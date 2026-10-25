"""Every app adds its own urls here (prefix /api/v1/)."""
from django.urls import include, path

urlpatterns = [
    path("", include("accounts.urls")),
    path("", include("academics.urls")),
    path("", include("jobs.urls")),
    path("", include("exams.urls")),
    # next steps: questions, tests, learning
]
