"""
The main list of web addresses. Each app adds its own list under a prefix.

Example: "api/profiles/" + "me/" (from profiles/urls.py) = /api/profiles/me/

Uploaded files (CVs) are NOT served from /media/ on purpose: they are
private, and are only sent through the logged-in view /api/profiles/<id>/cv/.
"""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from .health import health_view

urlpatterns = [
    # Django's built-in admin site (developers only). The address comes from
    # DJANGO_ADMIN_URL, so on the real website it isn't the easy-to-guess /admin/.
    path(settings.DJANGO_ADMIN_URL, admin.site.urls),
    path("api/health/", health_view, name="health"),  # "is the app alive?" for hosting
    path("api/accounts/", include("accounts.urls")),
    path("api/profiles/", include("profiles.urls")),
    path("api/connections/", include("connections.urls")),
    path("api/app-config/", include("app_config.urls")),
    path("api/admin/", include("admin_panel.urls")),
    path("api/recruiter/", include("recruiter.urls")),
    path("api/ai/", include("ai.urls")),
]

handler500 = "config.exception_handler.json_500"
