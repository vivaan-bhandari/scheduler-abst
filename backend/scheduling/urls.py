from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StaffViewSet, 
    ShiftViewSet, 
    StaffAssignmentViewSet,
    StaffAvailabilityViewSet,
    AIInsightViewSet, 
    AIRecommendationViewSet,
    TimeTrackingViewSet,
    WeeklyHoursSummaryViewSet
)

router = DefaultRouter()
router.register(r'staff', StaffViewSet)
router.register(r'shifts', ShiftViewSet)
router.register(r'assignments', StaffAssignmentViewSet)
router.register(r'staff-availability', StaffAvailabilityViewSet)
router.register(r'ai-insights', AIInsightViewSet)
router.register(r'ai-recommendations', AIRecommendationViewSet)
router.register(r'time-tracking', TimeTrackingViewSet)
router.register(r'weekly-hours-summary', WeeklyHoursSummaryViewSet)

urlpatterns = [
    path('', include(router.urls)),
]