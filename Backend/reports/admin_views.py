"""
The admin's report tools: "/api/admin/reports/..." (wired in admin_panel/urls.py).

  GET  reports/?status=open|closed   -> the queue (open = newest first)
  POST reports/<id>/resolve/         -> close one: dismiss, suspend, ban, or hide_job

Suspend and ban use the SAME code as the Users page (apply_account_action),
so the rules (not yourself, not the last admin, a reason is required...)
and the audit log line are exactly the same. On a job report they act on
the job's recruiter.

"hide_job" (job reports only) uses the SAME code as the admin Jobs page
(hide_job in jobs/admin_views.py), so the job looks and logs the same.

When an admin suspends or bans someone from a report, every other OPEN
report about that person is closed too: the problem is handled. Hiding a
job closes every open report about that job (not other jobs).
"""

from django.db import transaction
from django.db.models import Count, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from admin_panel.views import apply_account_action, get_target_user, log_action
from jobs.admin_views import hide_job
from profiles.permissions import IsAppAdmin

from .models import Report
from .serializers import AdminReportSerializer, ResolveReportSerializer

# The most reports the page loads at once.
REPORTS_LIMIT = 200

ACTION_REPORT_DISMISSED = "report_dismissed"


def admin_reports():
    """Reports with the people loaded, plus how many OPEN reports each reported person has."""
    open_about_user = (
        Report.objects.filter(reported_user=OuterRef("reported_user"), status=Report.STATUS_OPEN)
        .values("reported_user")
        .annotate(total=Count("id"))
        .values("total")
    )
    return Report.objects.select_related(
        "reporter", "reported_user", "reported_user__profile", "resolved_by", "job"
    ).annotate(open_about_user=Coalesce(Subquery(open_about_user, output_field=IntegerField()), 0))


def report_response(report_id, message, extra=None):
    data = dict(AdminReportSerializer(admin_reports().get(pk=report_id)).data)
    data["message"] = message
    data.update(extra or {})
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_reports_view(request):
    reports = admin_reports()
    if request.query_params.get("status") == "closed":
        reports = reports.exclude(status=Report.STATUS_OPEN).order_by("-resolved_at", "-created_at")
    else:
        reports = reports.filter(status=Report.STATUS_OPEN).order_by("-created_at")
    return Response(AdminReportSerializer(reports[:REPORTS_LIMIT], many=True).data)


def resolve_by_hiding_job(request, report, note, now):
    """Hide the reported job, then close every open report about that job."""
    if report.kind != Report.KIND_JOB:
        return Response({"message": "Only job reports can hide a job."}, status=status.HTTP_400_BAD_REQUEST)
    job = report.job
    if job is None:  # the recruiter deleted it (the report keeps the title copy)
        return Response({"message": "This job no longer exists."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        hide_job(request, job, note, extra_metadata={"report_id": report.pk})
        closed = Report.objects.filter(job=job, status=Report.STATUS_OPEN).update(
            status=Report.STATUS_ACTIONED,
            action_taken=Report.ACTION_HIDE_JOB,
            resolution_note=note,
            resolved_by=request.user,
            resolved_at=now,
        )

    others = closed - 1
    message = f"\"{job.title}\" is hidden. The recruiter sees why."
    if others > 0:
        message += f" {others} other open report{'s' if others != 1 else ''} about this job {'were' if others != 1 else 'was'} closed too."
    return report_response(report.pk, message, {"closedOthers": others})


@api_view(["POST"])
@permission_classes([IsAppAdmin])
def admin_resolve_report_view(request, report_id):
    serializer = ResolveReportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    action = serializer.validated_data["action"]
    note = serializer.validated_data["note"]

    report = get_object_or_404(Report.objects.select_related("reported_user", "job"), pk=report_id)
    if report.status != Report.STATUS_OPEN:
        return Response({"message": "This report is already closed."}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    person = report.reported_user
    name = person.get_full_name() or person.email

    if action == Report.ACTION_HIDE_JOB:
        return resolve_by_hiding_job(request, report, note, now)

    if action == Report.ACTION_DISMISS:
        report.status = Report.STATUS_DISMISSED
        report.action_taken = Report.ACTION_DISMISS
        report.resolution_note = note
        report.resolved_by = request.user
        report.resolved_at = now
        report.save()
        log_action(
            request,
            action=ACTION_REPORT_DISMISSED,
            description=f"Dismissed a {report.kind} report about {person.email}",
            target_user=person,
            metadata={"report_id": report.pk, "reason": report.reason, "note": note},
        )
        return report_response(report.pk, "Report dismissed. Nothing changed for the account.")

    # Suspend or ban: same rules as the Users page.
    user = get_target_user(request, person.pk)  # not yourself, not a superuser
    with transaction.atomic():
        problem = apply_account_action(request, user, action, note, extra_metadata={"report_id": report.pk})
        if problem:
            return Response({"message": problem}, status=status.HTTP_400_BAD_REQUEST)

        # Close THIS report and every other open one about the same person.
        closed = Report.objects.filter(reported_user=person, status=Report.STATUS_OPEN).update(
            status=Report.STATUS_ACTIONED,
            action_taken=action,
            resolution_note=note,
            resolved_by=request.user,
            resolved_at=now,
        )

    done = "suspended" if action == Report.ACTION_SUSPEND else "banned"
    others = closed - 1
    message = f"{name} is {done}."
    if others > 0:
        message += f" {others} other open report{'s' if others != 1 else ''} about them {'were' if others != 1 else 'was'} closed too."
    return report_response(report.pk, message, {"closedOthers": others})
