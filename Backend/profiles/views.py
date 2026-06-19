from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User

from .models import Activity, Profile, ProfileView, Skill, Project, Experience
from .serializers import (
    ActivitySerializer,
    ProfileSerializer,
    SkillSerializer,
    ProjectSerializer,
    ExperienceSerializer,
)


def parse_boolean(value):
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.lower() in ["true", "1", "yes", "on"]

    return False


def validate_cv_file(cv_file):
    if cv_file.content_type != "application/pdf":
        return "Only PDF files are accepted"

    max_size = 5 * 1024 * 1024

    if cv_file.size > max_size:
        return "CV file must be less than 5MB"

    return ""


def add_activity(profile, title):
    Activity.objects.create(profile=profile, title=title)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_profile_view(request):
    profile, created = Profile.objects.get_or_create(user=request.user)

    serializer = ProfileSerializer(profile)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_profile_view(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    profile, created = Profile.objects.get_or_create(user=user)
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
    profile, created = Profile.objects.get_or_create(user=request.user)
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
    user = request.user
    profile, created = Profile.objects.get_or_create(user=user)

    full_name = request.data.get("fullName")

    if full_name is not None:
        full_name = full_name.strip()

        if full_name:
            name_parts = full_name.split(" ", 1)
            user.first_name = name_parts[0]
            user.last_name = name_parts[1] if len(name_parts) > 1 else ""
            user.save()

    profile.headline = request.data.get("headline", profile.headline)
    profile.location = request.data.get("location", profile.location)
    profile.bio = request.data.get("bio", profile.bio)
    profile.linkedin_url = request.data.get("linkedinUrl", profile.linkedin_url)
    profile.github_url = request.data.get("githubUrl", profile.github_url)
    profile.portfolio_url = request.data.get("portfolioUrl", profile.portfolio_url)

    if "openToWork" in request.data:
        profile.open_to_work = parse_boolean(request.data.get("openToWork"))

    cv_file = request.FILES.get("cvFile")

    if cv_file:
        cv_error = validate_cv_file(cv_file)

        if cv_error:
            return Response(
                {"message": cv_error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.cv_file = cv_file

    profile.save()
    add_activity(profile, "Updated profile information")

    serializer = ProfileSerializer(profile)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def skills_list_view(request):
    profile, created = Profile.objects.get_or_create(user=request.user)

    skills = Skill.objects.filter(profile=profile)
    serializer = SkillSerializer(skills, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def skill_create_view(request):
    name = request.data.get("name")

    if not name:
        return Response(
            {"message": "Skill name is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    profile, created = Profile.objects.get_or_create(user=request.user)

    skill = Skill.objects.create(profile=profile, name=name)
    add_activity(profile, f"Added skill: {skill.name}")

    serializer = SkillSerializer(skill)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def skill_delete_view(request, skill_id):
    profile, created = Profile.objects.get_or_create(user=request.user)

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
    profile, created = Profile.objects.get_or_create(user=request.user)

    projects = Project.objects.filter(profile=profile)
    serializer = ProjectSerializer(projects, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def project_create_view(request):
    profile, created = Profile.objects.get_or_create(user=request.user)

    project = Project.objects.create(
        profile=profile,
        title=request.data.get("title", ""),
        description=request.data.get("description", ""),
        tech_stack=request.data.get("tech_stack", []),
        github_url=request.data.get("github_url", ""),
    )
    add_activity(profile, f"Added project: {project.title}")

    serializer = ProjectSerializer(project)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def project_update_view(request, project_id):
    profile, created = Profile.objects.get_or_create(user=request.user)

    try:
        project = Project.objects.get(id=project_id, profile=profile)
    except Project.DoesNotExist:
        return Response({"message": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    project.title = request.data.get("title", project.title)
    project.description = request.data.get("description", project.description)
    project.tech_stack = request.data.get("tech_stack", project.tech_stack)
    project.github_url = request.data.get("github_url", project.github_url)

    project.save()
    add_activity(profile, f"Updated project: {project.title}")

    serializer = ProjectSerializer(project)
    return Response(serializer.data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def project_delete_view(request, project_id):
    profile, created = Profile.objects.get_or_create(user=request.user)

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
    profile, created = Profile.objects.get_or_create(user=request.user)

    experiences = Experience.objects.filter(profile=profile)
    serializer = ExperienceSerializer(experiences, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def experience_create_view(request):
    profile, created = Profile.objects.get_or_create(user=request.user)

    experience = Experience.objects.create(
        profile=profile,
        title=request.data.get("title", ""),
        company=request.data.get("company", ""),
        location=request.data.get("location", ""),
        start_date=request.data.get("start_date", ""),
        end_date=request.data.get("end_date", ""),
        current=request.data.get("current", False),
        description=request.data.get("description", ""),
    )
    add_activity(profile, f"Added experience: {experience.title}")

    serializer = ExperienceSerializer(experience)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def experience_update_view(request, experience_id):
    profile, created = Profile.objects.get_or_create(user=request.user)

    try:
        experience = Experience.objects.get(id=experience_id, profile=profile)
    except Experience.DoesNotExist:
        return Response({"message": "Experience not found"}, status=status.HTTP_404_NOT_FOUND)

    experience.title = request.data.get("title", experience.title)
    experience.company = request.data.get("company", experience.company)
    experience.location = request.data.get("location", experience.location)
    experience.start_date = request.data.get("start_date", experience.start_date)
    experience.end_date = request.data.get("end_date", experience.end_date)
    experience.current = request.data.get("current", experience.current)
    experience.description = request.data.get("description", experience.description)

    experience.save()
    add_activity(profile, f"Updated experience: {experience.title}")

    serializer = ExperienceSerializer(experience)
    return Response(serializer.data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def experience_delete_view(request, experience_id):
    profile, created = Profile.objects.get_or_create(user=request.user)

    try:
        experience = Experience.objects.get(id=experience_id, profile=profile)
    except Experience.DoesNotExist:
        return Response({"message": "Experience not found"}, status=status.HTTP_404_NOT_FOUND)

    experience_title = experience.title
    experience.delete()
    add_activity(profile, f"Removed experience: {experience_title}")
    return Response({"message": "Experience deleted"})
