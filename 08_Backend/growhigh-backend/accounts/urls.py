from django.urls import path
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = SimpleRouter()
router.register("users", views.UserViewSet, basename="user")
router.register("faculty-requests", views.FacultyRequestViewSet, basename="faculty-request")
router.register("companies", views.CompanyViewSet, basename="company")

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/register-company/", views.RegisterCompanyView.as_view()),
    path("auth/register-faculty/", views.RegisterFacultyView.as_view()),
    path("auth/check-email/", views.CheckEmailView.as_view()),
    path("auth/send-email-code/", views.SendEmailCodeView.as_view()),
    path("auth/verify-email-code/", views.VerifyEmailCodeView.as_view()),
    path("auth/login/", views.LoginView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("auth/change-password/", views.ChangePasswordView.as_view()),
    path("auth/forgot-password/", views.ForgotPasswordView.as_view()),
    path("auth/reset-password/", views.ResetPasswordView.as_view()),
] + router.urls
