from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User

from .models import Activity, Profile, ProfileView, Skill, Project, Experience
from .serializers import (
    ActivitySerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    SkillSerializer,
    ProjectSerializer,
    ExperienceSerializer,
)


def add_activity(profile, title):
    Activity.objects.create(profile=profile, title=title)


def get_or_create_user_profile(user):
    default_role = Profile.ROLE_ADMIN if user.is_staff else Profile.ROLE_CANDIDATE
    profile, _created = Profile.objects.get_or_create(
        user=user,
        defaults={"role": default_role},
    )

    if user.is_staff and profile.role != Profile.ROLE_ADMIN:
        profile.role = Profile.ROLE_ADMIN
        profile.save(update_fields=["role"])

    return profile


def serializer_error_message(serializer):
    field_labels = {
        "fullName": "Full name",
        "headline": "Headline",
        "location": "Location",
        "bio": "Bio",
        "linkedinUrl": "LinkedIn URL",
        "githubUrl": "GitHub URL",
        "portfolioUrl": "Portfolio URL",
        "companyName": "Company name",
        "companyWebsite": "Company website URL",
        "companyLocation": "Company location",
        "hiringTitle": "Hiring title",
        "adminTitle": "Admin title",
        "cvFile": "CV",
    }

    for field, errors in serializer.errors.items():
        label = field_labels.get(field, field)

        if isinstance(errors, list) and errors:
            return f"{label}: {errors[0]}"

        return f"{label}: {errors}"

    return "Invalid request"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_profile_view(request):
    profile = get_or_create_user_profile(request.user)

    serializer = ProfileSerializer(profile)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_profile_view(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    profile = get_or_create_user_profile(user)
    serializer = ProfileSerializer(profile)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def track_profile_view(request, user_id):
    if request.user.id == user_id:
        return Response({"message": "Own profile view ignored"})

    try:
        profile = Profile.objects.get(user_id=user_id)
    except Profile.DoesNotExist:
        return Response({"message": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

    ProfileView.objects.update_or_create(profile=profile, viewer=request.user)
    serializer = ProfileSerializer(profile)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def activities_list_view(request):
    profile = get_or_create_user_profile(request.user)
    activities = Activity.objects.filter(profile=profile)[:10]
    serializer = ActivitySerializer(activities, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_skills_view(request, user_id):
    try:
        profile = Profile.objects.get(user_id=user_id)
    except Profile.DoesNotExist:
        return Response([])

    skills = Skill.objects.filter(profile=profile)
    serializer = SkillSerializer(skills, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_projects_view(request, user_id):
    try:
        profile = Profile.objects.get(user_id=user_id)
    except Profile.DoesNotExist:
        return Response([])

    projects = Project.objects.filter(profile=profile)
    serializer = ProjectSerializer(projects, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_experiences_view(request, user_id):
    try:
        profile = Profile.objects.get(user_id=user_id)
    except Profile.DoesNotExist:
        return Response([])

    experiences = Experience.objects.filter(profile=profile)
    serializer = ExperienceSerializer(experiences, many=True)
    return Response(serializer.data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_my_profile_view(request):
    profile = get_or_create_user_profile(request.user)
    serializer = ProfileUpdateSerializer(
        profile,
        data=request.data,
        partial=True,
    )

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    profile = serializer.save()
    add_activity(profile, "Updated profile information")

    serializer = ProfileSerializer(profile)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def skills_list_view(request):
    profile = get_or_create_user_profile(request.user)

    skills = Skill.objects.filter(profile=profile)
    serializer = SkillSerializer(skills, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def skill_create_view(request):
    profile = get_or_create_user_profile(request.user)
    serializer = SkillSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    skill = serializer.save(profile=profile)
    add_activity(profile, f"Added skill: {skill.name}")

    serializer = SkillSerializer(skill)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def skill_delete_view(request, skill_id):
    profile = get_or_create_user_profile(request.user)

    try:
        skill = Skill.objects.get(id=skill_id, profile=profile)
    except Skill.DoesNotExist:
        return Response({"message": "Skill not found"}, status=status.HTTP_404_NOT_FOUND)

    skill_name = skill.name
    skill.delete()
    add_activity(profile, f"Removed skill: {skill_name}")
    return Response({"message": "Skill deleted"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def projects_list_view(request):
    profile = get_or_create_user_profile(request.user)

    projects = Project.objects.filter(profile=profile)
    serializer = ProjectSerializer(projects, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def project_create_view(request):
    profile = get_or_create_user_profile(request.user)
    serializer = ProjectSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    project = serializer.save(profile=profile)
    add_activity(profile, f"Added project: {project.title}")

    serializer = ProjectSerializer(project)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def project_update_view(request, project_id):
    profile = get_or_create_user_profile(request.user)

    try:
        project = Project.objects.get(id=project_id, profile=profile)
    except Project.DoesNotExist:
        return Response({"message": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = ProjectSerializer(project, data=request.data, partial=True)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    project = serializer.save()
    add_activity(profile, f"Updated project: {project.title}")

    serializer = ProjectSerializer(project)
    return Response(serializer.data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def project_delete_view(request, project_id):
    profile = get_or_create_user_profile(request.user)

    try:
        project = Project.objects.get(id=project_id, profile=profile)
    except Project.DoesNotExist:
        return Response({"message": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    project_title = project.title
    project.delete()
    add_activity(profile, f"Removed project: {project_title}")
    return Response({"message": "Project deleted"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def experiences_list_view(request):
    profile = get_or_create_user_profile(request.user)

    experiences = Experience.objects.filter(profile=profile)
    serializer = ExperienceSerializer(experiences, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def experience_create_view(request):
    profile = get_or_create_user_profile(request.user)
    serializer = ExperienceSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    experience = serializer.save(profile=profile)
    add_activity(profile, f"Added experience: {experience.title}")

    serializer = ExperienceSerializer(experience)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def experience_update_view(request, experience_id):
    profile = get_or_create_user_profile(request.user)

    try:
        experience = Experience.objects.get(id=experience_id, profile=profile)
    except Experience.DoesNotExist:
        return Response({"message": "Experience not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = ExperienceSerializer(experience, data=request.data, partial=True)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    experience = serializer.save()
    add_activity(profile, f"Updated experience: {experience.title}")

    serializer = ExperienceSerializer(experience)
    return Response(serializer.data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def experience_delete_view(request, experience_id):
    profile = get_or_create_user_profile(request.user)

    try:
        experience = Experience.objects.get(id=experience_id, profile=profile)
    except Experience.DoesNotExist:
        return Response({"message": "Experience not found"}, status=status.HTTP_404_NOT_FOUND)

    experience_title = experience.title
    experience.delete()
    add_activity(profile, f"Removed experience: {experience_title}")
    return Response({"message": "Experience deleted"})
