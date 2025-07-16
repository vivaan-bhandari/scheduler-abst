#!/bin/bash

# ABST App Deployment Script
# This script helps prepare and deploy the ABST application

set -e  # Exit on any error

echo "🚀 ABST App Deployment Script"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "backend/manage.py" ]; then
    print_error "Please run this script from the abst-fullstack directory"
    exit 1
fi

print_status "Checking prerequisites..."

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_warning "Not in a git repository. Initializing..."
    git init
    git add .
    git commit -m "Initial commit for deployment"
fi

# Check backend requirements
print_status "Checking backend requirements..."
if [ ! -f "backend/requirements.txt" ]; then
    print_error "backend/requirements.txt not found"
    exit 1
fi

if [ ! -f "backend/Procfile" ]; then
    print_error "backend/Procfile not found"
    exit 1
fi

if [ ! -f "backend/runtime.txt" ]; then
    print_error "backend/runtime.txt not found"
    exit 1
fi

# Check frontend requirements
print_status "Checking frontend requirements..."
if [ ! -f "frontend/package.json" ]; then
    print_error "frontend/package.json not found"
    exit 1
fi

# Check if config.js exists
if [ ! -f "frontend/src/config.js" ]; then
    print_error "frontend/src/config.js not found"
    exit 1
fi

print_status "All prerequisites met!"

echo ""
echo "📋 Deployment Checklist:"
echo "========================"
echo "1. ✅ Code is in a git repository"
echo "2. ✅ Backend files are ready (requirements.txt, Procfile, runtime.txt)"
echo "3. ✅ Frontend files are ready (package.json, config.js)"
echo ""
echo "🚀 Next Steps:"
echo "=============="
echo "1. Push your code to GitHub:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/abst-app.git"
echo "   git push -u origin main"
echo ""
echo "2. Deploy to Railway:"
echo "   - Go to railway.app"
echo "   - Create new project"
echo "   - Deploy from GitHub repo"
echo "   - Select backend directory first"
echo "   - Then create another project for frontend"
echo ""
echo "3. Set environment variables in Railway:"
echo "   - DEBUG=False"
echo "   - SECRET_KEY=your-secret-key"
echo "   - ALLOWED_HOSTS=your-app.railway.app"
echo "   - CORS_ALLOWED_ORIGINS=https://your-frontend.railway.app"
echo "   - REACT_APP_API_URL=https://your-backend.railway.app"
echo ""
echo "4. Run migrations:"
echo "   python manage.py migrate"
echo "   python manage.py createsuperuser"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT_GUIDE.md"
echo ""
print_status "Deployment preparation complete!" 