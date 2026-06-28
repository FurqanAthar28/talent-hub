from django.urls import path
from .views import ui_content_view

urlpatterns = [
    path("ui-content/", ui_content_view),
]