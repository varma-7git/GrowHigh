from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Send one test email to check the email settings: python manage.py send_test_email you@gmail.com"

    def add_arguments(self, parser):
        parser.add_argument("to")

    def handle(self, *args, **opts):
        self.stdout.write(f"Backend: {settings.EMAIL_BACKEND}")
        self.stdout.write(f"From:    {settings.DEFAULT_FROM_EMAIL}")
        send_mail("GrowHigh test email", "If you can read this, GrowHigh email works.", None, [opts["to"]])
        if "console" in settings.EMAIL_BACKEND:
            self.stdout.write(self.style.WARNING("No EMAIL_HOST_USER in .env, so the email was only printed above, not sent."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Sent to {opts['to']}. Check the inbox (and spam)."))
