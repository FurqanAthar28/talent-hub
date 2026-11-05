"""
GET /api/health/  ->  {"status": "ok"}  (or 503 if the database is down)

Hosting services (Render, Railway, a load balancer, an uptime monitor) call
this every few seconds to ask "is the app alive?". It also checks that the
database answers, because the app is useless without it.

It is public and needs no login, and it returns nothing private.
"""

import logging

from django.db import DatabaseError, connection
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["GET"])
@authentication_classes([])  # no cookies, no CSRF: just a quick check
@permission_classes([AllowAny])
def health_view(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        logger.exception("Health check: the database did not answer")
        return Response({"status": "database unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response({"status": "ok"})
