from django.urls import path
from . import views

# Note: Paycom ViewSets are registered in abst/urls.py router
# This file only contains individual endpoint paths
urlpatterns = [
    path('trigger-sync/', views.trigger_paycom_sync, name='trigger_paycom_sync'),
    path('sync-status/', views.sync_status, name='sync_status'),
    path('run-migrations/', views.run_migrations, name='run_migrations'),
    path('check-config/', views.check_sftp_config, name='check_sftp_config'),  # Debug endpoint
]
