# Paycom Time Tracking Setup Guide

## Overview

This guide explains how to set up Paycom time tracking reports to automatically sync clock in/out times and hours worked with your scheduling system. This enables:

- **Overtime Prevention**: Avoid assigning staff who have already worked 40+ hours
- **Cost Control**: Track actual labor costs including overtime
- **Accurate Scheduling**: Base recommendations on real hours worked, not just availability

## What You Need to Add to Paycom

### 1. Time Tracking Report Configuration

In Paycom's backend, you need to add a **Time Tracking Report** that includes:

#### Required Fields:
- `Employee_ID` - Unique employee identifier
- `Employee_Name` - Full name (First Last)
- `Date` - Work date (YYYY-MM-DD format)
- `Clock_In` - Clock in time (HH:MM:SS or HH:MM format)
- `Clock_Out` - Clock out time (HH:MM:SS or HH:MM format)
- `Break_Start` - Break start time (optional)
- `Break_End` - Break end time (optional)
- `Total_Hours` - Total hours worked (calculated field)
- `Regular_Hours` - Regular hours (up to 40/week)
- `Overtime_Hours` - Overtime hours (over 40/week)
- `Facility_Code` - Facility identifier for multi-facility setups

#### Recommended File Format:
```csv
Employee_ID,Employee_Name,Date,Clock_In,Clock_Out,Break_Start,Break_End,Total_Hours,Regular_Hours,Overtime_Hours,Facility_Code
EMP001,John Smith,2025-07-21,07:00:00,15:30:00,12:00:00,12:30:00,8.0,8.0,0.0,MH001
EMP002,Jane Doe,2025-07-21,07:00:00,19:00:00,12:00:00,12:30:00,11.5,8.0,3.5,MH001
```

### 2. SFTP Push Configuration

Configure the time tracking report to push via SFTP with these settings:

#### File Naming Convention:
```
TimeTracking_YYYYMMDD_HHMMSS_[ReportID]_TimeTracking.csv
```

Example: `TimeTracking_20250721_140000_12345_TimeTracking.csv`

#### Push Schedule:
- **Frequency**: Daily (recommended) or every 4 hours
- **Time**: End of each work day (e.g., 6:00 PM) + next morning (e.g., 8:00 AM)
- **Retention**: Keep files for 30 days

#### SFTP Settings:
- **Server**: Same as your current Paycom SFTP setup
- **Directory**: Same directory as other reports
- **File Format**: CSV with headers
- **Encoding**: UTF-8

## Backend Integration

### 1. Database Models Added

The system now includes these new models:

#### `TimeTracking` Model:
- Tracks individual clock in/out records per staff member per day
- Calculates total hours worked (excluding breaks)
- Separates regular vs overtime hours
- Links to Paycom employee data

#### `WeeklyHoursSummary` Model:
- Weekly summary of hours worked per staff member
- Cost analysis (regular vs overtime rates)
- Scheduling flags (can work more, should avoid overtime)
- Links to TimeTracking records

### 2. Management Commands

#### Daily Time Tracking Sync:
```bash
python manage.py sync_paycom_time_tracking --days-back 3
```

#### Manual File Processing:
```bash
python manage.py sync_paycom_time_tracking --file /path/to/TimeTracking.csv
```

### 3. AI Recommendations Enhancement

The AI scheduling recommendations now consider:

- **Actual hours worked** (not just availability)
- **Overtime prevention** (won't assign staff at 40+ hours)
- **Cost optimization** (prioritizes regular hours over overtime)
- **Real-time warnings** for overtime situations

## Paycom Backend Changes Required

### Single Change: Add Time Tracking Report

In Paycom's backend reporting system, you need to:

1. **Create a new report** called "Time Tracking Report"
2. **Add the required fields** listed above
3. **Configure SFTP push** with daily frequency
4. **Set file naming** to include "TimeTracking" in the filename

### No Changes Needed For:
- ✅ File format (CSV is already used)
- ✅ SFTP server settings (use existing)
- ✅ Authentication (use existing)
- ✅ Directory structure (use existing)
- ✅ Employee data sync (already working)

## Workflow Integration

### Weekly Schedule Planning (Fridays):
1. **Employee Data Sync** (2:00 PM Friday)
   - Updates staff roster and roles
   - Creates weekly availability records

2. **Time Tracking Sync** (Daily)
   - Syncs actual hours worked
   - Updates overtime status
   - Generates cost analysis

3. **AI Recommendations** (Real-time)
   - Considers actual hours worked
   - Avoids overtime assignments
   - Provides cost-optimized suggestions

### Daily Operations:
- **Morning**: Sync previous day's time tracking
- **Scheduling**: AI recommendations respect actual hours
- **Evening**: Final time tracking sync for the day

## Cost Benefits

### Before Time Tracking:
- ❌ No visibility into actual hours worked
- ❌ Risk of unexpected overtime costs
- ❌ Scheduling based on assumptions
- ❌ No cost analysis for recommendations

### After Time Tracking:
- ✅ Real-time overtime prevention
- ✅ Accurate labor cost tracking
- ✅ Data-driven scheduling decisions
- ✅ Cost optimization in AI recommendations

## Implementation Steps

### Step 1: Add Time Tracking Report to Paycom
1. Log into Paycom backend
2. Go to Reporting → Custom Reports
3. Create "Time Tracking Report" with required fields
4. Configure SFTP push (daily at 6:00 PM and 8:00 AM)
5. Test with a sample export

### Step 2: Update Your App's Cron Jobs
Add to your server's crontab:
```bash
# Daily time tracking sync (6:30 PM and 8:30 AM)
30 18 * * * cd /path/to/backend && python manage.py sync_paycom_time_tracking --days-back 2
30 8 * * * cd /path/to/backend && python manage.py sync_paycom_time_tracking --days-back 1
```

### Step 3: Test the Integration
1. Generate a test time tracking file from Paycom
2. Run the sync command manually
3. Check that TimeTracking records are created
4. Verify AI recommendations consider overtime

### Step 4: Monitor and Optimize
1. Check daily sync logs
2. Monitor overtime warnings
3. Review cost analysis reports
4. Adjust scheduling algorithms if needed

## Expected Results

### Immediate Benefits:
- **Overtime Prevention**: System won't assign staff who have worked 40+ hours
- **Cost Visibility**: Real-time tracking of labor costs including overtime
- **Accurate Scheduling**: Recommendations based on actual hours, not assumptions

### Long-term Benefits:
- **Reduced Overtime Costs**: Proactive prevention vs reactive management
- **Better Staff Utilization**: Optimal distribution of hours across staff
- **Data-Driven Decisions**: Historical analysis of labor patterns and costs
- **Compliance**: Accurate time tracking for payroll and labor law compliance

## Troubleshooting

### Common Issues:

#### 1. Time Tracking Records Not Created
- Check file format matches expected CSV structure
- Verify Employee_ID matches existing Staff records
- Check facility mapping configuration

#### 2. Overtime Calculations Incorrect
- Verify clock in/out times are in correct format
- Check break time calculations
- Ensure weekly boundaries are correct (Monday-Sunday)

#### 3. AI Recommendations Still Show Overtime Staff
- Verify TimeTracking records are being created
- Check WeeklyHoursSummary calculations
- Ensure sync is running daily

### Debug Commands:
```bash
# Check time tracking records
python manage.py shell
>>> from scheduling.models import TimeTracking
>>> TimeTracking.objects.filter(date__gte='2025-07-21').count()

# Check weekly summaries
>>> from scheduling.models import WeeklyHoursSummary
>>> WeeklyHoursSummary.objects.filter(week_start_date='2025-07-21').values()

# Test AI recommendations with overtime awareness
>>> from scheduling.views import AIRecommendationViewSet
>>> # Test the new overtime-aware methods
```

## Support

If you encounter issues:
1. Check the sync logs for error messages
2. Verify Paycom file format matches requirements
3. Test with a small sample file first
4. Contact support with specific error messages and file samples

The time tracking integration will significantly improve your scheduling accuracy and cost control while preventing unexpected overtime expenses.
