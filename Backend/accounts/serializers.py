from rest_framework import serializers
from django.contrib.auth.models import User
from profiles.models import Profile


class SignupSerializer(serializers.Serializer):
    fullName = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    linkedinUrl = serializers.URLField(required=False, allow_blank=True)
    cvFile = serializers.FileField(required=True)

    def validate_email(self, value):
        email = value.lower()

        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("Email already exists")

        return email

    def validate_cvFile(self, value):
        if value.content_type != "application/pdf":
            raise serializers.ValidationError("Only PDF files are accepted")

        max_size = 5 * 1024 * 1024

        if value.size > max_size:
            raise serializers.ValidationError("CV file must be less than 5MB")

        return value

    def create(self, validated_data):
        full_name = validated_data["fullName"].strip()
        email = validated_data["email"]
        password = validated_data["password"]
        cv_file = validated_data["cvFile"]

        name_parts = full_name.split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        Profile.objects.create(
            user=user,
            linkedin_url=validated_data.get("linkedinUrl", ""),
            cv_file=cv_file,
        )

        return user


class SigninSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)