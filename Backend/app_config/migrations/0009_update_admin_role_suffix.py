from django.db import migrations


def update_admin_role_suffix(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")
    ui_content.objects.update_or_create(
        key="apiAdminUserRoleSuffix",
        defaults={"value": "role/"},
    )


def revert_admin_role_suffix(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")
    ui_content.objects.update_or_create(
        key="apiAdminUserRoleSuffix",
        defaults={"value": "role"},
    )


class Migration(migrations.Migration):

    dependencies = [
        ("app_config", "0008_seed_role_ui_content"),
    ]

    operations = [
        migrations.RunPython(update_admin_role_suffix, revert_admin_role_suffix),
    ]
