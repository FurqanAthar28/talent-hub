from django.core.exceptions import ImproperlyConfigured
from django.db import models


class UiContent(models.Model):
    """
    Text shown in the app (buttons, messages, emails) that admins can edit
    without changing code. One row = one piece of text, found by its `key`.
    """

    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()

    def __str__(self):
        return self.key

    @classmethod
    def get_text(cls, key, default=None):
        """
        Read one text by its key, for example UiContent.get_text("signinFailed").

        If the key is missing:
        - with a `default`, use the default;
        - without one, stop with a clear error, so a missing text is noticed
          right away instead of showing users an empty message.

        (`classmethod` means we call it on the class itself: UiContent.get_text.)
        """
        try:
            return cls.objects.get(key=key).value
        except cls.DoesNotExist as exc:
            if default is not None:
                return default
            raise ImproperlyConfigured(f"Missing backend UI content: {key}") from exc
