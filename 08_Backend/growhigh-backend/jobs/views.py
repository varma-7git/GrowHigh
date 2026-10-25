from datetime import date

from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts import services
from common.constants import ReviewStatus, Role
from common.exceptions import Conflict
from common.permissions import IsAdmin, IsApprovedCompany, IsStudent
from common.serializers import RejectSerializer

from .models import Application, Job
from .serializers import ApplicantSerializer, JobSerializer, JobWriteSerializer, MyApplicationSerializer


def _by_branch(applications):
    """Counts of applicants per branch (course) for the given applications."""
    rows = (applications.values("student__student_profile__branch_id", "student__student_profile__branch__name")
            .annotate(count=Count("id")).order_by("-count", "student__student_profile__branch__name"))
    return [{"branch_id": r["student__student_profile__branch_id"],
             "branch_name": r["student__student_profile__branch__name"], "count": r["count"]} for r in rows]


class JobViewSet(viewsets.ModelViewSet):
    """Jobs and internships.
    Student/faculty: approved, open jobs (students only see jobs open to their branch).
    Company: its own jobs. Admin: everything."""
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    queryset = Job.objects.none()

    def get_permissions(self):
        if self.action in ("create", "partial_update", "applications", "application_stats"):
            return [(IsAdmin | IsApprovedCompany)()]
        if self.action in ("approve", "reject", "applications_summary", "destroy"):
            return [IsAdmin()]
        if self.action == "apply":
            return [IsStudent()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        job = self.get_object()
        if job.applications.exists():
            raise Conflict("Students have applied to this posting, so it cannot be removed. Close it instead.")
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_serializer_class(self):
        return JobWriteSerializer if self.action in ("create", "partial_update") else JobSerializer

    def get_queryset(self):
        u = self.request.user
        qs = (Job.objects.select_related("posted_by").prefetch_related("branches")
              .annotate(applicant_count=Count("applications", distinct=True),
                        has_applied=Exists(Application.objects.filter(job=OuterRef("pk"), student_id=u.id))))
        if u.role == Role.COMPANY:
            qs = qs.filter(posted_by=u)
        elif u.role != Role.ADMIN:
            qs = qs.filter(status=ReviewStatus.APPROVED, is_active=True).filter(
                Q(deadline__isnull=True) | Q(deadline__gte=date.today()))
            if u.role == Role.STUDENT:
                branch_id = u.student_profile.branch_id
                qs = qs.filter(Q(branches__isnull=True) | Q(branches__id=branch_id)).distinct()
        qs = qs.order_by("-created_at", "-id")  # stable order for pagination
        p = self.request.query_params
        if p.get("job_type", "").upper() in ("JOB", "INTERNSHIP"):
            qs = qs.filter(job_type=p["job_type"].upper())
        if p.get("status", "").upper() in ReviewStatus.values and u.role in (Role.ADMIN, Role.COMPANY):
            qs = qs.filter(status=p["status"].upper())
        if p.get("search"):
            qs = qs.filter(Q(title__icontains=p["search"]) | Q(company_name__icontains=p["search"]))
        return qs

    # ---- create / edit ----
    def create(self, request, *args, **kwargs):
        s = JobWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        u = request.user
        if u.role == Role.COMPANY:
            job = s.save(posted_by=u, company_name=u.company_profile.company_name, status=ReviewStatus.PENDING)
            services.notify_admins(
                f"New {job.get_job_type_display().lower()} to review: {job.title}",
                f"{job.company_name} posted '{job.title}' and it is waiting for your approval (Admin dashboard, Jobs).")
        else:  # admin: live at once
            if not s.validated_data.get("company_name"):
                return Response({"detail": "Validation error", "errors": {"company_name": ["This field is required."]}}, status=400)
            job = s.save(posted_by=u, status=ReviewStatus.APPROVED, reviewed_by=u, reviewed_at=timezone.now())
        return Response(self._read(job, request), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        job = self.get_object()  # a company only reaches its own jobs
        s = JobWriteSerializer(job, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        u = request.user
        extra = {}
        if u.role == Role.COMPANY:
            s.validated_data.pop("company_name", None)
            changed = set(s.validated_data) - {"is_active"}
            if changed:  # editing content sends the job back for review
                extra = {"status": ReviewStatus.PENDING, "rejection_reason": None, "reviewed_by": None, "reviewed_at": None}
        s.save(**extra)
        return Response(self._read(job, request))

    def _read(self, job, request):
        fresh = self.get_queryset().get(pk=job.pk)
        return JobSerializer(fresh, context={"request": request}).data

    # ---- review (admin) ----
    def _review(self, request, new_status, reason=None):
        job = self.get_object()
        job.status, job.rejection_reason = new_status, reason
        job.reviewed_by, job.reviewed_at = request.user, timezone.now()
        job.save()
        return Response(self._read(job, request))

    @extend_schema(request=None, responses=JobSerializer)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._review(request, ReviewStatus.APPROVED)

    @extend_schema(request=RejectSerializer, responses=JobSerializer)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        s = RejectSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._review(request, ReviewStatus.REJECTED, s.validated_data["reason"])

    # ---- student ----
    @extend_schema(request=None, responses={201: MyApplicationSerializer})
    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        job = self.get_object()  # only approved, open jobs for the student's branch are reachable
        app, created = Application.objects.get_or_create(job=job, student=request.user)
        if not created:
            raise Conflict("You have already applied to this job.")
        return Response(MyApplicationSerializer(app).data, status=status.HTTP_201_CREATED)

    # ---- applicants (admin, or the company that posted the job) ----
    @extend_schema(responses=ApplicantSerializer(many=True))
    @action(detail=True, methods=["get"])
    def applications(self, request, pk=None):
        job = self.get_object()
        qs = job.applications.select_related("student__student_profile__branch").order_by("-applied_at")
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(ApplicantSerializer(page, many=True).data)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["get"], url_path="application-stats")
    def application_stats(self, request, pk=None):
        job = self.get_object()
        apps = job.applications.all()
        return Response({"job_id": job.id, "title": job.title, "total": apps.count(), "by_branch": _by_branch(apps)})

    @extend_schema(parameters=[OpenApiParameter("job_type", str, description="JOB or INTERNSHIP")], responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["get"], url_path="applications-summary")
    def applications_summary(self, request):
        """Admin report: for each job or internship, how many students applied, split by branch (course)."""
        jobs = list(self.get_queryset().filter(status=ReviewStatus.APPROVED))
        result = []
        for j in jobs:
            apps = Application.objects.filter(job=j)
            result.append({"job_id": j.id, "title": j.title, "company_name": j.company_name, "job_type": j.job_type,
                           "total": j.applicant_count, "by_branch": _by_branch(apps)})
        return Response(result)


class MyApplicationsView(generics.ListAPIView):
    """Student: the jobs I applied to."""
    permission_classes = [IsStudent]
    serializer_class = MyApplicationSerializer

    def get_queryset(self):
        return Application.objects.filter(student=self.request.user).select_related("job")
