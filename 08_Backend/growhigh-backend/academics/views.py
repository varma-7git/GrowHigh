from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated

from common.constants import Role
from common.mixins import ActiveOnlyForNonAdminMixin, AdminWriteMixin, SafeDeleteMixin

from rest_framework.decorators import action
from rest_framework.response import Response

from .models import GUIDE_SECTIONS, Branch, Guide, GuideDone, Material, MaterialDone, Regulation, Subject, Topic
from .serializers import BranchSerializer, GuideSerializer, MaterialSerializer, RegulationSerializer, SubjectSerializer, TopicSerializer


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == Role.ADMIN)


class IsAdminOrFaculty(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role in (Role.ADMIN, Role.FACULTY))


class _Base(AdminWriteMixin, SafeDeleteMixin, ActiveOnlyForNonAdminMixin, viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]  # delete only when nothing is linked


class BranchViewSet(_Base):
    serializer_class = BranchSerializer
    queryset = Branch.objects.none()

    def get_permissions(self):
        # The branch list is public: the register form needs it before anyone is logged in.
        if self.action == "list":
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        qs = self.filter_active(Branch.objects.all())
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        return qs


class RegulationViewSet(_Base):
    serializer_class = RegulationSerializer
    queryset = Regulation.objects.none()
    delete_hint = "Hide it instead."

    def get_permissions(self):
        # Public list: the register form needs it before anyone is logged in.
        if self.action == "list":
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        return self.filter_active(Regulation.objects.all())


class SubjectViewSet(_Base):
    serializer_class = SubjectSerializer
    queryset = Subject.objects.none()

    def get_queryset(self):
        qs = self.filter_active(Subject.objects.all())
        branch = self.request.query_params.get("branch")
        if branch and branch.isdigit():
            # subjects of that branch plus the common subjects (branch is empty)
            qs = qs.filter(Q(branch_id=int(branch)) | Q(branch__isnull=True))
        regulation = self.request.query_params.get("regulation")
        if regulation and regulation.isdigit():
            qs = qs.filter(regulation_id=int(regulation))
        semester = self.request.query_params.get("semester")
        if semester and semester.isdigit():
            qs = qs.filter(semester=int(semester))
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        return qs


class TopicViewSet(_Base):
    serializer_class = TopicSerializer
    queryset = Topic.objects.none()

    def get_queryset(self):
        qs = self.filter_active(Topic.objects.all())
        subject = self.request.query_params.get("subject")
        if subject and subject.isdigit():
            qs = qs.filter(subject_id=int(subject))
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


class MaterialViewSet(ActiveOnlyForNonAdminMixin, SafeDeleteMixin, viewsets.ModelViewSet):
    """Learning material for a topic.

    Admin and faculty can add material (including uploaded videos and PDFs). Faculty can change or delete only their own.
    Students read it and mark items done.
    """
    serializer_class = MaterialSerializer
    queryset = Material.objects.none()
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy"):
            return [IsAdminOrFaculty()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Material.objects.select_related("uploaded_by")
        if user.role == Role.ADMIN:
            qs = self.filter_active(qs)
        elif user.role == Role.FACULTY:  # faculty also see their own hidden items
            qs = qs.filter(Q(is_active=True) | Q(uploaded_by=user))
        else:
            qs = qs.filter(is_active=True)
        topic = self.request.query_params.get("topic")
        if topic and topic.isdigit():
            qs = qs.filter(topic_id=int(topic))
        subject = self.request.query_params.get("subject")
        if subject and subject.isdigit():
            qs = qs.filter(topic__subject_id=int(subject))
        if self.request.query_params.get("mine") in ("1", "true"):
            qs = qs.filter(uploaded_by=user)
        return qs

    def get_object(self):
        obj = super().get_object()
        if self.action in ("partial_update", "update", "destroy") and self.request.user.role == Role.FACULTY and obj.uploaded_by_id != self.request.user.id:
            raise PermissionDenied("You can change only the material you added.")
        return obj

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if user.is_authenticated:
            ctx["done_ids"] = set(MaterialDone.objects.filter(user=user).values_list("material_id", flat=True))
        return ctx

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        m = self.get_object()
        MaterialDone.objects.get_or_create(user=request.user, material=m)
        return Response({"done": True})

    @action(detail=True, methods=["post"])
    def undo(self, request, pk=None):
        MaterialDone.objects.filter(user=request.user, material_id=pk).delete()
        return Response({"done": False})


def guide_progress(user):
    """{area: {total, done, percent, sections: {section: {total, done}}}} over the visible guides."""
    out = {a: {"total": 0, "done": 0, "percent": 0, "sections": {k: {"total": 0, "done": 0} for k, _ in secs}} for a, secs in GUIDE_SECTIONS.items()}
    done_ids = set(GuideDone.objects.filter(user=user).values_list("guide_id", flat=True))
    for g in Guide.objects.filter(is_active=True).values("id", "area", "section"):
        a = out.get(g["area"])
        if not a or g["section"] not in a["sections"]:
            continue
        for node in (a, a["sections"][g["section"]]):
            node["total"] += 1
            node["done"] += 1 if g["id"] in done_ids else 0
    for a in out.values():
        a["percent"] = round(a["done"] * 100 / a["total"]) if a["total"] else 0
    return out


class GuideViewSet(ActiveOnlyForNonAdminMixin, SafeDeleteMixin, viewsets.ModelViewSet):
    """Job preparation, Career growth and Communication lessons. The admin writes; students read and mark done."""
    serializer_class = GuideSerializer
    queryset = Guide.objects.none()
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy"):
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = self.filter_active(Guide.objects.select_related("uploaded_by"))
        p = self.request.query_params
        if p.get("area"):
            qs = qs.filter(area=p["area"])
        if p.get("section"):
            qs = qs.filter(section=p["section"])
        return qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.user.is_authenticated:
            ctx["done_ids"] = set(GuideDone.objects.filter(user=self.request.user).values_list("guide_id", flat=True))
        return ctx

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        GuideDone.objects.get_or_create(user=request.user, guide=self.get_object())
        return Response({"done": True})

    @action(detail=True, methods=["post"])
    def undo(self, request, pk=None):
        GuideDone.objects.filter(user=request.user, guide_id=pk).delete()
        return Response({"done": False})

    @action(detail=False, methods=["get"])
    def progress(self, request):
        return Response(guide_progress(request.user))
