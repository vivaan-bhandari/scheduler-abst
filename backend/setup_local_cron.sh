#!/bin/bash

# Setup local cron job for Paycom sync
# This script sets up automated sync every 2 hours during business hours

echo "Setting up local Paycom sync automation..."

# Get the current directory (backend)
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

# Create the cron job entry
CRON_ENTRY="0 9,11,13,15,17 * * * cd $BACKEND_DIR && python manage.py sync_paycom_time_tracking --days-back 2 >> logs/paycom_sync_\$(date +\%Y\%m\%d).log 2>&1"

# Add to crontab
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Local cron job installed!"
echo "📅 Schedule: Every 2 hours during business hours (9 AM, 11 AM, 1 PM, 3 PM, 5 PM)"
echo "📝 Logs will be saved to: $BACKEND_DIR/logs/"
echo ""
echo "To view your cron jobs: crontab -l"
echo "To remove cron jobs: crontab -r"
echo ""
echo "🎯 Next time Paycom pushes files, they'll be automatically synced within 2 hours!"
