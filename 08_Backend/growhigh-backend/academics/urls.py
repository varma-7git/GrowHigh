from rest_framework.routers import SimpleRouter

from .views import BranchViewSet, GuideViewSet, MaterialViewSet, RegulationViewSet, SubjectViewSet, TopicViewSet

router = SimpleRouter()
router.register("branches", BranchViewSet, basename="branch")
router.register("regulations", RegulationViewSet, basename="regulation")
router.register("subjects", SubjectViewSet, basename="subject")
router.register("topics", TopicViewSet, basename="topic")
router.register("guides", GuideViewSet, basename="guide")
router.register("materials", MaterialViewSet, basename="material")

urlpatterns = router.urls
