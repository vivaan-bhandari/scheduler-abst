# Paycom Weekly Workflow Guide

## Overview
This guide explains how to align your Paycom SFTP integration with your weekly ADL-based scheduling workflow.

## Current Setup
- **App**: Weekly ADL data entry (Monday-Sunday)
- **Scheduling**: AI recommendations based on ADL data
- **Finalization**: Friday before next week (as per Roddy's guidance)
- **Paycom**: Currently set to daily push (misaligned)

## Recommended Weekly Workflow

### Monday - Thursday: Data Collection
```
Monday: Start of work week
Tuesday: Begin ADL data entry for next week
Wednesday: Continue ADL data entry
Thursday: Complete ADL data entry and review
```

### Friday: Schedule Finalization Day
```
Morning: Run weekly Paycom sync
Afternoon: Generate AI recommendations based on ADL data
Evening: Finalize next week's schedule
```

### Weekend: Distribution
```
Saturday: Staff review finalized schedule
Sunday: Any last-minute adjustments
```

## Implementation Steps

### 1. Set Up Weekly Paycom Sync

#### Option A: Cron Job (Recommended)
```bash
# Add to crontab (runs every Friday at 2:00 PM)
0 14 * * 5 /path/to/your/project/backend/cron_weekly_paycom_sync.sh
```

#### Option B: Manual Execution
```bash
# Run weekly sync manually on Fridays
cd /path/to/your/project/backend
python manage.py sync_paycom_weekly --notify
```

#### Option C: Django Management Command
```bash
# Test the weekly sync
python manage.py sync_paycom_weekly --force

# Run with notifications
python manage.py sync_paycom_weekly --notify
```

### 2. Workflow Integration

#### Friday Morning (2:00 PM):
1. **Paycom Sync**: Updates employee data, roles, and availability
2. **Staff Sync**: Ensures Staff model has latest Paycom data
3. **Hours Update**: Updates staff hours and constraints

#### Friday Afternoon:
1. **ADL Review**: Ensure ADL data is complete for next week
2. **AI Recommendations**: Generate staffing recommendations
3. **Schedule Creation**: Create shifts based on recommendations
4. **Staff Assignment**: Assign staff to shifts

#### Friday Evening:
1. **Schedule Finalization**: Lock in the schedule
2. **Distribution**: Send schedule to staff

### 3. Monitoring and Alerts

The weekly sync command includes:
- ✅ **Success notifications**: Confirms sync completed
- ⚠️ **Error handling**: Reports any sync issues
- 📊 **Detailed logging**: Shows what was updated
- 📝 **Next steps guidance**: Reminds of schedule workflow

## Benefits of Weekly Approach

### Aligned Workflow:
- ✅ **Consistent timing**: Matches your ADL data entry cycle
- ✅ **Fresh data**: Employee data updated before schedule creation
- ✅ **Reduced complexity**: No daily processing overhead
- ✅ **Better planning**: Staff data available when needed

### Resource Efficiency:
- ✅ **Less SFTP traffic**: Weekly vs daily connections
- ✅ **Reduced processing**: Batch processing vs real-time
- ✅ **Better performance**: Less system load
- ✅ **Easier monitoring**: Weekly sync status vs daily

## Troubleshooting

### Common Issues:

1. **Sync fails on non-Friday**:
   ```bash
   # Use --force flag
   python manage.py sync_paycom_weekly --force
   ```

2. **Recent sync exists**:
   ```bash
   # Check recent syncs
   python manage.py sync_paycom_weekly --force
   ```

3. **SFTP connection issues**:
   ```bash
   # Test connection
   python manage.py sync_paycom --test-connection
   ```

### Monitoring Commands:

```bash
# Check sync status
python manage.py shell -c "
from paycom.models import PaycomSyncLog
recent = PaycomSyncLog.objects.filter(status='completed').order_by('-started_at')[:5]
for sync in recent:
    print(f'{sync.started_at.date()}: {sync.get_status_display()} - {sync.employees_processed} employees')
"

# Check staff sync status
python manage.py shell -c "
from scheduling.models import Staff
total = Staff.objects.count()
paycom_synced = Staff.objects.exclude(notes__isnull=True).count()
print(f'Total staff: {total}, Paycom synced: {paycom_synced}')
"
```

## Migration from Daily to Weekly

### Step 1: Test Weekly Sync
```bash
# Test the new weekly command
python manage.py sync_paycom_weekly --force
```

### Step 2: Disable Daily Sync
- Remove or comment out daily cron jobs
- Update any daily automation scripts

### Step 3: Set Up Friday Schedule
```bash
# Add to crontab
0 14 * * 5 /path/to/your/project/backend/cron_weekly_paycom_sync.sh
```

### Step 4: Monitor First Week
- Check sync logs
- Verify staff data updates
- Ensure scheduling works correctly

## Conclusion

The weekly Paycom sync approach aligns perfectly with your ADL-based scheduling workflow:
- **Friday sync** provides fresh employee data
- **AI recommendations** use current ADL data
- **Schedule finalization** happens with up-to-date staff information
- **Staff distribution** occurs over the weekend

This creates a smooth, predictable workflow that matches Roddy's "Friday before next week" schedule finalization requirement.
