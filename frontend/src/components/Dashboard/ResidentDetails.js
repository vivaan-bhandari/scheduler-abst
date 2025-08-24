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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Container,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import CaregivingSummaryChart from './CaregivingSummaryChart';

const days = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];
const dayPrefixes = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'];
const shifts = [
  { label: 'Day', key: 'Shift1' },
  { label: 'Swing', key: 'Shift2' },
  { label: 'NOC', key: 'Shift3' },
];

const ResidentDetails = () => {
  const { residentId } = useParams();
  const navigate = useNavigate();
  const [resident, setResident] = useState(null);
  const [adls, setAdls] = useState([]); // All ADL responses for this resident
  const [questions, setQuestions] = useState([]); // Master list
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuestion, setModalQuestion] = useState(null);
  const [modalForm, setModalForm] = useState({ minutes: '', frequency: '', per_day_shift_times: {} });
  const [modalAdlId, setModalAdlId] = useState(null);
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, [residentId]);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [res, qRes, adlRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/residents/${residentId}/`),
        axios.get(`${API_BASE_URL}/api/adls/questions/`),
        axios.get(`${API_BASE_URL}/api/adls/?resident=${residentId}&page_size=1000`),
      ]);
      setResident(res.data);
      setQuestions(qRes.data);
      setAdls(adlRes.data.results || adlRes.data);
    } catch (err) {
      setError('Failed to fetch resident or ADL data');
    } finally {
      setLoading(false);
    }
  };

  // Map: adl_question.id -> ADL response
  const adlMap = {};
  adls.forEach(adl => {
    if (adl.adl_question) adlMap[adl.adl_question] = adl;
  });

  const handleOpenModal = (question) => {
    const adl = adlMap[question.id];
    setModalQuestion(question);
    setModalAdlId(adl ? adl.id : null);
    setModalForm({
      minutes: adl ? adl.minutes : '',
      frequency: adl ? adl.frequency : '',
      per_day_shift_times: adl ? { ...adl.per_day_shift_times } : {},
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleModalChange = (e) => {
    setModalForm({ ...modalForm, [e.target.name]: e.target.value });
  };

  const handlePerDayShiftChange = (dayIdx, shiftKey, value) => {
    const prefix = dayPrefixes[dayIdx];
    const field = `${prefix}${shiftKey}Time`;
    setModalForm((prev) => ({
      ...prev,
      per_day_shift_times: {
        ...prev.per_day_shift_times,
        [field]: value,
      },
    }));
  };

  // Bulk fill templates for common patterns (now fills '1' for selected cells)
  const applyBulkTemplate = (template) => {
    const newPerDayShiftTimes = { ...modalForm.per_day_shift_times };
    switch (template) {
      case 'all_mornings_weekdays':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
        });
        break;
      case 'all_evenings_weekdays':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
        });
        break;
      case 'all_nights_weekdays':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'all_mornings_weekend':
        ['Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
        });
        break;
      case 'all_evenings_weekend':
        ['Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
        });
        break;
      case 'all_nights_weekend':
        ['Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'all_mornings_7days':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
        });
        break;
      case 'all_evenings_7days':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
        });
        break;
      case 'all_nights_7days':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'full_week':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'weekdays_only':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'clear_all':
        Object.keys(newPerDayShiftTimes).forEach(key => {
          newPerDayShiftTimes[key] = 0;
        });
        break;
    }
    setModalForm(prev => ({
      ...prev,
      per_day_shift_times: newPerDayShiftTimes,
    }));
  };

  // Calculate frequency as the sum of all per-day/shift values (number of times)
  const calculatedFrequency = Object.values(modalForm.per_day_shift_times || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const calculatedMinutes = Number(modalForm.minutes) || 0;
  const totalTime = calculatedMinutes * calculatedFrequency;

  const handleModalSave = async () => {
    setModalLoading(true);
    setModalError('');
    try {
      // Sanitize per_day_shift_times: convert empty strings to 0
      const sanitizedPerDayShiftTimes = {};
      Object.entries(modalForm.per_day_shift_times || {}).forEach(([k, v]) => {
        sanitizedPerDayShiftTimes[k] = v === '' || v === undefined || v === null ? 0 : Number(v);
      });
      const payload = {
        minutes: Number(modalForm.minutes),
        frequency: calculatedFrequency,
        per_day_shift_times: sanitizedPerDayShiftTimes,
      };
      if (modalAdlId) {
        await axios.patch(`${API_BASE_URL}/api/adls/${modalAdlId}/`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/adls/`, {
          resident: resident.id,
          adl_question: modalQuestion.id,
          question_text: modalQuestion.text,
          ...payload,
        });
      }
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      setModalError(
        err.response?.data
          ? JSON.stringify(err.response.data)
          : 'Failed to save ADL response.'
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    setStatusSaving(true);
    try {
      await axios.patch(`${API_BASE_URL}/api/residents/${resident.id}/`, { status: newStatus });
      setResident({ ...resident, status: newStatus });
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) return <Box sx={{ p: 3 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!resident) return <Typography>No resident found.</Typography>;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ p: 3 }}>
        <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>
        <Typography variant="h4" gutterBottom>Resident Details: {resident.name}</Typography>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">Status:</Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={resident.status}
                onChange={handleStatusChange}
                disabled={statusSaving}
              >
                <MenuItem value="New">New</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Typography>Facility Section: {resident.facility_section}</Typography>
          <Typography>Facility: {resident.facility_name} (ID: {resident.facility_id})</Typography>
        </Paper>

        {/* Caregiving Summary Chart */}
        <CaregivingSummaryChart 
          title={`Caregiving Time Summary - ${resident?.first_name} ${resident?.last_name}`}
          endpoint={`${API_BASE_URL}/api/residents/${resident.id}/caregiving_summary/`}
        />

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>ADL Questions</Typography>
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
        </Paper>
      </Box>
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
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
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle1">Frequency: <b>{calculatedFrequency}</b></Typography>
            <Typography variant="subtitle1">Total Time: <b>{totalTime}</b> minutes</Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>How many times is this activity performed for each day/shift below?</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>Each cell = number of times this activity is performed during that shift. Total time = number of times × minutes per event.</Typography>
            
            {/* Bulk Fill Templates */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>Quick Fill Templates:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('all_mornings_weekdays')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  All Mornings (Weekdays)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('all_evenings_weekdays')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  All Evenings (Weekdays)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('all_nights_weekdays')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  All Nights (Weekdays)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('all_mornings_weekend')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  All Mornings (Weekend)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('all_evenings_weekend')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  All Evenings (Weekend)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('all_nights_weekend')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  All Nights (Weekend)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('all_mornings_7days')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  All Mornings (7 Days)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('all_evenings_7days')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  All Evenings (7 Days)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('all_nights_7days')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  All Nights (7 Days)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('weekdays_only')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Weekdays Only
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => applyBulkTemplate('full_week')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Full Week
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  color="error"
                  onClick={() => applyBulkTemplate('clear_all')}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Clear All
                </Button>
              </Box>
            </Box>
            
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell></TableCell>
                    {shifts.map((shift) => (
                      <TableCell key={shift.key}>{shift.label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {days.map((day, dayIdx) => (
                    <TableRow key={day}>
                      <TableCell>{day}</TableCell>
                      {shifts.map((shift) => {
                        const prefix = dayPrefixes[dayIdx];
                        const field = `${prefix}${shift.key}Time`;
                        return (
                          <TableCell key={shift.key}>
                            <TextField
                              type="number"
                              size="small"
                              value={modalForm.per_day_shift_times[field] || ''}
                              onChange={e => handlePerDayShiftChange(dayIdx, shift.key, e.target.value)}
                              inputProps={{ min: 0 }}
                              sx={{ width: 70 }}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          {modalError && <Alert severity="error" sx={{ mt: 2 }}>{modalError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleModalSave} disabled={modalLoading}>
            {modalLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ResidentDetails; 