#!/usr/bin/env python
import os
import sys
import django

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from django.contrib.auth.models import User

def create_user(username, email, password, first_name="", last_name="", is_staff=False):
    """Create a new user in the database"""
    try:
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            print(f"User '{username}' already exists!")
            return False
        
        if User.objects.filter(email=email).exists():
            print(f"Email '{email}' already exists!")
            return False
        
        # Create the user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_staff=is_staff
        )
        
        print(f"✅ Successfully created user: {username}")
        print(f"   Email: {email}")
        print(f"   Name: {first_name} {last_name}")
        print(f"   Staff: {is_staff}")
        return True
        
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        return False

def create_superuser(username, email, password, first_name="", last_name=""):
    """Create a superuser"""
    try:
        if User.objects.filter(username=username).exists():
            print(f"User '{username}' already exists!")
            return False
        
        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        print(f"✅ Successfully created superuser: {username}")
        print(f"   Email: {email}")
        print(f"   Name: {first_name} {last_name}")
        return True
        
    except Exception as e:
        print(f"❌ Error creating superuser: {e}")
        return False

if __name__ == '__main__':
    print("=== ABST User Creation Tool ===\n")
    
    # Create a test user
    print("Creating test user...")
    create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
        first_name="Test",
        last_name="User"
    )
    
    print("\nCreating admin user...")
    create_user(
        username="admin",
        email="admin@example.com",
        password="adminpass123",
        first_name="Admin",
        last_name="User",
        is_staff=True
    )
    
    print("\nCreating superuser...")
    create_superuser(
        username="superadmin",
        email="superadmin@example.com",
        password="superpass123",
        first_name="Super",
        last_name="Admin"
    )
    
    print("\n=== User Creation Complete ===")
    print("\nYou can now:")
    print("1. Login to Django admin at: https://abst-fullstack-production.up.railway.app/admin/")
    print("2. Use these credentials to login to your frontend")
    print("3. Access the API directly with these users") 