"""
AI endpoints. One endpoint per feature.

POST /api/ai/headline-bio/
  Writes 3 headlines and 2 bios from the candidate's own profile.
  It only ANSWERS with text: nothing is saved. The candidate picks an option,
  edits it, and saves it with the normal "Save changes" button.

POST /api/ai/job-draft/
  Turns a recruiter's rough notes into a job title, description and skills.
  Also only answers: the draft fills the "Post a job" form, and nothing is
  posted until the recruiter presses "Post job".

Both share one daily limit per person (settings.AI_DAILY_LIMIT).
"""

import hashlib
import json

from django.conf import settings
from django.core.cache import cache
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from jobs.models import Job
from jobs.serializers import choice_values
from profiles.models import Profile
from profiles.permissions import is_approved_recruiter

from . import provider
from .models import AIDailyUsage

UNAVAILABLE_MESSAGE = "AI is unavailable right now."

# Asking again with the same facts reuses the last answer for this long,
# which doesn't call the AI and doesn't use up one of the daily uses.
RESULT_CACHE_SECONDS = 24 * 60 * 60

# Profile text has no length limit, and a long text makes the AI slow.
MAX_SKILLS = 50
MAX_EXPERIENCES = 15
MAX_DESCRIPTION_LENGTH = 1000

# The recruiter's rough notes for a job draft.
# Must match JOB_NOTES_MIN_LENGTH / JOB_NOTES_MAX_LENGTH in Frontend/app/config/constants.ts.
JOB_NOTES_MIN_LENGTH = 20
JOB_NOTES_MAX_LENGTH = 1000


class IsCandidate(BasePermission):
    message = "Only candidates can use this."

    def has_permission(self, request, view):
        profile = getattr(request.user, "profile", None)
        return profile is not None and profile.role == Profile.ROLE_CANDIDATE


class IsApprovedRecruiter(BasePermission):
    # Same people who can post a job (jobs/views.py), so nobody else uses up the AI.
    message = "Only approved recruiters can use this."

    def has_permission(self, request, view):
        return is_approved_recruiter(request.user)


def profile_facts(profile):
    """
    The ONLY data sent to the AI. Nothing else may be added here without a good
    reason: no email, no name, no CV, no messages, no other person's data.
    """
    skills = profile.skills.order_by("name")[:MAX_SKILLS]
    experiences = profile.experiences.order_by("id")[:MAX_EXPERIENCES]

    return {
        "current_headline": profile.headline,
        "location": profile.location,
        "open_to_work": profile.open_to_work,
        "skills": [skill.name for skill in skills],
        "experience": [
            {
                "title": experience.title,
                "company": experience.company,
                "location": experience.location,
                "start_date": experience.start_date,
                "end_date": experience.end_date,
                "current_job": experience.current,
                "description": experience.description[:MAX_DESCRIPTION_LENGTH],
            }
            for experience in experiences
        ],
    }


def cache_key_for(feature, user, facts):
    """Changes whenever the facts change, so edited facts get a fresh answer."""
    fingerprint = hashlib.sha256(json.dumps(facts, sort_keys=True).encode()).hexdigest()
    return f"ai:{feature}:{user.pk}:{fingerprint}"


def take_one_use(user, day):
    """Count one AI use. Returns False if today's uses have run out."""
    AIDailyUsage.objects.get_or_create(user=user, day=day)
    # The database checks the limit and adds 1 in one step, so two requests at
    # the same moment can't both take the last use.
    updated = AIDailyUsage.objects.filter(
        user=user, day=day, count__lt=settings.AI_DAILY_LIMIT
    ).update(count=F("count") + 1)
    return updated == 1


def give_back_one_use(user, day):
    """A failed AI call shouldn't cost the person one of their uses."""
    AIDailyUsage.objects.filter(user=user, day=day, count__gt=0).update(count=F("count") - 1)


def answer_with_ai(user, feature, facts, write):
    """
    The steps every AI button shares: reuse a saved answer, check the daily
    limit, call the AI (`write`), and give the use back if the AI fails.
    """
    cache_key = cache_key_for(feature, user, facts)
    saved_answer = cache.get(cache_key)
    if saved_answer is not None:
        return Response(saved_answer)

    if not provider.is_configured():
        return Response({"message": UNAVAILABLE_MESSAGE}, status=503)

    today = timezone.now().date()
    if not take_one_use(user, today):
        return Response(
            {"message": f"You've used all {settings.AI_DAILY_LIMIT} AI uses for today. Please try again tomorrow."},
            status=429,
        )

    try:
        answer = write(facts)
    except provider.AIUnavailable:
        give_back_one_use(user, today)
        return Response({"message": UNAVAILABLE_MESSAGE}, status=503)

    cache.set(cache_key, answer, RESULT_CACHE_SECONDS)
    return Response(answer)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsCandidate])
def headline_bio_view(request):
    facts = profile_facts(request.user.profile)

    # With nothing to go on, the AI could only make things up.
    if not (facts["current_headline"] or facts["skills"] or facts["experience"]):
        return Response(
            {"message": "Add a skill or a job to your profile first, so the AI has something to write about."},
            status=400,
        )

    return answer_with_ai(request.user, "headline-bio", facts, provider.write_headline_and_bios)


class JobDraftSerializer(serializers.Serializer):
    """
    What the "Write with AI" box on the job form sends.
    Field names must match askForJobDraft in Frontend/app/services/jobs.ts.
    """

    notes = serializers.CharField(max_length=JOB_NOTES_MAX_LENGTH, trim_whitespace=True)
    employmentType = serializers.ChoiceField(choices=choice_values(Job.TYPE_CHOICES))
    workStyle = serializers.ChoiceField(choices=choice_values(Profile.WORK_STYLE_CHOICES))
    experienceLevel = serializers.ChoiceField(choices=choice_values(Profile.HIRING_LEVEL_CHOICES))
    location = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate_notes(self, value):
        # A few words aren't enough: the AI would have to make the job up.
        if len(value) < JOB_NOTES_MIN_LENGTH:
            raise serializers.ValidationError("Write a few more words about the job first.")
        return value


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedRecruiter])
def job_draft_view(request):
    serializer = JobDraftSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # The ONLY data sent to the AI: what the recruiter typed and picked.
    # No name, email or company details, so it can't copy them in wrongly.
    facts = {
        "notes": data["notes"],
        "job_type": dict(Job.TYPE_CHOICES)[data["employmentType"]],
        "work_style": dict(Profile.WORK_STYLE_CHOICES)[data["workStyle"]],
        "experience_level": dict(Profile.HIRING_LEVEL_CHOICES)[data["experienceLevel"]],
        "location": data.get("location", "").strip(),
    }

    def write(job_facts):
        return provider.write_job_draft(
            job_facts,
            title_max_length=Job.TITLE_MAX_LENGTH,
            description_max_length=Job.DESCRIPTION_MAX_LENGTH,
            max_skills=Job.MAX_SKILLS,
        )

    return answer_with_ai(request.user, "job-draft", facts, write)
