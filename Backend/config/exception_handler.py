"""
Make every API error look the same.

Our own views answer errors like this:     {"message": "Sign in failed"}
But DRF's built-in errors look different:
    {"detail": "Request was throttled."}         (rate limit, CSRF, login...)
    {"email": ["Email already exists"]}          (a serializer error)

The frontend shows `data.message`, so this file makes sure every error
has a "message". The original fields stay too, so nothing that reads
them breaks.

It is switched on in settings.py: REST_FRAMEWORK -> "EXCEPTION_HANDLER".

Views can also call first_error_message(serializer.errors) themselves.
"""

from rest_framework.views import exception_handler
from django.http import JsonResponse
import logging

logger = logging.getLogger(__name__)

# Friendly names for form fields, used in messages like "Email: ...".
# One list for the whole API. Add new fields here.
FIELD_LABELS = {
    "fullName": "Full name",
    "email": "Email",
    "password": "Password",
    "role": "Role",
    "headline": "Headline",
    "location": "Location",
    "bio": "Bio",
    "linkedinUrl": "LinkedIn URL",
    "githubUrl": "GitHub URL",
    "portfolioUrl": "Portfolio URL",
    "companyName": "Company name",
    "companyWebsite": "Company website URL",
    "companyLocation": "Company location",
    "hiringTitle": "Hiring title",
    "companyAbout": "About the company",
    "companyIndustry": "Industry",
    "companySize": "Company size",
    "companyLinkedinUrl": "Company LinkedIn",
    "workStyles": "Work style",
    "hiringRoles": "Roles you hire for",
    "hiringSkills": "Skills you look for",
    "hiringLocations": "Hiring locations",
    "hiringLevels": "Experience levels",
    "employmentType": "Job type",
    "workStyle": "Work style",
    "experienceLevel": "Experience level",
    "salary": "Salary",
    "skills": "Skills",
    "notes": "Notes",  # "Write with AI" on the job form
    "adminTitle": "Admin title",
    "cvFile": "CV",
    "otp": "OTP",
    "name": "Name",
    "title": "Title",
    "company": "Company",
    "description": "Description",
    "tech_stack": "Tech stack",
    "github_url": "GitHub URL",
    "start_date": "Start date",
    "end_date": "End date",
}


def first_error_message(errors):
    """
    Turn DRF's error data into ONE short sentence for the user.

    {"email": ["Enter a valid email address."]}
        -> "Email: Enter a valid email address."
    {"non_field_errors": ["Something is wrong."]}
        -> "Something is wrong."
    """
    for field, problems in errors.items():
        # Errors usually come as a list. Take the first one.
        if isinstance(problems, list) and problems:
            problem = problems[0]
        # Sometimes they come as a dict (nested fields). Take the first value.
        elif isinstance(problems, dict) and problems:
            problem = next(iter(problems.values()))
            if isinstance(problem, list) and problem:
                problem = problem[0]
        else:
            problem = problems

        if field == "non_field_errors":
            return str(problem)

        label = FIELD_LABELS.get(field, field)
        return f"{label}: {problem}"

    return "Invalid request"


def api_exception_handler(exc, context):
    # Let DRF build its normal error response first.
    response = exception_handler(exc, context)

    # response is None for crashes DRF doesn't know about (real bugs).
    # Django then shows its normal 500 error, and the error is logged.
    if response is None:
        return None

    data = response.data

    if not isinstance(data, dict) or "message" in data:
        return response

    if "detail" in data:
        data["message"] = str(data["detail"])
    else:
        data["message"] = first_error_message(data)

    return response


def json_500(request, *args, **kwargs):
    """Keep browser-facing crashes out of Django's HTML error pages."""
    logger.exception("Unhandled API server error", extra={"request_path": request.path})
    return JsonResponse(
        {"message": "Internal server error.", "detail": "An unexpected server error occurred."},
        status=500,
    )
