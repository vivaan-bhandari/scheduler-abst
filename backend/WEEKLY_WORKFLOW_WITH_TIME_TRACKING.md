# Weekly Workflow with Time Tracking Integration

## Overview

Your system now operates on a **weekly schedule** that aligns with your scheduling workflow. All Paycom data (employees, time tracking, rosters) syncs weekly on Fridays to prepare for the next week's scheduling.

## Weekly Workflow Timeline

### **Friday 2:00 PM - Complete Weekly Sync**

The system runs `sync_paycom_complete_weekly` which performs:

#### **Step 1: Employee Data Sync** 📥
- Downloads latest employee data from Paycom SFTP
- Updates existing staff records (roles, positions, contact info)
- Adds new employees who started this week
- Removes/deactivates terminated employees

#### **Step 2: Time Tracking Sync** ⏰
- Downloads Time Detail Reports from Paycom SFTP
- Syncs clock in/out times for the past week
- Calculates overtime hours and weekly summaries
- Updates `TimeTracking` and `WeeklyHoursSummary` records

#### **Step 3: Roster Creation** 👥
- Creates weekly `StaffAvailability` records for next week
- Based on current employee roster (including new hires)
- Sets default availability and hours limits
- Prepares data for AI recommendations

## Why Weekly Sync Works Better

### **✅ Consistent with Your Scheduling System**
- Your ADL data is weekly
- Your scheduling is weekly
- Your roster should be weekly

### **✅ Handles New Employees Properly**
- New hires from this week are included in next week's roster
- Terminated employees are excluded from future schedules
- Role changes are reflected immediately

### **✅ Time Tracking Alignment**
- Syncs actual hours worked for the current week
- Prevents overtime in next week's scheduling
- Provides accurate cost analysis

### **✅ Reduced System Load**
- One comprehensive sync vs multiple daily syncs
- Less SFTP traffic and processing
- More reliable and predictable

## Current Paycom Reports (Weekly)

You now have **4 reports** configured for weekly SFTP push:

1. **Employee 3rd Party Payee Report (Active)** → Employee roles and pay
2. **Employee Dates Report (Active)** → Hire dates, personal info
3. **Employee Directory (Active)** → Contact information
4. **Time Detail Report (MTD)** → Clock in/out times and hours ← **NEW**

## What Happens Each Week

### **Friday 2:00 PM - Automated Sync**
```bash
# Your cron job runs:
python manage.py sync_paycom_complete_weekly --notify
```

This creates:
- ✅ Updated employee roster for next week
- ✅ Time tracking data with overtime calculations
- ✅ Weekly staff availability records
- ✅ Cost analysis for labor planning

### **Friday Afternoon - Schedule Planning**
- Enter ADL data for residents for next week
- Generate AI recommendations (now with overtime prevention)
- Create shifts and assign staff
- Finalize schedule

### **Monday - New Week Begins**
- Staff have their weekly schedules
- Time tracking begins for the new week
- AI recommendations consider actual hours worked

## Time Tracking Integration Benefits

### **Overtime Prevention**
- System won't assign staff who have worked 40+ hours
- Real-time warnings for overtime situations
- Cost optimization in AI recommendations

### **Accurate Labor Costs**
- Tracks regular vs overtime hours
- Provides cost analysis for scheduling decisions
- Historical data for budget planning

### **Better Staff Utilization**
- Optimal distribution of hours across staff
- Prevents under-utilization of available staff
- Balances workload fairly

## Commands Available

### **Complete Weekly Sync**
```bash
# Full weekly sync (employees + time tracking + roster)
python manage.py sync_paycom_complete_weekly

# Skip time tracking sync
python manage.py sync_paycom_complete_weekly --skip-time-tracking

# Skip roster creation
python manage.py sync_paycom_complete_weekly --skip-roster-creation

# Force re-run even if data exists
python manage.py sync_paycom_complete_weekly --force
```

### **Time Tracking Only**
```bash
# Sync just time tracking data
python manage.py sync_paycom_time_tracking

# Sync specific time period
python manage.py sync_paycom_time_tracking --days-back 14
```

### **Employee Sync Only**
```bash
# Sync just employee data
python manage.py sync_paycom_data
```

## Expected Results

### **After Weekly Sync (Fridays)**
1. **Employee Roster**: Updated with new hires, role changes, terminations
2. **Time Tracking**: Actual hours worked with overtime calculations
3. **Staff Availability**: Weekly records for next week's scheduling
4. **Cost Analysis**: Labor costs including overtime percentages

### **AI Recommendations Now Include**
- **Overtime Warnings**: Staff who have worked 40+ hours
- **Cost Optimization**: Prioritizes regular hours over overtime
- **Staff Shortage Alerts**: When no staff available due to overtime
- **Labor Cost Analysis**: Real-time cost tracking

## Monitoring and Troubleshooting

### **Check Weekly Sync Results**
```bash
# Check recent TimeTracking records
python manage.py shell
>>> from scheduling.models import TimeTracking, WeeklyHoursSummary
>>> TimeTracking.objects.filter(date__gte='2025-01-01').count()
>>> WeeklyHoursSummary.objects.filter(week_start_date='2025-01-06').values()
```

### **Verify Employee Data**
```bash
# Check staff records
>>> from scheduling.models import Staff
>>> Staff.objects.filter(status='active').count()
>>> Staff.objects.filter(created_at__gte='2025-01-01').count()
```

### **Test AI Recommendations**
- Go to Scheduling tab
- Select a facility and week
- Click "Get Weekly Recommendations"
- Check for overtime warnings and cost analysis

## Next Steps

1. **Wait for First Time Detail Report**: The first Time Detail file should arrive via SFTP soon
2. **Test Integration**: Run the weekly sync manually to test
3. **Set Up Cron Job**: Configure the weekly cron job on your server
4. **Monitor Results**: Check AI recommendations include overtime prevention

## Benefits You'll See

### **Immediate Benefits**
- ✅ New employees automatically included in next week's roster
- ✅ Terminated employees excluded from future schedules
- ✅ Overtime prevention in AI recommendations
- ✅ Real-time labor cost tracking

### **Long-term Benefits**
- ✅ Reduced overtime costs through proactive prevention
- ✅ Better staff utilization and workload balancing
- ✅ Data-driven scheduling decisions
- ✅ Accurate labor cost analysis for budgeting

Your system now has a complete weekly workflow that handles employees, time tracking, and scheduling in perfect alignment!
