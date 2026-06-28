from rest_framework import serializers
from .models import UiContent


class UiContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = UiContent
        fields = ["key", "value"]