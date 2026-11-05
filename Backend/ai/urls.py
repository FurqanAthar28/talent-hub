"""
Web addresses for the AI app.

config/urls.py adds "api/ai/" in front of each one,
so "headline-bio/" below becomes "/api/ai/headline-bio/".
"""

from django.urls import path

from . import views

app_name = "ai"

urlpatterns = [
    path("headline-bio/", views.headline_bio_view, name="headline-bio"),
]
