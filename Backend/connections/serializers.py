from rest_framework import serializers
from django.contrib.auth.models import User

from .models import Connection, ConnectionRequest, Conversation, Message
from profiles.models import Profile


class ConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Connection
        fields = "__all__"


def get_user_role(user):
    if user.is_staff or user.is_superuser:
        return "admin"

    profile = get_user_profile(user)
    return profile.role if profile else "candidate"


def get_user_display_name(user):
    return user.get_full_name() or user.email or user.username


def get_user_profile(user):
    try:
        return user.profile
    except Profile.DoesNotExist:
        return None


def is_network_user(user):
    if not user.is_active or user.is_staff or user.is_superuser:
        return False

    profile = get_user_profile(user)

    if not profile:
        return True

    if profile.role != Profile.ROLE_RECRUITER:
        return True

    return (
        profile.recruiter_verification_status
        == Profile.RECRUITER_VERIFICATION_APPROVED
    )


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


class NetworkUserSerializer(serializers.ModelSerializer):
    fullName = serializers.SerializerMethodField()
    headline = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    connectionStatus = serializers.SerializerMethodField()
    requestId = serializers.SerializerMethodField()
    requestStatus = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "fullName",
            "email",
            "headline",
            "location",
            "connectionStatus",
            "requestId",
            "requestStatus",
        ]

    def get_fullName(self, obj):
        return obj.get_full_name() or obj.email

    def get_headline(self, obj):
        profile = get_user_profile(obj)
        return profile.headline if profile else ""

    def get_location(self, obj):
        profile = get_user_profile(obj)
        return profile.location if profile else ""

    def get_relationship_data(self, obj):
        current_user = self.context.get("current_user")

        if current_user is None:
            return {}

        if not hasattr(self, "_relationship_cache"):
            self._relationship_cache = {}

        if obj.id not in self._relationship_cache:
            self._relationship_cache[obj.id] = get_relationship(current_user, obj)

        return self._relationship_cache[obj.id]

    def get_connectionStatus(self, obj):
        return self.get_relationship_data(obj).get("connectionStatus", "none")

    def get_requestId(self, obj):
        return self.get_relationship_data(obj).get("requestId")

    def get_requestStatus(self, obj):
        return self.get_relationship_data(obj).get("requestStatus")


class AdminConnectionSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source="user.id", read_only=True)
    userName = serializers.SerializerMethodField()
    userEmail = serializers.EmailField(source="user.email", read_only=True)
    userRole = serializers.SerializerMethodField()
    connectedUserId = serializers.IntegerField(source="connected_user.id", read_only=True)
    connectedUserName = serializers.SerializerMethodField()
    connectedUserEmail = serializers.EmailField(source="connected_user.email", read_only=True)
    connectedUserRole = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Connection
        fields = [
            "id",
            "userId",
            "userName",
            "userEmail",
            "userRole",
            "connectedUserId",
            "connectedUserName",
            "connectedUserEmail",
            "connectedUserRole",
            "createdAt",
        ]

    def get_userName(self, obj):
        return get_user_display_name(obj.user)

    def get_connectedUserName(self, obj):
        return get_user_display_name(obj.connected_user)

    def get_userRole(self, obj):
        return get_user_role(obj.user)

    def get_connectedUserRole(self, obj):
        return get_user_role(obj.connected_user)


class AdminConnectionActionSerializer(serializers.Serializer):
    userId = serializers.IntegerField()
    connectedUserId = serializers.IntegerField()

    def validate(self, attrs):
        user_id = attrs["userId"]
        connected_user_id = attrs["connectedUserId"]

        if user_id == connected_user_id:
            raise serializers.ValidationError("Choose two different users")

        try:
            user = User.objects.select_related("profile").get(id=user_id)
            connected_user = User.objects.select_related("profile").get(
                id=connected_user_id
            )
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")

        if not is_network_user(user) or not is_network_user(connected_user):
            raise serializers.ValidationError(
                "Only active candidate and recruiter accounts can be connected"
            )

        attrs["user"] = user
        attrs["connected_user"] = connected_user
        return attrs


class ConnectionRequestSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_email = serializers.EmailField(source="sender.email", read_only=True)
    sender_headline = serializers.SerializerMethodField()
    sender_location = serializers.SerializerMethodField()
    receiver_name = serializers.SerializerMethodField()
    receiver_email = serializers.EmailField(source="receiver.email", read_only=True)
    receiver_headline = serializers.SerializerMethodField()
    receiver_location = serializers.SerializerMethodField()

    class Meta:
        model = ConnectionRequest
        fields = [
            "id",
            "sender",
            "receiver",
            "sender_name",
            "sender_email",
            "sender_headline",
            "sender_location",
            "receiver_name",
            "receiver_email",
            "receiver_headline",
            "receiver_location",
            "status",
            "created_at",
        ]

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.email

    def get_receiver_name(self, obj):
        return obj.receiver.get_full_name() or obj.receiver.email

    def get_sender_headline(self, obj):
        profile = get_user_profile(obj.sender)
        return profile.headline if profile else ""

    def get_receiver_headline(self, obj):
        profile = get_user_profile(obj.receiver)
        return profile.headline if profile else ""

    def get_sender_location(self, obj):
        profile = get_user_profile(obj.sender)
        return profile.location if profile else ""

    def get_receiver_location(self, obj):
        profile = get_user_profile(obj.receiver)
        return profile.location if profile else ""


class SendConnectionRequestSerializer(serializers.Serializer):
    receiverId = serializers.IntegerField()

    def validate(self, attrs):
        sender = self.context["request"].user
        receiver_id = attrs["receiverId"]

        if sender.id == receiver_id:
            raise serializers.ValidationError("You cannot send a request to yourself")

        try:
            receiver = User.objects.get(id=receiver_id)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")

        if not is_network_user(sender):
            raise serializers.ValidationError(
                "Connections are not available for this account"
            )

        if not is_network_user(receiver):
            raise serializers.ValidationError("This account is not available for connections")

        if Connection.objects.filter(user=sender, connected_user=receiver).exists():
            raise serializers.ValidationError("You are already connected")

        existing_outgoing_request = ConnectionRequest.objects.filter(
            sender=sender,
            receiver=receiver,
        ).first()

        if existing_outgoing_request:
            if existing_outgoing_request.status == "pending":
                raise serializers.ValidationError("Request already sent")

            if existing_outgoing_request.status == "accepted":
                raise serializers.ValidationError("You are already connected")

        if ConnectionRequest.objects.filter(
            sender=receiver,
            receiver=sender,
            status="pending",
        ).exists():
            raise serializers.ValidationError("This user already sent you a request")

        attrs["sender"] = sender
        attrs["receiver"] = receiver
        attrs["existing_request"] = existing_outgoing_request
        return attrs

    def create(self, validated_data):
        existing_request = validated_data["existing_request"]
        self.was_reopened = existing_request is not None

        if existing_request:
            existing_request.status = "pending"
            existing_request.save()
            return existing_request

        return ConnectionRequest.objects.create(
            sender=validated_data["sender"],
            receiver=validated_data["receiver"],
        )


class ConnectionRequestActionSerializer(serializers.Serializer):
    requestId = serializers.IntegerField()

    def validate_requestId(self, value):
        try:
            return ConnectionRequest.objects.get(
                id=value,
                receiver=self.context["request"].user,
                status="pending",
            )
        except ConnectionRequest.DoesNotExist:
            raise serializers.ValidationError("Request not found")


class ConversationSerializer(serializers.ModelSerializer):
    participantId = serializers.SerializerMethodField()
    participantName = serializers.SerializerMethodField()
    participantEmail = serializers.SerializerMethodField()
    participantHeadline = serializers.SerializerMethodField()
    lastMessage = serializers.SerializerMethodField()
    lastMessageAt = serializers.SerializerMethodField()
    unreadCount = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "participantId",
            "participantName",
            "participantEmail",
            "participantHeadline",
            "lastMessage",
            "lastMessageAt",
            "unreadCount",
            "updated_at",
        ]

    def get_participant(self, obj):
        current_user = self.context["request"].user
        return (
            obj.participant_two
            if obj.participant_one_id == current_user.id
            else obj.participant_one
        )

    def get_participantId(self, obj):
        return self.get_participant(obj).id

    def get_participantName(self, obj):
        return get_user_display_name(self.get_participant(obj))

    def get_participantEmail(self, obj):
        return self.get_participant(obj).email

    def get_participantHeadline(self, obj):
        profile = get_user_profile(self.get_participant(obj))
        return profile.headline if profile else ""

    def get_lastMessage(self, obj):
        message = obj.messages.order_by("-created_at").first()
        return message.body if message else ""

    def get_lastMessageAt(self, obj):
        message = obj.messages.order_by("-created_at").first()
        return message.created_at if message else None

    def get_unreadCount(self, obj):
        current_user = self.context["request"].user
        return obj.messages.filter(read_at__isnull=True).exclude(sender=current_user).count()


class MessageSerializer(serializers.ModelSerializer):
    senderName = serializers.SerializerMethodField()
    isMine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "senderName",
            "body",
            "isMine",
            "read_at",
            "created_at",
        ]

    def get_senderName(self, obj):
        return get_user_display_name(obj.sender)

    def get_isMine(self, obj):
        return obj.sender_id == self.context["request"].user.id


class StartConversationSerializer(serializers.Serializer):
    userId = serializers.IntegerField()

    def validate_userId(self, value):
        current_user = self.context["request"].user

        if current_user.id == value:
            raise serializers.ValidationError("You cannot message yourself")

        try:
            target_user = User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")

        if not Connection.objects.filter(
            user=current_user,
            connected_user=target_user,
        ).exists():
            raise serializers.ValidationError("You can only message your connections")

        return target_user


class SendMessageSerializer(serializers.Serializer):
    body = serializers.CharField()

    def validate_body(self, value):
        body = value.strip()

        if not body:
            raise serializers.ValidationError("Message cannot be empty")

        if len(body) > 2000:
            raise serializers.ValidationError("Message must be 2000 characters or less")

        return body
