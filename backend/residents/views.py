from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from .models import Resident, Facility, FacilitySection
from .serializers import ResidentSerializer, FacilitySerializer, FacilitySectionDetailSerializer
import csv
import io
import pandas as pd
import logging
from django.db.models import Sum
from adls.models import ADL
from datetime import datetime, timedelta
from users.models import FacilityAccess
from rest_framework.permissions import AllowAny

logger = logging.getLogger(__name__)



class ResidentViewSet(viewsets.ModelViewSet):
    queryset = Resident.objects.all()
    serializer_class = ResidentSerializer

    def get_queryset(self):
        user = self.request.user
        # Superadmins and admins see all residents
        if user.is_staff or getattr(user, 'role', None) in ['superadmin', 'admin']:
            return Resident.objects.all()

        # Get approved facility IDs for this user
        approved_facility_ids = FacilityAccess.objects.filter(
            user=user,
            status='approved'
        ).values_list('facility_id', flat=True)

        # Get all sections in those facilities
        allowed_sections = FacilitySection.objects.filter(facility_id__in=approved_facility_ids)

        # Only residents in allowed sections
        return Resident.objects.filter(facility_section__in=allowed_sections)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def debug_count(self, request):
        """Debug endpoint to check resident count without authentication"""
        total_residents = Resident.objects.count()
        facility_id = request.query_params.get('facility_id')
        
        if facility_id:
            sections = FacilitySection.objects.filter(facility_id=facility_id)
            residents_in_facility = Resident.objects.filter(facility_section__in=sections).count()
            return Response({
                'total_residents': total_residents,
                'facility_id': facility_id,
                'residents_in_facility': residents_in_facility,
                'sections_in_facility': sections.count(),
                'section_details': [
                    {
                        'id': section.id,
                        'name': section.name,
                        'residents_count': section.residents.count()
                    } for section in sections
                ]
            })
        
        return Response({
            'total_residents': total_residents,
            'message': 'Add ?facility_id=73 to see facility-specific data'
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export residents to CSV"""
        residents = self.get_queryset()
        
        # Create the CSV file
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow(['Name', 'Status', 'Facility Section', 'Facility ID', 'Facility Name'])
        
        # Write data
        for resident in residents:
            writer.writerow([
                resident.name,
                resident.status,
                resident.facility_section,
                resident.facility_id,
                resident.facility_name,
            ])
        
        # Create the response
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="residents.csv"'
        
        return response

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """Import residents from CSV"""
        logger.info("Starting CSV import")
        if 'file' not in request.FILES:
            logger.error("No file in request.FILES")
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        file = request.FILES['file']
        logger.info(f"Received file: {file.name}")
        if not file.name.endswith('.csv'):
            logger.error("File is not a CSV")
            return Response({'error': 'File must be a CSV'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # Read the CSV file
            logger.info("Reading CSV file")
            df = pd.read_csv(file)
            logger.info(f"CSV columns: {df.columns.tolist()}")
            # Map column names to expected fields
            column_mapping = {
                'ResidentName': 'name',
                'ResidentStatus': 'status',
                'FacilitySectionName': 'facility_section',
                'FacilityID': 'facility_id',
                'FacilityName': 'facility_name'
            }
            required_columns = list(column_mapping.keys())
            if not all(col in df.columns for col in required_columns):
                missing_cols = [col for col in required_columns if col not in df.columns]
                logger.error(f"Missing required columns: {missing_cols}")
                return Response({
                    'error': f'Missing required columns: {", ".join(missing_cols)}. Required columns are: {", ".join(required_columns)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            unique_residents = df[required_columns].drop_duplicates()
            logger.info(f"Found {len(unique_residents)} unique residents")
            created_count = 0
            updated_count = 0
            for _, row in unique_residents.iterrows():
                # Clean and map the data
                resident_data = {
                    new_key: str(row[old_key]).strip() 
                    for old_key, new_key in column_mapping.items()
                }
                logger.info(f"Processing resident: {resident_data['name']}")
                # Get or create Facility
                facility, _ = Facility.objects.get_or_create(
                    facility_id=resident_data['facility_id'],
                    defaults={'name': resident_data['facility_name']}
                )
                # Get or create FacilitySection
                section, _ = FacilitySection.objects.get_or_create(
                    name=resident_data['facility_section'],
                    facility=facility
                )
                # Try to find existing resident by name and section
                resident, created = Resident.objects.update_or_create(
                    name=resident_data['name'],
                    facility_section=section,
                    defaults={
                        'status': resident_data['status'],
                        'facility_section': section
                    }
                )
                if created:
                    created_count += 1
                    logger.info(f"Created new resident: {resident.name}")
                else:
                    updated_count += 1
                    logger.info(f"Updated existing resident: {resident.name}")
            logger.info(f"Import complete. Created: {created_count}, Updated: {updated_count}")
            return Response({
                'message': f'Successfully imported {created_count} new residents and updated {updated_count} existing residents.'
            })
        except Exception as e:
            logger.error(f"Error during import: {str(e)}", exc_info=True)
            return Response({'error': f'Error importing file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def caregiving_summary(self, request, pk=None):
        resident = self.get_object()
        from users.models import FacilityAccess
        
        # Check if user has access to this resident's facility
        user = request.user
        
        # Check for week filtering
        week_start_date = request.query_params.get('week_start_date')
        
        if week_start_date:
            # Parse the week start date
            try:
                from datetime import timedelta
                week_start = datetime.strptime(week_start_date, '%Y-%m-%d').date()
                
                # Normalize week_start to Sunday to match frontend display (weekday() returns 0=Monday, 1=Tuesday, ..., 6=Sunday)
                # Frontend displays "Week of Nov 30 - Dec 6" (Sunday to Saturday), so we query using Sunday as week_start
                # If the date is not Sunday, find the Sunday of that week
                days_since_monday = week_start.weekday()  # 0=Monday, 6=Sunday
                if days_since_monday == 6:  # Already Sunday
                    pass  # No change needed
                else:  # Monday-Saturday - go back to Sunday
                    # For Monday (0), go back 1 day. For Tuesday (1), go back 2 days, etc.
                    week_start = week_start - timedelta(days=days_since_monday + 1)
                
                # Only use WeeklyADLEntry data for the specific selected week
                # No baseline data - only show actual data for that week
                from adls.models import WeeklyADLEntry
                
                weekly_entries = WeeklyADLEntry.objects.filter(
                    resident=resident,
                    week_start_date=week_start,
                    status='complete'
                )
                
                # If no WeeklyADLEntry data exists for this week, return empty data
                if weekly_entries.count() == 0:
                    return Response({
                        'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                        'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
                    })
                else:
                    # Calculate caregiving summary from WeeklyADLEntry data for this specific week
                    from adls.views import ADLViewSet # Import here to avoid circular dependency
                    return ADLViewSet()._calculate_caregiving_summary_from_weekly_entries(weekly_entries)
                    
            except ValueError:
                return Response({
                    'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                    'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
                })
        
        # If no week specified, return empty data
        return Response({
            'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
            'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
        })

from rest_framework.permissions import AllowAny

class FacilityViewSet(viewsets.ModelViewSet):
    queryset = Facility.objects.all()
    serializer_class = FacilitySerializer
    permission_classes = [AllowAny]  # Allow unauthenticated access for facility listing

    def get_queryset(self):
        user = self.request.user
        queryset = Facility.objects.all()
        
        # Superadmins and admins see all facilities
        if not (user.is_staff or getattr(user, 'role', None) in ['superadmin', 'admin']):
            # For anonymous users, show all facilities (for access request)
            if not user.is_anonymous:
                # Get approved facility IDs for this user
                approved_facility_ids = FacilityAccess.objects.filter(
                    user=user,
                    status='approved'
                ).values_list('facility_id', flat=True)

                # If user has no approved access, show all facilities (for access request)
                if approved_facility_ids:
                    queryset = queryset.filter(id__in=approved_facility_ids)

        # Always prefetch sections to ensure they're included in the response
        return queryset.prefetch_related('sections')

    def update(self, request, *args, **kwargs):
        print('DEBUG Facility update payload:', request.data)
        print('DEBUG Facility update method:', request.method)
        # DRF's ModelViewSet already handles partial updates for PATCH
        # Just ensure partial=True is set for PATCH requests
        if request.method == 'PATCH':
            kwargs['partial'] = True
        response = super().update(request, *args, **kwargs)
        if response.status_code == 400:
            print('DEBUG Facility update error:', response.data)
        return response

    @action(detail=True, methods=['get'])
    def caregiving_summary(self, request, pk=None):
        facility = self.get_object()
        sections = facility.sections.all()
        residents = Resident.objects.filter(facility_section__in=sections)
        
        # Check for week filtering
        week_start_date = request.query_params.get('week_start_date')
        
        if week_start_date:
            # Parse the week start date
            try:
                from datetime import timedelta
                week_start = datetime.strptime(week_start_date, '%Y-%m-%d').date()
                
                # Normalize week_start to Sunday to match frontend display (weekday() returns 0=Monday, 1=Tuesday, ..., 6=Sunday)
                # Frontend displays "Week of Nov 30 - Dec 6" (Sunday to Saturday), so we query using Sunday as week_start
                # If the date is not Sunday, find the Sunday of that week
                days_since_monday = week_start.weekday()  # 0=Monday, 6=Sunday
                if days_since_monday == 6:  # Already Sunday
                    pass  # No change needed
                else:  # Monday-Saturday - go back to Sunday
                    # For Monday (0), go back 1 day. For Tuesday (1), go back 2 days, etc.
                    week_start = week_start - timedelta(days=days_since_monday + 1)
                    print(f"DEBUG: Normalized week_start_date from {week_start_date} to Sunday {week_start}")
                
                # CRITICAL: ONLY use WeeklyADLEntry data for the specific selected week
                # This ensures week-specific data isolation - ADL data only shows for the week it was uploaded for
                # NO FALLBACK to static total_shift_times data (which is not week-specific and causes cross-week contamination)
                from adls.models import WeeklyADLEntry
                
                # Query for entries where week_start_date falls within the week (Sunday to Saturday)
                # This handles cases where entries were saved with Monday instead of Sunday
                week_end = week_start + timedelta(days=6)  # Saturday
                weekly_entries = WeeklyADLEntry.objects.filter(
                    resident__in=residents,
                    week_start_date__gte=week_start,  # Sunday or later
                    week_start_date__lte=week_end,     # Saturday or earlier
                    status='complete',  # Only show completed entries
                    is_deleted=False  # Also filter out deleted entries
                )
                
                # Debug logging
                print(f"DEBUG FacilityViewSet.caregiving_summary: Facility={facility.name} (ID={facility.id}), week_start={week_start}")
                print(f"DEBUG: Found {residents.count()} residents in {sections.count()} sections")
                print(f"DEBUG: Found {weekly_entries.count()} WeeklyADLEntry records for this facility and week")
                
                # Check total entries for this week regardless of facility
                total_entries = WeeklyADLEntry.objects.filter(
                    week_start_date=week_start,
                    is_deleted=False
                ).count()
                print(f"DEBUG: Total WeeklyADLEntry records for week {week_start} (all facilities): {total_entries}")
                
                # Also check what week_start_date values actually exist in the database
                from django.db.models import Count
                week_dates = WeeklyADLEntry.objects.filter(
                    is_deleted=False
                ).values('week_start_date').annotate(count=Count('id')).order_by('-count')[:10]
                print(f"DEBUG: Top 10 week_start_date values in database:")
                for wd in week_dates:
                    print(f"  - {wd['week_start_date']}: {wd['count']} records")
                
                if total_entries > 0 and weekly_entries.count() == 0:
                    # Sample a few entries to see what facilities/residents they belong to
                    sample_entries = WeeklyADLEntry.objects.filter(
                        week_start_date=week_start,
                        is_deleted=False
                    )[:5]
                    print(f"DEBUG: Sample entries (first 5):")
                    for entry in sample_entries:
                        print(f"  - {entry.resident.name} in {entry.resident.facility_section.facility.name} (section: {entry.resident.facility_section.name})")
                
                # Also check if records exist for this facility but with different week_start_date
                facility_entries_all_weeks = WeeklyADLEntry.objects.filter(
                    resident__in=residents,
                    is_deleted=False
                ).count()
                print(f"DEBUG: Total WeeklyADLEntry records for this facility (all weeks): {facility_entries_all_weeks}")
                
                # If no WeeklyADLEntry data exists for this week, return empty data
                if weekly_entries.count() == 0:
                    print(f"DEBUG: No entries found - returning empty data")
                    return Response({
                        'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                        'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
                    })
                else:
                    # Calculate caregiving summary from WeeklyADLEntry data for this specific week
                    from adls.views import ADLViewSet # Import here to avoid circular dependency
                    print(f"DEBUG: Calculating summary from {weekly_entries.count()} entries")
                    return ADLViewSet()._calculate_caregiving_summary_from_weekly_entries(weekly_entries)
                    
            except ValueError:
                return Response({
                    'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                    'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
                })
        
        # If no week specified, return empty data
        return Response({
            'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
            'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
        })

class FacilitySectionViewSet(viewsets.ModelViewSet):
    queryset = FacilitySection.objects.all()
    serializer_class = FacilitySectionDetailSerializer
    
    def get_queryset(self):
        queryset = FacilitySection.objects.all()
        
        # Filter by facility if provided
        facility_id = self.request.query_params.get('facility')
        if facility_id:
            try:
                facility_id = int(facility_id)
                queryset = queryset.filter(facility_id=facility_id)
            except (ValueError, TypeError):
                pass  # Invalid facility ID, return all sections
        
        return queryset.order_by('name')

    @action(detail=True, methods=['get'])
    def caregiving_summary(self, request, pk=None):
        section = self.get_object()
        residents = section.residents.all()
        
        # Check if user has access to this section's facility
        user = request.user
        from users.models import FacilityAccess
        
        # For anonymous users, return empty data
        if user.is_anonymous:
            return Response({
                'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
            })
        
        # Check access (unless superadmin/admin)
        if not (user.is_staff or getattr(user, 'role', None) in ['superadmin', 'admin']):
            approved_facility_ids = FacilityAccess.objects.filter(
                user=user,
                status='approved'
            ).values_list('facility_id', flat=True)

            # Check if user has access to this section's facility
            if section.facility.id not in approved_facility_ids:
                return Response({'error': 'Access denied to this section'}, status=403)
        
        # Check for week filtering
        week_start_date = request.query_params.get('week_start_date')
        
        if week_start_date:
            # Parse the week start date
            try:
                from datetime import timedelta
                week_start = datetime.strptime(week_start_date, '%Y-%m-%d').date()
                
                # Normalize week_start to Sunday to match frontend display (weekday() returns 0=Monday, 1=Tuesday, ..., 6=Sunday)
                # Frontend displays "Week of Nov 30 - Dec 6" (Sunday to Saturday), so we query using Sunday as week_start
                # If the date is not Sunday, find the Sunday of that week
                days_since_monday = week_start.weekday()  # 0=Monday, 6=Sunday
                if days_since_monday == 6:  # Already Sunday
                    pass  # No change needed
                else:  # Monday-Saturday - go back to Sunday
                    # For Monday (0), go back 1 day. For Tuesday (1), go back 2 days, etc.
                    week_start = week_start - timedelta(days=days_since_monday + 1)
                
                # CRITICAL: ONLY use WeeklyADLEntry data for the specific selected week
                # This ensures week-specific data isolation - ADL data only shows for the week it was uploaded for
                from adls.models import WeeklyADLEntry
                
                weekly_entries = WeeklyADLEntry.objects.filter(
                    resident__in=residents,
                    week_start_date=week_start,
                    is_deleted=False  # Also filter out deleted entries
                )
                
                # If no WeeklyADLEntry data exists for this week, return empty data
                if weekly_entries.count() == 0:
                    return Response({
                        'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                        'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
                    })
                else:
                    # Calculate caregiving summary from WeeklyADLEntry data for this specific week
                    from adls.views import ADLViewSet # Import here to avoid circular dependency
                    return ADLViewSet()._calculate_caregiving_summary_from_weekly_entries(weekly_entries)
                    
            except ValueError:
                return Response({
                    'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                    'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
                })
        
        # If no week specified, return empty data
        return Response({
            'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
            'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
        })
