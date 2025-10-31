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
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assessment as AssessmentIcon,
  ViewList as ViewListIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import CaregivingSummaryChart from './CaregivingSummaryChart';
import { useWeek } from '../../contexts/WeekContext';

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
  const { selectedWeek, getWeekLabel } = useWeek();
  const [resident, setResident] = useState(null);
  const [adls, setAdls] = useState([]); // All ADL responses for this resident
  const [questions, setQuestions] = useState([]); // Master list
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuestion, setModalQuestion] = useState(null);
  const [weeklyEntries, setWeeklyEntries] = useState([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState('');
  const [weeklySuccess, setWeeklySuccess] = useState('');
  const [modalForm, setModalForm] = useState({ minutes: '', frequency: '', per_day_shift_times: {} });
  const [modalAdlId, setModalAdlId] = useState(null);
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, [residentId]);

  // Refetch weekly entries when selectedWeek changes
  useEffect(() => {
    if (selectedWeek && resident) {
      fetchWeeklyEntries();
    }
  }, [selectedWeek, resident]);

  // Helper function to ensure we always use Monday dates
  const normalizeToMonday = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(date);
    monday.setDate(date.getDate() - daysToMonday);
    return monday.toISOString().split('T')[0];
  };

  // Helper function to get week end date (Sunday)
  const getWeekEndDate = (mondayDate) => {
    if (!mondayDate) return '';
    const date = new Date(mondayDate);
    date.setDate(date.getDate() + 6);
    return date.toISOString().split('T')[0];
  };

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

  // Weekly ADL functions
  const fetchWeeklyEntries = async () => {
    if (!residentId || !selectedWeek) return;
    
    setWeeklyLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/weekly-adls/?resident=${residentId}&page_size=1000`
      );
      
      // Handle paginated response
      const allEntries = response.data.results || response.data;
      console.log('🔍 All weekly entries:', allEntries.length);
      
      const weekEntries = allEntries.filter(entry => 
        entry.week_start_date === selectedWeek
      );
      console.log('🔍 Filtered entries for week:', weekEntries.length, 'week:', selectedWeek);
      
      setWeeklyEntries(weekEntries);
    } catch (err) {
      setWeeklyError('Failed to fetch weekly entries');
    } finally {
      setWeeklyLoading(false);
    }
  };

  const handleWeeklyEntrySave = async (questionId, entryData) => {
    if (!residentId || !selectedWeek) return;

    try {
      const weekEnd = new Date(selectedWeek);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const payload = {
        resident: residentId,
        adl_question: questionId,
        question_text: questions.find(q => q.id === questionId)?.text || '',
        week_start_date: selectedWeek,
        week_end_date: weekEnd.toISOString().split('T')[0],
        minutes_per_occurrence: entryData.minutes_per_occurrence || 0,
        frequency_per_week: entryData.frequency_per_week || 0,
        total_minutes_week: (entryData.minutes_per_occurrence || 0) * (entryData.frequency_per_week || 0),
        status: entryData.status || 'Complete',
        notes: entryData.notes || ''
      };

      // Check if entry already exists for this week and question
      const existingEntry = weeklyEntries.find(entry => 
        entry.adl_question === questionId && entry.week_start_date === selectedWeek
      );

      if (existingEntry) {
        await axios.patch(`${API_BASE_URL}/api/weekly-adls/${existingEntry.id}/`, payload);
        setWeeklySuccess('Weekly ADL entry updated successfully!');
      } else {
        await axios.post(`${API_BASE_URL}/api/weekly-adls/`, payload);
        setWeeklySuccess('Weekly ADL entry created successfully!');
      }

      fetchWeeklyEntries();
      // Trigger chart refresh
      setChartRefreshKey(prev => prev + 1);
    } catch (err) {
      setWeeklyError('Failed to save weekly ADL entry');
    }
  };

  // Use getWeekLabel from WeekContext instead of local definition
  // const getWeekLabel = (dateStr) => { ... } // REMOVED - using WeekContext version

  useEffect(() => {
    if (selectedWeek && residentId) {
      fetchWeeklyEntries();
    }
  }, [selectedWeek, residentId]);

  // Map: adl_question.id -> ADL response (legacy)
  const adlMap = {};
  adls.forEach(adl => {
    if (adl.adl_question) adlMap[adl.adl_question] = adl;
  });

  // Map: adl_question.id -> WeeklyADLEntry response (current)
  const weeklyEntryMap = {};
  weeklyEntries.forEach(entry => {
    if (entry.adl_question) weeklyEntryMap[entry.adl_question] = entry;
  });
  
  console.log('🔍 Weekly entries loaded:', weeklyEntries.length);
  console.log('🔍 Weekly entry map:', Object.keys(weeklyEntryMap));

  const handleOpenModal = (question) => {
    // Use WeeklyADLEntry data if available, fallback to legacy ADL data
    const weeklyEntry = weeklyEntryMap[question.id];
    const adl = adlMap[question.id];
    
    console.log('🔍 Opening modal for question:', question.id);
    console.log('🔍 Question text:', question.text);
    console.log('🔍 WeeklyEntry found:', !!weeklyEntry);
    console.log('🔍 WeeklyEntry data:', weeklyEntry);
    console.log('🔍 ADL fallback found:', !!adl);
    
    setModalQuestion(question);
    setModalAdlId(weeklyEntry ? weeklyEntry.id : (adl ? adl.id : null));
    
    if (weeklyEntry) {
      console.log('🔍 Converting WeeklyADLEntry data to modal format');
      console.log('🔍 WeeklyEntry per_day_data:', weeklyEntry.per_day_data);
      
      // Convert WeeklyADLEntry per_day_data to per_day_shift_times format
      const per_day_shift_times = {};
      
      if (weeklyEntry.per_day_data) {
        // Check if it's in old format (MonShift1Time, MonShift2Time, etc.)
        const oldFormatKeys = Object.keys(weeklyEntry.per_day_data);
        const isOldFormat = oldFormatKeys.some(key => key.includes('Shift') && key.includes('Time'));
        
        if (isOldFormat) {
          console.log('🔍 Detected old format, using data directly');
          // Old format: {'MonShift1Time': 1, 'MonShift2Time': 0, ...}
          Object.assign(per_day_shift_times, weeklyEntry.per_day_data);
        } else {
          console.log('🔍 Detected new format, converting to old format');
          // New format: {'Monday': {'Day': 1}, 'Tuesday': {'Swing': 1}, ...}
          const shiftMapping = { 'Day': 'Shift1', 'Swing': 'Shift2', 'NOC': 'Shift3' };
          const dayMapping = {
            'Monday': 'Mon', 'Tuesday': 'Tues', 'Wednesday': 'Wed', 'Thursday': 'Thurs',
            'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun'
          };
          
          Object.entries(weeklyEntry.per_day_data).forEach(([day, shifts]) => {
            const dayPrefix = dayMapping[day];
            if (dayPrefix) {
              Object.entries(shifts || {}).forEach(([shiftName, frequency]) => {
                const shiftKey = shiftMapping[shiftName];
                if (shiftKey) {
                  per_day_shift_times[`${dayPrefix}${shiftKey}Time`] = frequency;
                }
              });
            }
          });
        }
      }
      
      console.log('🔍 Converted per_day_shift_times:', per_day_shift_times);
      console.log('🔍 Modal form values:', {
        minutes: weeklyEntry.minutes_per_occurrence || '',
        frequency: weeklyEntry.frequency_per_week || '',
        per_day_shift_times: per_day_shift_times,
      });
      
      setModalForm({
        minutes: weeklyEntry.minutes_per_occurrence || '',
        frequency: weeklyEntry.frequency_per_week || '',
        per_day_shift_times: per_day_shift_times,
      });
    } else {
      // Fallback to legacy ADL data
      setModalForm({
        minutes: adl ? adl.minutes : '',
        frequency: adl ? adl.frequency : '',
        per_day_shift_times: adl ? { ...adl.per_day_shift_times } : {},
      });
    }
    
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
      
      // Calculate frequency from per_day_shift_times
      const calculatedFrequency = Object.values(sanitizedPerDayShiftTimes).reduce((sum, val) => sum + val, 0);
      
      const weekEnd = new Date(selectedWeek);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const payload = {
        resident: resident.id,
        adl_question: modalQuestion.id,
        question_text: modalQuestion.text,
        week_start_date: selectedWeek,
        week_end_date: weekEnd.toISOString().split('T')[0],
        minutes_per_occurrence: Number(modalForm.minutes),
        frequency_per_week: calculatedFrequency,
        total_minutes_week: Number(modalForm.minutes) * calculatedFrequency,
        per_day_data: sanitizedPerDayShiftTimes,
        status: 'complete',
        notes: ''
      };
      
      if (modalAdlId) {
        await axios.patch(`${API_BASE_URL}/api/weekly-adls/${modalAdlId}/`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/weekly-adls/`, payload);
      }
      
      setModalOpen(false);
      fetchWeeklyEntries(); // Refresh weekly entries
    } catch (err) {
      setModalError(
        err.response?.data
          ? JSON.stringify(err.response.data)
          : 'Failed to save weekly ADL entry.'
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

        {/* Current Week Info */}
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" color="info.main">
              📅 Current Week: {getWeekLabel(selectedWeek)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All data below represents caregiving activities for this specific week (Monday to Sunday)
            </Typography>
          </Box>
        </Paper>

        {/* Caregiving Summary Chart */}
        <CaregivingSummaryChart 
          key={`chart-${resident?.id}-${selectedWeek}-${chartRefreshKey}`}
          title={resident ? `Weekly Caregiving Hours - ${resident.name} - ${getWeekLabel(selectedWeek)}` : 'Weekly Caregiving Hours - Loading...'}
          endpoint={resident ? `${API_BASE_URL}/api/residents/${resident.id}/caregiving_summary/` : null}
          queryParams={selectedWeek ? { week_start_date: selectedWeek } : {}}
        />

        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h6">
                Weekly ADL Data Entry
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedWeek === '2025-09-21' ? 
                  'View and edit caregiving data for the current week (September 21-27, 2025)' :
                  'Enter caregiving data for the selected week (Monday to Sunday)'}
              </Typography>
            </Box>
          </Box>

          {weeklyError && <Alert severity="error" onClose={() => setWeeklyError('')} sx={{ mb: 2 }}>{weeklyError}</Alert>}
          {weeklySuccess && <Alert severity="success" onClose={() => setWeeklySuccess('')} sx={{ mb: 2 }}>{weeklySuccess}</Alert>}

          {/* Weekly Summary */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
            <Typography variant="h6" gutterBottom>
              Week Summary: {getWeekLabel(selectedWeek)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Data represents caregiving activities for this specific week (Monday to Sunday)
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {weeklyEntries.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Questions Completed
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {questions.length > 0 ? Math.round((weeklyEntries.length / questions.length) * 100) : 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completion Rate
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {weeklyEntries.reduce((sum, entry) => sum + (entry.total_hours_week || 0), 0).toFixed(1)}h
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Caregiving Hours
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Question</TableCell>
                  <TableCell>Minutes/Occurrence</TableCell>
                  <TableCell>Frequency/Week</TableCell>
                  <TableCell>Total Hours</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {questions.map((q, idx) => {
                  // Always show weekly ADL data for consistency with chart
                  const weeklyEntry = weeklyEntries.find(entry => 
                    entry.adl_question === q.id && entry.week_start_date === selectedWeek
                  );
                  
                  return (
                    <TableRow key={q.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{q.text}</TableCell>
                      <TableCell>
                        {weeklyEntry ? (
                          <TextField
                            size="small"
                            type="number"
                            value={weeklyEntry.minutes_per_occurrence || 0}
                            onChange={async (e) => {
                              const newMinutes = parseInt(e.target.value) || 0;
                              const newTotal = newMinutes * (weeklyEntry.frequency_per_week || 0);
                              const updatedEntry = { 
                                ...weeklyEntry, 
                                minutes_per_occurrence: newMinutes, 
                                total_minutes_week: newTotal, 
                                total_hours_week: newTotal / 60 
                              };
                              setWeeklyEntries(prev => prev.map(entry => 
                                entry.id === weeklyEntry.id ? updatedEntry : entry
                              ));
                              
                              // Auto-save to backend
                              try {
                                await axios.patch(`${API_BASE_URL}/api/weekly-adls/${weeklyEntry.id}/`, {
                                  minutes_per_occurrence: newMinutes,
                                  total_minutes_week: newTotal,
                                  total_hours_week: newTotal / 60,
                                  per_day_data: weeklyEntry.per_day_data || {}
                                });
                              } catch (err) {
                                console.error('Failed to auto-save:', err);
                              }
                            }}
                            inputProps={{ min: 0 }}
                            sx={{ width: 80 }}
                          />
                        ) : (
                          <TextField
                            size="small"
                            type="number"
                            value={0}
                            disabled
                            inputProps={{ min: 0 }}
                            sx={{ width: 80 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {weeklyEntry ? (
                          <TextField
                            size="small"
                            type="number"
                            value={weeklyEntry.frequency_per_week || 0}
                            onChange={async (e) => {
                              const newFreq = parseInt(e.target.value) || 0;
                              const newTotal = (weeklyEntry.minutes_per_occurrence || 0) * newFreq;
                              const updatedEntry = { 
                                ...weeklyEntry, 
                                frequency_per_week: newFreq, 
                                total_minutes_week: newTotal, 
                                total_hours_week: newTotal / 60 
                              };
                              setWeeklyEntries(prev => prev.map(entry => 
                                entry.id === weeklyEntry.id ? updatedEntry : entry
                              ));
                              
                              // Auto-save to backend
                              try {
                                await axios.patch(`${API_BASE_URL}/api/weekly-adls/${weeklyEntry.id}/`, {
                                  frequency_per_week: newFreq,
                                  total_minutes_week: newTotal,
                                  total_hours_week: newTotal / 60,
                                  per_day_data: weeklyEntry.per_day_data || {}
                                });
                              } catch (err) {
                                console.error('Failed to auto-save:', err);
                              }
                            }}
                            inputProps={{ min: 0 }}
                            sx={{ width: 80 }}
                          />
                        ) : (
                          <TextField
                            size="small"
                            type="number"
                            value={0}
                            disabled
                            inputProps={{ min: 0 }}
                            sx={{ width: 80 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {weeklyEntry ? (
                          <Typography variant="body2" color="primary">
                            {weeklyEntry.total_hours_week?.toFixed(1) || 0}h
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            0.0h
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {weeklyEntry ? (
                          <Select
                            size="small"
                            value={weeklyEntry.status || 'Complete'}
                            onChange={(e) => {
                              setWeeklyEntries(prev => prev.map(entry => 
                                entry.id === weeklyEntry.id ? { ...entry, status: e.target.value } : entry
                              ));
                            }}
                            sx={{ minWidth: 100 }}
                          >
                            <MenuItem value="Complete">Complete</MenuItem>
                            <MenuItem value="Incomplete">Incomplete</MenuItem>
                            <MenuItem value="Not Applicable">Not Applicable</MenuItem>
                          </Select>
                        ) : (
                          <Select
                            size="small"
                            value="Complete"
                            disabled
                            sx={{ minWidth: 100 }}
                          >
                            <MenuItem value="Complete">Complete</MenuItem>
                            <MenuItem value="Incomplete">Incomplete</MenuItem>
                            <MenuItem value="Not Applicable">Not Applicable</MenuItem>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {weeklyEntry ? (
                          <div>
                            <Button 
                              size="small" 
                              variant="outlined" 
                              onClick={() => handleOpenModal(q)}
                            >
                              Edit Details
                            </Button>
                            <Button 
                              size="small" 
                              variant="outlined" 
                              color="error"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this weekly ADL entry?')) {
                                  setWeeklyEntries(prev => prev.filter(entry => entry.id !== weeklyEntry.id));
                                  // Also delete from backend
                                  axios.delete(`${API_BASE_URL}/api/weekly-adls/${weeklyEntry.id}/`);
                                }
                              }}
                              sx={{ ml: 1 }}
                            >
                              Delete
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            size="small" 
                            variant="contained" 
                            onClick={() => {
                              setModalQuestion(q);
                              setModalForm({ 
                                minutes: '', 
                                frequency: '', 
                                per_day_shift_times: {} 
                              });
                              setModalAdlId(null);
                              setModalError('');
                              setModalOpen(true);
                            }}
                          >
                            Add Entry
                          </Button>
                        )}
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