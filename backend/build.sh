#!/bin/bash
# Build script for Railway deployment

echo "Starting build process..."

# Install dependencies (if needed)
echo "Installing dependencies..."
pip install -r requirements.txt

# Run migrations
echo "Running Django migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser if it doesn't exist
echo "Checking for superuser..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='superadmin').exists():
    User.objects.create_superuser('superadmin', 'superadmin@example.com', 'superpass123')
    print('Superuser created')
else:
    print('Superuser already exists')
"

echo "Build completed successfully!" 