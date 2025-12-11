from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from django.utils import timezone
from .models import ADL, ADLQuestion, WeeklyADLEntry, WeeklyADLSummary

class ADLQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ADLQuestion
        fields = ['id', 'text', 'order']

class ADLSerializer(serializers.ModelSerializer):
    resident_name = serializers.CharField(source='resident.name', read_only=True)
    adl_question_text = serializers.CharField(source='adl_question.text', read_only=True)
    
    class Meta:
        model = ADL
        fields = '__all__'  # includes adl_question, question_text (deprecated), adl_question_text
        read_only_fields = [
            'total_minutes', 'total_hours', 'created_at', 
            'updated_at', 'is_deleted', 'deleted_at', 'adl_question_text'
        ]

    def validate(self, data):
        """
        Validate the ADL data.
        """
        # Ensure minutes and frequency are positive
        minutes = data.get('minutes', 0)
        frequency = data.get('frequency', 0)
        
        if minutes < 0:
            raise serializers.ValidationError({'minutes': 'Minutes must be a positive number.'})
        if frequency < 0:
            raise serializers.ValidationError({'frequency': 'Frequency must be a positive number.'})
            
        return data

class WeeklyADLEntrySerializer(serializers.ModelSerializer):
    resident_name = serializers.CharField(source='resident.name', read_only=True)
    adl_question_text = serializers.CharField(source='adl_question.text', read_only=True)
    week_label = serializers.CharField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.username', read_only=True)
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remove UniqueTogetherValidator if it exists (DRF adds it automatically)
        # We handle duplicates in create() method using update_or_create
        self.validators = [
            v for v in self.validators 
            if not isinstance(v, UniqueTogetherValidator)
        ]
    
    class Meta:
        model = WeeklyADLEntry
        fields = '__all__'
        read_only_fields = [
            'total_hours_week', 'week_label', 'created_at', 'updated_at', 
            'is_deleted', 'deleted_at', 'created_by_name', 'updated_by_name'
        ]
    
    def validate(self, data):
        """
        Validate the weekly ADL entry data.
        Note: We don't validate uniqueness here because the create() method
        uses update_or_create() to handle duplicates gracefully.
        """
        week_start = data.get('week_start_date')
        week_end = data.get('week_end_date')
        
        # Normalize week_start_date to Sunday (weekday 6) to match backend query logic
        # This ensures consistency - all entries are stored with Sunday as week_start_date
        if week_start:
            from datetime import timedelta
            days_since_monday = week_start.weekday()  # 0=Monday, 6=Sunday
            if days_since_monday != 6:  # Not Sunday, normalize to Sunday
                week_start = week_start - timedelta(days=days_since_monday + 1)
                data['week_start_date'] = week_start
                # Also update week_end_date to be Saturday (6 days after Sunday)
                if week_end:
                    week_end = week_start + timedelta(days=6)
                    data['week_end_date'] = week_end
        
        if week_start and week_end:
            if week_end <= week_start:
                raise serializers.ValidationError({
                    'week_end_date': 'Week end date must be after week start date.'
                })
        
        # Validate positive numbers
        minutes = data.get('minutes_per_occurrence', 0)
        frequency = data.get('frequency_per_week', 0)
        
        if minutes < 0:
            raise serializers.ValidationError({
                'minutes_per_occurrence': 'Minutes must be a positive number.'
            })
        if frequency < 0:
            raise serializers.ValidationError({
                'frequency_per_week': 'Frequency must be a positive number.'
            })
        
        return data
    
    def create(self, validated_data):
        # Use update_or_create to handle duplicates gracefully
        # This prevents unique constraint violations when updating existing entries
        resident = validated_data.get('resident')
        adl_question = validated_data.get('adl_question')
        week_start_date = validated_data.get('week_start_date')
        
        # Set the user who created/updated this entry
        user = self.context['request'].user
        
        # Remove fields that shouldn't be in defaults (they're part of the lookup)
        lookup_fields = {
            'resident': resident,
            'adl_question': adl_question,
            'week_start_date': week_start_date
        }
        
        # Prepare defaults (all fields except the lookup fields)
        defaults = {k: v for k, v in validated_data.items() if k not in lookup_fields}
        defaults['updated_by'] = user
        
        # First, check if there's ANY entry (deleted or not) for this combination
        # We need to use .all() to bypass the default queryset filter that excludes soft-deleted entries
        # Use a raw queryset to check for any entry regardless of deletion status
        from django.db import models
        existing_entry = WeeklyADLEntry.objects.filter(
            resident=resident,
            adl_question=adl_question,
            week_start_date=week_start_date
        ).first()
        
        if existing_entry:
            # Entry exists (either deleted or not) - restore if deleted and update
            if existing_entry.is_deleted:
                # Restore the soft-deleted entry
                existing_entry.is_deleted = False
                existing_entry.deleted_at = None
                # Set created_by if it was never set
                if not existing_entry.created_by:
                    existing_entry.created_by = user
            
            # Update all fields from validated_data
            for key, value in validated_data.items():
                setattr(existing_entry, key, value)
            existing_entry.updated_by = user
            existing_entry.save()
            return existing_entry
        
        # If no entry exists at all, create a new one
        # Create the instance with all validated data
        instance = WeeklyADLEntry.objects.create(
            resident=resident,
            adl_question=adl_question,
            week_start_date=week_start_date,
            created_by=user,
            **defaults
        )
        
        # Set created_by only if this is a new entry
        if created:
            instance.created_by = user
            instance.save()
        
        return instance
    
    def update(self, instance, validated_data):
        # Set the user who updated this entry
        validated_data['updated_by'] = self.context['request'].user
        
        # Check if week_start_date is being changed and would create a conflict
        new_week_start = validated_data.get('week_start_date')
        if new_week_start and new_week_start != instance.week_start_date:
            # Check if there's already an entry with the new week_start_date
            existing_entry = WeeklyADLEntry.objects.filter(
                resident=instance.resident,
                adl_question=instance.adl_question,
                week_start_date=new_week_start
            ).exclude(id=instance.id).first()
            
            if existing_entry:
                # If there's a soft-deleted entry, restore and merge it
                if existing_entry.is_deleted:
                    # Restore the soft-deleted entry
                    existing_entry.is_deleted = False
                    existing_entry.deleted_at = None
                    # Update with new data
                    for key, value in validated_data.items():
                        setattr(existing_entry, key, value)
                    existing_entry.updated_by = self.context['request'].user
                    existing_entry.save()
                    # Soft-delete the old instance
                    instance.is_deleted = True
                    instance.deleted_at = timezone.now()
                    instance.save()
                    return existing_entry
                else:
                    # If there's a non-deleted entry, update it instead and soft-delete this one
                    for key, value in validated_data.items():
                        setattr(existing_entry, key, value)
                    existing_entry.updated_by = self.context['request'].user
                    existing_entry.save()
                    # Soft-delete the old instance
                    instance.is_deleted = True
                    instance.deleted_at = timezone.now()
                    instance.save()
                    return existing_entry
        
        # Normal update if no conflict
        return super().update(instance, validated_data)

class WeeklyADLSummarySerializer(serializers.ModelSerializer):
    resident_name = serializers.CharField(source='resident.name', read_only=True)
    week_label = serializers.CharField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.username', read_only=True)
    
    class Meta:
        model = WeeklyADLSummary
        fields = '__all__'
        read_only_fields = [
            'total_hours_week', 'week_label', 'created_at', 'updated_at',
            'created_by_name', 'updated_by_name'
        ]
    
    def validate(self, data):
        """
        Validate the weekly ADL summary data.
        """
        week_start = data.get('week_start_date')
        week_end = data.get('week_end_date')
        
        if week_start and week_end:
            if week_end <= week_start:
                raise serializers.ValidationError({
                    'week_end_date': 'Week end date must be after week start date.'
                })
        
        return data
    
    def create(self, validated_data):
        # Set the user who created this summary
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Set the user who updated this summary
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data) 