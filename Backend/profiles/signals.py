"""
Signals = "when THIS happens, also do THAT", automatically.

Here: when a Profile is deleted, delete its CV file from the disk too.

Why a signal and not code in each view? A profile can be deleted in many
ways: the user deletes their account, an admin deletes the user in the
Django admin, or a half-finished sign-up is cleaned up. Deleting a user
deletes the profile with it ("cascade"). The signal runs in EVERY case,
so no CV file is ever left behind.

It is switched on in profiles/apps.py (the `ready` method).
"""

from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Profile


@receiver(post_delete, sender=Profile)
def delete_cv_file_with_profile(sender, instance, **kwargs):
    if instance.cv_file:
        # save=False: the profile row is already gone, so don't try to save it.
        instance.cv_file.delete(save=False)
