from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers


def normalize_url(value):
    url = value.strip()

    if not url:
        return ""

    if "://" not in url:
        url = f"https://{url}"

    try:
        URLValidator(schemes=["http", "https"])(url)
    except DjangoValidationError:
        raise serializers.ValidationError("Enter a valid URL.") from None

    return url
