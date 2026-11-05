"""
config/urls.py adds "api/app-config/" in front,
so "ui-content/" becomes "/api/app-config/ui-content/".
"""

from django.urls import path

from . import views

app_name = "app_config"

urlpatterns = [
    path("ui-content/", views.ui_content_view, name="ui-content"),
]
