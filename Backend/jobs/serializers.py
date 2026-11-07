"""
Serializers for job posts.

Field names MUST match Frontend/app/services/jobs.ts (Job, JobInput).
"""

from rest_framework import serializers

from profiles.models import Profile
from profiles.serializers import RecruiterListField

from .models import Job


def choice_values(choices):
    return [value for value, _label in choices]


class JobSerializer(serializers.ModelSerializer):
    """
    One job, as everyone sees it. The admin's "hidden" reason is only sent to
    the recruiter who posted it and to admins (the view passes show_private).
    """

    employmentType = serializers.CharField(source="employment_type", read_only=True)
    workStyle = serializers.CharField(source="work_style", read_only=True)
    experienceLevel = serializers.CharField(source="experience_level", read_only=True)
    hiddenByAdmin = serializers.SerializerMethodField()
    hiddenReason = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    recruiter = serializers.SerializerMethodField()
    isMine = serializers.SerializerMethodField()
    skillMatch = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id",
            "title",
            "employmentType",
            "workStyle",
            "experienceLevel",
            "location",
            "salary",
            "description",
            "skills",
            "status",
            "hiddenByAdmin",
            "hiddenReason",
            "createdAt",
            "updatedAt",
            "recruiter",
            "isMine",
            "skillMatch",
        ]

    def _viewer(self):
        request = self.context.get("request")
        return request.user if request else None

    def _show_private(self, job):
        viewer = self._viewer()
        return bool(viewer and (viewer.pk == job.recruiter_id or self.context.get("is_admin")))

    def get_hiddenByAdmin(self, job):
        return job.hidden_by_admin if self._show_private(job) else False

    def get_hiddenReason(self, job):
        return job.hidden_reason if self._show_private(job) else ""

    def get_isMine(self, job):
        viewer = self._viewer()
        return bool(viewer and viewer.pk == job.recruiter_id)

    def get_skillMatch(self, job):
        """
        Which of the job's skills the viewing candidate has, and which they're
        missing. Plain matching, no AI: free, instant, and it can't make things up.
        None for recruiters and admins, and for jobs that list no skills.
        """
        my_skills = self.context.get("my_skills")
        if my_skills is None or not job.skills:
            return None
        return {
            "matched": [skill for skill in job.skills if skill.lower() in my_skills],
            "missing": [skill for skill in job.skills if skill.lower() not in my_skills],
        }

    def get_recruiter(self, job):
        """Who posted it. The views load recruiter + profile in the same trip."""
        user = job.recruiter
        profile = getattr(user, "profile", None)
        return {
            "id": user.pk,
            "name": user.get_full_name() or "Recruiter",
            "title": profile.hiring_title if profile else "",
            "companyName": profile.company_name if profile else "",
            "companyIndustry": profile.company_industry if profile else "",
            "companyWebsite": profile.company_website if profile else "",
        }


class JobInputSerializer(serializers.Serializer):
    """What the recruiter's "Post a job" form sends (JSON)."""

    title = serializers.CharField(max_length=Job.TITLE_MAX_LENGTH)
    employmentType = serializers.ChoiceField(choices=choice_values(Job.TYPE_CHOICES))
    workStyle = serializers.ChoiceField(choices=choice_values(Profile.WORK_STYLE_CHOICES))
    experienceLevel = serializers.ChoiceField(choices=choice_values(Profile.HIRING_LEVEL_CHOICES))
    location = serializers.CharField(required=False, allow_blank=True, max_length=255)
    salary = serializers.CharField(required=False, allow_blank=True, max_length=Job.SALARY_MAX_LENGTH)
    description = serializers.CharField(max_length=Job.DESCRIPTION_MAX_LENGTH)
    skills = RecruiterListField(max_items=Job.MAX_SKILLS, required=False)
    status = serializers.ChoiceField(choices=choice_values(Job.STATUS_CHOICES), required=False)

    FIELD_MAP = {
        "title": "title",
        "employmentType": "employment_type",
        "workStyle": "work_style",
        "experienceLevel": "experience_level",
        "location": "location",
        "salary": "salary",
        "description": "description",
        "skills": "skills",
        "status": "status",
    }

    def validate_title(self, value):
        value = " ".join(value.split())
        if len(value) < 3:
            raise serializers.ValidationError("Give the job a clear title.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if len(value) < 30:
            raise serializers.ValidationError("Describe the job in a few sentences (at least 30 characters).")
        return value

    def validate(self, attrs):
        # On-site and hybrid jobs need a place; remote jobs don't.
        work_style = attrs.get("workStyle", getattr(self.instance, "work_style", None))
        location = attrs.get("location", getattr(self.instance, "location", ""))
        if work_style in ("onsite", "hybrid") and not (location or "").strip():
            raise serializers.ValidationError("Add a location for on-site and hybrid jobs.")
        return attrs

    def save_to(self, job):
        """Copy the checked values onto `job` (new or existing) and save it."""
        for frontend_name, column in self.FIELD_MAP.items():
            if frontend_name in self.validated_data:
                value = self.validated_data[frontend_name]
                setattr(job, column, value.strip() if isinstance(value, str) else value)
        job.save()
        return job


class JobVisibilitySerializer(serializers.Serializer):
    """Admin: hide or show a job. Hiding needs a reason (the recruiter sees it)."""

    hidden = serializers.BooleanField()
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255, trim_whitespace=True)

    def validate(self, attrs):
        attrs["reason"] = attrs.get("reason", "")
        if attrs["hidden"] and not attrs["reason"]:
            raise serializers.ValidationError("Please give a reason (the recruiter will see it).")
        return attrs
