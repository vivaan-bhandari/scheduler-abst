import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const StaffAssignments = ({ facilityId }) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (facilityId) {
      fetchAssignments();
    }
  }, [facilityId]);

  const fetchAssignments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/scheduling/assignments/?facility=${facilityId}`);
      const data = response.data.results || response.data;
      console.log('🔍 Staff Assignments Data:', data);
      if (data.length > 0) {
        console.log('🔍 First Assignment Structure:', data[0]);
        console.log('🔍 Shift Data:', data[0].shift);
        console.log('🔍 Shift Template Data:', data[0].shift?.shift_template);
      }
      setAssignments(data);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (assignment) => {
    setEditingAssignment(assignment);
    // For now, just log the assignment. You can expand this to show an edit modal
    console.log('Edit assignment:', assignment);
  };

  const handleDelete = async (assignmentId) => {
    setDeleteConfirm(assignmentId);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      try {
        await axios.delete(`${API_BASE_URL}/api/scheduling/assignments/${deleteConfirm}/`);
        // Refresh the assignments list
        await fetchAssignments();
        setDeleteConfirm(null);
      } catch (error) {
        console.error('Error deleting assignment:', error);
        alert('Failed to delete assignment. Please try again.');
      }
    }
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

  if (!facilityId) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Please select a facility to view staff assignments
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Staff Assignments
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Use the "Planner (Grid)" tab for drag-and-drop scheduling. This view shows current assignments.
      </Alert>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Staff Member</TableCell>
              <TableCell>Shift</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell>
                  <Typography variant="subtitle2">
                    {assignment.staff?.first_name} {assignment.staff?.last_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {assignment.staff?.role}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={assignment.shift?.shift_template?.template_name || 
                           assignment.shift?.shift_template?.shift_type || 
                           'Unknown'} 
                    size="small" 
                    color={getShiftTypeColor(assignment.shift?.shift_template?.shift_type)}
                  />
                </TableCell>
                <TableCell>
                  {assignment.shift?.date ? new Date(assignment.shift.date).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell>
                  {assignment.shift?.shift_template?.start_time && assignment.shift?.shift_template?.end_time 
                    ? `${assignment.shift.shift_template.start_time} - ${assignment.shift.shift_template.end_time}`
                    : 'Time not set'}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={assignment.status || 'assigned'} 
                    size="small" 
                    color={assignment.status === 'confirmed' ? 'success' : 
                           assignment.status === 'cancelled' ? 'error' : 
                           assignment.status === 'completed' ? 'default' : 'primary'}
                  />
                </TableCell>
                <TableCell>
                  <IconButton 
                    size="small" 
                    title="Edit"
                    onClick={() => handleEdit(assignment)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    color="error" 
                    title="Remove"
                    onClick={() => handleDelete(assignment.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {assignments.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No staff assignments found. Use the Planner (Grid) tab to create assignments.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Assignment Modal */}
      <Dialog 
        open={Boolean(editingAssignment)} 
        onClose={() => setEditingAssignment(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Staff Assignment</DialogTitle>
        <DialogContent>
          {editingAssignment && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Staff: {editingAssignment.staff?.first_name} {editingAssignment.staff?.last_name} ({editingAssignment.staff?.role})
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Shift: {editingAssignment.shift?.shift_template?.template_name || 'Unknown'} - {editingAssignment.shift?.shift_template?.start_time} to {editingAssignment.shift?.shift_template?.end_time}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Date: {editingAssignment.shift?.date ? new Date(editingAssignment.shift.date).toLocaleDateString() : 'Not specified'}
              </Typography>
              
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={editingAssignment.status || 'assigned'}
                  label="Status"
                  onChange={(e) => setEditingAssignment({
                    ...editingAssignment,
                    status: e.target.value
                  })}
                >
                  <MenuItem value="assigned">Assigned</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingAssignment(null)}>Cancel</Button>
          <Button 
            onClick={async () => {
              if (editingAssignment) {
                try {
                  await axios.patch(
                    `${API_BASE_URL}/api/scheduling/assignments/${editingAssignment.id}/`,
                    { status: editingAssignment.status }
                  );
                  await fetchAssignments();
                  setEditingAssignment(null);
                } catch (error) {
                  console.error('Error updating assignment:', error);
                  alert('Failed to update assignment. Please try again.');
                }
              }
            }}
            variant="contained"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={Boolean(deleteConfirm)} 
        onClose={() => setDeleteConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove this staff assignment? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button 
            onClick={confirmDelete}
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StaffAssignments;
