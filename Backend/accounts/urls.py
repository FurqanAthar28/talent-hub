"""
Web addresses for the accounts app.

config/urls.py adds "api/accounts/" in front of each one,
so "signin/" below becomes "/api/accounts/signin/".

Each path has a `name`, so other code can find it with reverse("accounts:signin")
instead of typing the address by hand.

The admin endpoints live in the admin_panel app ("/api/admin/..."), not here.
"""

from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    # --- Logging in and staying logged in ---
    path("signin/", views.signin_view, name="signin"),
    path("refresh/", views.refresh_view, name="refresh"),
    path("logout/", views.logout_view, name="logout"),
    path("me/", views.me_view, name="me"),
    path("csrf/", views.csrf_view, name="csrf"),
    path("delete-account/", views.delete_account_view, name="delete-account"),
    # --- Creating an account ---
    path("signup/", views.signup_view, name="signup"),
    path(
        "email-verification/request/",
        views.email_verification_request_view,
        name="email-verification-request",
    ),
    path(
        "email-verification/confirm/",
        views.email_verification_confirm_view,
        name="email-verification-confirm",
    ),
    # --- Forgot password ---
    path(
        "password-reset/request/",
        views.password_reset_request_view,
        name="password-reset-request",
    ),
    path(
        "password-reset/confirm/",
        views.password_reset_confirm_view,
        name="password-reset-confirm",
    ),
]
