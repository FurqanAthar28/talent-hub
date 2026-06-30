from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from accounts.models import AdminActionLog
from app_config.models import UiContent
from profiles.models import Profile
from .models import Connection, ConnectionRequest, Conversation, Message
from .serializers import (
    AdminConnectionActionSerializer,
    AdminConnectionSerializer,
    ConversationSerializer,
    ConnectionRequestActionSerializer,
    ConnectionRequestSerializer,
    is_network_user,
    MessageSerializer,
    NetworkUserSerializer,
    SendConnectionRequestSerializer,
    SendMessageSerializer,
    StartConversationSerializer,
)


def ui_content_value(key):
    try:
        return UiContent.objects.get(key=key).value
    except UiContent.DoesNotExist as exc:
        raise ImproperlyConfigured(f"Missing backend UI content: {key}") from exc


def network_users_queryset():
    return User.objects.filter(
        is_active=True,
        is_staff=False,
        is_superuser=False,
    ).filter(
        Q(profile__role=Profile.ROLE_CANDIDATE)
        | Q(
            profile__role=Profile.ROLE_RECRUITER,
            profile__recruiter_verification_status=Profile.RECRUITER_VERIFICATION_APPROVED,
        )
    )


def serializer_error_message(serializer):
    for errors in serializer.errors.values():
        if isinstance(errors, list) and errors:
            return str(errors[0])

        return str(errors)

    return "Invalid request"


def get_conversation_participants(user, other_user):
    if user.id < other_user.id:
        return user, other_user

    return other_user, user


def get_user_conversation_or_404(conversation_id, user):
    return Conversation.objects.filter(
        Q(participant_one=user) | Q(participant_two=user),
        id=conversation_id,
    ).first()


def admin_connection_response(user):
    if is_network_user(user):
        return None

    return Response(
        {"message": ui_content_value("connectionAdminUnavailable")},
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users_list_view(request):
    admin_response = admin_connection_response(request.user)

    if admin_response:
        return admin_response

    users = network_users_queryset().exclude(id=request.user.id)
    serializer = NetworkUserSerializer(
        users,
        many=True,
        context={"current_user": request.user},
    )
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_connection_request_view(request):
    serializer = SendConnectionRequestSerializer(
        data=request.data,
        context={"request": request},
    )

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    connection_request = serializer.save()
    response_status = status.HTTP_200_OK if serializer.was_reopened else status.HTTP_201_CREATED
    response_serializer = ConnectionRequestSerializer(connection_request)
    return Response(response_serializer.data, status=response_status)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pending_requests_view(request):
    admin_response = admin_connection_response(request.user)

    if admin_response:
        return admin_response

    requests = ConnectionRequest.objects.filter(
        receiver=request.user,
        sender__in=network_users_queryset(),
        status="pending",
    ).order_by("-created_at")

    serializer = ConnectionRequestSerializer(requests, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sent_requests_view(request):
    admin_response = admin_connection_response(request.user)

    if admin_response:
        return admin_response

    requests = ConnectionRequest.objects.filter(
        sender=request.user,
        receiver__in=network_users_queryset(),
    ).order_by("-created_at")

    serializer = ConnectionRequestSerializer(requests, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_request_view(request):
    admin_response = admin_connection_response(request.user)

    if admin_response:
        return admin_response

    serializer = ConnectionRequestActionSerializer(
        data=request.data,
        context={"request": request},
    )

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    connection_request = serializer.validated_data["requestId"]

    connection_request.status = "accepted"
    connection_request.save()

    Connection.objects.get_or_create(
        user=connection_request.sender,
        connected_user=connection_request.receiver,
    )

    Connection.objects.get_or_create(
        user=connection_request.receiver,
        connected_user=connection_request.sender,
    )

    return Response({"message": ui_content_value("connectionRequestAccepted")})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_request_view(request):
    admin_response = admin_connection_response(request.user)

    if admin_response:
        return admin_response

    serializer = ConnectionRequestActionSerializer(
        data=request.data,
        context={"request": request},
    )

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    connection_request = serializer.validated_data["requestId"]

    connection_request.status = "rejected"
    connection_request.save()

    return Response({"message": ui_content_value("connectionRequestRejected")})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_connections_view(request):
    admin_response = admin_connection_response(request.user)

    if admin_response:
        return admin_response

    connections = Connection.objects.filter(
        user=request.user,
        connected_user__in=network_users_queryset(),
    )
    users = [connection.connected_user for connection in connections]
    serializer = NetworkUserSerializer(
        users,
        many=True,
        context={"current_user": request.user},
    )
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def conversations_list_view(request):
    admin_response = admin_connection_response(request.user)

    if admin_response:
        return admin_response

    conversations = (
        Conversation.objects.filter(
            Q(participant_one=request.user) | Q(participant_two=request.user)
        )
        .select_related(
            "participant_one",
            "participant_one__profile",
            "participant_two",
            "participant_two__profile",
        )
        .prefetch_related("messages")
    )
    serializer = ConversationSerializer(
        conversations,
        many=True,
        context={"request": request},
    )
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_conversation_view(request):
    admin_response = admin_connection_response(request.user)

    if admin_response:
        return admin_response

    serializer = StartConversationSerializer(
        data=request.data,
        context={"request": request},
    )

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    other_user = serializer.validated_data["userId"]
    participant_one, participant_two = get_conversation_participants(
        request.user,
        other_user,
    )
    conversation, _created = Conversation.objects.get_or_create(
        participant_one=participant_one,
        participant_two=participant_two,
    )
    response_serializer = ConversationSerializer(
        conversation,
        context={"request": request},
    )
    return Response(response_serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def conversation_messages_view(request, conversation_id):
    admin_response = admin_connection_response(request.user)

    if admin_response:
        return admin_response

    conversation = get_user_conversation_or_404(conversation_id, request.user)

    if conversation is None:
        return Response(
            {"message": ui_content_value("messageConversationNotFound")},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        Message.objects.filter(
            conversation=conversation,
            read_at__isnull=True,
        ).exclude(sender=request.user).update(read_at=timezone.now())

        messages = conversation.messages.select_related("sender")
        serializer = MessageSerializer(
            messages,
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)

    serializer = SendMessageSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    message = Message.objects.create(
        conversation=conversation,
        sender=request.user,
        body=serializer.validated_data["body"],
    )
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])
    response_serializer = MessageSerializer(
        message,
        context={"request": request},
    )
    return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_connections_view(request):
    connections = (
        Connection.objects.filter(
            user_id__lt=F("connected_user_id"),
            user__in=network_users_queryset(),
            connected_user__in=network_users_queryset(),
        )
        .select_related("user", "user__profile", "connected_user", "connected_user__profile")
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
