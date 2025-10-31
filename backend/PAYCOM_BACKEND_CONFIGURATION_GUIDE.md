# Paycom Backend Configuration Guide

## Overview
Since you have access to Paycom's push reporting backend, you can make the necessary changes directly to align with your weekly scheduling workflow.

## Required Changes

### 1. Schedule Configuration

#### Current Setup (Daily):
```bash
# Typical cron configuration for daily pushes
0 2 * * * /path/to/paycom_sftp_push.sh
```

#### New Setup (Weekly - Friday):
```bash
# Weekly push every Friday at 2:00 PM
0 14 * * 5 /path/to/paycom_sftp_push.sh
```

**Explanation:**
- `0 14` = 2:00 PM (14:00)
- `* * 5` = Every Friday (5th day of week)
- This gives your app time to process before end of business day

### 2. Batch File Push Configuration

#### Current (Individual Files):
```bash
# May push files separately
push_file "employee_directory.numbers"
push_file "employee_dates.numbers" 
push_file "employee_payees.numbers"
```

#### New (Batch Push):
```bash
# Push all files together in one batch
push_files_batch() {
    local files=(
        "employee_directory.numbers"
        "employee_dates.numbers"
        "employee_payees.numbers"
    )
    
    for file in "${files[@]}"; do
        push_file "$file"
    done
}
```

### 3. File Generation Timing

#### Current:
- Files generated daily
- Pushed immediately after generation

#### New:
- Files generated weekly (Friday morning)
- Pushed Friday at 2:00 PM
- Ensures all data is current for the week

## Implementation Steps

### Step 1: Locate Schedule Configuration

Look for these files in Paycom backend:
```
/path/to/paycom/
├── config/
│   ├── sftp_schedule.conf
│   ├── cron_jobs.conf
│   └── push_settings.json
├── scripts/
│   ├── sftp_push.sh
│   ├── generate_reports.sh
│   └── batch_push.sh
└── logs/
    ├── sftp_push.log
    └── report_generation.log
```

### Step 2: Update Cron Schedule

**File**: `/config/cron_jobs.conf` or `/etc/crontab`

**Change from**:
```bash
# Daily at 2 AM
0 2 * * * /opt/paycom/scripts/sftp_push.sh
```

**Change to**:
```bash
# Weekly on Friday at 2 PM
0 14 * * 5 /opt/paycom/scripts/sftp_push.sh
```

### Step 3: Update Push Script

**File**: `/scripts/sftp_push.sh`

**Current** (may be individual):
```bash
#!/bin/bash
# Daily SFTP push
generate_employee_directory
push_file "employee_directory.numbers"

generate_employee_dates  
push_file "employee_dates.numbers"

generate_employee_payees
push_file "employee_payees.numbers"
```

**New** (batch approach):
```bash
#!/bin/bash
# Weekly SFTP push - Friday 2 PM

echo "Starting weekly Paycom SFTP push at $(date)"

# Generate all reports
echo "Generating employee reports..."
generate_employee_directory
generate_employee_dates
generate_employee_payees

# Push all files in batch
echo "Pushing files to SFTP..."
push_files_batch

echo "Weekly SFTP push completed at $(date)"
```

### Step 4: Add Batch Push Function

**File**: `/scripts/sftp_push.sh`

Add this function:
```bash
push_files_batch() {
    local files=(
        "employee_directory.numbers"
        "employee_dates.numbers"
        "employee_payees.numbers"
    )
    
    local success_count=0
    local total_count=${#files[@]}
    
    for file in "${files[@]}"; do
        echo "Pushing $file..."
        if push_file "$file"; then
            echo "✅ Successfully pushed $file"
            ((success_count++))
        else
            echo "❌ Failed to push $file"
        fi
    done
    
    echo "Batch push completed: $success_count/$total_count files successful"
    
    if [ $success_count -eq $total_count ]; then
        return 0
    else
        return 1
    fi
}
```

### Step 5: Update Configuration Files

**File**: `/config/sftp_schedule.conf`

```ini
[schedule]
frequency=weekly
day_of_week=friday
time=14:00
timezone=local

[files]
employee_directory=enabled
employee_dates=enabled
employee_payees=enabled
batch_push=enabled

[logging]
log_level=info
log_file=/opt/paycom/logs/sftp_push.log
```

**File**: `/config/push_settings.json`

```json
{
    "schedule": {
        "frequency": "weekly",
        "day_of_week": 5,
        "hour": 14,
        "minute": 0
    },
    "files": {
        "employee_directory": {
            "enabled": true,
            "filename": "employee_directory.numbers"
        },
        "employee_dates": {
            "enabled": true,
            "filename": "employee_dates.numbers"
        },
        "employee_payees": {
            "enabled": true,
            "filename": "employee_payees.numbers"
        }
    },
    "batch_push": {
        "enabled": true,
        "wait_between_files": 5
    }
}
```

## Testing the Changes

### Step 1: Test Schedule Change
```bash
# Check current cron jobs
crontab -l

# Test the script manually
/opt/paycom/scripts/sftp_push.sh
```

### Step 2: Verify File Generation
```bash
# Check if files are generated
ls -la /opt/paycom/reports/
# Should see all three .numbers files

# Check file timestamps
stat /opt/paycom/reports/employee_directory.numbers
```

### Step 3: Test SFTP Push
```bash
# Test SFTP connection
sftp -P 22 username@your-sftp-server.com

# Check if files are pushed
# Look at your SFTP server for the files
```

### Step 4: Monitor Logs
```bash
# Check push logs
tail -f /opt/paycom/logs/sftp_push.log

# Check for errors
grep -i error /opt/paycom/logs/sftp_push.log
```

## Validation Commands

### Check Schedule:
```bash
# Verify cron job is set correctly
crontab -l | grep sftp_push

# Should show: 0 14 * * 5 /opt/paycom/scripts/sftp_push.sh
```

### Test File Generation:
```bash
# Run report generation manually
cd /opt/paycom/scripts
./generate_reports.sh

# Check if files are created
ls -la /opt/paycom/reports/*.numbers
```

### Test SFTP Push:
```bash
# Test SFTP connection
sftp -o ConnectTimeout=10 username@your-sftp-server.com

# Check if push works
./sftp_push.sh
```

## Rollback Plan

If you need to revert to daily pushes:

### Step 1: Revert Cron Schedule
```bash
# Change back to daily
0 2 * * * /opt/paycom/scripts/sftp_push.sh
```

### Step 2: Revert Script Changes
```bash
# Restore original sftp_push.sh
cp /opt/paycom/scripts/sftp_push.sh.backup /opt/paycom/scripts/sftp_push.sh
```

### Step 3: Restart Services
```bash
# Restart Paycom services
systemctl restart paycom-sftp
systemctl restart paycom-reports
```

## Monitoring and Alerts

### Set Up Monitoring:
```bash
# Add to your monitoring system
# Check if weekly push completed successfully
# Alert if no files pushed on Friday by 3 PM
```

### Log Monitoring:
```bash
# Monitor push logs
tail -f /opt/paycom/logs/sftp_push.log | grep -E "(SUCCESS|ERROR|COMPLETED)"
```

### File Verification:
```bash
# Check if files exist on SFTP server
# Verify file sizes and timestamps
# Alert if files are missing or outdated
```

## Benefits of This Configuration

### For Your App:
- ✅ **Perfect timing**: Friday 2 PM push aligns with your workflow
- ✅ **Complete data**: All three files pushed together
- ✅ **Reliable delivery**: Weekly batch processing
- ✅ **Predictable schedule**: Same timing every week

### For Paycom System:
- ✅ **Reduced load**: Weekly vs daily processing
- ✅ **Better reliability**: Batch processing
- ✅ **Easier monitoring**: Weekly status checks
- ✅ **Simplified maintenance**: Less frequent operations

## Summary

The key changes you need to make in Paycom backend:

1. **Cron Schedule**: `0 2 * * *` → `0 14 * * 5`
2. **Batch Push**: Push all three files together
3. **File Generation**: Generate reports Friday morning
4. **Logging**: Enhanced logging for weekly operations

This will perfectly align your Paycom data with your weekly scheduling workflow!
