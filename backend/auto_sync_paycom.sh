#!/bin/bash

# Automated Paycom Sync Script
# This script automatically syncs new Paycom files every 2 hours
# Created: $(date)

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/paycom_sync_$(date +%Y%m%d).log"
MAX_LOG_DAYS=7

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to cleanup old logs
cleanup_old_logs() {
    find "$LOG_DIR" -name "paycom_sync_*.log" -mtime +$MAX_LOG_DAYS -delete
    log_message "Cleaned up logs older than $MAX_LOG_DAYS days"
}

# Function to check if sync is already running
check_running_sync() {
    if pgrep -f "sync_paycom_time_tracking" > /dev/null; then
        log_message "WARNING: Paycom sync is already running. Skipping this execution."
        exit 0
    fi
}

# Function to run the sync
run_sync() {
    log_message "Starting automated Paycom sync..."
    
    # Change to the backend directory
    cd "$SCRIPT_DIR" || {
        log_message "ERROR: Could not change to script directory: $SCRIPT_DIR"
        exit 1
    }
    
    # Run the sync command (look for files from last 2 days)
    python manage.py sync_paycom_time_tracking --days-back 2 2>&1 | while IFS= read -r line; do
        log_message "SYNC: $line"
    done
    
    # Check if sync was successful
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log_message "SUCCESS: Paycom sync completed successfully"
    else
        log_message "ERROR: Paycom sync failed with exit code ${PIPESTATUS[0]}"
        exit 1
    fi
}

# Function to send notification (optional - can be configured later)
send_notification() {
    local status="$1"
    local message="$2"
    
    # This can be expanded to send emails, Slack notifications, etc.
    log_message "NOTIFICATION: $status - $message"
}

# Main execution
main() {
    log_message "=== Automated Paycom Sync Started ==="
    
    # Check if sync is already running
    check_running_sync
    
    # Cleanup old logs
    cleanup_old_logs
    
    # Run the sync
    if run_sync; then
        send_notification "SUCCESS" "Paycom sync completed successfully"
        log_message "=== Automated Paycom Sync Completed Successfully ==="
    else
        send_notification "ERROR" "Paycom sync failed - check logs"
        log_message "=== Automated Paycom Sync Failed ==="
        exit 1
    fi
}

# Run main function
main "$@"
