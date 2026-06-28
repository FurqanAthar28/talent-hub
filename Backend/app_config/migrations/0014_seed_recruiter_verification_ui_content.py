from django.db import migrations


UI_CONTENT = {
    "adminPendingRecruiters": "Pending Recruiters",
    "adminRecruiterVerification": "Recruiter Verification",
    "adminRecruiterPending": "Pending",
    "adminRecruiterApproved": "Approved",
    "adminRecruiterRejected": "Rejected",
    "adminApproveRecruiter": "Approve",
    "adminRejectRecruiter": "Reject",
    "adminVerifyingRecruiter": "Updating...",
    "adminRecruiterVerificationInvalidRole": "Only recruiter accounts can be verified.",
    "adminRecruiterVerificationUpdated": "Recruiter verification updated.",
    "recruiterVerificationPendingNotice": "Your recruiter profile is pending admin approval.",
    "recruiterVerificationRejectedNotice": "Your recruiter profile was not approved. Please update your company details or contact support.",
    "apiAdminRecruiterVerificationSuffix": "recruiter-verification",
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
        ("app_config", "0013_seed_email_verification_ui_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
