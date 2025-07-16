from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, FacilityAccessViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'facility-access', FacilityAccessViewSet, basename='facility-access')

urlpatterns = [
    path('api/', include(router.urls)),
] 