"""
Friendlier wording for the "your code" emails.

The old texts said "OTP" (a word most people don't know) and used the old
name "Talent Hub". We only change a text if it still has its OLD default
value, so anything an admin already edited is left alone.
"""

from django.db import migrations

# key: (old default, new text)
CHANGES = {
    "emailVerificationSubject": (
        "Verify your Talent Hub email",
        "Verify your email address",
    ),
    "emailVerificationBody": (
        "Your verification OTP is {otp}. It expires in {minutes} minutes.",
        "Your verification code is {otp}. It expires in {minutes} minutes. "
        "If you didn't create an account, you can ignore this email.",
    ),
    "passwordResetEmailSubject": (
        "Password reset OTP",
        "Reset your password",
    ),
    "passwordResetEmailBody": (
        "Your password reset OTP is {otp}. It expires in {minutes} minutes.",
        "Your password reset code is {otp}. It expires in {minutes} minutes. "
        "If you didn't ask to reset your password, you can ignore this email.",
    ),
}


def use_new_texts(apps, schema_editor):
    UiContent = apps.get_model("app_config", "UiContent")
    for key, (old, new) in CHANGES.items():
        UiContent.objects.filter(key=key, value=old).update(value=new)


def use_old_texts(apps, schema_editor):
    UiContent = apps.get_model("app_config", "UiContent")
    for key, (old, new) in CHANGES.items():
        UiContent.objects.filter(key=key, value=new).update(value=old)


class Migration(migrations.Migration):
    dependencies = [
        ("app_config", "0022_seed_admin_ui_content_management"),
    ]

    operations = [
        migrations.RunPython(use_new_texts, use_old_texts),
    ]
