"""
Suspend, ban, soft delete and restore: the ONLY place that changes an
account's state.

THE ONE RULE (sync_is_active)
Django's `user.is_active` decides who can sign in, and every list in the app
(search, network, messages) already hides inactive people. So instead of
checking 4 things everywhere, we keep is_active = True only when ALL are true:
    - the email was confirmed with a code
    - the account isn't suspended or banned
    - the account isn't deleted
Every function below ends by calling sync_is_active(), so the flags can
never disagree.

WHY "DELETED" ISN'T A STATUS
A deleted account keeps its status (a banned person who deletes their
account is still banned when restored). Deleted = `deleted_at` has a date.
"""

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Value
from django.db.models.functions import Replace
from django.utils import timezone

from profiles.models import Profile

from .models import AdminActionLog, BannedEmail


def grace_period():
    return timedelta(days=settings.ACCOUNT_DELETION_GRACE_DAYS)


def profile_of(user):
    profile, _created = Profile.objects.get_or_create(user=user)
    return profile


def sync_is_active(user, profile):
    """Work out user.is_active from the facts above, and save both."""
    user.is_active = (
        profile.email_verified
        and profile.account_status == Profile.ACCOUNT_ACTIVE
        and profile.deleted_at is None
    )
    profile.save()
    user.save(update_fields=["is_active"])


def is_email_banned(email):
    return BannedEmail.objects.filter(email__iexact=email.strip()).exists()


# =============================================================================
# Suspend / ban (admins only)
# =============================================================================


def suspend(user, reason):
    profile = profile_of(user)
    profile.account_status = Profile.ACCOUNT_SUSPENDED
    profile.status_reason = reason
    sync_is_active(user, profile)


def ban(user, reason, banned_by):
    """Banned for good: can't sign in, and the email can't sign up again."""
    profile = profile_of(user)
    with transaction.atomic():
        profile.account_status = Profile.ACCOUNT_BANNED
        profile.status_reason = reason
        sync_is_active(user, profile)
        BannedEmail.objects.update_or_create(
            email=user.email.lower(), defaults={"reason": reason, "banned_by": banned_by}
        )


def reactivate(user):
    """Lift a suspension or a ban (an admin fixing a mistake)."""
    profile = profile_of(user)
    with transaction.atomic():
        profile.account_status = Profile.ACCOUNT_ACTIVE
        profile.status_reason = ""
        sync_is_active(user, profile)
        BannedEmail.objects.filter(email__iexact=user.email).delete()


# =============================================================================
# Soft delete and restore
# =============================================================================


def soft_delete(user, by_admin=False, reason=""):
    """
    Hidden everywhere right away; restorable until the grace period ends.
    by_admin=True: only an admin can restore it (the person can't undo it).
    """
    from .views import log_out_everywhere  # late import: views imports this file

    profile = profile_of(user)
    with transaction.atomic():
        profile.deleted_at = timezone.now()
        profile.deleted_by_admin = by_admin
        if by_admin:
            profile.status_reason = reason
        profile.deletion_warnings_sent = 0
        sync_is_active(user, profile)
        log_out_everywhere(user)
    return profile  # the UPDATED profile (an older copy may still say "not deleted")


def nice_date(moment):
    """ "December 5, 2026" (no leading zero), for messages and emails."""
    return f"{moment:%B} {moment.day}, {moment.year}"


def restore_until(profile):
    """The last moment this deleted account can be restored."""
    return profile.deleted_at + grace_period() if profile.deleted_at else None


def within_grace_period(profile):
    until = restore_until(profile)
    return until is not None and timezone.now() < until


def can_restore(profile):
    """Can the PERSON restore it themselves? (Not if an admin deleted it.)"""
    return within_grace_period(profile) and not profile.deleted_by_admin


def restore(user):
    profile = profile_of(user)
    if profile.deleted_by_admin:
        profile.status_reason = ""
    profile.deleted_at = None
    profile.deleted_by_admin = False
    profile.deletion_warnings_sent = 0
    sync_is_active(user, profile)


def delete_for_good(user):
    """
    The end of the grace period (only the daily job calls this).
    Deleting the user also deletes their profile, skills, projects, jobs,
    connections, requests and chats; profiles/signals.py removes the CV file.
    """
    email = user.email
    with transaction.atomic():
        # Old log lines may mention this email; replace it so no personal data stays.
        AdminActionLog.objects.filter(description__contains=email).update(
            description=Replace("description", Value(email), Value("a deleted user"))
        )
        user.delete()
        AdminActionLog.objects.create(
            actor=None,
            action="account_deleted_for_good",
            description=f"An account was deleted for good after {settings.ACCOUNT_DELETION_GRACE_DAYS} days",
        )
