"""
Tests for the AI app. Run them with:

    python manage.py test ai

These never call the real AI: `_ask_for_json` (the one function that does) is
replaced with a fake, so the tests are free and work without an API key.
"""

import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import anthropic
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from profiles.models import Experience, Profile, Skill

from . import provider
from .models import AIDailyUsage

URL = "/api/ai/headline-bio/"

GOOD_ANSWER = {
    "headlines": ["Python developer", "Backend engineer", "Django developer"],
    "short_bio": "I build Django apps.",
    "long_bio": "I build Django apps. I enjoy clean APIs.",
}


@override_settings(ANTHROPIC_API_KEY="test-key", AI_DAILY_LIMIT=10)
class HeadlineBioViewTests(TestCase):
    def setUp(self):
        cache.clear()  # saved answers must not leak from one test to the next
        self.user = self.make_user("ali@example.com")
        self.profile = self.user.profile
        self.profile.location = "Lahore"
        self.profile.bio = "My private old bio"
        self.profile.save()
        Skill.objects.create(profile=self.profile, name="Python")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        patcher = patch("ai.provider._ask_for_json", return_value=GOOD_ANSWER)
        self.fake_ai = patcher.start()
        self.addCleanup(patcher.stop)

    def make_user(self, email, role=Profile.ROLE_CANDIDATE):
        user = User.objects.create_user(email, email, "S3cure-pass!", first_name="Ali", last_name="Khan")
        Profile.objects.create(user=user, role=role, approval_status=Profile.APPROVAL_APPROVED)
        return user

    def uses_today(self):
        usage = AIDailyUsage.objects.filter(user=self.user).first()
        return usage.count if usage else 0

    def test_returns_three_headlines_and_two_bios(self):
        response = self.client.post(URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["headlines"], GOOD_ANSWER["headlines"])
        self.assertEqual(
            response.data["bios"],
            {"short": GOOD_ANSWER["short_bio"], "long": GOOD_ANSWER["long_bio"]},
        )
        self.assertEqual(self.uses_today(), 1)

    def test_nothing_is_saved_to_the_profile(self):
        self.client.post(URL)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.headline, "")
        self.assertEqual(self.profile.bio, "My private old bio")

    def test_sends_only_the_allowed_data(self):
        Experience.objects.create(profile=self.profile, title="Developer", company="Acme", current=True)
        other = self.make_user("sara@example.com")
        Skill.objects.create(profile=other.profile, name="SecretOtherSkill")

        self.client.post(URL)

        sent = self.fake_ai.call_args.args[1]
        self.assertEqual(
            set(json.loads(sent)),
            {"current_headline", "location", "open_to_work", "skills", "experience"},
        )
        self.assertIn("Python", sent)
        self.assertIn("Acme", sent)
        for private in ["ali@example.com", "Khan", "My private old bio", "SecretOtherSkill"]:
            self.assertNotIn(private, sent)

    def test_long_experience_text_is_cut_to_control_cost(self):
        Experience.objects.create(profile=self.profile, title="Dev", company="Acme", description="x" * 5000)

        self.client.post(URL)

        self.assertLess(len(self.fake_ai.call_args.args[1]), 2000)

    def test_login_is_required(self):
        self.assertEqual(APIClient().post(URL).status_code, 401)

    def test_recruiters_and_admins_are_refused(self):
        for role in [Profile.ROLE_RECRUITER, Profile.ROLE_ADMIN]:
            client = APIClient()
            client.force_authenticate(self.make_user(f"{role}@example.com", role=role))
            self.assertEqual(client.post(URL).status_code, 403)
        self.fake_ai.assert_not_called()

    def test_get_is_not_allowed(self):
        self.assertEqual(self.client.get(URL).status_code, 405)

    def test_empty_profile_is_refused_without_calling_ai(self):
        Skill.objects.all().delete()

        response = self.client.post(URL)

        self.assertEqual(response.status_code, 400)
        self.fake_ai.assert_not_called()
        self.assertEqual(self.uses_today(), 0)

    def test_same_profile_reuses_the_answer_without_using_a_use(self):
        first = self.client.post(URL)
        second = self.client.post(URL)

        self.assertEqual(second.data, first.data)
        self.fake_ai.assert_called_once()
        self.assertEqual(self.uses_today(), 1)

    def test_changed_profile_gets_a_new_answer(self):
        self.client.post(URL)
        Skill.objects.create(profile=self.profile, name="Django")
        self.client.post(URL)

        self.assertEqual(self.fake_ai.call_count, 2)

    def test_answers_are_not_shared_between_candidates(self):
        self.client.post(URL)
        other = self.make_user("sara@example.com")
        Skill.objects.create(profile=other.profile, name="Python")
        other.profile.location = "Lahore"
        other.profile.save()
        client = APIClient()
        client.force_authenticate(other)

        client.post(URL)

        self.assertEqual(self.fake_ai.call_count, 2)

    @override_settings(AI_DAILY_LIMIT=2)
    def test_daily_limit(self):
        for number in range(2):
            Skill.objects.create(profile=self.profile, name=f"Skill {number}")
            self.assertEqual(self.client.post(URL).status_code, 200)

        Skill.objects.create(profile=self.profile, name="One too many")
        response = self.client.post(URL)

        self.assertEqual(response.status_code, 429)
        self.assertIn("2 AI uses", response.data["message"])
        self.assertEqual(self.fake_ai.call_count, 2)

    @override_settings(AI_DAILY_LIMIT=1)
    def test_saved_answer_still_works_after_the_limit(self):
        self.client.post(URL)

        self.assertEqual(self.client.post(URL).status_code, 200)

    def test_limit_is_per_person(self):
        other = self.make_user("sara@example.com")
        AIDailyUsage.objects.create(user=other, day=timezone.now().date(), count=10)

        self.assertEqual(self.client.post(URL).status_code, 200)

    def test_limit_restarts_the_next_day(self):
        yesterday = timezone.now().date() - timedelta(days=1)
        AIDailyUsage.objects.create(user=self.user, day=yesterday, count=10)

        self.assertEqual(self.client.post(URL).status_code, 200)

    @override_settings(ANTHROPIC_API_KEY="")
    def test_missing_key_says_unavailable(self):
        response = self.client.post(URL)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["message"], "AI is unavailable right now.")
        self.fake_ai.assert_not_called()
        self.assertEqual(self.uses_today(), 0)

    def test_ai_failure_says_unavailable_and_gives_the_use_back(self):
        self.fake_ai.side_effect = provider.AIUnavailable

        response = self.client.post(URL)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["message"], "AI is unavailable right now.")
        self.assertEqual(self.uses_today(), 0)

    def test_failure_is_not_saved_as_the_answer(self):
        self.fake_ai.side_effect = provider.AIUnavailable
        self.client.post(URL)
        self.fake_ai.side_effect = None

        self.assertEqual(self.client.post(URL).status_code, 200)

    def test_unusable_answer_says_unavailable(self):
        self.fake_ai.return_value = {"headlines": ["  "], "short_bio": "", "long_bio": "x"}

        self.assertEqual(self.client.post(URL).status_code, 503)

    def test_extra_and_too_long_headlines_are_dropped(self):
        self.fake_ai.return_value = {**GOOD_ANSWER, "headlines": ["x" * 256, "a", "b", "c", "d"]}

        self.assertEqual(self.client.post(URL).data["headlines"], ["a", "b", "c"])


def fake_response(stop_reason="end_turn", text=json.dumps(GOOD_ANSWER)):
    return SimpleNamespace(
        stop_reason=stop_reason,
        _request_id="req_test",
        content=[SimpleNamespace(type="thinking"), SimpleNamespace(type="text", text=text)],
    )


@override_settings(ANTHROPIC_API_KEY="test-key", AI_MODEL="claude-opus-5-5")
class ProviderTests(SimpleTestCase):
    """How we read the provider's answers. Only the network call itself is faked."""

    def ask(self, response=None, error=None):
        with patch("ai.provider.anthropic.Anthropic") as client_class:
            create = client_class.return_value.beta.messages.create
            create.return_value = response
            create.side_effect = error
            self.create = create
            self.client_class = client_class
            return provider._ask_for_json("system", "{}", {})

    def test_reads_the_text_block_after_thinking(self):
        self.assertEqual(self.ask(fake_response()), GOOD_ANSWER)

    def test_time_limit_is_shorter_than_the_proxy_and_retries_are_off(self):
        self.ask(fake_response())

        self.assertLess(self.client_class.call_args.kwargs["timeout"], 30)
        self.assertEqual(self.client_class.call_args.kwargs["max_retries"], 0)

    def test_refusal_fallback_is_on_for_opus(self):
        self.ask(fake_response())

        self.assertEqual(self.create.call_args.kwargs["fallbacks"], "default")

    @override_settings(AI_MODEL="claude-haiku-5-5")
    def test_refusal_fallback_is_off_for_haiku(self):
        self.ask(fake_response())

        self.assertNotIn("fallbacks", self.create.call_args.kwargs)

    def test_refused_or_cut_off_answers_fail(self):
        for stop_reason in ["refusal", "max_tokens"]:
            with self.assertRaises(provider.AIUnavailable):
                self.ask(fake_response(stop_reason=stop_reason, text="{not json"))

    def test_invalid_json_fails(self):
        with self.assertRaises(provider.AIUnavailable):
            self.ask(fake_response(text="{not json"))

    def test_provider_errors_fail(self):
        request = MagicMock()
        status_error = {"response": MagicMock(status_code=500, headers={}), "body": None}
        errors = [
            anthropic.APIConnectionError(request=request),
            anthropic.APITimeoutError(request=request),
            anthropic.AuthenticationError("bad key", **status_error),
            anthropic.RateLimitError("slow down", **status_error),
            anthropic.InternalServerError("oops", **status_error),
        ]
        for error in errors:
            with self.subTest(type(error).__name__), self.assertRaises(provider.AIUnavailable):
                self.ask(error=error)
