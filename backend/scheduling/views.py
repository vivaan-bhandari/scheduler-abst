from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import serializers
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count, Sum
from django.utils import timezone
from django.conf import settings
from datetime import datetime, timedelta
import calendar

from .models import (
    Staff, ShiftTemplate, Shift, StaffAssignment, StaffAvailability,
    AIInsight, AIRecommendation, TimeTracking, WeeklyHoursSummary
)
from .serializers import (
    StaffSerializer, ShiftTemplateSerializer, ShiftSerializer,
    StaffAssignmentSerializer, StaffAvailabilitySerializer,
    AIInsightSerializer, AIRecommendationSerializer,
    DashboardStatsSerializer
)
from users.permissions import HasFacilityAccess


class AllowGetWithoutAuth(IsAuthenticated):
    """Allow GET requests without authentication, require auth for other methods"""
    def has_permission(self, request, view):
        if request.method == 'GET':
            return True
        return super().has_permission(request, view)


class AllowGetPostWithoutAuth(IsAuthenticated):
    """Allow GET and POST requests without authentication, require auth for other methods"""
    def has_permission(self, request, view):
        if request.method in ['GET', 'POST']:
            return True
        return super().has_permission(request, view)

class AllowGetPostDeleteWithoutAuth(IsAuthenticated):
    """Allow GET, POST, and DELETE requests without authentication, require auth for other methods"""
    def has_permission(self, request, view):
        if request.method in ['GET', 'POST', 'DELETE']:
            return True
        return super().has_permission(request, view)

class AllowGetPostWithoutAuthNoFacility(IsAuthenticated):
    """Allow GET and POST requests without authentication and without facility access check"""
    def has_permission(self, request, view):
        if request.method in ['GET', 'POST']:
            return True
        return super().has_permission(request, view)


class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [AllowGetWithoutAuth, HasFacilityAccess]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'status', 'facility']
    search_fields = ['first_name', 'last_name', 'email', 'employee_id']
    ordering_fields = ['last_name', 'first_name', 'hire_date', 'created_at']
    ordering = ['last_name', 'first_name']
    
    def get_queryset(self):
        user = self.request.user
        # Check if user has facility access
        try:
            from users.models import FacilityAccess
            facility_access = FacilityAccess.objects.filter(user=user, status='approved').first()
            
            if facility_access:
                # If facility filter is provided, use it; otherwise use user's approved facilities
                facility_id = self.request.query_params.get('facility')
                if facility_id:
                    # Check if user has access to the requested facility
                    if FacilityAccess.objects.filter(user=user, facility_id=facility_id, status='approved').exists():
                        # Only return active staff by default
                        return Staff.objects.filter(facility_id=facility_id, status='active')
                    else:
                        return Staff.objects.none()
                else:
                    # Return staff from all facilities user has access to
                    user_facilities = FacilityAccess.objects.filter(user=user, status='approved').values_list('facility_id', flat=True)
                    # Only return active staff by default
                    return Staff.objects.filter(facility_id__in=user_facilities, status='active')
            else:
                return Staff.objects.none()
        except Exception:
            return Staff.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        # Get facility_id from the serializer data (sent by frontend)
        facility_id = serializer.validated_data.get('facility_id')
        if facility_id:
            from residents.models import Facility
            try:
                facility = Facility.objects.get(id=facility_id)
                serializer.save(facility=facility)
            except Facility.DoesNotExist:
                raise serializers.ValidationError("Invalid facility ID")
        else:
            # Fallback to user's facility if no facility_id provided
            if hasattr(user, 'facility_access'):
                serializer.save(facility=user.facility_access.facility)
            else:
                raise serializers.ValidationError("No facility specified and user has no default facility")
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get staff summary statistics for the current facility"""
        user = request.user
        if not hasattr(user, 'facility_access'):
            return Response({'error': 'No facility access'}, status=status.HTTP_403_FORBIDDEN)
        
        facility = user.facility_access.facility
        staff_queryset = Staff.objects.filter(facility=facility)
        
        summary = {
            'count': staff_queryset.count(),
            'active_count': staff_queryset.filter(status='active').count(),
            'inactive_count': staff_queryset.filter(status__in=['inactive', 'on_leave', 'terminated']).count(),
        }
        
        serializer = DashboardStatsSerializer(summary)
        return Response(serializer.data)


class ShiftTemplateViewSet(viewsets.ModelViewSet):
    queryset = ShiftTemplate.objects.all()
    serializer_class = ShiftTemplateSerializer
    permission_classes = [IsAuthenticated, HasFacilityAccess]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['shift_type', 'is_active', 'facility']
    search_fields = ['template_name']
    ordering_fields = ['template_name', 'shift_type', 'start_time']
    ordering = ['shift_type', 'start_time']
    
    def get_queryset(self):
        user = self.request.user
        # Check if user has facility access
        try:
            from users.models import FacilityAccess
            facility_access = FacilityAccess.objects.filter(user=user, status='approved').first()
            
            if facility_access:
                # If facility filter is provided, use it; otherwise use user's approved facilities
                facility_id = self.request.query_params.get('facility')
                if facility_id:
                    # Check if user has access to the requested facility
                    if FacilityAccess.objects.filter(user=user, facility_id=facility_id, status='approved').exists():
                        return ShiftTemplate.objects.filter(facility_id=facility_id)
                    else:
                        return ShiftTemplate.objects.none()
                else:
                    # Return templates from all facilities user has access to
                    user_facilities = FacilityAccess.objects.filter(user=user, status='approved').values_list('facility_id', flat=True)
                    return ShiftTemplate.objects.filter(facility_id__in=user_facilities)
            else:
                return ShiftTemplate.objects.none()
        except Exception:
            return ShiftTemplate.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        # Get facility_id from the serializer data (sent by frontend)
        facility_id = serializer.validated_data.get('facility_id')
        if facility_id:
            from residents.models import Facility
            try:
                facility = Facility.objects.get(id=facility_id)
                serializer.save(facility=facility)
            except Facility.DoesNotExist:
                raise serializers.ValidationError("Invalid facility ID")
        else:
            # Fallback to user's facility if no facility_id provided
            if hasattr(user, 'facility_access'):
                serializer.save(facility=user.facility_access.facility)
            else:
                raise serializers.ValidationError("No facility specified and user has no default facility")
    
    @action(detail=True, methods=['post'])
    def copy(self, request, pk=None):
        """Copy a shift template"""
        template = self.get_object()
        new_template = ShiftTemplate.objects.create(
            template_name=f"{template.template_name} (Copy)",
            shift_type=template.shift_type,
            start_time=template.start_time,
            end_time=template.end_time,
            duration=template.duration,
            required_staff=template.required_staff,
            is_active=False,  # Start as inactive
            facility=template.facility
        )
        
        serializer = self.get_serializer(new_template)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [AllowGetWithoutAuth, HasFacilityAccess]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['date', 'shift_template__shift_type', 'facility']
    search_fields = ['shift_template__template_name']
    ordering_fields = ['date', 'shift_template__start_time']
    ordering = ['-date', 'shift_template__start_time']
    
    def get_queryset(self):
        user = self.request.user
        # Check if user has facility access
        try:
            from users.models import FacilityAccess
            facility_access = FacilityAccess.objects.filter(user=user, status='approved').first()
            
            if facility_access:
                # If facility filter is provided, use it; otherwise use user's approved facilities
                facility_id = self.request.query_params.get('facility')
                if facility_id:
                    # Check if user has access to the requested facility
                    if FacilityAccess.objects.filter(user=user, facility_id=facility_id, status='approved').exists():
                        return Shift.objects.filter(facility_id=facility_id)
                    else:
                        return Shift.objects.none()
                else:
                    # Return shifts from all facilities user has access to
                    user_facilities = FacilityAccess.objects.filter(user=user, status='approved').values_list('facility_id', flat=True)
                    return Shift.objects.filter(facility_id__in=user_facilities)
            else:
                return Shift.objects.none()
        except Exception:
            return Shift.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        # Get facility_id from the serializer data (sent by frontend)
        facility_id = serializer.validated_data.get('facility_id')
        if facility_id:
            from residents.models import Facility
            try:
                facility = Facility.objects.get(id=facility_id)
                serializer.save(facility=facility)
            except Facility.DoesNotExist:
                raise serializers.ValidationError("Invalid facility ID")
        else:
            # Fallback to user's facility if no facility_id provided
            if hasattr(user, 'facility_access'):
                serializer.save(facility=user.facility_access.facility)
            else:
                raise serializers.ValidationError("No facility specified and user has no default facility")
    
    @action(detail=False, methods=['get'])
    def weekly(self, request):
        """Get shifts for a specific week"""
        week_start_param = request.query_params.get('week_start')
        print(f"🔍 DEBUG weekly shifts: week_start_param={week_start_param}")
        
        if week_start_param:
            try:
                week_start = datetime.strptime(week_start_param, '%Y-%m-%d').date()
                print(f"🔍 DEBUG weekly shifts: parsed week_start={week_start}")
            except ValueError:
                return Response({'error': 'Invalid week_start format. Use YYYY-MM-DD'}, 
                              status=status.HTTP_400_BAD_REQUEST)
        else:
            # Default to current week
            today = timezone.now().date()
            week_start = today - timedelta(days=today.weekday())
            print(f"🔍 DEBUG weekly shifts: using default week_start={week_start}")
        
        week_end = week_start + timedelta(days=6)
        print(f"🔍 DEBUG weekly shifts: week range {week_start} to {week_end}")
        
        shifts = self.get_queryset().filter(
            date__gte=week_start,
            date__lte=week_end
        )
        
        print(f"🔍 DEBUG weekly shifts: found {shifts.count()} shifts")
        for shift in shifts:
            print(f"  - {shift.date} {shift.shift_template.shift_type}: {shift.required_staff_count} staff")
        
        serializer = self.get_serializer(shifts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def auto_fill(self, request):
        """Auto-fill staff assignments for a week"""
        week_start = request.data.get('week_start')
        if not week_start:
            return Response({'error': 'week_start is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            week_start = datetime.strptime(week_start, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid week_start format. Use YYYY-MM-DD'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        week_end = week_start + timedelta(days=6)
        
        # Get available staff and shifts for the week
        shifts = self.get_queryset().filter(date__gte=week_start, date__lte=week_end)
        staff = Staff.objects.filter(facility=request.user.facility_access.facility, status='active')
        
        # Simple auto-fill logic: assign staff to shifts based on availability
        assignments_created = 0
        for shift in shifts:
            if not StaffAssignment.objects.filter(shift=shift).exists():
                # Find available staff for this shift
                available_staff = staff.filter(
                    staffavailability__date=shift.date,
                    staffavailability__availability_status='available'
                ).first()
                
                if available_staff:
                    StaffAssignment.objects.create(
                        staff=available_staff,
                        shift=shift,
                        status='assigned'
                    )
                    assignments_created += 1
        
        return Response({
            'message': f'Auto-fill completed. {assignments_created} assignments created.',
            'assignments_created': assignments_created
        })
    
    @action(detail=False, methods=['post'])
    def clear_assignments(self, request):
        """Clear all staff assignments for a week"""
        week_start = request.data.get('week_start')
        if not week_start:
            return Response({'error': 'week_start is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            week_start = datetime.strptime(week_start, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid week_start format. Use YYYY-MM-DD'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        week_end = week_start + timedelta(days=6)
        
        # Get shifts for the week and delete their assignments
        shifts = self.get_queryset().filter(date__gte=week_start, date__lte=week_end)
        assignments_deleted = StaffAssignment.objects.filter(shift__in=shifts).delete()[0]
        
        return Response({
            'message': f'Cleared {assignments_deleted} assignments for the week.',
            'assignments_deleted': assignments_deleted
        })
    
    @action(detail=False, methods=['post'])
    def clear_shifts(self, request):
        """Clear all shifts for a week but maintain grid structure"""
        week_start = request.data.get('week_start')
        facility_id = request.data.get('facility')
        
        if not week_start:
            return Response({'error': 'week_start is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not facility_id:
            return Response({'error': 'facility is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from residents.models import Facility
            facility = Facility.objects.get(id=facility_id)
            week_start_date = datetime.strptime(week_start, '%Y-%m-%d').date()
        except Facility.DoesNotExist:
            return Response({'error': 'Facility not found'}, status=status.HTTP_404_NOT_FOUND)
        except ValueError:
            return Response({'error': 'Invalid week_start date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        
        week_end_date = week_start_date + timedelta(days=6)
        
        # Delete existing shifts for the week (and their assignments)
        existing_shifts = self.get_queryset().filter(
            facility=facility,
            date__gte=week_start_date,
            date__lte=week_end_date
        )
        shifts_deleted = existing_shifts.count()
        
        # Also delete all assignments for these shifts
        from .models import StaffAssignment
        shift_ids = list(existing_shifts.values_list('id', flat=True))
        assignments_deleted = StaffAssignment.objects.filter(shift_id__in=shift_ids).delete()[0]
        
        # Delete the shifts
        existing_shifts.delete()
        
        return Response({
            'message': f'Cleared {shifts_deleted} shifts and {assignments_deleted} assignments for the week. Grid will show empty.',
            'shifts_deleted': shifts_deleted,
            'assignments_deleted': assignments_deleted,
            'week_start': week_start_date.isoformat(),
            'week_end': week_end_date.isoformat()
        })


class StaffAssignmentViewSet(viewsets.ModelViewSet):
    queryset = StaffAssignment.objects.all()
    serializer_class = StaffAssignmentSerializer
    permission_classes = [AllowGetPostDeleteWithoutAuth, HasFacilityAccess]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'shift__facility', 'staff__role']
    search_fields = ['staff__first_name', 'staff__last_name', 'shift__shift_template__template_name']
    ordering_fields = ['assigned_at', 'shift__date']
    ordering = ['-assigned_at']
    
    def get_queryset(self):
        user = self.request.user
        print(f"🔍 StaffAssignmentViewSet.get_queryset() - User: {user}, is_superuser: {user.is_superuser}, is_staff: {user.is_staff}, is_authenticated: {user.is_authenticated}")
        
        # Superadmin and staff users can access all assignments
        if user.is_superuser or user.is_staff:
            facility_id = self.request.query_params.get('facility')
            print(f"🔍 StaffAssignmentViewSet - Superuser/Staff, facility_id: {facility_id}")
            if facility_id:
                queryset = StaffAssignment.objects.filter(shift__facility_id=facility_id)
                print(f"🔍 StaffAssignmentViewSet - Filtered by facility {facility_id}, count: {queryset.count()}")
                return queryset
            queryset = StaffAssignment.objects.all()
            print(f"🔍 StaffAssignmentViewSet - All assignments, count: {queryset.count()}")
            return queryset
        
        # Regular users with facility access
        try:
            from users.models import FacilityAccess
            facility_access = FacilityAccess.objects.filter(user=user, status='approved').first()
            
            if facility_access:
                # If facility filter is provided, use it; otherwise use user's approved facilities
                facility_id = self.request.query_params.get('facility')
                if facility_id:
                    # Check if user has access to the requested facility
                    if FacilityAccess.objects.filter(user=user, facility_id=facility_id, status='approved').exists():
                        return StaffAssignment.objects.filter(shift__facility_id=facility_id)
                    else:
                        return StaffAssignment.objects.none()
                else:
                    # Return assignments from all facilities user has access to
                    user_facilities = FacilityAccess.objects.filter(user=user, status='approved').values_list('facility_id', flat=True)
                    return StaffAssignment.objects.filter(shift__facility_id__in=user_facilities)
            else:
                return StaffAssignment.objects.none()
        except Exception:
            return StaffAssignment.objects.none()
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm a staff assignment"""
        assignment = self.get_object()
        assignment.status = 'confirmed'
        assignment.save()
        
        serializer = self.get_serializer(assignment)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a staff assignment"""
        assignment = self.get_object()
        assignment.status = 'cancelled'
        assignment.save()
        
        serializer = self.get_serializer(assignment)
        return Response(serializer.data)


class StaffAvailabilityViewSet(viewsets.ModelViewSet):
    queryset = StaffAvailability.objects.all()
    serializer_class = StaffAvailabilitySerializer
    permission_classes = [IsAuthenticated, HasFacilityAccess]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['availability_status', 'date', 'facility', 'staff__role']
    search_fields = ['staff__first_name', 'staff__last_name']
    ordering_fields = ['date', 'staff__last_name']
    ordering = ['-date', 'staff__last_name']
    
    def get_queryset(self):
        user = self.request.user
        
        # Superadmin and staff users can access all availability
        if user.is_superuser or user.is_staff:
            facility_id = self.request.query_params.get('facility')
            if facility_id:
                return StaffAvailability.objects.filter(facility_id=facility_id)
            return StaffAvailability.objects.all()
        
        # Check if user has facility access
        try:
            from users.models import FacilityAccess
            facility_access = FacilityAccess.objects.filter(user=user, status='approved').first()
            
            if (facility_access):
                # If facility filter is provided, use it; otherwise use user's approved facilities
                facility_id = self.request.query_params.get('facility')
                if facility_id:
                    # Check if user has access to the requested facility
                    if FacilityAccess.objects.filter(user=user, facility_id=facility_id, status='approved').exists():
                        return StaffAvailability.objects.filter(facility_id=facility_id)
                    else:
                        return StaffAvailability.objects.none()
                else:
                    # Return availability from all facilities user has access to
                    user_facilities = FacilityAccess.objects.filter(user=user, status='approved').values_list('facility_id', flat=True)
                    return StaffAvailability.objects.filter(facility_id__in=user_facilities)
            else:
                return StaffAvailability.objects.none()
        except Exception:
            return StaffAvailability.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        # Get facility_id from the serializer data (sent by frontend)
        facility_id = serializer.validated_data.get('facility_id')
        if facility_id:
            from residents.models import Facility
            try:
                facility = Facility.objects.get(id=facility_id)
                serializer.save(facility=facility)
            except Facility.DoesNotExist:
                raise serializers.ValidationError("Invalid facility ID")
        else:
            # Fallback to user's facility if no facility_id provided
            if hasattr(user, 'facility_access'):
                serializer.save(facility=user.facility_access.facility)
            else:
                raise serializers.ValidationError("No facility specified and user has no default facility")
    
    def perform_update(self, serializer):
        user = self.request.user
        # Get facility_id from the serializer data (sent by frontend)
        facility_id = serializer.validated_data.get('facility_id')
        if facility_id:
            from residents.models import Facility
            try:
                facility = Facility.objects.get(id=facility_id)
                serializer.save(facility=facility)
            except Facility.DoesNotExist:
                raise serializers.ValidationError("Invalid facility ID")
        else:
            # Fallback to user's facility if no facility_id provided
            if hasattr(user, 'facility_access'):
                serializer.save(facility=user.facility_access.facility)
            else:
                raise serializers.ValidationError("No facility specified and user has no default facility")
    
    @action(detail=False, methods=['get'])
    def weekly(self, request):
        """Get availability for a specific week"""
        week_start = request.query_params.get('week_start')
        if week_start:
            try:
                week_start = datetime.strptime(week_start, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Invalid week_start format. Use YYYY-MM-DD'}, 
                              status=status.HTTP_400_BAD_REQUEST)
        else:
            # Default to current week
            today = timezone.now().date()
            week_start = today - timedelta(days=today.weekday())
        
        week_end = week_start + timedelta(days=6)
        
        availability = self.get_queryset().filter(
            date__gte=week_start,
            date__lte=week_end
        )
        
        serializer = self.get_serializer(availability, many=True)
        return Response(serializer.data)


class AIInsightViewSet(viewsets.ModelViewSet):
    queryset = AIInsight.objects.all()
    serializer_class = AIInsightSerializer
    permission_classes = [IsAuthenticated, HasFacilityAccess]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['date', 'facility']
    ordering_fields = ['date']
    ordering = ['-date']
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'facility_access'):
            # If facility filter is provided, use it; otherwise use user's facility
            facility_id = self.request.query_params.get('facility')
            if facility_id:
                return AIInsight.objects.filter(facility_id=facility_id)
            return AIInsight.objects.filter(facility=user.facility_access.facility)
        return AIInsight.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        # Get facility_id from the serializer data (sent by frontend)
        facility_id = serializer.validated_data.get('facility_id')
        if facility_id:
            from residents.models import Facility
            try:
                facility = Facility.objects.get(id=facility_id)
                serializer.save(facility=facility)
            except Facility.DoesNotExist:
                raise serializers.ValidationError("Invalid facility ID")
        else:
            # Fallback to user's facility if no facility_id provided
            if hasattr(user, 'facility_access'):
                serializer.save(facility=user.facility_access.facility)
            else:
                raise serializers.ValidationError("No facility specified and user has no default facility")
    
    @action(detail=False, methods=['get'])
    def staffing_analysis(self, request):
        """Get staffing analysis for a specific date"""
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'error': 'date parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Get facility from query params or user access
        facility_id = request.query_params.get('facility')
        if facility_id:
            try:
                from residents.models import Facility
                facility = Facility.objects.get(id=facility_id)
            except Facility.DoesNotExist:
                return Response({'error': 'Facility not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            facility = request.user.facility_access.facility
        
        # Get insights for the date
        try:
            insight = AIInsight.objects.get(facility=facility, date=target_date)
        except AIInsight.DoesNotExist:
            return Response({'error': 'No insights available for this date'}, status=status.HTTP_404_NOT_FOUND)
        
        # Calculate staffing needs based on insights
        total_residents = insight.total_residents
        total_care_hours = insight.total_care_hours
        avg_acuity = insight.avg_acuity_score
        
        # Simple staffing calculation
        base_staff_needed = max(2, int(total_care_hours / 8))  # At least 2 staff, then 1 per 8 hours
        acuity_multiplier = 1 + (avg_acuity - 3) * 0.2  # Adjust based on acuity
        recommended_staff = max(base_staff_needed, int(base_staff_needed * acuity_multiplier))
        
        analysis = {
            'date': target_date,
            'facility': facility.name,
            'total_residents': total_residents,
            'total_care_hours': total_care_hours,
            'avg_acuity_score': avg_acuity,
            'base_staff_needed': base_staff_needed,
            'acuity_multiplier': round(acuity_multiplier, 2),
            'recommended_staff': recommended_staff,
            'staffing_efficiency': insight.staffing_efficiency,
            'acuity_distribution': {
                'low': insight.low_acuity_count,
                'medium': insight.medium_acuity_count,
                'high': insight.high_acuity_count
            }
        }
        
        return Response(analysis)


class AIRecommendationViewSet(viewsets.ModelViewSet):
    queryset = AIRecommendation.objects.all()
    serializer_class = AIRecommendationSerializer
    permission_classes = [AllowGetPostWithoutAuthNoFacility]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['date', 'shift_type', 'facility', 'applied']
    ordering_fields = ['date', 'shift_type']
    ordering = ['-date', 'shift_type']
    
    def _get_adl_weight(self, question_text):
        """
        Get ADL weight for a question based on its text.
        Matches the frontend getADLWeight function logic.
        """
        if not question_text:
            return 0
        
        text = question_text.lower()
        
        # Bathing: weight 2
        if 'bathing' in text:
            return 2
        
        # Toileting: weight 2 (bowel and bladder management)
        if 'bowel' in text or 'bladder' in text or 'toileting' in text:
            return 2
        
        # Transfers: weight 2
        if 'transfer' in text:
            return 2
        
        # Wandering/Behaviors: weight 2
        if ('behavioral' in text or 'cognitive' in text or 'cueing' in text or
            'redirecting' in text or 'dementia' in text or 'wandering' in text or
            'non-drug interventions for behaviors' in text):
            return 2
        
        # Dressing: weight 1
        if 'dressing' in text:
            return 1
        
        # Grooming: weight 1
        if 'grooming' in text or ('hygiene' in text and 'bathing' not in text):
            return 1
        
        # Night Checks: weight 1 (safety checks, fall prevention, monitoring)
        if ('night' in text or 'safety checks' in text or 'fall prevention' in text or
            ('monitoring' in text and ('physical conditions' in text or 'symptoms' in text))):
            return 1
        
        # Default: no weight (0)
        return 0
    
    def _calculate_acuity_metrics(self, weekly_entries):
        """
        Calculate weighted ADL score and total weekly hours for a resident.
        Matches the frontend calculateAcuityMetrics function logic.
        """
        weighted_score = 0
        total_weekly_hours = 0
        
        for entry in weekly_entries:
            # Only count entries with actual data
            frequency = entry.frequency_per_week or 0
            minutes = entry.minutes_per_occurrence or 0
            has_data = frequency > 0 or minutes > 0
            
            if has_data:
                # Get question text
                question_text = entry.question_text or ''
                if not question_text and entry.adl_question:
                    question_text = entry.adl_question.text or ''
                
                # Get weight for this question
                weight = self._get_adl_weight(question_text)
                
                # Add weight to score if this ADL has data
                if weight > 0:
                    weighted_score += weight
                
                # Add to total weekly hours
                if entry.total_hours_week:
                    total_weekly_hours += entry.total_hours_week
                elif frequency > 0 and minutes > 0:
                    # Calculate: (frequency per week * minutes per occurrence) / 60 = hours per week
                    total_weekly_hours += (frequency * minutes) / 60.0
        
        return {'weighted_score': weighted_score, 'total_weekly_hours': total_weekly_hours}
    
    def _get_acuity_level(self, weighted_score, total_weekly_hours, adl_count):
        """
        Determine acuity level based on weighted ADL score and total weekly time.
        Matches the frontend getAcuityLevel function logic.
        """
        # ADLs not entered: 0 entries
        if adl_count == 0:
            return None  # Don't count residents with no ADL data
        
        # High Acuity: (Weighted ADL Score ≥ 8) OR (Total Weekly Time ≥ 6h)
        if weighted_score >= 8 or total_weekly_hours >= 6:
            return 'high'
        
        # Medium Acuity: (Weighted ADL Score 5-7) OR (Score 3-4 AND Total Weekly Time 4-6h)
        if ((weighted_score >= 5 and weighted_score < 8) or 
            (weighted_score >= 3 and weighted_score < 5 and total_weekly_hours >= 4 and total_weekly_hours < 6)):
            return 'medium'
        
        # Low-Acuity Assisted Living: (Weighted ADL Score 1-4) AND (Total Weekly Time < 4h)
        if weighted_score >= 1 and weighted_score < 5 and total_weekly_hours < 4:
            return 'low'
        
        # Independent: weighted score 0 or very minimal care
        return 'low'  # Treat independent as low-acuity for counting purposes
    
    def _calculate_acuity_distribution(self, residents, week_start_date):
        """
        Calculate acuity distribution for residents using the same logic as frontend ADL acuity.
        Returns counts for low, medium, and high acuity residents.
        """
        from adls.models import WeeklyADLEntry
        
        low_count = 0
        medium_count = 0
        high_count = 0
        
        # Get all weekly entries for these residents and this week
        weekly_entries = WeeklyADLEntry.objects.filter(
            resident__in=residents,
            week_start_date=week_start_date,
            is_deleted=False
        ).select_related('resident', 'adl_question')
        
        # Group entries by resident
        entries_by_resident = {}
        for entry in weekly_entries:
            resident_id = entry.resident_id
            if resident_id not in entries_by_resident:
                entries_by_resident[resident_id] = []
            entries_by_resident[resident_id].append(entry)
        
        # Calculate acuity for each resident
        for resident in residents:
            resident_entries = entries_by_resident.get(resident.id, [])
            
            # Count entries with actual data
            adl_count = sum(1 for entry in resident_entries 
                          if (entry.frequency_per_week or 0) > 0 or 
                             (entry.minutes_per_occurrence or 0) > 0)
            
            # Calculate metrics
            metrics = self._calculate_acuity_metrics(resident_entries)
            weighted_score = metrics['weighted_score']
            total_weekly_hours = metrics['total_weekly_hours']
            
            # Determine acuity level
            acuity_level = self._get_acuity_level(weighted_score, total_weekly_hours, adl_count)
            
            if acuity_level == 'high':
                high_count += 1
            elif acuity_level == 'medium':
                medium_count += 1
            elif acuity_level == 'low':
                low_count += 1
            # If acuity_level is None (no ADL data), don't count the resident
        
        return {
            'low_acuity_count': low_count,
            'medium_acuity_count': medium_count,
            'high_acuity_count': high_count
        }
    
    def calculate_role_requirements(self, total_hours, shift_type, resident_count, facility=None):
        """
        Calculate role-specific staffing requirements based on care hours and shift type.
        Always ensures at least one MedTech is present for medication administration.
        Uses only Caregiver and MedTech roles.
        Each person can work a maximum of 12 hours per shift for 2-shift facilities, 8 hours for 3-shift facilities.
        """
        # Convert to float if it's a Decimal
        if hasattr(total_hours, '__class__') and 'Decimal' in str(type(total_hours)):
            total_hours = float(total_hours)
        
        # Determine max hours per shift based on facility format
        max_hours_per_shift = 12.0 if (facility and facility.is_2_shift_format) else 8.0
        
        # Base requirements: Always need at least 1 MedTech for medication administration
        med_tech_required = 1
        med_tech_capacity = max_hours_per_shift  # MedTech can handle max hours of care + medications
        
        # Calculate total staff needed based on care hours
        # Each person (MedTech or Caregiver) can work max hours per shift (12h for 2-shift, 8h for 3-shift)
        total_staff_needed = max(1, int((total_hours / max_hours_per_shift) + 0.99)) if total_hours > 0 else 1
        
        # MedTech is already counted in total_staff_needed
        # Calculate how many additional caregivers are needed
        caregiver_count = max(0, total_staff_needed - 1)  # Subtract 1 for MedTech
        
        # Ensure minimum staffing for high care hours
        if total_hours > max_hours_per_shift and caregiver_count == 0:
            caregiver_count = 1
        
        return {
            'med_tech': med_tech_required,
            'caregiver': caregiver_count,
            'cna': 0,  # No CNAs in the staffing plan
            'total': med_tech_required + caregiver_count
        }
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'facility_access'):
            # If facility filter is provided, use it; otherwise use user's facility
            facility_id = self.request.query_params.get('facility')
            if facility_id:
                return AIRecommendation.objects.filter(facility_id=facility_id)
            return AIRecommendation.objects.filter(facility=user.facility_access.facility)
        return AIRecommendation.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        # Get facility_id from the serializer data (sent by frontend)
        facility_id = serializer.validated_data.get('facility_id')
        if facility_id:
            from residents.models import Facility
            try:
                facility = Facility.objects.get(id=facility_id)
                serializer.save(facility=facility)
            except Facility.DoesNotExist:
                raise serializers.ValidationError("Invalid facility ID")
        else:
            # Fallback to user's facility if no facility_id provided
            if hasattr(user, 'facility_access'):
                serializer.save(facility=user.facility_access.facility)
            else:
                raise serializers.ValidationError("No facility specified and user has no default facility")
    
    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """Mark a recommendation as applied"""
        recommendation = self.get_object()
        recommendation.applied = True
        recommendation.save()
        
        serializer = self.get_serializer(recommendation)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def apply_recommendations(self, request):
        """Apply multiple recommendations at once"""
        recommendation_ids = request.data.get('recommendations', [])
        if not recommendation_ids:
            return Response({'error': 'No recommendations provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        recommendations = self.get_queryset().filter(id__in=recommendation_ids)
        applied_count = 0
        
        for recommendation in recommendations:
            recommendation.applied = True
            recommendation.save()
            applied_count += 1
        
        return Response({
            'message': f'Applied {applied_count} recommendations.',
            'applied_count': applied_count
        })
    
    @action(detail=False, methods=['get'])
    def weekly(self, request):
        """Get recommendations for a specific week"""
        week_start = request.query_params.get('week_start')
        if week_start:
            try:
                week_start = datetime.strptime(week_start, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Invalid week_start format. Use YYYY-MM-DD'}, 
                              status=status.HTTP_400_BAD_REQUEST)
        else:
            # Default to current week
            today = timezone.now().date()
            week_start = today - timedelta(days=today.weekday())
        
        week_end = week_start + timedelta(days=6)
        
        recommendations = self.get_queryset().filter(
            date__gte=week_start,
            date__lte=week_end
        )
        
        serializer = self.get_serializer(recommendations, many=True)
        return Response(serializer.data)
    
    def _optimize_staff_assignments(self, recommendations, facility, week_start, week_end, ignore_existing_assignments=False):
        """
        Optimize staff assignments for cost efficiency while enforcing constraints:
        - Max 12 hours per day per staff for 2-shift facilities, 8 hours for 3-shift facilities
        - Max 40 hours per week per staff
        - Role requirements (MedTech, Caregiver)
        - Staff availability
        
        Args:
            ignore_existing_assignments: If True, don't consider existing assignments when calculating.
                                        This ensures recommendations are consistent and don't alternate.
        """
        from datetime import datetime, timedelta
        from decimal import Decimal
        
        # Get all active staff for the facility
        all_staff = Staff.objects.filter(
            facility=facility,
            status='active'
        ).select_related('facility')
        
        # Get staff availability for the week
        availability_map = {}
        for avail in StaffAvailability.objects.filter(
            staff__facility=facility,
            date__gte=week_start,
            date__lte=week_end,
            availability_status__in=['available', 'no_overtime', 'limited']
        ).select_related('staff'):
            key = (avail.staff_id, avail.date)
            availability_map[key] = avail
        
        # Track weekly hours per staff
        staff_weekly_hours = {staff.id: 0.0 for staff in all_staff}
        # Track daily hours per staff
        staff_daily_hours = {}
        
        # Get existing assignments for the week to track current hours
        # BUT: If ignore_existing_assignments is True, start with a clean slate
        if not ignore_existing_assignments:
            existing_assignments = StaffAssignment.objects.filter(
                shift__facility=facility,
                shift__date__gte=week_start,
                shift__date__lte=week_end,
                status='assigned'
            ).select_related('shift', 'staff', 'shift__shift_template')
            
            # Calculate default shift hours based on facility format
            default_shift_hours_for_existing = 12.0 if facility.is_2_shift_format else 8.0
            
            for assignment in existing_assignments:
                staff_id = assignment.staff_id
                shift = assignment.shift
                if shift.shift_template:
                    # Calculate hours from shift template
                    hours = default_shift_hours_for_existing
                    if shift.shift_template.duration:
                        hours = float(shift.shift_template.duration)
                    else:
                        start = shift.shift_template.start_time
                        end = shift.shift_template.end_time
                        hours = self._calculate_shift_hours(start, end)
                    
                    # For 2-shift facilities, Day and NOC are always 12 hours (override incorrect template)
                    if facility.is_2_shift_format:
                        shift_type = shift.shift_template.shift_type.lower()
                        if shift_type in ['day', 'noc']:
                            hours = 12.0
                    
                    staff_weekly_hours[staff_id] = staff_weekly_hours.get(staff_id, 0) + hours
                    day_key = (staff_id, shift.date)
                    staff_daily_hours[day_key] = staff_daily_hours.get(day_key, 0) + hours
        
        # Organize recommendations by date and shift type
        rec_by_date_shift = {}
        for rec in recommendations:
            date_str = rec['date']
            shift_type = rec['shift_type']
            if date_str not in rec_by_date_shift:
                rec_by_date_shift[date_str] = {}
            rec_by_date_shift[date_str][shift_type] = rec
        
        # Optimize each shift
        optimized = {}
        total_weekly_cost = Decimal('0.00')
        
        # Process shifts in order (helps with constraint enforcement)
        sorted_dates = sorted(rec_by_date_shift.keys())
        
        for date_str in sorted_dates:
            rec_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            optimized[date_str] = {}
            
            for shift_type in ['day', 'swing', 'noc']:
                if shift_type not in rec_by_date_shift[date_str]:
                    continue
                
                rec = rec_by_date_shift[date_str][shift_type]
                role_reqs = rec.get('role_requirements', {})
                medtech_needed = role_reqs.get('med_tech', 1)
                caregiver_needed = role_reqs.get('caregiver', 0)
                
                # Get actual shift hours from shift template
                # Default based on facility format: 12 hours for 2-shift, 8 hours for 3-shift
                default_shift_hours = 12.0 if facility.is_2_shift_format else 8.0
                default_max_day_hours = 12.0 if facility.is_2_shift_format else 8.0
                
                try:
                    shift_template = ShiftTemplate.objects.filter(
                        facility=facility,
                        shift_type=shift_type,
                        is_active=True
                    ).first()
                    if shift_template and shift_template.duration:
                        shift_hours = float(shift_template.duration)
                    else:
                        shift_hours = default_shift_hours
                except Exception:
                    shift_hours = default_shift_hours
                
                # For 2-shift facilities, Day and NOC are always 12 hours (override incorrect template duration)
                if facility.is_2_shift_format and shift_type.lower() in ['day', 'noc']:
                    shift_hours = 12.0
                
                # Get available staff for this shift
                available_staff = []
                for staff in all_staff:
                    # Check availability
                    avail_key = (staff.id, rec_date)
                    availability = availability_map.get(avail_key)
                    
                    if availability:
                        if availability.availability_status == 'unavailable':
                            continue
                        max_day_hours = availability.max_hours
                    else:
                        max_day_hours = default_max_day_hours
                    
                    # Check daily hours constraint
                    day_key = (staff.id, rec_date)
                    current_day_hours = staff_daily_hours.get(day_key, 0)
                    if current_day_hours + shift_hours > max_day_hours:
                        continue
                    
                    # Check weekly hours constraint
                    current_weekly_hours = staff_weekly_hours.get(staff.id, 0)
                    max_weekly_hours = staff.max_hours or 40
                    if current_weekly_hours + shift_hours > max_weekly_hours:
                        continue
                    
                    # Check if staff can work this shift type
                    if availability and availability.preferred_shift_types:
                        if shift_type not in availability.preferred_shift_types:
                            continue
                    
                    # Get base hourly rate (default to $25 if not set)
                    base_hourly_rate = float(staff.hourly_rate) if staff.hourly_rate else 25.0
                    
                    # Calculate effective hourly rate considering OT
                    # OT applies if: 40+ hours/week OR exceeds daily limit (12h for 2-shift, 8h for 3-shift)
                    would_exceed_weekly = (current_weekly_hours + shift_hours) > max_weekly_hours
                    would_exceed_daily = (current_day_hours + shift_hours) > default_max_day_hours
                    
                    if would_exceed_weekly or would_exceed_daily:
                        # OT rate is 1.5x base rate
                        effective_rate = base_hourly_rate * 1.5
                    else:
                        effective_rate = base_hourly_rate
                    
                    available_staff.append({
                        'id': staff.id,
                        'name': staff.full_name,
                        'role': staff.role,
                        'rate': base_hourly_rate,  # Keep base rate for display
                        'effective_rate': effective_rate,  # Use effective rate for cost comparison
                        'current_weekly_hours': current_weekly_hours,
                        'current_day_hours': current_day_hours,
                        'max_weekly_hours': max_weekly_hours,  # Store for later use
                        'would_be_ot': would_exceed_weekly or would_exceed_daily,
                    })
                
                # Separate by role
                medtechs = [s for s in available_staff if s['role'] == 'med_tech']
                caregivers = [s for s in available_staff if s['role'] in ['caregiver', 'cna']]
                
                # Sort by EFFECTIVE rate (considering OT), not base rate
                # This ensures we prefer a $25/hr employee over a $20/hr employee going into OT ($30/hr)
                medtechs.sort(key=lambda x: (x['effective_rate'], x['id']))
                caregivers.sort(key=lambda x: (x['effective_rate'], x['id']))
                
                # Select cheapest staff that meet requirements
                selected_staff = []
                total_cost = Decimal('0.00')
                
                # Select MedTechs
                for i in range(min(medtech_needed, len(medtechs))):
                    staff_member = medtechs[i]
                    # Calculate actual cost based on whether this assignment would trigger OT
                    current_weekly = staff_weekly_hours.get(staff_member['id'], 0)
                    current_daily = staff_daily_hours.get((staff_member['id'], rec_date), 0)
                    max_weekly = staff_member.get('max_weekly_hours', 40)
                    
                    # Determine if this shift would be OT
                    would_be_weekly_ot = (current_weekly + shift_hours) > max_weekly
                    would_be_daily_ot = (current_daily + shift_hours) > default_max_day_hours
                    is_ot = would_be_weekly_ot or would_be_daily_ot
                    
                    # Use OT rate (1.5x) if applicable, otherwise base rate
                    cost_rate = staff_member['effective_rate'] if is_ot else staff_member['rate']
                    
                    selected_staff.append({
                        'id': staff_member['id'],
                        'name': staff_member['name'],
                        'role': 'med_tech',
                        'rate': staff_member['rate'],  # Base rate for display
                        'hours': shift_hours
                    })
                    total_cost += Decimal(str(cost_rate)) * Decimal(str(shift_hours))
                    # Update tracking
                    staff_weekly_hours[staff_member['id']] += shift_hours
                    day_key = (staff_member['id'], rec_date)
                    staff_daily_hours[day_key] = staff_daily_hours.get(day_key, 0) + shift_hours
                
                # Select Caregivers
                for i in range(min(caregiver_needed, len(caregivers))):
                    staff_member = caregivers[i]
                    # Calculate actual cost based on whether this assignment would trigger OT
                    current_weekly = staff_weekly_hours.get(staff_member['id'], 0)
                    current_daily = staff_daily_hours.get((staff_member['id'], rec_date), 0)
                    max_weekly = staff_member.get('max_weekly_hours', 40)
                    
                    # Determine if this shift would be OT
                    would_be_weekly_ot = (current_weekly + shift_hours) > max_weekly
                    would_be_daily_ot = (current_daily + shift_hours) > default_max_day_hours
                    is_ot = would_be_weekly_ot or would_be_daily_ot
                    
                    # Use OT rate (1.5x) if applicable, otherwise base rate
                    cost_rate = staff_member['effective_rate'] if is_ot else staff_member['rate']
                    
                    selected_staff.append({
                        'id': staff_member['id'],
                        'name': staff_member['name'],
                        'role': 'caregiver',
                        'rate': staff_member['rate'],  # Base rate for display
                        'hours': shift_hours
                    })
                    total_cost += Decimal(str(cost_rate)) * Decimal(str(shift_hours))
                    # Update tracking
                    staff_weekly_hours[staff_member['id']] += shift_hours
                    day_key = (staff_member['id'], rec_date)
                    staff_daily_hours[day_key] = staff_daily_hours.get(day_key, 0) + shift_hours
                
                optimized[date_str][shift_type] = {
                    'staff': selected_staff,
                    'cost': float(total_cost),
                    'staff_count': len(selected_staff)
                }
                total_weekly_cost += total_cost
        
        optimized['_weekly_total'] = float(total_weekly_cost)
        return optimized
    
    def _calculate_shift_hours(self, start_time, end_time):
        """Calculate hours between start and end time"""
        from datetime import datetime, timedelta
        
        if isinstance(start_time, str):
            start = datetime.strptime(start_time, '%H:%M:%S').time()
        else:
            start = start_time
        
        if isinstance(end_time, str):
            end = datetime.strptime(end_time, '%H:%M:%S').time()
        else:
            end = end_time
        
        start_dt = datetime.combine(datetime.today(), start)
        end_dt = datetime.combine(datetime.today(), end)
        
        if end_dt < start_dt:
            # Overnight shift
            end_dt += timedelta(days=1)
        
        delta = end_dt - start_dt
        return delta.total_seconds() / 3600.0

    @action(detail=False, methods=['get'])
    def calculate_from_adl(self, request):
        """Calculate AI recommendations based on actual ADL data for a facility"""
        facility_id = request.query_params.get('facility')
        week_start = request.query_params.get('week_start')
        
        if not facility_id:
            return Response({'error': 'facility parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from residents.models import Facility, FacilitySection, Resident
            facility = Facility.objects.get(id=facility_id)
        except Facility.DoesNotExist:
            return Response({'error': 'Facility not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Parse week start date (frontend sends Monday, but WeeklyADLEntry stores Sunday)
        if week_start:
            try:
                week_start_monday = datetime.strptime(week_start, '%Y-%m-%d').date()
                # Normalize to Sunday (backend format for WeeklyADLEntry)
                days_since_monday = week_start_monday.weekday()  # 0=Monday, 6=Sunday
                if days_since_monday == 6:  # Already Sunday
                    week_start_date = week_start_monday
                else:  # Monday-Saturday - go back to Sunday
                    week_start_date = week_start_monday - timedelta(days=days_since_monday + 1)
                print(f"🔍 DEBUG calculate_from_adl: Frontend sent Monday={week_start_monday}, normalized to Sunday={week_start_date}")
            except ValueError:
                return Response({'error': 'Invalid week_start format. Use YYYY-MM-DD'}, 
                              status=status.HTTP_400_BAD_REQUEST)
        else:
            # Default to current week (normalize to Sunday)
            today = timezone.now().date()
            days_since_monday = today.weekday()
            if days_since_monday == 6:  # Already Sunday
                week_start_date = today
            else:
                week_start_date = today - timedelta(days=days_since_monday + 1)
        
        week_end_date = week_start_date + timedelta(days=6)
        
        # Get all residents in the facility
        sections = FacilitySection.objects.filter(facility=facility)
        residents = Resident.objects.filter(facility_section__in=sections, is_deleted=False)
        
        # Check if there's actual facility data before generating recommendations
        if residents.count() == 0:
            return Response({
                'recommendations': [],
                'weekly_summary': {
                    'total_recommendations': 0,
                    'total_care_hours': 0,
                    'total_staff_required': 0,
                    'avg_confidence': 0
                },
                'care_intensity': {
                    'low_acuity_count': 0,
                    'medium_acuity_count': 0,
                    'high_acuity_count': 0
                },
                'facility': {
                    'id': facility.id,
                    'name': facility.name
                },
                'week_start': week_start_date.isoformat(),
                'week_end': week_end_date.isoformat(),
                'message': 'No residents found in this facility. AI recommendations require resident data.'
            })
        
        # Check if residents have ADL data (either shift times or direct ADL assessments)
        residents_with_data = 0
        
        # First check for shift times data
        for resident in residents:
            if hasattr(resident, 'total_shift_times') and resident.total_shift_times:
                residents_with_data += 1
                # Debug: Show first resident's data structure
                if residents_with_data == 1:
                    print(f"🔍 DEBUG - First resident '{resident.name}' shift times: {resident.total_shift_times}")
        
        # If no shift times, check for WeeklyADLEntry data for the specific week
        if residents_with_data == 0:
            from adls.models import WeeklyADLEntry
            weekly_entries_count = WeeklyADLEntry.objects.filter(
                resident__in=residents,
                week_start_date=week_start_date,
                status='complete',
                is_deleted=False
            ).count()
            
            if weekly_entries_count > 0:
                residents_with_data = weekly_entries_count
                print(f"🔍 DEBUG - Found {weekly_entries_count} WeeklyADLEntry records for week {week_start_date}")
        
        if residents_with_data == 0:
            return Response({
                'recommendations': [],
                'weekly_summary': {
                    'total_recommendations': 0,
                    'total_care_hours': 0,
                    'total_staff_required': 0,
                    'avg_confidence': 0
                },
                'care_intensity': {
                    'low_acuity_count': 0,
                    'medium_acuity_count': 0,
                    'high_acuity_count': 0
                },
                'facility': {
                    'id': facility.id,
                    'name': facility.name
                },
                'week_start': week_start_date.isoformat(),
                'week_end': week_end_date.isoformat(),
                'message': 'No ADL data found for residents. AI recommendations require resident care assessment data.'
            })
        
        # Use the same caregiving summary calculation as ADL section - just reuse that logic
        from adls.models import WeeklyADLEntry
        from adls.views import ADLViewSet
        
        # Get all weekly entries for this facility and week (same as ADL section)
        weekly_entries = WeeklyADLEntry.objects.filter(
            resident__in=residents,
            week_start_date=week_start_date,
            status='complete',
            is_deleted=False
        )
        
        print(f"🔍 DEBUG calculate_from_adl: Querying WeeklyADLEntry with week_start_date={week_start_date}, residents={residents.count()}, found {weekly_entries.count()} entries")
        
        if weekly_entries.count() == 0:
            return Response({
                'recommendations': [],
                'weekly_summary': {
                    'total_recommendations': 0,
                    'total_care_hours': 0,
                    'total_staff_required': 0,
                    'avg_confidence': 0
                },
                'care_intensity': {
                    'low_acuity_count': 0,
                    'medium_acuity_count': 0,
                    'high_acuity_count': 0
                },
                'facility': {
                    'id': facility.id,
                    'name': facility.name
                },
                'week_start': week_start_date.isoformat(),
                'week_end': week_end_date.isoformat(),
                'message': f'No WeeklyADLEntry data found for week {week_start_date}. AI recommendations require actual ADL data.'
            })
        
        # Use the exact same caregiving summary calculation as ADL section
        adl_viewset = ADLViewSet()
        caregiving_data = adl_viewset._calculate_caregiving_summary_from_weekly_entries(weekly_entries, facility)
        per_shift = caregiving_data.data['per_shift']
        
        # per_shift is in Monday-Sunday order: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
        # weekdays for display
        weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        # Get shift types based on facility format
        if facility.is_2_shift_format:
            shift_types = ['day', 'noc']  # 2-shift format: Day and NOC (no Swing)
        else:
            shift_types = ['day', 'swing', 'noc']  # 3-shift format: Day, Swing, NOC
        
        # Clear old AI recommendations for this week (Monday-Sunday range)
        monday_date = week_start_date + timedelta(days=1)  # Monday
        sunday_date = week_start_date + timedelta(days=7)  # Next Sunday (end of week)
        # Use date__lte to include Sunday in the deletion
        AIRecommendation.objects.filter(
            facility=facility,
            date__gte=monday_date,
            date__lte=sunday_date
        ).delete()
        
        # Generate recommendations from per_shift data
        recommendations = []
        # Map shift types to display names based on facility format
        if facility.is_2_shift_format:
            shift_mapping = {
                'day': 'Day',
                'noc': 'NOC'
            }
        else:
            shift_mapping = {
                'day': 'Day',
                'swing': 'Swing', 
                'noc': 'NOC'
            }
        
        # Generate recommendations - match frontend week structure (Monday-Sunday)
        # per_shift[0] = Monday, per_shift[1] = Tuesday, ..., per_shift[6] = Sunday
        # Frontend sends Monday date and expects Monday-Sunday recommendations
        # week_start_date is Sunday (for database queries), but we need Monday-Sunday dates for recommendations
        monday_date = week_start_date + timedelta(days=1)  # Monday is 1 day after Sunday
        
        for i, day_name in enumerate(weekdays):
            # Calculate date: per_shift[i] is for day_name (Monday-Sunday)
            # Monday (i=0) -> monday_date (Monday)
            # Tuesday (i=1) -> monday_date + 1, etc.
            # Sunday (i=6) -> monday_date + 6 (Sunday)
            current_date = monday_date + timedelta(days=i)
            
            day_data = per_shift[i]  # per_shift is already in Monday-Sunday order
            
            for shift_type in shift_types:
                shift_key = shift_mapping[shift_type]
                # Get hours for this shift (default to 0 if shift doesn't exist in data)
                total_hours = day_data.get(shift_key, 0)
                
                # Calculate staff required based on facility format
                # 2-shift: 12 hours per staff member, 3-shift: 8 hours per staff member
                hours_per_staff = 12.0 if facility.is_2_shift_format else 8.0
                staff_required = max(1, int((total_hours / hours_per_staff) + 0.99)) if total_hours > 0 else 0
                
                # Only add recommendation if there are care hours
                if total_hours > 0:
                    # Calculate role-specific staffing requirements
                    role_requirements = self.calculate_role_requirements(total_hours, shift_type, residents.count(), facility)
                    
                    # Create or update AI recommendation in database (handle duplicates safely)
                    ai_recommendation, created = AIRecommendation.objects.update_or_create(
                        facility=facility,
                        date=current_date,
                        shift_type=shift_type,
                        defaults={
                            'care_hours': round(total_hours, 2),
                            'required_staff': staff_required,
                            'resident_count': residents.count(),
                            'confidence': 100,
                            'applied': False
                        }
                    )
                    
                    recommendations.append({
                        'id': ai_recommendation.id,
                        'date': current_date.isoformat(),
                        'shift_type': shift_type,
                        'care_hours': round(total_hours, 2),
                        'required_staff': staff_required,
                        'resident_count': residents.count(),
                        'confidence': 100,
                        'facility_id': facility_id,
                        'role_requirements': role_requirements
                    })
        
        # Optimize staff assignments for cost efficiency
        # IMPORTANT: Don't consider existing assignments when calculating recommendations
        # This ensures recommendations are consistent and don't alternate between applies
        optimized_assignments = self._optimize_staff_assignments(
            recommendations, facility, week_start_date, week_end_date, ignore_existing_assignments=True
        )
        
        total_weekly_cost = optimized_assignments.get('_weekly_total', 0)
        
        # Update recommendations with optimized staff assignments
        for rec in recommendations:
            date_str = rec['date']
            shift_type = rec['shift_type']
            if date_str in optimized_assignments and shift_type in optimized_assignments[date_str]:
                rec['suggested_staff'] = optimized_assignments[date_str][shift_type]['staff']
                rec['estimated_cost'] = optimized_assignments[date_str][shift_type]['cost']
        
        # Calculate weekly summary
        total_recommendations = len(recommendations)
        total_care_hours = sum(r['care_hours'] for r in recommendations)
        total_staff_required = sum(r['required_staff'] for r in recommendations)
        avg_confidence = 100 if total_recommendations > 0 else 0
        total_weekly_cost = optimized_assignments.get('_weekly_total', 0)
        
        # Calculate care intensity distribution using same logic as frontend ADL acuity
        care_intensity = self._calculate_acuity_distribution(residents, week_start_date)
        
        return Response({
            'recommendations': recommendations,
            'weekly_summary': {
                'total_recommendations': total_recommendations,
                'total_care_hours': round(total_care_hours, 1),
                'total_staff_required': total_staff_required,
                'avg_confidence': avg_confidence,
                'estimated_weekly_cost': round(total_weekly_cost, 2)
            },
            'care_intensity': care_intensity,
            'facility': {
                'id': facility.id,
                'name': facility.name
            },
            'week_start': week_start_date.isoformat(),
            'week_end': week_end_date.isoformat()
        })

    @action(detail=False, methods=['post'])
    def apply_weekly_recommendations(self, request):
        """Apply all AI recommendations for a week by creating shifts"""
        facility_id = request.data.get('facility')
        week_start = request.data.get('week_start')
        frontend_recommendations = request.data.get('recommendations', [])  # Get suggested_staff from frontend
        
        print(f"🔍 DEBUG apply_weekly_recommendations: facility_id={facility_id}, week_start={week_start}")
        print(f"🔍 DEBUG: Received {len(frontend_recommendations)} recommendations with suggested_staff from frontend")
        
        if not facility_id:
            return Response({'error': 'facility parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not week_start:
            return Response({'error': 'week_start parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from residents.models import Facility
            facility = Facility.objects.get(id=facility_id)
            week_start_date = datetime.strptime(week_start, '%Y-%m-%d').date()
            print(f"🔍 DEBUG: Parsed week_start_date={week_start_date}, facility={facility.name}")
        except Facility.DoesNotExist:
            return Response({'error': 'Facility not found'}, status=status.HTTP_404_NOT_FOUND)
        except ValueError:
            return Response({'error': 'Invalid week_start date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        
        week_end_date = week_start_date + timedelta(days=6)
        print(f"🔍 DEBUG: Week range: {week_start_date} to {week_end_date}")
        
        # Only process recommendations that were sent from frontend
        # This allows partial application (single shift) without affecting others
        if not frontend_recommendations or len(frontend_recommendations) == 0:
            return Response({'error': 'No recommendations provided to apply'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Helper class for temporary recommendations when not in database
        class TempRecommendation:
            def __init__(self, date, shift_type, care_hours, required_staff, facility):
                from decimal import Decimal
                self.date = date
                self.shift_type = shift_type
                # Convert care_hours to Decimal if it's not already
                if isinstance(care_hours, (int, float)):
                    self.care_hours = Decimal(str(care_hours))
                elif isinstance(care_hours, Decimal):
                    self.care_hours = care_hours
                else:
                    self.care_hours = Decimal('0')
                self.required_staff = int(required_staff) if required_staff else 1
                self.facility = facility
        
        # Get AI recommendations from database that match the frontend recommendations
        # Only process the specific recommendations being applied
        recommendations_to_process = []
        frontend_recs_map = {}  # Store frontend data for reference
        
        for frontend_rec in frontend_recommendations:
            date_str = frontend_rec.get('date')
            shift_type = frontend_rec.get('shift_type')
            if date_str and shift_type:
                try:
                    # Handle both string and date formats
                    if isinstance(date_str, str):
                        rec_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    else:
                        rec_date = date_str
                    
                    recommendation = AIRecommendation.objects.filter(
            facility=facility,
                        date=rec_date,
                        shift_type=shift_type
                    ).first()
                    
                    if recommendation:
                        recommendations_to_process.append(recommendation)
                        # Store frontend data for this recommendation
                        frontend_recs_map[(date_str, shift_type)] = frontend_rec
                        print(f"🔍 DEBUG: Found recommendation for {date_str} {shift_type} - care_hours: {recommendation.care_hours}, required_staff: {recommendation.required_staff}")
                    else:
                        print(f"🔍 DEBUG: No recommendation found in database for {date_str} {shift_type}")
                        # Try to get care_hours and required_staff from frontend data
                        care_hours = frontend_rec.get('care_hours')
                        required_staff = frontend_rec.get('required_staff')
                        
                        # If frontend didn't provide care_hours, we can't create a valid recommendation
                        # This should not happen if calculate_from_adl was called first
                        if care_hours is None or care_hours == 0:
                            print(f"⚠️ WARNING: No care_hours provided for {date_str} {shift_type}, skipping this recommendation")
                            continue
                        
                        # If recommendation doesn't exist in DB, create a minimal object from frontend data
                        temp_rec = TempRecommendation(
                            date=rec_date,
                            shift_type=shift_type,
                            care_hours=care_hours,
                            required_staff=required_staff or 1,
                            facility=facility
                        )
                        recommendations_to_process.append(temp_rec)
                        frontend_recs_map[(date_str, shift_type)] = frontend_rec
                        print(f"🔍 DEBUG: Using frontend data for {date_str} {shift_type} - care_hours: {temp_rec.care_hours}, required_staff: {temp_rec.required_staff}")
                except (ValueError, TypeError) as e:
                    print(f"🔍 DEBUG: Error parsing date {date_str}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
        
        if not recommendations_to_process:
            return Response({'error': 'No matching AI recommendations found for the provided dates and shift types'}, status=status.HTTP_404_NOT_FOUND)
        
        recommendations = recommendations_to_process
        print(f"🔍 DEBUG: Processing {len(recommendations)} recommendations from frontend")
        
        # Get or create shift templates for each shift type
        shift_templates = {}
        for shift_type in ['day', 'swing', 'noc']:
            template, created = ShiftTemplate.objects.get_or_create(
                facility=facility,
                shift_type=shift_type,
                defaults={
                    'template_name': f'{shift_type.title()} Shift',
                    'start_time': '08:00' if shift_type == 'day' else '16:00' if shift_type == 'swing' else '00:00',
                    'end_time': '16:00' if shift_type == 'day' else '00:00' if shift_type == 'swing' else '08:00',
                    'duration': 8.0,
                    'required_staff': 1,
                    'is_active': True
                }
            )
            shift_templates[shift_type] = template
        
        # Create a map of suggested_staff from frontend by date and shift_type
        suggested_staff_map = {}
        for frontend_rec in frontend_recommendations:
            date_str = frontend_rec.get('date')
            shift_type = frontend_rec.get('shift_type')
            suggested_staff = frontend_rec.get('suggested_staff', [])
            if date_str and shift_type:
                key = (date_str, shift_type)
                suggested_staff_map[key] = suggested_staff
                print(f"🔍 DEBUG: Mapped suggested_staff for {date_str} {shift_type}: {len(suggested_staff)} staff")
        
        # Convert AIRecommendation objects to dict format (for role requirements calculation)
        from adls.models import WeeklyADLEntry
        residents = WeeklyADLEntry.objects.filter(
            resident__facility_section__facility=facility,
            week_start_date__lte=week_end_date,
            week_start_date__gte=week_start_date
        ).values_list('resident', flat=True).distinct()
        resident_count = len(residents)
        
        shifts_created = 0
        shifts_updated = 0
        assignments_created = 0
        assignments_skipped = 0  # Track assignments skipped due to hour limits
        skipped_details = []  # Track details of skipped assignments
        
        # Track created shifts by date and shift type for assignment
        created_shifts_map = {}
        
        # Calculate default shift hours based on facility format (define early to avoid UnboundLocalError)
        default_shift_hours = 12.0 if facility.is_2_shift_format else 8.0
        
        # Track weekly hours for all staff in this week (calculate once for entire batch)
        staff_weekly_hours_cache = {}
        # Get all existing assignments for the week
        existing_assignments = StaffAssignment.objects.filter(
            shift__facility=facility,
            shift__date__gte=week_start_date,
            shift__date__lte=week_end_date,
            status='assigned'
        ).select_related('shift', 'shift__shift_template')
        
        for assignment in existing_assignments:
            staff_id = assignment.staff_id
            if staff_id not in staff_weekly_hours_cache:
                staff_weekly_hours_cache[staff_id] = 0.0
            
            # Calculate hours for this assignment
            assigned_shift = assignment.shift
            if assigned_shift and assigned_shift.shift_template:
                assigned_shift_hours = default_shift_hours
                if assigned_shift.shift_template.duration:
                    assigned_shift_hours = float(assigned_shift.shift_template.duration)
                elif assigned_shift.shift_template.start_time and assigned_shift.shift_template.end_time:
                    start = datetime.combine(datetime.today(), assigned_shift.shift_template.start_time)
                    end = datetime.combine(datetime.today(), assigned_shift.shift_template.end_time)
                    if end < start:
                        end += timedelta(days=1)
                    assigned_shift_hours = (end - start).total_seconds() / 3600.0
                
                # For 2-shift facilities, override Day/NOC to 12 hours
                if facility.is_2_shift_format:
                    assigned_shift_type = assigned_shift.shift_template.shift_type.lower()
                    if assigned_shift_type in ['day', 'noc']:
                        assigned_shift_hours = 12.0
                
                staff_weekly_hours_cache[staff_id] += assigned_shift_hours
        
        try:
            for recommendation in recommendations:
                # Handle date - could be date object or string
                if isinstance(recommendation.date, str):
                    rec_date = datetime.strptime(recommendation.date, '%Y-%m-%d').date()
                else:
                    rec_date = recommendation.date
                date_str = rec_date.isoformat()
                shift_type = recommendation.shift_type
                
                print(f"🔍 DEBUG: Processing recommendation for {date_str} {shift_type}")
                print(f"🔍 DEBUG: Recommendation date type: {type(recommendation.date)}, value: {recommendation.date}")
                print(f"🔍 DEBUG: Parsed rec_date: {rec_date}, isoformat: {date_str}")
                
                # Skip if shift type doesn't exist in templates (e.g., 'swing' for 2-shift facility)
                if shift_type not in shift_templates:
                    print(f"🔍 DEBUG: Skipping recommendation for {date_str} {shift_type} - shift type not available for this facility")
                    continue
                
                # Validate that care_hours exists and is valid
                try:
                    care_hours = recommendation.care_hours
                    if care_hours is None:
                        print(f"⚠️ WARNING: care_hours is None for {date_str} {shift_type}, skipping")
                        continue
                    # Convert to float if it's a Decimal
                    if hasattr(care_hours, '__class__') and 'Decimal' in str(type(care_hours)):
                        care_hours = float(care_hours)
                    elif not isinstance(care_hours, (int, float)):
                        print(f"⚠️ WARNING: Invalid care_hours type for {date_str} {shift_type}: {type(care_hours)}, skipping")
                        continue
                except AttributeError as e:
                    print(f"⚠️ WARNING: Recommendation missing care_hours attribute for {date_str} {shift_type}: {e}, skipping")
                    continue
                
                # Get the role requirements for this recommendation
                role_requirements = self.calculate_role_requirements(
                    care_hours, 
                    shift_type, 
                    resident_count,
                    facility=facility
                )
                
                print(f"🔍 DEBUG: Role requirements: {role_requirements}")
                
                # Delete existing shifts for this date and shift type
                existing_shifts = Shift.objects.filter(
                    facility=facility,
                    date=rec_date,
                    shift_template__shift_type=shift_type
                )
                # Also delete existing assignments for these shifts
                deleted_count = existing_shifts.count()
                StaffAssignment.objects.filter(shift__in=existing_shifts).delete()
                existing_shifts.delete()
                print(f"🔍 DEBUG: Deleted {deleted_count} existing shifts")
                
                # Get shift template
                shift_template = shift_templates[shift_type]
                
                # Initialize map entry if needed
                if date_str not in created_shifts_map:
                    created_shifts_map[date_str] = {}
                if shift_type not in created_shifts_map[date_str]:
                    created_shifts_map[date_str][shift_type] = {}
                
                # Create MedTech shift if needed
                if role_requirements['med_tech'] > 0:
                    med_tech_shift = Shift.objects.create(
                        date=rec_date,
                        shift_template=shift_template,
                        facility=facility,
                        required_staff_count=role_requirements['med_tech'],
                        required_staff_role='med_tech'
                    )
                    shifts_created += 1
                    created_shifts_map[date_str][shift_type]['med_tech'] = med_tech_shift
                    print(f"🔍 DEBUG: Created MedTech shift: {med_tech_shift} (ID: {med_tech_shift.id})")
                
                # Create Caregiver shift if needed
                if role_requirements['caregiver'] > 0:
                    caregiver_shift = Shift.objects.create(
                        date=rec_date,
                        shift_template=shift_template,
                        facility=facility,
                        required_staff_count=role_requirements['caregiver'],
                        required_staff_role='caregiver'
                    )
                    shifts_created += 1
                    created_shifts_map[date_str][shift_type]['caregiver'] = caregiver_shift
                    print(f"🔍 DEBUG: Created Caregiver shift: {caregiver_shift} (ID: {caregiver_shift.id})")
                
                # Assign suggested staff to shifts - USE FRONTEND SUGGESTED_STAFF IF AVAILABLE
                suggested_staff = []
                map_key = (date_str, shift_type)
                if map_key in suggested_staff_map and len(suggested_staff_map[map_key]) > 0:
                    # Use suggested_staff from frontend (what user sees) - THIS IS THE SOURCE OF TRUTH
                    suggested_staff = suggested_staff_map[map_key]
                    print(f"🔍 DEBUG: Using suggested_staff from frontend: {len(suggested_staff)} staff members for {date_str} {shift_type}")
                    for staff in suggested_staff:
                        print(f"  - Staff ID: {staff.get('id')}, Name: {staff.get('name')}, Role: {staff.get('role')}")
                else:
                    # If frontend didn't provide suggested_staff, we need to calculate it
                    # But first, delete ALL existing assignments for this week to get a clean slate
                    print(f"🔍 DEBUG: No frontend suggested_staff for {date_str} {shift_type}, will need to calculate")
                    # Note: We should not recalculate here as it causes alternating behavior
                    # Instead, we should require frontend to always provide suggested_staff
                
                if suggested_staff:
                    print(f"🔍 DEBUG: Assigning {len(suggested_staff)} staff members to shifts")
                    
                    # Calculate shift hours based on facility format
                    shift_hours = default_shift_hours
                    if shift_template.duration:
                        shift_hours = float(shift_template.duration)
                    else:
                        # Calculate from start/end times if duration not set
                        if shift_template.start_time and shift_template.end_time:
                            start = datetime.combine(datetime.today(), shift_template.start_time)
                            end = datetime.combine(datetime.today(), shift_template.end_time)
                            if end < start:
                                end += timedelta(days=1)
                            shift_hours = (end - start).total_seconds() / 3600.0
                    
                    # For 2-shift facilities, Day and NOC are always 12 hours (override incorrect template)
                    if facility.is_2_shift_format and shift_type.lower() in ['day', 'noc']:
                        shift_hours = 12.0
                    
                    for staff_info in suggested_staff:
                        # Handle both formats: dict with 'id' key or dict with get()
                        staff_id = staff_info.get('id') if isinstance(staff_info, dict) else None
                        staff_role = staff_info.get('role') if isinstance(staff_info, dict) else None
                        
                        if not staff_id:
                            print(f"🔍 DEBUG: Invalid staff_info format, skipping: {staff_info}")
                            continue
                        
                        # Get the appropriate shift for this role
                        shift = None
                        # Safely check if date_str and shift_type exist in created_shifts_map
                        if date_str in created_shifts_map and shift_type in created_shifts_map[date_str]:
                            if staff_role == 'med_tech' and 'med_tech' in created_shifts_map[date_str][shift_type]:
                                shift = created_shifts_map[date_str][shift_type]['med_tech']
                            elif staff_role == 'caregiver' and 'caregiver' in created_shifts_map[date_str][shift_type]:
                                shift = created_shifts_map[date_str][shift_type]['caregiver']
                        
                        if shift:
                            try:
                                staff = Staff.objects.get(id=staff_id)
                                
                                # Validate hours before assigning
                                current_weekly_hours = staff_weekly_hours_cache.get(staff_id, 0.0)
                                max_weekly_hours = staff.max_hours or 40
                                
                                # Check if adding this shift would exceed weekly hours
                                if current_weekly_hours + shift_hours > max_weekly_hours:
                                    assignments_skipped += 1
                                    skipped_details.append({
                                        'staff_name': staff.full_name,
                                        'current_hours': current_weekly_hours,
                                        'shift_hours': shift_hours,
                                        'would_be_total': current_weekly_hours + shift_hours,
                                        'max_hours': max_weekly_hours,
                                        'date': date_str,
                                        'shift_type': shift_type
                                    })
                                    print(f"🔍 DEBUG: Skipping assignment for {staff.full_name}: would exceed weekly hours ({current_weekly_hours:.1f} + {shift_hours:.1f} = {current_weekly_hours + shift_hours:.1f} > {max_weekly_hours})")
                                    continue
                                
                                assignment, created = StaffAssignment.objects.get_or_create(
                                    staff=staff,
                                    shift=shift,
                                    defaults={'status': 'assigned'}
                                )
                                if created:
                                    assignments_created += 1
                                    # Update cache for this staff member
                                    staff_weekly_hours_cache[staff_id] = current_weekly_hours + shift_hours
                                    print(f"🔍 DEBUG: Assigned {staff.full_name} to {shift} (weekly hours: {staff_weekly_hours_cache[staff_id]:.1f}/{max_weekly_hours})")
                                else:
                                    print(f"🔍 DEBUG: Assignment already exists for {staff.full_name} to {shift}")
                            except Staff.DoesNotExist:
                                print(f"🔍 DEBUG: Staff with ID {staff_id} not found, skipping assignment")
                            except Exception as e:
                                print(f"🔍 DEBUG: Error assigning staff {staff_id}: {str(e)}")
                
                # Mark recommendation as applied (only if it's a real model instance)
                if hasattr(recommendation, 'save'):
                    recommendation.applied = True
                    recommendation.save()
        
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            error_type = type(e).__name__
            print(f"🔍 ERROR applying recommendations: {error_type}: {e}")
            print(f"🔍 ERROR traceback: {error_trace}")
            print(f"🔍 ERROR context: facility_id={facility_id}, week_start={week_start}, recommendations_count={len(recommendations)}")
            
            # Log more details about the recommendations being processed
            for i, rec in enumerate(recommendations):
                try:
                    rec_date = rec.date if hasattr(rec, 'date') else 'unknown'
                    rec_shift = rec.shift_type if hasattr(rec, 'shift_type') else 'unknown'
                    rec_care_hours = rec.care_hours if hasattr(rec, 'care_hours') else 'unknown'
                    print(f"🔍 Recommendation {i}: date={rec_date}, shift_type={rec_shift}, care_hours={rec_care_hours}")
                except Exception as rec_err:
                    print(f"🔍 Error inspecting recommendation {i}: {rec_err}")
            
            # Return a more user-friendly error message
            error_message = f'Error applying recommendations: {str(e)}'
            if 'KeyError' in error_type:
                error_message = f'Configuration error: Missing shift template or invalid recommendation data. Please refresh recommendations.'
            elif 'AttributeError' in error_type:
                error_message = f'Data error: Invalid recommendation format. Please refresh recommendations.'
            elif 'DoesNotExist' in error_type:
                error_message = f'Database error: Required data not found. Please refresh recommendations.'
            elif 'ValueError' in error_type:
                error_message = f'Data format error: Invalid data format. Please refresh recommendations.'
            
            return Response({
                'error': error_message,
                'error_type': error_type,
                'detail': error_trace if settings.DEBUG else None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Build response message
        message = f'Successfully applied AI recommendations for {facility.name}'
        if assignments_skipped > 0:
            message += f'. Note: {assignments_skipped} assignment(s) were skipped because they would exceed the 40-hour weekly limit. Please regenerate recommendations to get valid assignments.'
            print(f"⚠️ WARNING: {assignments_skipped} assignments were skipped due to hour limits")
            for detail in skipped_details[:5]:  # Show first 5 skipped assignments
                print(f"  - {detail['staff_name']}: {detail['current_hours']:.1f}h + {detail['shift_hours']:.1f}h = {detail['would_be_total']:.1f}h > {detail['max_hours']}h ({detail['date']} {detail['shift_type']})")
        
        return Response({
            'message': message,
            'shifts_created': shifts_created,
            'shifts_updated': shifts_updated,
            'assignments_created': assignments_created,
            'assignments_skipped': assignments_skipped,
            'skipped_details': skipped_details[:10],  # Include first 10 skipped details
            'total_recommendations': len(recommendations),
            'week_start': week_start_date.isoformat(),
            'week_end': week_end_date.isoformat()
        })
    
    def _get_available_staff_for_week_with_overtime(self, facility, week_start_date, week_end_date):
        """Get available staff for the week, considering actual hours worked and overtime"""
        from scheduling.models import TimeTracking, WeeklyHoursSummary
        
        # Get all staff for the facility
        all_staff = Staff.objects.filter(facility=facility, status='active')
        
        available_staff = []
        
        for staff in all_staff:
            # Get actual hours worked this week
            weekly_summary = WeeklyHoursSummary.objects.filter(
                staff=staff,
                week_start_date=week_start_date
            ).first()
            
            if weekly_summary:
                # Check if staff can work more hours
                can_work_more = weekly_summary.can_work_more and not weekly_summary.should_avoid_overtime
                hours_remaining = max(0, 40 - weekly_summary.total_hours_worked)
                
                available_staff.append({
                    'staff': staff,
                    'weekly_summary': weekly_summary,
                    'can_work_more': can_work_more,
                    'hours_remaining': hours_remaining,
                    'is_overtime': weekly_summary.is_overtime,
                    'overtime_hours': weekly_summary.overtime_hours,
                    'total_hours': weekly_summary.total_hours_worked
                })
            else:
                # No time tracking data, assume available
                available_staff.append({
                    'staff': staff,
                    'weekly_summary': None,
                    'can_work_more': True,
                    'hours_remaining': 40,  # Full week available
                    'is_overtime': False,
                    'overtime_hours': 0,
                    'total_hours': 0
                })
        
        return available_staff
    
    def _get_staff_for_shift_with_overtime_check(self, available_staff, day_date, shift_name, care_hours, role_requirements):
        """Get staff for a shift, avoiding overtime and considering actual hours worked"""
        shift_staff = []
        
        # Priority order: MedTech first, then Caregivers
        roles_needed = []
        
        # Always need at least 1 MedTech
        if role_requirements.get('med_tech', 0) > 0:
            roles_needed.extend(['med_tech'] * role_requirements['med_tech'])
        
        # Add caregivers
        if role_requirements.get('caregiver', 0) > 0:
            roles_needed.extend(['caregiver'] * role_requirements['caregiver'])
        
        # Filter staff by role and availability
        # IMPORTANT: med_tech staff can work caregiver shifts (dual-role capability)
        for role in roles_needed:
            # Find staff with matching role who can work more hours
            # For caregiver shifts, also include med_tech staff (MedTech/Caregiver dual-role)
            if role == 'caregiver':
                suitable_staff = [
                    s for s in available_staff 
                    if (s['staff'].role == role or s['staff'].role == 'med_tech') and s['can_work_more']
                ]
            else:
                suitable_staff = [
                    s for s in available_staff 
                    if s['staff'].role == role and s['can_work_more']
                ]
            
            if suitable_staff:
                # Sort by hours remaining (descending) to prioritize staff with more available hours
                suitable_staff.sort(key=lambda x: x['hours_remaining'], reverse=True)
                
                selected_staff = suitable_staff[0]
                shift_staff.append({
                    'id': selected_staff['staff'].id,
                    'name': selected_staff['staff'].full_name,
                    'role': selected_staff['staff'].role,
                    'hours_remaining': selected_staff['hours_remaining'],
                    'is_overtime': selected_staff['is_overtime'],
                    'total_hours_this_week': selected_staff['total_hours']
                })
                
                # Update hours remaining for this staff member
                shift_hours = min(8, care_hours, selected_staff['hours_remaining'])
                selected_staff['hours_remaining'] -= shift_hours
                
                # Check if this staff member is now at overtime threshold
                if selected_staff['hours_remaining'] <= 0:
                    selected_staff['can_work_more'] = False
            else:
                # No suitable staff found - this is a scheduling conflict
                shift_staff.append({
                    'id': None,
                    'name': f'No {role} available (overtime prevention)',
                    'role': role,
                    'hours_remaining': 0,
                    'is_overtime': True,
                    'total_hours_this_week': 40,
                    'warning': 'Staff shortage - consider external coverage'
                })
        
        return shift_staff
    
    def _get_overtime_warnings_detailed(self, available_staff, week_start_date):
        """Get detailed overtime warnings for staff"""
        warnings = []
        
        for staff_info in available_staff:
            if staff_info['is_overtime']:
                warnings.append({
                    'staff_name': staff_info['staff'].full_name,
                    'role': staff_info['staff'].role,
                    'total_hours': staff_info['total_hours'],
                    'overtime_hours': staff_info['overtime_hours'],
                    'message': f"{staff_info['staff'].full_name} has worked {staff_info['total_hours']} hours this week ({staff_info['overtime_hours']} overtime hours)"
                })
            elif staff_info['hours_remaining'] < 8:
                warnings.append({
                    'staff_name': staff_info['staff'].full_name,
                    'role': staff_info['staff'].role,
                    'total_hours': staff_info['total_hours'],
                    'overtime_hours': 0,
                    'message': f"{staff_info['staff'].full_name} has only {staff_info['hours_remaining']} hours remaining this week"
                })
        
        return warnings
    
    def _calculate_cost_analysis(self, available_staff, total_care_hours):
        """Calculate cost analysis based on actual hours worked and overtime"""
        from scheduling.models import WeeklyHoursSummary
        
        total_regular_hours = 0
        total_overtime_hours = 0
        estimated_regular_cost = 0
        estimated_overtime_cost = 0
        
        # Default hourly rates (should be configurable)
        regular_rate = 25.00  # $25/hour
        overtime_rate = 37.50  # $37.50/hour (1.5x regular)
        
        for staff_info in available_staff:
            weekly_summary = staff_info.get('weekly_summary')
            if weekly_summary:
                total_regular_hours += weekly_summary.regular_hours
                total_overtime_hours += weekly_summary.overtime_hours
                
                # Use actual rates if available, otherwise use defaults
                reg_rate = weekly_summary.regular_rate or regular_rate
                ot_rate = weekly_summary.overtime_rate or overtime_rate
                
                estimated_regular_cost += weekly_summary.regular_hours * reg_rate
                estimated_overtime_cost += weekly_summary.overtime_hours * ot_rate
        
        return {
            'total_regular_hours': round(total_regular_hours, 2),
            'total_overtime_hours': round(total_overtime_hours, 2),
            'estimated_regular_cost': round(estimated_regular_cost, 2),
            'estimated_overtime_cost': round(estimated_overtime_cost, 2),
            'total_estimated_cost': round(estimated_regular_cost + estimated_overtime_cost, 2),
            'overtime_percentage': round((total_overtime_hours / (total_regular_hours + total_overtime_hours)) * 100, 1) if (total_regular_hours + total_overtime_hours) > 0 else 0
        }


class SchedulingDashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, HasFacilityAccess]
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get dashboard statistics for the current facility"""
        user = request.user
        if not hasattr(user, 'facility_access'):
            return Response({'error': 'No facility access'}, status=status.HTTP_403_FORBIDDEN)
        
        # If facility filter is provided, use it; otherwise use user's facility
        facility_id = request.query_params.get('facility')
        if facility_id:
            try:
                from residents.models import Facility
                facility = Facility.objects.get(id=facility_id)
            except Facility.DoesNotExist:
                return Response({'error': 'Facility not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            facility = user.facility_access.facility
        
        # Calculate statistics
        total_staff = Staff.objects.filter(facility=facility).count()
        total_shifts = Shift.objects.filter(facility=facility).count()
        total_assignments = StaffAssignment.objects.filter(shift__facility=facility).count()
        
        # Calculate understaffed shifts
        understaffed_shifts = 0
        shifts = Shift.objects.filter(facility=facility)
        for shift in shifts:
            required = shift.required_staff_count
            assigned = StaffAssignment.objects.filter(
                shift=shift, 
                status__in=['assigned', 'confirmed']
            ).count()
            if assigned < required:
                understaffed_shifts += 1
        
        # Calculate staffing efficiency (simplified)
        staffing_efficiency = 85.5  # This would be calculated based on actual business logic
        
        stats = {
            'total_staff': total_staff,
            'total_shifts': total_shifts,
            'total_assignments': total_assignments,
            'understaffed_shifts': understaffed_shifts,
            'staffing_efficiency': staffing_efficiency,
        }
        
        serializer = DashboardStatsSerializer(stats)
        return Response(serializer.data)


class TimeTrackingViewSet(viewsets.ModelViewSet):
    """ViewSet for TimeTracking model"""
    queryset = TimeTracking.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['staff', 'facility', 'date', 'status']
    search_fields = ['staff__first_name', 'staff__last_name', 'staff__employee_id']
    ordering_fields = ['date', 'clock_in', 'clock_out', 'total_hours_worked']
    ordering = ['-date', 'staff__last_name', 'staff__first_name']
    
    def get_serializer_class(self):
        # Return a simple serializer for the time tracking data
        from rest_framework import serializers
        
        class TimeTrackingSerializer(serializers.ModelSerializer):
            staff_name = serializers.CharField(source='staff.full_name', read_only=True)
            staff_id = serializers.CharField(source='staff.employee_id', read_only=True)
            facility_name = serializers.CharField(source='staff.facility.name', read_only=True)
            facility_id = serializers.CharField(source='staff.facility.id', read_only=True)
            hourly_rate = serializers.DecimalField(source='staff.hourly_rate', max_digits=10, decimal_places=2, read_only=True, allow_null=True)
            
            class Meta:
                model = TimeTracking
                fields = [
                    'id', 'staff', 'staff_name', 'staff_id', 'facility_id', 'facility_name',
                    'date', 'clock_in', 'clock_out', 'break_start', 'break_end',
                    'total_hours_worked', 'regular_hours', 'overtime_hours',
                    'hourly_rate', 'status', 'notes', 'created_at', 'updated_at'
                ]
        
        return TimeTrackingSerializer
    
    def get_queryset(self):
        queryset = TimeTracking.objects.select_related('staff', 'staff__facility').all()
        
        # Filter by facility if provided (through staff relationship)
        facility_id = self.request.query_params.get('facility')
        if facility_id:
            queryset = queryset.filter(staff__facility_id=facility_id)
        
        # Filter by date if provided
        date = self.request.query_params.get('date')
        if date:
            queryset = queryset.filter(date=date)
        
        # Filter by date range if provided
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        
        return queryset


class WeeklyHoursSummaryViewSet(viewsets.ModelViewSet):
    """ViewSet for WeeklyHoursSummary model"""
    queryset = WeeklyHoursSummary.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['staff', 'facility', 'week_start_date']
    search_fields = ['staff__first_name', 'staff__last_name', 'staff__employee_id']
    ordering_fields = ['week_start_date', 'total_hours_worked', 'overtime_hours']
    ordering = ['-week_start_date', 'staff__last_name', 'staff__first_name']
    
    def get_serializer_class(self):
        from rest_framework import serializers
        
        class WeeklyHoursSummarySerializer(serializers.ModelSerializer):
            staff_name = serializers.CharField(source='staff.full_name', read_only=True)
            staff_id = serializers.CharField(source='staff.employee_id', read_only=True)
            facility_name = serializers.CharField(source='facility.name', read_only=True)
            
            class Meta:
                model = WeeklyHoursSummary
                fields = [
                    'id', 'staff', 'staff_name', 'staff_id', 'facility', 'facility_name',
                    'week_start_date', 'week_end_date', 'total_hours_worked',
                    'regular_hours', 'overtime_hours', 'regular_rate', 'overtime_rate',
                    'estimated_regular_cost', 'estimated_overtime_cost', 'total_estimated_cost',
                    'can_work_more', 'should_avoid_overtime', 'is_overtime',
                    'created_at', 'updated_at'
                ]
        
        return WeeklyHoursSummarySerializer
