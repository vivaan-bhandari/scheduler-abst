# ABST - Acuity Based Staffing Tool

A comprehensive web application for managing acuity-based staffing calculations in healthcare facilities. Built with Django REST Framework backend and React frontend.

## 🚀 Features

- **User Management**: Secure authentication with role-based access control
- **Facility Management**: Multi-facility support with section-based organization
- **Resident Management**: Complete resident lifecycle management
- **ADL Tracking**: Activities of Daily Living assessment and time tracking
- **Analytics Dashboard**: Real-time caregiving time summaries and reports
- **Data Import/Export**: CSV upload capabilities for bulk data management

## 🛠 Tech Stack

- **Backend**: Django 4.2 + Django REST Framework
- **Frontend**: React 18 + Material-UI
- **Database**: PostgreSQL (production) / SQLite (development)
- **Authentication**: Token-based authentication
- **Deployment**: Railway (backend) + Vercel (frontend)

## 📋 Prerequisites

- Python 3.9+
- Node.js 16+
- PostgreSQL (optional, falls back to SQLite)

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd abst-fullstack
npm install
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

### 4. Run Development Servers
```bash
# From root directory
npm run dev
```

**Access Points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Django Admin: http://localhost:8000/admin

## 📚 API Documentation

### Authentication
- `POST /api/users/register/` - User registration
- `POST /api/users/login/` - User authentication
- `POST /api/users/logout/` - User logout

### Core Resources
- `GET /api/facilities/` - List facilities
- `GET /api/residents/` - List residents
- `GET /api/adls/` - List ADL records
- `POST /api/adls/upload/` - Bulk ADL data import

### Analytics
- `GET /api/facilities/{id}/caregiving_summary/` - Facility caregiving summary
- `GET /api/residents/{id}/caregiving_summary/` - Resident caregiving summary

## 🏗 Project Structure

```
abst-fullstack/
├── backend/                 # Django backend
│   ├── abst/               # Project settings & configuration
│   ├── adls/               # ADL management & analytics
│   ├── residents/          # Facility & resident management
│   ├── users/              # Authentication & access control
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/       # Authentication components
│   │   │   ├── Dashboard/  # Main dashboard & analytics
│   │   │   └── Facility/   # Facility management
│   │   └── App.tsx         # Main application
│   └── package.json        # Node dependencies
└── README.md
```

## 🔧 Configuration

### Environment Variables
```bash
# Django Settings
SECRET_KEY=your-secret-key
DEBUG=False
DATABASE_URL=postgresql://user:pass@host:port/db

# CORS Settings
CORS_ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000
```

## 📊 Database Schema

The application uses a relational database with the following key models:
- **Facility**: Healthcare facilities with sections
- **Resident**: Patients within facility sections
- **ADL**: Activities of Daily Living records with time tracking
- **User**: System users with role-based permissions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions, please contact the development team or create an issue in the repository. 