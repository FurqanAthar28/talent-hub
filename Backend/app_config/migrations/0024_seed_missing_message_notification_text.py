"""Add the editable notification text used by the messaging UI."""

from django.db import migrations


def seed_text(apps, schema_editor):
    UiContent = apps.get_model("app_config", "UiContent")
    UiContent.objects.get_or_create(
        key="messageNewNotification",
        defaults={"value": "New message"},
    )


def remove_text(apps, schema_editor):
    UiContent = apps.get_model("app_config", "UiContent")
    UiContent.objects.filter(key="messageNewNotification").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("app_config", "0023_friendlier_code_emails"),
    ]

    operations = [
        migrations.RunPython(seed_text, remove_text),
    ]
