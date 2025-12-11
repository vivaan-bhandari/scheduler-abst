// Version: 2025-01-11-v3 - Overnight shifts + Daily/Weekly overtime alerts + Scroll preservation - DEPLOYED
import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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
  CircularProgress,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  FileDownload as FileDownloadIcon,
  Print as PrintIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  DragIndicator as DragIcon,
  SmartToy as SmartToyIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalHospital as MedTechIcon,
  Person as CaregiverIcon,
  HealthAndSafety as RNIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import { API_BASE_URL } from '../../config';
import { useWeek } from '../../contexts/WeekContext';

const WeeklyPlanner = forwardRef(({ facilityId, refreshTrigger }, ref) => {
  const { selectedWeek, getWeekLabel } = useWeek();
  const [currentWeek, setCurrentWeek] = useState(() => {
    const globalWeek = selectedWeek ? new Date(selectedWeek) : new Date();
    return globalWeek;
  });
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [hideOnLeave, setHideOnLeave] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'available', 'under_hours', 'at_limit', 'over_limit'
  const [newlyAddedAssignments, setNewlyAddedAssignments] = useState(new Set()); // Track newly added for fade-in
  const [removingAssignments, setRemovingAssignments] = useState(new Set()); // Track removing for slide-out
  const [autofilledShiftIds, setAutofilledShiftIds] = useState(new Set()); // Track autofilled shifts for scroll
  const [draggedStaff, setDraggedStaff] = useState(null);
  const [dragOverShift, setDragOverShift] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [successfulAssignment, setSuccessfulAssignment] = useState(null);
  const [pendingAssignments, setPendingAssignments] = useState(new Set());
  const [applying, setApplying] = useState(false);
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
    requiredStaffRole: 'med_tech',
    startTime: '08:00',
    endTime: '16:00'
  });
  const [staffPanelOpen, setStaffPanelOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedShiftForReassign, setSelectedShiftForReassign] = useState(null);
  const [selectedStaffForReassign, setSelectedStaffForReassign] = useState([]); // Changed to array for multiple assignments
  const [validationAlerts, setValidationAlerts] = useState([]);
  const [facility, setFacility] = useState(null); // Store facility data to determine shift format
  const [confirmationDialog, setConfirmationDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  // Get shift types and times based on facility format
  const getShiftTypes = () => {
    if (facility?.shift_format === '2_shift') {
      return ['DAY', 'NOC']; // 2-shift: Day and NOC only (no Swing)
    }
    return ['DAY', 'SWING', 'NOC']; // 3-shift: Day, Swing, and NOC
  };

  const getShiftTypeInfo = () => {
    if (facility?.shift_format === '2_shift') {
      // 2-shift format: 12-hour shifts
      return {
        DAY: { color: '#3b82f6', bg: '#eff6ff', time: '6:00 AM - 6:00 PM' },
        NOC: { color: '#8b5cf6', bg: '#f3e8ff', time: '6:00 PM - 6:00 AM' }
      };
    } else {
      // 3-shift format: 8-hour shifts
      return {
        DAY: { color: '#3b82f6', bg: '#eff6ff', time: '6:00 AM - 2:00 PM' },
        SWING: { color: '#f59e0b', bg: '#fffbeb', time: '2:00 PM - 10:00 PM' },
        NOC: { color: '#8b5cf6', bg: '#f3e8ff', time: '10:00 PM - 6:00 AM' }
      };
    }
  };

  // Shared helper function to calculate shift hours based on facility format
  // This ensures consistency across all hour calculations (tooltip, sidebar, validation, etc.)
  const getShiftHours = (shiftObj) => {
    if (!shiftObj?.shift_template) return 0;
    
    // For 2-shift facilities, Day and NOC are always 12 hours
    // Override any incorrect template duration/times
    if (facility?.shift_format === '2_shift') {
      const shiftType = shiftObj.shift_template.shift_type?.toLowerCase();
      if (shiftType === 'day' || shiftType === 'noc') {
        return 12.0; // Always 12 hours for 2-shift format
      }
    }
    
    // For 3-shift facilities, use duration if available
    const duration = parseFloat(shiftObj.shift_template.duration);
    if (duration) return duration;
    
    // Fallback: calculate from start/end times
    try {
      const startTime = new Date(`1970-01-01T${shiftObj.shift_template.start_time}`);
      const endTime = new Date(`1970-01-01T${shiftObj.shift_template.end_time}`);
      // Handle overnight shifts
      if (endTime < startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }
      const calculatedHours = (endTime - startTime) / (1000 * 60 * 60);
      
      // For 2-shift facilities, validate Day/NOC are 12 hours
      if (facility?.shift_format === '2_shift') {
        const shiftType = shiftObj.shift_template.shift_type?.toLowerCase();
        if ((shiftType === 'day' || shiftType === 'noc') && calculatedHours !== 12) {
          return 12.0; // Override incorrect template times
        }
      }
      
      return calculatedHours;
    } catch (e) {
      // Default based on facility format: 12 hours for 2-shift, 8 hours for 3-shift
      return facility?.shift_format === '2_shift' ? 12 : 8;
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    refreshData: fetchData,
    applyAIRecommendations: handleApplyAIRecommendations
  }));

  useEffect(() => {
    if (facilityId) {
      fetchData();
    }
  }, [facilityId, currentWeek, refreshTrigger]);

  useEffect(() => {
    if (selectedWeek) {
      const newWeek = new Date(selectedWeek);
      setCurrentWeek(newWeek);
    }
  }, [selectedWeek]);

  const fetchData = async () => {
    if (!facilityId) {
      console.log('🔍 WeeklyPlanner: No facilityId provided, skipping fetch');
      return;
    }

    // Save scroll position before fetching
    const scrollY = window.scrollY;
    
    console.log('🔍 WeeklyPlanner: fetchData called with facilityId:', facilityId);
    setLoading(true);
    try {
    const token = localStorage.getItem('authToken');
    console.log('🔍 WeeklyPlanner: Token check:', token ? 'Token present' : 'No token found');
    if (!token) {
      console.warn('⚠️ No authentication token found');
      setSnackbar({ 
        open: true, 
        message: 'Authentication required - please log in', 
        severity: 'warning' 
      });
        return;
      }

      const weekStart = getWeekStart();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      console.log('🔍 WeeklyPlanner: Fetching data for week:', weekStart);
      console.log('🔍 WeeklyPlanner: API calls:', [
        `${API_BASE_URL}/api/facilities/${facilityId}/`,
        `${API_BASE_URL}/api/scheduling/shifts/?facility=${facilityId}&week_start=${weekStart}`,
        `${API_BASE_URL}/api/scheduling/staff/?facility=${facilityId}`,
        `${API_BASE_URL}/api/scheduling/assignments/?facility=${facilityId}&week_start=${weekStart}`
      ]);

      console.log('🔍 WeeklyPlanner: Making API calls with token:', token ? `${token.substring(0, 20)}...` : 'No token');
      
      const [facilityResponse, shiftsResponse, staffResponse, assignmentsResponse] = await Promise.all([
        api.get(`/api/facilities/${facilityId}/`),
        api.get(`/api/scheduling/shifts/?facility=${facilityId}&week_start=${weekStart}`),
        api.get(`/api/scheduling/staff/?facility=${facilityId}`),
        api.get(`/api/scheduling/assignments/?facility=${facilityId}&week_start=${weekStart}`)
      ]);

      console.log('🔍 WeeklyPlanner: API responses:');
      console.log('  - Facility:', facilityResponse.data);
      console.log('  - Shifts:', shiftsResponse.data);
      console.log('  - Staff:', staffResponse.data);
      console.log('  - Assignments:', assignmentsResponse.data);

      const facilityData = facilityResponse.data;
      const shiftsData = shiftsResponse.data.results || [];
      const staffData = staffResponse.data.results || staffResponse.data || [];
      const assignmentsData = assignmentsResponse.data.results || [];

      console.log('🔍 WeeklyPlanner: Processed data:');
      console.log('  - Facility shift format:', facilityData?.shift_format);
      console.log('  - Shifts count:', shiftsData.length);
      console.log('  - Staff count:', staffData.length);
      console.log('  - Assignments count:', assignmentsData.length);

      setFacility(facilityData);
      setShifts(shiftsData);
      setStaff(staffData);
      
      // Normalize assignments data structure
      const normalizedAssignments = assignmentsData.map(assignment => {
        const normalized = { ...assignment };
        
        // Normalize shift field
        if (assignment.shift_id && !assignment.shift) {
          normalized.shift = assignment.shift_id;
        } else if (assignment.shift) {
          normalized.shift = assignment.shift;
        }
        
        // Normalize staff field
        if (assignment.staff_id && !assignment.staff) {
          normalized.staff = assignment.staff_id;
        } else if (assignment.staff) {
          normalized.staff = assignment.staff;
        }
        
        console.log('🔍 Normalized assignment:', normalized);
        return normalized;
      });
      
      setAssignments(normalizedAssignments);
      console.log('🔍 WeeklyPlanner: Data set successfully');
    } catch (error) {
      console.error('🔍 WeeklyPlanner: Error fetching data:', error);
      console.error('🔍 WeeklyPlanner: Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        facilityId,
        weekStart: getWeekStart()
      });
      setSnackbar({ 
        open: true, 
        message: `Error loading data: ${error.response?.data?.detail || error.message}`, 
        severity: 'error' 
      });
    } finally {
      setLoading(false);
      
      // Restore scroll position after data loads (use setTimeout to ensure DOM is updated)
      if (scrollY !== undefined && scrollY > 0) {
        setTimeout(() => {
          window.scrollTo({ top: scrollY, behavior: 'auto' });
        }, 50);
      }
    }
  };

  // Helper function to parse date string (YYYY-MM-DD) without timezone conversion
  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed, creates local date
  };

  // Helper function to format date as YYYY-MM-DD string
  const formatDateString = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekStart = () => {
    // Use the selected week from context, or default to current week
    if (selectedWeek) {
      return selectedWeek;
    }
    // Fallback to current week if no selectedWeek
    const today = new Date();
    const monday = new Date(today);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    monday.setDate(diff);
    return formatDateString(monday);
  };

  const getWeekDays = () => {
    // Parse week start date string (YYYY-MM-DD) without timezone conversion
    const weekStartStr = getWeekStart();
    const startDate = parseDateString(weekStartStr);
    
    if (!startDate) return [];
    
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      return date;
    });
    
    // Debug logging
    console.log('🔍 getWeekDays: weekStartStr=', weekStartStr, 'days=', weekDays.map(d => formatDateString(d)));
    
    return weekDays;
  };

  const handleClearAssignments = async () => {
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Get shift IDs for the week
    const weekShiftIds = shifts
      .filter(shift => {
        const shiftDate = new Date(shift.date);
        return shiftDate >= new Date(weekStart) && shiftDate <= weekEnd;
      })
      .map(shift => shift.id);
    
    // Filter assignments for the week - handle both object and ID shift formats
    const weekAssignments = assignments.filter(assignment => {
      const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      return shiftId && weekShiftIds.includes(shiftId);
    });
    
    if (weekAssignments.length === 0) {
      setSnackbar({ 
        open: true, 
        message: 'No assignments to clear for this week', 
        severity: 'info' 
      });
      return;
    }
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const assignment of weekAssignments) {
      try {
        const assignmentId = assignment.id;
        if (!assignmentId) {
          console.error('Assignment missing ID:', assignment);
          errorCount++;
          continue;
        }
        await api.delete(`/api/scheduling/assignments/${assignmentId}/`);
        deletedCount++;
      } catch (error) {
        console.error('Error removing assignment:', error);
        errorCount++;
      }
    }
    
    if (errorCount > 0) {
      setSnackbar({ 
        open: true, 
        message: `Cleared ${deletedCount} assignments. ${errorCount} failed.`, 
        severity: 'warning' 
      });
    } else {
      setSnackbar({ 
        open: true, 
        message: `Schedule cleared successfully! Removed ${deletedCount} assignments.`, 
        severity: 'success' 
      });
    }
    fetchData();
  };

  const handleClearAllShifts = async () => {
    const weekStart = getWeekStart();
    
    try {
      const response = await api.post(`/api/scheduling/shifts/clear_shifts/`, {
        week_start: weekStart,
        facility: facilityId
      });
      
      setSnackbar({ 
        open: true, 
        message: response.data.message, 
        severity: 'success' 
      });
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

  // Drag and Drop Handlers
  const handleDragStart = (e, staffMember) => {
    console.log('🔍 Drag started for staff:', staffMember);
    setDraggedStaff(staffMember);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', staffMember.id);
  };

  const handleDragEnd = () => {
    console.log('🔍 Drag ended');
    
    // If drag ended without a successful drop and we had a dragged staff member,
    // it might mean they tried to drop on an invalid location (like a full shift)
    // The error will be shown by handleDrop if the drop was attempted
    setDraggedStaff(null);
    setDragOverShift(null);
  };

  const handleDragOver = (e, shift) => {
    e.preventDefault();
    
    // Check if shift is already full
    const currentAssignments = assignments.filter(a => {
      const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
      if (assignmentShiftId !== shift.id) return false;
      const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
      const staffMember = staff.find(s => s.id === assignmentStaffId);
      return staffMember && staffMember.status === 'active';
    });
    
    if (currentAssignments.length >= shift.required_staff_count) {
      // Shift is full - allow drop but don't highlight (error will show in handleDrop)
      e.dataTransfer.dropEffect = 'move';
      setDragOverShift(null);
      return;
    }
    
    // Shift has space - allow drop and highlight
    e.dataTransfer.dropEffect = 'move';
    setDragOverShift(shift.id);
  };

  const handleDragLeave = () => {
    setDragOverShift(null);
  };

  const handleDrop = async (e, shift) => {
    e.preventDefault();
    console.log('🔍 Drop on shift:', shift);
    console.log('🔍 Dragged staff:', draggedStaff);
    console.log('🔍 Current assignments count:', assignments.length);
    console.log('🔍 Current validation alerts count:', validationAlerts.length);
    
    if (!draggedStaff || !shift) {
      console.log('🔍 No dragged staff or shift');
      setSnackbar({ 
        open: true, 
        message: 'No staff member selected to assign',
        severity: 'warning'
      });
      return;
    }

    // Check if staff role matches shift role requirement
    // Allow med_tech staff to work caregiver shifts (MedTech/Caregiver dual-role)
    const canAssign = draggedStaff.role === shift.required_staff_role || 
                     (shift.required_staff_role === 'caregiver' && draggedStaff.role === 'med_tech');
    
    if (!canAssign) {
      setSnackbar({ 
        open: true, 
        message: `Cannot assign ${draggedStaff.role.replace('_', ' ')} to ${shift.required_staff_role.replace('_', ' ')} shift`,
        severity: 'error'
      });
      return;
    }

    // Check if shift is already filled (only count active staff)
    const currentAssignments = assignments.filter(a => {
      const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
      if (assignmentShiftId !== shift.id) return false;
      const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
      const staffMember = staff.find(s => s.id === assignmentStaffId);
      return staffMember && staffMember.status === 'active';
    });
    
    console.log('🔍 Current assignments for shift:', currentAssignments.length, 'Required:', shift.required_staff_count);
    
    if (currentAssignments.length >= shift.required_staff_count) {
      const errorMessage = `❌ Shift is FULL! (${currentAssignments.length}/${shift.required_staff_count} assigned). Cannot assign ${draggedStaff.first_name} ${draggedStaff.last_name} to this shift.`;
      console.log('🔍', errorMessage);
      setSnackbar({ 
        open: true, 
        message: errorMessage,
        severity: 'error'
      });
      return;
    }

    // Check if staff member is already assigned to this shift
    const existingAssignment = assignments.find(a => {
      const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
      const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
      return assignmentShiftId === shift.id && assignmentStaffId === draggedStaff.id;
    });
    if (existingAssignment) {
      setSnackbar({ 
        open: true, 
        message: 'Staff member is already assigned to this shift',
        severity: 'warning'
      });
      return;
    }
    
    // Check if staff member has reached max hours - filter by current week
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const staffAssignments = assignments.filter(a => {
      const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
      if (assignmentStaffId !== draggedStaff.id) return false;
      
      // Filter by current week
      const shiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift || !shift.date) return false;
      
      const shiftDate = new Date(shift.date);
      return shiftDate >= new Date(weekStart) && shiftDate <= weekEnd;
    });
    
    // Calculate actual hours from shift templates (using shared helper)
    const hoursUsed = staffAssignments.reduce((total, assignment) => {
      const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      const shift = shifts.find(s => s.id === shiftId);
      if (shift && shift.shift_template) {
        const hours = getShiftHours(shift);
        console.log(`🔍 Assignment hours for ${draggedStaff.full_name}:`, {
          shiftId,
          shiftDate: shift.date,
          shiftType: shift.shift_template.shift_type,
          startTime: shift.shift_template.start_time,
          endTime: shift.shift_template.end_time,
          duration: shift.shift_template.duration,
          hours
        });
        return total + hours;
      }
      return total;
    }, 0);
    
    console.log('🔍 Total hours used for', draggedStaff.full_name, ':', hoursUsed, 'from', staffAssignments.length, 'assignments');
    console.log('🔍 All assignments for debugging:', assignments);
    console.log('🔍 Staff assignments details:', staffAssignments);
    
    // Calculate hours for the shift being assigned (using shared helper)
    const targetShift = shifts.find(s => s.id === shift.id);
    const targetShiftHours = targetShift ? getShiftHours(targetShift) : (facility?.shift_format === '2_shift' ? 12 : 8);
    
    // Check if this staff member has any existing alerts
    console.log('🔍 All validation alerts:', validationAlerts);
    console.log('🔍 Looking for alerts for staff ID:', draggedStaff.id);
    
    const staffAlerts = validationAlerts.filter(alert => {
      console.log('🔍 Checking alert:', alert);
      if (alert.staff && alert.staff.id === draggedStaff.id) {
        console.log('🔍 Found alert for this staff member:', alert);
        return true;
      }
      return false;
    });
    
    console.log('🔍 Staff alerts found:', staffAlerts);
    
    // Also check if adding this shift would create new conflicts
    const wouldExceedWeeklyHours = hoursUsed + targetShiftHours > draggedStaff.max_hours;
    const shiftDate = new Date(shift.date);
    const dateKey = shiftDate.toISOString().split('T')[0];
    
    // Check if staff already has assignments on this day
    const existingAssignments = assignments.filter(assignment => {
      const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
      const assignmentShiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      const shift = shifts.find(s => s.id === assignmentShiftId);
      
      if (assignmentStaffId !== draggedStaff.id || !shift) return false;
      
      const assignmentDate = new Date(shift.date);
      const assignmentDateKey = assignmentDate.toISOString().split('T')[0];
      return assignmentDateKey === dateKey;
    });
    
    const wouldCreateDailyConflict = existingAssignments.length > 0;
    
    // Build conflicts array
    const conflicts = [];
    
    // Add existing alerts for this staff member
    staffAlerts.forEach(alert => {
      conflicts.push(alert.message);
    });
    
    // Add new conflicts that would be created
    if (wouldExceedWeeklyHours) {
      conflicts.push(`Would exceed weekly hours (${hoursUsed.toFixed(1)} + ${targetShiftHours} = ${(hoursUsed + targetShiftHours).toFixed(1)} > ${draggedStaff.max_hours})`);
    }
    
    if (wouldCreateDailyConflict) {
      conflicts.push(`Already assigned to another shift on ${shiftDate.toLocaleDateString()}`);
    }
    
    // If there are any conflicts, show confirmation dialog
    if (conflicts.length > 0) {
      const title = "Assignment Conflicts Warning";
      const message = `${draggedStaff.full_name} has the following conflicts:\n\n• ${conflicts.join('\n• ')}\n\nAre you sure you want to proceed with this assignment despite these conflicts?`;
      
      handleConfirmationDialog(title, message, 
        () => {
          // On confirm, proceed with assignment
          makeDragDropAssignment(shift, draggedStaff);
        },
        () => {
          // On cancel, clear dragged staff
          setDraggedStaff(null);
          setDragOverShift(null);
        }
      );
      return;
    }
      
    // No conflict, proceed with assignment
    makeDragDropAssignment(shift, draggedStaff);
  };

  const makeDragDropAssignment = async (shift, staffMember) => {
    setIsAssigning(true);
    try {
      const response = await api.post(`/api/scheduling/assignments/`, {
        shift_id: shift.id,
        staff_id: staffMember.id,
        status: 'assigned'
      });

      console.log('🔍 Assignment created:', response.data);
        setSnackbar({ 
          open: true, 
        message: `Successfully assigned ${staffMember.first_name} ${staffMember.last_name} to shift`,
          severity: 'success' 
        });

      fetchData(); // Refresh data to show new assignment
    } catch (error) {
      console.error('🔍 Error creating assignment:', error);
      setSnackbar({ 
        open: true, 
        message: 'Failed to assign staff member to shift',
        severity: 'error' 
      });
    } finally {
      setIsAssigning(false);
      setDraggedStaff(null);
      setDragOverShift(null);
    }
  };

  // Unassign staff from shift
  const handleUnassignStaff = async (shiftId, staffId) => {
    try {
      console.log('🔍 Unassigning staff:', { shiftId, staffId });
      console.log('🔍 Total assignments:', assignments.length);
      
      // Find the assignment to delete
      const assignment = assignments.find(a => {
        const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
        const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
        const match = assignmentShiftId === shiftId && assignmentStaffId === staffId;
        if (match) {
          console.log('🔍 Found matching assignment:', a);
        }
        return match;
      });

      if (!assignment) {
        console.error('🔍 Assignment not found for shiftId:', shiftId, 'staffId:', staffId);
        console.log('🔍 Available assignments:', assignments.map(a => ({
          shiftId: typeof a.shift === 'object' ? a.shift?.id : a.shift,
          staffId: typeof a.staff === 'object' ? a.staff?.id : a.staff
        })));
        setSnackbar({ 
          open: true, 
          message: 'Assignment not found',
          severity: 'error'
        });
        return;
      }
    
      console.log('🔍 Deleting assignment:', assignment.id);
      console.log('🔍 Auth token exists:', !!localStorage.getItem('authToken'));
      
      // Mark as removing for slide-out animation
      const assignmentKey = `${shiftId}-${staffId}`;
      setRemovingAssignments(prev => new Set([...prev, assignmentKey]));
      
      // Delete the assignment after animation starts
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('🔍 No auth token found!');
        setSnackbar({
          open: true,
          message: 'Authentication required. Please log in again.',
          severity: 'error'
        });
        setRemovingAssignments(prev => {
          const next = new Set(prev);
          next.delete(assignmentKey);
          return next;
        });
        return;
      }
      
      console.log('🔍 Sending DELETE request with token:', token.substring(0, 20) + '...');
      
      // Wait for animation to complete before actually deleting
      setTimeout(async () => {
        try {
          await api.delete(`/api/scheduling/assignments/${assignment.id}/`);
      console.log('🔍 Assignment deleted successfully');
          
          // Remove from removing set
          setRemovingAssignments(prev => {
            const next = new Set(prev);
            next.delete(assignmentKey);
            return next;
          });
          
      setSnackbar({ 
        open: true, 
        message: 'Staff member unassigned successfully',
        severity: 'success'
      });
      
      // Refresh data to show updated assignments
      fetchData();
        } catch (error) {
          // If delete fails, remove from removing set
          setRemovingAssignments(prev => {
            const next = new Set(prev);
            next.delete(assignmentKey);
            return next;
          });
          throw error;
        }
      }, 300); // Wait for slide-out animation
    } catch (error) {
      console.error('🔍 Error unassigning staff:', error);
      console.error('🔍 Error details:', error.response?.data);
      setSnackbar({
        open: true,
        message: `Failed to unassign staff member: ${error.response?.data?.detail || error.message}`,
        severity: 'error'
      });
    }
  };

  const handleCloseShiftModal = () => {
    setShiftModalOpen(false);
    setSelectedShift(null);
  };

  const handleShiftClick = (shift) => {
    setSelectedShiftForReassign(shift);
    setReassignModalOpen(true);
    // Initialize with empty values for each required staff position
    const initialAssignments = new Array(shift.required_staff_count).fill('');
    setSelectedStaffForReassign(initialAssignments);
  };

  const handleCloseReassignModal = () => {
    setReassignModalOpen(false);
    setSelectedShiftForReassign(null);
    setSelectedStaffForReassign([]);
  };

  const handleReassignSubmit = async () => {
    if (!selectedShiftForReassign) {
      setSnackbar({ open: true, message: 'No shift selected', severity: 'warning' });
      return;
    }

    // Filter out empty assignments (staff that are not selected)
    const assignmentsToMake = selectedStaffForReassign.filter(staffId => staffId !== '');
    
    if (assignmentsToMake.length === 0) {
      // No assignments to make - just close the modal
      handleCloseReassignModal();
      return;
    }

    try {
      // Check for duplicate staff assignments within the same request
      const uniqueAssignments = [...new Set(assignmentsToMake)];
      if (uniqueAssignments.length !== assignmentsToMake.length) {
        setSnackbar({ 
          open: true, 
          message: 'Cannot assign the same staff member to multiple positions in the same shift', 
          severity: 'error' 
        });
        return;
      }

      // Check if any of the selected staff are already assigned to this shift
      const currentAssignments = assignments.filter(a => {
        const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
        if (assignmentShiftId !== selectedShiftForReassign.id) return false;
        const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
        const staffMember = staff.find(s => s.id === assignmentStaffId);
        return staffMember && staffMember.status === 'active';
      });

      const currentStaffIds = currentAssignments.map(a => {
        const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
        return assignmentStaffId;
      });

      // Check for conflicts
      const conflictingStaff = assignmentsToMake.filter(staffId => currentStaffIds.includes(staffId));
      if (conflictingStaff.length > 0) {
        const conflictingStaffNames = conflictingStaff.map(id => {
          const staffMember = staff.find(s => s.id === id);
          return staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Unknown';
        }).join(', ');
        setSnackbar({ 
          open: true, 
          message: `The following staff members are already assigned: ${conflictingStaffNames}`, 
          severity: 'warning' 
        });
        return;
      }

      // Check if adding these assignments would exceed the required count
      const totalAfterAssignment = currentAssignments.length + assignmentsToMake.length;
      if (totalAfterAssignment > selectedShiftForReassign.required_staff_count) {
        setSnackbar({ 
          open: true, 
          message: `Cannot assign ${assignmentsToMake.length} more staff. Shift requires ${selectedShiftForReassign.required_staff_count} total, and ${currentAssignments.length} are already assigned.`, 
          severity: 'error' 
        });
        return;
      }

      // Check for both weekly hours and daily conflicts before making assignments
      console.log('🔍 Checking for conflicts for assignments:', assignmentsToMake);
      
      const allConflicts = [];
      
      // Check each staff member for conflicts
      assignmentsToMake.forEach(staffId => {
        const staffMember = staff.find(s => s.id === staffId);
        if (!staffMember) return;
        
        const staffConflicts = [];
        
        // Check weekly hours conflict - filter by current week
        const weekStart = getWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const staffAssignments = assignments.filter(assignment => {
          const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
          if (assignmentStaffId !== staffId) return false;
          
          // Filter by current week
          const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
          const shift = shifts.find(s => s.id === shiftId);
          if (!shift || !shift.date) return false;
          
          const shiftDate = new Date(shift.date);
          return shiftDate >= new Date(weekStart) && shiftDate <= weekEnd;
        });

        const hoursUsed = staffAssignments.reduce((total, assignment) => {
          const assignmentShiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
          const shift = shifts.find(s => s.id === assignmentShiftId);
          if (shift && shift.shift_template) {
            return total + getShiftHours(shift);
          }
          return total;
        }, 0);

        // Calculate hours for the new shift (using shared helper)
        const newShiftHours = getShiftHours(selectedShiftForReassign);

        console.log('🔍 Reassign conflict check for', staffMember.full_name, {
          hoursUsed,
          newShiftHours,
          totalHours: hoursUsed + newShiftHours,
          maxHours: staffMember.max_hours,
          wouldExceed: hoursUsed + newShiftHours >= staffMember.max_hours
        });

        if (hoursUsed + newShiftHours >= staffMember.max_hours) {
          staffConflicts.push(`Would exceed weekly hours (${hoursUsed.toFixed(1)} + ${newShiftHours} = ${(hoursUsed + newShiftHours).toFixed(1)} > ${staffMember.max_hours})`);
        }

        // Check daily conflict
        const hasDailyConflict = checkDailyHoursConflict(staffId, selectedShiftForReassign.id, null, null);
        if (hasDailyConflict) {
          const shiftDate = new Date(selectedShiftForReassign.date);
          staffConflicts.push(`Already assigned to another shift on ${shiftDate.toLocaleDateString()}`);
        }

        if (staffConflicts.length > 0) {
          allConflicts.push({
            staffName: staffMember.full_name,
            conflicts: staffConflicts
          });
        }
      });

      // If there are any conflicts, show combined confirmation dialog
      if (allConflicts.length > 0) {
        console.log('⚠️ Showing confirmation dialog for all conflicts:', allConflicts);
        
        const title = "Assignment Conflicts Warning";
        const message = `The following staff members have conflicts:\n\n${allConflicts.map(staff => 
          `${staff.staffName}:\n• ${staff.conflicts.join('\n• ')}`
        ).join('\n\n')}\n\nAre you sure you want to proceed with these assignments despite these conflicts?`;
        
        handleConfirmationDialog(title, message, 
          () => {
            // On confirm, proceed with all assignments
            console.log('✅ User confirmed all conflicts, proceeding with assignments');
            makeAssignment(assignmentsToMake);
          },
          () => {
            // On cancel, close modal
            console.log('❌ User cancelled all conflicts, closing modal');
            handleCloseReassignModal();
          }
        );
        return;
      }

      // No conflicts, proceed with assignments
      makeAssignment(assignmentsToMake);
    } catch (error) {
      console.error('❌ Error assigning staff:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Failed to assign staff';
      if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  // Helper function to make assignments
  const makeAssignment = async (staffIds) => {
    try {
      // Make all assignments
      const assignmentPromises = (Array.isArray(staffIds) ? staffIds : [staffIds]).map(staffId => 
        api.post(`/api/scheduling/assignments/`, {
          shift_id: selectedShiftForReassign.id,
          staff_id: staffId
        })
      );

      const responses = await Promise.all(assignmentPromises);
      console.log('✅ Assignment responses:', responses);

      const successCount = responses.filter(r => r.status === 201).length;
      const staffNames = (Array.isArray(staffIds) ? staffIds : [staffIds]).map(id => 
        staff.find(s => s.id === id)?.full_name || 'Unknown'
      ).join(', ');
      
      setSnackbar({ 
        open: true, 
        message: `Successfully assigned ${staffNames}!`, 
        severity: 'success' 
      });
      
      fetchData(); // Refresh data
      handleCloseReassignModal();
    } catch (error) {
      console.error('❌ Error making assignment:', error);
      setSnackbar({ 
        open: true, 
        message: 'Failed to make assignment', 
        severity: 'error' 
      });
    }
  };

  const handleApplyAIRecommendations = async () => {
    if (!facilityId) {
      console.log('🔍 WeeklyPlanner: No facilityId for AI recommendations');
      setSnackbar({ open: true, message: 'Please select a facility first', severity: 'warning' });
      return;
    }
    
    console.log('🔍 WeeklyPlanner: handleApplyAIRecommendations called with facilityId:', facilityId);
    setApplying(true);
    try {
      const weekStart = getWeekStart();
      console.log('🔍 WeeklyPlanner: Getting AI recommendations for week:', weekStart);
      
      const recommendationsUrl = `/api/scheduling/ai-recommendations/calculate_from_adl/?facility=${facilityId}&week_start=${weekStart}`;
      console.log('🔍 WeeklyPlanner: Recommendations URL:', recommendationsUrl);
      
      const recommendationsResponse = await api.get(recommendationsUrl);
      console.log('🔍 WeeklyPlanner: Recommendations response:', recommendationsResponse.data);
      
      if (!recommendationsResponse.data.recommendations || recommendationsResponse.data.recommendations.length === 0) {
        console.log('🔍 WeeklyPlanner: No recommendations found');
      setSnackbar({ 
        open: true, 
          message: recommendationsResponse.data.message || 'No AI recommendations available for this week. Please ensure ADL data exists.', 
          severity: 'warning' 
      });
      return;
    }
    
      console.log('🔍 WeeklyPlanner: Applying recommendations...');
      
      // Prepare recommendations with suggested_staff for backend (same as AIRecommendations component)
      const recommendationsWithStaff = recommendationsResponse.data.recommendations.map(rec => {
        const staffList = rec.suggested_staff || [];
        console.log('🔍 WeeklyPlanner: Recommendation for', rec.date, rec.shift_type, 'has', staffList.length, 'suggested staff');
        return {
          date: rec.date,
          shift_type: rec.shift_type,
          care_hours: rec.care_hours, // Include care_hours from the recommendation
          required_staff: rec.required_staff, // Include required_staff from the recommendation
          suggested_staff: staffList
        };
      });
      
      console.log('🔍 WeeklyPlanner: Sending', recommendationsWithStaff.length, 'recommendations with suggested_staff to backend');
      
      const applyResponse = await api.post(`/api/scheduling/ai-recommendations/apply_weekly_recommendations/`, {
        facility: facilityId,
        week_start: weekStart,
        recommendations: recommendationsWithStaff
      });
      
      console.log('🔍 WeeklyPlanner: Apply response:', applyResponse.data);
      
      // Get the created shift IDs for scrolling and highlighting
      const createdShiftIds = new Set();
      if (applyResponse.data.shifts_created > 0) {
        // Fetch the updated shifts to get their IDs
        try {
          const updatedShifts = await api.get(`/api/scheduling/shifts/?facility=${facilityId}&week_start=${weekStart}`);
          if (updatedShifts.data && updatedShifts.data.results) {
            updatedShifts.data.results.forEach(shift => {
              createdShiftIds.add(shift.id);
            });
          }
        } catch (err) {
          console.log('🔍 Could not fetch updated shifts for scrolling:', err);
        }
        
        setAutofilledShiftIds(createdShiftIds);
        
        // Clear after animation
        setTimeout(() => {
          setAutofilledShiftIds(new Set());
        }, 1000);
        
        // Smooth scroll to first autofilled shift
        setTimeout(() => {
          if (createdShiftIds.size > 0) {
            const firstShiftId = Array.from(createdShiftIds)[0];
            const shiftElement = document.getElementById(`shift-${firstShiftId}`);
            if (shiftElement) {
              shiftElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'center'
              });
            }
          }
        }, 100);
      }
      
      const assignmentsMsg = applyResponse.data.assignments_created 
        ? ` Assigned ${applyResponse.data.assignments_created} staff members.`
        : '';
      const shiftsMsg = applyResponse.data.shifts_updated > 0
        ? ` Created ${applyResponse.data.shifts_created} new shifts and updated ${applyResponse.data.shifts_updated} existing shifts.`
        : ` Created ${applyResponse.data.shifts_created} new shifts.`;
      
      // Check if any assignments were skipped due to hour limits
      const skippedCount = applyResponse.data.assignments_skipped || 0;
      let message = `Successfully applied AI recommendations!${shiftsMsg}${assignmentsMsg}`;
      let severity = 'success';
      
      if (skippedCount > 0) {
        message += ` ⚠️ ${skippedCount} assignment(s) were skipped because they would exceed the 40-hour weekly limit. Please refresh recommendations to get valid assignments.`;
        severity = 'warning';
      }
      
      setSnackbar({ 
        open: true, 
        message: message, 
        severity: severity
      });
      fetchData();
    } catch (error) {
      console.error('🔍 WeeklyPlanner: Error applying AI recommendations:', error);
      console.error('🔍 WeeklyPlanner: Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        facilityId,
        weekStart: getWeekStart()
      });
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || error.response?.data?.detail || 'Failed to apply AI recommendations. Please try again.', 
        severity: 'error' 
      });
    } finally {
      setApplying(false);
    }
  };

  const getStaffStatus = (staffMember) => {
    // Filter assignments to only include current week
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const staffAssignments = assignments.filter(assignment => {
      const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
      if (assignmentStaffId !== staffMember.id) return false;
      
      // Filter by current week
      const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift || !shift.date) return false;
      
      const shiftDate = new Date(shift.date);
      return shiftDate >= new Date(weekStart) && shiftDate <= weekEnd;
    });
    
    // Calculate actual hours from shift templates (using shared helper)
    const hoursUsed = staffAssignments.reduce((total, assignment) => {
      const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      const shift = shifts.find(s => s.id === shiftId);
      if (shift && shift.shift_template) {
        return total + getShiftHours(shift);
      }
      return total;
    }, 0);
    
    const maxHours = staffMember.max_hours;
    
    if (hoursUsed >= maxHours) return 'over_max';
    if (hoursUsed >= maxHours * 0.8) return 'near_max';
    return 'available';
  };

  const getAssignmentsForStaff = (staffId, filterByWeek = false) => {
    const weekStartStr = getWeekStart();
    const weekStart = new Date(weekStartStr);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const staffAssignments = assignments.filter(assignment => {
      const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
      if (assignmentStaffId !== staffId) return false;
      
      // If filtering by week, check if the assignment's shift is within the current week
      if (filterByWeek) {
        const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift || !shift.date) return false;
        
        // Normalize shift date to start of day for accurate comparison
        const shiftDate = new Date(shift.date);
        shiftDate.setHours(0, 0, 0, 0);
        return shiftDate >= weekStart && shiftDate <= weekEnd;
      }
      
      return true;
    });
    return staffAssignments;
  };

  const getAssignmentsForShift = (shiftId) => {
    const shiftAssignments = assignments.filter(assignment => {
      const assignmentShiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      return assignmentShiftId === shiftId;
    });
    return shiftAssignments;
  };

  const filteredStaff = staff.filter(member => {
    // Only show active staff (not inactive, terminated, or on_leave)
    const isActive = member.status === 'active';
    const matchesSearch = member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.last_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const showOnLeave = !hideOnLeave || member.status !== 'on_leave';
    
    // Quick filter logic
    let matchesQuickFilter = true;
    if (quickFilter !== 'all') {
      const staffAssignments = getAssignmentsForStaff(member.id, true);
      let hoursUsed = 0;
      for (const assignment of staffAssignments) {
        const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
        const shift = shifts.find(s => s.id === shiftId);
        if (shift && shift.shift_template) {
          let hours = parseFloat(shift.shift_template.duration) || 0;
          if (!hours || hours === 0) {
            const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
            const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
            hours = (endTime - startTime) / (1000 * 60 * 60);
            if (hours < 0) hours += 24;
          }
          hoursUsed += hours;
        }
      }
      const maxHours = member.max_hours || 40;
      
      switch (quickFilter) {
        case 'available':
          matchesQuickFilter = hoursUsed < maxHours * 0.8; // Under 80% of max
          break;
        case 'under_hours':
          matchesQuickFilter = hoursUsed < maxHours;
          break;
        case 'at_limit':
          matchesQuickFilter = hoursUsed >= maxHours && hoursUsed <= maxHours;
          break;
        case 'over_limit':
          matchesQuickFilter = hoursUsed > maxHours;
          break;
        case 'med_tech':
          matchesQuickFilter = member.role === 'med_tech';
          break;
        case 'caregiver':
          matchesQuickFilter = member.role === 'caregiver' || member.role === 'cna';
          break;
        default:
          matchesQuickFilter = true;
      }
    }
    
    return isActive && matchesSearch && matchesRole && showOnLeave && matchesQuickFilter;
  });

  const handleExportCSV = () => {
    try {
      const weekStart = getWeekStart();
      const weekDays = getWeekDays();
      
      // Build CSV data
      const csvRows = [];
      csvRows.push(['Date', 'Shift Type', 'Start Time', 'End Time', 'Role', 'Required Staff', 'Assigned Staff', 'Staff Name', 'Staff Role']);
      
      // Group shifts by date and shift type
      weekDays.forEach(day => {
        // Format day as YYYY-MM-DD for comparison (avoid timezone issues)
        const dayStr = formatDateString(day);
        const dayShifts = shifts.filter(shift => {
          // Compare date strings directly to avoid timezone conversion issues
          const shiftDateStr = shift.date ? (shift.date.split('T')[0] || shift.date) : null;
          return shiftDateStr === dayStr;
        });
        
        if (dayShifts.length === 0) {
          // Add empty row for days with no shifts
          csvRows.push([
            day.toLocaleDateString(),
            '', '', '', '', '', '', '', ''
          ]);
        } else {
          dayShifts.forEach(shift => {
            const shiftAssignments = getAssignmentsForShift(shift.id);
            const shiftType = shift.shift_template?.shift_type || shift.shift_type || 'Unknown';
            const startTime = shift.shift_template?.start_time || shift.start_time || '';
            const endTime = shift.shift_template?.end_time || shift.end_time || '';
            const role = shift.required_staff_role || 'N/A';
            const required = shift.required_staff_count || 0;
            
            if (shiftAssignments.length === 0) {
              // Shift with no assignments
              csvRows.push([
                day.toLocaleDateString(),
                shiftType.toUpperCase(),
                startTime,
                endTime,
                role,
                required,
                0,
                '',
                ''
              ]);
            } else {
              // One row per assignment
              shiftAssignments.forEach(assignment => {
                const staffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
                const staffMember = staff.find(s => s.id === staffId);
                const staffName = staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Unknown';
                const staffRole = staffMember?.role || 'N/A';
                
                csvRows.push([
                  day.toLocaleDateString(),
                  shiftType.toUpperCase(),
                  startTime,
                  endTime,
                  role,
                  required,
                  shiftAssignments.length,
                  staffName,
                  staffRole
                ]);
              });
            }
          });
        }
      });
      
      // Convert to CSV string
      const csvContent = csvRows.map(row => 
        row.map(cell => {
          // Escape cells that contain commas or quotes
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      ).join('\n');
      
      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `schedule_${weekStart}_${facilityId}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSnackbar({ 
        open: true, 
        message: 'CSV export completed successfully', 
        severity: 'success' 
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setSnackbar({ 
        open: true, 
        message: `Error exporting CSV: ${error.message}`, 
        severity: 'error' 
      });
    }
  };

  const handlePrint = () => {
    try {
      const weekStart = getWeekStart();
      const weekDays = getWeekDays();
      const weekLabel = getWeekLabel(selectedWeek || weekStart);
      
      // Get facility name from the facility state
      const facilityName = facility?.name || `Facility ID: ${facilityId}`;
      
      // Create a print-friendly HTML content
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Weekly Schedule - ${weekLabel}</title>
            <style>
              @page {
                size: landscape;
                margin: 0.5in;
              }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                color: #000;
              }
              .print-header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 3px solid #000;
                padding-bottom: 10px;
              }
              .print-header h1 {
                margin: 0 0 5px 0;
                font-size: 24px;
                font-weight: bold;
              }
              .print-header h2 {
                margin: 0;
                font-size: 18px;
                font-weight: normal;
              }
              .print-header .facility-info {
                margin-top: 5px;
                font-size: 14px;
                color: #666;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                page-break-inside: avoid;
              }
              th, td {
                border: 2px solid #000;
                padding: 8px;
                text-align: left;
                font-size: 12px;
              }
              th {
                background-color: #f0f0f0;
                font-weight: bold;
                text-align: center;
              }
              .shift-type {
                font-weight: bold;
                text-align: center;
                width: 100px;
              }
              .shift-type.day {
                background-color: #eff6ff;
                color: #3b82f6;
                border-left: 4px solid #3b82f6;
              }
              .shift-type.noc {
                background-color: #f3e8ff;
                color: #8b5cf6;
                border-left: 4px solid #8b5cf6;
              }
              .shift-type.swing {
                background-color: #fffbeb;
                color: #f59e0b;
                border-left: 4px solid #f59e0b;
              }
              .day-header {
                text-align: center;
                font-weight: bold;
              }
              .day-header.weekday {
                background-color: #f8fafc;
              }
              .day-header.sunday {
                background-color: #fefce8;
              }
              .day-header.saturday {
                background-color: #fef9e7;
              }
              /* Cell backgrounds matching planner grid */
              td.shift-day {
                background-color: #eff6ff;
              }
              td.shift-noc {
                background-color: #f3e8ff;
              }
              td.shift-swing {
                background-color: #fffbeb;
              }
              .staff-name {
                margin: 2px 0;
                padding: 2px 0;
                border-bottom: 1px solid #ddd;
              }
              .role-label {
                font-weight: bold;
                margin-top: 5px;
                margin-bottom: 2px;
                color: #333;
              }
              .open-shift {
                color: #d32f2f;
                font-weight: bold;
                font-style: italic;
              }
              @media print {
                .no-print {
                  display: none;
                }
                body {
                  padding: 0;
                }
                /* Ensure colors print */
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-header">
              <h1>Weekly Schedule</h1>
              <h2>${weekLabel}</h2>
              <div class="facility-info">Facility: ${facilityName}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th class="shift-type">Shift Type</th>
                  ${weekDays.map(day => {
                    const dayOfWeek = day.getDay();
                    const dayClass = dayOfWeek === 0 ? 'sunday' : dayOfWeek === 6 ? 'saturday' : 'weekday';
                    return `
                    <th class="day-header ${dayClass}">
                      ${day.toLocaleDateString('en-US', { weekday: 'short' })}<br/>
                      ${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </th>
                  `;
                  }).join('')}
                </tr>
              </thead>
              <tbody>
                ${getShiftTypes().map(shiftType => {
                  const shiftTypeInfo = getShiftTypeInfo();
                  const shiftTypeClass = shiftType.toLowerCase();
                  return `
                    <tr>
                      <td class="shift-type ${shiftTypeClass}">${shiftType.toUpperCase()}<br/>${shiftTypeInfo[shiftType].time}</td>
                      ${weekDays.map(day => {
                        const dayStr = formatDateString(day);
                        const dayShifts = shifts.filter(s => {
                          const shiftDateStr = s.date ? (s.date.split('T')[0] || s.date) : null;
                          return shiftDateStr === dayStr && 
                                 (s.shift_template?.shift_type || 'DAY').toUpperCase() === shiftType.toUpperCase();
                        });
                        
                        let cellContent = '';
                        if (dayShifts.length === 0) {
                          cellContent = '<span class="open-shift">No shifts scheduled</span>';
                        } else {
                          dayShifts.forEach(shift => {
                            const shiftAssignments = getAssignmentsForShift(shift.id);
                            const role = shift.required_staff_role || 'staff';
                            const required = shift.required_staff_count || 0;
                            const assigned = shiftAssignments.length;
                            
                            cellContent += `<div class="role-label">${role === 'med_tech' ? 'Med Tech' : role === 'caregiver' ? 'Caregiver' : role} (${assigned}/${required})</div>`;
                            
                            if (shiftAssignments.length === 0) {
                              cellContent += '<span class="open-shift">OPEN</span>';
                            } else {
                              shiftAssignments.forEach(assignment => {
                                const staffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
                                const staffMember = staff.find(s => s.id === staffId);
                                if (staffMember) {
                                  cellContent += `<div class="staff-name">${staffMember.full_name || `${staffMember.first_name} ${staffMember.last_name}`}</div>`;
                                }
                              });
                            }
                          });
                        }
                        
                        return `<td class="shift-${shiftTypeClass}">${cellContent || '<span class="open-shift">OPEN</span>'}</td>`;
                      }).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            <div style="margin-top: 20px; font-size: 10px; color: #666; text-align: center;">
              Generated on ${new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} at ${new Date().toLocaleTimeString('en-US')}
            </div>
          </body>
        </html>
      `;
      
      // Open print window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for content to load, then print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };
      } else {
        setSnackbar({ 
          open: true, 
          message: 'Please allow pop-ups to print the schedule', 
          severity: 'warning' 
        });
      }
    } catch (error) {
      console.error('Error printing schedule:', error);
      setSnackbar({ 
        open: true, 
        message: `Error printing schedule: ${error.message}`, 
        severity: 'error' 
      });
    }
  };

  const handleConfirmationDialog = (title, message, onConfirm, onCancel) => {
    setConfirmationDialog({
      open: true,
      title,
      message,
      onConfirm: onConfirm || (() => {}),
      onCancel: onCancel || (() => {})
    });
  };

  const handleConfirmDialogConfirm = () => {
    if (confirmationDialog.onConfirm) {
      confirmationDialog.onConfirm();
    }
    setConfirmationDialog({
      open: false,
      title: '',
      message: '',
      onConfirm: null,
      onCancel: null
    });
  };

  const handleConfirmDialogCancel = () => {
    if (confirmationDialog.onCancel) {
      confirmationDialog.onCancel();
    }
    setConfirmationDialog({
      open: false,
      title: '',
      message: '',
      onConfirm: null,
      onCancel: null
    });
  };

  // Check if assigning staff to a shift would result in multiple shifts on the same day
  const checkDailyHoursConflict = (staffId, shiftId, onConfirm, onCancel) => {
    const staffMember = staff.find(s => s.id === staffId);
    const newShift = shifts.find(s => s.id === shiftId);
    
    if (!staffMember || !newShift) return false;

    const shiftDate = new Date(newShift.date);
    const dateKey = shiftDate.toISOString().split('T')[0];
    
    console.log('🔍 checkDailyHoursConflict called:', {
      staffId,
      shiftId,
      shiftDate: dateKey,
      staffName: staffMember.full_name
    });
    
    // Get existing assignments for this staff member on the same day
    const existingAssignments = assignments.filter(assignment => {
      const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
      const assignmentShiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      const shift = shifts.find(s => s.id === assignmentShiftId);
      
      console.log('🔍 Checking assignment for daily conflict:', {
        assignmentStaffId,
        staffId,
        assignmentShiftId,
        shiftDate: shift?.date,
        dateKey,
        matchesStaff: assignmentStaffId === staffId,
        hasShift: !!shift,
        matchesDate: shift ? (new Date(shift.date).toISOString().split('T')[0] === dateKey) : false
      });
      
      if (assignmentStaffId !== staffId || !shift) return false;
      
      const assignmentDate = new Date(shift.date);
      const assignmentDateKey = assignmentDate.toISOString().split('T')[0];
      return assignmentDateKey === dateKey;
    });

    console.log('🔍 Existing assignments for same day:', existingAssignments);

    // If staff already has assignments on this day, show confirmation
    if (existingAssignments.length > 0) {
      // Calculate existing hours for the day
      let existingHours = 0;
      existingAssignments.forEach(assignment => {
        const assignmentShiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
        const shift = shifts.find(s => s.id === assignmentShiftId);
        if (shift && shift.shift_template) {
          const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
          const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
          const hours = (endTime - startTime) / (1000 * 60 * 60);
          existingHours += hours;
        }
      });

      // Calculate hours for the new shift
      let newShiftHours = 0;
      if (newShift.shift_template) {
        const startTime = new Date(`1970-01-01T${newShift.shift_template.start_time}`);
        const endTime = new Date(`1970-01-01T${newShift.shift_template.end_time}`);
        newShiftHours = (endTime - startTime) / (1000 * 60 * 60);
      }

      const totalHours = existingHours + newShiftHours;
      
      // If callbacks are provided, show the detailed confirmation dialog
      if (onConfirm && onCancel) {
        const existingShiftNames = existingAssignments.map(assignment => {
          const assignmentShiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
          const shift = shifts.find(s => s.id === assignmentShiftId);
          if (shift && shift.shift_template) {
            return `${shift.required_staff_role} (${shift.shift_template.start_time}-${shift.shift_template.end_time})`;
          }
          return `${shift.required_staff_role} (Unknown time)`;
        }).join(', ');
        
        const newShiftName = newShift.shift_template ? 
          `${newShift.required_staff_role} (${newShift.shift_template.start_time}-${newShift.shift_template.end_time})` :
          `${newShift.required_staff_role} (Unknown time)`;
        
        const title = "Multiple Shifts Warning";
        const message = `${staffMember.full_name} is already assigned to ${existingAssignments.length} shift(s) on ${shiftDate.toLocaleDateString()}.\n\nExisting shifts: ${existingShiftNames}\nNew shift: ${newShiftName}\nTotal hours: ${totalHours.toFixed(1)}h\n\nAre you sure you want to assign this person to work multiple shifts in a single day?`;
        
        handleConfirmationDialog(title, message, onConfirm, onCancel);
      }
      return true;
    }
    
    return false;
  };

  // Validation functions for scheduling conflicts
  const validateSchedulingConflicts = () => {
    const alerts = [];
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);


    // Check for same-day conflicts and weekly hours
    const staffConflicts = {};
    
    assignments.forEach(assignment => {
      const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
      const assignmentShiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      const shift = shifts.find(s => s.id === assignmentShiftId);
      
      if (!shift) return;
      
      const staffMember = staff.find(s => s.id === assignmentStaffId);
      if (!staffMember) return;
      
      const shiftDate = new Date(shift.date);
      
      // Initialize staff conflict tracking
      if (!staffConflicts[assignmentStaffId]) {
        staffConflicts[assignmentStaffId] = {
          staff: staffMember,
          dailyShifts: {},
          weeklyHours: 0
        };
      }
      
      // Track daily shifts
      const dateKey = shiftDate.toISOString().split('T')[0];
      if (!staffConflicts[assignmentStaffId].dailyShifts[dateKey]) {
        staffConflicts[assignmentStaffId].dailyShifts[dateKey] = [];
      }
      staffConflicts[assignmentStaffId].dailyShifts[dateKey].push(shift);
      
      // Calculate weekly hours
      if (shift.shift_template) {
        const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
        const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
        
        // Handle overnight shifts (e.g., 22:00-06:00)
        let hours = (endTime - startTime) / (1000 * 60 * 60);
        if (hours < 0) {
          // If negative, it means the shift crosses midnight, add 24 hours
          hours += 24;
        }
        
        staffConflicts[assignmentStaffId].weeklyHours += hours;
        
      }
    });

    // Check for conflicts
    Object.values(staffConflicts).forEach(conflict => {
      const { staff, dailyShifts, weeklyHours } = conflict;
      
      // Check for daily overtime (8+ hours in a single day)
      Object.entries(dailyShifts).forEach(([date, shifts]) => {
        if (shifts.length > 0) {
          // Calculate total hours for this day
          let dailyHours = 0;
          shifts.forEach(shift => {
            if (shift.shift_template) {
              const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
              const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
              
              // Handle overnight shifts (e.g., 22:00-06:00)
              let hours = (endTime - startTime) / (1000 * 60 * 60);
              if (hours < 0) {
                // If negative, it means the shift crosses midnight, add 24 hours
                hours += 24;
              }
              
              dailyHours += hours;
            }
          });
          
          // Alert if working 8+ hours in a single day
          if (dailyHours > 8) {
            const shiftTypes = shifts.map(s => {
              if (s.shift_template?.name) return s.shift_template.name;
              if (s.shift_template?.start_time && s.shift_template?.end_time) {
                return `${s.shift_template.start_time}-${s.shift_template.end_time}`;
              }
              return `${s.required_staff_role} (${s.shift_template?.start_time || 'N/A'}-${s.shift_template?.end_time || 'N/A'})`;
            }).join(', ');
            
            alerts.push({
              type: 'daily_overtime',
              severity: 'error',
              staff: staff,
              date: date,
              hours: dailyHours,
              shifts: shifts,
              message: `${staff.full_name} is scheduled for ${dailyHours.toFixed(1)} hours on ${new Date(date).toLocaleDateString()} (exceeds 8-hour daily limit): ${shiftTypes}`
            });
          } else if (shifts.length > 1) {
            // Still warn about multiple shifts even if under 8 hours
            const shiftTypes = shifts.map(s => {
              if (s.shift_template?.name) return s.shift_template.name;
              if (s.shift_template?.start_time && s.shift_template?.end_time) {
                return `${s.shift_template.start_time}-${s.shift_template.end_time}`;
              }
              return `${s.required_staff_role} (${s.shift_template?.start_time || 'N/A'}-${s.shift_template?.end_time || 'N/A'})`;
            }).join(', ');
            alerts.push({
              type: 'multiple_daily_shifts',
              severity: 'warning',
              staff: staff,
              date: date,
              shifts: shifts,
              message: `${staff.full_name} is assigned to ${shifts.length} shifts on ${new Date(date).toLocaleDateString()}: ${shiftTypes}`
            });
          }
        }
      });
      
      // Check for weekly hours limit - USE SAME CALCULATION AS STAFF DISPLAY
      // Filter assignments by current week
      const staffAssignmentsForValidation = assignments.filter(assignment => {
        const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
        if (assignmentStaffId !== staff.id) return false;
        
        // Filter by current week
        const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift || !shift.date) return false;
        
        const shiftDate = new Date(shift.date);
        return shiftDate >= new Date(weekStart) && shiftDate <= weekEnd;
      });
      let actualWeeklyHours = 0;
      for (const assignment of staffAssignmentsForValidation) {
        const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
        const shift = shifts.find(s => s.id === shiftId);
        if (shift && shift.shift_template) {
          // Use shared helper to get correct hours based on facility format
          actualWeeklyHours += getShiftHours(shift);
        }
      }
      
      // Weekly overtime alert (only if EXCEEDS 40 hours, not at exactly 40)
      if (actualWeeklyHours > 40) {
        alerts.push({
          type: 'weekly_overtime',
          severity: 'error',
          staff: staff,
          hours: actualWeeklyHours,
          message: `${staff.full_name} is scheduled for ${actualWeeklyHours.toFixed(1)} hours this week (EXCEEDS 40-hour limit by ${(actualWeeklyHours - 40).toFixed(1)} hours)`
        });
      }
      // No alert for exactly 40 hours - that's the target, not a problem
      // Removed 32-hour warning as requested
    });

    setValidationAlerts(alerts);
    console.log('🔄 Validation alerts updated:', alerts);
    return alerts;
  };

  // Run validation when assignments change
  useEffect(() => {
    if (assignments.length > 0 && shifts.length > 0) {
      validateSchedulingConflicts();
    }
  }, [assignments, shifts]);

  if (loading) {
    return (
      <Box sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography variant="subtitle2" sx={{ fontSize: 14 }}>Loading planner...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      overflow: 'hidden'
    }}>
      {/* Sticky Summary Bar - Always Visible at Top */}
      {(() => {
          // Only count current week for all metrics
          const weekStartStr = getWeekStart();
          const weekStart = new Date(weekStartStr);
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          const currentWeekShifts = shifts.filter(shift => {
            const shiftDate = new Date(shift.date);
            shiftDate.setHours(0, 0, 0, 0);
            return shiftDate >= weekStart && shiftDate <= weekEnd;
          });
          
          const totalStaff = staff.filter(s => s.status === 'active').length;
          
          // Calculate total required caregivers and medtechs for the week
          let totalRequiredCaregivers = 0;
          let totalRequiredMedTechs = 0;
          let totalAssignedCaregivers = 0;
          let totalAssignedMedTechs = 0;
          
          currentWeekShifts.forEach(shift => {
            const shiftRole = shift.required_staff_role || shift.shift_template?.required_staff_role || 'caregiver';
            const requiredCount = shift.required_staff_count || 1;
            
            // Count required staff by role
            if (shiftRole === 'med_tech' || shiftRole === 'medtech') {
              totalRequiredMedTechs += requiredCount;
            } else {
              totalRequiredCaregivers += requiredCount;
            }
            
            // Count assigned staff by role
            const assignedStaff = assignments.filter(a => {
              const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
              if (assignmentShiftId !== shift.id) return false;
              const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
              const staffMember = staff.find(s => s.id === assignmentStaffId);
              return staffMember && staffMember.status === 'active';
            });
            
            assignedStaff.forEach(assignment => {
              const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
              const staffMember = staff.find(s => s.id === assignmentStaffId);
              if (staffMember) {
                if (staffMember.role === 'med_tech' || staffMember.role === 'medtech') {
                  totalAssignedMedTechs += 1;
                } else {
                  totalAssignedCaregivers += 1;
                }
              }
            });
          });
          
          // Calculate filled rate (average of caregiver and medtech fill rates)
          const caregiverFillRate = totalRequiredCaregivers > 0 
            ? Math.round((totalAssignedCaregivers / totalRequiredCaregivers) * 100) 
            : 100;
          const medtechFillRate = totalRequiredMedTechs > 0 
            ? Math.round((totalAssignedMedTechs / totalRequiredMedTechs) * 100) 
            : 100;
          const filledRate = (caregiverFillRate + medtechFillRate) / 2;
          
          return (
              <Box sx={{ 
                position: 'sticky',
                top: 0,
              zIndex: 1000,
              bgcolor: '#ffffff',
              borderBottom: '2px solid',
              borderColor: '#e5e7eb',
              py: 1.5,
              px: 3,
              mb: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              backdropFilter: 'blur(10px)',
              }}>
              <Box sx={{ 
                display: 'flex', 
                gap: 4,
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'space-between'
              }}>
                <Box sx={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem', mb: 0.25, display: 'block', fontWeight: 500 }}>
                      Caregivers
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: '700', color: '#3b82f6', fontSize: '1.25rem', lineHeight: 1.2 }}>
                      {totalAssignedCaregivers}/{totalRequiredCaregivers}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem', mb: 0.25, display: 'block', fontWeight: 500 }}>
                      MedTechs
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: '700', color: '#3b82f6', fontSize: '1.25rem', lineHeight: 1.2 }}>
                      {totalAssignedMedTechs}/{totalRequiredMedTechs}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem', mb: 0.25, display: 'block', fontWeight: 500 }}>
                      Filled Rate
                    </Typography>
                    <Typography variant="h6" sx={{ 
                      fontWeight: '700', 
                      color: filledRate >= 100 ? '#059669' : filledRate >= 50 ? '#f59e0b' : '#dc2626',
                      fontSize: '1.25rem',
                      lineHeight: 1.2
                    }}>
                      {Math.round(filledRate)}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          );
        })()}
        
        {/* Section Title */}
        <Typography variant="subtitle2" sx={{ 
          fontWeight: '600', 
          color: '#1a1a1a', 
          mb: 1.5,
          mt: 2,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Box sx={{ 
            width: 3, 
            height: 18, 
            bgcolor: '#3b82f6', 
            borderRadius: 1.5 
          }} />
          Summary
        </Typography>
        
        {/* Full-Width Floating AI Button - Most Important Action */}
        <Box sx={{ 
          position: 'sticky',
          top: 80, // Position below the sticky summary bar
          zIndex: 999,
          mb: 2,
          mt: 1
                    }}>
          <Tooltip title="This will assign staff according to AI recommendations." arrow placement="top">
          <Button
            variant="contained"
            onClick={handleApplyAIRecommendations}
            disabled={loading || applying}
            startIcon={<SmartToyIcon />}
              fullWidth
              size="large"
            sx={{ 
              backgroundColor: '#14b8a6', // Teal for recommendations
                py: 2,
              borderRadius: 2,
                fontWeight: '700',
                fontSize: '1rem',
                textTransform: 'none',
                boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)',
                '&:hover': { 
                  backgroundColor: '#0d9488',
                  boxShadow: '0 6px 16px rgba(20, 184, 166, 0.5)',
                  transform: 'translateY(-1px)'
                },
                '&:disabled': {
                  backgroundColor: '#9ca3af',
                  boxShadow: 'none'
                },
                transition: 'all 0.2s ease'
            }}
          >
              {applying ? 'Auto-filling Schedule...' : 'Auto-fill Schedule with AI'}
          </Button>
          </Tooltip>
        </Box>

                {/* Clean Action Buttons */}
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1.5, 
                  flexWrap: 'wrap',
                  justifyContent: 'flex-start'
                }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleClearAssignments}
            disabled={loading}
            startIcon={<ClearIcon />}
            sx={{ borderRadius: 2, fontSize: '0.8rem' }}
          >
            Clear Assignments
          </Button>
          
          <Button 
            variant="outlined" 
            size="small"
            onClick={handleClearAllShifts}
            disabled={loading}
            startIcon={<DeleteIcon />}
            sx={{ borderRadius: 2, fontSize: '0.8rem' }}
          >
            Clear Shifts
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={fetchData}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            sx={{ borderRadius: 2, fontSize: '0.8rem' }}
          >
            Refresh
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={handleExportCSV}
            disabled={loading}
            startIcon={<FileDownloadIcon />}
            sx={{ borderRadius: 2, fontSize: '0.8rem' }}
          >
            Export CSV
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={handlePrint}
            disabled={loading}
            startIcon={<PrintIcon />}
            sx={{ borderRadius: 2, fontSize: '0.8rem' }}
          >
            Print Schedule
          </Button>
        </Box>

        {/* Validation Alerts */}
        {validationAlerts.length > 0 && (
          <Box sx={{ p: 1, pb: 0 }}>
            {validationAlerts.map((alert, index) => (
              <Alert 
                key={index}
                severity={alert.severity}
                sx={{ 
                  mb: 0.75,
                  borderRadius: 1.5,
                  py: 0.5,
                  '& .MuiAlert-message': {
                    width: '100%',
                    fontSize: 12
                  }
                }}
                icon={
                  alert.type === 'same_day_conflict' ? <WarningIcon /> :
                  alert.type === 'weekly_hours_exceeded' ? <ErrorIcon /> :
                  <InfoIcon />
                }
              >
                <Typography variant="body2" sx={{ fontWeight: '500' }}>
                  {alert.message}
                </Typography>
                {alert.type === 'same_day_conflict' && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Shifts: {alert.shifts.map(s => {
                        if (s.shift_template?.name) {
                          return `${s.shift_template.name} (${s.shift_template.start_time} - ${s.shift_template.end_time})`;
                        }
                        if (s.shift_template?.start_time && s.shift_template?.end_time) {
                          return `${s.required_staff_role} (${s.shift_template.start_time} - ${s.shift_template.end_time})`;
                        }
                        return `${s.required_staff_role} (${s.shift_template?.start_time || 'N/A'} - ${s.shift_template?.end_time || 'N/A'})`;
                      }).join(', ')}
                    </Typography>
                  </Box>
                )}
              </Alert>
            ))}
          </Box>
        )}

      {/* Main Content Area */}
        <Box sx={{ 
          display: 'flex', 
        flex: 1, 
        overflow: 'hidden',
        bgcolor: '#f8fafc'
      }}>
                {/* Left Side - Planner Grid */}
                <Box sx={{ 
                  flex: 1, 
                  overflow: 'auto',
                  p: 2,
                  bgcolor: '#ffffff',
                  margin: 1.5,
                  borderRadius: 3,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
          {/* Section Title */}
          <Typography variant="h6" sx={{ 
            fontWeight: '600', 
            color: '#1a1a1a', 
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <Box sx={{ 
              width: 4, 
              height: 24, 
              bgcolor: '#3b82f6', 
              borderRadius: 2 
            }} />
            Weekly Planner
          </Typography>

          {/* Week Display */}
          <Box sx={{ mb: 1, textAlign: 'center', p: 1, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: '600', color: '#1a1a1a', mb: 0.25, fontSize: 13 }}>
              {getWeekLabel(selectedWeek)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
              Facility: {facilityId ? `ID: ${facilityId}` : 'No facility selected'}
            </Typography>
        </Box>


          {/* Uniform Table Structure */}
          <TableContainer sx={{ 
            maxHeight: 'calc(100vh - 280px)',
            border: '1px solid #e5e7eb',
            borderRadius: 2,
            bgcolor: '#ffffff'
          }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ 
                    fontWeight: '700', 
                    backgroundColor: '#f8fafc',
                    borderBottom: '2px solid #e5e7eb',
                    borderRight: '2px solid #e5e7eb',
                    minWidth: 100,
                    fontSize: '0.85rem',
                    py: 1,
                    px: 1.5
                  }}>
                    Shift Type
                  </TableCell>
                  {getWeekDays().map((day) => {
                    const dayOfWeek = day.getDay(); // 0 = Sunday, 6 = Saturday
                    const dayBgColor = dayOfWeek === 0 ? '#fefce8' : // Sunday - light yellow
                                      dayOfWeek === 6 ? '#fef9e7' : // Saturday - light beige
                                      '#f8fafc'; // Other days - default
                    
                    return (
                    <TableCell 
                      key={day.toISOString()}
                      sx={{ 
                        fontWeight: '700', 
                          backgroundColor: dayBgColor,
                        borderBottom: '2px solid #e5e7eb',
                        borderRight: '1px solid #e5e7eb',
                        textAlign: 'center',
                        minWidth: 140,
                        fontSize: '0.85rem',
                        py: 1,
                          px: 1.5,
                          transition: 'background-color 0.3s ease'
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: '700', color: '#111827', mb: 0.25, fontSize: 12 }}>
                          {day.toLocaleDateString('en-US', { weekday: 'long' })}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: '500', fontSize: 11 }}>
                          {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Typography>
                      </Box>
                    </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {getShiftTypes().map((shiftType) => {
                  const shiftTypeInfo = getShiftTypeInfo();
                  
                  return (
                    <TableRow key={shiftType}>
                      {/* Shift Type Header */}
                      <TableCell sx={{ 
                        fontWeight: '600', 
                        backgroundColor: '#ffffff',
                        borderRight: '2px solid #e5e7eb',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '0.85rem',
                        py: 1,
                        px: 1.5,
                        verticalAlign: 'top'
                      }}>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          p: 1,
                          bgcolor: shiftTypeInfo[shiftType].bg,
                          borderRadius: 1.5,
                          border: `1px solid ${shiftTypeInfo[shiftType].color}20`
                        }}>
                          <Box sx={{ 
                            width: 10, 
                            height: 10, 
                            bgcolor: shiftTypeInfo[shiftType].color, 
                            borderRadius: '50%',
                            mr: 1
                          }} />
                          <Box>
                            <Typography variant="body2" sx={{ 
                              fontWeight: '700',
                              color: shiftTypeInfo[shiftType].color,
                              mb: 0.5
                            }}>
                              {shiftType}
                            </Typography>
                            <Typography variant="caption" sx={{ 
                              color: '#6b7280',
                              fontWeight: '500'
                            }}>
                              {shiftTypeInfo[shiftType].time}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      
                      {/* Day Columns */}
                      {getWeekDays().map((day) => {
                        // Format day as YYYY-MM-DD for comparison (avoid timezone issues)
                        const dayStr = formatDateString(day);
                        const dayShifts = shifts.filter(s => {
                          // Compare date strings directly to avoid timezone conversion issues
                          const shiftDateStr = s.date ? (s.date.split('T')[0] || s.date) : null;
                          return shiftDateStr === dayStr && 
                                 (s.shift_template?.shift_type || 'DAY').toUpperCase() === shiftType;
                        }).sort((a, b) => {
                          // Sort shifts by role: med_tech first, then caregiver
                          // This ensures consistent ordering across all days
                          const roleOrder = { 'med_tech': 0, 'medtech': 0, 'caregiver': 1, 'cna': 1 };
                          const roleA = (a.required_staff_role || '').toLowerCase();
                          const roleB = (b.required_staff_role || '').toLowerCase();
                          const orderA = roleOrder[roleA] !== undefined ? roleOrder[roleA] : 2;
                          const orderB = roleOrder[roleB] !== undefined ? roleOrder[roleB] : 2;
                          return orderA - orderB;
                        });
                        
                        const dayOfWeek = day.getDay(); // 0 = Sunday, 6 = Saturday
                        const dayBgColor = dayOfWeek === 0 ? '#fefce8' : // Sunday - light yellow
                                          dayOfWeek === 6 ? '#fef9e7' : // Saturday - light beige
                                          '#ffffff'; // Other days - white
                        
                        return (
                          <TableCell 
                            key={`${shiftType}-${day.toISOString()}`}
                            sx={{ 
                              border: '1px solid #e5e7eb',
                              verticalAlign: 'top',
                              bgcolor: dayBgColor,
                              p: 2,
                              minHeight: 200,
                              transition: 'background-color 0.3s ease'
                            }}
                          >
                            {dayShifts.length > 0 ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {dayShifts.map((shift) => {
                                  // Filter assignments for this shift and only include active staff
                                  const shiftAssignments = assignments.filter(a => {
                                    const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                                    if (assignmentShiftId !== shift.id) return false;
                                    
                                    // Only include if the staff member is in the active staff list
                                    const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                                    const staffMember = staff.find(s => s.id === assignmentStaffId);
                                    return staffMember && staffMember.status === 'active';
                                  });
                                  
                                  const assignedCount = shiftAssignments.length;
                                  const isFilled = assignedCount >= shift.required_staff_count;
                                  const assignedStaff = shiftAssignments.map(assignment => {
                                    const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
                                    return staff.find(s => s.id === assignmentStaffId);
                                  }).filter(Boolean);
                                  
                                  // Check if this shift was just autofilled
                                  const wasAutofilled = autofilledShiftIds.has(shift.id);
                                  
                                  return (
                                    <Box 
                                      key={shift.id}
                                      id={`shift-${shift.id}`}
                                      sx={{
                                        border: dragOverShift === shift.id ? '2px solid #3b82f6' : 
                                                isFilled ? '2px solid #22c55e' : 
                                                assignedCount > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                                        borderRadius: 2,
                                        p: 1.5,
                                        bgcolor: dragOverShift === shift.id ? '#eff6ff' : 
                                                 isFilled ? '#f0fdf4' : 
                                                 assignedCount > 0 ? '#fffbeb' : '#ffffff',
                                        cursor: isFilled ? 'not-allowed' : 'pointer',
                                        opacity: isFilled ? 0.9 : 1,
                                        transition: 'all 0.2s ease',
                                        // Pulsing animation for incomplete shifts
                                        ...(!isFilled && {
                                          animation: 'pulse 2s ease-in-out infinite',
                                          '@keyframes pulse': {
                                            '0%, 100%': {
                                              boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.4)'
                                            },
                                            '50%': {
                                              boxShadow: '0 0 0 4px rgba(245, 158, 11, 0)'
                                            }
                                          }
                                        }),
                                        // Highlight autofilled shifts
                                        ...(wasAutofilled && {
                                          animation: 'fadeInHighlight 1s ease-out',
                                          '@keyframes fadeInHighlight': {
                                            '0%': {
                                              backgroundColor: '#dcfce7',
                                              transform: 'scale(1)'
                                            },
                                            '50%': {
                                              backgroundColor: '#bbf7d0',
                                              transform: 'scale(1.02)'
                                            },
                                            '100%': {
                                              backgroundColor: '#f0fdf4',
                                              transform: 'scale(1)'
                                            }
                                          }
                                        }),
                                        '&:hover': { 
                                          transform: isFilled ? 'none' : 'translateY(-1px)',
                                          boxShadow: isFilled ? 'none' : '0 4px 12px rgba(0,0,0,0.1)'
                                        }
                                      }}
                                      onDragOver={(e) => handleDragOver(e, shift)}
                                      onDragLeave={handleDragLeave}
                                      onDrop={(e) => handleDrop(e, shift)}
                                      onClick={() => handleShiftClick(shift)}
                                      title={isFilled ? `Shift is full (${assignedCount}/${shift.required_staff_count}). Cannot assign more staff.` : undefined}
                                    >
                                      {/* Role and Status */}
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="body2" sx={{ 
                                          fontWeight: '600',
                                          color: '#111827'
                                        }}>
                                          {shift.required_staff_role.split('_').map(word => 
                                            word.charAt(0).toUpperCase() + word.slice(1)
                                          ).join(' ')}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <Typography variant="caption" sx={{ 
                                            color: '#6b7280',
                                            fontWeight: '500'
                                          }}>
                                            {assignedCount}/{shift.required_staff_count}
                                          </Typography>
                                          {isFilled ? (
                                            <Box sx={{ 
                                              width: 6, 
                                              height: 6, 
                                              bgcolor: '#22c55e', 
                                              borderRadius: '50%' 
                                            }} />
                                          ) : assignedCount > 0 ? (
                                            <Box sx={{ 
                                              width: 6, 
                                              height: 6, 
                                              bgcolor: '#f59e0b', 
                                              borderRadius: '50%' 
                                            }} />
                                          ) : (
                                            <Box sx={{ 
                                              width: 6, 
                                              height: 6, 
                                              bgcolor: '#ef4444', 
                                              borderRadius: '50%' 
                                            }} />
                                          )}
                                        </Box>
                                      </Box>
                                      
                                      {/* Staff Assignments */}
                                      {assignedStaff.length > 0 ? (
                                        <Box>
                                          {assignedStaff.map((staffMember, index) => {
                                            // Determine role badge color and icon
                                            const role = staffMember.role || shift.required_staff_role;
                                            const roleConfig = {
                                              'med_tech': { color: '#3b82f6', bg: '#dbeafe', icon: <MedTechIcon sx={{ fontSize: 12 }} />, label: 'MT' },
                                              'caregiver': { color: '#059669', bg: '#d1fae5', icon: <CaregiverIcon sx={{ fontSize: 12 }} />, label: 'CG' },
                                              'rn': { color: '#8b5cf6', bg: '#ede9fe', icon: <RNIcon sx={{ fontSize: 12 }} />, label: 'RN' },
                                            };
                                            const roleInfo = roleConfig[role] || roleConfig['caregiver'];
                                            
                                            const assignmentKey = `${shift.id}-${staffMember.id}`;
                                            const isNewlyAdded = newlyAddedAssignments.has(assignmentKey);
                                            const isRemoving = removingAssignments.has(assignmentKey);
                                            
                                            
                                            // Calculate hours for this day (all shifts on the same date)
                                            const shiftDateStr = new Date(shift.date).toISOString().split('T')[0];
                                            const dayHours = assignments
                                              .filter(a => {
                                                const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                                                const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                                                if (assignmentStaffId !== staffMember.id) return false;
                                                const assignedShift = shifts.find(s => s.id === assignmentShiftId);
                                                if (!assignedShift) return false;
                                                const assignedShiftDateStr = new Date(assignedShift.date).toISOString().split('T')[0];
                                                return assignedShiftDateStr === shiftDateStr;
                                              })
                                              .reduce((sum, a) => {
                                                const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                                                const assignedShift = shifts.find(s => s.id === assignmentShiftId);
                                                return sum + (assignedShift ? getShiftHours(assignedShift) : 0);
                                              }, 0);
                                            
                                            // Calculate hours for the week
                                            const weekStartStr = getWeekStart();
                                            const weekStartDate = new Date(weekStartStr);
                                            weekStartDate.setHours(0, 0, 0, 0);
                                            const weekEndDate = new Date(weekStartDate);
                                            weekEndDate.setDate(weekEndDate.getDate() + 6);
                                            weekEndDate.setHours(23, 59, 59, 999);
                                            const weekHours = assignments
                                              .filter(a => {
                                                const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                                                if (assignmentStaffId !== staffMember.id) return false;
                                                const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                                                const assignedShift = shifts.find(s => s.id === assignmentShiftId);
                                                if (!assignedShift) return false;
                                                const shiftDateObj = new Date(assignedShift.date);
                                                shiftDateObj.setHours(0, 0, 0, 0);
                                                return shiftDateObj >= weekStartDate && shiftDateObj <= weekEndDate;
                                              })
                                              .reduce((sum, a) => {
                                                const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                                                const assignedShift = shifts.find(s => s.id === assignmentShiftId);
                                                return sum + (assignedShift ? getShiftHours(assignedShift) : 0);
                                              }, 0);
                                            
                                            return (
                                              <Tooltip
                                                key={index}
                                                title={
                                                  <Box>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                                      {staffMember.first_name} {staffMember.last_name}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                      <strong>Rate:</strong> ${staffMember.hourly_rate ? parseFloat(staffMember.hourly_rate).toFixed(2) : 'N/A'}/hr
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                      <strong>Hours Today:</strong> {dayHours.toFixed(1)}h
                                                    </Typography>
                                                    <Typography variant="body2">
                                                      <strong>Hours This Week:</strong> {weekHours.toFixed(1)}h / {staffMember.max_hours || 40}h
                                                    </Typography>
                                                  </Box>
                                                }
                                                arrow
                                                placement="right"
                                              >
                                              <Box 
                                                sx={{ 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              justifyContent: 'space-between',
                                              p: 0.75,
                                                  bgcolor: index % 2 === 0 ? '#ffffff' : '#f9fafb', // Alternating backgrounds
                                              borderRadius: 1,
                                              border: '1px solid #e5e7eb',
                                                  mb: 0.5,
                                                  // Fade-in animation for newly added
                                                  ...(isNewlyAdded && {
                                                    animation: 'fadeIn 0.5s ease-out',
                                                    '@keyframes fadeIn': {
                                                      '0%': {
                                                        opacity: 0,
                                                        transform: 'translateY(-10px)'
                                                      },
                                                      '100%': {
                                                        opacity: 1,
                                                        transform: 'translateY(0)'
                                                      }
                                                    }
                                                  }),
                                                  // Slide-out animation for removing
                                                  ...(isRemoving && {
                                                    animation: 'slideOut 0.3s ease-out forwards',
                                                    '@keyframes slideOut': {
                                                      '0%': {
                                                        opacity: 1,
                                                        transform: 'translateX(0)',
                                                        maxHeight: '100px'
                                                      },
                                                      '100%': {
                                                        opacity: 0,
                                                        transform: 'translateX(100%)',
                                                        maxHeight: 0,
                                                        marginBottom: 0,
                                                        padding: 0
                                                      }
                                                    }
                                                  }),
                                                  '&:hover .delete-button': {
                                                    opacity: 1
                                                  }
                                                }}
                                              >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
                                                  {/* Role Badge */}
                                                  <Chip
                                                    icon={roleInfo.icon}
                                                    label={roleInfo.label}
                                                    size="small"
                                                    sx={{
                                                      height: 18,
                                                      fontSize: '0.65rem',
                                                      bgcolor: roleInfo.bg,
                                                      color: roleInfo.color,
                                                      fontWeight: '600',
                                                      border: `1px solid ${roleInfo.color}40`,
                                                      '& .MuiChip-icon': {
                                                        color: roleInfo.color,
                                                        fontSize: 12
                                                      },
                                                      '& .MuiChip-label': {
                                                        px: 0.5
                                                      }
                                                    }}
                                                  />
                                              <Typography variant="caption" sx={{ 
                                                fontWeight: '500',
                                                color: '#111827',
                                                fontSize: '0.75rem'
                                              }}>
                                                {staffMember.first_name} {staffMember.last_name}
                                              </Typography>
                                                </Box>
                                              <IconButton 
                                                  className="delete-button"
                                                size="small" 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUnassignStaff(shift.id, staffMember.id);
                                                }}
                                                sx={{ 
                                                    width: 20, 
                                                    height: 20,
                                                    opacity: 0, // Hidden by default
                                                    transition: 'opacity 0.2s ease',
                                                    '&:hover': { 
                                                      bgcolor: '#fee2e2',
                                                      opacity: 1
                                                    } 
                                                }}
                                              >
                                                  <DeleteIcon sx={{ fontSize: 12, color: '#dc2626' }} />
                                              </IconButton>
                                            </Box>
                                              </Tooltip>
                                            );
                                          })}
                                        </Box>
                                      ) : (
                                        <Box sx={{
                                          bgcolor: '#fef2f2',
                                          color: '#dc2626',
                                          p: 1,
                                          borderRadius: 1,
                                          textAlign: 'center',
                                          border: '1px solid #fecaca'
                                        }}>
                                          <Typography variant="caption" sx={{ 
                                            fontWeight: '600',
                                            fontSize: '0.75rem'
                                          }}>
                                            OPEN
                                          </Typography>
                                        </Box>
                                      )}
                                    </Box>
                                  );
                                })}
                              </Box>
                            ) : (
                              <Box sx={{ 
                                textAlign: 'center', 
                                py: 4,
                                color: '#9ca3af',
                                border: '2px dashed #e5e7eb',
                                borderRadius: 2,
                                bgcolor: '#fafafa'
                              }}>
                                <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                                  No {shiftType} shifts
                                </Typography>
                                <Button 
                                  variant="outlined"
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => setCreateShiftData({ date: day, shiftType })}
                                  sx={{ 
                                    textTransform: 'none',
                                    fontWeight: '500',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  Add
                                </Button>
                              </Box>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Analytics Section */}
          <Box sx={{ mt: 3 }}>
              <Button
              onClick={() => setAnalyticsOpen(!analyticsOpen)}
              startIcon={analyticsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ mb: 2 }}
              >
              Analytics
              </Button>
            
            <Collapse in={analyticsOpen}>
              <Paper sx={{ p: 3, bgcolor: '#f8fafc' }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Weekly Coverage Summary
            </Typography>
                <Typography variant="body2" color="text.secondary">
                  Analytics chart would go here
            </Typography>
          </Paper>
            </Collapse>
        </Box>
      </Box>

        {/* Right Side - Staff Panel */}
        <Drawer
          variant="persistent"
          anchor="right"
          open={staffPanelOpen}
          sx={{
            width: staffPanelOpen ? '30%' : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: '30%',
              minWidth: 350,
              boxSizing: 'border-box',
              position: 'relative',
              height: '100%',
              border: 'none',
              borderLeft: '1px solid #e5e7eb',
              bgcolor: '#f8fafc'
            },
          }}
        >
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#ffffff',
                    margin: 1.5,
                    borderRadius: 3,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    height: 'calc(100vh - 150px)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
            {/* Section Title with Collapse Toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ 
              fontWeight: '600', 
              color: '#1a1a1a', 
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}>
              <Box sx={{ 
                width: 4, 
                height: 24, 
                bgcolor: '#3b82f6', 
                borderRadius: 2 
              }} />
              Staff Members
              </Typography>
              <IconButton 
                onClick={() => setStaffPanelOpen(false)} 
                size="small"
                sx={{ 
                  color: '#6b7280',
                  '&:hover': { bgcolor: '#f3f4f6' }
                }}
                title="Collapse panel"
              >
                <ExpandLessIcon />
              </IconButton>
            </Box>
        
            {/* Search and Filter */}
            <Box sx={{ mb: 2 }}>
          <TextField
            placeholder="Search staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
                fullWidth
                sx={{ mb: 2 }}
            InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: '#6b7280' }} />
            }}
          />
          
          {/* Quick Filters */}
          <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: '600', color: '#475569' }}>
            Quick Filters
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            <Chip
              label="All"
              size="small"
              onClick={() => setQuickFilter('all')}
              color={quickFilter === 'all' ? 'primary' : 'default'}
              sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
            />
            <Chip
              label="Available"
              size="small"
              onClick={() => setQuickFilter('available')}
              color={quickFilter === 'available' ? 'success' : 'default'}
              sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
            />
            <Chip
              label="Under Hours"
              size="small"
              onClick={() => setQuickFilter('under_hours')}
              color={quickFilter === 'under_hours' ? 'info' : 'default'}
              sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
            />
            <Chip
              label="At Limit"
              size="small"
              onClick={() => setQuickFilter('at_limit')}
              color={quickFilter === 'at_limit' ? 'warning' : 'default'}
              sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
            />
            <Chip
              label="Over Limit"
              size="small"
              onClick={() => setQuickFilter('over_limit')}
              color={quickFilter === 'over_limit' ? 'error' : 'default'}
              sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
            />
            <Chip
              icon={<MedTechIcon sx={{ fontSize: 12 }} />}
              label="MedTech"
              size="small"
              onClick={() => setQuickFilter('med_tech')}
              color={quickFilter === 'med_tech' ? 'primary' : 'default'}
              sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
            />
            <Chip
              icon={<CaregiverIcon sx={{ fontSize: 12 }} />}
              label="Caregiver"
              size="small"
              onClick={() => setQuickFilter('caregiver')}
              color={quickFilter === 'caregiver' ? 'success' : 'default'}
              sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
            />
          </Box>
          
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <MenuItem value="all">All Roles</MenuItem>
                  <MenuItem value="med_tech">MedTech</MenuItem>
              <MenuItem value="caregiver">Caregiver</MenuItem>
            </Select>
          </FormControl>
          
          {/* Hide On Leave Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <input 
              type="checkbox" 
              id="hideOnLeave"
              checked={hideOnLeave}
              onChange={(e) => setHideOnLeave(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label 
              htmlFor="hideOnLeave" 
              style={{ 
                cursor: 'pointer', 
                fontSize: '0.875rem',
                color: '#475569',
                fontWeight: '500'
              }}
            >
              Hide Staff on Leave
            </label>
          </Box>
        </Box>

            {/* Staff Status Summary */}
            {(() => {
              const activeCount = staff.filter(m => m.status === 'active').length;
              const onLeaveCount = staff.filter(m => m.status === 'on_leave').length;
              const inactiveCount = staff.filter(m => m.status === 'inactive').length;
              const terminatedCount = staff.filter(m => m.status === 'terminated').length;
              
              return (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: '600', color: '#475569' }}>
                    Staff Status
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Chip 
                      label={`${activeCount} Active`} 
                      size="small" 
                      sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: '600' }}
                    />
                    {onLeaveCount > 0 && (
                      <Chip 
                        label={`${onLeaveCount} On Leave`} 
                        size="small" 
                        sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: '600' }}
                        icon={<WarningIcon sx={{ fontSize: '14px !important' }} />}
                      />
                    )}
                    {inactiveCount > 0 && (
                      <Chip 
                        label={`${inactiveCount} Inactive`} 
                        size="small" 
                        sx={{ bgcolor: '#e5e7eb', color: '#374151', fontWeight: '500' }}
                      />
                    )}
                    {terminatedCount > 0 && (
                      <Chip 
                        label={`${terminatedCount} Terminated`} 
                        size="small" 
                        sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: '500' }}
                      />
                    )}
                  </Box>
                  {onLeaveCount > 0 && (
                    <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                      {onLeaveCount} staff member{onLeaveCount > 1 ? 's are' : ' is'} on leave
                    </Alert>
                  )}
                </Box>
              );
            })()}

            {/* Staff List */}
        <Box sx={{ 
              flex: 1, 
              overflow: 'auto',
              pr: 1,
          '&::-webkit-scrollbar': {
                width: '6px',
          },
          '&::-webkit-scrollbar-track': {
                bgcolor: '#f1f5f9',
                borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb': {
                bgcolor: '#cbd5e1',
                borderRadius: '3px',
                '&:hover': {
                  bgcolor: '#94a3b8',
                },
          },
        }}>
          {filteredStaff.map((member) => {
            const status = getStaffStatus(member);
                // Filter assignments to only include current week
                const staffAssignments = getAssignmentsForStaff(member.id, true);
                
                // Calculate actual hours from shift templates - uses facility format
                // Only count hours from assignments in the current week
                // Calculate hours used - staffAssignments is already filtered by current week
                let hoursUsed = 0;
                const assignmentDetails = []; // For debugging
                
                for (const assignment of staffAssignments) {
                  const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
                  const shift = shifts.find(s => s.id === shiftId);
                  if (shift && shift.shift_template) {
                    const hours = getShiftHours(shift);
                    hoursUsed += hours;
                    
                    // Debug logging for specific staff
                    if (['MADISON CATRON', 'LINDA CUSTER', 'ALIA FLORES-HUNGERFORD'].some(name => 
                      (member.first_name + ' ' + member.last_name).toUpperCase().includes(name.split(' ')[0])
                    )) {
                      assignmentDetails.push({
                        date: shift.date,
                        shiftType: shift.shift_template.shift_type,
                        startTime: shift.shift_template.start_time,
                        endTime: shift.shift_template.end_time,
                        hours: hours.toFixed(1),
                        cumulativeHours: hoursUsed.toFixed(1)
                      });
                    }
                  }
                }
                
                // Debug logging for specific staff
                if (['MADISON CATRON', 'LINDA CUSTER', 'ALIA FLORES-HUNGERFORD'].some(name => 
                  (member.first_name + ' ' + member.last_name).toUpperCase().includes(name.split(' ')[0])
                )) {
                  console.log(`🔍 Hours calculation for ${member.first_name} ${member.last_name}:`, {
                    totalHours: hoursUsed.toFixed(1),
                    maxHours: member.max_hours,
                    assignmentCount: staffAssignments.length,
                    assignments: assignmentDetails
                  });
                }
            
            return (
              <Card 
                key={member.id} 
                sx={{ 
                      mb: 2, 
                      cursor: member.status === 'on_leave' 
                        ? 'not-allowed' 
                        : draggedStaff?.id === member.id ? 'grabbing' : 'grab',
                      border: member.status === 'on_leave' 
                        ? '2px solid #fbbf24' 
                        : `2px solid ${status === 'available' ? '#dcfce7' : status === 'near_max' ? '#fed7aa' : '#fecaca'}`,
                      borderRadius: 3,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      opacity: draggedStaff?.id === member.id ? 0.5 : member.status === 'on_leave' ? 0.6 : 1,
                      bgcolor: member.status === 'on_leave' ? '#fffbeb' : 'white',
                      position: 'relative',
                  '&:hover': { 
                        transform: member.status === 'on_leave' ? 'none' : 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        border: member.status === 'on_leave'
                          ? '2px solid #f59e0b'
                          : `2px solid ${status === 'available' ? '#22c55e' : status === 'near_max' ? '#f59e0b' : '#ef4444'}`
                      }
                }}
                draggable={member.status !== 'on_leave'}
                onDragStart={(e) => {
                  if (member.status === 'on_leave') {
                    e.preventDefault();
                    setSnackbar({ 
                      open: true, 
                      message: `${member.first_name} ${member.last_name} is on leave and cannot be assigned`, 
                      severity: 'warning' 
                    });
                  } else {
                    handleDragStart(e, member);
                  }
                }}
                    onDragEnd={handleDragEnd}
              >
                            <CardContent sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Avatar 
                      sx={{ 
                            bgcolor: member.role === 'med_tech' ? '#dbeafe' : '#dcfce7',
                            color: member.role === 'med_tech' ? '#1e40af' : '#166534',
                            width: 44,
                            height: 44,
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            border: '2px solid #ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      {member.first_name[0]}{member.last_name[0]}
                    </Avatar>
                        
                    <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            {/* Role Icon */}
                            {member.role === 'med_tech' ? (
                              <MedTechIcon sx={{ fontSize: 16, color: '#3b82f6' }} />
                            ) : member.role === 'rn' ? (
                              <RNIcon sx={{ fontSize: 16, color: '#8b5cf6' }} />
                            ) : (
                              <CaregiverIcon sx={{ fontSize: 16, color: '#059669' }} />
                            )}
                            <Typography variant="subtitle1" sx={{ fontWeight: '600', fontSize: '0.95rem' }}>
                              {member.first_name} {member.last_name}
                            </Typography>
                            {member.status === 'on_leave' && (
                              <Chip 
                                label="On Leave" 
                                size="small" 
                                sx={{ 
                                  bgcolor: '#fef3c7', 
                                  color: '#92400e', 
                                  fontWeight: '600',
                                  fontSize: '0.7rem',
                                  height: '20px'
                                }}
                                icon={<WarningIcon sx={{ fontSize: '14px !important' }} />}
                              />
                            )}
                          </Box>
                                  <Typography variant="body2" sx={{ 
                                    color: member.role === 'med_tech' ? '#1e40af' : '#166534',
                                    fontWeight: '500',
                                    fontSize: '0.85rem'
                                  }}>
                                    {member.role.split('_').map(word => 
                                      word.charAt(0).toUpperCase() + word.slice(1)
                                    ).join(' ')}
                                  </Typography>
                          <Typography 
                            variant="caption" 
                            color={hoursUsed > 40 ? 'error.main' : hoursUsed === 40 ? 'warning.main' : 'text.secondary'} 
                            sx={{ 
                              fontSize: '0.8rem',
                              fontWeight: hoursUsed >= 40 ? 600 : 400
                            }}
                          >
                            {hoursUsed.toFixed(1)}/{member.max_hours} hours
                            {hoursUsed > 40 && ` (${(hoursUsed - 40).toFixed(1)}h OT)`}
                            {hoursUsed === 40 && ' (at limit)'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', fontWeight: '500' }}>
                        Rate: {member.hourly_rate ? `$${parseFloat(member.hourly_rate).toFixed(2)}/hr` : 'N/A'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                        Assignments: {staffAssignments.length}
                      </Typography>
                    </Box>

                        <Box sx={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          bgcolor: status === 'available' ? '#22c55e' : status === 'near_max' ? '#f59e0b' : '#ef4444',
                          border: '2px solid #ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                  </Box>
                  
                              {staffAssignments.length > 0 && (
                  <Box sx={{ 
                                  mt: 2, 
                                  p: 1.5, 
                                  bgcolor: '#f8fafc', 
                                  borderRadius: 2,
                                  border: '1px solid #e2e8f0'
                                }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: '500' }}>
                                    Current Assignments:
                    </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {staffAssignments.slice(0, 3).map((assignment) => {
                        const assignedShift = shifts.find(s => s.id === assignment.shift);
                        if (assignedShift) {
                          const day = new Date(assignedShift.date).toLocaleDateString('en-US', { weekday: 'short' });
                      return (
                                  <Chip
                                    key={assignment.id}
                                    label={`${day} ${assignedShift.shift_template?.shift_type}`}
                  size="small"
                          sx={{ 
                            fontSize: '0.7rem',
                                      height: 20,
                                      bgcolor: '#e0e7ff',
                                      color: '#3730a3',
                                      fontWeight: '500'
                                    }}
                                  />
                      );
                    }
                    return null;
                            })}
                            {staffAssignments.length > 3 && (
                              <Chip
                                label={`+${staffAssignments.length - 3}`}
                  size="small"
                  color="primary"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            )}
            </Box>
        </Box>
      )}
                </CardContent>
              </Card>
            );
          })}
              
              {filteredStaff.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <PeopleIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                    No staff found
                          </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try adjusting your search criteria
                          </Typography>
                        </Box>
              )}
            </Box>
          </Box>
        </Drawer>

        {/* Staff Panel Toggle */}
        {!staffPanelOpen && (
          <Box sx={{ 
            position: 'absolute', 
            right: 16, 
            top: '50%', 
            transform: 'translateY(-50%)',
            zIndex: 10
          }}>
            <Button
              variant="contained"
              onClick={() => setStaffPanelOpen(true)}
              startIcon={<ExpandLessIcon />}
                            sx={{ 
                bgcolor: '#3b82f6',
                color: 'white',
                borderRadius: 3,
                px: 3,
                py: 1.5,
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                '&:hover': { 
                  bgcolor: '#2563eb',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 16px rgba(59, 130, 246, 0.4)'
                }
              }}
            >
              Staff Panel
            </Button>
                                  </Box>
                                )}
      </Box>
                                
      {/* Snackbar */}
      {snackbar.open && (
                                <Box sx={{ 
            position: 'fixed',
          top: 20, 
          right: 20, 
          zIndex: 9999 
        }}>
          <Alert 
            severity={snackbar.severity}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
                                    sx={{ 
              minWidth: 300,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            {snackbar.message}
          </Alert>
        </Box>
      )}

      {/* Reassign Modal */}
      <Dialog 
        open={reassignModalOpen} 
        onClose={handleCloseReassignModal}
        maxWidth="sm"
        fullWidth
                                    sx={{ 
          '& .MuiDialog-paper': {
            borderRadius: 3,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: '600', color: '#111827' }}>
              {selectedShiftForReassign?.required_staff_role.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b7280', mt: 0.5 }}>
              {selectedShiftForReassign && new Date(selectedShiftForReassign.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Typography>
                                </Box>
          <IconButton onClick={handleCloseReassignModal} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ pb: 2 }}>
          {selectedShiftForReassign && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ color: '#6b7280', mb: 1 }}>
                Shift Time: {selectedShiftForReassign.shift_template?.start_time || '08:00'} - {selectedShiftForReassign.shift_template?.end_time || '16:00'}
                                </Typography>
                                
              {/* Current Assignment Status */}
              <Box sx={{ 
                p: 2, 
                bgcolor: '#f8fafc', 
                borderRadius: 2, 
                border: '1px solid #e5e7eb',
                mb: 3
              }}>
                {(() => {
                  // Only show active staff assignments
                  const currentAssignments = assignments.filter(a => {
                    const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                    if (assignmentShiftId !== selectedShiftForReassign.id) return false;
                    const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                    const staffMember = staff.find(s => s.id === assignmentStaffId);
                    return staffMember && staffMember.status === 'active';
                  });
                  
                  if (currentAssignments.length > 0) {
                    return (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: '600', mb: 1 }}>
                          Currently Assigned:
                        </Typography>
                        {currentAssignments.map((assignment) => {
                          const assignedStaff = staff.find(s => {
                            const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
                            return s.id === assignmentStaffId;
                          });
                                      return assignedStaff ? (
                            <Box key={assignment.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ 
                                width: 8, 
                                height: 8, 
                                bgcolor: '#22c55e', 
                                borderRadius: '50%' 
                              }} />
                              <Typography variant="body2">
                                {assignedStaff.first_name} {assignedStaff.last_name}
                              </Typography>
                                        </Box>
                                      ) : null;
                                    })}
                                  </Box>
                    );
                  } else {
                    return (
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: '#dc2626' }}>
                          OPEN SHIFT
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>
                          {selectedShiftForReassign.required_staff_count} {selectedShiftForReassign.required_staff_role.split('_').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')} needed
                                  </Typography>
                                </Box>
                    );
                  }
                })()}
                              </Box>
              
              {/* Staff Selection */}
              <Typography variant="body2" sx={{ fontWeight: '600', mb: 2 }}>
                Assign Staff ({selectedShiftForReassign.required_staff_count} needed):
                                </Typography>
              
              {/* Show multiple assignment fields if more than 1 requirement */}
              {selectedShiftForReassign.required_staff_count > 1 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Array.from({ length: selectedShiftForReassign.required_staff_count }).map((_, index) => {
                    const currentAssignments = assignments.filter(a => {
                      const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                      if (assignmentShiftId !== selectedShiftForReassign.id) return false;
                      const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                      const staffMember = staff.find(s => s.id === assignmentStaffId);
                      return staffMember && staffMember.status === 'active';
                    });
                    
                    return (
                      <Box key={index}>
                        <Typography variant="caption" sx={{ color: '#6b7280', mb: 0.5, display: 'block' }}>
                          {selectedShiftForReassign.required_staff_role.split('_').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')} {index + 1} ({currentAssignments.length}/{selectedShiftForReassign.required_staff_count})
                        </Typography>
                        <FormControl fullWidth>
                          <Select
                            value={selectedStaffForReassign[index] || ''}
                            onChange={(e) => {
                              const newAssignments = [...selectedStaffForReassign];
                              newAssignments[index] = e.target.value;
                              setSelectedStaffForReassign(newAssignments);
                            }}
                            displayEmpty
                            sx={{ 
                              '& .MuiSelect-select': { 
                                py: 1.5 
                              } 
                            }}
                          >
                            <MenuItem value="">
                              <em>Leave open</em>
                            </MenuItem>
                            {staff
                              .filter(member => {
                                // Allow med_tech staff to work caregiver shifts (dual-role)
                                return member.role === selectedShiftForReassign.required_staff_role ||
                                       (selectedShiftForReassign.required_staff_role === 'caregiver' && member.role === 'med_tech');
                              })
                              .map((member) => {
                                const memberAssignments = assignments.filter(a => {
                                  const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                                  return assignmentStaffId === member.id;
                                });
                                const isAvailable = memberAssignments.length < (member.max_hours_per_week || 40);
                                
                                return (
                                  <MenuItem 
                                    key={member.id} 
                                    value={member.id}
                                    sx={{
                                      bgcolor: !isAvailable ? '#fef2f2' : 'transparent',
                                      color: !isAvailable ? '#dc2626' : 'inherit',
                                      '&:hover': {
                                        bgcolor: !isAvailable ? '#fee2e2' : '#f3f4f6'
                                      }
                                    }}
                                    disabled={!isAvailable}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                      <Box sx={{ 
                                        width: 8, 
                                        height: 8, 
                                        bgcolor: isAvailable ? '#22c55e' : '#dc2626', 
                                        borderRadius: '50%' 
                                      }} />
                                      <Typography variant="body2">
                                        {member.last_name}, {member.first_name}
                                      </Typography>
                                      <Typography variant="caption" sx={{ ml: 'auto', color: '#6b7280' }}>
                                        {memberAssignments.length}/{member.max_hours_per_week || 40}h
                                      </Typography>
                                    </Box>
                                  </MenuItem>
                                );
                              })}
                          </Select>
                        </FormControl>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <Select
                    value={selectedStaffForReassign[0] || ''}
                    onChange={(e) => {
                      const newAssignments = [...selectedStaffForReassign];
                      newAssignments[0] = e.target.value;
                      setSelectedStaffForReassign(newAssignments);
                    }}
                    displayEmpty
                    disabled={(() => {
                      const currentAssignments = assignments.filter(a => {
                        const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                        if (assignmentShiftId !== selectedShiftForReassign.id) return false;
                        const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                        const staffMember = staff.find(s => s.id === assignmentStaffId);
                        return staffMember && staffMember.status === 'active';
                      });
                      return currentAssignments.length >= selectedShiftForReassign.required_staff_count;
                    })()}
                    sx={{ 
                      '& .MuiSelect-select': { 
                        py: 1.5 
                      } 
                    }}
                  >
                    <MenuItem value="">
                      <em>Leave open</em>
                    </MenuItem>
                    {staff
                      .filter(member => {
                        // Allow med_tech staff to work caregiver shifts (dual-role)
                        return member.role === selectedShiftForReassign.required_staff_role ||
                               (selectedShiftForReassign.required_staff_role === 'caregiver' && member.role === 'med_tech');
                      })
                      .map((member) => {
                        const memberAssignments = assignments.filter(a => {
                          const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                          return assignmentStaffId === member.id;
                        });
                        const isAvailable = memberAssignments.length < (member.max_hours_per_week || 40);
                        
                        return (
                          <MenuItem 
                            key={member.id} 
                            value={member.id}
                            sx={{
                              bgcolor: !isAvailable ? '#fef2f2' : 'transparent',
                              color: !isAvailable ? '#dc2626' : 'inherit',
                              '&:hover': {
                                bgcolor: !isAvailable ? '#fee2e2' : '#f3f4f6'
                              }
                            }}
                            disabled={!isAvailable}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <Box sx={{ 
                                width: 8, 
                                height: 8, 
                                bgcolor: isAvailable ? '#22c55e' : '#dc2626', 
                                borderRadius: '50%' 
                              }} />
                              <Typography variant="body2">
                                {member.last_name}, {member.first_name}
                              </Typography>
                              <Typography variant="caption" sx={{ ml: 'auto', color: '#6b7280' }}>
                                {memberAssignments.length}/{member.max_hours_per_week || 40}h
                              </Typography>
                            </Box>
                          </MenuItem>
                        );
                      })}
                  </Select>
                </FormControl>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={handleCloseReassignModal} variant="outlined">
                Cancel
              </Button>
              <Button
            onClick={handleReassignSubmit} 
                variant="contained"
            disabled={selectedStaffForReassign.length === 0}
            sx={{ 
              bgcolor: selectedStaffForReassign.every(s => s === '') ? '#dc2626' : '#3b82f6',
              '&:hover': {
                bgcolor: selectedStaffForReassign.every(s => s === '') ? '#b91c1c' : '#2563eb'
              }
            }}
          >
            {selectedStaffForReassign.every(s => s === '') ? 'Leave Open' : 'Save Assignments'}
              </Button>
        </DialogActions>
      </Dialog>

      {/* Shift Detail Modal */}
      {shiftModalOpen && selectedShift && (
        <Dialog 
          open={shiftModalOpen} 
          onClose={handleCloseShiftModal}
          maxWidth="sm"
          fullWidth
          sx={{
            '& .MuiDialog-paper': {
              borderRadius: 3,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }
          }}
        >
          <DialogTitle sx={{ 
            pb: 2, 
            borderBottom: '1px solid #e5e7eb',
            bgcolor: '#f8fafc'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: '600', color: '#111827' }}>
                  {selectedShift.required_staff_role.split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
            </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', mt: 0.5 }}>
                  {new Date(selectedShift.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
            </Typography>
            </Box>
              <IconButton onClick={handleCloseShiftModal} sx={{ color: '#6b7280' }}>
                <DeleteIcon sx={{ transform: 'rotate(45deg)' }} />
              </IconButton>
        </Box>
          </DialogTitle>
          
          <DialogContent sx={{ p: 3 }}>
            {/* Time Display */}
            <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
              mb: 4,
              p: 3,
              bgcolor: '#f8fafc',
              borderRadius: 2,
              border: '1px solid #e5e7eb'
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: '700', color: '#111827', mb: 1 }}>
                  {selectedShift.shift_template?.start_time || '08:00'}
            </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                  {new Date(selectedShift.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Typography>
              </Box>
              
              <Typography variant="h6" sx={{ mx: 3, color: '#6b7280', fontWeight: '500' }}>
                to
              </Typography>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: '700', color: '#111827', mb: 1 }}>
                  {selectedShift.shift_template?.end_time || '16:00'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                  {new Date(selectedShift.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
              </Typography>
              </Box>
            </Box>

            {/* Assigned Staff */}
            {(() => {
              // Only show active staff assignments
              const shiftAssignments = assignments.filter(a => {
                const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                if (assignmentShiftId !== selectedShift.id) return false;
                const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                const staffMember = staff.find(s => s.id === assignmentStaffId);
                return staffMember && staffMember.status === 'active';
              });

              return shiftAssignments.length > 0 ? (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: '600', mb: 2, color: '#111827' }}>
                    Assigned Staff ({shiftAssignments.length}/{selectedShift.required_staff_count})
                  </Typography>
                  {shiftAssignments.map((assignment) => {
                    const assignedStaff = staff.find(s => {
                      const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
                      return s.id === assignmentStaffId;
                    });
                    
                    if (!assignedStaff) return null;
                    
                    return (
                      <Box key={assignment.id} sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        mb: 2,
                        bgcolor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 2,
                        '&:hover': {
                          bgcolor: '#f9fafb'
                        }
                      }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: '600', color: '#111827' }}>
                            {assignedStaff.first_name} {assignedStaff.last_name}
                          </Typography>
                                  <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    {assignedStaff.role.split('_').map(word => 
                                      word.charAt(0).toUpperCase() + word.slice(1)
                                    ).join(' ')}
                                  </Typography>
                        </Box>
                        <IconButton 
                          onClick={() => {
                            handleUnassignStaff(selectedShift.id, assignedStaff.id);
                            handleCloseShiftModal();
                          }}
                          sx={{ 
                            color: '#dc2626',
                            '&:hover': {
                              bgcolor: '#fee2e2'
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  p: 4,
                  bgcolor: '#f0fdf4',
                  border: '2px dashed #22c55e',
                  borderRadius: 2,
                  mb: 3
                }}>
                  <Typography variant="h6" sx={{ color: '#166534', fontWeight: '600' }}>
                    OPEN SHIFT
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#166534', mt: 1 }}>
                    {selectedShift.required_staff_count} {selectedShift.required_staff_role.split('_').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')} needed
                  </Typography>
                </Box>
              );
            })()}
          </DialogContent>
          
          <DialogActions sx={{ 
            p: 3, 
            pt: 0,
            borderTop: '1px solid #e5e7eb',
            bgcolor: '#f8fafc'
          }}>
              <Button
                onClick={() => {
                // Reassign functionality
                setSnackbar({
                  open: true,
                  message: 'Reassign functionality coming soon',
                  severity: 'info'
                  });
                }}
              startIcon={<PeopleIcon />}
              sx={{ borderRadius: 2 }}
              >
              Reassign
                              </Button>
                <Button
              onClick={() => {
                // Edit functionality
                setSnackbar({
                  open: true,
                  message: 'Edit functionality coming soon',
                  severity: 'info'
                });
              }}
              startIcon={<EditIcon />}
              sx={{ borderRadius: 2 }}
            >
              Edit
                </Button>
            <Button
              onClick={() => {
                // Delete shift functionality
                setSnackbar({
                  open: true,
                  message: 'Delete shift functionality coming soon',
                  severity: 'info'
                });
              }}
              startIcon={<DeleteIcon />}
              color="error"
              sx={{ borderRadius: 2 }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Confirmation Dialog for Daily Hours Conflict */}
      <Dialog
        open={confirmationDialog.open}
        onClose={handleConfirmDialogCancel}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 3,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 2, 
          borderBottom: '1px solid #e5e7eb',
          bgcolor: '#fef3c7'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: '600', color: '#92400e' }}>
              {confirmationDialog.title}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {confirmationDialog.message}
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={handleConfirmDialogCancel} 
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDialogConfirm} 
            variant="contained"
            color="warning"
            sx={{ borderRadius: 2 }}
          >
            Yes, Assign Anyway
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Assignment Summary Panel */}
      {(() => {
        const weekStartStr = getWeekStart();
        const weekStart = new Date(weekStartStr);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        // Filter shifts to only current week
        const currentWeekShifts = shifts.filter(shift => {
          const shiftDate = new Date(shift.date);
          shiftDate.setHours(0, 0, 0, 0);
          return shiftDate >= weekStart && shiftDate <= weekEnd;
        });
        
        // Calculate unfilled shifts by type - only count shifts in current week
        const unfilledDayShifts = currentWeekShifts.filter(shift => {
          // Check shift type - could be in shift_template or directly on shift
          const shiftType = shift.shift_template?.shift_type || shift.shift_type;
          if (shiftType !== 'day' && shiftType !== 'DAY') return false;
          
          const assignedCount = assignments.filter(a => {
            const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
            if (assignmentShiftId !== shift.id) return false;
            const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
            const staffMember = staff.find(s => s.id === assignmentStaffId);
            return staffMember && staffMember.status === 'active';
          }).length;
          return assignedCount < shift.required_staff_count;
        }).length;

        const unfilledNOCShifts = currentWeekShifts.filter(shift => {
          // Check shift type - could be in shift_template or directly on shift
          const shiftType = shift.shift_template?.shift_type || shift.shift_type;
          if (shiftType !== 'noc' && shiftType !== 'NOC') return false;
          
          const assignedCount = assignments.filter(a => {
            const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
            if (assignmentShiftId !== shift.id) return false;
            const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
            const staffMember = staff.find(s => s.id === assignmentStaffId);
            return staffMember && staffMember.status === 'active';
          }).length;
          return assignedCount < shift.required_staff_count;
        }).length;

        // Calculate overbooked staff (staff with multiple shifts on same day or exceeding max hours)
        // Only count assignments in the current week
        const staffDailyCounts = {};
        const staffWeeklyHours = {};
        const processedAssignments = new Set(); // Track to avoid duplicates

        // Normalize week boundaries to start of day for accurate comparison
        const weekStartDate = new Date(weekStart);
        weekStartDate.setHours(0, 0, 0, 0);
        const weekEndDate = new Date(weekEnd);
        weekEndDate.setHours(23, 59, 59, 999); // End of day

        console.log('🔍 Week boundaries for OT calculation:', {
          weekStart: weekStartDate.toISOString(),
          weekEnd: weekEndDate.toISOString(),
          weekStartStr: weekStart,
          weekEndStr: weekEnd.toISOString().split('T')[0]
        });

        assignments.forEach(assignment => {
          // Skip if we've already processed this assignment
          if (processedAssignments.has(assignment.id)) {
            console.warn(`⚠️ Duplicate assignment detected:`, assignment.id);
            return;
          }
          processedAssignments.add(assignment.id);
          
          const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
          const assignmentShiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
          const shift = shifts.find(s => s.id === assignmentShiftId);
          if (!shift) {
            console.warn(`⚠️ Assignment ${assignment.id} references non-existent shift ${assignmentShiftId}`);
            return;
          }

          // Only count shifts in the current week - normalize shift date to start of day
          const shiftDate = new Date(shift.date);
          shiftDate.setHours(0, 0, 0, 0);
          
          // Skip if shift is outside current week
          if (shiftDate < weekStartDate || shiftDate > weekEndDate) {
            return;
          }

          const staffMember = staff.find(s => s.id === assignmentStaffId);
          if (!staffMember || staffMember.status !== 'active') return;

          // Track daily assignments
          const dateKey = shiftDate.toISOString().split('T')[0];
          if (!staffDailyCounts[assignmentStaffId]) {
            staffDailyCounts[assignmentStaffId] = {};
          }
          if (!staffDailyCounts[assignmentStaffId][dateKey]) {
            staffDailyCounts[assignmentStaffId][dateKey] = 0;
          }
          staffDailyCounts[assignmentStaffId][dateKey]++;

          // Track weekly hours - only for current week (using shared helper)
          if (shift.shift_template) {
            const hours = getShiftHours(shift);
            
            if (!staffWeeklyHours[assignmentStaffId]) {
              staffWeeklyHours[assignmentStaffId] = 0;
            }
            staffWeeklyHours[assignmentStaffId] += hours;
            
            // Debug: Log assignment details for specific staff
            const staffMember = staff.find(s => s.id === assignmentStaffId);
            if (staffMember && ['MADISON CATRON', 'LINDA CUSTER', 'ALIA FLORES-HUNGERFORD'].some(name => 
              staffMember.full_name?.toUpperCase().includes(name.split(' ')[0]) || 
              (staffMember.first_name + ' ' + staffMember.last_name).toUpperCase().includes(name.split(' ')[0])
            )) {
              console.log(`🔍 Assignment for ${staffMember.full_name || (staffMember.first_name + ' ' + staffMember.last_name)}:`, {
                assignmentId: assignment.id,
                shiftId: assignmentShiftId,
                shiftDate: shift.date,
                shiftType: shift.shift_template.shift_type,
                hours: hours.toFixed(1),
                startTime: shift.shift_template.start_time,
                endTime: shift.shift_template.end_time,
                cumulativeHours: (staffWeeklyHours[assignmentStaffId] || 0).toFixed(1),
                inWeekRange: shiftDate >= weekStartDate && shiftDate <= weekEndDate
              });
            }
            
            // Debug: Log if hours seem wrong
            if (hours > 16 || hours < 0) {
              console.warn(`⚠️ Unusual shift hours detected:`, {
                staffId: assignmentStaffId,
                shiftId: assignmentShiftId,
                date: shift.date,
                startTime: shift.shift_template.start_time,
                endTime: shift.shift_template.end_time,
                calculatedHours: hours
              });
            }
          } else {
            console.warn(`⚠️ Assignment without shift_template:`, {
              assignmentId: assignment.id,
              shiftId: assignmentShiftId,
              staffId: assignmentStaffId
            });
          }
        });

        // Find overbooked staff - only count those who exceed max hours (not just multiple shifts on same day)
        const overbookedStaffList = Object.keys(staffWeeklyHours).filter(staffId => {
          const staffMember = staff.find(s => s.id === parseInt(staffId));
          if (!staffMember) return false;
          
          // Only count if hours EXCEED max_hours (not at limit, not under)
          const maxHours = staffMember.max_hours || 40;
          const totalHours = staffWeeklyHours[staffId];
          const isOver = totalHours > maxHours;
          
          // Debug logging
          if (isOver) {
            console.log(`🔍 Overbooked Staff Found: ${staffMember.first_name} ${staffMember.last_name}`, {
              totalHours: totalHours.toFixed(1),
              maxHours,
              hoursOver: (totalHours - maxHours).toFixed(1),
              staffId: parseInt(staffId)
            });
          }
          
          return isOver;
        }).map(staffId => {
          const staffMember = staff.find(s => s.id === parseInt(staffId));
          return {
            id: parseInt(staffId),
            name: staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Unknown',
            hours: staffWeeklyHours[staffId],
            maxHours: staffMember?.max_hours || 40,
            hoursOver: staffWeeklyHours[staffId] - (staffMember?.max_hours || 40)
          };
        });
        
        const overbookedStaff = overbookedStaffList.length;
        
        // Debug: Log ALL staff hours for verification (not just overbooked)
        console.log('🔍 ALL Staff Weekly Hours Summary:', {
          totalStaffWithAssignments: Object.keys(staffWeeklyHours).length,
          overbookedCount: overbookedStaff,
          allStaffHours: Object.keys(staffWeeklyHours).map(staffId => {
            const staffMember = staff.find(s => s.id === parseInt(staffId));
            const totalHours = staffWeeklyHours[staffId];
            const maxHours = staffMember?.max_hours || 40;
            const isOver = totalHours > maxHours;
            
            // Get assignment details for this staff
            const staffAssignments = assignments.filter(a => {
              const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
              return assignmentStaffId === parseInt(staffId);
            });
            
            return {
              name: staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Unknown',
              hours: totalHours.toFixed(1),
              maxHours,
              isOver,
              hoursOver: isOver ? (totalHours - maxHours).toFixed(1) : 0,
              assignmentCount: staffAssignments.length,
              staffId: parseInt(staffId)
            };
          }).sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours))
        });
        
        // Log only overbooked staff details
        if (overbookedStaff > 0) {
          console.log('🔍 OVERBOOKED Staff Details:', overbookedStaffList);
        } else {
          console.log('✅ No staff are overbooked - all within max hours');
        }

        // Calculate OT cost impact - only count hours that exceed max_hours in current week
        // OT premium is typically 0.5x (so 1.5x total rate = 1x base + 0.5x premium)
        let otCostImpact = 0;
        Object.keys(staffWeeklyHours).forEach(staffId => {
          const staffMember = staff.find(s => s.id === parseInt(staffId));
          if (staffMember && staffMember.max_hours && staffMember.hourly_rate) {
            const totalHours = staffWeeklyHours[staffId];
            const hoursOver = totalHours - staffMember.max_hours;
            // Only count if actually over the limit (not just at limit)
            if (hoursOver > 0) {
              // Calculate OT premium: hours over max * hourly rate * 0.5 (the premium portion)
              otCostImpact += hoursOver * staffMember.hourly_rate * 0.5;
            }
          }
        });

        return (
          <Paper
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 280,
              p: 2,
              boxShadow: 4,
              zIndex: 1000,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, fontSize: 14 }}>
              Assignment Summary
            </Typography>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12, mb: 0.25 }}>
                  Unfilled Day Shifts
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: unfilledDayShifts > 0 ? 'error.main' : 'success.main' }}>
                  {unfilledDayShifts}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12, mb: 0.25 }}>
                  Unfilled NOC Shifts
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: unfilledNOCShifts > 0 ? 'error.main' : 'success.main' }}>
                  {unfilledNOCShifts}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12, mb: 0.25 }}>
                  Overbooked Staff
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: overbookedStaff > 0 ? 'warning.main' : 'success.main' }}>
                  {overbookedStaff}
                </Typography>
                {overbookedStaff > 0 && (
                  <Tooltip 
                    title={
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                          Staff Exceeding Max Hours:
                        </Typography>
                        {overbookedStaffList.map((staff, idx) => (
                          <Typography key={idx} variant="caption" sx={{ display: 'block' }}>
                            • {staff.name}: {staff.hours.toFixed(1)}h / {staff.maxHours}h ({staff.hoursOver.toFixed(1)}h over)
                          </Typography>
                        ))}
                      </Box>
                    }
                    arrow
                    placement="left"
                  >
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'warning.main', 
                        fontSize: 10, 
                        cursor: 'help',
                        textDecoration: 'underline',
                        textDecorationStyle: 'dotted'
                      }}
                    >
                      (Hover to see details)
                    </Typography>
                  </Tooltip>
                )}
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12, mb: 0.25 }}>
                  OT Cost Impact
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: otCostImpact > 0 ? 'warning.main' : 'success.main' }}>
                  {otCostImpact > 0 ? `+$${otCostImpact.toFixed(0)}` : '$0'}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        );
      })()}
    </Box>
  );
});

export default WeeklyPlanner;
