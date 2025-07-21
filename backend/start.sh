#!/bin/bash
# Start script for Railway deployment

set -e

echo "Starting Django application..."
echo "Port: $PORT"
echo "Database URL: $DATABASE_URL"

# Wait for database to be ready
echo "Waiting for database..."
sleep 5

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start gunicorn
echo "Starting gunicorn..."
exec gunicorn abst.wsgi --bind 0.0.0.0:$PORT --log-file - --workers 2 