"""
Web addresses for job posts. config/urls.py adds "api/jobs/" in front.
The admin's job tools live under "/api/admin/jobs/" (admin_panel/urls.py).
"""

from django.urls import path

from . import views

app_name = "jobs"

urlpatterns = [
    path("", views.jobs_view, name="list"),
    path("mine/", views.my_jobs_view, name="mine"),
    path("<int:job_id>/", views.job_detail_view, name="detail"),
]
