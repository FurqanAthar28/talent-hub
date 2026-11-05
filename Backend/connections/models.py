"""
Database tables for connections and messages.

Connection         -> "A is connected to B". We save TWO rows per friendship
                      (A->B and B->A), so "my connections" is one simple query.
ConnectionRequest  -> "A asked to connect with B" (pending / accepted / rejected)
Conversation       -> a private chat between exactly two people
Message            -> one message inside a conversation
"""

from typing import TYPE_CHECKING

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

if TYPE_CHECKING:
    # Only the editor reads this import (TYPE_CHECKING is False when the app runs).
    from django.db.models.fields.related_descriptors import RelatedManager

# ---------------------------------------------------------------------------
# NOTE ABOUT LINES LIKE `id: int` BELOW
# Django adds some attributes by itself: `id`, `user_id` (for a ForeignKey
# called `user`), and "reverse" lists like `profile.skills`.
# VS Code (Pylance) can't see that magic, so it showed red errors.
# A line like `user_id: int` only TELLS the editor the attribute exists.
# It does NOT create a database column, and it changes nothing at runtime.
# ---------------------------------------------------------------------------


class Connection(models.Model):
    id: int
    user_id: int
    connected_user_id: int

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="connections",
    )
    connected_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="connected_to",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "connected_user")  # no double rows
        constraints = [
            # The database itself refuses "A is connected to A".
            models.CheckConstraint(
                condition=~models.Q(user_id=models.F("connected_user_id")),
                name="connection_no_self_connection",
            ),
        ]

    def clean(self):
        if self.user_id and self.user_id == self.connected_user_id:
            raise ValidationError("A user cannot connect to themselves.")

    def save(self, *args, **kwargs):
        # full_clean runs clean() and the unique checks before saving.
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user} connected with {self.connected_user}"


class ConnectionRequest(models.Model):
    id: int
    sender_id: int
    receiver_id: int

    # Use these names in code instead of typing "pending" by hand.
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_REJECTED, "Rejected"),
    )

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_requests",
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_requests",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("sender", "receiver")  # one request per direction
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(sender_id=models.F("receiver_id")),
                name="connection_request_no_self_request",
            ),
        ]

    def clean(self):
        if self.sender_id and self.sender_id == self.receiver_id:
            raise ValidationError("A user cannot send a request to themselves.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.sender} sent request to {self.receiver} ({self.status})"


class Conversation(models.Model):
    """
    A chat between two people. To avoid two chats for the same pair,
    participant_one is ALWAYS the user with the smaller id
    (see get_or_create_conversation in network.py).
    """

    id: int
    participant_one_id: int
    participant_two_id: int
    messages: "RelatedManager[Message]"  # conversation.messages.all()

    participant_one = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations_as_one",
    )
    participant_two = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations_as_two",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)  # changes when a message is sent

    class Meta:
        unique_together = ("participant_one", "participant_two")
        ordering = ["-updated_at"]  # most recent chat first

    def __str__(self):
        return f"{self.participant_one} and {self.participant_two}"

    def other_participant(self, user):
        """The person in this chat who is NOT `user`."""
        if self.participant_one_id == user.id:
            return self.participant_two
        return self.participant_one


class Message(models.Model):
    id: int
    conversation_id: int
    sender_id: int

    # The longest message allowed (checked in the serializer).
    MAX_LENGTH = 2000

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_messages",
    )
    body = models.TextField()
    read_at = models.DateTimeField(blank=True, null=True)  # empty = not read yet
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]  # oldest first, like a chat

    def __str__(self):
        return f"{self.sender}: {self.body[:40]}"
