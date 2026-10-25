"""Class results for faculty (their own tests) and admin (all tests). Pass mark is 40%."""
from collections import defaultdict

from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from common.constants import Role

from .attempts import PASS_PERCENT
from .models import Attempt, AttemptAnswer, Test
from .views import IsStaff


def _pct(score, total):
    return round(score * 100 / total) if total else 0


def _tests_for(user):
    qs = Test.objects.select_related("branch")
    return qs if user.role == Role.ADMIN else qs.filter(created_by=user)


def _done_attempts(tests):
    return Attempt.objects.filter(test__in=tests, submitted_at__isnull=False).select_related("student", "test")


class PerformanceSummaryView(APIView):
    """Totals, class average, pass rate, weak topics and a per-test trend."""
    permission_classes = [IsStaff]

    def get(self, request):
        tests = list(_tests_for(request.user))
        attempts = list(_done_attempts(tests))
        percents = [_pct(a.score, a.total) for a in attempts]
        by_test = defaultdict(list)
        for a in attempts:
            by_test[a.test_id].append(_pct(a.score, a.total))
        topics = defaultdict(lambda: [0, 0])
        for row in AttemptAnswer.objects.filter(attempt__in=[a.id for a in attempts]).select_related("question__topic"):
            t = topics[row.question.topic.name]
            t[1] += 1
            t[0] += 1 if row.is_correct else 0
        weak = sorted(({"name": n, "percent": _pct(c, t), "answers": t} for n, (c, t) in topics.items()), key=lambda x: x["percent"])
        tests_sorted = sorted(tests, key=lambda t: (t.scheduled_date, t.start_time))
        trend = [{"test": t.name, "date": t.scheduled_date, "average": round(sum(by_test[t.id]) / len(by_test[t.id]))} for t in tests_sorted if by_test.get(t.id)][-7:]
        recent = [{"id": t.id, "name": t.name, "date": t.scheduled_date, "assigned": t.assignments.count(), "attempts": len(by_test.get(t.id, [])),
                   "average": round(sum(by_test[t.id]) / len(by_test[t.id])) if by_test.get(t.id) else None, "status": t.status}
                  for t in sorted(tests, key=lambda t: (t.scheduled_date, t.start_time), reverse=True)[:20]]
        assigned = set()
        for t in tests:
            assigned.update(t.assignments.values_list("student_id", flat=True))
        return Response({
            "tests": len(tests), "students_assigned": len(assigned), "attempts": len(attempts),
            "average": round(sum(percents) / len(percents)) if percents else None,
            "pass_rate": round(sum(1 for p in percents if p >= PASS_PERCENT) * 100 / len(percents)) if percents else None,
            "weak_topics": weak[:8], "trend": trend, "recent": recent,
        })


class TestResultsView(APIView):
    """Every assigned student for one test: their score, or 'not attempted'."""
    permission_classes = [IsStaff]

    def get(self, request, pk):
        try:
            test = _tests_for(request.user).get(pk=pk)
        except Test.DoesNotExist:
            raise NotFound("Test not found.")
        done = {a.student_id: a for a in Attempt.objects.filter(test=test).select_related("student")}
        rows = []
        for asg in test.assignments.select_related("student"):
            a = done.get(asg.student_id)
            finished = bool(a and a.submitted_at)
            rows.append({"student_id": asg.student_id, "student_name": asg.student.full_name, "login_id": asg.student.login_id,
                         "status": "SUBMITTED" if finished else ("IN_PROGRESS" if a else "NOT_ATTEMPTED"),
                         "score": a.score if finished else None, "total": a.total if finished else None,
                         "percent": _pct(a.score, a.total) if finished else None, "passed": _pct(a.score, a.total) >= PASS_PERCENT if finished else None})
        rows.sort(key=lambda r: (r["percent"] is None, -(r["percent"] or 0), r["student_name"]))
        taken = [r["percent"] for r in rows if r["percent"] is not None]
        return Response({"test": {"id": test.id, "name": test.name, "date": test.scheduled_date, "status": test.status},
                         "average": round(sum(taken) / len(taken)) if taken else None, "results": rows})


class StudentPerformanceView(APIView):
    """Average score and tests taken for each student, over the requester's tests. Used by the Students page."""
    permission_classes = [IsStaff]

    def get(self, request):
        tests = list(_tests_for(request.user))
        stats = defaultdict(list)
        for a in _done_attempts(tests):
            stats[a.student_id].append(_pct(a.score, a.total))
        return Response({str(sid): {"tests_taken": len(v), "average": round(sum(v) / len(v)), "needs_help": round(sum(v) / len(v)) < PASS_PERCENT} for sid, v in stats.items()})
