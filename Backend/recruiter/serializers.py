"""
What a recruiter sees about a candidate.
(No email or CV here: recruiters open the full profile page for those.)
"""

from rest_framework import serializers

from profiles.models import Profile


class RecruiterCandidateSerializer(serializers.ModelSerializer):
    # "id" is the USER id (the profile page and links use user ids).
    id = serializers.IntegerField(source="user_id", read_only=True)
    fullName = serializers.SerializerMethodField()
    openToWork = serializers.BooleanField(source="open_to_work", read_only=True)
    skills = serializers.SerializerMethodField()
    # These two come from extra columns added by candidate_profiles() in views.py.
    projectsCount = serializers.IntegerField(source="projects_count", read_only=True)
    experiencesCount = serializers.IntegerField(source="experiences_count", read_only=True)

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

    def get_fullName(self, profile):
        return profile.user.get_full_name() or "Candidate"

    def get_skills(self, profile):
        # .all() uses the skills the view already loaded (prefetch_related),
        # so this doesn't ask the database again.
        return [skill.name for skill in profile.skills.all()]
