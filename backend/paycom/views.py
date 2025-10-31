"""
Paycom views for employee data management and sync operations
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.core.management import call_command
from django.http import JsonResponse
import logging
import traceback
from datetime import datetime

from .models import PaycomEmployee
from .serializers import PaycomEmployeeSerializer
from .filters import PaycomEmployeeFilter

logger = logging.getLogger(__name__)


class PaycomEmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Paycom employee data
    """
    queryset = PaycomEmployee.objects.all()
    serializer_class = PaycomEmployeeSerializer
    filterset_class = PaycomEmployeeFilter
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        
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
        # Get unique location descriptions as facilities
        facilities = PaycomEmployee.objects.values_list('location_description', flat=True).distinct().exclude(location_description='')
        return Response({
            'facilities': list(facilities)
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
        """Trigger Paycom sync manually"""
        try:
            logger.info("Starting Paycom sync via ViewSet action")
            
            # Run the time tracking sync command
            call_command('sync_paycom_time_tracking', days_back=2)
            
            logger.info("Paycom sync completed successfully via ViewSet action")
            
            return Response({
                'status': 'success',
                'message': 'Paycom sync completed successfully',
                'timestamp': str(datetime.now())
            })
            
        except Exception as e:
            logger.error(f"Paycom sync failed via ViewSet action: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            return Response({
                'status': 'error',
                'message': f'Sync failed: {str(e)}',
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
        import sys
        
        logger.info("Running migrations via API endpoint")
        
        # Capture migration output
        output = StringIO()
        old_stdout = sys.stdout
        sys.stdout = output
        
        try:
            # Run migrations
            call_command('migrate', verbosity=2, stdout=output)
            migration_output = output.getvalue()
            logger.info(f"Migration output: {migration_output}")
        finally:
            sys.stdout = old_stdout
        
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
            'timestamp': str(datetime.now())
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)