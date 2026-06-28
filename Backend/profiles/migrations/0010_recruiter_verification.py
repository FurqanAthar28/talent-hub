from django.db import migrations, models


def approve_existing_recruiters(apps, schema_editor):
    profile = apps.get_model("profiles", "Profile")
    profile.objects.filter(role="recruiter").update(
        recruiter_verification_status="approved"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0009_profile_email_verified"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="recruiter_verification_note",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="profile",
            name="recruiter_verification_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                ],
                default="approved",
                max_length=20,
            ),
        ),
        migrations.RunPython(approve_existing_recruiters, migrations.RunPython.noop),
    ]
