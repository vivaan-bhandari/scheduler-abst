#!/usr/bin/env python
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from residents.models import Facility, Resident, FacilitySection
from adls.models import ADL

def force_remove_facilities():
    print("FORCE REMOVING DISCONTINUED FACILITIES...")
    
    # Facilities to remove
    facilities_to_remove = [
        'Mercy Housing',
        'Shalev Senior Living', 
        'Conyers Residential Homes',
        'CrossRoads'
    ]
    
    for facility_name in facilities_to_remove:
        try:
            # Find all facilities with this name (case insensitive)
            facilities = Facility.objects.filter(name__icontains=facility_name)
            if facilities.exists():
                print(f"Found {facilities.count()} facilities matching '{facility_name}'")
                
                for facility in facilities:
                    print(f"  DELETING: {facility.name} (ID: {facility.id})")
                    
                    # Delete all ADLs for residents in this facility
                    adls = ADL.objects.filter(resident__facility_section__facility=facility)
                    adl_count = adls.count()
                    adls.delete()
                    print(f"    - Deleted {adl_count} ADL records")
                    
                    # Delete all residents in this facility
                    residents = Resident.objects.filter(facility_section__facility=facility)
                    resident_count = residents.count()
                    residents.delete()
                    print(f"    - Deleted {resident_count} residents")
                    
                    # Delete all sections in this facility
                    sections = FacilitySection.objects.filter(facility=facility)
                    section_count = sections.count()
                    sections.delete()
                    print(f"    - Deleted {section_count} sections")
                    
                    # Delete the facility itself
                    facility.delete()
                    print(f"    - DELETED FACILITY: {facility.name}")
            else:
                print(f"No facilities found matching '{facility_name}'")
        except Exception as e:
            print(f"Error removing {facility_name}: {e}")
    
    print("\n=== CURRENT FACILITIES ===")
    remaining = Facility.objects.all()
    for facility in remaining:
        print(f"  - {facility.name} (ID: {facility.facility_id})")
    print(f"Total: {remaining.count()} facilities")

if __name__ == '__main__':
    force_remove_facilities() 