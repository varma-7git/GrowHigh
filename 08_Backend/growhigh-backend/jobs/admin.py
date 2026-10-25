from django.contrib import admin

from .models import Application, Job

admin.site.register(Job, list_display=("title", "company_name", "job_type", "status", "is_active"), list_filter=("job_type", "status"))
admin.site.register(Application, list_display=("job", "student", "applied_at"))
