"""
Web addresses for the profiles app.

config/urls.py adds "api/profiles/" in front of each one,
so "me/" below becomes "/api/profiles/me/".

"me/..."              -> things about the logged-in user
"<int:user_id>/..."   -> things about another user (read only)
"""

from django.urls import path

from . import views

app_name = "profiles"

urlpatterns = [
    # --- My profile ---
    path("me/", views.my_profile_view, name="my-profile"),
    path("me/update/", views.update_my_profile_view, name="update-my-profile"),
    path("activities/", views.activities_list_view, name="activities"),
    # --- My skills ---
    path("skills/", views.skills_list_view, name="skills"),
    path("skills/options/", views.skill_options, name="skill-options"),
    path("skills/add/", views.skill_create_view, name="skill-create"),
    path("skills/<int:skill_id>/delete/", views.skill_delete_view, name="skill-delete"),
    # --- My projects ---
    path("projects/", views.projects_list_view, name="projects"),
    path("projects/add/", views.project_create_view, name="project-create"),
    path(
        "projects/<int:project_id>/update/",
        views.project_update_view,
        name="project-update",
    ),
    path(
        "projects/<int:project_id>/delete/",
        views.project_delete_view,
        name="project-delete",
    ),
    # --- My experience ---
    path("experiences/", views.experiences_list_view, name="experiences"),
    path("experiences/add/", views.experience_create_view, name="experience-create"),
    path(
        "experiences/<int:experience_id>/update/",
        views.experience_update_view,
        name="experience-update",
    ),
    path(
        "experiences/<int:experience_id>/delete/",
        views.experience_delete_view,
        name="experience-delete",
    ),
    # --- Other users ---
    path("<int:user_id>/", views.user_profile_view, name="user-profile"),
    path("<int:user_id>/cv/", views.cv_download_view, name="user-cv"),
    path("<int:user_id>/view/", views.track_profile_view, name="track-view"),
    path("<int:user_id>/skills/", views.user_skills_view, name="user-skills"),
    path("<int:user_id>/projects/", views.user_projects_view, name="user-projects"),
    path(
        "<int:user_id>/experiences/",
        views.user_experiences_view,
        name="user-experiences",
    ),
]
