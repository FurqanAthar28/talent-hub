"""
Make every API error look the same.

Our own views answer errors like this:     {"message": "Sign in failed"}
But DRF's built-in errors look like this:  {"detail": "Request was throttled."}

The frontend shows `data.message`, so DRF's errors (too many tries,
CSRF failed, not logged in...) would show up as a blank or generic message.
This small function copies "detail" into "message" so the frontend
always finds the text in the same place.

It is switched on in settings.py: REST_FRAMEWORK -> "EXCEPTION_HANDLER".
"""

from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    # Let DRF build its normal error response first.
    response = exception_handler(exc, context)

    # response is None for crashes DRF doesn't know about (real bugs).
    # Django then shows its normal 500 error, and the error is logged.
    if response is None:
        return None

    data = response.data

    if isinstance(data, dict) and "detail" in data and "message" not in data:
        data["message"] = str(data["detail"])

    return response
