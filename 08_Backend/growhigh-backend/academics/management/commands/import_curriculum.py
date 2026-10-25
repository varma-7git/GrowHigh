"""Load diploma subjects and topics for one regulation and branch from a JSON file.

Run:  python manage.py import_curriculum --file seed/curriculum_C23_CSE.json
Safe to run again: existing subjects and topics are not duplicated.

File format (see seed/curriculum_template.json):
{
  "regulation": "C23", "branch": "CSE",
  "semesters": { "1": [ {"name": "Subject name", "code": "CS-101", "marks": 100, "topics": ["Topic 1", "Topic 2"]} ] }
}
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from academics.models import Branch, Regulation, Subject, Topic


class Command(BaseCommand):
    help = "Import subjects and topics for a regulation and branch from a JSON file"

    def add_arguments(self, parser):
        parser.add_argument("--file", required=True)

    def handle(self, *args, **opts):
        path = Path(opts["file"])
        if not path.exists():
            raise CommandError(f"File not found: {path}")
        data = json.loads(path.read_text(encoding="utf-8"))
        reg, _ = Regulation.objects.get_or_create(code=data["regulation"].strip().upper())
        try:
            branch = Branch.objects.get(code__iexact=data["branch"].strip())
        except Branch.DoesNotExist:
            raise CommandError(f"Branch code {data['branch']} not found. Add it in the admin first.")
        ns = nt = 0
        for sem, subjects in data["semesters"].items():
            for s in subjects:
                if s["name"].upper().startswith("REPLACE"):
                    continue
                subj, created = Subject.objects.get_or_create(
                    regulation=reg, branch=branch, name=s["name"].strip(),
                    defaults={"semester": int(sem), "code": s.get("code") or None, "marks": s.get("marks")})
                ns += created
                for i, t in enumerate(s.get("topics", []), start=1):
                    _, c = Topic.objects.get_or_create(subject=subj, name=t.strip(), defaults={"order_no": i})
                    nt += c
        self.stdout.write(self.style.SUCCESS(f"Done. New: {ns} subjects, {nt} topics for {reg.code} {branch.code}."))
