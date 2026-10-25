from django.urls import path
from rest_framework.routers import SimpleRouter

from . import attempts as at
from . import performance as pf
from . import progress as pg
from .papers import PaperViewSet
from .views import QuestionViewSet, RosterView, TestViewSet

router = SimpleRouter()
router.register("questions", QuestionViewSet, basename="question")
router.register("tests", TestViewSet, basename="test")
router.register("papers", PaperViewSet, basename="paper")

urlpatterns = [
    path("roster/", RosterView.as_view()),
    path("student/progress/", pg.StudentProgressView.as_view()),
    path("performance/summary/", pf.PerformanceSummaryView.as_view()),
    path("performance/tests/<int:pk>/", pf.TestResultsView.as_view()),
    path("performance/students/", pf.StudentPerformanceView.as_view()),
    path("practice/start/", at.PracticeStartView.as_view()),
    path("attempts/", at.AttemptListView.as_view()),
    path("attempts/<int:pk>/", at.AttemptDetailView.as_view()),
    path("attempts/<int:pk>/answer/", at.AttemptAnswerView.as_view()),
    path("attempts/<int:pk>/submit/", at.AttemptSubmitView.as_view()),
] + router.urls
