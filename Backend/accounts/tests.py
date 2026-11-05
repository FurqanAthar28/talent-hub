"""
Tests for the login system. Run them with:

    python manage.py test accounts

Each test pretends to be a browser and walks through a real situation
(sign up, verify email, sign in, token runs out, log out...). If you change
the login code and a test fails, the test name tells you what broke.
"""

import re
from unittest import mock

from django.contrib.auth.models import User
from django.conf import settings
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
        match = re.search(r"\b(\d{6})\b", str(mail.outbox[-1].body))
        assert match is not None, "No 6-digit code in the email"
        return match.group(1)

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

    def test_code_email_shows_sender_name_and_design(self):
        self.sign_up("design@example.com")
        email = mail.outbox[-1]
        code = self.last_emailed_code()

        # Gmail shows "ProfessionalHub" as the sender, not a bare address.
        self.assertTrue(email.from_email.startswith(settings.EMAIL_SENDER_NAME))
        self.assertIn("<", email.from_email)
        # Friendly wording (no "OTP", no old "Talent Hub" name).
        self.assertEqual(email.subject, "Verify your email address")
        self.assertNotIn("OTP", str(email.body))
        # The designed HTML version is attached and shows the code.
        html, content_type = email.alternatives[0]  # type: ignore[attr-defined]
        self.assertEqual(content_type, "text/html")
        self.assertIn(code, str(html))
        self.assertIn(settings.EMAIL_SENDER_NAME, str(html))

    def test_failed_email_is_logged_not_crashed(self):
        # If the mail server is down, the user gets a clean error (no crash).
        with mock.patch("accounts.views.send_mail", side_effect=OSError("mail server down")):
            with self.assertLogs("accounts.views", level="ERROR"):
                response = self.client.post(
                    "/api/accounts/signup/",
                    {
                        "fullName": "Test User",
                        "email": "down@example.com",
                        "password": PASSWORD,
                        "role": "recruiter",
                        "companyName": "Acme",
                    },
                    format="json",
                )
        # 503 = "service unavailable, try again later", with a clear message
        # (not a crash, and no technical details shown to the user).
        self.assertEqual(response.status_code, 503)
        self.assertTrue(response.json()["message"])

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


# =============================================================================
# Sign-up form rules and one-time code storage
# =============================================================================

from django.core.files.uploadedfile import SimpleUploadedFile  # noqa: E402

from accounts.models import PasswordResetOTP  # noqa: E402
from accounts.serializers import SignupSerializer  # noqa: E402

REAL_PDF = b"%PDF-1.4\n%fake but valid start\n"


class SignupRulesTests(TestCase):
    def signup_errors(self, **changes):
        """Fill in a valid candidate form, apply `changes`, return the errors."""
        data = {
            "fullName": "Ali Khan",
            "email": "ali@example.com",
            "password": PASSWORD,
            "role": "candidate",
            "linkedinUrl": "linkedin.com/in/ali",
            "cvFile": SimpleUploadedFile("cv.pdf", REAL_PDF, content_type="application/pdf"),
        }
        data.update(changes)
        serializer = SignupSerializer(data=data)
        serializer.is_valid()
        return serializer.errors

    def test_valid_form_passes(self):
        self.assertEqual(self.signup_errors(), {})

    def test_weak_passwords_are_rejected(self):
        self.assertIn("password", self.signup_errors(password="abc123"))  # too short
        self.assertIn("password", self.signup_errors(password="12345678"))  # only numbers
        self.assertIn("password", self.signup_errors(password="password"))  # too common
        self.assertIn("password", self.signup_errors(password="ali@example.com"))  # same as email

    def test_fake_pdf_is_rejected(self):
        fake = SimpleUploadedFile("cv.pdf", b"MZ not a pdf", content_type="application/pdf")
        self.assertIn("cvFile", self.signup_errors(cvFile=fake))

    def test_existing_email_in_other_case_is_rejected(self):
        User.objects.create_user("ali@example.com", "ali@example.com", PASSWORD)
        self.assertIn("email", self.signup_errors(email="ALI@Example.com"))

    def test_too_long_name_is_rejected_not_crashed(self):
        self.assertIn("fullName", self.signup_errors(fullName="A" * 151))

    def test_new_account_starts_switched_off(self):
        serializer = SignupSerializer(
            data={"fullName": "Sara   Ahmed", "email": "Sara@Example.com", "password": PASSWORD,
                  "role": "recruiter", "companyName": "Acme"}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertFalse(user.is_active)
        self.assertFalse(user.profile.email_verified)
        self.assertEqual(user.email, "sara@example.com")
        self.assertEqual((user.first_name, user.last_name), ("Sara", "Ahmed"))
        self.assertEqual(user.profile.recruiter_verification_status, "pending")


class OneTimeCodeTests(TestCase):
    def test_code_is_stored_as_keyed_hash(self):
        import hashlib

        code = "042917"
        self.assertNotEqual(PasswordResetOTP.hash_otp(code), hashlib.sha256(code.encode()).hexdigest())
        self.assertEqual(len(PasswordResetOTP.hash_otp(code)), 64)


class SignupLimitTests(TestCase):
    def test_signups_are_limited_for_the_whole_site(self):

        from accounts.throttles import SignupRateThrottle

        cache.clear()
        client = APIClient()
        # Pretend the limit is 2 sign-ups per hour, to keep the test short.
        with mock.patch.object(SignupRateThrottle, "rate", "2/hour", create=True):
            statuses = [
                client.post("/api/accounts/signup/", {"email": f"new{n}@example.com"}, format="json").status_code
                for n in range(3)
            ]
        # The first two are checked normally (400: form incomplete), the third is blocked.
        self.assertEqual(statuses, [400, 400, 429])


class DeleteAccountTests(TestCase):
    URL = "/api/accounts/delete-account/"

    def setUp(self):
        cache.clear()  # reset the rate-limit counters
        from profiles.models import Profile

        self.user = User.objects.create_user("ali@example.com", "ali@example.com", PASSWORD)
        Profile.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_wrong_password_keeps_the_account(self):
        response = self.client.post(self.URL, {"password": "wrong"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_right_password_deletes_everything(self):
        from accounts.models import AdminActionLog
        from profiles.models import Profile

        AdminActionLog.objects.create(action="user_deactivated", description="Deactivated ali@example.com")

        response = self.client.post(self.URL, {"password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.cookies["access_token"].value, "")  # logged out

        self.assertFalse(User.objects.filter(email="ali@example.com").exists())
        self.assertFalse(Profile.objects.filter(user_id=self.user.pk).exists())
        # No log line mentions the email any more.
        self.assertFalse(AdminActionLog.objects.filter(description__contains="ali@example.com").exists())
        self.assertTrue(AdminActionLog.objects.filter(action="account_deleted").exists())

    def test_superuser_cannot_delete_from_the_website(self):
        self.user.is_superuser = True
        self.user.save()
        response = self.client.post(self.URL, {"password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_must_be_logged_in(self):
        response = APIClient().post(self.URL, {"password": PASSWORD}, format="json")
        self.assertIn(response.status_code, (401, 403))


@override_settings(ROOT_URLCONF=__name__)
class AppAdminTests(TestCase):
    """
    App admins (profile role "admin") are separate from Django's built-in
    admin site (is_staff / is_superuser).
    """

    def setUp(self):
        cache.clear()  # reset the rate-limit counters
        self.api = APIClient()

    def create_admin(self, *args, password=PASSWORD, again=None):
        """Run `manage.py create_admin`, typing the password for it."""
        from django.core.management import call_command

        answers = [password, again if again is not None else password]
        with mock.patch("accounts.management.commands.create_admin.getpass", side_effect=answers):
            call_command("create_admin", *args, stdout=mock.MagicMock())

    def sign_in(self, email, password=PASSWORD):
        return self.api.post("/api/accounts/signin/", {"email": email, "password": password}, format="json")

    def test_create_admin_makes_an_app_admin_who_can_sign_in(self):
        from profiles.models import Profile

        self.create_admin("--email", "Boss@Example.com", "--name", "Sara Khan")

        user = User.objects.get(email="boss@example.com")  # saved in lower case
        self.assertTrue(user.is_active)  # no email code needed
        self.assertFalse(user.is_staff)  # NOT a Django-site account
        self.assertFalse(user.is_superuser)
        profile = Profile.objects.get(user=user)
        self.assertEqual(profile.role, Profile.ROLE_ADMIN)
        self.assertEqual(profile.admin_title, "Platform admin")

        self.assertEqual(self.sign_in("boss@example.com").status_code, 200)
        me = self.api.get("/api/accounts/me/").json()
        self.assertEqual(me["role"], "admin")
        self.assertNotIn("isStaff", me)

    def test_create_admin_refuses_bad_input(self):
        from django.core.management.base import CommandError

        with self.assertRaisesMessage(CommandError, "different"):
            self.create_admin("--email", "a@example.com", "--name", "A B", again="other-pass-123")
        with self.assertRaises(CommandError):  # too common / too short
            self.create_admin("--email", "a@example.com", "--name", "A B", password="password")
        self.assertFalse(User.objects.filter(email="a@example.com").exists())

        User.objects.create_user("ali@example.com", "ali@example.com", PASSWORD)
        with self.assertRaisesMessage(CommandError, "--promote"):
            self.create_admin("--email", "ali@example.com", "--name", "Ali")

    def test_promote_existing_account(self):
        from django.core.management import call_command
        from profiles.models import Profile

        ali = User.objects.create_user("ali@example.com", "ali@example.com", PASSWORD)
        Profile.objects.create(user=ali)
        call_command("create_admin", "--email", "ali@example.com", "--promote", stdout=mock.MagicMock())

        ali.refresh_from_db()
        self.assertEqual(Profile.objects.get(user=ali).role, Profile.ROLE_ADMIN)
        self.assertTrue(ali.check_password(PASSWORD))  # password unchanged

    def test_django_only_accounts_cannot_sign_in_to_the_app(self):
        User.objects.create_superuser("dev", "dev@example.com", PASSWORD)
        response = self.sign_in("dev@example.com")
        self.assertEqual(response.status_code, 403)
        self.assertIn("create_admin", response.json()["message"])

    def test_the_only_admin_cannot_delete_their_account(self):
        self.create_admin("--email", "boss@example.com", "--name", "Boss")
        boss = User.objects.get(email="boss@example.com")
        self.api.force_authenticate(boss)

        response = self.api.post("/api/accounts/delete-account/", {"password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertIn("only admin", response.json()["message"])

        # With a second admin, it's allowed.
        self.create_admin("--email", "second@example.com", "--name", "Second")
        response = self.api.post("/api/accounts/delete-account/", {"password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
