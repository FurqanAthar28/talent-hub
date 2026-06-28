from django.db import migrations


UI_CONTENT = {
    "candidateProfile": "Candidate Profile",
    "recruiterProfile": "Recruiter Profile",
    "adminProfile": "Admin Profile",
    "companyInformation": "Company Information",
    "companyName": "Company Name",
    "companyWebsite": "Company Website",
    "companyLocation": "Company Location",
    "hiringTitle": "Hiring Title",
    "adminTitle": "Admin Title",
    "hiringFocus": "Hiring Focus",
    "candidatePortfolio": "Candidate Portfolio",
    "recruiterContact": "Recruiter Contact",
    "adminContact": "Admin Contact",
    "companyNamePlaceholder": "Talent Hub Inc.",
    "companyWebsitePlaceholder": "https://company.com",
    "companyLocationPlaceholder": "City, Country",
    "hiringTitlePlaceholder": "Technical Recruiter",
    "adminTitlePlaceholder": "Platform Administrator",
    "recruiterProfileHint": "Recruiter profiles focus on company and hiring information.",
    "adminProfileHint": "Admin profiles focus on platform moderation and operations.",
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
        ("app_config", "0009_update_admin_role_suffix"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
