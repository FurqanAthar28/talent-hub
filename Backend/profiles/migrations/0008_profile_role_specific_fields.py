from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0007_profile_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="admin_title",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="profile",
            name="company_location",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="profile",
            name="company_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="profile",
            name="company_website",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="profile",
            name="hiring_title",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
