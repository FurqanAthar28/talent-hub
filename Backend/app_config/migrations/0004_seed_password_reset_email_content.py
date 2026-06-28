from django.db import migrations


UI_CONTENT = {
    "passwordResetEmailSubject": "Password reset OTP",
    "passwordResetEmailBody": "Your password reset OTP is {otp}. It expires in {minutes} minutes.",
    "passwordResetEmailSent": "If this email exists, an OTP has been sent.",
    "passwordResetInvalidOtp": "Invalid or expired OTP",
    "passwordResetUpdated": "Password updated successfully",
    "passwordResetEmailUnavailable": "Email service is not configured.",
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
        ("app_config", "0003_seed_password_reset_ui_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
