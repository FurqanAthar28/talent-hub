from django.urls import path

from .views import (
    admin_audit_logs_view,
    admin_recruiter_verification_view,
    admin_stats_view,
    admin_user_role_view,
    admin_user_status_view,
    admin_users_view,
    email_verification_confirm_view,
    email_verification_request_view,
    logout_view,
    me_view,
    password_reset_confirm_view,
    password_reset_request_view,
    signin_view,
    signup_view,
)

urlpatterns = [
    path("signup/", signup_view),
    path("signin/", signin_view),
    path("admin/stats/", admin_stats_view),
    path("admin/audit-logs/", admin_audit_logs_view),
    path("admin/users/", admin_users_view),
    path("admin/users/<int:user_id>/status/", admin_user_status_view),
    path("admin/users/<int:user_id>/role/", admin_user_role_view),
    path(
        "admin/users/<int:user_id>/recruiter-verification/",
        admin_recruiter_verification_view,
    ),
    path("password-reset/request/", password_reset_request_view),
    path("password-reset/confirm/", password_reset_confirm_view),
    path("email-verification/request/", email_verification_request_view),
    path("email-verification/confirm/", email_verification_confirm_view),
    path("me/", me_view),
    path("logout/", logout_view),
]
