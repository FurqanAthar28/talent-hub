"""
Rate limits ("throttles") for the login and one-time-code endpoints.

WHY WE COUNT BY EMAIL (and not by IP address)
---------------------------------------------
The browser never talks to Django directly. Every request goes through the
Next.js proxy first, so Django sees the SAME IP address (the proxy's) for
every visitor. Counting by IP would block everyone at once.

So we count tries per EMAIL address instead. This stops someone from
guessing the password or the 6-digit code of one account over and over.

The allowed speeds (for example "10/min") are set in settings.py under
REST_FRAMEWORK -> DEFAULT_THROTTLE_RATES ("auth_email", "signup", "delete_account").
"""

from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class EmailRateThrottle(SimpleRateThrottle):
    # This name must match the key in DEFAULT_THROTTLE_RATES.
    scope = "auth_email"

    def get_cache_key(self, request, view):
        # Read the email the user typed (it is in the request body).
        # request.data is usually a dict, but a client could send a JSON list.
        data = request.data if isinstance(request.data, dict) else {}
        email = str(data.get("email", "")).strip().lower()

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


class SignupRateThrottle(SimpleRateThrottle):
    """
    A limit on sign-ups for the WHOLE site (all visitors together),
    for example 30 per hour (settings: "signup").

    Why the whole site and not per person? Behind our Next.js proxy every
    visitor looks like the same address, and a new fake account uses a new
    email each time, so there is nothing per-person to count.
    The trade-off: during an attack, real people may have to wait a bit.
    """

    scope = "signup"

    def get_cache_key(self, request, view):
        # The same key for everyone = one shared counter.
        return self.cache_format % {"scope": self.scope, "ident": "all-visitors"}


class DeleteAccountRateThrottle(UserRateThrottle):
    """
    Limits "Delete my account" tries for each LOGGED-IN user
    (UserRateThrottle counts by user id), so nobody with a stolen session
    can keep guessing the password there.
    """

    scope = "delete_account"
