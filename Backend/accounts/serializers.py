from rest_framework import serializers
from django.contrib.auth.models import User
from profiles.constants import MAX_CV_FILE_SIZE_BYTES
from profiles.models import Profile
from profiles.pdf_metadata import apply_cv_pdf_metadata
from profiles.url_utils import normalize_url
from .models import AdminActionLog


def get_user_profile(user):
    try:
        return user.profile
    except Profile.DoesNotExist:
        return None


class SignupSerializer(serializers.Serializer):
    ROLE_CHOICES = ("candidate", "recruiter")

    fullName = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=ROLE_CHOICES, default="candidate")
    linkedinUrl = serializers.CharField(required=False, allow_blank=True)
    companyName = serializers.CharField(required=False, allow_blank=True)
    companyWebsite = serializers.CharField(required=False, allow_blank=True)
    companyLocation = serializers.CharField(required=False, allow_blank=True)
    hiringTitle = serializers.CharField(required=False, allow_blank=True)
    cvFile = serializers.FileField(required=False)

    def validate_email(self, value):
        email = value.lower()

        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("Email already exists")

        return email

    def validate_cvFile(self, value):
        if value.content_type != "application/pdf":
            raise serializers.ValidationError("Only PDF files are accepted")

        if value.size > MAX_CV_FILE_SIZE_BYTES:
            raise serializers.ValidationError("CV file must be less than 5MB")

        return value

    def validate_linkedinUrl(self, value):
        return normalize_url(value)

    def validate_companyWebsite(self, value):
        return normalize_url(value)

    def validate(self, attrs):
        role = attrs.get("role", Profile.ROLE_CANDIDATE)

        if role == Profile.ROLE_CANDIDATE and not attrs.get("cvFile"):
            raise serializers.ValidationError({"cvFile": "CV file is required"})

        if role == Profile.ROLE_CANDIDATE and not attrs.get("linkedinUrl", "").strip():
            raise serializers.ValidationError(
                {"linkedinUrl": "LinkedIn profile is required"}
            )

        if role == Profile.ROLE_RECRUITER and not attrs.get("companyName", "").strip():
            raise serializers.ValidationError({"companyName": "Company name is required"})

        return attrs

    def create(self, validated_data):
        full_name = validated_data["fullName"].strip()
        email = validated_data["email"]
        password = validated_data["password"]
        role = validated_data["role"]
        cv_file = validated_data.get("cvFile")

        name_parts = full_name.split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        if cv_file:
            cv_file = apply_cv_pdf_metadata(cv_file, full_name)

        Profile.objects.create(
            user=user,
            role=role,
            linkedin_url=validated_data.get("linkedinUrl", ""),
            company_name=validated_data.get("companyName", ""),
            company_website=validated_data.get("companyWebsite", ""),
            company_location=validated_data.get("companyLocation", ""),
            hiring_title=validated_data.get("hiringTitle", ""),
            recruiter_verification_status=Profile.RECRUITER_VERIFICATION_PENDING
            if role == Profile.ROLE_RECRUITER
            else Profile.RECRUITER_VERIFICATION_APPROVED,
            cv_file=cv_file,
        )

        return user


class SigninSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        return value.lower()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_email(self, value):
        return value.lower()

    def validate_otp(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("OTP must contain only numbers")

        return value


class EmailVerificationRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower()


class EmailVerificationConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate_email(self, value):
        return value.lower()

    def validate_otp(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("OTP must contain only numbers")

        return value


class RecruiterVerificationSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            Profile.RECRUITER_VERIFICATION_APPROVED,
            Profile.RECRUITER_VERIFICATION_REJECTED,
        ]
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class AdminUserSerializer(serializers.ModelSerializer):
    fullName = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    profileCompletion = serializers.SerializerMethodField()
    skillsCount = serializers.SerializerMethodField()
    projectsCount = serializers.SerializerMethodField()
    experiencesCount = serializers.SerializerMethodField()
    connectionsCount = serializers.SerializerMethodField()
    recruiterVerificationStatus = serializers.SerializerMethodField()
    recruiterVerificationNote = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "fullName",
            "role",
            "is_active",
            "is_staff",
            "date_joined",
            "last_login",
            "profileCompletion",
            "skillsCount",
            "projectsCount",
            "experiencesCount",
            "connectionsCount",
            "recruiterVerificationStatus",
            "recruiterVerificationNote",
        ]

    def get_fullName(self, obj):
        return obj.get_full_name() or obj.email

    def get_role(self, obj):
        if obj.is_staff:
            return Profile.ROLE_ADMIN

        profile = get_user_profile(obj)
        return profile.role if profile else Profile.ROLE_CANDIDATE

    def get_profileCompletion(self, obj):
        profile = get_user_profile(obj)

        if not profile:
            return 0

        missing_fields = []

        if not obj.get_full_name():
            missing_fields.append("full_name")

        if profile.role == Profile.ROLE_ADMIN:
            if not profile.admin_title:
                missing_fields.append("admin_title")

            total_fields = 2
            completed_fields = max(total_fields - len(missing_fields), 0)
            return int((completed_fields / total_fields) * 100)

        if profile.role == Profile.ROLE_RECRUITER:
            if not profile.headline:
                missing_fields.append("headline")

            if not profile.company_name:
                missing_fields.append("company_name")

            if not profile.hiring_title:
                missing_fields.append("hiring_title")

            if not profile.company_website:
                missing_fields.append("company_website")

            total_fields = 5
            completed_fields = max(total_fields - len(missing_fields), 0)
            return int((completed_fields / total_fields) * 100)

        if not profile.headline:
            missing_fields.append("headline")

        if not profile.location:
            missing_fields.append("location")

        if not profile.bio:
            missing_fields.append("bio")

        if not profile.linkedin_url:
            missing_fields.append("linkedin_url")

        if not profile.cv_file:
            missing_fields.append("cv_file")

        if self.get_skillsCount(obj) == 0:
            missing_fields.append("skills")

        if self.get_projectsCount(obj) == 0:
            missing_fields.append("projects")

        if self.get_experiencesCount(obj) == 0:
            missing_fields.append("experiences")

        total_fields = 9
        completed_fields = max(total_fields - len(missing_fields), 0)

        return int((completed_fields / total_fields) * 100)

    def get_skillsCount(self, obj):
        return getattr(obj, "skills_count", 0)

    def get_projectsCount(self, obj):
        return getattr(obj, "projects_count", 0)

    def get_experiencesCount(self, obj):
        return getattr(obj, "experiences_count", 0)

    def get_connectionsCount(self, obj):
        return getattr(obj, "connections_count", 0)

    def get_recruiterVerificationStatus(self, obj):
        profile = get_user_profile(obj)
        return (
            profile.recruiter_verification_status
            if profile
            else Profile.RECRUITER_VERIFICATION_APPROVED
        )

    def get_recruiterVerificationNote(self, obj):
        profile = get_user_profile(obj)
        return profile.recruiter_verification_note if profile else ""


class AdminActionLogSerializer(serializers.ModelSerializer):
    actorName = serializers.SerializerMethodField()
    actorEmail = serializers.EmailField(source="actor.email", read_only=True)
    targetUserName = serializers.SerializerMethodField()
    targetUserEmail = serializers.EmailField(source="target_user.email", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = AdminActionLog
        fields = [
            "id",
            "actorName",
            "actorEmail",
            "targetUserName",
            "targetUserEmail",
            "action",
            "description",
            "metadata",
            "createdAt",
        ]

    def get_actorName(self, obj):
        if not obj.actor:
            return "System"

        return obj.actor.get_full_name() or obj.actor.email or obj.actor.username

    def get_targetUserName(self, obj):
        if not obj.target_user:
            return ""

        return (
            obj.target_user.get_full_name()
            or obj.target_user.email
            or obj.target_user.username
        )
