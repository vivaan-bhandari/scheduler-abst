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

# Run migrations and collect static files
RUN python manage.py migrate --noinput || echo "Migrations failed, continuing..."
RUN python manage.py collectstatic --noinput || echo "Static collection failed, continuing..."

# Create a startup script
RUN echo '#!/bin/bash\n\
echo "Starting Django application..."\n\
echo "Port: $PORT"\n\
echo "Database URL: $DATABASE_URL"\n\
echo "Debug: $DEBUG"\n\
echo "Allowed Hosts: $ALLOWED_HOSTS"\n\
\n\
# Wait a moment for database\n\
sleep 2\n\
\n\
# Start gunicorn\n\
exec gunicorn abst.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --access-logfile - --error-logfile - --preload\n\
' > /app/backend/start.sh && chmod +x /app/backend/start.sh

# Expose port
EXPOSE $PORT

# Start command with better error handling
CMD ["/app/backend/start.sh"] 