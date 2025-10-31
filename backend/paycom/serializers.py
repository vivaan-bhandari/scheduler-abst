from rest_framework import serializers
from .models import PaycomEmployee, PaycomSyncLog, PaycomFile


class PaycomEmployeeSerializer(serializers.ModelSerializer):
    """Serializer for PaycomEmployee model"""
    
    full_name = serializers.ReadOnlyField()
    is_active = serializers.ReadOnlyField()
    is_available_for_scheduling = serializers.ReadOnlyField()
    
    class Meta:
        model = PaycomEmployee
        fields = [
            'id', 'employee_id', 'first_name', 'last_name', 'nickname',
            'status', 'department_code', 'department_description',
            'payroll_profile', 'payroll_profile_description',
            'location_code', 'location_description',
            'position_family', 'position_description',
            'work_email', 'phone_number', 'personal_phone',
            'street_address', 'city', 'state', 'zip_code', 'country',
            'birth_date', 'hire_date', 'rehire_date', 'termination_date',
            'employee_added_date', 'last_review_date', 'pay_change_date',
            'hourly_rate', 'salary', 'overtime_eligible',
            'part_time_to_full_time', 'cobra_start_date', 'on_leave_date',
            'k401_eligibility', 'k401_eligibility_date',
            'hours_worked_ytd', 'hours_worked_current_period',
            'max_hours_per_week', 'paycom_employee_code', 'case_reference',
            'created_at', 'updated_at', 'last_synced_at',
            'full_name', 'is_active', 'is_available_for_scheduling',
            'staff'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_synced_at']


class PaycomEmployeeListSerializer(serializers.ModelSerializer):
    """Simplified serializer for PaycomEmployee list views"""
    
    full_name = serializers.ReadOnlyField()
    is_active = serializers.ReadOnlyField()
    role_type = serializers.SerializerMethodField()
    
    class Meta:
        model = PaycomEmployee
        fields = [
            'id', 'employee_id', 'first_name', 'last_name', 'nickname', 'full_name',
            'status', 'department_code', 'department_description',
            'position_family', 'position_description', 'role_type',
            'location_code', 'location_description',
            'payroll_profile', 'payroll_profile_description',
            'work_email', 'phone_number', 'personal_phone',
            'street_address', 'city', 'state', 'zip_code', 'country',
            'hire_date', 'birth_date', 'is_active',
            'hourly_rate', 'hours_worked_current_period', 'max_hours_per_week',
            'part_time_to_full_time', 'on_leave_date', 'termination_date'
        ]
    
    def get_role_type(self, obj):
        """Determine if employee is MedTech or Caregiver based on position"""
        if not obj.position_description:
            return 'Other'
        
        position = obj.position_description.lower()
        
        # Check for combined MedTech/Caregiver positions first
        if 'medtech/caregiver' in position or 'med tech/caregiver' in position:
            return 'MedTech/Caregiver'
        
        # Check for MedTech positions
        elif any(keyword in position for keyword in ['med tech', 'medtech']):
            return 'MedTech'
        
        # Check for Caregiver positions
        elif 'caregiver' in position:
            return 'Caregiver'
        
        # Check for other nursing roles
        elif any(keyword in position for keyword in ['nurse', 'coordinator', 'manager', 'supervisor', 'lead']):
            return 'Nursing'
        
        # Default for other positions
        else:
            return 'Other'


class PaycomSyncLogSerializer(serializers.ModelSerializer):
    """Serializer for PaycomSyncLog model"""
    
    duration = serializers.ReadOnlyField()
    success_rate = serializers.ReadOnlyField()
    
    class Meta:
        model = PaycomSyncLog
        fields = [
            'id', 'sync_id', 'report_type', 'status', 'started_at',
            'completed_at', 'duration', 'files_processed', 'files_successful',
            'files_failed', 'employees_processed', 'employees_created',
            'employees_updated', 'employees_errors', 'error_message',
            'success_rate'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at']


class PaycomFileSerializer(serializers.ModelSerializer):
    """Serializer for PaycomFile model"""
    
    class Meta:
        model = PaycomFile
        fields = [
            'id', 'sync_log', 'filename', 'file_path', 'file_size',
            'file_type', 'status', 'downloaded_at', 'processed_at',
            'error_message', 'rows_processed', 'rows_successful', 'rows_failed'
        ]
        read_only_fields = ['id', 'downloaded_at', 'processed_at']


class PaycomSyncStatusSerializer(serializers.Serializer):
    """Serializer for sync status information"""
    
    last_sync = PaycomSyncLogSerializer(read_only=True)
    total_employees = serializers.IntegerField(read_only=True)
    active_employees = serializers.IntegerField(read_only=True)
    available_employees = serializers.IntegerField(read_only=True)
    sync_in_progress = serializers.BooleanField(read_only=True)
