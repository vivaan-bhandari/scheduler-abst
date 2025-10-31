#!/bin/bash

# Paycom Sync Status Checker
# This script helps you monitor the automated sync status

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"

echo "=== PAYCOM AUTOMATED SYNC STATUS ==="
echo "Current time: $(date)"
echo ""

# Check if cron job is installed
echo "📅 CRON JOB STATUS:"
if crontab -l | grep -q "auto_sync_paycom.sh"; then
    echo "✅ Cron job is installed and active"
    echo "📋 Schedule: Every 2 hours during business hours (9 AM, 11 AM, 1 PM, 3 PM, 5 PM)"
else
    echo "❌ Cron job is NOT installed"
    echo "💡 Run: crontab paycom_sync_cron.txt"
fi
echo ""

# Check recent log files
echo "📊 RECENT SYNC LOGS:"
if [ -d "$LOG_DIR" ]; then
    latest_log=$(ls -t "$LOG_DIR"/paycom_sync_*.log 2>/dev/null | head -1)
    if [ -n "$latest_log" ]; then
        echo "📄 Latest log: $(basename "$latest_log")"
        echo "📏 Log size: $(du -h "$latest_log" | cut -f1)"
        echo ""
        
        # Show last sync status
        echo "🔄 LAST SYNC STATUS:"
        if grep -q "SUCCESS: Paycom sync completed successfully" "$latest_log"; then
            echo "✅ Last sync: SUCCESS"
        elif grep -q "ERROR: Paycom sync failed" "$latest_log"; then
            echo "❌ Last sync: FAILED"
        else
            echo "⚠️  Last sync: UNKNOWN STATUS"
        fi
        
        # Show last sync time
        last_sync=$(grep "Automated Paycom Sync Started" "$latest_log" | tail -1 | cut -d']' -f1 | cut -d'[' -f2)
        if [ -n "$last_sync" ]; then
            echo "🕐 Last sync time: $last_sync"
        fi
        echo ""
        
        # Show recent entries
        echo "📝 RECENT LOG ENTRIES (last 10 lines):"
        tail -10 "$latest_log" | sed 's/^/   /'
    else
        echo "❌ No log files found"
    fi
else
    echo "❌ Log directory not found: $LOG_DIR"
fi
echo ""

# Check if sync process is currently running
echo "⚡ CURRENT PROCESS STATUS:"
if pgrep -f "sync_paycom_time_tracking" > /dev/null; then
    echo "🔄 Sync process is currently running"
    echo "📊 Process details:"
    ps aux | grep "sync_paycom_time_tracking" | grep -v grep | sed 's/^/   /'
else
    echo "✅ No sync process currently running"
fi
echo ""

# Check next scheduled run
echo "⏰ NEXT SCHEDULED RUNS:"
echo "   Today's remaining sync times:"
current_hour=$(date +%H)
for hour in 9 11 13 15 17; do
    if [ "$current_hour" -lt "$hour" ]; then
        echo "   - ${hour}:00 (in $((hour - current_hour)) hours)"
    fi
done
echo ""

echo "=== END STATUS CHECK ==="
