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
} from '@mui/material';
import {
  Add as AddIcon,
  Clear as ClearIcon,
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
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { useWeek } from '../../contexts/WeekContext';

const WeeklyPlanner = forwardRef(({ facilityId, refreshTrigger }, ref) => {
  const { selectedWeek, getWeekLabel } = useWeek();
  const [currentWeek, setCurrentWeek] = useState(() => {
    const globalWeek = selectedWeek ? new Date(selectedWeek) : new Date('2025-07-21');
    return globalWeek;
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
    if (!facilityId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
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

      const [shiftsResponse, staffResponse, assignmentsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/scheduling/shifts/?facility=${facilityId}&week_start=${weekStart}`),
        axios.get(`${API_BASE_URL}/api/scheduling/staff/?facility=${facilityId}`),
        axios.get(`${API_BASE_URL}/api/scheduling/assignments/?facility=${facilityId}&week_start=${weekStart}`)
      ]);

      setShifts(shiftsResponse.data.results || []);
      setStaff(staffResponse.data.results || []);
      
      // Normalize assignments data structure
      const normalizedAssignments = (assignmentsResponse.data.results || []).map(assignment => {
        const normalized = { ...assignment };
        if (assignment.shift_id && !assignment.shift) {
          normalized.shift = assignment.shift_id;
        } else if (assignment.shift) {
          normalized.shift = assignment.shift;
        }
        return normalized;
      });
      
      setAssignments(normalizedAssignments);
    } catch (error) {
      console.error('Error fetching data:', error);
      setSnackbar({ 
        open: true, 
        message: 'Error loading data', 
        severity: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = () => {
    // Hardcoded to July 21, 2025 for Murray Highland data consistency
    return '2025-07-21';
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
      const currentAssignments = assignments.filter(a => a.shift === shift.id);
      const needed = shift.required_staff_count - currentAssignments.length;
      
      if (needed <= 0) continue;

      const availableStaff = staff.filter(member => {
        const alreadyAssigned = assignments.some(a => 
          a.shift === shift.id && a.staff === member.id
        );
        if (alreadyAssigned) return false;
        
        const staffAssignments = getAssignmentsForStaff(member.id);
        return staffAssignments.length < member.max_hours;
      });

      for (let i = 0; i < Math.min(needed, availableStaff.length); i++) {
        try {
          await axios.post(`${API_BASE_URL}/api/scheduling/assignments/`, {
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
        await axios.delete(`${API_BASE_URL}/api/scheduling/assignments/${assignment.id}/`);
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
      const response = await axios.post(`${API_BASE_URL}/api/scheduling/shifts/clear_shifts/`, {
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

  const handleApplyAIRecommendations = async () => {
    if (!facilityId) {
      setSnackbar({ open: true, message: 'Please select a facility first', severity: 'warning' });
      return;
    }

    setApplying(true);
    try {
      const weekStart = getWeekStart();
      
      const recommendationsResponse = await axios.get(`${API_BASE_URL}/api/scheduling/ai-recommendations/calculate_from_adl/?facility=${facilityId}&week_start=${weekStart}`);
      
      if (!recommendationsResponse.data.recommendations || recommendationsResponse.data.recommendations.length === 0) {
        setSnackbar({ open: true, message: 'No AI recommendations available for this week. Please ensure ADL data exists.', severity: 'warning' });
        return;
      }

      const applyResponse = await axios.post(`${API_BASE_URL}/api/scheduling/ai-recommendations/apply_weekly_recommendations/`, {
        facility: facilityId,
        week_start: weekStart
      });
      
      setSnackbar({ 
        open: true, 
        message: `Successfully applied AI recommendations! Created ${applyResponse.data.shifts_created} new shifts and updated ${applyResponse.data.shifts_updated} existing shifts.`, 
        severity: 'success' 
      });
      fetchData();
    } catch (error) {
      console.error('Error applying AI recommendations:', error);
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Failed to apply AI recommendations. Please try again.', 
        severity: 'error' 
      });
    } finally {
      setApplying(false);
    }
  };

  const getStaffStatus = (staffMember) => {
    const staffAssignments = assignments.filter(assignment => {
      return assignment.staff === staffMember.id;
    });
    
    const hoursUsed = staffAssignments.length;
    const maxHours = staffMember.max_hours;
    
    if (hoursUsed >= maxHours) return 'over_max';
    if (hoursUsed >= maxHours * 0.8) return 'near_max';
    return 'available';
  };

  const getAssignmentsForStaff = (staffId) => {
    const staffAssignments = assignments.filter(assignment => {
      return assignment.staff === staffId;
    });
    return staffAssignments;
  };

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.last_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleExportCSV = () => {
    // CSV export logic
    setSnackbar({ open: true, message: 'CSV export functionality coming soon', severity: 'info' });
  };

  const handleExportICS = () => {
    // ICS export logic
    setSnackbar({ open: true, message: 'ICS export functionality coming soon', severity: 'info' });
  };

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
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        p: 3,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {/* Main Title and AI Button */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 3
        }}>
          <Typography variant="h4" sx={{ fontWeight: '600', color: '#1a1a1a' }}>
            Weekly Planner
          </Typography>
          
          <Button
            variant="contained"
            onClick={handleApplyAIRecommendations}
            disabled={loading || applying}
            startIcon={<SmartToyIcon />}
            sx={{ 
              backgroundColor: '#10b981',
              px: 4,
              py: 1.5,
              borderRadius: 3,
              fontWeight: '600',
              '&:hover': { backgroundColor: '#059669' }
            }}
          >
            Apply AI Recommendations
          </Button>
        </Box>

        {/* Summary Cards */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 3,
          mb: 3
        }}>
          <Box sx={{ 
            p: 3, 
            bgcolor: '#f8fafc', 
            borderRadius: 3, 
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <Typography variant="h3" sx={{ fontWeight: '700', color: '#1e40af', mb: 1 }}>
              {staff.length}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: '500' }}>
              Total Staff
            </Typography>
          </Box>
          
          <Box sx={{ 
            p: 3, 
            bgcolor: '#f8fafc', 
            borderRadius: 3, 
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <Typography variant="h3" sx={{ fontWeight: '700', color: '#059669', mb: 1 }}>
              {shifts.length}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: '500' }}>
              Total Shifts
            </Typography>
          </Box>
          
          <Box sx={{ 
            p: 3, 
            bgcolor: '#f8fafc', 
            borderRadius: 3, 
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <Typography variant="h3" sx={{ fontWeight: '700', color: '#dc2626', mb: 1 }}>
              {shifts.filter(shift => 
                assignments.filter(a => a.shift === shift.id).length < shift.required_staff_count
              ).length}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: '500' }}>
              Open Shifts
            </Typography>
          </Box>
          
          <Box sx={{ 
            p: 3, 
            bgcolor: '#f8fafc', 
            borderRadius: 3, 
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <Typography variant="h3" sx={{ fontWeight: '700', color: '#f59e0b', mb: 1 }}>
              {Math.round((assignments.length / (shifts.reduce((sum, shift) => sum + shift.required_staff_count, 0)) || 0) * 100)}%
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: '500' }}>
              Coverage
            </Typography>
          </Box>
        </Box>

        {/* Compact Action Buttons */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleAutoFill}
            disabled={loading}
            startIcon={<AutoFillIcon />}
            sx={{ borderRadius: 2 }}
          >
            AutoFill
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={handleClearAssignments}
            disabled={loading}
            startIcon={<ClearIcon />}
            sx={{ borderRadius: 2 }}
          >
            Clear Assignments
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={handleClearAllShifts}
            disabled={loading}
            startIcon={<DeleteIcon />}
            sx={{ borderRadius: 2 }}
          >
            Clear Shifts
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={fetchData}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            sx={{ borderRadius: 2 }}
          >
            Refresh
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={handleExportCSV}
            disabled={loading}
            startIcon={<FileDownloadIcon />}
            sx={{ borderRadius: 2 }}
          >
            Export CSV
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            onClick={handleExportICS}
            disabled={loading}
            startIcon={<CalendarTodayIcon />}
            sx={{ borderRadius: 2 }}
          >
            Export ICS
          </Button>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden'
      }}>
        {/* Left Side - Planner Grid */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          p: 3
        }}>
          {/* Week Display */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: '600', color: '#1a1a1a', mb: 1 }}>
              {getWeekLabel(selectedWeek)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Facility: {facilityId ? `ID: ${facilityId}` : 'No facility selected'}
            </Typography>
          </Box>

          {/* Planner Grid Table */}
          <TableContainer component={Paper} sx={{ 
            maxHeight: 600,
            border: '1px solid #e5e7eb',
            borderRadius: 3,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ 
                    fontWeight: '600', 
                    backgroundColor: '#f8fafc',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: 120
                  }}>
                    Shift Type
                  </TableCell>
                  {getWeekDays().map((day) => (
                    <TableCell 
                      key={day.toISOString()} 
                      sx={{ 
                        fontWeight: '600', 
                        backgroundColor: '#f8fafc',
                        borderBottom: '2px solid #e5e7eb',
                        textAlign: 'center',
                        minWidth: 140
                      }}
                    >
                      {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {['DAY', 'SWING', 'NOC'].map((shiftType) => (
                  <TableRow key={shiftType}>
                    <TableCell sx={{ 
                      fontWeight: '600', 
                      backgroundColor: '#f9fafb',
                      borderRight: '1px solid #e5e7eb'
                    }}>
                      {shiftType}
                    </TableCell>
                    {getWeekDays().map((day) => {
                      const shift = shifts.find(s => {
                        const shiftDate = new Date(s.date);
                        return shiftDate.toDateString() === day.toDateString() && 
                               s.shift_template?.shift_type?.toUpperCase() === shiftType;
                      });

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
                            bgcolor: shift ? 'background.paper' : '#fafafa',
                            position: 'relative'
                          }}
                        >
                          {shift ? (
                            <Box sx={{ p: 2 }}>
                              <Box sx={{ mb: 2 }}>
                                <Chip 
                                  label={`${shift.required_staff_role.replace('_', ' ')} ${assignments.filter(a => a.shift === shift.id).length}/${shift.required_staff_count}`}
                                  size="small"
                                  color={assignments.filter(a => a.shift === shift.id).length >= shift.required_staff_count ? 'success' : 'warning'}
                                />
                              </Box>
                              
                              <Typography variant="body2" sx={{ mb: 1, fontWeight: '500' }}>
                                {assignments.filter(a => a.shift === shift.id).length >= shift.required_staff_count 
                                  ? 'Filled' 
                                  : `${shift.required_staff_count - assignments.filter(a => a.shift === shift.id).length} more needed`
                                }
                              </Typography>

                              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                <IconButton size="small" color="primary">
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="error">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          ) : (
                            <Box sx={{ 
                              height: '100%', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              p: 2
                            }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => setCreateShiftData({ date: day, shiftType })}
                                sx={{ 
                                  borderRadius: 2,
                                  textTransform: 'none',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Create Shift
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
            width: staffPanelOpen ? 400 : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 400,
              boxSizing: 'border-box',
              position: 'relative',
              height: '100%',
              border: 'none',
              borderLeft: '1px solid #e5e7eb'
            },
          }}
        >
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: '600' }}>
                Staff Members
              </Typography>
              <IconButton onClick={() => setStaffPanelOpen(false)} size="small">
                <ExpandLessIcon />
              </IconButton>
            </Box>

            {/* Search and Filter */}
            <Box sx={{ mb: 3 }}>
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
            </Box>

            {/* Staff List */}
            <Box sx={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
              {filteredStaff.map((member) => {
                const status = getStaffStatus(member);
                const staffAssignments = getAssignmentsForStaff(member.id);
                const hoursUsed = staffAssignments.length;
                
                return (
                  <Card 
                    key={member.id}
                    sx={{ 
                      mb: 2, 
                      cursor: 'grab',
                      border: `2px solid ${status === 'available' ? '#dcfce7' : status === 'near_max' ? '#fed7aa' : '#fecaca'}`,
                      '&:hover': { 
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }
                    }}
                    draggable
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar 
                          sx={{ 
                            bgcolor: member.role === 'med_tech' ? '#dbeafe' : '#dcfce7',
                            color: member.role === 'med_tech' ? '#1e40af' : '#166534',
                            width: 40,
                            height: 40,
                            fontSize: '0.875rem',
                            fontWeight: '600'
                          }}
                        >
                          {member.first_name[0]}{member.last_name[0]}
                        </Avatar>
                        
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: '600', mb: 0.5 }}>
                            {member.first_name} {member.last_name}
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            color: member.role === 'med_tech' ? '#1e40af' : '#166534',
                            fontWeight: '500',
                            textTransform: 'capitalize'
                          }}>
                            {member.role.replace('_', ' ')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {hoursUsed}/{member.max_hours} hours
                          </Typography>
                        </Box>
                        
                        <Box sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: status === 'available' ? '#22c55e' : status === 'near_max' ? '#f59e0b' : '#ef4444'
                        }} />
                      </Box>
                      
                      {staffAssignments.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            Assigned:
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
                                    sx={{ fontSize: '0.7rem' }}
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
                                sx={{ fontSize: '0.7rem' }}
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
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <PeopleIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    No staff found
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
            right: 0, 
            top: '50%', 
            transform: 'translateY(-50%)',
            zIndex: 10
          }}>
            <IconButton 
              onClick={() => setStaffPanelOpen(true)}
              sx={{ 
                bgcolor: 'primary.main', 
                color: 'white',
                '&:hover': { bgcolor: 'primary.dark' }
              }}
            >
              <ExpandLessIcon />
            </IconButton>
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
    </Box>
  );
});

export default WeeklyPlanner;
