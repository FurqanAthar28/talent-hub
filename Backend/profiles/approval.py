"""
The approval checks for candidates and recruiters, written in ONE place.

THREE LAYERS (from the project spec)
  1. At sign-up         -> accounts/serializers.py (email, password, CV, LinkedIn...)
  2. At approval        -> approval_checks() below: what the admin sees before
                           pressing Approve. "Required" checks must pass first;
                           "warnings" need the admin's judgement.
  3. In every search    -> searchable_candidates() below: the system hides people
                           who are switched off, not approved, or whose profile
                           became incomplete after approval. No admin needed.

WHY SOME THINGS ARE CHECKED BY A PERSON
LinkedIn blocks automatic visits, so "the link opens and matches the name"
is ticked by the admin. The system checks everything it can.
"""

import re

from django.db.models import Q
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from .models import Profile

# A CV with less text than this is probably a blank or scanned-only page.
MIN_CV_TEXT_CHARACTERS = 200
# Only the first pages are read: enough to know it's a real CV, and fast.
CV_PAGES_TO_READ = 3

# Words people type just to get past a form.
PLACEHOLDER_TEXT = {
    "test", "testing", "asdf", "qwerty", "lorem ipsum", "n/a", "na", "none",
    "abc", "xyz", "sample", "placeholder", "todo", "tbd", "hello", "aaa", "xxx",
}

LINKEDIN_PROFILE = re.compile(r"^https?://([a-z]{2,3}\.)?linkedin\.com/in/[^/?#\s]+/?$", re.IGNORECASE)


# =============================================================================
# Small checks
# =============================================================================


def looks_like_placeholder(text):
    """'test', 'asdf', '...', 'aaaa', or under 3 letters."""
    cleaned = text.strip().lower()
    if len(re.sub(r"[^a-z]", "", cleaned)) < 3:
        return True
    if cleaned in PLACEHOLDER_TEXT:
        return True
    return len(set(cleaned.replace(" ", ""))) == 1  # "aaaaaa"


def cv_text_length(profile):
    """How much readable text the first pages of the CV have (0 if it can't be read)."""
    if not profile.cv_file:
        return 0
    try:
        with profile.cv_file.open("rb") as file:
            reader = PdfReader(file)
            pages = reader.pages[:CV_PAGES_TO_READ]
            return sum(len((page.extract_text() or "").strip()) for page in pages)
    except (PyPdfError, OSError, ValueError):
        return 0


def normalized_linkedin(url):
    """'https://www.LinkedIn.com/in/Ali/' -> 'linkedin.com/in/ali' (to compare two links)."""
    cleaned = re.sub(r"^https?://(www\.)?", "", url.strip().lower())
    return cleaned.rstrip("/")


def claims_company(profile):
    """
    Recruiters always represent a company. A candidate "claims" one when a
    job on their profile is marked "I still work here".
    """
    if profile.role == Profile.ROLE_RECRUITER:
        return True
    return profile.experiences.filter(current=True).exists()


def allowed_rejection_reasons(profile):
    """The fixed reasons that make sense for this person."""
    reasons = [Profile.REJECTION_EMAIL]
    if claims_company(profile):
        reasons.append(Profile.REJECTION_COMPANY)
    return reasons


# =============================================================================
# Layer 2: what the admin sees before approving
# =============================================================================


def check(key, label, passed, required, detail=""):
    return {"key": key, "label": label, "passed": bool(passed), "required": required, "detail": detail}


def missing_profile_parts(profile):
    """What a person still has to fill in before they can be approved."""
    missing = []
    if profile.role == Profile.ROLE_CANDIDATE:
        for label, value in (
            ("Headline", profile.headline),
            ("Location", profile.location),
            ("About (bio)", profile.bio),
            ("LinkedIn link", profile.linkedin_url),
        ):
            if not value.strip():
                missing.append(label)
        if not profile.cv_file:
            missing.append("CV")
        if not profile.skills.exists():
            missing.append("At least 1 skill")
        if not profile.projects.exists() and not profile.experiences.exists():
            missing.append("At least 1 project or job")
    elif profile.role == Profile.ROLE_RECRUITER:
        if not profile.company_name.strip():
            missing.append("Company name")
    return missing


def approval_checks(profile):
    """
    Every check for one person, in the order the admin reads them.
    Required checks must pass before Approve works.
    """
    user = profile.user
    checks = [
        check("email_verified", "Email confirmed with a code", profile.email_verified, required=True),
    ]

    missing = missing_profile_parts(profile)
    checks.append(
        check("complete", "Profile complete", not missing, required=True, detail=", ".join(missing))
    )

    if profile.role == Profile.ROLE_CANDIDATE:
        text_length = cv_text_length(profile)
        checks.append(
            check(
                "cv_readable",
                "CV is a readable PDF",
                text_length >= MIN_CV_TEXT_CHARACTERS,
                required=True,
                detail="" if text_length >= MIN_CV_TEXT_CHARACTERS else "Blank, scanned-only or damaged file",
            )
        )
        checks.append(
            check(
                "linkedin_format",
                "LinkedIn link is a profile address",
                LINKEDIN_PROFILE.match(profile.linkedin_url.strip()),
                required=True,
                detail=profile.linkedin_url,
            )
        )

    # ----- Warnings: the admin decides -----
    others = Profile.objects.exclude(pk=profile.pk)

    duplicate_cv = bool(profile.cv_sha256) and others.filter(cv_sha256=profile.cv_sha256).exists()
    checks.append(check("unique_cv", "CV not used by another account", not duplicate_cv, required=False))

    if profile.linkedin_url:
        link = normalized_linkedin(profile.linkedin_url)
        duplicate_link = any(
            normalized_linkedin(url) == link
            for url in others.exclude(linkedin_url="").values_list("linkedin_url", flat=True)
        )
        checks.append(
            check("unique_linkedin", "LinkedIn link not used by another account", not duplicate_link, required=False)
        )

    texts = {"Name": user.get_full_name(), "Headline": profile.headline, "About": profile.bio}
    if profile.role == Profile.ROLE_RECRUITER:
        texts["Company"] = profile.company_name
    placeholders = [label for label, value in texts.items() if value.strip() and looks_like_placeholder(value)]
    checks.append(
        check("real_text", "No placeholder text", not placeholders, required=False, detail=", ".join(placeholders))
    )

    if profile.role == Profile.ROLE_RECRUITER:
        checks.append(
            check(
                "company_website",
                "Company website given",
                profile.company_website.strip(),
                required=False,
                detail=profile.company_website or "Ask for one if you can't verify the company",
            )
        )
    return checks


def can_be_approved(checks):
    return all(item["passed"] for item in checks if item["required"])


# =============================================================================
# Layer 3: who appears in recruiter search (checked on EVERY search)
# =============================================================================


def searchable_candidates():
    """
    Candidates a recruiter may find:
      - account switched on (a suspended or deleted person vanishes at once)
      - approved by an admin (pending and rejected people are hidden)
      - still has a CV and a LinkedIn link (removed after approval? hidden until fixed)
      - not a Django developer account
    """
    return Profile.objects.filter(
        role=Profile.ROLE_CANDIDATE,
        approval_status=Profile.APPROVAL_APPROVED,
        user__is_active=True,
        user__is_staff=False,
        user__is_superuser=False,
    ).exclude(Q(cv_file="") | Q(cv_file__isnull=True) | Q(linkedin_url=""))
