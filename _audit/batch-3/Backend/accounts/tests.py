"""
Tests for the login system. Run them with:

    python manage.py test accounts

Each test pretends to be a browser and walks through a real situation
(sign up, verify email, sign in, token runs out, log out...). If you change
the login code and a test fails, the test name tells you what broke.
"""

import re

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import include, path
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.test import APIClient

FRONTEND_ORIGIN = "http://localhost:3000"
PASSWORD = "S3cure-pass!"


# A tiny "logged-in users only" endpoint, just for these tests.
# (It uses the default permission from settings: IsAuthenticated.)
@api_view(["POST"])
def protected_test_view(request):
    return Response({"email": request.user.email})


# These tests use their own small list of web addresses (see ROOT_URLCONF below).
urlpatterns = [
    path("api/accounts/", include("accounts.urls")),
    path("api/test/protected/", protected_test_view),
]


@override_settings(
    ROOT_URLCONF=__name__,
    # Keep emails in memory (mail.outbox) so we can read the codes.
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class AuthFlowTests(TestCase):
    def setUp(self):
        cache.clear()  # reset the rate-limit counters
        # enforce_csrf_checks=True makes the test client behave like a real browser.
        self.client = APIClient(enforce_csrf_checks=True)

    # ---------- small helpers ----------

    def last_emailed_code(self):
        """Find the 6-digit code in the newest email."""
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)

    def post(self, url, data=None, client=None, **extra):
        return (client or self.client).post(url, data or {}, format="json", **extra)

    def sign_up(self, email):
        response = self.client.post(
            "/api/accounts/signup/",
            {
                "fullName": "Test User",
                "email": email,
                "password": PASSWORD,
                "role": "recruiter",
                "companyName": "Acme",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.content)

    def sign_up_and_verify(self, email):
        self.sign_up(email)
        response = self.post(
            "/api/accounts/email-verification/confirm/",
            {"email": email, "otp": self.last_emailed_code()},
        )
        self.assertEqual(response.status_code, 200, response.content)

    def sign_in(self, email, password=PASSWORD, client=None):
        return self.post(
            "/api/accounts/signin/",
            {"email": email, "password": password},
            client=client,
        )

    # ---------- the tests ----------

    def test_unverified_user_must_verify_before_signing_in(self):
        self.sign_up("ali@example.com")

        # Wrong password: a plain "sign in failed", no hint about the account.
        self.assertEqual(self.sign_in("ali@example.com", "wrong").status_code, 401)

        # Right password but email not verified yet.
        self.assertEqual(self.sign_in("ali@example.com").status_code, 403)

    def test_signin_sets_cookies_and_last_login(self):
        self.sign_up_and_verify("ali@example.com")

        # Upper-case email should still work.
        response = self.sign_in("ALI@example.com")
        self.assertEqual(response.status_code, 200, response.content)

        for cookie_name in ("access_token", "refresh_token", "csrftoken"):
            self.assertIn(cookie_name, response.cookies)
        self.assertTrue(response.cookies["access_token"]["httponly"])
        self.assertIsNotNone(User.objects.get(email="ali@example.com").last_login)

    def test_csrf_token_is_required_for_changes(self):
        self.sign_up_and_verify("ali@example.com")
        self.sign_in("ali@example.com")

        # No X-CSRFToken header -> blocked.
        response = self.post("/api/test/protected/", HTTP_ORIGIN=FRONTEND_ORIGIN)
        self.assertEqual(response.status_code, 403)
        self.assertIn("CSRF", response.json()["message"])

        # With the header -> allowed.
        csrf_token = self.client.cookies["csrftoken"].value
        response = self.post(
            "/api/test/protected/",
            HTTP_ORIGIN=FRONTEND_ORIGIN,
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(response.status_code, 200, response.content)

    def test_expired_access_token_can_be_refreshed(self):
        self.sign_up_and_verify("ali@example.com")
        self.sign_in("ali@example.com")
        old_refresh_token = self.client.cookies["refresh_token"].value

        # Pretend the 30-minute access cookie ran out.
        del self.client.cookies["access_token"]
        self.assertEqual(self.client.get("/api/accounts/me/").status_code, 401)

        # Refresh -> new cookies -> logged in again.
        self.assertEqual(self.post("/api/accounts/refresh/").status_code, 204)
        self.assertEqual(self.client.get("/api/accounts/me/").status_code, 200)

        # The OLD refresh token must not work any more (it was blacklisted).
        thief = APIClient()
        thief.cookies["refresh_token"] = old_refresh_token
        self.assertEqual(self.post("/api/accounts/refresh/", client=thief).status_code, 401)

    def test_broken_cookie_never_blocks_signin(self):
        self.sign_up_and_verify("ali@example.com")

        browser = APIClient(enforce_csrf_checks=True)
        browser.cookies["access_token"] = "this-is-not-a-real-token"

        self.assertEqual(browser.get("/api/accounts/me/").status_code, 401)
        self.assertEqual(self.sign_in("ali@example.com", client=browser).status_code, 200)

    def test_logout_clears_cookies_and_kills_refresh_token(self):
        self.sign_up_and_verify("ali@example.com")
        self.sign_in("ali@example.com")
        refresh_token = self.client.cookies["refresh_token"].value

        response = self.post("/api/accounts/logout/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies["access_token"].value, "")

        other = APIClient()
        other.cookies["refresh_token"] = refresh_token
        self.assertEqual(self.post("/api/accounts/refresh/", client=other).status_code, 401)

    def test_password_reset_logs_out_other_devices(self):
        self.sign_up_and_verify("sara@example.com")

        laptop = APIClient()
        self.sign_in("sara@example.com", client=laptop)
        laptop_refresh_token = laptop.cookies["refresh_token"].value

        self.assertEqual(
            self.post("/api/accounts/password-reset/request/", {"email": "sara@example.com"}).status_code,
            200,
        )
        # Asking again straight away -> "please wait".
        self.assertEqual(
            self.post("/api/accounts/password-reset/request/", {"email": "sara@example.com"}).status_code,
            429,
        )

        response = self.post(
            "/api/accounts/password-reset/confirm/",
            {"email": "sara@example.com", "otp": self.last_emailed_code(), "password": "N3w-pass-word!"},
        )
        self.assertEqual(response.status_code, 200, response.content)

        # The laptop's old login no longer works.
        old_login = APIClient()
        old_login.cookies["refresh_token"] = laptop_refresh_token
        self.assertEqual(self.post("/api/accounts/refresh/", client=old_login).status_code, 401)

        # The new password works.
        self.assertEqual(self.sign_in("sara@example.com", "N3w-pass-word!").status_code, 200)

    def test_code_locks_after_too_many_wrong_tries(self):
        self.sign_up("max@example.com")
        real_code = self.last_emailed_code()
        wrong_code = "123456" if real_code != "123456" else "654321"

        statuses = [
            self.post(
                "/api/accounts/email-verification/confirm/",
                {"email": "max@example.com", "otp": wrong_code},
            ).status_code
            for _ in range(5)
        ]
        self.assertEqual(statuses, [400, 400, 400, 400, 429])

        # Even the real code is useless now.
        response = self.post(
            "/api/accounts/email-verification/confirm/",
            {"email": "max@example.com", "otp": real_code},
        )
        self.assertEqual(response.status_code, 400)

    def test_signin_is_rate_limited_per_email(self):
        # This test expects AUTH_EMAIL_THROTTLE_RATE=10/min (the default).
        statuses = [self.sign_in("x@example.com", "guess").status_code for _ in range(11)]
        self.assertEqual(statuses, [401] * 10 + [429])

        # A different email is not affected.
        self.assertEqual(self.sign_in("y@example.com", "guess").status_code, 401)

    def test_unknown_email_does_not_reveal_anything(self):
        response = self.post("/api/accounts/password-reset/request/", {"email": "ghost@example.com"})
        self.assertEqual(response.status_code, 200)

    def test_csrf_endpoint_sets_cookie(self):
        response = self.client.get("/api/accounts/csrf/")
        self.assertEqual(response.status_code, 204)
        self.assertIn("csrftoken", response.cookies)
