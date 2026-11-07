"""
The admin's job tools: "/api/admin/jobs/..." (wired in admin_panel/urls.py).

  GET  jobs/                    -> every job (open, closed, hidden), newest first
  POST jobs/<id>/visibility/    -> hide (with a reason the recruiter sees) or show again

Hiding doesn't delete anything: the recruiter still sees the job, marked
"Hidden by an admin" with the reason, and can fix it and ask again.
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from admin_panel.views import log_action
from profiles.permissions import IsAppAdmin

from .models import Job
from .serializers import JobSerializer, JobVisibilitySerializer

ADMIN_JOBS_LIMIT = 200


def admin_job_data(request, job_or_jobs, many=False):
    return JobSerializer(job_or_jobs, many=many, context={"request": request, "is_admin": True}).data


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_jobs_view(request):
    jobs = Job.objects.select_related("recruiter", "recruiter__profile").order_by("-created_at")
    return Response(admin_job_data(request, jobs[:ADMIN_JOBS_LIMIT], many=True))


@api_view(["POST"])
@permission_classes([IsAppAdmin])
def admin_job_visibility_view(request, job_id):
    serializer = JobVisibilitySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    hidden = serializer.validated_data["hidden"]
    reason = serializer.validated_data["reason"]

    job = get_object_or_404(Job.objects.select_related("recruiter", "recruiter__profile"), pk=job_id)
    job.hidden_by_admin = hidden
    job.hidden_reason = reason if hidden else ""
    job.hidden_by = request.user if hidden else None
    job.updated_at = timezone.now()
    job.save(update_fields=["hidden_by_admin", "hidden_reason", "hidden_by", "updated_at"])

    log_action(
        request,
        action="job_hidden" if hidden else "job_shown",
        description=(f"Hid the job \"{job.title}\": {reason}" if hidden else f"Showed the job \"{job.title}\" again"),
        target_user=job.recruiter,
        metadata={"job_id": job.pk, "reason": reason},
    )
    data = dict(admin_job_data(request, job))
    data["message"] = "Job hidden. The recruiter sees why." if hidden else "Job is visible again."
    return Response(data)
