"""
Django management command to sync Paycom weekly roster data
This creates weekly StaffAvailability records for scheduling
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import datetime, date, timedelta
import logging
from scheduling.models import Staff, StaffAvailability
from residents.models import Facility
from paycom.models import PaycomEmployee
from paycom.sync_utils import sync_paycom_to_staff

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Create weekly staff roster and availability from Paycom data'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--week-start',
            type=str,
            help='Week start date (YYYY-MM-DD). Defaults to next Monday.',
        )
        parser.add_argument(
            '--facility-id',
            type=int,
            help='Specific facility ID to process. Defaults to all facilities.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force creation even if availability already exists for the week'
        )
        parser.add_argument(
            '--default-availability',
            type=str,
            choices=['available', 'no_overtime', 'limited', 'unavailable'],
            default='available',
            help='Default availability status for staff (default: available)'
        )
    
    def handle(self, *args, **options):
        week_start_str = options.get('week_start')
        facility_id = options.get('facility_id')
        force = options.get('force')
        default_availability = options.get('default_availability')
        
        # Determine week start date
        if week_start_str:
            try:
                week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
            except ValueError:
                raise CommandError('Invalid week_start format. Use YYYY-MM-DD')
        else:
            # Default to next Monday
            today = timezone.now().date()
            days_until_monday = (7 - today.weekday()) % 7
            if days_until_monday == 0:  # If today is Monday
                days_until_monday = 7   # Go to next Monday
            week_start = today + timedelta(days=days_until_monday)
        
        week_end = week_start + timedelta(days=6)
        
        self.stdout.write(
            self.style.SUCCESS(
                f'🔄 Creating weekly roster for {week_start} to {week_end}'
            )
        )
        
        # Ensure Paycom data is synced first
        self.stdout.write('📥 Step 1: Ensuring Paycom data is synced...')
        sync_result = sync_paycom_to_staff()
        if sync_result['success']:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Paycom sync: {sync_result["created_count"]} created, '
                    f'{sync_result["updated_count"]} updated'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'⚠️  Paycom sync issues: {sync_result.get("error", "Unknown error")}'
                )
            )
        
        # Get facilities to process
        if facility_id:
            facilities = Facility.objects.filter(id=facility_id)
            if not facilities.exists():
                raise CommandError(f'Facility with ID {facility_id} not found')
        else:
            facilities = Facility.objects.all()
        
        total_staff_processed = 0
        total_availability_created = 0
        
        # Process each facility
        for facility in facilities:
            self.stdout.write(f'🏢 Processing facility: {facility.name}')
            
            # Get active staff for this facility
            staff_members = Staff.objects.filter(
                facility=facility,
                status='active'
            )
            
            self.stdout.write(f'   👥 Found {staff_members.count()} active staff members')
            
            facility_availability_created = 0
            
            # Create weekly availability for each staff member
            for staff in staff_members:
                staff_availability_created = self._create_weekly_availability(
                    staff, week_start, week_end, default_availability, force
                )
                facility_availability_created += staff_availability_created
                total_staff_processed += 1
            
            total_availability_created += facility_availability_created
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'   ✅ Created {facility_availability_created} availability records'
                )
            )
        
        # Summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write('📋 WEEKLY ROSTER CREATION SUMMARY')
        self.stdout.write('='*60)
        self.stdout.write(f'📅 Week: {week_start} to {week_end}')
        self.stdout.write(f'🏢 Facilities: {facilities.count()}')
        self.stdout.write(f'👥 Staff processed: {total_staff_processed}')
        self.stdout.write(f'📊 Availability records: {total_availability_created}')
        self.stdout.write(f'🎯 Default status: {default_availability}')
        
        self.stdout.write('\n📝 NEXT STEPS:')
        self.stdout.write('='*60)
        self.stdout.write('1. ✅ Weekly roster created - staff availability is set')
        self.stdout.write('2. 📅 ADL data should be entered for residents')
        self.stdout.write('3. 🤖 AI recommendations can be generated')
        self.stdout.write('4. 📋 Schedule can be created and staff assigned')
        
        self.stdout.write(
            self.style.SUCCESS('🎉 Weekly roster creation completed successfully!')
        )
    
    def _create_weekly_availability(self, staff, week_start, week_end, default_status, force):
        """Create weekly availability records for a staff member"""
        availability_created = 0
        
        # Check if availability already exists for this week
        existing_availability = StaffAvailability.objects.filter(
            staff=staff,
            date__gte=week_start,
            date__lte=week_end
        ).count()
        
        if existing_availability > 0 and not force:
            self.stdout.write(
                f'   ⚠️  {staff.full_name}: {existing_availability} availability records already exist'
            )
            return 0
        
        # Create availability for each day of the week
        for i in range(7):
            availability_date = week_start + timedelta(days=i)
            
            # Determine availability status based on staff role and day
            availability_status = self._determine_availability_status(
                staff, availability_date, default_status
            )
            
            # Determine max hours based on staff role and day
            max_hours = self._determine_max_hours(staff, availability_date)
            
            # Determine preferred shift types
            preferred_shifts = self._determine_preferred_shifts(staff)
            
            # Create or update availability record
            availability, created = StaffAvailability.objects.update_or_create(
                staff=staff,
                date=availability_date,
                facility=staff.facility,
                defaults={
                    'availability_status': availability_status,
                    'max_hours': max_hours,
                    'preferred_shift_types': preferred_shifts,
                    'notes': f'Weekly roster created on {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}'
                }
            )
            
            if created:
                availability_created += 1
        
        if availability_created > 0:
            self.stdout.write(
                f'   ✅ {staff.full_name}: Created {availability_created} availability records'
            )
        
        return availability_created
    
    def _determine_availability_status(self, staff, date, default_status):
        """Determine availability status based on staff role, date, and business rules"""
        # Business rules for availability
        day_of_week = date.weekday()  # Monday = 0, Sunday = 6
        
        # Weekend rules (Saturday = 5, Sunday = 6)
        if day_of_week >= 5:
            # Weekend availability - some staff might be limited
            if staff.role in ['rn', 'lpn']:
                return 'limited'  # Nurses might have limited weekend availability
            elif staff.role == 'med_tech':
                return 'available'  # MedTechs usually available weekends
            else:
                return default_status
        
        # Weekday rules
        if staff.role in ['rn', 'lpn', 'med_tech']:
            return 'available'  # Clinical staff usually available weekdays
        elif staff.role == 'caregiver':
            return 'available'  # Caregivers usually available
        else:
            return default_status
    
    def _determine_max_hours(self, staff, date):
        """Determine max hours for a staff member on a specific date"""
        day_of_week = date.weekday()  # Monday = 0, Sunday = 6
        
        # Base max hours from staff record
        base_hours = min(staff.max_hours, 40)  # Cap at 40 hours
        
        # Weekend adjustments
        if day_of_week >= 5:  # Weekend
            if staff.role in ['rn', 'lpn']:
                return min(base_hours, 12)  # Nurses might work longer weekend shifts
            else:
                return min(base_hours, 8)   # Other staff typically 8-hour weekend shifts
        else:  # Weekday
            if staff.role in ['rn', 'lpn']:
                return min(base_hours, 12)  # Nurses can work 12-hour shifts
            else:
                return min(base_hours, 8)   # Other staff typically 8-hour shifts
    
    def _determine_preferred_shifts(self, staff):
        """Determine preferred shift types based on staff role"""
        if staff.role in ['rn', 'lpn']:
            return ['day', 'swing']  # Nurses prefer day/swing shifts
        elif staff.role == 'med_tech':
            return ['day', 'swing', 'noc']  # MedTechs available all shifts
        elif staff.role == 'caregiver':
            return ['day', 'swing']  # Caregivers prefer day/swing
        elif staff.role == 'cna':
            return ['day', 'swing']  # CNAs prefer day/swing
        else:
            return ['day']  # Default to day shift
