"""
Connections and messaging API (for normal users).

WHAT'S IN THIS FILE
1. Permission + helpers
2. People and connection requests
3. Messages

Admin-only endpoints live in admin_views.py.
"""

from django.db.models import Count, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from app_config.models import UiContent

from .models import ConnectionRequest, Conversation, Message
from .network import (
    are_connected,
    connect_users,
    get_or_create_conversation,
    get_relationships,
    is_network_user,
    network_users,
)
from .serializers import (
    ConnectionRequestActionSerializer,
    ConnectionRequestSerializer,
    ConversationSerializer,
    MessageSerializer,
    NetworkUserSerializer,
    SendConnectionRequestSerializer,
    SendMessageSerializer,
    StartConversationSerializer,
)


# =============================================================================
# 1. PERMISSION + HELPERS
# =============================================================================


class IsNetworkUser(BasePermission):
    """
    Only candidates and approved recruiters can use connections and messages.
    Admins and unapproved recruiters get a 403 with a friendly message.

    A "permission class" is a small checker DRF runs BEFORE the view.
    Before, every view repeated the same 4 lines to do this.
    """

    @property
    def message(self):
        return UiContent.get_text(
            "connectionAdminUnavailable",
            default="Connections are not available for this account.",
        )

    def has_permission(self, request, view):
        return is_network_user(request.user)


# Every view in this file uses these two checks: logged in + network user.
NETWORK_PERMISSIONS = [IsAuthenticated, IsNetworkUser]


def people_response(request, users):
    """
    Turn a list of users into JSON, with each person's relationship to me.
    get_relationships asks the database 2 questions in total, not per person.
    """
    users = list(users.select_related("profile"))
    relationships = get_relationships(request.user, [user.id for user in users])
    serializer = NetworkUserSerializer(
        users,
        many=True,
        context={"relationships": relationships},
    )
    return Response(serializer.data)


def requests_response(request, requests):
    requests = requests.select_related(
        "sender", "sender__profile", "receiver", "receiver__profile"
    ).order_by("-created_at")
    serializer = ConnectionRequestSerializer(requests, many=True, context={"request": request})
    return Response(serializer.data)


def conversations_for(user):
    """
    All of a user's chats, with 3 extra columns worked out BY THE DATABASE:
        last_message_body, last_message_at -> the newest message
        unread_count                       -> messages to me I haven't read

    `Subquery` = "a small question inside the big question". It finds the
    newest message for each chat in the same database trip.
    """
    newest_message = Message.objects.filter(conversation=OuterRef("pk")).order_by("-created_at")

    return (
        Conversation.objects.filter(Q(participant_one=user) | Q(participant_two=user))
        .select_related(
            "participant_one",
            "participant_one__profile",
            "participant_two",
            "participant_two__profile",
        )
        .annotate(
            last_message_body=Subquery(newest_message.values("body")[:1]),
            last_message_at=Subquery(newest_message.values("created_at")[:1]),
            unread_count=Count(
                "messages",
                filter=Q(messages__read_at__isnull=True) & ~Q(messages__sender=user),
            ),
        )
    )


# =============================================================================
# 2. PEOPLE AND CONNECTION REQUESTS
# =============================================================================


@api_view(["GET"])
@permission_classes(NETWORK_PERMISSIONS)
def users_list_view(request):
    """Everyone I could connect with (except me)."""
    return people_response(request, network_users().exclude(id=request.user.id))


@api_view(["GET"])
@permission_classes(NETWORK_PERMISSIONS)
def my_connections_view(request):
    """People I'm connected to (only ones who can still use the network)."""
    connected = network_users().filter(connected_to__user=request.user)
    return people_response(request, connected)


@api_view(["POST"])
@permission_classes(NETWORK_PERMISSIONS)
def send_connection_request_view(request):
    serializer = SendConnectionRequestSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)  # bad data -> 400 with a "message"
    connection_request = serializer.save()

    # 200 = we re-opened an old request, 201 = we made a new one.
    response_status = status.HTTP_200_OK if serializer.was_reopened else status.HTTP_201_CREATED
    data = ConnectionRequestSerializer(connection_request, context={"request": request}).data
    return Response(data, status=response_status)


@api_view(["GET"])
@permission_classes(NETWORK_PERMISSIONS)
def pending_requests_view(request):
    """Requests other people sent ME that I haven't answered yet."""
    requests = ConnectionRequest.objects.filter(
        receiver=request.user,
        sender__in=network_users(),
        status=ConnectionRequest.STATUS_PENDING,
    )
    return requests_response(request, requests)


@api_view(["GET"])
@permission_classes(NETWORK_PERMISSIONS)
def sent_requests_view(request):
    """Requests I sent (any status)."""
    requests = ConnectionRequest.objects.filter(
        sender=request.user,
        receiver__in=network_users(),
    )
    return requests_response(request, requests)


@api_view(["POST"])
@permission_classes(NETWORK_PERMISSIONS)
def accept_request_view(request):
    serializer = ConnectionRequestActionSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    connection_request = serializer.validated_data["requestId"]

    # The sender may have been deactivated since they asked.
    if not is_network_user(connection_request.sender):
        return Response(
            {"message": "This account is not available for connections"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    connection_request.status = ConnectionRequest.STATUS_ACCEPTED
    connection_request.save(update_fields=["status"])
    connect_users(connection_request.sender, connection_request.receiver)

    return Response({"message": UiContent.get_text("connectionRequestAccepted")})


@api_view(["POST"])
@permission_classes(NETWORK_PERMISSIONS)
def reject_request_view(request):
    serializer = ConnectionRequestActionSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    connection_request = serializer.validated_data["requestId"]

    connection_request.status = ConnectionRequest.STATUS_REJECTED
    connection_request.save(update_fields=["status"])

    return Response({"message": UiContent.get_text("connectionRequestRejected")})


# =============================================================================
# 3. MESSAGES
# =============================================================================


@api_view(["GET"])
@permission_classes(NETWORK_PERMISSIONS)
def conversations_list_view(request):
    conversations = conversations_for(request.user)
    serializer = ConversationSerializer(conversations, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes(NETWORK_PERMISSIONS)
def start_conversation_view(request):
    """Open (or re-open) a chat with one of my connections."""
    serializer = StartConversationSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    other_user = serializer.validated_data["userId"]

    conversation = get_or_create_conversation(request.user, other_user)

    # Load it again through conversations_for, so it has the extra columns.
    conversation = conversations_for(request.user).get(pk=conversation.pk)
    data = ConversationSerializer(conversation, context={"request": request}).data
    return Response(data, status=status.HTTP_200_OK)


@api_view(["GET", "POST"])
@permission_classes(NETWORK_PERMISSIONS)
def conversation_messages_view(request, conversation_id):
    """
    GET  -> read all messages in a chat (and mark the other person's as read)
    POST -> send a new message
    """
    # Only find chats I'm part of. Anyone else's chat is "not found".
    my_conversations = Conversation.objects.filter(
        Q(participant_one=request.user) | Q(participant_two=request.user)
    )
    conversation = get_object_or_404(my_conversations, id=conversation_id)

    if request.method == "GET":
        conversation.messages.filter(read_at__isnull=True).exclude(
            sender=request.user
        ).update(read_at=timezone.now())

        messages = conversation.messages.select_related("sender")
        serializer = MessageSerializer(messages, many=True, context={"request": request})
        return Response(serializer.data)

    # POST: you can only send messages while you are still connected.
    other_person = conversation.other_participant(request.user)
    if not are_connected(request.user, other_person) or not is_network_user(other_person):
        return Response(
            {"message": "You can only message your connections"},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = SendMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    message = Message.objects.create(
        conversation=conversation,
        sender=request.user,
        body=serializer.validated_data["body"],
    )
    # Move this chat to the top of the list.
    conversation.save(update_fields=["updated_at"])  # auto_now sets the time

    data = MessageSerializer(message, context={"request": request}).data
    return Response(data, status=status.HTTP_201_CREATED)
