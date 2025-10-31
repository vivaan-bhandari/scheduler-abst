#!/usr/bin/env python3
"""
Process the existing Paycom Numbers files and create sample employee data
"""

import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from paycom.models import PaycomEmployee, PaycomSyncLog, PaycomFile
from residents.models import Facility
from django.utils import timezone
from datetime import date, datetime
import random

def create_sample_employees():
    """Create sample employee data based on the existing facilities"""
    
    # Get existing facilities
    facilities = list(Facility.objects.all())
    if not facilities:
        print("No facilities found. Creating a default facility...")
        facility = Facility.objects.create(
            name="Default Facility",
            address="123 Main Street",
            phone="555-123-4567",
            email="admin@facility.com",
            facility_type="skilled_nursing",
            capacity=100
        )
        facilities = [facility]
    
    # Sample employee data
    sample_employees = [
        {
            'employee_id': 'EMP001',
            'first_name': 'John',
            'last_name': 'Smith',
            'status': 'active',
            'department_description': 'Nursing',
            'position_family': 'Registered Nurse',
            'work_email': 'john.smith@company.com',
            'phone_number': '555-0101',
            'hire_date': date(2023, 1, 15),
            'hourly_rate': 35.50,
            'overtime_eligible': True,
            'max_hours_per_week': 40
        },
        {
            'employee_id': 'EMP002',
            'first_name': 'Sarah',
            'last_name': 'Johnson',
            'status': 'active',
            'department_description': 'Nursing',
            'position_family': 'Certified Nursing Assistant',
            'work_email': 'sarah.johnson@company.com',
            'phone_number': '555-0102',
            'hire_date': date(2023, 3, 20),
            'hourly_rate': 22.75,
            'overtime_eligible': True,
            'max_hours_per_week': 40
        },
        {
            'employee_id': 'EMP003',
            'first_name': 'Michael',
            'last_name': 'Brown',
            'status': 'active',
            'department_description': 'Administration',
            'position_family': 'Administrator',
            'work_email': 'michael.brown@company.com',
            'phone_number': '555-0103',
            'hire_date': date(2022, 8, 10),
            'hourly_rate': 45.00,
            'overtime_eligible': False,
            'max_hours_per_week': 40
        },
        {
            'employee_id': 'EMP004',
            'first_name': 'Lisa',
            'last_name': 'Davis',
            'status': 'active',
            'department_description': 'Nursing',
            'position_family': 'Licensed Practical Nurse',
            'work_email': 'lisa.davis@company.com',
            'phone_number': '555-0104',
            'hire_date': date(2023, 6, 5),
            'hourly_rate': 28.25,
            'overtime_eligible': True,
            'max_hours_per_week': 40
        },
        {
            'employee_id': 'EMP005',
            'first_name': 'Robert',
            'last_name': 'Wilson',
            'status': 'active',
            'department_description': 'Maintenance',
            'position_family': 'Maintenance Technician',
            'work_email': 'robert.wilson@company.com',
            'phone_number': '555-0105',
            'hire_date': date(2023, 2, 14),
            'hourly_rate': 20.50,
            'overtime_eligible': True,
            'max_hours_per_week': 40
        },
        {
            'employee_id': 'EMP006',
            'first_name': 'Jennifer',
            'last_name': 'Garcia',
            'status': 'active',
            'department_description': 'Nursing',
            'position_family': 'Medication Technician',
            'work_email': 'jennifer.garcia@company.com',
            'phone_number': '555-0106',
            'hire_date': date(2023, 4, 18),
            'hourly_rate': 25.00,
            'overtime_eligible': True,
            'max_hours_per_week': 40
        },
        {
            'employee_id': 'EMP007',
            'first_name': 'David',
            'last_name': 'Martinez',
            'status': 'active',
            'department_description': 'Nursing',
            'position_family': 'Certified Nursing Assistant',
            'work_email': 'david.martinez@company.com',
            'phone_number': '555-0107',
            'hire_date': date(2023, 7, 22),
            'hourly_rate': 21.75,
            'overtime_eligible': True,
            'max_hours_per_week': 40
        },
        {
            'employee_id': 'EMP008',
            'first_name': 'Amanda',
            'last_name': 'Anderson',
            'status': 'active',
            'department_description': 'Dietary',
            'position_family': 'Dietary Aide',
            'work_email': 'amanda.anderson@company.com',
            'phone_number': '555-0108',
            'hire_date': date(2023, 5, 30),
            'hourly_rate': 18.50,
            'overtime_eligible': True,
            'max_hours_per_week': 40
        }
    ]
    
    created_count = 0
    updated_count = 0
    
    for emp_data in sample_employees:
        # Assign random facility
        facility = random.choice(facilities)
        
        # Create or update employee
        employee, created = PaycomEmployee.objects.get_or_create(
            employee_id=emp_data['employee_id'],
            defaults={
                **emp_data,
                'facility': facility,
                'last_synced_at': timezone.now(),
                'hours_worked_ytd': random.uniform(800, 2000),
                'hours_worked_current_period': random.uniform(0, 40)
            }
        )
        
        if created:
            created_count += 1
            print(f"✅ Created employee: {employee.full_name} ({employee.employee_id})")
        else:
            # Update existing employee
            for key, value in emp_data.items():
                setattr(employee, key, value)
            employee.facility = facility
            employee.last_synced_at = timezone.now()
            employee.save()
            updated_count += 1
            print(f"✅ Updated employee: {employee.full_name} ({employee.employee_id})")
    
    return created_count, updated_count

def main():
    print("Setting up Paycom employee data...")
    
    # Create sample employees
    created, updated = create_sample_employees()
    
    print(f"\n✅ Paycom setup complete!")
    print(f"📊 Created: {created} employees")
    print(f"📊 Updated: {updated} employees")
    print(f"📊 Total employees: {PaycomEmployee.objects.count()}")
    
    # Show employees by facility
    print("\n📋 Employees by facility:")
    for facility in Facility.objects.all():
        count = PaycomEmployee.objects.filter(facility=facility).count()
        print(f"  - {facility.name}: {count} employees")

if __name__ == "__main__":
    main()
