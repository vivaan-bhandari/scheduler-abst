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
} from '@mui/material';
import {
  Add as AddIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  FileDownload as FileDownloadIcon,
  Print as PrintIcon,
  AutoFixHigh as AutoFillIcon,
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
  CalendarToday as CalendarTodayIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
  const [confirmationDialog, setConfirmationDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

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
        `${API_BASE_URL}/api/scheduling/shifts/?facility=${facilityId}&week_start=${weekStart}`,
        `${API_BASE_URL}/api/scheduling/staff/?facility=${facilityId}`,
        `${API_BASE_URL}/api/scheduling/assignments/?facility=${facilityId}&week_start=${weekStart}`
      ]);

      console.log('🔍 WeeklyPlanner: Making API calls with token:', token ? `${token.substring(0, 20)}...` : 'No token');
      
      const [shiftsResponse, staffResponse, assignmentsResponse] = await Promise.all([
        api.get(`/api/scheduling/shifts/?facility=${facilityId}&week_start=${weekStart}`),
        api.get(`/api/scheduling/staff/?facility=${facilityId}`),
        api.get(`/api/scheduling/assignments/?facility=${facilityId}&week_start=${weekStart}`)
      ]);

      console.log('🔍 WeeklyPlanner: API responses:');
      console.log('  - Shifts:', shiftsResponse.data);
      console.log('  - Staff:', staffResponse.data);
      console.log('  - Assignments:', assignmentsResponse.data);

      const shiftsData = shiftsResponse.data.results || [];
      const staffData = staffResponse.data.results || staffResponse.data || [];
      const assignmentsData = assignmentsResponse.data.results || [];

      console.log('🔍 WeeklyPlanner: Processed data:');
      console.log('  - Shifts count:', shiftsData.length);
      console.log('  - Staff count:', staffData.length);
      console.log('  - Assignments count:', assignmentsData.length);

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
    return monday.toISOString().split('T')[0];
  };

  const getWeekDays = () => {
    const startDate = new Date(getWeekStart());
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      return date;
    });
  };

  const handleAutoFill = async () => {
    const weekStart = getWeekStart();
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
      for (const shift of weekShifts) {
      // Only count assignments with active staff
      const currentAssignments = assignments.filter(a => {
        const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
        if (assignmentShiftId !== shift.id) return false;
        const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
        const staffMember = staff.find(s => s.id === assignmentStaffId);
        return staffMember && staffMember.status === 'active';
      });
      const needed = shift.required_staff_count - currentAssignments.length;
      
      if (needed <= 0) continue;

          const availableStaff = staff.filter(member => {
        const alreadyAssigned = assignments.some(a => {
          const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
          const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
          return assignmentShiftId === shift.id && assignmentStaffId === member.id;
        });
            if (alreadyAssigned) return false;
            
            const staffAssignments = getAssignmentsForStaff(member.id);
            // Calculate actual hours from shift templates
            const hoursUsed = staffAssignments.reduce((total, assignment) => {
              const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
              const shift = shifts.find(s => s.id === shiftId);
              if (shift && shift.shift_template) {
                // Calculate hours from shift template
                const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
                const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
                const hours = (endTime - startTime) / (1000 * 60 * 60);
                return total + hours;
              }
              return total;
            }, 0);
            return hoursUsed < member.max_hours;
          });
          
      for (let i = 0; i < Math.min(needed, availableStaff.length); i++) {
        try {
          // Check for daily hours conflict before making assignment
          const hasConflict = checkDailyHoursConflict(availableStaff[i].id, shift.id, null, null);
          
          if (hasConflict) {
            console.log(`⚠️ Skipping ${availableStaff[i].full_name} - would work 8+ hours on ${new Date(shift.date).toLocaleDateString()}`);
            continue; // Skip this staff member
          }
          
          await api.post(`/api/scheduling/assignments/`, {
            shift: shift.id,
            staff: availableStaff[i].id
          });
              assignmentsCreated++;
            } catch (error) {
          console.error('Error creating assignment:', error);
          }
        }
      }
      
      if (assignmentsCreated > 0) {
        setSnackbar({ 
          open: true, 
          message: `Auto-fill completed! Created ${assignmentsCreated} assignments.`, 
          severity: 'success' 
        });
        fetchData();
      } else {
        setSnackbar({ 
          open: true, 
          message: 'No new assignments could be created. All shifts may be filled or no staff available.', 
          severity: 'info' 
      });
    }
  };

  const handleClearAssignments = async () => {
    const weekStart = getWeekStart();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekAssignments = assignments.filter(assignment => {
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
      
    for (const assignment of weekAssignments) {
      try {
        await api.delete(`/api/scheduling/assignments/${assignment.id}/`);
      } catch (error) {
        console.error('Error removing assignment:', error);
      }
    }
      
      setSnackbar({ 
        open: true, 
        message: `Schedule cleared successfully! Removed ${weekAssignments.length} assignments.`, 
        severity: 'success' 
      });
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
    if (draggedStaff.role !== shift.required_staff_role) {
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
    
    // Check if staff member has reached max hours
    const staffAssignments = assignments.filter(a => {
      const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
      return assignmentStaffId === draggedStaff.id;
    });
    
    // Calculate actual hours from shift templates
    const hoursUsed = staffAssignments.reduce((total, assignment) => {
      const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      const shift = shifts.find(s => s.id === shiftId);
      if (shift && shift.shift_template) {
        // Calculate hours from shift template
        const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
        const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
        const hours = (endTime - startTime) / (1000 * 60 * 60);
        console.log(`🔍 Assignment hours for ${draggedStaff.full_name}:`, {
          shiftId,
          shiftDate: shift.date,
          startTime: shift.shift_template.start_time,
          endTime: shift.shift_template.end_time,
          hours
        });
        return total + hours;
      }
      return total;
    }, 0);
    
    console.log('🔍 Total hours used for', draggedStaff.full_name, ':', hoursUsed, 'from', staffAssignments.length, 'assignments');
    console.log('🔍 All assignments for debugging:', assignments);
    console.log('🔍 Staff assignments details:', staffAssignments);
    
    // Calculate hours for the shift being assigned
    const targetShift = shifts.find(s => s.id === shift.id);
    let targetShiftHours = 8; // default
    if (targetShift && targetShift.shift_template) {
      const startTime = new Date(`1970-01-01T${targetShift.shift_template.start_time}`);
      const endTime = new Date(`1970-01-01T${targetShift.shift_template.end_time}`);
      targetShiftHours = (endTime - startTime) / (1000 * 60 * 60);
    }
    
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
      
      // Delete the assignment
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('🔍 No auth token found!');
        setSnackbar({
          open: true,
          message: 'Authentication required. Please log in again.',
          severity: 'error'
        });
        return;
      }
      
      console.log('🔍 Sending DELETE request with token:', token.substring(0, 20) + '...');
      await api.delete(`/api/scheduling/assignments/${assignment.id}/`);
      
      console.log('🔍 Assignment deleted successfully');
      setSnackbar({ 
        open: true, 
        message: 'Staff member unassigned successfully',
        severity: 'success'
      });
      
      // Refresh data to show updated assignments
      fetchData();
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
        
        // Check weekly hours conflict
        const staffAssignments = assignments.filter(assignment => {
          const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
          return assignmentStaffId === staffId;
        });

        const hoursUsed = staffAssignments.reduce((total, assignment) => {
          const assignmentShiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
          const shift = shifts.find(s => s.id === assignmentShiftId);
          if (shift && shift.shift_template) {
            const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
            const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
            const hours = (endTime - startTime) / (1000 * 60 * 60);
            return total + hours;
          }
          return total;
        }, 0);

        // Calculate hours for the new shift
        let newShiftHours = 0;
        if (selectedShiftForReassign.shift_template) {
          const startTime = new Date(`1970-01-01T${selectedShiftForReassign.shift_template.start_time}`);
          const endTime = new Date(`1970-01-01T${selectedShiftForReassign.shift_template.end_time}`);
          newShiftHours = (endTime - startTime) / (1000 * 60 * 60);
        }

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
      const applyResponse = await api.post(`/api/scheduling/ai-recommendations/apply_weekly_recommendations/`, {
        facility: facilityId,
        week_start: weekStart
      });
      
      console.log('🔍 WeeklyPlanner: Apply response:', applyResponse.data);
      setSnackbar({ 
        open: true, 
        message: `Successfully applied AI recommendations! Created ${applyResponse.data.shifts_created} new shifts and updated ${applyResponse.data.shifts_updated} existing shifts.`, 
        severity: 'success' 
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
    const staffAssignments = assignments.filter(assignment => {
      const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
      return assignmentStaffId === staffMember.id;
    });
    
    // Calculate actual hours from shift templates
    const hoursUsed = staffAssignments.reduce((total, assignment) => {
      const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
      const shift = shifts.find(s => s.id === shiftId);
      if (shift && shift.shift_template) {
        // Calculate hours from shift template
        const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
        const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
        const hours = (endTime - startTime) / (1000 * 60 * 60);
        return total + hours;
      }
      return total;
    }, 0);
    
    const maxHours = staffMember.max_hours;
    
    if (hoursUsed >= maxHours) return 'over_max';
    if (hoursUsed >= maxHours * 0.8) return 'near_max';
    return 'available';
  };

  const getAssignmentsForStaff = (staffId) => {
    const staffAssignments = assignments.filter(assignment => {
      const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
      return assignmentStaffId === staffId;
    });
    return staffAssignments;
  };

  const filteredStaff = staff.filter(member => {
    // Only show active staff (not inactive, terminated, or on_leave)
    const isActive = member.status === 'active';
    const matchesSearch = member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.last_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const showOnLeave = !hideOnLeave || member.status !== 'on_leave';
    return isActive && matchesSearch && matchesRole && showOnLeave;
  });

  const handleExportCSV = () => {
    // CSV export logic
    setSnackbar({ open: true, message: 'CSV export functionality coming soon', severity: 'info' });
  };

  const handleExportICS = () => {
    // ICS export logic
    setSnackbar({ open: true, message: 'ICS export functionality coming soon', severity: 'info' });
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
      const staffAssignmentsForValidation = assignments.filter(assignment => {
        const assignmentStaffId = typeof assignment.staff === 'object' ? assignment.staff?.id : assignment.staff;
        return assignmentStaffId === staff.id;
      });
      let actualWeeklyHours = 0;
      for (const assignment of staffAssignmentsForValidation) {
        const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
        const shift = shifts.find(s => s.id === shiftId);
        if (shift && shift.shift_template) {
          const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
          const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
          
          // Handle overnight shifts (e.g., 22:00-06:00)
          let hours = (endTime - startTime) / (1000 * 60 * 60);
          if (hours < 0) {
            // If negative, it means the shift crosses midnight, add 24 hours
            hours += 24;
          }
          
          actualWeeklyHours += hours;
        }
      }
      
      // Weekly overtime alert (40+ hours)
      if (actualWeeklyHours > 40) {
        alerts.push({
          type: 'weekly_overtime',
          severity: 'error',
          staff: staff,
          hours: actualWeeklyHours,
          message: `${staff.full_name} is scheduled for ${actualWeeklyHours.toFixed(1)} hours this week (exceeds 40-hour limit)`
        });
      } else if (actualWeeklyHours >= 40) {
        alerts.push({
          type: 'weekly_hours_reached',
          severity: 'warning',
          staff: staff,
          hours: actualWeeklyHours,
          message: `${staff.full_name} is scheduled for ${actualWeeklyHours.toFixed(1)} hours this week (reaches 40-hour limit)`
        });
      } else if (actualWeeklyHours >= 32 && actualWeeklyHours < 40) {
        // Also warn if they're close to the limit (32+ hours, meaning one more 8-hour shift would reach/exceed 40)
        alerts.push({
          type: 'weekly_hours_warning',
          severity: 'warning',
          staff: staff,
          hours: actualWeeklyHours,
          message: `${staff.full_name} is at ${actualWeeklyHours.toFixed(1)}/40 hours - one more shift would reach the weekly limit`
        });
      }
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
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">Loading planner...</Typography>
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
              {/* Sticky Top Summary Section */}
              <Box sx={{ 
                position: 'sticky',
                top: 0,
                zIndex: 100,
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e5e7eb',
                p: 2,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
          Summary
        </Typography>
        
        {/* Summary Cards and AI Button Row */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 2
        }}>
          {/* Compact Summary Cards */}
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1.5
                  }}>
                    <Box sx={{ 
                      p: 1.5, 
                      bgcolor: '#ffffff', 
                      borderRadius: 2, 
                      border: '1px solid #e2e8f0',
                      textAlign: 'center',
                      minWidth: 100
                    }}>
              <Typography variant="h4" sx={{ fontWeight: '700', color: '#1e40af', mb: 0.5 }}>
                {staff.length}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: '500', fontSize: '0.875rem' }}>
                Total Staff
              </Typography>
            </Box>
            
                    <Box sx={{ 
                      p: 1.5, 
                      bgcolor: '#ffffff', 
                      borderRadius: 2, 
                      border: '1px solid #e2e8f0',
                      textAlign: 'center',
                      minWidth: 100
                    }}>
                      <Typography variant="h4" sx={{ fontWeight: '700', color: '#059669', mb: 0.5 }}>
                        {shifts.length}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: '500', fontSize: '0.875rem' }}>
                        Total Shifts
                      </Typography>
                    </Box>
                    
                    <Box sx={{ 
                      p: 1.5, 
                      bgcolor: '#ffffff', 
                      borderRadius: 2, 
                      border: '1px solid #e2e8f0',
                      textAlign: 'center',
                      minWidth: 100
                    }}>
                      <Typography variant="h4" sx={{ fontWeight: '700', color: '#dc2626', mb: 0.5 }}>
                        {shifts.filter(shift => {
                          const assignedCount = assignments.filter(a => {
                            const assignmentShiftId = typeof a.shift === 'object' ? a.shift?.id : a.shift;
                            if (assignmentShiftId !== shift.id) return false;
                            const assignmentStaffId = typeof a.staff === 'object' ? a.staff?.id : a.staff;
                            const staffMember = staff.find(s => s.id === assignmentStaffId);
                            return staffMember && staffMember.status === 'active';
                          }).length;
                          return assignedCount < shift.required_staff_count;
                        }).length}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: '500', fontSize: '0.875rem' }}>
                        Open Shifts
          </Typography>
        </Box>
        
                    <Box sx={{ 
                      p: 1.5, 
                      bgcolor: '#ffffff', 
                      borderRadius: 2, 
                      border: '1px solid #e2e8f0',
                      textAlign: 'center',
                      minWidth: 100
                    }}>
              <Typography variant="h4" sx={{ fontWeight: '700', color: '#f59e0b', mb: 0.5 }}>
                {Math.round((assignments.length / (shifts.reduce((sum, shift) => sum + shift.required_staff_count, 0)) || 0) * 100)}%
        </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: '500', fontSize: '0.875rem' }}>
                Coverage
              </Typography>
            </Box>
          </Box>

          {/* AI Recommendations Button */}
          <Button
            variant="contained"
            onClick={handleApplyAIRecommendations}
            disabled={loading || applying}
            startIcon={<SmartToyIcon />}
            sx={{ 
              backgroundColor: '#10b981',
              px: 3,
              py: 1.5,
              borderRadius: 2,
              fontWeight: '600',
              '&:hover': { backgroundColor: '#059669' }
            }}
          >
            Apply AI Recommendations
          </Button>
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
            onClick={handleAutoFill}
            disabled={loading}
            startIcon={<AutoFillIcon />}
            sx={{ borderRadius: 2, fontSize: '0.8rem' }}
          >
            AutoFill
          </Button>
          
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
            onClick={handleExportICS}
            disabled={loading}
            startIcon={<CalendarTodayIcon />}
            sx={{ borderRadius: 2, fontSize: '0.8rem' }}
          >
            Export ICS
          </Button>
          </Box>
        </Box>

        {/* Validation Alerts */}
        {validationAlerts.length > 0 && (
          <Box sx={{ p: 2, pb: 0 }}>
            {validationAlerts.map((alert, index) => (
              <Alert 
                key={index}
                severity={alert.severity}
                sx={{ 
                  mb: 1,
                  borderRadius: 2,
                  '& .MuiAlert-message': {
                    width: '100%'
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
          <Box sx={{ mb: 2, textAlign: 'center', p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: '600', color: '#1a1a1a', mb: 0.5 }}>
              {getWeekLabel(selectedWeek)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Facility: {facilityId ? `ID: ${facilityId}` : 'No facility selected'}
            </Typography>
        </Box>


          {/* Uniform Table Structure */}
          <TableContainer sx={{ 
            maxHeight: 'calc(100vh - 420px)',
            border: '2px solid #e5e7eb',
            borderRadius: 3,
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
                    minWidth: 120,
                    fontSize: '1rem',
                    py: 3,
                    px: 3
                  }}>
                    Shift Type
                  </TableCell>
                  {getWeekDays().map((day) => (
                    <TableCell 
                      key={day.toISOString()}
                      sx={{ 
                        fontWeight: '700', 
                        backgroundColor: '#f8fafc',
                        borderBottom: '2px solid #e5e7eb',
                        borderRight: '1px solid #e5e7eb',
                        textAlign: 'center',
                        minWidth: 160,
                        fontSize: '1rem',
                        py: 3,
                        px: 2
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: '700', color: '#111827', mb: 0.5 }}>
                          {day.toLocaleDateString('en-US', { weekday: 'long' })}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280', fontWeight: '500' }}>
                          {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Typography>
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {['DAY', 'SWING', 'NOC'].map((shiftType) => {
                  const shiftTypeInfo = {
                    DAY: { color: '#3b82f6', bg: '#eff6ff', time: '6:00 AM - 2:00 PM' },
                    SWING: { color: '#f59e0b', bg: '#fffbeb', time: '2:00 PM - 10:00 PM' },
                    NOC: { color: '#8b5cf6', bg: '#f3e8ff', time: '10:00 PM - 6:00 AM' }
                  };
                  
                  return (
                    <TableRow key={shiftType}>
                      {/* Shift Type Header */}
                      <TableCell sx={{ 
                        fontWeight: '600', 
                        backgroundColor: '#ffffff',
                        borderRight: '2px solid #e5e7eb',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '1rem',
                        py: 3,
                        px: 3,
                        verticalAlign: 'top'
                      }}>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          p: 2,
                          bgcolor: shiftTypeInfo[shiftType].bg,
                          borderRadius: 2,
                          border: `2px solid ${shiftTypeInfo[shiftType].color}20`
                        }}>
                          <Box sx={{ 
                            width: 12, 
                            height: 12, 
                            bgcolor: shiftTypeInfo[shiftType].color, 
                            borderRadius: '50%',
                            mr: 1.5
                          }} />
                          <Box>
                            <Typography variant="subtitle1" sx={{ 
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
                        const dayShifts = shifts.filter(s => {
                          const shiftDate = new Date(s.date);
                          return shiftDate.toDateString() === day.toDateString() && 
                                 (s.shift_template?.shift_type || 'DAY').toUpperCase() === shiftType;
                        });
                        
                        return (
                          <TableCell 
                            key={`${shiftType}-${day.toISOString()}`}
                            sx={{ 
                              border: '1px solid #e5e7eb',
                              verticalAlign: 'top',
                              bgcolor: '#ffffff',
                              p: 2,
                              minHeight: 200
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
                                  
                                  return (
                                    <Box 
                                      key={shift.id}
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
                                          {assignedStaff.map((staffMember, index) => (
                                            <Box key={index} sx={{ 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              justifyContent: 'space-between',
                                              p: 0.75,
                                              bgcolor: '#ffffff',
                                              borderRadius: 1,
                                              border: '1px solid #e5e7eb',
                                              mb: 0.5
                                            }}>
                                              <Typography variant="caption" sx={{ 
                                                fontWeight: '500',
                                                color: '#111827',
                                                fontSize: '0.75rem'
                                              }}>
                                                {staffMember.first_name} {staffMember.last_name}
                                              </Typography>
                                              <IconButton 
                                                size="small" 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUnassignStaff(shift.id, staffMember.id);
                                                }}
                                                sx={{ 
                                                  width: 16, 
                                                  height: 16, 
                                                  '&:hover': { bgcolor: '#fee2e2' } 
                                                }}
                                              >
                                                <DeleteIcon sx={{ fontSize: 10, color: '#dc2626' }} />
                                              </IconButton>
                                            </Box>
                                          ))}
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
              Staff Members
              <IconButton 
                onClick={() => setStaffPanelOpen(false)} 
                size="small"
                sx={{ ml: 'auto' }}
              >
                <ExpandLessIcon />
              </IconButton>
        </Typography>
        
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
          
                <FormControl fullWidth size="small">
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
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
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
                const staffAssignments = getAssignmentsForStaff(member.id);
                
                // Calculate actual hours from shift templates - SIMPLE VERSION
                let hoursUsed = 0;
                for (const assignment of staffAssignments) {
                  const shiftId = typeof assignment.shift === 'object' ? assignment.shift?.id : assignment.shift;
                  const shift = shifts.find(s => s.id === shiftId);
                  if (shift && shift.shift_template) {
                    const startTime = new Date(`1970-01-01T${shift.shift_template.start_time}`);
                    const endTime = new Date(`1970-01-01T${shift.shift_template.end_time}`);
                    
                    // Handle overnight shifts (e.g., 22:00-06:00)
                    let hours = (endTime - startTime) / (1000 * 60 * 60);
                    if (hours < 0) {
                      // If negative, it means the shift crosses midnight, add 24 hours
                      hours += 24;
                    }
                    
                    hoursUsed += hours;
                  }
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
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            {hoursUsed}/{member.max_hours} hours
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
                              .filter(member => member.role === selectedShiftForReassign.required_staff_role)
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
                      .filter(member => member.role === selectedShiftForReassign.required_staff_role)
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
    </Box>
  );
});

export default WeeklyPlanner;
