"""
Rate limit for reports, per signed-in user, so one account can't flood the
admins' queue. The speed is set in settings.py (REPORT_THROTTLE_RATE).
"""

from rest_framework.throttling import UserRateThrottle


class ReportThrottle(UserRateThrottle):
    scope = "report"
