import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from common.constants import ReviewStatus
from common.permissions import IsAdmin
from common.serializers import RejectSerializer

from . import services
from .models import CompanyProfile, FacultyProfile
from .serializers import (EmailCheckSerializer, FacultyRegisterSerializer, FacultyRequestSerializer, ChangePasswordSerializer, CompanyRegisterSerializer, CompanySerializer, FacultyCreateSerializer, ForgotPasswordSerializer, LoginSerializer,
                          ProfileUpdateSerializer, RegisterSerializer, ResetPasswordSerializer,
                          SendEmailCodeSerializer, UserAdminUpdateSerializer, UserSerializer, VerifyEmailCodeSerializer)

User = get_user_model()
logger = logging.getLogger(__name__)


def _tell_applicant(user, kind, new_status, reason):
    """Email a company or faculty member the admin's decision, because they cannot log in to see it."""
    if new_status == ReviewStatus.APPROVED:
        services.notify_user(user, "Your GrowHigh account is approved",
                             f"Hello {user.full_name},\n\nYour {kind} account has been approved. You can now log in with your email or login ID.")
    else:
        services.notify_user(user, "Your GrowHigh registration was not approved",
                             f"Hello {user.full_name},\n\nYour {kind} registration was not approved.\nReason: {reason}")


class RegisterView(APIView):
    """POST /auth/register/  Student self-registration (public)."""
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=RegisterSerializer, responses={201: UserSerializer})
    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class RegisterCompanyView(APIView):
    """POST /auth/register-company/  Company self-registration. The account stays PENDING until the admin approves."""
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=CompanyRegisterSerializer, responses={201: CompanySerializer})
    def post(self, request):
        s = CompanyRegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        profile = s.save()
        return Response(CompanySerializer(profile).data, status=status.HTTP_201_CREATED)


class RegisterFacultyView(APIView):
    """POST /auth/register-faculty/  Faculty self-registration. Stays PENDING until the admin approves."""
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=FacultyRegisterSerializer, responses={201: FacultyRequestSerializer})
    def post(self, request):
        s = FacultyRegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(FacultyRequestSerializer(s.save()).data, status=status.HTTP_201_CREATED)


class CheckEmailView(APIView):
    """GET /auth/check-email/?email=  Tells the register forms whether an email is already registered."""
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_check"

    @extend_schema(parameters=[EmailCheckSerializer], responses=inline_serializer("EmailAvailability", {"available": serializers.BooleanField()}))
    def get(self, request):
        s = EmailCheckSerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        taken = User.objects.filter(email__iexact=s.validated_data["email"].strip()).exists()
        return Response({"available": not taken})


class SendEmailCodeView(APIView):
    """POST /auth/send-email-code/ {email}  Emails a 6-digit code to prove the address is real and yours."""
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_code"

    @extend_schema(request=SendEmailCodeSerializer, responses=inline_serializer("CodeSent", {"detail": serializers.CharField()}))
    def post(self, request):
        s = SendEmailCodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            services.send_email_code(s.validated_data["email"])
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Code sent."})


class VerifyEmailCodeView(APIView):
    """POST /auth/verify-email-code/ {email, code}  Returns a token to send with the register or create form."""
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_code"

    @extend_schema(request=VerifyEmailCodeSerializer, responses=inline_serializer("EmailToken", {"token": serializers.CharField()}))
    def post(self, request):
        s = VerifyEmailCodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        token = services.check_email_code(s.validated_data["email"], s.validated_data["code"])
        if not token:
            return Response({"detail": "That code is wrong or has expired. Ask for a new one."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"token": token})


class LoginView(TokenObtainPairView):
    """POST /auth/login/  login_id + password for every role."""
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class LogoutView(APIView):
    """POST /auth/logout/  Blacklists the refresh token."""

    @extend_schema(request=inline_serializer('LogoutRequest', {'refresh': serializers.CharField()}), responses={204: OpenApiResponse(description='Logged out')})
    def post(self, request):
        token = request.data.get("refresh")
        if not token:
            raise ValidationError({"refresh": ["This field is required."]})
        try:
            RefreshToken(token).blacklist()
        except TokenError:
            raise ValidationError({"refresh": ["Invalid or expired token."]})
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET /auth/me/  and  PATCH /auth/me/ (name, email, phone, college, year)."""

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=ProfileUpdateSerializer, responses=UserSerializer)
    def patch(self, request):
        s = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    @extend_schema(request=ChangePasswordSerializer, responses={204: OpenApiResponse(description='Password changed')})
    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        request.user.set_password(s.validated_data["new_password"])
        request.user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ForgotPasswordView(APIView):
    """POST /auth/forgot-password/  Same reply whether or not the login ID exists."""
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(request=ForgotPasswordSerializer, responses=inline_serializer('DetailMessage', {'detail': serializers.CharField()}))
    def post(self, request):
        s = ForgotPasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = services.find_user(s.validated_data["login_id"])
        if user and user.is_active and user.email:
            token = default_token_generator.make_token(user)
            try:
                send_mail(
                    "GrowHigh password reset",
                    f"Hello {user.full_name},\n\nYour password reset code is:\n\n{token}\n\n"
                    f"Use it with your login ID ({user.login_id}) within 15 minutes.\n"
                    "If you did not ask for this, ignore this email.",
                    None, [user.email],
                )
            except Exception:  # never reveal mail problems to the caller
                logger.exception("Could not send reset email")
        return Response({"detail": "If this account has an email, a reset code has been sent."})


class ResetPasswordView(APIView):
    """POST /auth/reset-password/  login_id + emailed token + new password."""
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(request=ResetPasswordSerializer, responses={204: OpenApiResponse(description='Password reset')})
    def post(self, request):
        s = ResetPasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.validated_data["user"]
        user.set_password(s.validated_data["new_password"])
        user.save()
        for t in OutstandingToken.objects.filter(user=user):  # log out everywhere
            BlacklistedToken.objects.get_or_create(token=t)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserViewSet(viewsets.ModelViewSet):
    """Admin: list, create faculty, details, edit/deactivate. Users are never deleted."""
    permission_classes = [IsAdmin]
    queryset = User.objects.none()  # real queryset in get_queryset; lets Swagger type the id
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = User.objects.select_related("student_profile__branch", "faculty_profile").order_by("-created_at")
        p = self.request.query_params
        if p.get("role"):
            qs = qs.filter(role=p["role"].upper())
        if p.get("branch", "").isdigit():
            qs = qs.filter(student_profile__branch_id=int(p["branch"]))
        if p.get("year_of_study", "").isdigit():
            qs = qs.filter(student_profile__year_of_study=int(p["year_of_study"]))
        if p.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=p["is_active"] == "true")
        if p.get("search"):
            qs = qs.filter(Q(full_name__icontains=p["search"]) | Q(login_id__icontains=p["search"]))
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return FacultyCreateSerializer
        if self.action == "partial_update":
            return UserAdminUpdateSerializer
        return UserSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    def create(self, request, *args, **kwargs):
        s = FacultyCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(UserSerializer(s.save()).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        s = UserAdminUpdateSerializer(user, data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save()
        return Response(UserSerializer(user).data)

    @extend_schema(request=inline_serializer("SetPassword", {"password": serializers.CharField(required=False)}),
                   responses=inline_serializer("TempPassword", {"temporary_password": serializers.CharField(allow_null=True), "detail": serializers.CharField()}))
    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        """Admin sets a chosen password (send `password`) or gets a random temporary one (send nothing)."""
        from django.contrib.auth.password_validation import validate_password as _validate
        from django.core.exceptions import ValidationError as DjangoValidationError
        user = self.get_object()
        chosen = (request.data.get("password") or "").strip()
        if chosen:
            try:
                _validate(chosen, user)
            except DjangoValidationError as e:
                return Response({"detail": "Validation error", "errors": {"password": list(e.messages)}}, status=400)
            user.set_password(chosen)
            user.save()
            return Response({"temporary_password": None, "detail": "Password changed."})
        temp = services.generate_temp_password()
        user.set_password(temp)
        user.save()
        return Response({"temporary_password": temp, "detail": "Temporary password generated."})


class CompanyViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin: review company registrations (list, details, approve, reject)."""
    permission_classes = [IsAdmin]
    serializer_class = CompanySerializer
    queryset = CompanyProfile.objects.none()

    def get_queryset(self):
        qs = CompanyProfile.objects.select_related("user").order_by("-created_at")
        p = self.request.query_params
        if p.get("status", "").upper() in ReviewStatus.values:
            qs = qs.filter(status=p["status"].upper())
        if p.get("search"):
            qs = qs.filter(Q(company_name__icontains=p["search"]) | Q(user__full_name__icontains=p["search"]))
        return qs

    def _review(self, request, new_status, reason=None):
        profile = self.get_object()
        profile.status = new_status
        profile.rejection_reason = reason
        profile.reviewed_by = request.user
        profile.reviewed_at = timezone.now()
        profile.save()
        _tell_applicant(profile.user, "company", new_status, reason)
        return Response(CompanySerializer(profile).data)

    @extend_schema(request=None, responses=CompanySerializer)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._review(request, ReviewStatus.APPROVED)

    @extend_schema(request=RejectSerializer, responses=CompanySerializer)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        s = RejectSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._review(request, ReviewStatus.REJECTED, s.validated_data["reason"])


class FacultyRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin: review faculty registrations (list, details, approve, reject)."""
    permission_classes = [IsAdmin]
    serializer_class = FacultyRequestSerializer
    queryset = FacultyProfile.objects.none()

    def get_queryset(self):
        qs = FacultyProfile.objects.select_related("user").order_by("-user__created_at")
        p = self.request.query_params
        if p.get("status", "").upper() in ReviewStatus.values:
            qs = qs.filter(status=p["status"].upper())
        if p.get("search"):
            qs = qs.filter(Q(user__full_name__icontains=p["search"]) | Q(user__login_id__icontains=p["search"]))
        return qs

    def _review(self, request, new_status, reason=None):
        profile = self.get_object()
        profile.status, profile.rejection_reason = new_status, reason
        profile.reviewed_by, profile.reviewed_at = request.user, timezone.now()
        profile.save()
        _tell_applicant(profile.user, "faculty", new_status, reason)
        return Response(FacultyRequestSerializer(profile).data)

    @extend_schema(request=None, responses=FacultyRequestSerializer)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._review(request, ReviewStatus.APPROVED)

    @extend_schema(request=RejectSerializer, responses=FacultyRequestSerializer)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        s = RejectSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._review(request, ReviewStatus.REJECTED, s.validated_data["reason"])
