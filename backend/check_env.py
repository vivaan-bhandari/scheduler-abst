#!/usr/bin/env python3
"""
Environment check script for debugging deployment issues.
Run this to verify that all necessary environment variables are set correctly.
"""

import os
from decouple import config

def check_environment():
    """Check all environment variables and configuration."""
    print("=== Environment Check ===")
    
    # Check critical environment variables
    critical_vars = [
        'SECRET_KEY',
        'DEBUG',
        'USE_HTTPS',
        'DATABASE_URL',
        'RAILWAY_ENVIRONMENT',
        'RAILWAY_SERVICE_NAME',
    ]
    
    for var in critical_vars:
        value = config(var, default=None)
        if value is not None:
            # Mask sensitive values
            if var == 'SECRET_KEY':
                display_value = value[:10] + '...' if len(value) > 10 else value
            else:
                display_value = value
            print(f"✓ {var}: {display_value}")
        else:
            print(f"✗ {var}: NOT SET")
    
    # Check Django settings
    print("\n=== Django Settings ===")
    try:
        import django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
        django.setup()
        
        from django.conf import settings
        print(f"✓ DEBUG: {settings.DEBUG}")
        print(f"✓ ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
        print(f"✓ DATABASES: {list(settings.DATABASES.keys())}")
        print(f"✓ STATIC_ROOT: {settings.STATIC_ROOT}")
        print(f"✓ MIDDLEWARE count: {len(settings.MIDDLEWARE)}")
        
    except Exception as e:
        print(f"✗ Django setup failed: {e}")
    
    # Check database connection
    print("\n=== Database Connection ===")
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            print("✓ Database connection successful")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        if "DATABASE_URL" in str(e) or "database" in str(e).lower():
            print("  This might be because DATABASE_URL is not set yet")
            print("  Railway should set this automatically when the database service is ready")
    
    print("\n=== Environment Check Complete ===")

if __name__ == '__main__':
    check_environment()
