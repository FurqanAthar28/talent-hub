"""
Login check that runs on every API request.

HOW IT WORKS (simple version)
-----------------------------
1. The browser automatically sends the "access_token" cookie with each request.
   (JavaScript can't read this cookie because it is httpOnly. Only Django can.)
2. We read that cookie.
3. We check the token is real and not expired, and we find the user.
4. Because the browser sends cookies AUTOMATICALLY, a bad website could
   trick it into sending them too. So for requests that CHANGE data
   (POST, PUT, PATCH, DELETE) we also check the CSRF token.

If anything is wrong with the token, we treat the visitor as "not logged in".
Protected endpoints then answer 401, and the frontend knows to refresh
the token or send the user to the login page.
"""

from django.conf import settings
from django.http import HttpResponse
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """Reads the JWT from an httpOnly cookie instead of the Authorization header."""

    def authenticate(self, request):
        # Step 1 + 2: read the raw (not yet checked) token from the cookie.
        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)

        # No cookie, or an empty one -> visitor is "not logged in".
        # We return None (not an error) so public pages like login still work.
        if not raw_token:
            return None

        # Step 3: check the token and find the user it belongs to.
        try:
            # SimpleJWT expects bytes, so we encode the text first.
            validated_token = self.get_validated_token(raw_token.encode())
            user = self.get_user(validated_token)
        except exceptions.AuthenticationFailed:
            # The token is expired, fake, or the user was deleted/disabled.
            # Don't block the request here. Just treat them as "not logged in".
            # (This also catches SimpleJWT's InvalidToken, which is a kind
            # of AuthenticationFailed.)
            return None

        # Step 4: the user IS logged in by cookie, so protect against CSRF.
        self.enforce_csrf(request)

        return user, validated_token

    def enforce_csrf(self, request):
        """
        Run Django's normal CSRF check on this request.

        Django skips the check by itself for "safe" requests (GET, HEAD,
        OPTIONS), so only requests that change data are checked.
        This is the same approach DRF's own SessionAuthentication uses.
        """

        # Django's CSRF checker is middleware, and middleware needs a
        # "next step" function. We don't need one, so we give it a
        # do-nothing function that returns an empty response.
        def do_nothing(request):
            return HttpResponse()

        check = CSRFCheck(do_nothing)

        # Read the CSRF cookie from the request.
        check.process_request(request)

        # Compare the CSRF cookie with the X-CSRFToken header.
        # If they don't match, `reason` explains why. If all is fine, it is None.
        # (We pass do_nothing as the "view", because there is no real view here.)
        reason = check.process_view(request, do_nothing, (), {})

        if reason:
            # 403 Forbidden: "you are logged in, but this request looks forged".
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")