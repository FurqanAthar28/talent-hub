"""
Approval for candidates AND recruiters (it used to be recruiters only).

What this does to your existing data:
  - recruiter_verification_status is RENAMED to approval_status, so everyone
    keeps their current state (existing candidates were already "approved").
    Only NEW sign-ups start as "pending".
  - The old free-text rejection note becomes one of the two fixed reasons:
    recruiters -> "company not verifiable", others -> "email not verifiable".
  - Every existing CV gets a fingerprint (for the "duplicate CV" check).
  - Duplicate skills like "React" + "react" on one profile are merged (the
    oldest one is kept), then the database refuses new duplicates.
"""

import hashlib

import django.db.models.functions.text
from django.db import migrations, models


def reasons_from_old_notes(apps, schema_editor):
    Profile = apps.get_model("profiles", "Profile")
    for profile in Profile.objects.filter(approval_status="rejected"):
        profile.rejection_reason = (
            "company_not_verifiable" if profile.role == "recruiter" else "email_not_verifiable"
        )
        profile.save(update_fields=["rejection_reason"])


def fingerprint_existing_cvs(apps, schema_editor):
    Profile = apps.get_model("profiles", "Profile")
    for profile in Profile.objects.exclude(cv_file="").exclude(cv_file__isnull=True):
        try:
            digest = hashlib.sha256()
            with profile.cv_file.open("rb") as file:
                for chunk in file.chunks():
                    digest.update(chunk)
        except OSError:
            continue  # the file is missing on this computer: skip it
        profile.cv_sha256 = digest.hexdigest()
        profile.save(update_fields=["cv_sha256"])


def merge_duplicate_skills(apps, schema_editor):
    Skill = apps.get_model("profiles", "Skill")
    seen = set()
    for skill in Skill.objects.order_by("profile_id", "id"):
        key = (skill.profile_id, skill.name.strip().lower())
        if key in seen:
            skill.delete()
        else:
            seen.add(key)


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0011_app_admins_are_not_django_staff"),
    ]

    operations = [
        migrations.RenameField("profile", "recruiter_verification_status", "approval_status"),
        migrations.AlterField(
            model_name="profile",
            name="approval_status",
            field=models.CharField(
                choices=[("pending", "Waiting for approval"), ("approved", "Approved"), ("rejected", "Not approved")],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="rejection_reason",
            field=models.CharField(
                blank=True,
                choices=[("email_not_verifiable", "Email not verifiable"), ("company_not_verifiable", "Company not verifiable")],
                max_length=40,
            ),
        ),
        migrations.RunPython(reasons_from_old_notes, migrations.RunPython.noop),
        migrations.RemoveField("profile", "recruiter_verification_note"),
        migrations.AddField(
            model_name="profile",
            name="cv_sha256",
            field=models.CharField(blank=True, editable=False, max_length=64),
        ),
        migrations.RunPython(fingerprint_existing_cvs, migrations.RunPython.noop),
        migrations.RunPython(merge_duplicate_skills, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="skill",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Lower("name"),
                models.F("profile"),
                name="unique_skill_per_profile_any_case",
            ),
        ),
    ]
