#!/bin/bash
# Start script for Railway deployment

set -e

echo "Starting Django application..."
echo "Port: $PORT"
echo "Database URL: $DATABASE_URL"

# Set default environment variables if not provided
export DEBUG=${DEBUG:-False}
export USE_HTTPS=${USE_HTTPS:-True}
export RAILWAY_ENVIRONMENT=${RAILWAY_ENVIRONMENT:-production}
export RAILWAY_SERVICE_NAME=${RAILWAY_SERVICE_NAME:-scheduler-abst}

echo "Environment: $RAILWAY_ENVIRONMENT"
echo "Service: $RAILWAY_SERVICE_NAME"
echo "Debug: $DEBUG"
echo "Use HTTPS: $USE_HTTPS"

# Run environment check
echo "Running environment check..."
python check_env.py || echo "Warning: Environment check failed"

# Check if we have all required environment variables
echo "Checking required environment variables..."
if [ -z "$SECRET_KEY" ]; then
    echo "ERROR: SECRET_KEY is not set"
    exit 1
fi

# Check DATABASE_URL but don't fail immediately - it might be set by Railway
if [ -z "$DATABASE_URL" ]; then
    echo "WARNING: DATABASE_URL is not set - waiting for Railway to set it..."
    # Wait a bit for Railway to set the DATABASE_URL
    sleep 10
fi

# Wait for database to be ready
echo "Waiting for database..."
sleep 15

# Check if we're running on Railway
if [ -n "$RAILWAY_ENVIRONMENT" ]; then
    echo "Running on Railway environment: $RAILWAY_ENVIRONMENT"
    # Additional Railway-specific setup can go here
    
    # Set additional Railway-specific variables
    export PYTHONPATH="${PYTHONPATH}:${PWD}"
    echo "Python path: $PYTHONPATH"
    
    # Check Railway-specific environment
    echo "Railway service name: $RAILWAY_SERVICE_NAME"
    echo "Railway environment: $RAILWAY_ENVIRONMENT"
    echo "Railway project ID: $RAILWAY_PROJECT_ID"
    echo "Railway service ID: $RAILWAY_SERVICE_ID"
else
    echo "Not running on Railway"
fi

# Test database connection with retry logic
echo "Testing database connection..."
for i in {1..10}; do
    echo "Attempt $i to connect to database..."
    
    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        echo "DATABASE_URL not set yet, waiting..."
        sleep 10
        continue
    fi
    
    if python manage.py shell -c "
import django
django.setup()
from django.db import connection
try:
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
    print('Database connection successful')
    exit(0)
except Exception as e:
    print(f'Database connection attempt {i} failed: {e}')
    exit(1)
"; then
        echo "Database connection successful on attempt $i"
        break
    else
        if [ $i -eq 10 ]; then
            echo "All database connection attempts failed"
            exit 1
        fi
        echo "Waiting before retry..."
        sleep 10
    fi
done

# Run migrations
echo "Running migrations..."
python manage.py migrate || echo "Warning: Could not run migrations"

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput || echo "Warning: Could not collect static files"

# Try to add Brighton facilities (but don't fail if it doesn't work)
echo "Setting up facilities..."
if [ -f "add_brighton_facilities.py" ]; then
    python add_brighton_facilities.py || echo "Warning: Could not add Brighton facilities"
else
    echo "Warning: add_brighton_facilities.py not found"
fi

# Check if we can import Django and run basic commands
echo "Testing Django import..."
python -c "import django; print('Django import successful')" || echo "Warning: Django import failed"

# Try to seed ADL questions using Django shell (but don't fail if it doesn't work)
echo "Seeding ADL questions..."
python manage.py shell -c "
try:
    from adls.models import ADLQuestion
    from adls.seed_adl_questions import seed_adl_questions
    seed_adl_questions()
    print('ADL questions seeded successfully')
except Exception as e:
    print(f'Warning: Could not seed ADL questions: {e}')
" || echo "Warning: Could not seed ADL questions"

# Check if we can run Django management commands
echo "Testing Django management commands..."
python manage.py check --deploy || echo "Warning: Django deployment check failed"

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

# Check if we can access the database models
echo "Testing database models..."
python manage.py shell -c "
try:
    from django.contrib.auth.models import User
    from residents.models import Facility
    print(f'Database models accessible. Users: {User.objects.count()}, Facilities: {Facility.objects.count()}')
except Exception as e:
    print(f'Warning: Could not access database models: {e}')
" || echo "Warning: Could not access database models"

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

# Final health check before starting
echo "Performing final health check..."
python manage.py shell -c "
try:
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
    print('Final database health check: OK')
except Exception as e:
    print(f'Final database health check failed: {e}')
    exit(1)
"

# Check if we can start the Django development server (test run)
echo "Testing Django server startup..."
timeout 10s python manage.py runserver 0.0.0.0:8000 &
DJANGO_PID=$!
sleep 5
if kill -0 $DJANGO_PID 2>/dev/null; then
    echo "Django test server started successfully"
    kill $DJANGO_PID
    wait $DJANGO_PID 2>/dev/null || true
else
    echo "Warning: Django test server failed to start"
fi

# Start gunicorn
echo "Starting gunicorn..."
echo "Final environment check before starting gunicorn..."
echo "Port: $PORT"
echo "Database URL: ${DATABASE_URL:0:50}..."
echo "Debug: $DEBUG"
echo "Use HTTPS: $USE_HTTPS"
echo "Railway Environment: $RAILWAY_ENVIRONMENT"
echo "Railway Service: $RAILWAY_SERVICE_NAME"

# Set gunicorn environment variables
export GUNICORN_CMD_ARGS="--bind 0.0.0.0:$PORT --workers 2 --worker-class sync --timeout 120 --keep-alive 2 --max-requests 1000 --max-requests-jitter 100 --log-level info --access-logfile - --error-logfile - --capture-output --preload"

echo "Gunicorn command: gunicorn abst.wsgi $GUNICORN_CMD_ARGS"

# Check if we have all required files
echo "Checking required files..."
ls -la abst/ || echo "Warning: abst directory not found"
ls -la abst/wsgi.py || echo "Warning: wsgi.py not found"
ls -la manage.py || echo "Warning: manage.py not found"

# Check Python path and Django setup
echo "Checking Python path..."
python -c "import sys; print('Python path:', sys.path)"
python -c "import django; print('Django version:', django.get_version())"

# Check if we can import the WSGI application
echo "Testing WSGI import..."
python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
import django
django.setup()
from abst.wsgi import application
print('WSGI application imported successfully')
" || echo "Warning: WSGI import failed"

# Check if we can access the database through Django
echo "Testing Django database access..."
python manage.py shell -c "
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute('SELECT version()')
    version = cursor.fetchone()
    print(f'Database version: {version[0] if version else \"Unknown\"}')
" || echo "Warning: Django database access failed"

exec gunicorn abst.wsgi \
    --bind 0.0.0.0:$PORT \
    --workers 2 \
    --worker-class sync \
    --timeout 120 \
    --keep-alive 2 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --log-level info \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --preload 