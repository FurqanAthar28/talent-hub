"""
The main list of web addresses. Each app adds its own list under a prefix.

Example: "api/profiles/" + "me/" (from profiles/urls.py) = /api/profiles/me/

Uploaded files (CVs) are NOT served from /media/ on purpose: they are
private, and are only sent through the logged-in view /api/profiles/<id>/cv/.
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),  # Django's built-in admin site
    path("api/accounts/", include("accounts.urls")),
    path("api/profiles/", include("profiles.urls")),
    path("api/connections/", include("connections.urls")),
    path("api/app-config/", include("app_config.urls")),
    path("api/admin/", include("admin_panel.urls")),
    path("api/recruiter/", include("recruiter.urls")),
]
