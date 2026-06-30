from django.db.models import Count, F
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from accounts.models import AdminActionLog
from app_config.models import UiContent
from profiles.models import Profile
from .models import Connection, ConnectionRequest, Conversation
from .serializers import (
    AdminConnectionActionSerializer,
    AdminConnectionSerializer,
    AdminConversationDetailSerializer,
    AdminConversationSerializer,
)


def ui_content_value(key):
    return UiContent.objects.get(key=key).value


def network_users_queryset():
    return Profile.objects.filter(
        user__is_active=True,
        user__is_staff=False,
        user__is_superuser=False,
    ).values_list("user_id", flat=True)


def serializer_error_message(serializer):
    for errors in serializer.errors.values():
        if isinstance(errors, list) and errors:
            return str(errors[0])

        return str(errors)

    return "Invalid request"


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_connections_view(request):
    network_user_ids = network_users_queryset()

    connections = (
        Connection.objects.filter(
            user_id__lt=F("connected_user_id"),
            user_id__in=network_user_ids,
            connected_user_id__in=network_user_ids,
        )
        .select_related(
            "user",
            "user__profile",
            "connected_user",
            "connected_user__profile",
        )
        .order_by("-created_at")
    )

    serializer = AdminConnectionSerializer(connections, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_connect_users_view(request):
    serializer = AdminConnectionActionSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = serializer.validated_data["user"]
    connected_user = serializer.validated_data["connected_user"]

    Connection.objects.get_or_create(user=user, connected_user=connected_user)
    connection, _created = Connection.objects.get_or_create(
        user=connected_user,
        connected_user=user,
    )

    ConnectionRequest.objects.filter(sender=user, receiver=connected_user).delete()
    ConnectionRequest.objects.filter(sender=connected_user, receiver=user).delete()

    AdminActionLog.objects.create(
        actor=request.user,
        target_user=user,
        action="connection_created",
        description="Created managed connection",
        metadata={
            "user_id": user.id,
            "connected_user_id": connected_user.id,
        },
    )

    response_serializer = AdminConnectionSerializer(connection)
    return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_disconnect_users_view(request):
    serializer = AdminConnectionActionSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = serializer.validated_data["user"]
    connected_user = serializer.validated_data["connected_user"]

    deleted_count, _deleted = Connection.objects.filter(
        user__in=[user, connected_user],
        connected_user__in=[user, connected_user],
    ).delete()

    if deleted_count == 0:
        return Response(
            {"message": ui_content_value("connectionNotFound")},
            status=status.HTTP_404_NOT_FOUND,
        )

    AdminActionLog.objects.create(
        actor=request.user,
        target_user=user,
        action="connection_removed",
        description="Removed managed connection",
        metadata={
            "user_id": user.id,
            "connected_user_id": connected_user.id,
        },
    )

    return Response(
        {"message": ui_content_value("adminConnectionRemoved")},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_conversations_view(request):
    conversations = (
        Conversation.objects.select_related(
            "participant_one",
            "participant_one__profile",
            "participant_two",
            "participant_two__profile",
        )
        .prefetch_related("messages")
        .annotate(message_count=Count("messages"))
        .order_by("-updated_at")
    )

    serializer = AdminConversationSerializer(conversations, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_conversation_detail_view(request, conversation_id):
    conversation = (
        Conversation.objects.select_related(
            "participant_one",
            "participant_one__profile",
            "participant_two",
            "participant_two__profile",
        )
        .prefetch_related("messages", "messages__sender")
        .filter(id=conversation_id)
        .first()
    )

    if conversation is None:
        return Response(
            {"message": ui_content_value("messageConversationNotFound")},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = AdminConversationDetailSerializer(conversation)
    return Response(serializer.data)