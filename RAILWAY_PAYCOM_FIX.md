# Railway Paycom Integration Fix

## Problem
Paycom API endpoints returning 404 errors on Railway deployment, even though they work on localhost.

## Root Cause
The entire `paycom` app directory (24 files including migrations) was missing from git, so Railway didn't have the Paycom code deployed.

## What Was Fixed
✅ Added all Paycom app files to git (commit `6bf9afb0a`):
- `backend/paycom/migrations/0001_initial.py`
- `backend/paycom/models.py`
- `backend/paycom/views.py`
- `backend/paycom/serializers.py`
- All management commands
- All utility files

## What Needs to Happen on Railway

### Step 1: Verify Railway Deployment
1. Go to https://railway.app
2. Check if a new deployment is in progress (should auto-deploy from the latest push)
3. Wait for deployment to complete (2-5 minutes)

### Step 2: Run Migrations
After Railway deploys, the Paycom database tables need to be created:

**Option A: Railway Dashboard**
1. Go to your Railway project
2. Open the service/container
3. Click on "Deploy Logs" or "Shell"
4. Run: `python manage.py migrate`

**Option B: Railway CLI**
```bash
railway run python manage.py migrate
```

**Option C: Check if migrations run automatically**
- Some Railway configurations auto-run migrations
- Check the deployment logs to see if migrations ran

### Step 3: Restart the Service (if needed)
If migrations ran but endpoints still don't work:
1. Go to Railway dashboard
2. Find your service
3. Click "Restart" or "Redeploy"
4. Wait for it to complete

### Step 4: Verify Endpoints
After migrations run, test these endpoints:
- `https://scheduler-abst-production.up.railway.app/api/paycom/employees/`
- `https://scheduler-abst-production.up.railway.app/api/paycom/sync-logs/`
- `https://scheduler-abst-production.up.railway.app/api/paycom/sync/start_sync/`

They should return JSON (even if empty) instead of 404.

## Expected API Endpoints

After successful deployment, these endpoints should work:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/paycom/employees/` | GET | List Paycom employees |
| `/api/paycom/employees/facility_options/` | GET | Get facility options |
| `/api/paycom/sync-logs/` | GET | Get sync history |
| `/api/paycom/sync/start_sync/` | POST | Start a sync operation |
| `/api/paycom/files/` | GET | List Paycom files |

## Troubleshooting

### If endpoints still return 404:
1. **Check Railway logs** for errors during deployment
2. **Verify Paycom app is in INSTALLED_APPS** in `settings.py` (should be there)
3. **Check URL routing** - verify `backend/abst/urls.py` includes Paycom routes (should be there)
4. **Restart the service** - sometimes Railway needs a restart to pick up new code

### If migrations fail:
1. Check Railway logs for migration errors
2. Verify database connection is working
3. Try running migrations manually via Railway shell

### If you see 500 errors instead of 404:
- Good! This means endpoints are found but there's a runtime error
- Check Railway logs for the actual error
- Usually indicates missing environment variables or database issues

## Status Check
After following the steps above, the Paycom integration should work exactly like it does on localhost.

