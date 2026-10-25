"""Starting, saving, grading and presenting attempts. Questions are sent without answers until the attempt is submitted."""
import random
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from common.constants import Role
from common.exceptions import Conflict

from .models import Attempt, AttemptAnswer, Question

GRACE = timedelta(seconds=60)  # network delay allowed when the timer ends
PASS_PERCENT = 40


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == Role.STUDENT)


def remaining(attempt):
    if not attempt.deadline:
        return None
    return max(0, int((attempt.deadline - timezone.now()).total_seconds()))


def finalize(attempt, answers=None):
    """Grade and close the attempt. `answers` is {question_id: selected}. Safe to call twice."""
    if attempt.submitted_at:
        return attempt
    with transaction.atomic():
        rows = list(attempt.answers.select_related("question"))
        late = attempt.deadline and timezone.now() > attempt.deadline + GRACE
        for r in rows:
            if answers and not late and str(r.question_id) in {str(k) for k in answers}:
                val = {str(k): v for k, v in answers.items()}[str(r.question_id)]
                r.selected = val if val in (0, 1, 2, 3) else None
            r.is_correct = r.selected is not None and r.selected == r.question.correct
            r.save(update_fields=["selected", "is_correct"])
        attempt.score = sum(1 for r in rows if r.is_correct)
        attempt.total = len(rows)
        attempt.submitted_at = timezone.now()
        attempt.save(update_fields=["score", "total", "submitted_at"])
    return attempt


def close_if_expired(attempt):
    if not attempt.submitted_at and attempt.deadline and timezone.now() > attempt.deadline + GRACE:
        finalize(attempt)


def question_payload(attempt):
    return [{"id": a.question_id, "text": a.question.text, "options": a.question.options, "topic_name": a.question.topic.name, "selected": a.selected}
            for a in attempt.answers.select_related("question__topic")]


def run_payload(attempt):
    return {"id": attempt.id, "title": attempt.title, "kind": "TEST" if attempt.test_id else "PRACTICE", "submitted": False,
            "remaining_seconds": remaining(attempt), "questions": question_payload(attempt)}


def result_payload(attempt):
    rows = list(attempt.answers.select_related("question__topic"))
    topics = {}
    for r in rows:
        t = topics.setdefault(r.question.topic.name, [0, 0])
        t[1] += 1
        t[0] += 1 if r.is_correct else 0
    pct = round(attempt.score * 100 / attempt.total) if attempt.total else 0
    return {
        "id": attempt.id, "title": attempt.title, "kind": "TEST" if attempt.test_id else "PRACTICE", "submitted": True,
        "submitted_at": attempt.submitted_at, "score": attempt.score, "total": attempt.total, "percent": pct, "passed": pct >= PASS_PERCENT,
        "topics": [{"name": n, "correct": c, "total": t, "percent": round(c * 100 / t)} for n, (c, t) in topics.items()],
        "review": [{"id": r.question_id, "text": r.question.text, "options": r.question.options, "correct": r.question.correct, "selected": r.selected,
                    "is_correct": r.is_correct, "explanation": r.question.explanation, "topic_name": r.question.topic.name} for r in rows],
    }


def start_test(user, test):
    from .models import Test
    if test.status == "UPCOMING":
        raise Conflict(f"This test opens on {test.scheduled_date:%d %b} at {test.start_time:%H:%M}.")
    existing = Attempt.objects.filter(test=test, student=user).first()
    if existing:
        close_if_expired(existing)
        existing.refresh_from_db()
        if existing.submitted_at:
            raise Conflict("You have already taken this test. Each test allows one attempt.")
        return existing
    if test.status == "ENDED":
        raise Conflict("This test has ended.")
    items = list(test.items.select_related("question"))
    if not items:
        raise Conflict("This test has no questions.")
    now = timezone.now()
    deadline = min(now + timedelta(minutes=test.duration_minutes), test.ends_at)
    with transaction.atomic():
        attempt = Attempt.objects.create(student=user, test=test, deadline=deadline, total=len(items))
        AttemptAnswer.objects.bulk_create([AttemptAnswer(attempt=attempt, question=i.question, order_no=n) for n, i in enumerate(items, start=1)])
    return attempt


def start_practice(user, topic, count):
    ids = list(Question.objects.filter(topic=topic, is_active=True).values_list("pk", flat=True))
    if not ids:
        raise Conflict("There are no practice questions for this topic yet.")
    picked = random.sample(ids, min(count, len(ids)))
    with transaction.atomic():
        attempt = Attempt.objects.create(student=user, topic=topic, total=len(picked))
        AttemptAnswer.objects.bulk_create([AttemptAnswer(attempt=attempt, question_id=q, order_no=n) for n, q in enumerate(picked, start=1)])
    return attempt


MOCK_MAX = 200
MOCK_SECONDS_PER_QUESTION = 54  # 200 questions in 3 hours


def _start_set(user, picked, label, timed=False):
    deadline = timezone.now() + timedelta(seconds=MOCK_SECONDS_PER_QUESTION * len(picked)) if timed else None
    with transaction.atomic():
        attempt = Attempt.objects.create(student=user, label=label, deadline=deadline, total=len(picked))
        AttemptAnswer.objects.bulk_create([AttemptAnswer(attempt=attempt, question_id=q, order_no=n) for n, q in enumerate(picked, start=1)])
    return attempt


def start_mock(user):
    """Timed mock from the ECET subjects (no regulation) that apply to the student's branch, up to 200 questions."""
    from academics.models import Subject
    branch = getattr(getattr(user, "student_profile", None), "branch_id", None)
    subjects = Subject.objects.filter(is_active=True, regulation__isnull=True).filter(Q(branch__isnull=True) | Q(branch_id=branch))
    ids = list(Question.objects.filter(is_active=True, topic__is_active=True, topic__subject__in=subjects).values_list("pk", flat=True))
    if not ids:
        raise Conflict("There are no mock test questions yet.")
    return _start_set(user, random.sample(ids, min(MOCK_MAX, len(ids))), "Mock test", timed=True)


def start_cumulative(user, subject, count=30):
    ids = list(Question.objects.filter(is_active=True, topic__is_active=True, topic__subject=subject).values_list("pk", flat=True))
    if not ids:
        raise Conflict("There are no questions for this subject yet.")
    return _start_set(user, random.sample(ids, min(count, len(ids))), f"Cumulative · {subject.name}")


def own_attempt(request, pk):
    try:
        attempt = Attempt.objects.select_related("test", "topic").get(pk=pk)
    except Attempt.DoesNotExist:
        raise NotFound("Attempt not found.")
    if attempt.student_id != request.user.id:
        raise PermissionDenied("This is not your attempt.")
    return attempt


class PracticeStartView(APIView):
    permission_classes = [IsStudent]

    def post(self, request):
        from academics.models import Subject, Topic
        kind = request.data.get("kind", "topic")
        if kind == "mock":
            return Response(run_payload(start_mock(request.user)), status=201)
        if kind == "cumulative":
            try:
                subject = Subject.objects.get(pk=int(request.data.get("subject_id")), is_active=True)
            except (Subject.DoesNotExist, TypeError, ValueError):
                return Response({"detail": "Choose a subject.", "errors": {"subject_id": ["Choose a subject."]}}, status=400)
            return Response(run_payload(start_cumulative(request.user, subject)), status=201)
        topic_id = request.data.get("topic_id")
        try:
            topic = Topic.objects.get(pk=int(topic_id), is_active=True)
        except (Topic.DoesNotExist, TypeError, ValueError):
            return Response({"detail": "Choose a topic.", "errors": {"topic_id": ["Choose a topic."]}}, status=400)
        try:
            count = max(1, min(int(request.data.get("count", 10)), 30))
        except (TypeError, ValueError):
            count = 10
        return Response(run_payload(start_practice(request.user, topic, count)), status=201)


class AttemptListView(APIView):
    permission_classes = [IsStudent]

    def get(self, request):
        rows = Attempt.objects.filter(student=request.user, submitted_at__isnull=False).select_related("test", "topic")
        return Response([{"id": a.id, "title": a.title, "kind": "TEST" if a.test_id else "PRACTICE", "submitted_at": a.submitted_at, "score": a.score, "total": a.total,
                          "percent": round(a.score * 100 / a.total) if a.total else 0} for a in rows[:200]])


class AttemptDetailView(APIView):
    """In progress: the questions without answers. Submitted: the full result with review."""
    permission_classes = [IsStudent]

    def get(self, request, pk):
        attempt = own_attempt(request, pk)
        close_if_expired(attempt)
        attempt.refresh_from_db()
        return Response(result_payload(attempt) if attempt.submitted_at else run_payload(attempt))


class AttemptAnswerView(APIView):
    permission_classes = [IsStudent]

    def post(self, request, pk):
        attempt = own_attempt(request, pk)
        close_if_expired(attempt)
        attempt.refresh_from_db()
        if attempt.submitted_at:
            raise Conflict("This attempt is already submitted.")
        sel = request.data.get("selected")
        if sel not in (0, 1, 2, 3, None):
            return Response({"detail": "Invalid option.", "errors": {"selected": ["Pick A, B, C or D."]}}, status=400)
        updated = AttemptAnswer.objects.filter(attempt=attempt, question_id=request.data.get("question_id")).update(selected=sel)
        if not updated:
            return Response({"detail": "That question is not in this attempt."}, status=400)
        return Response({"saved": True})


class AttemptSubmitView(APIView):
    permission_classes = [IsStudent]

    def post(self, request, pk):
        attempt = own_attempt(request, pk)
        answers = request.data.get("answers")
        finalize(attempt, answers if isinstance(answers, dict) else None)
        attempt.refresh_from_db()
        return Response(result_payload(attempt))
