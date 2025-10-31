from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import PaycomEmployee, PaycomSyncLog, PaycomFile


@admin.register(PaycomEmployee)
class PaycomEmployeeAdmin(admin.ModelAdmin):
    list_display = [
        'employee_id', 'full_name', 'status', 'department_description',
        'location_description', 'position_description', 'is_active',
        'hire_date', 'last_synced_at'
    ]
    list_filter = [
        'status', 'department_code', 'location_code', 'overtime_eligible',
        'k401_eligibility', 'created_at', 'last_synced_at'
    ]
    search_fields = [
        'employee_id', 'first_name', 'last_name', 'work_email',
        'department_description', 'location_description'
    ]
    readonly_fields = [
        'created_at', 'updated_at', 'last_synced_at', 'full_name',
        'is_active', 'is_available_for_scheduling'
    ]
    ordering = ['last_name', 'first_name']
    
    fieldsets = (
        ('Basic Information', {
            'fields': (
                'employee_id', 'first_name', 'last_name', 'nickname',
                'status', 'full_name', 'is_active', 'is_available_for_scheduling'
            )
        }),
        ('Department & Role', {
            'fields': (
                'department_code', 'department_description',
                'payroll_profile', 'payroll_profile_description',
                'location_code', 'location_description',
                'position_family', 'position_description'
            )
        }),
        ('Contact Information', {
            'fields': (
                'work_email', 'phone_number', 'personal_phone',
                'street_address', 'city', 'state', 'zip_code', 'country'
            )
        }),
        ('Dates', {
            'fields': (
                'birth_date', 'hire_date', 'rehire_date', 'termination_date',
                'employee_added_date', 'last_review_date', 'pay_change_date'
            )
        }),
        ('Payroll Information', {
            'fields': (
                'hourly_rate', 'salary', 'overtime_eligible',
                'part_time_to_full_time', 'cobra_start_date', 'on_leave_date',
                'k401_eligibility', 'k401_eligibility_date'
            )
        }),
        ('Hours Tracking', {
            'fields': (
                'hours_worked_ytd', 'hours_worked_current_period',
                'max_hours_per_week'
            )
        }),
        ('System Information', {
            'fields': (
                'paycom_employee_code', 'case_reference', 'staff',
                'created_at', 'updated_at', 'last_synced_at'
            )
        }),
    )
    
    def is_active(self, obj):
        return obj.is_active
    is_active.boolean = True
    is_active.short_description = 'Active'
    
    def is_available_for_scheduling(self, obj):
        return obj.is_available_for_scheduling
    is_available_for_scheduling.boolean = True
    is_available_for_scheduling.short_description = 'Available for Scheduling'


@admin.register(PaycomSyncLog)
class PaycomSyncLogAdmin(admin.ModelAdmin):
    list_display = [
        'sync_id', 'report_type', 'status', 'started_at', 'completed_at',
        'duration_display', 'files_processed', 'employees_processed',
        'success_rate_display'
    ]
    list_filter = ['status', 'report_type', 'started_at']
    search_fields = ['sync_id', 'error_message']
    readonly_fields = [
        'sync_id', 'started_at', 'completed_at', 'duration_display',
        'success_rate_display'
    ]
    ordering = ['-started_at']
    
    fieldsets = (
        ('Sync Information', {
            'fields': (
                'sync_id', 'report_type', 'status', 'started_at', 'completed_at',
                'duration_display'
            )
        }),
        ('File Statistics', {
            'fields': (
                'files_processed', 'files_successful', 'files_failed',
                'success_rate_display'
            )
        }),
        ('Employee Statistics', {
            'fields': (
                'employees_processed', 'employees_created', 'employees_updated',
                'employees_errors'
            )
        }),
        ('Error Information', {
            'fields': ('error_message', 'error_details'),
            'classes': ('collapse',)
        }),
    )
    
    def duration_display(self, obj):
        if obj.duration:
            return str(obj.duration)
        return '-'
    duration_display.short_description = 'Duration'
    
    def success_rate_display(self, obj):
        return f"{obj.success_rate:.1f}%"
    success_rate_display.short_description = 'Success Rate'
    
    def has_add_permission(self, request):
        return False  # Sync logs are created programmatically


@admin.register(PaycomFile)
class PaycomFileAdmin(admin.ModelAdmin):
    list_display = [
        'filename', 'file_type', 'status', 'file_size_display',
        'downloaded_at', 'processed_at', 'rows_processed',
        'success_rate_display'
    ]
    list_filter = ['file_type', 'status', 'downloaded_at', 'sync_log']
    search_fields = ['filename', 'error_message']
    readonly_fields = [
        'downloaded_at', 'processed_at', 'file_size_display',
        'success_rate_display'
    ]
    ordering = ['-downloaded_at']
    
    fieldsets = (
        ('File Information', {
            'fields': (
                'sync_log', 'filename', 'file_path', 'file_type',
                'file_size_display', 'status'
            )
        }),
        ('Processing Information', {
            'fields': (
                'downloaded_at', 'processed_at', 'rows_processed',
                'rows_successful', 'rows_failed', 'success_rate_display'
            )
        }),
        ('Error Information', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
    )
    
    def file_size_display(self, obj):
        if obj.file_size:
            return f"{obj.file_size:,} bytes"
        return '-'
    file_size_display.short_description = 'File Size'
    
    def success_rate_display(self, obj):
        if obj.rows_processed > 0:
            rate = (obj.rows_successful / obj.rows_processed) * 100
            return f"{rate:.1f}%"
        return '-'
    success_rate_display.short_description = 'Success Rate'
    
    def has_add_permission(self, request):
        return False  # Files are created programmatically