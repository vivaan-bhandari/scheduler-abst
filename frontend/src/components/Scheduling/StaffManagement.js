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
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const StaffManagement = ({ facilityId }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    employee_id: '',
    role: '',
    hire_date: '',
    status: 'active',
    max_hours: 40,
    notes: '',
  });

  const roles = [
    { value: 'cna', label: 'Certified Nursing Assistant' },
    { value: 'lpn', label: 'Licensed Practical Nurse' },
    { value: 'rn', label: 'Registered Nurse' },
    { value: 'cna_float', label: 'CNA Float' },
    { value: 'med_tech', label: 'Medication Technician' },
    { value: 'caregiver', label: 'Caregiver' },
  ];

  const statuses = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'on_leave', label: 'On Leave' },
    { value: 'terminated', label: 'Terminated' },
  ];

  useEffect(() => {
    if (facilityId) {
      fetchStaff();
    }
  }, [facilityId]);

  const fetchStaff = async () => {
    try {
      console.log('Fetching staff for facility:', facilityId);
      const response = await axios.get(`${API_BASE_URL}/api/scheduling/staff/?facility=${facilityId}`);
      console.log('Staff API response:', response.data);
      console.log('Staff data:', response.data.results || response.data);
      setStaff(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching staff:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching staff data',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (staff = null) => {
    if (staff) {
      setEditingStaff(staff);
      setFormData({
        first_name: staff.first_name || '',
        last_name: staff.last_name || '',
        email: staff.email || '',
        employee_id: staff.employee_id || '',
        role: staff.role || '',
        hire_date: staff.hire_date ? staff.hire_date.split('T')[0] : '',
        status: staff.status || 'active',
        max_hours: staff.max_hours || 40,
        notes: staff.notes || '',
      });
    } else {
      setEditingStaff(null);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        employee_id: '',
        role: '',
        hire_date: '',
        status: 'active',
        max_hours: 40,
        notes: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingStaff(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      employee_id: '',
        role: '',
        hire_date: '',
        status: 'active',
        max_hours: 40,
        notes: '',
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      // Ensure date is in YYYY-MM-DD format
      const submitData = {
        ...formData,
        facility_id: facilityId,
      };
      
      // Ensure hire_date is in YYYY-MM-DD format
      if (submitData.hire_date) {
        console.log('Processing hire_date:', submitData.hire_date);
        
        // Handle MM/DD/YYYY format properly
        if (submitData.hire_date.includes('/')) {
          const [month, day, year] = submitData.hire_date.split('/');
          const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          console.log('Converted MM/DD/YYYY to YYYY-MM-DD:', formattedDate);
          submitData.hire_date = formattedDate;
        } else if (submitData.hire_date.includes('-')) {
          // If it's already in YYYY-MM-DD format, validate it
          const date = new Date(submitData.hire_date);
          if (!isNaN(date.getTime())) {
            const formattedDate = date.toISOString().split('T')[0];
            console.log('Formatted existing YYYY-MM-DD:', formattedDate);
            submitData.hire_date = formattedDate;
          } else {
            console.error('Invalid date format:', submitData.hire_date);
            throw new Error('Invalid date format. Please use the date picker or enter date in YYYY-MM-DD format.');
          }
        } else {
          console.error('Unknown date format:', submitData.hire_date);
          throw new Error('Invalid date format. Please use the date picker or enter date in YYYY-MM-DD format.');
        }
      }
      
      console.log('Original formData:', formData);
      console.log('Submitting staff data:', submitData);
      console.log('Final hire_date being sent:', submitData.hire_date);
      
      if (editingStaff) {
        await axios.put(`${API_BASE_URL}/api/scheduling/staff/${editingStaff.id}/`, submitData);
        setSnackbar({
          open: true,
          message: 'Staff member updated successfully',
          severity: 'success',
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/scheduling/staff/`, submitData);
        setSnackbar({
          open: true,
          message: 'Staff member added successfully',
          severity: 'success',
        });
      }
      handleCloseDialog();
      fetchStaff();
    } catch (error) {
      console.error('Error saving staff:', error);
      let errorMessage = 'Error saving staff member';
      
      // Handle specific date format errors
      if (error.message && error.message.includes('date format')) {
        errorMessage = error.message;
      } else if (error.response && error.response.data) {
        // Handle backend validation errors
        if (error.response.data.hire_date) {
          errorMessage = `Date error: ${error.response.data.hire_date[0]}`;
        } else if (error.response.data.non_field_errors) {
          errorMessage = error.response.data.non_field_errors[0];
        }
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    }
  };

  const handleDelete = async (staffId) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/scheduling/staff/${staffId}/`);
        setSnackbar({
          open: true,
          message: 'Staff member deleted successfully',
          severity: 'success',
        });
        fetchStaff();
      } catch (error) {
        console.error('Error deleting staff:', error);
        setSnackbar({
          open: true,
          message: 'Error deleting staff member',
          severity: 'error',
        });
      }
    }
  };

  const getRoleLabel = (roleValue) => {
    const role = roles.find(r => r.value === roleValue);
    return role ? role.label : roleValue;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'on_leave':
        return 'warning';
      case 'terminated':
        return 'error';
      default:
        return 'default';
    }
  };

  if (!facilityId) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Please select a facility to manage staff
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Staff Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Staff Member
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Employee ID</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Hire Date</TableCell>
              <TableCell>Max Hours</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2">
                      {member.first_name} {member.last_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ID: {member.employee_id}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{member.employee_id}</TableCell>
                <TableCell>
                  <Chip 
                    label={getRoleLabel(member.role)} 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={member.status} 
                    size="small" 
                    color={getStatusColor(member.status)}
                  />
                </TableCell>
                <TableCell>
                  {member.hire_date ? new Date(member.hire_date).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell>{member.max_hours || 40}h</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(member)}
                    title="Edit"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(member.id)}
                    title="Delete"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {staff.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No staff members found. Add your first staff member to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Staff Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              label="First Name *"
              value={formData.first_name}
              onChange={(e) => handleInputChange('first_name', e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Last Name *"
              value={formData.last_name}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Employee ID *"
              value={formData.employee_id}
              onChange={(e) => handleInputChange('employee_id', e.target.value)}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                label="Role"
                onChange={(e) => handleInputChange('role', e.target.value)}
              >
                {roles.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Hire Date"
              type="date"
              value={formData.hire_date || ''}
              onChange={(e) => {
                // Ensure we get a valid date in YYYY-MM-DD format
                const inputValue = e.target.value;
                if (inputValue) {
                  // The date input should already be in YYYY-MM-DD format
                  handleInputChange('hire_date', inputValue);
                } else {
                  handleInputChange('hire_date', '');
                }
              }}
              onBlur={(e) => {
                // Validate date format on blur
                const inputValue = e.target.value;
                if (inputValue && !/^\d{4}-\d{2}-\d{2}$/.test(inputValue)) {
                  // If user manually typed an invalid format, try to convert it
                  if (inputValue.includes('/')) {
                    const [month, day, year] = inputValue.split('/');
                    const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    handleInputChange('hire_date', formattedDate);
                  }
                }
              }}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Use the date picker or enter date in YYYY-MM-DD format"
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => handleInputChange('status', e.target.value)}
              >
                {statuses.map((status) => (
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
              onChange={(e) => handleInputChange('max_hours', parseInt(e.target.value) || 40)}
              fullWidth
              inputProps={{ min: 1, max: 168 }}
            />
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
            disabled={!formData.first_name || !formData.last_name || !formData.email || !formData.employee_id}
          >
            {editingStaff ? 'Update' : 'Add'}
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

export default StaffManagement;
