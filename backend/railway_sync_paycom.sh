#!/bin/bash

# Railway Paycom Sync Script
# This script is optimized for Railway's environment

echo "=== Railway Paycom Sync Started ==="
echo "Timestamp: $(date)"
echo "Environment: Railway"

# Change to the correct directory (Railway sets this automatically)
cd /app || {
    echo "ERROR: Could not change to /app directory"
    exit 1
}

# Run the sync command
echo "Running Paycom time tracking sync..."
python manage.py sync_paycom_time_tracking --days-back 2

# Check exit status
if [ $? -eq 0 ]; then
    echo "SUCCESS: Paycom sync completed successfully"
    exit 0
else
    echo "ERROR: Paycom sync failed with exit code $?"
    exit 1
fi
