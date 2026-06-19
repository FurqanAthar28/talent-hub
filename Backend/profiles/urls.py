from django.urls import path
from .views import (
    my_profile_view,
    activities_list_view,
    track_profile_view,
    user_profile_view,
    user_skills_view,
    user_projects_view,
    user_experiences_view,
    update_my_profile_view,
    skills_list_view,
    skill_create_view,
    skill_delete_view,
    projects_list_view,
    project_create_view,
    project_update_view,
    project_delete_view,
    experiences_list_view,
    experience_create_view,
    experience_update_view,
    experience_delete_view,
)

urlpatterns = [
    path("me/", my_profile_view),
    path("activities/", activities_list_view),
    path("<int:user_id>/view/", track_profile_view),
    path("<int:user_id>/", user_profile_view),
    path("<int:user_id>/skills/", user_skills_view),
    path("<int:user_id>/projects/", user_projects_view),
    path("<int:user_id>/experiences/", user_experiences_view),
    path("me/update/", update_my_profile_view),

    path("skills/", skills_list_view),
    path("skills/add/", skill_create_view),
    path("skills/<int:skill_id>/delete/", skill_delete_view),

    path("projects/", projects_list_view),
    path("projects/add/", project_create_view),
    path("projects/<int:project_id>/update/", project_update_view),
    path("projects/<int:project_id>/delete/", project_delete_view),

    path("experiences/", experiences_list_view),
    path("experiences/add/", experience_create_view),
    path("experiences/<int:experience_id>/update/", experience_update_view),
    path("experiences/<int:experience_id>/delete/", experience_delete_view),
]
