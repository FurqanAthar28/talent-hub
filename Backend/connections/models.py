from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError


class Connection(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="connections")
    connected_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="connected_to")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "connected_user")
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(user_id=models.F("connected_user_id")),
                name="connection_no_self_connection",
            ),
        ]

    def clean(self):
        if self.user_id and self.user_id == self.connected_user_id:
            raise ValidationError("A user cannot connect to themselves.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} connected with {self.connected_user.username}"


class ConnectionRequest(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
    )

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_requests")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_requests")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("sender", "receiver")
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
        return f"{self.sender.username} sent request to {self.receiver.username}"


class Conversation(models.Model):
    participant_one = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversations_as_one",
    )
    participant_two = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversations_as_two",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("participant_one", "participant_two")
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.participant_one.username} and {self.participant_two.username}"


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    body = models.TextField()
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender.username}: {self.body[:40]}"
