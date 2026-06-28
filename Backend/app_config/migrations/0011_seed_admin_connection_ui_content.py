from django.db import migrations


UI_CONTENT = {
    "adminConnections": "Connections",
    "adminConnectionManagement": "Connection Management",
    "adminConnectionManagementIntro": "Inspect, create, and remove candidate/recruiter relationships.",
    "adminFirstUser": "First User",
    "adminSecondUser": "Second User",
    "adminSelectUser": "Select user",
    "adminCreateConnection": "Create Connection",
    "adminCreatingConnection": "Creating...",
    "adminDisconnect": "Disconnect",
    "adminDisconnecting": "Disconnecting...",
    "adminNoConnections": "No managed connections found.",
    "adminConnectionCreated": "Connection created.",
    "adminConnectionRemoved": "Connection removed.",
    "adminInvalidConnectionUsers": "Choose two different active candidate/recruiter users.",
    "apiAdminConnections": "/connections/admin/connections",
    "apiAdminConnectUsers": "/connections/admin/connect",
    "apiAdminDisconnectUsers": "/connections/admin/disconnect",
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
        ("app_config", "0010_seed_role_profile_ui_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
