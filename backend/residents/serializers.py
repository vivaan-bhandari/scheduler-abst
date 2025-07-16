from rest_framework import serializers
from .models import Resident, Facility, FacilitySection

class ResidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resident
        fields = '__all__'

class FacilitySectionSerializer(serializers.ModelSerializer):
    occupancy = serializers.IntegerField(read_only=True)
    class Meta:
        model = FacilitySection
        fields = '__all__'

class FacilitySerializer(serializers.ModelSerializer):
    sections = FacilitySectionSerializer(many=True, read_only=True)
    class Meta:
        model = Facility
        fields = '__all__'

class FacilitySectionDetailResidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resident
        fields = ['id', 'name', 'status', 'created_at', 'updated_at']

class FacilitySectionDetailSerializer(serializers.ModelSerializer):
    residents = FacilitySectionDetailResidentSerializer(many=True, read_only=True)
    occupancy = serializers.IntegerField(read_only=True)
    class Meta:
        model = FacilitySection
        fields = '__all__' 