from django.db import migrations


UI_CONTENT = {
    "editProfileTitle": "Edit Profile",
    "editProfileDescription": "Update the profile details people see across Professional Hub.",
    "genericError": "Something went wrong. Please try again.",
    "headline": "Headline",
    "headlinePlaceholder": "Example: Frontend Developer | React | Next.js",
    "bio": "Bio",
    "bioPlaceholder": "Write a short summary of your background, skills, and goals.",
    "locationPlaceholder": "Example: Lahore, Pakistan",
    "linkedinUrl": "LinkedIn URL",
    "linkedinUrlPlaceholder": "https://www.linkedin.com/in/your-profile",
    "githubUrl": "GitHub URL",
    "githubUrlPlaceholder": "https://github.com/your-username",
    "portfolioUrl": "Portfolio URL",
    "portfolioUrlPlaceholder": "https://your-portfolio.com",
    "cvResume": "CV / Resume",
    "viewCurrentCv": "View current CV",
    "cvReplaceTitle": "Choose a PDF to upload or replace your CV",
    "cancel": "Cancel",
    "saving": "Saving...",
    "saveChanges": "Save Changes",
}


def seed_profile_edit_ui_content(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")

    for key, value in UI_CONTENT.items():
        ui_content.objects.update_or_create(key=key, defaults={"value": value})


class Migration(migrations.Migration):
    dependencies = [
        ("app_config", "0019_seed_signup_ui_content"),
    ]

    operations = [
        migrations.RunPython(
            seed_profile_edit_ui_content,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
