"""
Profile API.

WHAT'S IN THIS FILE
1. Helpers           -> find profiles, check errors, write activity lines
2. Profiles          -> my profile, someone else's profile, edit, CV download
3. Skills            -> list / add / delete
4. Projects          -> list / add / edit / delete
5. Experience        -> list / add / edit / delete
6. Other users' lists, views and activity

Every endpoint needs login (that's the default in settings.py).

HOW EDITING IS KEPT SAFE
The "my item" helpers always search inside YOUR profile, for example
Skill.objects.get(id=5, profile=my_profile). So nobody can edit or delete
someone else's skill just by changing the id number in the address.
"""

from django.contrib.auth import get_user_model
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from connections.network import get_relationships

from .models import Activity, Experience, Profile, ProfileView, Project, Skill
from .permissions import can_view_cv, is_app_admin
from .serializers import (
    ActivitySerializer,
    ExperienceSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    ProjectSerializer,
    SkillSerializer,
)
from .skill_options import SKILL_OPTIONS

User = get_user_model()

# How many recent activity lines to show on the dashboard.
RECENT_ACTIVITY_LIMIT = 10


# =============================================================================
# 1. HELPERS
# =============================================================================


def get_or_create_user_profile(user):
    """
    Return the user's profile, making a candidate one if it doesn't exist yet.
    Being Django staff does NOT make anyone an app admin any more: only
    `python manage.py create_admin` or another admin can do that.
    """
    profile, _created = Profile.objects.get_or_create(user=user)
    # We already have the user, so hand it to the profile.
    # Otherwise profile.user would load the same user from the database again.
    profile.user = user
    return profile


def get_visible_profile_or_404(request, user_id):
    """
    Someone else's profile.
    Deactivated or unverified accounts are hidden ("not found", 404),
    except from admins, who need to see every account.
    """
    users = User.objects.all() if is_app_admin(request.user) else User.objects.filter(is_active=True)
    user = get_object_or_404(users, id=user_id)
    return get_or_create_user_profile(user)


def profile_response(profile, request, extra=None):
    """
    Profile JSON, with only what THIS viewer may see:
    - email and admin note: only your own profile, or admins
    - CV link: only people allowed by can_view_cv (profiles/permissions.py)
    `extra` = more fields to add (for example the connection status).
    """
    show_private = profile.user_id == request.user.pk or is_app_admin(request.user)
    serializer = ProfileSerializer(
        profile,
        context={
            "show_private": show_private,
            "show_cv": can_view_cv(request.user, profile),
        },
    )
    data = dict(serializer.data)
    if extra:
        data.update(extra)
    return Response(data)


def add_activity(profile, title):
    """Add a line like "Added skill: Python" to the user's activity list."""
    Activity.objects.create(profile=profile, title=title)


def check_or_raise(serializer):
    """
    Check the data. If something is wrong, DRF stops here and answers 400.
    Our exception handler (config/exception_handler.py) turns the problem
    into {"message": "Title: This field may not be blank."}.
    """
    serializer.is_valid(raise_exception=True)


def deleted(message):
    return Response({"message": message}, status=status.HTTP_200_OK)


# =============================================================================
# 2. PROFILES
# =============================================================================


@api_view(["GET"])
def my_profile_view(request):
    profile = get_or_create_user_profile(request.user)
    return profile_response(profile, request)


@api_view(["PATCH"])
def update_my_profile_view(request):
    profile = get_or_create_user_profile(request.user)

    serializer = ProfileUpdateSerializer(profile, data=request.data, partial=True)
    check_or_raise(serializer)
    profile = serializer.save()

    add_activity(profile, "Updated profile information")
    return profile_response(profile, request)


@api_view(["GET"])
def user_profile_view(request, user_id):
    """
    Someone else's profile, plus how I am related to them, for example
    {"connectionStatus": "sent_pending", "requestId": 31, ...}.
    The page needs this to show the right button (Connect / Request sent /
    Accept / Message).
    """
    profile = get_visible_profile_or_404(request, user_id)
    relationship = get_relationships(request.user, [profile.user_id])[profile.user_id]
    return profile_response(profile, request, extra=relationship)


@api_view(["GET"])
def cv_download_view(request, user_id):
    """
    Send someone's CV file, but ONLY to people allowed to see it:
    the owner, staff, approved recruiters, and the candidate's connections
    (see can_view_cv in profiles/permissions.py).
    """
    profile = get_visible_profile_or_404(request, user_id)

    if not can_view_cv(request.user, profile):
        raise PermissionDenied("You don't have permission to view this CV.")

    if not profile.cv_file:
        raise Http404("This user has no CV.")

    try:
        cv = profile.cv_file.open("rb")
    except FileNotFoundError:
        # The database says there's a file, but it's missing on disk.
        raise Http404("CV file not found.") from None

    # A friendly download name like "ali-khan-cv.pdf".
    person = slugify(profile.user.get_full_name()) or f"user-{profile.user_id}"

    return FileResponse(
        cv,
        content_type="application/pdf",
        filename=f"{person}-cv.pdf",
        as_attachment=False,  # open in the browser instead of downloading
    )


# =============================================================================
# 3. SKILLS
# =============================================================================


@api_view(["GET"])
def skill_options(request):
    """The list of suggested skills for the "add skill" box."""
    return Response(SKILL_OPTIONS)


@api_view(["GET"])
def skills_list_view(request):
    profile = get_or_create_user_profile(request.user)
    serializer = SkillSerializer(profile.skills.all(), many=True)
    return Response(serializer.data)


@api_view(["POST"])
def skill_create_view(request):
    profile = get_or_create_user_profile(request.user)

    # context={"profile": ...} lets the serializer stop duplicate skills.
    serializer = SkillSerializer(data=request.data, context={"profile": profile})
    check_or_raise(serializer)
    skill = serializer.save(profile=profile)

    add_activity(profile, f"Added skill: {skill.name}")
    return Response(SkillSerializer(skill).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def skill_delete_view(request, skill_id):
    profile = get_or_create_user_profile(request.user)
    skill = get_object_or_404(Skill, id=skill_id, profile=profile)

    skill_name = skill.name
    skill.delete()

    add_activity(profile, f"Removed skill: {skill_name}")
    return deleted("Skill deleted")


# =============================================================================
# 4. PROJECTS
# =============================================================================


@api_view(["GET"])
def projects_list_view(request):
    profile = get_or_create_user_profile(request.user)
    serializer = ProjectSerializer(profile.projects.all(), many=True)
    return Response(serializer.data)


@api_view(["POST"])
def project_create_view(request):
    profile = get_or_create_user_profile(request.user)

    serializer = ProjectSerializer(data=request.data)
    check_or_raise(serializer)
    project = serializer.save(profile=profile)

    add_activity(profile, f"Added project: {project.title}")
    return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
def project_update_view(request, project_id):
    profile = get_or_create_user_profile(request.user)
    project = get_object_or_404(Project, id=project_id, profile=profile)

    serializer = ProjectSerializer(project, data=request.data, partial=True)
    check_or_raise(serializer)
    project = serializer.save()

    add_activity(profile, f"Updated project: {project.title}")
    return Response(ProjectSerializer(project).data)


@api_view(["DELETE"])
def project_delete_view(request, project_id):
    profile = get_or_create_user_profile(request.user)
    project = get_object_or_404(Project, id=project_id, profile=profile)

    project_title = project.title
    project.delete()

    add_activity(profile, f"Removed project: {project_title}")
    return deleted("Project deleted")


# =============================================================================
# 5. EXPERIENCE
# =============================================================================


@api_view(["GET"])
def experiences_list_view(request):
    profile = get_or_create_user_profile(request.user)
    serializer = ExperienceSerializer(profile.experiences.all(), many=True)
    return Response(serializer.data)


@api_view(["POST"])
def experience_create_view(request):
    profile = get_or_create_user_profile(request.user)

    serializer = ExperienceSerializer(data=request.data)
    check_or_raise(serializer)
    experience = serializer.save(profile=profile)

    add_activity(profile, f"Added experience: {experience.title}")
    return Response(ExperienceSerializer(experience).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
def experience_update_view(request, experience_id):
    profile = get_or_create_user_profile(request.user)
    experience = get_object_or_404(Experience, id=experience_id, profile=profile)

    serializer = ExperienceSerializer(experience, data=request.data, partial=True)
    check_or_raise(serializer)
    experience = serializer.save()

    add_activity(profile, f"Updated experience: {experience.title}")
    return Response(ExperienceSerializer(experience).data)


@api_view(["DELETE"])
def experience_delete_view(request, experience_id):
    profile = get_or_create_user_profile(request.user)
    experience = get_object_or_404(Experience, id=experience_id, profile=profile)

    experience_title = experience.title
    experience.delete()

    add_activity(profile, f"Removed experience: {experience_title}")
    return deleted("Experience deleted")


# =============================================================================
# 6. OTHER USERS' LISTS, PROFILE VIEWS, AND MY ACTIVITY
# =============================================================================


@api_view(["GET"])
def user_skills_view(request, user_id):
    profile = get_visible_profile_or_404(request, user_id)
    return Response(SkillSerializer(profile.skills.all(), many=True).data)


@api_view(["GET"])
def user_projects_view(request, user_id):
    profile = get_visible_profile_or_404(request, user_id)
    return Response(ProjectSerializer(profile.projects.all(), many=True).data)


@api_view(["GET"])
def user_experiences_view(request, user_id):
    profile = get_visible_profile_or_404(request, user_id)
    return Response(ExperienceSerializer(profile.experiences.all(), many=True).data)


@api_view(["POST"])
def track_profile_view(request, user_id):
    """Remember that the logged-in user looked at this profile."""
    if request.user.id == user_id:
        # Looking at your own profile doesn't count.
        return Response(status=status.HTTP_204_NO_CONTENT)

    profile = get_visible_profile_or_404(request, user_id)

    # One row per viewer. Visiting again just updates the time.
    ProfileView.objects.update_or_create(profile=profile, viewer=request.user)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def activities_list_view(request):
    profile = get_or_create_user_profile(request.user)
    activities = profile.activities.all()[:RECENT_ACTIVITY_LIMIT]
    return Response(ActivitySerializer(activities, many=True).data)
