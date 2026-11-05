"""
Serializers for the admin page.

The field names here MUST match Frontend/app/(main)/admin/types.ts.
Before, they didn't, so parts of the admin page were blank.

WHAT'S IN HERE
1. Output (what the admin page shows): users, audit logs, UI content
2. Input  (what the admin page sends): status, role, verification,
   connect/disconnect, UI content edits
"""

from string import Formatter

from django.contrib.auth.models import User
from rest_framework import serializers

from accounts.models import AdminActionLog
from app_config.models import UiContent
from connections.network import is_network_user
from profiles.models import Profile
from profiles.permissions import role_of
from profiles.utils import calculate_profile_completion

# =============================================================================
# 1. OUTPUT
# =============================================================================


def display_name(user):
    return user.get_full_name() or user.email or user.username


class AdminUserSerializer(serializers.ModelSerializer):
    """
    One row in the admin "Users" table.

    The counts (skillsCount, ...) come from extra columns added by
    admin_users() in views.py, so the whole table costs ONE database trip
    instead of several per user.
    """

    fullName = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    profileCompletion = serializers.SerializerMethodField()
    skillsCount = serializers.IntegerField(source="skills_count", read_only=True)
    projectsCount = serializers.IntegerField(source="projects_count", read_only=True)
    experiencesCount = serializers.IntegerField(source="experiences_count", read_only=True)
    connectionsCount = serializers.IntegerField(source="connections_count", read_only=True)
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

    def get_profile(self, user):
        # getattr(..., None) returns None (instead of crashing) if there's no profile.
        return getattr(user, "profile", None)

    def get_fullName(self, user):
        return display_name(user)

    def get_role(self, user):
        return role_of(user)

    def get_profileCompletion(self, user):
        profile = self.get_profile(user)
        if profile is None:
            return 0
        # Use the numbers we already counted (no extra database trips).
        counts = {
            "skills": user.skills_count,
            "projects": user.projects_count,
            "experiences": user.experiences_count,
        }
        return calculate_profile_completion(profile, counts)

    def get_recruiterVerificationStatus(self, user):
        profile = self.get_profile(user)
        return profile.recruiter_verification_status if profile else Profile.RECRUITER_VERIFICATION_APPROVED

    def get_recruiterVerificationNote(self, user):
        profile = self.get_profile(user)
        return profile.recruiter_verification_note if profile else ""


class AdminAuditLogSerializer(serializers.ModelSerializer):
    actorName = serializers.SerializerMethodField()
    actorEmail = serializers.SerializerMethodField()
    targetUserName = serializers.SerializerMethodField()
    targetUserEmail = serializers.SerializerMethodField()
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
            "createdAt",
        ]

    # If the admin or user was deleted later, the log row stays (with no person).
    def get_actorName(self, log):
        return display_name(log.actor) if log.actor else "System"

    def get_actorEmail(self, log):
        return log.actor.email if log.actor else ""

    def get_targetUserName(self, log):
        return display_name(log.target_user) if log.target_user else ""

    def get_targetUserEmail(self, log):
        return log.target_user.email if log.target_user else ""


class AdminUiContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = UiContent
        fields = ["id", "key", "value"]


# =============================================================================
# 2. INPUT
# =============================================================================


class UserStatusSerializer(serializers.Serializer):
    # BooleanField understands true/false, "true"/"false", 1/0.
    # Before, the text "false" was treated as True!
    is_active = serializers.BooleanField()


class UserRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=[Profile.ROLE_CANDIDATE, Profile.ROLE_RECRUITER, Profile.ROLE_ADMIN]
    )


class RecruiterVerificationSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[Profile.RECRUITER_VERIFICATION_APPROVED, Profile.RECRUITER_VERIFICATION_REJECTED]
    )
    # An optional private note, e.g. "Company website checked".
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class UserPairSerializer(serializers.Serializer):
    """Two different users, for connect / disconnect."""

    userId = serializers.IntegerField()
    connectedUserId = serializers.IntegerField()

    def validate(self, attrs):
        if attrs["userId"] == attrs["connectedUserId"]:
            raise serializers.ValidationError("Please select two different users.")

        users = User.objects.filter(id__in=[attrs["userId"], attrs["connectedUserId"]])
        users_by_id = {user.pk: user for user in users}
        if len(users_by_id) != 2:
            raise serializers.ValidationError("User not found.")

        attrs["user"] = users_by_id[attrs["userId"]]
        attrs["connected_user"] = users_by_id[attrs["connectedUserId"]]
        return attrs


class ConnectUsersSerializer(UserPairSerializer):
    """Like UserPairSerializer, but both users must be allowed to connect."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not is_network_user(attrs["user"]) or not is_network_user(attrs["connected_user"]):
            raise serializers.ValidationError(
                "Only active candidates and approved recruiters can be connected."
            )
        return attrs


# ----- UI content -----

# Texts with {placeholders} that Python fills in with .format().
# key -> placeholders that MUST be there, and the full list that MAY be there.
EMAIL_TEMPLATES = {
    "passwordResetEmailBody": {"required": {"otp"}, "allowed": {"otp", "minutes"}},
    "emailVerificationBody": {"required": {"otp"}, "allowed": {"otp", "minutes"}},
}

# Keys that hold web addresses or page routes. Changing them can break
# whole pages, so they are read-only in the admin page.
LOCKED_KEY_PREFIXES = ("api", "route")


class UiContentUpdateSerializer(serializers.Serializer):
    """
    The view passes context={"key": "..."} so we know WHICH text is being edited.
    """

    value = serializers.CharField(allow_blank=True, trim_whitespace=False)

    def validate(self, attrs):
        key = self.context["key"]
        value = attrs["value"]

        if key.startswith(LOCKED_KEY_PREFIXES):
            raise serializers.ValidationError(
                "This item is a web address used by the app and can't be edited here."
            )

        template = EMAIL_TEMPLATES.get(key)
        if template:
            check_email_template(value, template["required"], template["allowed"])

        return attrs


def check_email_template(value, required, allowed):
    """
    Make sure an email text only uses the {placeholders} we fill in.

    Example: "Your code is {otp}" is fine.
             "Hi {name}, your code is {otp}" would CRASH password reset,
             because we never provide {name}.
    """
    try:
        # Formatter().parse finds every {...} in the text.
        used = {name for _text, name, _spec, _conv in Formatter().parse(value) if name is not None}
    except ValueError:
        # For example a lonely "{" with no "}".
        raise serializers.ValidationError(
            "This text has a broken { } placeholder. Use {{ and }} for real curly brackets."
        ) from None

    unknown = used - allowed
    if unknown:
        raise serializers.ValidationError(
            f"Unknown placeholder(s): {', '.join('{' + n + '}' for n in sorted(unknown))}. "
            f"Allowed: {', '.join('{' + n + '}' for n in sorted(allowed))}."
        )

    missing = required - used
    if missing:
        raise serializers.ValidationError(
            f"This text must include {', '.join('{' + n + '}' for n in sorted(missing))}."
        )
