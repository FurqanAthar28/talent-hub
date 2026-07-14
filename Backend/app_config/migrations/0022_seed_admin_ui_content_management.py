from django.db import migrations


UI_CONTENT = {
    "adminUiContent": "UI Content",
    "adminUiContentIntro": "Edit application text without changing code or running SQL.",
    "adminUiContentSearchPlaceholder": "Search content keys or values",
    "adminNoUiContent": "No UI content found.",
    "adminSaveUiContent": "Save",
    "adminSavingUiContent": "Saving...",
    "adminUiContentUpdated": "UI content updated.",
}


def seed_admin_ui_content_management(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")

    for key, value in UI_CONTENT.items():
        ui_content.objects.update_or_create(key=key, defaults={"value": value})


class Migration(migrations.Migration):
    dependencies = [
        ("app_config", "0021_seed_messaging_ui_content"),
    ]

    operations = [
        migrations.RunPython(
            seed_admin_ui_content_management,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
