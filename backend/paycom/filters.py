import django_filters
from django.db.models import Q
from .models import PaycomEmployee
from datetime import datetime, timedelta

class PaycomEmployeeFilter(django_filters.FilterSet):
    week_start_date = django_filters.DateFilter(method='filter_by_week', label="Week Start Date (YYYY-MM-DD)")
    
    class Meta:
        model = PaycomEmployee
        fields = {
            'employee_id': ['exact'],
            'first_name': ['icontains'],
            'last_name': ['icontains'],
            'status': ['exact'],
            'position_description': ['icontains'],
            'location_description': ['icontains'],
            'hire_date': ['gte', 'lte'],
            'termination_date': ['gte', 'lte', 'isnull'],
        }

    def filter_by_week(self, queryset, name, value):
        # 'value' is the week_start_date (Monday)
        week_start = value
        week_end = week_start + timedelta(days=6)
        
        # If the selected week is in the future, return an empty queryset
        if week_start > datetime.now().date():
            return queryset.none()
        
        # For current or past weeks, return employees who were active at any point during that week
        # This means their hire_date is before or during the week_end
        # AND their termination_date is after or during the week_start, or they are not terminated
        
        # Filter by hire date: employee must be hired by the end of the selected week
        queryset = queryset.filter(hire_date__lte=week_end)
        
        # Filter by termination date: employee must not be terminated before the start of the selected week
        # Or they must not have a termination date (i.e., still active)
        queryset = queryset.filter(
            Q(termination_date__gte=week_start) | 
            Q(termination_date__isnull=True)
        )
        
        return queryset