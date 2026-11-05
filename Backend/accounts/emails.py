"""
Emails about the account itself (not codes): "your account is deleted",
"it will be deleted for good in 7 days / 24 hours".

Like the code emails, each goes out as plain text AND a designed HTML
version (templates/accounts/emails/account_notice.html).
"""

import logging
from smtplib import SMTPException

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

from .account_state import nice_date

logger = logging.getLogger(__name__)

# The sign-in page of the website (restoring happens there).
SIGNIN_PATH = "/signin"


def account_emails(until):
    """The texts for each kind of email. `until` = the last day to restore."""
    day = nice_date(until)
    return {
        "deleted": {
            "subject": "Your account is deleted",
            "lines": [
                "We've deleted your account, as you asked. Your profile is hidden from everyone.",
                f"Changed your mind? Sign in before {day} and choose \"Restore my account\". "
                "After that date, everything is deleted for good.",
            ],
        },
        "warning": {
            "subject": f"Your account will be deleted for good on {day}",
            "lines": [
                f"Your deleted account can still be restored until {day}.",
                "To keep it, sign in and choose \"Restore my account\". "
                "If you do nothing, your profile, messages and CV are deleted for good.",
            ],
        },
    }


def send_account_email(user, kind, until):
    """Send one account email. Returns True if it was sent."""
    email = account_emails(until)[kind]
    link = f"{settings.FRONTEND_URL}{SIGNIN_PATH}"

    html = render_to_string(
        "accounts/emails/account_notice.html",
        {
            "app_name": settings.EMAIL_SENDER_NAME,
            "heading": email["subject"],
            "lines": email["lines"],
            "button_text": "Sign in to restore",
            "button_link": link,
        },
    )
    text = "\n\n".join([*email["lines"], f"Sign in: {link}"])

    try:
        send_mail(
            subject=email["subject"],
            message=text,
            html_message=html,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except (OSError, SMTPException):
        logger.exception("Failed to send the %s account email", kind)
        return False
    return True
