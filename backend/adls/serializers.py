from rest_framework import serializers
from .models import ADL, ADLQuestion

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