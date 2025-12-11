from django.shortcuts import render
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Sum, Avg, Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from .models import ADL, ADLQuestion, WeeklyADLEntry, WeeklyADLSummary
from .serializers import ADLSerializer, ADLQuestionSerializer, WeeklyADLEntrySerializer, WeeklyADLSummarySerializer
from residents.models import Resident
from residents.serializers import ResidentSerializer
import pandas as pd
import io



class ADLViewSet(viewsets.ModelViewSet):
    queryset = ADL.objects.filter(is_deleted=False)  # Only show non-deleted records by default
    serializer_class = ADLSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['resident', 'status', 'question_text']
    search_fields = ['question_text', 'resident__name', 'status']
    ordering_fields = ['created_at', 'total_minutes', 'total_hours', 'resident__name']
    ordering = ['-created_at']  # Default ordering
    
    @staticmethod
    def get_shift_mapping(facility):
        """
        Get shift mapping based on facility shift format.
        Returns dict mapping Shift1/Shift2/Shift3 to shift names.
        
        For 2-shift format (Oregon - 12 hour shifts):
        - Shift1 = Day (6am-6pm)
        - Shift3 = NOC (6pm-6am) 
        - Shift2 = Not typically used, but if present, map to Day
        
        For 3-shift format (California - 8 hour shifts):
        - Shift1 = Day
        - Shift2 = Swing
        - Shift3 = NOC
        """
        if facility and facility.is_2_shift_format:
            # 2-shift format: Day (6am-6pm) and NOC (6pm-6am)
            # No Swing shift for 2-shift format
            return {
                'Shift1': 'Day',
                'Shift2': 'Day',  # If Shift2 data exists, treat as Day (some facilities might use it)
                'Shift3': 'NOC',  # Shift3 = NOC shift for 2-shift format
            }
        else:
            # 3-shift format: Day, Swing, NOC (default)
            return {
                'Shift1': 'Day',
                'Shift2': 'Swing',
                'Shift3': 'NOC',
            }
    
    @staticmethod
    def get_shift_names_for_format(facility):
        """
        Get list of shift names for the facility's format.
        Used for initializing per_shift data structures.
        For 2-shift format: Day and NOC only (no Swing).
        For 3-shift format: Day, Swing, and NOC.
        """
        if facility and facility.is_2_shift_format:
            return ['Day', 'NOC']  # No Swing for 2-shift format
        else:
            return ['Day', 'Swing', 'NOC']

    def get_queryset(self):
        user = self.request.user
        # Superadmins and admins see all ADLs
        if user.is_staff or getattr(user, 'role', None) in ['superadmin', 'admin']:
            return ADL.objects.filter(is_deleted=False)

        # Get approved facility IDs for this user
        from users.models import FacilityAccess
        from residents.models import FacilitySection, Resident
        approved_facility_ids = FacilityAccess.objects.filter(
            user=user,
            status='approved'
        ).values_list('facility_id', flat=True)

        # Get all sections in those facilities
        allowed_sections = FacilitySection.objects.filter(facility_id__in=approved_facility_ids)

        # Get all residents in those sections
        allowed_residents = Resident.objects.filter(facility_section__in=allowed_sections)

        # Only ADLs for allowed residents
        return ADL.objects.filter(resident__in=allowed_residents, is_deleted=False)

    def perform_update(self, serializer):
        """Custom update to validate and save ADL"""
        instance = serializer.instance
        data = serializer.validated_data
        
        # Calculate total_minutes and total_hours
        minutes = data.get('minutes', instance.minutes)
        frequency = data.get('frequency', instance.frequency)
        per_day_shift_times = data.get('per_day_shift_times', getattr(instance, 'per_day_shift_times', {}))
        
        # Sum all per-day/shift times
        per_day_shift_total = 0
        if per_day_shift_times:
            per_day_shift_total = sum(int(v) for v in per_day_shift_times.values() if v)
        
        if per_day_shift_total > 0:
            total_minutes = per_day_shift_total
        else:
            total_minutes = minutes * frequency
        total_hours = float(total_minutes) / 60 if total_minutes else 0
        
        # Update the calculated fields and ensure per_day_shift_times is saved
        serializer.save(
            total_minutes=total_minutes,
            total_hours=total_hours,
            per_day_shift_times=per_day_shift_times,
            updated_by=self.request.user,
            updated_at=timezone.now()
        )

    def perform_destroy(self, instance):
        """Soft delete instead of hard delete"""
        instance.soft_delete()

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore a soft-deleted ADL"""
        instance = self.get_object()
        instance.restore()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def deleted(self, request):
        """View soft-deleted ADLs"""
        queryset = ADL.objects.filter(is_deleted=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_resident(self, request):
        """Get all ADLs grouped by resident"""
        resident_id = request.query_params.get('resident_id')
        if resident_id:
            adls = self.queryset.filter(resident_id=resident_id)
        else:
            adls = self.queryset.all()
        
        serializer = self.get_serializer(adls, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_date(self, request):
        """Get ADLs grouped by date"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        adls = self.queryset.all()
        if start_date:
            adls = adls.filter(created_at__date__gte=start_date)
        if end_date:
            adls = adls.filter(created_at__date__lte=end_date)
            
        adls = adls.annotate(date=TruncDate('created_at')).order_by('-date')
        serializer = self.get_serializer(adls, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics of ADLs, with optional resident or facility filtering"""
        resident_id = request.query_params.get('resident_id')
        facility_id = request.query_params.get('facility_id')
        queryset = self.queryset
        if resident_id:
            queryset = queryset.filter(resident_id=resident_id)
        if facility_id:
            # Filter by residents in the given facility
            from residents.models import Resident, FacilitySection
            sections = FacilitySection.objects.filter(facility_id=facility_id)
            residents = Resident.objects.filter(facility_section__in=sections)
            queryset = queryset.filter(resident__in=residents)
        summary = queryset.aggregate(
            total_minutes=Sum('total_minutes'),
            total_hours=Sum('total_hours'),
            avg_minutes_per_task=Avg('minutes'),
            total_adls=Count('id')
        )
        return Response(summary)

    @action(detail=False, methods=['post'], url_path='upload', permission_classes=[AllowAny])
    def upload_file(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get facility_id from request if provided
        facility_id = request.POST.get('facility_id')
        target_facility = None
        if facility_id:
            try:
                from residents.models import Facility
                target_facility = Facility.objects.get(id=facility_id)
            except Facility.DoesNotExist:
                return Response({'error': f'Facility with ID {facility_id} not found.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            if file.name.endswith('.csv'):
                # Read CSV with UTF-8-sig encoding to handle BOM (Byte Order Mark) characters
                # This is common in CSV files exported from Excel
                try:
                    df = pd.read_csv(file, encoding='utf-8-sig')
                except UnicodeDecodeError:
                    # Fallback to regular UTF-8 if utf-8-sig fails
                    df = pd.read_csv(file, encoding='utf-8')
                # Strip any BOM or whitespace from column names
                df.columns = df.columns.str.strip().str.replace('\ufeff', '')  # Remove BOM if present
            else:
                df = pd.read_excel(file)
            print(f"CSV file '{file.name}' parsed successfully. Columns found: {list(df.columns)}")
            print(f"Total rows: {len(df)}")
        except Exception as e:
            print(f"Error parsing file '{file.name}': {e}")
            return Response({'error': f'File parsing error: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        created_adls = 0
        updated_adls = 0
        created_residents = 0
        created_weekly_entries = 0
        updated_weekly_entries = 0
        skipped_rows = 0
        error_rows = []
        
        # Define the per-day/shift time columns
        per_day_shift_cols = [
            'MonShift1Time', 'MonShift2Time', 'MonShift3Time',
            'TuesShift1Time', 'TuesShift2Time', 'TuesShift3Time',
            'WedShift1Time', 'WedShift2Time', 'WedShift3Time',
            'ThursShift1Time', 'ThursShift2Time', 'ThursShift3Time',
            'FriShift1Time', 'FriShift2Time', 'FriShift3Time',
            'SatShift1Time', 'SatShift2Time', 'SatShift3Time',
            'SunShift1Time', 'SunShift2Time', 'SunShift3Time'
        ]
        
        # Check if this is a resident-based CSV (one row per resident) or ADL-based CSV (one row per ADL)
        is_resident_based = 'Name' in df.columns and 'TotalCareTime' in df.columns and 'QuestionText' not in df.columns
        is_adl_answer_export = 'QuestionText' in df.columns and 'ResidentName' in df.columns
        
        print(f"CSV format detection - is_resident_based: {is_resident_based}, is_adl_answer_export: {is_adl_answer_export}")
        
        # For ADL Answer Export format, facility_id is required
        if is_adl_answer_export and not target_facility:
            print("ERROR: ADL Answer Export format detected but no facility_id provided")
            return Response({
                'error': 'facility_id is required for ADL Answer Export format. Please provide facility_id in the upload request.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if is_adl_answer_export:
            # Handle ADL Answer Export format (like the Murray Highland Answer Export)
            print("Processing ADL Answer Export format...")
            
            for index, row in df.iterrows():
                try:
                    # Get question text
                    question_text = row.get('QuestionText', '')
                    if pd.isna(question_text) or not str(question_text).strip():
                        skipped_rows += 1
                        print(f"Row {index}: Skipped - empty QuestionText")
                        continue
                    question_text = str(question_text).strip()
                    
                    # Get resident name
                    resident_name = row.get('ResidentName', '')
                    if pd.isna(resident_name) or not str(resident_name).strip():
                        skipped_rows += 1
                        print(f"Row {index}: Skipped - empty ResidentName")
                        continue
                    resident_name = str(resident_name).strip()
                    
                    # Get facility information
                    facility_id = row.get('FacilityID', '')
                    if pd.isna(facility_id):
                        facility_id = ''
                    else:
                        facility_id = str(facility_id).strip()
                    
                    facility_name = row.get('FacilityName', '')
                    if pd.isna(facility_name):
                        facility_name = ''
                    else:
                        facility_name = str(facility_name).strip()
                    
                    from residents.models import Facility
                    facility = target_facility  # Always use the selected facility from the upload context
                    
                    if not facility:
                        # If no facility provided in request, try to find by CSV data
                        if facility_id or facility_name:
                            # Try to find facility by ID first
                            if facility_id:
                                try:
                                    facility = Facility.objects.get(facility_id=facility_id)
                                except Facility.DoesNotExist:
                                    pass
                            
                            # If not found by ID, try by name
                            if not facility and facility_name:
                                try:
                                    facility = Facility.objects.get(name__iexact=facility_name)
                                except Facility.DoesNotExist:
                                    pass
                    
                    if not facility:
                        # Skip this row but continue processing others
                        error_msg = f"Row {index}: No facility found for FacilityID '{facility_id}' or name '{facility_name}'. Skipping row. Please ensure facility_id is provided in the upload request or the facility exists in the system."
                        print(error_msg)
                        # Don't skip - this is a critical error that should stop the import
                        return Response({
                            'error': error_msg,
                            'details': {
                                'row_index': index,
                                'facility_id_from_csv': facility_id,
                                'facility_name_from_csv': facility_name,
                                'target_facility_provided': target_facility is not None,
                                'target_facility_id': target_facility.id if target_facility else None
                            }
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Get or create section
                    section_name = row.get('FacilitySectionName', 'whole building')
                    if pd.isna(section_name):
                        section_name = 'whole building'
                    else:
                        section_name = str(section_name).strip()
                    
                    from residents.models import FacilitySection, Resident
                    facility_section, _ = FacilitySection.objects.get_or_create(
                        name=section_name,
                        facility=facility
                    )
                    
                    # Get or create resident
                    current_resident, created = Resident.objects.get_or_create(
                        name=resident_name,
                        facility_section=facility_section,
                        defaults={
                            'status': row.get('ResidentStatus', 'Active'),
                        }
                    )
                    
                    if created:
                        created_residents += 1
                    
                    # Store resident total shift times for chart calculations (like Oregon ABST)
                    resident_total_shift_times = {}
                    resident_total_shift_cols = [
                        'ResidentTotalMonShift1Time', 'ResidentTotalMonShift2Time', 'ResidentTotalMonShift3Time',
                        'ResidentTotalTuesShift1Time', 'ResidentTotalTuesShift2Time', 'ResidentTotalTuesShift3Time',
                        'ResidentTotalWedShift1Time', 'ResidentTotalWedShift2Time', 'ResidentTotalWedShift3Time',
                        'ResidentTotalThursShift1Time', 'ResidentTotalThursShift2Time', 'ResidentTotalThursShift3Time',
                        'ResidentTotalFriShift1Time', 'ResidentTotalFriShift2Time', 'ResidentTotalFriShift3Time',
                        'ResidentTotalSatShift1Time', 'ResidentTotalSatShift2Time', 'ResidentTotalSatShift3Time',
                        'ResidentTotalSunShift1Time', 'ResidentTotalSunShift2Time', 'ResidentTotalSunShift3Time',
                    ]
                    
                    for col in resident_total_shift_cols:
                        if col in df.columns:
                            value = row.get(col, 0)
                            if pd.isna(value) or value is None:
                                value = 0
                            resident_total_shift_times[col] = int(float(value))
                    
                    # Do NOT update resident.total_shift_times - all imports must be week-specific
                    # WeeklyADLEntry records are created with the specific week_start_date
                    print(f"Skipped updating resident.total_shift_times for {resident_name} - using week-specific WeeklyADLEntry only")
                    
                    # Find the ADLQuestion object
                    adl_question = ADLQuestion.objects.filter(text__iexact=question_text).first()
                    if not adl_question:
                        # Create the question if it doesn't exist
                        adl_question, _ = ADLQuestion.objects.get_or_create(
                            text=question_text,
                            defaults={'order': 999}
                        )
                    
                    # Get task time from CSV - SIMPLE AND DIRECT
                    task_time = 0
                    
                    # Create case-insensitive column mapping
                    col_map = {col.lower().strip(): col for col in df.columns}
                    
                    # Try TaskTime column (case-insensitive) - Check multiple variations
                    # Check multiple variations: tasktime, task time, time of task, totaltasktime
                    task_time_column_exists = False
                    for key in ['tasktime', 'task time', 'time of task', 'totaltasktime']:
                        if key in col_map:
                            actual_col = col_map[key]
                            task_time_column_exists = True  # At least one TaskTime column exists
                            value = row.get(actual_col, None)
                            if value is not None and not pd.isna(value):
                                try:
                                    task_time = float(value)
                                    print(f"Row {index}: Found TaskTime = {task_time} from column '{actual_col}'")
                                    break  # Found a value, stop looking
                                except (ValueError, TypeError) as e:
                                    print(f"Row {index}: Error parsing TaskTime '{value}' from '{actual_col}': {e}")
                                    continue  # Try next column
                            # If this column exists but is empty, continue to next option
                            continue
                    
                    # Only try fallback columns if TaskTime column doesn't exist
                    if not task_time_column_exists:
                        for key in ['time', 'minutes', 'min', 'timepertask', 'taskminutes', 'duration', 'minpertask']:
                            if key in col_map:
                                actual_col = col_map[key]
                                value = row.get(actual_col, None)
                                if value is not None and not pd.isna(value):
                                    try:
                                        test_value = float(value)
                                        if test_value > 0:  # Only use if > 0 for fallback columns
                                            task_time = test_value
                                            print(f"Row {index}: Found task time '{task_time}' from fallback column '{actual_col}'")
                                            break
                                    except (ValueError, TypeError):
                                        continue
                    
                    # If still 0, it might be a valid 0 value or missing - log for debugging
                    if task_time == 0:
                        time_cols = [c for c in df.columns if any(x in c.lower() for x in ['time', 'minute'])]
                        print(f"Row {index}: TaskTime is 0. Time-related columns found: {time_cols[:5]}")
                    
                    # Get TotalFrequency from CSV if available
                    total_frequency = 0
                    if 'TotalFrequency' in df.columns:
                        freq_value = row.get('TotalFrequency', 0)
                        if not pd.isna(freq_value) and freq_value is not None:
                            try:
                                total_frequency = int(float(freq_value))
                            except (ValueError, TypeError):
                                pass
                    
                    # Prepare per-day/shift times dict from individual shift columns
                    # IMPORTANT: CSV shift columns (MonShift1Time, etc.) store TOTAL MINUTES per shift, not frequency
                    # We need to convert to frequency by dividing by Time of Task (minutes per occurrence)
                    # Example: MonShift1Time = 10, Time of Task = 10 → frequency = 10/10 = 1
                    # This matches Oregon ABST's export format where shift columns are in minutes
                    per_day_shift_times = {}
                    total_frequency_from_shifts = 0
                    task_time_for_conversion = task_time if task_time > 0 else 1  # Avoid division by zero
                    
                    for col in per_day_shift_cols:
                        if col in df.columns:
                            value = row.get(col, 0)
                            if pd.isna(value) or value is None:
                                value = 0
                            try:
                                # Convert minutes to frequency: minutes_per_shift / minutes_per_occurrence
                                minutes_per_shift = float(value)
                                if minutes_per_shift > 0 and task_time_for_conversion > 0:
                                    frequency = round(minutes_per_shift / task_time_for_conversion)
                                    # Round to nearest integer (frequencies are whole numbers)
                                    per_day_shift_times[col] = frequency
                                    total_frequency_from_shifts += frequency
                                else:
                                    per_day_shift_times[col] = 0
                            except (ValueError, TypeError):
                                per_day_shift_times[col] = 0
                    
                    # Use TotalFrequency if available, otherwise use frequency from shifts
                    final_frequency = total_frequency if total_frequency > 0 else total_frequency_from_shifts
                    
                    # IMPORTANT: Use TotalCaregivingTime from CSV as the authoritative source for total minutes
                    # This ensures we match Oregon ABST calculations exactly
                    total_minutes_from_csv = None
                    if 'TotalCaregivingTime' in df.columns:
                        csv_total_value = row.get('TotalCaregivingTime', None)
                        if csv_total_value is not None and not pd.isna(csv_total_value):
                            try:
                                total_minutes_from_csv = int(float(csv_total_value))
                                print(f"Row {index}: Using TotalCaregivingTime = {total_minutes_from_csv} from CSV")
                            except (ValueError, TypeError) as e:
                                print(f"Row {index}: Error parsing TotalCaregivingTime '{csv_total_value}': {e}")
                    
                    # Calculate total minutes: prefer CSV value, fallback to calculation
                    if total_minutes_from_csv is not None:
                        total_minutes = total_minutes_from_csv
                        # If we have CSV total but no task_time, try to infer it from the calculation
                        # This helps maintain consistency
                        if task_time == 0 and final_frequency > 0:
                            task_time = total_minutes / final_frequency if final_frequency > 0 else 0
                    else:
                        # Fallback: calculate from task_time * frequency
                        total_minutes = int(task_time) * int(final_frequency) if task_time > 0 and final_frequency > 0 else 0
                    
                    total_hours = float(total_minutes) / 60 if total_minutes else 0
                    
                    # IMPORTANT: Store FREQUENCIES in per_day_data, not minutes
                    # The frontend expects frequencies (number of times) so it can display and calculate correctly
                    # We already have total_minutes_week for the total, so per_day_data should store frequencies
                    # per_day_shift_times now contains frequencies (converted from minutes by dividing by task_time)
                    per_day_shift_data = {}
                    # per_day_shift_times already contains frequencies (converted from CSV minutes), use them directly
                    for col, frequency in per_day_shift_times.items():
                        per_day_shift_data[col] = frequency
                    
                    # Check for existing ADL record (including soft-deleted ones)
                    existing_adl = ADL.objects.filter(
                        resident=current_resident,
                        adl_question=adl_question
                    ).first()
                    
                    if existing_adl:
                        # Update existing record (restore if deleted)
                        if existing_adl.is_deleted:
                            existing_adl.is_deleted = False
                            existing_adl.deleted_at = None
                        existing_adl.question_text = question_text
                        existing_adl.minutes = int(task_time)
                        existing_adl.frequency = int(final_frequency)
                        existing_adl.total_minutes = total_minutes
                        existing_adl.total_hours = total_hours
                        existing_adl.status = row.get('ResidentStatus', 'Complete')
                        existing_adl.per_day_shift_times = per_day_shift_times
                        existing_adl.updated_by = request.user if request.user.is_authenticated else None
                        existing_adl.save()
                        adl = existing_adl
                        created = False
                    else:
                        # Create new ADL record
                        adl = ADL.objects.create(
                            resident=current_resident,
                            adl_question=adl_question,
                            question_text=question_text,
                            minutes=int(task_time),
                            frequency=int(final_frequency),
                            total_minutes=total_minutes,
                            total_hours=total_hours,
                            status=row.get('ResidentStatus', 'Complete'),
                            per_day_shift_times=per_day_shift_times,
                            is_deleted=False,
                            deleted_at=None,
                            created_by=request.user if request.user.is_authenticated else None,
                            updated_by=request.user if request.user.is_authenticated else None,
                        )
                        created = True
                    
                    if created:
                        created_adls += 1
                        print(f"Created ADL for {resident_name} - {question_text[:30]}...")
                    else:
                        updated_adls += 1
                        print(f"Updated ADL for {resident_name} - {question_text[:30]}...")
                    
                    # ALSO create WeeklyADLEntry for charts and analytics
                    # Get week dates from request or use current week
                    week_start_date = request.POST.get('week_start_date')
                    week_end_date = request.POST.get('week_end_date')
                    
                    if not week_start_date or not week_end_date:
                        return Response({
                            'error': 'week_start_date and week_end_date are required for ADL imports. Please select a week before importing.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    try:
                        from datetime import datetime, timedelta
                        week_start = datetime.strptime(week_start_date, '%Y-%m-%d').date()
                        week_end = datetime.strptime(week_end_date, '%Y-%m-%d').date()
                        
                        # Normalize week_start to Sunday (consistent with serializer)
                        days_since_monday = week_start.weekday()  # 0=Monday, 6=Sunday
                        if days_since_monday == 6:  # Already Sunday
                            week_start_normalized = week_start
                        else:  # Monday-Saturday - go back to Sunday
                            week_start_normalized = week_start - timedelta(days=days_since_monday + 1)
                        
                        # Calculate week_end as Saturday (6 days after Sunday)
                        week_end_normalized = week_start_normalized + timedelta(days=6)
                        
                        print(f"ADL Answer Export import: Using week {week_start_normalized} to {week_end_normalized} (normalized from {week_start} to {week_end})")
                    except ValueError as e:
                        return Response({
                            'error': f'Invalid week date format: {e}. Please use YYYY-MM-DD format.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Use update_or_create to prevent duplicates (unique_together: resident, adl_question, week_start_date)
                    # First, restore any soft-deleted entries for this combination
                    existing_deleted = WeeklyADLEntry.objects.filter(
                        resident=current_resident,
                        adl_question=adl_question,
                        week_start_date=week_start_normalized,
                        is_deleted=True
                    ).first()
                    
                    if existing_deleted:
                        # Restore the soft-deleted entry instead of creating a new one
                        existing_deleted.is_deleted = False
                        existing_deleted.deleted_at = None
                        existing_deleted.week_end_date = week_end_normalized
                        existing_deleted.question_text = question_text
                        existing_deleted.minutes_per_occurrence = int(task_time)
                        existing_deleted.frequency_per_week = int(final_frequency)
                        existing_deleted.total_minutes_week = total_minutes
                        existing_deleted.total_hours_week = float(total_minutes) / 60 if total_minutes else 0
                        existing_deleted.per_day_data = per_day_shift_data
                        existing_deleted.status = 'complete'
                        existing_deleted.updated_by = request.user if request.user.is_authenticated else None
                        existing_deleted.save()
                        weekly_entry = existing_deleted
                        weekly_created = False
                    else:
                        # Now create/update the entry (will create new or update existing non-deleted)
                        weekly_entry, weekly_created = WeeklyADLEntry.objects.update_or_create(
                                resident=current_resident,
                                adl_question=adl_question,
                                week_start_date=week_start_normalized,
                            defaults={
                                'week_end_date': week_end_normalized,
                                'question_text': question_text,
                            'minutes_per_occurrence': int(task_time),
                            'frequency_per_week': int(final_frequency),
                            'total_minutes_week': total_minutes,
                            'total_hours_week': float(total_minutes) / 60 if total_minutes else 0,
                            'per_day_data': per_day_shift_data,
                                'status': 'complete',
                                'is_deleted': False,
                                'deleted_at': None,
                                'updated_by': request.user if request.user.is_authenticated else None,
                            }
                        )
                    
                    # Set created_by only if this is a new entry
                    if weekly_created:
                        weekly_entry.created_by = request.user if request.user.is_authenticated else None
                        weekly_entry.save()
                        created_weekly_entries += 1
                    else:
                        updated_weekly_entries += 1
                    
                    if weekly_created:
                        print(f"Created WeeklyADLEntry for {resident_name} - {question_text[:30]}... (Week: {week_start} to {week_end})")
                    else:
                        print(f"Updated WeeklyADLEntry for {resident_name} - {question_text[:30]}... (Week: {week_start} to {week_end})")
                    
                    print(f"Row {index}: Processed '{question_text}' for resident '{resident_name}' - {task_time}min x {final_frequency} = {total_minutes} total minutes (from CSV TotalCaregivingTime: {total_minutes_from_csv if total_minutes_from_csv is not None else 'calculated'})")
                    
                except Exception as e:
                    print(f"Error processing row {index}: {e}")
                    continue
                    
        elif is_resident_based:
            # Handle resident-based CSV format (like the Murray Highland export)
            print("Processing resident-based CSV format...")
            
            # Get week_start_date from request for resident-based imports
            week_start_date = request.POST.get('week_start_date')
            week_end_date = request.POST.get('week_end_date')
            
            if not week_start_date or not week_end_date:
                return Response({
                    'error': 'week_start_date and week_end_date are required for resident-based CSV imports. Please select a week before importing.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                from datetime import datetime, timedelta
                week_start = datetime.strptime(week_start_date, '%Y-%m-%d').date()
                week_end = datetime.strptime(week_end_date, '%Y-%m-%d').date()
                
                # Normalize week_start to Sunday (consistent with serializer)
                days_since_monday = week_start.weekday()  # 0=Monday, 6=Sunday
                if days_since_monday == 6:  # Already Sunday
                    week_start_normalized = week_start
                else:  # Monday-Saturday - go back to Sunday
                    week_start_normalized = week_start - timedelta(days=days_since_monday + 1)
                
                # Calculate week_end as Saturday (6 days after Sunday)
                week_end_normalized = week_start_normalized + timedelta(days=6)
                
                print(f"Resident-based import: Using week {week_start_normalized} to {week_end_normalized} (normalized from {week_start} to {week_end})")
            except ValueError as e:
                return Response({
                    'error': f'Invalid week date format: {e}. Please use YYYY-MM-DD format.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            for index, row in df.iterrows():
                try:
                    # Get resident name
                    resident_name = row.get('Name', '')
                    if pd.isna(resident_name) or not str(resident_name).strip():
                        continue
                    resident_name = str(resident_name).strip()
                    
                    # Get facility information
                    facility_id = row.get('FacilityID', '')
                    if pd.isna(facility_id):
                        facility_id = ''
                    else:
                        facility_id = str(facility_id).strip()
                    
                    facility_name = row.get('FacilityName', '')
                    if pd.isna(facility_name):
                        facility_name = ''
                    else:
                        facility_name = str(facility_name).strip()
                    
                    from residents.models import Facility
                    facility = None
                    
                    # Try to find facility by ID first
                    if facility_id:
                        try:
                            facility = Facility.objects.get(facility_id=facility_id)
                        except Facility.DoesNotExist:
                            # Try alternative ID mappings for Murray Highland
                            if facility_id == '50R460':
                                try:
                                    facility = Facility.objects.get(name__iexact='Murray Highland')
                                except Facility.DoesNotExist:
                                    pass
                            pass
                    
                    # If not found by ID, try by name
                    if not facility and facility_name:
                        try:
                            facility = Facility.objects.get(name__iexact=facility_name)
                        except Facility.DoesNotExist:
                            pass
                    
                    if not facility:
                        print(f"Row {index}: Facility not found for FacilityID '{facility_id}' or name '{facility_name}'. Skipping row.")
                        continue
                    
                    # Get or create section
                    section_name = row.get('FacilitySectionName', 'whole building')
                    if pd.isna(section_name):
                        section_name = 'whole building'
                    else:
                        section_name = str(section_name).strip()
                    
                    from residents.models import FacilitySection, Resident
                    facility_section, _ = FacilitySection.objects.get_or_create(
                        name=section_name,
                        facility=facility
                    )
                    
                    # Get or create resident
                    current_resident, created = Resident.objects.get_or_create(
                        name=resident_name,
                        facility_section=facility_section,
                        defaults={
                            'status': row.get('Status', 'Active'),
                        }
                    )
                    
                    if created:
                        created_residents += 1
                    
                    # Store resident total shift times for chart calculations (like Oregon ABST)
                    resident_total_shift_times = {}
                    resident_total_shift_cols = [
                        'ResidentTotalMonShift1Time', 'ResidentTotalMonShift2Time', 'ResidentTotalMonShift3Time',
                        'ResidentTotalTuesShift1Time', 'ResidentTotalTuesShift2Time', 'ResidentTotalTuesShift3Time',
                        'ResidentTotalWedShift1Time', 'ResidentTotalWedShift2Time', 'ResidentTotalWedShift3Time',
                        'ResidentTotalThursShift1Time', 'ResidentTotalThursShift2Time', 'ResidentTotalThursShift3Time',
                        'ResidentTotalFriShift1Time', 'ResidentTotalFriShift2Time', 'ResidentTotalFriShift3Time',
                        'ResidentTotalSatShift1Time', 'ResidentTotalSatShift2Time', 'ResidentTotalSatShift3Time',
                        'ResidentTotalSunShift1Time', 'ResidentTotalSunShift2Time', 'ResidentTotalSunShift3Time',
                    ]
                    
                    for col in resident_total_shift_cols:
                        if col in df.columns:
                            value = row.get(col, 0)
                            if pd.isna(value) or value is None:
                                value = 0
                            resident_total_shift_times[col] = int(float(value))
                    
                    # Do NOT update resident.total_shift_times - all imports must be week-specific
                    # WeeklyADLEntry records are created with the specific week_start_date
                    print(f"Skipped updating resident.total_shift_times for {resident_name} - using week-specific WeeklyADLEntry only")
                    
                    # Prepare per-day/shift times dict
                    per_day_shift_times = {}
                    for col in per_day_shift_cols:
                        if col in df.columns:
                            value = row.get(col, 0)
                            if pd.isna(value) or value is None:
                                value = 0
                            per_day_shift_times[col] = int(float(value))  # Handle decimal values
                    
                    # Calculate total minutes from shift times
                    total_minutes = sum(per_day_shift_times.values())
                    total_hours = float(total_minutes) / 60 if total_minutes else 0
                    
                    # For resident-based CSV, we need to create individual ADL records for each standard question
                    # Get all standard ADL questions
                    standard_questions = ADLQuestion.objects.all().order_by('order')
                    
                    if not standard_questions.exists():
                        # If no questions exist, seed them first
                        from adls.seed_adl_questions import seed_adl_questions
                        seed_adl_questions()
                        standard_questions = ADLQuestion.objects.all().order_by('order')
                    
                    # Create realistic ADL data based on total care time
                    # Instead of distributing evenly, create realistic activity patterns
                    questions_count = standard_questions.count()
                    if questions_count > 0:
                        # Define realistic activity patterns (minutes per activity, frequency per day)
                        activity_patterns = [
                            {'minutes': 15, 'frequency': 2},   # Personal hygiene
                            {'minutes': 5, 'frequency': 8},    # Safety checks
                            {'minutes': 3, 'frequency': 12},   # Call lights
                            {'minutes': 10, 'frequency': 3},   # Communication
                            {'minutes': 8, 'frequency': 4},    # Behavioral monitoring
                            {'minutes': 8, 'frequency': 4},    # Physical monitoring
                            {'minutes': 20, 'frequency': 2},   # Leisure activities
                            {'minutes': 12, 'frequency': 3},   # Non-drug interventions
                            {'minutes': 15, 'frequency': 6},   # Cognitive cueing
                            {'minutes': 25, 'frequency': 2},   # Treatments
                            {'minutes': 10, 'frequency': 3},   # Pain management
                            {'minutes': 8, 'frequency': 4},    # Medication
                            {'minutes': 30, 'frequency': 3},   # Eating assistance
                            {'minutes': 15, 'frequency': 4},   # Ambulation
                            {'minutes': 10, 'frequency': 6},   # Repositioning
                            {'minutes': 20, 'frequency': 3},   # Transfers
                            {'minutes': 45, 'frequency': 1},   # Bathing
                            {'minutes': 15, 'frequency': 4},   # Bowel/bladder
                            {'minutes': 20, 'frequency': 2},   # Dressing
                            {'minutes': 15, 'frequency': 2},   # Grooming
                            {'minutes': 30, 'frequency': 1},   # Housekeeping
                            {'minutes': 10, 'frequency': 2},   # Additional care
                        ]
                        
                        # Calculate total expected minutes from patterns
                        total_expected = sum(pattern['minutes'] * pattern['frequency'] for pattern in activity_patterns)
                        
                        # Scale patterns to match total care time from CSV
                        scale_factor = total_minutes / total_expected if total_expected > 0 else 1
                        
                        for i, adl_question in enumerate(standard_questions):
                            if i < len(activity_patterns):
                                pattern = activity_patterns[i]
                                # Scale the pattern to match total care time
                                scaled_minutes = int(pattern['minutes'] * scale_factor)
                                scaled_frequency = max(1, int(pattern['frequency'] * scale_factor))
                                
                                # Calculate total minutes for this activity
                                activity_total_minutes = scaled_minutes * scaled_frequency
                                
                                # Create realistic per-day shift times distribution
                                # Distribute based on typical care patterns
                                question_per_day_shift_times = {}
                                for col in per_day_shift_cols:
                                    # Use original shift times but scale for this activity
                                    original_value = per_day_shift_times.get(col, 0)
                                    # Distribute based on activity type and frequency
                                    if 'Shift1' in col:  # Day shift - most activities
                                        question_per_day_shift_times[col] = max(1, original_value // (questions_count * 2))
                                    elif 'Shift2' in col:  # Swing shift - moderate activities
                                        question_per_day_shift_times[col] = max(0, original_value // (questions_count * 4))
                                    else:  # NOC shift - minimal activities
                                        question_per_day_shift_times[col] = max(0, original_value // (questions_count * 8))
                                
                                # Update or create ADL entry for this specific question
                                adl, created = ADL.objects.update_or_create(
                                    resident=current_resident,
                                    adl_question=adl_question,
                                    defaults={
                                        'question_text': adl_question.text,
                                        'minutes': scaled_minutes,
                                        'frequency': scaled_frequency,
                                        'total_minutes': activity_total_minutes,
                                        'total_hours': float(activity_total_minutes) / 60 if activity_total_minutes else 0,
                                        'status': row.get('Status', 'Complete'),
                                        'per_day_shift_times': question_per_day_shift_times,
                                    }
                                )
                            else:
                                # Fallback for any additional questions
                                fallback_minutes = max(5, total_minutes // (questions_count * 2))
                                fallback_frequency = max(1, total_minutes // (questions_count * fallback_minutes))
                                
                                adl, created = ADL.objects.update_or_create(
                                    resident=current_resident,
                                    adl_question=adl_question,
                                    defaults={
                                        'question_text': adl_question.text,
                                        'minutes': fallback_minutes,
                                        'frequency': fallback_frequency,
                                        'total_minutes': fallback_minutes * fallback_frequency,
                                        'total_hours': float(fallback_minutes * fallback_frequency) / 60,
                                        'status': row.get('Status', 'Complete'),
                                        'per_day_shift_times': {},
                                    }
                                )
                            
                            if created:
                                created_adls += 1
                            else:
                                updated_adls += 1
                            
                            # Create WeeklyADLEntry for this specific week
                            # Convert per_day_shift_times to per_day_data format
                            per_day_data = {}
                            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                            day_prefixes = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun']
                            shift_map = {'Shift1': 'Day', 'Shift2': 'Swing', 'Shift3': 'NOC'}
                            
                            for day_idx, day in enumerate(days):
                                day_prefix = day_prefixes[day_idx]
                                day_data = {}
                                for shift_num, shift_name in shift_map.items():
                                    col = f'{day_prefix}{shift_num}Time'
                                    day_data[shift_name] = question_per_day_shift_times.get(col, 0)
                                per_day_data[day] = day_data
                            
                            # Check for existing entry (including soft-deleted) to ensure overwriting
                            existing_entry = WeeklyADLEntry.objects.filter(
                                resident=current_resident,
                                adl_question=adl_question,
                                week_start_date=week_start_normalized
                            ).first()
                            
                            if existing_entry:
                                # If soft-deleted, restore it
                                if existing_entry.is_deleted:
                                    existing_entry.is_deleted = False
                                    existing_entry.deleted_at = None
                                
                                # Update all fields to overwrite existing data
                                existing_entry.week_end_date = week_end_normalized
                                existing_entry.question_text = adl_question.text
                                existing_entry.minutes_per_occurrence = scaled_minutes
                                existing_entry.frequency_per_week = scaled_frequency
                                existing_entry.total_minutes_week = activity_total_minutes
                                existing_entry.total_hours_week = float(activity_total_minutes) / 60 if activity_total_minutes else 0
                                existing_entry.per_day_data = per_day_data
                                existing_entry.status = 'complete'
                                existing_entry.updated_by = request.user if request.user.is_authenticated else None
                                existing_entry.save()
                                weekly_created = False
                                weekly_entry = existing_entry
                            else:
                                # Create new entry
                                weekly_entry = WeeklyADLEntry.objects.create(
                                    resident=current_resident,
                                    adl_question=adl_question,
                                    week_start_date=week_start_normalized,
                                    week_end_date=week_end_normalized,
                                    question_text=adl_question.text,
                                    minutes_per_occurrence=scaled_minutes,
                                    frequency_per_week=scaled_frequency,
                                    total_minutes_week=activity_total_minutes,
                                    total_hours_week=float(activity_total_minutes) / 60 if activity_total_minutes else 0,
                                    per_day_data=per_day_data,
                                    status='complete',
                                    created_by=request.user if request.user.is_authenticated else None,
                                    updated_by=request.user if request.user.is_authenticated else None,
                                )
                                weekly_created = True
                            
                            if weekly_created:
                                print(f"Created WeeklyADLEntry for {current_resident.name} - {adl_question.text[:30]}... (Week: {week_start} to {week_end})")
                            else:
                                print(f"Updated WeeklyADLEntry for {current_resident.name} - {adl_question.text[:30]}... (Week: {week_start} to {week_end})")
                    else:
                        # Fallback: create a single aggregated ADL record
                        default_question_text = "Total caregiving time for resident"
                        adl_question, _ = ADLQuestion.objects.get_or_create(
                            text=default_question_text,
                            defaults={'order': 999}
                        )
                        
                        adl, created = ADL.objects.update_or_create(
                            resident=current_resident,
                            adl_question=adl_question,
                            defaults={
                                'question_text': default_question_text,
                                'minutes': total_minutes,
                                'frequency': 1,
                                'total_minutes': total_minutes,
                                'total_hours': total_hours,
                                'status': row.get('Status', 'Complete'),
                                'per_day_shift_times': per_day_shift_times,
                            }
                        )
                        
                        if created:
                            created_adls += 1
                        else:
                            updated_adls += 1
                        
                        # Create WeeklyADLEntry for fallback case
                        # Convert per_day_shift_times to per_day_data format
                        per_day_data = {}
                        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                        day_prefixes = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun']
                        shift_map = {'Shift1': 'Day', 'Shift2': 'Swing', 'Shift3': 'NOC'}
                        
                        for day_idx, day in enumerate(days):
                            day_prefix = day_prefixes[day_idx]
                            day_data = {}
                            for shift_num, shift_name in shift_map.items():
                                col = f'{day_prefix}{shift_num}Time'
                                day_data[shift_name] = per_day_shift_times.get(col, 0)
                            per_day_data[day] = day_data
                        
                        # Check for existing entry (including soft-deleted) to ensure overwriting
                        existing_entry = WeeklyADLEntry.objects.filter(
                            resident=current_resident,
                            adl_question=adl_question,
                            week_start_date=week_start_normalized
                        ).first()
                        
                        if existing_entry:
                            # If soft-deleted, restore it
                            if existing_entry.is_deleted:
                                existing_entry.is_deleted = False
                                existing_entry.deleted_at = None
                            
                            # Update all fields to overwrite existing data
                            existing_entry.week_end_date = week_end_normalized
                            existing_entry.question_text = default_question_text
                            existing_entry.minutes_per_occurrence = total_minutes
                            existing_entry.frequency_per_week = 1
                            existing_entry.total_minutes_week = total_minutes
                            existing_entry.total_hours_week = total_hours
                            existing_entry.per_day_data = per_day_data
                            existing_entry.status = 'complete'
                            existing_entry.updated_by = request.user if request.user.is_authenticated else None
                            existing_entry.save()
                            weekly_created = False
                            weekly_entry = existing_entry
                        else:
                            # Create new entry
                            weekly_entry = WeeklyADLEntry.objects.create(
                                resident=current_resident,
                                adl_question=adl_question,
                                week_start_date=week_start_normalized,
                                week_end_date=week_end_normalized,
                                question_text=default_question_text,
                                minutes_per_occurrence=total_minutes,
                                frequency_per_week=1,
                                total_minutes_week=total_minutes,
                                total_hours_week=total_hours,
                                per_day_data=per_day_data,
                                status='complete',
                                created_by=request.user if request.user.is_authenticated else None,
                                updated_by=request.user if request.user.is_authenticated else None,
                            )
                            weekly_created = True
                        
                        if weekly_created:
                            print(f"Created WeeklyADLEntry (fallback) for {resident_name} (Week: {week_start} to {week_end})")
                        else:
                            print(f"Updated WeeklyADLEntry (fallback) for {resident_name} (Week: {week_start} to {week_end})")
                    
                    # IMPORTANT: Do NOT update resident.total_shift_times - all imports must be week-specific
                    # WeeklyADLEntry records are created with the specific week_start_date
                    # This ensures data only appears for the selected week, not all weeks
                    if week_start_date:
                        print(f"Skipped updating resident.total_shift_times for {resident_name} (week-specific import: {week_start})")
                    else:
                        print(f"WARNING: No week_start_date provided for {resident_name} - WeeklyADLEntry records will use current week")
                    
                    print(f"Row {index}: Processed resident '{resident_name}' with {total_minutes} total minutes")
                    
                except Exception as e:
                    print(f"Error processing row {index}: {e}")
                    continue
        else:
            # Handle ADL-based CSV format (original logic)
            print("Processing ADL-based CSV format...")
            current_resident = None
            
            for index, row in df.iterrows():
                try:
                    # Check if this is a new resident (Name or ResidentName is not blank)
                    resident_name = row.get('Name', row.get('ResidentName', ''))
                    if pd.isna(resident_name):
                        resident_name = ''
                    else:
                        resident_name = str(resident_name).strip()
                    
                    if resident_name:  # New resident block starts
                        # Get facility by FacilityID or name (do NOT create)
                        facility_id = row.get('FacilityID', '')
                        if pd.isna(facility_id):
                            facility_id = ''
                        else:
                            facility_id = str(facility_id).strip()
                        facility_name = row.get('FacilityName', '')
                        if pd.isna(facility_name):
                            facility_name = ''
                        else:
                            facility_name = str(facility_name).strip()
                        from residents.models import Facility
                        facility = None
                        
                        # Try to find facility by ID first
                        if facility_id:
                            try:
                                facility = Facility.objects.get(facility_id=facility_id)
                            except Facility.DoesNotExist:
                                # Try alternative ID mappings for Murray Highland
                                if facility_id == '50R460':
                                    try:
                                        facility = Facility.objects.get(name__iexact='Murray Highland')
                                    except Facility.DoesNotExist:
                                        pass
                                pass
                        
                        # If not found by ID, try by name with flexible matching
                        if not facility and facility_name:
                            # Try exact match first
                            try:
                                facility = Facility.objects.get(name__iexact=facility_name)
                            except Facility.DoesNotExist:
                                pass
                            
                            # If still not found, try partial matching for common variations
                            if not facility:
                                # Handle common variations like "Murray Highland" vs "Murray Highland Care" etc.
                                facility_name_clean = facility_name.lower().replace('care', '').replace('center', '').replace('facility', '').strip()
                                try:
                                    facility = Facility.objects.filter(name__icontains=facility_name_clean).first()
                                except:
                                    pass
                        
                        if not facility:
                            print(f"Row {index}: Facility not found for FacilityID '{facility_id}' or name '{facility_name}'. Skipping row.")
                            print(f"Available facilities: {list(Facility.objects.values_list('name', 'facility_id'))}")
                            continue  # Skip this row if facility not found
                        else:
                            print(f"Row {index}: Found facility '{facility.name}' (ID: {facility.facility_id}) for CSV data: FacilityID='{facility_id}', FacilityName='{facility_name}'")
                        # Get or create section under this facility
                        section_name = row.get('FacilitySectionName', row.get('Section', 'Memory Care Residents'))
                        if pd.isna(section_name):
                            section_name = 'Memory Care Residents'
                        else:
                            section_name = str(section_name).strip()
                        from residents.models import FacilitySection
                        facility_section, _ = FacilitySection.objects.get_or_create(
                            name=section_name,
                            facility=facility
                        )
                        
                        # Get or create resident (always look up by name, section, and facility, ignoring case/whitespace)
                        resident_name_clean = resident_name.strip().lower()
                        section_name_clean = section_name.strip().lower()
                        facility_id_clean = facility_id.strip().lower()

                        from residents.models import Resident, FacilitySection, Facility
                        
                        # Use the facility we already found above, don't create a new one
                        if not facility:
                            print(f"Row {index}: Facility not found for FacilityID '{facility_id}' or name '{facility_name}'. Skipping row.")
                            continue
                        
                        try:
                            facility_section = FacilitySection.objects.get(name__iexact=section_name_clean, facility=facility)
                            current_resident = Resident.objects.get(name__iexact=resident_name_clean, facility_section=facility_section)
                        except (FacilitySection.DoesNotExist, Resident.DoesNotExist):
                            # Only create section and resident, not facility
                            facility_section, _ = FacilitySection.objects.get_or_create(
                                name=section_name,
                                facility=facility,
                                defaults={}
                            )
                            current_resident, _ = Resident.objects.get_or_create(
                                name=resident_name,
                                facility_section=facility_section,
                                defaults={
                                    'status': row.get('Status', row.get('ResidentStatus', 'Active')),
                                }
                            )
                        
                        # Prepare per-day/shift times dict for this specific ADL
                        per_day_shift_times = {}
                        for col in per_day_shift_cols:
                            if col in df.columns:
                                value = row.get(col, 0)
                                # Convert to int, handle NaN/None
                                if pd.isna(value) or value is None:
                                    value = 0
                                per_day_shift_times[col] = int(value)
                        
                        # Calculate totals from per-day/shift times
                        total_per_day_shift = sum(per_day_shift_times.values())
                        
                        # Get question text and other fields
                        question_text = row.get('QuestionText', '')
                        if pd.isna(question_text):
                            question_text = ''
                        else:
                            question_text = str(question_text).strip()
                        
                        if not question_text:
                            continue  # Skip rows without question text
                        
                        # Find the ADLQuestion object
                        adl_question = ADLQuestion.objects.filter(text__iexact=question_text).first()
                        if not adl_question:
                            print(f"Row {index}: ADLQuestion not found for '{question_text}'. Skipping row.")
                            continue  # Skip if master question not found
                        
                        # Get task time and frequency - try multiple possible column names
                        task_time = 0
                        task_time_column_names = [
                            'TaskTime', 'Task Time', 'Time', 'Minutes', 'Min', 
                            'TimePerTask', 'Time Per Task', 'MinutesPerTask', 'Minutes Per Task',
                            'TaskMinutes', 'Task Minutes', 'Duration', 'MinPerTask', 'Min Per Task'
                        ]
                        
                        for col_name in task_time_column_names:
                            if col_name in df.columns:
                                value = row.get(col_name, 0)
                                if pd.isna(value) or value is None:
                                    continue
                                try:
                                    task_time = float(value)
                                    if task_time > 0:
                                        print(f"Row {index}: Found task time '{task_time}' from column '{col_name}'")
                                        break
                                except (ValueError, TypeError):
                                    continue
                        
                        if task_time == 0:
                            print(f"Row {index}: WARNING - No task time found. Available columns: {list(df.columns)}")
                        
                        total_frequency = row.get('TotalFrequency', 0)
                        if pd.isna(total_frequency) or total_frequency is None:
                            total_frequency = 0
                        
                        # Set total_minutes to sum of all per-day/shift times
                        total_minutes = total_per_day_shift
                        total_hours = float(total_minutes) / 60 if total_minutes else 0
                        
                        # Update or create ADL entry
                        adl, created = ADL.objects.update_or_create(
                            resident=current_resident,
                            adl_question=adl_question,
                            defaults={
                                'question_text': question_text,  # for legacy/compat
                                'minutes': int(task_time),
                                'frequency': int(total_frequency),
                                'total_minutes': int(total_minutes),
                                'total_hours': total_hours,
                                'status': row.get('ResidentStatus', 'Active'),
                                'per_day_shift_times': per_day_shift_times,
                            }
                        )
                        
                        if created:
                            created_adls += 1
                        else:
                            updated_adls += 1
                        
                except Exception as e:
                    # Log the error but continue processing other rows
                    error_msg = f"Error processing row {index}: {e}"
                    print(error_msg)
                    import traceback
                    traceback.print_exc()
                    error_rows.append({'row': index, 'error': str(e)})
                    skipped_rows += 1
                    continue
        
        total_processed = created_adls + updated_adls
        if total_processed == 0:
            error_details = {
                    'created_residents': created_residents,
                    'created_adls': created_adls,
                    'updated_adls': updated_adls,
                'created_weekly_entries': created_weekly_entries,
                'updated_weekly_entries': updated_weekly_entries,
                'total_processed': total_processed,
                'skipped_rows': skipped_rows,
                'total_rows_in_file': len(df),
                'error_rows': error_rows[:10]  # First 10 errors
            }
            return Response({
                'error': f'No ADL data was processed. {skipped_rows} rows were skipped. Please check: 1) The file format matches the expected columns (QuestionText, ResidentName, etc.), 2) A facility_id was provided in the upload request, 3) The CSV file contains valid data rows. Check backend logs for details.',
                'details': error_details
            }, status=status.HTTP_400_BAD_REQUEST)
        
        total_weekly_entries = created_weekly_entries + updated_weekly_entries
        return Response({
            'message': f'Import completed successfully! Created {created_adls} ADL records ({updated_adls} updated) and {created_weekly_entries} WeeklyADLEntry records ({updated_weekly_entries} updated) for charts. Total: {total_processed} ADL records, {total_weekly_entries} WeeklyADLEntry records.',
            'details': {
                'created_residents': created_residents,
                'created_adls': created_adls,
                'updated_adls': updated_adls,
                'created_weekly_entries': created_weekly_entries,
                'updated_weekly_entries': updated_weekly_entries,
                'total_processed': total_processed,
                'total_weekly_entries': total_weekly_entries
            }
        })

    @action(detail=False, methods=['get'], url_path='grouped_by_resident', permission_classes=[AllowAny])
    def grouped_by_resident(self, request):
        # Get all residents with at least one ADL
        from residents.models import Resident
        residents = Resident.objects.filter(adls__isnull=False).distinct()
        grouped = []
        for resident in residents:
            adls = self.queryset.filter(resident=resident)
            adl_data = ADLSerializer(adls, many=True).data
            resident_data = ResidentSerializer(resident).data
            grouped.append({
                'resident': resident_data,
                'adls': adl_data
            })
        return Response(grouped)

    @action(detail=False, methods=['get'])
    def by_facility(self, request):
        """Get all ADLs for a facility"""
        facility_id = request.query_params.get('facility_id')
        if not facility_id:
            return Response({'error': 'facility_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get all residents in the facility
        from residents.models import Resident, FacilitySection
        sections = FacilitySection.objects.filter(facility_id=facility_id)
        residents = Resident.objects.filter(facility_section__in=sections)
        
        # Get all ADLs for those residents
        adls = self.get_queryset().filter(resident__in=residents)
        
        serializer = self.get_serializer(adls, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='questions', permission_classes=[AllowAny])
    def list_questions(self, request):
        """Return the full list of ADLQuestions, ordered."""
        questions = ADLQuestion.objects.all().order_by('order', 'id')
        serializer = ADLQuestionSerializer(questions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='seed', permission_classes=[AllowAny])
    def seed_questions(self, request):
        """Manually seed ADL questions"""
        from .seed_adl_questions import seed_adl_questions
        try:
            seed_adl_questions()
            questions = ADLQuestion.objects.all().order_by('order', 'id')
            serializer = ADLQuestionSerializer(questions, many=True)
            return Response({
                'message': f'Successfully seeded {questions.count()} ADL questions',
                'questions': serializer.data
            })
        except Exception as e:
            return Response({
                'error': f'Failed to seed questions: {str(e)}'
            }, status=500)

    def perform_create(self, serializer):
        data = serializer.validated_data
        minutes = data.get('minutes', 0)
        frequency = data.get('frequency', 0)
        per_day_shift_times = data.get('per_day_shift_times', {})
        per_day_shift_total = sum(int(v) for v in per_day_shift_times.values() if v)
        if per_day_shift_total > 0:
            total_minutes = per_day_shift_total
        else:
            total_minutes = minutes * frequency
        total_hours = float(total_minutes) / 60 if total_minutes else 0
        serializer.save(
            total_minutes=total_minutes,
            total_hours=total_hours,
            created_by=self.request.user,
            updated_by=self.request.user
        )

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        from residents.models import Resident, FacilitySection
        from users.models import FacilityAccess
        from datetime import datetime, timedelta
        
        # Get parameters
        week_start_date = request.query_params.get('week_start_date')
        facility_id = request.query_params.get('facility_id')
        resident_id = request.query_params.get('resident_id')
        
        if not week_start_date:
            return Response({'error': 'week_start_date is required'}, status=400)
        
        # Parse week start date
        try:
            current_week = datetime.strptime(week_start_date, '%Y-%m-%d').date()
            previous_week = current_week - timedelta(days=7)
        except ValueError:
            return Response({'error': 'Invalid week_start_date format. Use YYYY-MM-DD'}, status=400)
        
        # Allow analytics for any week - compare with previous week
        # If requesting Sept 21-27, 2025, use legacy ADL data
        # For other weeks, use WeeklyADLEntry data
        
        # Get ADL data for current week
        user = request.user
        
        # Check if this is the legacy week (Sept 21-27, 2025)
        if current_week == datetime(2025, 9, 21).date():
            # Use legacy ADL data for current week
            if user.is_staff or getattr(user, 'role', None) in ['superadmin', 'admin']:
                current_adls = ADL.objects.filter(is_deleted=False)
            else:
                # Get approved facility IDs for this user
                approved_facility_ids = FacilityAccess.objects.filter(
                    user=user,
                    status='approved'
                ).values_list('facility_id', flat=True)

                # Get all sections in those facilities
                allowed_sections = FacilitySection.objects.filter(facility_id__in=approved_facility_ids)

                # Get all residents in those sections
                allowed_residents = Resident.objects.filter(facility_section__in=allowed_sections)

                # Only ADLs for allowed residents
                current_adls = ADL.objects.filter(resident__in=allowed_residents, is_deleted=False)
            
            # Filter by facility if specified
            if facility_id:
                sections = FacilitySection.objects.filter(facility_id=facility_id)
                residents = Resident.objects.filter(facility_section__in=sections)
                current_adls = current_adls.filter(resident__in=residents)
            
            # Filter by resident if specified
            if resident_id:
                current_adls = current_adls.filter(resident_id=resident_id)
            
            # Convert ADL objects to analytics format
            current_week_data = self._convert_adl_to_analytics_format(current_adls)
        else:
            # Use WeeklyADLEntry data for other weeks
            weekly_entries = WeeklyADLEntry.objects.filter(
                week_start_date=current_week,
                status='complete'
            )
            
            # Filter by facility if specified
            if facility_id:
                sections = FacilitySection.objects.filter(facility_id=facility_id)
                residents = Resident.objects.filter(facility_section__in=sections)
                weekly_entries = weekly_entries.filter(resident__in=residents)
            
            # Filter by resident if specified
            if resident_id:
                weekly_entries = weekly_entries.filter(resident_id=resident_id)
            
            # Convert WeeklyADLEntry objects to analytics format
            current_week_data = self._convert_weekly_entry_to_analytics_format(weekly_entries)
        
        # Get previous week data
        previous_week_data = self._get_previous_week_data(previous_week, user, facility_id, resident_id)
        
        # Calculate analytics
        analytics = self._calculate_analytics(current_week_data, previous_week_data, current_week, previous_week)
        
        return Response(analytics)
    
    def _convert_adl_to_analytics_format(self, adls):
        """Convert ADL objects to analytics format"""
        analytics_data = {}
        for adl in adls:
            analytics_data[adl.id] = {
                'minutes': adl.minutes,
                'frequency': adl.frequency,
                'per_day_shift_times': adl.per_day_shift_times or {},
                'resident_id': adl.resident_id,
                'adl_question_id': adl.adl_question_id
            }
        return analytics_data
    
    def _convert_weekly_entry_to_analytics_format(self, weekly_entries):
        """Convert WeeklyADLEntry objects to analytics format"""
        analytics_data = {}
        for entry in weekly_entries:
            analytics_data[entry.id] = {
                'minutes': entry.minutes_per_occurrence,
                'frequency': entry.frequency_per_week,
                'per_day_shift_times': entry.per_day_data or {},
                'resident_id': entry.resident_id,
                'adl_question_id': entry.adl_question_id
            }
        return analytics_data
    
    def _get_previous_week_data(self, previous_week, user, facility_id, resident_id):
        """Get previous week data for comparison"""
        from .models import ADL, WeeklyADLEntry
        
        # Check if previous week is the legacy week (Sept 21-27, 2025)
        if previous_week == datetime(2025, 9, 21).date():
            # Use legacy ADL data for previous week
            if user.is_staff or getattr(user, 'role', None) in ['superadmin', 'admin']:
                previous_adls = ADL.objects.filter(is_deleted=False)
            else:
                # Get approved facility IDs for this user
                approved_facility_ids = FacilityAccess.objects.filter(
                    user=user,
                    status='approved'
                ).values_list('facility_id', flat=True)

                # Get all sections in those facilities
                allowed_sections = FacilitySection.objects.filter(facility_id__in=approved_facility_ids)

                # Get all residents in those sections
                allowed_residents = Resident.objects.filter(facility_section__in=allowed_sections)

                # Only ADLs for allowed residents
                previous_adls = ADL.objects.filter(resident__in=allowed_residents, is_deleted=False)
            
            # Filter by facility if specified
            if facility_id:
                sections = FacilitySection.objects.filter(facility_id=facility_id)
                residents = Resident.objects.filter(facility_section__in=sections)
                previous_adls = previous_adls.filter(resident__in=residents)
            
            # Filter by resident if specified
            if resident_id:
                previous_adls = previous_adls.filter(resident_id=resident_id)
            
            return self._convert_adl_to_analytics_format(previous_adls)
        else:
            # Use WeeklyADLEntry data for previous week
            weekly_entries = WeeklyADLEntry.objects.filter(
                week_start_date=previous_week,
                status='complete'
            )
            
            # Filter by facility if specified
            if facility_id:
                sections = FacilitySection.objects.filter(facility_id=facility_id)
                residents = Resident.objects.filter(facility_section__in=sections)
                weekly_entries = weekly_entries.filter(resident__in=residents)
            
            # Filter by resident if specified
            if resident_id:
                weekly_entries = weekly_entries.filter(resident_id=resident_id)
            
            return self._convert_weekly_entry_to_analytics_format(weekly_entries)
    
    def _calculate_analytics(self, current_adls, previous_week_data, current_week, previous_week):
        """Calculate analytics comparing current and previous week"""
        
        # Calculate totals for current week
        current_total_hours = sum(
            (adl.minutes * adl.frequency) / 60.0 for adl in current_adls
        )
        
        # Calculate totals for previous week (simulated)
        previous_total_hours = sum(
            (data['minutes'] * data['frequency']) / 60.0 
            for data in previous_week_data.values()
        )
        
        # Calculate changes
        total_hours_change = current_total_hours - previous_total_hours
        
        # Calculate other metrics
        current_completed_adls = len(current_adls)
        previous_completed_adls = len(previous_week_data)
        completed_adls_change = current_completed_adls - previous_completed_adls
        
        # Calculate average ADL scores (simplified)
        current_avg_score = current_total_hours / max(current_completed_adls, 1)
        previous_avg_score = previous_total_hours / max(previous_completed_adls, 1)
        avg_score_change = current_avg_score - previous_avg_score
        
        # Count unique residents
        current_residents = len(set(adl.resident_id for adl in current_adls))
        previous_residents = len(set(data.get('resident_id', 0) for data in previous_week_data.values()))
        residents_change = current_residents - previous_residents
        
        # Create daily trends (simplified)
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        daily_trends = []
        
        for i, day in enumerate(days):
            # Simulate daily variations
            current_day_hours = current_total_hours / 7 * (0.8 + (i * 0.05))
            previous_day_hours = previous_total_hours / 7 * (0.8 + (i * 0.05))
            
            daily_trends.append({
                'day': day[:3],  # Mon, Tue, etc.
                'current_week': round(current_day_hours, 1),
                'previous_week': round(previous_day_hours, 1)
            })
        
        # Create ADL category comparison (simplified)
        categories = ['Personal Care', 'Mobility', 'Meals', 'Medication', 'Social']
        adl_categories = []
        
        for category in categories:
            current_category_hours = current_total_hours / len(categories)
            previous_category_hours = previous_total_hours / len(categories)
            
            adl_categories.append({
                'category': category,
                'current_week': round(current_category_hours, 1),
                'previous_week': round(previous_category_hours, 1)
            })
        
        # Create top improvements and areas needing attention
        top_improvements = []
        areas_needing_attention = []
        
        for category in categories[:3]:  # Top 3 for each
            change = (current_total_hours / len(categories)) - (previous_total_hours / len(categories))
            
            if change > 0:
                top_improvements.append({
                    'category': category,
                    'change': change
                })
            else:
                areas_needing_attention.append({
                    'category': category,
                    'change': abs(change)
                })
        
        return {
            'current_week': current_week.isoformat(),
            'previous_week': previous_week.isoformat(),
            'total_hours': {
                'current': current_total_hours,
                'previous': previous_total_hours,
                'change': total_hours_change
            },
            'completed_adls': {
                'current': current_completed_adls,
                'previous': previous_completed_adls,
                'change': completed_adls_change
            },
            'avg_adl_score': {
                'current': current_avg_score,
                'previous': previous_avg_score,
                'change': avg_score_change
            },
            'residents_assessed': {
                'current': current_residents,
                'previous': previous_residents,
                'change': residents_change
            },
            'daily_trends': daily_trends,
            'adl_categories': adl_categories,
            'top_improvements': top_improvements[:3],
            'areas_needing_attention': areas_needing_attention[:3]
        }
    
    def _calculate_caregiving_summary_from_weekly_entries(self, weekly_entries, facility=None):
        """Calculate caregiving summary from WeeklyADLEntry data"""
        # Get facility from first entry if not provided
        if not facility and weekly_entries:
            try:
                facility = weekly_entries[0].resident.facility_section.facility
            except:
                pass
        
        # Get shift mapping and names based on facility format
        shift_mapping = self.get_shift_mapping(facility)
        shift_names = self.get_shift_names_for_format(facility)
        
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        # Initialize per_shift with dynamic shift names
        per_shift = [
            {**{'day': day}, **{shift: 0 for shift in shift_names}} for day in days
        ]
        
        # IMPORTANT: Use total_minutes_week as the source of truth, then distribute by per_day_data ratios
        # This avoids double-counting and ensures we match Oregon's calculation
        from collections import defaultdict
        resident_totals = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
        
        # Track unique entries to avoid duplicates
        seen_entries = set()
        entry_count = 0
        sample_entry_data = None
        total_from_per_day_data = 0
        total_from_total_minutes_week = 0
        
        for entry in weekly_entries:
            entry_key = (entry.resident_id, entry.adl_question_id, entry.week_start_date)
            if entry_key in seen_entries:
                continue
            seen_entries.add(entry_key)
            entry_count += 1
            
            # Store sample entry for debugging
            if sample_entry_data is None and entry.per_day_data:
                sample_entry_data = {
                    'resident': entry.resident.name,
                    'question': entry.question_text[:50],
                    'minutes_per_occurrence': entry.minutes_per_occurrence,
                    'frequency_per_week': entry.frequency_per_week,
                    'total_minutes_week': entry.total_minutes_week,
                    'per_day_data_sample': dict(list(entry.per_day_data.items())[:3]) if entry.per_day_data else None
                }
            
            resident_id = entry.resident_id
            per_day_data = entry.per_day_data or {}
            total_minutes_week = entry.total_minutes_week or 0
            
            # If total_minutes_week is 0 but we have per_day_data, recalculate from per_day_data
            # NOTE: per_day_data contains FREQUENCIES, so we need to convert to minutes
            if total_minutes_week == 0 and per_day_data:
                minutes_per_occurrence = entry.minutes_per_occurrence or 0
                if minutes_per_occurrence > 0:
                    # Sum all frequencies from per_day_data and convert to minutes
                    total_frequency = sum(float(v) for v in per_day_data.values() if v)
                    total_minutes_week = total_frequency * minutes_per_occurrence
                    if total_minutes_week > 0:
                        print(f"DEBUG: Recalculated total_minutes_week from per_day_data frequencies for {entry.resident.name} - {entry.question_text[:30]}: {total_frequency} frequencies * {minutes_per_occurrence} min = {total_minutes_week} minutes")
            
            total_from_total_minutes_week += total_minutes_week
            
            # Calculate distribution ratios from per_day_data
            # IMPORTANT: per_day_data contains FREQUENCIES, not minutes
            # We need to convert frequencies to minutes: frequency * minutes_per_occurrence
            old_format_days = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun']
            old_format_shifts = ['Shift1Time', 'Shift2Time', 'Shift3Time']
            # Use dynamic shift mapping based on facility format
            shift_mapping_for_entry = self.get_shift_mapping(facility)
            shift_names_for_entry = self.get_shift_names_for_format(facility)
            minutes_per_occurrence = entry.minutes_per_occurrence or 0
            
            # Convert per_day_data frequencies to minutes and calculate distribution
            total_per_day_data_minutes = 0
            day_shift_values = {}
            
            if per_day_data and any(any(key.startswith(day) for key in per_day_data.keys()) for day in old_format_days):
                for i, day_prefix in enumerate(old_format_days):
                    day = days[i]
                    day_shift_values[day] = {}
                    for j, shift_suffix in enumerate(old_format_shifts):
                        key = f"{day_prefix}{shift_suffix}"
                        frequency = float(per_day_data.get(key, 0))
                        # Convert frequency to minutes: frequency * minutes_per_occurrence
                        minutes_for_shift = frequency * minutes_per_occurrence
                        # Map Shift1/Shift2/Shift3 to actual shift names based on facility format
                        shift_key = shift_suffix.replace('Time', '')  # 'Shift1Time' -> 'Shift1'
                        shift_name = shift_mapping_for_entry.get(shift_key)
                        # Only add if shift_name is not None (Shift3 might be None for 2-shift format)
                        if shift_name:
                            # Accumulate if multiple shifts map to same name (e.g., Shift1 and Shift2 both -> Day)
                            if shift_name in day_shift_values[day]:
                                day_shift_values[day][shift_name] += minutes_for_shift
                            else:
                                day_shift_values[day][shift_name] = minutes_for_shift
                            total_per_day_data_minutes += minutes_for_shift
                
                total_from_per_day_data += total_per_day_data_minutes
                
                # If calculated minutes from per_day_data match total_minutes_week, use them directly
                # Otherwise, distribute total_minutes_week proportionally
                if total_per_day_data_minutes > 0 and abs(total_per_day_data_minutes - total_minutes_week) < 1:
                    # per_day_data calculated minutes match total_minutes_week - use them directly
                    for day, shift_data in day_shift_values.items():
                        for shift_name, value in shift_data.items():
                            resident_totals[resident_id][day][shift_name] += value
                else:
                    # Distribute total_minutes_week proportionally based on per_day_data frequency ratios
                    if total_per_day_data_minutes > 0:
                        ratio = total_minutes_week / total_per_day_data_minutes
                        for day, shift_data in day_shift_values.items():
                            for shift_name, value in shift_data.items():
                                resident_totals[resident_id][day][shift_name] += value * ratio
                    else:
                        # No per_day_data - distribute evenly across week
                        # For 2-shift format, distribute between Day and NOC
                        # For 3-shift format, default to Day shift
                        minutes_per_day = total_minutes_week / 7.0
                        for day in days:
                            if facility and facility.is_2_shift_format:
                                # For 2-shift: split between Day (60%) and NOC (40%)
                                resident_totals[resident_id][day]['Day'] += minutes_per_day * 0.6
                                resident_totals[resident_id][day]['NOC'] += minutes_per_day * 0.4
                            else:
                                # For 3-shift: default to Day shift
                                resident_totals[resident_id][day]['Day'] += minutes_per_day
        
        if sample_entry_data:
            print(f"DEBUG: Sample entry - Resident: {sample_entry_data['resident']}, Question: {sample_entry_data['question']}")
            print(f"DEBUG: Sample entry - minutes_per_occurrence: {sample_entry_data['minutes_per_occurrence']}, frequency_per_week: {sample_entry_data['frequency_per_week']}, total_minutes_week: {sample_entry_data['total_minutes_week']}")
            print(f"DEBUG: Sample entry - per_day_data sample: {sample_entry_data['per_day_data_sample']}")
        
        print(f"DEBUG: Processed {entry_count} unique WeeklyADLEntry records from {len(weekly_entries)} total entries")
        print(f"DEBUG: Aggregated data for {len(resident_totals)} unique residents")
        print(f"DEBUG: Sum of total_minutes_week from all entries: {total_from_total_minutes_week} ({total_from_total_minutes_week/60:.2f} hours)")
        print(f"DEBUG: Sum of per_day_data values: {total_from_per_day_data} ({total_from_per_day_data/60:.2f} hours)")
        print(f"DEBUG: Expected total (Oregon): 452.65 hours = {452.65 * 60} minutes")
        print(f"DEBUG: Difference: {452.65 * 60 - total_from_total_minutes_week:.2f} minutes ({452.65 - total_from_total_minutes_week/60:.2f} hours)")
        
        # Check for entries with 0 total_minutes_week but non-zero per_day_data
        zero_total_but_has_data = []
        for entry in weekly_entries:
            if (entry.total_minutes_week or 0) == 0 and entry.per_day_data:
                per_day_sum = sum(float(v) for v in entry.per_day_data.values() if v)
                if per_day_sum > 0:
                    zero_total_but_has_data.append({
                        'resident': entry.resident.name,
                        'question': entry.question_text[:50],
                        'per_day_sum': per_day_sum
                    })
        if zero_total_but_has_data:
            print(f"DEBUG: Found {len(zero_total_but_has_data)} entries with total_minutes_week=0 but per_day_data > 0:")
            for item in zero_total_but_has_data[:5]:
                print(f"  - {item['resident']}: {item['question']} ({item['per_day_sum']} min)")
        
        # Second pass: sum across all residents to get facility totals
        total_minutes_all = 0
        monday_day_minutes = 0  # Track Monday Day shift specifically for debugging
        monday_residents = []  # Track which residents contribute to Monday
        
        for resident_id, resident_data in resident_totals.items():
            resident_name = None
            for entry in weekly_entries:
                if entry.resident_id == resident_id:
                    resident_name = entry.resident.name
                    break
            
            for i, day in enumerate(days):
                for shift_name in shift_names:  # Use dynamic shift names
                    minutes = resident_data.get(day, {}).get(shift_name, 0)
                    total_minutes_all += minutes
                    hours = minutes / 60.0
                    per_shift[i][shift_name] += hours
                    
                    # Track Monday Day shift for detailed debugging
                    if day == 'Monday' and shift_name == 'Day' and minutes > 0:
                        monday_day_minutes += minutes
                        monday_residents.append({
                            'name': resident_name or f'Resident {resident_id}',
                            'minutes': minutes,
                            'hours': round(hours, 2)
                        })
        
        print(f"DEBUG: Total minutes across all residents/shifts: {total_minutes_all} ({total_minutes_all/60:.2f} hours)")
        print(f"DEBUG: Monday Day shift breakdown: {monday_day_minutes} minutes ({monday_day_minutes/60:.2f} hours)")
        print(f"DEBUG: Monday Day shift contributors (top 10): {monday_residents[:10]}")
        print(f"DEBUG: Monday Day shift from per_shift array: {per_shift[0]['Day']:.2f} hours")
        
        # Round to 2 decimal places
        for s in per_shift:
            for shift in shift_names:  # Use dynamic shift names
                s[shift] = round(s[shift], 2)
        
        per_day = [
            {'day': s['day'], 'hours': round(sum(s[shift] for shift in shift_names), 2)}
            for s in per_shift
        ]
        
        return Response({
            'per_shift': per_shift,
            'per_day': per_day
        })

    @action(detail=False, methods=['get'])
    def caregiving_summary(self, request):
        from residents.models import Resident, FacilitySection, Facility
        from .models import ADL, WeeklyADLEntry
        from users.models import FacilityAccess
        from datetime import datetime, timedelta
        
        # Use the same filtering logic as get_queryset
        user = request.user
        
        # Check for week filtering
        week_start_date = request.query_params.get('week_start_date')
        
        if week_start_date:
            # Parse the week start date
            try:
                week_start = datetime.strptime(week_start_date, '%Y-%m-%d').date()
                
                # IMPORTANT: Normalize week_start to Sunday to match import logic
                # Import normalizes to Sunday, so query must do the same
                days_since_monday = week_start.weekday()  # 0=Monday, 6=Sunday
                if days_since_monday == 6:  # Already Sunday
                    week_start_normalized = week_start
                else:  # Monday-Saturday - go back to Sunday
                    week_start_normalized = week_start - timedelta(days=days_since_monday + 1)
                
                # Filter by facility if specified
                facility_id = request.query_params.get('facility_id')
                residents_query = Resident.objects.all()
                
                if facility_id:
                    from residents.models import Facility, FacilitySection
                    try:
                        facility = Facility.objects.get(id=facility_id)
                        sections = FacilitySection.objects.filter(facility=facility)
                        residents_query = Resident.objects.filter(facility_section__in=sections)
                    except Facility.DoesNotExist:
                        pass  # No facility found, return empty data
                
                # PRIORITY 1: Use WeeklyADLEntry data for the specific week first
                # This ensures week-specific imports only show data for the selected week
                # IMPORTANT: Exclude deleted entries and ensure no duplicates
                # Use select_related to optimize and distinct() to avoid duplicates
                # Use normalized week_start to match what import stored
                weekly_entries = WeeklyADLEntry.objects.filter(
                    week_start_date=week_start_normalized,
                    status='complete',
                    is_deleted=False
                ).select_related('resident', 'adl_question').distinct()
                
                if facility_id:
                    weekly_entries = weekly_entries.filter(resident__in=residents_query)
                
                # If WeeklyADLEntry data exists for this week, use it (week-specific data)
                if weekly_entries.count() > 0:
                    # Check for potential duplicates
                    from django.db.models import Count
                    duplicate_check = weekly_entries.values('resident_id', 'adl_question_id', 'week_start_date').annotate(
                        count=Count('id')
                    ).filter(count__gt=1)
                    
                    if duplicate_check.exists():
                        print(f"WARNING: Found {duplicate_check.count()} duplicate WeeklyADLEntry records! This may cause incorrect totals.")
                        # Remove duplicates by keeping only the most recent entry
                        for dup in duplicate_check:
                            entries = WeeklyADLEntry.objects.filter(
                                resident_id=dup['resident_id'],
                                adl_question_id=dup['adl_question_id'],
                                week_start_date=dup['week_start_date'],
                                is_deleted=False
                            ).order_by('-updated_at')
                            # Keep the first (most recent), soft-delete the rest
                            if entries.count() > 1:
                                for entry in entries[1:]:
                                    entry.is_deleted = True
                                    entry.deleted_at = timezone.now()
                                    entry.save()
                    
                    print(f"DEBUG: Using {weekly_entries.count()} WeeklyADLEntry records for week {week_start_normalized} (normalized from {week_start})")
                    # Re-fetch after potential cleanup
                    weekly_entries = WeeklyADLEntry.objects.filter(
                        week_start_date=week_start_normalized,
                        status='complete',
                        is_deleted=False
                    ).select_related('resident', 'adl_question').distinct()
                    
                    if facility_id:
                        weekly_entries = weekly_entries.filter(resident__in=residents_query)
                    
                    # Get facility for shift format
                    facility = None
                    if facility_id:
                        try:
                            facility = Facility.objects.get(id=facility_id)
                        except Facility.DoesNotExist:
                            pass
                    
                    # Calculate caregiving summary from WeeklyADLEntry data for this specific week
                    return self._calculate_caregiving_summary_from_weekly_entries(weekly_entries, facility)
                
                # FALLBACK: Only use resident.total_shift_times if NO WeeklyADLEntry exists for this week
                # This is for backward compatibility with old data that doesn't have week-specific entries
                print(f"DEBUG: No WeeklyADLEntry found for week {week_start_normalized} (normalized from {week_start}), checking for legacy total_shift_times data")
                
                all_residents = list(residents_query)
                residents_with_times = {}
                for r in all_residents:
                    if r.total_shift_times and len(r.total_shift_times) > 0:
                        # Use name as key to avoid counting duplicates (same name = same person)
                        resident_key = r.name.strip().lower()
                        if resident_key not in residents_with_times:
                            residents_with_times[resident_key] = r
                        else:
                            # If duplicate name, use the one with more data
                            existing = residents_with_times[resident_key]
                            if len(r.total_shift_times) > len(existing.total_shift_times):
                                residents_with_times[resident_key] = r
                
                if residents_with_times:
                    print(f"DEBUG: Using legacy total_shift_times for {len(residents_with_times)} residents (no WeeklyADLEntry for week {week_start})")
                    # Use resident.total_shift_times for accurate chart data (legacy fallback)
                    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                    day_prefixes = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun']
                    
                    # Get facility for shift format
                    facility = None
                    if facility_id:
                        try:
                            facility = Facility.objects.get(id=facility_id)
                        except Facility.DoesNotExist:
                            pass
                    
                    # Get shift mapping based on facility format
                    shift_mapping = self.get_shift_mapping(facility)
                    shift_names = self.get_shift_names_for_format(facility)
                    shift_map = {f'Shift{i}Time': shift_mapping.get(f'Shift{i}') for i in [1, 2, 3] if shift_mapping.get(f'Shift{i}')}
                    
                    per_shift = [
                        {**{'day': day}, **{shift: 0 for shift in shift_names}} for day in days
                    ]
                    
                    total_residents_counted = 0
                    for resident in residents_with_times.values():
                        resident_total_times = resident.total_shift_times or {}
                        if not resident_total_times:
                            continue
                        total_residents_counted += 1
                        for i, prefix in enumerate(day_prefixes):
                            for shift_num, shift_name in shift_map.items():
                                col = f'ResidentTotal{prefix}{shift_num}Time'
                                minutes = resident_total_times.get(col, 0)
                                if isinstance(minutes, (int, float)):
                                    per_shift[i][shift_name] += minutes / 60.0  # convert to hours
                    
                    # Round to 2 decimal places
                    for s in per_shift:
                        for shift in shift_names:
                            s[shift] = round(s[shift], 2)
                    
                    per_day = [
                        {'day': s['day'], 'hours': round(sum(s[shift] for shift in shift_names), 2)}
                        for s in per_shift
                    ]
                    
                    return Response({
                        'per_shift': per_shift,
                        'per_day': per_day
                    })
                
                # If no data at all, return empty data
                print(f"DEBUG: No WeeklyADLEntry or total_shift_times data found for week {week_start}")
                # Get facility for shift format
                facility = None
                if facility_id:
                    try:
                        facility = Facility.objects.get(id=facility_id)
                    except Facility.DoesNotExist:
                        pass
                shift_names = self.get_shift_names_for_format(facility)
                return Response({
                    'per_shift': [{**{'day': day}, **{shift: 0 for shift in shift_names}} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                    'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
                })
                    
            except ValueError:
                # Get facility for shift format
                facility = None
                if facility_id:
                    try:
                        facility = Facility.objects.get(id=facility_id)
                    except Facility.DoesNotExist:
                        pass
                shift_names = self.get_shift_names_for_format(facility)
                return Response({
                    'per_shift': [{**{'day': day}, **{shift: 0 for shift in shift_names}} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                    'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
                })
        
        # Superadmins and admins see all ADLs
        if user.is_staff or getattr(user, 'role', None) in ['superadmin', 'admin']:
            adls = ADL.objects.filter(is_deleted=False)
        else:
            # For anonymous users, return empty data
            if user.is_anonymous:
                return Response({
                    'per_shift': [{'day': day, 'Day': 0, 'Swing': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
                    'per_day': [{'day': day, 'hours': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']]
                })
            
            # Get approved facility IDs for this user
            approved_facility_ids = FacilityAccess.objects.filter(
                user=user,
                status='approved'
            ).values_list('facility_id', flat=True)

            # Get all sections in those facilities
            allowed_sections = FacilitySection.objects.filter(facility_id__in=approved_facility_ids)

            # Get all residents in those sections
            allowed_residents = Resident.objects.filter(facility_section__in=allowed_sections)

            # Only ADLs for allowed residents
            adls = ADL.objects.filter(resident__in=allowed_residents, is_deleted=False)
        
        # Optionally filter by facility_id
        facility_id = request.query_params.get('facility_id')
        if facility_id:
            # facility_id is the database ID, so filter by the facility object
            from residents.models import Facility
            try:
                facility = Facility.objects.get(id=facility_id)
                sections = FacilitySection.objects.filter(facility=facility)
                residents = Resident.objects.filter(facility_section__in=sections)
                adls = adls.filter(resident__in=residents)
            except Facility.DoesNotExist:
                pass  # No facility found, return empty data
        
        # Get facility for shift format
        facility = None
        if facility_id:
            try:
                facility = Facility.objects.get(id=facility_id)
            except Facility.DoesNotExist:
                pass
        
        # Get shift mapping based on facility format
        shift_mapping = self.get_shift_mapping(facility)
        shift_names = self.get_shift_names_for_format(facility)
        shift_map = {f'Shift{i}': shift_mapping.get(f'Shift{i}') for i in [1, 2, 3] if shift_mapping.get(f'Shift{i}')}
        
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        day_prefixes = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun']
        per_shift = [
            {**{'day': day}, **{shift: 0 for shift in shift_names}} for day in days
        ]
        
        # Use resident total shift times for chart calculation (like Oregon ABST)
        # Get unique residents from ADLs
        residents = Resident.objects.filter(adls__in=adls).distinct()
        for resident in residents:
            resident_total_times = resident.total_shift_times or {}
            for i, prefix in enumerate(day_prefixes):
                for shift_num, shift_name in shift_map.items():
                    col = f'ResidentTotal{prefix}{shift_num}Time'
                    minutes = resident_total_times.get(col, 0)
                    per_shift[i][shift_name] += minutes / 60.0
        for s in per_shift:
            for shift in shift_names:
                s[shift] = round(s[shift], 2)
        per_day = [
            {'day': s['day'], 'hours': round(sum(s[shift] for shift in shift_names), 2)}
            for s in per_shift
        ]
        return Response({
            'per_shift': per_shift,
            'per_day': per_day
        })


class ADLQuestionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for retrieving ADL questions.
    Read-only since questions are typically seeded/managed via admin.
    """
    queryset = ADLQuestion.objects.all().order_by('order', 'id')
    serializer_class = ADLQuestionSerializer
    permission_classes = [AllowAny]  # Allow any authenticated or unauthenticated user to read questions
    
    def get_queryset(self):
        return ADLQuestion.objects.all().order_by('order', 'id')

class WeeklyADLEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing weekly ADL entries.
    Allows staff to enter ADL data for specific weeks and track historical data.
    """
    queryset = WeeklyADLEntry.objects.filter(is_deleted=False)
    serializer_class = WeeklyADLEntrySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['resident', 'adl_question', 'status', 'week_start_date', 'week_end_date']
    search_fields = ['question_text', 'resident__name', 'notes']
    ordering_fields = ['week_start_date', 'created_at', 'total_hours_week', 'resident__name']
    ordering = ['-week_start_date', 'resident__name', 'adl_question__order']

    def get_queryset(self):
        user = self.request.user
        queryset = WeeklyADLEntry.objects.filter(is_deleted=False)
        
        # Apply facility filtering if user has facility access
        if hasattr(user, 'facilityaccess_set'):
            facility_accesses = user.facilityaccess_set.all()
            if facility_accesses.exists():
                facility_ids = [fa.facility_id for fa in facility_accesses]
                queryset = queryset.filter(resident__facility_id__in=facility_ids)
        
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Handle both single entry creation and bulk creation (array of entries).
        """
        # Check if request.data is a list (bulk create)
        if isinstance(request.data, list):
            created_entries = []
            errors = []
            
            for idx, entry_data in enumerate(request.data):
                serializer = self.get_serializer(data=entry_data)
                if serializer.is_valid():
                    try:
                        # The serializer's create method now uses update_or_create,
                        # so this will update existing entries instead of creating duplicates
                        entry = serializer.save()
                        created_entries.append(entry)
                    except Exception as e:
                        errors.append({
                            'index': idx,
                            'data': entry_data,
                            'error': str(e)
                        })
                else:
                    errors.append({
                        'index': idx,
                        'data': entry_data,
                        'errors': serializer.errors
                    })
            
            if errors:
                # Return partial success with errors
                return Response({
                    'created': len(created_entries),
                    'errors': errors,
                    'created_entries': WeeklyADLEntrySerializer(created_entries, many=True).data
                }, status=207)  # 207 Multi-Status
            
            # All entries created successfully
            return Response(
                WeeklyADLEntrySerializer(created_entries, many=True).data,
                status=201
            )
        else:
            # Single entry creation - the serializer's create method uses update_or_create
            # which will automatically handle duplicates, so we can use the default behavior
            # However, we need to catch IntegrityError in case the unique constraint is violated
            # (this can happen in race conditions)
            try:
                return super().create(request, *args, **kwargs)
            except Exception as e:
                # If we get a unique constraint error, try to find and update the existing entry
                error_str = str(e).lower()
                if 'unique' in error_str or 'duplicate' in error_str:
                    serializer = self.get_serializer(data=request.data)
                    serializer.is_valid(raise_exception=True)
                    
                    resident = serializer.validated_data.get('resident')
                    adl_question = serializer.validated_data.get('adl_question')
                    week_start_date = serializer.validated_data.get('week_start_date')
                    
                    # Try to find existing entry (including soft-deleted ones)
                    try:
                        existing_entry = WeeklyADLEntry.objects.get(
                            resident=resident,
                            adl_question=adl_question,
                            week_start_date=week_start_date
                        )
                        # Restore if soft-deleted
                        if existing_entry.is_deleted:
                            existing_entry.is_deleted = False
                            existing_entry.deleted_at = None
                        
                        # Update existing entry
                        update_serializer = self.get_serializer(existing_entry, data=request.data, partial=False)
                        update_serializer.is_valid(raise_exception=True)
                        update_serializer.save(updated_by=request.user)
                        return Response(update_serializer.data, status=200)
                    except WeeklyADLEntry.DoesNotExist:
                        # Should not happen, but if it does, re-raise the original error
                        return Response({'error': 'Failed to save entry. Please try again.'}, status=400)
                else:
                    # Re-raise other errors
                    raise

    @action(detail=False, methods=['get'], url_path='by-resident/(?P<resident_id>[^/.]+)')
    def by_resident(self, request, resident_id=None):
        """
        Get all weekly ADL entries for a specific resident.
        """
        entries = self.get_queryset().filter(resident_id=resident_id)
        serializer = self.get_serializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-week/(?P<week_start>[^/.]+)')
    def by_week(self, request, week_start=None):
        """
        Get all weekly ADL entries for a specific week.
        """
        from datetime import datetime
        try:
            week_start_date = datetime.strptime(week_start, '%Y-%m-%d').date()
            entries = self.get_queryset().filter(week_start_date=week_start_date)
            serializer = self.get_serializer(entries, many=True)
            return Response(serializer.data)
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

    @action(detail=False, methods=['get'], url_path='historical/(?P<resident_id>[^/.]+)')
    def historical_data(self, request, resident_id=None):
        """
        Get historical weekly ADL data for a resident, showing trends over time.
        """
        from datetime import datetime, timedelta
        
        # Get last 12 weeks of data
        end_date = timezone.now().date()
        start_date = end_date - timedelta(weeks=12)
        
        entries = self.get_queryset().filter(
            resident_id=resident_id,
            week_start_date__gte=start_date,
            week_start_date__lte=end_date
        ).order_by('week_start_date')
        
        # Group by week and ADL question
        weekly_data = {}
        for entry in entries:
            week_key = entry.week_start_date.strftime('%Y-%m-%d')
            if week_key not in weekly_data:
                weekly_data[week_key] = {
                    'week_label': entry.week_label,
                    'week_start_date': entry.week_start_date,
                    'adl_questions': {}
                }
            
            weekly_data[week_key]['adl_questions'][entry.adl_question.id] = {
                'question_text': entry.question_text,
                'minutes_per_occurrence': entry.minutes_per_occurrence,
                'frequency_per_week': entry.frequency_per_week,
                'total_hours_week': entry.total_hours_week,
                'status': entry.status
            }
        
        return Response({
            'resident_id': resident_id,
            'historical_data': list(weekly_data.values()),
            'date_range': {
                'start_date': start_date,
                'end_date': end_date
            }
        })

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create_weekly_entries(self, request):
        """
        Create multiple weekly ADL entries at once.
        Useful for staff to enter a full week of ADL data for a resident.
        """
        data = request.data
        resident_id = data.get('resident_id')
        week_start_date = data.get('week_start_date')
        week_end_date = data.get('week_end_date')
        adl_entries = data.get('adl_entries', [])
        
        if not resident_id or not week_start_date or not adl_entries:
            return Response({
                'error': 'resident_id, week_start_date, and adl_entries are required'
            }, status=400)
        
        try:
            from datetime import datetime
            week_start = datetime.strptime(week_start_date, '%Y-%m-%d').date()
            if week_end_date:
                week_end = datetime.strptime(week_end_date, '%Y-%m-%d').date()
            else:
                week_end = week_start + timedelta(days=6)
            
            created_entries = []
            for entry_data in adl_entries:
                entry_data.update({
                    'resident_id': resident_id,
                    'week_start_date': week_start,
                    'week_end_date': week_end,
                    'created_by': request.user
                })
                
                # Calculate total minutes for the week
                minutes_per_occurrence = entry_data.get('minutes_per_occurrence', 0)
                frequency_per_week = entry_data.get('frequency_per_week', 0)
                entry_data['total_minutes_week'] = minutes_per_occurrence * frequency_per_week
                
                serializer = self.get_serializer(data=entry_data)
                if serializer.is_valid():
                    entry = serializer.save()
                    created_entries.append(entry)
                else:
                    return Response({
                        'error': 'Invalid entry data',
                        'details': serializer.errors
                    }, status=400)
            
            # Generate weekly summary
            self._generate_weekly_summary(resident_id, week_start, week_end)
            
            return Response({
                'message': f'Successfully created {len(created_entries)} weekly ADL entries',
                'entries': WeeklyADLEntrySerializer(created_entries, many=True).data
            })
            
        except ValueError as e:
            return Response({'error': f'Invalid date format: {str(e)}'}, status=400)

    def _generate_weekly_summary(self, resident_id, week_start, week_end):
        """
        Generate or update weekly summary for a resident.
        """
        from datetime import timedelta
        
        entries = WeeklyADLEntry.objects.filter(
            resident_id=resident_id,
            week_start_date=week_start,
            is_deleted=False
        )
        
        total_minutes = sum(entry.total_minutes_week for entry in entries)
        total_frequency = sum(entry.frequency_per_week for entry in entries)
        total_questions = entries.count()
        
        # Get total ADL questions for completion percentage
        total_adl_questions = ADLQuestion.objects.count()
        completion_percentage = (total_questions / total_adl_questions * 100) if total_adl_questions > 0 else 0
        
        summary, created = WeeklyADLSummary.objects.update_or_create(
            resident_id=resident_id,
            week_start_date=week_start,
            defaults={
                'week_end_date': week_end,
                'total_adl_questions': total_questions,
                'total_minutes_week': total_minutes,
                'total_frequency_week': total_frequency,
                'is_complete': completion_percentage >= 100,
                'completion_percentage': completion_percentage
            }
        )
        
        return summary


class WeeklyADLSummaryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing weekly ADL summaries.
    Provides aggregated data for weekly caregiving reports.
    """
    queryset = WeeklyADLSummary.objects.all()
    serializer_class = WeeklyADLSummarySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['resident', 'is_complete', 'week_start_date', 'week_end_date']
    search_fields = ['resident__name']
    ordering_fields = ['week_start_date', 'created_at', 'total_hours_week', 'resident__name']
    ordering = ['-week_start_date', 'resident__name']

    def get_queryset(self):
        user = self.request.user
        queryset = WeeklyADLSummary.objects.all()
        
        # Apply facility filtering if user has facility access
        if hasattr(user, 'facilityaccess_set'):
            facility_accesses = user.facilityaccess_set.all()
            if facility_accesses.exists():
                facility_ids = [fa.facility_id for fa in facility_accesses]
                queryset = queryset.filter(resident__facility_id__in=facility_ids)
        
        return queryset

    @action(detail=False, methods=['get'], url_path='trends/(?P<resident_id>[^/.]+)')
    def weekly_trends(self, request, resident_id=None):
        """
        Get weekly trends for a resident showing caregiving hours over time.
        """
        from datetime import timedelta
        
        # Get last 12 weeks of summaries
        end_date = timezone.now().date()
        start_date = end_date - timedelta(weeks=12)
        
        summaries = self.get_queryset().filter(
            resident_id=resident_id,
            week_start_date__gte=start_date,
            week_start_date__lte=end_date
        ).order_by('week_start_date')
        
        trend_data = []
        for summary in summaries:
            trend_data.append({
                'week_label': summary.week_label,
                'week_start_date': summary.week_start_date,
                'total_hours': summary.total_hours_week,
                'total_minutes': summary.total_minutes_week,
                'completion_percentage': summary.completion_percentage,
                'is_complete': summary.is_complete
            })
        
        return Response({
            'resident_id': resident_id,
            'trend_data': trend_data,
            'date_range': {
                'start_date': start_date,
                'end_date': end_date
            }
        })

    @action(detail=False, methods=['get'], url_path='facility-summary/(?P<facility_id>[^/.]+)')
    def facility_weekly_summary(self, request, facility_id=None):
        """
        Get weekly summary for all residents in a facility.
        """
        from datetime import timedelta
        
        # Get current week
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())  # Monday
        
        summaries = self.get_queryset().filter(
            resident__facility_id=facility_id,
            week_start_date=week_start
        )
        
        facility_summary = {
            'facility_id': facility_id,
            'week_start_date': week_start,
            'total_residents': summaries.count(),
            'completed_weeks': summaries.filter(is_complete=True).count(),
            'total_caregiving_hours': sum(s.total_hours_week for s in summaries),
            'average_hours_per_resident': sum(s.total_hours_week for s in summaries) / summaries.count() if summaries.count() > 0 else 0,
            'residents': []
        }
        
        for summary in summaries:
            facility_summary['residents'].append({
                'resident_id': summary.resident.id,
                'resident_name': summary.resident.name,
                'total_hours': summary.total_hours_week,
                'completion_percentage': summary.completion_percentage,
                'is_complete': summary.is_complete
            })
        
        return Response(facility_summary)
