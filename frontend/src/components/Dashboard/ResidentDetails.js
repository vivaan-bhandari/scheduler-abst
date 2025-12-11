import React, { useEffect, useState, Fragment } from 'react';
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
  Collapse,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assessment as AssessmentIcon,
  ViewList as ViewListIcon,
  DateRange as DateRangeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import CaregivingSummaryChart from './CaregivingSummaryChart';
import { useWeek } from '../../contexts/WeekContext';

const days = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];
const dayPrefixes = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'];

const ResidentDetails = () => {
  const { residentId } = useParams();
  const navigate = useNavigate();
  const { selectedWeek, getWeekLabel, setSelectedWeek } = useWeek();
  const [resident, setResident] = useState(null);
  const [facility, setFacility] = useState(null); // Store facility data for shift_format
  const [adls, setAdls] = useState([]); // All ADL responses for this resident
  const [questions, setQuestions] = useState([]); // Master list
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Get shifts based on facility format
  const getShifts = () => {
    if (facility?.shift_format === '2_shift') {
      return [
        { label: 'Day', key: 'Shift1' },
        { label: 'NOC', key: 'Shift3' },
      ];
    }
    return [
      { label: 'Day', key: 'Shift1' },
      { label: 'Swing', key: 'Shift2' },
      { label: 'NOC', key: 'Shift3' },
    ];
  };
  const shifts = getShifts();
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
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [expandedCategories, setExpandedCategories] = useState(new Set(['Personal Care', 'Mobility', 'Behavioral / Cognitive', 'Medical / Medication', 'Documentation & Communication']));

  const toggleRowExpansion = (questionId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const toggleCategoryExpansion = (category) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Categorize ADL questions based on keywords
  const categorizeQuestion = (questionText) => {
    const text = questionText.toLowerCase();
    
    // Personal Care
    if (text.includes('bathing') || text.includes('grooming') || text.includes('dressing') || 
        text.includes('bowel') || text.includes('bladder') || text.includes('toileting') ||
        text.includes('housekeeping') || text.includes('laundry')) {
      return 'Personal Care';
    }
    
    // Mobility
    if (text.includes('ambulation') || text.includes('repositioning') || text.includes('transfer') ||
        text.includes('mobility') || text.includes('walking') || text.includes('escorting')) {
      return 'Mobility';
    }
    
    // Behavioral / Cognitive
    if (text.includes('behavioral') || text.includes('cognitive') || text.includes('cueing') ||
        text.includes('redirecting') || text.includes('dementia') || text.includes('leisure') ||
        text.includes('non-drug interventions')) {
      return 'Behavioral / Cognitive';
    }
    
    // Medical / Medication
    if (text.includes('medication') || text.includes('treatment') || text.includes('wound') ||
        text.includes('skin care') || text.includes('pain management') || text.includes('antibiotic')) {
      return 'Medical / Medication';
    }
    
    // Documentation & Communication
    if (text.includes('monitoring') || text.includes('communication') || text.includes('vision') ||
        text.includes('speech') || text.includes('physical conditions') || text.includes('symptoms')) {
      return 'Documentation & Communication';
    }
    
    return 'Other';
  };

  const handleInlinePerDayShiftChange = async (weeklyEntryId, dayIdx, shiftKey, value) => {
    if (!weeklyEntryId) return;
    
    const prefix = dayPrefixes[dayIdx];
    const field = `${prefix}${shiftKey}Time`;
    const numValue = Number(value) || 0;
    
    // Find the entry
    const entry = weeklyEntries.find(e => e.id === weeklyEntryId);
    if (!entry) return;
    
    // Convert per_day_data to per_day_shift_times format
    let perDayShiftTimes = {};
    if (entry.per_day_data) {
      // Handle both old and new formats
      if (typeof entry.per_day_data === 'object' && !Array.isArray(entry.per_day_data)) {
        Object.entries(entry.per_day_data).forEach(([day, shifts]) => {
          if (typeof shifts === 'object') {
            Object.entries(shifts).forEach(([shiftKey, freq]) => {
              const dayPrefix = dayPrefixes[days.indexOf(day)];
              if (dayPrefix) {
                perDayShiftTimes[`${dayPrefix}${shiftKey}Time`] = Number(freq) || 0;
              }
            });
          } else {
            // Old format
            perDayShiftTimes[day] = Number(shifts) || 0;
          }
        });
      }
    }
    
    // Update the specific field
    perDayShiftTimes[field] = numValue;
    
    // Calculate new frequency
    const newFrequency = Object.values(perDayShiftTimes).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const newTotal = (entry.minutes_per_occurrence || 0) * newFrequency;
    
    // Convert back to per_day_data format
    const newPerDayData = {};
    days.forEach((day, idx) => {
      const dayPrefix = dayPrefixes[idx];
      newPerDayData[day] = {
        Day: Number(perDayShiftTimes[`${dayPrefix}Shift1Time`] || 0),
        Swing: Number(perDayShiftTimes[`${dayPrefix}Shift2Time`] || 0),
        NOC: Number(perDayShiftTimes[`${dayPrefix}Shift3Time`] || 0),
      };
    });
    
    // Update state
    const updatedEntry = {
      ...entry,
      frequency_per_week: newFrequency,
      total_minutes_week: newTotal,
      total_hours_week: newTotal / 60,
      per_day_data: newPerDayData
    };
    
    setWeeklyEntries(prev => prev.map(e => e.id === weeklyEntryId ? updatedEntry : e));
    
    // Auto-save to backend
    try {
      await axios.patch(`${API_BASE_URL}/api/weekly-adls/${weeklyEntryId}/`, {
        frequency_per_week: newFrequency,
        total_minutes_week: newTotal,
        total_hours_week: newTotal / 60,
        per_day_data: newPerDayData
      });
    } catch (err) {
      console.error('Failed to auto-save per-day data:', err);
    }
  };

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

  // Helper function to convert Monday date to Sunday (backend format)
  const mondayToSunday = (mondayDate) => {
    if (!mondayDate) return '';
    const date = new Date(mondayDate);
    // Go back one day to get Sunday
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
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
      
      // Fetch facility data to get shift_format
      if (res.data?.facility_section?.facility) {
        try {
          const facilityRes = await axios.get(`${API_BASE_URL}/api/facilities/${res.data.facility_section.facility}/`);
          setFacility(facilityRes.data);
        } catch (facilityErr) {
          console.error('Error fetching facility data:', facilityErr);
        }
      }
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
      // Convert Monday (frontend) to Sunday (backend format)
      const weekStartSunday = mondayToSunday(selectedWeek);
      console.log('🔍 Fetching weekly entries - selectedWeek (Monday):', selectedWeek, 'weekStartSunday (backend):', weekStartSunday);
      
      // Query backend with the Sunday date that matches backend's week_start_date format
      const response = await axios.get(
        `${API_BASE_URL}/api/weekly-adls/?resident=${residentId}&week_start_date=${weekStartSunday}&page_size=1000`
      );
      
      // Handle paginated response
      const allEntries = response.data.results || response.data;
      console.log('🔍 Fetched weekly entries for week (Sunday):', allEntries.length, 'week_start_date:', weekStartSunday);
      
      // Filter to ensure we only get entries for this specific week (in case backend returns multiple)
      const weekEntries = allEntries.filter(entry => 
        entry.week_start_date === weekStartSunday
      );
      console.log('🔍 Filtered entries for week:', weekEntries.length);
      
      setWeeklyEntries(weekEntries);
    } catch (err) {
      console.error('❌ Error fetching weekly entries:', err);
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
      // Convert Monday (selectedWeek) to Sunday (backend format) for comparison
      const weekStartSunday = mondayToSunday(selectedWeek);
      // Ensure both IDs are compared as numbers
      const existingEntry = weeklyEntries.find(entry => 
        Number(entry.adl_question) === Number(questionId) && entry.week_start_date === weekStartSunday
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
  // Use Number() to ensure consistent ID comparison (handles string vs number)
  const weeklyEntryMap = {};
  weeklyEntries.forEach(entry => {
    if (entry.adl_question) {
      const questionId = Number(entry.adl_question);
      weeklyEntryMap[questionId] = entry;
    }
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

  // Calculate summary stats
  const completedCount = weeklyEntries.length;
  const totalHours = weeklyEntries.reduce((sum, entry) => sum + (entry.total_hours_week || 0), 0);
  const statusCount = weeklyEntries.filter(e => e.status === 'Complete').length;
  
  // Group questions by category
  const questionsByCategory = {};
  questions.forEach(q => {
    const category = categorizeQuestion(q.text || q.question_text);
    if (!questionsByCategory[category]) {
      questionsByCategory[category] = [];
    }
    questionsByCategory[category].push(q);
  });

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ p: 3 }}>
        <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>
        
        {/* Sticky Header */}
        <Paper 
          sx={{ 
            p: 2, 
            mb: 2, 
            position: 'sticky',
            top: 0,
            zIndex: 100,
            bgcolor: 'background.paper',
            boxShadow: 2,
            borderBottom: '2px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {resident.name} — {getWeekLabel(selectedWeek)}
            </Typography>
            <Button 
              variant="outlined" 
              size="small"
              startIcon={<CalendarIcon />}
              onClick={() => {
                // Simple week navigation - go to previous/next week
                // For now, just show a prompt. Can be enhanced with a proper picker
                const currentDate = new Date(selectedWeek);
                const newDate = new Date(currentDate);
                newDate.setDate(newDate.getDate() + 7); // Next week
                setSelectedWeek(newDate.toISOString().split('T')[0]);
              }}
            >
              Change Week
            </Button>
          </Box>
          <Typography variant="body2" sx={{ color: '#6f6f6f', mb: 1.5 }}>
            Status: {statusCount === completedCount && completedCount > 0 ? 'Complete' : 'In Progress'} · {completedCount} ADL {completedCount === 1 ? 'entry' : 'entries'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, borderTop: '1px solid', borderColor: '#eeeeee', pt: 1.5 }}>
            <Typography variant="body2" sx={{ fontSize: 13, color: '#6f6f6f' }}>
              <strong style={{ color: '#000' }}>{completedCount}</strong> Questions Completed
            </Typography>
            <Typography variant="body2" sx={{ fontSize: 13, color: '#6f6f6f' }}>
              <strong style={{ color: '#000' }}>{totalHours.toFixed(1)}</strong> Total Caregiving Hours
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

          <Box sx={{ width: '100%' }}>
            <TableContainer sx={{ width: '100%' }}>
              <Table size="small" sx={{ width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 30, px: 0.5 }}></TableCell>
                  <TableCell sx={{ width: 30, px: 0.5 }}>#</TableCell>
                  <TableCell sx={{ width: '30%', px: 1 }}>Question</TableCell>
                  <TableCell sx={{ width: 90, px: 0.5 }}>Min/Occ</TableCell>
                  <TableCell sx={{ width: 80, px: 0.5 }}>Freq/Week</TableCell>
                  <TableCell sx={{ width: 70, px: 0.5 }}>Total Hrs</TableCell>
                  <TableCell sx={{ width: 100, px: 0.5 }}>Status</TableCell>
                  <TableCell sx={{ width: 100, px: 0.5 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(questionsByCategory).map(([category, categoryQuestions]) => {
                  const isCategoryExpanded = expandedCategories.has(category);
                  const categoryQuestionCount = categoryQuestions.length;
                  
                  return (
                    <Fragment key={category}>
                      {/* Category Header Row */}
                      <TableRow sx={{ bgcolor: '#f5f5f5', '&:hover': { bgcolor: '#eeeeee' } }}>
                        <TableCell colSpan={8} sx={{ py: 1, px: 1.5 }}>
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                            onClick={() => toggleCategoryExpansion(category)}
                          >
                            <IconButton size="small" sx={{ mr: 1 }}>
                              {isCategoryExpanded ? <ExpandLessIcon /> : <ChevronRightIcon />}
                            </IconButton>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13 }}>
                              {category} ({categoryQuestionCount} {categoryQuestionCount === 1 ? 'question' : 'questions'})
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                      
                      {/* Category Questions */}
                      <Collapse in={isCategoryExpanded} timeout="auto" unmountOnExit>
                        {categoryQuestions.map((q, categoryIdx) => {
                          const globalIdx = questions.findIndex(q2 => q2.id === q.id);
                          const isEven = categoryIdx % 2 === 0;
                  // Always show weekly ADL data for consistency with chart
                  // Convert Monday (selectedWeek) to Sunday (backend format) for comparison
                  const weekStartSunday = mondayToSunday(selectedWeek);
                  // Ensure both IDs are compared as numbers (in case one is string)
                  const weeklyEntry = weeklyEntries.find(entry => 
                    Number(entry.adl_question) === Number(q.id) && entry.week_start_date === weekStartSunday
                  );
                  
                  const isExpanded = expandedRows.has(q.id);
                  
                  // Convert per_day_data to per_day_shift_times for display
                  // Handle BOTH old format (MonShift1Time: 2) and new format (Monday: {Day: 2})
                  let perDayShiftTimes = {};
                  if (weeklyEntry?.per_day_data) {
                    const perDayData = weeklyEntry.per_day_data;
                    // Check if it's old format (has keys like MonShift1Time)
                    const hasOldFormat = Object.keys(perDayData).some(key => 
                      typeof key === 'string' && key.includes('Shift') && key.includes('Time')
                    );
                    
                    if (hasOldFormat) {
                      // Old format: already in MonShift1Time format, use directly
                      perDayShiftTimes = { ...perDayData };
                    } else {
                      // New format: convert from {Monday: {Day: 2, Swing: 0, NOC: 0}}
                      days.forEach((day, dayIdx) => {
                        const dayPrefix = dayPrefixes[dayIdx];
                        const dayData = perDayData[day];
                        if (dayData && typeof dayData === 'object') {
                          perDayShiftTimes[`${dayPrefix}Shift1Time`] = dayData.Day || 0;
                          perDayShiftTimes[`${dayPrefix}Shift2Time`] = dayData.Swing || 0;
                          perDayShiftTimes[`${dayPrefix}Shift3Time`] = dayData.NOC || 0;
                        }
                      });
                    }
                  }
                  
                          return (
                            <Fragment key={q.id}>
                              <TableRow sx={{ bgcolor: isEven ? '#ffffff' : '#fafafa' }}>
                        <TableCell>
                          {weeklyEntry && (
                            <IconButton
                              size="small"
                              onClick={() => toggleRowExpansion(q.id)}
                            >
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          )}
                        </TableCell>
                        <TableCell sx={{ px: 1 }}>{globalIdx + 1}</TableCell>
                                <TableCell sx={{ px: 1 }}>
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      fontSize: 11,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      lineHeight: 1.3
                                    }}
                                    title={q.text}
                                  >
                                    {q.text}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ px: 1 }}>
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
                                      sx={{ width: 70 }}
                                    />
                                  ) : (
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={0}
                                      disabled
                                      inputProps={{ min: 0 }}
                                      sx={{ width: 70 }}
                                    />
                                  )}
                                </TableCell>
                                <TableCell sx={{ px: 1 }}>
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
                                      sx={{ width: 60 }}
                                    />
                                  ) : (
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={0}
                                      disabled
                                      inputProps={{ min: 0 }}
                                      sx={{ width: 60 }}
                                    />
                                  )}
                                </TableCell>
                                <TableCell sx={{ px: 0.5 }}>
                                  {weeklyEntry ? (
                                    <Typography variant="body2" color="primary" sx={{ fontSize: 11 }}>
                                      {weeklyEntry.total_hours_week?.toFixed(1) || 0}h
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11 }}>
                                      0.0h
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell sx={{ px: 0.5 }}>
                                  {weeklyEntry ? (
                                    <Select
                                      size="small"
                                      value={weeklyEntry.status || 'Complete'}
                                      onChange={(e) => {
                                        setWeeklyEntries(prev => prev.map(entry => 
                                          entry.id === weeklyEntry.id ? { ...entry, status: e.target.value } : entry
                                        ));
                                      }}
                                      sx={{ width: 95, fontSize: 11 }}
                                    >
                                      <MenuItem value="Complete" sx={{ fontSize: 11 }}>Complete</MenuItem>
                                      <MenuItem value="Incomplete" sx={{ fontSize: 11 }}>Incomplete</MenuItem>
                                      <MenuItem value="Not Applicable" sx={{ fontSize: 11 }}>N/A</MenuItem>
                                    </Select>
                                  ) : (
                                    <Select
                                      size="small"
                                      value="Complete"
                                      disabled
                                      sx={{ width: 95, fontSize: 11 }}
                                    >
                                      <MenuItem value="Complete" sx={{ fontSize: 11 }}>Complete</MenuItem>
                                      <MenuItem value="Incomplete" sx={{ fontSize: 11 }}>Incomplete</MenuItem>
                                      <MenuItem value="Not Applicable" sx={{ fontSize: 11 }}>N/A</MenuItem>
                                    </Select>
                                  )}
                                </TableCell>
                                <TableCell sx={{ px: 0.5 }}>
                                  {weeklyEntry ? (
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap' }}>
                                      <Button 
                                        size="small" 
                                        variant="text" 
                                        onClick={() => handleOpenModal(q)}
                                        sx={{ 
                                          fontSize: 13, 
                                          py: 0.2, 
                                          px: 0.6, 
                                          minWidth: 'auto',
                                          color: '#2563eb',
                                          fontWeight: 500,
                                          textTransform: 'none',
                                          '&:hover': {
                                            bgcolor: 'transparent',
                                            color: '#1e40af'
                                          }
                                        }}
                                      >
                                        Edit
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
                                        sx={{ fontSize: 10, py: 0.25, px: 0.75, minWidth: 'auto' }}
                                      >
                                        Del
                                      </Button>
                                    </Box>
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
                                      sx={{ fontSize: 10, py: 0.25, px: 1, minWidth: 'auto' }}
                                    >
                                      Add Ent
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                              {isExpanded && weeklyEntry && (
                                <TableRow sx={{ bgcolor: isEven ? '#ffffff' : '#fafafa' }}>
                                  <TableCell colSpan={8} sx={{ py: 2, bgcolor: 'grey.50' }}>
                                    <Box>
                                      <Typography variant="subtitle2" sx={{ mb: 2 }}>
                                        Day-wise Frequency Entry (times per shift)
                                      </Typography>
                                      <TableContainer>
                                        <Table size="small">
                                          <TableHead>
                                            <TableRow>
                                              <TableCell>Day</TableCell>
                                              {shifts.map((shift) => (
                                                <TableCell key={shift.key} align="center">{shift.label}</TableCell>
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
                                                    <TableCell key={shift.key} align="center">
                                                      <TextField
                                                        type="number"
                                                        size="small"
                                                        value={perDayShiftTimes[field] || ''}
                                                        onChange={(e) => handleInlinePerDayShiftChange(weeklyEntry.id, dayIdx, shift.key, e.target.value)}
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
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </Collapse>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          </Box>
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