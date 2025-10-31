"""
Django management command to sync Paycom time tracking data
Runs daily to get actual clock in/out times and hours worked
"""

import os
import logging
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.utils import timezone
from datetime import datetime, timedelta

from paycom.sftp_service import PaycomSFTPService
from paycom.time_tracking_parser import sync_paycom_time_tracking
from paycom.facility_mapping import get_facility_mapping

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync Paycom time tracking data (clock in/out times and hours worked)'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            help='Path to specific time tracking CSV file to process'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be processed without making changes'
        )
        parser.add_argument(
            '--days-back',
            type=int,
            default=7,
            help='Number of days back to look for time tracking files (default: 7)'
        )
        parser.add_argument(
            '--facility-mapping',
            type=str,
            help='Path to facility mapping CSV file'
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        days_back = options['days_back']
        specific_file = options['file']
        facility_mapping_file = options['facility_mapping']
        
        self.stdout.write(
            self.style.SUCCESS(f'Starting Paycom time tracking sync at {timezone.now()}')
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made')
            )
        
        try:
            # Get facility mapping
            facility_mapping = None
            if facility_mapping_file:
                facility_mapping = get_facility_mapping(facility_mapping_file)
            else:
                # Use default facility mapping
                facility_mapping = get_facility_mapping()
            
            if specific_file:
                # Process specific file
                self._process_single_file(specific_file, facility_mapping, dry_run)
            else:
                # Process files from SFTP
                self._process_sftp_files(days_back, facility_mapping, dry_run)
                
        except Exception as e:
            logger.error(f"Error in time tracking sync: {e}")
            raise CommandError(f'Time tracking sync failed: {e}')
    
    def _process_single_file(self, file_path: str, facility_mapping: dict, dry_run: bool):
        """Process a single time tracking file"""
        if not os.path.exists(file_path):
            raise CommandError(f'File not found: {file_path}')
        
        self.stdout.write(f'Processing file: {file_path}')
        
        if dry_run:
            self.stdout.write(f'Would process: {file_path}')
            return
        
        # Process the file
        result = sync_paycom_time_tracking(file_path, facility_mapping)
        
        if result['success']:
            self.stdout.write(
                self.style.SUCCESS(f"Successfully processed {file_path}")
            )
            self._display_stats(result['stats'])
        else:
            self.stdout.write(
                self.style.ERROR(f"Failed to process {file_path}: {result['message']}")
            )
    
    def _process_sftp_files(self, days_back: int, facility_mapping: dict, dry_run: bool):
        """Process time tracking files from SFTP"""
        try:
            # Initialize SFTP service
            sftp_service = PaycomSFTPService()
            
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            self.stdout.write(
                f'Looking for time tracking files from {start_date.date()} to {end_date.date()}'
            )
            
            # Connect to SFTP
            with sftp_service.connect() as sftp:
                # Look for time tracking files
                time_tracking_files = self._find_time_tracking_files(sftp, start_date, end_date)
                
                if not time_tracking_files:
                    self.stdout.write(
                        self.style.WARNING('No time tracking files found in the specified date range')
                    )
                    return
                
                self.stdout.write(f'Found {len(time_tracking_files)} time tracking files')
                
                # Process each file
                total_stats = {
                    'processed': 0,
                    'created': 0,
                    'updated': 0,
                    'errors': 0,
                    'skipped': 0
                }
                
                for file_info in time_tracking_files:
                    self.stdout.write(f'Processing: {file_info["filename"]}')
                    
                    if dry_run:
                        self.stdout.write(f'Would download and process: {file_info["filename"]}')
                        continue
                    
                    # Download file using existing SFTP connection
                    local_path = sftp_service.download_file(file_info['filepath'], sftp_client=sftp)
                    
                    try:
                        # Process the file
                        result = sync_paycom_time_tracking(local_path, facility_mapping)
                        
                        if result['success']:
                            self.stdout.write(
                                self.style.SUCCESS(f"Successfully processed {file_info['filename']}")
                            )
                            # Accumulate stats
                            for key in total_stats:
                                total_stats[key] += result['stats'].get(key, 0)
                        else:
                            self.stdout.write(
                                self.style.ERROR(f"Failed to process {file_info['filename']}: {result['message']}")
                            )
                            total_stats['errors'] += 1
                    
                    finally:
                        # Clean up local file
                        if os.path.exists(local_path):
                            os.remove(local_path)
                
                # Display final stats
                if not dry_run:
                    self.stdout.write('\n' + '='*50)
                    self.stdout.write('FINAL SYNC STATISTICS')
                    self.stdout.write('='*50)
                    self._display_stats(total_stats)
                
        except Exception as e:
            logger.error(f"Error processing SFTP files: {e}")
            raise CommandError(f'Error processing SFTP files: {e}')
    
    def _find_time_tracking_files(self, sftp, start_date: datetime, end_date: datetime) -> list:
        """Find time tracking files in the specified date range"""
        files = []
        
        try:
            # List files in the SFTP Outbound directory
            remote_files = sftp.listdir_attr('/Outbound')
            
            for file_attr in remote_files:
                filename = file_attr.filename
                
                # Check if this looks like a time tracking file
                if self._is_time_tracking_file(filename):
                    # Check if file is in date range
                    file_date = datetime.fromtimestamp(file_attr.st_mtime)
                    if start_date <= file_date <= end_date:
                        files.append({
                            'filename': filename,
                            'filepath': filename,  # Just the filename, not the full path
                            'date': file_date,
                            'size': file_attr.st_size
                        })
            
            # Sort by date (newest first)
            files.sort(key=lambda x: x['date'], reverse=True)
            
        except Exception as e:
            logger.error(f"Error listing SFTP files: {e}")
            raise
        
        return files
    
    def _is_time_tracking_file(self, filename: str) -> bool:
        """Check if filename looks like a time tracking file"""
        filename_lower = filename.lower()
        
        # Common patterns for time tracking files
        time_tracking_patterns = [
            'time_tracking',
            'time_detail_report',
            'clock_in_out',
            'hours_worked',
            'timesheet',
            'punch_data',
            'attendance'
        ]
        
        # Check for time tracking patterns
        for pattern in time_tracking_patterns:
            if pattern in filename_lower:
                return True
        
        # Check for CSV extension
        if filename_lower.endswith('.csv'):
            # Additional check for time-related keywords
            time_keywords = ['time', 'clock', 'hours', 'punch', 'attendance']
            for keyword in time_keywords:
                if keyword in filename_lower:
                    return True
        
        return False
    
    def _display_stats(self, stats: dict):
        """Display sync statistics"""
        self.stdout.write(f"Records processed: {stats['processed']}")
        self.stdout.write(f"Time tracking records created: {stats['created']}")
        self.stdout.write(f"Time tracking records updated: {stats['updated']}")
        self.stdout.write(f"Records skipped: {stats['skipped']}")
        self.stdout.write(f"Errors: {stats['errors']}")
        
        if stats['errors'] > 0:
            self.stdout.write(
                self.style.WARNING(f"⚠️  {stats['errors']} errors occurred during sync")
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("✅ All records processed successfully")
            )
