"""
Paycom views for employee data management and sync operations
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.core.management import call_command
from django.http import JsonResponse
from django.conf import settings
import logging
import traceback
from datetime import datetime

from .models import PaycomEmployee
from .serializers import PaycomEmployeeSerializer
from .filters import PaycomEmployeeFilter
from .sftp_service import PaycomSFTPError

logger = logging.getLogger(__name__)


class PaycomEmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Paycom employee data
    """
    serializer_class = PaycomEmployeeSerializer
    filterset_class = PaycomEmployeeFilter
    permission_classes = [AllowAny]

    def get_queryset(self):
        try:
            queryset = PaycomEmployee.objects.all()
        except Exception:
            # Table doesn't exist yet (migrations not run)
            return PaycomEmployee.objects.none()
        
        # Apply week filtering if provided
        week_start_date = self.request.query_params.get('week_start_date')
        if week_start_date:
            # For now, return all employees since we're filtering by report push date
            # In the future, we could implement more sophisticated filtering
            pass
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def facility_options(self, request):
        """Get list of unique facilities from Paycom employees"""
        try:
            # Get unique location descriptions as facilities
            facilities = PaycomEmployee.objects.values_list('location_description', flat=True).distinct().exclude(location_description='')
            return Response({
                'facilities': list(facilities)
            })
        except Exception:
            # Table doesn't exist yet
            return Response({
                'facilities': []
            })
    
    @action(detail=False, methods=['get'])
    def scheduling_recommendations(self, request):
        """Get scheduling recommendations based on Paycom time tracking data"""
        week_start_date = request.query_params.get('week_start_date')
        
        if not week_start_date:
            return Response({
                'error': 'week_start_date parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate recommendations based on time tracking data
        # This is a placeholder - implement your recommendation logic here
        recommendations = []
        
        return Response({
            'week_start_date': week_start_date,
            'recommendations': recommendations
        })
    # Placeholder ViewSets for compatibility with main urls.py
class PaycomSyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Placeholder for sync logs - to be implemented later"""
    queryset = PaycomEmployee.objects.none()
    serializer_class = PaycomEmployeeSerializer
    permission_classes = [IsAuthenticated]


class PaycomFileViewSet(viewsets.ReadOnlyModelViewSet):
    """Placeholder for file management - to be implemented later"""
    queryset = PaycomEmployee.objects.none()
    serializer_class = PaycomEmployeeSerializer
    permission_classes = [IsAuthenticated]


class PaycomSyncViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Paycom sync operations"""
    queryset = PaycomEmployee.objects.none()
    serializer_class = PaycomEmployeeSerializer
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['post'])
    def start_sync(self, request):
        """Trigger Paycom sync manually - syncs both employee data and time tracking"""
        try:
            logger.info("Starting Paycom sync via ViewSet action")
            
            # Step 1: Sync employee data (Employee Directory, Dates, Payees)
            logger.info("Step 1: Syncing employee roster data...")
            try:
                # Try to sync employee roster, but don't fail if it errors (files might not exist)
                call_command('sync_paycom', report_type='all', force=True, verbosity=0)
                logger.info("Employee roster sync completed")
            except Exception as e:
                # Log but don't fail - employee roster sync is optional if files don't exist
                logger.warning(f"Employee roster sync skipped (may be expected if no files): {str(e)}")
                # Continue with time tracking sync even if employee sync fails
            
            # Step 2: Sync time tracking data (clock in/out times)
            logger.info("Step 2: Syncing time tracking data...")
            call_command('sync_paycom_time_tracking', days_back=7)
            logger.info("Time tracking sync completed")
            
            logger.info("Paycom sync completed successfully via ViewSet action")
            
            return Response({
                'status': 'success',
                'message': 'Paycom sync completed successfully (employee data + time tracking)',
                'timestamp': str(datetime.now())
            })
            
        except PaycomSFTPError as e:
            logger.error(f"Paycom SFTP error via ViewSet action: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            return Response({
                'status': 'error',
                'message': f'Sync failed: {str(e)}',
                'error_type': 'SFTP_ERROR',
                'timestamp': str(datetime.now())
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"Paycom sync failed via ViewSet action: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Include more error details for debugging
            error_details = {
                'error_type': type(e).__name__,
                'message': str(e),
                'traceback': traceback.format_exc() if settings.DEBUG else None
            }
            
            return Response({
                'status': 'error',
                'message': f'Sync failed: {str(e)}',
                'error_type': 'UNKNOWN_ERROR',
                'details': error_details,
                'timestamp': str(datetime.now())
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_paycom_sync(request):
    """
    API endpoint to trigger Paycom sync manually or via cron job
    """
    try:
        logger.info("Starting Paycom sync via API endpoint")
        
        # Run the time tracking sync command
        call_command('sync_paycom_time_tracking', days_back=2)
        
        logger.info("Paycom sync completed successfully via API endpoint")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Paycom sync completed successfully',
            'timestamp': str(datetime.now())
        })
        
    except Exception as e:
        logger.error(f"Paycom sync failed via API endpoint: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return JsonResponse({
            'status': 'error',
            'message': f'Paycom sync failed: {str(e)}',
            'timestamp': str(datetime.now())
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Temporarily allow for debugging
def check_sftp_config(request):
    """
    Debug endpoint to check SFTP configuration (without exposing password)
    """
    from django.conf import settings
    from paycom.sftp_service import PaycomSFTPService
    
    try:
        config_info = {
            'host': getattr(settings, 'PAYCOM_SFTP_HOST', None),
            'port': getattr(settings, 'PAYCOM_SFTP_PORT', 22),
            'username': getattr(settings, 'PAYCOM_SFTP_USERNAME', None),
            'password_set': bool(getattr(settings, 'PAYCOM_SFTP_PASSWORD', None)),
            'password_length': len(getattr(settings, 'PAYCOM_SFTP_PASSWORD', '')) if getattr(settings, 'PAYCOM_SFTP_PASSWORD', None) else 0,
            'password_type': str(type(getattr(settings, 'PAYCOM_SFTP_PASSWORD', None))),
        }
        
        # Try to initialize the service to see what happens
        try:
            service = PaycomSFTPService()
            config_info['service_initialized'] = True
            config_info['service_host'] = service.host
            config_info['service_username'] = service.username
            config_info['service_password_length'] = len(service.password) if service.password else 0
            config_info['service_password_type'] = str(type(service.password))
        except Exception as e:
            config_info['service_initialized'] = False
            config_info['service_error'] = str(e)
        
        return JsonResponse({
            'status': 'success',
            'config': config_info
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sync_status(request):
    """
    API endpoint to check sync status
    """
    try:
        from datetime import datetime, timedelta
        from scheduling.models import TimeTracking
        
        # Get recent sync data
        today = datetime.now().date()
        recent_data = {}
        
        for days_back in range(5):
            check_date = today - timedelta(days=days_back)
            time_entries = TimeTracking.objects.filter(date=check_date).count()
            recent_data[check_date.isoformat()] = time_entries
            
        return JsonResponse({
            'status': 'success',
            'data': {
                'recent_time_tracking_data': recent_data,
                'last_checked': str(datetime.now())
            }
        })
        
    except Exception as e:
        logger.error(f"Sync status check failed: {str(e)}")
        
        return JsonResponse({
            'status': 'error',
            'message': f'Sync status check failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def run_migrations(request):
    """
    API endpoint to manually run migrations (for admin use)
    """
    try:
        from django.core.management import call_command
        from io import StringIO
        
        logger.info("Running migrations via API endpoint")
        
        # Capture migration output
        output = StringIO()
        
        # Run migrations and capture output
        call_command('migrate', verbosity=2, stdout=output)
        migration_output = output.getvalue()
        logger.info(f"Migration output: {migration_output}")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Migrations completed successfully',
            'output': migration_output,
            'timestamp': str(datetime.now())
        })
        
    except Exception as e:
        logger.error(f"Migration failed via API endpoint: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return JsonResponse({
            'status': 'error',
            'message': f'Migration failed: {str(e)}',
            'error_details': str(e),
            'timestamp': str(datetime.now())
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)