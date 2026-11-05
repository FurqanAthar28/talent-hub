"""
Add a case-insensitive unique database index for Django users.

Run this only after a backup. Duplicate lower-case emails stop the migration so
existing data is fixed deliberately instead of being changed automatically.
"""

from django.db import migrations
from django.db.models import Count
from django.db.models.functions import Lower


def check_duplicate_emails(apps, schema_editor):
    User = apps.get_model("auth", "User")
    duplicates = (
        User.objects.values(lower_email=Lower("email"))
        .exclude(lower_email="")
        .annotate(total=Count("id"))
        .filter(total__gt=1)
    )
    if duplicates.exists():
        raise RuntimeError("Backup complete, but duplicate lower-case emails exist. Fix them before migrating.")


def add_index(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "CREATE UNIQUE INDEX auth_user_email_lower_unique ON auth_user ((LOWER(email))) "
            "WHERE email <> ''"
        )


def remove_index(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP INDEX IF EXISTS auth_user_email_lower_unique")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_account_states"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(check_duplicate_emails, migrations.RunPython.noop),
        migrations.RunPython(add_index, remove_index),
    ]
