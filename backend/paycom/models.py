from django.db import models
from django.contrib.auth.models import User
from residents.models import Facility
from scheduling.models import Staff


class PaycomEmployee(models.Model):
    """Employee data from Paycom SFTP reports"""
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('terminated', 'Terminated'),
        ('on_leave', 'On Leave'),
    ]
    
    # Basic employee information
    employee_id = models.CharField(max_length=50, unique=True, db_index=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    nickname = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    # Department and role information
    department_code = models.CharField(max_length=20, blank=True)
    department_description = models.CharField(max_length=200, blank=True)
    payroll_profile = models.CharField(max_length=50, blank=True)
    payroll_profile_description = models.CharField(max_length=200, blank=True)
    location_code = models.CharField(max_length=20, blank=True)
    location_description = models.CharField(max_length=200, blank=True)
    position_family = models.CharField(max_length=100, blank=True)
    position_description = models.CharField(max_length=200, blank=True)
    
    # Contact information
    work_email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    personal_phone = models.CharField(max_length=20, blank=True)
    street_address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=50, blank=True)
    zip_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=50, blank=True)
    
    # Dates
    birth_date = models.DateField(null=True, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    rehire_date = models.DateField(null=True, blank=True)
    termination_date = models.DateField(null=True, blank=True)
    employee_added_date = models.DateField(null=True, blank=True)
    last_review_date = models.DateField(null=True, blank=True)
    pay_change_date = models.DateField(null=True, blank=True)
    
    # Payroll information
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    overtime_eligible = models.BooleanField(default=True)
    part_time_to_full_time = models.BooleanField(default=False)
    
    # Benefits and eligibility
    cobra_start_date = models.DateField(null=True, blank=True)
    on_leave_date = models.DateField(null=True, blank=True)
    k401_eligibility = models.BooleanField(default=False)
    k401_eligibility_date = models.DateField(null=True, blank=True)
    
    # Hours tracking
    hours_worked_ytd = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    hours_worked_current_period = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    max_hours_per_week = models.PositiveIntegerField(default=40)
    
    # Paycom specific fields
    paycom_employee_code = models.CharField(max_length=50, blank=True)
    case_reference = models.CharField(max_length=100, blank=True)
    
    # System fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    
    # Link to existing Staff model if exists
    staff = models.OneToOneField(Staff, on_delete=models.SET_NULL, null=True, blank=True, related_name='paycom_employee')
    
    class Meta:
        ordering = ['last_name', 'first_name']
        verbose_name = "Paycom Employee"
        verbose_name_plural = "Paycom Employees"
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.employee_id})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def is_active(self):
        return self.status == 'active'
    
    @property
    def is_available_for_scheduling(self):
        return self.is_active and self.hours_worked_current_period < self.max_hours_per_week


class PaycomSyncLog(models.Model):
    """Log of SFTP sync operations"""
    
    SYNC_STATUS_CHOICES = [
        ('started', 'Started'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('partial', 'Partial Success'),
    ]
    
    REPORT_TYPE_CHOICES = [
        ('employee_directory', 'Employee Directory'),
        ('employee_dates', 'Employee Dates'),
        ('employee_payees', 'Employee Payees'),
        ('all', 'All Reports'),
    ]
    
    sync_id = models.CharField(max_length=100, unique=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES, default='started')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # File information
    files_processed = models.PositiveIntegerField(default=0)
    files_successful = models.PositiveIntegerField(default=0)
    files_failed = models.PositiveIntegerField(default=0)
    
    # Employee data
    employees_processed = models.PositiveIntegerField(default=0)
    employees_created = models.PositiveIntegerField(default=0)
    employees_updated = models.PositiveIntegerField(default=0)
    employees_errors = models.PositiveIntegerField(default=0)
    
    # Error tracking
    error_message = models.TextField(blank=True)
    error_details = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-started_at']
        verbose_name = "Paycom Sync Log"
        verbose_name_plural = "Paycom Sync Logs"
    
    def __str__(self):
        return f"Sync {self.sync_id} - {self.get_report_type_display()} ({self.status})"
    
    @property
    def duration(self):
        if self.completed_at and self.started_at:
            return self.completed_at - self.started_at
        return None
    
    @property
    def success_rate(self):
        if self.files_processed > 0:
            return (self.files_successful / self.files_processed) * 100
        return 0


class PaycomFile(models.Model):
    """Track individual files downloaded from Paycom SFTP"""
    
    FILE_STATUS_CHOICES = [
        ('downloaded', 'Downloaded'),
        ('processed', 'Processed'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ]
    
    sync_log = models.ForeignKey(PaycomSyncLog, on_delete=models.CASCADE, related_name='files')
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.PositiveIntegerField()
    file_type = models.CharField(max_length=50)  # employee_directory, employee_dates, employee_payees
    status = models.CharField(max_length=20, choices=FILE_STATUS_CHOICES, default='downloaded')
    
    # Processing information
    downloaded_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    # Data extraction results
    rows_processed = models.PositiveIntegerField(default=0)
    rows_successful = models.PositiveIntegerField(default=0)
    rows_failed = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['-downloaded_at']
        verbose_name = "Paycom File"
        verbose_name_plural = "Paycom Files"
    
    def __str__(self):
        return f"{self.filename} ({self.status})"