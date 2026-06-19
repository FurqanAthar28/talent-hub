from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Connection, ConnectionRequest
from .serializers import ConnectionRequestSerializer


def network_users_queryset():
    return User.objects.filter(is_active=True, is_staff=False, is_superuser=False)


def is_network_user(user):
    return user.is_active and not user.is_staff and not user.is_superuser


def get_relationship(current_user, target_user):
    if Connection.objects.filter(user=current_user, connected_user=target_user).exists():
        return {
            "connectionStatus": "connected",
            "requestId": None,
            "requestStatus": "accepted",
        }

    outgoing_request = ConnectionRequest.objects.filter(
        sender=current_user,
        receiver=target_user,
    ).first()

    if outgoing_request:
        return {
            "connectionStatus": f"sent_{outgoing_request.status}",
            "requestId": outgoing_request.id,
            "requestStatus": outgoing_request.status,
        }

    incoming_request = ConnectionRequest.objects.filter(
        sender=target_user,
        receiver=current_user,
    ).first()

    if incoming_request:
        return {
            "connectionStatus": f"received_{incoming_request.status}",
            "requestId": incoming_request.id,
            "requestStatus": incoming_request.status,
        }

    return {
        "connectionStatus": "none",
        "requestId": None,
        "requestStatus": None,
    }


def serialize_connection_user(user, current_user=None):
    profile = getattr(user, "profile", None)

    data = {
        "id": user.id,
        "fullName": user.get_full_name() or user.email,
        "email": user.email,
        "headline": profile.headline if profile else "",
        "location": profile.location if profile else "",
    }

    if current_user is not None:
        data.update(get_relationship(current_user, user))

    return data


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users_list_view(request):
    users = network_users_queryset().exclude(id=request.user.id)
    return Response(
        [serialize_connection_user(user, request.user) for user in users]
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_connection_request_view(request):
    sender = request.user
    receiver_id = request.data.get("receiverId")

    if not receiver_id:
        return Response(
            {"message": "receiverId is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if str(sender.id) == str(receiver_id):
        return Response(
            {"message": "You cannot send a request to yourself"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        receiver = User.objects.get(id=receiver_id)
    except User.DoesNotExist:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if not is_network_user(sender):
        return Response(
            {"message": "Admin accounts cannot send connection requests"},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not is_network_user(receiver):
        return Response(
            {"message": "This account is not available for connections"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if Connection.objects.filter(user=sender, connected_user=receiver).exists():
        return Response(
            {"message": "You are already connected"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    existing_outgoing_request = ConnectionRequest.objects.filter(
        sender=sender,
        receiver=receiver,
    ).first()

    if existing_outgoing_request:
        if existing_outgoing_request.status == "pending":
            return Response(
                {"message": "Request already sent"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if existing_outgoing_request.status == "accepted":
            return Response(
                {"message": "You are already connected"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_outgoing_request.status = "pending"
        existing_outgoing_request.save()

        serializer = ConnectionRequestSerializer(existing_outgoing_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    if ConnectionRequest.objects.filter(
        sender=receiver,
        receiver=sender,
        status="pending",
    ).exists():
        return Response(
            {"message": "This user already sent you a request"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    connection_request = ConnectionRequest.objects.create(
        sender=sender,
        receiver=receiver,
    )

    serializer = ConnectionRequestSerializer(connection_request)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pending_requests_view(request):
    requests = ConnectionRequest.objects.filter(
        receiver=request.user,
        sender__is_active=True,
        sender__is_staff=False,
        sender__is_superuser=False,
    ).order_by("-created_at")

    serializer = ConnectionRequestSerializer(requests, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sent_requests_view(request):
    requests = ConnectionRequest.objects.filter(
        sender=request.user,
        receiver__is_active=True,
        receiver__is_staff=False,
        receiver__is_superuser=False,
    ).order_by("-created_at")

    serializer = ConnectionRequestSerializer(requests, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_request_view(request):
    request_id = request.data.get("requestId")

    if not request_id:
        return Response({"message": "requestId is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        connection_request = ConnectionRequest.objects.get(
            id=request_id,
            receiver=request.user,
            status="pending",
        )
    except ConnectionRequest.DoesNotExist:
        return Response({"message": "Request not found"}, status=status.HTTP_404_NOT_FOUND)

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

    return Response({"message": "Connection request accepted"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_request_view(request):
    request_id = request.data.get("requestId")

    if not request_id:
        return Response({"message": "requestId is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        connection_request = ConnectionRequest.objects.get(
            id=request_id,
            receiver=request.user,
            status="pending",
        )
    except ConnectionRequest.DoesNotExist:
        return Response({"message": "Request not found"}, status=status.HTTP_404_NOT_FOUND)

    connection_request.status = "rejected"
    connection_request.save()

    return Response({"message": "Connection request rejected"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_connections_view(request):
    connections = Connection.objects.filter(
        user=request.user,
        connected_user__is_active=True,
        connected_user__is_staff=False,
        connected_user__is_superuser=False,
    )
    return Response(
        [
            serialize_connection_user(connection.connected_user, request.user)
            for connection in connections
        ]
    )
