from django.apps import AppConfig


class ProfilesConfig(AppConfig):
    name = "profiles"

    def ready(self):
        # Django calls ready() once at start-up. Importing the signals
        # file here switches them on (see profiles/signals.py).
        from . import signals  # noqa: F401
