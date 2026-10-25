from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from common.constants import Role
from common.exceptions import Conflict
from common.mixins import SafeDeleteMixin

from . import attempts as at
from .models import Question, Test, TestAssignment
from .serializers import QuestionSerializer, RosterSerializer, TestSerializer


class IsStaff(BasePermission):
    """Admin or faculty."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role in (Role.ADMIN, Role.FACULTY))


class _OwnerMixin:
    """Faculty change or delete only what they created; admin can change anything."""

    def get_object(self):
        obj = super().get_object()
        if self.action in ("update", "partial_update", "destroy") and self.request.user.role == Role.FACULTY and obj.created_by_id != self.request.user.id:
            raise PermissionDenied("You can change only what you created.")
        return obj

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class QuestionViewSet(_OwnerMixin, SafeDeleteMixin, viewsets.ModelViewSet):
    """The question bank. Faculty and admin only: students never see questions or answers outside a test."""
    serializer_class = QuestionSerializer
    permission_classes = [IsStaff]
    queryset = Question.objects.none()
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    delete_hint = "Hide it instead so existing tests keep working."

    def get_queryset(self):
        qs = Question.objects.select_related("topic__subject", "created_by")
        p = self.request.query_params
        if p.get("topic", "").isdigit():
            qs = qs.filter(topic_id=int(p["topic"]))
        if p.get("subject", "").isdigit():
            qs = qs.filter(topic__subject_id=int(p["subject"]))
        if p.get("mine") in ("1", "true"):
            qs = qs.filter(created_by=self.request.user)
        if p.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=p["is_active"] == "true")
        elif self.request.user.role == Role.FACULTY:
            qs = qs.filter(Q(is_active=True) | Q(created_by=self.request.user))
        if p.get("search"):
            qs = qs.filter(Q(text__icontains=p["search"]) | Q(topic__name__icontains=p["search"]))
        return qs


class TestViewSet(_OwnerMixin, SafeDeleteMixin, viewsets.ModelViewSet):
    """Create and schedule tests. Faculty see their own tests, admin sees all, a student sees only tests assigned to them."""
    serializer_class = TestSerializer
    queryset = Test.objects.none()
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        if self.action == "start":
            return [at.IsStudent()]
        return [IsStaff()]

    def get_queryset(self):
        user = self.request.user
        qs = Test.objects.select_related("branch", "created_by")
        if user.role == Role.STUDENT:
            qs = qs.filter(assignments__student=user, is_active=True)
        elif user.role == Role.FACULTY:
            qs = qs.filter(created_by=user)
        elif user.role != Role.ADMIN:
            qs = qs.none()
        p = self.request.query_params
        if p.get("test_type"):
            qs = qs.filter(test_type=p["test_type"].upper())
        if p.get("search"):
            qs = qs.filter(name__icontains=p["search"])
        return qs

    def perform_update(self, serializer):
        if serializer.instance.status != "UPCOMING" and serializer.validated_data.get("question_ids") is not None:
            raise Conflict("Questions cannot be changed after the test has started.")
        serializer.save()

    @action(detail=True, methods=["post"], permission_classes=[at.IsStudent])
    def start(self, request, pk=None):
        """A student begins (or resumes) an assigned test. One attempt only."""
        test = self.get_object()
        return Response(at.run_payload(at.start_test(request.user, test)))

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """Body: {"student_ids": [..]}. Replaces the list of students who have this test."""
        test = self.get_object()
        if request.user.role == Role.FACULTY and test.created_by_id != request.user.id:
            raise PermissionDenied("You can assign only your own tests.")
        ids = request.data.get("student_ids")
        if not isinstance(ids, list):
            return Response({"detail": "Send student_ids as a list.", "errors": {"student_ids": ["Select at least one student."]}}, status=400)
        students = User.objects.filter(pk__in=ids, role=Role.STUDENT, is_active=True, student_profile__isnull=False)
        if test.branch_id:
            students = students.filter(student_profile__branch_id=test.branch_id)
        if test.year_of_study:
            students = students.filter(student_profile__year_of_study=test.year_of_study)
        valid = set(students.values_list("pk", flat=True))
        if set(ids) - valid:
            return Response({"detail": "Some students do not belong to this test's branch and year.", "errors": {"student_ids": ["Choose students from the test's branch and year."]}}, status=400)
        keep = set(test.assignments.values_list("student_id", flat=True))
        TestAssignment.objects.filter(test=test).exclude(student_id__in=valid).delete()
        TestAssignment.objects.bulk_create([TestAssignment(test=test, student_id=s) for s in valid - keep])
        return Response({"assigned": len(valid)})


class RosterView(generics.ListAPIView):
    """Students that faculty can pick from. Filter with ?branch=, ?year_of_study=, ?search=."""
    permission_classes = [IsStaff]
    serializer_class = RosterSerializer

    def get_queryset(self):
        qs = User.objects.filter(role=Role.STUDENT, is_active=True, student_profile__isnull=False).select_related("student_profile__branch", "student_profile__regulation").order_by("full_name")
        p = self.request.query_params
        if p.get("branch", "").isdigit():
            qs = qs.filter(student_profile__branch_id=int(p["branch"]))
        if p.get("year_of_study", "").isdigit():
            qs = qs.filter(student_profile__year_of_study=int(p["year_of_study"]))
        if p.get("search"):
            qs = qs.filter(Q(full_name__icontains=p["search"]) | Q(login_id__icontains=p["search"]))
        return qs
