FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire project first
COPY . .

# Install Python dependencies from backend requirements
RUN pip install --no-cache-dir -r backend/requirements.txt

# Change to backend directory
WORKDIR /app/backend

# Collect static files only (migrations will run at startup)
RUN python manage.py collectstatic --noinput

# Create a startup script
RUN echo '#!/bin/bash\n\
echo "Starting Django application..."\n\
echo "Port: $PORT"\n\
echo "Database URL: $DATABASE_URL"\n\
echo "Debug: $DEBUG"\n\
echo "Allowed Hosts: $ALLOWED_HOSTS"\n\
\n\
# Wait for database to be ready\n\
echo "Waiting for database..."\n\
sleep 5\n\
\n\
# Run migrations\n\
echo "Running migrations..."\n\
python manage.py migrate --noinput\n\
\n\
# Collect static files\n\
echo "Collecting static files..."\n\
python manage.py collectstatic --noinput\n\
\n\
# Add Brighton facilities\n\
echo "Setting up facilities..."\n\
python add_brighton_facilities.py\n\
\n\
# Seed ADL questions\n\
echo "Seeding ADL questions..."\n\
python adls/seed_adl_questions.py\n\
\n\
# Create superuser if it doesn'\''t exist\n\
echo "Checking for superuser..."\n\
python manage.py shell -c "\n\
from django.contrib.auth.models import User\n\
if not User.objects.filter(username='\''superadmin'\'').exists():\n\
    User.objects.create_superuser('\''superadmin'\'', '\''superadmin@example.com'\'', '\''superpass123'\'')\n\
    print('\''Superuser created'\'')\n\
else:\n\
    print('\''Superuser already exists'\'')\n\
"\n\
\n\
# Grant facility access to all users\n\
echo "Granting facility access to users..."\n\
python manage.py shell -c "\n\
from django.contrib.auth.models import User\n\
from users.models import FacilityAccess\n\
from residents.models import Facility\n\
\n\
users = User.objects.all()\n\
facilities = Facility.objects.all()\n\
\n\
for user in users:\n\
    for facility in facilities:\n\
        access, created = FacilityAccess.objects.get_or_create(\n\
            user=user,\n\
            facility=facility,\n\
            defaults={\n\
                '\''role'\'': '\''admin'\'' if user.is_staff else '\''staff'\'',\n\
                '\''status'\'': '\''approved'\''\n\
            }\n\
        )\n\
        if not created and access.status != '\''approved'\'':\n\
            access.status = '\''approved'\''\n\
            access.role = '\''admin'\'' if user.is_staff else '\''staff'\''\n\
            access.save()\n\
\n\
print(f'\''Granted facility access to {users.count()} users for {facilities.count()} facilities'\'')\n\
"\n\
\n\
# Start gunicorn\n\
echo "Starting gunicorn..."\n\
exec gunicorn abst.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --access-logfile - --error-logfile - --preload\n\
' > /app/backend/start.sh && chmod +x /app/backend/start.sh

# Expose port
EXPOSE $PORT

# Start command with better error handling
CMD ["/app/backend/start.sh"] 