from rest_framework import serializers

from academics.models import Branch, Topic
from accounts.models import User

from .models import Attempt, Question, Test, TestQuestion


class QuestionSerializer(serializers.ModelSerializer):
    topic_id = serializers.PrimaryKeyRelatedField(source="topic", queryset=Topic.objects.all())
    topic_name = serializers.CharField(source="topic.name", read_only=True)
    subject_id = serializers.IntegerField(source="topic.subject_id", read_only=True)
    subject_name = serializers.CharField(source="topic.subject.name", read_only=True)
    options = serializers.ListField(child=serializers.CharField(max_length=300), min_length=4, max_length=4)
    created_by_name = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(required=False)

    class Meta:
        model = Question
        fields = ["id", "topic_id", "topic_name", "subject_id", "subject_name", "text", "options", "correct", "explanation",
                  "created_by_name", "mine", "is_active", "created_at"]

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else None

    def get_mine(self, obj):
        request = self.context.get("request")
        return bool(request and obj.created_by_id == request.user.id)

    def to_representation(self, obj):
        data = super().to_representation(obj)
        data["options"] = obj.options
        return data

    def validate_options(self, value):
        cleaned = [v.strip() for v in value]
        if any(not v for v in cleaned):
            raise serializers.ValidationError("Fill all four options.")
        if len({v.lower() for v in cleaned}) < 4:
            raise serializers.ValidationError("The four options must be different.")
        return cleaned

    def validate_correct(self, value):
        if value not in (0, 1, 2, 3):
            raise serializers.ValidationError("Pick the correct option: A, B, C or D.")
        return value

    def validate_text(self, value):
        if not value.strip():
            raise serializers.ValidationError("Write the question.")
        return value.strip()

    def _apply(self, validated):
        options = validated.pop("options", None)
        if options:
            validated["option_a"], validated["option_b"], validated["option_c"], validated["option_d"] = options
        return validated

    def create(self, validated):
        return Question.objects.create(**self._apply(validated))

    def update(self, instance, validated):
        for k, v in self._apply(validated).items():
            setattr(instance, k, v)
        instance.save()
        return instance


class TestSerializer(serializers.ModelSerializer):
    branch_id = serializers.PrimaryKeyRelatedField(source="branch", queryset=Branch.objects.all(), allow_null=True, required=False)
    branch_code = serializers.CharField(source="branch.code", read_only=True, default=None)
    question_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    question_count = serializers.SerializerMethodField()
    assigned_count = serializers.SerializerMethodField()
    assigned_ids = serializers.SerializerMethodField()
    status = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()
    my_attempt = serializers.SerializerMethodField()
    year_of_study = serializers.ChoiceField(choices=[1, 2, 3], allow_null=True, required=False)
    is_active = serializers.BooleanField(required=False)

    class Meta:
        model = Test
        fields = ["id", "name", "test_type", "scheduled_date", "start_time", "duration_minutes", "branch_id", "branch_code", "year_of_study",
                  "question_ids", "question_count", "assigned_count", "assigned_ids", "status", "created_by_name", "mine", "my_attempt", "is_active"]

    def get_question_count(self, obj):
        return obj.items.count()

    def get_assigned_count(self, obj):
        return obj.assignments.count()

    def get_assigned_ids(self, obj):
        # only the owner sees who has the test; students just see their own test
        request = self.context.get("request")
        if request and request.user.role == "STUDENT":
            return []
        return list(obj.assignments.values_list("student_id", flat=True))

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else None

    def get_mine(self, obj):
        request = self.context.get("request")
        return bool(request and obj.created_by_id == request.user.id)

    def get_my_attempt(self, obj):
        request = self.context.get("request")
        if not request or request.user.role != "STUDENT":
            return None
        a = Attempt.objects.filter(test=obj, student=request.user).first()
        if not a:
            return None
        pct = round(a.score * 100 / a.total) if a.total else 0
        return {"id": a.id, "submitted": a.submitted_at is not None, "score": a.score, "total": a.total, "percent": pct if a.submitted_at else None}

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Enter a test name.")
        return value.strip()

    def validate_duration_minutes(self, value):
        if not 1 <= value <= 300:
            raise serializers.ValidationError("Duration must be between 1 and 300 minutes.")
        return value

    def validate_question_ids(self, ids):
        found = set(Question.objects.filter(pk__in=ids, is_active=True).values_list("pk", flat=True))
        missing = [i for i in ids if i not in found]
        if missing:
            raise serializers.ValidationError("Some selected questions are missing or hidden.")
        if len(set(ids)) != len(ids):
            raise serializers.ValidationError("A question was selected twice.")
        return ids

    def validate(self, attrs):
        if self.instance is None and not attrs.get("question_ids"):
            raise serializers.ValidationError({"question_ids": ["Select at least one question."]})
        return attrs

    def _set_questions(self, test, ids):
        test.items.all().delete()
        TestQuestion.objects.bulk_create([TestQuestion(test=test, question_id=q, order_no=i) for i, q in enumerate(ids, start=1)])

    def create(self, validated):
        ids = validated.pop("question_ids")
        test = Test.objects.create(**validated)
        self._set_questions(test, ids)
        return test

    def update(self, instance, validated):
        ids = validated.pop("question_ids", None)
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if ids is not None:
            self._set_questions(instance, ids)
        return instance


class RosterSerializer(serializers.ModelSerializer):
    branch_code = serializers.SerializerMethodField()
    year_of_study = serializers.SerializerMethodField()
    regulation = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "login_id", "full_name", "email", "branch_code", "year_of_study", "regulation"]

    def get_branch_code(self, obj):
        return obj.student_profile.branch.code

    def get_year_of_study(self, obj):
        return obj.student_profile.year_of_study

    def get_regulation(self, obj):
        r = obj.student_profile.regulation
        return r.code if r else None
