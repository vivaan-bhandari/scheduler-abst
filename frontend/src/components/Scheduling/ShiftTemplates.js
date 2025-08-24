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
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const ShiftTemplates = ({ facilityId }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    template_name: 'Day',
    shift_type: 'day',
    start_time: '06:00',
    end_time: '14:00',
    duration: 8.0,
    required_staff: 1,
    is_active: true,
  });

  const shiftTypes = [
    { value: 'day', label: 'Day (06:00-14:00)' },
    { value: 'swing', label: 'Swing (14:00-22:00)' },
    { value: 'noc', label: 'NOC (22:00-06:00)' },
    { value: 'custom', label: 'Custom' },
  ];

  useEffect(() => {
    if (facilityId) {
      fetchTemplates();
    }
  }, [facilityId]);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/scheduling/shift-templates/?facility=${facilityId}`);
      setTemplates(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching shift templates',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template = null) => {
    console.log('🔍 handleOpenDialog called with:', template);
    console.log('🔍 Current facilityId:', facilityId);
    
    if (template) {
      setEditingTemplate(template);
      setFormData({
        template_name: template.template_name || '',
        shift_type: template.shift_type || '',
        start_time: template.start_time || '',
        end_time: template.end_time || '',
        duration: template.duration || 8.0,
        required_staff: template.required_staff || 1,
        is_active: template.is_active !== false,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        template_name: 'Day Shift',
        shift_type: 'day',
        start_time: '06:00',
        end_time: '14:00',
        duration: 8.0,
        required_staff: 1,
        is_active: true,
      });
    }
    console.log('🔍 Setting openDialog to true');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
    setFormData({
      template_name: 'Day',
      shift_type: 'day',
      start_time: '06:00',
      end_time: '14:00',
      duration: 8.0,
      required_staff: 1,
      is_active: true,
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Auto-populate times when shift type is selected
    if (field === 'shift_type' && value) {
      autoPopulateTimes(value);
    }
  };

  const autoPopulateTimes = (shiftType) => {
    let startTime, endTime, duration;
    
    switch (shiftType) {
      case 'day':
        startTime = '06:00';
        endTime = '14:00';
        duration = 8.0;
        break;
      case 'swing':
        startTime = '14:00';
        endTime = '22:00';
        duration = 8.0;
        break;
      case 'noc':
        startTime = '22:00';
        endTime = '06:00';
        duration = 8.0;
        break;
      case 'custom':
        // Don't auto-populate for custom shifts
        return;
      default:
        return;
    }
    
    setFormData(prev => ({
      ...prev,
      start_time: startTime,
      end_time: endTime,
      duration: duration,
    }));
  };

  const handleTimeChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Auto-calculate duration if both times are set
    if (field === 'start_time' && formData.end_time) {
      calculateDuration(value, formData.end_time);
    } else if (field === 'end_time' && formData.start_time) {
      calculateDuration(formData.start_time, value);
    }
  };

  const calculateDuration = (startTime, endTime) => {
    if (startTime && endTime) {
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      
      if (end < start) {
        end.setDate(end.getDate() + 1); // Handle overnight shifts
      }
      
      const duration = (end - start) / (1000 * 60 * 60); // Convert to hours
      setFormData(prev => ({
        ...prev,
        duration: Math.round(duration * 100) / 100,
      }));
    }
  };

  const handleSubmit = async () => {
    console.log('🔍 handleSubmit called');
    console.log('🔍 Form data:', formData);
    console.log('🔍 Facility ID:', facilityId);
    console.log('🔍 Editing template:', editingTemplate);
    
    // Validate required fields
    if (!formData.template_name || !formData.shift_type || !formData.start_time || !formData.end_time) {
      setSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        severity: 'error',
      });
      return;
    }
    
    // Validate facility ID
    if (!facilityId) {
      setSnackbar({
        open: true,
        message: 'No facility selected. Please select a facility first.',
        severity: 'error',
      });
      return;
    }
    
    try {
      if (editingTemplate) {
        console.log('🔍 Updating existing template...');
        await axios.put(`${API_BASE_URL}/api/scheduling/shift-templates/${editingTemplate.id}/`, {
          ...formData,
          facility_id: facilityId,
        });
        setSnackbar({
          open: true,
          message: 'Shift template updated successfully',
          severity: 'success',
        });
      } else {
        console.log('🔍 Creating new template...');
        const response = await axios.post(`${API_BASE_URL}/api/scheduling/shift-templates/`, {
          ...formData,
          facility_id: facilityId,
        });
        console.log('🔍 API response:', response.data);
        setSnackbar({
          open: true,
          message: 'Shift template added successfully',
          severity: 'success',
        });
      }
      handleCloseDialog();
      fetchTemplates();
    } catch (error) {
      console.error('🔍 Error saving template:', error);
      console.error('🔍 Error response:', error.response?.data);
      setSnackbar({
        open: true,
        message: `Error saving shift template: ${error.response?.data?.detail || error.message}`,
        severity: 'error',
      });
    }
  };

  const handleDelete = async (templateId) => {
    if (window.confirm('Are you sure you want to delete this shift template?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/scheduling/shift-templates/${templateId}/`);
        setSnackbar({
          open: true,
          message: 'Shift template deleted successfully',
          severity: 'success',
        });
        fetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
        setSnackbar({
          open: true,
          message: 'Error deleting shift template',
          severity: 'error',
        });
      }
    }
  };

  const handleCopy = async (template) => {
    try {
      const copyData = {
        ...template,
        template_name: `${template.template_name} (Copy)`,
        facility_id: facilityId,
      };
      delete copyData.id;
      
      await axios.post(`${API_BASE_URL}/api/scheduling/shift-templates/`, copyData);
      setSnackbar({
        open: true,
        message: 'Shift template copied successfully',
        severity: 'success',
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error copying template:', error);
      setSnackbar({
        open: true,
        message: 'Error copying shift template',
        severity: 'error',
      });
    }
  };

  const getShiftTypeLabel = (type) => {
    const shiftType = shiftTypes.find(st => st.value === type);
    return shiftType ? shiftType.label : type;
  };

  const getShiftTypeColor = (type) => {
    switch (type) {
      case 'day':
        return 'success';
      case 'swing':
        return 'warning';
      case 'noc':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatTime = (time) => {
    if (!time) return '--:--';
    return time;
  };

  if (!facilityId) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Please select a facility to manage shift templates
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Shift Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Template
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Template Name</TableCell>
              <TableCell>Shift Type</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Required Staff</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>{template.template_name}</TableCell>
                <TableCell>
                  <Chip 
                    label={getShiftTypeLabel(template.shift_type)} 
                    size="small" 
                    color={getShiftTypeColor(template.shift_type)}
                  />
                </TableCell>
                <TableCell>
                  {formatTime(template.start_time)} - {formatTime(template.end_time)}
                </TableCell>
                <TableCell>{template.duration} hours</TableCell>
                <TableCell>{template.required_staff}</TableCell>
                <TableCell>
                  <Chip 
                    label={template.is_active ? 'Active' : 'Inactive'} 
                    size="small" 
                    color={template.is_active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(template)}
                    title="Copy"
                  >
                    <CopyIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(template)}
                    title="Edit"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(template.id)}
                    title="Delete"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No shift templates found. Add your first template to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Template Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Shift Template' : 'Add Shift Template'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              label="Template Name *"
              value={formData.template_name}
              onChange={(e) => handleInputChange('template_name', e.target.value)}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Shift Type *</InputLabel>
              <Select
                value={formData.shift_type}
                label="Shift Type"
                onChange={(e) => handleInputChange('shift_type', e.target.value)}
              >
                {shiftTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary">
                Selecting a shift type will automatically set the start/end times and duration
              </Typography>
            </FormControl>
            <TextField
              label="Required Staff Count *"
              type="number"
              value={formData.required_staff}
              onChange={(e) => handleInputChange('required_staff', parseInt(e.target.value) || 1)}
              fullWidth
              required
              inputProps={{ min: 1, max: 20 }}
            />
            <TextField
              label="Start Time *"
              type="time"
              value={formData.start_time}
              onChange={(e) => handleTimeChange('start_time', e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Time *"
              type="time"
              value={formData.end_time}
              onChange={(e) => handleTimeChange('end_time', e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Duration (hours) *"
              type="number"
              value={formData.duration}
              onChange={(e) => handleInputChange('duration', parseFloat(e.target.value) || 8.0)}
              fullWidth
              required
              inputProps={{ min: 0.5, max: 24, step: 0.25 }}
            />
            <Box sx={{ gridColumn: '1 / -1' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                  />
                }
                label="Active Template"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={!formData.template_name || !formData.shift_type || !formData.start_time || !formData.end_time}
          >
            {editingTemplate ? 'Update' : 'Add'}
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

export default ShiftTemplates;
