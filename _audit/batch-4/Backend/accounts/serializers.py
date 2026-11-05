"""
Serializers for the accounts app.

A serializer is a "form checker" for the API. It takes the JSON (or form
data) the browser sent, checks every field, and gives the view clean,
safe values in `serializer.validated_data`. If something is wrong, it
fills `serializer.errors` instead.

WHAT'S IN THIS FILE
1. Messages and reusable fields
2. Sign-up                 (SignupSerializer)
3. Sign-in                 (SigninSerializer)
4. Email verification      (EmailVerification...Serializer)
5. Password reset          (PasswordReset...Serializer)
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

from profiles.constants import MAX_CV_FILE_SIZE_BYTES
from profiles.models import Profile
from profiles.pdf_metadata import apply_cv_pdf_metadata
from profiles.url_utils import normalize_url

User = get_user_model()


# =============================================================================
# 1. MESSAGES AND REUSABLE FIELDS
# =============================================================================

# Turn 5242880 bytes into "5" so the message always matches the real limit.
MAX_CV_FILE_SIZE_MB = MAX_CV_FILE_SIZE_BYTES // (1024 * 1024)

VALIDATION_MESSAGES = {
    "email_exists": "Email already exists",
    "pdf_only": "Only PDF files are accepted",
    "cv_too_large": f"CV file must be {MAX_CV_FILE_SIZE_MB}MB or smaller",
    "cv_required": "CV file is required",
    "linkedin_required": "LinkedIn profile is required",
    "company_name_required": "Company name is required",
    "otp_format": "OTP must be exactly 6 numbers",
}

# Every real PDF file starts with these 5 bytes.
PDF_FILE_START = b"%PDF-"

# Database limits. Sending more than this would crash the save,
# so we stop it here with a friendly message instead.
NAME_MAX_LENGTH = 150  # Django's first_name / last_name limit
TEXT_MAX_LENGTH = 255  # company name, location, hiring title
URL_MAX_LENGTH = 200  # Django's URLField limit


class LowercaseEmailField(serializers.EmailField):
    """
    An email field that always gives back lower-case text.
    "Ali@Example.COM" -> "ali@example.com", so one person can't
    end up with two accounts just by typing capital letters.
    """

    def to_internal_value(self, data):
        return super().to_internal_value(data).lower()


class OtpField(serializers.RegexField):
    """
    A 6-digit code field. The pattern ^\\d{6}$ means
    "exactly 6 numbers, nothing before, nothing after".
    """

    def __init__(self, **kwargs):
        super().__init__(
            regex=r"^\d{6}$",
            error_messages={"invalid": VALIDATION_MESSAGES["otp_format"]},
            **kwargs,
        )


def check_password_rules(password, user=None):
    """
    Check a new password against the rules in settings.AUTH_PASSWORD_VALIDATORS
    (at least 8 characters, not too common, not only numbers, not too
    similar to the user's name or email).
    """
    try:
        validate_password(password, user=user)
    except DjangoValidationError as error:
        # Django gives a list of problems. DRF wants them as its own error type.
        raise serializers.ValidationError(list(error.messages)) from None


def split_full_name(full_name):
    """
    "Ali Raza Khan" -> ("Ali", "Raza Khan")
    "Ali"           -> ("Ali", "")
    split(maxsplit=1) also handles extra spaces: "Ali   Khan" -> ("Ali", "Khan").
    """
    parts = full_name.split(maxsplit=1)
    first_name = parts[0] if parts else ""
    last_name = parts[1] if len(parts) > 1 else ""
    return first_name, last_name


# =============================================================================
# 2. SIGN-UP
# =============================================================================


class SignupSerializer(serializers.Serializer):
    """
    Checks the sign-up form and creates the user + profile.

    Candidates must send a CV (PDF) and a LinkedIn URL.
    Recruiters must send a company name.
    """

    fullName = serializers.CharField(max_length=NAME_MAX_LENGTH)
    email = LowercaseEmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(
        choices=[Profile.ROLE_CANDIDATE, Profile.ROLE_RECRUITER],
        default=Profile.ROLE_CANDIDATE,
    )
    linkedinUrl = serializers.CharField(
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
    cvFile = serializers.FileField(required=False)

    # ----- Checks for single fields (DRF runs "validate_<field name>") -----

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(VALIDATION_MESSAGES["email_exists"])
        return value

    def validate_cvFile(self, value):
        if value.size > MAX_CV_FILE_SIZE_BYTES:
            raise serializers.ValidationError(VALIDATION_MESSAGES["cv_too_large"])

        # The browser's "content type" label can be faked, so we ALSO look
        # at the first bytes of the file itself.
        value.seek(0)
        file_start = value.read(len(PDF_FILE_START))
        value.seek(0)  # rewind, so the file can be read again later

        if value.content_type != "application/pdf" or file_start != PDF_FILE_START:
            raise serializers.ValidationError(VALIDATION_MESSAGES["pdf_only"])

        return value

    def validate_linkedinUrl(self, value):
        # normalize_url adds "https://" if missing and checks it's a real URL.
        return normalize_url(value)

    def validate_companyWebsite(self, value):
        return normalize_url(value)

    # ----- Checks that need more than one field -----

    def validate(self, attrs):
        role = attrs["role"]

        if role == Profile.ROLE_CANDIDATE:
            if not attrs.get("cvFile"):
                raise serializers.ValidationError(
                    {"cvFile": VALIDATION_MESSAGES["cv_required"]}
                )
            if not attrs.get("linkedinUrl"):
                raise serializers.ValidationError(
                    {"linkedinUrl": VALIDATION_MESSAGES["linkedin_required"]}
                )

        if role == Profile.ROLE_RECRUITER and not attrs.get("companyName"):
            raise serializers.ValidationError(
                {"companyName": VALIDATION_MESSAGES["company_name_required"]}
            )

        # Check the password here (not in validate_password) because the
        # "not too similar to your name/email" rule needs the name and email.
        # This User is only for the check. It is NOT saved.
        first_name, last_name = split_full_name(attrs["fullName"])
        user_for_check = User(
            username=attrs["email"],
            email=attrs["email"],
            first_name=first_name,
            last_name=last_name,
        )
        try:
            check_password_rules(attrs["password"], user=user_for_check)
        except serializers.ValidationError as error:
            raise serializers.ValidationError({"password": error.detail}) from None

        return attrs

    # ----- Saving -----

    def create(self, validated_data):
        """Make the user and their profile. Both start "not verified"."""
        full_name = validated_data["fullName"]
        email = validated_data["email"]
        role = validated_data["role"]
        first_name, last_name = split_full_name(full_name)

        # Put the person's name inside the PDF's details (title, author).
        cv_file = validated_data.get("cvFile")
        if cv_file:
            cv_file = apply_cv_pdf_metadata(cv_file, full_name)

        # Recruiters must be approved by an admin. Candidates don't.
        if role == Profile.ROLE_RECRUITER:
            verification_status = Profile.RECRUITER_VERIFICATION_PENDING
        else:
            verification_status = Profile.RECRUITER_VERIFICATION_APPROVED

        try:
            # atomic = save BOTH the user and the profile, or NEITHER.
            # We never want a user without a profile.
            with transaction.atomic():
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    password=validated_data["password"],
                    first_name=first_name,
                    last_name=last_name,
                    # Switched off until they type the code from their email.
                    is_active=False,
                )
                Profile.objects.create(
                    user=user,
                    role=role,
                    email_verified=False,
                    linkedin_url=validated_data.get("linkedinUrl", ""),
                    company_name=validated_data.get("companyName", ""),
                    company_website=validated_data.get("companyWebsite", ""),
                    company_location=validated_data.get("companyLocation", ""),
                    hiring_title=validated_data.get("hiringTitle", ""),
                    recruiter_verification_status=verification_status,
                    cv_file=cv_file,
                )
        except IntegrityError:
            # Two sign-ups with the same email at the same moment:
            # validate_email passed for both, but the database allows only one.
            raise serializers.ValidationError(
                {"email": [VALIDATION_MESSAGES["email_exists"]]}
            ) from None

        return user


# =============================================================================
# 3. SIGN-IN
# =============================================================================


class SigninSerializer(serializers.Serializer):
    email = LowercaseEmailField()
    # No password rules here: we only compare it with the saved password.
    password = serializers.CharField(write_only=True)


# =============================================================================
# 4. EMAIL VERIFICATION
# =============================================================================


class EmailVerificationRequestSerializer(serializers.Serializer):
    email = LowercaseEmailField()


class EmailVerificationConfirmSerializer(serializers.Serializer):
    email = LowercaseEmailField()
    otp = OtpField()


# =============================================================================
# 5. PASSWORD RESET
# =============================================================================


class PasswordResetRequestSerializer(serializers.Serializer):
    email = LowercaseEmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = LowercaseEmailField()
    otp = OtpField()
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        # Same rules as sign-up. (We don't know the user yet here, so the
        # "similar to your name" rule is skipped. The others still apply.)
        check_password_rules(value)
        return value
