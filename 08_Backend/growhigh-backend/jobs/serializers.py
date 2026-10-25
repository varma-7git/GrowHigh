from datetime import date

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from academics.models import Branch
from academics.serializers import BranchSerializer
from common.constants import Role

from .models import Application, Job


class JobSerializer(serializers.ModelSerializer):
    branches = BranchSerializer(many=True, read_only=True)
    posted_by_name = serializers.CharField(source="posted_by.full_name", read_only=True)
    applicant_count = serializers.IntegerField(read_only=True, required=False)
    has_applied = serializers.BooleanField(read_only=True, required=False)

    class Meta:
        model = Job
        fields = ["id", "title", "company_name", "job_type", "description", "location", "duration", "pay", "branches", "deadline",
                  "apply_link", "status", "rejection_reason", "is_active", "posted_by_name", "applicant_count",
                  "has_applied", "created_at"]

    def to_representation(self, obj):
        data = super().to_representation(obj)
        role = getattr(self.context["request"].user, "role", None)
        if role in (Role.STUDENT, Role.FACULTY):  # students never see counts or review notes
            data.pop("applicant_count", None)
            data.pop("rejection_reason", None)
            data.pop("status", None)
        if role != Role.STUDENT:
            data.pop("has_applied", None)
        return data


class JobWriteSerializer(serializers.ModelSerializer):
    branch_ids = serializers.PrimaryKeyRelatedField(source="branches", many=True, required=False,
                                                    queryset=Branch.objects.filter(is_active=True))
    company_name = serializers.CharField(max_length=150, required=False)

    class Meta:
        model = Job
        fields = ["title", "company_name", "job_type", "description", "location", "duration", "pay", "branch_ids", "deadline",
                  "apply_link", "is_active"]

    def validate_deadline(self, value):
        if value and value < date.today():
            raise serializers.ValidationError("Deadline cannot be in the past.")
        return value


class ApplicantSerializer(serializers.ModelSerializer):
    """One applicant, as shown to the admin or to the company that posted the job."""
    student_id = serializers.IntegerField(source="student.id")
    roll_number = serializers.CharField(source="student.login_id")
    full_name = serializers.CharField(source="student.full_name")
    email = serializers.EmailField(source="student.email")
    phone = serializers.CharField(source="student.phone")
    branch = serializers.CharField(source="student.student_profile.branch.name")
    year_of_study = serializers.IntegerField(source="student.student_profile.year_of_study")
    college_name = serializers.CharField(source="student.student_profile.college_name")

    class Meta:
        model = Application
        fields = ["id", "student_id", "roll_number", "full_name", "email", "phone", "branch", "year_of_study",
                  "college_name", "applied_at"]


class MyApplicationSerializer(serializers.ModelSerializer):
    job = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = ["id", "job", "applied_at"]

    @extend_schema_field(serializers.DictField())
    def get_job(self, obj):
        j = obj.job
        return {"id": j.id, "title": j.title, "company_name": j.company_name, "job_type": j.job_type, "deadline": j.deadline}
