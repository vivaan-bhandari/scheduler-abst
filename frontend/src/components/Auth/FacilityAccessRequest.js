import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import { BusinessOutlined } from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const FacilityAccessRequest = ({ onRequestSubmitted }) => {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [selectedRole, setSelectedRole] = useState('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const roleOptions = [
    { value: 'staff', label: 'Staff Member' },
    { value: 'facility_admin', label: 'Facility Administrator' },
    { value: 'readonly', label: 'Read Only Access' },
  ];

  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/facilities/`);
      // Handle paginated or non-paginated response
      const facilitiesData = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      setFacilities(facilitiesData);
    } catch (err) {
      console.error('Error fetching facilities:', err);
      setFacilities([]); // Always set to an array on error
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/facility-access/request_access/`, {
        facility: selectedFacility,
        role: selectedRole,
      });

      setSuccess('Access request submitted successfully! An administrator will review your request.');
      setSelectedFacility('');
      setSelectedRole('staff');
      
      if (onRequestSubmitted) {
        onRequestSubmitted(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit access request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 600, width: '100%', mx: 'auto' }}>
      <CardHeader
        avatar={<BusinessOutlined sx={{ fontSize: 32, color: 'primary.main' }} />}
        title="Request Facility Access"
        subheader="Request access to manage data for a specific facility"
      />
      <CardContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Select Facility</InputLabel>
            <Select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              label="Select Facility"
              required
            >
              {facilities.map((facility) => (
                <MenuItem key={facility.id} value={facility.id}>
                  {facility.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Requested Role</InputLabel>
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              label="Requested Role"
              required
            >
              {roleOptions.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {role.label}
                    {role.value === 'facility_admin' && (
                      <Chip label="Admin" size="small" color="warning" />
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Role Descriptions:</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Staff Member:</strong> Can view and edit resident data, upload ADL records
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Facility Administrator:</strong> Can manage users, approve access requests, full facility control
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Read Only:</strong> Can view data but cannot make changes
            </Typography>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading || !selectedFacility}
            sx={{ mt: 3 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Submit Access Request'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default FacilityAccessRequest; 