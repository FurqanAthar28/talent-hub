"""
Job posts: an approved recruiter tells candidates "we are hiring for this".

WHO SEES A JOB (see visible_jobs() in views.py)
  - status "open" (the recruiter can close it when it's filled),
  - not hidden by an admin,
  - posted by a recruiter who can still use the network (switched on and
    approved). If the recruiter is suspended, their jobs disappear too.
The recruiter always sees their own jobs; admins see every job.

There is no "apply" button on purpose: candidates contact the recruiter
through the normal Connect / Message flow, which already has approval,
rate limits and reports.
"""

from django.conf import settings
from django.db import models

from profiles.models import Profile


class Job(models.Model):
    id: int
    recruiter_id: int
    hidden_by_id: int | None

    TYPE_CHOICES = (
        ("full_time", "Full-time"),
        ("part_time", "Part-time"),
        ("contract", "Contract"),
        ("internship", "Internship"),
    )
    STATUS_OPEN = "open"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = (
        (STATUS_OPEN, "Open"),
        (STATUS_CLOSED, "Closed"),
    )

    TITLE_MAX_LENGTH = 120
    DESCRIPTION_MAX_LENGTH = 5000
    SALARY_MAX_LENGTH = 100
    MAX_SKILLS = 15

    recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="jobs",
    )
    title = models.CharField(max_length=TITLE_MAX_LENGTH)
    employment_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    # Same values as the recruiter profile (profiles/models.py), so filters match.
    work_style = models.CharField(max_length=20, choices=Profile.WORK_STYLE_CHOICES)
    experience_level = models.CharField(max_length=20, choices=Profile.HIRING_LEVEL_CHOICES)
    location = models.CharField(max_length=255, blank=True)  # "Lahore", or empty for remote
    salary = models.CharField(max_length=SALARY_MAX_LENGTH, blank=True)  # free text: "PKR 200k-300k / month"
    description = models.TextField()
    skills = models.JSONField(default=list, blank=True)  # ["Django", "PostgreSQL"]

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True)

    # An admin can hide a job (spam, scam, wrong info). The recruiter sees why.
    hidden_by_admin = models.BooleanField(default=False, db_index=True)
    hidden_reason = models.CharField(max_length=255, blank=True)
    hidden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs_hidden",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]  # newest first
        indexes = [
            models.Index(fields=["status", "hidden_by_admin", "-created_at"], name="job_visible_idx"),
        ]

    def __str__(self):
        return f"{self.title} ({self.recruiter})"
