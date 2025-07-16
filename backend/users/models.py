from django.db import models
from django.contrib.auth.models import User
from residents.models import Facility

class FacilityAccess(models.Model):
    ROLE_CHOICES = [
        ('superadmin', 'Super Admin'),
        ('admin', 'Admin'),
        ('facility_admin', 'Facility Admin'),
        ('staff', 'Staff'),
        ('readonly', 'Read Only'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('denied', 'Denied'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='facility_accesses')
    facility = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name='user_accesses')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'facility')

# Optionally extend User with a profile for global role
User.add_to_class('role', models.CharField(max_length=20, choices=[
    ('superadmin', 'Super Admin'),
    ('admin', 'Admin'),
    ('user', 'User')
], default='user'))
