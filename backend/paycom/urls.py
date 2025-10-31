from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'employees', views.PaycomEmployeeViewSet)
router.register(r'sync-logs', views.PaycomSyncLogViewSet)
router.register(r'files', views.PaycomFileViewSet)
router.register(r'sync', views.PaycomSyncViewSet, basename='sync')

urlpatterns = [
    path('', include(router.urls)),
    path('trigger-sync/', views.trigger_paycom_sync, name='trigger_paycom_sync'),
    path('sync-status/', views.sync_status, name='sync_status'),
    path('run-migrations/', views.run_migrations, name='run_migrations'),
]
