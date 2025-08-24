#!/bin/bash

echo "🚀 Starting deployment process..."

# Check if git is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Git working directory is not clean. Please commit or stash your changes first."
    exit 1
fi

echo "✅ Git working directory is clean"

# Build frontend
echo "🔨 Building frontend..."
cd frontend
npm run build
cd ..

echo "✅ Frontend built successfully"

echo ""
echo "📋 Next steps:"
echo "1. Deploy backend to Railway:"
echo "   - Go to https://railway.app"
echo "   - Connect your GitHub repository"
echo "   - Deploy the backend folder"
echo ""
echo "2. Deploy frontend to Vercel:"
echo "   - Go to https://vercel.com"
echo "   - Connect your GitHub repository"
echo "   - Deploy the frontend folder"
echo ""
echo "3. Update environment variables in both platforms"
echo "4. Test your deployed application"
echo ""
echo "🎯 Your app will be accessible online for your internship manager!"
