#!/usr/bin/env python
"""
Test script to verify CSV import functionality
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from django.core.files.uploadedfile import SimpleUploadedFile
from adls.views import ADLViewSet
from rest_framework.test import APIRequestFactory
from rest_framework import status

def test_csv_import():
    """Test the CSV import functionality"""
    print("Testing CSV import functionality...")
    
    # Create a test request
    factory = APIRequestFactory()
    
    # Read the test CSV file
    csv_path = "test_upload.csv"
    if not os.path.exists(csv_path):
        print(f"Error: Test file {csv_path} not found!")
        return
    
    with open(csv_path, 'rb') as f:
        file_content = f.read()
    
    # Create a mock file upload
    uploaded_file = SimpleUploadedFile(
        "test_upload.csv",
        file_content,
        content_type="text/csv"
    )
    
    # Create the request
    request = factory.post('/api/adls/upload/', {
        'file': uploaded_file
    })
    
    # Create view instance
    view = ADLViewSet()
    view.request = request
    
    try:
        # Call the upload method
        response = view.upload_file(request)
        
        print("✅ Import successful!")
        print(f"Response: {response.data}")
        
        # Check if we have data
        from adls.models import ADL
        from residents.models import Resident, Facility, FacilitySection
        
        total_residents = Resident.objects.count()
        total_adls = ADL.objects.count()
        total_facilities = Facility.objects.count()
        total_sections = FacilitySection.objects.count()
        
        print(f"📊 Total facilities in database: {total_facilities}")
        print(f"📊 Total facility sections in database: {total_sections}")
        print(f"📊 Total residents in database: {total_residents}")
        print(f"📊 Total ADLs in database: {total_adls}")
        
        # Show some sample data
        if total_facilities > 0:
            print("\n🏥 Sample facilities:")
            for facility in Facility.objects.all()[:3]:
                print(f"  - {facility.name} (ID: {facility.facility_id})")
        
        if total_sections > 0:
            print("\n🏢 Sample facility sections:")
            for section in FacilitySection.objects.all()[:3]:
                print(f"  - {section.name} (Facility: {section.facility.name})")
        
        if total_residents > 0:
            print("\n👥 Sample residents:")
            for resident in Resident.objects.all()[:3]:
                print(f"  - {resident.name} (Status: {resident.status})")
                print(f"    Section: {resident.facility_section.name}")
                print(f"    Facility: {resident.facility_section.facility.name}")
        
        if total_adls > 0:
            print("\n📋 Sample ADLs:")
            for adl in ADL.objects.all()[:3]:
                print(f"  - {adl.resident.name}: {adl.question_text[:50]}...")
                print(f"    Minutes: {adl.minutes}, Frequency: {adl.frequency}")
                print(f"    Total Minutes: {adl.total_minutes}, Total Hours: {adl.total_hours:.2f}")
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_csv_import() 