"""
Account API: sign up, sign in, stay signed in, sign out, and one-time codes.

WHAT'S IN THIS FILE (read top to bottom)
----------------------------------------
1. Small helpers       -> tiny functions the views below reuse
2. Login cookies       -> put the JWT tokens in (or take them out of) cookies
3. One-time codes      -> make, check, and email 6-digit codes (OTP)
4. Login views         -> signin, refresh, logout, me, csrf
5. Sign-up views       -> signup, email verification
6. Password reset      -> request a code, then set a new password

Every view answers with JSON like {"message": "..."} so the frontend
can always show `data.message` to the user.

The admin endpoints that used to live here were exact copies of the ones
in the admin_panel app (which the admin page really uses), so they were
removed. One place for each thing = fewer bugs.
"""

import logging
import secrets
from datetime import timedelta
from smtplib import SMTPException

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import send_mail
from django.db import transaction
from django.middleware.csrf import get_token, rotate_token
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from app_config.models import UiContent
from profiles.models import Profile

from .models import EmailVerificationOTP, PasswordResetOTP
from .serializers import (
    EmailVerificationConfirmSerializer,
    EmailVerificationRequestSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    SigninSerializer,
    SignupSerializer,
)
from .throttles import EmailRateThrottle

User = get_user_model()
logger = logging.getLogger(__name__)


# =============================================================================
# 1. SMALL HELPERS
# =============================================================================


def ui_content_value(key, default=None):
    """
    Read a text message from the UiContent table (admins can edit these).

    If the key is missing and we gave a `default`, use the default.
    If there is no default either, stop with a clear error so we notice.
    """
    try:
        return UiContent.objects.get(key=key).value
    except UiContent.DoesNotExist as exc:
        if default is not None:
            return default
        raise ImproperlyConfigured(f"Missing backend UI content: {key}") from exc


def message_response(key, status_code, default=None):
    """Shortcut for the most common reply: {"message": <text>} + a status code."""
    return Response(
        {"message": ui_content_value(key, default)},
        status=status_code,
    )


# Friendly names for form fields, used in error messages ("Email: ...").
FIELD_LABELS = {
    "fullName": "Full name",
    "email": "Email",
    "password": "Password",
    "role": "Role",
    "linkedinUrl": "LinkedIn URL",
    "companyName": "Company name",
    "companyWebsite": "Company website URL",
    "companyLocation": "Company location",
    "hiringTitle": "Hiring title",
    "cvFile": "CV",
    "otp": "OTP",
}


def first_error_message(serializer):
    """
    Turn a serializer's errors into ONE short sentence for the user.

    Example: {"email": ["Enter a valid email address."]}
          -> "Email: Enter a valid email address."
    """
    for field, problems in serializer.errors.items():
        label = FIELD_LABELS.get(field, field)

        # Errors usually come as a list. Take the first one.
        if isinstance(problems, list) and problems:
            return f"{label}: {problems[0]}"

        # Sometimes they come as a dict (nested fields). Take the first value.
        if isinstance(problems, dict) and problems:
            first_problem = next(iter(problems.values()))
            if isinstance(first_problem, list) and first_problem:
                first_problem = first_problem[0]
            return f"{label}: {first_problem}"

    return "Invalid request"


def find_user_by_email(email):
    """
    Find a user by email, ignoring upper/lower case.
    Returns None (instead of crashing) if nobody has that email.
    """
    return User.objects.filter(email__iexact=email).first()


def get_user_profile(user):
    """Return the user's profile, or None if they don't have one."""
    try:
        return user.profile
    except Profile.DoesNotExist:
        return None


def get_user_role(user):
    """Staff users are always "admin". Everyone else uses their profile role."""
    if user.is_staff:
        return Profile.ROLE_ADMIN

    profile = get_user_profile(user)
    return profile.role if profile else Profile.ROLE_CANDIDATE


def user_summary(user):
    """The small bit of user info we send back after signin / signup."""
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "fullName": user.get_full_name(),
    }


# =============================================================================
# 2. LOGIN COOKIES
# =============================================================================


def set_auth_cookies(response, access_token, refresh_token):
    """
    Save both login tokens in httpOnly cookies.

    httponly=True means JavaScript can never read them, so a bad script
    on the page can't steal them. Only the server sees them.
    """
    cookie_options = {
        "httponly": True,
        "secure": settings.JWT_COOKIE_SECURE,
        "samesite": settings.JWT_COOKIE_SAMESITE,
        "path": "/",
    }

    # Short-lived "access" token: proves who you are on every request.
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE,
        access_token,
        max_age=settings.JWT_ACCESS_COOKIE_MAX_AGE_SECONDS,
        **cookie_options,
    )

    # Long-lived "refresh" token: used ONLY to get a new access token.
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE,
        refresh_token,
        max_age=settings.JWT_REFRESH_COOKIE_MAX_AGE_SECONDS,
        **cookie_options,
    )


def clear_auth_cookies(response):
    """Delete both login cookies (used for logout and expired sessions)."""
    for cookie_name in (settings.JWT_ACCESS_COOKIE, settings.JWT_REFRESH_COOKIE):
        response.delete_cookie(
            cookie_name,
            path="/",
            samesite=settings.JWT_COOKIE_SAMESITE,
        )


def log_out_everywhere(user):
    """
    Make ALL of this user's refresh tokens useless (every browser, every device).
    We do this after a password reset: if someone stole the old login,
    they get kicked out too.
    """
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


# =============================================================================
# 3. ONE-TIME CODES (OTP)
# =============================================================================
# Password reset and email verification work the SAME way, so they share
# these helpers. We pass in which table (model) and which settings to use.


def generate_otp():
    """A random 6-digit code like "042917". `secrets` is safe for passwords."""
    return f"{secrets.randbelow(1_000_000):06d}"


def email_service_is_configured():
    """
    Can we send emails right now?

    On your laptop we use the "console" backend, which just prints emails
    in the terminal, so no mail server settings are needed.
    """
    smtp_backend = "django.core.mail.backends.smtp.EmailBackend"

    if settings.EMAIL_BACKEND != smtp_backend:
        return True

    return all(
        [
            settings.EMAIL_HOST,
            settings.EMAIL_HOST_USER,
            settings.EMAIL_HOST_PASSWORD,
            settings.DEFAULT_FROM_EMAIL,
        ]
    )


def get_active_otp(otp_model, user, lock=False):
    """
    Get the user's newest code that hasn't been used yet (or None).

    lock=True tells the database "nobody else may change this row until
    I'm done". This stops two requests at the same moment from both
    sneaking past the "max attempts" limit.
    """
    codes = otp_model.objects.filter(user=user, used_at__isnull=True)

    if lock:
        codes = codes.select_for_update()

    return codes.first()


def is_in_cooldown(otp_model, user, cooldown_seconds):
    """True if we sent a code too recently and the user must wait."""
    active_otp = get_active_otp(otp_model, user)

    if active_otp is None:
        return False

    cooldown_ends_at = active_otp.created_at + timedelta(seconds=cooldown_seconds)
    return timezone.now() < cooldown_ends_at


def mark_otp_used(otp_record):
    """A used code can never work again."""
    otp_record.used_at = timezone.now()
    otp_record.save(update_fields=["used_at"])


def create_otp(otp_model, user, expiry_minutes):
    """
    Make a new code and save it. Any older unused codes stop working.

    We only save a HASH of the code (like a fingerprint), never the code
    itself, so someone reading the database can't see it.

    Returns (the plain code to email, the saved database row).
    """
    otp_model.objects.filter(user=user, used_at__isnull=True).update(
        used_at=timezone.now()
    )

    code = generate_otp()
    otp_record = otp_model.objects.create(
        user=user,
        otp_hash=otp_model.hash_otp(code),
        expires_at=timezone.now() + timedelta(minutes=expiry_minutes),
    )
    return code, otp_record


def check_otp(otp_record, code, max_attempts):
    """
    Check a code the user typed. Returns one of three words:
        "ok"        -> correct code
        "wrong"     -> wrong (or expired) code, they can try again
        "too_many"  -> too many wrong tries, this code is now locked
    """
    if otp_record.attempts >= max_attempts:
        mark_otp_used(otp_record)
        return "too_many"

    if otp_record.is_valid_for(code):
        return "ok"

    # Wrong code: count the failed try.
    otp_record.attempts += 1

    if otp_record.attempts >= max_attempts:
        otp_record.used_at = timezone.now()
        otp_record.save(update_fields=["attempts", "used_at"])
        return "too_many"

    otp_record.save(update_fields=["attempts"])
    return "wrong"


def send_otp_email(user, code, subject_key, body_key, expiry_minutes):
    """
    Email the code. Returns True if it was sent, False if sending failed.
    The email text comes from UiContent, so admins can change the wording.
    """
    try:
        send_mail(
            subject=ui_content_value(subject_key),
            message=ui_content_value(body_key).format(
                otp=code,
                minutes=expiry_minutes,
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except (OSError, SMTPException):
        # Write the full error to the server logs, but don't show it to the user.
        logger.exception("Failed to send %s email", subject_key)
        return False

    return True


def start_email_verification(user):
    """
    Create and email a verification code.
    Returns None if all went well, or an error Response to send back.
    """
    if not email_service_is_configured():
        return message_response(
            "passwordResetEmailUnavailable", status.HTTP_503_SERVICE_UNAVAILABLE
        )

    if is_in_cooldown(
        EmailVerificationOTP, user, settings.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
    ):
        return message_response(
            "emailVerificationCooldown", status.HTTP_429_TOO_MANY_REQUESTS
        )

    expiry_minutes = settings.EMAIL_VERIFICATION_OTP_EXPIRY_MINUTES
    code, otp_record = create_otp(EmailVerificationOTP, user, expiry_minutes)

    email_sent = send_otp_email(
        user,
        code,
        subject_key="emailVerificationSubject",
        body_key="emailVerificationBody",
        expiry_minutes=expiry_minutes,
    )

    if not email_sent:
        # The user never got this code, so switch it off.
        mark_otp_used(otp_record)
        return message_response(
            "passwordResetEmailUnavailable", status.HTTP_503_SERVICE_UNAVAILABLE
        )

    return None


# =============================================================================
# 4. LOGIN VIEWS
# =============================================================================
# authentication_classes([]) = "don't look at login cookies for this view".
# Public pages need this so an old, broken cookie can never block them.


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([EmailRateThrottle])
def signin_view(request):
    """Check email + password. If correct, give the browser its login cookies."""
    serializer = SigninSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": first_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]

    # Step 1: check the password FIRST.
    # If we said "account not verified" before checking the password,
    # strangers could learn which emails have accounts here.
    user = find_user_by_email(email)

    if user is None or not user.check_password(password):
        return message_response("signinFailed", status.HTTP_401_UNAUTHORIZED)

    # Step 2: the password is right, but is the account switched on?
    if not user.is_active:
        profile = get_user_profile(user)

        if profile and not profile.email_verified:
            return message_response(
                "emailVerificationRequired", status.HTTP_403_FORBIDDEN
            )

        return message_response("accountDeactivated", status.HTTP_403_FORBIDDEN)

    # Step 3: all good. Remember when they logged in (the admin page shows this).
    update_last_login(None, user)

    # Give them a fresh CSRF token for their new login.
    rotate_token(request)

    refresh = RefreshToken.for_user(user)
    response = Response(
        {
            "message": ui_content_value("signinSuccess"),
            "user": user_summary(user),
        },
        status=status.HTTP_200_OK,
    )
    set_auth_cookies(response, str(refresh.access_token), str(refresh))
    return response


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def refresh_view(request):
    """
    The access token only lives a short time (30 minutes by default).
    When it runs out, the frontend calls this to get a new one,
    using the long-lived refresh token cookie. No password needed.
    """
    raw_refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)

    # SimpleJWT's serializer checks the token, checks the user is still
    # active, makes new tokens, and blacklists the old refresh token.
    serializer = TokenRefreshSerializer(data={"refresh": raw_refresh_token or ""})

    try:
        serializer.is_valid(raise_exception=True)
    except (TokenError, AuthenticationFailed, ValidationError, User.DoesNotExist):
        # Missing, expired, already-used, or the user was removed/disabled.
        # Clear the bad cookies so the browser starts fresh at the login page.
        response = message_response(
            "sessionExpired",
            status.HTTP_401_UNAUTHORIZED,
            default="Your session has expired. Please sign in again.",
        )
        clear_auth_cookies(response)
        return response

    new_tokens = serializer.validated_data
    response = Response(status=status.HTTP_204_NO_CONTENT)
    set_auth_cookies(response, new_tokens["access"], new_tokens["refresh"])
    return response


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def logout_view(request):
    """
    Sign out. This works even if the access token already expired,
    so a user is never "stuck" logged in.
    """
    raw_refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)

    if raw_refresh_token:
        try:
            # Blacklist = this refresh token can never be used again.
            RefreshToken(raw_refresh_token).blacklist()
        except TokenError:
            # Already expired or already blacklisted. That's fine.
            pass

    response = message_response("logoutSuccess", status.HTTP_200_OK)
    clear_auth_cookies(response)
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Who is logged in right now? The frontend calls this when it loads."""
    user = request.user

    # Make sure this browser has a CSRF cookie (the frontend needs it
    # for POST/PATCH/DELETE requests).
    get_token(request)

    return Response(
        {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "fullName": user.get_full_name(),
            "isStaff": user.is_staff,
            "role": get_user_role(user),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def csrf_view(request):
    """
    Give the browser a "csrftoken" cookie.
    The frontend calls this if it needs to send a POST but has no CSRF cookie yet.
    """
    get_token(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


# =============================================================================
# 5. SIGN-UP AND EMAIL VERIFICATION
# =============================================================================


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def signup_view(request):
    """Create an account. It stays switched off until the email is verified."""
    serializer = SignupSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {
                "message": first_error_message(serializer),
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # The serializer creates the user switched OFF (is_active=False),
    # so they can't log in until they type the code from their email.
    user = serializer.save()

    error_response = start_email_verification(user)

    if error_response:
        # We couldn't send the code. Remove the half-made account so the
        # person can simply try signing up again.
        # Deleting a user does NOT delete their uploaded file, so we
        # remove the CV file ourselves first.
        cv_file = user.profile.cv_file
        if cv_file:
            cv_file.delete(save=False)
        user.delete()
        return error_response

    return Response(
        {
            "message": ui_content_value("emailVerificationSent"),
            "user": user_summary(user),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([EmailRateThrottle])
def email_verification_request_view(request):
    """Send (or re-send) the email verification code."""
    serializer = EmailVerificationRequestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": first_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = find_user_by_email(serializer.validated_data["email"])

    # Unknown email? Pretend it worked, so strangers can't test which
    # emails have accounts here.
    if user is None:
        return message_response("emailVerificationSent", status.HTTP_200_OK)

    profile = get_user_profile(user)

    if profile and profile.email_verified:
        return message_response("emailAlreadyVerified", status.HTTP_200_OK)

    error_response = start_email_verification(user)

    if error_response:
        return error_response

    return message_response("emailVerificationSent", status.HTTP_200_OK)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([EmailRateThrottle])
def email_verification_confirm_view(request):
    """Check the email verification code. If correct, switch the account on."""
    serializer = EmailVerificationConfirmSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": first_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = find_user_by_email(serializer.validated_data["email"])
    code = serializer.validated_data["otp"]

    # Everything inside "with transaction.atomic()" happens all together,
    # or not at all. Together with lock=True, this makes the attempt
    # counter safe even if many requests arrive at once.
    with transaction.atomic():
        otp_record = (
            get_active_otp(EmailVerificationOTP, user, lock=True) if user else None
        )

        if otp_record is None:
            return message_response(
                "emailVerificationInvalidOtp", status.HTTP_400_BAD_REQUEST
            )

        result = check_otp(otp_record, code, settings.EMAIL_VERIFICATION_MAX_ATTEMPTS)

        if result == "too_many":
            return message_response(
                "emailVerificationTooManyAttempts", status.HTTP_429_TOO_MANY_REQUESTS
            )

        if result == "wrong":
            return message_response(
                "emailVerificationInvalidOtp", status.HTTP_400_BAD_REQUEST
            )

        # Correct code: mark the email as verified and switch the account on.
        profile, _created = Profile.objects.get_or_create(user=user)
        profile.email_verified = True
        profile.save(update_fields=["email_verified"])

        user.is_active = True
        user.save(update_fields=["is_active"])

        mark_otp_used(otp_record)

    return message_response("emailVerificationSuccess", status.HTTP_200_OK)


# =============================================================================
# 6. PASSWORD RESET
# =============================================================================


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([EmailRateThrottle])
def password_reset_request_view(request):
    """Step 1 of a password reset: email the user a 6-digit code."""
    serializer = PasswordResetRequestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": first_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = find_user_by_email(serializer.validated_data["email"])

    # Unknown email? Pretend it worked (same reason as above).
    if user is None:
        return message_response("passwordResetEmailSent", status.HTTP_200_OK)

    if not email_service_is_configured():
        return message_response(
            "passwordResetEmailUnavailable", status.HTTP_503_SERVICE_UNAVAILABLE
        )

    if is_in_cooldown(
        PasswordResetOTP, user, settings.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS
    ):
        return message_response(
            "passwordResetCooldown", status.HTTP_429_TOO_MANY_REQUESTS
        )

    expiry_minutes = settings.PASSWORD_RESET_OTP_EXPIRY_MINUTES
    code, otp_record = create_otp(PasswordResetOTP, user, expiry_minutes)

    email_sent = send_otp_email(
        user,
        code,
        subject_key="passwordResetEmailSubject",
        body_key="passwordResetEmailBody",
        expiry_minutes=expiry_minutes,
    )

    if not email_sent:
        mark_otp_used(otp_record)
        return message_response(
            "passwordResetEmailUnavailable", status.HTTP_503_SERVICE_UNAVAILABLE
        )

    return message_response("passwordResetEmailSent", status.HTTP_200_OK)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([EmailRateThrottle])
def password_reset_confirm_view(request):
    """Step 2 of a password reset: check the code, then save the new password."""
    serializer = PasswordResetConfirmSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": first_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = find_user_by_email(serializer.validated_data["email"])
    code = serializer.validated_data["otp"]
    new_password = serializer.validated_data["password"]

    with transaction.atomic():
        otp_record = get_active_otp(PasswordResetOTP, user, lock=True) if user else None

        if otp_record is None:
            return message_response(
                "passwordResetInvalidOtp", status.HTTP_400_BAD_REQUEST
            )

        result = check_otp(otp_record, code, settings.PASSWORD_RESET_MAX_ATTEMPTS)

        if result == "too_many":
            return message_response(
                "passwordResetTooManyAttempts", status.HTTP_429_TOO_MANY_REQUESTS
            )

        if result == "wrong":
            return message_response(
                "passwordResetInvalidOtp", status.HTTP_400_BAD_REQUEST
            )

        # Correct code: save the new password (set_password stores a safe hash).
        user.set_password(new_password)
        user.save(update_fields=["password"])

        mark_otp_used(otp_record)

        # Sign this user out on every other browser and device.
        log_out_everywhere(user)

    return message_response("passwordResetUpdated", status.HTTP_200_OK)
