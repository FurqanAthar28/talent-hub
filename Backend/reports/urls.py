"""
Web addresses for reports (normal users).

config/urls.py adds "api/reports/" in front, so "" below is "/api/reports/".
The admin's report tools live under "/api/admin/reports/" (admin_panel/urls.py).
"""

from django.urls import path

from . import views

app_name = "reports"

urlpatterns = [
    path("", views.create_report_view, name="create"),
]
