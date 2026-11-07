"""
Database tables for the profiles app.

Profile        -> one per user: headline, bio, links, CV, role...
ProfileView    -> "who looked at my profile"
Activity       -> "Added skill: Python" lines shown on the dashboard
Skill          -> one skill of a profile
Project        -> one project of a profile
Experience     -> one job of a profile
"""

import hashlib
import uuid
from functools import cached_property
from collections.abc import Collection
from typing import TYPE_CHECKING, Any, Self

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

if TYPE_CHECKING:
    # Only the editor reads this import (TYPE_CHECKING is False when the app runs).
    from django.db.models.fields.related_descriptors import RelatedManager

# ---------------------------------------------------------------------------
# NOTE ABOUT LINES LIKE `id: int` BELOW
# Django adds some attributes by itself: `id`, `user_id` (for a ForeignKey
# called `user`), and "reverse" lists like `profile.skills`.
# VS Code (Pylance) can't see that magic, so it showed red errors.
# A line like `user_id: int` only TELLS the editor the attribute exists.
# It does NOT create a database column, and it changes nothing at runtime.
# ---------------------------------------------------------------------------


def fingerprint(file):
    """SHA-256 of a file's bytes, read in small pieces (big files never fill memory)."""
    digest = hashlib.sha256()
    file.seek(0)
    for chunk in file.chunks():
        digest.update(chunk)
    file.seek(0)
    return digest.hexdigest()


def profile_cv_upload_path(instance, filename):
    """
    Where a CV file is saved, for example "cvs/42/3f9c...e1.pdf".

    We use a random name (uuid4) instead of the person's name, so nobody
    can guess the address of someone else's CV.
    (Django calls this function by name, so keep the name the same.)
    """
    return f"cvs/{instance.user_id}/{uuid.uuid4().hex}.pdf"


class Profile(models.Model):
    id: int
    user_id: int
    # The "reverse" lists, e.g. profile.skills.all()
    skills: "RelatedManager[Skill]"
    projects: "RelatedManager[Project]"
    experiences: "RelatedManager[Experience]"
    activities: "RelatedManager[Activity]"
    views: "RelatedManager[ProfileView]"

    # ----- Allowed values for `role` -----
    ROLE_CANDIDATE = "candidate"
    ROLE_RECRUITER = "recruiter"
    ROLE_ADMIN = "admin"
    ROLE_CHOICES = (
        (ROLE_CANDIDATE, "Candidate"),
        (ROLE_RECRUITER, "Recruiter"),
        (ROLE_ADMIN, "Admin"),
    )

    # ----- Allowed values for `approval_status` (candidates AND recruiters) -----
    APPROVAL_PENDING = "pending"
    APPROVAL_APPROVED = "approved"
    APPROVAL_REJECTED = "rejected"
    APPROVAL_CHOICES = (
        (APPROVAL_PENDING, "Waiting for approval"),
        (APPROVAL_APPROVED, "Approved"),
        (APPROVAL_REJECTED, "Not approved"),
    )

    # ----- Recruiter company + hiring choices -----
    COMPANY_SIZE_CHOICES = (
        ("1-10", "1-10 people"),
        ("11-50", "11-50 people"),
        ("51-200", "51-200 people"),
        ("201-1000", "201-1,000 people"),
        ("1000+", "1,000+ people"),
    )
    WORK_STYLE_CHOICES = (
        ("onsite", "On-site"),
        ("hybrid", "Hybrid"),
        ("remote", "Remote"),
    )
    HIRING_LEVEL_CHOICES = (
        ("intern", "Internship"),
        ("junior", "Junior"),
        ("mid", "Mid-level"),
        ("senior", "Senior"),
        ("lead", "Lead / Manager"),
    )

    # ----- Allowed values for `account_status` -----
    # (Deleted accounts are NOT a status: they have a `deleted_at` date, so
    #  they can be restored, and still remember if they were suspended.)
    ACCOUNT_ACTIVE = "active"
    ACCOUNT_SUSPENDED = "suspended"  # can't sign in until an admin lifts it
    ACCOUNT_BANNED = "banned"  # can't sign in, and the email can't sign up again
    ACCOUNT_STATUS_CHOICES = (
        (ACCOUNT_ACTIVE, "Active"),
        (ACCOUNT_SUSPENDED, "Suspended"),
        (ACCOUNT_BANNED, "Banned"),
    )

    # ----- The ONLY reasons an admin may give for "not approved" -----
    REJECTION_EMAIL = "email_not_verifiable"
    REJECTION_COMPANY = "company_not_verifiable"
    REJECTION_CHOICES = (
        (REJECTION_EMAIL, "Email not verifiable"),
        (REJECTION_COMPANY, "Company not verifiable"),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",  # lets us write user.profile
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CANDIDATE, db_index=True)

    # ----- Everyone -----
    headline = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)

    # ----- Candidates -----
    linkedin_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    portfolio_url = models.URLField(blank=True)
    cv_file = models.FileField(upload_to=profile_cv_upload_path, blank=True, null=True)
    open_to_work = models.BooleanField(default=False)

    # ----- Recruiters -----
    company_name = models.CharField(max_length=255, blank=True)
    company_website = models.URLField(blank=True)
    company_location = models.CharField(max_length=255, blank=True)
    hiring_title = models.CharField(max_length=255, blank=True)
    # About the company (all optional; shown on the recruiter's profile).
    company_about = models.TextField(blank=True)
    company_industry = models.CharField(max_length=100, blank=True)
    company_size = models.CharField(max_length=20, choices=COMPANY_SIZE_CHOICES, blank=True)
    company_linkedin_url = models.URLField(blank=True)
    # Lists of short words, e.g. ["onsite", "remote"]. Allowed values and
    # limits are checked in profiles/serializers.py (RecruiterListField).
    work_styles = models.JSONField(default=list, blank=True)
    # "Hiring for": what candidates should know before reaching out.
    hiring_now = models.BooleanField(default=True)
    hiring_roles = models.JSONField(default=list, blank=True)  # ["Backend Engineer", ...]
    hiring_skills = models.JSONField(default=list, blank=True)  # ["Django", "React", ...]
    hiring_locations = models.JSONField(default=list, blank=True)  # ["Lahore", "Remote (PK)"]
    hiring_levels = models.JSONField(default=list, blank=True)  # ["junior", "mid"]

    # ----- Approval (candidates AND recruiters) -----
    # New people wait for an admin. Only approved people appear in search
    # and can connect or send messages (see connections/network.py).
    approval_status = models.CharField(
        max_length=20, choices=APPROVAL_CHOICES, default=APPROVAL_PENDING, db_index=True
    )
    # Set only when approval_status is "rejected". The person sees it and
    # can fix their profile, then send it for review again.
    rejection_reason = models.CharField(max_length=40, choices=REJECTION_CHOICES, blank=True)

    # A fingerprint of the CV file. Two accounts with the same fingerprint
    # uploaded the very same file: the admin sees a "duplicate CV" warning.
    cv_sha256 = models.CharField(max_length=64, blank=True, editable=False)

    # ----- Admins -----
    admin_title = models.CharField(max_length=255, blank=True)

    # ----- Account state -----
    # Never change these by hand: use accounts/account_state.py, which also
    # keeps user.is_active in step (so the two can never disagree).
    email_verified = models.BooleanField(default=True)
    account_status = models.CharField(
        max_length=20, choices=ACCOUNT_STATUS_CHOICES, default=ACCOUNT_ACTIVE, db_index=True
    )
    # Why the account was suspended or banned (the person sees it at sign-in).
    status_reason = models.CharField(max_length=255, blank=True)
    # Soft delete: set = deleted. Restorable for ACCOUNT_DELETION_GRACE_DAYS
    # (settings.py); after that the daily job deletes it for good.
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    # Deleted by an admin (e.g. for misuse)? Then only an admin can restore it.
    deleted_by_admin = models.BooleanField(default=False)
    # How many "your account will be deleted soon" emails were sent (0, 1 or 2).
    deletion_warnings_sent = models.PositiveSmallIntegerField(default=0)
    password_changed_at = models.DateTimeField(null=True, blank=True, editable=False)

    # NOT USED ANY MORE. Completion is now calculated live
    # (see profiles/utils.py). Kept only so the database doesn't need a
    # migration today. You can remove it later with makemigrations.
    profile_completion = models.IntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["role", "approval_status"], name="profile_role_approval_idx"),
            models.Index(fields=["approval_status", "account_status"], name="profile_approval_account_idx"),
            models.Index(fields=["account_status", "deleted_at"], name="profile_status_deleted_idx"),
        ]

    def __str__(self):
        return self.user.get_full_name() or self.user.email

    @classmethod
    def from_db(cls, db: str | None, field_names: Collection[str], values: Collection[Any], **kwargs: Any) -> Self:
        """Remember which CV file the database had, to spot a NEW one in save()."""
        profile = super().from_db(db, field_names, values, **kwargs)
        profile._cv_name_in_db = profile.__dict__.get("cv_file") or ""
        return profile

    def save(self, *args, **kwargs):
        """Keep cv_sha256 in step with the CV file, whichever code saves it."""
        update_fields = kwargs.get("update_fields")
        cv_is_saved = update_fields is None or "cv_file" in update_fields

        if cv_is_saved:
            if not self.cv_file:
                self.cv_sha256 = ""
            elif not getattr(self.cv_file, "_committed", True):
                # A new upload that isn't stored yet: read it from memory.
                self.cv_sha256 = fingerprint(self.cv_file)
            elif self.cv_file.name != getattr(self, "_cv_name_in_db", None) or not self.cv_sha256:
                # Already stored (e.g. by cv_file.save()) but new to the database: read it back.
                try:
                    with self.cv_file.open("rb") as stored:
                        self.cv_sha256 = fingerprint(stored)
                except OSError:
                    # The file is missing on this server (e.g. uploads wiped by a
                    # redeploy). Saving the profile must still work.
                    self.cv_sha256 = ""
            if update_fields is not None:
                kwargs["update_fields"] = {*update_fields, "cv_sha256"}

        super().save(*args, **kwargs)
        self._cv_name_in_db = self.cv_file.name if self.cv_file else ""

    @cached_property
    def related_counts(self):
        """
        How many skills, projects, etc. this profile has.

        `cached_property` = work it out the FIRST time we ask, then remember
        the answer. Without it, one page load asked the database for the
        same counts 2-3 times each.
        """
        return {
            "skills": self.skills.count(),
            "projects": self.projects.count(),
            "experiences": self.experiences.count(),
            "viewers": self.views.count(),
            "connections": self.user.connections.count(),
        }


class ProfileView(models.Model):
    """One row per (profile, viewer). viewed_at updates on every new visit."""

    id: int
    profile_id: int
    viewer_id: int

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="views")
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile_views",
    )
    viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("profile", "viewer")

    def __str__(self):
        return f"{self.viewer} viewed {self.profile}"


class Activity(models.Model):
    id: int
    profile_id: int

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="activities")
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]  # newest first

    def __str__(self):
        return self.title


class Skill(models.Model):
    id: int
    profile_id: int

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="skills")
    name = models.CharField(max_length=100)

    class Meta:
        constraints = [
            # One person can't have "React" AND "react": the DATABASE refuses it,
            # even if some code forgets to check.
            models.UniqueConstraint(Lower("name"), "profile", name="unique_skill_per_profile_any_case"),
        ]

    def __str__(self):
        return self.name


class Project(models.Model):
    id: int
    profile_id: int

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="projects")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    tech_stack = models.JSONField(default=list, blank=True)  # e.g. ["Django", "React"]
    github_url = models.URLField(blank=True)

    def __str__(self):
        return self.title


class Experience(models.Model):
    id: int
    profile_id: int

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="experiences")
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    start_date = models.CharField(max_length=20, blank=True)  # free text, e.g. "Jan 2024"
    end_date = models.CharField(max_length=20, blank=True)
    current = models.BooleanField(default=False)  # "I still work here"
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.title} at {self.company}"
