from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import JobViewSet, MyApplicationsView

router = SimpleRouter()
router.register("jobs", JobViewSet, basename="job")

urlpatterns = [path("my-applications/", MyApplicationsView.as_view())] + router.urls
