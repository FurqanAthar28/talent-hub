"""
Tests for job posts. Run them with:

    python manage.py test jobs
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from accounts import account_state
from accounts.models import AdminActionLog
from profiles.models import Profile

from .models import Job
from .views import MAX_OPEN_JOBS_PER_RECRUITER

# These names must match Job in Frontend/app/services/jobs.ts
JOB_FIELDS = {
    "id", "title", "employmentType", "workStyle", "experienceLevel", "location",
    "salary", "description", "skills", "status", "hiddenByAdmin", "hiddenReason",
    "createdAt", "updatedAt", "recruiter", "isMine",
}

GOOD_JOB = {
    "title": "Backend Engineer",
    "employmentType": "full_time",
    "workStyle": "hybrid",
    "experienceLevel": "mid",
    "location": "Lahore",
    "salary": "PKR 300k-400k / month",
    "description": "Build and run our Django APIs for payroll customers across Pakistan.",
    "skills": ["Django", "PostgreSQL", "django"],
}


def make_user(email, role=Profile.ROLE_CANDIDATE, approval=Profile.APPROVAL_APPROVED, **profile):
    user = User.objects.create_user(email, email, "S3cure-pass!", first_name=email.split("@")[0].title())
    Profile.objects.create(user=user, role=role, approval_status=approval, **profile)
    return user


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


class JobTests(TestCase):
    def setUp(self):
        self.recruiter = make_user("rec@example.com", Profile.ROLE_RECRUITER, company_name="Acme")
        self.other_recruiter = make_user("rec2@example.com", Profile.ROLE_RECRUITER, company_name="Globex")
        self.candidate = make_user("ali@example.com")
        self.waiting = make_user("new@example.com", approval=Profile.APPROVAL_PENDING)
        self.admin = make_user("boss@example.com", Profile.ROLE_ADMIN)
        self.rec_client = client_for(self.recruiter)
        self.cand_client = client_for(self.candidate)

    def post_job(self, client=None, **changes):
        return (client or self.rec_client).post("/api/jobs/", {**GOOD_JOB, **changes}, format="json")

    # ----- posting -----

    def test_approved_recruiter_posts_a_job(self):
        response = self.post_job()
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(set(data.keys()), JOB_FIELDS)
        self.assertEqual(data["skills"], ["Django", "PostgreSQL"])  # repeat dropped
        self.assertEqual(data["recruiter"]["companyName"], "Acme")
        self.assertTrue(data["isMine"])

    def test_only_approved_recruiters_post(self):
        self.assertEqual(self.post_job(self.cand_client).status_code, 403)
        pending = make_user("pending-rec@example.com", Profile.ROLE_RECRUITER, approval=Profile.APPROVAL_PENDING)
        self.assertEqual(self.post_job(client_for(pending)).status_code, 403)
        self.assertEqual(self.post_job(client_for(self.admin)).status_code, 403)

    def test_checks_the_form(self):
        self.assertEqual(self.post_job(title="x").status_code, 400)
        self.assertEqual(self.post_job(description="Too short").status_code, 400)
        self.assertEqual(self.post_job(employmentType="forever").status_code, 400)
        # On-site and hybrid need a place; remote doesn't.
        self.assertEqual(self.post_job(workStyle="onsite", location="").status_code, 400)
        self.assertEqual(self.post_job(workStyle="remote", location="").status_code, 201)

    def test_limit_of_open_jobs(self):
        for number in range(MAX_OPEN_JOBS_PER_RECRUITER):
            Job.objects.create(
                recruiter=self.recruiter, title=f"Job {number}", employment_type="full_time",
                work_style="remote", experience_level="mid", description="x" * 40,
            )
        self.assertEqual(self.post_job().status_code, 400)

    # ----- who sees what -----

    def test_network_sees_open_jobs_with_filters(self):
        self.post_job()
        self.post_job(
            self.rec_client,
            title="QA Intern",
            employmentType="internship",
            workStyle="remote",
            location="",
            description="Test our web and mobile apps by hand and write clear bug reports.",
        )
        rows = self.cand_client.get("/api/jobs/").json()
        self.assertEqual(len(rows), 2)
        self.assertFalse(rows[0]["isMine"])

        self.assertEqual(len(self.cand_client.get("/api/jobs/?type=internship").json()), 1)
        self.assertEqual(len(self.cand_client.get("/api/jobs/?workStyle=hybrid").json()), 1)
        self.assertEqual(len(self.cand_client.get("/api/jobs/?q=acme").json()), 2)  # company name
        self.assertEqual(len(self.cand_client.get("/api/jobs/?q=django").json()), 1)  # description
        self.assertEqual(len(self.cand_client.get(f"/api/jobs/?recruiter={self.other_recruiter.pk}").json()), 0)

    def test_people_waiting_for_approval_cant_browse(self):
        self.assertEqual(client_for(self.waiting).get("/api/jobs/").status_code, 403)

    def test_closed_hidden_and_suspended_jobs_disappear(self):
        job_id = self.post_job().json()["id"]
        url = f"/api/jobs/{job_id}/"

        self.rec_client.patch(url, {"status": "closed"}, format="json")
        self.assertEqual(self.cand_client.get("/api/jobs/").json(), [])
        self.assertEqual(self.cand_client.get(url).status_code, 404)
        self.assertEqual(self.rec_client.get(url).status_code, 200)  # the owner still sees it

        self.rec_client.patch(url, {"status": "open"}, format="json")
        self.assertEqual(len(self.cand_client.get("/api/jobs/").json()), 1)

        account_state.suspend(self.recruiter, "test")
        self.assertEqual(self.cand_client.get("/api/jobs/").json(), [])

    # ----- changing -----

    def test_only_the_owner_edits_or_deletes(self):
        job_id = self.post_job().json()["id"]
        url = f"/api/jobs/{job_id}/"
        other = client_for(self.other_recruiter)
        self.assertEqual(other.patch(url, {"title": "Hacked"}, format="json").status_code, 403)
        self.assertEqual(other.delete(url).status_code, 403)

        response = self.rec_client.patch(url, {"title": "Senior Backend Engineer", "experienceLevel": "senior"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["title"], "Senior Backend Engineer")
        self.assertEqual(self.rec_client.delete(url).status_code, 204)
        self.assertFalse(Job.objects.exists())

    def test_my_jobs_lists_everything_i_posted(self):
        self.post_job()
        job_id = self.post_job(title="Closed one").json()["id"]
        self.rec_client.patch(f"/api/jobs/{job_id}/", {"status": "closed"}, format="json")
        self.assertEqual(len(self.rec_client.get("/api/jobs/mine/").json()), 2)
        self.assertEqual(self.cand_client.get("/api/jobs/mine/").json(), [])

    # ----- admins -----

    def test_admin_hides_a_job_and_the_recruiter_sees_why(self):
        job_id = self.post_job().json()["id"]
        admin_client = client_for(self.admin)
        url = f"/api/admin/jobs/{job_id}/visibility/"

        self.assertEqual(self.cand_client.post(url, {"hidden": True, "reason": "x"}, format="json").status_code, 403)
        self.assertEqual(admin_client.post(url, {"hidden": True}, format="json").status_code, 400)  # needs a reason

        response = admin_client.post(url, {"hidden": True, "reason": "Asks for a fee"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.cand_client.get("/api/jobs/").json(), [])

        mine = self.rec_client.get("/api/jobs/mine/").json()[0]
        self.assertTrue(mine["hiddenByAdmin"])
        self.assertEqual(mine["hiddenReason"], "Asks for a fee")
        self.assertTrue(AdminActionLog.objects.filter(action="job_hidden", target_user=self.recruiter).exists())

        admin_client.post(url, {"hidden": False}, format="json")
        self.assertEqual(len(self.cand_client.get("/api/jobs/").json()), 1)

    def test_admin_sees_every_job_and_the_count(self):
        self.post_job()
        job_id = self.post_job(title="Old").json()["id"]
        self.rec_client.patch(f"/api/jobs/{job_id}/", {"status": "closed"}, format="json")
        admin_client = client_for(self.admin)
        self.assertEqual(len(admin_client.get("/api/admin/jobs/").json()), 2)
        self.assertEqual(admin_client.get("/api/admin/stats/").json()["openJobs"], 1)
        self.assertEqual(self.cand_client.get("/api/admin/jobs/").status_code, 403)

    def test_hidden_reason_is_private(self):
        job = Job.objects.create(
            recruiter=self.recruiter, title="Hidden", employment_type="full_time", work_style="remote",
            experience_level="mid", description="x" * 40, hidden_reason="secret",
        )
        # Even if a candidate somehow got the row, the reason isn't in it.
        from .serializers import JobSerializer

        class FakeRequest:
            user = self.candidate

        data = JobSerializer(job, context={"request": FakeRequest()}).data
        self.assertEqual(data["hiddenReason"], "")
