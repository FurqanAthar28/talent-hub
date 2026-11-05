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
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, F
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.models import AdminActionLog
from app_config.models import UiContent
from config.db_helpers import count_related
from connections.models import Connection, ConnectionRequest
from connections.network import connect_users, disconnect_users, network_users, requests_between
from connections.serializers import AdminConnectionSerializer
from profiles.models import Experience, Profile, Project, Skill
from profiles.permissions import IsAppAdmin

from .serializers import (
    AdminAuditLogSerializer,
    AdminUiContentSerializer,
    AdminUserSerializer,
    ConnectUsersSerializer,
    RecruiterVerificationSerializer,
    UiContentUpdateSerializer,
    UserPairSerializer,
    UserRoleSerializer,
    UserStatusSerializer,
)

# How many audit log rows to show.
AUDIT_LOG_LIMIT = 50

# The admin's own profile: how many days the activity grid shows (12 weeks),
# and how many of their latest actions to list.
ACTIVITY_DAYS = 84
MY_RECENT_ACTIONS = 6

# The short codes written in the audit log. One list, so the counting on the
# admin's profile always matches what the buttons write.
ACTION_USER_ACTIVATED = "user_activated"
ACTION_USER_DEACTIVATED = "user_deactivated"
ACTION_ROLE_CHANGED = "role_changed"
ACTION_RECRUITER_VERIFICATION = "recruiter_verification_changed"
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


# =============================================================================
# 2. DASHBOARD NUMBERS
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_stats_view(request):
    """The numbers at the top of the admin page and the admin dashboard."""
    users = User.objects.all()
    recruiters = Profile.objects.filter(role=Profile.ROLE_RECRUITER)

    return Response(
        {
            "users": users.count(),
            "activeUsers": users.filter(is_active=True).count(),
            "inactiveUsers": users.filter(is_active=False).count(),
            "adminUsers": users.filter(profile__role=Profile.ROLE_ADMIN).count(),
            "candidates": Profile.objects.filter(role=Profile.ROLE_CANDIDATE).count(),
            "recruiters": recruiters.count(),
            "pendingRecruiters": recruiters.filter(
                recruiter_verification_status=Profile.RECRUITER_VERIFICATION_PENDING
            ).count(),
            "skills": Skill.objects.count(),
            "projects": Project.objects.count(),
            "experiences": Experience.objects.count(),
            # Each friendship is saved as 2 rows (A->B and B->A), so divide by 2.
            "connections": Connection.objects.count() // 2,
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


@api_view(["PATCH"])
@permission_classes([IsAppAdmin])
def admin_user_status_view(request, user_id):
    """Switch an account on or off."""
    serializer = UserStatusSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = get_target_user(request, user_id)

    user.is_active = serializer.validated_data["is_active"]
    user.save(update_fields=["is_active"])

    state = "Activated" if user.is_active else "Deactivated"
    log_action(
        request,
        action=ACTION_USER_ACTIVATED if user.is_active else ACTION_USER_DEACTIVATED,
        description=f"{state} {user.email}",
        target_user=user,
        metadata={"is_active": user.is_active},
    )
    return user_response(user.pk, "User status updated successfully.")


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


@api_view(["PATCH"])
@permission_classes([IsAppAdmin])
def admin_recruiter_verification_view(request, user_id):
    """Approve or reject a recruiter (only approved recruiters can connect)."""
    serializer = RecruiterVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    new_status = serializer.validated_data["status"]

    user = get_object_or_404(User, pk=user_id)
    profile, _created = Profile.objects.get_or_create(user=user)

    if profile.role != Profile.ROLE_RECRUITER:
        return Response(
            {"message": "Only recruiters can be verified."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    profile.recruiter_verification_status = new_status
    profile.recruiter_verification_note = serializer.validated_data.get("note", "")
    profile.save(update_fields=["recruiter_verification_status", "recruiter_verification_note"])

    log_action(
        request,
        action=ACTION_RECRUITER_VERIFICATION,
        description=f"{'Approved' if new_status == Profile.RECRUITER_VERIFICATION_APPROVED else 'Rejected'} recruiter {user.email}",
        target_user=user,
        metadata={"status": new_status},
    )
    return user_response(user.pk, "Recruiter verification updated.")


# =============================================================================
# 4. CONNECTIONS
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_connections_view(request):
    """
    Every connection, listed ONCE (A-B, not also B-A).
    `user_id < connected_user_id` keeps just one of the two rows.
    """
    connections = (
        Connection.objects.filter(
            user_id__lt=F("connected_user_id"),
            user__in=network_users(),
            connected_user__in=network_users(),
        )
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
        connect_users(user, other)  # shared rule: saves both rows
        requests_between(user, other).delete()  # old requests aren't needed now

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
    return Response(AdminConnectionSerializer(connection).data, status=status.HTTP_201_CREATED)


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
    verifications = mine.filter(action=ACTION_RECRUITER_VERIFICATION)
    activity = daily_activity(mine, ACTIVITY_DAYS)
    recent = mine.select_related("actor", "target_user")[:MY_RECENT_ACTIONS]

    return Response(
        {
            "memberSince": request.user.date_joined,
            "lastSignIn": request.user.last_login,
            "impact": {
                "totalActions": mine.count(),
                "recruitersApproved": verifications.filter(
                    metadata__status=Profile.RECRUITER_VERIFICATION_APPROVED
                ).count(),
                "recruitersRejected": verifications.filter(
                    metadata__status=Profile.RECRUITER_VERIFICATION_REJECTED
                ).count(),
                # Different people, not clicks: switching Ali off and on is 1.
                "accountsManaged": mine.filter(
                    action__in=[ACTION_USER_ACTIVATED, ACTION_USER_DEACTIVATED, ACTION_ROLE_CHANGED]
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
