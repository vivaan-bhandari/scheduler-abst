# Paycom SFTP Integration

This document describes the Paycom SFTP integration feature that automatically pulls employee data from Paycom's SFTP server.

## Overview

The Paycom integration allows the application to:
- Connect to Paycom's SFTP server
- Download employee roster reports (Directory, Dates, Payees)
- Parse and store employee data in the database
- Integrate with the existing scheduling system
- Provide API endpoints for accessing employee data

## Features

### 1. SFTP Connection
- Secure connection to Paycom SFTP server
- Support for both password and private key authentication
- Automatic file discovery and download
- Error handling and retry logic

### 2. Data Models
- **PaycomEmployee**: Stores comprehensive employee information
- **PaycomSyncLog**: Tracks sync operations and statistics
- **PaycomFile**: Tracks individual downloaded files

### 3. Data Processing
- Automatic parsing of Numbers files (.numbers format)
- Employee data extraction and validation
- Database synchronization with existing Staff model
- Error tracking and reporting

### 4. Management Commands
- `sync_paycom`: Main command for syncing data
- Support for different report types
- Dry-run mode for testing
- Force sync option

### 5. API Endpoints
- Employee data access and filtering
- Sync status and statistics
- File management
- Sync operations

## Setup

### 1. Install Dependencies

The following packages are required:
```bash
pip install paramiko pysftp
```

### 2. Environment Configuration

Add the following environment variables to your `.env` file:

```env
# Paycom SFTP Configuration
PAYCOM_SFTP_HOST=your-paycom-sftp-host.com
PAYCOM_SFTP_PORT=22
PAYCOM_SFTP_USERNAME=your-paycom-username
PAYCOM_SFTP_PASSWORD=your-paycom-password
# Alternative: Use private key instead of password
# PAYCOM_SFTP_PRIVATE_KEY_PATH=/path/to/private/key
PAYCOM_SFTP_REMOTE_DIRECTORY=/
PAYCOM_SFTP_LOCAL_DIRECTORY=/path/to/local/storage
```

### 3. Database Migration

Run the migrations to create the Paycom tables:
```bash
python manage.py migrate paycom
```

## Usage

### 1. Manual Sync

To manually sync Paycom data:

```bash
# Sync all reports
python manage.py sync_paycom

# Sync specific report type
python manage.py sync_paycom --report-type employee_directory

# Test connection only
python manage.py sync_paycom --test-connection

# Dry run (show what would be downloaded)
python manage.py sync_paycom --dry-run

# Force sync even if recent sync exists
python manage.py sync_paycom --force
```

### 2. API Usage

#### Get All Employees
```http
GET /api/paycom/employees/
```

#### Get Active Employees
```http
GET /api/paycom/employees/active/
```

#### Get Employees Available for Scheduling
```http
GET /api/paycom/employees/available_for_scheduling/
```

#### Get Employee Statistics
```http
GET /api/paycom/employees/stats/
```

#### Start Sync
```http
POST /api/paycom/sync/start_sync/
Content-Type: application/json

{
    "report_type": "all",
    "force": false
}
```

#### Test SFTP Connection
```http
POST /api/paycom/sync/test_connection/
```

#### Get Sync Status
```http
GET /api/paycom/sync/status/
```

### 3. Automated Sync

To set up automated syncing, you can:

1. **Use a cron job**:
```bash
# Add to crontab to run every hour
0 * * * * cd /path/to/backend && python manage.py sync_paycom
```

2. **Use Django management command in a scheduled task**:
```python
from django.core.management import call_command
call_command('sync_paycom')
```

3. **Use the API endpoint** in your frontend to trigger syncs

## Data Structure

### PaycomEmployee Model

The `PaycomEmployee` model stores comprehensive employee information:

```python
class PaycomEmployee(models.Model):
    # Basic Information
    employee_id = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    
    # Department and Role
    department_code = models.CharField(max_length=20)
    department_description = models.CharField(max_length=200)
    position_family = models.CharField(max_length=100)
    
    # Contact Information
    work_email = models.EmailField()
    phone_number = models.CharField(max_length=20)
    street_address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=50)
    zip_code = models.CharField(max_length=20)
    
    # Dates
    birth_date = models.DateField()
    hire_date = models.DateField()
    termination_date = models.DateField()
    
    # Payroll Information
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)
    salary = models.DecimalField(max_digits=12, decimal_places=2)
    overtime_eligible = models.BooleanField()
    
    # Hours Tracking
    hours_worked_ytd = models.DecimalField(max_digits=8, decimal_places=2)
    hours_worked_current_period = models.DecimalField(max_digits=8, decimal_places=2)
    max_hours_per_week = models.PositiveIntegerField()
    
    # System Fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_synced_at = models.DateTimeField()
    
    # Link to existing Staff model
    staff = models.OneToOneField(Staff, on_delete=models.SET_NULL, null=True)
```

## Integration with Scheduling

The Paycom integration is designed to work with the existing scheduling system:

1. **Employee Matching**: Paycom employees can be linked to existing Staff records
2. **Availability Tracking**: Hours worked and availability are tracked
3. **Role Mapping**: Department and position information helps with role assignment
4. **Cost Optimization**: Pay rates and overtime eligibility inform scheduling decisions

## Error Handling

The system includes comprehensive error handling:

- **SFTP Connection Errors**: Automatic retry with exponential backoff
- **File Processing Errors**: Individual file error tracking
- **Data Validation Errors**: Invalid data is logged but doesn't stop processing
- **Database Errors**: Transaction rollback on critical failures

## Monitoring

### Sync Logs

All sync operations are logged in the `PaycomSyncLog` model:
- Sync start/completion times
- Files processed and success rates
- Employee data statistics
- Error messages and details

### Admin Interface

The Django admin provides:
- Employee data management
- Sync log viewing
- File processing status
- Error tracking and debugging

## Security Considerations

1. **SFTP Credentials**: Store securely in environment variables
2. **Private Keys**: Use file-based permissions for private key files
3. **Data Encryption**: Consider encrypting sensitive employee data
4. **Access Control**: Use Django's permission system for API access

## Troubleshooting

### Common Issues

1. **SFTP Connection Failed**
   - Check credentials and hostname
   - Verify network connectivity
   - Check firewall settings

2. **File Download Failed**
   - Verify file permissions on SFTP server
   - Check local storage space
   - Verify file format (.numbers)

3. **Data Parsing Errors**
   - Check file format compatibility
   - Review parsing logic for new data formats
   - Check for encoding issues

4. **Database Errors**
   - Verify database connectivity
   - Check for constraint violations
   - Review migration status

### Debugging

1. **Enable Debug Logging**:
```python
LOGGING = {
    'loggers': {
        'paycom': {
            'level': 'DEBUG',
            'handlers': ['console'],
        },
    },
}
```

2. **Use Test Script**:
```bash
python test_paycom_sftp.py
```

3. **Check Admin Interface**:
   - View sync logs
   - Check file processing status
   - Review error messages

## Future Enhancements

1. **Real-time Sync**: Webhook-based updates from Paycom
2. **Advanced Parsing**: Better Numbers file format support
3. **Data Validation**: Enhanced data quality checks
4. **Performance Optimization**: Parallel processing and caching
5. **Reporting**: Advanced analytics and reporting features

## Support

For issues or questions:
1. Check the logs in Django admin
2. Run the test script to verify configuration
3. Review the sync logs for error details
4. Check the API documentation for endpoint usage
