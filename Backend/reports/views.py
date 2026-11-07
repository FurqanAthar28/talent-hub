"""
Reports API for normal users: "/api/reports/".

Anyone signed in (except admins, who have the admin page) can report:
  - a person's profile
  - a message someone sent them in a chat

You can't report yourself or an admin, and you can only report a message
from a chat you are part of, sent by the person you report.
Reporting the same thing twice while the first report is still open does
nothing (it answers "already reported"), so one person can't flood the queue.
"""

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from connections.models import Message
from profiles.models import Profile
from profiles.permissions import is_app_admin, role_of

from .models import Report
from .serializers import CreateReportSerializer
from .throttles import ReportThrottle

THANKS = "Thanks for telling us. An admin will look at your report."
ALREADY_REPORTED = "You already reported this. An admin will look at it soon."


def bad_request(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({"message": message}, status=code)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([ReportThrottle])
def create_report_view(request):
    if is_app_admin(request.user):
        return bad_request("Admins handle problems from the admin page.", status.HTTP_403_FORBIDDEN)

    serializer = CreateReportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    reported = User.objects.select_related("profile").filter(pk=data["reportedUserId"]).first()
    if reported is None:
        return bad_request("This account doesn't exist anymore.", status.HTTP_404_NOT_FOUND)
    if reported.pk == request.user.pk:
        return bad_request("You can't report yourself.")
    if role_of(reported) == Profile.ROLE_ADMIN:
        return bad_request("This account can't be reported.")

    message = None
    if data["kind"] == Report.KIND_MESSAGE:
        # Only a message in MY chat, sent by the person I report.
        # Anything else answers "not found", so nobody can guess other chats.
        message = (
            Message.objects.filter(
                Q(conversation__participant_one=request.user) | Q(conversation__participant_two=request.user),
                pk=data["messageId"],
                sender=reported,
            )
            .first()
        )
        if message is None:
            return bad_request("We couldn't find that message.", status.HTTP_404_NOT_FOUND)

    already_open = Report.objects.filter(
        reporter=request.user,
        reported_user=reported,
        kind=data["kind"],
        message=message,
        status=Report.STATUS_OPEN,
    ).exists()
    if already_open:
        return Response({"message": ALREADY_REPORTED})

    Report.objects.create(
        reporter=request.user,
        reported_user=reported,
        kind=data["kind"],
        message=message,
        message_text=message.body if message else "",
        reason=data["reason"],
        details=data["details"],
    )
    return Response({"message": THANKS}, status=status.HTTP_201_CREATED)
