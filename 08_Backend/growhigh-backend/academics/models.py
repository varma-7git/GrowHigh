from django.db import models
from django.db.models import Q


class Branch(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=True)  # hide instead of delete

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.code


class Regulation(models.Model):
    """A diploma curriculum scheme such as C20, C23 or C26. Students belong to one."""
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code


class Subject(models.Model):
    # branch = None means a common subject for every branch (Mathematics, Physics, Chemistry)
    branch = models.ForeignKey(Branch, null=True, blank=True, on_delete=models.PROTECT, related_name="subjects")
    # regulation + semester place a diploma subject in the curriculum; both empty = ECET subject
    regulation = models.ForeignKey(Regulation, null=True, blank=True, on_delete=models.PROTECT, related_name="subjects")
    semester = models.PositiveSmallIntegerField(null=True, blank=True)  # 1 to 6
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=20, null=True, blank=True)
    marks = models.PositiveSmallIntegerField(null=True, blank=True)  # marks in the exam paper
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["regulation", "branch", "name"], name="unique_subject_per_branch"),
            models.UniqueConstraint(fields=["name"], condition=Q(branch__isnull=True, regulation__isnull=True), name="unique_common_subject_name"),
        ]

    def __str__(self):
        return self.name


class Topic(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="topics")
    name = models.CharField(max_length=150)
    description = models.CharField(max_length=300, blank=True, default="")
    order_no = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["subject_id", "order_no", "name"]
        constraints = [models.UniqueConstraint(fields=["subject", "name"], name="unique_topic_per_subject")]

    def __str__(self):
        return self.name


class Material(models.Model):
    """Something a student reads or watches to learn a topic: notes, a video link, a PDF or a web link."""
    class Kind(models.TextChoices):
        NOTES = "NOTES", "Notes"
        VIDEO = "VIDEO", "Video"
        PDF = "PDF", "PDF"
        LINK = "LINK", "Web link"

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="materials")
    kind = models.CharField(max_length=5, choices=Kind.choices, default=Kind.NOTES)
    title = models.CharField(max_length=150)
    body = models.TextField(blank=True, default="")      # written notes
    url = models.URLField(max_length=500, blank=True, default="")  # video, PDF or web link
    file = models.FileField(upload_to="materials/%Y/%m/", blank=True, default="")  # uploaded video or PDF
    uploaded_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="materials")
    order_no = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["topic_id", "order_no", "id"]

    def __str__(self):
        return self.title


class MaterialDone(models.Model):
    """A student marked a material as finished. Feeds the progress bars."""
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="materials_done")
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name="done_by")
    done_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "material"], name="unique_material_done")]


# Sections of the three guidance areas. The admin adds content under one of these.
GUIDE_SECTIONS = {
    "JOB_PREP": [("aptitude", "Aptitude"), ("reasoning", "Reasoning"), ("coding", "Coding"), ("technical", "Technical interview"), ("hr", "HR interview"), ("projects", "Projects")],
    "CAREER": [("technologies", "Technologies"), ("paths", "Career paths"), ("roadmap", "Roadmap"), ("projects", "Projects")],
    "COMM": [("spoken", "Spoken English"), ("vocabulary", "Vocabulary"), ("grammar", "Grammar"), ("speaking", "Speaking"), ("listening", "Listening"),
             ("gd", "Group discussion"), ("presentation", "Presentation"), ("interview", "Interview"), ("professional", "Professional")],
}


class Guide(models.Model):
    """One lesson in Job preparation, Career growth or Communication, written or uploaded by the admin."""
    class Area(models.TextChoices):
        JOB_PREP = "JOB_PREP", "Job preparation"
        CAREER = "CAREER", "Career growth"
        COMM = "COMM", "Communication"

    area = models.CharField(max_length=10, choices=Area.choices)
    section = models.CharField(max_length=20)
    group = models.CharField(max_length=80, blank=True, default="")  # optional heading inside a section, e.g. "Quantitative"
    kind = models.CharField(max_length=5, choices=Material.Kind.choices, default=Material.Kind.NOTES)
    title = models.CharField(max_length=150)
    body = models.TextField(blank=True, default="")
    url = models.URLField(max_length=500, blank=True, default="")
    file = models.FileField(upload_to="guides/%Y/%m/", blank=True, default="")
    uploaded_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="guides")
    order_no = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["area", "section", "group", "order_no", "id"]

    def __str__(self):
        return self.title


class GuideDone(models.Model):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="guides_done")
    guide = models.ForeignKey(Guide, on_delete=models.CASCADE, related_name="done_by")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "guide"], name="unique_guide_done")]
