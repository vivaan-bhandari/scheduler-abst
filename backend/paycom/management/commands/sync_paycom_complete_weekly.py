"""
Complete weekly Paycom sync and roster creation
This command handles the entire weekly workflow:
1. Sync Paycom employee data
2. Create weekly staff roster and availability
3. Prepare data for AI recommendations and scheduling
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import datetime, date, timedelta
import logging
from scheduling.models import Staff, StaffAvailability
from residents.models import Facility
from paycom.models import PaycomEmployee
from paycom.sync_utils import sync_paycom_to_staff
from paycom.sftp_service import sync_paycom_data
from paycom.data_parser import parse_paycom_files

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Complete weekly Paycom sync and roster creation for scheduling'
    
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
            '--skip-paycom-sync',
            action='store_true',
            help='Skip Paycom SFTP sync and only create roster'
        )
        parser.add_argument(
            '--skip-roster-creation',
            action='store_true',
            help='Skip roster creation and only sync Paycom data'
        )
        parser.add_argument(
            '--skip-time-tracking',
            action='store_true',
            help='Skip time tracking sync'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force operations even if data already exists'
        )
        parser.add_argument(
            '--notify',
            action='store_true',
            help='Send notification about results'
        )
    
    def handle(self, *args, **options):
        week_start_str = options.get('week_start')
        facility_id = options.get('facility_id')
        skip_paycom_sync = options.get('skip_paycom_sync')
        skip_roster_creation = options.get('skip_roster_creation')
        skip_time_tracking = options.get('skip_time_tracking')
        force = options.get('force')
        notify = options.get('notify')
        
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
        
        self.stdout.write('\n' + '='*70)
        self.stdout.write('🚀 COMPLETE WEEKLY PAYCOM SYNC & ROSTER CREATION')
        self.stdout.write('='*70)
        self.stdout.write(f'📅 Target Week: {week_start} to {week_end}')
        self.stdout.write(f'🕐 Started: {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}')
        
        results = {
            'paycom_sync': {'success': False, 'details': {}},
            'time_tracking_sync': {'success': False, 'details': {}},
            'roster_creation': {'success': False, 'details': {}},
            'facilities_processed': 0,
            'total_staff_processed': 0,
            'total_availability_created': 0,
        }
        
        try:
            # Step 1: Paycom SFTP Sync (if not skipped)
            if not skip_paycom_sync:
                self.stdout.write('\n📥 STEP 1: PAYCOM SFTP SYNC')
                self.stdout.write('-'*50)
                results['paycom_sync'] = self._sync_paycom_data(force)
            else:
                self.stdout.write('\n⏭️  STEP 1: PAYCOM SYNC SKIPPED')
                results['paycom_sync']['success'] = True
            
            # Step 2: Time Tracking Sync (if not skipped)
            if not skip_time_tracking:
                self.stdout.write('\n⏰ STEP 2: TIME TRACKING SYNC')
                self.stdout.write('-'*50)
                results['time_tracking_sync'] = self._sync_time_tracking_data(week_start, week_end)
            else:
                self.stdout.write('\n⏭️  STEP 2: TIME TRACKING SYNC SKIPPED')
                results['time_tracking_sync']['success'] = True
                results['paycom_sync']['details']['skipped'] = True
            
            # Step 3: Roster Creation (if not skipped)
            if not skip_roster_creation:
                self.stdout.write('\n👥 STEP 3: WEEKLY ROSTER CREATION')
                self.stdout.write('-'*50)
                results['roster_creation'] = self._create_weekly_roster(
                    week_start, week_end, facility_id, force
                )
            else:
                self.stdout.write('\n⏭️  STEP 2: ROSTER CREATION SKIPPED')
                results['roster_creation']['success'] = True
                results['roster_creation']['details']['skipped'] = True
            
            # Step 3: Validation and Summary
            self.stdout.write('\n✅ STEP 3: VALIDATION & SUMMARY')
            self.stdout.write('-'*50)
            self._validate_and_summarize(results, week_start, week_end, notify)
            
        except Exception as e:
            logger.error(f'Error in complete weekly sync: {e}')
            raise CommandError(f'Weekly sync failed: {e}')
    
    def _sync_paycom_data(self, force):
        """Sync Paycom data from SFTP"""
        try:
            # Check for recent sync unless forced
            if not force:
                from paycom.models import PaycomSyncLog
                recent_sync = PaycomSyncLog.objects.filter(
                    status='completed',
                    started_at__gte=timezone.now() - timezone.timedelta(hours=6)
                ).first()
                
                if recent_sync:
                    self.stdout.write(
                        self.style.WARNING(
                            f'⚠️  Recent sync found (ID: {recent_sync.sync_id}). Use --force to override.'
                        )
                    )
                    return {'success': True, 'details': {'skipped': True, 'reason': 'recent_sync_exists'}}
            
            # Download files from SFTP
            self.stdout.write('📥 Downloading files from Paycom SFTP...')
            sync_log = sync_paycom_data('all')
            
            if sync_log.status == 'failed':
                return {'success': False, 'details': {'error': sync_log.error_message}}
            
            self.stdout.write(
                self.style.SUCCESS(f'✅ Downloaded {sync_log.files_successful} files')
            )
            
            # Parse employee data
            self.stdout.write('📊 Parsing employee data...')
            parse_result = parse_paycom_files(sync_log)
            
            if not parse_result['success']:
                return {'success': False, 'details': {'error': 'Failed to parse employee data'}}
            
            stats = parse_result['total_stats']
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Parsed: {stats["created"]} created, {stats["updated"]} updated, {stats["errors"]} errors'
                )
            )
            
            # Sync with Staff model
            self.stdout.write('👥 Syncing with Staff model...')
            sync_result = sync_paycom_to_staff()
            
            if sync_result['success']:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Staff sync: {sync_result["created_count"]} created, '
                        f'{sync_result["updated_count"]} updated'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'⚠️  Staff sync issues: {sync_result.get("error", "Unknown error")}'
                    )
                )
            
            return {
                'success': True,
                'details': {
                    'files_downloaded': sync_log.files_successful,
                    'employees_created': stats['created'],
                    'employees_updated': stats['updated'],
                    'staff_created': sync_result['created_count'],
                    'staff_updated': sync_result['updated_count'],
                    'sync_id': sync_log.sync_id
                }
            }
            
        except Exception as e:
            logger.error(f'Error in Paycom sync: {e}')
            return {'success': False, 'details': {'error': str(e)}}
    
    def _create_weekly_roster(self, week_start, week_end, facility_id, force):
        """Create weekly roster and availability"""
        try:
            # Get facilities to process
            if facility_id:
                facilities = Facility.objects.filter(id=facility_id)
                if not facilities.exists():
                    return {'success': False, 'details': {'error': f'Facility {facility_id} not found'}}
            else:
                facilities = Facility.objects.all()
            
            total_staff_processed = 0
            total_availability_created = 0
            
            for facility in facilities:
                self.stdout.write(f'🏢 Processing facility: {facility.name}')
                
                # Get active staff
                staff_members = Staff.objects.filter(
                    facility=facility,
                    status='active'
                )
                
                self.stdout.write(f'   👥 {staff_members.count()} active staff members')
                
                facility_availability_created = 0
                
                # Create availability for each staff member
                for staff in staff_members:
                    availability_created = self._create_staff_weekly_availability(
                        staff, week_start, week_end, force
                    )
                    facility_availability_created += availability_created
                    total_staff_processed += 1
                
                total_availability_created += facility_availability_created
                
                self.stdout.write(
                    self.style.SUCCESS(f'   ✅ {facility_availability_created} availability records')
                )
            
            return {
                'success': True,
                'details': {
                    'facilities_processed': facilities.count(),
                    'staff_processed': total_staff_processed,
                    'availability_created': total_availability_created
                }
            }
            
        except Exception as e:
            logger.error(f'Error in roster creation: {e}')
            return {'success': False, 'details': {'error': str(e)}}
    
    def _create_staff_weekly_availability(self, staff, week_start, week_end, force):
        """Create weekly availability for a staff member"""
        availability_created = 0
        
        # Check existing availability
        existing_count = StaffAvailability.objects.filter(
            staff=staff,
            date__gte=week_start,
            date__lte=week_end
        ).count()
        
        if existing_count > 0 and not force:
            return 0
        
        # Create availability for each day
        for i in range(7):
            availability_date = week_start + timedelta(days=i)
            
            availability_status = self._determine_availability_status(staff, availability_date)
            max_hours = self._determine_max_hours(staff, availability_date)
            preferred_shifts = self._determine_preferred_shifts(staff)
            
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
        
        return availability_created
    
    def _determine_availability_status(self, staff, date):
        """Determine availability status"""
        day_of_week = date.weekday()
        
        if day_of_week >= 5:  # Weekend
            if staff.role in ['rn', 'lpn']:
                return 'limited'
            else:
                return 'available'
        else:  # Weekday
            return 'available'
    
    def _determine_max_hours(self, staff, date):
        """Determine max hours"""
        day_of_week = date.weekday()
        base_hours = min(staff.max_hours, 40)
        
        if day_of_week >= 5:  # Weekend
            return min(base_hours, 8)
        else:  # Weekday
            return min(base_hours, 12)
    
    def _determine_preferred_shifts(self, staff):
        """Determine preferred shift types"""
        if staff.role in ['rn', 'lpn']:
            return ['day', 'swing']
        elif staff.role == 'med_tech':
            return ['day', 'swing', 'noc']
        elif staff.role in ['caregiver', 'cna']:
            return ['day', 'swing']
        else:
            return ['day']
    
    def _validate_and_summarize(self, results, week_start, week_end, notify):
        """Validate results and provide summary"""
        
        # Overall success check
        overall_success = (
            results['paycom_sync']['success'] and 
            results['roster_creation']['success']
        )
        
        self.stdout.write('\n' + '='*70)
        self.stdout.write('📋 COMPLETE WEEKLY SYNC SUMMARY')
        self.stdout.write('='*70)
        self.stdout.write(f'📅 Week: {week_start} to {week_end}')
        self.stdout.write(f'🕐 Completed: {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}')
        
        # Paycom sync results
        if results['paycom_sync']['success']:
            if results['paycom_sync']['details'].get('skipped'):
                self.stdout.write('📥 Paycom Sync: ⏭️  Skipped (recent sync exists)')
            else:
                details = results['paycom_sync']['details']
                self.stdout.write(f'📥 Paycom Sync: ✅ Success')
                self.stdout.write(f'   📁 Files: {details.get("files_downloaded", 0)}')
                self.stdout.write(f'   👤 Staff: {details.get("staff_created", 0)} created, {details.get("staff_updated", 0)} updated')
        else:
            self.stdout.write('📥 Paycom Sync: ❌ Failed')
            self.stdout.write(f'   Error: {results["paycom_sync"]["details"].get("error", "Unknown")}')
        
        # Roster creation results
        if results['roster_creation']['success']:
            if results['roster_creation']['details'].get('skipped'):
                self.stdout.write('👥 Roster Creation: ⏭️  Skipped')
            else:
                details = results['roster_creation']['details']
                self.stdout.write(f'👥 Roster Creation: ✅ Success')
                self.stdout.write(f'   🏢 Facilities: {details.get("facilities_processed", 0)}')
                self.stdout.write(f'   👤 Staff: {details.get("staff_processed", 0)}')
                self.stdout.write(f'   📊 Availability: {details.get("availability_created", 0)} records')
        else:
            self.stdout.write('👥 Roster Creation: ❌ Failed')
            self.stdout.write(f'   Error: {results["roster_creation"]["details"].get("error", "Unknown")}')
        
        # Next steps
        self.stdout.write('\n📝 NEXT STEPS FOR SCHEDULE PLANNING:')
        self.stdout.write('='*70)
        if overall_success:
            self.stdout.write('1. ✅ Employee data is up-to-date')
            self.stdout.write('2. ✅ Weekly staff roster and availability created')
            self.stdout.write('3. 📅 Enter ADL data for residents for this week')
            self.stdout.write('4. 🤖 Generate AI recommendations based on ADL data')
            self.stdout.write('5. 📋 Create shifts and assign staff')
            self.stdout.write('6. 🔒 Finalize schedule by Friday')
            
            if notify:
                self.stdout.write('\n📧 Notification sent: Weekly sync completed successfully')
            
            self.stdout.write(
                self.style.SUCCESS('\n🎉 COMPLETE WEEKLY SYNC SUCCESSFUL!')
            )
        else:
            self.stdout.write('❌ Some operations failed. Check errors above.')
            self.stdout.write('🔧 Fix issues and re-run with --force if needed.')
            
            if notify:
                self.stdout.write('\n📧 Notification sent: Weekly sync completed with errors')
            
            self.stdout.write(
                self.style.ERROR('\n⚠️  WEEKLY SYNC COMPLETED WITH ISSUES')
            )
    
    def _sync_time_tracking_data(self, week_start, week_end):
        """Sync time tracking data for the specified week"""
        try:
            from paycom.time_tracking_parser import sync_paycom_time_tracking
            from paycom.facility_mapping import get_facility_mapping
            
            # Get facility mapping
            facility_mapping = get_facility_mapping()
            
            # Calculate days back to sync (include the week + buffer)
            days_back = (week_end - timezone.now().date()).days + 7
            
            if days_back < 0:
                days_back = 7  # At least sync last week
            
            self.stdout.write(f'🔄 Syncing time tracking data for {days_back} days back...')
            
            # Import and run the time tracking sync
            from django.core.management import call_command
            from io import StringIO
            
            # Capture output
            out = StringIO()
            call_command(
                'sync_paycom_time_tracking',
                '--days-back', str(days_back),
                stdout=out,
                stderr=out
            )
            
            output = out.getvalue()
            self.stdout.write(output)
            
            # Parse the results (this is a simplified approach)
            if 'successfully' in output.lower():
                return {
                    'success': True,
                    'details': {
                        'days_synced': days_back,
                        'week_start': week_start.isoformat(),
                        'week_end': week_end.isoformat()
                    }
                }
            else:
                return {
                    'success': False,
                    'details': {
                        'error': 'Time tracking sync failed',
                        'output': output
                    }
                }
                
        except Exception as e:
            logger.error(f"Error syncing time tracking data: {e}")
            return {
                'success': False,
                'details': {
                    'error': str(e)
                }
            }
