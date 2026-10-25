"""Load the 14 AP ECET branches and the common subjects with topics.

Run:  python manage.py seed_academics
Safe to run again: existing rows are not duplicated.
"""
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from academics.models import Branch, Regulation, Subject, Topic

BRANCH_CODES = {
    "Ceramic Technology": "CT",
    "Chemical Engineering": "CHE",
    "Civil Engineering": "CE",
    "Computer Science and Engineering": "CSE",
    "Electrical and Electronics Engineering": "EEE",
    "Electronics and Communication Engineering": "ECE",
    "Electronics and Instrumentation": "EIE",
    "Mechanical Engineering": "ME",
    "Metallurgical Engineering": "MET",
    "Mining Engineering": "MIN",
    "Pharmacy": "PHARM",
    "Agricultural Engineering": "AGR",
    "BioTechnology": "BT",
    "B.Sc Mathematics": "BSCM",
}


class Command(BaseCommand):
    help = "Seed branches, common subjects and topics from seed/ap_ecet_seed.json"

    def add_arguments(self, parser):
        parser.add_argument("--file", default=str(Path(settings.BASE_DIR) / "seed" / "ap_ecet_seed.json"))

    def handle(self, *args, **opts):
        path = Path(opts["file"])
        if not path.exists():
            raise CommandError(f"Seed file not found: {path}")
        data = json.loads(path.read_text(encoding="utf-8"))

        for code in ("C20", "C23", "C26"):
            Regulation.objects.get_or_create(code=code)
        nb = 0
        for name in data["branches"]:
            code = BRANCH_CODES.get(name) or "".join(w[0] for w in name.split()).upper()[:10]
            _, created = Branch.objects.get_or_create(name=name, defaults={"code": code})
            nb += created

        ns = nt = 0
        for s in data["subjects"]:  # Mathematics, Physics, Chemistry are common to all branches
            subject, created = Subject.objects.get_or_create(branch=None, regulation=None, name=s["name"])
            ns += created
            for i, topic in enumerate(s.get("topics", []), start=1):
                _, c = Topic.objects.get_or_create(subject=subject, name=topic, defaults={"order_no": i})
                nt += c

        self.stdout.write(self.style.SUCCESS(f"Done. New: {nb} branches, {ns} subjects, {nt} topics."))
