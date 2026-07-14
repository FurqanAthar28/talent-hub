from django.urls import path

from .views import recruiter_candidate_detail, recruiter_candidates

urlpatterns = [
    path("candidates/", recruiter_candidates, name="recruiter-candidates"),
    path(
        "candidates/<int:candidate_id>/",
        recruiter_candidate_detail,
        name="recruiter-candidate-detail",
    ),
]