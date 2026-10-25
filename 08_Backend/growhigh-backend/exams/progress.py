"""A student's own progress: syllabus coverage, practice activity for the last 7 days and the study streak."""
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import Material, MaterialDone, Subject
from academics.views import guide_progress

from .attempts import IsStudent
from .models import Attempt, Test

DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class StudentProgressView(APIView):
    permission_classes = [IsStudent]

    def get(self, request):
        user = request.user
        prof = getattr(user, "student_profile", None)
        branch = getattr(prof, "branch_id", None)
        regulation = getattr(prof, "regulation_id", None)
        subjects = Subject.objects.filter(is_active=True).filter(Q(branch__isnull=True) | Q(branch_id=branch)).filter(Q(regulation__isnull=True) | Q(regulation_id=regulation))
        mats = Material.objects.filter(is_active=True, topic__is_active=True, topic__subject__in=subjects)
        total = mats.count()
        done = MaterialDone.objects.filter(user=user, material__in=mats).count()

        today = timezone.localdate()
        attempts = list(Attempt.objects.filter(student=user, submitted_at__isnull=False))
        by_day = {}
        for a in attempts:
            d = timezone.localtime(a.submitted_at).date()
            by_day[d] = by_day.get(d, 0) + a.total
        week = [{"day": DAY[(today - timedelta(days=i)).weekday()], "date": str(today - timedelta(days=i)), "questions": by_day.get(today - timedelta(days=i), 0)} for i in range(6, -1, -1)]
        streak, d = 0, today if today in by_day else today - timedelta(days=1)
        while d in by_day:
            streak += 1
            d -= timedelta(days=1)
        scored = [round(a.score * 100 / a.total) for a in attempts if a.total]
        finished = set(Attempt.objects.filter(student=user, test__isnull=False, submitted_at__isnull=False).values_list("test_id", flat=True))
        pending = [t for t in Test.objects.filter(assignments__student=user, is_active=True) if t.status != "ENDED" and t.id not in finished]
        gp = guide_progress(user)
        return Response({
            "job_prep": gp["JOB_PREP"], "career": gp["CAREER"],
            "materials_total": total, "materials_done": done, "ecet_percent": round(done * 100 / total) if total else 0,
            "attempts": len(attempts), "questions_answered": sum(a.total for a in attempts),
            "average": round(sum(scored) / len(scored)) if scored else None,
            "streak": streak, "week": week, "tests_pending": len(pending),
        })
