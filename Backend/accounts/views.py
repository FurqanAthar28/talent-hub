from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import SignupSerializer

User = get_user_model()


def set_jwt_cookies(response, user):
    refresh = RefreshToken.for_user(user)

    response.set_cookie(
        key=settings.JWT_ACCESS_COOKIE,
        value=str(refresh.access_token),
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=30 * 60,
        path="/",
    )

    response.set_cookie(
        key=settings.JWT_REFRESH_COOKIE,
        value=str(refresh),
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=7 * 24 * 60 * 60,
        path="/",
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def signin_view(request):
    email = request.data.get("email")
    password = request.data.get("password")

    if not email or not password:
        return Response(
            {"message": "Email and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user_obj = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {"message": "Invalid email or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    user = authenticate(
        request,
        username=user_obj.username,
        password=password,
    )

    if user is None:
        return Response(
            {"message": "Invalid email or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    response = Response(
        {
            "message": "Signin successful",
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


@api_view(["POST"])
@permission_classes([AllowAny])
def signup_view(request):
    serializer = SignupSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        return Response(
            {
                "message": "Signup successful",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "fullName": user.get_full_name(),
                },
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user

    return Response(
        {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "fullName": user.get_full_name(),
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
        except Exception:
            pass

    response = Response(
        {"message": "Logged out successfully"},
        status=status.HTTP_200_OK,
    )

    response.delete_cookie(settings.JWT_ACCESS_COOKIE, path="/")
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, path="/")

    return response