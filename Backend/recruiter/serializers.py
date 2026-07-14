# recruiter/serializers.py

from rest_framework import serializers

from profiles.models import Profile


class RecruiterCandidateSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="user.id", read_only=True)
    fullName = serializers.SerializerMethodField()
    headline = serializers.CharField(read_only=True)
    location = serializers.CharField(read_only=True)
    bio = serializers.CharField(read_only=True)
    openToWork = serializers.BooleanField(source="open_to_work", read_only=True)
    skills = serializers.SerializerMethodField()
    projectsCount = serializers.SerializerMethodField()
    experiencesCount = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "fullName",
            "headline",
            "location",
            "bio",
            "openToWork",
            "skills",
            "projectsCount",
            "experiencesCount",
        ]

    def get_fullName(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_skills(self, obj):
        return [skill.name for skill in obj.skills.all()]

    def get_projectsCount(self, obj):
        return obj.projects.count()

    def get_experiencesCount(self, obj):
        return obj.experiences.count()