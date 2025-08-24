import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Alert,
  Container,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import CaregivingSummaryChart from '../Dashboard/CaregivingSummaryChart';

const FacilitySectionDetails = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  const [editSectionForm, setEditSectionForm] = useState({ name: '', occupancy: '' });
  const [deleteSectionConfirm, setDeleteSectionConfirm] = useState(false);
  const [editResidentOpen, setEditResidentOpen] = useState(false);
  const [editResidentForm, setEditResidentForm] = useState({ id: null, name: '', status: '' });
  const [deleteResidentId, setDeleteResidentId] = useState(null);

  useEffect(() => {
    fetchSection();
    // eslint-disable-next-line
  }, [sectionId]);

  const fetchSection = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/facilitysections/${sectionId}/`);
      setSection(res.data);
    } catch (err) {
      setError('Failed to fetch section data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSection = () => {
    setEditSectionForm({ name: section.name, occupancy: section.occupancy });
    setEditSectionOpen(true);
  };
  const handleEditSectionChange = (e) => {
    setEditSectionForm({ ...editSectionForm, [e.target.name]: e.target.value });
  };
  const handleEditSectionSave = async () => {
    try {
      await axios.patch(`${API_BASE_URL}/api/facilitysections/${sectionId}/`, editSectionForm);
      setEditSectionOpen(false);
      fetchSection();
    } catch (err) {
      alert('Failed to update section');
    }
  };
  const handleDeleteSection = async () => {
    try {
      await axios.delete(`http://localhost:8000/api/facilitysections/${sectionId}/`);
      setDeleteSectionConfirm(false);
      navigate(-1);
    } catch (err) {
      alert('Failed to delete section');
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
      await axios.patch(`http://localhost:8000/api/residents/${editResidentForm.id}/`, {
        name: editResidentForm.name,
        status: editResidentForm.status,
      });
      setEditResidentOpen(false);
      fetchSection();
    } catch (err) {
      alert('Failed to update resident');
    }
  };
  const handleDeleteResident = async () => {
    try {
      await axios.delete(`http://localhost:8000/api/residents/${deleteResidentId}/`);
      setDeleteResidentId(null);
      fetchSection();
    } catch (err) {
      alert('Failed to delete resident');
    }
  };

  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!section) return <Typography>No section found.</Typography>;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back to Facility</Button>
      <Typography variant="h4" gutterBottom>Facility Section Details</Typography>
      
      {/* Caregiving Summary Chart */}
      <CaregivingSummaryChart 
        title={`Caregiving Time Summary - ${section?.name || 'Section'}`}
        endpoint={`http://localhost:8000/api/facilitysections/${sectionId}/caregiving_summary/`}
      />
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
        <Typography variant="h6">Section: {section.name}</Typography>
        <Typography>Occupancy: {section.occupancy}</Typography>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" onClick={handleEditSection}>Edit</Button>
              <Button variant="outlined" color="error" size="small" onClick={() => setDeleteSectionConfirm(true)}>Delete</Button>
        </Box>
      </Paper>
        </Grid>
        <Grid item xs={12}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Residents</Typography>
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
              {section.residents && section.residents.length > 0 ? (
                section.residents.map((resident) => (
                  <TableRow key={resident.id}>
                    <TableCell>{resident.name}</TableCell>
                    <TableCell>{resident.status}</TableCell>
                    <TableCell>{new Date(resident.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(resident.updated_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="outlined" size="small" onClick={() => handleEditResident(resident)}>Edit</Button>
                          <Button variant="outlined" color="error" size="small" onClick={() => setDeleteResidentId(resident.id)}>Delete</Button>
                        </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} align="center">No residents found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
        </Grid>
      </Grid>
      <Dialog open={editSectionOpen} onClose={() => setEditSectionOpen(false)}>
        <DialogTitle>Edit Section</DialogTitle>
        <DialogContent>
          <TextField label="Name" name="name" value={editSectionForm.name} onChange={handleEditSectionChange} fullWidth sx={{ mb: 2 }} />
          <TextField label="Occupancy" name="occupancy" type="number" value={editSectionForm.occupancy} onChange={handleEditSectionChange} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditSectionOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSectionSave}>Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteSectionConfirm} onClose={() => setDeleteSectionConfirm(false)}>
        <DialogTitle>Delete Section</DialogTitle>
        <DialogContent>Are you sure you want to delete this section?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteSectionConfirm(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteSection}>Delete</Button>
        </DialogActions>
      </Dialog>
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
      <Dialog open={!!deleteResidentId} onClose={() => setDeleteResidentId(null)}>
        <DialogTitle>Delete Resident</DialogTitle>
        <DialogContent>Are you sure you want to delete this resident?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteResidentId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteResident}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FacilitySectionDetails; 