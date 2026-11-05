"""
Serializers for connections and messages.

PRIVACY RULE: you only see someone's EMAIL once you are connected to them
(or if it's your own). Strangers see name, headline and location only.

SPEED RULE: serializers here never ask the database questions inside a
loop. The views load everything first (select_related, annotate, or
get_relationships) and pass it in.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from profiles.permissions import role_of

from .models import ConnectionRequest, Conversation, Message
from .network import NO_RELATIONSHIP, are_connected, is_network_user

User = get_user_model()


# =============================================================================
# SMALL HELPERS
# =============================================================================


def display_name(user):
    return user.get_full_name() or "Member"


def profile_text(user, field_name):
    """Read a profile field (like "headline") safely, even with no profile."""
    profile = getattr(user, "profile", None)
    return getattr(profile, field_name, "") if profile else ""


def user_role(user):
    return role_of(user)  # one rule for the whole app (profiles/permissions.py)


def get_user_or_error(user_id):
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise serializers.ValidationError("User not found") from None


# =============================================================================
# PEOPLE AND REQUESTS (what normal users see)
# =============================================================================


class NetworkUserSerializer(serializers.ModelSerializer):
    """
    One person in the "find people" or "my connections" list.

    The view must pass context={"relationships": {...}} made by
    network.get_relationships(), so we don't ask the database per person.
    """

    fullName = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
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

    def relationship(self, obj):
        return self.context.get("relationships", {}).get(obj.id, NO_RELATIONSHIP)

    def get_fullName(self, obj):
        return display_name(obj)

    def get_email(self, obj):
        # Only connections can see your email.
        if self.relationship(obj)["connectionStatus"] == "connected":
            return obj.email
        return ""

    def get_headline(self, obj):
        return profile_text(obj, "headline")

    def get_location(self, obj):
        return profile_text(obj, "location")

    def get_connectionStatus(self, obj):
        return self.relationship(obj)["connectionStatus"]

    def get_requestId(self, obj):
        return self.relationship(obj)["requestId"]

    def get_requestStatus(self, obj):
        return self.relationship(obj)["requestStatus"]


class ConnectionRequestSerializer(serializers.ModelSerializer):
    """
    A connection request. The view must pass context={"request": request}
    so we know who is looking (to hide the other person's email).
    """

    sender_name = serializers.SerializerMethodField()
    sender_email = serializers.SerializerMethodField()
    sender_headline = serializers.SerializerMethodField()
    sender_location = serializers.SerializerMethodField()
    receiver_name = serializers.SerializerMethodField()
    receiver_email = serializers.SerializerMethodField()
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

    def visible_email(self, obj, person):
        """Your own email, or anyone's once the request was accepted."""
        current_user = self.context["request"].user
        if person.id == current_user.id or obj.status == ConnectionRequest.STATUS_ACCEPTED:
            return person.email
        return ""

    def get_sender_name(self, obj):
        return display_name(obj.sender)

    def get_receiver_name(self, obj):
        return display_name(obj.receiver)

    def get_sender_email(self, obj):
        return self.visible_email(obj, obj.sender)

    def get_receiver_email(self, obj):
        return self.visible_email(obj, obj.receiver)

    def get_sender_headline(self, obj):
        return profile_text(obj.sender, "headline")

    def get_receiver_headline(self, obj):
        return profile_text(obj.receiver, "headline")

    def get_sender_location(self, obj):
        return profile_text(obj.sender, "location")

    def get_receiver_location(self, obj):
        return profile_text(obj.receiver, "location")


class SendConnectionRequestSerializer(serializers.Serializer):
    """Checks a "send connection request" and then sends it."""

    receiverId = serializers.IntegerField()

    def validate(self, attrs):
        sender = self.context["request"].user

        if sender.id == attrs["receiverId"]:
            raise serializers.ValidationError("You cannot send a request to yourself")

        receiver = get_user_or_error(attrs["receiverId"])

        if not is_network_user(receiver):
            raise serializers.ValidationError("This account is not available for connections")

        if are_connected(sender, receiver):
            raise serializers.ValidationError("You are already connected")

        # Did I already ask them?
        my_request = ConnectionRequest.objects.filter(sender=sender, receiver=receiver).first()
        if my_request and my_request.status == ConnectionRequest.STATUS_PENDING:
            raise serializers.ValidationError("Request already sent")

        # Did they already ask me? Then I should accept theirs instead.
        if ConnectionRequest.objects.filter(
            sender=receiver,
            receiver=sender,
            status=ConnectionRequest.STATUS_PENDING,
        ).exists():
            raise serializers.ValidationError("This user already sent you a request")

        attrs["sender"] = sender
        attrs["receiver"] = receiver
        attrs["old_request"] = my_request  # a rejected/old request we can reuse
        return attrs

    def create(self, validated_data):
        old_request = validated_data["old_request"]
        self.was_reopened = old_request is not None

        # Re-use the old row (the database allows only one per direction).
        if old_request:
            old_request.status = ConnectionRequest.STATUS_PENDING
            old_request.save(update_fields=["status"])
            return old_request

        return ConnectionRequest.objects.create(
            sender=validated_data["sender"],
            receiver=validated_data["receiver"],
        )


class ConnectionRequestActionSerializer(serializers.Serializer):
    """For accept / reject: the request must be pending AND sent to me."""

    requestId = serializers.IntegerField()

    def validate_requestId(self, value):
        try:
            return ConnectionRequest.objects.select_related("sender", "receiver").get(
                id=value,
                receiver=self.context["request"].user,
                status=ConnectionRequest.STATUS_PENDING,
            )
        except ConnectionRequest.DoesNotExist:
            raise serializers.ValidationError("Request not found") from None


# =============================================================================
# MESSAGES (what normal users see)
# =============================================================================


class ConversationSerializer(serializers.ModelSerializer):
    """
    One chat in the chat list.

    lastMessage, lastMessageAt and unreadCount come from extra columns the
    view adds with `annotate` (see conversations_for() in views.py),
    so we don't ask the database once per chat.
    """

    participantId = serializers.SerializerMethodField()
    participantName = serializers.SerializerMethodField()
    participantEmail = serializers.SerializerMethodField()
    participantHeadline = serializers.SerializerMethodField()
    lastMessage = serializers.CharField(source="last_message_body", default="", read_only=True)
    lastMessageAt = serializers.DateTimeField(source="last_message_at", default=None, read_only=True)
    unreadCount = serializers.IntegerField(source="unread_count", default=0, read_only=True)

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

    def other_person(self, obj):
        return obj.other_participant(self.context["request"].user)

    def get_participantId(self, obj):
        return self.other_person(obj).id

    def get_participantName(self, obj):
        return display_name(self.other_person(obj))

    def get_participantEmail(self, obj):
        # You can only chat with connections, so showing the email is fine.
        return self.other_person(obj).email

    def get_participantHeadline(self, obj):
        return profile_text(self.other_person(obj), "headline")


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
        return display_name(obj.sender)

    def get_isMine(self, obj):
        return obj.sender_id == self.context["request"].user.id


class StartConversationSerializer(serializers.Serializer):
    userId = serializers.IntegerField()

    def validate_userId(self, value):
        current_user = self.context["request"].user

        if current_user.id == value:
            raise serializers.ValidationError("You cannot message yourself")

        other_user = get_user_or_error(value)

        if not are_connected(current_user, other_user):
            raise serializers.ValidationError("You can only message your connections")

        return other_user


class SendMessageSerializer(serializers.Serializer):
    # CharField removes spaces at the start/end and refuses empty text.
    body = serializers.CharField(
        max_length=Message.MAX_LENGTH,
        error_messages={
            "blank": "Message cannot be empty",
            "max_length": f"Message must be {Message.MAX_LENGTH} characters or less",
        },
    )
