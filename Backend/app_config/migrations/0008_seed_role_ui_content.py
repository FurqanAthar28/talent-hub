from django.db import migrations


UI_CONTENT = {
    "role": "Role",
    "candidate": "Candidate",
    "recruiter": "Recruiter",
    "adminRole": "Admin",
    "selectRole": "Select role",
    "adminInvalidUserRole": "Invalid user role.",
    "adminCannotChangeOwnRole": "You cannot remove your own admin role.",
    "apiAdminUserRoleSuffix": "role",
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
        ("app_config", "0007_seed_signin_ui_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
