from django.db import migrations


UI_CONTENT = {
    "signinWelcome": "Welcome back",
    "signinIntro": "Sign in to access your professional network.",
    "password": "Password",
    "passwordPlaceholder": "Enter your password",
    "signin": "Sign in",
    "signingIn": "Signing in...",
    "signinMissingFields": "Please fill in all fields.",
    "signinFailed": "Sign in failed",
    "serverConnectionError": "Unable to connect to server.",
    "newToApp": "New to ProfessionalHub?",
    "createAccount": "Create account",
    "routeSignup": "/signup",
    "apiSignin": "/accounts/signin",
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
        ("app_config", "0006_seed_admin_ui_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
