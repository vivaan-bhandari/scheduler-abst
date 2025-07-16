#!/usr/bin/env python
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from django.contrib.auth.models import User

def create_superadmin():
    # Create superadmin user
    username = 'superadmin'
    email = 'superadmin@abst.com'
    password = 'superadmin123'
    
    # Check if user already exists
    if User.objects.filter(username=username).exists():
        user = User.objects.get(username=username)
        user.role = 'superadmin'
        user.is_staff = True
        user.is_superuser = True
        user.save()
        print(f"Updated existing user '{username}' to superadmin role")
    else:
        # Create new superadmin user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name='Super',
            last_name='Admin'
        )
        user.role = 'superadmin'
        user.is_staff = True
        user.is_superuser = True
        user.save()
        print(f"Created superadmin user: {username}")
        print(f"Password: {password}")
    
    print("Superadmin setup complete!")

if __name__ == '__main__':
    create_superadmin() 