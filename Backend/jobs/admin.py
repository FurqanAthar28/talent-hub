from django.contrib import admin

from .models import Job


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "recruiter", "status", "hidden_by_admin", "created_at")
    list_filter = ("status", "hidden_by_admin", "employment_type", "work_style")
    search_fields = ("title", "recruiter__email", "description")
