import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CalendarToday as CalendarIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const StaffAvailability = ({ facilityId }) => {
  const [availability, setAvailability] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [viewMode, setViewMode] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    staff_member: '',
    date: '',
    availability_status: 'available',
    max_hours: 8,
    preferred_start_time: '',
    preferred_end_time: '',
    preferred_shift_types: [],
    notes: '',
  });

  const availabilityStatuses = [
    { value: 'available', label: 'Available' },
    { value: 'no_overtime', label: 'No Overtime' },
    { value: 'limited', label: 'Limited Hours' },
    { value: 'unavailable', label: 'Unavailable' },
  ];

  const shiftTypes = [
    { value: 'day', label: 'Day' },
    { value: 'swing', label: 'Swing' },
    { value: 'noc', label: 'NOC' },
  ];

  useEffect(() => {
    if (facilityId) {
      fetchData();
    }
  }, [facilityId, selectedDate, viewMode]);

  const fetchData = async () => {
    try {
      const [availabilityRes, staffRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/scheduling/availability/?facility=${facilityId}&date=${selectedDate}`),
        axios.get(`${API_BASE_URL}/api/scheduling/staff/?facility=${facilityId}`),
      ]);
      
      console.log('Availability API response:', availabilityRes.data); // Debug log
      console.log('Staff API response:', staffRes.data); // Debug log
      
      setAvailability(availabilityRes.data.results || availabilityRes.data);
      setStaff(staffRes.data.results || staffRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (avail = null) => {
    if (avail) {
      setEditingAvailability(avail);
      console.log('Editing availability:', avail); // Debug log
      
      // Helper function to format time for HTML time input
      const formatTimeForInput = (timeValue) => {
        if (!timeValue) return '';
        console.log('Formatting time value:', timeValue, 'Type:', typeof timeValue); // Debug log
        
        if (typeof timeValue === 'string') {
          // If it's already a string like "12:30:00", extract just "12:30"
          const formatted = timeValue.split(':').slice(0, 2).join(':');
          console.log('Formatted string time:', formatted); // Debug log
          return formatted;
        }
        // If it's a time object, format it as HH:MM
        if (timeValue.hour !== undefined && timeValue.minute !== undefined) {
          const formatted = `${timeValue.hour.toString().padStart(2, '0')}:${timeValue.minute.toString().padStart(2, '0')}`;
          console.log('Formatted object time:', formatted); // Debug log
          return formatted;
        }
        console.log('Returning original time value:', timeValue); // Debug log
        return timeValue;
      };
      
      console.log('Raw availability data:', avail); // Debug log
      
      setFormData({
        staff_member: avail.staff?.id || avail.staff_member || '',
        date: avail.date ? avail.date.split('T')[0] : selectedDate,
        availability_status: avail.availability_status || 'available',
        max_hours: avail.max_hours || 8,
        preferred_start_time: formatTimeForInput(avail.preferred_start_time),
        preferred_end_time: formatTimeForInput(avail.preferred_end_time),
        preferred_shift_types: avail.preferred_shift_types || [],
        notes: avail.notes || '',
      });
      
      console.log('Form data set to:', {
        staff_member: avail.staff?.id || avail.staff_member || '',
        date: avail.date ? avail.date.split('T')[0] : selectedDate,
        availability_status: avail.availability_status || 'available',
        max_hours: avail.max_hours || 8,
        preferred_start_time: formatTimeForInput(avail.preferred_start_time),
        preferred_end_time: formatTimeForInput(avail.preferred_end_time),
        preferred_shift_types: avail.preferred_shift_types || [],
        notes: avail.notes || '',
      });
    } else {
      setEditingAvailability(null);
      setFormData({
        staff_member: '',
        date: selectedDate,
        availability_status: 'available',
        max_hours: 8,
        preferred_start_time: '',
        preferred_end_time: '',
        preferred_shift_types: [],
        notes: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAvailability(null);
    setFormData({
      staff_member: '',
      date: selectedDate,
      availability_status: 'available',
      max_hours: 8,
      preferred_start_time: '',
      preferred_end_time: '',
      preferred_shift_types: [],
      notes: '',
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Format time values to HH:MM format (remove seconds if present)
  const formatTimeForAPI = (timeValue) => {
    if (!timeValue || timeValue === '') return null;
    // If time has seconds (HH:MM:SS), remove them
    if (typeof timeValue === 'string' && timeValue.includes(':')) {
      const parts = timeValue.split(':');
      if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
    }
    return timeValue;
  };

  const handleShiftTypeToggle = (shiftType) => {
    setFormData(prev => ({
      ...prev,
      preferred_shift_types: prev.preferred_shift_types.includes(shiftType)
        ? prev.preferred_shift_types.filter(type => type !== shiftType)
        : [...prev.preferred_shift_types, shiftType]
    }));
  };

  const handleSubmit = async () => {
    try {
      if (editingAvailability) {
        console.log('Updating availability with data:', formData); // Debug log
        console.log('Original editing availability:', editingAvailability); // Debug log

        const updateData = {
          staff_id: formData.staff_member, // Map staff_member to staff_id
          date: formData.date,
          availability_status: formData.availability_status,
          max_hours: formData.max_hours,
          preferred_start_time: formatTimeForAPI(formData.preferred_start_time),
          preferred_end_time: formatTimeForAPI(formData.preferred_end_time),
          preferred_shift_types: formData.preferred_shift_types,
          notes: formData.notes,
          facility_id: facilityId,
        };
        console.log('Form data before update:', formData); // Debug log
        console.log('Sending update request:', updateData); // Debug log
        console.log('Time values - Start:', formData.preferred_start_time, 'End:', formData.preferred_end_time); // Debug log
        
        try {
          const response = await axios.put(`${API_BASE_URL}/api/scheduling/availability/${editingAvailability.id}/`, updateData);
          console.log('Update successful:', response);
        } catch (putError) {
          console.log('Update failed with error:', putError);
          console.log('Error response:', putError.response);
          throw putError; // Re-throw to be caught by outer catch
        }
        setSnackbar({
          open: true,
          message: 'Availability updated successfully',
          severity: 'success',
        });
      } else {
        // Check if availability already exists for this staff member and date
        const existingAvailability = availability.find(avail => 
          avail.staff.id === formData.staff_member && 
          avail.date === formData.date
        );
        
        if (existingAvailability) {
          // Ask user if they want to update existing record
          if (window.confirm(
            `Staff availability already exists for ${getStaffName(formData.staff_member)} on ${formData.date}. ` +
            'Would you like to update the existing record instead?'
          )) {
            // Switch to edit mode
            setEditingAvailability(existingAvailability);
            setFormData({
              staff_member: existingAvailability.staff.id,
              date: existingAvailability.date.split('T')[0],
              availability_status: existingAvailability.availability_status,
              max_hours: existingAvailability.max_hours,
              preferred_start_time: existingAvailability.preferred_start_time || '',
              preferred_end_time: existingAvailability.preferred_end_time || '',
              preferred_shift_types: existingAvailability.preferred_shift_types || [],
              notes: existingAvailability.notes || '',
            });
            return; // Don't proceed with creation
          } else {
            // User chose not to update, so we can't create duplicate
            setSnackbar({
              open: true,
              message: 'Please choose a different date or staff member',
              severity: 'warning',
            });
            return;
          }
        }
        
        const createData = {
          staff_id: formData.staff_member, // Map staff_member to staff_id
          date: formData.date,
          availability_status: formData.availability_status,
          max_hours: formData.max_hours,
          preferred_start_time: formatTimeForAPI(formData.preferred_start_time),
          preferred_end_time: formatTimeForAPI(formData.preferred_end_time),
          preferred_shift_types: formData.preferred_shift_types,
          notes: formData.notes,
          facility_id: facilityId,
        };
        
        await axios.post(`${API_BASE_URL}/api/scheduling/availability/`, createData);
        setSnackbar({
          open: true,
          message: 'Availability added successfully',
          severity: 'success',
        });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving availability:', error);
      
      let errorMessage = 'Error saving availability';
      
      // Handle specific backend validation errors
      if (error.response && error.response.data) {
        if (error.response.data.non_field_errors) {
          errorMessage = error.response.data.non_field_errors[0];
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        }
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    }
  };

  const handleDelete = async (availabilityId) => {
    if (window.confirm('Are you sure you want to delete this availability record?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/scheduling/availability/${availabilityId}/`);
        setSnackbar({
          open: true,
          message: 'Availability deleted successfully',
          severity: 'success',
        });
        fetchData();
      } catch (error) {
        console.error('Error deleting availability:', error);
        setSnackbar({
          open: true,
          message: 'Error deleting availability',
          severity: 'error',
        });
      }
    }
  };

  const getStaffName = (staffId) => {
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Unknown';
  };

  const getStaffById = (staffId) => {
    return staff.find(s => s.id === staffId);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'no_overtime':
        return 'warning';
      case 'limited':
        return 'info';
      case 'unavailable':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    const statusObj = availabilityStatuses.find(s => s.value === status);
    return statusObj ? statusObj.label : status;
  };

  if (!facilityId) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Please select a facility to manage staff availability
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Staff Availability Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          + Add Availability
        </Button>
      </Box>

      {/* View Toggle */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={viewMode} onChange={(e, newValue) => setViewMode(newValue)}>
          <Tab 
            label="Daily View" 
            icon={<CalendarIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Weekly Summary" 
            icon={<PeopleIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Daily View */}
      {viewMode === 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Daily Availability
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <TextField
              label="Select Date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Staff Member</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Preferred Times</TableCell>
                  <TableCell>Max Hours</TableCell>
                  <TableCell>Preferred Shifts</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availability.map((avail) => (
                  <TableRow key={avail.id}>
                    <TableCell>{getStaffName(avail.staff_member)}</TableCell>
                    <TableCell>
                      {staff.find(s => s.id === avail.staff_member)?.role || '-'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getStatusLabel(avail.availability_status)} 
                        size="small" 
                        color={getStatusColor(avail.availability_status)}
                      />
                    </TableCell>
                    <TableCell>
                      {avail.preferred_start_time && avail.preferred_end_time
                        ? `${avail.preferred_start_time} - ${avail.preferred_end_time}`
                        : 'Any time'
                      }
                    </TableCell>
                    <TableCell>{avail.max_hours}</TableCell>
                    <TableCell>
                      {avail.preferred_shift_types.length > 0
                        ? avail.preferred_shift_types.join(', ')
                        : 'Any shift'
                      }
                    </TableCell>
                    <TableCell>{avail.notes || '-'}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(avail)}
                        title="Edit"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(avail.id)}
                        title="Delete"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {availability.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No availability records found for this date. Add availability to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Weekly Summary View */}
      {viewMode === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Weekly Summary
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Weekly summary view coming soon. This will show staff availability patterns across the week.
          </Alert>
        </Box>
      )}

      {/* Add/Edit Availability Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingAvailability ? 'Edit Availability' : 'Add Availability'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Staff Member</InputLabel>
              <Select
                value={formData.staff_member}
                label="Staff Member"
                onChange={(e) => handleInputChange('staff_member', e.target.value)}
              >
                {staff.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.first_name} {member.last_name} ({member.role})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            
            <FormControl fullWidth>
              <InputLabel>Availability Status</InputLabel>
              <Select
                value={formData.availability_status}
                label="Availability Status"
                onChange={(e) => handleInputChange('availability_status', e.target.value)}
              >
                {availabilityStatuses.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="Max Hours"
              type="number"
              value={formData.max_hours}
              onChange={(e) => handleInputChange('max_hours', parseInt(e.target.value) || 8)}
              fullWidth
              inputProps={{ min: 1, max: 24 }}
            />
            
            <TextField
              label="Preferred Start Time"
              type="time"
              value={formData.preferred_start_time}
              onChange={(e) => {
                console.log('Start time changed to:', e.target.value); // Debug log
                // Ensure we get 24-hour format
                const timeValue = e.target.value;
                if (timeValue) {
                  handleInputChange('preferred_start_time', timeValue);
                }
              }}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Optional: Preferred start time for the shift (use 24-hour format)"
            />
            
            <TextField
              label="Preferred End Time"
              type="time"
              value={formData.preferred_end_time}
              onChange={(e) => {
                console.log('End time changed to:', e.target.value); // Debug log
                // Ensure we get 24-hour format
                const timeValue = e.target.value;
                if (timeValue) {
                  handleInputChange('preferred_end_time', timeValue);
                }
              }}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Optional: Preferred end time for the shift (must be after start time, use 24-hour format)"
            />
            
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="subtitle2" gutterBottom>
                Preferred Shift Types
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {shiftTypes.map((type) => (
                  <Chip
                    key={type.value}
                    label={type.label}
                    onClick={() => handleShiftTypeToggle(type.value)}
                    color={formData.preferred_shift_types.includes(type.value) ? 'primary' : 'default'}
                    variant={formData.preferred_shift_types.includes(type.value) ? 'filled' : 'outlined'}
                    clickable
                  />
                ))}
              </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Note: If you specify both start and end times, they must be at least 30 minutes apart.
            </Typography>
            {formData.preferred_start_time && formData.preferred_end_time && 
             formData.preferred_start_time === formData.preferred_end_time && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Start and end times cannot be the same. Please adjust one of the times.
              </Alert>
            )}
            </Box>
            
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              fullWidth
              multiline
              rows={3}
              sx={{ gridColumn: '1 / -1' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={
              !formData.staff_member || 
              !formData.date ||
              (formData.preferred_start_time && 
               formData.preferred_end_time && 
               formData.preferred_start_time === formData.preferred_end_time)
            }
          >
            {editingAvailability ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
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

export default StaffAvailability;
