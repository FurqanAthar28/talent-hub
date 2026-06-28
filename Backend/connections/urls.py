from django.urls import path

from .views import (
    admin_connect_users_view,
    admin_connections_view,
    admin_disconnect_users_view,
    users_list_view,
    send_connection_request_view,
    pending_requests_view,
    sent_requests_view,
    accept_request_view,
    conversations_list_view,
    conversation_messages_view,
    reject_request_view,
    my_connections_view,
    start_conversation_view,
)


urlpatterns = [
    path("users/", users_list_view),
    path("send/", send_connection_request_view),
    path("pending/", pending_requests_view),
    path("sent/", sent_requests_view),
    path("accept/", accept_request_view),
    path("reject/", reject_request_view),
    path("my-connections/", my_connections_view),
    path("conversations/", conversations_list_view),
    path("conversations/start/", start_conversation_view),
    path("conversations/<int:conversation_id>/messages/", conversation_messages_view),
    path("admin/connections/", admin_connections_view),
    path("admin/connect/", admin_connect_users_view),
    path("admin/disconnect/", admin_disconnect_users_view),
]
