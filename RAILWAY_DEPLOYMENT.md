# Railway Deployment Guide

## Automated Paycom Sync Setup

This guide explains how to set up automated Paycom sync on Railway.

### Prerequisites

1. Railway account with your Django app deployed
2. All Paycom SFTP credentials configured as environment variables

### Environment Variables Required

Make sure these are set in your Railway project:

```bash
# Paycom SFTP Configuration
PAYCOM_SFTP_HOST=push.paycomonline.net
PAYCOM_SFTP_USERNAME=your_username
PAYCOM_SFTP_PASSWORD=your_password
PAYCOM_SFTP_REMOTE_DIRECTORY=/Outbound
PAYCOM_SFTP_LOCAL_DIRECTORY=/app/media/paycom_reports

# Django Configuration
DJANGO_SECRET_KEY=your_secret_key
DEBUG=False
ALLOWED_HOSTS=your-railway-app.railway.app
```

### Cron Job Configuration

The `railway.json` file is already configured with:

- **Schedule**: Every 2 hours during business hours (9 AM, 11 AM, 1 PM, 3 PM, 5 PM)
- **Command**: `python manage.py sync_paycom_time_tracking --days-back 2`

### API Endpoints Available

After deployment, you can use these endpoints:

1. **Manual Sync Trigger**:
   ```
   POST /api/paycom/trigger-sync/
   Authorization: Bearer <your_token>
   ```

2. **Sync Status Check**:
   ```
   GET /api/paycom/sync-status/
   Authorization: Bearer <your_token>
   ```

### Monitoring

1. **Railway Dashboard**: Check cron job logs in the Railway dashboard
2. **API Endpoint**: Use the sync-status endpoint to check recent data
3. **Application Logs**: Monitor your Django application logs

### Deployment Steps

1. **Commit all files** to your repository
2. **Deploy to Railway** - the cron job will be automatically set up
3. **Verify environment variables** are set correctly
4. **Test the sync** using the API endpoint

### Troubleshooting

1. **Cron job not running**: Check Railway dashboard for cron job status
2. **SFTP connection issues**: Verify environment variables
3. **Permission errors**: Ensure the Django app has proper permissions

### Schedule Details

- **Business Hours**: 9 AM - 5 PM (UTC-5/EDT or UTC-6/EST)
- **Frequency**: Every 2 hours
- **Days**: Monday through Friday
- **Command**: Automatically syncs last 2 days of Paycom data

This setup ensures your app automatically receives new Paycom data within 2 hours of it being pushed, without any manual intervention.
