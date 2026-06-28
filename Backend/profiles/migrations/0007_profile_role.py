from django.db import migrations, models


def sync_staff_roles(apps, schema_editor):
    profile = apps.get_model("profiles", "Profile")
    profile.objects.filter(user__is_staff=True).update(role="admin")


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0006_remove_profile_profile_viewers"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="role",
            field=models.CharField(
                choices=[
                    ("candidate", "Candidate"),
                    ("recruiter", "Recruiter"),
                    ("admin", "Admin"),
                ],
                default="candidate",
                max_length=20,
            ),
        ),
        migrations.RunPython(sync_staff_roles, migrations.RunPython.noop),
    ]
