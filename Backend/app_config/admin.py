from django.contrib import admin

from .models import UiContent


@admin.register(UiContent)
class UiContentAdmin(admin.ModelAdmin):
    list_display = ("key", "value")
    search_fields = ("key", "value")