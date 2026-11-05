"""
Web addresses for the connections app.

config/urls.py adds "api/connections/" in front of each one,
so "users/" below becomes "/api/connections/users/".
"""

from django.urls import path

from . import views

app_name = "connections"

urlpatterns = [
    # --- People and requests ---
    path("users/", views.users_list_view, name="users"),
    path("my-connections/", views.my_connections_view, name="my-connections"),
    path("send/", views.send_connection_request_view, name="send-request"),
    path("pending/", views.pending_requests_view, name="pending-requests"),
    path("sent/", views.sent_requests_view, name="sent-requests"),
    path("accept/", views.accept_request_view, name="accept-request"),
    path("reject/", views.reject_request_view, name="reject-request"),
    # --- Messages ---
    path("conversations/", views.conversations_list_view, name="conversations"),
    path("conversations/start/", views.start_conversation_view, name="start-conversation"),
    path(
        "conversations/<int:conversation_id>/messages/",
        views.conversation_messages_view,
        name="conversation-messages",
    ),
]
