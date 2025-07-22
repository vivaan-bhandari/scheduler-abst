#!/usr/bin/env python
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from residents.models import Facility, Resident, FacilitySection
from adls.models import ADL

def remove_facilities():
    # Facilities to remove
    facilities_to_remove = [
        'Mercy Housing',
        'Shalev Senior Living', 
        'Conyers Residential Homes',
        'CrossRoads'
    ]
    
    print("Removing facilities and all related data...")
    
    for facility_name in facilities_to_remove:
        try:
            facility = Facility.objects.get(name=facility_name)
            print(f"Removing facility: {facility_name}")
            
            # Get all residents in this facility
            residents = Resident.objects.filter(facility_section__facility=facility)
            resident_count = residents.count()
            print(f"  - Found {resident_count} residents")
            
            # Get all ADLs for residents in this facility
            adls = ADL.objects.filter(resident__facility_section__facility=facility)
            adl_count = adls.count()
            print(f"  - Found {adl_count} ADL records")
            
            # Delete ADLs first (due to foreign key constraints)
            adls.delete()
            print(f"  - Deleted {adl_count} ADL records")
            
            # Delete residents
            residents.delete()
            print(f"  - Deleted {resident_count} residents")
            
            # Delete facility sections
            sections = FacilitySection.objects.filter(facility=facility)
            section_count = sections.count()
            sections.delete()
            print(f"  - Deleted {section_count} facility sections")
            
            # Delete the facility
            facility.delete()
            print(f"  - Deleted facility: {facility_name}")
            
        except Facility.DoesNotExist:
            print(f"Facility '{facility_name}' not found, skipping...")
    
    print("\nFacility removal complete!")
    print(f"Remaining facilities: {list(Facility.objects.values_list('name', flat=True))}")

if __name__ == '__main__':
    remove_facilities() 