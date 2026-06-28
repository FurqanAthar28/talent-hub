from django.db import migrations


UI_CONTENT = {
    "emailVerificationSubject": "Verify your Talent Hub email",
    "emailVerificationBody": "Your verification OTP is {otp}. It expires in {minutes} minutes.",
    "emailVerificationSent": "Verification OTP sent. Please check your email.",
    "emailVerificationRequired": "Please verify your email before signing in.",
    "emailVerificationInvalidOtp": "Invalid or expired verification OTP.",
    "emailVerificationTooManyAttempts": "Too many invalid verification attempts. Request a new OTP.",
    "emailVerificationCooldown": "Please wait before requesting another verification OTP.",
    "emailVerificationSuccess": "Email verified. You can now sign in.",
    "emailAlreadyVerified": "Email is already verified.",
    "verifyEmail": "Verify Email",
    "verifyEmailIntro": "Enter the OTP sent to your email to activate your account.",
    "verifyOtp": "Verify OTP",
    "verifyingOtp": "Verifying...",
    "resendOtp": "Resend OTP",
    "resendingOtp": "Resending...",
    "routeVerifyEmail": "/verify-email",
    "apiEmailVerificationRequest": "/accounts/email-verification/request",
    "apiEmailVerificationConfirm": "/accounts/email-verification/confirm",
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
        ("app_config", "0012_seed_admin_audit_ui_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
