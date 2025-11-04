"""
Utility functions for syncing Paycom data with existing scheduling system
"""

from django.db import transaction
from django.utils import timezone
from scheduling.models import Staff
from residents.models import Facility
from .models import PaycomEmployee
import logging

logger = logging.getLogger(__name__)


def sync_paycom_to_staff():
    """
    Sync Paycom employees with the existing Staff model
    Creates new Staff records for Paycom employees that don't have them
    """
    synced_count = 0
    created_count = 0
    updated_count = 0
    error_count = 0
    
    try:
        with transaction.atomic():
            # Get all Paycom employees that don't have a linked Staff record
            paycom_employees = PaycomEmployee.objects.filter(staff__isnull=True)
            
            for paycom_emp in paycom_employees:
                try:
                    # Map Paycom role to Staff role
                    staff_role = map_paycom_role_to_staff_role(paycom_emp)
                    
                    # Get or create facility (you might need to adjust this logic)
                    facility = get_or_create_facility_for_employee(paycom_emp)
                    
                    if not facility:
                        logger.error(f"No facility found for Paycom employee {paycom_emp.employee_id}, skipping")
                        error_count += 1
                        continue
                    
                    # Check if Staff already exists by employee_id (to avoid duplicates)
                    existing_staff = Staff.objects.filter(employee_id=paycom_emp.employee_id).first()
                    if existing_staff:
                        # Link existing Staff to Paycom employee
                        paycom_emp.staff = existing_staff
                        paycom_emp.save()
                        
                        # Update existing Staff record
                        existing_staff.first_name = paycom_emp.first_name
                        existing_staff.last_name = paycom_emp.last_name
                        existing_staff.status = paycom_emp.status
                        existing_staff.max_hours = paycom_emp.max_hours_per_week
                        existing_staff.facility = facility
                        existing_staff.save()
                        
                        updated_count += 1
                        synced_count += 1
                        logger.info(f"Updated existing Staff record for Paycom employee {paycom_emp.employee_id}")
                        continue
                    
                    # Create Staff record - handle duplicate emails
                    email = paycom_emp.work_email or f"{paycom_emp.employee_id}@company.com"
                    
                    # If email already exists, make it unique
                    if Staff.objects.filter(email=email).exists():
                        email = f"{paycom_emp.employee_id}@company.com"
                    
                    staff = Staff.objects.create(
                        first_name=paycom_emp.first_name,
                        last_name=paycom_emp.last_name,
                        email=email,
                        employee_id=paycom_emp.employee_id,
                        role=staff_role,
                        hire_date=paycom_emp.hire_date or timezone.now().date(),
                        status=paycom_emp.status,
                        max_hours=paycom_emp.max_hours_per_week,
                        facility=facility,
                        notes=f"Synced from Paycom on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
                    )
                    
                    # Link Paycom employee to Staff
                    paycom_emp.staff = staff
                    paycom_emp.save()
                    
                    created_count += 1
                    synced_count += 1
                    
                    logger.info(f"Created Staff record for Paycom employee {paycom_emp.employee_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to create Staff record for Paycom employee {paycom_emp.employee_id}: {e}")
                    error_count += 1
            
            # Update existing Staff records with Paycom data
            paycom_employees_with_staff = PaycomEmployee.objects.filter(staff__isnull=False)
            
            for paycom_emp in paycom_employees_with_staff:
                try:
                    staff = paycom_emp.staff
                    
                    # Update Staff record with latest Paycom data
                    staff.first_name = paycom_emp.first_name
                    staff.last_name = paycom_emp.last_name
                    staff.email = paycom_emp.work_email or staff.email
                    staff.status = paycom_emp.status
                    staff.max_hours = paycom_emp.max_hours_per_week
                    staff.updated_at = timezone.now()
                    
                    # Update notes with sync timestamp
                    if not staff.notes:
                        staff.notes = ""
                    if "Synced from Paycom" not in staff.notes:
                        staff.notes += f"\nSynced from Paycom on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
                    
                    staff.save()
                    
                    updated_count += 1
                    synced_count += 1
                    
                    logger.info(f"Updated Staff record for Paycom employee {paycom_emp.employee_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to update Staff record for Paycom employee {paycom_emp.employee_id}: {e}")
                    error_count += 1
            
            logger.info(f"Sync completed: {created_count} created, {updated_count} updated, {error_count} errors")
            
            return {
                'success': True,
                'synced_count': synced_count,
                'created_count': created_count,
                'updated_count': updated_count,
                'error_count': error_count
            }
            
    except Exception as e:
        logger.error(f"Failed to sync Paycom to Staff: {e}")
        return {
            'success': False,
            'error': str(e),
            'synced_count': synced_count,
            'created_count': created_count,
            'updated_count': updated_count,
            'error_count': error_count
        }


def map_paycom_role_to_staff_role(paycom_employee):
    """
    Map Paycom position/role to Staff role
    Uses position_family, position_description, and department_description
    """
    # Try position_family first
    position = paycom_employee.position_family or paycom_employee.position_description or ''
    
    if position:
        position_lower = position.lower()
        
        # Map common Paycom positions to Staff roles
        if 'nurse' in position_lower or 'rn' in position_lower:
            return 'rn'
        elif 'lpn' in position_lower or 'licensed practical' in position_lower:
            return 'lpn'
        elif 'cna' in position_lower or 'certified nursing' in position_lower:
            return 'cna'
        elif 'medication' in position_lower or 'med tech' in position_lower:
            return 'med_tech'
        elif 'caregiver' in position_lower or 'care' in position_lower:
            return 'caregiver'
        elif 'float' in position_lower:
            return 'cna_float'
    
    # Fallback to department_description if position is empty
    department = paycom_employee.department_description or ''
    department_lower = department.lower()
    
    # Map departments to roles
    if 'nursing' in department_lower:
        # For nursing department, default to caregiver (can be updated manually)
        return 'caregiver'
    elif 'dietary' in department_lower or 'food' in department_lower:
        # Dietary staff are not typically used in scheduling
        return 'caregiver'  # Default to caregiver for now
    elif 'administration' in department_lower or 'admin' in department_lower:
        return 'caregiver'  # Default to caregiver for now
    elif 'facilities' in department_lower or 'maintenance' in department_lower:
        return 'caregiver'  # Default to caregiver for now
    
    # Ultimate default
    return 'caregiver'


def get_or_create_facility_for_employee(paycom_employee):
    """
    Map Paycom employee to existing Facility based on location description
    """
    # Location mapping from Paycom to existing facilities
    location_mapping = {
        'Buena Vista': 'Buena Vista',
        'Murray Highland': 'Murray Highland', 
        'Posada SL': 'La Posada Senior Living',
        'Markham': 'Markham House Assisted Living',
        'Arbor MC': 'Mill View Memory Care',
        'Corporate': 'Buena Vista',  # Map corporate to main facility
    }
    
    if not paycom_employee.location_description:
        # Return default facility (Buena Vista as main facility)
        facility = Facility.objects.filter(name='Buena Vista').first()
        if facility:
            return facility
    
    location_desc = paycom_employee.location_description.strip()
    
    # Try exact mapping first
    if location_desc in location_mapping:
        facility_name = location_mapping[location_desc]
        facility = Facility.objects.filter(name=facility_name).first()
        if facility:
            logger.info(f"Mapped {location_desc} to existing facility: {facility.name}")
            return facility
    
    # Try partial matching as fallback
    facility = Facility.objects.filter(
        name__icontains=location_desc
    ).first()
    
    if facility:
        logger.info(f"Mapped {location_desc} to existing facility (partial match): {facility.name}")
        return facility
    
    # If no match found, use Buena Vista as default
    facility = Facility.objects.filter(name='Buena Vista').first()
    if facility:
        logger.warning(f"No facility mapping found for '{location_desc}', using default: {facility.name}")
        return facility
    
    # Last resort - this shouldn't happen if facilities exist
    logger.error(f"No facilities found in system! Paycom location: {location_desc}")
    return None


def get_employee_availability_summary():
    """
    Get summary of employee availability for scheduling
    """
    from django.db.models import Count, Q, F
    
    # Get Paycom employees available for scheduling
    available_employees = PaycomEmployee.objects.filter(
        status='active',
        hours_worked_current_period__lt=F('max_hours_per_week')
    ).count()
    
    # Get employees by department
    by_department = PaycomEmployee.objects.filter(
        status='active'
    ).values('department_description').annotate(
        count=Count('id')
    ).order_by('-count')
    
    # Get employees by role
    by_role = PaycomEmployee.objects.filter(
        status='active'
    ).values('position_family').annotate(
        count=Count('id')
    ).order_by('-count')
    
    # Get overtime eligible employees
    overtime_eligible = PaycomEmployee.objects.filter(
        status='active',
        overtime_eligible=True
    ).count()
    
    return {
        'total_active': PaycomEmployee.objects.filter(status='active').count(),
        'available_for_scheduling': available_employees,
        'overtime_eligible': overtime_eligible,
        'by_department': list(by_department),
        'by_role': list(by_role)
    }


def update_staff_hours_from_paycom():
    """
    Update Staff availability based on Paycom hours data
    """
    updated_count = 0
    
    try:
        # Get Paycom employees with Staff links
        paycom_employees = PaycomEmployee.objects.filter(staff__isnull=False)
        
        for paycom_emp in paycom_employees:
            try:
                staff = paycom_emp.staff
                
                # Update max hours based on Paycom data
                if paycom_emp.max_hours_per_week != staff.max_hours:
                    staff.max_hours = paycom_emp.max_hours_per_week
                    staff.save()
                    updated_count += 1
                    
            except Exception as e:
                logger.error(f"Failed to update hours for Staff {paycom_emp.employee_id}: {e}")
        
        logger.info(f"Updated hours for {updated_count} staff members")
        return updated_count
        
    except Exception as e:
        logger.error(f"Failed to update staff hours: {e}")
        return 0
