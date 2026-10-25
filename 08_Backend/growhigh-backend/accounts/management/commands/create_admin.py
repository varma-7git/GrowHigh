"""Create the first Admin.  python manage.py create_admin admin --password "Admin@12345" """
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = "Create the first Admin user"

    def add_arguments(self, parser):
        parser.add_argument("login_id")
        parser.add_argument("--password", required=True)
        parser.add_argument("--name", default="Admin")
        parser.add_argument("--email", default=None)

    def handle(self, *args, **o):
        if User.objects.filter(login_id=o["login_id"]).exists():
            raise CommandError("This login ID already exists.")
        User.objects.create_superuser(o["login_id"], o["password"], full_name=o["name"], email=o["email"])
        self.stdout.write(self.style.SUCCESS(f"Admin '{o['login_id']}' created."))
