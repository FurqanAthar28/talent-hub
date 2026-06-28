from django.db import models
from django.contrib.auth.models import User


class Connection(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="connections")
    connected_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="connected_to")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "connected_user")

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
