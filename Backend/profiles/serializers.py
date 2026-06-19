from rest_framework import serializers
from .models import Activity, Profile, Skill, Project, Experience


class ProfileSerializer(serializers.ModelSerializer):
    fullName = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    linkedinUrl = serializers.CharField(source="linkedin_url", read_only=True)
    githubUrl = serializers.CharField(source="github_url", read_only=True)
    portfolioUrl = serializers.CharField(source="portfolio_url", read_only=True)
    cvUrl = serializers.SerializerMethodField()
    profileCompletion = serializers.SerializerMethodField()
    profileViewers = serializers.SerializerMethodField()
    openToWork = serializers.BooleanField(source="open_to_work", read_only=True)
    missingFields = serializers.SerializerMethodField()
    skillsCount = serializers.SerializerMethodField()
    projectsCount = serializers.SerializerMethodField()
    experiencesCount = serializers.SerializerMethodField()
    connectionsCount = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "fullName",
            "email",
            "headline",
            "location",
            "bio",
            "linkedinUrl",
            "githubUrl",
            "portfolioUrl",
            "cvUrl",
            "profileCompletion",
            "profileViewers",
            "openToWork",
            "missingFields",
            "skillsCount",
            "projectsCount",
            "experiencesCount",
            "connectionsCount",
        ]

    def get_fullName(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_email(self, obj):
        return obj.user.email

    def get_cvUrl(self, obj):
        if obj.cv_file:
            return obj.cv_file.url
        return ""

    def get_missingFields(self, obj):
        missing = []

        if not obj.user.get_full_name():
            missing.append("Full name")

        if not obj.headline:
            missing.append("Headline")

        if not obj.location:
            missing.append("Location")

        if not obj.bio:
            missing.append("Bio")

        if not obj.linkedin_url:
            missing.append("LinkedIn profile")

        if not obj.cv_file:
            missing.append("CV")

        if obj.skills.count() == 0:
            missing.append("Skills")

        if obj.projects.count() == 0:
            missing.append("Projects")

        if obj.experiences.count() == 0:
            missing.append("Experience")

        return missing

    def get_profileCompletion(self, obj):
        total = 8
        completed = total - len(self.get_missingFields(obj))

        return int((completed / total) * 100)

    def get_skillsCount(self, obj):
        return obj.skills.count()

    def get_projectsCount(self, obj):
        return obj.projects.count()

    def get_experiencesCount(self, obj):
        return obj.experiences.count()

    def get_connectionsCount(self, obj):
        from connections.models import Connection

        return Connection.objects.filter(user=obj.user).count()

    def get_profileViewers(self, obj):
        return obj.views.count()


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ["id", "title", "created_at"]


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ["id", "name"]


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "title",
            "description",
            "tech_stack",
            "github_url",
        ]


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = [
            "id",
            "title",
            "company",
            "location",
            "start_date",
            "end_date",
            "current",
            "description",
        ]
