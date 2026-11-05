"""
The public "UI texts" endpoint: GET /api/app-config/ui-content/

The frontend loads every editable text once, as one simple object:
    {"appName": "ProfessionalHub", "signin": "Sign in", ...}

It is public on purpose: the sign-in page needs its texts BEFORE anyone
is logged in. (Admins change the texts through /api/admin/ui-content/.)
"""

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import UiContent


@api_view(["GET"])
@authentication_classes([])  # ignore login cookies: works for everyone
@permission_classes([AllowAny])
def ui_content_view(request):
    # values_list gives plain (key, value) pairs, which is all we need.
    texts = dict(UiContent.objects.values_list("key", "value"))
    return Response(texts)
