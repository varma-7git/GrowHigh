from django.contrib import admin

from .models import Attempt, Paper, Question, Test, TestAssignment, TestQuestion

admin.site.register(Question, list_display=("text", "topic", "is_active"))
admin.site.register(Test, list_display=("name", "test_type", "scheduled_date", "branch", "year_of_study"))
admin.site.register(TestQuestion)
admin.site.register(TestAssignment)
admin.site.register(Attempt, list_display=("title", "student", "score", "total", "submitted_at"))
admin.site.register(Paper, list_display=("year", "title", "branch", "is_active"))
