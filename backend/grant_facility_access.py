#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from django.contrib.auth.models import User
from users.models import FacilityAccess
from residents.models import Facility

def grant_facility_access():
    """Grant facility access to all users for testing"""
    print("=== Granting Facility Access ===\n")
    
    # Get all users
    users = User.objects.all()
    print(f"Found {users.count()} users:")
    for user in users:
        print(f"  - {user.username} (ID: {user.id}, Staff: {user.is_staff})")
    
    # Get all facilities
    facilities = Facility.objects.all()
    print(f"\nFound {facilities.count()} facilities:")
    for facility in facilities:
        print(f"  - {facility.name} (ID: {facility.id})")
    
    # Grant access to all users for all facilities
    created_count = 0
    updated_count = 0
    
    for user in users:
        for facility in facilities:
            access, created = FacilityAccess.objects.get_or_create(
                user=user,
                facility=facility,
                defaults={
                    'role': 'admin' if user.is_staff else 'staff',
                    'status': 'approved'
                }
            )
            
            if created:
                created_count += 1
                print(f"✅ Created access for {user.username} to {facility.name}")
            else:
                # Update existing access to approved
                if access.status != 'approved':
                    access.status = 'approved'
                    access.role = 'admin' if user.is_staff else 'staff'
                    access.save()
                    updated_count += 1
                    print(f"🔄 Updated access for {user.username} to {facility.name}")
    
    print(f"\n=== Access Grant Complete ===")
    print(f"Created: {created_count} new access records")
    print(f"Updated: {updated_count} existing access records")
    
    # Verify the results
    total_access = FacilityAccess.objects.count()
    print(f"Total facility access records: {total_access}")
    
    # Test that users can now see residents
    print(f"\n=== Testing Resident Access ===")
    for user in users[:3]:  # Test first 3 users
        approved_facility_ids = FacilityAccess.objects.filter(
            user=user,
            status='approved'
        ).values_list('facility_id', flat=True)
        
        from residents.models import FacilitySection, Resident
        allowed_sections = FacilitySection.objects.filter(facility_id__in=approved_facility_ids)
        allowed_residents = Resident.objects.filter(facility_section__in=allowed_sections)
        
        print(f"User {user.username} can see {allowed_residents.count()} residents")

if __name__ == '__main__':
    grant_facility_access() 