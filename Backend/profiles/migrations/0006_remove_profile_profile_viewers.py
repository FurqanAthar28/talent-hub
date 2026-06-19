# Generated after replacing stored viewer count with ProfileView rows.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0005_activity_profileview"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="profile",
            name="profile_viewers",
        ),
    ]
