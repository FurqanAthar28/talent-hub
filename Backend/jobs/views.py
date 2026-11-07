"""
Job posts API: "/api/jobs/...".

  GET    /api/jobs/              -> open jobs everyone in the network can see (with filters)
  POST   /api/jobs/              -> an approved recruiter posts a job
  GET    /api/jobs/mine/         -> the recruiter's own jobs (open, closed, hidden)
  GET    /api/jobs/<id>/         -> one job
  PATCH  /api/jobs/<id>/         -> the recruiter edits, closes or reopens their job
  DELETE /api/jobs/<id>/         -> the recruiter deletes their job

Admin tools ("hide a job") live in admin_views.py, under /api/admin/jobs/.
"""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from connections.network import is_network_user, network_users
from profiles.models import Profile
from profiles.permissions import is_app_admin, is_approved_recruiter

from .models import Job
from .serializers import JobInputSerializer, JobSerializer

# Most open jobs one recruiter can have at once (stops spam).
MAX_OPEN_JOBS_PER_RECRUITER = 20
# Most jobs one list answer holds.
LIST_LIMIT = 100


class CanSeeJobs(BasePermission):
    """Approved candidates and recruiters (the network), and admins."""

    message = "Jobs are open once an admin approves your profile."

    def has_permission(self, request, view):
        return is_app_admin(request.user) or is_network_user(request.user)


def with_people(jobs):
    """Load each job's recruiter and profile in the same database trip."""
    return jobs.select_related("recruiter", "recruiter__profile")


def visible_jobs():
    """Open, not hidden, and the recruiter can still use the network."""
    return with_people(
        Job.objects.filter(
            status=Job.STATUS_OPEN,
            hidden_by_admin=False,
            recruiter__in=network_users().filter(profile__role=Profile.ROLE_RECRUITER),
        )
    )


def job_data(request, jobs, many=False):
    context = {"request": request, "is_admin": is_app_admin(request.user)}
    return JobSerializer(jobs, many=many, context=context).data


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, CanSeeJobs])
def jobs_view(request):
    if request.method == "POST":
        return create_job(request)

    jobs = visible_jobs()
    params = request.query_params

    search = params.get("q", "").strip()
    if search:
        jobs = jobs.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
            | Q(location__icontains=search)
            | Q(recruiter__profile__company_name__icontains=search)
        )
    for param, column in (("type", "employment_type"), ("workStyle", "work_style"), ("level", "experience_level")):
        value = params.get(param, "").strip()
        if value:
            jobs = jobs.filter(**{column: value})
    recruiter_id = params.get("recruiter", "").strip()
    if recruiter_id.isdigit():
        jobs = jobs.filter(recruiter_id=int(recruiter_id))

    return Response(job_data(request, jobs[:LIST_LIMIT], many=True))


def create_job(request):
    if not (is_approved_recruiter(request.user) and request.user.is_active):
        return Response({"message": "Only approved recruiters can post jobs."}, status=status.HTTP_403_FORBIDDEN)

    open_count = Job.objects.filter(recruiter=request.user, status=Job.STATUS_OPEN).count()
    if open_count >= MAX_OPEN_JOBS_PER_RECRUITER:
        return Response(
            {"message": f"You can have up to {MAX_OPEN_JOBS_PER_RECRUITER} open jobs. Close one first."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = JobInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    job = serializer.save_to(Job(recruiter=request.user, status=Job.STATUS_OPEN))
    return Response(job_data(request, with_people(Job.objects).get(pk=job.pk)), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_jobs_view(request):
    """Every job I posted, newest first (recruiters only; others get an empty list)."""
    jobs = with_people(Job.objects.filter(recruiter=request.user))
    return Response(job_data(request, jobs, many=True))


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def job_detail_view(request, job_id):
    job = get_object_or_404(with_people(Job.objects), pk=job_id)
    is_mine = job.recruiter_id == request.user.pk

    if request.method == "GET":
        # Others only see visible jobs; "not found" for anything else.
        allowed = is_mine or is_app_admin(request.user) or (
            is_network_user(request.user) and visible_jobs().filter(pk=job.pk).exists()
        )
        if not allowed:
            return Response({"message": "This job isn't available."}, status=status.HTTP_404_NOT_FOUND)
        return Response(job_data(request, job))

    if not is_mine:
        return Response({"message": "You can only change your own jobs."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "DELETE":
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH: edit, close or reopen.
    serializer = JobInputSerializer(instance=job, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)

    reopening = serializer.validated_data.get("status") == Job.STATUS_OPEN and job.status != Job.STATUS_OPEN
    if reopening:
        open_count = Job.objects.filter(recruiter=request.user, status=Job.STATUS_OPEN).count()
        if open_count >= MAX_OPEN_JOBS_PER_RECRUITER:
            return Response(
                {"message": f"You can have up to {MAX_OPEN_JOBS_PER_RECRUITER} open jobs. Close one first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    serializer.save_to(job)
    return Response(job_data(request, with_people(Job.objects).get(pk=job.pk)))
