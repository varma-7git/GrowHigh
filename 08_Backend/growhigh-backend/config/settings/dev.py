import os

from .base import *  # noqa

DEBUG = True

if os.getenv("EMAIL_HOST_USER"):
    # Real emails (forgot password, admin alerts). Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.environ["EMAIL_HOST_USER"]
    EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
    DEFAULT_FROM_EMAIL = f"GrowHigh <{EMAIL_HOST_USER}>"
else:
    # No email settings: emails are printed in the terminal
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
