"""
Serializers for reports.

The field names of the admin output MUST match
Frontend/app/(main)/admin/types.ts (AdminReport).
"""

from rest_framework import serializers

from profiles.models import Profile

from .models import Report

REASON_TEXT = dict(Report.REASON_CHOICES)


def display_name(user):
    return user.get_full_name() or user.email or user.username


# =============================================================================
# INPUT
# =============================================================================


class CreateReportSerializer(serializers.Serializer):
    """What a user sends from the "Report" box."""

    kind = serializers.ChoiceField(choices=[Report.KIND_PROFILE, Report.KIND_MESSAGE])
    reportedUserId = serializers.IntegerField()
    messageId = serializers.IntegerField(required=False, allow_null=True)
    reason = serializers.ChoiceField(choices=[value for value, _label in Report.REASON_CHOICES])
    details = serializers.CharField(
        required=False, allow_blank=True, max_length=Report.DETAILS_MAX_LENGTH, trim_whitespace=True
    )

    def validate(self, attrs):
        attrs["details"] = attrs.get("details", "")
        if attrs["kind"] == Report.KIND_MESSAGE and not attrs.get("messageId"):
            raise serializers.ValidationError("Choose the message you want to report.")
        if attrs["reason"] == Report.REASON_OTHER and not attrs["details"]:
            raise serializers.ValidationError("Please tell us a little about the problem.")
        return attrs


class ResolveReportSerializer(serializers.Serializer):
    """What an admin sends to close a report."""

    action = serializers.ChoiceField(
        choices=[Report.ACTION_DISMISS, Report.ACTION_SUSPEND, Report.ACTION_BAN]
    )
    note = serializers.CharField(
        required=False, allow_blank=True, max_length=Report.NOTE_MAX_LENGTH, trim_whitespace=True
    )

    def validate(self, attrs):
        attrs["note"] = attrs.get("note", "")
        if attrs["action"] != Report.ACTION_DISMISS and not attrs["note"]:
            raise serializers.ValidationError("Please give a reason (the person will see it).")
        return attrs


# =============================================================================
# OUTPUT (admin page)
# =============================================================================


class AdminReportSerializer(serializers.ModelSerializer):
    """
    One report on the admin Reports page.

    `openReportsAboutUser` comes from an extra column added in the view
    (one database trip for the whole list).
    """

    reasonLabel = serializers.SerializerMethodField()
    reporterName = serializers.SerializerMethodField()
    reporterEmail = serializers.SerializerMethodField()
    reportedUserId = serializers.IntegerField(source="reported_user_id", read_only=True)
    reportedUserName = serializers.SerializerMethodField()
    reportedUserEmail = serializers.SerializerMethodField()
    reportedUserRole = serializers.SerializerMethodField()
    reportedUserAccountStatus = serializers.SerializerMethodField()
    reportedUserDeleted = serializers.SerializerMethodField()
    messageText = serializers.CharField(source="message_text", read_only=True)
    actionTaken = serializers.CharField(source="action_taken", read_only=True)
    resolutionNote = serializers.CharField(source="resolution_note", read_only=True)
    resolvedByName = serializers.SerializerMethodField()
    resolvedAt = serializers.DateTimeField(source="resolved_at", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    openReportsAboutUser = serializers.IntegerField(source="open_about_user", read_only=True, default=0)

    class Meta:
        model = Report
        fields = [
            "id",
            "kind",
            "reason",
            "reasonLabel",
            "details",
            "messageText",
            "status",
            "actionTaken",
            "resolutionNote",
            "resolvedByName",
            "resolvedAt",
            "createdAt",
            "reporterName",
            "reporterEmail",
            "reportedUserId",
            "reportedUserName",
            "reportedUserEmail",
            "reportedUserRole",
            "reportedUserAccountStatus",
            "reportedUserDeleted",
            "openReportsAboutUser",
        ]

    def get_reasonLabel(self, report):
        return REASON_TEXT.get(report.reason, report.reason)

    # The reporter may have deleted their account since (the report stays).
    def get_reporterName(self, report):
        return display_name(report.reporter) if report.reporter else "Deleted account"

    def get_reporterEmail(self, report):
        return report.reporter.email if report.reporter else ""

    def get_reportedUserName(self, report):
        return display_name(report.reported_user)

    def get_reportedUserEmail(self, report):
        return report.reported_user.email

    def _profile(self, report):
        return getattr(report.reported_user, "profile", None)

    def get_reportedUserRole(self, report):
        profile = self._profile(report)
        return profile.role if profile else Profile.ROLE_CANDIDATE

    def get_reportedUserAccountStatus(self, report):
        profile = self._profile(report)
        return profile.account_status if profile else Profile.ACCOUNT_ACTIVE

    def get_reportedUserDeleted(self, report):
        profile = self._profile(report)
        return bool(profile and profile.deleted_at)

    def get_resolvedByName(self, report):
        return display_name(report.resolved_by) if report.resolved_by else ""
