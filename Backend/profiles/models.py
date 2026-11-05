"""
Database tables for the profiles app.

Profile        -> one per user: headline, bio, links, CV, role...
ProfileView    -> "who looked at my profile"
Activity       -> "Added skill: Python" lines shown on the dashboard
Skill          -> one skill of a profile
Project        -> one project of a profile
Experience     -> one job of a profile
"""

import uuid
from functools import cached_property
from typing import TYPE_CHECKING

from django.conf import settings
from django.db import models

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

    # ----- Allowed values for `recruiter_verification_status` -----
    RECRUITER_VERIFICATION_PENDING = "pending"
    RECRUITER_VERIFICATION_APPROVED = "approved"
    RECRUITER_VERIFICATION_REJECTED = "rejected"
    RECRUITER_VERIFICATION_CHOICES = (
        (RECRUITER_VERIFICATION_PENDING, "Pending"),
        (RECRUITER_VERIFICATION_APPROVED, "Approved"),
        (RECRUITER_VERIFICATION_REJECTED, "Rejected"),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",  # lets us write user.profile
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CANDIDATE)

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
    recruiter_verification_status = models.CharField(
        max_length=20,
        choices=RECRUITER_VERIFICATION_CHOICES,
        default=RECRUITER_VERIFICATION_APPROVED,
    )
    # A private note from the admin who approved/rejected the recruiter.
    recruiter_verification_note = models.CharField(max_length=255, blank=True)

    # ----- Admins -----
    admin_title = models.CharField(max_length=255, blank=True)

    # ----- Account state -----
    email_verified = models.BooleanField(default=True)

    # NOT USED ANY MORE. Completion is now calculated live
    # (see profiles/utils.py). Kept only so the database doesn't need a
    # migration today. You can remove it later with makemigrations.
    profile_completion = models.IntegerField(default=0)

    def __str__(self):
        return self.user.get_full_name() or self.user.email

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
