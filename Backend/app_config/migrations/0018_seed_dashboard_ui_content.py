from django.db import migrations


UI_CONTENT = {
    "apiProfileActivities": "/profiles/activities",
    "apiProfileUpdate": "/profiles/me/update",
    "candidateDashboard": "Candidate Dashboard",
    "recruiterDashboard": "Recruiter Dashboard",
    "candidateDashboardIntro": "Welcome back, {name}. Manage your professional profile and grow your network.",
    "recruiterDashboardIntro": "Welcome back, {name}. Manage your company presence and hiring profile.",
    "adminDashboardIntro": "Welcome back, {name}. Manage platform users, moderation, and system activity.",
    "dashboardActions": "Dashboard Actions",
    "dashboardLoading": "Loading your dashboard...",
    "dashboardUnableToLoad": "Unable to load dashboard right now.",
    "dashboardOpenToWorkUpdateFailed": "Unable to update open-to-work status.",
    "addProfessionalHeadline": "Add a professional headline",
    "addYourProfessionalHeadline": "Add your professional headline",
    "profileViewers": "Profile Viewers",
    "notAdded": "Not added",
    "notLooking": "Not Looking",
    "openToWork": "Open to Work",
    "setOpenToWork": "Set Open to Work",
    "contactInfo": "Contact Info",
    "companyContact": "Company Contact",
    "adminInfo": "Admin Info",
    "profileCompletion": "Profile Completion",
    "moderation": "Moderation",
    "access": "Access",
    "staffControls": "Staff Controls",
    "adminWorkspace": "Admin Workspace",
    "openAdminDashboard": "Open Admin Dashboard",
    "activity": "Activity",
    "emptyActivity": "Your activity will appear here when you update your profile, add projects, or connect with professionals.",
    "professionalProfiles": "Professional Profiles",
    "addLinkedin": "Add LinkedIn",
    "addGithub": "Add GitHub",
    "addPortfolio": "Add Portfolio",
    "uploadCv": "Upload CV",
    "complete": "complete",
    "completeTheseNext": "Complete these next:",
    "completeProfile": "Complete Profile",
    "location": "Location",
}


def seed_dashboard_ui_content(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")

    for key, value in UI_CONTENT.items():
        ui_content.objects.update_or_create(key=key, defaults={"value": value})


class Migration(migrations.Migration):
    dependencies = [
        ("app_config", "0017_seed_admin_action_feedback_ui_content"),
    ]

    operations = [
        migrations.RunPython(
            seed_dashboard_ui_content,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
