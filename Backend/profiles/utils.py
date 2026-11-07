"""
Profile completion: "what is still missing?" and "how complete is it (%)?"

Before, there were TWO different formulas (one for the list of missing
things, another for the percentage), so a recruiter could see
"nothing missing" next to "40% complete". Now there is ONE checklist per
role, and the percentage is simply: done items / all items.
"""

from .models import Profile


def get_completion_checklist(profile, counts=None):
    """
    A list of (label, done?) pairs for this profile's role.
    Example: [("Headline", True), ("Bio", False), ...]

    `counts` is optional: {"skills": 3, "projects": 1, "experiences": 0}.
    Pages that list MANY profiles (like the admin page) count everything in
    one database trip and pass the numbers in. Otherwise we count here.
    """
    counts = counts or profile.related_counts
    has_full_name = bool(profile.user.get_full_name())

    if profile.role == Profile.ROLE_ADMIN:
        return [
            ("Full name", has_full_name),
            ("Admin title", bool(profile.admin_title)),
        ]

    if profile.role == Profile.ROLE_RECRUITER:
        return [
            ("Full name", has_full_name),
            ("Recruiter headline", bool(profile.headline)),
            ("Company name", bool(profile.company_name)),
            ("Hiring title", bool(profile.hiring_title)),
            ("Company website", bool(profile.company_website)),
            ("About the company", bool(profile.company_about.strip())),
            ("Roles you hire for", bool(profile.hiring_roles)),
        ]

    # Candidates
    return [
        ("Full name", has_full_name),
        ("Headline", bool(profile.headline)),
        ("Location", bool(profile.location)),
        ("Bio", bool(profile.bio)),
        ("LinkedIn profile", bool(profile.linkedin_url)),
        ("CV", bool(profile.cv_file)),
        ("Skills", counts["skills"] > 0),
        ("Projects", counts["projects"] > 0),
        ("Experience", counts["experiences"] > 0),
    ]


def get_missing_fields(profile, counts=None):
    """The labels of everything NOT done yet, e.g. ["Bio", "CV"]."""
    return [label for label, done in get_completion_checklist(profile, counts) if not done]


def calculate_profile_completion(profile, counts=None):
    """How complete the profile is, from 0 to 100."""
    checklist = get_completion_checklist(profile, counts)
    done_count = sum(1 for _label, done in checklist if done)
    return round(done_count / len(checklist) * 100)
