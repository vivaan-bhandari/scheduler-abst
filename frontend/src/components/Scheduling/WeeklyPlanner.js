import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Avatar,
  Divider,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Add as AddIcon,
  Clear as ClearIcon,
  FileDownload as ExportIcon,
  Print as PrintIcon,
  AutoFixHigh as AutoFillIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

// Add CSS keyframes for animations
const styles = `
  @keyframes slideInUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

const WeeklyPlanner = ({ facilityId }) => {
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date();
    console.log('🔍 DEBUG Initial currentWeek:', now.toISOString().split('T')[0]);
    return now;
  });
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [draggedStaff, setDraggedStaff] = useState(null);
  const [dragOverShift, setDragOverShift] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [successfulAssignment, setSuccessfulAssignment] = useState(null);
  const [pendingAssignments, setPendingAssignments] = useState(new Set());
  const [deleteConfirmShift, setDeleteConfirmShift] = useState(null);
  const [deleteConfirmAssignment, setDeleteConfirmAssignment] = useState(null);
  const [createShiftData, setCreateShiftData] = useState(null);
  const [creatingShift, setCreatingShift] = useState(false);
  const [showCreateShiftDialog, setShowCreateShiftDialog] = useState(false);
  const [isEditingShift, setIsEditingShift] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [createShiftForm, setCreateShiftForm] = useState({
    date: '',
    shiftType: '',
    requiredStaffCount: 1,
    requiredStaffRole: 'cna',
    startTime: '08:00',
    endTime: '16:00'
  });

  useEffect(() => {
    if (facilityId) {
      console.log('🔍 DEBUG - Component mounted with facilityId:', facilityId);
      fetchData();
    } else {
      console.log('⚠️ WARNING - No facilityId provided');
    }
  }, [facilityId, currentWeek]);

  // Add a manual data fetch effect for debugging
  useEffect(() => {
    console.log('🔍 DEBUG - Current state:', {
      facilityId,
      currentWeek: currentWeek?.toISOString(),
      shiftsCount: shifts.length,
      staffCount: staff.length,
      assignmentsCount: assignments.length
    });
  }, [facilityId, currentWeek, shifts, staff, assignments]);

  // Check authentication status
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.warn('⚠️ No authentication token found');
      setSnackbar({ 
        open: true, 
        message: 'Authentication required - please log in', 
        severity: 'warning' 
      });
    } else {
      console.log('✅ Authentication token found:', token.substring(0, 20) + '...');
      // Set axios authorization header
      axios.defaults.headers.common['Authorization'] = `Token ${token}`;
    }
  }, []);

  // Normalize assignment data structure
  const normalizeAssignments = (assignmentsData) => {
    if (!assignmentsData || !Array.isArray(assignmentsData)) {
      return [];
    }
    
    return assignmentsData.map(assignment => {
      // Ensure we have consistent structure
      const normalized = {
        id: assignment.id,
        status: assignment.status || 'assigned',
        assigned_at: assignment.assigned_at,
        confirmed_at: assignment.confirmed_at,
        notes: assignment.notes || ''
      };
      
      // Handle staff field (could be object or ID)
      if (assignment.staff && typeof assignment.staff === 'object') {
        normalized.staff = assignment.staff.id;
        normalized.staff_object = assignment.staff;
      } else {
        normalized.staff = assignment.staff || assignment.staff_id;
      }
      
      // Handle shift field (could be object or ID)
      if (assignment.shift && typeof assignment.shift === 'object') {
        normalized.shift = assignment.shift.id;
        normalized.shift_object = assignment.shift;
      } else {
        normalized.shift = assignment.shift || assignment.shift_id;
      }
      
      return normalized;
    });
  };

  const fetchData = async () => {
    console.log('🔍 DEBUG - fetchData called');
    console.log('🔍 DEBUG - facilityId:', facilityId);
    console.log('🔍 DEBUG - currentWeek:', currentWeek);
    console.log('🔍 DEBUG - week start:', getWeekStart(currentWeek));
    
    try {
      console.log('🔍 DEBUG - Making API calls...');
      
      const [shiftsRes, staffRes, assignmentsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/scheduling/shifts/weekly/?facility=${facilityId}&week_start=${getWeekStart(currentWeek)}`),
        axios.get(`${API_BASE_URL}/api/scheduling/staff/?facility=${facilityId}`),
        axios.get(`${API_BASE_URL}/api/scheduling/assignments/?facility=${facilityId}`),
      ]);
      
      console.log('🔍 DEBUG - API calls completed');
      console.log('🔍 DEBUG - Shifts response status:', shiftsRes.status);
      console.log('🔍 DEBUG - Staff response status:', staffRes.status);
      console.log('🔍 DEBUG - Assignments response status:', assignmentsRes.status);
      
      const shiftsData = shiftsRes.data.results || shiftsRes.data;
      const staffData = staffRes.data.results || staffRes.data;
      const assignmentsData = assignmentsRes.data.results || assignmentsRes.data;
      
      console.log('🔍 DEBUG - Raw API Responses:');
      console.log('Shifts response:', shiftsRes.data);
      console.log('Staff response:', staffRes.data);
      console.log('Assignments response:', assignmentsRes.data);
      
      console.log('🔍 DEBUG - Processed Data:');
      console.log('Shifts:', shiftsData);
      console.log('Staff:', staffData);
      console.log('Assignments:', assignmentsData);
      
      // Check if assignments are empty and log the API call details
      if (!assignmentsData || assignmentsData.length === 0) {
        console.log('⚠️ WARNING: No assignments returned from API');
        console.log('🔍 API URL called:', `${API_BASE_URL}/api/scheduling/assignments/?facility=${facilityId}&week=${getWeekStart(currentWeek)}`);
        console.log('🔍 Facility ID:', facilityId);
        console.log('🔍 Week start:', getWeekStart(currentWeek));
      } else {
        console.log('✅ Assignments found:', assignmentsData.length);
        console.log('🔍 First assignment structure:', assignmentsData[0]);
        console.log('🔍 Assignment fields:', Object.keys(assignmentsData[0]));
      }
      
      // Normalize assignment data structure
      const normalizedAssignments = normalizeAssignments(assignmentsData);
      console.log('🔍 DEBUG - Normalized assignments:', normalizedAssignments);
      
      setShifts(shiftsData);
      setStaff(staffData);
      setAssignments(normalizedAssignments);
      
      console.log('🔍 DEBUG - State updated');
    } catch (error) {
      console.error('Error fetching data:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    } finally {
      setLoading(false);
      console.log('🔍 DEBUG - fetchData completed');
    }
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    // Get Monday of the current week (0 = Sunday, 1 = Monday, etc.)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d);
    weekStart.setDate(diff);
    
    console.log('🔍 DEBUG getWeekStart:', { 
      inputDate: date, 
      inputDateString: date.toISOString().split('T')[0],
      dayOfWeek: day,
      diff: diff,
      calculatedWeekStart: weekStart.toISOString().split('T')[0],
      currentDate: new Date().toISOString().split('T')[0]
    });
    
    return weekStart.toISOString().split('T')[0];
  };

  const getWeekDays = () => {
    const start = getWeekStart(currentWeek);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getShiftTypes = () => {
    // Always return the 3 standard shift types regardless of whether shifts exist
    const standardTypes = ['day', 'swing', 'noc'];
    
    // If we have shifts, also include any custom types that might exist
    const customTypes = [...new Set(shifts.map(shift => shift.shift_type))];
    const allTypes = [...new Set([...standardTypes, ...customTypes])];
    
    // Sort but ensure standard types come first
    return allTypes.sort((a, b) => {
      const aIndex = standardTypes.indexOf(a);
      const bIndex = standardTypes.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
  };

  const getShiftForDay = (day, shiftType) => {
    const dayStr = day.toISOString().split('T')[0];
    return shifts.find(shift => 
      shift.date === dayStr && shift.shift_type === shiftType
    );
  };

  const getAssignmentsForShift = (shiftId) => {
    if (!assignments || assignments.length === 0) {
      console.log(`🔍 DEBUG getAssignmentsForShift(${shiftId}): No assignments available`);
      return [];
    }
    
    // Use normalized data structure
    const shiftAssignments = assignments.filter(assignment => {
      const matches = assignment.shift === shiftId;
      console.log(`🔍 DEBUG assignment ${assignment.id}: shift=${assignment.shift}, matches=${matches}`);
      return matches;
    });
    
    console.log(`🔍 DEBUG getAssignmentsForShift(${shiftId}): Found ${shiftAssignments.length} assignments`);
    return shiftAssignments;
  };

  const getAssignmentsForStaff = (staffId) => {
    // Use normalized data structure
    const staffAssignments = assignments.filter(assignment => {
      return assignment.staff === staffId;
    });
    
    console.log(`🔍 DEBUG getAssignmentsForStaff(${staffId}): Found ${staffAssignments.length} assignments`);
    return staffAssignments;
  };

  const handleRemoveAssignment = async (assignmentId) => {
    setDeleteConfirmAssignment(assignmentId);
  };

  const confirmRemoveAssignment = async () => {
    if (!deleteConfirmAssignment) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/api/scheduling/assignments/${deleteConfirmAssignment}/`);
      setSnackbar({ 
        open: true, 
        message: 'Staff assignment removed successfully', 
        severity: 'success' 
      });
      fetchData();
    } catch (error) {
      console.error('Error removing assignment:', error);
      setSnackbar({ 
        open: true, 
        message: 'Error removing staff assignment', 
        severity: 'error' 
      });
    } finally {
      setDeleteConfirmAssignment(null);
    }
  };

  const handlePrevWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() - 7);
    setCurrentWeek(newWeek);
  };

  const handleNextWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + 7);
    setCurrentWeek(newWeek);
  };

  const handleCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  const handleAutoFill = async () => {
    try {
      // Get all unassigned shifts for the week
      const weekStart = getWeekStart(currentWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.date);
        return shiftDate >= new Date(weekStart) && shiftDate <= weekEnd;
      });
      
      if (weekShifts.length === 0) {
        setSnackbar({ 
          open: true, 
          message: 'No shifts found for this week', 
          severity: 'info' 
        });
        return;
      }
      
      let assignmentsCreated = 0;
      
      // For each shift, try to assign available staff
      for (const shift of weekShifts) {
        const shiftAssignments = getAssignmentsForShift(shift.id);
        const neededStaff = (shift.required_staff_count || 1) - shiftAssignments.length;
        
        if (neededStaff > 0) {
          // Find available staff for this shift
          const availableStaff = staff.filter(member => {
            // Check if staff is already assigned to this shift
            const alreadyAssigned = shiftAssignments.some(assignment => 
              assignment.staff === member.id
            );
            
            if (alreadyAssigned) return false;
            
            // Check if staff has reached max hours
            const staffAssignments = getAssignmentsForStaff(member.id);
            return staffAssignments.length < member.max_hours;
          });
          
          // Assign staff to the shift
          for (let i = 0; i < Math.min(neededStaff, availableStaff.length); i++) {
            const staffMember = availableStaff[i];
            
            try {
              const newAssignment = {
                staff_id: staffMember.id,
                shift_id: shift.id,
                status: 'assigned'
              };
              
              await axios.post(`${API_BASE_URL}/api/scheduling/assignments/`, newAssignment);
              assignmentsCreated++;
            } catch (error) {
              console.error(`Error assigning ${staffMember.first_name} to shift:`, error);
            }
          }
        }
      }
      
      if (assignmentsCreated > 0) {
        setSnackbar({ 
          open: true, 
          message: `Auto-fill completed! Created ${assignmentsCreated} assignments.`, 
          severity: 'success' 
        });
        
        // Refresh data to show the new assignments
        fetchData();
      } else {
        setSnackbar({ 
          open: true, 
          message: 'No new assignments could be created. All shifts may be filled or no staff available.', 
          severity: 'info' 
        });
      }
    } catch (error) {
      console.error('Error during auto-fill:', error);
      setSnackbar({ 
        open: true, 
        message: 'Error during auto-fill operation', 
        severity: 'error' 
      });
    }
  };

  const handleClearAssignments = async () => {
    try {
      // Get all assignments for the current facility and week
      const weekStart = getWeekStart(currentWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekAssignments = assignments.filter(assignment => {
        // Get the shift object to access the date
        const shift = shifts.find(s => s.id === assignment.shift);
        if (!shift) return false;
        
        const assignmentDate = new Date(shift.date);
        return assignmentDate >= new Date(weekStart) && assignmentDate <= weekEnd;
      });
      
      if (weekAssignments.length === 0) {
        setSnackbar({ 
          open: true, 
          message: 'No assignments to clear for this week', 
          severity: 'info' 
        });
        return;
      }
      
      // Delete all assignments for the week
      const deletePromises = weekAssignments.map(assignment => 
        axios.delete(`${API_BASE_URL}/api/scheduling/assignments/${assignment.id}/`)
      );
      
      await Promise.all(deletePromises);
      
      setSnackbar({ 
        open: true, 
        message: `Schedule cleared successfully! Removed ${weekAssignments.length} assignments.`, 
        severity: 'success' 
      });
      
      // Refresh data to show the cleared assignments
      fetchData();
    } catch (error) {
      console.error('Error clearing assignments:', error);
      setSnackbar({ 
        open: true, 
        message: 'Error clearing assignments', 
        severity: 'error' 
      });
    }
  };

    const handleClearShifts = async () => {
    try {
      const weekStart = getWeekStart(currentWeek);
      
      // Call the clear_shifts endpoint that maintains grid structure
      const response = await axios.post(`${API_BASE_URL}/api/scheduling/shifts/clear_shifts/`, {
        week_start: weekStart,
        facility: facilityId
      });
      
      setSnackbar({ 
        open: true, 
        message: response.data.message, 
        severity: 'success' 
      });
      
      // Refresh data to show the empty placeholder shifts
      fetchData();
    } catch (error) {
      console.error('Error clearing shifts:', error);
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Error clearing shifts', 
        severity: 'error' 
      });
    }
  };

  const handleCreateShift = async (day, shiftType) => {
    // Check if a shift already exists for this day and shift type
    const existingShift = shifts.find(shift => {
      const shiftDate = new Date(shift.date);
      const targetDate = new Date(day);
      return shiftDate.toDateString() === targetDate.toDateString() && 
             shift.shift_type.toLowerCase() === shiftType.toLowerCase();
    });
    
    if (existingShift) {
      setSnackbar({ 
        open: true, 
        message: `${shiftType} shift already exists for ${day.toLocaleDateString()}`, 
        severity: 'info' 
      });
      return;
    }
    
    // Open the create shift dialog
    setIsEditingShift(false);
    setEditingShiftId(null);
    setCreateShiftForm({
      date: day.toISOString().split('T')[0],
      shiftType: shiftType,
      requiredStaffCount: 1,
      requiredStaffRole: 'cna',
      startTime: '08:00',
      endTime: '16:00'
    });
    setShowCreateShiftDialog(true);
  };

  // Edit shift functionality moved to existing handleEditShift function

  const handleSubmitCreateShift = async () => {
    try {
      setCreatingShift(true);
      
      // First, get the shift template for this facility and shift type
      const templateResponse = await axios.get(`${API_BASE_URL}/api/scheduling/shift-templates/?facility=${facilityId}&shift_type=${createShiftForm.shiftType.toLowerCase()}`);
      
      if (!templateResponse.data.results || templateResponse.data.results.length === 0) {
        setSnackbar({ 
          open: true, 
          message: `No shift template found for ${createShiftForm.shiftType} shift type. Please create a template first.`, 
          severity: 'warning' 
        });
        return;
      }
      
      const shiftTemplate = templateResponse.data.results[0];
      
      if (isEditingShift && editingShiftId) {
        // Update existing shift
        const updatedShift = {
          date: createShiftForm.date,
          shift_template_id: shiftTemplate.id,
          facility_id: facilityId,
          required_staff_count: createShiftForm.requiredStaffCount,
          required_staff_role: createShiftForm.requiredStaffRole
        };

        await axios.put(`${API_BASE_URL}/api/scheduling/shifts/${editingShiftId}/`, updatedShift);
        
        setSnackbar({ 
          open: true, 
          message: `${createShiftForm.shiftType} shift updated for ${new Date(createShiftForm.date).toLocaleDateString()}`, 
          severity: 'success' 
        });
      } else {
        // Create new shift
        const newShift = {
          date: createShiftForm.date,
          shift_template_id: shiftTemplate.id,
          facility_id: facilityId,
          required_staff_count: createShiftForm.requiredStaffCount,
          required_staff_role: createShiftForm.requiredStaffRole
        };

        await axios.post(`${API_BASE_URL}/api/scheduling/shifts/`, newShift);
        
        setSnackbar({ 
          open: true, 
          message: `${createShiftForm.shiftType} shift created for ${new Date(createShiftForm.date).toLocaleDateString()}`, 
          severity: 'success' 
        });
      }

      // Close dialog and refresh data
      setShowCreateShiftDialog(false);
      setIsEditingShift(false);
      setEditingShiftId(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving shift:', error);
      let errorMessage = isEditingShift ? 'Error updating shift' : 'Error creating shift';
      
      if (error.response && error.response.data) {
        if (error.response.data.shift_template_id) {
          errorMessage = 'Shift template not found. Please create shift templates first.';
        } else if (error.response.data.facility_id) {
          errorMessage = 'Facility not found. Please select a valid facility.';
        }
      }
      
      // Check for unique constraint violation
      if (error.response && error.response.status === 400) {
        errorMessage = 'A shift already exists for this day and shift type.';
      }
      
      setSnackbar({ 
        open: true, 
        message: errorMessage, 
        severity: 'error' 
      });
    } finally {
      setCreatingShift(false);
    }
  };

  const getStaffStatus = (staffMember) => {
    const staffAssignments = assignments.filter(assignment => {
      // Use normalized data structure
      return assignment.staff === staffMember.id;
    });
    
    if (staffAssignments.length === 0) return 'available';
    if (staffAssignments.length >= staffMember.max_hours) return 'over_max';
    if (staffAssignments.length >= staffMember.max_hours * 0.8) return 'near_max';
    return 'assigned';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'success';
      case 'assigned': return 'primary';
      case 'near_max': return 'warning';
      case 'over_max': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'available': return <CheckIcon />;
      case 'assigned': return <InfoIcon />;
      case 'near_max': return <WarningIcon />;
      case 'over_max': return <ErrorIcon />;
      default: return <InfoIcon />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return 'Available';
      case 'assigned': return 'Assigned this week';
      case 'near_max': return 'Near max hours';
      case 'over_max': return 'Over max hours';
      default: return 'Unknown';
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, staffMember) => {
    // Check if staff member is available for assignment
    const currentAssignments = getAssignmentsForStaff(staffMember.id);
    const currentHours = currentAssignments.length;
    
    if (currentHours >= staffMember.max_hours) {
      setSnackbar({ 
        open: true, 
        message: `⚠️ ${staffMember.first_name} has reached maximum hours (${staffMember.max_hours}h). Cannot assign to more shifts.`, 
        severity: 'warning' 
      });
      e.preventDefault();
      return;
    }
    
    setDraggedStaff(staffMember);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', staffMember.id);
    
    // Show helpful tooltip
    setSnackbar({ 
      open: true, 
      message: `📋 Dragging ${staffMember.first_name} (${staffMember.role}) - Drop on a shift to assign`, 
      severity: 'info' 
    });
  };

  const handleDragOver = (e, shift) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverShift(shift);
  };

  const handleDragLeave = (e) => {
    setDragOverShift(null);
  };

  const handleDrop = async (e, shift) => {
    e.preventDefault();
    
    if (!draggedStaff || !shift) return;

    // Create a unique key for this assignment
    const assignmentKey = `${draggedStaff.id}-${shift.id}`;
    
    // Check if this assignment is already pending
    if (pendingAssignments.has(assignmentKey)) {
      setSnackbar({ 
        open: true, 
        message: 'Assignment already in progress, please wait...', 
        severity: 'info' 
      });
      return;
    }

    setIsAssigning(true);
    setPendingAssignments(prev => new Set(prev).add(assignmentKey));

    // Debug: Check authentication state
    console.log('🔐 Authentication Debug:');
    console.log('Axios default headers:', axios.defaults.headers.common);
    console.log('Authorization header:', axios.defaults.headers.common['Authorization']);
    console.log('Current API base URL:', API_BASE_URL);

    try {
      // Check if staff is already assigned to this shift
      const existingAssignment = assignments.find(assignment => {
        // Use normalized data structure
        return assignment.staff === draggedStaff.id && assignment.shift === shift.id;
      });

      if (existingAssignment) {
        setSnackbar({ 
          open: true, 
          message: `❌ ${draggedStaff.first_name} is already assigned to this shift! Cannot add the same staff member twice.`, 
          severity: 'error' 
        });
        return;
      }

      // Additional check: Verify no duplicate assignments exist in the current shift
      const shiftAssignments = getAssignmentsForShift(shift.id);
      const isStaffAlreadyInShift = shiftAssignments.some(assignment => {
        const assignedStaff = staff.find(s => s.id === assignment.staff);
        return assignedStaff && assignedStaff.id === draggedStaff.id;
      });

      if (isStaffAlreadyInShift) {
        setSnackbar({ 
          open: true, 
          message: `❌ ${draggedStaff.first_name} is already assigned to this ${shift.shift_type} shift on ${new Date(shift.date).toLocaleDateString()}!`, 
          severity: 'error' 
        });
        return;
      }

      // Validate staff availability
      const staffAssignments = getAssignmentsForStaff(draggedStaff.id);
      if (staffAssignments.length >= draggedStaff.max_hours) {
        setSnackbar({ 
          open: true, 
          message: `${draggedStaff.first_name} has reached their maximum hours (${draggedStaff.max_hours}h)`, 
          severity: 'warning' 
        });
        return;
      }

      // Create new assignment - FIXED: Use correct field names
      const newAssignment = {
        staff_id: draggedStaff.id,
        shift_id: shift.id,
        status: 'assigned'
      };

      console.log('Creating assignment:', newAssignment);
      console.log('Making request to:', `${API_BASE_URL}/api/scheduling/assignments/`);

      // Make actual API call to create assignment
      const response = await axios.post(`${API_BASE_URL}/api/scheduling/assignments/`, newAssignment);
      
      console.log('Assignment created:', response.data);
      console.log('🔍 DEBUG - Response structure:', Object.keys(response.data));
      console.log('🔍 DEBUG - Response data:', response.data);
      
      setSnackbar({ 
        open: true, 
        message: `${draggedStaff.first_name} assigned to ${shift.shift_type} shift on ${new Date(shift.date).toLocaleDateString()}`, 
        severity: 'success' 
      });

      // Set success state for visual feedback
      setSuccessfulAssignment(shift.id);
      setTimeout(() => setSuccessfulAssignment(null), 2000); // Clear after 2 seconds

      // Refresh data to show the new assignment
      console.log('🔍 DEBUG - Refreshing data after assignment creation...');
      try {
        await fetchData();
        console.log('🔍 DEBUG - Data refresh completed');
        
        // Double-check that the assignment is now visible
        const updatedAssignments = await axios.get(`${API_BASE_URL}/api/scheduling/assignments/?facility=${facilityId}`);
        console.log('🔍 DEBUG - Verification fetch result:', updatedAssignments.data);
        
        if (updatedAssignments.data && updatedAssignments.data.length > 0) {
          console.log('✅ Assignments found after refresh:', updatedAssignments.data.length);
        } else {
          console.log('⚠️ No assignments found after refresh');
        }
      } catch (refreshError) {
        console.error('Error refreshing data:', refreshError);
        setSnackbar({ 
          open: true, 
          message: 'Assignment created but data refresh failed. Please refresh the page.', 
          severity: 'warning' 
        });
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
      console.error('Error response:', error.response);
      console.error('Error request:', error.request);
      
      let errorMessage = 'Error assigning staff to shift';
      
      if (error.response) {
        // Server responded with error status
        console.log('Server responded with status:', error.response.status);
        console.log('Server response data:', error.response.data);
        
        if (error.response.data && error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.status === 400) {
          errorMessage = 'Invalid assignment data';
        } else if (error.response.status === 401) {
          errorMessage = 'Authentication required - please log in again';
        } else if (error.response.status === 403) {
          errorMessage = 'Permission denied';
        } else if (error.response.status === 404) {
          errorMessage = 'Shift or staff not found';
        } else if (error.response.status === 500) {
          // Check for specific database errors
          if (error.response.data && typeof error.response.data === 'string') {
            if (error.response.data.includes('UNIQUE constraint failed')) {
              errorMessage = 'This staff member is already assigned to this shift';
            } else if (error.response.data.includes('IntegrityError')) {
              errorMessage = 'Database constraint error - please try again';
            } else {
              errorMessage = 'Server error: ' + error.response.data;
            }
          } else {
            errorMessage = 'Server error - please try again';
          }
        }
      } else if (error.request) {
        // Request was made but no response received
        console.log('Request was made but no response received');
        errorMessage = 'Network error - please check your connection';
      }
      
      setSnackbar({ 
        open: true, 
        message: errorMessage, 
        severity: 'error' 
      });
    } finally {
      setDraggedStaff(null);
      setDragOverShift(null);
      setIsAssigning(false);
      setPendingAssignments(prev => {
        const newSet = new Set(prev);
        newSet.delete(assignmentKey);
        return newSet;
      });
    }
  };

  const handleEditShift = (shift) => {
    // Open the edit shift dialog with current shift data
    setIsEditingShift(true);
    setEditingShiftId(shift.id);
    setCreateShiftForm({
      date: shift.date,
      shiftType: shift.shift_type,
      requiredStaffCount: shift.required_staff_count || 1,
      requiredStaffRole: shift.required_staff_role || 'cna',
      startTime: shift.start_time || '08:00',
      endTime: shift.end_time || '16:00'
    });
    setShowCreateShiftDialog(true);
  };

  const handleDeleteShift = async (shift) => {
    if (!shift || !shift.id) {
      console.error('Invalid shift object:', shift);
      setSnackbar({ 
        open: true, 
        message: 'Invalid shift data', 
        severity: 'error' 
      });
      return;
    }
    
    console.log('Deleting shift:', shift);
    setDeleteConfirmShift(shift);
  };

  const confirmDeleteShift = async () => {
    if (!deleteConfirmShift || !deleteConfirmShift.id) {
      console.error('Invalid shift object for deletion:', deleteConfirmShift);
      setSnackbar({ 
        open: true, 
        message: 'Invalid shift data for deletion', 
        severity: 'error' 
      });
      setDeleteConfirmShift(null);
      return;
    }
    
    try {
      await axios.delete(`${API_BASE_URL}/api/scheduling/shifts/${deleteConfirmShift.id}/`);
      setSnackbar({ 
        open: true, 
        message: `Shift "${deleteConfirmShift.shift_type}" on ${new Date(deleteConfirmShift.date).toLocaleDateString()} deleted.`, 
        severity: 'success' 
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting shift:', error);
      setSnackbar({ 
        open: true, 
        message: 'Error deleting shift', 
        severity: 'error' 
      });
    } finally {
      setDeleteConfirmShift(null);
    }
  };

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.last_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const weekDays = getWeekDays();
  const shiftTypes = getShiftTypes();

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">Loading planner...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Summary Stats */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Weekly Planner Grid
        </Typography>
        


        {/* Week Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Button onClick={handlePrevWeek} startIcon={<PrevIcon />} variant="outlined">
            Previous Week
          </Button>
          <Typography variant="h6" sx={{ minWidth: 300, textAlign: 'center' }}>
            Week of {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Typography>
          <Button onClick={handleCurrentWeek} variant="outlined">
            Current Week
          </Button>
          <Button onClick={handleNextWeek} endIcon={<NextIcon />} variant="outlined">
            Next Week
          </Button>
        </Box>
        
        {/* Facility Info */}
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
          Facility: {facilityId ? `ID: ${facilityId}` : 'No facility selected'}
        </Typography>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<AutoFillIcon />}
            onClick={handleAutoFill}
            sx={{ 
              fontWeight: '500',
              borderColor: '#e0e0e0',
              color: '#666',
              '&:hover': {
                borderColor: '#999',
                bgcolor: 'rgba(0, 0, 0, 0.02)'
              }
            }}
          >
            Auto-Fill
          </Button>
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={handleClearAssignments}
            sx={{ 
              fontWeight: '500',
              borderColor: '#e0e0e0',
              color: '#666',
              '&:hover': {
                borderColor: '#999',
                bgcolor: 'rgba(0, 0, 0, 0.02)'
              }
            }}
          >
            Clear All Assignments
          </Button>
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={handleClearShifts}
            sx={{ 
              fontWeight: '500',
              borderColor: '#e0e0e0',
              color: '#666',
              '&:hover': {
                borderColor: '#999',
                bgcolor: 'rgba(0, 0, 0, 0.02)'
              }
            }}
          >
            Clear All Shifts
          </Button>
          <Button 
            variant="outlined" 
            onClick={fetchData}
            sx={{ 
              fontWeight: '500',
              borderColor: '#e0e0e0',
              color: '#666',
              '&:hover': {
                borderColor: '#999',
                bgcolor: 'rgba(0, 0, 0, 0.02)'
              }
            }}
          >
            Refresh Data
          </Button>
          <Button variant="outlined" startIcon={<ExportIcon />} sx={{ 
            fontWeight: '500',
            borderColor: '#e0e0e0',
            color: '#666',
            '&:hover': {
              borderColor: '#999',
              bgcolor: 'rgba(0, 0, 0, 0.02)'
            }
          }}>
            Export CSV
          </Button>
          <Button variant="outlined" startIcon={<ExportIcon />} sx={{ 
            fontWeight: '500',
            borderColor: '#e0e0e0',
            color: '#666',
            '&:hover': {
              borderColor: '#999',
              bgcolor: 'rgba(0, 0, 0, 0.02)'
            }
          }}>
            Export ICS
          </Button>
          <Button variant="outlined" startIcon={<PrintIcon />} sx={{ 
            fontWeight: '500',
            borderColor: '#e0e0e0',
            color: '#666',
            '&:hover': {
              borderColor: '#999',
              bgcolor: 'rgba(0, 0, 0, 0.02)'
            }
          }}>
            Print View
          </Button>
        </Box>








      </Box>

      {/* Staff Section - Horizontal Bar Above Grid */}
      <Paper sx={{ 
        p: 2, 
        mb: 2, 
        bgcolor: 'background.paper',
        border: '1px solid #e0e0e0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        borderRadius: 2
      }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
          Staff
        </Typography>
        
        {/* Search and Filter Row */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Search staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ width: 200 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
          
          <FormControl size="small" sx={{ width: 150 }}>
            <InputLabel>Role Filter</InputLabel>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              label="Role Filter"
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="cna">CNA</MenuItem>
              <MenuItem value="lpn">LPN</MenuItem>
              <MenuItem value="rn">RN</MenuItem>
              <MenuItem value="caregiver">Caregiver</MenuItem>
            </Select>
          </FormControl>

          {/* Status Legend */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.primary' }}>
              Status:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4caf50' }} />
              <Typography variant="caption" sx={{ fontWeight: 'medium', color: '#666' }}>Available</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#666' }} />
              <Typography variant="caption" sx={{ fontWeight: 'medium', color: '#666' }}>Assigned</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff9800' }} />
              <Typography variant="caption" sx={{ fontWeight: 'medium', color: '#666' }}>Near Max</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f44336' }} />
              <Typography variant="caption" sx={{ fontWeight: 'medium', color: '#666' }}>Over Max</Typography>
            </Box>
          </Box>
        </Box>

        {/* Staff Count */}
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium', mb: 2 }}>
          Showing {filteredStaff.length} of {staff.length} staff members
        </Typography>

        {/* Staff List - Horizontal Scrollable */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          overflowX: 'auto', 
          pb: 1,
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f1f1',
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#c1c1c1',
            borderRadius: 4,
          },
        }}>
          {filteredStaff.map((member) => {
            const status = getStaffStatus(member);
            const statusColor = getStatusColor(status);
            const statusIcon = getStatusIcon(status);
            const statusText = getStatusText(status);
            
            return (
              <Card 
                key={member.id} 
                sx={{ 
                  minWidth: 200,
                  cursor: 'grab',
                  '&:hover': { 
                    boxShadow: 3,
                    transform: 'translateY(-2px)'
                  },
                  border: `2px solid ${status === 'available' ? 'transparent' : 'transparent'}`,
                  transition: 'all 0.3s ease-in-out',
                  bgcolor: 'background.paper',
                  ...(draggedStaff && draggedStaff.id === member.id && {
                    transform: 'scale(1.05) translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                    cursor: 'grabbing',
                    border: '2px solid #1976d2'
                  }),
                  ...(draggedStaff && draggedStaff.id !== member.id && {
                    opacity: 0.6,
                    transform: 'scale(0.95)'
                  })
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, member)}
              >
                <CardContent sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Avatar 
                      sx={{ 
                        width: 32, 
                        height: 32, 
                        fontSize: '0.875rem',
                        bgcolor: status === 'available' ? '#4caf50' : '#666',
                        color: 'white'
                      }}
                    >
                      {member.first_name[0]}{member.last_name[0]}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" noWrap sx={{ fontWeight: 'bold' }}>
                        {member.first_name} {member.last_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                        {member.role.toUpperCase()}
                      </Typography>
                    </Box>

                  </Box>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    mb: 1
                  }}>
                    <Typography variant="body2" color="text.primary" sx={{ fontWeight: 'bold' }}>
                      {getAssignmentsForStaff(member.id).length}/{member.max_hours}h
                    </Typography>
                    <DragIcon sx={{ color: 'text.secondary', opacity: 0.7 }} />
                  </Box>
                  
                  {/* Status Text */}
                  <Typography variant="caption" color={`${statusColor}.main`} sx={{ fontWeight: 'medium', mb: 1 }}>
                    {statusText}
                  </Typography>
                  
                  {/* Current Assignments Preview */}
                  {(() => {
                    const staffAssignments = getAssignmentsForStaff(member.id);
                    if (staffAssignments.length > 0) {
                      const assignmentDetails = staffAssignments.slice(0, 2).map(assignment => {
                        const assignedShift = shifts.find(s => s.id === assignment.shift);
                        if (assignedShift) {
                          const day = new Date(assignedShift.date).toLocaleDateString('en-US', { weekday: 'short' });
                          return `${day} ${assignedShift.shift_type}`;
                        }
                        return '';
                      }).filter(Boolean).join(', ');
                      
                      return (
                        <Typography 
                          variant="caption" 
                          color="text.secondary" 
                          sx={{ 
                            display: 'block', 
                            textAlign: 'center',
                            fontSize: '0.7rem',
                            opacity: 0.7,
                            mb: 1
                          }}
                        >
                          📅 {assignmentDetails}
                          {staffAssignments.length > 2 && ` +${staffAssignments.length - 2} more`}
                        </Typography>
                      );
                    }
                    return null;
                  })()}
                  
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ 
                      display: 'block', 
                      textAlign: 'center',
                      fontStyle: 'italic',
                      opacity: 0.8
                    }}
                  >
                    Drag to assign to shifts
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Paper>

      {/* Main Content Area - Full Width Grid */}
      <Grid container spacing={2} sx={{ 
        alignItems: 'flex-start',
        bgcolor: 'grey.50',
        p: 1,
        borderRadius: 2
      }}>
        {/* Weekly Grid Table - Full Width */}
        <Grid item xs={12}>
          <Paper sx={{ 
            overflow: 'auto',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: 2
          }}>
            <TableContainer>
              <Table sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow>
                    <TableCell 
                      sx={{ 
                        width: 100, 
                        minWidth: 100, 
                        bgcolor: 'grey.100', 
                        fontWeight: 'bold',
                        textAlign: 'center',
                        border: '1px solid #e0e0e0'
                      }}
                    >
                      Shift Type
                    </TableCell>
                    {weekDays.map((day) => (
                                          <TableCell 
                      key={day.toISOString()}
                      sx={{ 
                        width: 140, 
                        minWidth: 140, 
                        bgcolor: 'grey.100', 
                        fontWeight: 'bold',
                        textAlign: 'center',
                        border: '1px solid #e0e0e0',
                        ...(day.toDateString() === new Date().toDateString() && {
                          bgcolor: 'rgba(25, 118, 210, 0.2)',
                          border: '2px solid #1976d2'
                        })
                      }}
                    >
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                          </Typography>
                          <Typography variant="body2">
                            {day.getDate()} {day.toLocaleDateString('en-US', { month: 'short' })}
                          </Typography>
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shiftTypes.map((shiftType) => (
                    <TableRow key={shiftType}>
                      <TableCell 
                        sx={{ 
                          width: 100, 
                          minWidth: 100, 
                          bgcolor: 'grey.50', 
                          fontWeight: 'bold',
                          textAlign: 'center',
                          border: '1px solid #e0e0e0',
                          verticalAlign: 'top'
                        }}
                      >
                        <Typography variant="subtitle1" fontWeight="bold">
                          {shiftType.toUpperCase()}
                        </Typography>
                      </TableCell>
                      {weekDays.map((day) => {
                        const shift = getShiftForDay(day, shiftType);
                        const shiftAssignments = shift ? getAssignmentsForShift(shift.id) : [];
                        
                        return (
                          <TableCell 
                            key={`${shiftType}-${day.toISOString()}`}
                            sx={{ 
                              width: 140, 
                              minWidth: 140, 
                              height: 160,
                              minHeight: 160,
                              border: '1px solid #e0e0e0',
                              verticalAlign: 'top',
                              bgcolor: shift ? 'background.paper' : 'grey.50',
                              transition: 'all 0.3s ease-in-out',
                              ...(day.toDateString() === new Date().toDateString() && {
                                border: '2px solid #1976d2',
                                bgcolor: shift ? 'rgba(25, 118, 210, 0.05)' : 'rgba(25, 118, 210, 0.1)'
                              }),
                              ...(dragOverShift && dragOverShift.id === shift?.id && {
                                bgcolor: 'rgba(25, 118, 210, 0.1)',
                                border: '2px solid #1976d2',
                                boxShadow: '0 0 10px rgba(25, 118, 210, 0.3)',
                                transform: 'scale(1.02)'
                              }),
                              ...(successfulAssignment === shift?.id && {
                                bgcolor: 'rgba(76, 175, 80, 0.1)',
                                border: '2px solid #4caf50',
                                boxShadow: '0 0 15px rgba(76, 175, 80, 0.4)',
                                transform: 'scale(1.02)'
                              })
                            }}
                            onDragOver={(e) => shift && handleDragOver(e, shift)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => shift && handleDrop(e, shift)}
                          >
                            {shift && shift.id ? (
                              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                {/* Loading Overlay */}
                                {isAssigning && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      bgcolor: 'rgba(25, 118, 210, 0.1)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 1,
                                      borderRadius: 1
                                    }}
                                  >
                                    <Typography variant="caption" color="primary.main">
                                      Assigning...
                                    </Typography>
                                  </Box>
                                )}
                                
                                {/* Staff Count Chip and Delete Button */}
                                <Box sx={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  mb: 1
                                }}>
                                  <Chip 
                                    label={`${shift.required_staff_role || 'CNA'} ${shiftAssignments.length}/${shift.required_staff_count || 1} filled`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ 
                                      fontWeight: '500',
                                      fontSize: '0.7rem',
                                      borderColor: shiftAssignments.length >= (shift.required_staff_count || 1) ? '#4caf50' : '#f44336',
                                      color: shiftAssignments.length >= (shift.required_staff_count || 1) ? '#2e7d32' : '#d32f2f',
                                      bgcolor: shiftAssignments.length >= (shift.required_staff_count || 1) ? 'rgba(76, 175, 80, 0.08)' : 'rgba(244, 67, 54, 0.08)'
                                    }}
                                  />
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditShift(shift)}
                                    sx={{ 
                                      width: 20, 
                                      height: 20,
                                      color: '#666',
                                      transition: 'all 0.2s ease-in-out',
                                      mr: 0.5,
                                      '&:hover': { 
                                        bgcolor: 'rgba(0, 0, 0, 0.04)',
                                        color: '#1976d2'
                                      }
                                    }}
                                    title="Edit Shift"
                                  >
                                    <EditIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteShift(shift)}
                                    sx={{ 
                                      width: 20, 
                                      height: 20,
                                      color: '#666',
                                      transition: 'all 0.2s ease-in-out',
                                      '&:hover': { 
                                        bgcolor: 'rgba(0, 0, 0, 0.04)',
                                        color: '#d32f2f'
                                      }
                                    }}
                                    title="Delete Shift"
                                  >
                                    <ClearIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Box>
                                
                                {/* Staff Needed Text */}
                                <Typography variant="caption" display="block" sx={{ mb: 1, fontWeight: 'medium' }}>
                                  {shiftAssignments.length >= (shift.required_staff_count || 1) 
                                    ? 'Filled' 
                                    : `${(shift.required_staff_count || 1) - shiftAssignments.length} more staff needed`
                                  }
                                </Typography>
                                
                                {/* Assigned Staff List */}
                                {shiftAssignments.length > 0 && (
                                  <Box sx={{ mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                      Staff:
                                    </Typography>
                                    {shiftAssignments.map((assignment) => {
                                      // Use normalized data structure
                                      const assignedStaff = staff.find(s => s.id === assignment.staff);
                                      
                                      return assignedStaff ? (
                                        <Box
                                          key={assignment.id}
                                          sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            mb: 0.5
                                          }}
                                        >
                                                                                  <Chip
                                          label={`${assignedStaff.first_name} ${assignedStaff.last_name}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ 
                                            flex: 1, 
                                            fontSize: '0.7rem', 
                                            py: 0.2,
                                            borderColor: '#e0e0e0',
                                            color: '#666',
                                            bgcolor: 'rgba(0, 0, 0, 0.02)'
                                          }}
                                        />
                                          <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => handleRemoveAssignment(assignment.id)}
                                            sx={{ 
                                              width: 18, 
                                              height: 18,
                                              '&:hover': { bgcolor: 'error.light' }
                                            }}
                                          >
                                            <ClearIcon sx={{ fontSize: 12 }} />
                                          </IconButton>
                                        </Box>
                                      ) : null;
                                    })}
                                  </Box>
                                )}
                                
                                {/* Drop Zone */}
                                <Box sx={{ 
                                  border: '1px dashed #e0e0e0', 
                                  borderRadius: 1, 
                                  p: 0.5, 
                                  mb: 1,
                                  textAlign: 'center',
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minHeight: 40,
                                  bgcolor: 'rgba(0,0,0,0.01)',
                                  transition: 'all 0.2s ease-in-out',
                                  cursor: 'pointer',
                                  '&:hover': {
                                    bgcolor: 'rgba(0,0,0,0.03)',
                                    borderColor: '#999'
                                  },
                                  ...(dragOverShift && dragOverShift.id === shift.id && {
                                    bgcolor: 'rgba(25, 118, 210, 0.06)',
                                    borderColor: '#1976d2',
                                    borderStyle: 'solid',
                                    transform: 'scale(1.02)',
                                    boxShadow: '0 0 8px rgba(25, 118, 210, 0.2)'
                                  }),
                                  ...(successfulAssignment === shift.id && {
                                    bgcolor: 'rgba(76, 175, 80, 0.06)',
                                    borderColor: '#4caf50',
                                    borderStyle: 'solid',
                                    transform: 'scale(1.02)'
                                  }),
                                  ...(draggedStaff && !dragOverShift && {
                                    bgcolor: 'rgba(0, 0, 0, 0.02)',
                                    borderColor: '#999',
                                    borderStyle: 'dashed'
                                  })
                                }}
                                >
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    {shiftAssignments.length >= (shift.required_staff_count || 1) 
                                      ? 'Fully Staffed' 
                                      : draggedStaff 
                                        ? 'Drop Here'
                                        : 'Drop Staff Here'
                                    }
                                  </Typography>
                                </Box>
                              </Box>
                            ) : (
                              <Box sx={{ 
                                textAlign: 'center', 
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                p: 2
                              }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  No Shift
                                </Typography>
                                <Button 
                                  size="small" 
                                  variant="outlined" 
                                  startIcon={<AddIcon />}
                                  sx={{ 
                                    mt: 1,
                                    borderColor: '#e0e0e0',
                                    color: '#666',
                                    '&:hover': {
                                      borderColor: '#999',
                                      bgcolor: 'rgba(0, 0, 0, 0.02)'
                                    }
                                  }}
                                  onClick={() => handleCreateShift(day, shiftType)}
                                  disabled={creatingShift}
                                >
                                  {creatingShift ? 'Creating...' : 'Create Shift'}
                                </Button>
                              </Box>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmShift && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <Paper sx={{ p: 3, maxWidth: 400, mx: 2 }}>
            <Typography variant="h6" gutterBottom>
              Delete Shift
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Are you sure you want to delete the {deleteConfirmShift.shift_type} shift on {new Date(deleteConfirmShift.date).toLocaleDateString()}? This will also remove all staff assignments for this shift.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setDeleteConfirmShift(null)}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={confirmDeleteShift}
              >
                Delete Shift
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Assignment Removal Confirmation Dialog */}
      {deleteConfirmAssignment && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <Paper sx={{ p: 3, maxWidth: 400, mx: 2 }}>
            <Typography variant="h6" gutterBottom>
              Remove Staff Assignment
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Are you sure you want to remove this staff member from the shift? This action cannot be undone.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setDeleteConfirmAssignment(null)}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={confirmRemoveAssignment}
              >
                Remove Assignment
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Create Shift Dialog */}
      {showCreateShiftDialog && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <Paper sx={{ p: 3, maxWidth: 500, mx: 2, width: '100%', position: 'relative', zIndex: 10000 }}>
            <Typography variant="h6" gutterBottom>
              {isEditingShift ? 'Edit Shift' : 'Create New Shift'}
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Date: {new Date(createShiftForm.date).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Shift Type: {createShiftForm.shiftType.toUpperCase()}
              </Typography>
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Required Staff Count"
                  type="number"
                  value={createShiftForm.requiredStaffCount}
                  onChange={(e) => setCreateShiftForm({
                    ...createShiftForm,
                    requiredStaffCount: parseInt(e.target.value) || 1
                  })}
                  inputProps={{ min: 1, max: 20 }}
                  size="small"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Required Staff Role</InputLabel>
                  <Select
                    value={createShiftForm.requiredStaffRole}
                    onChange={(e) => setCreateShiftForm({
                      ...createShiftForm,
                      requiredStaffRole: e.target.value
                    })}
                    label="Required Staff Role"
                    MenuProps={{
                      sx: {
                        zIndex: 10001,
                        '& .MuiPaper-root': {
                          maxHeight: 200,
                          overflow: 'auto'
                        }
                      },
                      anchorOrigin: {
                        vertical: 'bottom',
                        horizontal: 'left',
                      },
                      transformOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      }
                    }}
                  >
                    <MenuItem value="cna">CNA</MenuItem>
                    <MenuItem value="lpn">LPN</MenuItem>
                    <MenuItem value="rn">RN</MenuItem>
                    <MenuItem value="cna_float">CNA Float</MenuItem>
                    <MenuItem value="med_tech">Medication Technician</MenuItem>
                    <MenuItem value="caregiver">Caregiver</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Start Time"
                  type="time"
                  value={createShiftForm.startTime}
                  onChange={(e) => setCreateShiftForm({
                    ...createShiftForm,
                    startTime: e.target.value
                  })}
                  size="small"
                  inputProps={{ step: 900 }} // 15 minutes
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="End Time"
                  type="time"
                  value={createShiftForm.endTime}
                  onChange={(e) => setCreateShiftForm({
                    ...createShiftForm,
                    endTime: e.target.value
                  })}
                  size="small"
                  inputProps={{ step: 900 }} // 15 minutes
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setShowCreateShiftDialog(false);
                  setIsEditingShift(false);
                  setEditingShiftId(null);
                  setCreateShiftForm({
                    date: '',
                    shiftType: '',
                    requiredStaffCount: 1,
                    requiredStaffRole: 'cna',
                    startTime: '08:00',
                    endTime: '16:00'
                  });
                }}
                disabled={creatingShift}
              >
                Cancel
                              </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSubmitCreateShift}
                  disabled={creatingShift}
                  startIcon={creatingShift ? null : (isEditingShift ? <EditIcon /> : <AddIcon />)}
                >
                  {creatingShift ? (isEditingShift ? 'Updating...' : 'Creating...') : (isEditingShift ? 'Update Shift' : 'Create Shift')}
                </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Success Message */}
      {successfulAssignment && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 80,
            left: 20,
            zIndex: 9999,
            minWidth: 300,
            maxWidth: 500
          }}
        >
          <Alert 
            severity="success"
            sx={{ 
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderRadius: 2,
              animation: 'slideInUp 0.3s ease-out'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckIcon />
              <Typography variant="body2">
                Staff assigned successfully!
              </Typography>
            </Box>
          </Alert>
        </Box>
      )}

      {/* Notification Bar */}
      {snackbar.open && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            zIndex: 9999,
            minWidth: 300,
            maxWidth: 500
          }}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{ 
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderRadius: 2
            }}
          >
            {snackbar.message}
          </Alert>
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        sx={{ display: 'none' }} // Hide the default snackbar since we have custom notification
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WeeklyPlanner;
