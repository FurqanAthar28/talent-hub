"""
Tests for the admin page API. Run them with:

    python manage.py test admin_panel
"""

import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.db import connection as db_connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounts.models import AdminActionLog
from app_config.models import UiContent
from connections.models import Connection
from profiles.models import Experience, Profile, Project, Skill

# These names must match Frontend/app/(main)/admin/types.ts
ADMIN_USER_FIELDS = {
    "id", "email", "username", "fullName", "role", "is_active", "is_staff",
    "date_joined", "last_login", "profileCompletion", "skillsCount",
    "projectsCount", "experiencesCount", "connectionsCount",
    "approvalStatus", "rejectionReason", "accountStatus", "statusReason",
    "deletedAt", "deletedByAdmin", "restoreUntil",
}
STATS_FIELDS_USED_BY_PAGE = {
    "users", "activeUsers", "inactiveUsers", "adminUsers", "skills",
    "projects", "experiences", "pendingConnectionRequests", "pendingApprovals",
}


class AdminApiTests(TestCase):
    def make_user(self, email, role=Profile.ROLE_CANDIDATE, staff=False, superuser=False):
        """`role` decides the APP role. `staff`/`superuser` are Django-site flags only."""
        user = User.objects.create_user(
            email, email, "S3cure-pass!", is_staff=staff, is_superuser=superuser, first_name="Test"
        )
        Profile.objects.create(user=user, role=role, approval_status=Profile.APPROVAL_APPROVED)
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

    def suspend(self, user, client=None):
        url = f"/api/admin/users/{user.pk}/account/"
        return (client or self.admin_client).post(url, {"action": "suspend", "reason": "Spam"}, format="json")

    def test_suspend_needs_a_reason_and_blocks_sign_in(self):
        url = f"/api/admin/users/{self.ali.pk}/account/"
        self.assertEqual(self.admin_client.post(url, {"action": "suspend"}, format="json").status_code, 400)

        response = self.suspend(self.ali)
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual((body["accountStatus"], body["is_active"]), ("suspended", False))

        signin = APIClient().post("/api/accounts/signin/", {"email": "ali@example.com", "password": "S3cure-pass!"}, format="json")
        self.assertEqual(signin.status_code, 403)
        self.assertIn("Spam", signin.json()["message"])  # they see why

        self.assertEqual(self.admin_client.post(url, {"action": "unsuspend"}, format="json").json()["is_active"], True)
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
        own = self.suspend(self.admin)
        self.assertEqual(own.status_code, 403)

        owner = self.make_user("owner@example.com", staff=True, superuser=True)
        response = self.admin_client.patch(f"/api/admin/users/{owner.pk}/role/", {"role": "candidate"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertIn("manage.py", response.json()["message"])

    def test_admins_dont_need_approval(self):
        response = self.admin_client.patch(f"/api/admin/users/{self.admin.pk}/approval/", {"status": "approved"}, format="json")
        self.assertEqual(response.status_code, 403)

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

    def test_already_connected_pair_adds_nothing(self):
        pair = {"userId": self.ali.pk, "connectedUserId": self.sara.pk}
        self.admin_client.post("/api/admin/connect-users/", pair, format="json")

        # Same pair again, in either order: a clear message, no new rows, no new log line.
        for again in (pair, {"userId": self.sara.pk, "connectedUserId": self.ali.pk}):
            response = self.admin_client.post("/api/admin/connect-users/", again, format="json")
            self.assertEqual(response.status_code, 200)
        self.assertEqual(Connection.objects.count(), 2)  # A->B and B->A
        self.assertEqual(AdminActionLog.objects.filter(action="connection_created").count(), 1)

    def test_stats_and_list_always_agree(self):
        pair = {"userId": self.ali.pk, "connectedUserId": self.sara.pk}
        self.admin_client.post("/api/admin/connect-users/", pair, format="json")
        self.assertEqual(self.admin_client.get("/api/admin/stats/").json()["connections"], 1)

        # Switch Sara off: her connection leaves the list AND the number.
        # (Before: the number still said 1 while the list showed 0.)
        self.suspend(self.sara)
        listed = len(self.admin_client.get("/api/admin/connections/").json())
        counted = self.admin_client.get("/api/admin/stats/").json()["connections"]
        self.assertEqual((listed, counted), (0, 0))

    def test_the_last_admin_is_protected(self):
        from profiles.permissions import is_last_admin

        self.assertTrue(is_last_admin(self.admin))
        second = self.make_user("second@example.com", role=Profile.ROLE_ADMIN)
        self.assertFalse(is_last_admin(self.admin))

        # With two admins, one may demote the other...
        url = f"/api/admin/users/{second.pk}/role/"
        self.assertEqual(self.admin_client.patch(url, {"role": "candidate"}, format="json").status_code, 200)
        # ...and then the remaining one is the last admin again.
        self.assertTrue(is_last_admin(self.admin))

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
        self.suspend(self.ali)
        logs = self.admin_client.get("/api/admin/audit-logs/").json()
        self.assertEqual(logs[0]["targetUserEmail"], "ali@example.com")
        self.assertTrue(AdminActionLog.objects.filter(action="account_suspend").exists())

    # ----- the admin's own profile -----

    def test_my_admin_profile_counts_only_my_actions(self):
        recruiter = self.make_user("rec@example.com", role=Profile.ROLE_RECRUITER)
        Profile.objects.filter(user=recruiter).update(approval_status=Profile.APPROVAL_PENDING, company_name="Arbisoft")
        self.admin_client.patch(f"/api/admin/users/{recruiter.pk}/approval/", {"status": "approved"}, format="json")
        self.suspend(self.ali)
        self.admin_client.post(f"/api/admin/users/{self.ali.pk}/account/", {"action": "unsuspend"}, format="json")

        # Another admin's work must not show up on MY profile.
        other = self.make_user("other@example.com", role=Profile.ROLE_ADMIN)
        self.suspend(self.sara, client=self.client_for(other))

        me = self.admin_client.get("/api/admin/me/").json()
        self.assertEqual(me["impact"]["totalActions"], 3)
        self.assertEqual(me["impact"]["peopleApproved"], 1)
        self.assertEqual(me["impact"]["accountsManaged"], 1)  # Ali twice = 1 person
        self.assertEqual(len(me["activity"]), 84)  # 12 weeks, one entry per day
        self.assertEqual(me["activity"][-1]["count"], 3)  # all today
        self.assertEqual((me["activeDays"], me["streak"]), (1, 1))
        self.assertEqual(len(me["recent"]), 3)

        self.assertEqual(self.client_for(self.ali).get("/api/admin/me/").status_code, 403)


# =============================================================================
# Approval for candidates and recruiters (layer 2 of the spec)
# =============================================================================

TEST_MEDIA_ROOT = tempfile.mkdtemp()
CV_TEXT = "Ali Khan Backend developer Python Django PostgreSQL REST APIs " * 6  # over 200 characters


def text_pdf(text):
    """A tiny but REAL one-page PDF whose text can be read back (for the 'readable CV' check)."""
    stream = f"BT /F1 10 Tf 40 760 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ApprovalTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_user("boss@example.com", "boss@example.com", "S3cure-pass!")
        Profile.objects.create(user=self.admin, role=Profile.ROLE_ADMIN, approval_status=Profile.APPROVAL_APPROVED)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def make_candidate(self, email="ali@example.com", complete=True, cv_text=CV_TEXT, linkedin=None):
        user = User.objects.create_user(email, email, "S3cure-pass!", first_name="Ali", last_name="Khan")
        profile = Profile.objects.create(user=user, role=Profile.ROLE_CANDIDATE)  # pending, like a new sign-up
        if complete:
            profile.headline = "Backend developer"
            profile.location = "Lahore"
            profile.bio = "I build REST APIs with Django."
            profile.linkedin_url = linkedin or f"https://www.linkedin.com/in/{email.split('@')[0]}"
            profile.cv_file.save("cv.pdf", ContentFile(text_pdf(cv_text) if cv_text else b"%PDF-1.4\n"))
            Skill.objects.create(profile=profile, name="Python")
            Project.objects.create(profile=profile, title="Job parser")
        return user

    def checks_for(self, user):
        return self.client.get(f"/api/admin/users/{user.pk}/approval-checks/").json()

    def decide(self, user, **body):
        return self.client.patch(f"/api/admin/users/{user.pk}/approval/", body, format="json")

    def test_new_candidates_wait_and_incomplete_ones_cant_be_approved(self):
        ali = self.make_candidate(complete=False)
        result = self.checks_for(ali)
        self.assertFalse(result["canApprove"])
        complete = next(item for item in result["checks"] if item["key"] == "complete")
        self.assertIn("CV", complete["detail"])

        response = self.decide(ali, status="approved", linkedinChecked=True)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Profile complete", response.json()["message"])

    def test_complete_candidate_is_approved_after_the_linkedin_check(self):
        ali = self.make_candidate()
        result = self.checks_for(ali)
        self.assertTrue(result["canApprove"], result["checks"])
        self.assertTrue(result["needsLinkedinCheck"])

        self.assertEqual(self.decide(ali, status="approved").status_code, 400)  # LinkedIn not ticked
        response = self.decide(ali, status="approved", linkedinChecked=True)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["approvalStatus"], "approved")
        self.assertTrue(AdminActionLog.objects.filter(action="approval_changed", target_user=ali).exists())

    def test_blank_cv_fails_and_duplicates_are_flagged(self):
        blank = self.make_candidate("blank@example.com", cv_text="")
        checks = {item["key"]: item for item in self.checks_for(blank)["checks"]}
        self.assertFalse(checks["cv_readable"]["passed"])

        first = self.make_candidate("one@example.com", linkedin="https://linkedin.com/in/ali-khan")
        copy = self.make_candidate("two@example.com", linkedin="https://www.LinkedIn.com/in/Ali-Khan/")
        checks = {item["key"]: item for item in self.checks_for(copy)["checks"]}
        self.assertFalse(checks["unique_cv"]["passed"])  # the very same CV file as "first"
        self.assertFalse(checks["unique_linkedin"]["passed"])  # same link, other spelling
        self.assertTrue(self.checks_for(first)["canApprove"])  # warnings don't block approval

    def test_only_the_two_fixed_reasons_and_company_only_when_claimed(self):
        ali = self.make_candidate()
        self.assertEqual(self.decide(ali, status="rejected").status_code, 400)  # a reason is required
        self.assertEqual(self.decide(ali, status="rejected", reason="looks_odd").status_code, 400)

        # Ali claims no company yet, so "company not verifiable" doesn't apply.
        reasons = [item["value"] for item in self.checks_for(ali)["rejectionReasons"]]
        self.assertEqual(reasons, ["email_not_verifiable"])
        self.assertEqual(self.decide(ali, status="rejected", reason="company_not_verifiable").status_code, 400)

        # A current job = a claimed company.
        Experience.objects.create(profile=Profile.objects.get(user=ali), title="Dev", company="Acme", current=True)
        response = self.decide(ali, status="rejected", reason="company_not_verifiable")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["rejectionReason"], "company_not_verifiable")

    def test_rejected_person_can_fix_and_send_again(self):
        ali = self.make_candidate()
        self.decide(ali, status="rejected", reason="email_not_verifiable")

        own = APIClient()
        own.force_authenticate(ali)
        me = own.get("/api/profiles/me/").json()
        self.assertEqual((me["approvalStatus"], me["rejectionReason"]), ("rejected", "email_not_verifiable"))

        response = own.post("/api/profiles/me/resubmit/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["approvalStatus"], "pending")
        self.assertEqual(own.post("/api/profiles/me/resubmit/").status_code, 400)  # already waiting

    def test_pending_people_are_counted_for_the_admin(self):
        self.make_candidate("a@example.com")
        self.make_candidate("b@example.com", complete=False)
        self.assertEqual(self.client.get("/api/admin/stats/").json()["pendingApprovals"], 2)


# =============================================================================
# Suspend, ban, soft delete and restore
# =============================================================================


class AccountStateTests(TestCase):
    PASSWORD = "S3cure-pass!"

    def setUp(self):
        self.admin = User.objects.create_user("boss@example.com", "boss@example.com", self.PASSWORD)
        Profile.objects.create(user=self.admin, role=Profile.ROLE_ADMIN, approval_status=Profile.APPROVAL_APPROVED)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.ali = User.objects.create_user("ali@example.com", "ali@example.com", self.PASSWORD, first_name="Ali")
        Profile.objects.create(user=self.ali, approval_status=Profile.APPROVAL_APPROVED)

    def act(self, user, action, reason="Fake company"):
        return self.client.post(f"/api/admin/users/{user.pk}/account/", {"action": action, "reason": reason}, format="json")

    def sign_in(self, email="ali@example.com"):
        return APIClient().post("/api/accounts/signin/", {"email": email, "password": self.PASSWORD}, format="json")

    def test_banned_email_cant_sign_in_or_sign_up_again(self):
        self.assertEqual(self.act(self.ali, "ban").status_code, 200)
        self.assertEqual(self.sign_in().json()["code"], "account_banned")

        # Even after the account is gone for good, the email stays blocked.
        from accounts.account_state import delete_for_good

        delete_for_good(User.objects.get(pk=self.ali.pk))
        signup = APIClient().post(
            "/api/accounts/signup/",
            {"fullName": "Ali Again", "email": "ALI@example.com", "password": self.PASSWORD, "role": "recruiter", "companyName": "Acme"},
            format="multipart",
        )
        self.assertEqual(signup.status_code, 400)
        self.assertIn("can't be used", signup.json()["message"])

    def test_suspended_and_deleted_people_vanish_from_the_network(self):
        from connections.network import network_users

        self.assertIn(self.ali, network_users())
        self.act(self.ali, "suspend")
        self.assertNotIn(self.ali, network_users())
        self.act(self.ali, "unsuspend")
        self.act(self.ali, "delete")
        self.assertNotIn(self.ali, network_users())

    def test_user_deletes_and_restores_their_own_account(self):
        own = APIClient()
        own.force_authenticate(self.ali)
        response = own.post("/api/accounts/delete-account/", {"password": self.PASSWORD}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("restoreUntil", response.json())
        self.assertTrue(User.objects.filter(pk=self.ali.pk).exists())  # soft: still in the database

        blocked = self.sign_in()
        self.assertEqual((blocked.status_code, blocked.json()["code"]), (403, "account_deleted"))

        restored = APIClient().post("/api/accounts/restore/", {"email": "ali@example.com", "password": self.PASSWORD}, format="json")
        self.assertEqual(restored.status_code, 200, restored.content)
        self.assertTrue(User.objects.get(pk=self.ali.pk).is_active)

    def test_admin_deletion_can_only_be_undone_by_an_admin(self):
        self.act(self.ali, "delete", reason="Fake profile")
        self.assertEqual(self.sign_in().json()["code"], "account_removed")
        restore = APIClient().post("/api/accounts/restore/", {"email": "ali@example.com", "password": self.PASSWORD}, format="json")
        self.assertEqual(restore.status_code, 400)

        self.assertEqual(self.act(self.ali, "restore").status_code, 200)
        self.assertEqual(self.sign_in().status_code, 200)

    def test_admin_cant_act_on_themselves_or_twice(self):
        self.assertEqual(self.act(self.admin, "suspend").status_code, 403)
        self.assertEqual(self.act(self.admin, "delete").status_code, 403)
        self.act(self.ali, "suspend")
        self.assertEqual(self.act(self.ali, "suspend").status_code, 400)  # already suspended


class PurgeJobTests(TestCase):
    """The daily job: warnings at 7 days and 1 day left, then delete for good."""

    def setUp(self):
        self.ali = User.objects.create_user("ali@example.com", "ali@example.com", "S3cure-pass!")
        self.profile = Profile.objects.create(user=self.ali)
        from accounts.account_state import soft_delete

        soft_delete(self.ali)

    def run_job(self, days_after_delete):
        from datetime import timedelta
        from io import StringIO
        from unittest import mock

        from django.core import mail
        from django.core.management import call_command
        from django.utils import timezone

        later = timezone.now() + timedelta(days=days_after_delete)
        mail.outbox.clear()
        with mock.patch("django.utils.timezone.now", return_value=later):
            call_command("purge_deleted_accounts", stdout=StringIO())
        return [message.subject for message in mail.outbox]

    def test_warnings_then_permanent_delete(self):
        self.assertEqual(self.run_job(10), [])  # 20 days left: nothing yet
        self.assertEqual(len(self.run_job(23)), 1)  # 7 days left: first warning
        self.assertEqual(self.run_job(24), [])  # never the same warning twice
        self.assertEqual(len(self.run_job(29.5)), 1)  # under 1 day left: last warning
        self.assertTrue(User.objects.filter(pk=self.ali.pk).exists())

        self.run_job(30.1)  # grace period over
        self.assertFalse(User.objects.filter(pk=self.ali.pk).exists())
        self.assertTrue(AdminActionLog.objects.filter(action="account_deleted_for_good").exists())
