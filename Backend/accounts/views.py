import secrets
import logging
from smtplib import SMTPException
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import send_mail
from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from app_config.models import UiContent
from profiles.models import Profile
from .models import AdminActionLog, EmailVerificationOTP, PasswordResetOTP
from .serializers import (
    AdminActionLogSerializer,
    EmailVerificationConfirmSerializer,
    EmailVerificationRequestSerializer,
    AdminUserSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RecruiterVerificationSerializer,
    SigninSerializer,
    SignupSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def ui_content_value(key):
    try:
        return UiContent.objects.get(key=key).value
    except UiContent.DoesNotExist as exc:
        raise ImproperlyConfigured(f"Missing backend UI content: {key}") from exc


def serializer_error_message(serializer):
    errors = serializer.errors
    field_labels = {
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
        "newPassword": "New password",
        "status": "Status",
        "note": "Note",
    }

    for field, value in errors.items():
        label = field_labels.get(field, field)

        if isinstance(value, list) and value:
            return f"{label}: {value[0]}"

        if isinstance(value, dict):
            nested = next(iter(value.values()), None)

            if isinstance(nested, list) and nested:
                return f"{label}: {nested[0]}"

            if nested:
                return f"{label}: {nested}"

        if value:
            return f"{label}: {value}"

    return "Invalid request"


def create_admin_action_log(actor, action, description, target_user=None, metadata=None):
    AdminActionLog.objects.create(
        actor=actor,
        target_user=target_user,
        action=action,
        description=description,
        metadata=metadata or {},
    )


def get_user_profile(user):
    try:
        return user.profile
    except Profile.DoesNotExist:
        return None


def set_jwt_cookies(response, user):
    refresh = RefreshToken.for_user(user)

    response.set_cookie(
        key=settings.JWT_ACCESS_COOKIE,
        value=str(refresh.access_token),
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_ACCESS_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )

    response.set_cookie(
        key=settings.JWT_REFRESH_COOKIE,
        value=str(refresh),
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_REFRESH_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )


def generate_otp():
    return f"{secrets.randbelow(1_000_000):06d}"


def email_service_is_configured():
    required_values = [
        settings.EMAIL_BACKEND,
        settings.EMAIL_HOST,
        settings.EMAIL_HOST_USER,
        settings.EMAIL_HOST_PASSWORD,
        settings.DEFAULT_FROM_EMAIL,
    ]
    return all(required_values)


def send_password_reset_otp(user, otp):
    expiry_minutes = settings.PASSWORD_RESET_OTP_EXPIRY_MINUTES

    send_mail(
        subject=ui_content_value("passwordResetEmailSubject"),
        message=ui_content_value("passwordResetEmailBody").format(
            otp=otp,
            minutes=expiry_minutes,
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_email_verification_otp(user, otp):
    expiry_minutes = settings.EMAIL_VERIFICATION_OTP_EXPIRY_MINUTES

    send_mail(
        subject=ui_content_value("emailVerificationSubject"),
        message=ui_content_value("emailVerificationBody").format(
            otp=otp,
            minutes=expiry_minutes,
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def get_active_password_reset_otp(user):
    return PasswordResetOTP.objects.filter(
        user=user,
        used_at__isnull=True,
    ).first()


def get_active_email_verification_otp(user):
    return EmailVerificationOTP.objects.filter(
        user=user,
        used_at__isnull=True,
    ).first()


def create_and_send_email_verification_otp(user):
    active_otp = get_active_email_verification_otp(user)

    if active_otp:
        cooldown_ends_at = active_otp.created_at + timedelta(
            seconds=settings.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
        )

        if cooldown_ends_at > timezone.now():
            return Response(
                {"message": ui_content_value("emailVerificationCooldown")},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

    otp = generate_otp()
    EmailVerificationOTP.objects.filter(user=user, used_at__isnull=True).update(
        used_at=timezone.now()
    )
    otp_record = EmailVerificationOTP.objects.create(
        user=user,
        otp_hash=EmailVerificationOTP.hash_otp(otp),
        expires_at=timezone.now()
        + timedelta(minutes=settings.EMAIL_VERIFICATION_OTP_EXPIRY_MINUTES),
    )

    try:
        send_email_verification_otp(user, otp)
    except (OSError, SMTPException):
        logger.exception("Failed to send email verification OTP")
        otp_record.used_at = timezone.now()
        otp_record.save(update_fields=["used_at"])
        return Response(
            {"message": ui_content_value("passwordResetEmailUnavailable")},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return None


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def signin_view(request):
    serializer = SigninSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]

    try:
        user_obj = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {"message": ui_content_value("signinFailed")},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user_obj.is_active:
        profile = get_user_profile(user_obj)

        if profile and not profile.email_verified:
            return Response(
                {"message": ui_content_value("emailVerificationRequired")},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            {"message": ui_content_value("accountDeactivated")},
            status=status.HTTP_403_FORBIDDEN,
        )

    user = authenticate(
        request,
        username=user_obj.username,
        password=password,
    )

    if user is None:
        return Response(
            {"message": ui_content_value("signinFailed")},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    response = Response(
        {
            "message": ui_content_value("signinSuccess"),
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "fullName": user.get_full_name(),
            },
        },
        status=status.HTTP_200_OK,
    )

    set_jwt_cookies(response, user)

    return response


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_stats_view(request):
    from connections.models import ConnectionRequest
    from profiles.models import Experience, Project, Skill

    return Response(
        {
            "users": User.objects.count(),
            "activeUsers": User.objects.filter(is_active=True).count(),
            "inactiveUsers": User.objects.filter(is_active=False).count(),
            "staffUsers": User.objects.filter(is_staff=True).count(),
            "skills": Skill.objects.count(),
            "projects": Project.objects.count(),
            "experiences": Experience.objects.count(),
            "pendingConnectionRequests": ConnectionRequest.objects.filter(
                status="pending"
            ).count(),
            "pendingRecruiters": Profile.objects.filter(
                role=Profile.ROLE_RECRUITER,
                recruiter_verification_status=Profile.RECRUITER_VERIFICATION_PENDING,
            ).count(),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_users_view(request):
    users = (
        User.objects.select_related("profile")
        .annotate(
            skills_count=Count("profile__skills", distinct=True),
            projects_count=Count("profile__projects", distinct=True),
            experiences_count=Count("profile__experiences", distinct=True),
            connections_count=Count("connections", distinct=True),
        )
        .order_by("-date_joined")
    )
    serializer = AdminUserSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_audit_logs_view(request):
    logs = AdminActionLog.objects.select_related("actor", "target_user")[:50]
    serializer = AdminActionLogSerializer(logs, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def admin_user_status_view(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {"message": ui_content_value("adminUserNotFound")},
            status=status.HTTP_404_NOT_FOUND,
        )

    if user.id == request.user.id:
        return Response(
            {"message": ui_content_value("adminCannotDeactivateSelf")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    is_active = request.data.get("is_active")

    if not isinstance(is_active, bool):
        return Response(
            {"message": ui_content_value("adminInvalidUserStatus")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.is_active = is_active
    user.save(update_fields=["is_active"])
    create_admin_action_log(
        actor=request.user,
        target_user=user,
        action="user_activated" if is_active else "user_deactivated",
        description="Activated user account" if is_active else "Deactivated user account",
        metadata={"is_active": is_active},
    )

    serializer = AdminUserSerializer(user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def admin_user_role_view(request, user_id):
    try:
        user = User.objects.select_related("profile").get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {"message": ui_content_value("adminUserNotFound")},
            status=status.HTTP_404_NOT_FOUND,
        )

    role = request.data.get("role")
    allowed_roles = {
        Profile.ROLE_CANDIDATE,
        Profile.ROLE_RECRUITER,
        Profile.ROLE_ADMIN,
    }

    if role not in allowed_roles:
        return Response(
            {"message": ui_content_value("adminInvalidUserRole")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if user.id == request.user.id and role != Profile.ROLE_ADMIN:
        return Response(
            {"message": ui_content_value("adminCannotChangeOwnRole")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    profile, _created = Profile.objects.get_or_create(user=user)
    previous_role = profile.role
    profile.role = role
    profile.save(update_fields=["role"])

    user.is_staff = role == Profile.ROLE_ADMIN
    user.is_superuser = role == Profile.ROLE_ADMIN
    user.save(update_fields=["is_staff", "is_superuser"])

    create_admin_action_log(
        actor=request.user,
        target_user=user,
        action="role_changed",
        description=f"Changed user role from {previous_role} to {role}",
        metadata={"previous_role": previous_role, "new_role": role},
    )

    serializer = AdminUserSerializer(user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def admin_recruiter_verification_view(request, user_id):
    serializer = RecruiterVerificationSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.select_related("profile").get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {"message": ui_content_value("adminUserNotFound")},
            status=status.HTTP_404_NOT_FOUND,
        )

    profile, _created = Profile.objects.get_or_create(user=user)

    if profile.role != Profile.ROLE_RECRUITER:
        return Response(
            {"message": ui_content_value("adminRecruiterVerificationInvalidRole")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    previous_status = profile.recruiter_verification_status
    profile.recruiter_verification_status = serializer.validated_data["status"]
    profile.recruiter_verification_note = serializer.validated_data.get("note", "")
    profile.save(
        update_fields=[
            "recruiter_verification_status",
            "recruiter_verification_note",
        ]
    )
    create_admin_action_log(
        actor=request.user,
        target_user=user,
        action="recruiter_verification_changed",
        description=(
            "Approved recruiter"
            if profile.recruiter_verification_status
            == Profile.RECRUITER_VERIFICATION_APPROVED
            else "Rejected recruiter"
        ),
        metadata={
            "previous_status": previous_status,
            "new_status": profile.recruiter_verification_status,
        },
    )

    return Response(AdminUserSerializer(user).data, status=status.HTTP_200_OK)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def password_reset_request_view(request):
    serializer = PasswordResetRequestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = serializer.validated_data["email"]
    success_message = ui_content_value("passwordResetEmailSent")

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {"message": success_message},
            status=status.HTTP_200_OK,
        )

    if not email_service_is_configured():
        return Response(
            {"message": ui_content_value("passwordResetEmailUnavailable")},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    active_otp = get_active_password_reset_otp(user)

    if active_otp:
        cooldown_ends_at = active_otp.created_at + timedelta(
            seconds=settings.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS
        )

        if cooldown_ends_at > timezone.now():
            return Response(
                {"message": ui_content_value("passwordResetCooldown")},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

    otp = generate_otp()
    PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).update(
        used_at=timezone.now()
    )
    otp_record = PasswordResetOTP.objects.create(
        user=user,
        otp_hash=PasswordResetOTP.hash_otp(otp),
        expires_at=timezone.now()
        + timedelta(minutes=settings.PASSWORD_RESET_OTP_EXPIRY_MINUTES),
    )

    try:
        send_password_reset_otp(user, otp)
    except (OSError, SMTPException):
        logger.exception("Failed to send password reset OTP email")
        otp_record.used_at = timezone.now()
        otp_record.save(update_fields=["used_at"])
        return Response(
            {"message": ui_content_value("passwordResetEmailUnavailable")},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response(
        {"message": success_message},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def password_reset_confirm_view(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = serializer.validated_data["email"]
    otp = serializer.validated_data["otp"]
    password = serializer.validated_data["password"]

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {"message": ui_content_value("passwordResetInvalidOtp")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    otp_record = get_active_password_reset_otp(user)

    if not otp_record:
        return Response(
            {"message": ui_content_value("passwordResetInvalidOtp")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if otp_record.attempts >= settings.PASSWORD_RESET_MAX_ATTEMPTS:
        otp_record.used_at = timezone.now()
        otp_record.save(update_fields=["used_at"])

        return Response(
            {"message": ui_content_value("passwordResetTooManyAttempts")},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if not otp_record.is_valid_for(otp):
        otp_record.attempts += 1

        if otp_record.attempts >= settings.PASSWORD_RESET_MAX_ATTEMPTS:
            otp_record.used_at = timezone.now()
            otp_record.save(update_fields=["attempts", "used_at"])

            return Response(
                {"message": ui_content_value("passwordResetTooManyAttempts")},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        otp_record.save(update_fields=["attempts"])

        return Response(
            {"message": ui_content_value("passwordResetInvalidOtp")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(password)
    user.save(update_fields=["password"])

    otp_record.used_at = timezone.now()
    otp_record.save(update_fields=["used_at"])

    return Response(
        {"message": ui_content_value("passwordResetUpdated")},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def signup_view(request):
    serializer = SignupSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        user.is_active = False
        user.save(update_fields=["is_active"])

        profile = user.profile
        profile.email_verified = False
        profile.save(update_fields=["email_verified"])

        verification_response = create_and_send_email_verification_otp(user)

        if verification_response:
            user.delete()
            return verification_response

        return Response(
            {
                "message": ui_content_value("emailVerificationSent"),
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "fullName": user.get_full_name(),
                },
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(
        {
            "message": serializer_error_message(serializer),
            "errors": serializer.errors,
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def email_verification_request_view(request):
    serializer = EmailVerificationRequestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = serializer.validated_data["email"]
    success_message = ui_content_value("emailVerificationSent")

    try:
        user = User.objects.select_related("profile").get(email=email)
    except User.DoesNotExist:
        return Response({"message": success_message}, status=status.HTTP_200_OK)

    profile = get_user_profile(user)

    if profile and profile.email_verified:
        return Response(
            {"message": ui_content_value("emailAlreadyVerified")},
            status=status.HTTP_200_OK,
        )

    verification_response = create_and_send_email_verification_otp(user)

    if verification_response:
        return verification_response

    return Response({"message": success_message}, status=status.HTTP_200_OK)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def email_verification_confirm_view(request):
    serializer = EmailVerificationConfirmSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {"message": serializer_error_message(serializer)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = serializer.validated_data["email"]
    otp = serializer.validated_data["otp"]

    try:
        user = User.objects.select_related("profile").get(email=email)
    except User.DoesNotExist:
        return Response(
            {"message": ui_content_value("emailVerificationInvalidOtp")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    otp_record = get_active_email_verification_otp(user)

    if not otp_record:
        return Response(
            {"message": ui_content_value("emailVerificationInvalidOtp")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if otp_record.attempts >= settings.EMAIL_VERIFICATION_MAX_ATTEMPTS:
        otp_record.used_at = timezone.now()
        otp_record.save(update_fields=["used_at"])

        return Response(
            {"message": ui_content_value("emailVerificationTooManyAttempts")},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if not otp_record.is_valid_for(otp):
        otp_record.attempts += 1

        if otp_record.attempts >= settings.EMAIL_VERIFICATION_MAX_ATTEMPTS:
            otp_record.used_at = timezone.now()
            otp_record.save(update_fields=["attempts", "used_at"])

            return Response(
                {"message": ui_content_value("emailVerificationTooManyAttempts")},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        otp_record.save(update_fields=["attempts"])

        return Response(
            {"message": ui_content_value("emailVerificationInvalidOtp")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    profile, _created = Profile.objects.get_or_create(user=user)
    profile.email_verified = True
    profile.save(update_fields=["email_verified"])
    user.is_active = True
    user.save(update_fields=["is_active"])
    otp_record.used_at = timezone.now()
    otp_record.save(update_fields=["used_at"])

    return Response(
        {"message": ui_content_value("emailVerificationSuccess")},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user
    profile = None

    if not user.is_staff:
        try:
            profile = user.profile
        except Profile.DoesNotExist:
            profile = None

    return Response(
        {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "fullName": user.get_full_name(),
            "isStaff": user.is_staff,
            "role": Profile.ROLE_ADMIN
            if user.is_staff
            else profile.role
            if profile
            else Profile.ROLE_CANDIDATE,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)

    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            logger.exception("Failed to blacklist refresh token during logout")

    response = Response(
        {"message": ui_content_value("logoutSuccess")},
        status=status.HTTP_200_OK,
    )

    response.delete_cookie(settings.JWT_ACCESS_COOKIE, path="/")
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, path="/")

    return response
