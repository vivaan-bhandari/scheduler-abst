# ABST - Acuity Based Staffing Tool

A fullstack web application for managing acuity-based staffing calculations in healthcare facilities.

## Tech Stack

- **Backend**: Django 4.2 + Django REST Framework
- **Frontend**: React 18 + Material-UI
- **Database**: PostgreSQL (with SQLite fallback for development)
- **Authentication**: Token-based authentication

## Features

- ✅ User authentication (login/register/logout)
- ✅ View all saved ADL responses with pagination
- ✅ Edit and delete ADL records
- ✅ Search and filter functionality
- ✅ Real-time statistics dashboard
- ✅ Responsive Material-UI interface

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 16+
- PostgreSQL (optional, falls back to SQLite)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd abst-fullstack
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Set up the database**
   ```bash
   cd ../backend
   python manage.py makemigrations
   python manage.py migrate
   ```

4. **Create a superuser (optional)**
   ```bash
   python manage.py createsuperuser
   ```

### Running the Application

#### Development Mode (Both Frontend and Backend)
```bash
# From the root directory
npm run dev
```

#### Individual Services
```bash
# Backend only (Django)
npm run start-backend

# Frontend only (React)
npm run start-frontend
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Django Admin: http://localhost:8000/admin

## API Endpoints

### Authentication
- `POST /api/users/register/` - Create new user account
- `POST /api/users/login/` - Get authentication token
- `POST /api/users/logout/` - Invalidate token

### ADLs (require authentication)
- `GET /api/adls/` - List all ADLs (paginated)
- `POST /api/adls/` - Create new ADL
- `GET /api/adls/{id}/` - Get specific ADL
- `PUT /api/adls/{id}/` - Update ADL
- `DELETE /api/adls/{id}/` - Soft delete ADL
- `GET /api/adls/by_resident/` - Filter by resident
- `GET /api/adls/by_date/` - View by date range
- `GET /api/adls/summary/` - Get statistics

### Residents
- `GET /api/residents/` - List all residents
- `POST /api/residents/` - Create new resident
- `GET /api/residents/{id}/` - Get specific resident
- `PUT /api/residents/{id}/` - Update resident
- `DELETE /api/residents/{id}/` - Delete resident

## Database Configuration

### PostgreSQL (Production)
Set environment variables:
```bash
export USE_POSTGRES=true
export DB_NAME=abst_db
export DB_USER=postgres
export DB_PASSWORD=your_password
export DB_HOST=localhost
export DB_PORT=5432
```

### SQLite (Development - Default)
No configuration needed. The application will automatically use SQLite for development.

## Project Structure

```
abst-fullstack/
├── backend/                 # Django backend
│   ├── abst/               # Django project settings
│   ├── adls/               # ADL management app
│   ├── residents/          # Resident management app
│   ├── users/              # User authentication app
│   ├── manage.py
│   └── requirements.txt
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/       # Authentication components
│   │   │   └── Dashboard/  # Main dashboard components
│   │   └── App.js
│   └── package.json
├── package.json            # Root package.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details 