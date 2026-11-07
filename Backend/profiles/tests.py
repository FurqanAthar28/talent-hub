"""
Tests for the profiles app. Run them with:

    python manage.py test profiles

They use force_authenticate (a test shortcut that skips the login cookies),
because the login system has its own tests in accounts/tests.py.
"""

import json
import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from connections.models import ConnectionRequest
from connections.network import connect_users

from .models import Profile, Skill
from .utils import calculate_profile_completion

REAL_PDF = b"%PDF-1.4\n%test file\n"

# Save uploaded test files in a temporary folder, not your real media folder.
TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ProfileTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def make_user(self, email, role=Profile.ROLE_CANDIDATE, active=True):
        user = User.objects.create_user(
            email, email, "S3cure-pass!", first_name="Test", last_name="User", is_active=active
        )
        Profile.objects.create(user=user, role=role, approval_status=Profile.APPROVAL_APPROVED)
        return user

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def setUp(self):
        self.ali = self.make_user("ali@example.com")
        self.sara = self.make_user("sara@example.com")
        self.ali_client = self.client_for(self.ali)
        self.sara_client = self.client_for(self.sara)

    def upload_cv(self, client, content=REAL_PDF):
        return client.patch(
            "/api/profiles/me/update/",
            {"cvFile": SimpleUploadedFile("cv.pdf", content, content_type="application/pdf")},
            format="multipart",
        )

    # ----- privacy -----

    def test_email_is_private(self):
        mine = self.ali_client.get("/api/profiles/me/").json()
        theirs = self.ali_client.get(f"/api/profiles/{self.sara.pk}/").json()
        self.assertEqual(mine["email"], "ali@example.com")
        self.assertEqual(theirs["email"], "")

    def test_deactivated_profiles_are_hidden(self):
        hidden = self.make_user("gone@example.com", active=False)
        response = self.ali_client.get(f"/api/profiles/{hidden.pk}/")
        self.assertEqual(response.status_code, 404)

    # ----- CV -----

    def test_cv_needs_login_and_old_file_is_deleted(self):
        self.assertEqual(self.upload_cv(self.ali_client).status_code, 200)
        profile = Profile.objects.get(user=self.ali)
        first_file = profile.cv_file.name or ""
        self.assertNotIn("test", first_file.lower())  # random name, not the person's name

        cv_url = self.ali_client.get("/api/profiles/me/").json()["cvUrl"]
        self.assertEqual(cv_url, f"/profiles/{self.ali.pk}/cv/")

        # The owner can open their own CV.
        response = self.ali_client.get(f"/api{cv_url}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.getvalue().startswith(b"%PDF-"))
        response.close()

        # Not logged in -> refused.
        self.assertEqual(APIClient().get(f"/api{cv_url}").status_code, 401)

        # Uploading a new CV removes the old file from disk.
        self.upload_cv(self.ali_client)
        profile.refresh_from_db()
        self.assertNotEqual(profile.cv_file.name, first_file)
        self.assertFalse(profile.cv_file.storage.exists(first_file))

    def test_only_the_right_people_can_see_a_cv(self):
        from connections.network import connect_users

        self.upload_cv(self.ali_client)
        cv_address = f"/api/profiles/{self.ali.pk}/cv/"

        def sees_cv(client):
            """True if the profile shows a CV link AND the download works."""
            link = client.get(f"/api/profiles/{self.ali.pk}/").json()["cvUrl"]
            response = client.get(cv_address)
            allowed = response.status_code == 200
            if allowed:
                response.close()
            self.assertEqual(bool(link), allowed)  # link shown only if allowed
            return allowed

        # A stranger (another candidate, not connected): NO.
        self.assertFalse(sees_cv(self.sara_client))

        # An approved recruiter: YES.  A recruiter still waiting: NO.
        recruiter = self.make_user("rec@example.com", role=Profile.ROLE_RECRUITER)
        self.assertTrue(sees_cv(self.client_for(recruiter)))
        waiting = self.make_user("wait@example.com", role=Profile.ROLE_RECRUITER)
        Profile.objects.filter(user=waiting).update(approval_status=Profile.APPROVAL_PENDING)
        # Load the user fresh, like a real request does (the old object
        # still remembers its profile from before the update).
        self.assertFalse(sees_cv(self.client_for(User.objects.get(pk=waiting.pk))))

        # Once connected, the stranger becomes a connection: YES.
        connect_users(self.ali, self.sara)
        self.assertTrue(sees_cv(self.sara_client))

    def test_cv_file_is_deleted_with_the_user(self):
        self.upload_cv(self.ali_client)
        profile = Profile.objects.get(user=self.ali)
        storage, name = profile.cv_file.storage, profile.cv_file.name or ""
        self.assertTrue(storage.exists(name))

        self.ali.delete()  # any way of deleting (admin, account deletion...)
        self.assertFalse(storage.exists(name))

    def test_fake_pdf_is_rejected(self):
        response = self.upload_cv(self.ali_client, content=b"MZ not a pdf")
        self.assertEqual(response.status_code, 400)
        self.assertIn("CV", response.json()["message"])

    # ----- editing -----

    def test_too_long_headline_gives_friendly_error(self):
        response = self.ali_client.patch(
            "/api/profiles/me/update/", {"headline": "x" * 300}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.json()["message"].startswith("Headline:"))

    def test_name_with_extra_spaces(self):
        self.ali_client.patch("/api/profiles/me/update/", {"fullName": "Ali   Raza Khan"}, format="json")
        self.ali.refresh_from_db()
        self.assertEqual((self.ali.first_name, self.ali.last_name), ("Ali", "Raza Khan"))

    def test_duplicate_skill_is_rejected(self):
        self.assertEqual(self.ali_client.post("/api/profiles/skills/add/", {"name": "Python"}, format="json").status_code, 201)
        response = self.ali_client.post("/api/profiles/skills/add/", {"name": "python"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_cannot_delete_someone_elses_skill(self):
        skill = Skill.objects.create(profile=Profile.objects.get(user=self.sara), name="Go")
        response = self.ali_client.delete(f"/api/profiles/skills/{skill.id}/delete/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Skill.objects.filter(id=skill.id).exists())

    def test_project_url_is_fixed_and_empty_tech_dropped(self):
        response = self.ali_client.post(
            "/api/profiles/projects/add/",
            {"title": "Talent Hub", "github_url": "github.com/ali/hub", "tech_stack": ["Django", "", "React"]},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["github_url"], "https://github.com/ali/hub")
        self.assertEqual(response.json()["tech_stack"], ["Django", "React"])

    def test_current_job_has_no_end_date(self):
        response = self.ali_client.post(
            "/api/profiles/experiences/add/",
            {"title": "Engineer", "company": "VertXsoft", "current": True, "end_date": "2025"},
            format="json",
        )
        self.assertEqual(response.json()["end_date"], "")

    # ----- completion -----

    def test_completion_matches_missing_fields(self):
        recruiter = self.make_user("rec@example.com", role=Profile.ROLE_RECRUITER)
        profile = Profile.objects.get(user=recruiter)
        profile.headline = "Hiring"
        profile.company_name = "Acme"
        profile.hiring_title = "HR"
        profile.company_website = "https://acme.com"
        profile.company_about = "We build payroll software."
        profile.hiring_roles = ["Backend Engineer"]
        profile.save()

        data = self.client_for(recruiter).get("/api/profiles/me/").json()
        self.assertEqual(data["missingFields"], [])
        self.assertEqual(data["profileCompletion"], 100)
        self.assertEqual(calculate_profile_completion(Profile.objects.get(user=self.ali)), 11)  # only the name is done

    def test_profile_page_uses_few_queries(self):
        # 7 to build the profile + 1 to check "may this viewer see the CV?"
        # + 2 to work out "how am I related to this person?"
        with self.assertNumQueries(10):
            self.ali_client.get(f"/api/profiles/{self.sara.pk}/")

    def test_tracking_own_or_other_view(self):
        self.assertEqual(self.ali_client.post(f"/api/profiles/{self.ali.pk}/view/").status_code, 204)
        self.assertEqual(self.ali_client.post(f"/api/profiles/{self.sara.pk}/view/").status_code, 204)
        sara_data = self.sara_client.get("/api/profiles/me/").json()
        self.assertEqual(sara_data["profileViewers"], 1)

    def test_profile_says_how_we_are_related(self):
        url = f"/api/profiles/{self.sara.pk}/"
        self.assertEqual(self.ali_client.get(url).json()["connectionStatus"], "none")

        request = ConnectionRequest.objects.create(sender=self.ali, receiver=self.sara)
        data = self.ali_client.get(url).json()
        self.assertEqual(data["connectionStatus"], "sent_pending")
        self.assertEqual(data["requestId"], request.id)
        # Sara sees the same request from her side.
        self.assertEqual(
            self.sara_client.get(f"/api/profiles/{self.ali.pk}/").json()["connectionStatus"],
            "received_pending",
        )

        connect_users(self.ali, self.sara)
        self.assertEqual(self.ali_client.get(url).json()["connectionStatus"], "connected")

    def test_checklist_lists_every_item_done_or_not(self):
        data = self.ali_client.get("/api/profiles/me/").json()
        checklist = data["completionChecklist"]

        labels = [item["label"] for item in checklist]
        self.assertIn("CV", labels)
        # The missing list and the checklist always agree.
        self.assertEqual(
            [item["label"] for item in checklist if not item["done"]],
            data["missingFields"],
        )
        done = sum(1 for item in checklist if item["done"])
        self.assertEqual(data["profileCompletion"], round(done / len(checklist) * 100))


class DuplicateSkillTests(TestCase):
    def test_database_refuses_the_same_skill_in_another_case(self):
        from django.db import IntegrityError, transaction

        user = User.objects.create_user("ali@example.com", "ali@example.com", "S3cure-pass!")
        profile = Profile.objects.create(user=user)
        Skill.objects.create(profile=profile, name="React")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Skill.objects.create(profile=profile, name="react")


class RecruiterProfileTests(TestCase):
    """Company details and "Hiring for" on a recruiter's profile."""

    def setUp(self):
        self.recruiter = User.objects.create_user("rec@example.com", "rec@example.com", "S3cure-pass!", first_name="Rec")
        Profile.objects.create(
            user=self.recruiter,
            role=Profile.ROLE_RECRUITER,
            approval_status=Profile.APPROVAL_APPROVED,
            company_name="Acme",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.recruiter)

    def update(self, **fields):
        # The real page sends FormData (multipart), with lists as JSON text.
        return self.client.patch("/api/profiles/me/update/", fields, format="multipart")

    def test_save_and_read_company_and_hiring(self):
        response = self.update(
            companyAbout="We build payroll software.",
            companyIndustry="Fintech",
            companySize="51-200",
            companyLinkedinUrl="linkedin.com/company/acme",
            workStyles='["hybrid", "remote"]',
            hiringNow="false",
            hiringRoles='["Backend Engineer", "  backend engineer ", "Data  Analyst", ""]',
            hiringSkills='["Django", "React"]',
            hiringLocations='["Lahore"]',
            hiringLevels='["junior", "mid"]',
        )
        self.assertEqual(response.status_code, 200, response.content)

        data = self.client.get("/api/profiles/me/").json()
        self.assertEqual(data["companyIndustry"], "Fintech")
        self.assertEqual(data["companySize"], "51-200")
        self.assertEqual(data["companyLinkedinUrl"], "https://linkedin.com/company/acme")
        self.assertEqual(data["workStyles"], ["hybrid", "remote"])
        self.assertFalse(data["hiringNow"])
        # Repeats (any case) and empty items are dropped; spaces are tidied.
        self.assertEqual(data["hiringRoles"], ["Backend Engineer", "Data Analyst"])
        self.assertEqual(data["hiringLevels"], ["junior", "mid"])

    def test_other_people_see_it_on_the_profile(self):
        self.update(hiringRoles='["Backend Engineer"]', companyAbout="Payroll software")
        viewer = User.objects.create_user("ali@example.com", "ali@example.com", "S3cure-pass!", first_name="Ali")
        Profile.objects.create(user=viewer, approval_status=Profile.APPROVAL_APPROVED)
        client = APIClient()
        client.force_authenticate(viewer)
        data = client.get(f"/api/profiles/{self.recruiter.pk}/").json()
        self.assertEqual(data["hiringRoles"], ["Backend Engineer"])
        self.assertEqual(data["companyAbout"], "Payroll software")

    def test_rejects_unknown_choices_and_too_many_items(self):
        self.assertEqual(self.update(workStyles='["moon"]').status_code, 400)
        self.assertEqual(self.update(hiringLevels='["wizard"]').status_code, 400)
        self.assertEqual(self.update(companySize="huge").status_code, 400)
        self.assertEqual(self.update(hiringRoles='"not a list"').status_code, 400)
        too_many = json.dumps([f"Role {number}" for number in range(11)])
        self.assertEqual(self.update(hiringRoles=too_many).status_code, 400)

    def test_company_linkedin_must_be_a_company_page(self):
        self.assertEqual(self.update(companyLinkedinUrl="linkedin.com/in/some-person").status_code, 400)
