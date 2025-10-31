"""
Scheduling recommendation logic for nursing staff based on ADL data and minimum requirements.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, date, time
from django.db.models import Q, Count, Sum
from django.utils import timezone
import logging

from .models import PaycomEmployee
from adls.models import WeeklyADLSummary, ADL
from scheduling.models import Staff, Shift

logger = logging.getLogger(__name__)


class SchedulingRecommendationEngine:
    """
    Engine for generating scheduling recommendations based on ADL data and staffing requirements.
    """
    
    def __init__(self, facility_id: int, target_date: date):
        self.facility_id = facility_id
        self.target_date = target_date
        self.facility_name = self._get_facility_name()
        
    def _get_facility_name(self) -> str:
        """Get facility name from facility ID"""
        try:
            from facility.models import Facility
            facility = Facility.objects.get(id=self.facility_id)
            return facility.name
        except:
            return "Unknown Facility"
    
    def get_adl_requirements(self) -> Dict[str, int]:
        """
        Get ADL requirements for the target date.
        Returns dict with shift requirements: {'day': 15, 'noc': 8, 'swing': 12}
        """
        try:
            # Get the week containing the target date
            week_start = target_date - timezone.timedelta(days=target_date.weekday())
            
            # Get ADL summary for the week
            adl_summary = WeeklyADLSummary.objects.filter(
                facility_id=self.facility_id,
                week_start_date=week_start
            ).first()
            
            if not adl_summary:
                logger.warning(f"No ADL summary found for facility {self.facility_id}, week {week_start}")
                return self._get_default_requirements()
            
            # Calculate requirements based on ADL data
            requirements = {
                'day': self._calculate_shift_requirements(adl_summary, 'day'),
                'noc': self._calculate_shift_requirements(adl_summary, 'noc'),
                'swing': self._calculate_shift_requirements(adl_summary, 'swing')
            }
            
            logger.info(f"ADL requirements for {self.facility_name} on {self.target_date}: {requirements}")
            return requirements
            
        except Exception as e:
            logger.error(f"Error getting ADL requirements: {e}")
            return self._get_default_requirements()
    
    def _calculate_shift_requirements(self, adl_summary: WeeklyADLSummary, shift_type: str) -> int:
        """
        Calculate staffing requirements for a specific shift based on ADL data.
        
        Logic:
        - Base requirement: 1 MedTech minimum
        - Additional caregivers based on ADL complexity:
          * High ADL scores (4-5): 1 caregiver per 3 residents
          * Medium ADL scores (2-3): 1 caregiver per 4 residents  
          * Low ADL scores (0-1): 1 caregiver per 5 residents
        """
        try:
            # Get total residents for the facility
            total_residents = adl_summary.total_residents or 0
            
            if total_residents == 0:
                return 1  # Minimum 1 MedTech
            
            # Get ADL data for the specific date
            adl_data = ADL.objects.filter(
                resident__facility_id=self.facility_id,
                assessment_date=self.target_date
            ).select_related('resident')
            
            if not adl_data.exists():
                # Fallback: use average ADL scores from summary
                return self._calculate_from_summary(adl_summary, total_residents)
            
            # Calculate ADL complexity scores
            high_complexity = 0
            medium_complexity = 0
            low_complexity = 0
            
            for adl in adl_data:
                # Calculate total ADL score (sum of all ADL categories)
                total_score = (
                    (adl.bathing or 0) + (adl.dressing or 0) + (adl.toileting or 0) +
                    (adl.transferring or 0) + (adl.continence or 0) + (adl.feeding or 0)
                )
                
                if total_score >= 20:  # High complexity (4-5 average per category)
                    high_complexity += 1
                elif total_score >= 12:  # Medium complexity (2-3 average per category)
                    medium_complexity += 1
                else:  # Low complexity (0-1 average per category)
                    low_complexity += 1
            
            # Calculate caregiver requirements
            caregivers_needed = 0
            
            # High complexity: 1 caregiver per 3 residents
            caregivers_needed += (high_complexity + 2) // 3
            
            # Medium complexity: 1 caregiver per 4 residents
            caregivers_needed += (medium_complexity + 3) // 4
            
            # Low complexity: 1 caregiver per 5 residents
            caregivers_needed += (low_complexity + 4) // 5
            
            # Add shift-specific adjustments
            if shift_type == 'day':
                # Day shift typically needs more staff due to activities, meals, etc.
                caregivers_needed = int(caregivers_needed * 1.2)
            elif shift_type == 'noc':
                # Night shift can have fewer staff but still need minimum coverage
                caregivers_needed = max(1, int(caregivers_needed * 0.8))
            # Swing shift stays as calculated
            
            # Ensure minimum of 1 MedTech + calculated caregivers
            return max(1, caregivers_needed + 1)  # +1 for minimum MedTech
            
        except Exception as e:
            logger.error(f"Error calculating shift requirements for {shift_type}: {e}")
            return 2  # Fallback: 1 MedTech + 1 Caregiver
    
    def _calculate_from_summary(self, adl_summary: WeeklyADLSummary, total_residents: int) -> int:
        """Calculate requirements from summary data when individual ADL data unavailable"""
        try:
            # Use average ADL scores from summary
            avg_bathing = adl_summary.avg_bathing or 2
            avg_dressing = adl_summary.avg_dressing or 2
            avg_toileting = adl_summary.avg_toileting or 2
            avg_transferring = adl_summary.avg_transferring or 2
            avg_continence = adl_summary.avg_continence or 2
            avg_feeding = adl_summary.avg_feeding or 2
            
            avg_total = (avg_bathing + avg_dressing + avg_toileting + 
                        avg_transferring + avg_continence + avg_feeding)
            
            # Estimate complexity based on average scores
            if avg_total >= 20:
                caregivers_needed = (total_residents + 2) // 3  # High complexity
            elif avg_total >= 12:
                caregivers_needed = (total_residents + 3) // 4  # Medium complexity
            else:
                caregivers_needed = (total_residents + 4) // 5  # Low complexity
            
            return max(2, caregivers_needed + 1)  # Minimum 1 MedTech + 1 Caregiver
            
        except Exception as e:
            logger.error(f"Error calculating from summary: {e}")
            return 2
    
    def _get_default_requirements(self) -> Dict[str, int]:
        """Get default requirements when ADL data is unavailable"""
        return {
            'day': 3,  # 1 MedTech + 2 Caregivers
            'noc': 2,  # 1 MedTech + 1 Caregiver
            'swing': 2  # 1 MedTech + 1 Caregiver
        }
    
    def get_available_staff(self) -> Dict[str, List[PaycomEmployee]]:
        """
        Get available nursing staff categorized by role type.
        Returns: {'medtech': [...], 'caregiver': [...], 'medtech_caregiver': [...]}
        """
        try:
            # Get active nursing staff from Paycom data
            nursing_staff = PaycomEmployee.objects.filter(
                status='active',
                location_description__in=self._get_paycom_locations_for_facility()
            ).exclude(
                Q(termination_date__isnull=False) | 
                Q(on_leave_date__isnull=False)
            )
            
            # Categorize by role type
            staff_by_role = {
                'medtech': [],
                'caregiver': [],
                'medtech_caregiver': [],
                'other': []
            }
            
            for staff in nursing_staff:
                position = (staff.position_description or '').lower()
                
                if 'medtech/caregiver' in position or 'med tech/caregiver' in position:
                    staff_by_role['medtech_caregiver'].append(staff)
                elif 'med tech' in position or 'medtech' in position:
                    staff_by_role['medtech'].append(staff)
                elif 'caregiver' in position:
                    staff_by_role['caregiver'].append(staff)
                else:
                    staff_by_role['other'].append(staff)
            
            logger.info(f"Available staff for {self.facility_name}: "
                       f"MedTech: {len(staff_by_role['medtech'])}, "
                       f"Caregiver: {len(staff_by_role['caregiver'])}, "
                       f"MedTech/Caregiver: {len(staff_by_role['medtech_caregiver'])}")
            
            return staff_by_role
            
        except Exception as e:
            logger.error(f"Error getting available staff: {e}")
            return {'medtech': [], 'caregiver': [], 'medtech_caregiver': [], 'other': []}
    
    def _get_paycom_locations_for_facility(self) -> List[str]:
        """Map facility ID to Paycom location descriptions"""
        facility_mapping = {
            1: ['Buena Vista', 'Corporate'],  # Assuming facility ID 1 is Buena Vista
            2: ['Murray Highland'],
            3: ['Posada SL'],  # La Posada Senior Living
            4: ['Markham'],  # Markham House Assisted Living
            5: ['Arbor MC'],  # Mill View Memory Care
        }
        
        return facility_mapping.get(self.facility_id, ['Buena Vista'])
    
    def generate_recommendations(self) -> Dict[str, Any]:
        """
        Generate scheduling recommendations for all shifts.
        Returns comprehensive recommendation data.
        """
        try:
            adl_requirements = self.get_adl_requirements()
            available_staff = self.get_available_staff()
            
            recommendations = {
                'facility_id': self.facility_id,
                'facility_name': self.facility_name,
                'target_date': self.target_date,
                'adl_requirements': adl_requirements,
                'available_staff_counts': {
                    'medtech': len(available_staff['medtech']),
                    'caregiver': len(available_staff['caregiver']),
                    'medtech_caregiver': len(available_staff['medtech_caregiver']),
                    'other': len(available_staff['other'])
                },
                'shift_recommendations': {},
                'warnings': [],
                'summary': {}
            }
            
            # Generate recommendations for each shift
            for shift_type in ['day', 'noc', 'swing']:
                shift_rec = self._generate_shift_recommendation(
                    shift_type, 
                    adl_requirements[shift_type], 
                    available_staff
                )
                recommendations['shift_recommendations'][shift_type] = shift_rec
            
            # Generate summary
            recommendations['summary'] = self._generate_summary(recommendations)
            
            logger.info(f"Generated scheduling recommendations for {self.facility_name} on {self.target_date}")
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return {
                'facility_id': self.facility_id,
                'facility_name': self.facility_name,
                'target_date': self.target_date,
                'error': str(e),
                'shift_recommendations': {},
                'warnings': ['Error generating recommendations'],
                'summary': {}
            }
    
    def _generate_shift_recommendation(self, shift_type: str, required_count: int, available_staff: Dict) -> Dict[str, Any]:
        """Generate recommendation for a specific shift"""
        try:
            # Start with required MedTech (minimum 1)
            medtech_count = max(1, required_count // 2)  # At least 1 MedTech, ideally 1 per 2 total staff
            caregiver_count = required_count - medtech_count
            
            recommended_staff = []
            warnings = []
            
            # Select MedTech staff
            medtech_selected = self._select_staff(
                available_staff['medtech'], 
                medtech_count, 
                f"MedTech for {shift_type} shift"
            )
            recommended_staff.extend(medtech_selected)
            
            # If not enough MedTech, use MedTech/Caregiver combinations
            if len(medtech_selected) < medtech_count:
                needed = medtech_count - len(medtech_selected)
                medtech_caregiver_selected = self._select_staff(
                    available_staff['medtech_caregiver'], 
                    needed, 
                    f"MedTech/Caregiver for {shift_type} shift"
                )
                recommended_staff.extend(medtech_caregiver_selected)
                
                if len(medtech_caregiver_selected) < needed:
                    warnings.append(f"Insufficient MedTech staff for {shift_type} shift")
            
            # Select Caregiver staff
            caregiver_selected = self._select_staff(
                available_staff['caregiver'], 
                caregiver_count, 
                f"Caregiver for {shift_type} shift"
            )
            recommended_staff.extend(caregiver_selected)
            
            # If not enough caregivers, use remaining MedTech/Caregiver
            if len(caregiver_selected) < caregiver_count:
                needed = caregiver_count - len(caregiver_selected)
                remaining_medtech_caregiver = [
                    staff for staff in available_staff['medtech_caregiver'] 
                    if staff not in [s['employee'] for s in recommended_staff]
                ]
                additional_selected = self._select_staff(
                    remaining_medtech_caregiver, 
                    needed, 
                    f"Additional MedTech/Caregiver for {shift_type} shift"
                )
                recommended_staff.extend(additional_selected)
                
                if len(additional_selected) < needed:
                    warnings.append(f"Insufficient caregiver staff for {shift_type} shift")
            
            return {
                'shift_type': shift_type,
                'required_count': required_count,
                'recommended_count': len(recommended_staff),
                'staff': recommended_staff,
                'warnings': warnings,
                'coverage_ratio': len(recommended_staff) / required_count if required_count > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error generating shift recommendation for {shift_type}: {e}")
            return {
                'shift_type': shift_type,
                'required_count': required_count,
                'recommended_count': 0,
                'staff': [],
                'warnings': [f'Error generating recommendation: {str(e)}'],
                'coverage_ratio': 0
            }
    
    def _select_staff(self, staff_list: List[PaycomEmployee], count: int, purpose: str) -> List[Dict[str, Any]]:
        """Select staff from available list, prioritizing by availability and experience"""
        if not staff_list or count <= 0:
            return []
        
        # Sort by availability (hours worked vs max hours) and experience (hire date)
        sorted_staff = sorted(
            staff_list,
            key=lambda x: (
                (x.hours_worked_current_period or 0) / (x.max_hours_per_week or 40),  # Availability ratio
                x.hire_date or datetime.min.date()  # Experience (older hire date = more experience)
            )
        )
        
        selected = []
        for i, staff in enumerate(sorted_staff[:count]):
            selected.append({
                'employee': staff,
                'employee_id': staff.employee_id,
                'name': f"{staff.first_name} {staff.last_name}",
                'role': self._determine_role(staff),
                'phone': staff.phone_number or staff.personal_phone,
                'email': staff.work_email,
                'availability_score': 1 - ((staff.hours_worked_current_period or 0) / (staff.max_hours_per_week or 40)),
                'experience_months': self._calculate_experience_months(staff.hire_date)
            })
        
        logger.info(f"Selected {len(selected)} staff for {purpose}")
        return selected
    
    def _determine_role(self, staff: PaycomEmployee) -> str:
        """Determine the role type for a staff member"""
        position = (staff.position_description or '').lower()
        if 'medtech/caregiver' in position or 'med tech/caregiver' in position:
            return 'MedTech/Caregiver'
        elif 'med tech' in position or 'medtech' in position:
            return 'MedTech'
        elif 'caregiver' in position:
            return 'Caregiver'
        else:
            return 'Other'
    
    def _calculate_experience_months(self, hire_date: Optional[date]) -> int:
        """Calculate experience in months"""
        if not hire_date:
            return 0
        
        today = timezone.now().date()
        months = (today.year - hire_date.year) * 12 + (today.month - hire_date.month)
        return max(0, months)
    
    def _generate_summary(self, recommendations: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary statistics"""
        try:
            total_required = sum(
                rec['required_count'] 
                for rec in recommendations['shift_recommendations'].values()
            )
            total_recommended = sum(
                rec['recommended_count'] 
                for rec in recommendations['shift_recommendations'].values()
            )
            
            # Count warnings
            total_warnings = sum(
                len(rec.get('warnings', [])) 
                for rec in recommendations['shift_recommendations'].values()
            )
            
            return {
                'total_required_staff': total_required,
                'total_recommended_staff': total_recommended,
                'coverage_percentage': (total_recommended / total_required * 100) if total_required > 0 else 0,
                'total_warnings': total_warnings,
                'is_adequately_staffed': total_warnings == 0 and total_recommended >= total_required,
                'facility_name': recommendations['facility_name'],
                'target_date': recommendations['target_date']
            }
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return {
                'total_required_staff': 0,
                'total_recommended_staff': 0,
                'coverage_percentage': 0,
                'total_warnings': 1,
                'is_adequately_staffed': False,
                'error': str(e)
            }


def generate_scheduling_recommendations(facility_id: int, target_date: date) -> Dict[str, Any]:
    """
    Main function to generate scheduling recommendations.
    
    Args:
        facility_id: ID of the facility
        target_date: Date for which to generate recommendations
    
    Returns:
        Dict containing scheduling recommendations
    """
    engine = SchedulingRecommendationEngine(facility_id, target_date)
    return engine.generate_recommendations()


def generate_weekly_scheduling_recommendations(facility_id: int, week_start_date: date) -> Dict[str, Any]:
    """
    Generate scheduling recommendations for a facility for an entire week.
    
    Args:
        facility_id: ID of the facility
        week_start_date: Start date of the week (Monday)
    
    Returns:
        Dict containing weekly scheduling recommendations
    """
    try:
        from datetime import timedelta
        
        week_dates = [week_start_date + timedelta(days=i) for i in range(7)]
        
        weekly_recommendations = {
            'facility_id': facility_id,
            'week_start_date': week_start_date,
            'week_dates': week_dates,
            'daily_recommendations': {},
            'weekly_summary': {
                'total_required_staff': 0,
                'total_recommended_staff': 0,
                'average_coverage_percentage': 0,
                'days_with_warnings': 0,
                'is_week_adequately_staffed': True
            }
        }
        
        total_required = 0
        total_recommended = 0
        days_with_warnings = 0
        
        # Generate recommendations for each day of the week
        for day_date in week_dates:
            daily_rec = generate_scheduling_recommendations(facility_id, day_date)
            weekly_recommendations['daily_recommendations'][day_date.isoformat()] = daily_rec
            
            # Update weekly summary
            if 'summary' in daily_rec:
                total_required += daily_rec['summary'].get('total_required_staff', 0)
                total_recommended += daily_rec['summary'].get('total_recommended_staff', 0)
                if daily_rec['summary'].get('total_warnings', 0) > 0:
                    days_with_warnings += 1
                if not daily_rec['summary'].get('is_adequately_staffed', False):
                    weekly_recommendations['weekly_summary']['is_week_adequately_staffed'] = False
        
        # Calculate weekly averages
        weekly_recommendations['weekly_summary']['total_required_staff'] = total_required
        weekly_recommendations['weekly_summary']['total_recommended_staff'] = total_recommended
        weekly_recommendations['weekly_summary']['average_coverage_percentage'] = (
            total_recommended / total_required * 100
        ) if total_required > 0 else 0
        weekly_recommendations['weekly_summary']['days_with_warnings'] = days_with_warnings
        
        # Get facility name from first day's recommendations
        if weekly_recommendations['daily_recommendations']:
            first_day = list(weekly_recommendations['daily_recommendations'].values())[0]
            weekly_recommendations['facility_name'] = first_day.get('facility_name', 'Unknown Facility')
        
        logger.info(f"Generated weekly recommendations for facility {facility_id}, week {week_start_date}")
        return weekly_recommendations
        
    except Exception as e:
        logger.error(f"Error generating weekly scheduling recommendations: {e}")
        return {
            'facility_id': facility_id,
            'week_start_date': week_start_date,
            'error': str(e),
            'daily_recommendations': {},
            'weekly_summary': {}
        }


def generate_multi_facility_weekly_recommendations(week_start_date: date) -> Dict[str, Any]:
    """
    Generate weekly scheduling recommendations for all facilities.
    
    Args:
        week_start_date: Start date of the week (Monday)
    
    Returns:
        Dict containing weekly recommendations for all facilities
    """
    try:
        from facility.models import Facility
        
        facilities = Facility.objects.all()
        all_recommendations = {
            'week_start_date': week_start_date,
            'facilities': {},
            'weekly_summary': {
                'total_facilities': facilities.count(),
                'total_required_staff': 0,
                'total_recommended_staff': 0,
                'facilities_with_warnings': 0,
                'is_all_facilities_adequately_staffed': True
            }
        }
        
        for facility in facilities:
            weekly_rec = generate_weekly_scheduling_recommendations(facility.id, week_start_date)
            all_recommendations['facilities'][facility.id] = weekly_rec
            
            # Update summary
            if 'weekly_summary' in weekly_rec:
                all_recommendations['weekly_summary']['total_required_staff'] += weekly_rec['weekly_summary'].get('total_required_staff', 0)
                all_recommendations['weekly_summary']['total_recommended_staff'] += weekly_rec['weekly_summary'].get('total_recommended_staff', 0)
                if weekly_rec['weekly_summary'].get('days_with_warnings', 0) > 0:
                    all_recommendations['weekly_summary']['facilities_with_warnings'] += 1
                if not weekly_rec['weekly_summary'].get('is_week_adequately_staffed', False):
                    all_recommendations['weekly_summary']['is_all_facilities_adequately_staffed'] = False
        
        # Calculate overall coverage percentage
        total_required = all_recommendations['weekly_summary']['total_required_staff']
        total_recommended = all_recommendations['weekly_summary']['total_recommended_staff']
        all_recommendations['weekly_summary']['overall_coverage_percentage'] = (
            total_recommended / total_required * 100
        ) if total_required > 0 else 0
        
        return all_recommendations
        
    except Exception as e:
        logger.error(f"Error generating multi-facility weekly recommendations: {e}")
        return {
            'week_start_date': week_start_date,
            'error': str(e),
            'facilities': {},
            'weekly_summary': {}
        }


def apply_scheduling_recommendations(facility_id: int, week_start_date: date, recommendations: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply scheduling recommendations to create actual shifts and staff assignments.
    
    Args:
        facility_id: ID of the facility
        week_start_date: Start date of the week (Monday)
        recommendations: Weekly recommendations data
    
    Returns:
        Dict containing application results
    """
    try:
        from datetime import timedelta
        from scheduling.models import Shift, Staff
        from facility.models import Facility
        
        facility = Facility.objects.get(id=facility_id)
        applied_shifts = []
        applied_assignments = []
        errors = []
        
        # Process each day's recommendations
        for date_str, day_data in recommendations.get('daily_recommendations', {}).items():
            day_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            # Process each shift type for this day
            for shift_type, shift_data in day_data.get('shift_recommendations', {}).items():
                try:
                    # Create or update shift
                    shift, created = _create_or_update_shift(
                        facility, day_date, shift_type, shift_data
                    )
                    
                    if created:
                        applied_shifts.append(shift.id)
                    
                    # Assign recommended staff to shift
                    for staff_rec in shift_data.get('staff', []):
                        assignment = _assign_staff_to_shift(
                            shift, staff_rec
                        )
                        if assignment:
                            applied_assignments.append(assignment.id)
                            
                except Exception as e:
                    errors.append(f"Error applying {shift_type} shift for {day_date}: {str(e)}")
                    logger.error(f"Error applying shift: {e}")
        
        return {
            'success': len(errors) == 0,
            'facility_id': facility_id,
            'facility_name': facility.name,
            'week_start_date': week_start_date,
            'applied_shifts': len(applied_shifts),
            'applied_assignments': len(applied_assignments),
            'errors': errors,
            'message': f"Successfully applied recommendations: {len(applied_shifts)} shifts, {len(applied_assignments)} assignments"
        }
        
    except Exception as e:
        logger.error(f"Error applying scheduling recommendations: {e}")
        return {
            'success': False,
            'facility_id': facility_id,
            'week_start_date': week_start_date,
            'error': str(e),
            'applied_shifts': 0,
            'applied_assignments': 0,
            'errors': [str(e)]
        }


def _create_or_update_shift(facility, day_date, shift_type, shift_data):
    """Create or update a shift based on recommendations"""
    try:
        # Map shift types to times
        shift_times = {
            'day': ('06:00:00', '14:00:00'),
            'swing': ('14:00:00', '22:00:00'),
            'noc': ('22:00:00', '06:00:00')
        }
        
        start_time_str, end_time_str = shift_times.get(shift_type, ('06:00:00', '14:00:00'))
        
        # Try to find existing shift
        shift = Shift.objects.filter(
            facility=facility,
            date=day_date,
            shift_type=shift_type.upper()
        ).first()
        
        if shift:
            # Update existing shift
            shift.required_staff_count = shift_data.get('required_count', 0)
            shift.save()
            return shift, False
        else:
            # Create new shift
            shift = Shift.objects.create(
                facility=facility,
                date=day_date,
                shift_type=shift_type.upper(),
                start_time=start_time_str,
                end_time=end_time_str,
                required_staff_count=shift_data.get('required_count', 0),
                status='scheduled'
            )
            return shift, True
            
    except Exception as e:
        logger.error(f"Error creating/updating shift: {e}")
        raise


def _assign_staff_to_shift(shift, staff_rec):
    """Assign recommended staff to a shift"""
    try:
        # Find staff member by employee_id
        staff = Staff.objects.filter(
            employee_id=staff_rec.get('employee_id')
        ).first()
        
        if not staff:
            logger.warning(f"Staff not found for employee_id: {staff_rec.get('employee_id')}")
            return None
        
        # Check if already assigned to this shift
        existing_assignment = shift.assignments.filter(staff=staff).first()
        if existing_assignment:
            return existing_assignment
        
        # Create new assignment
        from scheduling.models import ShiftAssignment
        assignment = ShiftAssignment.objects.create(
            shift=shift,
            staff=staff,
            status='assigned',
            assigned_by_ai=True
        )
        
        return assignment
        
    except Exception as e:
        logger.error(f"Error assigning staff to shift: {e}")
        return None


def generate_multi_facility_recommendations(target_date: date) -> Dict[str, Any]:
    """
    Generate scheduling recommendations for all facilities.
    
    Args:
        target_date: Date for which to generate recommendations
    
    Returns:
        Dict containing recommendations for all facilities
    """
    try:
        from facility.models import Facility
        
        facilities = Facility.objects.all()
        all_recommendations = {
            'target_date': target_date,
            'facilities': {},
            'summary': {
                'total_facilities': facilities.count(),
                'total_required_staff': 0,
                'total_recommended_staff': 0,
                'facilities_with_warnings': 0
            }
        }
        
        for facility in facilities:
            recommendations = generate_scheduling_recommendations(facility.id, target_date)
            all_recommendations['facilities'][facility.id] = recommendations
            
            # Update summary
            if 'summary' in recommendations:
                all_recommendations['summary']['total_required_staff'] += recommendations['summary'].get('total_required_staff', 0)
                all_recommendations['summary']['total_recommended_staff'] += recommendations['summary'].get('total_recommended_staff', 0)
                if recommendations['summary'].get('total_warnings', 0) > 0:
                    all_recommendations['summary']['facilities_with_warnings'] += 1
        
        # Calculate overall coverage percentage
        total_required = all_recommendations['summary']['total_required_staff']
        total_recommended = all_recommendations['summary']['total_recommended_staff']
        all_recommendations['summary']['overall_coverage_percentage'] = (
            total_recommended / total_required * 100
        ) if total_required > 0 else 0
        
        return all_recommendations
        
    except Exception as e:
        logger.error(f"Error generating multi-facility recommendations: {e}")
        return {
            'target_date': target_date,
            'error': str(e),
            'facilities': {},
            'summary': {}
        }
