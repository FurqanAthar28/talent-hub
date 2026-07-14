from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from accounts.models import AdminActionLog
from app_config.models import UiContent
from connections.models import Connection
from profiles.models import Profile


def is_admin_user(user):
    return user.is_authenticated and (user.is_staff or user.profile.role == Profile.ROLE_ADMIN)


def require_admin(request):
    if not is_admin_user(request.user):
        return Response(
            {"message": "You do not have permission to access admin data."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return None


def serialize_user(user):
    profile = getattr(user, "profile", None)

    return {
        "id": user.id,
        "fullName": user.get_full_name() or user.username,
        "email": user.email,
        "role": profile.role if profile else "candidate",
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "recruiterVerificationStatus": (
            profile.recruiter_verification_status if profile else "approved"
        ),
        "dateJoined": user.date_joined,
    }


def serialize_connection(connection):
    return {
        "id": connection.id,
        "userId": connection.user.id,
        "connectedUserId": connection.connected_user.id,
        "userName": connection.user.get_full_name() or connection.user.username,
        "connectedUserName": connection.connected_user.get_full_name()
        or connection.connected_user.username,
        "createdAt": connection.created_at,
    }


def serialize_ui_content(item):
    return {
        "id": item.id,
        "key": item.key,
        "value": item.value,
    }


def create_admin_log(actor, action, description, target_user=None, metadata=None):
    AdminActionLog.objects.create(
        actor=actor,
        target_user=target_user,
        action=action,
        description=description,
        metadata=metadata or {},
    )


@api_view(["GET"])
def admin_stats_view(request):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    return Response(
        {
            "totalUsers": User.objects.count(),
            "activeUsers": User.objects.filter(is_active=True).count(),
            "candidateCount": Profile.objects.filter(role=Profile.ROLE_CANDIDATE).count(),
            "recruiterCount": Profile.objects.filter(role=Profile.ROLE_RECRUITER).count(),
            "pendingRecruiters": Profile.objects.filter(
                role=Profile.ROLE_RECRUITER,
                recruiter_verification_status=Profile.RECRUITER_VERIFICATION_PENDING,
            ).count(),
            "connectionCount": Connection.objects.count(),
        }
    )


@api_view(["GET"])
def admin_users_view(request):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    users = User.objects.select_related("profile").order_by("-date_joined")
    return Response([serialize_user(user) for user in users])


@api_view(["PATCH"])
def admin_user_status_view(request, user_id):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"message": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    target_user.is_active = bool(request.data.get("is_active"))
    target_user.save(update_fields=["is_active"])

    create_admin_log(
        actor=request.user,
        target_user=target_user,
        action="user_status_updated",
        description=f"Updated user status for {target_user.email}.",
        metadata={"is_active": target_user.is_active},
    )

    data = serialize_user(target_user)
    data["message"] = "User status updated successfully."
    return Response(data)


@api_view(["PATCH"])
def admin_user_role_view(request, user_id):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    role = request.data.get("role")

    if role not in [Profile.ROLE_CANDIDATE, Profile.ROLE_RECRUITER, Profile.ROLE_ADMIN]:
        return Response({"message": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target_user = User.objects.select_related("profile").get(id=user_id)
    except User.DoesNotExist:
        return Response({"message": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    profile = target_user.profile
    profile.role = role
    profile.save(update_fields=["role"])

    create_admin_log(
        actor=request.user,
        target_user=target_user,
        action="user_role_updated",
        description=f"Updated role for {target_user.email}.",
        metadata={"role": role},
    )

    data = serialize_user(target_user)
    data["message"] = "User role updated successfully."
    return Response(data)


@api_view(["PATCH"])
def admin_recruiter_verification_view(request, user_id):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    verification_status = request.data.get("status")

    if verification_status not in [
        Profile.RECRUITER_VERIFICATION_APPROVED,
        Profile.RECRUITER_VERIFICATION_REJECTED,
    ]:
        return Response(
            {"message": "Invalid recruiter verification status."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        target_user = User.objects.select_related("profile").get(id=user_id)
    except User.DoesNotExist:
        return Response({"message": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    profile = target_user.profile

    if profile.role != Profile.ROLE_RECRUITER:
        return Response(
            {"message": "Only recruiters can be verified."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    profile.recruiter_verification_status = verification_status
    profile.save(update_fields=["recruiter_verification_status"])

    create_admin_log(
        actor=request.user,
        target_user=target_user,
        action="recruiter_verification_updated",
        description=f"Updated recruiter verification for {target_user.email}.",
        metadata={"status": verification_status},
    )

    return Response(serialize_user(target_user))


@api_view(["GET"])
def admin_connections_view(request):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    connections = Connection.objects.select_related(
        "user", "connected_user"
    ).order_by("-created_at")

    return Response([serialize_connection(connection) for connection in connections])


@api_view(["POST"])
def admin_connect_users_view(request):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    user_id = request.data.get("userId")
    connected_user_id = request.data.get("connectedUserId")

    if not user_id or not connected_user_id or user_id == connected_user_id:
        return Response(
            {"message": "Please select two different users."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        first_user = User.objects.get(id=user_id)
        second_user = User.objects.get(id=connected_user_id)
    except User.DoesNotExist:
        return Response({"message": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    first_connection, _ = Connection.objects.get_or_create(
        user=first_user,
        connected_user=second_user,
    )

    Connection.objects.get_or_create(
        user=second_user,
        connected_user=first_user,
    )

    create_admin_log(
        actor=request.user,
        target_user=first_user,
        action="connection_created",
        description=f"Created connection between {first_user.email} and {second_user.email}.",
        metadata={"connected_user_id": second_user.id},
    )

    return Response(serialize_connection(first_connection), status=status.HTTP_201_CREATED)


@api_view(["POST"])
def admin_disconnect_users_view(request):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    user_id = request.data.get("userId")
    connected_user_id = request.data.get("connectedUserId")

    deleted_count, _ = Connection.objects.filter(
        Q(user_id=user_id, connected_user_id=connected_user_id)
        | Q(user_id=connected_user_id, connected_user_id=user_id)
    ).delete()

    create_admin_log(
        actor=request.user,
        action="connection_removed",
        description="Removed managed connection.",
        metadata={
            "user_id": user_id,
            "connected_user_id": connected_user_id,
            "deleted_count": deleted_count,
        },
    )

    return Response({"message": "Connection removed successfully."})


@api_view(["GET"])
def admin_audit_logs_view(request):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    logs = AdminActionLog.objects.select_related("actor", "target_user")[:50]

    return Response(
        [
            {
                "id": log.id,
                "actorName": log.actor.get_full_name() if log.actor else "System",
                "targetUserName": (
                    log.target_user.get_full_name() if log.target_user else ""
                ),
                "action": log.action,
                "description": log.description,
                "createdAt": log.created_at,
            }
            for log in logs
        ]
    )


@api_view(["GET"])
def admin_ui_content_view(request):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    items = UiContent.objects.order_by("key")

    return Response([serialize_ui_content(item) for item in items])


@api_view(["PATCH"])
def admin_ui_content_detail_view(request, key):
    permission_error = require_admin(request)
    if permission_error:
        return permission_error

    value = request.data.get("value")

    if not isinstance(value, str):
        return Response(
            {"message": "UI content value is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        item = UiContent.objects.get(key=key)
    except UiContent.DoesNotExist:
        return Response(
            {"message": "UI content key not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    old_value = item.value
    item.value = value
    item.save(update_fields=["value"])

    create_admin_log(
        actor=request.user,
        action="ui_content_updated",
        description=f"Updated UI content: {item.key}.",
        metadata={
            "key": item.key,
            "old_value": old_value,
            "new_value": item.value,
        },
    )

    data = serialize_ui_content(item)
    data["message"] = "UI content updated."
    return Response(data)
