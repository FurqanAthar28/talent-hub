from django.db import migrations


UI_CONTENT = {
    "adminAuditLogs": "Audit Logs",
    "adminAuditLogsIntro": "Review recent admin actions across users and connections.",
    "adminAuditAction": "Action",
    "adminAuditActor": "Actor",
    "adminAuditTarget": "Target",
    "adminAuditTime": "Time",
    "adminNoAuditLogs": "No admin actions have been recorded yet.",
    "apiAdminAuditLogs": "/accounts/admin/audit-logs",
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
        ("app_config", "0011_seed_admin_connection_ui_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
