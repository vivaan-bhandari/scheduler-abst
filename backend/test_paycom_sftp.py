#!/usr/bin/env python3
"""
Test script for Paycom SFTP integration
Run this to test the SFTP connection and basic functionality
"""

import os
import sys
import django
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from paycom.sftp_service import PaycomSFTPService, PaycomSFTPError
from paycom.models import PaycomSyncLog
from django.conf import settings


def test_sftp_connection():
    """Test SFTP connection"""
    print("Testing Paycom SFTP connection...")
    
    try:
        sftp_service = PaycomSFTPService()
        
        if sftp_service.test_connection():
            print("✓ SFTP connection successful!")
            return True
        else:
            print("✗ SFTP connection failed")
            return False
            
    except PaycomSFTPError as e:
        print(f"✗ SFTP error: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False


def test_list_files():
    """Test listing remote files"""
    print("\nTesting file listing...")
    
    try:
        sftp_service = PaycomSFTPService()
        files = sftp_service.list_remote_files("*.numbers")
        
        if files:
            print(f"✓ Found {len(files)} files:")
            for file_info in files:
                print(f"  - {file_info['filename']} ({file_info['size']} bytes)")
        else:
            print("⚠ No .numbers files found in remote directory")
        
        return True
        
    except Exception as e:
        print(f"✗ Error listing files: {e}")
        return False


def test_download_file():
    """Test downloading a single file"""
    print("\nTesting file download...")
    
    try:
        sftp_service = PaycomSFTPService()
        files = sftp_service.list_remote_files("*.numbers")
        
        if not files:
            print("⚠ No files available for download test")
            return True
        
        # Download the first file
        first_file = files[0]
        local_path = sftp_service.download_file(first_file['filename'])
        
        if os.path.exists(local_path):
            file_size = os.path.getsize(local_path)
            print(f"✓ Downloaded {first_file['filename']} to {local_path} ({file_size} bytes)")
            return True
        else:
            print(f"✗ File download failed - {local_path} not found")
            return False
            
    except Exception as e:
        print(f"✗ Error downloading file: {e}")
        return False


def test_sync_command():
    """Test the sync management command"""
    print("\nTesting sync management command...")
    
    try:
        from django.core.management import call_command
        
        # Test dry run
        call_command('sync_paycom', '--dry-run', '--report-type', 'all')
        print("✓ Dry run completed successfully")
        
        return True
        
    except Exception as e:
        print(f"✗ Error running sync command: {e}")
        return False


def main():
    """Run all tests"""
    print("Paycom SFTP Integration Test")
    print("=" * 40)
    
    # Check if SFTP credentials are configured
    if not settings.PAYCOM_SFTP_HOST or not settings.PAYCOM_SFTP_USERNAME:
        print("⚠ SFTP credentials not configured. Please set:")
        print("  - PAYCOM_SFTP_HOST")
        print("  - PAYCOM_SFTP_USERNAME")
        print("  - PAYCOM_SFTP_PASSWORD (or PAYCOM_SFTP_PRIVATE_KEY_PATH)")
        return
    
    tests = [
        ("SFTP Connection", test_sftp_connection),
        ("List Files", test_list_files),
        ("Download File", test_download_file),
        ("Sync Command", test_sync_command),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"✗ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 40)
    print("Test Summary:")
    print("=" * 40)
    
    passed = 0
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nPassed: {passed}/{len(results)}")
    
    if passed == len(results):
        print("🎉 All tests passed!")
    else:
        print("❌ Some tests failed. Check the output above for details.")


if __name__ == "__main__":
    main()
