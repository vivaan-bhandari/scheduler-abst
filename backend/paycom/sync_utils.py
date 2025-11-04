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
    logger.info("=" * 80)
    logger.info("STARTING Staff sync from Paycom employees")
    logger.info("=" * 80)
    
    # Log all MedTech positions to diagnose role mapping
    logger.info("🔍 DIAGNOSTIC: Checking for MedTech positions in PaycomEmployee records...")
    all_positions = PaycomEmployee.objects.filter(
        status='active'
    ).exclude(
        position_description__isnull=True
    ).exclude(
        position_description=''
    ).values_list('position_description', flat=True).distinct()
    
    logger.info(f"Total distinct active positions found: {len(all_positions)}")
    
    medtech_like_positions = [
        pos for pos in all_positions 
        if pos and ('medtech' in pos.lower() or 'med tech' in pos.lower() or 'medication' in pos.lower())
    ]
    
    logger.info("=" * 80)
    logger.info(f"🔍 FOUND {len(medtech_like_positions)} MedTech-like positions in PaycomEmployee records:")
    if medtech_like_positions:
        for pos in sorted(medtech_like_positions):
            logger.info(f"  ✅ '{pos}'")
    else:
        logger.warning("  ❌ NO MedTech positions found! All positions:")
        for pos in sorted(all_positions)[:20]:  # Show first 20 positions
            logger.warning(f"     - '{pos}'")
    logger.info("=" * 80)
    
    synced_count = 0
    created_count = 0
    updated_count = 0
    error_count = 0
    
    try:
        with transaction.atomic():
            # Get all ACTIVE Paycom employees that don't have a linked Staff record
            # Only sync active employees for scheduling
            paycom_employees = PaycomEmployee.objects.filter(
                staff__isnull=True,
                status='active'  # Only sync active employees
            )
            
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
                        
                        # Map Paycom role to Staff role
                        staff_role = map_paycom_role_to_staff_role(paycom_emp)
                        position_info = paycom_emp.position_description or paycom_emp.position_family or 'N/A'
                        logger.info(f"Updating existing Staff {paycom_emp.employee_id}: position='{position_info}' -> role='{staff_role}'")
                        
                        # Update existing Staff record
                        existing_staff.first_name = paycom_emp.first_name
                        existing_staff.last_name = paycom_emp.last_name
                        # CRITICAL: Update role if it changed
                        if existing_staff.role != staff_role:
                            logger.warning(f"Updating role for existing Staff {paycom_emp.employee_id}: '{existing_staff.role}' -> '{staff_role}' (position: {position_info})")
                        existing_staff.role = staff_role  # CRITICAL: Update role
                        existing_staff.status = 'active'  # Ensure active status
                        existing_staff.max_hours = paycom_emp.max_hours_per_week
                        existing_staff.facility = facility
                        existing_staff.save()
                        
                        updated_count += 1
                        synced_count += 1
                        logger.info(f"Updated existing Staff record for Paycom employee {paycom_emp.employee_id}")
                        continue
                    
                    # Create Staff record - handle duplicate emails and employee_ids
                    email = paycom_emp.work_email or f"{paycom_emp.employee_id}@company.com"
                    
                    # If email already exists, make it unique
                    if Staff.objects.filter(email=email).exists():
                        email = f"{paycom_emp.employee_id}@company.com"
                    
                    # Double-check employee_id doesn't exist (race condition protection)
                    if Staff.objects.filter(employee_id=paycom_emp.employee_id).exists():
                        logger.warning(f"Staff with employee_id {paycom_emp.employee_id} already exists, skipping creation")
                        error_count += 1
                        continue
                    
                    try:
                        staff = Staff.objects.create(
                            first_name=paycom_emp.first_name,
                            last_name=paycom_emp.last_name,
                            email=email,
                            employee_id=paycom_emp.employee_id,
                            role=staff_role,
                            hire_date=paycom_emp.hire_date or timezone.now().date(),
                            status='active',  # Always create as active (we're only syncing active Paycom employees)
                            max_hours=paycom_emp.max_hours_per_week,
                            facility=facility,
                            notes=f"Synced from Paycom on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
                        )
                    except Exception as create_error:
                        # Handle unique constraint violations
                        if 'employee_id' in str(create_error) or 'unique' in str(create_error).lower():
                            logger.warning(f"Staff with employee_id {paycom_emp.employee_id} already exists (constraint error), linking existing staff")
                            existing_staff = Staff.objects.filter(employee_id=paycom_emp.employee_id).first()
                            if existing_staff:
                                paycom_emp.staff = existing_staff
                                paycom_emp.save()
                                updated_count += 1
                                synced_count += 1
                            else:
                                error_count += 1
                            continue
                        else:
                            raise  # Re-raise if it's a different error
                    
                    # Link Paycom employee to Staff
                    paycom_emp.staff = staff
                    paycom_emp.save()
                    
                    created_count += 1
                    synced_count += 1
                    
                    logger.info(f"Created Staff record for Paycom employee {paycom_emp.employee_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to create Staff record for Paycom employee {paycom_emp.employee_id}: {e}")
                    error_count += 1
            
            # Update existing Staff records with Paycom data (including facility correction)
            # Only update active employees
            paycom_employees_with_staff = PaycomEmployee.objects.filter(
                staff__isnull=False,
                status='active'  # Only update active employees
            )
            
            for paycom_emp in paycom_employees_with_staff:
                try:
                    staff = paycom_emp.staff
                    
                    # Get correct facility for this employee
                    correct_facility = get_or_create_facility_for_employee(paycom_emp)
                    
                    # Map Paycom role to Staff role (in case position changed)
                    staff_role = map_paycom_role_to_staff_role(paycom_emp)
                    
                    # Log role mapping for debugging
                    position_info = paycom_emp.position_description or paycom_emp.position_family or 'N/A'
                    logger.info(f"Mapping role for {paycom_emp.employee_id} ({paycom_emp.first_name} {paycom_emp.last_name}): position='{position_info}' -> role='{staff_role}'")
                    
                    # Update Staff record with latest Paycom data
                    staff.first_name = paycom_emp.first_name
                    staff.last_name = paycom_emp.last_name
                    staff.email = paycom_emp.work_email or staff.email
                    
                    # IMPORTANT: Always update role (fixes MedTech issue)
                    if staff.role != staff_role:
                        logger.warning(f"Updating role for {paycom_emp.employee_id}: '{staff.role}' -> '{staff_role}' (position: {position_info})")
                    staff.role = staff_role  # Update role in case position changed (e.g., MedTech/Caregiver -> med_tech)
                    staff.status = 'active'  # Ensure active status (we're only syncing active Paycom employees)
                    staff.max_hours = paycom_emp.max_hours_per_week
                    
                    # IMPORTANT: Update facility if it's wrong (fixes Veronica issue)
                    if correct_facility and staff.facility != correct_facility:
                        logger.warning(f"Correcting facility for {paycom_emp.employee_id} ({paycom_emp.first_name} {paycom_emp.last_name}): {staff.facility.name} -> {correct_facility.name}")
                        staff.facility = correct_facility
                    
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
            
            logger.info("=" * 80)
            logger.info(f"Staff sync COMPLETED: {created_count} created, {updated_count} updated, {error_count} errors")
            logger.info("=" * 80)
            
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
        # IMPORTANT: Check MedTech BEFORE Caregiver (for "MedTech/Caregiver" positions)
        if 'nurse' in position_lower or 'rn' in position_lower:
            return 'rn'
        elif 'lpn' in position_lower or 'licensed practical' in position_lower:
            return 'lpn'
        elif 'cna' in position_lower or 'certified nursing' in position_lower:
            return 'cna'
        elif 'medtech' in position_lower or 'med tech' in position_lower or 'medication' in position_lower:
            # Match "MedTech", "Med Tech", "MedTech/Caregiver", "Medication Technician", etc.
            return 'med_tech'
        elif 'caregiver' in position_lower:
            # Only match standalone "caregiver", not "MedTech/Caregiver" (handled above)
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
    Uses facility_mapping.py for consistent mapping
    """
    from .facility_mapping import get_facility_from_paycom_location
    
    if not paycom_employee.location_description:
        logger.warning(f"No location_description for Paycom employee {paycom_employee.employee_id}, cannot assign facility")
        return None
    
    location_desc = paycom_employee.location_description.strip()
    
    # Use the centralized facility mapping function
    facility = get_facility_from_paycom_location(location_desc)
    
    if facility:
        logger.info(f"Mapped Paycom location '{location_desc}' to facility: {facility.name}")
        return facility
    
    # Try partial matching as fallback (case-insensitive)
    location_lower = location_desc.lower()
    
    # Try to find facility by partial match in location description
    if 'posada' in location_lower or 'la posada' in location_lower:
        facility = Facility.objects.filter(name__icontains='La Posada').first()
        if facility:
            logger.info(f"Mapped '{location_desc}' to facility via partial match: {facility.name}")
            return facility
    
    if 'markham' in location_lower:
        facility = Facility.objects.filter(name__icontains='Markham').first()
        if facility:
            logger.info(f"Mapped '{location_desc}' to facility via partial match: {facility.name}")
            return facility
    
    if 'arbor' in location_lower or 'mill view' in location_lower or 'mv' in location_lower:
        facility = Facility.objects.filter(name__icontains='Mill View').first()
        if facility:
            logger.info(f"Mapped '{location_desc}' to facility via partial match: {facility.name}")
            return facility
    
    if 'buena vista' in location_lower or 'bv' in location_lower:
        facility = Facility.objects.filter(name__icontains='Buena Vista').first()
        if facility:
            logger.info(f"Mapped '{location_desc}' to facility via partial match: {facility.name}")
            return facility
    
    if 'murray' in location_lower or 'highland' in location_lower:
        facility = Facility.objects.filter(name__icontains='Murray Highland').first()
        if facility:
            logger.info(f"Mapped '{location_desc}' to facility via partial match: {facility.name}")
            return facility
    
    # If no match found, log error and return None (don't default to Buena Vista)
    logger.error(f"No facility mapping found for Paycom location '{location_desc}' (employee {paycom_employee.employee_id}). Employee will not be synced to Staff.")
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
