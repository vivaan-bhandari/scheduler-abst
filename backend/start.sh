#!/bin/bash
# Start script for Railway deployment

set -e

echo "Starting Django application..."
echo "Port: $PORT"
echo "Database URL: $DATABASE_URL"

# Wait for database to be ready
echo "Waiting for database..."
sleep 10

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Try to add Brighton facilities (but don't fail if it doesn't work)
echo "Setting up facilities..."
if [ -f "add_brighton_facilities.py" ]; then
    python add_brighton_facilities.py || echo "Warning: Could not add Brighton facilities"
else
    echo "Warning: add_brighton_facilities.py not found"
fi

# Try to seed ADL questions (but don't fail if it doesn't work)
echo "Seeding ADL questions..."
if [ -f "adls/seed_adl_questions.py" ]; then
    python adls/seed_adl_questions.py || echo "Warning: Could not seed ADL questions"
else
    echo "Warning: adls/seed_adl_questions.py not found"
fi

# Create superuser if it doesn't exist
echo "Checking for superuser..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='superadmin').exists():
    User.objects.create_superuser('superadmin', 'superadmin@example.com', 'superpass123')
    print('Superuser created')
else:
    print('Superuser already exists')
" || echo "Warning: Could not create superuser"

# Try to grant facility access (but don't fail if it doesn't work)
echo "Granting facility access to users..."
python manage.py shell -c "
try:
    from django.contrib.auth.models import User
    from users.models import FacilityAccess
    from residents.models import Facility

    users = User.objects.all()
    facilities = Facility.objects.all()

    for user in users:
        for facility in facilities:
            access, created = FacilityAccess.objects.get_or_create(
                user=user,
                facility=facility,
                defaults={
                    'role': 'admin' if user.is_staff else 'staff',
                    'status': 'approved'
                }
            )
            if not created and access.status != 'approved':
                access.status = 'approved'
                access.role = 'admin' if user.is_staff else 'staff'
                access.save()

    print(f'Granted facility access to {users.count()} users for {facilities.count()} facilities')
except Exception as e:
    print(f'Warning: Could not grant facility access: {e}')
" || echo "Warning: Could not grant facility access"

# Start gunicorn
echo "Starting gunicorn..."
exec gunicorn abst.wsgi --bind 0.0.0.0:$PORT --log-file - --workers 1 --timeout 120 