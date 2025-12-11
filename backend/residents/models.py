from django.db import models

# Facility model
class Facility(models.Model):
    SHIFT_FORMAT_CHOICES = [
        ('2_shift', '2-Shift (Day/Night - 12 hour shifts)'),
        ('3_shift', '3-Shift (Day/Swing/NOC - 8 hour shifts)'),
    ]
    
    name = models.CharField(max_length=255)
    facility_type = models.CharField(max_length=100, blank=True, null=True)
    facility_id = models.CharField(max_length=100, unique=True)
    admin_name = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=50, blank=True, null=True)
    zip_code = models.CharField(max_length=20, blank=True, null=True)
    shift_format = models.CharField(
        max_length=20,
        choices=SHIFT_FORMAT_CHOICES,
        default='3_shift',
        help_text='2-shift: Day/Night (12hr shifts, Oregon). 3-shift: Day/Swing/NOC (8hr shifts, California)'
    )

    def __str__(self):
        return self.name
    
    @property
    def is_2_shift_format(self):
        """Returns True if facility uses 2-shift format (Day/Night)"""
        return self.shift_format == '2_shift'
    
    @property
    def is_3_shift_format(self):
        """Returns True if facility uses 3-shift format (Day/Swing/NOC)"""
        return self.shift_format == '3_shift'

# FacilitySection model
class FacilitySection(models.Model):
    name = models.CharField(max_length=255)
    facility = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name='sections')

    def __str__(self):
        return f"{self.name} ({self.facility.name})"

    @property
    def occupancy(self):
        return self.residents.count()

# Resident model
class Resident(models.Model):
    ADL_DATA_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
    ]
    
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=100)
    facility_section = models.ForeignKey(FacilitySection, on_delete=models.CASCADE, related_name='residents')
    adl_data_status = models.CharField(max_length=20, choices=ADL_DATA_STATUS_CHOICES, default='pending')
    total_shift_times = models.JSONField(default=dict, blank=True)  # Store resident total shift times for chart calculations
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name

# ResidentQuestion model
class ResidentQuestion(models.Model):
    resident = models.ForeignKey(Resident, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    task_time = models.CharField(max_length=50, blank=True, null=True)
    frequency = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.resident.name} - {self.question_text[:30]}..."
