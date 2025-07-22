from django.shortcuts import render
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Sum, Avg, Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from .models import ADL, ADLQuestion
from .serializers import ADLSerializer, ADLQuestionSerializer
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
        
        try:
            if file.name.endswith('.csv'):
                df = pd.read_csv(file)
            else:
                df = pd.read_excel(file)
        except Exception as e:
            return Response({'error': f'File parsing error: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        created_adls = 0
        updated_adls = 0
        created_residents = 0
        
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
        is_resident_based = 'Name' in df.columns and 'TotalCareTime' in df.columns
        
        if is_resident_based:
            # Handle resident-based CSV format (like the Murray Highland export)
            print("Processing resident-based CSV format...")
            
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
                    
                    # Calculate minutes per question (distribute total minutes across questions)
                    # For now, we'll distribute evenly, but this could be made more sophisticated
                    questions_count = standard_questions.count()
                    if questions_count > 0:
                        minutes_per_question = total_minutes // questions_count
                        remaining_minutes = total_minutes % questions_count
                        
                        for i, adl_question in enumerate(standard_questions):
                            # Distribute remaining minutes to first few questions
                            question_minutes = minutes_per_question + (1 if i < remaining_minutes else 0)
                            
                            # Create per-day shift times for this question (distribute proportionally)
                            question_per_day_shift_times = {}
                            for col, value in per_day_shift_times.items():
                                question_per_day_shift_times[col] = value // questions_count
                            
                            # Update or create ADL entry for this specific question
                            adl, created = ADL.objects.update_or_create(
                                resident=current_resident,
                                adl_question=adl_question,
                                defaults={
                                    'question_text': adl_question.text,
                                    'minutes': question_minutes,
                                    'frequency': 1,  # Default frequency
                                    'total_minutes': question_minutes,
                                    'total_hours': float(question_minutes) / 60 if question_minutes else 0,
                                    'status': row.get('Status', 'Complete'),
                                    'per_day_shift_times': question_per_day_shift_times,
                                }
                            )
                            
                            if created:
                                created_adls += 1
                            else:
                                updated_adls += 1
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
                        
                        # Get task time and frequency
                        task_time = row.get('TaskTime', 0)
                        if pd.isna(task_time) or task_time is None:
                            task_time = 0
                        
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
                    print(f"Error processing row {index}: {e}")
                    continue
        
        return Response({
            'message': f'Import completed successfully!',
            'details': {
                'created_residents': created_residents,
                'created_adls': created_adls,
                'updated_adls': updated_adls,
                'total_processed': created_adls + updated_adls
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
    def caregiving_summary(self, request):
        from residents.models import Resident, FacilitySection, Facility
        from .models import ADL
        from users.models import FacilityAccess
        
        # Use the same filtering logic as get_queryset
        user = request.user
        
        # Superadmins and admins see all ADLs
        if user.is_staff or getattr(user, 'role', None) in ['superadmin', 'admin']:
            adls = ADL.objects.filter(is_deleted=False)
        else:
            # For anonymous users, return empty data
            if user.is_anonymous:
                return Response({
                    'per_shift': [{'day': day, 'Day': 0, 'Eve': 0, 'NOC': 0} for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
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
            sections = FacilitySection.objects.filter(facility_id=facility_id)
            residents = Resident.objects.filter(facility_section__in=sections)
            adls = adls.filter(resident__in=residents)
        
        shift_map = {
            'Shift1': 'Day',
            'Shift2': 'Eve',
            'Shift3': 'NOC',
        }
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        day_prefixes = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun']
        per_shift = [
            {'day': day, 'Day': 0, 'Eve': 0, 'NOC': 0} for day in days
        ]
        for adl in adls:
            times = adl.per_day_shift_times or {}
            for i, prefix in enumerate(day_prefixes):
                for shift_num, shift_name in shift_map.items():
                    col = f'{prefix}{shift_num}Time'
                    minutes = times.get(col, 0)
                    per_shift[i][shift_name] += minutes / 60.0
        for s in per_shift:
            for shift in ['Day', 'Eve', 'NOC']:
                s[shift] = round(s[shift], 2)
        per_day = [
            {'day': s['day'], 'hours': round(s['Day'] + s['Eve'] + s['NOC'], 2)}
            for s in per_shift
        ]
        return Response({
            'per_shift': per_shift,
            'per_day': per_day
        })
