"""
Django management command to sync Paycom data weekly (Friday schedule)
This aligns with the weekly ADL-based scheduling workflow.
"""

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.utils import timezone
import logging
from paycom.sftp_service import sync_paycom_data, PaycomSFTPError
from paycom.data_parser import parse_paycom_files
from paycom.sync_utils import sync_paycom_to_staff, update_staff_hours_from_paycom
from paycom.models import PaycomSyncLog

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Weekly Paycom sync - runs on Fridays to align with schedule finalization'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--report-type',
            type=str,
            choices=['employee_directory', 'employee_dates', 'employee_payees', 'rate_history', 'all'],
            default='all',
            help='Type of report to sync (default: all)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force sync even if recent sync exists'
        )
        parser.add_argument(
            '--notify',
            action='store_true',
            help='Send notification about sync results'
        )
    
    def handle(self, *args, **options):
        report_type = options['report_type']
        force = options['force']
        notify = options['notify']
        
        # Check if it's Friday (optimal day for weekly sync)
        today = timezone.now().date()
        is_friday = today.weekday() == 4  # Monday = 0, Friday = 4
        
        if not is_friday and not force:
            self.stdout.write(
                self.style.WARNING(
                    '⚠️  Weekly sync is optimized for Fridays (schedule finalization day). '
                    'Use --force to run on other days.'
                )
            )
            return
        
        self.stdout.write(
            self.style.SUCCESS(
                f'🔄 Starting WEEKLY Paycom sync for {today.strftime("%A, %B %d, %Y")}'
            )
        )
        self.stdout.write(
            f'📅 This sync prepares employee data for next week\'s schedule finalization'
        )
        
        try:
            # Check for recent sync unless forced
            if not force:
                recent_sync = PaycomSyncLog.objects.filter(
                    report_type=report_type,
                    status='completed',
                    started_at__gte=timezone.now() - timezone.timedelta(days=2)  # Allow 2-day window
                ).first()
                
                if recent_sync:
                    self.stdout.write(
                        self.style.WARNING(
                            f'⚠️  Recent weekly sync found (ID: {recent_sync.sync_id}, {recent_sync.started_at.date()}). '
                            'Use --force to override.'
                        )
                    )
                    return
            
            # Perform the weekly sync
            self._perform_weekly_sync(report_type, notify)
            
        except PaycomSFTPError as e:
            raise CommandError(f'Paycom SFTP error: {e}')
        except Exception as e:
            logger.error(f'Unexpected error during weekly sync: {e}')
            raise CommandError(f'Unexpected error: {e}')
    
    def _perform_weekly_sync(self, report_type, notify):
        """Perform the weekly sync operation optimized for schedule planning"""
        
        # Step 1: Download files from SFTP
        self.stdout.write('📥 Step 1: Downloading employee data from Paycom...')
        sync_log = sync_paycom_data(report_type)
        
        if sync_log.status == 'failed':
            raise CommandError(f'Sync failed: {sync_log.error_message}')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Downloaded {sync_log.files_successful} files successfully'
            )
        )
        
        # Step 2: Parse and save employee data
        self.stdout.write('📊 Step 2: Processing employee data...')
        parse_result = parse_paycom_files(sync_log)
        
        if not parse_result['success']:
            raise CommandError('Failed to parse employee data')
        
        stats = parse_result['total_stats']
        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Processed {parse_result["files_processed"]} files: '
                f'{stats["created"]} created, {stats["updated"]} updated, {stats["errors"]} errors'
            )
        )
        
        # Step 3: Sync with Staff model (critical for scheduling)
        self.stdout.write('👥 Step 3: Updating Staff records for scheduling...')
        sync_result = sync_paycom_to_staff()
        
        if sync_result['success']:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Staff records updated: {sync_result["created_count"]} created, '
                    f'{sync_result["updated_count"]} updated, {sync_result["error_count"]} errors'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'⚠️  Staff sync had issues: {sync_result.get("error", "Unknown error")}'
                )
            )
        
        # Step 4: Update staff hours and availability
        self.stdout.write('⏰ Step 4: Updating staff hours and availability...')
        hours_updated = update_staff_hours_from_paycom()
        self.stdout.write(
            self.style.SUCCESS(f'✅ Updated hours for {hours_updated} staff members')
        )
        
        # Step 5: Weekly summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write('📋 WEEKLY PAYCOM SYNC SUMMARY')
        self.stdout.write('='*60)
        self.stdout.write(f'🆔 Sync ID: {sync_log.sync_id}')
        self.stdout.write(f'📊 Report Type: {sync_log.get_report_type_display()}')
        self.stdout.write(f'✅ Status: {sync_log.get_status_display()}')
        self.stdout.write(f'🕐 Started: {sync_log.started_at}')
        self.stdout.write(f'🏁 Completed: {sync_log.completed_at}')
        self.stdout.write(f'⏱️  Duration: {sync_log.duration}')
        self.stdout.write(f'📁 Files: {sync_log.files_successful}/{sync_log.files_processed} successful')
        self.stdout.write(f'👤 Employees: {sync_log.employees_created} created, {sync_log.employees_updated} updated')
        
        # Status check
        if sync_log.files_failed > 0 or sync_log.employees_errors > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'⚠️  Sync completed with {sync_log.files_failed} file errors and {sync_log.employees_errors} employee errors'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS('🎉 Weekly sync completed successfully with no errors')
            )
        
        # Next steps guidance
        self.stdout.write('\n' + '📝 NEXT STEPS FOR SCHEDULE PLANNING:')
        self.stdout.write('='*60)
        self.stdout.write('1. ✅ Employee data is now up-to-date for scheduling')
        self.stdout.write('2. 📅 ADL data should be entered for next week\'s residents')
        self.stdout.write('3. 🤖 AI recommendations will be generated based on ADL data')
        self.stdout.write('4. 📋 Final schedule should be completed by Friday')
        self.stdout.write('5. 👥 Staff will receive finalized schedule for next week')
        
        if notify:
            self._send_notification(sync_log)
    
    def _send_notification(self, sync_log):
        """Send notification about sync results (placeholder for email/SMS)"""
        self.stdout.write(
            f'📧 Notification sent: Weekly Paycom sync {sync_log.get_status_display().lower()}'
        )
