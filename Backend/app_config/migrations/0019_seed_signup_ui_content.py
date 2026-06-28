from django.db import migrations


UI_CONTENT = {
    "createAccountTitle": "Create your account",
    "createAccountDescription": "Join Professional Hub to build your profile and connect with opportunities.",
    "fullName": "Full name",
    "fullNamePlaceholder": "Enter your full name",
    "confirmPassword": "Confirm password",
    "confirmPasswordPlaceholder": "Confirm your password",
    "linkedinProfile": "LinkedIn profile",
    "linkedinProfilePlaceholder": "https://www.linkedin.com/in/your-profile",
    "cvUploadTitle": "Drop your CV here or click to upload",
    "cvUploadHint": "PDF only, up to 5MB.",
    "selectedFileLabel": "Selected file",
    "createAccountButton": "Create account",
    "creatingAccountButton": "Creating account...",
    "alreadyHaveAccount": "Already have an account?",
    "signIn": "Sign in",
}


def seed_signup_ui_content(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")

    for key, value in UI_CONTENT.items():
        ui_content.objects.update_or_create(key=key, defaults={"value": value})


class Migration(migrations.Migration):
    dependencies = [
        ("app_config", "0018_seed_dashboard_ui_content"),
    ]

    operations = [
        migrations.RunPython(
            seed_signup_ui_content,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
