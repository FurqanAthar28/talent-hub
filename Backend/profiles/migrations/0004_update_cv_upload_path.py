# Generated after making CV filenames person-readable.

from django.db import migrations, models
import profiles.models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0003_project_tech_stack"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="cv_file",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to=profiles.models.profile_cv_upload_path,
            ),
        ),
    ]
