"""
The daily job for deleted accounts. Run it once a day:

    python manage.py purge_deleted_accounts
    python manage.py purge_deleted_accounts --dry-run   (only SAY what it would do)

For every deleted account it does ONE of these:
  - grace period over          -> delete it for good (profile, chats, CV file...)
  - 1 day or less left         -> email "deleted for good in 24 hours" (once)
  - 7 days or less left        -> email "deleted for good in 7 days" (once)

It's safe to run late or twice: it looks at dates, and remembers which
warnings were sent, so nobody gets the same email twice. If the job missed a
week, the next run still sends the right warning (or deletes).

HOW TO RUN IT EVERY DAY
  Windows (your laptop): Task Scheduler -> Create Basic Task -> Daily ->
      Program: <your venv>\\Scripts\\python.exe
      Arguments: manage.py purge_deleted_accounts
      Start in: the Backend folder
  Hosting (e.g. Render): a "Cron Job" with schedule "0 3 * * *" and the
      same command.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.account_state import delete_for_good, restore_until
from accounts.emails import send_account_email
from profiles.models import Profile


class Command(BaseCommand):
    help = "Send deletion warnings and delete accounts whose grace period is over (run daily)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Only show what would happen.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        now = timezone.now()
        # Biggest first, e.g. (7, 1): warning number 1 = 7 days, number 2 = 1 day.
        warning_days = sorted(settings.ACCOUNT_DELETION_WARNING_DAYS, reverse=True)
        counts = {"deleted": 0, "warned": 0}

        deleted_profiles = Profile.objects.filter(deleted_at__isnull=False).select_related("user")
        for profile in deleted_profiles:
            user = profile.user
            until = restore_until(profile)
            if until is None:  # can't happen (we only loaded deleted accounts), but be safe
                continue

            if now >= until:
                self.stdout.write(f"Delete for good: {user.email}")
                if not dry_run:
                    delete_for_good(user)
                counts["deleted"] += 1
                continue

            # Removed by an admin: the person can't restore it, so no "sign in to restore" emails.
            if profile.deleted_by_admin:
                continue

            # Which warnings are due? (all whose day has come)
            due = sum(1 for days in warning_days if now >= until - timedelta(days=days))
            if due > profile.deletion_warnings_sent:
                self.stdout.write(f"Warn ({until - now} left): {user.email}")
                if not dry_run and send_account_email(user, "warning", until):
                    profile.deletion_warnings_sent = due
                    profile.save(update_fields=["deletion_warnings_sent"])
                counts["warned"] += 1

        prefix = "Would have" if dry_run else "Done:"
        self.stdout.write(
            self.style.SUCCESS(f"{prefix} deleted {counts['deleted']} and warned {counts['warned']} account(s).")
        )
