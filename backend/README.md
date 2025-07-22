# ABST Backend

Django REST Framework backend for the ABST (Acuity Based Staffing Tool) application.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

## Key Features

- **Authentication**: Token-based authentication with role-based access control
- **Facility Management**: Multi-facility support with section organization
- **Resident Management**: Complete resident lifecycle management
- **ADL Tracking**: Activities of Daily Living assessment and time tracking
- **Analytics**: Real-time caregiving time summaries and reports
- **Data Import**: CSV upload capabilities for bulk data management

## API Endpoints

- `/api/facilities/` - Facility management
- `/api/residents/` - Resident management
- `/api/adls/` - ADL records and analytics
- `/api/users/` - User authentication and management
