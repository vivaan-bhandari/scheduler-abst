# Paycom Backend Changes - Quick Checklist

## ✅ Changes to Make in Paycom Backend

### 1. **Schedule Change** (Most Important)
```bash
# FIND: Current cron job (likely daily at 2 AM)
0 2 * * * /path/to/paycom_sftp_push.sh

# CHANGE TO: Weekly on Friday at 2 PM
0 14 * * 5 /path/to/paycom_sftp_push.sh
```

### 2. **File Generation Timing**
- **Current**: Generate files daily
- **Change to**: Generate files Friday morning (before 2 PM push)

### 3. **Batch Push** (Optional but Recommended)
- **Current**: May push files individually
- **Change to**: Push all three files together in one batch

## 🔍 Where to Look in Paycom Backend

### Common Locations:
```
/opt/paycom/
├── config/crontab
├── scripts/sftp_push.sh
├── config/schedule.conf
└── logs/sftp_push.log
```

### Or:
```
/etc/crontab
/var/spool/cron/paycom
/paycom/config/
```

## ⚡ Quick Implementation

### Step 1: Find Current Schedule
```bash
# Look for current cron job
crontab -l | grep sftp
# OR
grep -r "sftp_push" /etc/crontab
# OR
find /opt/paycom -name "*.conf" -exec grep -l "sftp" {} \;
```

### Step 2: Make the Change
```bash
# Edit the cron file
sudo nano /etc/crontab
# OR
sudo crontab -e

# Change the schedule line from daily to weekly
```

### Step 3: Test the Change
```bash
# Test the script manually
/path/to/paycom_sftp_push.sh

# Check if it works
ls -la /your/sftp/server/path/
```

## 🎯 That's It!

**Only change needed**: 
- Daily push → Weekly push (Friday 2 PM)

**Everything else stays the same**:
- ✅ Same file format
- ✅ Same file names  
- ✅ Same file content
- ✅ Same SFTP server

## 📞 Your App Side

Once you make the Paycom change, your app will automatically work with:

```bash
# Your weekly sync command (already created)
python manage.py sync_paycom_complete_weekly --notify

# Your cron job (already created)
# Runs every Friday at 2:30 PM
30 14 * * 5 /path/to/your/project/backend/cron_weekly_paycom_sync.sh
```

## 🚀 Result

**Perfect Weekly Workflow**:
```
Friday 2:00 PM: Paycom pushes employee files
Friday 2:30 PM: Your app syncs data + creates roster
Friday 3:00 PM: ADL data + AI recommendations
Friday 4:00 PM: Schedule creation
Friday 5:00 PM: Schedule finalization ✅
```

**This matches Roddy's "Friday before next week" rule perfectly!**
