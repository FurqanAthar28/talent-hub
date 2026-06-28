from django.db import migrations


UI_CONTENT = {
    "admin": "Admin",
    "adminDashboard": "Admin Dashboard",
    "adminIntro": "Review platform activity and manage user access.",
    "adminUsers": "Users",
    "adminActiveUsers": "Active Users",
    "adminInactiveUsers": "Inactive Users",
    "adminStaffUsers": "Staff Users",
    "adminSkills": "Skills",
    "adminProjects": "Projects",
    "adminExperiences": "Experiences",
    "adminPendingRequests": "Pending Requests",
    "adminSearchPlaceholder": "Search users by name or email",
    "adminName": "Name",
    "adminJoined": "Joined",
    "adminLastLogin": "Last login",
    "adminProfileCompletion": "Profile",
    "adminContent": "Content",
    "adminRole": "Role",
    "adminStatus": "Status",
    "adminActions": "Actions",
    "adminStaff": "Staff",
    "adminMember": "Member",
    "adminActive": "Active",
    "adminInactive": "Inactive",
    "adminDeactivate": "Deactivate",
    "adminActivate": "Activate",
    "adminUpdating": "Updating...",
    "adminNoUsers": "No users found.",
    "adminAccessDenied": "You do not have permission to view this page.",
    "adminUnableToLoad": "Unable to load admin data.",
    "adminUserNotFound": "User not found",
    "adminCannotDeactivateSelf": "You cannot deactivate your own account.",
    "adminInvalidUserStatus": "Invalid user status.",
    "routeAdmin": "/admin",
    "apiAdminStats": "/accounts/admin/stats",
    "apiAdminUsers": "/accounts/admin/users",
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
        ("app_config", "0005_seed_password_reset_rate_limit_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
