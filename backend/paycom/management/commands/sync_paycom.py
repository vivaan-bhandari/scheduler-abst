"""
Django management command to sync Paycom data via SFTP
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
    help = 'Sync employee data from Paycom SFTP server'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--report-type',
            type=str,
            choices=['employee_directory', 'employee_dates', 'employee_payees', 'rate_history', 'all'],
            default='all',
            help='Type of report to sync (default: all)'
        )
        parser.add_argument(
            '--test-connection',
            action='store_true',
            help='Test SFTP connection without downloading files'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be downloaded without actually downloading'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force sync even if recent sync exists'
        )
    
    def handle(self, *args, **options):
        report_type = options['report_type']
        test_connection = options['test_connection']
        dry_run = options['dry_run']
        force = options['force']
        
        self.stdout.write(
            self.style.SUCCESS(f'Starting Paycom sync for report type: {report_type}')
        )
        
        try:
            # Test connection if requested
            if test_connection:
                self._test_connection()
                return
            
            # Check for recent sync unless forced
            if not force:
                recent_sync = PaycomSyncLog.objects.filter(
                    report_type=report_type,
                    status='completed',
                    started_at__gte=timezone.now() - timezone.timedelta(hours=1)
                ).first()
                
                if recent_sync:
                    self.stdout.write(
                        self.style.WARNING(
                            f'Recent sync found (ID: {recent_sync.sync_id}). Use --force to override.'
                        )
                    )
                    return
            
            # Dry run - show what would be downloaded
            if dry_run:
                self._dry_run(report_type)
                return
            
            # Perform actual sync
            self._perform_sync(report_type)
            
        except PaycomSFTPError as e:
            raise CommandError(f'Paycom SFTP error: {e}')
        except Exception as e:
            logger.error(f'Unexpected error during sync: {e}')
            raise CommandError(f'Unexpected error: {e}')
    
    def _test_connection(self):
        """Test SFTP connection"""
        from paycom.sftp_service import PaycomSFTPService
        
        self.stdout.write('Testing SFTP connection...')
        
        try:
            sftp_service = PaycomSFTPService()
            if sftp_service.test_connection():
                self.stdout.write(
                    self.style.SUCCESS('✓ SFTP connection successful')
                )
            else:
                self.stdout.write(
                    self.style.ERROR('✗ SFTP connection failed')
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'✗ SFTP connection error: {e}')
            )
    
    def _dry_run(self, report_type):
        """Show what would be downloaded without actually downloading"""
        from paycom.sftp_service import PaycomSFTPService
        
        self.stdout.write('Dry run - checking remote files...')
        
        try:
            sftp_service = PaycomSFTPService()
            files = sftp_service.list_remote_files("*.numbers")
            
            if not files:
                self.stdout.write(
                    self.style.WARNING('No .numbers files found in remote directory')
                )
                return
            
            self.stdout.write(f'Found {len(files)} files:')
            for file_info in files:
                self.stdout.write(f'  - {file_info["filename"]} ({file_info["size"]} bytes)')
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error listing files: {e}')
            )
    
    def _perform_sync(self, report_type):
        """Perform the actual sync operation"""
        # Step 1: Download files from SFTP
        self.stdout.write('Step 1: Downloading files from Paycom SFTP...')
        sync_log = sync_paycom_data(report_type)
        
        if sync_log.status == 'failed':
            raise CommandError(f'Sync failed: {sync_log.error_message}')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Downloaded {sync_log.files_successful} files successfully'
            )
        )
        
        # Step 2: Parse and save employee data
        self.stdout.write('Step 2: Parsing and saving employee data...')
        parse_result = parse_paycom_files(sync_log)
        
        if not parse_result['success']:
            raise CommandError('Failed to parse employee data')
        
        stats = parse_result['total_stats']
        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Parsed {parse_result["files_processed"]} files: '
                f'{stats["created"]} created, {stats["updated"]} updated, {stats["errors"]} errors'
            )
        )
        
        # Step 3: Sync with Staff model
        self.stdout.write('Step 3: Syncing with Staff model...')
        sync_result = sync_paycom_to_staff()
        
        if sync_result['success']:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Staff sync completed: {sync_result["created_count"]} created, '
                    f'{sync_result["updated_count"]} updated, {sync_result["error_count"]} errors'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'⚠ Staff sync had issues: {sync_result.get("error", "Unknown error")}'
                )
            )
        
        # Step 4: Update staff hours
        self.stdout.write('Step 4: Updating staff hours...')
        hours_updated = update_staff_hours_from_paycom()
        self.stdout.write(
            self.style.SUCCESS(f'✓ Updated hours for {hours_updated} staff members')
        )
        
        # Step 5: Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write('SYNC SUMMARY')
        self.stdout.write('='*50)
        self.stdout.write(f'Sync ID: {sync_log.sync_id}')
        self.stdout.write(f'Report Type: {sync_log.get_report_type_display()}')
        self.stdout.write(f'Status: {sync_log.get_status_display()}')
        self.stdout.write(f'Started: {sync_log.started_at}')
        self.stdout.write(f'Completed: {sync_log.completed_at}')
        self.stdout.write(f'Duration: {sync_log.duration}')
        self.stdout.write(f'Files Processed: {sync_log.files_processed}')
        self.stdout.write(f'Files Successful: {sync_log.files_successful}')
        self.stdout.write(f'Files Failed: {sync_log.files_failed}')
        self.stdout.write(f'Employees Processed: {sync_log.employees_processed}')
        self.stdout.write(f'Employees Created: {sync_log.employees_created}')
        self.stdout.write(f'Employees Updated: {sync_log.employees_updated}')
        self.stdout.write(f'Employees Errors: {sync_log.employees_errors}')
        
        if sync_log.files_failed > 0 or sync_log.employees_errors > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'⚠️  Sync completed with {sync_log.files_failed} file errors and {sync_log.employees_errors} employee errors'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS('✓ Sync completed successfully with no errors')
            )
