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
