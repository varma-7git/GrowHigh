from django.contrib import admin

from .models import CompanyProfile, FacultyProfile, StudentProfile, User

admin.site.register(User, list_display=("login_id", "full_name", "email", "role", "is_active", "created_at"), search_fields=("login_id", "full_name", "email"), list_filter=("role", "is_active"))
admin.site.register(StudentProfile, list_display=("user", "branch", "year_of_study"))
admin.site.register(FacultyProfile, list_display=("user", "department", "status"), list_filter=("status",))
admin.site.register(CompanyProfile, list_display=("company_name", "user", "status"), list_filter=("status",))
