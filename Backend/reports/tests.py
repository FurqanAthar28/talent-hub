"""
Tests for reports (users report, admins handle). Run them with:

    python manage.py test reports
"""

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import AdminActionLog
from connections.models import Conversation, Message
from profiles.models import Profile

from .models import Report

# These names must match AdminReport in Frontend/app/(main)/admin/types.ts
ADMIN_REPORT_FIELDS = {
    "id", "kind", "reason", "reasonLabel", "details", "messageText", "status",
    "actionTaken", "resolutionNote", "resolvedByName", "resolvedAt", "createdAt",
    "reporterName", "reporterEmail", "reportedUserId", "reportedUserName",
    "reportedUserEmail", "reportedUserRole", "reportedUserAccountStatus",
    "reportedUserDeleted", "openReportsAboutUser",
}


class ReportTestBase(TestCase):
    def setUp(self):
        cache.clear()  # throttle counters live in the cache
        self.admin = self.make_user("boss@example.com", Profile.ROLE_ADMIN)
        self.ali = self.make_user("ali@example.com")
        self.sara = self.make_user("sara@example.com")
        self.zain = self.make_user("zain@example.com")

        first, second = sorted([self.ali, self.sara], key=lambda user: user.pk)
        self.chat = Conversation.objects.create(participant_one=first, participant_two=second)
        self.sara_message = Message.objects.create(conversation=self.chat, sender=self.sara, body="Send me money now")
        self.ali_message = Message.objects.create(conversation=self.chat, sender=self.ali, body="No thanks")

    def make_user(self, email, role=Profile.ROLE_CANDIDATE):
        user = User.objects.create_user(email, email, "S3cure-pass!", first_name=email.split("@")[0].title())
        Profile.objects.create(user=user, role=role, approval_status=Profile.APPROVAL_APPROVED)
        return user

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def report(self, reporter, **body):
        payload = {"kind": "profile", "reason": "spam", **body}
        return self.client_for(reporter).post("/api/reports/", payload, format="json")


class UserReportTests(ReportTestBase):
    def test_report_a_profile(self):
        response = self.report(self.ali, reportedUserId=self.zain.pk, reason="fake_profile", details="Not a real person")
        self.assertEqual(response.status_code, 201)
        report = Report.objects.get()
        self.assertEqual(report.reporter, self.ali)
        self.assertEqual(report.reported_user, self.zain)
        self.assertEqual(report.status, Report.STATUS_OPEN)
        self.assertEqual(report.details, "Not a real person")

    def test_report_a_message_copies_its_text(self):
        response = self.report(self.ali, kind="message", reportedUserId=self.sara.pk, messageId=self.sara_message.pk, reason="scam")
        self.assertEqual(response.status_code, 201)
        report = Report.objects.get()
        self.assertEqual(report.message_text, "Send me money now")

        # Deleting the message later keeps the copy for the admin.
        self.sara_message.delete()
        report.refresh_from_db()
        self.assertIsNone(report.message)
        self.assertEqual(report.message_text, "Send me money now")

    def test_cannot_report_a_message_from_someone_elses_chat(self):
        response = self.report(self.zain, kind="message", reportedUserId=self.sara.pk, messageId=self.sara_message.pk)
        self.assertEqual(response.status_code, 404)

    def test_cannot_report_a_message_under_the_wrong_person(self):
        # Ali's own message, reported as if Sara sent it.
        response = self.report(self.sara, kind="message", reportedUserId=self.zain.pk, messageId=self.ali_message.pk)
        self.assertEqual(response.status_code, 404)

    def test_message_report_needs_a_message(self):
        response = self.report(self.ali, kind="message", reportedUserId=self.sara.pk)
        self.assertEqual(response.status_code, 400)

    def test_cannot_report_yourself_or_an_admin(self):
        self.assertEqual(self.report(self.ali, reportedUserId=self.ali.pk).status_code, 400)
        self.assertEqual(self.report(self.ali, reportedUserId=self.admin.pk).status_code, 400)
        self.assertEqual(self.report(self.ali, reportedUserId=999999).status_code, 404)
        self.assertFalse(Report.objects.exists())

    def test_admins_dont_report(self):
        self.assertEqual(self.report(self.admin, reportedUserId=self.ali.pk).status_code, 403)

    def test_must_be_signed_in(self):
        response = APIClient().post("/api/reports/", {"kind": "profile", "reportedUserId": self.ali.pk, "reason": "spam"})
        self.assertIn(response.status_code, (401, 403))

    def test_other_needs_details(self):
        self.assertEqual(self.report(self.ali, reportedUserId=self.zain.pk, reason="other").status_code, 400)
        self.assertEqual(
            self.report(self.ali, reportedUserId=self.zain.pk, reason="other", details="Odd").status_code, 201
        )

    def test_reporting_twice_while_open_makes_one_report(self):
        self.assertEqual(self.report(self.ali, reportedUserId=self.zain.pk).status_code, 201)
        second = self.report(self.ali, reportedUserId=self.zain.pk)
        self.assertEqual(second.status_code, 200)
        self.assertIn("already", second.json()["message"])
        self.assertEqual(Report.objects.count(), 1)

        # Someone else reporting the same person is a separate report.
        self.assertEqual(self.report(self.sara, reportedUserId=self.zain.pk).status_code, 201)
        self.assertEqual(Report.objects.count(), 2)


class AdminReportTests(ReportTestBase):
    def setUp(self):
        super().setUp()
        self.admin_client = self.client_for(self.admin)
        self.report(self.ali, reportedUserId=self.zain.pk, reason="fake_profile")
        self.report(self.sara, reportedUserId=self.zain.pk, reason="spam")
        self.report(self.ali, kind="message", reportedUserId=self.sara.pk, messageId=self.sara_message.pk, reason="scam")
        self.zain_report = Report.objects.filter(reported_user=self.zain).first()
        self.sara_report = Report.objects.get(reported_user=self.sara)

    def resolve(self, report, action, note=""):
        return self.admin_client.post(
            f"/api/admin/reports/{report.pk}/resolve/", {"action": action, "note": note}, format="json"
        )

    def test_only_admins_see_reports(self):
        self.assertEqual(self.client_for(self.ali).get("/api/admin/reports/").status_code, 403)
        self.assertEqual(self.resolve_as(self.ali, self.zain_report).status_code, 403)

    def resolve_as(self, user, report):
        return self.client_for(user).post(f"/api/admin/reports/{report.pk}/resolve/", {"action": "dismiss"}, format="json")

    def test_list_has_every_field_and_counts_open_reports_per_person(self):
        rows = self.admin_client.get("/api/admin/reports/").json()
        self.assertEqual(len(rows), 3)
        self.assertEqual(set(rows[0].keys()), ADMIN_REPORT_FIELDS)
        zain_rows = [row for row in rows if row["reportedUserId"] == self.zain.pk]
        self.assertEqual({row["openReportsAboutUser"] for row in zain_rows}, {2})
        message_row = next(row for row in rows if row["kind"] == "message")
        self.assertEqual(message_row["messageText"], "Send me money now")
        self.assertEqual(message_row["reasonLabel"], "Scam or fake job offer")

    def test_stats_count_open_reports(self):
        self.assertEqual(self.admin_client.get("/api/admin/stats/").json()["openReports"], 3)

    def test_dismiss_changes_nothing_for_the_account(self):
        response = self.resolve(self.sara_report, "dismiss")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "dismissed")
        self.sara.refresh_from_db()
        self.assertTrue(self.sara.is_active)
        self.assertTrue(AdminActionLog.objects.filter(action="report_dismissed", target_user=self.sara).exists())

        # Closed reports move to the "closed" list.
        open_ids = [row["id"] for row in self.admin_client.get("/api/admin/reports/").json()]
        closed_ids = [row["id"] for row in self.admin_client.get("/api/admin/reports/?status=closed").json()]
        self.assertNotIn(self.sara_report.pk, open_ids)
        self.assertIn(self.sara_report.pk, closed_ids)

    def test_suspend_closes_every_open_report_about_the_person(self):
        response = self.resolve(self.zain_report, "suspend", "Fake profile")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["closedOthers"], 1)

        self.zain.refresh_from_db()
        self.assertFalse(self.zain.is_active)
        self.assertEqual(self.zain.profile.account_status, Profile.ACCOUNT_SUSPENDED)
        self.assertEqual(Report.objects.filter(reported_user=self.zain, status=Report.STATUS_ACTIONED).count(), 2)
        # Sara's report is about someone else: still open.
        self.sara_report.refresh_from_db()
        self.assertEqual(self.sara_report.status, Report.STATUS_OPEN)

        # Same audit line as the Users page, with the report id.
        log = AdminActionLog.objects.get(action="account_suspend", target_user=self.zain)
        self.assertEqual(log.metadata["report_id"], self.zain_report.pk)

    def test_ban_needs_a_reason(self):
        self.assertEqual(self.resolve(self.zain_report, "ban").status_code, 400)
        self.assertEqual(self.resolve(self.zain_report, "ban", "Scam").status_code, 200)
        self.zain.refresh_from_db()
        self.assertEqual(self.zain.profile.account_status, Profile.ACCOUNT_BANNED)

    def test_cannot_close_twice(self):
        self.assertEqual(self.resolve(self.sara_report, "dismiss").status_code, 200)
        self.assertEqual(self.resolve(self.sara_report, "dismiss").status_code, 400)

    def test_suspending_an_already_suspended_account_explains_why(self):
        self.admin_client.post(
            f"/api/admin/users/{self.zain.pk}/account/", {"action": "suspend", "reason": "x"}, format="json"
        )
        response = self.resolve(self.zain_report, "suspend", "Again")
        self.assertEqual(response.status_code, 400)
        self.zain_report.refresh_from_db()
        self.assertEqual(self.zain_report.status, Report.STATUS_OPEN)
