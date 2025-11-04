"""
Data parser for Paycom Numbers files
Handles extraction and parsing of employee data from various report types
"""

import os
import logging
import zipfile
import xml.etree.ElementTree as ET
import re
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Any
from django.utils import timezone
from .models import PaycomEmployee, PaycomFile, PaycomSyncLog

logger = logging.getLogger(__name__)


class PaycomDataParserError(Exception):
    """Custom exception for Paycom data parsing operations"""
    pass


class PaycomDataParser:
    """Parser for Paycom Numbers files"""
    
    def __init__(self):
        self.employee_data = {}
        self.processed_files = []
    
    def parse_file(self, paycom_file: PaycomFile) -> Dict[str, Any]:
        """Parse a single Paycom Numbers file"""
        try:
            logger.info(f"Parsing file: {paycom_file.filename}")
            
            # Extract data from CSV file
            if paycom_file.file_path.endswith('.csv'):
                raw_data = self._extract_csv_data(paycom_file.file_path)
            else:
                raw_data = self._extract_numbers_data(paycom_file.file_path)
            
            # Parse based on file type
            if paycom_file.file_type == 'employee_directory':
                parsed_data = self._parse_employee_directory(raw_data)
            elif paycom_file.file_type == 'employee_dates':
                parsed_data = self._parse_employee_dates(raw_data)
            elif paycom_file.file_type == 'employee_payees':
                parsed_data = self._parse_employee_payees(raw_data)
            else:
                logger.warning(f"Unknown file type: {paycom_file.file_type}")
                parsed_data = []
            
            # Update file record
            paycom_file.rows_processed = len(parsed_data)
            paycom_file.rows_successful = len([d for d in parsed_data if d.get('success', False)])
            paycom_file.rows_failed = len([d for d in parsed_data if not d.get('success', False)])
            paycom_file.status = 'processed'
            paycom_file.processed_at = timezone.now()
            paycom_file.save()
            
            logger.info(f"Successfully parsed {paycom_file.filename}: {paycom_file.rows_successful} successful, {paycom_file.rows_failed} failed")
            
            return {
                'file': paycom_file,
                'data': parsed_data,
                'success': True
            }
            
        except Exception as e:
            logger.error(f"Failed to parse file {paycom_file.filename}: {e}")
            paycom_file.status = 'failed'
            paycom_file.error_message = str(e)
            paycom_file.save()
            
            return {
                'file': paycom_file,
                'data': [],
                'success': False,
                'error': str(e)
            }
    
    def _extract_csv_data(self, file_path: str) -> List[Dict[str, str]]:
        """Extract data from CSV file"""
        import csv
        try:
            data = []
            with open(file_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    data.append(row)
            return data
        except Exception as e:
            logger.error(f"Failed to extract data from CSV file {file_path}: {e}")
            raise PaycomDataParserError(f"Failed to extract CSV data: {e}")
    
    def _extract_numbers_data(self, file_path: str) -> List[str]:
        """Extract raw data from Numbers file"""
        try:
            with zipfile.ZipFile(file_path, 'r') as zip_file:
                # Look for data in the Index/Tables/ directory
                data_files = [f for f in zip_file.namelist() if 'Index/Tables/DataList-' in f]
                
                extracted_data = []
                
                for data_file in data_files:
                    try:
                        content = zip_file.read(data_file)
                        # Try to parse as XML
                        root = ET.fromstring(content)
                        
                        # Extract text content
                        text_content = []
                        for elem in root.iter():
                            if elem.text and elem.text.strip():
                                text_content.append(elem.text.strip())
                        
                        if text_content:
                            extracted_data.extend(text_content)
                            
                    except ET.ParseError:
                        # If not XML, try to decode as text
                        try:
                            text_content = content.decode('utf-8', errors='ignore')
                            if text_content.strip():
                                extracted_data.append(text_content.strip())
                        except:
                            pass
                
                return extracted_data
                
        except Exception as e:
            logger.error(f"Failed to extract data from Numbers file {file_path}: {e}")
            raise PaycomDataParserError(f"Failed to extract data: {e}")
    
    def _parse_employee_directory(self, raw_data) -> List[Dict[str, Any]]:
        """Parse employee directory data from CSV"""
        employees = []
        
        if isinstance(raw_data, list) and len(raw_data) > 0 and isinstance(raw_data[0], dict):
            # CSV data - process each row
            for row in raw_data:
                employee_data = {}
                
                # Map CSV columns to employee fields
                employee_data['employee_id'] = row.get('EECode', row.get('Employee ID', ''))
                
                # Parse name from "LAST, FIRST" format
                ee_name = row.get('EE Name', '')
                if ee_name and ',' in ee_name:
                    name_parts = ee_name.split(',', 1)
                    employee_data['last_name'] = name_parts[0].strip()
                    employee_data['first_name'] = name_parts[1].strip()
                else:
                    employee_data['first_name'] = row.get('First Name', '')
                    employee_data['last_name'] = row.get('Last Name', '')
                
                # Basic info
                employee_data['nickname'] = row.get('Nickname', '')
                employee_data['status'] = 'active' if row.get('Status', '').upper() in ['V', 'A'] else 'inactive'
                
                # Department and role information
                employee_data['department_code'] = row.get('Department', '')
                employee_data['department_description'] = row.get('Department Desc', '')
                employee_data['payroll_profile'] = row.get('Payroll Profile', '')
                employee_data['payroll_profile_description'] = row.get('Payroll Profile Desc', '')
                employee_data['location_code'] = row.get('Location', '')
                employee_data['location_description'] = row.get('Location Desc', '')
                employee_data['position_family'] = row.get('Position Family', '')
                employee_data['position_description'] = row.get('Position', '')
                
                # Contact information
                employee_data['work_email'] = row.get('Work Email', '')
                employee_data['phone_number'] = row.get('Phone #', '')
                employee_data['personal_phone'] = row.get('Secondary Phone #', '')
                
                # Address information
                employee_data['street_address'] = row.get('Street Address', '')
                employee_data['city'] = row.get('City', '')
                employee_data['state'] = row.get('State', '')
                employee_data['zip_code'] = row.get('Zip', '')
                
                if employee_data['employee_id']:
                    employees.append(self._finalize_employee(employee_data))
        else:
            # Fallback to old parsing logic for non-CSV data
            current_employee = {}
            for line in raw_data:
                line = line.strip()
                if not line:
                    continue
                
                # Look for employee ID patterns
                if re.match(r'^\d+$', line) and len(line) >= 3:
                    if current_employee:
                        employees.append(self._finalize_employee(current_employee))
                    current_employee = {'employee_id': line}
                
                # Look for name patterns (Last, First)
                elif re.match(r'^[A-Z][A-Z\s,]+$', line) and ',' in line:
                    if current_employee:
                        name_parts = line.split(',')
                        if len(name_parts) >= 2:
                            current_employee['last_name'] = name_parts[0].strip()
                            current_employee['first_name'] = name_parts[1].strip()
                
                # Look for email patterns
                elif '@' in line and '.' in line:
                    if current_employee:
                        current_employee['work_email'] = line
                
                # Look for phone patterns
                elif re.match(r'^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$', line):
                    if current_employee:
                        current_employee['phone_number'] = line
                
                # Look for department/location patterns
                elif any(keyword in line.upper() for keyword in ['NURSING', 'ADMIN', 'MAINTENANCE', 'DIETARY']):
                    if current_employee:
                        current_employee['department_description'] = line
            
            # Add the last employee if exists
            if current_employee:
                employees.append(self._finalize_employee(current_employee))
        
        return employees
    
    def _parse_employee_dates(self, raw_data) -> List[Dict[str, Any]]:
        """Parse employee dates data from CSV"""
        employees = []
        
        if isinstance(raw_data, list) and len(raw_data) > 0 and isinstance(raw_data[0], dict):
            # CSV data - process each row
            for row in raw_data:
                employee_data = {}
                
                # Map CSV columns to employee fields
                employee_data['employee_id'] = row.get('EE Code', row.get('Employee ID', ''))
                
                # Parse name from "LAST, FIRST" format
                ee_name = row.get('EE Name', '')
                if ee_name and ',' in ee_name:
                    name_parts = ee_name.split(',', 1)
                    employee_data['last_name'] = name_parts[0].strip()
                    employee_data['first_name'] = name_parts[1].strip()
                else:
                    employee_data['first_name'] = row.get('First Name', '')
                    employee_data['last_name'] = row.get('Last Name', '')
                
                # Department and role information (from dates file)
                employee_data['department_code'] = row.get('Department', '')
                employee_data['department_description'] = row.get('Department Desc', '')
                employee_data['payroll_profile'] = row.get('Payroll Profile', '')
                employee_data['payroll_profile_description'] = row.get('Payroll Profile Desc', '')
                employee_data['location_code'] = row.get('Location', '')
                employee_data['location_description'] = row.get('Location Desc', '')
                employee_data['position_family'] = row.get('Position Family', '')
                employee_data['position_description'] = row.get('Position', '')
                
                # Dates
                employee_data['employee_added_date'] = self._parse_date(row.get('Employee Added', ''))
                employee_data['birth_date'] = self._parse_date(row.get('Birth Date', ''))
                employee_data['hire_date'] = self._parse_date(row.get('Hire Date', ''))
                employee_data['rehire_date'] = self._parse_date(row.get('Re-hire Date', ''))
                employee_data['termination_date'] = self._parse_date(row.get('Termination Date', ''))
                employee_data['last_review_date'] = self._parse_date(row.get('Last Review', ''))
                employee_data['pay_change_date'] = self._parse_date(row.get('Last Pay Change', ''))
                
                # Benefits and eligibility
                employee_data['cobra_start_date'] = self._parse_date(row.get('Cobra Start', ''))
                employee_data['on_leave_date'] = self._parse_date(row.get('On Leave Start', ''))
                employee_data['k401_eligibility_date'] = self._parse_date(row.get('401k Eligibility Date', ''))
                
                # Part-time/Full-time status
                employee_data['part_time_to_full_time'] = row.get('Part-Time to Full-Time', '').upper() == 'YES'
                
                if employee_data['employee_id']:
                    employees.append(self._finalize_employee(employee_data))
        else:
            # Fallback to old parsing logic for non-CSV data
            current_employee = {}
            for line in raw_data:
                line = line.strip()
                if not line:
                    continue
                
                # Look for date patterns
                date_patterns = [
                    r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
                    r'\d{2}/\d{2}/\d{4}',  # MM/DD/YYYY
                    r'\d{1,2}/\d{1,2}/\d{4}',  # M/D/YYYY
                ]
                
                for pattern in date_patterns:
                    if re.search(pattern, line):
                        if current_employee:
                            # Try to determine what type of date this is
                            if 'hire' in line.lower() or 'start' in line.lower():
                                current_employee['hire_date'] = self._parse_date(line)
                            elif 'terminat' in line.lower() or 'end' in line.lower():
                                current_employee['termination_date'] = self._parse_date(line)
                            elif 'birth' in line.lower():
                                current_employee['birth_date'] = self._parse_date(line)
            
            # Add the last employee if exists
            if current_employee:
                employees.append(self._finalize_employee(current_employee))
        
        return employees
    
    def _parse_employee_payees(self, raw_data) -> List[Dict[str, Any]]:
        """Parse employee payees data from CSV"""
        employees = []
        
        if isinstance(raw_data, list) and len(raw_data) > 0 and isinstance(raw_data[0], dict):
            # CSV data - process each row
            for row in raw_data:
                employee_data = {}
                
                # Map CSV columns to employee fields
                employee_data['employee_id'] = row.get('EE Code', row.get('Employee ID', ''))
                
                # Parse name from "LAST, FIRST" format
                ee_name = row.get('EE Name', '')
                if ee_name and ',' in ee_name:
                    name_parts = ee_name.split(',', 1)
                    employee_data['last_name'] = name_parts[0].strip()
                    employee_data['first_name'] = name_parts[1].strip()
                else:
                    employee_data['first_name'] = row.get('First Name', '')
                    employee_data['last_name'] = row.get('Last Name', '')
                
                # Department and role information (from payees file)
                employee_data['department_code'] = row.get('Department Code', '')
                employee_data['department_description'] = row.get('Department Desc', '')
                employee_data['payroll_profile'] = row.get('Payroll Profile Code', '')
                employee_data['payroll_profile_description'] = row.get('Payroll Profile Desc', '')
                employee_data['location_code'] = row.get('Location Code', '')
                employee_data['location_description'] = row.get('Location Desc', '')
                
                # Payee information
                employee_data['case_reference'] = row.get('Case Reference', '')
                
                # Address information
                employee_data['street_address'] = row.get('Street', '')
                employee_data['city'] = row.get('City', '')
                employee_data['state'] = row.get('State', '')
                employee_data['zip_code'] = row.get('Zipcode', '')
                employee_data['country'] = row.get('Country Code', '')
                
                if employee_data['employee_id']:
                    employees.append(self._finalize_employee(employee_data))
        else:
            # Fallback to old parsing logic for non-CSV data
            current_employee = {}
            for line in raw_data:
                line = line.strip()
                if not line:
                    continue
                
                # Look for monetary amounts
                money_pattern = r'\$?[\d,]+\.?\d*'
                if re.search(money_pattern, line):
                    amount = self._parse_decimal(line)
                    if amount is not None:
                        if current_employee:
                            if 'rate' in line.lower() or 'hourly' in line.lower():
                                current_employee['hourly_rate'] = amount
                            elif 'salary' in line.lower():
                                current_employee['salary'] = amount
            
            # Add the last employee if exists
            if current_employee:
                employees.append(self._finalize_employee(current_employee))
        
        return employees
    
    def _finalize_employee(self, employee_data: Dict[str, Any]) -> Dict[str, Any]:
        """Finalize employee data and add success flag"""
        employee_data['success'] = True
        employee_data['parsed_at'] = timezone.now()
        return employee_data
    
    def _parse_date(self, date_string: str) -> Optional[date]:
        """Parse date string into date object"""
        date_formats = [
            '%Y-%m-%d',
            '%m/%d/%Y',
            '%m/%d/%y',
            '%d/%m/%Y',
            '%d/%m/%y',
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_string, fmt).date()
            except ValueError:
                continue
        
        return None
    
    def _parse_decimal(self, value_string: str) -> Optional[Decimal]:
        """Parse decimal value from string"""
        try:
            # Remove currency symbols and commas
            cleaned = re.sub(r'[^\d.-]', '', value_string)
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return None
    
    def save_employees(self, parsed_data: List[Dict[str, Any]], sync_log: PaycomSyncLog) -> Dict[str, int]:
        """Save parsed employee data to database"""
        stats = {
            'created': 0,
            'updated': 0,
            'errors': 0
        }
        
        for employee_data in parsed_data:
            if not employee_data.get('success', False):
                stats['errors'] += 1
                continue
            
            try:
                employee_id = employee_data.get('employee_id')
                if not employee_id:
                    stats['errors'] += 1
                    continue
                
                # Try to get existing employee
                try:
                    employee = PaycomEmployee.objects.get(employee_id=employee_id)
                    # Update existing employee
                    for field, value in employee_data.items():
                        if hasattr(employee, field) and value is not None:
                            # Don't overwrite existing non-empty values with empty strings
                            # This prevents employee_directory from overwriting position data from employee_dates
                            current_value = getattr(employee, field)
                            if isinstance(value, str) and value.strip() == '' and current_value and current_value.strip():
                                # Skip updating if new value is empty but current value has data
                                continue
                            setattr(employee, field, value)
                    
                    employee.last_synced_at = timezone.now()
                    employee.save()
                    stats['updated'] += 1
                    
                except PaycomEmployee.DoesNotExist:
                    # Create new employee
                    # Ensure required fields are present
                    create_data = {
                        'employee_id': employee_id,
                        'first_name': employee_data.get('first_name', '') or 'Unknown',
                        'last_name': employee_data.get('last_name', '') or 'Unknown',
                        'last_synced_at': timezone.now(),
                    }
                    # Add optional fields
                    for k, v in employee_data.items():
                        if k != 'employee_id' and hasattr(PaycomEmployee, k) and v is not None:
                            create_data[k] = v
                    
                    employee = PaycomEmployee.objects.create(**create_data)
                    stats['created'] += 1
                
                # Update sync log
                sync_log.employees_processed += 1
                if stats['created'] > 0 or stats['updated'] > 0:
                    sync_log.employees_created += stats['created']
                    sync_log.employees_updated += stats['updated']
                else:
                    sync_log.employees_errors += 1
                
            except Exception as e:
                logger.error(f"Failed to save employee {employee_data.get('employee_id', 'unknown')}: {e}")
                stats['errors'] += 1
                sync_log.employees_errors += 1
        
        sync_log.save()
        return stats


def parse_paycom_files(sync_log: PaycomSyncLog) -> Dict[str, Any]:
    """Parse all files in a sync log"""
    parser = PaycomDataParser()
    all_parsed_data = []
    total_stats = {'created': 0, 'updated': 0, 'errors': 0}
    
    # Get all files for this sync
    files = PaycomFile.objects.filter(sync_log=sync_log)
    
    for paycom_file in files:
        if paycom_file.status == 'downloaded':
            result = parser.parse_file(paycom_file)
            all_parsed_data.extend(result['data'])
            
            if result['success']:
                # Save employees from this file
                file_stats = parser.save_employees(result['data'], sync_log)
                for key in total_stats:
                    total_stats[key] += file_stats[key]
    
    return {
        'sync_log': sync_log,
        'total_stats': total_stats,
        'files_processed': files.count(),
        'success': True
    }
