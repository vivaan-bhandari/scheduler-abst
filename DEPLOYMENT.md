# 🚀 Deployment Guide

This guide will walk you through deploying your ABST application online so your internship manager can access it.

## 📋 Prerequisites

- GitHub account
- Railway account (free tier available)
- Vercel account (free tier available)

## 🎯 Deployment Overview

We'll deploy:
- **Backend (Django)**: Railway (PostgreSQL database + Django app)
- **Frontend (React)**: Vercel (static hosting)

## 🔧 Step 1: Prepare Your Code

1. **Commit your changes** (if you haven't already):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Run the deployment script**:
   ```bash
   ./deploy.sh
   ```

## 🚂 Step 2: Deploy Backend to Railway

1. **Go to [Railway](https://railway.app)** and sign up/login
2. **Click "New Project"** → "Deploy from GitHub repo"
3. **Select your repository**
4. **Choose the backend folder** (not the root)
5. **Add environment variables**:
   ```
   SECRET_KEY=your-super-secret-key-here
   DEBUG=False
   USE_HTTPS=True
   CORS_ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
   CSRF_TRUSTED_ORIGINS=https://your-backend-domain.railway.app,https://your-frontend-domain.vercel.app
   ALLOWED_HOSTS=your-backend-domain.railway.app
   ```
6. **Railway will automatically**:
   - Detect it's a Django app
   - Install dependencies from requirements.txt
   - Run your start.sh script
   - Provide a PostgreSQL database
   - Give you a public URL

## ⚡ Step 3: Deploy Frontend to Vercel

1. **Go to [Vercel](https://vercel.com)** and sign up/login
2. **Click "New Project"** → "Import Git Repository"
3. **Select your repository**
4. **Configure the project**:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
5. **Add environment variables**:
   ```
   REACT_APP_API_BASE_URL=https://your-backend-domain.railway.app
   ```
6. **Deploy!**

## 🔗 Step 4: Connect Frontend to Backend

1. **Copy your Railway backend URL** (e.g., `https://abst-backend-production.up.railway.app`)
2. **Go to your Vercel project settings**
3. **Update the environment variable**:
   ```
   REACT_APP_API_BASE_URL=https://your-backend-domain.railway.app
   ```
4. **Redeploy** the frontend

## 🧪 Step 5: Test Your Deployment

1. **Visit your Vercel frontend URL**
2. **Try to log in** (use the superadmin credentials from your start.sh)
3. **Test basic functionality**
4. **Check the browser console** for any errors

## 🔐 Default Login Credentials

After deployment, you can log in with:
- **Username**: `superadmin`
- **Password**: `superpass123`

## 🚨 Troubleshooting

### Backend Issues
- Check Railway logs for errors
- Ensure all environment variables are set
- Verify DATABASE_URL is correct

### Frontend Issues
- Check browser console for API errors
- Verify REACT_APP_API_BASE_URL is correct
- Ensure CORS is properly configured

### Database Issues
- Railway automatically provides PostgreSQL
- Your start.sh script handles migrations
- Check if migrations ran successfully

## 📱 Sharing with Your Manager

Once deployed, share these URLs:
- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-app.railway.app`

## 💰 Cost

- **Railway**: Free tier (limited usage)
- **Vercel**: Free tier (unlimited)
- **Total**: $0/month for basic usage

## 🔄 Updates

To update your deployed app:
1. Make changes locally
2. Commit and push to GitHub
3. Railway and Vercel will automatically redeploy

## 🎉 Success!

Your app is now online and accessible to your internship manager! 🚀
