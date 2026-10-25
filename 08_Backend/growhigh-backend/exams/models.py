from datetime import datetime, timedelta

from django.db import models
from django.utils import timezone


class Question(models.Model):
    """One multiple-choice question with exactly one correct option."""
    topic = models.ForeignKey("academics.Topic", on_delete=models.PROTECT, related_name="questions")
    text = models.TextField()
    option_a = models.CharField(max_length=300)
    option_b = models.CharField(max_length=300)
    option_c = models.CharField(max_length=300)
    option_d = models.CharField(max_length=300)
    correct = models.PositiveSmallIntegerField()  # 0 = A, 1 = B, 2 = C, 3 = D
    explanation = models.TextField(blank=True, default="")
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="questions")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def options(self):
        return [self.option_a, self.option_b, self.option_c, self.option_d]

    def __str__(self):
        return self.text[:60]


class Test(models.Model):
    class Type(models.TextChoices):
        DAILY = "DAILY", "Daily"
        WEEKLY = "WEEKLY", "Weekly"
        CUMULATIVE = "CUMULATIVE", "Cumulative"
        MOCK = "MOCK", "Mock"

    name = models.CharField(max_length=150)
    test_type = models.CharField(max_length=12, choices=Type.choices, default=Type.DAILY)
    scheduled_date = models.DateField()
    start_time = models.TimeField()
    duration_minutes = models.PositiveSmallIntegerField()
    branch = models.ForeignKey("academics.Branch", null=True, blank=True, on_delete=models.PROTECT, related_name="tests")
    year_of_study = models.PositiveSmallIntegerField(null=True, blank=True)
    questions = models.ManyToManyField(Question, through="TestQuestion", related_name="tests")
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="tests_created")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_date", "-start_time"]

    @property
    def starts_at(self):
        return timezone.make_aware(datetime.combine(self.scheduled_date, self.start_time))

    @property
    def ends_at(self):
        return self.starts_at + timedelta(minutes=self.duration_minutes)

    @property
    def status(self):
        now = timezone.now()
        if now < self.starts_at:
            return "UPCOMING"
        return "ACTIVE" if now <= self.ends_at else "ENDED"

    def __str__(self):
        return self.name


class TestQuestion(models.Model):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="items")
    question = models.ForeignKey(Question, on_delete=models.PROTECT, related_name="test_items")
    order_no = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order_no", "id"]
        constraints = [models.UniqueConstraint(fields=["test", "question"], name="unique_question_per_test")]


class TestAssignment(models.Model):
    """A test given to one student."""
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="assignments")
    student = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="test_assignments")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["test", "student"], name="unique_assignment")]


class Attempt(models.Model):
    """One student sitting a test (one attempt only) or a practice set on a topic."""
    student = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="attempts")
    test = models.ForeignKey(Test, null=True, blank=True, on_delete=models.CASCADE, related_name="attempts")  # empty = practice
    topic = models.ForeignKey("academics.Topic", null=True, blank=True, on_delete=models.SET_NULL, related_name="practice_attempts")
    started_at = models.DateTimeField(auto_now_add=True)
    deadline = models.DateTimeField(null=True, blank=True)  # empty = no time limit (practice)
    submitted_at = models.DateTimeField(null=True, blank=True)
    label = models.CharField(max_length=120, blank=True, default="")  # "Mock test", "Cumulative · Physics"
    score = models.PositiveSmallIntegerField(default=0)
    total = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["-started_at"]
        constraints = [models.UniqueConstraint(fields=["test", "student"], condition=models.Q(test__isnull=False), name="one_attempt_per_test")]

    @property
    def title(self):
        if self.test_id:
            return self.test.name
        if self.label:
            return self.label
        return f"Practice · {self.topic.name}" if self.topic_id else "Practice"


class AttemptAnswer(models.Model):
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.PROTECT, related_name="answers")
    order_no = models.PositiveSmallIntegerField(default=0)
    selected = models.PositiveSmallIntegerField(null=True, blank=True)
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ["order_no", "id"]
        constraints = [models.UniqueConstraint(fields=["attempt", "question"], name="unique_answer_per_question")]


class Paper(models.Model):
    """A previous AP ECET question paper (PDF) added by the admin. Branch empty = common to every branch."""
    year = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=150)
    branch = models.ForeignKey("academics.Branch", null=True, blank=True, on_delete=models.PROTECT, related_name="papers")
    file = models.FileField(upload_to="papers/%Y/")
    uploaded_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="papers_uploaded")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-year", "title", "id"]

    def __str__(self):
        return f"{self.year} {self.title}"


class SavedPaper(models.Model):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="saved_papers")
    paper = models.ForeignKey(Paper, on_delete=models.CASCADE, related_name="saved_by")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "paper"], name="unique_saved_paper")]
