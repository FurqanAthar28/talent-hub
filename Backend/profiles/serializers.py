"""
Serializers for the profiles app.

ProfileSerializer        -> turns a Profile into JSON (read only)
ProfileUpdateSerializer  -> checks + saves the "Edit profile" form
SkillSerializer, ProjectSerializer, ExperienceSerializer, ActivitySerializer
"""

from django.db import transaction
from rest_framework import serializers

from .models import Activity, Experience, Profile, Project, Skill
from .pdf_metadata import apply_cv_pdf_metadata
from .url_utils import normalize_url
from .utils import calculate_profile_completion, get_completion_checklist, get_missing_fields
from .validators import validate_cv_file

# Database limits. Sending more than this would crash the save,
# so we stop it here with a friendly message instead.
NAME_MAX_LENGTH = 150  # Django's first_name / last_name limit
TEXT_MAX_LENGTH = 255
URL_MAX_LENGTH = 200  # Django's URLField limit
MAX_TECH_STACK_ITEMS = 20


def split_full_name(full_name):
    """
    "Ali Raza Khan" -> ("Ali", "Raza Khan").
    split(maxsplit=1) also handles extra spaces: "Ali   Khan" -> ("Ali", "Khan").
    """
    parts = full_name.split(maxsplit=1)
    first_name = parts[0] if parts else ""
    last_name = parts[1] if len(parts) > 1 else ""
    return first_name, last_name


# =============================================================================
# PROFILE (reading)
# =============================================================================


class ProfileSerializer(serializers.ModelSerializer):
    """
    A profile as JSON.

    PRIVATE fields (email, the admin's verification note) are only shown
    to the profile's owner and to staff. The view tells us who is looking
    by passing context={"show_private": True or False}.
    """

    fullName = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    linkedinUrl = serializers.CharField(source="linkedin_url", read_only=True)
    githubUrl = serializers.CharField(source="github_url", read_only=True)
    portfolioUrl = serializers.CharField(source="portfolio_url", read_only=True)
    companyName = serializers.CharField(source="company_name", read_only=True)
    companyWebsite = serializers.CharField(source="company_website", read_only=True)
    companyLocation = serializers.CharField(source="company_location", read_only=True)
    hiringTitle = serializers.CharField(source="hiring_title", read_only=True)
    adminTitle = serializers.CharField(source="admin_title", read_only=True)
    openToWork = serializers.BooleanField(source="open_to_work", read_only=True)
    approvalStatus = serializers.CharField(source="approval_status", read_only=True)
    rejectionReason = serializers.SerializerMethodField()
    approvalMissing = serializers.SerializerMethodField()
    cvUrl = serializers.SerializerMethodField()
    profileCompletion = serializers.SerializerMethodField()
    missingFields = serializers.SerializerMethodField()
    completionChecklist = serializers.SerializerMethodField()
    profileViewers = serializers.SerializerMethodField()
    skillsCount = serializers.SerializerMethodField()
    projectsCount = serializers.SerializerMethodField()
    experiencesCount = serializers.SerializerMethodField()
    connectionsCount = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "role",
            "fullName",
            "email",
            "headline",
            "location",
            "bio",
            "linkedinUrl",
            "githubUrl",
            "portfolioUrl",
            "companyName",
            "companyWebsite",
            "companyLocation",
            "hiringTitle",
            "adminTitle",
            "cvUrl",
            "profileCompletion",
            "profileViewers",
            "openToWork",
            "approvalStatus",
            "rejectionReason",
            "approvalMissing",
            "missingFields",
            "completionChecklist",
            "skillsCount",
            "projectsCount",
            "experiencesCount",
            "connectionsCount",
        ]

    def show_private(self):
        return self.context.get("show_private", False)

    def get_fullName(self, obj):
        return obj.user.get_full_name() or "Member"

    def get_email(self, obj):
        return obj.user.email if self.show_private() else ""

    def get_rejectionReason(self, obj):
        """Only the person themselves (and admins) see WHY they weren't approved."""
        return obj.rejection_reason if self.show_private() else ""

    def get_approvalMissing(self, obj):
        """What they still have to add before an admin can approve them (owner only)."""
        if not self.show_private() or obj.approval_status == Profile.APPROVAL_APPROVED:
            return []
        from .approval import missing_profile_parts  # late import: approval imports models

        return missing_profile_parts(obj)

    def get_cvUrl(self, obj):
        """
        The address to DOWNLOAD the CV, for example "/profiles/42/cv/".
        Empty if there is no CV, or if this viewer may not see it
        (the view decides and passes context={"show_cv": True/False}).
        """
        if not obj.cv_file or not self.context.get("show_cv", False):
            return ""
        return f"/profiles/{obj.user_id}/cv/"

    def get_profileCompletion(self, obj):
        return calculate_profile_completion(obj)

    def get_missingFields(self, obj):
        return get_missing_fields(obj)

    def get_completionChecklist(self, obj):
        """
        Every checklist item, done or not, e.g.
        [{"label": "Headline", "done": True}, {"label": "CV", "done": False}]
        The dashboard draws its progress bar from this, so the rules
        live ONLY here in Django (never copied into the frontend).
        """
        return [
            {"label": label, "done": done}
            for label, done in get_completion_checklist(obj)
        ]

    # The counts all come from profile.related_counts, which asks the
    # database only ONCE per profile (see models.py).
    def get_profileViewers(self, obj):
        return obj.related_counts["viewers"]

    def get_skillsCount(self, obj):
        return obj.related_counts["skills"]

    def get_projectsCount(self, obj):
        return obj.related_counts["projects"]

    def get_experiencesCount(self, obj):
        return obj.related_counts["experiences"]

    def get_connectionsCount(self, obj):
        if obj.role == Profile.ROLE_ADMIN:
            return 0
        return obj.related_counts["connections"]


# =============================================================================
# PROFILE (editing)
# =============================================================================


class ProfileUpdateSerializer(serializers.Serializer):
    """
    The "Edit profile" form. Every field is optional (send only what changed).
    The names on the left are what the frontend sends (camelCase).
    """

    fullName = serializers.CharField(
        required=False, allow_blank=True, max_length=NAME_MAX_LENGTH
    )
    headline = serializers.CharField(
        required=False, allow_blank=True, max_length=TEXT_MAX_LENGTH
    )
    location = serializers.CharField(
        required=False, allow_blank=True, max_length=TEXT_MAX_LENGTH
    )
    bio = serializers.CharField(required=False, allow_blank=True)
    linkedinUrl = serializers.CharField(
        required=False, allow_blank=True, max_length=URL_MAX_LENGTH
    )
    githubUrl = serializers.CharField(
        required=False, allow_blank=True, max_length=URL_MAX_LENGTH
    )
    portfolioUrl = serializers.CharField(
        required=False, allow_blank=True, max_length=URL_MAX_LENGTH
    )
    companyName = serializers.CharField(
        required=False, allow_blank=True, max_length=TEXT_MAX_LENGTH
    )
    companyWebsite = serializers.CharField(
        required=False, allow_blank=True, max_length=URL_MAX_LENGTH
    )
    companyLocation = serializers.CharField(
        required=False, allow_blank=True, max_length=TEXT_MAX_LENGTH
    )
    hiringTitle = serializers.CharField(
        required=False, allow_blank=True, max_length=TEXT_MAX_LENGTH
    )
    adminTitle = serializers.CharField(
        required=False, allow_blank=True, max_length=TEXT_MAX_LENGTH
    )
    openToWork = serializers.BooleanField(required=False)
    cvFile = serializers.FileField(required=False)

    # Frontend name -> database column name.
    FIELD_MAP = {
        "headline": "headline",
        "location": "location",
        "bio": "bio",
        "linkedinUrl": "linkedin_url",
        "githubUrl": "github_url",
        "portfolioUrl": "portfolio_url",
        "companyName": "company_name",
        "companyWebsite": "company_website",
        "companyLocation": "company_location",
        "hiringTitle": "hiring_title",
        "adminTitle": "admin_title",
        "openToWork": "open_to_work",
    }

    # ----- Checks -----

    def validate_cvFile(self, value):
        return validate_cv_file(value)

    # normalize_url adds "https://" if missing and checks it's a real URL.
    def validate_linkedinUrl(self, value):
        return normalize_url(value)

    def validate_githubUrl(self, value):
        return normalize_url(value)

    def validate_portfolioUrl(self, value):
        return normalize_url(value)

    def validate_companyWebsite(self, value):
        return normalize_url(value)

    # ----- Saving -----

    def update(self, instance, validated_data):
        profile = instance
        user = profile.user
        old_cv_file = profile.cv_file.name if profile.cv_file else ""
        cv_storage = profile.cv_file.storage  # where CV files are kept

        # 1. Name lives on the User, not the Profile. A blank name is ignored.
        full_name = validated_data.get("fullName", "")
        if full_name:
            user.first_name, user.last_name = split_full_name(full_name)

        # 2. Copy every other field that was sent onto the profile.
        for frontend_name, column_name in self.FIELD_MAP.items():
            if frontend_name in validated_data:
                setattr(profile, column_name, validated_data[frontend_name])

        # 3. New CV? Put the person's name inside the PDF, then attach it.
        new_cv = validated_data.get("cvFile")
        if new_cv:
            person_name = user.get_full_name() or user.email
            profile.cv_file = apply_cv_pdf_metadata(new_cv, person_name)

        # Save the user and profile together (both or neither).
        with transaction.atomic():
            if full_name:
                user.save(update_fields=["first_name", "last_name"])
            profile.save()

        # 4. Delete the OLD CV file from disk, so old CVs don't pile up
        #    (and can't be downloaded any more).
        if new_cv and old_cv_file and old_cv_file != profile.cv_file.name:
            cv_storage.delete(old_cv_file)

        return profile


# =============================================================================
# SKILLS, PROJECTS, EXPERIENCE, ACTIVITY
# =============================================================================


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ["id", "title", "created_at"]


class SkillSerializer(serializers.ModelSerializer):
    """
    The view must pass context={"profile": profile}, so we can check the
    user doesn't already have this skill.
    """

    class Meta:
        model = Skill
        fields = ["id", "name"]

    def validate_name(self, value):
        # (DRF already removed spaces at the start and end.)
        profile = self.context["profile"]

        # iexact = ignore upper/lower case, so "python" = "Python".
        if profile.skills.filter(name__iexact=value).exists():
            raise serializers.ValidationError("You already added this skill")

        return value


class ProjectSerializer(serializers.ModelSerializer):
    # A list of short words like ["Django", "React"].
    # allow_blank=True lets us quietly drop empty items below.
    tech_stack = serializers.ListField(
        child=serializers.CharField(max_length=50, allow_blank=True),
        required=False,
        max_length=MAX_TECH_STACK_ITEMS,
    )
    # CharField (not URLField) so "github.com/me/app" is accepted
    # and fixed up by normalize_url.
    github_url = serializers.CharField(
        required=False, allow_blank=True, max_length=URL_MAX_LENGTH
    )

    class Meta:
        model = Project
        fields = ["id", "title", "description", "tech_stack", "github_url"]

    def validate_tech_stack(self, value):
        # Drop empty items: ["Django", "", "React"] -> ["Django", "React"]
        return [item for item in value if item]

    def validate_github_url(self, value):
        return normalize_url(value)


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = [
            "id",
            "title",
            "company",
            "location",
            "start_date",
            "end_date",
            "current",
            "description",
        ]

    def validate(self, attrs):
        # "I still work here" means there is no end date.
        if attrs.get("current"):
            attrs["end_date"] = ""
        return attrs
