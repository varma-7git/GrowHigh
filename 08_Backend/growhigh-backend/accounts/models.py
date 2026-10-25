from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from common.constants import ReviewStatus, Role


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, login_id, password, **extra):
        if not login_id:
            raise ValueError("login_id is required")
        user = self.model(login_id=login_id, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, login_id, password=None, **extra):
        extra.setdefault("role", Role.STUDENT)
        return self._create(login_id, password, **extra)

    def create_superuser(self, login_id, password=None, **extra):
        extra.setdefault("role", Role.ADMIN)
        extra.setdefault("full_name", "Admin")
        extra["is_staff"] = True
        extra["is_superuser"] = True
        return self._create(login_id, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """One user model for every role. Login uses login_id
    (roll number for students, Faculty ID for faculty, username for Admin)."""

    login_id = models.CharField(max_length=30, unique=True)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15, null=True, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    is_active = models.BooleanField(default=True)  # False blocks login; users are never deleted
    is_staff = models.BooleanField(default=False)  # Django admin site access
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()
    USERNAME_FIELD = "login_id"
    REQUIRED_FIELDS = ["full_name"]

    def save(self, *args, **kwargs):
        if not self.email:
            self.email = None  # keep unique email working with empty values
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.login_id} ({self.role})"


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    branch = models.ForeignKey("academics.Branch", on_delete=models.PROTECT, related_name="students")
    year_of_study = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(3)])
    regulation = models.ForeignKey("academics.Regulation", null=True, blank=True, on_delete=models.PROTECT, related_name="students")
    college_name = models.CharField(max_length=150, null=True, blank=True)

    def __str__(self):
        return f"Student {self.user.login_id}"


class FacultyProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="faculty_profile")
    department = models.CharField(max_length=100)
    # Admin-created faculty are APPROVED at once; self-registered faculty wait for the admin.
    status = models.CharField(max_length=10, choices=ReviewStatus.choices, default=ReviewStatus.APPROVED)
    rejection_reason = models.CharField(max_length=500, null=True, blank=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Faculty {self.user.login_id}"


class CompanyProfile(models.Model):
    """A company or recruiter. The account cannot log in until the admin approves it."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="company_profile")
    company_name = models.CharField(max_length=150)
    designation = models.CharField(max_length=100, null=True, blank=True)  # contact person's role
    website = models.URLField(max_length=200, null=True, blank=True)
    location = models.CharField(max_length=100, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=ReviewStatus.choices, default=ReviewStatus.PENDING)
    rejection_reason = models.CharField(max_length=500, null=True, blank=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.company_name} ({self.status})"


class EmailCode(models.Model):
    """A 6-digit code emailed to prove the person owns the address. Only a hash is stored."""
    email = models.EmailField(db_index=True)
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
