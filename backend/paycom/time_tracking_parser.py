"""
Paycom Time Tracking Data Parser
Handles time tracking reports from Paycom SFTP to track actual hours worked
"""

import csv
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError

from scheduling.models import Staff, TimeTracking, WeeklyHoursSummary
from residents.models import Facility

logger = logging.getLogger(__name__)


class PaycomTimeTrackingParser:
    """Parse and sync Paycom time tracking data"""
    
    def __init__(self):
        self.sync_stats = {
            'processed': 0,
            'created': 0,
            'updated': 0,
            'errors': 0,
            'skipped': 0
        }
    
    def parse_time_tracking_file(self, file_path: str, facility_mapping: Dict[str, int] = None) -> Dict[str, Any]:
        """
        Parse Paycom time tracking CSV file
        
        Expected CSV format:
        Employee_ID,Employee_Name,Date,Clock_In,Clock_Out,Break_Start,Break_End,Total_Hours,Regular_Hours,Overtime_Hours,Facility_Code
        
        Args:
            file_path: Path to the CSV file
            facility_mapping: Optional mapping of facility codes to facility IDs
            
        Returns:
            Dictionary with parsing results and statistics
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                # Detect delimiter
                sample = file.read(1024)
                file.seek(0)
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                
                reader = csv.DictReader(file, delimiter=delimiter)
                
                # Process each row
                for row_num, row in enumerate(reader, start=2):
                    try:
                        self._process_time_tracking_row(row, facility_mapping)
                        self.sync_stats['processed'] += 1
                    except Exception as e:
                        logger.error(f"Error processing row {row_num}: {e}")
                        self.sync_stats['errors'] += 1
                        continue
                
                # Generate weekly summaries after processing all time tracking data
                self._generate_weekly_summaries()
                
                return {
                    'success': True,
                    'message': 'Time tracking data parsed successfully',
                    'stats': self.sync_stats
                }
                
        except Exception as e:
            logger.error(f"Error parsing time tracking file {file_path}: {e}")
            return {
                'success': False,
                'message': f'Error parsing time tracking file: {e}',
                'stats': self.sync_stats
            }
    
    def _process_time_tracking_row(self, row: Dict[str, str], facility_mapping: Dict[str, int] = None):
        """Process a single time tracking row"""
        
        # Extract and validate data - handle both expected format and actual Paycom format
        # Expected format: Employee_ID,Employee_Name,Date,Clock_In,Clock_Out,Break_Start,Break_End,Total_Hours,Regular_Hours,Overtime_Hours,Facility_Code
        # Actual Paycom format: EECode,Lastname,Firstname,HomeDepartment,HomeAllocation,Pay Class,Badge,InPunchTime,OutPunchTime,Allocation,EarnCode,EarnHours,Dollars,...
        
        # Try Paycom format first
        if 'EECode' in row and 'InPunchTime' in row:
            employee_id = row.get('EECode', '').strip()
            employee_name = f"{row.get('Firstname', '').strip()} {row.get('Lastname', '').strip()}".strip()
            clock_in_str = row.get('InPunchTime', '').strip()
            clock_out_str = row.get('OutPunchTime', '').strip()
            earn_hours = row.get('EarnHours', '').strip()
            facility_desc = row.get('Home Location Desc', '').strip()
            
            # Extract date from clock_in_str (format: 2025-10-01 06:40:00)
            if clock_in_str and ' ' in clock_in_str:
                date_str = clock_in_str.split(' ')[0]
            else:
                date_str = ''
                
            # No break data in Paycom format
            break_start_str = ''
            break_end_str = ''
            facility_code = ''
        else:
            # Fall back to expected format
            employee_id = row.get('Employee_ID', '').strip()
            employee_name = row.get('Employee_Name', '').strip()
            date_str = row.get('Date', '').strip()
            clock_in_str = row.get('Clock_In', '').strip()
            clock_out_str = row.get('Clock_Out', '').strip()
            break_start_str = row.get('Break_Start', '').strip()
            break_end_str = row.get('Break_End', '').strip()
            facility_code = row.get('Facility_Code', '').strip()
            earn_hours = ''
            facility_desc = ''
        
        # Skip empty rows
        if not employee_id or not date_str:
            self.sync_stats['skipped'] += 1
            return
        
        # Parse dates and times
        try:
            # Handle invalid dates like 0000-00-00
            if not date_str or date_str == '0000-00-00' or '0000-00-00' in date_str:
                logger.debug(f"Skipping row with invalid date '{date_str}' for employee {employee_id}")
                self.sync_stats['skipped'] += 1
                return
                
            work_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            clock_in = self._parse_datetime(clock_in_str, work_date)
            clock_out = self._parse_datetime(clock_out_str, work_date) if clock_out_str else None
            break_start = self._parse_datetime(break_start_str, work_date) if break_start_str else None
            break_end = self._parse_datetime(break_end_str, work_date) if break_end_str else None
        except ValueError as e:
            logger.error(f"Error parsing date/time for employee {employee_id}: {e}")
            self.sync_stats['errors'] += 1
            return
        
        # Find or create staff member - use facility_desc for Paycom format
        if facility_desc:
            staff = self._get_or_create_staff(employee_id, employee_name, facility_desc, facility_mapping)
        else:
            staff = self._get_or_create_staff(employee_id, employee_name, facility_code, facility_mapping)
        if not staff:
            self.sync_stats['errors'] += 1
            return
        
        # Create or update time tracking record
        self._create_or_update_time_tracking(
            staff=staff,
            work_date=work_date,
            clock_in=clock_in,
            clock_out=clock_out,
            break_start=break_start,
            break_end=break_end
        )
    
    def _parse_datetime(self, datetime_str: str, default_date: date) -> Optional[datetime]:
        """Parse datetime string with various formats and make timezone-aware"""
        if not datetime_str:
            return None
        
        # Handle invalid dates like 0000-00-00
        if '0000-00-00' in datetime_str or datetime_str.startswith('0000-00-00'):
            logger.debug(f"Skipping invalid date: {datetime_str}")
            return None
        
        # Common datetime formats from Paycom
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%m/%d/%Y %H:%M:%S',
            '%m/%d/%Y %H:%M',
            '%H:%M:%S',
            '%H:%M'
        ]
        
        parsed_dt = None
        for fmt in formats:
            try:
                if fmt in ['%H:%M:%S', '%H:%M']:
                    # Time only, combine with default date
                    time_part = datetime.strptime(datetime_str, fmt).time()
                    parsed_dt = datetime.combine(default_date, time_part)
                else:
                    # Full datetime
                    parsed_dt = datetime.strptime(datetime_str, fmt)
                
                # Make timezone-aware (Django requires this)
                if parsed_dt and timezone.is_naive(parsed_dt):
                    parsed_dt = timezone.make_aware(parsed_dt)
                
                return parsed_dt
            except ValueError:
                continue
        
        logger.error(f"Could not parse datetime: {datetime_str}")
        return None
    
    def _get_or_create_staff(self, employee_id: str, employee_name: str, facility_code: str, facility_mapping: Dict[str, int] = None) -> Optional[Staff]:
        """Get or create staff member"""
        try:
            # Try to find existing staff by employee_id
            staff = Staff.objects.filter(employee_id=employee_id).first()
            
            if staff:
                return staff
            
            # If not found, create new staff (this should be rare if employee sync is working)
            logger.warning(f"Staff not found for employee_id {employee_id}, creating new record")
            
            # Parse name
            name_parts = employee_name.split(' ', 1)
            first_name = name_parts[0] if name_parts else employee_name
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Get facility - handle both facility_code and facility_desc
            facility = None
            if facility_code and facility_mapping:
                facility_id = facility_mapping.get(facility_code)
                if facility_id:
                    facility = Facility.objects.filter(id=facility_id).first()
            
            # If facility_code didn't work, try facility_desc (Paycom format)
            if not facility and facility_code:
                # Try to find facility by name/description
                facility = Facility.objects.filter(name__icontains=facility_code).first()
                if not facility:
                    # Try common facility name mappings
                    facility_name_mappings = {
                        'Posada SL': 'Posada SL',
                        'Murray Highland': 'Murray Highland',
                        'Buena Vista': 'Buena Vista'
                    }
                    for key, value in facility_name_mappings.items():
                        if key in facility_code:
                            facility = Facility.objects.filter(name__icontains=value).first()
                            break
            
            if not facility:
                # Default to first facility if mapping fails
                facility = Facility.objects.first()
                logger.warning(f"Using default facility for employee {employee_id}")
            
            # Create staff record
            staff = Staff.objects.create(
                employee_id=employee_id,
                first_name=first_name,
                last_name=last_name,
                email=f"{employee_id}@temp.com",  # Temporary email
                role='caregiver',  # Default role
                hire_date=date.today(),
                facility=facility,
                status='active'
            )
            
            logger.info(f"Created new staff record for {employee_id}")
            return staff
            
        except Exception as e:
            logger.error(f"Error getting/creating staff for {employee_id}: {e}")
            return None
    
    def _create_or_update_time_tracking(self, staff: Staff, work_date: date, clock_in: datetime, 
                                      clock_out: Optional[datetime] = None, break_start: Optional[datetime] = None, 
                                      break_end: Optional[datetime] = None):
        """Create or update time tracking record"""
        try:
            with transaction.atomic():
                # Check if record already exists
                time_tracking, created = TimeTracking.objects.get_or_create(
                    staff=staff,
                    date=work_date,
                    defaults={
                        'clock_in': clock_in,
                        'clock_out': clock_out,
                        'break_start': break_start,
                        'break_end': break_end,
                        'status': 'clocked_out' if clock_out else 'clocked_in',
                        'facility': staff.facility,
                        'paycom_sync_date': timezone.now(),
                        'paycom_employee_id': staff.employee_id
                    }
                )
                
                if not created:
                    # Update existing record
                    time_tracking.clock_in = clock_in
                    time_tracking.clock_out = clock_out
                    time_tracking.break_start = break_start
                    time_tracking.break_end = break_end
                    time_tracking.status = 'clocked_out' if clock_out else 'clocked_in'
                    time_tracking.paycom_sync_date = timezone.now()
                    time_tracking.save()
                    self.sync_stats['updated'] += 1
                else:
                    self.sync_stats['created'] += 1
                
                logger.debug(f"{'Created' if created else 'Updated'} time tracking for {staff.full_name} on {work_date}")
                
        except Exception as e:
            logger.error(f"Error creating/updating time tracking for {staff.full_name} on {work_date}: {e}")
            self.sync_stats['errors'] += 1
    
    def _generate_weekly_summaries(self):
        """Generate weekly hours summaries for all staff"""
        try:
            # Get all unique staff and weeks from time tracking data
            time_tracking_data = TimeTracking.objects.filter(
                clock_out__isnull=False
            ).values('staff', 'date').distinct()
            
            processed_weeks = set()
            
            for record in time_tracking_data:
                staff_id = record['staff']
                work_date = record['date']
                
                # Calculate week start date (Monday)
                week_start = work_date - timedelta(days=work_date.weekday())
                week_end = week_start + timedelta(days=6)
                
                # Skip if we've already processed this staff/week combination
                week_key = f"{staff_id}_{week_start}"
                if week_key in processed_weeks:
                    continue
                processed_weeks.add(week_key)
                
                # Generate summary for this week
                self._create_weekly_summary(staff_id, week_start, week_end)
                
        except Exception as e:
            logger.error(f"Error generating weekly summaries: {e}")
    
    def _create_weekly_summary(self, staff_id: int, week_start: date, week_end: date):
        """Create weekly hours summary for a staff member"""
        try:
            staff = Staff.objects.get(id=staff_id)
            
            # Get all time tracking records for this week
            time_records = TimeTracking.objects.filter(
                staff=staff,
                date__gte=week_start,
                date__lte=week_end,
                clock_out__isnull=False
            )
            
            # Calculate totals
            total_hours = sum(record.total_hours_worked for record in time_records)
            regular_hours = sum(record.regular_hours for record in time_records)
            overtime_hours = sum(record.overtime_hours for record in time_records)
            
            # Get or create weekly summary
            weekly_summary, created = WeeklyHoursSummary.objects.get_or_create(
                staff=staff,
                week_start_date=week_start,
                defaults={
                    'week_end_date': week_end,
                    'total_hours_worked': total_hours,
                    'regular_hours': regular_hours,
                    'overtime_hours': overtime_hours,
                    'regular_rate': 0.00,  # Will be updated when pay rates are available
                    'overtime_rate': 0.00,  # Will be updated when pay rates are available
                    'total_cost': 0.00,  # Will be calculated when rates are available
                    'paycom_sync_date': timezone.now()
                }
            )
            
            if not created:
                # Update existing summary
                weekly_summary.week_end_date = week_end
                weekly_summary.total_hours_worked = total_hours
                weekly_summary.regular_hours = regular_hours
                weekly_summary.overtime_hours = overtime_hours
                weekly_summary.paycom_sync_date = timezone.now()
                weekly_summary.save()
            
            logger.debug(f"{'Created' if created else 'Updated'} weekly summary for {staff.full_name} week of {week_start}")
            
        except Exception as e:
            logger.error(f"Error creating weekly summary for staff {staff_id} week {week_start}: {e}")


def sync_paycom_time_tracking(file_path: str, facility_mapping: Dict[str, int] = None) -> Dict[str, Any]:
    """
    Main function to sync Paycom time tracking data
    
    Args:
        file_path: Path to the Paycom time tracking CSV file
        facility_mapping: Optional mapping of facility codes to facility IDs
        
    Returns:
        Dictionary with sync results
    """
    parser = PaycomTimeTrackingParser()
    return parser.parse_time_tracking_file(file_path, facility_mapping)
