"""
Tests for recruiter tools. Run them with:

    python manage.py test recruiter
"""

from django.contrib.auth.models import User
from django.db import connection as db_connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from connections.models import ConnectionRequest
from connections.network import connect_users
from profiles.models import Profile, Project, Skill

URL = "/api/recruiter/candidates/"


class RecruiterTests(TestCase):
    def make_user(self, email, role=Profile.ROLE_CANDIDATE, approved=True, active=True, **profile_fields):
        user = User.objects.create_user(
            email, email, "S3cure-pass!", first_name=email.split("@")[0].title(), is_active=active
        )
        if role == Profile.ROLE_CANDIDATE:
            # What an approved candidate always has (search hides anyone without them).
            profile_fields.setdefault("linkedin_url", f"https://linkedin.com/in/{email.split('@')[0]}")
            profile_fields.setdefault("cv_file", "cvs/test.pdf")
        Profile.objects.create(
            user=user,
            role=role,
            approval_status=(
                Profile.APPROVAL_APPROVED if approved else Profile.APPROVAL_PENDING
            ),
            **profile_fields,
        )
        return user

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def setUp(self):
        self.recruiter = self.make_user("rec@example.com", role=Profile.ROLE_RECRUITER)
        self.client = self.client_for(self.recruiter)
        self.ali = self.make_user("ali@example.com", location="Lahore", open_to_work=True)
        self.sara = self.make_user("sara@example.com", location="Karachi")
        Skill.objects.create(profile=Profile.objects.get(user=self.ali), name="Django")
        Project.objects.create(profile=Profile.objects.get(user=self.ali), title="Talent Hub")

    def found_ids(self, query=""):
        response = self.client.get(URL + query).json()
        candidates = response["results"] if isinstance(response, dict) else response
        return {candidate["id"] for candidate in candidates}

    # ----- who can use it -----

    def test_only_approved_recruiters_and_admins(self):
        candidate_client = self.client_for(self.ali)
        pending = self.client_for(self.make_user("new@example.com", role=Profile.ROLE_RECRUITER, approved=False))

        self.assertEqual(candidate_client.get(URL).status_code, 403)
        response = pending.get(URL)
        self.assertEqual(response.status_code, 403)
        self.assertIn("approved recruiters", response.json()["message"])

        admin = self.client_for(self.make_user("boss@example.com", role=Profile.ROLE_ADMIN))
        self.assertEqual(admin.get(URL).status_code, 200)

    # ----- results -----

    def test_filters(self):
        self.assertEqual(self.found_ids(), {self.ali.pk, self.sara.pk})
        self.assertEqual(self.found_ids("?search=django"), {self.ali.pk})
        self.assertEqual(self.found_ids("?location=karachi"), {self.sara.pk})
        self.assertEqual(self.found_ids("?open_to_work=true"), {self.ali.pk})

    def test_hidden_people(self):
        hidden = self.make_user("gone@example.com", active=False)
        self.assertNotIn(hidden.pk, self.found_ids())
        self.assertNotIn(self.recruiter.pk, self.found_ids())  # only candidates
        # Email isn't searchable (no guessing which emails have accounts).
        self.assertEqual(self.found_ids("?search=sara@example.com"), set())

    def test_counts_and_detail(self):
        detail = self.client.get(f"{URL}{self.ali.pk}/").json()
        self.assertEqual(detail["projectsCount"], 1)
        self.assertEqual(detail["skills"], ["Django"])
        self.assertEqual(self.client.get(f"{URL}{self.recruiter.pk}/").status_code, 404)

    def test_search_does_not_slow_down_with_more_candidates(self):
        with CaptureQueriesContext(db_connection) as few:
            self.client.get(URL)
        for number in range(15):
            self.make_user(f"user{number}@example.com")
        with CaptureQueriesContext(db_connection) as many:
            self.client.get(URL)
        self.assertEqual(len(few), len(many))

    # ----- dashboard numbers -----

    def test_summary_counts(self):
        connect_users(self.recruiter, self.ali)
        ConnectionRequest.objects.create(sender=self.sara, receiver=self.recruiter)
        self.make_user("gone@example.com", active=False)  # not counted

        response = self.client.get("/api/recruiter/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"candidatesCount": 2, "connectionsCount": 1, "pendingRequestsCount": 1},
        )
        # Candidates (and unapproved recruiters) can't see it.
        self.assertEqual(self.client_for(self.ali).get("/api/recruiter/summary/").status_code, 403)


class SearchVisibilityTests(TestCase):
    """Layer 3: checked on EVERY search, no admin needed."""

    make_user = RecruiterTests.make_user
    client_for = RecruiterTests.client_for

    def test_candidates_disappear_from_search_the_moment_they_stop_qualifying(self):
        recruiter = self.client_for(self.make_user("rec@example.com", role=Profile.ROLE_RECRUITER))
        omar = self.make_user("omar@example.com")

        def found():
            candidates = recruiter.get(URL).json()["results"]
            return "Omar" in [c["fullName"].split()[0] for c in candidates]

        self.assertTrue(found())

        Profile.objects.filter(user=omar).update(approval_status=Profile.APPROVAL_PENDING)
        self.assertFalse(found())  # not approved (yet / any more)
        Profile.objects.filter(user=omar).update(approval_status=Profile.APPROVAL_APPROVED)

        Profile.objects.filter(user=omar).update(cv_file="")
        self.assertFalse(found())  # CV removed after approval: hidden until fixed
        Profile.objects.filter(user=omar).update(cv_file="cvs/test.pdf")

        User.objects.filter(pk=omar.pk).update(is_active=False)
        self.assertFalse(found())  # switched off: gone at once
