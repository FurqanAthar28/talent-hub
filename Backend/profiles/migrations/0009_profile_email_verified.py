from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0008_profile_role_specific_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="email_verified",
            field=models.BooleanField(default=True),
        ),
    ]
