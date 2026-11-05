"""
Tests for the admin page API. Run them with:

    python manage.py test admin_panel
"""

from django.contrib.auth.models import User
from django.db import connection as db_connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounts.models import AdminActionLog
from app_config.models import UiContent
from connections.models import Connection
from profiles.models import Profile, Skill

# These names must match Frontend/app/(main)/admin/types.ts
ADMIN_USER_FIELDS = {
    "id", "email", "username", "fullName", "role", "is_active", "is_staff",
    "date_joined", "last_login", "profileCompletion", "skillsCount",
    "projectsCount", "experiencesCount", "connectionsCount",
    "recruiterVerificationStatus", "recruiterVerificationNote",
}
STATS_FIELDS_USED_BY_PAGE = {
    "users", "activeUsers", "inactiveUsers", "adminUsers", "skills",
    "projects", "experiences", "pendingConnectionRequests", "pendingRecruiters",
}


class AdminApiTests(TestCase):
    def make_user(self, email, role=Profile.ROLE_CANDIDATE, staff=False, superuser=False):
        """`role` decides the APP role. `staff`/`superuser` are Django-site flags only."""
        user = User.objects.create_user(
            email, email, "S3cure-pass!", is_staff=staff, is_superuser=superuser, first_name="Test"
        )
        Profile.objects.create(user=user, role=role)
        return user

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def setUp(self):
        self.admin = self.make_user("boss@example.com", role=Profile.ROLE_ADMIN)
        self.ali = self.make_user("ali@example.com")
        self.sara = self.make_user("sara@example.com")
        self.admin_client = self.client_for(self.admin)

    # ----- who can use it -----

    def test_only_app_admins_can_use_admin_api(self):
        self.assertEqual(self.client_for(self.ali).get("/api/admin/users/").status_code, 403)
        self.assertEqual(self.admin_client.get("/api/admin/users/").status_code, 200)
        self.assertFalse(self.admin.is_staff)  # an app admin is NOT Django staff

        # Django staff/superusers are developer accounts, not app admins.
        developer = self.make_user("dev@example.com", staff=True, superuser=True)
        self.assertEqual(self.client_for(developer).get("/api/admin/users/").status_code, 403)

    def test_switched_off_admin_loses_access(self):
        self.admin.is_active = False
        self.admin.save()
        self.assertEqual(self.admin_client.get("/api/admin/users/").status_code, 403)

    # ----- shapes match the frontend -----

    def test_users_and_stats_have_every_field_the_page_needs(self):
        Skill.objects.create(profile=Profile.objects.get(user=self.ali), name="Python")

        users = self.admin_client.get("/api/admin/users/").json()
        self.assertEqual(set(users[0].keys()), ADMIN_USER_FIELDS)
        ali_row = next(user for user in users if user["id"] == self.ali.pk)
        self.assertEqual(ali_row["skillsCount"], 1)

        stats = self.admin_client.get("/api/admin/stats/").json()
        self.assertTrue(STATS_FIELDS_USED_BY_PAGE <= set(stats.keys()))
        self.assertEqual(stats["users"], 3)

    def test_users_list_does_not_slow_down_with_more_users(self):
        with CaptureQueriesContext(db_connection) as few:
            self.admin_client.get("/api/admin/users/")
        for number in range(15):
            self.make_user(f"user{number}@example.com")
        with CaptureQueriesContext(db_connection) as many:
            self.admin_client.get("/api/admin/users/")
        self.assertEqual(len(few), len(many))

    # ----- the buttons that were broken -----

    def test_status_button(self):
        url = f"/api/admin/users/{self.ali.pk}/status/"
        response = self.admin_client.patch(url, {"is_active": "false"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(response.json()["is_active"])  # the text "false" means False
        self.assertEqual(set(response.json()) - {"message"}, ADMIN_USER_FIELDS)

    def test_role_button_gives_app_admin_but_never_django_staff(self):
        url = f"/api/admin/users/{self.ali.pk}/role/"
        response = self.admin_client.patch(url, {"role": "admin"}, format="json")
        self.assertEqual(response.json()["role"], "admin")
        self.ali.refresh_from_db()
        self.assertFalse(self.ali.is_staff)  # Django's own site stays closed
        self.assertEqual(self.client_for(self.ali).get("/api/admin/users/").status_code, 200)

        self.admin_client.patch(url, {"role": "candidate"}, format="json")
        self.ali.refresh_from_db()
        self.assertEqual(self.client_for(self.ali).get("/api/admin/users/").status_code, 403)

    def test_stats_count_app_admins(self):
        self.make_user("dev@example.com", staff=True, superuser=True)  # not counted
        self.assertEqual(self.admin_client.get("/api/admin/stats/").json()["adminUsers"], 1)

    def test_admin_cannot_lock_themselves_or_superuser_out(self):
        own = self.admin_client.patch(f"/api/admin/users/{self.admin.pk}/status/", {"is_active": False}, format="json")
        self.assertEqual(own.status_code, 403)

        owner = self.make_user("owner@example.com", staff=True, superuser=True)
        response = self.admin_client.patch(f"/api/admin/users/{owner.pk}/role/", {"role": "candidate"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertIn("manage.py", response.json()["message"])

    def test_recruiter_verification_button(self):
        recruiter = self.make_user("rec@example.com", role=Profile.ROLE_RECRUITER)
        url = f"/api/admin/users/{recruiter.pk}/recruiter-verification/"
        response = self.admin_client.patch(url, {"status": "rejected", "note": "No website"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["recruiterVerificationNote"], "No website")

        not_recruiter = self.admin_client.patch(
            f"/api/admin/users/{self.ali.pk}/recruiter-verification/", {"status": "approved"}, format="json"
        )
        self.assertEqual(not_recruiter.status_code, 400)

    # ----- connections -----

    def test_connect_list_disconnect(self):
        pair = {"userId": self.ali.pk, "connectedUserId": self.sara.pk}
        self.assertEqual(self.admin_client.post("/api/admin/connect-users/", pair, format="json").status_code, 201)

        rows = self.admin_client.get("/api/admin/connections/").json()
        self.assertEqual(len(rows), 1)  # one row per pair, not two
        self.assertIn("userEmail", rows[0])

        self.assertEqual(self.admin_client.post("/api/admin/disconnect-users/", pair, format="json").status_code, 200)
        self.assertFalse(Connection.objects.exists())
        self.assertEqual(self.admin_client.post("/api/admin/disconnect-users/", pair, format="json").status_code, 404)

    def test_cannot_connect_an_admin(self):
        pair = {"userId": self.ali.pk, "connectedUserId": self.admin.pk}
        response = self.admin_client.post("/api/admin/connect-users/", pair, format="json")
        self.assertEqual(response.status_code, 400)

    def test_cannot_connect_user_to_themselves(self):
        pair = {"userId": self.ali.pk, "connectedUserId": self.ali.pk}
        response = self.admin_client.post("/api/admin/connect-users/", pair, format="json")
        self.assertEqual(response.status_code, 400)

    # ----- UI content -----

    def test_email_template_placeholders_are_checked(self):
        url = "/api/admin/ui-content/passwordResetEmailBody/"
        bad = self.admin_client.patch(url, {"value": "Hi {name}, code {otp}"}, format="json")
        self.assertEqual(bad.status_code, 400)
        self.assertIn("{name}", bad.json()["message"])

        missing = self.admin_client.patch(url, {"value": "No code here"}, format="json")
        self.assertEqual(missing.status_code, 400)

        good = self.admin_client.patch(url, {"value": "Your code is {otp}. It lasts {minutes} minutes."}, format="json")
        self.assertEqual(good.status_code, 200, good.content)

    def test_web_addresses_are_read_only(self):
        UiContent.objects.update_or_create(key="apiSignin", defaults={"value": "/accounts/signin"})
        response = self.admin_client.patch("/api/admin/ui-content/apiSignin/", {"value": "/broken"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_actions_are_logged(self):
        self.admin_client.patch(f"/api/admin/users/{self.ali.pk}/status/", {"is_active": False}, format="json")
        logs = self.admin_client.get("/api/admin/audit-logs/").json()
        self.assertEqual(logs[0]["targetUserEmail"], "ali@example.com")
        self.assertTrue(AdminActionLog.objects.filter(action="user_deactivated").exists())

    # ----- the admin's own profile -----

    def test_my_admin_profile_counts_only_my_actions(self):
        recruiter = self.make_user("rec@example.com", role=Profile.ROLE_RECRUITER)
        self.admin_client.patch(
            f"/api/admin/users/{recruiter.pk}/recruiter-verification/", {"status": "approved"}, format="json"
        )
        status_url = f"/api/admin/users/{self.ali.pk}/status/"
        self.admin_client.patch(status_url, {"is_active": False}, format="json")
        self.admin_client.patch(status_url, {"is_active": True}, format="json")

        # Another admin's work must not show up on MY profile.
        other = self.make_user("other@example.com", role=Profile.ROLE_ADMIN)
        self.client_for(other).patch(f"/api/admin/users/{self.sara.pk}/status/", {"is_active": False}, format="json")

        me = self.admin_client.get("/api/admin/me/").json()
        self.assertEqual(me["impact"]["totalActions"], 3)
        self.assertEqual(me["impact"]["recruitersApproved"], 1)
        self.assertEqual(me["impact"]["accountsManaged"], 1)  # Ali twice = 1 person
        self.assertEqual(len(me["activity"]), 84)  # 12 weeks, one entry per day
        self.assertEqual(me["activity"][-1]["count"], 3)  # all today
        self.assertEqual((me["activeDays"], me["streak"]), (1, 1))
        self.assertEqual(len(me["recent"]), 3)

        self.assertEqual(self.client_for(self.ali).get("/api/admin/me/").status_code, 403)
