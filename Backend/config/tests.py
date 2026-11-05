# Tests for shared API response handling.

import json

from django.test import RequestFactory, SimpleTestCase

from .exception_handler import json_500


class ApiErrorHandlingTests(SimpleTestCase):
    def test_unhandled_api_error_returns_json(self):
        request = RequestFactory().get("/api/example/")

        response = json_500(request)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertIn("message", json.loads(response.content))
