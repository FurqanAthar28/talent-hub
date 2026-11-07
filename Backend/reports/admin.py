from django.contrib import admin

from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "reason", "reported_user", "reporter", "status", "created_at")
    list_filter = ("status", "kind", "reason")
    search_fields = ("reported_user__email", "reporter__email", "details")
