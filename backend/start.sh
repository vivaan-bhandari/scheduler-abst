#!/bin/bash
# Start script for Railway deployment

echo "Starting Django application..."
echo "Port: $PORT"
echo "Database URL: $DATABASE_URL"

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Start gunicorn
exec gunicorn abst.wsgi --bind 0.0.0.0:$PORT --log-file - 