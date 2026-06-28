from django.db import migrations


UI_CONTENT = {
    "passwordResetCooldown": "Please wait before requesting another OTP.",
    "passwordResetTooManyAttempts": "Too many invalid OTP attempts. Request a new OTP.",
}


def seed_ui_content(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")

    for key, value in UI_CONTENT.items():
        ui_content.objects.update_or_create(
            key=key,
            defaults={"value": value},
        )


def remove_seeded_ui_content(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")
    ui_content.objects.filter(key__in=UI_CONTENT.keys()).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("app_config", "0004_seed_password_reset_email_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
