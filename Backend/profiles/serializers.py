from rest_framework import serializers
from django.conf import settings
from .constants import MAX_CV_FILE_SIZE_BYTES
from .models import Activity, Profile, Skill, Project, Experience
from .pdf_metadata import apply_cv_pdf_metadata
from .url_utils import normalize_url


class ProfileSerializer(serializers.ModelSerializer):
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
    cvUrl = serializers.SerializerMethodField()
    profileCompletion = serializers.SerializerMethodField()
    profileViewers = serializers.SerializerMethodField()
    openToWork = serializers.BooleanField(source="open_to_work", read_only=True)
    recruiterVerificationStatus = serializers.CharField(
        source="recruiter_verification_status",
        read_only=True,
    )
    recruiterVerificationNote = serializers.CharField(
        source="recruiter_verification_note",
        read_only=True,
    )
    missingFields = serializers.SerializerMethodField()
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
            "recruiterVerificationStatus",
            "recruiterVerificationNote",
            "missingFields",
            "skillsCount",
            "projectsCount",
            "experiencesCount",
            "connectionsCount",
        ]

    def get_fullName(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_email(self, obj):
        return obj.user.email

    def get_cvUrl(self, obj):
        if obj.cv_file:
            cv_path = (obj.cv_file.name or "").replace("\\", "/").lstrip("/")
            media_prefix = settings.MEDIA_URL.strip("/")

            while media_prefix and cv_path.startswith(f"{media_prefix}/"):
                cv_path = cv_path[len(media_prefix) + 1 :]

            return cv_path

        return ""

    def get_missingFields(self, obj):
        missing = []

        if not obj.user.get_full_name():
            missing.append("Full name")

        if obj.role == Profile.ROLE_ADMIN:
            if not obj.admin_title:
                missing.append("Admin title")

            return missing

        if obj.role == Profile.ROLE_RECRUITER:
            if not obj.headline:
                missing.append("Recruiter headline")

            if not obj.company_name:
                missing.append("Company name")

            if not obj.hiring_title:
                missing.append("Hiring title")

            if not obj.company_website:
                missing.append("Company website")

            return missing

        if not obj.headline:
            missing.append("Headline")

        if not obj.location:
            missing.append("Location")

        if not obj.bio:
            missing.append("Bio")

        if not obj.linkedin_url:
            missing.append("LinkedIn profile")

        if not obj.cv_file:
            missing.append("CV")

        if obj.skills.count() == 0:
            missing.append("Skills")

        if obj.projects.count() == 0:
            missing.append("Projects")

        if obj.experiences.count() == 0:
            missing.append("Experience")

        return missing

    def get_profileCompletion(self, obj):
        if obj.role == Profile.ROLE_ADMIN:
            total = 2
        elif obj.role == Profile.ROLE_RECRUITER:
            total = 5
        else:
            total = 9

        completed = total - len(self.get_missingFields(obj))

        return int((completed / total) * 100)

    def get_skillsCount(self, obj):
        return obj.skills.count()

    def get_projectsCount(self, obj):
        return obj.projects.count()

    def get_experiencesCount(self, obj):
        return obj.experiences.count()

    def get_connectionsCount(self, obj):
        if obj.role == Profile.ROLE_ADMIN:
            return 0

        from connections.models import Connection

        return Connection.objects.filter(user=obj.user).count()

    def get_profileViewers(self, obj):
        return obj.views.count()


class ProfileUpdateSerializer(serializers.Serializer):
    fullName = serializers.CharField(required=False, allow_blank=True)
    headline = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    linkedinUrl = serializers.CharField(required=False, allow_blank=True)
    githubUrl = serializers.CharField(required=False, allow_blank=True)
    portfolioUrl = serializers.CharField(required=False, allow_blank=True)
    companyName = serializers.CharField(required=False, allow_blank=True)
    companyWebsite = serializers.CharField(required=False, allow_blank=True)
    companyLocation = serializers.CharField(required=False, allow_blank=True)
    hiringTitle = serializers.CharField(required=False, allow_blank=True)
    adminTitle = serializers.CharField(required=False, allow_blank=True)
    openToWork = serializers.BooleanField(required=False)
    cvFile = serializers.FileField(required=False)

    def validate_cvFile(self, value):
        if value.content_type != "application/pdf":
            raise serializers.ValidationError("Only PDF files are accepted")

        if value.size > MAX_CV_FILE_SIZE_BYTES:
            raise serializers.ValidationError("CV file must be less than 5MB")

        return value

    def validate_linkedinUrl(self, value):
        return normalize_url(value)

    def validate_githubUrl(self, value):
        return normalize_url(value)

    def validate_portfolioUrl(self, value):
        return normalize_url(value)

    def validate_companyWebsite(self, value):
        return normalize_url(value)

    def update(self, instance, validated_data):
        user = instance.user
        full_name = validated_data.pop("fullName", None)

        if full_name is not None:
            full_name = full_name.strip()

            if full_name:
                name_parts = full_name.split(" ", 1)
                user.first_name = name_parts[0]
                user.last_name = name_parts[1] if len(name_parts) > 1 else ""
                user.save()

        if "cvFile" in validated_data:
            person_name = user.get_full_name() or user.email
            validated_data["cvFile"] = apply_cv_pdf_metadata(
                validated_data["cvFile"],
                person_name,
            )

        field_map = {
            "linkedinUrl": "linkedin_url",
            "githubUrl": "github_url",
            "portfolioUrl": "portfolio_url",
            "companyName": "company_name",
            "companyWebsite": "company_website",
            "companyLocation": "company_location",
            "hiringTitle": "hiring_title",
            "adminTitle": "admin_title",
            "openToWork": "open_to_work",
            "cvFile": "cv_file",
        }

        for field, value in validated_data.items():
            model_field = field_map.get(field, field)
            setattr(instance, model_field, value)

        instance.save()
        return instance


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ["id", "title", "created_at"]


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ["id", "name"]

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Skill name is required")

        return value


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "title",
            "description",
            "tech_stack",
            "github_url",
        ]

    def validate_title(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Project title is required")

        return value

    def validate_tech_stack(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Tech stack must be a list")

        return [str(item).strip() for item in value if str(item).strip()]


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

    def validate_title(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Experience title is required")

        return value

    def validate_company(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Company is required")

        return value
