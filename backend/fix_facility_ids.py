#!/usr/bin/env python
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from residents.models import Facility, Resident, FacilitySection
from adls.models import ADL

def fix_facility_ids():
    print("Fixing facility IDs and ensuring single Murray Highland...")
    
    # Define the correct facility mappings
    facility_mappings = {
        'Buena Vista': 'B001',
        'Murray Highland': 'B002', 
        'La Posada Senior Living': 'B003',
        'Mill View Memory Care': 'B008'
    }
    
    # Update facility IDs to match Brighton Care Group format
    for facility_name, correct_id in facility_mappings.items():
        try:
            facility = Facility.objects.get(name=facility_name)
            old_id = facility.facility_id
            facility.facility_id = correct_id
            facility.save()
            print(f"Updated {facility_name}: {old_id} → {correct_id}")
        except Facility.DoesNotExist:
            print(f"Facility '{facility_name}' not found")
        except Facility.MultipleObjectsReturned:
            # Handle duplicate Murray Highland facilities
            facilities = Facility.objects.filter(name=facility_name)
            print(f"Found {facilities.count()} {facility_name} facilities, keeping the first one...")
            
            # Keep the first one, delete the rest
            first_facility = facilities.first()
            first_facility.facility_id = correct_id
            first_facility.save()
            
            # Move all data to the first facility before deleting duplicates
            for duplicate in facilities[1:]:
                print(f"  Moving data from duplicate {facility_name} (ID: {duplicate.id}) to main facility...")
                
                # Move sections and residents
                sections = FacilitySection.objects.filter(facility=duplicate)
                for section in sections:
                    section.facility = first_facility
                    section.save()
                
                # Delete the duplicate facility
                duplicate.delete()
                print(f"  Deleted duplicate facility {facility_name} (ID: {duplicate.id})")
    
    print("\nFacility ID fix complete!")
    print("Current facilities:")
    facilities = Facility.objects.all()
    for facility in facilities:
        print(f"  - {facility.name} (ID: {facility.facility_id})")

if __name__ == '__main__':
    fix_facility_ids() 