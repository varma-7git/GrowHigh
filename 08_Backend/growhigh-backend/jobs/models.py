from django.conf import settings
from django.db import models

from common.constants import ReviewStatus


class JobType(models.TextChoices):
    JOB = "JOB", "Job"
    INTERNSHIP = "INTERNSHIP", "Internship"


class Job(models.Model):
    """A job or internship. Posted by a company (needs admin approval) or by the admin (live at once)."""

    title = models.CharField(max_length=150)
    company_name = models.CharField(max_length=150)
    job_type = models.CharField(max_length=12, choices=JobType.choices, default=JobType.JOB)
    description = models.TextField()
    location = models.CharField(max_length=100, null=True, blank=True)
    duration = models.CharField(max_length=50, null=True, blank=True)  # internships: "3 months"
    pay = models.CharField(max_length=100, null=True, blank=True)  # salary or stipend, free text
    branches = models.ManyToManyField("academics.Branch", blank=True, related_name="jobs")  # empty = open to all branches
    deadline = models.DateField(null=True, blank=True)
    apply_link = models.URLField(max_length=500, null=True, blank=True)

    posted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="posted_jobs")
    status = models.CharField(max_length=10, choices=ReviewStatus.choices, default=ReviewStatus.PENDING)
    rejection_reason = models.CharField(max_length=500, null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)  # the poster can close a job; nothing is deleted
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} at {self.company_name}"


class Application(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="applications")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="applications")
    applied_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-applied_at"]
        constraints = [models.UniqueConstraint(fields=["job", "student"], name="one_application_per_student_per_job")]

    def __str__(self):
        return f"{self.student_id} -> {self.job_id}"
