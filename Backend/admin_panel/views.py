"""
The admin page API ("/api/admin/...").

Only APP ADMINS can use these endpoints: profile role "admin"
(IsAppAdmin, profiles/permissions.py). Django staff/superusers are a
different thing and do NOT get in. The frontend uses the same rule.

WHAT'S IN THIS FILE
1. Helpers
2. Dashboard numbers
3. Users        -> list, switch on/off, change role, verify recruiters
4. Connections  -> list, connect, disconnect
5. Audit log
6. UI content   -> the editable texts
(Reports have their own file: reports/admin_views.py, same "/api/admin/" prefix.)
"""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts import account_state
from accounts.account_state import within_grace_period
from accounts.models import AdminActionLog
from app_config.models import UiContent
from config.db_helpers import count_related
from connections.models import Connection, ConnectionRequest
from connections.network import connect_users, disconnect_users, network_connections, requests_between
from profiles.approval import allowed_rejection_reasons, approval_checks, can_be_approved
from profiles.models import Experience, Profile, Project, Skill
from profiles.permissions import IsAppAdmin, is_last_admin
from jobs.models import Job
from reports.models import Report

from .serializers import (
    AdminAuditLogSerializer,
    AdminConnectionSerializer,
    AdminUiContentSerializer,
    AccountActionSerializer,
    AdminUserSerializer,
    ApprovalDecisionSerializer,
    ConnectUsersSerializer,
    UiContentUpdateSerializer,
    UserPairSerializer,
    UserRoleSerializer,
)

# How many audit log rows to show.
AUDIT_LOG_LIMIT = 50

# The admin's own profile: how many days the activity grid shows (12 weeks),
# and how many of their latest actions to list.
ACTIVITY_DAYS = 84
MY_RECENT_ACTIONS = 6

# The short codes written in the audit log. One list, so the counting on the
# admin's profile always matches what the buttons write.
# Older log lines ("switch off / on") used these two codes.
ACTION_USER_ACTIVATED = "user_activated"
ACTION_USER_DEACTIVATED = "user_deactivated"
# New: "account_suspend", "account_ban", "account_delete", ... (see ACCOUNT_ACTIONS)
ACCOUNT_ACTION_CODES = [f"account_{name}" for name in ("suspend", "unsuspend", "ban", "unban", "delete", "restore")]
ACTION_ROLE_CHANGED = "role_changed"
ACTION_APPROVAL = "approval_changed"
# Older log lines (before candidates needed approval too) used this code.
ACTION_RECRUITER_VERIFICATION_OLD = "recruiter_verification_changed"
ACTION_CONNECTION_CREATED = "connection_created"
ACTION_CONNECTION_REMOVED = "connection_removed"
ACTION_UI_CONTENT_UPDATED = "ui_content_updated"


# =============================================================================
# 1. HELPERS
# =============================================================================


def admin_users():
    """
    All users, with their profile and 4 counts added as extra columns.
    (count_related lives in config/db_helpers.py.)
    """
    return User.objects.select_related("profile").annotate(
        skills_count=count_related(Skill, "profile__user"),
        projects_count=count_related(Project, "profile__user"),
        experiences_count=count_related(Experience, "profile__user"),
        connections_count=count_related(Connection, "user"),
    )


def user_response(user_id, message):
    """Send back ONE user, freshly loaded WITH the counts, plus a message."""
    data = dict(AdminUserSerializer(admin_users().get(pk=user_id)).data)
    data["message"] = message
    return Response(data)


def log_action(request, action, description, target_user=None, metadata=None):
    """Write one line in the admin audit log."""
    AdminActionLog.objects.create(
        actor=request.user,
        target_user=target_user,
        action=action,
        description=description,
        metadata=metadata or {},
    )


def get_target_user(request, user_id):
    """
    Find the user an admin wants to change.

    Admins may not change THEMSELVES or a SUPERUSER here, so nobody can
    lock themselves (or the site owner) out by accident.
    `raise PermissionDenied(...)` stops the view right here and answers
    403 with {"message": "..."}.
    """
    user = get_object_or_404(User.objects.select_related("profile"), pk=user_id)

    if user.pk == request.user.pk:
        raise PermissionDenied("You can't change your own account here.")
    if user.is_superuser:
        raise PermissionDenied("Superuser accounts can only be changed with manage.py.")
    return user


def refuse_if_last_admin(user):
    """Stop the change if it would leave the app with no admin at all."""
    if is_last_admin(user):
        raise PermissionDenied(
            f"{user.get_full_name() or user.email} is the only admin. Make someone else an admin first."
        )


# =============================================================================
# 2. DASHBOARD NUMBERS
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_stats_view(request):
    """The numbers at the top of the admin page and the admin dashboard."""
    users = User.objects.all()
    recruiters = Profile.objects.filter(role=Profile.ROLE_RECRUITER)
    waiting = Profile.objects.filter(
        role__in=[Profile.ROLE_CANDIDATE, Profile.ROLE_RECRUITER],
        approval_status=Profile.APPROVAL_PENDING,
        user__is_active=True,
    )

    return Response(
        {
            "users": users.count(),
            "activeUsers": users.filter(is_active=True).count(),
            "inactiveUsers": users.filter(is_active=False).count(),
            "suspendedUsers": Profile.objects.filter(account_status=Profile.ACCOUNT_SUSPENDED).count(),
            "bannedUsers": Profile.objects.filter(account_status=Profile.ACCOUNT_BANNED).count(),
            "deletedUsers": Profile.objects.filter(deleted_at__isnull=False).count(),
            "adminUsers": users.filter(profile__role=Profile.ROLE_ADMIN).count(),
            "candidates": Profile.objects.filter(role=Profile.ROLE_CANDIDATE).count(),
            "recruiters": recruiters.count(),
            # Everyone waiting for an admin's decision (candidates and recruiters).
            "pendingApprovals": waiting.count(),
            "skills": Skill.objects.count(),
            "projects": Project.objects.count(),
            "experiences": Experience.objects.count(),
            # Same rule as the Connections list, so the two always agree.
            "connections": network_connections().count(),
            # Reports from users that no admin has handled yet.
            "openReports": Report.objects.filter(status=Report.STATUS_OPEN).count(),
            # Job posts that are open and not hidden by an admin.
            "openJobs": Job.objects.filter(status=Job.STATUS_OPEN, hidden_by_admin=False).count(),
            "pendingConnectionRequests": ConnectionRequest.objects.filter(
                status=ConnectionRequest.STATUS_PENDING
            ).count(),
        }
    )


# =============================================================================
# 3. USERS
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_users_view(request):
    users = admin_users().order_by("-date_joined")
    return Response(AdminUserSerializer(users, many=True).data)


# What each account action needs first, and what it says afterwards.
# (state_ok gets the profile and says if the action makes sense right now.)
ACCOUNT_ACTIONS = {
    "suspend": {
        "state_ok": lambda p: p.account_status == Profile.ACCOUNT_ACTIVE and not p.deleted_at,
        "not_now": "Only active accounts can be suspended.",
        "done": "{name} is suspended and can't sign in.",
        "log": "Suspended {email}: {reason}",
    },
    "unsuspend": {
        "state_ok": lambda p: p.account_status == Profile.ACCOUNT_SUSPENDED,
        "not_now": "This account isn't suspended.",
        "done": "{name} can sign in again.",
        "log": "Lifted the suspension of {email}",
    },
    "ban": {
        "state_ok": lambda p: p.account_status != Profile.ACCOUNT_BANNED,
        "not_now": "This account is already banned.",
        "done": "{name} is banned. Their email can't sign up again.",
        "log": "Banned {email}: {reason}",
    },
    "unban": {
        "state_ok": lambda p: p.account_status == Profile.ACCOUNT_BANNED,
        "not_now": "This account isn't banned.",
        "done": "{name} is no longer banned.",
        "log": "Lifted the ban of {email}",
    },
    "delete": {
        "state_ok": lambda p: p.deleted_at is None,
        "not_now": "This account is already deleted.",
        "done": "{name} is deleted. You can restore it for {days} days.",
        "log": "Deleted {email} (restorable): {reason}",
    },
    "restore": {
        "state_ok": lambda p: within_grace_period(p),
        "not_now": "This account can't be restored (it isn't deleted, or the time is up).",
        "done": "{name} is restored.",
        "log": "Restored {email}",
    },
}
# Actions that take an admin away: never allowed on the last admin.
REMOVING_ACTIONS = ("suspend", "ban", "delete")


@api_view(["POST"])
@permission_classes([IsAppAdmin])
def admin_account_action_view(request, user_id):
    """Suspend, ban, delete (soft) or undo any of them. Always logged."""
    serializer = AccountActionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    action = serializer.validated_data["action"]
    reason = serializer.validated_data["reason"]

    user = get_target_user(request, user_id)  # not yourself, not a superuser
    problem = apply_account_action(request, user, action, reason)
    if problem:
        return Response({"message": problem}, status=status.HTTP_400_BAD_REQUEST)

    name = user.get_full_name() or user.email
    rules = ACCOUNT_ACTIONS[action]
    return user_response(user.pk, rules["done"].format(name=name, days=settings.ACCOUNT_DELETION_GRACE_DAYS))


def apply_account_action(request, user, action, reason, extra_metadata=None):
    """
    Do one account action and write it in the audit log.
    Used by the Users page AND by Reports (so both follow the same rules).

    Returns None when it worked, or a sentence saying why it can't be done now.
    (Raises PermissionDenied for the last admin, like the other views.)
    """
    if action in REMOVING_ACTIONS:
        refuse_if_last_admin(user)

    profile, _created = Profile.objects.get_or_create(user=user)
    rules = ACCOUNT_ACTIONS[action]
    if not rules["state_ok"](profile):
        return rules["not_now"]

    if action == "suspend":
        account_state.suspend(user, reason)
    elif action == "ban":
        account_state.ban(user, reason, banned_by=request.user)
    elif action in ("unsuspend", "unban"):
        account_state.reactivate(user)
    elif action == "delete":
        account_state.soft_delete(user, by_admin=True, reason=reason)
    else:
        account_state.restore(user)

    log_action(
        request,
        action=f"account_{action}",
        description=rules["log"].format(email=user.email, reason=reason),
        target_user=user,
        metadata={"action": action, "reason": reason, **(extra_metadata or {})},
    )
    return None


@api_view(["PATCH"])
@permission_classes([IsAppAdmin])
def admin_user_role_view(request, user_id):
    """
    Change a user's role. "admin" gives them the admin page. It does NOT
    make them Django staff: the built-in Django site stays for developers.
    """
    serializer = UserRoleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    new_role = serializer.validated_data["role"]

    user = get_target_user(request, user_id)
    if new_role != Profile.ROLE_ADMIN:
        refuse_if_last_admin(user)

    profile, _created = Profile.objects.get_or_create(user=user)
    old_role = profile.role

    profile.role = new_role
    profile.save(update_fields=["role"])

    log_action(
        request,
        action=ACTION_ROLE_CHANGED,
        description=f"Changed role of {user.email} from {old_role} to {new_role}",
        target_user=user,
        metadata={"previous_role": old_role, "new_role": new_role},
    )
    return user_response(user.pk, "User role updated successfully.")


REJECTION_TEXT = dict(Profile.REJECTION_CHOICES)


def approvable_profile(user_id):
    """The profile of a candidate or recruiter (admins don't need approval)."""
    user = get_object_or_404(User.objects.select_related("profile"), pk=user_id)
    profile, _created = Profile.objects.get_or_create(user=user)
    if profile.role not in (Profile.ROLE_CANDIDATE, Profile.ROLE_RECRUITER):
        raise PermissionDenied("Only candidates and recruiters need approval.")
    return user, profile


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_approval_checks_view(request, user_id):
    """What the admin sees before deciding: every check, and the allowed reasons."""
    _user, profile = approvable_profile(user_id)
    checks = approval_checks(profile)
    return Response(
        {
            "checks": checks,
            "canApprove": can_be_approved(checks),
            "needsLinkedinCheck": profile.role == Profile.ROLE_CANDIDATE,
            "rejectionReasons": [
                {"value": reason, "label": REJECTION_TEXT[reason]} for reason in allowed_rejection_reasons(profile)
            ],
        }
    )


@api_view(["PATCH"])
@permission_classes([IsAppAdmin])
def admin_approval_view(request, user_id):
    """
    Approve a candidate or recruiter, or say "not approved" with one of the
    two fixed reasons. Approving needs every REQUIRED check to pass.
    """
    serializer = ApprovalDecisionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    decision = serializer.validated_data
    user, profile = approvable_profile(user_id)

    if decision["status"] == Profile.APPROVAL_APPROVED:
        checks = approval_checks(profile)
        failed = [item["label"] for item in checks if item["required"] and not item["passed"]]
        if failed:
            return Response(
                {"message": "Can't approve yet: " + "; ".join(failed) + "."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if profile.role == Profile.ROLE_CANDIDATE and not decision["linkedinChecked"]:
            return Response(
                {"message": "Open their LinkedIn link and confirm it matches before approving."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif decision["reason"] not in allowed_rejection_reasons(profile):
        return Response(
            {"message": "\"Company not verifiable\" only applies when they claim a company."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    profile.approval_status = decision["status"]
    profile.rejection_reason = decision["reason"]
    profile.save(update_fields=["approval_status", "rejection_reason"])

    approved = decision["status"] == Profile.APPROVAL_APPROVED
    log_action(
        request,
        action=ACTION_APPROVAL,
        description=(
            f"Approved {profile.role} {user.email}"
            if approved
            else f"Did not approve {profile.role} {user.email}: {REJECTION_TEXT[decision['reason']].lower()}"
        ),
        target_user=user,
        metadata={
            "status": decision["status"],
            "reason": decision["reason"],
            "role": profile.role,
            "linkedin_checked": decision["linkedinChecked"],
        },
    )
    return user_response(user.pk, "Approved." if approved else "Marked as not approved.")


# =============================================================================
# 4. CONNECTIONS
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_connections_view(request):
    """Every connection, listed ONCE (A-B, not also B-A). Same rule as the stats."""
    connections = (
        network_connections()
        .select_related("user", "user__profile", "connected_user", "connected_user__profile")
        .order_by("-created_at")
    )
    return Response(AdminConnectionSerializer(connections, many=True).data)


@api_view(["POST"])
@permission_classes([IsAppAdmin])
def admin_connect_users_view(request):
    serializer = ConnectUsersSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data["user"]
    other = serializer.validated_data["connected_user"]

    with transaction.atomic():
        created = connect_users(user, other)  # shared rule: saves both rows
        requests_between(user, other).delete()  # old requests aren't needed now
        if created:
            log_action(
                request,
                action=ACTION_CONNECTION_CREATED,
                description=f"Connected {user.email} and {other.email}",
                target_user=user,
                metadata={"user_id": user.pk, "connected_user_id": other.pk},
            )

    connection = Connection.objects.select_related(
        "user", "user__profile", "connected_user", "connected_user__profile"
    ).get(user=user, connected_user=other)
    status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(AdminConnectionSerializer(connection).data, status=status_code)


@api_view(["POST"])
@permission_classes([IsAppAdmin])
def admin_disconnect_users_view(request):
    serializer = UserPairSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data["user"]
    other = serializer.validated_data["connected_user"]

    # Shared rule: removes both rows AND old requests, so they can reconnect later.
    if not disconnect_users(user, other):
        return Response(
            {"message": "These users are not connected."},
            status=status.HTTP_404_NOT_FOUND,
        )

    log_action(
        request,
        action=ACTION_CONNECTION_REMOVED,
        description=f"Disconnected {user.email} and {other.email}",
        target_user=user,
        metadata={"user_id": user.pk, "connected_user_id": other.pk},
    )
    return Response({"message": "Connection removed successfully."})


# =============================================================================
# 5. AUDIT LOG
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_audit_logs_view(request):
    logs = AdminActionLog.objects.select_related("actor", "target_user")[:AUDIT_LOG_LIMIT]
    return Response(AdminAuditLogSerializer(logs, many=True).data)


# =============================================================================
# 5b. MY ADMIN PROFILE (what *I* have done, from the audit log)
# =============================================================================


def daily_activity(actions, days):
    """
    One entry per day for the last `days` days, oldest first, even on days
    with nothing: [{"date": "2026-11-03", "count": 4}, ...].
    The database does the counting (one query), not Python.
    """
    today = timezone.localdate()
    first_day = today - timedelta(days=days - 1)

    per_day = (
        actions.filter(created_at__date__gte=first_day)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"))
    )
    counts = {row["day"]: row["count"] for row in per_day}

    return [
        {"date": day.isoformat(), "count": counts.get(day, 0)}
        for day in (first_day + timedelta(days=offset) for offset in range(days))
    ]


def current_streak(activity):
    """How many days in a row (up to today) had at least one action."""
    streak = 0
    for day in reversed(activity):
        if day["count"] == 0:
            # A quiet TODAY doesn't break the streak yet: the day isn't over.
            if streak == 0 and day is activity[-1]:
                continue
            break
        streak += 1
    return streak


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_me_view(request):
    """Numbers for the signed-in admin's own profile page."""
    mine = AdminActionLog.objects.filter(actor=request.user)
    verifications = mine.filter(action__in=[ACTION_APPROVAL, ACTION_RECRUITER_VERIFICATION_OLD])
    activity = daily_activity(mine, ACTIVITY_DAYS)
    recent = mine.select_related("actor", "target_user")[:MY_RECENT_ACTIONS]

    return Response(
        {
            "memberSince": request.user.date_joined,
            "lastSignIn": request.user.last_login,
            "impact": {
                "totalActions": mine.count(),
                "peopleApproved": verifications.filter(
                    metadata__status=Profile.APPROVAL_APPROVED
                ).count(),
                "peopleNotApproved": verifications.filter(
                    metadata__status=Profile.APPROVAL_REJECTED
                ).count(),
                # Different people, not clicks: switching Ali off and on is 1.
                "accountsManaged": mine.filter(
                    action__in=[ACTION_USER_ACTIVATED, ACTION_USER_DEACTIVATED, ACTION_ROLE_CHANGED, *ACCOUNT_ACTION_CODES]
                )
                .values("target_user")
                .distinct()
                .count(),
                "connectionsMade": mine.filter(action=ACTION_CONNECTION_CREATED).count(),
                "textsEdited": mine.filter(action=ACTION_UI_CONTENT_UPDATED).count(),
            },
            "activity": activity,
            "activeDays": sum(1 for day in activity if day["count"]),
            "streak": current_streak(activity),
            "recent": AdminAuditLogSerializer(recent, many=True).data,
        }
    )


# =============================================================================
# 6. UI CONTENT (editable texts)
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_ui_content_view(request):
    items = UiContent.objects.order_by("key")
    return Response(AdminUiContentSerializer(items, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAppAdmin])
def admin_ui_content_detail_view(request, key):
    item = get_object_or_404(UiContent, key=key)

    serializer = UiContentUpdateSerializer(data=request.data, context={"key": key})
    serializer.is_valid(raise_exception=True)

    old_value = item.value
    item.value = serializer.validated_data["value"]
    item.save(update_fields=["value"])

    log_action(
        request,
        action=ACTION_UI_CONTENT_UPDATED,
        description=f"Updated UI text: {item.key}",
        metadata={"key": item.key, "old_value": old_value, "new_value": item.value},
    )

    data = dict(AdminUiContentSerializer(item).data)
    data["message"] = "UI content updated."
    return Response(data)
