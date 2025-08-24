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
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Chip,
  CircularProgress,
  Stack,
  Input,
} from '@mui/material';
import { 
  Edit,
  Delete,
  Add,
  Visibility,
  Download,
  Upload,
  Assessment,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const initialForm = {
  name: '',
  status: '',
  facility_section: '',
  facility_id: '',
  facility_name: '',
};

const ResidentList = ({ navigate }) => {
  const [residents, setResidents] = useState([]);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [selectedId, setSelectedId] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);
  const [residentADLs, setResidentADLs] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editADL, setEditADL] = useState(null);
  const [editForm, setEditForm] = useState({ minutes: '', frequency: '', status: '', per_day_shift_times: {} });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [editResidentOpen, setEditResidentOpen] = useState(false);
  const [editResidentForm, setEditResidentForm] = useState({ id: null, name: '', status: '' });
  const [deleteResidentId, setDeleteResidentId] = useState(null);

  useEffect(() => {
    fetchResidents();
    fetchQuestions();
  }, []);

  const fetchResidents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/residents/`);
      setResidents(res.data.results || res.data);
    } catch (err) {
      setError('Failed to fetch residents');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/adls/questions/`);
      setQuestions(res.data);
    } catch (err) {
      setError('Failed to fetch ADL questions');
    }
  };

  const handleOpenDialog = (resident = null) => {
    if (resident) {
      setEditMode(true);
      setForm({ ...resident });
      setSelectedId(resident.id);
    } else {
      setEditMode(false);
      setForm(initialForm);
      setSelectedId(null);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setForm(initialForm);
    setSelectedId(null);
    setEditMode(false);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      if (editMode) {
        await axios.put(`${API_BASE_URL}/api/residents/${selectedId}/`, form);
      } else {
        await axios.post(`${API_BASE_URL}/api/residents/`, form);
      }
      fetchResidents();
      handleCloseDialog();
    } catch (err) {
      setError('Failed to save resident');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this resident?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/residents/${id}/`);
        fetchResidents();
      } catch (err) {
        setError('Failed to delete resident');
      }
    }
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/residents/export/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'residents.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // Clean up the URL object
    } catch (err) {
      setError('Failed to export residents');
    }
  };

  const handleImportDialogOpen = () => {
    setImportDialogOpen(true);
    setImportError('');
    setImportSuccess('');
    setImportFile(null);
  };

  const handleImportDialogClose = () => {
    setImportDialogOpen(false);
    setImportError('');
    setImportSuccess('');
    setImportFile(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/csv') {
      setImportFile(file);
      setImportError('');
    } else {
      setImportError('Please select a valid CSV file');
      setImportFile(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setImportError('Please select a file to import');
      return;
    }

    setImportLoading(true);
    setImportError('');
    setImportSuccess('');

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/adls/upload/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
        },
      });
      setImportSuccess('ADL data imported successfully');
      fetchResidents();
      setTimeout(() => {
        handleImportDialogClose();
      }, 1500);
    } catch (err) {
      console.error('Import error:', err);
      setImportError(err.response?.data?.message || 'Failed to import ADL data. Please check your file format.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleResidentClick = async (resident) => {
    setModalOpen(true);
    setSelectedResident(resident);
    setModalLoading(true);
    setModalError('');
    try {
      const adlRes = await axios.get(`${API_BASE_URL}/api/adls/?resident=${resident.id}`);
      setResidentADLs(adlRes.data.results || adlRes.data);
    } catch (err) {
      setModalError('Failed to fetch ADL records');
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedResident(null);
    setResidentADLs([]);
    setModalError('');
  };

  const handleEditClick = (adl) => {
    setEditADL(adl);
    setEditForm({
      minutes: adl.minutes,
      frequency: adl.frequency,
      status: adl.status,
      per_day_shift_times: { ...adl.per_day_shift_times },
    });
    setEditError('');
  };

  const handleEditFormChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handlePerDayShiftChange = (key, value) => {
    setEditForm((prev) => ({
      ...prev,
      per_day_shift_times: { ...prev.per_day_shift_times, [key]: value },
    }));
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    setEditError('');
    try {
      await axios.patch(`${API_BASE_URL}/api/adls/${editADL.id}/`, {
        minutes: Number(editForm.minutes),
        frequency: Number(editForm.frequency),
        status: editForm.status,
        per_day_shift_times: editForm.per_day_shift_times,
      });
      // Refresh ADLs
      const adlRes = await axios.get(`${API_BASE_URL}/api/adls/?resident=${selectedResident.id}`);
      setResidentADLs(adlRes.data.results || adlRes.data);
      setEditADL(null);
    } catch (err) {
      setEditError('Failed to update ADL');
    } finally {
      setEditLoading(false);
    }
  };

  // Map: adl_question.id -> ADL response
  const adlMap = {};
  residentADLs.forEach(adl => {
    if (adl.adl_question) adlMap[adl.adl_question] = adl;
  });

  const [modalQuestion, setModalQuestion] = useState(null);
  const [modalForm, setModalForm] = useState({ minutes: '', frequency: '', status: '' });
  const [modalAdlId, setModalAdlId] = useState(null);
  const [modalEditError, setModalEditError] = useState('');
  const [modalEditLoading, setModalEditLoading] = useState(false);

  const handleOpenModal = (question) => {
    const adl = adlMap[question.id];
    setModalQuestion(question);
    setModalAdlId(adl ? adl.id : null);
    setModalForm({
      minutes: adl ? adl.minutes : '',
      frequency: adl ? adl.frequency : '',
      status: adl ? adl.status : '',
    });
    setModalEditError('');
  };

  const handleModalChange = (e) => {
    setModalForm({ ...modalForm, [e.target.name]: e.target.value });
  };

  const handleModalSave = async () => {
    setModalEditLoading(true);
    setModalEditError('');
    try {
      if (modalAdlId) {
        await axios.patch(`${API_BASE_URL}/api/adls/${modalAdlId}/`, {
          minutes: Number(modalForm.minutes),
          frequency: Number(modalForm.frequency),
          status: modalForm.status,
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/adls/`, {
          resident: selectedResident.id,
          adl_question: modalQuestion.id,
          minutes: Number(modalForm.minutes),
          frequency: Number(modalForm.frequency),
          status: modalForm.status || 'Incomplete',
        });
      }
      // Refresh ADLs
      const adlRes = await axios.get(`${API_BASE_URL}/api/adls/?resident=${selectedResident.id}`);
      setResidentADLs(adlRes.data.results || adlRes.data);
      setModalQuestion(null);
    } catch (err) {
      setModalEditError('Failed to save ADL response.');
    } finally {
      setModalEditLoading(false);
    }
  };

  const handleEditResident = (resident) => {
    setEditResidentForm({ id: resident.id, name: resident.name, status: resident.status });
    setEditResidentOpen(true);
  };

  const handleEditResidentChange = (e) => {
    setEditResidentForm({ ...editResidentForm, [e.target.name]: e.target.value });
  };

  const handleEditResidentSave = async () => {
    try {
      await axios.patch(`${API_BASE_URL}/api/residents/${editResidentForm.id}/`, {
        name: editResidentForm.name,
        status: editResidentForm.status,
      });
      setEditResidentOpen(false);
      fetchResidents();
    } catch (err) {
      alert('Failed to update resident');
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

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Residents
      </Typography>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Resident
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileUploadIcon />}
          onClick={handleImportDialogOpen}
        >
          Import CSV
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </Stack>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Section</TableCell>
              <TableCell>Facility ID</TableCell>
              <TableCell>Facility Name</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {residents.map((resident) => (
              <TableRow key={resident.id}>
                <TableCell>
                  <Button onClick={() => navigate(`/resident/${resident.id}`)}>{resident.name}</Button>
                </TableCell>
                <TableCell>{resident.status}</TableCell>
                <TableCell>{resident.facility_section}</TableCell>
                <TableCell>{resident.facility_id}</TableCell>
                <TableCell>{resident.facility_name}</TableCell>
                <TableCell>
                  <Button variant="outlined" size="small" onClick={() => handleEditResident(resident)}>Edit</Button>
                  <Button variant="outlined" color="error" size="small" onClick={() => setDeleteResidentId(resident.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? 'Edit Resident' : 'Add Resident'}</DialogTitle>
        <DialogContent>
          <TextField
            margin="normal"
            fullWidth
            label="Name"
            name="name"
            value={form.name}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            fullWidth
            label="Status"
            name="status"
            value={form.status}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            fullWidth
            label="Facility Section"
            name="facility_section"
            value={form.facility_section}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            fullWidth
            label="Facility ID"
            name="facility_id"
            value={form.facility_id}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            fullWidth
            label="Facility Name"
            name="facility_name"
            value={form.facility_name}
            onChange={handleChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>{editMode ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={handleImportDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Import Residents from CSV</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {importError && <Alert severity="error" sx={{ mb: 2 }}>{importError}</Alert>}
            {importSuccess && <Alert severity="success" sx={{ mb: 2 }}>{importSuccess}</Alert>}
            <input
              accept=".csv"
              style={{ display: 'none' }}
              id="raised-button-file"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="raised-button-file">
              <Button variant="outlined" component="span" fullWidth>
                Choose CSV File
              </Button>
            </label>
            {importFile && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Selected file: {importFile.name}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
                  <Button onClick={handleImportDialogClose} disabled={importLoading}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleImport} 
          disabled={!importFile || importLoading}
          startIcon={importLoading ? <CircularProgress size={16} /> : null}
        >
          {importLoading ? 'Importing...' : 'Import'}
        </Button>
        </DialogActions>
      </Dialog>

      {/* Modal for Resident Details */}
      <Dialog open={modalOpen} onClose={handleModalClose} maxWidth="md" fullWidth>
        <DialogTitle>Resident Details: {selectedResident?.name}</DialogTitle>
        <DialogContent>
          {modalLoading ? <CircularProgress /> : modalError ? <Alert severity="error">{modalError}</Alert> : (
            <>
              <Typography>Status: {selectedResident?.status}</Typography>
              <Typography>Facility Section: {selectedResident?.facility_section}</Typography>
              <Typography>Facility: {selectedResident?.facility_name} (ID: {selectedResident?.facility_id})</Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Question</TableCell>
                      <TableCell>Minutes</TableCell>
                      <TableCell>Frequency</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {questions.map((q, idx) => {
                      const adl = adlMap[q.id];
                      return (
                        <TableRow key={q.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{q.text}</TableCell>
                          <TableCell>{adl ? adl.minutes : '-'}</TableCell>
                          <TableCell>{adl ? adl.frequency : '-'}</TableCell>
                          <TableCell>{adl ? adl.status : 'Incomplete'}</TableCell>
                          <TableCell>
                            <Button variant="outlined" size="small" onClick={() => handleOpenModal(q)}>
                              {adl ? 'Edit' : 'Start'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleModalClose}>Close</Button>
        </DialogActions>
        <Dialog open={!!modalQuestion} onClose={() => setModalQuestion(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{modalQuestion ? `ADL: ${modalQuestion.text}` : ''}</DialogTitle>
          <DialogContent>
            <TextField
              margin="normal"
              fullWidth
              label="Minutes"
              name="minutes"
              type="number"
              value={modalForm.minutes}
              onChange={handleModalChange}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="Frequency"
              name="frequency"
              type="number"
              value={modalForm.frequency}
              onChange={handleModalChange}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="Status"
              name="status"
              value={modalForm.status}
              onChange={handleModalChange}
              required
            />
            {modalEditError && <Alert severity="error" sx={{ mt: 2 }}>{modalEditError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModalQuestion(null)}>Cancel</Button>
            <Button variant="contained" onClick={handleModalSave} disabled={modalEditLoading}>
              {modalEditLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </Dialog>

      {/* Edit ADL Dialog */}
      <Dialog open={!!editADL} onClose={() => setEditADL(null)} maxWidth="lg" fullWidth>
        <DialogTitle>Edit ADL</DialogTitle>
        <DialogContent>
          <TextField label="Minutes" name="minutes" type="number" value={editForm.minutes} onChange={handleEditFormChange} fullWidth sx={{ mb: 2 }} />
          <TextField label="Frequency" name="frequency" type="number" value={editForm.frequency} onChange={handleEditFormChange} fullWidth sx={{ mb: 2 }} />
          <TextField label="Status" name="status" select value={editForm.status} onChange={handleEditFormChange} fullWidth sx={{ mb: 3 }}>
            <MenuItem value="Complete">Complete</MenuItem>
            <MenuItem value="In Progress">In Progress</MenuItem>
            <MenuItem value="Not Started">Not Started</MenuItem>
          </TextField>
          
          <Typography variant="subtitle1" sx={{ mb: 2 }}>Per-Day/Shift Times (minutes)</Typography>
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Day</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Day</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Swing</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>NOC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <TableRow key={day}>
                    <TableCell sx={{ fontWeight: 'bold' }}>{day}</TableCell>
                    {[1, 2, 3].map((shift) => {
                      const key = `ResidentTotal${day}Shift${shift}Time`;
                      return (
                        <TableCell key={shift}>
                          <TextField
                            type="number"
                            value={editForm.per_day_shift_times[key] || 0}
                            onChange={e => handlePerDayShiftChange(key, Number(e.target.value))}
                            size="small"
                            sx={{ width: '80px' }}
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {editError && <Alert severity="error" sx={{ mt: 2 }}>{editError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditADL(null)}>Cancel</Button>
          <Button onClick={handleEditSave} disabled={editLoading} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Resident Dialog */}
      <Dialog open={editResidentOpen} onClose={() => setEditResidentOpen(false)}>
        <DialogTitle>Edit Resident</DialogTitle>
        <DialogContent>
          <TextField label="Name" name="name" value={editResidentForm.name} onChange={handleEditResidentChange} fullWidth sx={{ mb: 2 }} />
          <TextField label="Status" name="status" value={editResidentForm.status} onChange={handleEditResidentChange} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditResidentOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditResidentSave}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Resident Dialog */}
      <Dialog open={!!deleteResidentId} onClose={() => setDeleteResidentId(null)}>
        <DialogTitle>Delete Resident</DialogTitle>
        <DialogContent>Are you sure you want to delete this resident?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteResidentId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteResident}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResidentList; 