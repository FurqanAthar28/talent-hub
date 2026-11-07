"""
The admin's report tools: "/api/admin/reports/..." (wired in admin_panel/urls.py).

  GET  reports/?status=open|closed   -> the queue (open = newest first)
  POST reports/<id>/resolve/         -> close one: dismiss, suspend or ban

Suspend and ban use the SAME code as the Users page (apply_account_action),
so the rules (not yourself, not the last admin, a reason is required...)
and the audit log line are exactly the same.

When an admin suspends or bans someone from a report, every other OPEN
report about that person is closed too: the problem is handled.
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
        "reporter", "reported_user", "reported_user__profile", "resolved_by"
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


@api_view(["POST"])
@permission_classes([IsAppAdmin])
def admin_resolve_report_view(request, report_id):
    serializer = ResolveReportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    action = serializer.validated_data["action"]
    note = serializer.validated_data["note"]

    report = get_object_or_404(Report.objects.select_related("reported_user"), pk=report_id)
    if report.status != Report.STATUS_OPEN:
        return Response({"message": "This report is already closed."}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    person = report.reported_user
    name = person.get_full_name() or person.email

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
