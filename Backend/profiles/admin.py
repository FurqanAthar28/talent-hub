"""
Show profile tables in the Django admin site (/admin/).

list_display = the columns in the list page.
search_fields = what the search box looks in.
"""

from django.contrib import admin

from .models import Activity, Experience, Profile, ProfileView, Project, Skill


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "headline", "recruiter_verification_status")
    list_filter = ("role", "recruiter_verification_status", "open_to_work")
    search_fields = ("user__email", "user__first_name", "user__last_name", "headline")
    list_select_related = ("user",)  # load users in the same query (faster)


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ("name", "profile")
    search_fields = ("name",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "profile")
    search_fields = ("title",)


@admin.register(Experience)
class ExperienceAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "profile", "current")
    search_fields = ("title", "company")


admin.site.register(Activity)
admin.site.register(ProfileView)
