# Deployment Guide - Railway (Backend) & Vercel (Frontend)

## 🚀 Quick Deployment Steps

### Step 1: Prepare Files for Commit

**IMPORTANT:** Do NOT commit these files:
- `backend/.env` (contains secrets)
- `backend/db.sqlite3` (local database)
- `.DS_Store` (macOS system file)

### Step 2: Stage and Commit Your Changes

```bash
# Add the WeeklyPlanner fixes and other code changes
git add frontend/src/components/Scheduling/WeeklyPlanner.js
git add frontend/src/components/Scheduling/*.js
git add backend/scheduling/
git add backend/adls/

# Add any new files you want to deploy
git add railway.json
git add vercel.json

# Commit with a descriptive message
git commit -m "Fix scheduling: overnight shift calculations, daily/weekly overtime alerts, scroll position preservation"
```

### Step 3: Push to GitHub

```bash
git push origin main
```

---

## 🔧 Railway Deployment (Backend)

Railway automatically deploys when you push to `main` branch.

### Verify Deployment:

1. Go to https://railway.app
2. Select your project
3. Check the "Deployments" tab
4. Wait for the build to complete (usually 2-5 minutes)

### Environment Variables (if needed):
- Make sure all required environment variables are set in Railway dashboard
- Settings → Variables

### Check Logs:
- If deployment fails, check the logs in Railway dashboard

---

## 🌐 Vercel Deployment (Frontend)

Vercel automatically deploys when you push to `main` branch.

### Verify Deployment:

1. Go to https://vercel.com
2. Select your project: `scheduler-abst`
3. Check the "Deployments" tab
4. Wait for the build to complete (usually 1-3 minutes)

### Important:
- Vercel is configured to build from the root directory
- The `vercel.json` config handles the build automatically
- Frontend will be deployed to: `scheduler-abst.vercel.app`

---

## ✅ Post-Deployment Checklist

1. **Test the Frontend:**
   - Visit your Vercel URL
   - Test the Weekly Planner
   - Verify overnight shift calculations work
   - Check that daily/weekly overtime alerts appear correctly
   - Verify scroll position is preserved after assignments

2. **Test the Backend:**
   - Check Railway logs for any errors
   - Test API endpoints if needed

3. **Monitor:**
   - Watch Railway and Vercel dashboards for any errors
   - Check browser console for frontend errors

---

## 🐛 Troubleshooting

### Railway Deployment Fails:
- Check Railway logs
- Verify environment variables are set
- Ensure `requirements.txt` is up to date

### Vercel Deployment Fails:
- Check Vercel build logs
- Verify `package.json` has correct build scripts
- Ensure `vercel.json` is configured correctly

### Build Errors:
- Check if all dependencies are listed in `requirements.txt` (backend) or `package.json` (frontend)
- Verify node/python versions match your local environment

---

## 📝 Notes

- Both Railway and Vercel auto-deploy on push to `main` branch
- Deployments usually take 2-5 minutes
- You'll receive email notifications when deployments complete
- Previous deployments are saved for easy rollback if needed

