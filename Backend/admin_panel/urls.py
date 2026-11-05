"""
Web addresses for the admin page.

config/urls.py adds "api/admin/" in front of each one,
so "stats/" below becomes "/api/admin/stats/".
"""

from django.urls import path

from . import views

app_name = "admin_panel"

urlpatterns = [
    path("stats/", views.admin_stats_view, name="stats"),
    path("me/", views.admin_me_view, name="me"),  # the admin's own profile numbers
    # --- Users ---
    path("users/", views.admin_users_view, name="users"),
    path("users/<int:user_id>/status/", views.admin_user_status_view, name="user-status"),
    path("users/<int:user_id>/role/", views.admin_user_role_view, name="user-role"),
    path(
        "users/<int:user_id>/recruiter-verification/",
        views.admin_recruiter_verification_view,
        name="recruiter-verification",
    ),
    # --- Connections ---
    path("connections/", views.admin_connections_view, name="connections"),
    path("connect-users/", views.admin_connect_users_view, name="connect-users"),
    path("disconnect-users/", views.admin_disconnect_users_view, name="disconnect-users"),
    # --- Audit log and texts ---
    path("audit-logs/", views.admin_audit_logs_view, name="audit-logs"),
    path("ui-content/", views.admin_ui_content_view, name="ui-content"),
    path("ui-content/<str:key>/", views.admin_ui_content_detail_view, name="ui-content-detail"),
]
