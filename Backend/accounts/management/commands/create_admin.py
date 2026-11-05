"""
Make an APP admin: someone who uses the app's own admin page
(approve recruiters, switch accounts on/off, change roles, edit page texts).

    python manage.py create_admin
    python manage.py create_admin --email admin@site.com --name "Sara Khan"
    python manage.py create_admin --email ali@site.com --promote   (an existing account)

This is NOT Django's `createsuperuser`. An app admin:
  - signs in on the app's normal Sign in page (email + password),
  - is NOT Django staff, so Django's built-in /admin/ site stays closed to them.

The password is always typed (hidden), never passed on the command line,
so it doesn't end up in your terminal history.
"""

from getpass import getpass

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction

from profiles.models import Profile
from profiles.serializers import split_full_name

DEFAULT_TITLE = "Platform admin"


class Command(BaseCommand):
    help = "Create an app admin (or make an existing account an admin with --promote)."

    def add_arguments(self, parser):
        parser.add_argument("--email", help="The admin's email. They sign in with it.")
        parser.add_argument("--name", help='Full name, e.g. "Sara Khan".')
        parser.add_argument("--title", default=DEFAULT_TITLE, help=f'Shown on their profile (default "{DEFAULT_TITLE}").')
        parser.add_argument(
            "--promote",
            action="store_true",
            help="The email already has an account: make it an admin (keeps its password).",
        )

    def handle(self, *args, **options):
        email = (options["email"] or input("Email: ")).strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            raise CommandError(f'"{email}" is not a valid email address.') from None

        existing = User.objects.filter(email__iexact=email).first()

        if existing and options["promote"]:
            self.promote(existing, options["title"])
            return
        if existing:
            raise CommandError(
                f"{email} already has an account. To make it an admin, run:\n"
                f"  python manage.py create_admin --email {email} --promote"
            )
        if options["promote"]:
            raise CommandError(f"No account uses {email}, so there is nothing to promote.")

        name = (options["name"] or input("Full name: ")).strip()
        if not name:
            raise CommandError("Please give a name.")

        password = self.ask_password(email, name)
        first_name, last_name = split_full_name(name)

        # atomic = save the user AND the profile, or neither.
        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_active=True,  # no email code needed: you made it yourself
                is_staff=False,  # NOT a Django-site account
                is_superuser=False,
            )
            Profile.objects.create(
                user=user,
                role=Profile.ROLE_ADMIN,
                admin_title=options["title"],
                email_verified=True,
            )

        self.stdout.write(self.style.SUCCESS(f"Admin created. Sign in on the app with {email}."))

    def promote(self, user, title):
        profile, _created = Profile.objects.get_or_create(user=user)
        profile.role = Profile.ROLE_ADMIN
        profile.admin_title = profile.admin_title or title
        profile.email_verified = True
        profile.save(update_fields=["role", "admin_title", "email_verified"])

        user.is_active = True
        user.save(update_fields=["is_active"])
        self.stdout.write(self.style.SUCCESS(f"{user.email} is now an admin. They keep their password."))

    def ask_password(self, email, name):
        """Ask twice (hidden), and use Django's password rules from settings.py."""
        password = getpass("Password: ")
        if password != getpass("Password (again): "):
            raise CommandError("The two passwords are different. Nothing was created.")

        # Check against the rules WITH the email and name, so "sara1234" for
        # Sara is refused ("too similar to the name").
        first_name, last_name = split_full_name(name)
        try:
            validate_password(password, User(username=email, email=email, first_name=first_name, last_name=last_name))
        except ValidationError as error:
            raise CommandError(" ".join(error.messages)) from None
        return password
