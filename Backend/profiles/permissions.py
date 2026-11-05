"""
"Who may see what" rules about profiles, written in ONE place.
Views, serializers and the recruiter app all use these, so the rules can
never disagree.

TWO KINDS OF "ADMIN" (kept apart on purpose)
  - App admin:    profile.role == "admin". Uses OUR admin page (/admin in
                  the frontend): users, recruiter approvals, connections,
                  page texts. Made with `python manage.py create_admin`.
  - Django admin: user.is_staff / is_superuser. Only for developers, on
                  Django's built-in site (backend /admin/). Made with
                  `python manage.py createsuperuser`.
Being one never makes you the other.
"""

from rest_framework.permissions import BasePermission

from .models import Profile


def role_of(user):
    """The user's role in the app: "candidate", "recruiter" or "admin"."""
    profile = getattr(user, "profile", None)  # None if there's no profile
    return profile.role if profile else Profile.ROLE_CANDIDATE


def is_app_admin(user):
    """Signed in, switched on, and the profile says "admin"."""
    return (
        getattr(user, "is_authenticated", False)
        and user.is_active
        and role_of(user) == Profile.ROLE_ADMIN
    )


def is_django_only_account(user):
    """
    A developer account for Django's built-in site, not an app account.
    These may not sign in to the app (see accounts/views.py signin).
    """
    return (user.is_staff or user.is_superuser) and not is_app_admin(user)


class IsAppAdmin(BasePermission):
    """For DRF views: only app admins. (Not DRF's IsAdminUser: that checks is_staff.)"""

    message = "Only admins can do this."

    def has_permission(self, request, view):
        return is_app_admin(request.user)


def is_approved_recruiter(user):
    """A recruiter that an admin has approved."""
    profile = getattr(user, "profile", None)  # None if there's no profile
    return (
        profile is not None
        and profile.role == Profile.ROLE_RECRUITER
        and profile.recruiter_verification_status == Profile.RECRUITER_VERIFICATION_APPROVED
    )


def can_view_cv(viewer, profile):
    """
    May `viewer` open the CV of `profile`?

    YES for:
      - the CV's owner
      - app admins
      - approved recruiters (finding candidates is their job)
      - people connected to the candidate
    NO for everyone else, because a CV holds private details
    (phone number, address...).
    """
    if not viewer.is_authenticated:
        return False

    if viewer.pk == profile.user_id or is_app_admin(viewer):
        return True

    if is_approved_recruiter(viewer):
        return True

    # Imported here (not at the top) because the connections app also
    # imports profiles; importing late avoids a "circular import".
    from connections.network import are_connected

    return are_connected(viewer, profile.user)
