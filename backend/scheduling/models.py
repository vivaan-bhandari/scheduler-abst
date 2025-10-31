from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Staff(models.Model):
    ROLE_CHOICES = [
        ('cna', 'Certified Nursing Assistant'),
        ('lpn', 'Licensed Practical Nurse'),
        ('rn', 'Registered Nurse'),
        ('cna_float', 'CNA Float'),
        ('med_tech', 'Medication Technician'),
        ('caregiver', 'Caregiver'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('on_leave', 'On Leave'),
        ('terminated', 'Terminated'),
    ]
    
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    employee_id = models.CharField(max_length=50, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    hire_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    max_hours = models.PositiveIntegerField(default=40, validators=[MinValueValidator(1), MaxValueValidator(168)])
    notes = models.TextField(blank=True)
    facility = models.ForeignKey('residents.Facility', on_delete=models.CASCADE, related_name='staff')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Staff"
        ordering = ['last_name', 'first_name']
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.employee_id})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class ShiftTemplate(models.Model):
    SHIFT_TYPE_CHOICES = [
        ('day', 'Day'),
        ('swing', 'Swing'),
        ('noc', 'NOC'),
        ('custom', 'Custom'),
    ]
    
    template_name = models.CharField(max_length=100)
    shift_type = models.CharField(max_length=20, choices=SHIFT_TYPE_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration = models.DecimalField(max_digits=4, decimal_places=2, help_text="Duration in hours")
    required_staff = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(20)])
    is_active = models.BooleanField(default=True)
    facility = models.ForeignKey('residents.Facility', on_delete=models.CASCADE, related_name='shift_templates')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['shift_type', 'start_time']
        unique_together = ['facility', 'template_name']
    
    def __str__(self):
        return f"{self.template_name} ({self.get_shift_type_display()})"


class Shift(models.Model):
    date = models.DateField()
    shift_template = models.ForeignKey(ShiftTemplate, on_delete=models.CASCADE, related_name='shifts')
    facility = models.ForeignKey('residents.Facility', on_delete=models.CASCADE, related_name='shifts')
    required_staff_count = models.PositiveIntegerField(default=1)
    required_staff_role = models.CharField(max_length=20, default='med_tech')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['date', 'shift_template__start_time']
        unique_together = ['facility', 'date', 'shift_template', 'required_staff_role']
    
    def __str__(self):
        return f"{self.shift_template.template_name} - {self.date}"
    
    @property
    def shift_type(self):
        return self.shift_template.shift_type
    
    @property
    def start_time(self):
        return self.shift_template.start_time
    
    @property
    def end_time(self):
        return self.shift_template.end_time
    
    @property
    def duration(self):
        return self.shift_template.duration


class StaffAssignment(models.Model):
    STATUS_CHOICES = [
        ('assigned', 'Assigned'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]
    
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='assignments')
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='assignments')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='assigned')
    assigned_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['shift__date', 'shift__shift_template__start_time']
        unique_together = ['staff', 'shift']
    
    def __str__(self):
        return f"{self.staff.full_name} - {self.shift}"
    
    def save(self, *args, **kwargs):
        if self.status == 'confirmed' and not self.confirmed_at:
            self.confirmed_at = timezone.now()
        super().save(*args, **kwargs)


class StaffAvailability(models.Model):
    AVAILABILITY_STATUS_CHOICES = [
        ('available', 'Available'),
        ('no_overtime', 'No Overtime'),
        ('limited', 'Limited Hours'),
        ('unavailable', 'Unavailable'),
    ]
    
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='availability')
    date = models.DateField()
    availability_status = models.CharField(max_length=20, choices=AVAILABILITY_STATUS_CHOICES, default='available')
    max_hours = models.PositiveIntegerField(default=8, validators=[MinValueValidator(1), MaxValueValidator(24)])
    preferred_start_time = models.TimeField(null=True, blank=True)
    preferred_end_time = models.TimeField(null=True, blank=True)
    preferred_shift_types = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    facility = models.ForeignKey('residents.Facility', on_delete=models.CASCADE, related_name='staff_availability')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['date', 'staff__last_name']
        unique_together = ['staff', 'date', 'facility']
        verbose_name_plural = "Staff Availability"
    
    def __str__(self):
        return f"{self.staff.full_name} - {self.date} ({self.get_availability_status_display()})"


class TimeTracking(models.Model):
    """Track actual clock in/out times and hours worked"""
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='time_tracking')
    date = models.DateField()
    clock_in = models.DateTimeField()
    clock_out = models.DateTimeField(null=True, blank=True)
    break_start = models.DateTimeField(null=True, blank=True)
    break_end = models.DateTimeField(null=True, blank=True)
    
    # Calculated fields
    total_hours_worked = models.FloatField(default=0.0)  # Actual hours worked (excluding breaks)
    regular_hours = models.FloatField(default=0.0)  # Hours up to 40/week
    overtime_hours = models.FloatField(default=0.0)  # Hours over 40/week
    
    # Status tracking
    STATUS_CHOICES = [
        ('clocked_in', 'Clocked In'),
        ('on_break', 'On Break'),
        ('clocked_out', 'Clocked Out'),
        ('no_show', 'No Show'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='clocked_in')
    
    # Paycom sync tracking
    paycom_sync_date = models.DateTimeField(null=True, blank=True)
    paycom_employee_id = models.CharField(max_length=50, blank=True)
    
    notes = models.TextField(blank=True)
    facility = models.ForeignKey('residents.Facility', on_delete=models.CASCADE, related_name='time_tracking')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date', 'staff__last_name']
        unique_together = ['staff', 'date']
        verbose_name_plural = "Time Tracking"
    
    def __str__(self):
        return f"{self.staff.full_name} - {self.date} ({self.total_hours_worked}h)"
    
    def save(self, *args, **kwargs):
        # Calculate total hours worked if clock out is set
        if self.clock_out and self.clock_in:
            total_time = self.clock_out - self.clock_in
            
            # Subtract break time if applicable
            if self.break_start and self.break_end:
                break_time = self.break_end - self.break_start
                total_time -= break_time
            
            self.total_hours_worked = total_time.total_seconds() / 3600.0
            
            # Calculate regular vs overtime hours
            self._calculate_regular_overtime_hours()
        
        super().save(*args, **kwargs)
    
    def _calculate_regular_overtime_hours(self):
        """Calculate regular and overtime hours based on weekly total"""
        if not self.total_hours_worked:
            return
        
        # Get total hours worked this week
        week_start = self.date - timezone.timedelta(days=self.date.weekday())
        week_end = week_start + timezone.timedelta(days=6)
        
        weekly_hours = TimeTracking.objects.filter(
            staff=self.staff,
            date__gte=week_start,
            date__lte=week_end,
            clock_out__isnull=False
        ).aggregate(total=models.Sum('total_hours_worked'))['total'] or 0
        
        # Calculate regular vs overtime
        if weekly_hours <= 40:
            self.regular_hours = self.total_hours_worked
            self.overtime_hours = 0
        else:
            # This day pushes into overtime
            regular_remaining = max(0, 40 - (weekly_hours - self.total_hours_worked))
            self.regular_hours = min(self.total_hours_worked, regular_remaining)
            self.overtime_hours = max(0, self.total_hours_worked - regular_remaining)


class WeeklyHoursSummary(models.Model):
    """Weekly summary of hours worked for cost control and scheduling"""
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='weekly_hours')
    week_start_date = models.DateField()
    week_end_date = models.DateField()
    
    # Hours breakdown
    total_hours_worked = models.FloatField(default=0.0)
    regular_hours = models.FloatField(default=0.0)
    overtime_hours = models.FloatField(default=0.0)
    
    # Cost implications
    regular_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    overtime_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    total_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Status flags
    is_overtime = models.BooleanField(default=False)
    is_under_hours = models.BooleanField(default=False)
    is_optimal_hours = models.BooleanField(default=True)
    
    # Scheduling impact
    can_work_more = models.BooleanField(default=True)
    should_avoid_overtime = models.BooleanField(default=False)
    
    # Paycom sync
    paycom_sync_date = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-week_start_date', 'staff__last_name']
        unique_together = ['staff', 'week_start_date']
        verbose_name_plural = "Weekly Hours Summary"
    
    def __str__(self):
        return f"{self.staff.full_name} - Week of {self.week_start_date} ({self.total_hours_worked}h)"
    
    def save(self, *args, **kwargs):
        # Calculate status flags
        self.is_overtime = self.overtime_hours > 0
        self.is_under_hours = self.total_hours_worked < 32  # Less than 80% of 40 hours
        self.is_optimal_hours = 32 <= self.total_hours_worked <= 40
        
        # Scheduling recommendations
        self.can_work_more = self.total_hours_worked < 40
        self.should_avoid_overtime = self.overtime_hours > 0
        
        super().save(*args, **kwargs)


class AIInsight(models.Model):
    facility = models.ForeignKey('residents.Facility', on_delete=models.CASCADE, related_name='ai_insights')
    date = models.DateField()
    total_residents = models.PositiveIntegerField()
    total_care_hours = models.DecimalField(max_digits=6, decimal_places=2)
    avg_acuity_score = models.DecimalField(max_digits=3, decimal_places=2)
    staffing_efficiency = models.PositiveIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)])
    low_acuity_count = models.PositiveIntegerField(default=0)
    medium_acuity_count = models.PositiveIntegerField(default=0)
    high_acuity_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-date']
        unique_together = ['facility', 'date']
    
    def __str__(self):
        return f"AI Insights - {self.facility.name} - {self.date}"


class AIRecommendation(models.Model):
    facility = models.ForeignKey('residents.Facility', on_delete=models.CASCADE, related_name='ai_recommendations')
    date = models.DateField()
    shift_type = models.CharField(max_length=20)
    care_hours = models.DecimalField(max_digits=5, decimal_places=2)
    required_staff = models.PositiveIntegerField()
    resident_count = models.PositiveIntegerField()
    confidence = models.PositiveIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)])
    applied = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['date', 'shift_type']
        unique_together = ['facility', 'date', 'shift_type']
    
    def __str__(self):
        return f"AI Rec - {self.facility.name} - {self.date} {self.shift_type} ({self.confidence}%)"
