# Paycom SFTP Weekly Configuration Guide

## Overview
This guide explains how to configure Paycom's SFTP to work optimally with your weekly scheduling workflow.

## Current vs. Recommended Setup

### Current Setup (Daily):
- ❌ **Frequency**: Daily pushes
- ❌ **Timing**: Not aligned with schedule planning
- ❌ **Data**: Basic employee roster only
- ❌ **Workflow**: Misaligned with weekly ADL/scheduling cycle

### Recommended Setup (Weekly):
- ✅ **Frequency**: Weekly (Friday) pushes
- ✅ **Timing**: Aligned with schedule finalization
- ✅ **Data**: Complete employee roster + availability
- ✅ **Workflow**: Perfectly aligned with weekly cycle

## Required Changes on Paycom SFTP End

### 1. Change Push Frequency
**Current**: Daily pushes
**Recommended**: Weekly pushes (Fridays)

**Action Required**: Contact Paycom support to change SFTP push schedule from daily to weekly (Friday).

### 2. Optimize Data Files
**Current Files** (keep these):
- `employee_directory.numbers` - Basic employee info
- `employee_dates.numbers` - Hire/termination dates  
- `employee_payees.numbers` - Payroll information

**New File** (recommend adding):
- `employee_availability.numbers` - Weekly availability data

### 3. File Naming Convention
**Current**: `YYYYMMDD_HHMMSS_Employee_Directory_XXXXXX_EmployeeRoster.numbers`

**Recommended**: Keep current naming but ensure Friday delivery:
- Friday 2:00 PM delivery
- Consistent file format
- All three files delivered together

## Recommended Paycom SFTP Configuration

### Schedule:
```
Day: Every Friday
Time: 2:00 PM (or earlier)
Frequency: Weekly
```

### Files to Push:
1. **employee_directory.numbers** - Employee basic info
2. **employee_dates.numbers** - Employment dates
3. **employee_payees.numbers** - Payroll data

### File Content Requirements:

#### employee_directory.numbers should include:
- Employee ID
- First Name, Last Name
- Email Address
- Position/Role
- Department/Location
- Status (Active/Inactive)
- Hire Date

#### employee_dates.numbers should include:
- Employee ID
- Hire Date
- Termination Date (if applicable)
- Last Updated Date

#### employee_payees.numbers should include:
- Employee ID
- Max Hours Per Week
- Pay Rate (if needed for scheduling)
- Status

## Your App's Weekly Workflow Integration

### Friday 2:00 PM - Paycom SFTP Push
```
Paycom sends updated employee files → Your SFTP server
```

### Friday 2:30 PM - Your App Processes Data
```bash
# Run the complete weekly sync
python manage.py sync_paycom_complete_weekly --notify
```

**This command does**:
1. ✅ Downloads latest Paycom files
2. ✅ Updates employee data in your system
3. ✅ Creates weekly staff roster
4. ✅ Sets up staff availability for next week
5. ✅ Prepares data for AI recommendations

### Friday 3:00 PM - Schedule Planning
```
1. ADL data entry (if not completed)
2. AI recommendations generation
3. Schedule creation and staff assignment
4. Schedule finalization
```

## Implementation Steps

### Step 1: Contact Paycom Support
**Request**: Change SFTP push schedule from daily to weekly (Friday)

**Message Template**:
```
Subject: Change SFTP Push Schedule from Daily to Weekly

Hello Paycom Support,

We would like to change our SFTP employee data push schedule from daily to weekly.

Current: Daily pushes
Requested: Weekly pushes on Fridays at 2:00 PM

This change will:
- Reduce server load
- Align with our weekly scheduling workflow
- Provide more efficient data processing

Please confirm when this change can be implemented.

Thank you,
[Your Name]
[Your Company]
```

### Step 2: Test Weekly Sync
```bash
# Test the new weekly sync command
python manage.py sync_paycom_complete_weekly --force

# Check results
python manage.py shell -c "
from scheduling.models import StaffAvailability
from datetime import date, timedelta

# Check next week's availability
next_monday = date.today() + timedelta(days=(7 - date.today().weekday()) % 7)
week_end = next_monday + timedelta(days=6)

availability = StaffAvailability.objects.filter(
    date__gte=next_monday,
    date__lte=week_end
).count()

print(f'Availability records for next week: {availability}')
"
```

### Step 3: Set Up Cron Job
```bash
# Add to crontab (runs every Friday at 2:30 PM)
30 14 * * 5 /path/to/your/project/backend/cron_weekly_paycom_sync.sh
```

### Step 4: Monitor and Validate
```bash
# Check sync status
python manage.py shell -c "
from paycom.models import PaycomSyncLog
recent = PaycomSyncLog.objects.filter(status='completed').order_by('-started_at')[:3]
for sync in recent:
    print(f'{sync.started_at.date()}: {sync.employees_processed} employees processed')
"

# Check staff availability
python manage.py shell -c "
from scheduling.models import StaffAvailability
from datetime import date, timedelta

next_monday = date.today() + timedelta(days=(7 - date.today().weekday()) % 7)
week_end = next_monday + timedelta(days=6)

availability = StaffAvailability.objects.filter(
    date__gte=next_monday,
    date__lte=week_end
).count()

staff_count = StaffAvailability.objects.filter(
    date__gte=next_monday,
    date__lte=week_end
).values('staff').distinct().count()

print(f'Next week: {staff_count} staff with {availability} availability records')
"
```

## Benefits of Weekly Approach

### For Your App:
- ✅ **Aligned workflow**: Matches your weekly ADL/scheduling cycle
- ✅ **Better performance**: Less frequent processing
- ✅ **Predictable timing**: Same workflow every Friday
- ✅ **Complete data**: Full weekly roster available for scheduling

### For Paycom:
- ✅ **Reduced server load**: Less frequent SFTP transfers
- ✅ **Better reliability**: Weekly batch processing
- ✅ **Simplified monitoring**: Weekly status checks

### For Your Team:
- ✅ **Clear timeline**: Friday = data update + schedule planning
- ✅ **Fresh data**: Employee info updated before scheduling
- ✅ **Complete roster**: All staff availability ready for AI recommendations

## Troubleshooting

### Common Issues:

1. **Paycom still pushing daily**:
   - Contact Paycom support again
   - Provide specific account details
   - Request escalation if needed

2. **Files not arriving Friday**:
   - Check Paycom SFTP schedule
   - Verify file naming conventions
   - Test SFTP connection

3. **Weekly sync fails**:
   ```bash
   # Check recent syncs
   python manage.py sync_paycom_complete_weekly --force
   
   # Check specific facility
   python manage.py sync_paycom_complete_weekly --facility-id 29 --force
   ```

### Monitoring Commands:
```bash
# Check Paycom sync status
python manage.py shell -c "
from paycom.models import PaycomSyncLog, PaycomEmployee
print(f'Total Paycom employees: {PaycomEmployee.objects.count()}')
recent = PaycomSyncLog.objects.filter(status='completed').order_by('-started_at').first()
if recent:
    print(f'Last sync: {recent.started_at.date()} - {recent.employees_processed} employees')
"

# Check staff roster
python manage.py shell -c "
from scheduling.models import Staff
active_staff = Staff.objects.filter(status='active').count()
print(f'Active staff: {active_staff}')
"

# Check weekly availability
python manage.py shell -c "
from scheduling.models import StaffAvailability
from datetime import date, timedelta

# Next week
next_monday = date.today() + timedelta(days=(7 - date.today().weekday()) % 7)
week_end = next_monday + timedelta(days=6)

availability = StaffAvailability.objects.filter(
    date__gte=next_monday,
    date__lte=week_end
).count()

print(f'Next week availability records: {availability}')
"
```

## Summary

The key change needed on Paycom's end is:
- **Change SFTP push frequency from daily to weekly (Friday)**
- **Keep the same file format and naming convention**
- **Ensure all three employee files are pushed together**

This will perfectly align with your weekly scheduling workflow and eliminate the confusion between daily Paycom pushes and weekly ADL/scheduling needs.
