from django.db import models
from django.utils import timezone
from residents.models import Resident
from django.db.models import JSONField

class ADLQuestion(models.Model):
    text = models.TextField(unique=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.text[:50]

class ADL(models.Model):
    resident = models.ForeignKey(Resident, on_delete=models.CASCADE, related_name='adls')
    adl_question = models.ForeignKey(ADLQuestion, on_delete=models.SET_NULL, null=True, blank=True, related_name='adls')
    question_text = models.TextField()  # Deprecated: use adl_question.text instead
    minutes = models.PositiveIntegerField()
    frequency = models.PositiveIntegerField()
    total_minutes = models.PositiveIntegerField()
    total_hours = models.FloatField()
    status = models.CharField(max_length=100, default='Complete', blank=True)
    per_day_shift_times = JSONField(default=dict, blank=True)
    
    # Audit fields
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_adls')
    updated_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_adls')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save()

    def __str__(self):
        return f"{self.resident.name} - {self.question_text[:30]}..."

class WeeklyADLEntry(models.Model):
    """
    Represents a weekly ADL entry for a resident and specific ADL question.
    Stores the data for a specific week period.
    """
    resident = models.ForeignKey(Resident, on_delete=models.CASCADE, related_name='weekly_adl_entries')
    adl_question = models.ForeignKey(ADLQuestion, on_delete=models.CASCADE, related_name='weekly_entries')
    question_text = models.TextField()  # Store text for historical reference
    
    # Week period
    week_start_date = models.DateField()  # Sunday of the week (to match frontend display "Week of Nov 30 - Dec 6")
    week_end_date = models.DateField()    # Saturday of the week
    
    # ADL data for the week
    minutes_per_occurrence = models.PositiveIntegerField(default=0)
    frequency_per_week = models.PositiveIntegerField(default=0)
    total_minutes_week = models.PositiveIntegerField(default=0)
    total_hours_week = models.FloatField(default=0.0)
    
    # Per-day breakdown (optional - can store daily data within the week)
    per_day_data = JSONField(default=dict, blank=True)  # e.g., {"Monday": 30, "Tuesday": 25, ...}
    
    # Status and notes
    status = models.CharField(max_length=100, default='complete', blank=True)
    notes = models.TextField(blank=True, null=True)
    
    # Audit fields
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_weekly_adls')
    updated_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_weekly_adls')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-week_start_date', 'resident__name', 'adl_question__order']
        unique_together = ['resident', 'adl_question', 'week_start_date']
    
    def save(self, *args, **kwargs):
        # Auto-calculate total hours
        if self.total_minutes_week:
            self.total_hours_week = self.total_minutes_week / 60.0
        else:
            self.total_hours_week = (self.minutes_per_occurrence * self.frequency_per_week) / 60.0
        
        # Auto-generate per_day_data if none provided
        if not self.per_day_data and self.frequency_per_week > 0:
            # Distribute frequency evenly across the week (simple default)
            daily_frequency = self.frequency_per_week / 7.0
            self.per_day_data = {}
            
            # Use old format for compatibility with existing calculation logic
            days = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun']
            shifts = ['Shift1Time', 'Shift2Time', 'Shift3Time']
            
            for day in days:
                for shift in shifts:
                    # Default to Day shift (Shift1Time) for simple distribution
                    if shift == 'Shift1Time':
                        self.per_day_data[f'{day}{shift}'] = 1 if daily_frequency >= 0.5 else 0
                    else:
                        self.per_day_data[f'{day}{shift}'] = 0
        
        super().save(*args, **kwargs)
    
    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
    
    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save()
    
    @property
    def week_label(self):
        """Returns a human-readable week label"""
        return f"Week of {self.week_start_date.strftime('%b %d')} - {self.week_end_date.strftime('%b %d, %Y')}"
    
    def __str__(self):
        return f"{self.resident.name} - {self.question_text[:30]} - {self.week_label}"

class WeeklyADLSummary(models.Model):
    """
    Aggregated weekly summary for a resident across all ADL questions.
    Provides quick access to total caregiving time per week.
    """
    resident = models.ForeignKey(Resident, on_delete=models.CASCADE, related_name='weekly_adl_summaries')
    
    # Week period
    week_start_date = models.DateField()
    week_end_date = models.DateField()
    
    # Summary totals
    total_adl_questions = models.PositiveIntegerField(default=0)
    total_minutes_week = models.PositiveIntegerField(default=0)
    total_hours_week = models.FloatField(default=0.0)
    total_frequency_week = models.PositiveIntegerField(default=0)
    
    # Breakdown by ADL categories (optional)
    adl_category_totals = JSONField(default=dict, blank=True)  # e.g., {"Personal Care": 120, "Mobility": 90}
    
    # Status
    is_complete = models.BooleanField(default=False)
    completion_percentage = models.FloatField(default=0.0)  # % of ADL questions completed
    
    # Audit fields
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_weekly_summaries')
    updated_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_weekly_summaries')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-week_start_date', 'resident__name']
        unique_together = ['resident', 'week_start_date']
    
    def save(self, *args, **kwargs):
        # Auto-calculate total hours
        if self.total_minutes_week:
            self.total_hours_week = self.total_minutes_week / 60.0
        super().save(*args, **kwargs)
    
    @property
    def week_label(self):
        """Returns a human-readable week label"""
        return f"Week of {self.week_start_date.strftime('%b %d')} - {self.week_end_date.strftime('%b %d, %Y')}"
    
    def __str__(self):
        return f"{self.resident.name} - {self.week_label} - {self.total_hours_week:.1f}h"
