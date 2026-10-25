"""Previous AP ECET papers. The admin uploads PDFs; students open and save them."""
from django.db.models import Q
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from academics.models import Branch
from academics.serializers import FormBoolean
from common.constants import Role
from common.mixins import ActiveOnlyForNonAdminMixin

from .models import Paper, SavedPaper

MAX_PAPER_MB = 25


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == Role.ADMIN)


class PaperSerializer(serializers.ModelSerializer):
    branch_id = serializers.PrimaryKeyRelatedField(source="branch", queryset=Branch.objects.all(), allow_null=True, required=False)
    branch_code = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True, required=False)
    file_url = serializers.SerializerMethodField()
    saved = serializers.SerializerMethodField()
    is_active = FormBoolean(required=False)

    class Meta:
        model = Paper
        fields = ["id", "year", "title", "branch_id", "branch_code", "file", "file_url", "is_active", "saved"]

    def get_branch_code(self, obj):
        return obj.branch.code if obj.branch_id else None

    def get_file_url(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url

    def get_saved(self, obj):
        return obj.id in (self.context.get("saved_ids") or set())

    def validate_year(self, v):
        if not 1990 <= v <= 2100:
            raise serializers.ValidationError("Enter a valid year.")
        return v

    def validate_file(self, f):
        if not f.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Upload a PDF file.")
        if f.size > MAX_PAPER_MB * 1024 * 1024:
            raise serializers.ValidationError(f"The PDF must be {MAX_PAPER_MB} MB or smaller.")
        return f

    def validate(self, data):
        if not self.instance and not data.get("file"):
            raise serializers.ValidationError({"file": ["Choose a PDF file."]})
        return data


class PaperViewSet(ActiveOnlyForNonAdminMixin, viewsets.ModelViewSet):
    serializer_class = PaperSerializer
    queryset = Paper.objects.none()
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy"):
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = self.filter_active(Paper.objects.select_related("branch"))
        if user.role == Role.STUDENT:
            branch = getattr(getattr(user, "student_profile", None), "branch_id", None)
            qs = qs.filter(Q(branch__isnull=True) | Q(branch_id=branch))
        p = self.request.query_params
        if p.get("year", "").isdigit():
            qs = qs.filter(year=int(p["year"]))
        if p.get("branch", "").isdigit():
            qs = qs.filter(Q(branch_id=int(p["branch"])) | Q(branch__isnull=True))
        if p.get("saved") in ("1", "true"):
            qs = qs.filter(saved_by__user=user)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        u = self.request.user
        if u.is_authenticated:
            ctx["saved_ids"] = set(SavedPaper.objects.filter(user=u).values_list("paper_id", flat=True))
        return ctx

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=True, methods=["post"])
    def save(self, request, pk=None):
        SavedPaper.objects.get_or_create(user=request.user, paper=self.get_object())
        return Response({"saved": True})

    @action(detail=True, methods=["post"])
    def unsave(self, request, pk=None):
        SavedPaper.objects.filter(user=request.user, paper_id=pk).delete()
        return Response({"saved": False})
