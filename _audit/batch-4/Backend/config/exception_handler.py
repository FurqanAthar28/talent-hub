"""
Make every API error look the same.

Our own views answer errors like this:     {"message": "Sign in failed"}
But DRF's built-in errors look different:
    {"detail": "Request was throttled."}         (rate limit, CSRF, login...)
    {"email": ["Email already exists"]}          (a serializer error)

The frontend shows `data.message`, so this small function adds a
"message" to every error that doesn't already have one.
The original fields stay too, so nothing that reads them breaks.

It is switched on in settings.py: REST_FRAMEWORK -> "EXCEPTION_HANDLER".
"""

from rest_framework.views import exception_handler


def first_error_text(data):
    """
    Find the first error sentence inside DRF's error data.
    {"email": ["Email already exists"]} -> "Email already exists"
    """
    first_value = next(iter(data.values()), None)

    if isinstance(first_value, list) and first_value:
        first_value = first_value[0]

    return str(first_value) if first_value else ""


def api_exception_handler(exc, context):
    # Let DRF build its normal error response first.
    response = exception_handler(exc, context)

    # response is None for crashes DRF doesn't know about (real bugs).
    # Django then shows its normal 500 error, and the error is logged.
    if response is None:
        return None

    data = response.data

    if not isinstance(data, dict) or "message" in data:
        return response

    if "detail" in data:
        data["message"] = str(data["detail"])
    else:
        data["message"] = first_error_text(data) or "Invalid request"

    return response
