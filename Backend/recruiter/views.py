"""
Recruiter tools: search candidates and open one candidate.

Only APPROVED recruiters (and app admins) can use these endpoints.
"""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from config.db_helpers import count_related
from connections.models import ConnectionRequest
from connections.network import network_users
from profiles.models import Experience, Profile, Project
from profiles.permissions import is_app_admin, is_approved_recruiter

from .serializers import RecruiterCandidateSerializer

# The longest search text we accept (longer text is cut off).
MAX_SEARCH_LENGTH = 100


class IsApprovedRecruiter(BasePermission):
    """
    Allow app admins, and recruiters an admin has approved.
    Before, ANY logged-in user (even a candidate) could search all candidates.
    """

    message = "Only approved recruiters can search candidates."

    def has_permission(self, request, view):
        user = request.user
        if is_app_admin(user):
            return True
        return is_approved_recruiter(user)  # shared rule (profiles/permissions.py)


RECRUITER_PERMISSIONS = [IsAuthenticated, IsApprovedRecruiter]


def visible_candidates():
    """Every candidate a recruiter may see: candidate role, account switched on."""
    return Profile.objects.filter(
        role=Profile.ROLE_CANDIDATE,
        user__is_active=True,
        user__is_staff=False,
    )


def candidate_profiles():
    """
    The same candidates, ready to show on cards.
    The counts are added by the database in the same trip (no extra queries).
    """
    return (
        visible_candidates()
        .select_related("user")
        .prefetch_related("skills")  # we show the skill names
        .annotate(
            projects_count=count_related(Project, "profile"),
            experiences_count=count_related(Experience, "profile"),
        )
    )


def read_text_param(request, name):
    """Read ?name=... from the address, trimmed and not too long."""
    return request.query_params.get(name, "").strip()[:MAX_SEARCH_LENGTH]


@api_view(["GET"])
@permission_classes(RECRUITER_PERMISSIONS)
def recruiter_candidates(request):
    """
    Search candidates. All filters are optional:
        ?search=django        name, headline, location, bio or a skill
        ?skill=python
        ?location=lahore
        ?open_to_work=true    (or false)
    """
    search = read_text_param(request, "search")
    skill = read_text_param(request, "skill")
    location = read_text_param(request, "location")
    open_to_work = read_text_param(request, "open_to_work").lower()

    candidates = candidate_profiles()

    if search:
        # Q(...) | Q(...) means "this OR that".
        # (Email is NOT searched, so nobody can test which emails have accounts.)
        candidates = candidates.filter(
            Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(headline__icontains=search)
            | Q(location__icontains=search)
            | Q(bio__icontains=search)
            | Q(skills__name__icontains=search)
        )

    if skill:
        candidates = candidates.filter(skills__name__icontains=skill)

    if location:
        candidates = candidates.filter(location__icontains=location)

    if open_to_work in ("true", "false"):
        candidates = candidates.filter(open_to_work=(open_to_work == "true"))

    # distinct(): searching skills can find the same person twice
    # (for example "Python" and "Python Django"). Show each person once.
    candidates = candidates.distinct().order_by("user__first_name", "user__last_name")

    return Response(RecruiterCandidateSerializer(candidates, many=True).data)


@api_view(["GET"])
@permission_classes(RECRUITER_PERMISSIONS)
def recruiter_candidate_detail(request, candidate_id):
    """One candidate, found by their USER id."""
    candidate = get_object_or_404(candidate_profiles(), user_id=candidate_id)
    return Response(RecruiterCandidateSerializer(candidate).data)


@api_view(["GET"])
@permission_classes(RECRUITER_PERMISSIONS)
def recruiter_summary(request):
    """
    The numbers for the recruiter dashboard.

    .count() asks the database "how many?" and gets back ONE number.
    Before, the dashboard downloaded every user, connection and request
    just to count them in the browser.
    """
    user = request.user
    return Response(
        {
            "candidatesCount": visible_candidates().count(),
            "connectionsCount": network_users().filter(connected_to__user=user).count(),
            "pendingRequestsCount": ConnectionRequest.objects.filter(
                receiver=user,
                sender__in=network_users(),
                status=ConnectionRequest.STATUS_PENDING,
            ).count(),
        }
    )
