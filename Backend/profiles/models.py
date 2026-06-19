from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.text import slugify


def profile_cv_upload_path(instance, filename):
    user = instance.user
    person_name = user.get_full_name() or user.email or "user"
    person_slug = slugify(person_name) or f"user-{user.id or 'new'}"
    timestamp = timezone.now().strftime("%Y%m%d-%H%M%S")

    return f"cvs/{person_slug}/{person_slug}-cv-{timestamp}.pdf"


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    headline = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)
    linkedin_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    portfolio_url = models.URLField(blank=True)
    cv_file = models.FileField(
        upload_to=profile_cv_upload_path,
        blank=True,
        null=True,
    )
    profile_completion = models.IntegerField(default=0)
    open_to_work = models.BooleanField(default=False)

    def __str__(self):
        return self.user.get_full_name()


class ProfileView(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="views")
    viewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="profile_views")
    viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("profile", "viewer")

    def __str__(self):
        return f"{self.viewer} viewed {self.profile}"


class Activity(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="activities")
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Skill(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="skills")
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Project(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="projects")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    tech_stack=models.JSONField(default=list, blank=True)
    github_url = models.URLField(blank=True)

    def __str__(self):
        return self.title


class Experience(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="experiences")
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    start_date = models.CharField(max_length=20, blank=True)
    end_date = models.CharField(max_length=20, blank=True)
    current = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.title} at {self.company}"
