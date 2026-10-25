from django.db import models


class Role(models.TextChoices):
    STUDENT = "STUDENT", "Student"
    FACULTY = "FACULTY", "Faculty"
    ADMIN = "ADMIN", "Admin"
    COMPANY = "COMPANY", "Company"


YEAR_CHOICES = [(1, "1st year"), (2, "2nd year"), (3, "3rd year")]


class ReviewStatus(models.TextChoices):
    """Admin review state for a company registration or a posted job."""
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
