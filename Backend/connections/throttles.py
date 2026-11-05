"""
Rate limits for the network: stop one account from spamming people.

Each LOGGED-IN user has their own counter (UserRateThrottle counts by user
id), so one spammer never slows anyone else down. The speeds are set in
settings.py under REST_FRAMEWORK -> DEFAULT_THROTTLE_RATES, and can be
changed in .env (CONNECTION_REQUEST_THROTTLE_RATE, MESSAGE_THROTTLE_RATE).

When someone goes over the limit, Django answers 429 "Too many requests"
and config/exception_handler.py turns that into a friendly "message".
"""

from rest_framework.throttling import UserRateThrottle


class SendingOnlyThrottle(UserRateThrottle):
    """Count only POST (sending). Reading a chat or a list is never limited."""

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)


class ConnectionRequestThrottle(SendingOnlyThrottle):
    scope = "connection_request"


class MessageThrottle(SendingOnlyThrottle):
    """New messages AND new chats share one counter."""

    scope = "message"
