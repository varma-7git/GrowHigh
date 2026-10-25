from rest_framework import serializers

from .models import GUIDE_SECTIONS, Guide, Branch, Material, Regulation, Subject, Topic


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "code", "is_active"]
        validators = []

    def validate(self, attrs):
        qs = Branch.objects.all()
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if "name" in attrs and qs.filter(name__iexact=attrs["name"]).exists():
            raise serializers.ValidationError({"name": ["A branch with this name already exists."]})
        if "code" in attrs and qs.filter(code__iexact=attrs["code"]).exists():
            raise serializers.ValidationError({"code": ["A branch with this code already exists."]})
        return attrs


class RegulationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Regulation
        fields = ["id", "code", "name", "is_active"]
        validators = []

    def validate_code(self, value):
        value = value.strip().upper()
        qs = Regulation.objects.filter(code__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This regulation already exists.")
        return value


class SubjectSerializer(serializers.ModelSerializer):
    branch_id = serializers.PrimaryKeyRelatedField(source="branch", queryset=Branch.objects.all(), allow_null=True, required=False)

    regulation_id = serializers.PrimaryKeyRelatedField(source="regulation", queryset=Regulation.objects.all(), allow_null=True, required=False)
    semester = serializers.IntegerField(min_value=1, max_value=6, allow_null=True, required=False)

    class Meta:
        model = Subject
        fields = ["id", "branch_id", "regulation_id", "semester", "name", "code", "marks", "is_active"]
        validators = []

    def validate(self, attrs):
        branch = attrs.get("branch", self.instance.branch if self.instance else None)
        regulation = attrs.get("regulation", self.instance.regulation if self.instance else None)
        name = attrs.get("name", self.instance.name if self.instance else None)
        qs = Subject.objects.filter(branch=branch, regulation=regulation, name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if name and qs.exists():
            raise serializers.ValidationError({"name": ["This subject already exists for this branch and regulation."]})
        return attrs


class TopicSerializer(serializers.ModelSerializer):
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=Subject.objects.all())

    class Meta:
        model = Topic
        fields = ["id", "subject_id", "name", "description", "order_no", "is_active"]
        validators = []

    def validate(self, attrs):
        subject = attrs.get("subject", self.instance.subject if self.instance else None)
        name = attrs.get("name", self.instance.name if self.instance else None)
        qs = Topic.objects.filter(subject=subject, name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if name and qs.exists():
            raise serializers.ValidationError({"name": ["This topic already exists in this subject."]})
        return attrs


class FormBoolean(serializers.BooleanField):
    """A missing flag in a multipart upload keeps the model default instead of becoming False."""
    default_empty_html = serializers.empty


MAX_VIDEO_MB = 300
MAX_PDF_MB = 25
VIDEO_EXT = (".mp4", ".webm", ".mov", ".m4v")


class MaterialSerializer(serializers.ModelSerializer):
    topic_id = serializers.PrimaryKeyRelatedField(source="topic", queryset=Topic.objects.all())
    file = serializers.FileField(write_only=True, required=False, allow_null=True)
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()
    done = serializers.SerializerMethodField()
    is_active = FormBoolean(required=False)

    class Meta:
        model = Material
        fields = ["id", "topic_id", "kind", "title", "body", "url", "file", "file_url", "order_no", "is_active", "uploaded_by_name", "mine", "done"]

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.full_name if obj.uploaded_by else None

    def get_mine(self, obj):
        request = self.context.get("request")
        return bool(request and obj.uploaded_by_id == request.user.id)

    def get_done(self, obj):
        done = self.context.get("done_ids")
        return obj.id in done if done is not None else False

    def validate_file(self, f):
        if f is None:
            return f
        name = f.name.lower()
        if name.endswith(".pdf"):
            if f.size > MAX_PDF_MB * 1024 * 1024:
                raise serializers.ValidationError(f"A PDF can be at most {MAX_PDF_MB} MB.")
        elif name.endswith(VIDEO_EXT):
            if f.size > MAX_VIDEO_MB * 1024 * 1024:
                raise serializers.ValidationError(f"A video can be at most {MAX_VIDEO_MB} MB. Upload a shorter video or share a link.")
        else:
            raise serializers.ValidationError("Upload an MP4, WebM or MOV video, or a PDF.")
        return f

    def validate(self, attrs):
        kind = attrs.get("kind", self.instance.kind if self.instance else "NOTES")
        body = attrs.get("body", self.instance.body if self.instance else "")
        url = attrs.get("url", self.instance.url if self.instance else "")
        has_file = bool(attrs.get("file") or (self.instance and self.instance.file))
        if kind == "NOTES" and not body.strip():
            raise serializers.ValidationError({"body": ["Write the notes."]})
        if kind in ("VIDEO", "PDF") and not (url or has_file):
            raise serializers.ValidationError({"file": ["Upload a file or add a link."]})
        if kind == "LINK" and not url:
            raise serializers.ValidationError({"url": ["Add the link."]})
        if kind == "VIDEO" and attrs.get("file") and not attrs["file"].name.lower().endswith(VIDEO_EXT):
            raise serializers.ValidationError({"file": ["A video must be MP4, WebM or MOV."]})
        if kind == "PDF" and attrs.get("file") and not attrs["file"].name.lower().endswith(".pdf"):
            raise serializers.ValidationError({"file": ["A PDF must be a .pdf file."]})
        return attrs


class GuideSerializer(MaterialSerializer):
    topic_id = None  # a guide belongs to an area and section, not a topic
    area = serializers.ChoiceField(choices=Guide.Area.choices)

    class Meta:
        model = Guide
        fields = ["id", "area", "section", "group", "kind", "title", "body", "url", "file", "file_url", "order_no", "is_active", "uploaded_by_name", "mine", "done"]

    def validate(self, attrs):
        area = attrs.get("area", self.instance.area if self.instance else None)
        section = attrs.get("section", self.instance.section if self.instance else None)
        if section not in dict(GUIDE_SECTIONS.get(area, [])):
            raise serializers.ValidationError({"section": ["Choose a section that belongs to this area."]})
        return super().validate(attrs)
