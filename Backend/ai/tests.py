"""
Tests for the AI app. Run them with:

    python manage.py test ai

These never call the real AI: `_ask_for_json` (the one function that does) is
replaced with a fake, so the tests are fast and work without Ollama.
"""

import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

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


@override_settings(AI_BASE_URL="http://ai.test/v1", AI_DAILY_LIMIT=10)
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

    @override_settings(AI_BASE_URL="")
    def test_no_ai_server_set_says_unavailable(self):
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

    def test_boastful_headlines_are_dropped(self):
        self.fake_ai.return_value = {**GOOD_ANSWER, "headlines": ["Python Expert", "Django Specialist", "Python developer"]}

        self.assertEqual(self.client.post(URL).data["headlines"], ["Python developer"])

    def test_boastful_word_is_kept_when_the_profile_says_it(self):
        self.profile.headline = "Certified AWS specialist"
        self.profile.save()
        self.fake_ai.return_value = {**GOOD_ANSWER, "headlines": ["AWS Specialist", "Cloud engineer"]}

        self.assertEqual(self.client.post(URL).data["headlines"], ["AWS Specialist", "Cloud engineer"])

    def test_extra_and_too_long_headlines_are_dropped(self):
        self.fake_ai.return_value = {**GOOD_ANSWER, "headlines": ["x" * 256, "a", "b", "c", "d"]}

        self.assertEqual(self.client.post(URL).data["headlines"], ["a", "b", "c"])


@override_settings(AI_BASE_URL="http://ai.test/v1", AI_MODEL="qwen2.5-3b-instruct", AI_TIMEOUT_SECONDS=25)
class ProviderTests(SimpleTestCase):
    """The provider network call is replaced; response parsing stays real."""

    def ask(self, text):
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=text))]
        )
        with patch("ai.provider.openai.OpenAI") as client_class:
            client_class.return_value.chat.completions.create.return_value = response
            return provider._ask_for_json("system", "{}", 100)

    def test_reads_json_answer(self):
        self.assertEqual(self.ask(json.dumps(GOOD_ANSWER)), GOOD_ANSWER)

    def test_timeout_is_shorter_than_the_proxy_and_retries_are_off(self):
        with patch("ai.provider.openai.OpenAI") as client_class:
            client_class.return_value.chat.completions.create.return_value = SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(GOOD_ANSWER)))]
            )
            provider._ask_for_json("system", "{}", 100)

        self.assertLess(client_class.call_args.kwargs["timeout"], 30)
        self.assertEqual(client_class.call_args.kwargs["max_retries"], 0)

    def test_invalid_json_fails(self):
        with self.assertRaises(provider.AIUnavailable):
            self.ask("{not json")

    def test_talks_to_our_own_ai_server(self):
        with patch("ai.provider.openai.OpenAI") as client_class:
            client_class.return_value.chat.completions.create.return_value = SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(GOOD_ANSWER)))]
            )
            provider._ask_for_json("system", "{}", 100)

        self.assertEqual(client_class.call_args.kwargs["base_url"], "http://ai.test/v1")
        create = client_class.return_value.chat.completions.create
        self.assertEqual(create.call_args.kwargs["model"], "qwen2.5-3b-instruct")
        self.assertEqual(create.call_args.kwargs["max_tokens"], 100)
        self.assertLessEqual(create.call_args.kwargs["temperature"], 0.3)  # sticks to the facts


JOB_DRAFT_URL = "/api/ai/job-draft/"

GOOD_DRAFT = {
    "title": "React Developer",
    "description": "Build our fintech web app with React and TypeScript. You have 3+ years of React.",
    "skills": ["React", "TypeScript"],
}

DRAFT_REQUEST = {
    "notes": "React dev for our fintech app, 3+ years, TypeScript",
    "employmentType": "full_time",
    "workStyle": "onsite",
    "experienceLevel": "mid",
    "location": "Lahore",
}


@override_settings(AI_BASE_URL="http://ai.test/v1", AI_DAILY_LIMIT=10)
class JobDraftViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = self.make_user("rec@example.com", Profile.ROLE_RECRUITER)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        patcher = patch("ai.provider._ask_for_json", return_value=GOOD_DRAFT)
        self.fake_ai = patcher.start()
        self.addCleanup(patcher.stop)

    def make_user(self, email, role, approval=Profile.APPROVAL_APPROVED):
        user = User.objects.create_user(email, email, "S3cure-pass!", first_name="Sara", last_name="Ali")
        Profile.objects.create(user=user, role=role, approval_status=approval, company_name="Secret Co")
        return user

    def uses_today(self):
        usage = AIDailyUsage.objects.filter(user=self.user).first()
        return usage.count if usage else 0

    def test_returns_a_draft_and_posts_nothing(self):
        from jobs.models import Job

        response = self.client.post(JOB_DRAFT_URL, DRAFT_REQUEST, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, GOOD_DRAFT)
        self.assertEqual(Job.objects.count(), 0)
        self.assertEqual(self.uses_today(), 1)

    def test_sends_only_the_notes_and_picked_details(self):
        self.client.post(JOB_DRAFT_URL, DRAFT_REQUEST, format="json")

        sent = json.loads(self.fake_ai.call_args.args[1])
        self.assertEqual(
            sent,
            {
                "notes": DRAFT_REQUEST["notes"],
                "job_type": "Full-time",
                "work_style": "On-site",
                "experience_level": "Mid-level",
                "location": "Lahore",
            },
        )
        # No name, email or company details.
        self.assertNotIn("Secret Co", self.fake_ai.call_args.args[1])
        self.assertNotIn("rec@example.com", self.fake_ai.call_args.args[1])

    def test_only_approved_recruiters(self):
        for email, role, approval in (
            ("cand@example.com", Profile.ROLE_CANDIDATE, Profile.APPROVAL_APPROVED),
            ("wait@example.com", Profile.ROLE_RECRUITER, Profile.APPROVAL_PENDING),
        ):
            self.client.force_authenticate(self.make_user(email, role, approval))
            response = self.client.post(JOB_DRAFT_URL, DRAFT_REQUEST, format="json")
            self.assertEqual(response.status_code, 403, email)
        self.fake_ai.assert_not_called()

    def test_login_is_required(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.post(JOB_DRAFT_URL, DRAFT_REQUEST, format="json").status_code, (401, 403))

    def test_too_short_notes_are_refused_without_calling_ai(self):
        response = self.client.post(JOB_DRAFT_URL, {**DRAFT_REQUEST, "notes": "  dev  "}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], "Notes: Write a few more words about the job first.")
        self.fake_ai.assert_not_called()

    def test_too_long_notes_and_bad_choices_are_refused(self):
        too_long = self.client.post(JOB_DRAFT_URL, {**DRAFT_REQUEST, "notes": "x" * 1001}, format="json")
        bad_type = self.client.post(JOB_DRAFT_URL, {**DRAFT_REQUEST, "employmentType": "forever"}, format="json")

        self.assertEqual(too_long.status_code, 400)
        self.assertEqual(bad_type.status_code, 400)
        self.fake_ai.assert_not_called()

    def test_same_notes_reuse_the_answer_without_using_a_use(self):
        self.client.post(JOB_DRAFT_URL, DRAFT_REQUEST, format="json")
        self.client.post(JOB_DRAFT_URL, DRAFT_REQUEST, format="json")

        self.assertEqual(self.fake_ai.call_count, 1)
        self.assertEqual(self.uses_today(), 1)

    @override_settings(AI_DAILY_LIMIT=1)
    def test_daily_limit_is_shared_with_the_headline_writer(self):
        AIDailyUsage.objects.create(user=self.user, day=timezone.now().date(), count=1)

        response = self.client.post(JOB_DRAFT_URL, DRAFT_REQUEST, format="json")

        self.assertEqual(response.status_code, 429)
        self.fake_ai.assert_not_called()

    def test_ai_failure_says_unavailable_and_gives_the_use_back(self):
        self.fake_ai.side_effect = provider.AIUnavailable

        response = self.client.post(JOB_DRAFT_URL, DRAFT_REQUEST, format="json")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["message"], "AI is unavailable right now.")
        self.assertEqual(self.uses_today(), 0)


class JobDraftAnswerTests(SimpleTestCase):
    """The AI's answer is checked before it reaches the form."""

    NOTES = "We need React, Go, SQL and AWS."

    def draft(self, answer, notes=NOTES):
        with patch("ai.provider._ask_for_json", return_value=answer):
            return provider.write_job_draft(
                {"notes": notes}, title_max_length=120, description_max_length=5000, max_skills=3
            )

    def test_cleans_spaces_and_repeated_skills(self):
        draft = self.draft(
            {**GOOD_DRAFT, "title": "  React   Developer ", "skills": ["React", " react ", "", "x" * 61, "Go", "SQL", "AWS"]}
        )

        self.assertEqual(draft["title"], "React Developer")
        self.assertEqual(draft["skills"], ["React", "Go", "SQL"])  # max_skills=3

    def test_skills_not_in_the_notes_are_dropped(self):
        draft = self.draft({**GOOD_DRAFT, "skills": ["Agile Methodologies", "react", "API Testing"]}, notes="React dev")

        self.assertEqual(draft["skills"], ["react"])

    def test_skills_as_one_text_are_split(self):
        draft = self.draft({**GOOD_DRAFT, "skills": "React, Go ,SQL"})

        self.assertEqual(draft["skills"], ["React", "Go", "SQL"])

    def test_missing_skills_are_fine(self):
        self.assertEqual(self.draft({"title": "React Developer", "description": GOOD_DRAFT["description"]})["skills"], [])

    def test_unusable_answers_fail(self):
        for answer in (
            {"title": "", "description": GOOD_DRAFT["description"]},
            {"title": "x" * 121, "description": GOOD_DRAFT["description"]},
            {"title": "React Developer", "description": "Too short."},
            {"title": "React Developer", "description": "x" * 5001},
            {"description": GOOD_DRAFT["description"]},
            {"title": ["not", "text"], "description": GOOD_DRAFT["description"]},
        ):
            with self.assertRaises(provider.AIUnavailable, msg=answer):
                self.draft(answer)
