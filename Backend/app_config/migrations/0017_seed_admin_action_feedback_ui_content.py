from django.db import migrations


UI_CONTENT = {
    "adminUserRoleUpdated": "User role updated.",
    "adminUserStatusUpdated": "User status updated.",
    "adminNoChangeRequired": "No change needed.",
}


def seed_admin_action_feedback_content(apps, schema_editor):
    UIContent = apps.get_model("app_config", "UIContent")

    for key, value in UI_CONTENT.items():
        UIContent.objects.update_or_create(key=key, defaults={"value": value})


class Migration(migrations.Migration):
    dependencies = [
        ("app_config", "0016_reseed_required_ui_content"),
    ]

    operations = [
        migrations.RunPython(
            seed_admin_action_feedback_content,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
