"""
URL configuration for abst project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from adls.views import ADLViewSet
from residents.views import ResidentViewSet, FacilityViewSet, FacilitySectionViewSet
from users.views import UserViewSet, FacilityAccessViewSet

router = DefaultRouter()
router.register(r'adls', ADLViewSet)
router.register(r'residents', ResidentViewSet)
router.register(r'users', UserViewSet)
router.register(r'facilities', FacilityViewSet)
router.register(r'facilitysections', FacilitySectionViewSet)
router.register(r'facility-access', FacilityAccessViewSet, basename='facility-access')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('', include('users.urls')),  # Include users app URLs
]
