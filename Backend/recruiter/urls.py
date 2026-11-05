"""
Web addresses for recruiter tools.

config/urls.py adds "api/recruiter/" in front of each one,
so "candidates/" becomes "/api/recruiter/candidates/".
"""

from django.urls import path

from . import views

app_name = "recruiter"

urlpatterns = [
    path("summary/", views.recruiter_summary, name="summary"),
    path("candidates/", views.recruiter_candidates, name="candidates"),
    path("candidates/<int:candidate_id>/", views.recruiter_candidate_detail, name="candidate-detail"),
]
