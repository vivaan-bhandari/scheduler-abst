#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from adls.models import ADL, ADLQuestion
from residents.models import Resident, Facility, FacilitySection
from django.contrib.auth.models import User
from users.models import FacilityAccess

def debug_data_persistence():
    """Debug script to check data persistence and user filtering"""
    print("=== ABST Data Debug Report ===\n")
    
    # Check ADL Questions
    print("1. ADL Questions:")
    questions = ADLQuestion.objects.all()
    print(f"   Total ADL questions: {questions.count()}")
    for i, q in enumerate(questions[:5], 1):
        print(f"   {i}. {q.text[:50]}...")
    if questions.count() > 5:
        print(f"   ... and {questions.count() - 5} more")
    print()
    
    # Check Facilities
    print("2. Facilities:")
    facilities = Facility.objects.all()
    print(f"   Total facilities: {facilities.count()}")
    for f in facilities:
        print(f"   - {f.name} (ID: {f.id}, Facility ID: {f.facility_id})")
    print()
    
    # Check Residents
    print("3. Residents:")
    residents = Resident.objects.all()
    print(f"   Total residents: {residents.count()}")
    for r in residents[:5]:
        print(f"   - {r.name} (ID: {r.id}, Section: {r.facility_section.name}, Facility: {r.facility_section.facility.name})")
    if residents.count() > 5:
        print(f"   ... and {residents.count() - 5} more")
    print()
    
    # Check ADLs
    print("4. ADL Records:")
    adls = ADL.objects.filter(is_deleted=False)
    print(f"   Total ADL records: {adls.count()}")
    for adl in adls[:5]:
        print(f"   - Resident: {adl.resident.name}, Question: {adl.question_text[:30]}...")
        print(f"     Minutes: {adl.minutes}, Frequency: {adl.frequency}")
        print(f"     Total Minutes: {adl.total_minutes}, Total Hours: {adl.total_hours}")
        print(f"     Created by: {adl.created_by.username if adl.created_by else 'Unknown'}")
        print(f"     Updated by: {adl.updated_by.username if adl.updated_by else 'Unknown'}")
        print(f"     Per-day shift times: {adl.per_day_shift_times}")
        print()
    if adls.count() > 5:
        print(f"   ... and {adls.count() - 5} more")
    print()
    
    # Check Users and Access
    print("5. Users and Facility Access:")
    users = User.objects.all()
    print(f"   Total users: {users.count()}")
    for user in users:
        print(f"   - {user.username} (ID: {user.id}, Staff: {user.is_staff})")
        access_records = FacilityAccess.objects.filter(user=user)
        if access_records.exists():
            for access in access_records:
                print(f"     Access to {access.facility.name}: {access.role} ({access.status})")
        else:
            print(f"     No facility access records")
    print()
    
    # Check specific user filtering
    print("6. User-Specific Data Filtering Test:")
    for user in users[:3]:  # Test first 3 users
        print(f"   Testing user: {user.username}")
        
        # Get approved facility IDs for this user
        approved_facility_ids = FacilityAccess.objects.filter(
            user=user,
            status='approved'
        ).values_list('facility_id', flat=True)
        
        print(f"     Approved facilities: {list(approved_facility_ids)}")
        
        # Get sections in those facilities
        from residents.models import FacilitySection
        allowed_sections = FacilitySection.objects.filter(facility_id__in=approved_facility_ids)
        print(f"     Allowed sections: {list(allowed_sections.values_list('name', flat=True))}")
        
        # Get residents in those sections
        allowed_residents = Resident.objects.filter(facility_section__in=allowed_sections)
        print(f"     Allowed residents: {list(allowed_residents.values_list('name', flat=True))}")
        
        # Get ADLs for those residents
        user_adls = ADL.objects.filter(resident__in=allowed_residents, is_deleted=False)
        print(f"     User's ADL records: {user_adls.count()}")
        print()

if __name__ == '__main__':
    debug_data_persistence() 