from django.db import models

# Facility model
class Facility(models.Model):
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

    def __str__(self):
        return self.name

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
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=100)
    facility_section = models.ForeignKey(FacilitySection, on_delete=models.CASCADE, related_name='residents')
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
