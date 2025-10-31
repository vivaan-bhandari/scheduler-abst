#!/bin/bash
# Complete Weekly Paycom Sync & Roster Creation Script
# Runs every Friday at 2:00 PM to align with schedule finalization workflow
# This creates:
# 1. Updated employee data from Paycom
# 2. Time tracking data (clock in/out times and overtime)
# 3. Weekly staff roster and availability

# Set the Django project directory
PROJECT_DIR="/path/to/your/abst-fullstack/backend"

# Change to project directory
cd $PROJECT_DIR

# Activate virtual environment (if using one)
# source venv/bin/activate

# Run the complete weekly sync (Paycom data + time tracking + roster creation)
echo "Starting complete weekly Paycom sync, time tracking, and roster creation at $(date)"
python manage.py sync_paycom_complete_weekly --notify

# Log the result
if [ $? -eq 0 ]; then
    echo "Complete weekly sync, time tracking, and roster creation completed successfully at $(date)"
else
    echo "Complete weekly sync, time tracking, and roster creation failed at $(date)"
fi
