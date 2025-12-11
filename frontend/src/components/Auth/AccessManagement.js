import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import { AdminPanelSettings, CheckCircle, Cancel, Add, Delete } from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const AccessManagement = () => {
  const [tab, setTab] = useState(0);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allAccess, setAllAccess] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [approvalDialog, setApprovalDialog] = useState({ open: false, request: null });
  const [assignDialog, setAssignDialog] = useState({ open: false });
  const [assignForm, setAssignForm] = useState({
    user: '',
    facility: '',
    role: 'staff'
  });

  useEffect(() => {
    if (tab === 0) fetchPendingRequests();
    if (tab === 1) fetchAllUsersAndAccess();
    if (tab === 2) fetchFacilities();
    if (tab === 3) fetchFacilities(); // Facility Management tab
  }, [tab]);

  const fetchFacilities = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/facilities/`);
      const facilitiesData = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      setFacilities(facilitiesData);
    } catch (err) {
      console.error('Error fetching facilities:', err);
      setFacilities([]);
    }
  };

  const fetchPendingRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_BASE_URL}/api/facility-access/pending_requests/`);
      setPendingRequests(response.data);
    } catch (err) {
      if (err.response) {
        if (err.response.status === 403) {
          setError('You must be an admin to view pending requests.');
        } else if (err.response.status === 401) {
          setError('You must be logged in to view this page.');
        } else {
          setError(err.response.data.error || 'Failed to fetch pending requests');
        }
      } else {
        setError('Network error: Could not connect to server.');
      }
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsersAndAccess = async () => {
    setLoading(true);
    setError("");
    try {
      const usersRes = await axios.get(`${API_BASE_URL}/api/users/`);
      const accessRes = await axios.get(`${API_BASE_URL}/api/facility-access/`);
      const users = Array.isArray(usersRes.data)
        ? usersRes.data
        : usersRes.data.results || [];
      setAllUsers(users);
      setAllAccess(Array.isArray(accessRes.data) ? accessRes.data : accessRes.data.results || []);
    } catch (err) {
      if (err.response) {
        if (err.response.status === 403) {
          setError('You must be an admin to view the user access matrix.');
        } else if (err.response.status === 401) {
          setError('You must be logged in to view this page.');
        } else {
          setError(err.response.data.error || 'Failed to fetch users or access records');
        }
      } else {
        setError('Network error: Could not connect to server.');
      }
      setAllUsers([]);
      setAllAccess([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId, status) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/facility-access/${requestId}/approve_access/`, {
        status: status
      });
      
      setSuccess(`Request ${status === 'approved' ? 'approved' : 'denied'} successfully`);
      fetchPendingRequests();
      setApprovalDialog({ open: false, request: null });
    } catch (err) {
      setError('Failed to update request status');
    }
  };

  const handleAssignAccess = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/facility-access/assign_access/`, assignForm);
      setSuccess('Access assigned successfully');
      setAssignDialog({ open: false });
      setAssignForm({ user: '', facility: '', role: 'staff' });
      fetchAllUsersAndAccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign access');
    }
  };

  const handleRemoveAccess = async (userId, facilityId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/facility-access/remove_access/`, {
        data: { user: userId, facility: facilityId }
      });
      setSuccess('Access removed successfully');
      fetchAllUsersAndAccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove access');
    }
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      pending: { color: 'warning', label: 'Pending' },
      approved: { color: 'success', label: 'Approved' },
      denied: { color: 'error', label: 'Denied' },
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const getRoleChip = (role) => {
    const roleConfig = {
      superadmin: { color: 'error', label: 'Super Admin' },
      admin: { color: 'secondary', label: 'Admin' },
      staff: { color: 'primary', label: 'Staff' },
      facility_admin: { color: 'warning', label: 'Facility Admin' },
      readonly: { color: 'default', label: 'Read Only' },
    };
    
    const config = roleConfig[role] || roleConfig.staff;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={<Box><b>Pending Requests</b><Typography variant="caption" display="block">Approve or deny new access requests</Typography></Box>} />
        <Tab label={<Box><b>User Access Matrix</b><Typography variant="caption" display="block">See all users and their facility access</Typography></Box>} />
        <Tab label={<Box><b>Assign Access</b><Typography variant="caption" display="block">Superadmin: Assign facility access to users</Typography></Box>} />
        <Tab label={<Box><b>Facility Management</b><Typography variant="caption" display="block">Admin: Manage facility shift formats and settings</Typography></Box>} />
      </Tabs>
      {tab === 0 && (
        <Card>
          <CardHeader
            avatar={<AdminPanelSettings sx={{ fontSize: 32, color: 'primary.main' }} />}
            title="Access Request Management"
            subheader="Review and approve facility access requests"
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

            {!error && pendingRequests.length === 0 && !loading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  No pending access requests
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  All access requests have been processed
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Facility</TableCell>
                      <TableCell>Requested Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Typography variant="body2">
                            {request.user_username}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {request.user_email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {request.facility_name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {getRoleChip(request.role)}
                        </TableCell>
                        <TableCell>
                          {getStatusChip(request.status)}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckCircle />}
                              onClick={() => setApprovalDialog({ open: true, request })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<Cancel />}
                              onClick={() => handleApprove(request.id, 'denied')}
                            >
                              Deny
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
      {tab === 2 && (
        <Card>
          <CardHeader
            avatar={<AdminPanelSettings sx={{ fontSize: 32, color: 'error.main' }} />}
            title="Assign Facility Access"
            subheader="Superadmin: Directly assign facility access to users"
            action={
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                onClick={() => setAssignDialog({ open: true })}
              >
                Assign Access
              </Button>
            }
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

            <Typography variant="body1" sx={{ mb: 2 }}>
              Use this section to directly assign facility access to users. This bypasses the approval process.
            </Typography>
          </CardContent>
        </Card>
      )}
      {tab === 1 && (
        <Card>
          <CardHeader
            avatar={<AdminPanelSettings sx={{ fontSize: 32, color: 'primary.main' }} />}
            title="User Access Matrix"
            subheader="View and manage which users have access to which facilities"
          />
          <CardContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {!error && allUsers.length === 0 && !loading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  No users found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Users will appear here after registration
                </Typography>
              </Box>
            ) : null}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Facility Access</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(allUsers || []).map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {(allAccess || [])
                            .filter((a) => a.user === user.id)
                            .map((a) => (
                              <Chip
                                key={a.id}
                                label={`${a.facility_name} (${a.role}, ${a.status})`}
                                color={a.status === 'approved' ? 'success' : a.status === 'pending' ? 'warning' : 'error'}
                                size="small"
                                sx={{ mr: 1, mb: 1 }}
                              />
                            ))}
                        </TableCell>
                        <TableCell>
                          {(allAccess || [])
                            .filter((a) => a.user === user.id && a.status === 'approved')
                            .map((a) => (
                              <Button
                                key={a.id}
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<Delete />}
                                onClick={() => handleRemoveAccess(user.id, a.facility)}
                                sx={{ mr: 1, mb: 1 }}
                              >
                                Remove
                              </Button>
                            ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onClose={() => setApprovalDialog({ open: false, request: null })}>
        <DialogTitle>Approve Access Request</DialogTitle>
        <DialogContent>
          {approvalDialog.request && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Approve access for <strong>{approvalDialog.request.user_username}</strong> to{' '}
                <strong>{approvalDialog.request.facility_name}</strong>?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Role: {approvalDialog.request.role}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog({ open: false, request: null })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleApprove(approvalDialog.request?.id, 'approved')}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Access Dialog */}
      <Dialog open={assignDialog.open} onClose={() => setAssignDialog({ open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Facility Access</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>User</InputLabel>
              <Select
                value={assignForm.user}
                onChange={(e) => setAssignForm({ ...assignForm, user: e.target.value })}
                label="User"
              >
                {allUsers.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Facility</InputLabel>
              <Select
                value={assignForm.facility}
                onChange={(e) => setAssignForm({ ...assignForm, facility: e.target.value })}
                label="Facility"
              >
                {facilities.map((facility) => (
                  <MenuItem key={facility.id} value={facility.id}>
                    {facility.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={assignForm.role}
                onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}
                label="Role"
              >
                <MenuItem value="superadmin">Super Admin</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="facility_admin">Facility Admin</MenuItem>
                <MenuItem value="staff">Staff</MenuItem>
                <MenuItem value="readonly">Read Only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog({ open: false })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAssignAccess}
            disabled={!assignForm.user || !assignForm.facility}
          >
            Assign Access
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Facility Management Tab */}
      {tab === 3 && (
        <Card>
          <CardHeader
            avatar={<AdminPanelSettings sx={{ fontSize: 32, color: 'primary.main' }} />}
            title="Facility Management"
            subheader="Admin: Configure shift formats and settings for all facilities"
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

            <Typography variant="body1" sx={{ mb: 3 }}>
              Manage shift format settings for each facility. This determines whether facilities use 2-shift (Day/NOC) or 3-shift (Day/Swing/NOC) scheduling.
            </Typography>

            {facilities.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  No facilities found
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Facility Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Current Shift Format</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {facilities.map((facility) => (
                      <FacilityShiftFormatRow 
                        key={facility.id} 
                        facility={facility}
                        onUpdate={() => {
                          fetchFacilities();
                          setSuccess('Shift format updated successfully');
                          setTimeout(() => setSuccess(''), 3000);
                        }}
                        onError={(err) => {
                          setError(err);
                          setTimeout(() => setError(''), 5000);
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

// Component for managing individual facility shift format
const FacilityShiftFormatRow = ({ facility, onUpdate, onError }) => {
  const [shiftFormat, setShiftFormat] = useState(facility.shift_format || '3_shift');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (shiftFormat === facility.shift_format) return; // No change
    
    setSaving(true);
    try {
      // Use PATCH for partial update (only send shift_format)
      await axios.patch(`${API_BASE_URL}/api/facilities/${facility.id}/`, {
        shift_format: shiftFormat
      });
      onUpdate();
    } catch (err) {
      console.error('Error updating shift format:', err);
      console.error('Error response:', err.response?.data);
      onError(err.response?.data?.detail || err.response?.data?.shift_format?.[0] || 'Failed to update shift format');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {facility.name}
        </Typography>
        {facility.facility_type && (
          <Typography variant="caption" color="text.secondary">
            {facility.facility_type}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {facility.city && facility.state ? `${facility.city}, ${facility.state}` : facility.address || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={shiftFormat}
            onChange={(e) => setShiftFormat(e.target.value)}
            disabled={saving}
          >
            <MenuItem value="2_shift">2-Shift (Day/NOC - 12 hour shifts)</MenuItem>
            <MenuItem value="3_shift">3-Shift (Day/Swing/NOC - 8 hour shifts)</MenuItem>
          </Select>
        </FormControl>
      </TableCell>
      <TableCell>
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          disabled={saving || shiftFormat === facility.shift_format}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default AccessManagement; 