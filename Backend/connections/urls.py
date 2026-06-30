from django.urls import path

from .views import (
    users_list_view,
    send_connection_request_view,
    pending_requests_view,
    sent_requests_view,
    accept_request_view,
    reject_request_view,
    my_connections_view,
    conversations_list_view,
    start_conversation_view,
    conversation_messages_view,
)

from .admin_views import (
    admin_connections_view,
    admin_connect_users_view,
    admin_disconnect_users_view,
    admin_conversations_view,
    admin_conversation_detail_view,
)


urlpatterns = [
    # User APIs
    path("users/", users_list_view),
    path("send/", send_connection_request_view),
    path("pending/", pending_requests_view),
    path("sent/", sent_requests_view),
    path("accept/", accept_request_view),
    path("reject/", reject_request_view),
    path("my-connections/", my_connections_view),

    # Messaging APIs
    path("conversations/", conversations_list_view),
    path("conversations/start/", start_conversation_view),
    path(
        "conversations/<int:conversation_id>/messages/",
        conversation_messages_view,
    ),

    # Admin APIs
    path("admin/connections/", admin_connections_view),
    path("admin/connect/", admin_connect_users_view),
    path("admin/disconnect/", admin_disconnect_users_view),

    # Admin Messaging APIs
    path("admin/conversations/", admin_conversations_view),
    path(
        "admin/conversations/<int:conversation_id>/",
        admin_conversation_detail_view,
    ),
]