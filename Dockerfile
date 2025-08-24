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

# Use our custom start.sh script instead of creating a new one
# The start.sh script is already in the repository and has the correct configuration

# Expose port
EXPOSE $PORT

# Start command using our custom script
CMD ["/app/backend/start.sh"] 