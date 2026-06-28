from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import UiContent


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def ui_content_view(request):
    items = UiContent.objects.all()

    return Response({
        item.key: item.value
        for item in items
    })
