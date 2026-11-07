"""
Reports: a user tells the admins "this profile, message or job is a problem".

ONE ROW = ONE REPORT
  - kind "profile": about a person's profile (fake, spam, ...)
  - kind "message": about one chat message. We COPY the message text into
    `message_text` when the report is made, so the admin can still read it
    even if the message is deleted later. Admins only ever see the reported
    message, never the rest of the chat.

LIFE OF A REPORT
  open  -> an admin looks at it ->  dismissed  (no problem found)
                                 ->  actioned   (the account was suspended or banned,
                                                 or the reported job was hidden)
"""

from django.conf import settings
from django.db import models


class Report(models.Model):
    id: int
    reporter_id: int | None
    reported_user_id: int
    message_id: int | None
    job_id: int | None
    resolved_by_id: int | None

    # ----- What is reported -----
    KIND_PROFILE = "profile"
    KIND_MESSAGE = "message"
    KIND_JOB = "job"
    KIND_CHOICES = (
        (KIND_PROFILE, "Profile"),
        (KIND_MESSAGE, "Message"),
        (KIND_JOB, "Job"),
    )

    # ----- Why (the reporter picks one) -----
    REASON_FAKE = "fake_profile"
    REASON_SPAM = "spam"
    REASON_SCAM = "scam"
    REASON_HARASSMENT = "harassment"
    REASON_INAPPROPRIATE = "inappropriate"
    REASON_OTHER = "other"
    REASON_CHOICES = (
        (REASON_FAKE, "Fake profile or impersonation"),
        (REASON_SPAM, "Spam"),
        (REASON_SCAM, "Scam or fake job offer"),
        (REASON_HARASSMENT, "Harassment or hate"),
        (REASON_INAPPROPRIATE, "Inappropriate content"),
        (REASON_OTHER, "Something else"),
    )

    # ----- Where it stands -----
    STATUS_OPEN = "open"
    STATUS_DISMISSED = "dismissed"
    STATUS_ACTIONED = "actioned"
    STATUS_CHOICES = (
        (STATUS_OPEN, "Open"),
        (STATUS_DISMISSED, "Dismissed"),
        (STATUS_ACTIONED, "Action taken"),
    )

    # What the admin did when they closed it.
    ACTION_DISMISS = "dismiss"
    ACTION_SUSPEND = "suspend"
    ACTION_BAN = "ban"
    ACTION_HIDE_JOB = "hide_job"  # only for job reports
    ACTION_CHOICES = (
        (ACTION_DISMISS, "Dismissed"),
        (ACTION_SUSPEND, "Suspended"),
        (ACTION_BAN, "Banned"),
        (ACTION_HIDE_JOB, "Job hidden"),
    )

    # Longest "tell us more" text, and longest admin note.
    DETAILS_MAX_LENGTH = 500
    NOTE_MAX_LENGTH = 255

    # Who reported. SET_NULL: if they delete their account, keep the report.
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="reports_made",
    )
    # Who is reported. CASCADE: if the account is gone for good, so is the report.
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reports_received",
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    message = models.ForeignKey(
        "connections.Message",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )
    message_text = models.TextField(blank=True)  # copy of the message, see top of file
    # SET_NULL: if the recruiter deletes the job, keep the report (and the title copy).
    job = models.ForeignKey(
        "jobs.Job",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )
    job_title = models.CharField(max_length=255, blank=True)  # copy of the title, see top of file
    reason = models.CharField(max_length=30, choices=REASON_CHOICES)
    details = models.CharField(max_length=DETAILS_MAX_LENGTH, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True)
    action_taken = models.CharField(max_length=20, choices=ACTION_CHOICES, blank=True)
    resolution_note = models.CharField(max_length=NOTE_MAX_LENGTH, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports_resolved",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]  # newest first
        indexes = [
            models.Index(fields=["status", "-created_at"], name="report_status_created_idx"),
            models.Index(fields=["reported_user", "status"], name="report_user_status_idx"),
        ]

    def __str__(self):
        return f"{self.kind} report about {self.reported_user} ({self.status})"
