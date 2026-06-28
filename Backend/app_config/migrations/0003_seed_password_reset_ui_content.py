from django.db import migrations


UI_CONTENT = {
    "forgotPassword": "Forgot password?",
    "resetPassword": "Reset Password",
    "resetPasswordIntro": "Enter your email to receive a password reset OTP.",
    "email": "Email",
    "emailPlaceholder": "john.doe@company.com",
    "sendOtp": "Send OTP",
    "sendingOtp": "Sending OTP...",
    "otp": "OTP",
    "otpPlaceholder": "Enter 6 digit OTP",
    "newPassword": "New Password",
    "newPasswordPlaceholder": "Enter new password",
    "updatePassword": "Update Password",
    "updatingPassword": "Updating Password...",
    "backToSignin": "Back to sign in",
    "otpSentNextStep": "Enter the OTP sent to your email and choose a new password.",
    "passwordResetSuccessRedirect": "Password updated successfully. Redirecting to sign in...",
    "routeForgotPassword": "/forgot-password",
    "apiPasswordResetRequest": "/accounts/password-reset/request",
    "apiPasswordResetConfirm": "/accounts/password-reset/confirm",
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
        ("app_config", "0002_seed_ui_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
