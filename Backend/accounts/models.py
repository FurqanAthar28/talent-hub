"""
Database tables for the accounts app.

1. OneTimeCode (a "template", no table of its own)
   - PasswordResetOTP      -> codes for "I forgot my password"
   - EmailVerificationOTP  -> codes for "please confirm your email"
2. AdminActionLog          -> a diary of what admins changed
"""

import hashlib
import hmac

from django.conf import settings
from django.db import models
from django.utils import timezone

# ---------------------------------------------------------------------------
# NOTE ABOUT LINES LIKE `id: int` BELOW
# Django adds some attributes by itself: `id`, `user_id` (for a ForeignKey
# called `user`), and "reverse" lists like `profile.skills`.
# VS Code (Pylance) can't see that magic, so it showed red errors.
# A line like `user_id: int` only TELLS the editor the attribute exists.
# It does NOT create a database column, and it changes nothing at runtime.
# ---------------------------------------------------------------------------


# =============================================================================
# 1. ONE-TIME CODES
# =============================================================================


class OneTimeCode(models.Model):
    """
    Everything the two kinds of code share, written ONCE.

    `abstract = True` means: Django does NOT make a table for this class.
    It only copies these fields and methods into the classes below.
    So the database tables stay exactly the same as before.
    """

    # We never save the real code, only a "fingerprint" (hash) of it.
    otp_hash = models.CharField(max_length=64)
    # How many wrong guesses have been made for this code.
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    # Empty = still usable. Filled in = used up (or switched off).
    used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]  # newest code first

    @staticmethod
    def hash_otp(otp):
        """
        Turn "042917" into a 64-character fingerprint.

        We mix in SECRET_KEY (this is called an HMAC). A 6-digit code has
        only 1 million possibilities, so a plain hash could be "un-guessed"
        in a second if someone stole the database. Without SECRET_KEY,
        they can't.
        """
        return hmac.new(
            key=settings.SECRET_KEY.encode("utf-8"),
            msg=otp.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()

    def is_used(self):
        return self.used_at is not None

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def matches(self, otp):
        """
        Is this the right code?
        compare_digest takes the same time whether the first letter or
        the last letter is wrong, so attackers can't learn from timing.
        """
        return hmac.compare_digest(self.otp_hash, self.hash_otp(otp))

    def is_valid_for(self, otp):
        """A code works only if it is unused, not expired, and correct."""
        return not self.is_used() and not self.is_expired() and self.matches(otp)


class PasswordResetOTP(OneTimeCode):
    """A code emailed when someone clicks "Forgot password"."""

    id: int
    user_id: int

    # The `user` field stays here (not in OneTimeCode) because each kind
    # of code needs its own `related_name`.
    # user.password_reset_otps.all() -> all of this user's reset codes.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,  # delete the codes if the user is deleted
        related_name="password_reset_otps",
    )

    class Meta(OneTimeCode.Meta):  # keep the "newest first" ordering
        pass

    def __str__(self):
        return f"Password reset code for user {self.user_id}"


class EmailVerificationOTP(OneTimeCode):
    """A code emailed after sign-up, to prove the email address is real."""

    id: int
    user_id: int

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification_otps",
    )

    class Meta(OneTimeCode.Meta):
        pass

    def __str__(self):
        return f"Email verification code for user {self.user_id}"


# =============================================================================
# 2. ADMIN ACTION LOG
# =============================================================================


class AdminActionLog(models.Model):
    """One row = one thing an admin did, like "deactivated user X"."""

    id: int
    actor_id: int | None
    target_user_id: int | None

    # The admin who did it. SET_NULL: if that admin is deleted later,
    # keep the log row and just leave this empty (shown as "System").
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="admin_actions_performed",
        null=True,
    )
    # The user it was done to (empty for actions that aren't about one user).
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="admin_actions_received",
        blank=True,
        null=True,
    )
    action = models.CharField(max_length=100)  # short code, e.g. "role_changed"
    description = models.CharField(max_length=255)  # sentence for humans
    metadata = models.JSONField(default=dict, blank=True)  # extra details
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        # actor_id is just the admin's ID number, already loaded. Checking it
        # first skips a database query when there is no admin.
        actor = self.actor.email if self.actor_id else "System"
        return f"{actor}: {self.action}"


class BannedEmail(models.Model):
    """
    Emails that may never sign up again (an admin banned them).
    Kept even after the account itself is deleted for good.
    """

    id: int

    email = models.EmailField(unique=True)  # always saved in lower case
    reason = models.CharField(max_length=255)
    banned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email
