from .models import Profile


def calculate_profile_completion(profile, missing_fields):
    score = 0
    total = 100

    if profile.user.get_full_name():
        score += 10

    if profile.headline:
        score += 10

    if profile.location:
        score += 10

    if profile.bio:
        score += 10

    if profile.linkedin_url:
        score += 10

    if profile.github_url:
        score += 5

    if profile.portfolio_url:
        score += 5

    if profile.cv_file:
        score += 15

    if profile.skills.exists():
        score += 10

    if profile.projects.exists():
        score += 10

    if profile.experiences.exists():
        score += 10

    return min(score, total)