"""
Facility mapping utilities for Paycom integration
Maps Paycom location descriptions to actual facility names
"""

from residents.models import Facility

# Mapping from Paycom location descriptions to actual facility names
PAYCOM_TO_FACILITY_MAPPING = {
    'Buena Vista': 'Buena Vista',
    'Murray Highland': 'Murray Highland', 
    'Posada SL': 'La Posada Senior Living',
    'Markham': 'Markham House Assisted Living',
    'Arbor MC': 'Mill View Memory Care',
    'Corporate': 'Buena Vista',  # Map corporate to main facility
}

def get_facility_name_from_paycom_location(paycom_location):
    """
    Convert Paycom location description to actual facility name
    
    Args:
        paycom_location (str): Paycom location description
        
    Returns:
        str: Actual facility name or None if not found
    """
    if not paycom_location:
        return None
        
    # Clean up the location string
    location = paycom_location.strip()
    
    # Try exact mapping first
    if location in PAYCOM_TO_FACILITY_MAPPING:
        return PAYCOM_TO_FACILITY_MAPPING[location]
    
    # Try partial matching as fallback
    for paycom_loc, facility_name in PAYCOM_TO_FACILITY_MAPPING.items():
        if paycom_loc.lower() in location.lower():
            return facility_name
    
    return None

def get_facility_from_paycom_location(paycom_location):
    """
    Get the actual Facility object from Paycom location description
    
    Args:
        paycom_location (str): Paycom location description
        
    Returns:
        Facility: The actual Facility object or None if not found
    """
    facility_name = get_facility_name_from_paycom_location(paycom_location)
    if facility_name:
        try:
            return Facility.objects.get(name=facility_name)
        except Facility.DoesNotExist:
            return None
    return None

def get_all_facility_options():
    """
    Get all facility options for frontend dropdowns
    
    Returns:
        list: List of facility names sorted alphabetically
    """
    return sorted(Facility.objects.values_list('name', flat=True))

def get_paycom_location_options():
    """
    Get all Paycom location options mapped to facility names
    
    Returns:
        list: List of tuples (paycom_location, facility_name)
    """
    return [(paycom_loc, facility_name) for paycom_loc, facility_name in PAYCOM_TO_FACILITY_MAPPING.items()]

def get_facility_mapping(file_path=None):
    """
    Get facility mapping dictionary for time tracking sync
    
    Args:
        file_path (str): Optional path to facility mapping CSV file
        
    Returns:
        dict: Mapping of facility codes to facility IDs
    """
    # For now, return a simple mapping based on facility names
    # This can be enhanced later to read from a CSV file
    mapping = {}
    
    for paycom_location, facility_name in PAYCOM_TO_FACILITY_MAPPING.items():
        try:
            facility = Facility.objects.get(name=facility_name)
            # Use facility ID as the key (assuming facility code matches ID)
            mapping[str(facility.id)] = facility.id
        except Facility.DoesNotExist:
            continue
    
    return mapping
