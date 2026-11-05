"""
Database tables for the AI app.

AIDailyUsage -> how many AI uses one person has made on one day.

Why a table and not a DRF throttle? A throttle counts every request, but here
a failed AI call or a saved (cached) answer must NOT use up one of the 10.
Why not the cache? Its counter isn't safe when two requests arrive together.
A database UPDATE is, so nobody can slip past the limit and run up the bill.
"""

from django.conf import settings
from django.db import models


class AIDailyUsage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_usage")
    day = models.DateField()  # in UTC, so the count restarts at midnight UTC
    count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "day"], name="unique_ai_usage_per_user_per_day"),
        ]

    def __str__(self):
        return f"{self.user} used AI {self.count}x on {self.day}"
