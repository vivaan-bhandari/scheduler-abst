import django_filters
from django.db.models import Q
from .models import PaycomEmployee
from datetime import datetime, timedelta
from .facility_mapping import get_facility_name_from_paycom_location

class PaycomEmployeeFilter(django_filters.FilterSet):
    week_start_date = django_filters.DateFilter(method='filter_by_week', label="Week Start Date (YYYY-MM-DD)")
    facility = django_filters.CharFilter(method='filter_by_facility', label="Facility Name")
    role_type = django_filters.CharFilter(field_name='role_type', lookup_expr='icontains')
    zip_code = django_filters.CharFilter(field_name='zip_code', lookup_expr='exact')
    available_only = django_filters.BooleanFilter(method='filter_available_only')
    has_phone = django_filters.BooleanFilter(method='filter_has_phone')
    has_email = django_filters.BooleanFilter(method='filter_has_email')
    search = django_filters.CharFilter(method='filter_search')
    
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
    
    def filter_by_facility(self, queryset, name, value):
        """Filter by facility name (mapped from Paycom location)"""
        if not value:
            return queryset
        
        # Get all unique Paycom locations from all employees (not just filtered queryset)
        all_locations = PaycomEmployee.objects.values_list('location_description', flat=True).distinct().exclude(location_description='').exclude(location_description__isnull=True)
        
        # Find all Paycom locations that map to this facility name
        matching_locations = []
        facility_name_lower = value.lower().strip()
        for location in all_locations:
            if location:
                mapped_facility = get_facility_name_from_paycom_location(location)
                if mapped_facility and mapped_facility.lower() == facility_name_lower:
                    matching_locations.append(location)
                # Also check if location itself matches (for unmapped locations)
                elif location.strip().lower() == facility_name_lower:
                    matching_locations.append(location)
        
        if matching_locations:
            return queryset.filter(location_description__in=matching_locations)
        return queryset.none()
    
    def filter_available_only(self, queryset, name, value):
        """Filter for employees who are available (not on leave, not terminated)"""
        if value:
            return queryset.filter(
                Q(termination_date__isnull=True) & 
                Q(on_leave_date__isnull=True)
            )
        return queryset
    
    def filter_has_phone(self, queryset, name, value):
        """Filter for employees who have a phone number"""
        if value:
            return queryset.exclude(phone_number__isnull=True).exclude(phone_number='')
        return queryset
    
    def filter_has_email(self, queryset, name, value):
        """Filter for employees who have an email"""
        if value:
            return queryset.exclude(work_email__isnull=True).exclude(work_email='')
        return queryset
    
    def filter_search(self, queryset, name, value):
        """Search across multiple fields: name, ID, role, facility, phone, email, zip"""
        if not value:
            return queryset
        
        search_term = value.strip()
        return queryset.filter(
            Q(first_name__icontains=search_term) |
            Q(last_name__icontains=search_term) |
            Q(employee_id__icontains=search_term) |
            Q(role_type__icontains=search_term) |
            Q(position_description__icontains=search_term) |
            Q(location_description__icontains=search_term) |
            Q(phone_number__icontains=search_term) |
            Q(work_email__icontains=search_term) |
            Q(zip_code__icontains=search_term)
        )

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