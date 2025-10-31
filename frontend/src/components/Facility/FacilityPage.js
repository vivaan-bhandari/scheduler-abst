import React, { useEffect, useState, useCallback } from 'react';
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
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
  Container,
  Tabs,
  Tab,
  MenuItem,
  Snackbar,
  Stack,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import ADLList from '../Dashboard/ADLList';
import ADLUpload from '../Dashboard/ADLUpload';
import ADLAnalytics from '../Dashboard/Analytics';
import CaregivingSummaryChart from '../Dashboard/CaregivingSummaryChart';
import { API_BASE_URL } from '../../config';
import { useWeek } from '../../contexts/WeekContext';

const FacilityPage = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const { selectedWeek, getWeekLabel } = useWeek();
  const [facility, setFacility] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [facilityForm, setFacilityForm] = useState({});
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({ name: '' });
  const [sectionError, setSectionError] = useState('');
  const [sectionEditDialogOpen, setSectionEditDialogOpen] = useState(false);
  const [sectionToEdit, setSectionToEdit] = useState(null);
  const [sectionDeleteDialogOpen, setSectionDeleteDialogOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [residents, setResidents] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newResident, setNewResident] = useState({ name: '', section: '' });
  const [addError, setAddError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importStatus, setImportStatus] = useState({ open: false, message: '', severity: 'success' });
  const [tab, setTab] = useState(0);
  const [selectedSection, setSelectedSection] = useState(null);
  

  const [deleteResidentId, setDeleteResidentId] = useState(null);

  const fetchFacility = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/facilities/${facilityId}/`);
      const facilityData = res.data;
      setFacility(facilityData);
      setFacilityForm(facilityData);
      setSections(facilityData.sections || []);
    } catch (err) {
      setError('Failed to fetch facility data');
      console.error('Error fetching facility:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  const fetchResidents = useCallback(async () => {
    if (!facilityId) return;
    try {
      // Get all residents without pagination
      const res = await axios.get(`${API_BASE_URL}/api/residents/?facility_id=${facilityId}&page_size=1000`);
      const data = res.data;
      
      const allResidents = data.results || data;
      setResidents(allResidents);
    } catch (err) {
      console.error('Error fetching residents:', err);
      console.error('Error response:', err.response?.data);
      setResidents([]);
    }
  }, [facilityId]);

  useEffect(() => {
    if (facilityId) {
      fetchFacility();
      fetchResidents();
    }
  }, [facilityId, fetchFacility, fetchResidents]);

  const validateEmail = (email) => {
    if (!email) return '';
    // Simple email regex
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) ? '' : 'Please enter a valid email address.';
  };

  const handleFacilityChange = (e) => {
    const { name, value } = e.target;
    setFacilityForm({ ...facilityForm, [name]: value });
    if (name === 'email') {
      setEmailError(validateEmail(value));
    }
  };

  const handleFacilitySave = async () => {
    // Validate email before saving
    const emailErr = validateEmail(facilityForm.email);
    setEmailError(emailErr);
    if (emailErr) return;
    try {
      // Only send valid Facility fields
      const {
        name,
        facility_type,
        facility_id,
        admin_name,
        phone,
        email,
        address,
        city,
        state,
        zip_code
      } = facilityForm;
      const payload = {
        name,
        facility_type,
        facility_id,
        admin_name,
        phone,
        email,
        address,
        city,
        state,
        zip_code
      };
      await axios.put(`${API_BASE_URL}/api/facilities/${facility.id}/`, payload);
      setFacility({ ...facility, ...payload });
      setEditMode(false);
    } catch (err) {
      setError('Failed to update facility info');
    }
  };

  const handleSectionDialogOpen = () => {
    setSectionDialogOpen(true);
    setSectionForm({ name: '' });
    setSectionError('');
  };

  const handleSectionDialogClose = () => {
    setSectionDialogOpen(false);
    setSectionForm({ name: '' });
    setSectionError('');
  };

  const handleSectionFormChange = (e) => {
    setSectionForm({ ...sectionForm, [e.target.name]: e.target.value });
  };

  const handleSectionAdd = async () => {
    if (!sectionForm.name) {
      setSectionError('Section name is required');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/facilitysections/`, {
        name: sectionForm.name,
        facility: facility.id,
      });
      setSectionDialogOpen(false);
      setSectionForm({ name: '' });
      setSectionError('');
      fetchFacility();
    } catch (err) {
      setSectionError('Failed to add section');
    }
  };

  const handleSectionEditDialogOpen = (section) => {
    setSectionToEdit(section);
    setSectionForm({ name: section.name });
    setSectionEditDialogOpen(true);
    setSectionError('');
  };

  const handleSectionEditDialogClose = () => {
    setSectionEditDialogOpen(false);
    setSectionToEdit(null);
    setSectionError('');
  };

  const handleSectionEdit = async () => {
    if (!sectionForm.name) {
      setSectionError('Section name is required');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/facilitysections/${sectionToEdit.id}/`, {
        ...sectionForm,
        facility: facility.id,
      });
      fetchFacility();
      setSectionEditDialogOpen(false);
    } catch (err) {
      setSectionError('Failed to update section');
    }
  };

  const handleSectionDeleteDialogOpen = (section) => {
    setSectionToDelete(section);
    setSectionDeleteDialogOpen(true);
  };

  const handleSectionDeleteDialogClose = () => {
    setSectionDeleteDialogOpen(false);
    setSectionToDelete(null);
  };

  const handleSectionDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/api/facilitysections/${sectionToDelete.id}/`);
      fetchFacility();
      setSectionDeleteDialogOpen(false);
    } catch (err) {
      setSectionError('Failed to delete section');
    }
  };

  const handleBackToFacilities = () => {
    navigate('/');
  };

  const handleAddResident = async () => {
    try {
      // Use selectedSection.id if a section is selected, otherwise use newResident.section
      const sectionId = selectedSection ? selectedSection.id : newResident.section;
      
      if (!sectionId) {
        setAddError('Please select a section.');
        return;
      }
      
      await axios.post(`${API_BASE_URL}/api/residents/`, {
        name: newResident.name,
        status: 'New',
        facility_section: sectionId,
      });
      
      setAddOpen(false);
      setNewResident({ name: '', section: '' });
      setAddError('');
      fetchResidents();
    } catch (err) {
      console.error('Error adding resident:', err);
      setAddError('Failed to add resident.');
    }
  };

  const handleImportCSV = async () => {
    if (!importFile) return;
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('facility_id', facilityId); // Add facility context
    try {
      const response = await axios.post(`${API_BASE_URL}/api/adls/upload/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportStatus({ open: true, message: 'Import successful!', severity: 'success' });
      setImportOpen(false);
      setImportFile(null);
      fetchResidents();
    } catch (err) {
      console.error('Import error:', err);
      const errorMessage = err.response?.data?.message || 'Import failed. Please check your file format.';
      setImportStatus({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const handleDeleteResident = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/api/residents/${deleteResidentId}/`);
      setDeleteResidentId(null);
      fetchResidents();
    } catch (err) {
      alert('Failed to delete resident');
    }
  };

  if (loading) return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography>Loading facility...</Typography>
    </Container>
  );
  
  if (error) return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Alert severity="error">{error}</Alert>
    </Container>
  );
  
  if (!facility) return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography>Facility not found.</Typography>
    </Container>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Back Button */}
      <Button
        variant="outlined"
        startIcon={<ArrowBackIcon />}
        onClick={handleBackToFacilities}
        sx={{ mb: 3 }}
      >
        Back to Facilities
      </Button>

      {/* Facility Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {facility.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {facility.facility_type} • {facility.address}, {facility.city}, {facility.state}
        </Typography>
      </Box>

      {/* Caregiving Summary Chart */}
      <CaregivingSummaryChart 
        title={`Caregiving Time Summary - ${facility.name} - ${getWeekLabel(selectedWeek)}`}
        endpoint={`${API_BASE_URL}/api/facilities/${facilityId}/caregiving_summary/`}
        queryParams={selectedWeek ? { week_start_date: selectedWeek } : {}}
      />

      {/* Classic ABST Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Residents" />
        <Tab label="ADL Data" />
        <Tab label="Upload ADL" />
        <Tab label="Analytics" />
      </Tabs>

      {/* Tab Panels */}
      {tab === 0 && (
        <>
          {/* Residents Table and Import UI (existing code) */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
            <Typography variant="h5">Residents</Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button variant="contained" onClick={() => setAddOpen(true)}>Add Resident</Button>
              <Button variant="outlined" onClick={handleSectionDialogOpen}>Add Section</Button>
              <Button variant="outlined" onClick={() => setImportOpen(true)}>Import CSV</Button>
            </Stack>
          </Box>
          <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
            <DialogTitle>Add Resident</DialogTitle>
            <DialogContent>
              <TextField
                label="Name"
                value={newResident.name}
                onChange={e => setNewResident({ ...newResident, name: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                select
                label="Section"
                value={selectedSection ? selectedSection.id : newResident.section}
                onChange={e => {
                  if (selectedSection) {
                    // If a section is selected, update the selectedSection
                    const section = sections.find(s => s.id === parseInt(e.target.value));
                    setSelectedSection(section);
                  } else {
                    // Otherwise update the newResident.section
                    setNewResident({ ...newResident, section: e.target.value });
                  }
                }}
                fullWidth
                margin="normal"
              >
                {sections.map(section => (
                  <MenuItem key={section.id} value={section.id}>{section.name}</MenuItem>
                ))}
              </TextField>
              {addError && <Typography color="error">{addError}</Typography>}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddResident} variant="contained">Add</Button>
            </DialogActions>
          </Dialog>
          <Dialog open={importOpen} onClose={() => setImportOpen(false)}>
            <DialogTitle>Import Residents & ADL Data (CSV)</DialogTitle>
            <DialogContent>
              <input
                type="file"
                accept=".csv"
                onChange={e => setImportFile(e.target.files[0])}
                style={{ marginTop: 16 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button onClick={handleImportCSV} variant="contained" disabled={!importFile}>Import</Button>
            </DialogActions>
          </Dialog>
          <Snackbar
            open={importStatus.open}
            autoHideDuration={4000}
            onClose={() => setImportStatus({ ...importStatus, open: false })}
          >
            <Alert severity={importStatus.severity} sx={{ width: '100%' }}>
              {importStatus.message}
            </Alert>
          </Snackbar>
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>Sections</Typography>
            
            {selectedWeek !== '2025-07-21' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Week: {getWeekLabel(selectedWeek)} (Debug: {selectedWeek})</strong><br />
                  Showing sections and residents for this week. ADL data will be empty unless you create new entries.
                </Typography>
              </Alert>
            )}
            
            {sections.length === 0 ? (
              <Typography color="text.secondary">No sections found for this facility.</Typography>
            ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                      <TableCell>Name</TableCell>
                <TableCell>Occupancy</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Updated</TableCell>
                      <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sections.map((section) => (
                      <TableRow key={section.id} hover selected={selectedSection?.id === section.id} onClick={() => setSelectedSection(section)} style={{ cursor: 'pointer' }}>
                        <TableCell>{section.name}</TableCell>
                        <TableCell>{section.occupancy ?? '-'}</TableCell>
                        <TableCell>{section.created_at ? new Date(section.created_at).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{section.updated_at ? new Date(section.updated_at).toLocaleDateString() : '-'}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => handleSectionEditDialogOpen(section)}>Edit</Button>
                          <Button variant="outlined" color="error" size="small" onClick={() => handleSectionDeleteDialogOpen(section)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
          {selectedSection && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Residents in Section: {selectedSection.name} (ID: {selectedSection.id})
                </Typography>
                <Button variant="outlined" onClick={() => setSelectedSection(null)}>Back to Sections</Button>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" onClick={() => setAddOpen(true)}>Add Resident</Button>
              </Box>
              {(() => {
                const filteredResidents = residents.filter(r => r.facility_section === selectedSection.id || r.facility_section?.id === selectedSection.id);
                return filteredResidents.length === 0 ? (
                  <Typography color="text.secondary">No residents found in this section.</Typography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell>Updated</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredResidents.map((resident) => (
                          <TableRow key={resident.id}>
                            <TableCell>
                              <Button variant="text" color="primary" onClick={() => navigate(`/resident/${resident.id}`)}>
                                {resident.name}
                              </Button>
                            </TableCell>
                            <TableCell>{resident.status}</TableCell>
                            <TableCell>{new Date(resident.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(resident.updated_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button variant="outlined" color="error" size="small" onClick={() => setDeleteResidentId(resident.id)}>Delete</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                );
              })()}
              <Dialog open={!!deleteResidentId} onClose={() => setDeleteResidentId(null)}>
                <DialogTitle>Delete Resident</DialogTitle>
                <DialogContent>Are you sure you want to delete this resident?</DialogContent>
                <DialogActions>
                  <Button onClick={() => setDeleteResidentId(null)}>Cancel</Button>
                  <Button variant="contained" color="error" onClick={handleDeleteResident}>Delete</Button>
                </DialogActions>
              </Dialog>
      </Paper>
          )}
      <Dialog open={sectionDialogOpen} onClose={handleSectionDialogClose} maxWidth="sm" fullWidth>
            <DialogTitle>Add Section</DialogTitle>
        <DialogContent>
          <TextField
            margin="normal"
            fullWidth
            label="Section Name"
            name="name"
            value={sectionForm.name}
                onChange={handleSectionFormChange}
                required
              />
              {sectionError && <Alert severity="error" sx={{ mt: 2 }}>{sectionError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSectionDialogClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSectionAdd}>Add Section</Button>
        </DialogActions>
      </Dialog>
          <Dialog open={sectionEditDialogOpen} onClose={handleSectionEditDialogClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogContent>
              <TextField
                margin="normal"
                fullWidth
                label="Section Name"
                name="name"
                value={sectionForm.name}
                onChange={handleSectionFormChange}
                required
              />
              {sectionError && <Alert severity="error" sx={{ mt: 2 }}>{sectionError}</Alert>}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleSectionEditDialogClose}>Cancel</Button>
              <Button variant="contained" onClick={handleSectionEdit}>Save</Button>
            </DialogActions>
          </Dialog>
          <Dialog open={sectionDeleteDialogOpen} onClose={handleSectionDeleteDialogClose} maxWidth="xs">
            <DialogTitle>Delete Section</DialogTitle>
            <DialogContent>
              Are you sure you want to delete the section "{sectionToDelete?.name}"?
            </DialogContent>
            <DialogActions>
              <Button onClick={handleSectionDeleteDialogClose}>Cancel</Button>
              <Button variant="contained" color="error" onClick={handleSectionDelete}>Delete</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
      {tab === 1 && (
        <ADLList facilityId={facilityId} />
      )}
      {tab === 2 && (
        <ADLUpload facilityId={facilityId} selectedWeek={selectedWeek} />
      )}
      {tab === 3 && (
        <ADLAnalytics facilityId={facilityId} />
      )}
    </Container>
  );
};

export default FacilityPage; 