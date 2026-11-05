"""
Tests for the UI texts. Run them with:

    python manage.py test app_config
"""

from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase
from rest_framework.test import APIClient

from .models import UiContent


class UiContentTests(TestCase):
    def test_public_endpoint_returns_all_texts(self):
        UiContent.objects.update_or_create(key="appName", defaults={"value": "ProfessionalHub"})

        # Works without logging in, even with a broken login cookie.
        client = APIClient()
        client.cookies["access_token"] = "broken"
        response = client.get("/api/app-config/ui-content/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["appName"], "ProfessionalHub")

    def test_get_text_with_and_without_default(self):
        UiContent.objects.update_or_create(key="hello", defaults={"value": "Hi!"})
        self.assertEqual(UiContent.get_text("hello"), "Hi!")
        self.assertEqual(UiContent.get_text("missing", default="Fallback"), "Fallback")

        # No default -> a clear error, so a missing text is noticed right away.
        with self.assertRaises(ImproperlyConfigured):
            UiContent.get_text("missing")


class HealthCheckTests(TestCase):
    def test_health_check_is_public_and_checks_the_database(self):
        client = APIClient()
        client.cookies["access_token"] = "broken"  # login cookies are ignored
        response = client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
