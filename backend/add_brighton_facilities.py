#!/usr/bin/env python
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from residents.models import Facility

def add_brighton_facilities():
    # Brighton Care Group facilities (names and unique facility_id)
    facilities = [
        {'name': 'Buena Vista', 'facility_id': 'B001'},
        {'name': 'Murray Highland', 'facility_id': 'B002'},
        {'name': 'La Posada Senior Living', 'facility_id': 'B003'},
        {'name': 'CrossRoads', 'facility_id': 'B004'},
        {'name': 'Conyers Residential Homes', 'facility_id': 'B005'},
        {'name': 'Mercy Housing', 'facility_id': 'B006'},
        {'name': 'Shalev Senior Living', 'facility_id': 'B007'},
        {'name': 'Mill View Memory Care', 'facility_id': 'B008'},
    ]
    
    created_count = 0
    for facility_data in facilities:
        # Only create if facility doesn't exist
        facility, created = Facility.objects.get_or_create(
            facility_id=facility_data['facility_id'],
            defaults={'name': facility_data['name']}
        )
        if created:
            created_count += 1
            print(f"Created facility: {facility_data['name']} ({facility_data['facility_id']})")
        else:
            print(f"Facility already exists: {facility_data['name']} ({facility_data['facility_id']})")
    
    print(f"\nFacility setup complete!")
    print(f"Created: {created_count} new facilities")
    print(f"Total facilities: {Facility.objects.count()}")

if __name__ == '__main__':
    add_brighton_facilities() 