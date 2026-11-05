"""
Rate limits ("throttles") for the login and one-time-code endpoints.

WHY WE COUNT BY EMAIL (and not by IP address)
---------------------------------------------
The browser never talks to Django directly. Every request goes through the
Next.js proxy first, so Django sees the SAME IP address (the proxy's) for
every visitor. Counting by IP would block everyone at once.

So we count tries per EMAIL address instead. This stops someone from
guessing the password or the 6-digit code of one account over and over.

The allowed speed (for example "10/min") is set in settings.py under
REST_FRAMEWORK -> DEFAULT_THROTTLE_RATES -> "auth_email".
"""

from rest_framework.throttling import SimpleRateThrottle


class EmailRateThrottle(SimpleRateThrottle):
    # This name must match the key in DEFAULT_THROTTLE_RATES.
    scope = "auth_email"

    def get_cache_key(self, request, view):
        # Read the email the user typed (it is in the request body).
        email = str(request.data.get("email", "")).strip().lower()

        # No email -> nothing to count. The view will reply "invalid request".
        if not email:
            return None

        # Each email gets its own counter on each page, for example
        # "/api/accounts/signin/:ali@x.com". Adding the page address means
        # 10 login tries don't use up the 10 tries for "send me a code".
        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{request.path}:{email}",
        }
