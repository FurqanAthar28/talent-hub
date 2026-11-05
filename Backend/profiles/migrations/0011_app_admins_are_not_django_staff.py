"""
App admins and Django staff are now two separate things.

Before: making someone "admin" on the app's admin page ALSO made them
Django staff (so they could sign in to Django's built-in /admin/ site).
Now the app only looks at profile.role.

This step fixes the accounts that were made the old way:
  - staff who are NOT superusers -> stay app admins, lose Django staff.
  - superusers (made with createsuperuser) are left alone.
"""

from django.conf import settings
from django.db import migrations


def split_admins(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    Profile = apps.get_model("profiles", "Profile")

    for user in User.objects.filter(is_staff=True, is_superuser=False):
        profile, _created = Profile.objects.get_or_create(user=user)
        profile.role = "admin"
        profile.save(update_fields=["role"])

        user.is_staff = False
        user.save(update_fields=["is_staff"])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("profiles", "0010_recruiter_verification"),
    ]

    operations = [
        # Going back is a no-op: we can't know who had staff before.
        migrations.RunPython(split_admins, migrations.RunPython.noop),
    ]
