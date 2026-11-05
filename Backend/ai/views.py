"""
AI endpoints. One endpoint per feature.

POST /api/ai/headline-bio/
  Writes 3 headlines and 2 bios from the candidate's own profile.
  It only ANSWERS with text: nothing is saved. The candidate picks an option,
  edits it, and saves it with the normal "Save changes" button.
"""

import hashlib
import json

from django.conf import settings
from django.core.cache import cache
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from profiles.models import Profile

from . import provider
from .models import AIDailyUsage

UNAVAILABLE_MESSAGE = "AI is unavailable right now."

# Reopening the page with an unchanged profile reuses the last answer for this
# long, which doesn't call the AI and doesn't use up one of the daily uses.
RESULT_CACHE_SECONDS = 24 * 60 * 60

# Profile text has no length limit, so one huge profile could cost a lot per call.
MAX_SKILLS = 50
MAX_EXPERIENCES = 15
MAX_DESCRIPTION_LENGTH = 1000


class IsCandidate(BasePermission):
    message = "Only candidates can use this."

    def has_permission(self, request, view):
        profile = getattr(request.user, "profile", None)
        return profile is not None and profile.role == Profile.ROLE_CANDIDATE


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


def cache_key_for(user, facts):
    """Changes whenever the profile changes, so an edited profile gets a fresh answer."""
    fingerprint = hashlib.sha256(json.dumps(facts, sort_keys=True).encode()).hexdigest()
    return f"ai:headline-bio:{user.pk}:{fingerprint}"


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
    """A failed AI call shouldn't cost the candidate one of their uses."""
    AIDailyUsage.objects.filter(user=user, day=day, count__gt=0).update(count=F("count") - 1)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsCandidate])
def headline_bio_view(request):
    user = request.user
    facts = profile_facts(user.profile)

    # With nothing to go on, the AI could only make things up.
    if not (facts["current_headline"] or facts["skills"] or facts["experience"]):
        return Response(
            {"message": "Add a skill or a job to your profile first, so the AI has something to write about."},
            status=400,
        )

    cache_key = cache_key_for(user, facts)
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
        answer = provider.write_headline_and_bios(facts)
    except provider.AIUnavailable:
        give_back_one_use(user, today)
        return Response({"message": UNAVAILABLE_MESSAGE}, status=503)

    cache.set(cache_key, answer, RESULT_CACHE_SECONDS)
    return Response(answer)
