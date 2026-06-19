from django.urls import path

from .views import (
    users_list_view,
    send_connection_request_view,
    pending_requests_view,
    sent_requests_view,
    accept_request_view,
    reject_request_view,
    my_connections_view,
)


urlpatterns = [
    path("users/", users_list_view),
    path("send/", send_connection_request_view),
    path("pending/", pending_requests_view),
    path("sent/", sent_requests_view),
    path("accept/", accept_request_view),
    path("reject/", reject_request_view),
    path("my-connections/", my_connections_view),
]