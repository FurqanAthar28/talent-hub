from django.urls import path
from . import views

urlpatterns = [
    path("stats/", views.admin_stats_view),
    path("users/", views.admin_users_view),
    path("users/<int:user_id>/status/", views.admin_user_status_view),
    path("users/<int:user_id>/role/", views.admin_user_role_view),
    path(
        "users/<int:user_id>/recruiter-verification/",
        views.admin_recruiter_verification_view,
    ),
    path("connections/", views.admin_connections_view),
    path("connect-users/", views.admin_connect_users_view),
    path("disconnect-users/", views.admin_disconnect_users_view),
    path("audit-logs/", views.admin_audit_logs_view),
    path("ui-content/", views.admin_ui_content_view),
    path("ui-content/<str:key>/", views.admin_ui_content_detail_view),
]
