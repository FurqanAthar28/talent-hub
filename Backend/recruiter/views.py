from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from profiles.models import Profile
from .serializers import RecruiterCandidateSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recruiter_candidates(request):
    search = request.query_params.get("search", "").strip()
    skill = request.query_params.get("skill", "").strip()
    location = request.query_params.get("location", "").strip()
    open_to_work = request.query_params.get("open_to_work", "").strip()

    candidates = (
        Profile.objects
        .select_related("user")
        .prefetch_related("skills", "projects", "experiences")
        .filter(role=Profile.ROLE_CANDIDATE)
    )

    if search:
        candidates = candidates.filter(
            Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(user__email__icontains=search)
            | Q(headline__icontains=search)
            | Q(location__icontains=search)
            | Q(bio__icontains=search)
            | Q(skills__name__icontains=search)
        )

    if skill:
        candidates = candidates.filter(skills__name__icontains=skill)

    if location:
        candidates = candidates.filter(location__icontains=location)

    if open_to_work in ["true", "false"]:
        candidates = candidates.filter(open_to_work=open_to_work == "true")

    candidates = candidates.distinct().order_by("user__first_name", "user__last_name")

    serializer = RecruiterCandidateSerializer(candidates, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recruiter_candidate_detail(request, candidate_id):
    candidate = get_object_or_404(
        Profile.objects
        .select_related("user")
        .prefetch_related("skills", "projects", "experiences"),
        user_id=candidate_id,
        role=Profile.ROLE_CANDIDATE,
    )

    serializer = RecruiterCandidateSerializer(candidate)
    return Response(serializer.data)