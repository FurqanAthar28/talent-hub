from django.db import migrations


UI_CONTENT = {
    "loading": "Loading...",
    "professionalFallback": "Professional",
    "avatarFallbackInitial": "U",
    "editProfile": "Edit Profile",
    "connections": "Connections",
    "projects": "Projects",
    "skills": "Skills",
    "experience": "Experience",
    "startDateFallback": "Start date",
    "endDateFallback": "End date",
    "present": "Present",
    "contact": "Contact",
    "linkedin": "LinkedIn",
    "github": "GitHub",
    "portfolio": "Portfolio",
    "cv": "CV",
    "viewCv": "View CV",
    "appName": "ProfessionalHub",
    "home": "Home",
    "profile": "Profile",
    "myNetwork": "My Network",
    "logout": "Logout",
    "loggingOut": "Logging out...",
    "routeSignin": "/signin",
    "routeDashboard": "/dashboard",
    "routeProfile": "/profile",
    "routeConnections": "/connections",
    "routeProfileEdit": "/profile/edit",
    "apiAccountsMe": "/accounts/me",
    "apiAccountsLogout": "/accounts/logout",
    "apiProfileMe": "/profiles/me",
    "apiProfileExperiences": "/profiles/experiences",
    "apiProfileSkills": "/profiles/skills",
    "apiProfileProjects": "/profiles/projects",
    "apiMyConnections": "/connections/my-connections",
    "apiMediaPrefix": "/api/backend/media/",
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
        ("app_config", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
