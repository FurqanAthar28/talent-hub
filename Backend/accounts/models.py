import hashlib

from django.conf import settings
from django.db import models
from django.utils import timezone


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_otps",
    )
    otp_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    @staticmethod
    def hash_otp(otp):
        return hashlib.sha256(otp.encode("utf-8")).hexdigest()

    def is_valid_for(self, otp):
        return (
            self.used_at is None
            and self.expires_at > timezone.now()
            and self.otp_hash == self.hash_otp(otp)
        )


class EmailVerificationOTP(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification_otps",
    )
    otp_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    @staticmethod
    def hash_otp(otp):
        return hashlib.sha256(otp.encode("utf-8")).hexdigest()

    def is_valid_for(self, otp):
        return (
            self.used_at is None
            and self.expires_at > timezone.now()
            and self.otp_hash == self.hash_otp(otp)
        )


class AdminActionLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="admin_actions_performed",
        null=True,
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="admin_actions_received",
        blank=True,
        null=True,
    )
    action = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        actor = self.actor.email if self.actor else "System"
        return f"{actor}: {self.action}"
