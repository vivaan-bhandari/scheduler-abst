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

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Change to backend directory
WORKDIR /app/backend

# Run migrations and collect static files
RUN python manage.py migrate --noinput
RUN python manage.py collectstatic --noinput

# Expose port
EXPOSE $PORT

# Start command
CMD gunicorn abst.wsgi:application --bind 0.0.0.0:$PORT --workers 2 