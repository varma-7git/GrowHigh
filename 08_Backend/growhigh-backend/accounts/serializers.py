from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.fields import empty
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from academics.models import Branch, Regulation
from academics.serializers import BranchSerializer, RegulationSerializer

from common.constants import ReviewStatus, Role

from . import services
from .models import CompanyProfile, FacultyProfile

User = get_user_model()
YEARS = [1, 2, 3]
FORBIDDEN_EDIT = ("login_id", "role")  # BR-13: login ID and role never change


def _check_login_id_free(value, exclude_pk=None):
    value = value.strip()
    qs = User.objects.filter(login_id__iexact=value)
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    if qs.exists():
        raise serializers.ValidationError("This login ID is already registered.")
    return value


def _check_email_free(value, exclude_pk=None):
    value = value.strip().lower()
    qs = User.objects.filter(email__iexact=value)
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    if qs.exists():
        raise serializers.ValidationError("This email is already registered.")
    return value


class EmailVerifiedSerializer(serializers.Serializer):
    """Base for forms that create an account: the email must have been proven with a 6-digit code."""
    email_token = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def run_validation(self, data=empty):
        value = super().run_validation(data)
        value.pop("email_token", None)
        if not services.token_is_valid(value.get("email"), (self.initial_data or {}).get("email_token")):
            raise serializers.ValidationError({"email_token": ["Verify this email: ask for a code and enter it."]})
        return value


def _require_proof_if_email_changed(serializer, attrs):
    """Changing an email address needs the same 6-digit proof as registering with it."""
    new = attrs.get("email")
    if new and new.strip().lower() != (serializer.instance.email or "").lower():
        if not services.token_is_valid(new, (serializer.initial_data or {}).get("email_token")):
            raise serializers.ValidationError({"email_token": ["Verify the new email: ask for a code and enter it."]})


def _reject_forbidden(serializer):
    sent = [f for f in FORBIDDEN_EDIT if f in getattr(serializer, "initial_data", {})]
    if sent:
        raise serializers.ValidationError({f: ["This field cannot be changed."] for f in sent})


class UserSerializer(serializers.ModelSerializer):
    branch = serializers.SerializerMethodField()
    year_of_study = serializers.SerializerMethodField()
    regulation = serializers.SerializerMethodField()
    college_name = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    company_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "login_id", "full_name", "email", "phone", "role", "is_active",
                  "branch", "year_of_study", "regulation", "college_name", "department", "company_name", "company_status", "created_at"]

    @extend_schema_field(BranchSerializer(allow_null=True))
    def get_branch(self, obj):
        sp = getattr(obj, "student_profile", None)
        return BranchSerializer(sp.branch).data if sp else None

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_year_of_study(self, obj):
        sp = getattr(obj, "student_profile", None)
        return sp.year_of_study if sp else None

    @extend_schema_field(RegulationSerializer(allow_null=True))
    def get_regulation(self, obj):
        sp = getattr(obj, "student_profile", None)
        return RegulationSerializer(sp.regulation).data if sp and sp.regulation else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_college_name(self, obj):
        sp = getattr(obj, "student_profile", None)
        return sp.college_name if sp else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_department(self, obj):
        fp = getattr(obj, "faculty_profile", None)
        return fp.department if fp else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_company_name(self, obj):
        cp = getattr(obj, "company_profile", None)
        return cp.company_name if cp else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_company_status(self, obj):
        cp = getattr(obj, "company_profile", None)
        return cp.status if cp else None


class RegisterSerializer(EmailVerifiedSerializer):
    full_name = serializers.CharField(max_length=100)
    login_id = serializers.CharField(max_length=30)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True)
    college_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    confirm_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    branch_id = serializers.PrimaryKeyRelatedField(source="branch", queryset=Branch.objects.filter(is_active=True))
    year_of_study = serializers.ChoiceField(choices=YEARS)
    regulation_id = serializers.PrimaryKeyRelatedField(source="regulation", queryset=Regulation.objects.filter(is_active=True), required=False, allow_null=True)

    def validate_login_id(self, value):
        return _check_login_id_free(value)

    def validate_email(self, value):
        return _check_email_free(value)

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated):
        return services.create_student(
            login_id=validated["login_id"], password=validated["password"], full_name=validated["full_name"],
            email=validated["email"], branch=validated["branch"], year_of_study=validated["year_of_study"],
            phone=validated.get("phone") or None, college_name=validated.get("college_name") or None,
            regulation=validated.get("regulation"),
        )


class LoginSerializer(TokenObtainPairSerializer):
    """Uses login_id + password (USERNAME_FIELD). Returns access, refresh and the user."""

    def validate(self, attrs):
        ident = (attrs.get("login_id") or "").strip()
        if "@" in ident:  # people may log in with their email
            found = services.find_user(ident)
            if found:
                attrs["login_id"] = found.login_id
        data = super().validate(attrs)
        if self.user.role == Role.FACULTY:
            fp = getattr(self.user, "faculty_profile", None)
            if fp and fp.status == ReviewStatus.PENDING:
                raise PermissionDenied("Your faculty account is waiting for admin approval. You can log in once it is approved.")
            if fp and fp.status == ReviewStatus.REJECTED:
                raise PermissionDenied("Your faculty registration was rejected." + (f" Reason: {fp.rejection_reason}" if fp.rejection_reason else ""))
        if self.user.role == Role.COMPANY:
            cp = getattr(self.user, "company_profile", None)
            if not cp or cp.status == ReviewStatus.PENDING:
                raise PermissionDenied("Your company account is waiting for admin approval. You can log in once it is approved.")
            if cp.status == ReviewStatus.REJECTED:
                raise PermissionDenied("Your company registration was rejected." + (f" Reason: {cp.rejection_reason}" if cp.rejection_reason else ""))
        data["user"] = UserSerializer(self.user).data
        return data


class ProfileUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=100, required=False)
    email = serializers.EmailField(max_length=254, required=False)
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True)
    college_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    year_of_study = serializers.ChoiceField(choices=YEARS, required=False)
    regulation_id = serializers.PrimaryKeyRelatedField(source="regulation", queryset=Regulation.objects.filter(is_active=True), required=False)

    def validate_email(self, value):
        return _check_email_free(value, exclude_pk=self.instance.pk)

    def validate(self, attrs):
        _reject_forbidden(self)
        _require_proof_if_email_changed(self, attrs)
        if ("college_name" in attrs or "year_of_study" in attrs or "regulation" in attrs) and not hasattr(self.instance, "student_profile"):
            raise serializers.ValidationError("Only students have college name and year of study.")
        return attrs

    def update(self, user, validated):
        for f in ("full_name", "email", "phone"):
            if f in validated:
                setattr(user, f, validated[f] or None if f != "full_name" else validated[f])
        user.save()
        sp = getattr(user, "student_profile", None)
        if sp:
            if "college_name" in validated:
                sp.college_name = validated["college_name"] or None
            if "year_of_study" in validated:
                sp.year_of_study = validated["year_of_study"]
            if "regulation" in validated:
                sp.regulation = validated["regulation"]
            sp.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is wrong.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        validate_password(attrs["new_password"], self.context["request"].user)
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    login_id = serializers.CharField(max_length=254, label="Email or login ID")


class ResetPasswordSerializer(serializers.Serializer):
    login_id = serializers.CharField(max_length=254, label="Email or login ID")
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = services.find_user(attrs["login_id"])
        if not user or not user.is_active or not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError({"token": ["Invalid or expired token."]})
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        validate_password(attrs["new_password"], user)
        attrs["user"] = user
        return attrs


class FacultyCreateSerializer(EmailVerifiedSerializer):
    login_id = serializers.CharField(max_length=30)
    full_name = serializers.CharField(max_length=100)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    department = serializers.CharField(max_length=100)

    def validate_login_id(self, value):
        return _check_login_id_free(value)

    def validate_email(self, value):
        return _check_email_free(value)

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, v):
        return services.create_faculty(login_id=v["login_id"], password=v["password"], full_name=v["full_name"],
                                       email=v["email"], department=v["department"], phone=v.get("phone") or None)


class UserAdminUpdateSerializer(serializers.Serializer):
    """Admin edits a user. login_id and role cannot be changed. Use is_active to block a user."""
    full_name = serializers.CharField(max_length=100, required=False)
    email = serializers.EmailField(max_length=254, required=False)
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    branch_id = serializers.PrimaryKeyRelatedField(source="branch", queryset=Branch.objects.all(), required=False)
    year_of_study = serializers.ChoiceField(choices=YEARS, required=False)
    department = serializers.CharField(max_length=100, required=False)

    def validate_email(self, value):
        return _check_email_free(value, exclude_pk=self.instance.pk)

    def validate(self, attrs):
        _reject_forbidden(self)
        _require_proof_if_email_changed(self, attrs)
        user = self.instance
        if attrs.get("is_active") is False and user.pk == self.context["request"].user.pk:
            raise serializers.ValidationError({"is_active": ["You cannot deactivate your own account."]})
        if ("branch" in attrs or "year_of_study" in attrs) and not hasattr(user, "student_profile"):
            raise serializers.ValidationError("Branch and year apply to students only.")
        if "department" in attrs and not hasattr(user, "faculty_profile"):
            raise serializers.ValidationError("Department applies to faculty only.")
        return attrs

    def update(self, user, v):
        for f in ("full_name", "email", "phone", "is_active"):
            if f in v:
                setattr(user, f, v[f] if f in ("full_name", "is_active") else (v[f] or None))
        user.save()
        sp = getattr(user, "student_profile", None)
        if sp:
            if "branch" in v:
                sp.branch = v["branch"]
            if "year_of_study" in v:
                sp.year_of_study = v["year_of_study"]
            sp.save()
        fp = getattr(user, "faculty_profile", None)
        if fp and "department" in v:
            fp.department = v["department"]
            fp.save()
        return user


class CompanyRegisterSerializer(EmailVerifiedSerializer):
    company_name = serializers.CharField(max_length=150)
    full_name = serializers.CharField(max_length=100, label="Contact person name")
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    login_id = serializers.CharField(max_length=30, label="Username")
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=15)
    website = serializers.URLField(max_length=200, required=False, allow_blank=True)
    location = serializers.CharField(max_length=100, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    confirm_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_login_id(self, value):
        return _check_login_id_free(value)

    def validate_email(self, value):
        return _check_email_free(value)

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        validate_password(attrs["password"])
        return attrs

    def create(self, v):
        return services.create_company(
            login_id=v["login_id"], password=v["password"], full_name=v["full_name"], email=v["email"], phone=v["phone"],
            company_name=v["company_name"], designation=v.get("designation") or None, website=v.get("website") or None,
            location=v.get("location") or None, description=v.get("description") or None,
        )


class CompanySerializer(serializers.ModelSerializer):
    """What the admin sees when reviewing a company."""
    contact_person = serializers.CharField(source="user.full_name")
    login_id = serializers.CharField(source="user.login_id")
    email = serializers.EmailField(source="user.email")
    phone = serializers.CharField(source="user.phone")

    class Meta:
        model = CompanyProfile
        fields = ["id", "company_name", "contact_person", "designation", "login_id", "email", "phone", "website",
                  "location", "description", "status", "rejection_reason", "reviewed_at", "created_at"]


class FacultyRegisterSerializer(EmailVerifiedSerializer):
    full_name = serializers.CharField(max_length=100)
    login_id = serializers.CharField(max_length=30, label="Faculty ID")
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True)
    department = serializers.CharField(max_length=100)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    confirm_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_login_id(self, value):
        return _check_login_id_free(value)

    def validate_email(self, value):
        return _check_email_free(value)

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        validate_password(attrs["password"])
        return attrs

    def create(self, v):
        return services.register_faculty(
            login_id=v["login_id"], password=v["password"], full_name=v["full_name"], email=v["email"],
            department=v["department"], phone=v.get("phone") or None)


class FacultyRequestSerializer(serializers.ModelSerializer):
    """What the admin sees when reviewing a faculty registration."""
    full_name = serializers.CharField(source="user.full_name")
    login_id = serializers.CharField(source="user.login_id")
    email = serializers.EmailField(source="user.email")
    phone = serializers.CharField(source="user.phone")
    created_at = serializers.DateTimeField(source="user.created_at")

    class Meta:
        model = FacultyProfile
        fields = ["id", "full_name", "login_id", "email", "phone", "department", "status", "rejection_reason",
                  "reviewed_at", "created_at"]


class EmailCheckSerializer(serializers.Serializer):
    email = serializers.EmailField()


class SendEmailCodeSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)

    def validate_email(self, value):
        return _check_email_free(value)


class VerifyEmailCodeSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    code = serializers.CharField(max_length=6)
