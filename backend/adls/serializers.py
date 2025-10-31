from rest_framework import serializers
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
        """
        week_start = data.get('week_start_date')
        week_end = data.get('week_end_date')
        
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
        # Set the user who created this entry
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Set the user who updated this entry
        validated_data['updated_by'] = self.context['request'].user
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