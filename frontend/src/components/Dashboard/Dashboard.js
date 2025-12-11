import React, { useState, useEffect } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Toolbar,
  Typography,
  AppBar,
  Collapse,
} from '@mui/material';
import {
  AdminPanelSettings,
  Assignment as AssignmentIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarTodayIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Logout as LogoutIcon,
  People as PeopleIcon,
  Phone as PhoneIcon,
  Schedule as ScheduleIcon,
  Sync as SyncIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  ArrowUpward as ArrowUpwardIcon,
  CheckCircle as CheckCircleIcon,
  ContentCopy as ContentCopyIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import FacilityAccessRequest from '../Auth/FacilityAccessRequest';
import AccessManagement from '../Auth/AccessManagement';
import CaregivingSummaryChart from './CaregivingSummaryChart';
import SchedulingDashboard from '../Scheduling/SchedulingDashboard';
import ADLAnalytics from './ADLAnalytics';
import PaycomDashboard from '../Paycom/PaycomDashboard';
import { API_BASE_URL } from '../../config';
import { useWeek } from '../../contexts/WeekContext';

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // 'adl' or 'scheduling' or null
  const [adlTab, setAdlTab] = useState(0); // For ADL mode: 0 = Residents, 1 = Analytics
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [adminMenuAnchor, setAdminMenuAnchor] = useState(null);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [hasFacilityAccess, setHasFacilityAccess] = useState(true);
  const [userAccess, setUserAccess] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedFacilityData, setSelectedFacilityData] = useState(null); // Store full facility object for shift_format
  const [facilities, setFacilities] = useState([]);
  const [sections, setSections] = useState([]);
  const [residents, setResidents] = useState([]);
  const [adlsByResident, setAdlsByResident] = useState({});
  const [selectedSection, setSelectedSection] = useState(null);
  const [expandedResident, setExpandedResident] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({}); // { residentId: Set of category names }
  const [loadingADLs, setLoadingADLs] = useState(false);
  const [adlQuestions, setAdlQuestions] = useState([]);
  const [chartRefreshKey, setChartRefreshKey] = useState(0); // Force chart refresh after ADL saves
  const [importingCSV, setImportingCSV] = useState(false);
  const fileInputRef = React.useRef(null);

  // Get ADL weight for a question based on its text
  const getADLWeight = (questionText) => {
    const text = questionText.toLowerCase();
    
    // Bathing: weight 2
    if (text.includes('bathing')) {
      return 2;
    }
    
    // Toileting: weight 2 (bowel and bladder management)
    if (text.includes('bowel') || text.includes('bladder') || text.includes('toileting')) {
      return 2;
    }
    
    // Transfers: weight 2
    if (text.includes('transfer')) {
      return 2;
    }
    
    // Wandering/Behaviors: weight 2
    if (text.includes('behavioral') || text.includes('cognitive') || text.includes('cueing') ||
        text.includes('redirecting') || text.includes('dementia') || text.includes('wandering') ||
        text.includes('non-drug interventions for behaviors')) {
      return 2;
    }
    
    // Dressing: weight 1
    if (text.includes('dressing')) {
      return 1;
    }
    
    // Grooming: weight 1
    if (text.includes('grooming') || (text.includes('hygiene') && !text.includes('bathing'))) {
      return 1;
    }
    
    // Night Checks: weight 1 (safety checks, fall prevention, monitoring)
    if (text.includes('night') || text.includes('safety checks') || text.includes('fall prevention') ||
        (text.includes('monitoring') && (text.includes('physical conditions') || text.includes('symptoms')))) {
      return 1;
    }
    
    // Default: no weight (0)
    return 0;
  };

  // Calculate weighted ADL score and total weekly time for a resident
  const calculateAcuityMetrics = (residentAdls, adlQuestions = []) => {
    let weightedScore = 0;
    let totalWeeklyHours = 0;
    
    // Create a map of question ID to question text for lookup
    const questionTextMap = {};
    adlQuestions.forEach(q => {
      questionTextMap[q.id] = q.text || q.question_text;
    });
    
    const debugEntries = [];
    const allEntries = [];
    const entriesWithoutWeights = [];
    
    residentAdls.forEach(adl => {
      // Check for data in both formats (legacy: frequency/minutes, new: frequency_per_week/minutes_per_occurrence)
      const frequency = adl.frequency_per_week || adl.frequency || 0;
      const minutes = adl.minutes_per_occurrence || adl.minutes || 0;
      const hasData = frequency > 0 || minutes > 0;
      
      if (hasData) {
        // Get question text from multiple possible sources
        let questionText = adl.question_text || '';
        let questionSource = 'question_text field';
        
        if (!questionText && adl.adl_question) {
          if (typeof adl.adl_question === 'object') {
            questionText = adl.adl_question.text || adl.adl_question.question_text || '';
            questionSource = 'adl_question object';
          } else if (typeof adl.adl_question === 'number') {
            // Look up question text from adlQuestions array
            questionText = questionTextMap[adl.adl_question] || '';
            questionSource = `lookup from adlQuestions (ID: ${adl.adl_question})`;
            if (!questionText) {
              questionSource += ' - NOT FOUND IN MAP';
            }
          }
        }
        
        const weight = getADLWeight(questionText);
        
        // Track ALL entries for debugging
        const entryInfo = {
          question: questionText || 'NO QUESTION TEXT',
          questionLength: questionText.length,
          weight,
          freq: frequency,
          min: minutes,
          hasQuestionText: !!questionText,
          adlQuestionId: typeof adl.adl_question === 'object' ? adl.adl_question?.id : adl.adl_question,
          questionSource,
          rawQuestionText: adl.question_text,
          rawAdlQuestion: adl.adl_question
        };
        
        allEntries.push(entryInfo);
        
        // Track entries without weights separately
        if (weight === 0 && questionText) {
          entriesWithoutWeights.push(entryInfo);
        }
        
        // Debug: track entries with weights
        if (weight > 0) {
          debugEntries.push({
            question: questionText.substring(0, 50),
            weight,
            freq: frequency,
            min: minutes
          });
        }
        
        // Add weight to score if this ADL has data
        if (weight > 0) {
          weightedScore += weight;
        }
        
        // Add to total weekly hours - use total_hours_week if available, otherwise calculate from frequency * minutes
        if (adl.total_hours_week) {
          totalWeeklyHours += adl.total_hours_week;
        } else if (frequency > 0 && minutes > 0) {
          // Calculate: (frequency per week * minutes per occurrence) / 60 = hours per week
          totalWeeklyHours += (frequency * minutes) / 60;
        }
      }
    });
    
    // Debug: log ALL entries to see what's missing weights
    // Only log if score is low (like Patty's case) to reduce console noise
    const shouldLog = weightedScore < 8 || allEntries.length < 10;
    if (shouldLog) {
      console.log('📊 ALL ADL Entries (with weights):', {
        totalScore: weightedScore,
        totalHours: totalWeeklyHours,
        totalEntries: allEntries.length,
        entriesWithWeights: debugEntries.length,
        entriesWithoutWeights: entriesWithoutWeights.length,
        adlQuestionsCount: adlQuestions.length,
        questionTextMapSize: Object.keys(questionTextMap).length,
        entriesWithoutWeights: entriesWithoutWeights,
        allEntries: allEntries,
        entriesWithWeights: debugEntries
      });
    }
    
    return { weightedScore, totalWeeklyHours };
  };

  // Determine acuity level based on weighted ADL score and total weekly time
  const getAcuityLevel = (residentAdls, adlCount, adlQuestions = []) => {
    // ADLs not entered: 0 entries - use orange to indicate warning, not disabled
    if (adlCount === 0) {
      return { label: 'ADLs Not Entered', color: 'warning', customColor: '#ff9800' };
    }
    
    // Calculate weighted score and total weekly time
    const { weightedScore, totalWeeklyHours } = calculateAcuityMetrics(residentAdls, adlQuestions);
    
    // Debug logging - always log to see calculations
    console.log('🔍 Acuity Calculation:', {
      weightedScore,
      totalWeeklyHours,
      adlCount,
      threshold: 'High: Score ≥ 8 OR Time ≥ 6h',
      isHigh: weightedScore >= 8 || totalWeeklyHours >= 6,
      isMedium: (weightedScore >= 5 && weightedScore < 8) || (weightedScore >= 3 && weightedScore < 5 && totalWeeklyHours >= 4 && totalWeeklyHours < 6),
      isLow: weightedScore >= 1 && weightedScore < 5 && totalWeeklyHours < 4,
      sampleEntries: residentAdls.slice(0, 5).map(adl => ({
        question: adl.question_text?.substring(0, 50) || 'NO QUESTION TEXT',
        weight: getADLWeight(adl.question_text || ''),
        freq: adl.frequency_per_week,
        min: adl.minutes_per_occurrence,
        hasData: (adl.frequency_per_week || 0) > 0 || (adl.minutes_per_occurrence || 0) > 0
      }))
    });
    
    // High Acuity: (Weighted ADL Score ≥ 8) OR (Total Weekly Time ≥ 6h)
    // Adjusted threshold based on real data analysis - most memory care residents score 5-7
    if (weightedScore >= 8 || totalWeeklyHours >= 6) {
      const result = { label: 'High-Acuity', color: 'error', customColor: '#ff6b6b' }; // Softer red
      console.log('✅ Returning High-Acuity:', { weightedScore, totalWeeklyHours, result });
      return result;
    }
    
    // Medium Acuity: (Weighted ADL Score 5-7) OR (Score 3-4 AND Total Weekly Time 4-6h)
    // Covers residents with moderate dependency needs
    if ((weightedScore >= 5 && weightedScore < 8) || (weightedScore >= 3 && weightedScore < 5 && totalWeeklyHours >= 4 && totalWeeklyHours < 6)) {
      const result = { label: 'Medium-Acuity', color: 'warning', customColor: '#ffd93d' }; // Softer yellow
      console.log('⚠️ Returning Medium-Acuity:', { weightedScore, totalWeeklyHours, result });
      return result;
    }
    
    // Low-Acuity Assisted Living: (Weighted ADL Score 1-4) AND (Total Weekly Time < 4h)
    // Covers residents with minimal to low dependency needs
    if (weightedScore >= 1 && weightedScore < 5 && totalWeeklyHours < 4) {
      return { label: 'Low-Acuity Assisted Living', color: 'info', customColor: '#6bcf7f' }; // Softer green
    }
    
    // Independent: weighted score 0 or very minimal care
    // This would be residents with minimal ADL needs
    return { label: 'Independent', color: 'info', customColor: '#6bcf7f' }; // Softer green
  };

  // Categorize ADL questions based on keywords
  const categorizeQuestion = (questionText) => {
    const text = questionText.toLowerCase();
    
    // Personal Care
    if (text.includes('bathing') || text.includes('grooming') || text.includes('dressing') || 
        text.includes('bowel') || text.includes('bladder') || text.includes('toileting') ||
        text.includes('housekeeping') || text.includes('laundry') || text.includes('hygiene')) {
      return 'Personal Care';
    }
    
    // Mobility
    if (text.includes('ambulation') || text.includes('repositioning') || text.includes('transfer') ||
        text.includes('mobility') || text.includes('walking') || text.includes('escorting') ||
        text.includes('eating') || text.includes('supervising')) {
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
        text.includes('speech') || text.includes('physical conditions') || text.includes('symptoms') ||
        text.includes('call lights') || text.includes('safety checks')) {
      return 'Documentation & Communication';
    }
    
    return 'Other';
  };

  const toggleCategoryExpansion = (residentId, category) => {
    setExpandedCategories(prev => {
      const newState = { ...prev };
      if (!newState[residentId]) {
        newState[residentId] = new Set(['Personal Care', 'Mobility', 'Behavioral / Cognitive', 'Medical / Medication', 'Documentation & Communication']);
      }
      const categorySet = new Set(newState[residentId]);
      if (categorySet.has(category)) {
        categorySet.delete(category);
      } else {
        categorySet.add(category);
      }
      return { ...newState, [residentId]: categorySet };
    });
  };
  const [addingADLForQuestion, setAddingADLForQuestion] = useState(null); // Track which question/resident is being added/edited {residentId, questionId, entryId}
  const [adlEntryForm, setAdlEntryForm] = useState({ 
    minutes: '', 
    per_day_shift_times: {} 
  });
  const [adlEntryError, setAdlEntryError] = useState('');
  const [savingADLEntry, setSavingADLEntry] = useState(false);
  const [editingADLEntryId, setEditingADLEntryId] = useState(null); // Track if we're editing an existing entry
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({ name: '' });
  const [sectionError, setSectionError] = useState('');
  const [residentDialogOpen, setResidentDialogOpen] = useState(false);
  const [residentForm, setResidentForm] = useState({ name: '', status: 'Active' });
  const [residentError, setResidentError] = useState('');
  
  // Global week selection state
  const { selectedWeek, setSelectedWeek } = useWeek();
  const [selectedFacilityName, setSelectedFacilityName] = useState('');
  
  // Wizard state for guided flow
  const [wizardStep, setWizardStep] = useState(0); // 0: Facility, 1: Task, 2: Week
  const [wizardCompleted, setWizardCompleted] = useState(false);
  
  // Week picker state
  const [weekPickerAnchor, setWeekPickerAnchor] = useState(null);
  
  // Helper function to parse YYYY-MM-DD date string reliably (avoiding timezone issues)
  const parseDateString = (dateString) => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    // month is 0-indexed in Date constructor
    return new Date(year, month - 1, day);
  };
  
  const [weekPickerMonth, setWeekPickerMonth] = useState(() => {
    // Initialize to selected week's month, or current month if no week selected
    if (selectedWeek) {
      return parseDateString(selectedWeek);
    }
    return new Date();
  });
  
  // Keep weekPickerMonth in sync with selectedWeek
  useEffect(() => {
    if (selectedWeek) {
      const selectedDate = parseDateString(selectedWeek);
      setWeekPickerMonth(selectedDate);
    }
  }, [selectedWeek]);

  // Use the getWeekLabel from WeekContext instead of defining our own
  const { getWeekLabel } = useWeek();

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

  // Helper function to get current week's Monday in LA timezone
  const getCurrentWeekMonday = () => {
    // Get current time
    const now = new Date();
    
    // Get LA time components using Intl.DateTimeFormat
    const laFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long'
    });
    
    // Format to get LA date string
    const laDateParts = laFormatter.formatToParts(now);
    const laYear = parseInt(laDateParts.find(part => part.type === 'year').value);
    const laMonth = parseInt(laDateParts.find(part => part.type === 'month').value);
    const laDay = parseInt(laDateParts.find(part => part.type === 'day').value);
    const weekdayName = laDateParts.find(part => part.type === 'weekday').value.toLowerCase();
    
    // Map weekday name to number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const weekdayMap = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    const dayOfWeek = weekdayMap[weekdayName] || 1;
    
    // Calculate days to Monday (if Sunday, go back 6 days; otherwise go back dayOfWeek - 1 days)
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Create Monday date (using UTC date constructor to avoid timezone issues)
    const mondayUTC = new Date(Date.UTC(laYear, laMonth - 1, laDay - daysToMonday));
    
    // Format as YYYY-MM-DD
    const year = mondayUTC.getUTCFullYear();
    const month = String(mondayUTC.getUTCMonth() + 1).padStart(2, '0');
    const day = String(mondayUTC.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    fetchUserAccess();
    fetchFacilities();
    // Check if user has facility access
    const checkAccess = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/facility-access/my_access/`);
        setHasFacilityAccess(res.data && res.data.length > 0);
      } catch (err) {
        setHasFacilityAccess(false);
      }
    };
    checkAccess();
  }, [user]);

  const fetchFacilities = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/facilities/`);
      const facilitiesData = response.data.results || response.data || [];
      setFacilities(facilitiesData);
      
      // Auto-select first facility if none selected
      if (facilitiesData.length > 0 && !selectedFacility) {
        const firstFacility = facilitiesData[0];
        setSelectedFacility(firstFacility.id);
        setSelectedFacilityName(firstFacility.name);
        setSelectedFacilityData(firstFacility);
      }
    } catch (err) {
      console.error('Error fetching facilities:', err);
    }
  };



  const fetchUserAccess = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/facility-access/my_access/`);
      setUserAccess(res.data);
    } catch (err) {
      console.error('Error fetching user access:', err);
    }
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
      onLogout();
  };

  const isAdmin = user?.role === 'admin' || user?.is_staff || user?.is_superuser || user?.role === 'superadmin';

  const handleModeChange = (newMode) => {
    setMode(newMode);
    // Auto-advance to Step 3 when a task is selected
    if (!wizardCompleted && wizardStep === 1) {
      setWizardStep(2);
    }
  };
  
  // Wizard navigation handlers
  const handleWizardNext = () => {
    if (wizardStep === 0) {
      // Step 1: Facility selected, move to task selection
      if (selectedFacility) {
        setWizardStep(1);
      }
    } else if (wizardStep === 1) {
      // Step 2: Task selected, move to week selection
      if (mode) {
        setWizardStep(2);
      }
    } else if (wizardStep === 2) {
      // Step 3: Week selected, complete wizard
      if (selectedWeek) {
        setWizardCompleted(true);
        setWizardStep(0); // Reset step for next time
      }
    }
  };
  
  const handleWizardBack = () => {
    if (wizardStep > 0) {
      // Clear task selection when going back to Step 1
      if (wizardStep === 1) {
        setMode(null);
      }
      // Also clear task selection when going back from Step 3 to Step 2 (so user can reselect)
      if (wizardStep === 2) {
        setMode(null);
      }
      setWizardStep(wizardStep - 1);
    }
  };
  
  const handleWizardContinue = () => {
    if (selectedWeek) {
      setWizardCompleted(true);
      setWizardStep(0); // Reset step for next time
    }
  };
  

  const handleFacilityChange = async (facilityId, facilityName) => {
    const normalizedId = facilityId || null;
    const resolvedName = facilityName
      || (normalizedId ? facilities.find((f) => f.id === normalizedId)?.name : '');

    console.log('🔄 Dashboard: Facility changed to', normalizedId, resolvedName);
    setSelectedFacility(normalizedId);
    setSelectedFacilityName(resolvedName || '');
    setSelectedSection(null);
    
    // Fetch sections and residents for the selected facility
    if (normalizedId) {
      try {
        // Fetch sections - try facility endpoint first (includes prefetched sections)
        try {
          const facilityRes = await axios.get(`${API_BASE_URL}/api/facilities/${normalizedId}/`);
          // Store full facility data for shift_format
          setSelectedFacilityData(facilityRes.data);
          if (facilityRes.data.sections && Array.isArray(facilityRes.data.sections)) {
            setSections(facilityRes.data.sections);
            console.log('✅ Fetched sections from facility endpoint:', facilityRes.data.sections.length);
          } else {
            // Fallback: Use facilitysections endpoint with facility filter
              const sectionsRes = await axios.get(`${API_BASE_URL}/api/facilitysections/?facility=${normalizedId}`);
              const sectionsData = sectionsRes.data.results || sectionsRes.data || [];
              setSections(sectionsData);
              console.log('✅ Fetched sections from facilitysections endpoint:', sectionsData.length);
          }
        } catch (sectionsErr) {
          console.error('❌ Error fetching sections:', sectionsErr);
          console.error('Error response:', sectionsErr.response?.data);
          setSections([]);
          // Don't set error here - just show empty sections list with "Add Section" button
        }
        
        // Fetch residents
        try {
          const residentsRes = await axios.get(`${API_BASE_URL}/api/residents/?facility_id=${normalizedId}&page_size=1000`);
          const residentsData = residentsRes.data.results || residentsRes.data || [];
          setResidents(residentsData);
        } catch (residentsErr) {
          console.error('Error fetching residents:', residentsErr);
          setResidents([]);
        }
        
        // Fetch ADLs will be done in useEffect when week/facility changes
      } catch (err) {
        console.error('Error fetching facility data:', err);
        setSections([]);
        setResidents([]);
      }
    } else {
      setSections([]);
      setResidents([]);
    }
    
    // Don't automatically navigate - let user stay on current page
    // User can navigate to facility page manually if needed
  };

  // Helper function to clean section name by removing "Residents" suffix
  const getCleanSectionName = (sectionName) => {
    return sectionName ? sectionName.replace(/\s+Residents?$/i, '') : sectionName;
  };

  // Constants for ADL entry form
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayPrefixes = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'];
  
  // Get shifts based on facility format
  const getShifts = () => {
    if (selectedFacilityData?.shift_format === '2_shift') {
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

  // Calculate frequency from per_day_shift_times
  const calculateFrequency = (perDayShiftTimes) => {
    return Object.values(perDayShiftTimes || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  };

  // Bulk fill templates for ADL entry
  const applyBulkTemplate = (template) => {
    const newPerDayShiftTimes = { ...adlEntryForm.per_day_shift_times };
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
    setAdlEntryForm(prev => ({
      ...prev,
      per_day_shift_times: newPerDayShiftTimes,
    }));
  };

  // Fetch ADL questions
  useEffect(() => {
    const fetchADLQuestions = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/adls/questions/`);
        const questions = response.data.results || response.data || [];
        setAdlQuestions(questions);
        console.log('✅ Loaded ADL questions:', questions.length);
      } catch (err) {
        console.error('Error fetching ADL questions:', err);
        setAdlQuestions([]);
      }
    };
    
    if (mode === 'adl') {
      fetchADLQuestions();
    }
  }, [mode]);

  // Fetch ADL records for the facility (to show which residents have ADLs entered)
  useEffect(() => {
    const fetchADLs = async () => {
      if (!selectedFacility || mode !== 'adl') {
        return;
      }

      try {
        const normalizedId = typeof selectedFacility === 'object' ? selectedFacility.id : selectedFacility;
        const response = await axios.get(`${API_BASE_URL}/api/adls/by_facility/?facility_id=${normalizedId}&page_size=1000`);
        const allAdls = response.data.results || response.data || [];
        
        // Group ADLs by resident ID
        const grouped = {};
        allAdls.forEach(adl => {
          const residentId = typeof adl.resident === 'object' ? adl.resident.id : adl.resident;
          if (!grouped[residentId]) {
            grouped[residentId] = [];
          }
          grouped[residentId].push(adl);
        });
        
        // Merge with existing adlsByResident (from WeeklyADLEntry)
        setAdlsByResident(prev => {
          const merged = { ...prev };
          Object.keys(grouped).forEach(residentId => {
            if (!merged[residentId]) {
              merged[residentId] = [];
            }
            // Add ADL records, avoiding duplicates
            grouped[residentId].forEach(adl => {
              const exists = merged[residentId].some(existing => 
                existing.id === adl.id || 
                (existing.adl_question === adl.adl_question && existing.resident === adl.resident)
              );
              if (!exists) {
                merged[residentId].push(adl);
              }
            });
          });
          return merged;
        });
      } catch (err) {
        console.error('Error fetching ADLs:', err);
      }
    };

    if (mode === 'adl' && selectedFacility) {
      fetchADLs();
    }
  }, [selectedFacility, mode]);

  // Fetch WeeklyADLEntry for selected week and facility
  useEffect(() => {
    const fetchWeeklyADLEntries = async () => {
      if (!selectedWeek || !selectedFacility || mode !== 'adl') {
        return;
      }

      setLoadingADLs(true);
      try {
        const normalizedId = typeof selectedFacility === 'object' ? selectedFacility.id : selectedFacility;
        
        // Fetch WeeklyADLEntry for the selected week
        // Convert Monday (frontend) to Sunday (backend format) for query
        const weekStartSunday = mondayToSunday(selectedWeek);
        console.log('🔍 Fetching WeeklyADLEntry - selectedWeek (Monday):', selectedWeek, 'weekStartSunday (backend):', weekStartSunday);
        const weeklyEntriesRes = await axios.get(`${API_BASE_URL}/api/weekly-adls/?week_start_date=${weekStartSunday}&page_size=1000`);
        const weeklyEntries = weeklyEntriesRes.data.results || weeklyEntriesRes.data || [];
        console.log('🔍 Fetched', weeklyEntries.length, 'WeeklyADLEntry records for week (Sunday):', weekStartSunday);
        
        // Get all residents for this facility
        const residentsRes = await axios.get(`${API_BASE_URL}/api/residents/?facility_id=${normalizedId}&page_size=1000`);
        const facilityResidents = residentsRes.data.results || residentsRes.data || [];
        const facilityResidentIds = facilityResidents.map(r => r.id);
        
        // Filter weekly entries for residents in this facility
        const facilityWeeklyEntries = weeklyEntries.filter(entry => {
          const residentId = typeof entry.resident === 'object' ? entry.resident?.id : entry.resident;
          return facilityResidentIds.includes(residentId);
        });
        
        // Debug: Log entry week dates to see what we got
        if (facilityWeeklyEntries.length > 0) {
          const weekDates = [...new Set(facilityWeeklyEntries.map(e => e.week_start_date))];
          console.log('🔍 Entry week_start_date values from API:', weekDates);
          console.log('🔍 Looking for week:', weekStartSunday);
        } else {
          console.warn('⚠️ No entries found for week:', weekStartSunday, 'Query returned', weeklyEntries.length, 'total entries');
        }
        
        // Group by resident and convert to format expected by the UI
        const grouped = {};
        facilityWeeklyEntries.forEach(entry => {
          const residentId = typeof entry.resident === 'object' ? entry.resident?.id : entry.resident;
          if (!grouped[residentId]) {
            grouped[residentId] = [];
          }
          // Convert WeeklyADLEntry format to display format
          grouped[residentId].push({
            id: entry.id,
            resident: residentId,
            adl_question: typeof entry.adl_question === 'object' ? entry.adl_question?.id : entry.adl_question,
            question_text: entry.question_text,
            minutes: entry.minutes_per_occurrence,
            minutes_per_occurrence: entry.minutes_per_occurrence,
            frequency: entry.frequency_per_week,
            frequency_per_week: entry.frequency_per_week,
            total_hours: entry.total_hours_week,
            total_hours_week: entry.total_hours_week,
            status: entry.status || 'complete',
            per_day_data: entry.per_day_data,
            week_start_date: entry.week_start_date
          });
        });
        
        setAdlsByResident(grouped);
        console.log('✅ Loaded WeeklyADLEntry for week:', selectedWeek, 'Entries:', facilityWeeklyEntries.length, 'Residents with data:', Object.keys(grouped).length);
      } catch (err) {
        console.error('Error fetching WeeklyADLEntry:', err);
        setAdlsByResident({});
      } finally {
        setLoadingADLs(false);
      }
    };

    fetchWeeklyADLEntries();
  }, [selectedWeek, selectedFacility, mode]);

  const renderSectionsAndResidents = () => {
    if (!selectedFacility) return null;

    // Count residents per section
    const getSectionResidentCount = (sectionId) => {
      return residents.filter(
        r => r.facility_section === sectionId || r.facility_section?.id === sectionId
      ).length;
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Sections List */}
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5, display: 'block' }}>
                Sections in this Facility:
            </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSectionDialogOpen(true)}
              sx={{ fontSize: 12 }}
            >
              + Add Section
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sections.length === 0 ? (
              <Typography sx={{ color: '#6B7280', fontSize: 13, py: 1 }}>
                No sections found. Click "+ Add Section" to create one.
              </Typography>
            ) : (
              sections.map((section) => {
                const residentCount = getSectionResidentCount(section.id);
                return (
                <Paper
                  key={section.id}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    borderRadius: 2,
                    border: selectedSection?.id === section.id ? '2px solid' : '1px solid',
                    borderColor: selectedSection?.id === section.id ? 'primary.main' : '#E5E7EB',
                    bgcolor: selectedSection?.id === section.id ? '#E3F2FD' : 'background.paper',
                    boxShadow: selectedSection?.id === section.id 
                      ? '0 2px 4px rgba(0,0,0,0.1)' 
                      : '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    '&:hover': {
                      bgcolor: selectedSection?.id === section.id ? '#E3F2FD' : '#F5F5F5',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                      borderColor: selectedSection?.id === section.id ? 'primary.main' : 'primary.light',
                    },
                  }}
                  onClick={() => setSelectedSection(selectedSection?.id === section.id ? null : section)}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 14, mb: 0.5 }}>
                      {getCleanSectionName(section.name)}
                    </Typography>
                    <Typography sx={{ color: '#6B7280', fontSize: 13 }}>
                      {residentCount} {residentCount === 1 ? 'resident' : 'residents'}
                    </Typography>
                  </Box>
                  {selectedSection?.id === section.id ? (
                    <ExpandMoreIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  ) : (
                    <ChevronRightIcon sx={{ color: '#9CA3AF', fontSize: 20 }} />
                  )}
                </Paper>
                );
              })
            )}
          </Box>
        </Paper>

        {/* Residents for Selected Section */}
        {selectedSection && (
          <Paper sx={{ p: 2, ml: 2, borderLeft: '3px solid', borderColor: 'primary.main' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                    Residents in {getCleanSectionName(selectedSection.name)}
                  </Typography>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    startIcon={<PeopleIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setResidentDialogOpen(true)}
                    disabled={!selectedSection}
                    sx={{ fontSize: 12, py: 0.5 }}
                  >
                    Add Resident
                  </Button>
                </Box>
                <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600, mb: 1 }}>
                  {(() => {
                    const sectionResidents = residents.filter(
                      r => r.facility_section === selectedSection.id || r.facility_section?.id === selectedSection.id
                    );
                    return `${sectionResidents.length} ${sectionResidents.length === 1 ? 'Resident' : 'Residents'}`;
                  })()}
                </Typography>
                {(() => {
                  const sectionResidents = residents.filter(
                    r => r.facility_section === selectedSection.id || r.facility_section?.id === selectedSection.id
                  );
                  if (sectionResidents.length === 0) return null;
                  
                  let completedCount = 0;
                  let missingCount = 0;
                  sectionResidents.forEach(resident => {
                    const residentAdls = adlsByResident[resident.id] || [];
                    // Only count entries with actual data (frequency > 0 or minutes > 0)
                    const adlCount = residentAdls.filter(adl => 
                      (adl.frequency_per_week || 0) > 0 || (adl.minutes_per_occurrence || 0) > 0
                    ).length;
                    if (adlCount === 0) {
                      missingCount++;
                    } else if (resident.adl_data_status === 'completed') {
                      completedCount++;
                    }
                  });
                  
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontSize: 13, color: '#6f6f6f' }}>
                        <strong style={{ color: '#000' }}>{completedCount}</strong> Completed
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: 13, color: '#9CA3AF' }}>
                        ·
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: 13, color: '#6f6f6f' }}>
                        <strong style={{ color: '#000' }}>{missingCount}</strong> Missing ADLs
                      </Typography>
                    </Box>
                  );
                })()}
              </Box>
            </Box>
            {(() => {
              const sectionResidents = residents.filter(
                r => r.facility_section === selectedSection.id || r.facility_section?.id === selectedSection.id
              );
              
              if (sectionResidents.length === 0) {
                return (
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    No residents found in this section.
                  </Typography>
                );
              }

              return (
                <Box>
                  {sectionResidents.map((resident, index) => {
                    const residentAdls = adlsByResident[resident.id] || [];
                    const isExpanded = expandedResident === resident.id;
                    // Only count entries with actual data (frequency > 0 or minutes > 0)
                    // ADL model uses 'frequency' and 'minutes', not 'frequency_per_week' and 'minutes_per_occurrence'
                    const adlCount = residentAdls.filter(adl => 
                      (adl.frequency || 0) > 0 || (adl.minutes || 0) > 0
                    ).length;
                    const isLast = index === sectionResidents.length - 1;
                    
                    // Calculate total weekly time for this resident
                    const { totalWeeklyHours } = calculateAcuityMetrics(residentAdls, adlQuestions);
                    
                    // Debug: Log resident data for Patty specifically
                    if (resident.name && resident.name.includes('Patty')) {
                      console.log('🔍 PATTY DEBUG - Resident ADLs:', {
                        residentName: resident.name,
                        residentId: resident.id,
                        totalAdls: residentAdls.length,
                        adlsWithData: adlCount,
                        allAdls: residentAdls.map(adl => ({
                          id: adl.id,
                          question_text: adl.question_text,
                          adl_question: adl.adl_question,
                          frequency: adl.frequency,
                          minutes: adl.minutes,
                          hasData: (adl.frequency || 0) > 0 || (adl.minutes || 0) > 0
                        }))
                      });
                    }
                    
                    return (
                      <Box key={resident.id}>
                        <Box
                          sx={{
                            py: 0.8, // Reduced by ~20% from py: 1
                            px: 1.5,
                            borderBottom: isLast ? 'none' : '1px solid #eeeeee', // Faint row separator
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            bgcolor: isExpanded ? '#E3F2FD' : 'transparent',
                            '&:hover': {
                              bgcolor: isExpanded ? '#E3F2FD' : '#F9FAFB',
                            },
                            transition: 'background-color 0.2s ease',
                          }}
                          onClick={() => setExpandedResident(isExpanded ? null : resident.id)}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 15 }}>
                                  {resident.name}
                                </Typography>
                                {totalWeeklyHours > 0 && (
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      fontSize: 11, 
                                      color: '#6f6f6f',
                                      fontWeight: 500
                                    }}
                                  >
                                    {totalWeeklyHours.toFixed(1)}h/week
                                  </Typography>
                                )}
                              </Box>
                              <ChevronRightIcon 
                                sx={{ 
                                  color: '#9CA3AF', 
                                  fontSize: 18, 
                                  ml: 1,
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s ease',
                                }} 
                              />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                label={(resident.adl_data_status && resident.adl_data_status === 'completed') ? 'Completed' : 'Pending'}
                                size="small"
                                color={(resident.adl_data_status && resident.adl_data_status === 'completed') ? 'success' : 'warning'}
                                sx={{ 
                                  height: 20,
                                  fontSize: 11,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  '&:hover': {
                                    opacity: 0.8
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleADLDataStatus(resident);
                                }}
                              />
                              {(() => {
                                const acuity = getAcuityLevel(residentAdls, adlCount, adlQuestions);
                                // Debug: log what's being rendered
                                if (resident.name && (resident.name.includes('Patty') || resident.name.includes('Darlene'))) {
                                  console.log(`🎨 Rendering acuity for ${resident.name}:`, acuity);
                                }
                                // Show "ADLs Not Entered" tag for all residents with 0 entries
                                // Show acuity tags only for completed residents (and only if they have ADL data)
                                if (acuity) {
                                  if (acuity.label === 'ADLs Not Entered') {
                                    // Show missing tag for all residents with 0 entries - orange color
                                    return (
                                      <Chip
                                        label={acuity.label}
                                        size="small"
                                        sx={{ 
                                          height: 20,
                                          fontSize: 10,
                                          fontWeight: 500,
                                          bgcolor: acuity.customColor || '#ff9800',
                                          color: 'white'
                                        }}
                                      />
                                    );
                                  } else if (resident.adl_data_status === 'completed' && adlCount > 0) {
                                    // Show acuity tags only for completed residents with ADL data - use softer colors
                                    return (
                                      <Chip
                                        label={acuity.label}
                                        size="small"
                                        sx={{ 
                                          height: 20,
                                          fontSize: 10,
                                          fontWeight: 500,
                                          bgcolor: acuity.customColor || (acuity.color === 'error' ? '#ff6b6b' : acuity.color === 'warning' ? '#ffd93d' : '#6bcf7f'),
                                          color: 'white'
                                        }}
                                      />
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </Box>
                          </Box>
                        </Box>
                        
                        {isExpanded && (
                          <Box sx={{ px: 1.5, py: 1.5, bgcolor: '#FAFAFA', borderBottom: '1px solid', borderColor: '#E5E7EB' }}>
                            {loadingADLs ? (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                                Loading ADL entries...
                              </Typography>
                            ) : (
                              <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13 }}>
                                    ADL Questions & Entries
                                  </Typography>
                                  <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <Select
                                      value={resident.adl_data_status || 'pending'}
                                      onChange={(e) => {
                                        handleToggleADLDataStatus(resident, e.target.value);
                                      }}
                                      sx={{ 
                                        fontSize: 12,
                                        height: 28,
                                        '& .MuiSelect-select': {
                                          py: 0.5
                                        }
                                      }}
                                    >
                                      <MenuItem value="pending">Pending</MenuItem>
                                      <MenuItem value="completed">Completed</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Box>
                                {adlQuestions.length > 0 ? (() => {
                                  // Group questions by category
                                  const questionsByCategory = {};
                                  adlQuestions.forEach(q => {
                                    const category = categorizeQuestion(q.text || q.question_text);
                                    if (!questionsByCategory[category]) {
                                      questionsByCategory[category] = [];
                                    }
                                    questionsByCategory[category].push(q);
                                  });

                                  // Initialize expanded categories for this resident if not set
                                  if (!expandedCategories[resident.id]) {
                                    setExpandedCategories(prev => ({
                                      ...prev,
                                      [resident.id]: new Set(['Personal Care', 'Mobility', 'Behavioral / Cognitive', 'Medical / Medication', 'Documentation & Communication'])
                                    }));
                                  }

                                  const residentExpandedCategories = expandedCategories[resident.id] || new Set(['Personal Care', 'Mobility', 'Behavioral / Cognitive', 'Medical / Medication', 'Documentation & Communication']);

                                  return (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                      {Object.entries(questionsByCategory).map(([category, categoryQuestions]) => {
                                        const isCategoryExpanded = residentExpandedCategories.has(category);
                                        
                                        return (
                                          <Box key={category}>
                                            {/* Category Header */}
                                            <Box
                                              sx={{
                                                p: 1,
                                                bgcolor: '#f5f5f5',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                '&:hover': { bgcolor: '#eeeeee' },
                                              }}
                                              onClick={() => toggleCategoryExpansion(resident.id, category)}
                                            >
                                              <IconButton size="small" sx={{ mr: 0.5, p: 0.5 }}>
                                                {isCategoryExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
                                              </IconButton>
                                              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 12 }}>
                                                {category} ({categoryQuestions.length} {categoryQuestions.length === 1 ? 'question' : 'questions'})
                                              </Typography>
                                            </Box>
                                            
                                            {/* Category Questions */}
                                            <Collapse in={isCategoryExpanded} timeout="auto" unmountOnExit>
                                              {categoryQuestions.map((question, qIndex) => {
                                                // Ensure both IDs are compared as numbers (in case one is string)
                                                const existingEntry = residentAdls.find(adl => {
                                                  const adlQuestionId = typeof adl.adl_question === 'object' ? adl.adl_question?.id : adl.adl_question;
                                                  return Number(adlQuestionId) === Number(question.id);
                                                });
                                                
                                                // Debug: log if we're looking for a specific question
                                                if (question.id === 1) {
                                                  if (existingEntry) {
                                                    console.log('🔍 Found entry for question 1:', existingEntry, 'week_start_date:', existingEntry?.week_start_date);
                                                  } else {
                                                    console.log('⚠️ No data found for question 1. residentAdls:', residentAdls.length, 'entries');
                                                  }
                                                }
                                                
                                                // Check if entry has actual data
                                                const hasData = existingEntry && (
                                                  (existingEntry.frequency_per_week || 0) > 0 || 
                                                  (existingEntry.minutes_per_occurrence || 0) > 0 ||
                                                  (existingEntry.frequency || 0) > 0 ||
                                                  (existingEntry.minutes || 0) > 0
                                                );
                                                
                                                // Calculate total minutes for this question
                                                let totalMinutes = 0;
                                                if (existingEntry) {
                                                  if (existingEntry.total_minutes_week) {
                                                    totalMinutes = existingEntry.total_minutes_week;
                                                  } else if (existingEntry.total_minutes) {
                                                    totalMinutes = existingEntry.total_minutes;
                                                  } else {
                                                    // Calculate from frequency and minutes
                                                    const frequency = existingEntry.frequency_per_week || existingEntry.frequency || 0;
                                                    const minutes = existingEntry.minutes_per_occurrence || existingEntry.minutes || 0;
                                                    totalMinutes = frequency * minutes;
                                                  }
                                                }
                                                
                                                const isEven = qIndex % 2 === 0;
                                                
                                                return (
                                                  <Box
                                                    key={question.id}
                                                    sx={{
                                                      p: 1.5,
                                                      bgcolor: isEven ? '#ffffff' : '#fafafa',
                                                      borderBottom: '1px solid #eeeeee',
                                                    }}
                                                  >
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                      <Box sx={{ flex: 1 }}>
                                                        <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 500 }}>
                                                          {question.text || question.question_text}
                                                        </Typography>
                                                        {hasData && totalMinutes > 0 && (
                                                          <Typography variant="caption" sx={{ fontSize: 11, color: '#6B7280', mt: 0.25, display: 'block' }}>
                                                            {totalMinutes} min/week
                                                          </Typography>
                                                        )}
                                                      </Box>
                                                      {hasData ? (
                                                        <Button
                                                          size="small"
                                                          variant="text"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            console.log('🔵 Edit button clicked for entry:', existingEntry);
                                                            handleEditADLEntry(resident, question, existingEntry);
                                                          }}
                                                          sx={{ 
                                                            fontSize: 13, 
                                                            ml: 1,
                                                            color: '#2563eb',
                                                            fontWeight: 500,
                                                            textTransform: 'none',
                                                            py: 0.2,
                                                            px: 0.6,
                                                            minWidth: 'auto',
                                                            '&:hover': {
                                                              bgcolor: 'transparent',
                                                              color: '#1e40af'
                                                            }
                                                          }}
                                                        >
                                                          Edit
                                                        </Button>
                                                      ) : (
                                                        <Button
                                                          size="small"
                                                          variant="text"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (existingEntry) {
                                                              // Edit existing entry with no data
                                                              handleEditADLEntry(resident, question, existingEntry);
                                                            } else {
                                                              // Add new entry
                                                              setAddingADLForQuestion({ residentId: resident.id, questionId: question.id });
                                                              setAdlEntryForm({ minutes: '', per_day_shift_times: {} });
                                                              setAdlEntryError('');
                                                            }
                                                          }}
                                                          sx={{ 
                                                            fontSize: 13, 
                                                            ml: 1,
                                                            color: '#2563eb',
                                                            fontWeight: 500,
                                                            textTransform: 'none',
                                                            py: 0.2,
                                                            px: 0.6,
                                                            minWidth: 'auto',
                                                            '&:hover': {
                                                              bgcolor: 'transparent',
                                                              color: '#1e40af'
                                                            }
                                                          }}
                                                        >
                                                          Add
                                                        </Button>
                                                      )}
                                                    </Box>
                                                  </Box>
                                                );
                                              })}
                                            </Collapse>
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  );
                                })() : (
                                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                                    Loading ADL questions...
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              );
            })()}
          </Paper>
        )}
      </Box>
    );
  };

  const handleSectionFormChange = (e) => {
    setSectionForm({ ...sectionForm, [e.target.name]: e.target.value });
    setSectionError('');
  };

  const handleSectionAdd = async () => {
    if (!sectionForm.name || !sectionForm.name.trim()) {
      setSectionError('Section name is required');
      return;
    }
    if (!selectedFacility) {
      setSectionError('Please select a facility first');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/facilitysections/`, {
        name: sectionForm.name.trim(),
        facility: selectedFacility,
      });
      setSectionDialogOpen(false);
      setSectionForm({ name: '' });
      setSectionError('');
      // Refresh sections - use the same reliable method as handleFacilityChange
      try {
        const facilityRes = await axios.get(`${API_BASE_URL}/api/facilities/${selectedFacility}/`);
        if (facilityRes.data.sections && Array.isArray(facilityRes.data.sections)) {
          setSections(facilityRes.data.sections);
          console.log('✅ Refreshed sections from facility endpoint:', facilityRes.data.sections.length);
        } else {
          // Fallback to facilitysections endpoint
          const sectionsRes = await axios.get(`${API_BASE_URL}/api/facilitysections/?facility=${selectedFacility}`);
          const sectionsData = sectionsRes.data.results || sectionsRes.data || [];
          setSections(sectionsData);
          console.log('✅ Refreshed sections from facilitysections endpoint:', sectionsData.length);
        }
      } catch (refreshErr) {
        console.error('Error refreshing sections:', refreshErr);
        // Try one more time with facilitysections endpoint
        try {
          const sectionsRes = await axios.get(`${API_BASE_URL}/api/facilitysections/?facility=${selectedFacility}`);
          const sectionsData = sectionsRes.data.results || sectionsRes.data || [];
          setSections(sectionsData);
        } catch (finalErr) {
          console.error('Final error refreshing sections:', finalErr);
        }
      }
    } catch (err) {
      console.error('Error adding section:', err);
      setSectionError(err.response?.data?.detail || err.response?.data?.name?.[0] || 'Failed to add section');
    }
  };

  // selectedFacilityData is now a state variable set in handleFacilityChange and fetchFacilities

  const [hasADLDataForWeek, setHasADLDataForWeek] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [checkingADLData, setCheckingADLData] = useState(false);
  const [copyingPreviousWeek, setCopyingPreviousWeek] = useState(false);

  // Check if ADL data exists for the selected week and facility
  // Use the same endpoint as the caregiving summary chart - if chart shows data, ADL data exists!
  const checkADLData = async () => {
    if (!selectedWeek) {
      setHasADLDataForWeek(false);
      return;
    }

    setCheckingADLData(true);
    try {
      // Use the same endpoint as the caregiving summary chart
      const params = {
        week_start_date: selectedWeek
      };
      if (selectedFacility) {
        params.facility_id = selectedFacility;
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/adls/caregiving_summary/`, { params });
      
      // If the chart endpoint returns data with hours > 0, ADL data exists
      const perShift = response.data?.per_shift || [];
      const hasData = perShift.some(day => {
        const totalHours = (day.Day || 0) + (day.Swing || 0) + (day.NOC || 0);
        return totalHours > 0;
      });
      
      setHasADLDataForWeek(hasData);
    } catch (error) {
      console.error('Error checking ADL data:', error);
      setHasADLDataForWeek(false);
    } finally {
      setCheckingADLData(false);
    }
  };

  useEffect(() => {
    checkADLData();
  }, [selectedWeek, selectedFacility]);

  // Helper function to get previous week's Monday date
  const getPreviousWeek = (currentWeekDate) => {
    if (!currentWeekDate) return null;
    const date = new Date(currentWeekDate);
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };

  // Handle CSV import
  const handleCSVImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!selectedFacility) {
      alert('Please select a facility first');
      return;
    }

    if (!selectedWeek) {
      alert('Please select a week first');
      return;
    }

    // Calculate week_end_date (6 days after week_start_date)
    const weekStart = new Date(selectedWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndDate = weekEnd.toISOString().split('T')[0];

    setImportingCSV(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('facility_id', selectedFacility);
      formData.append('week_start_date', selectedWeek);
      formData.append('week_end_date', weekEndDate);

      const response = await axios.post(`${API_BASE_URL}/api/adls/upload/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert(`Import successful! ${response.data.message || 'CSV imported successfully.'}`);
      
      // Refresh sections and residents after import (new ones may have been created)
      if (selectedFacility) {
        const normalizedId = typeof selectedFacility === 'object' ? selectedFacility.id : selectedFacility;
        try {
          // Refresh sections
          const facilityRes = await axios.get(`${API_BASE_URL}/api/facilities/${normalizedId}/`);
          if (facilityRes.data.sections && Array.isArray(facilityRes.data.sections)) {
            setSections(facilityRes.data.sections);
            console.log('✅ Refreshed sections after import:', facilityRes.data.sections.length);
          } else {
            // Fallback: Use facilitysections endpoint
            const sectionsRes = await axios.get(`${API_BASE_URL}/api/facilitysections/?facility=${normalizedId}`);
            const sectionsData = sectionsRes.data.results || sectionsRes.data || [];
            setSections(sectionsData);
            console.log('✅ Refreshed sections after import (fallback):', sectionsData.length);
          }
          
          // Refresh residents
          const residentsRes = await axios.get(`${API_BASE_URL}/api/residents/?facility_id=${normalizedId}&page_size=1000`);
          const residentsData = residentsRes.data.results || residentsRes.data || [];
          setResidents(residentsData);
          console.log('✅ Refreshed residents after import:', residentsData.length);
        } catch (refreshErr) {
          console.error('❌ Error refreshing sections/residents after import:', refreshErr);
        }
      }
      
      // Refresh chart and ADL data
      setChartRefreshKey(prev => prev + 1);
      checkADLData();
      
      // Reload weekly entries
      if (selectedWeek && selectedFacility && mode === 'adl') {
        const normalizedId = typeof selectedFacility === 'object' ? selectedFacility.id : selectedFacility;
        // Convert Monday (frontend) to Sunday (backend format) for query
        const weekStartSunday = mondayToSunday(selectedWeek);
        console.log('🔄 Reloading WeeklyADLEntry after import - selectedWeek (Monday):', selectedWeek, 'weekStartSunday (backend):', weekStartSunday);
        const weeklyEntriesRes = await axios.get(`${API_BASE_URL}/api/weekly-adls/?week_start_date=${weekStartSunday}&page_size=1000`);
        const allEntries = weeklyEntriesRes.data.results || weeklyEntriesRes.data || [];
        console.log('🔄 Fetched', allEntries.length, 'entries after import');
        const facilityWeeklyEntries = allEntries.filter(entry => {
          const entryFacilityId = entry.resident?.facility_section?.facility;
          return String(entryFacilityId) === String(normalizedId);
        });
        
        // Group by resident and convert to format expected by the UI
        const grouped = {};
        facilityWeeklyEntries.forEach(entry => {
          const residentId = typeof entry.resident === 'object' ? entry.resident?.id : entry.resident;
          if (!grouped[residentId]) {
            grouped[residentId] = [];
          }
          // Convert WeeklyADLEntry format to display format (same as fetchWeeklyADLEntries)
          grouped[residentId].push({
            id: entry.id,
            resident: residentId,
            adl_question: typeof entry.adl_question === 'object' ? entry.adl_question?.id : entry.adl_question,
            question_text: entry.question_text,
            minutes: entry.minutes_per_occurrence,
            minutes_per_occurrence: entry.minutes_per_occurrence,
            frequency: entry.frequency_per_week,
            frequency_per_week: entry.frequency_per_week,
            total_hours: entry.total_hours_week,
            total_hours_week: entry.total_hours_week,
            status: entry.status || 'complete',
            per_day_data: entry.per_day_data,
            week_start_date: entry.week_start_date
          });
        });
        setAdlsByResident(grouped);
        console.log('🔄 Updated adlsByResident with', Object.keys(grouped).length, 'residents,', facilityWeeklyEntries.length, 'total entries');
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert(`Import failed: ${error.response?.data?.error || error.message || 'Unknown error'}`);
    } finally {
      setImportingCSV(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Copy ADL entries from previous week to current week
  const handleCopyPreviousWeek = async () => {
    if (!selectedWeek || !selectedFacility) {
      alert('Please select a week and facility first');
      return;
    }

    const previousWeekDate = getPreviousWeek(selectedWeek);
    if (!previousWeekDate) {
      alert('Could not calculate previous week date');
      return;
    }

    setCopyingPreviousWeek(true);
    try {
      // Get residents for the selected facility first
      let facilityResidentIds = [];
      if (selectedFacility) {
        const residentsRes = await axios.get(`${API_BASE_URL}/api/residents/?facility_id=${selectedFacility}&page_size=1000`);
        const facilityResidents = residentsRes.data.results || residentsRes.data || [];
        facilityResidentIds = facilityResidents.map(r => r.id);
      }

      // Fetch previous week's entries
      const previousWeekRes = await axios.get(
        `${API_BASE_URL}/api/weekly-adls/?week_start_date=${mondayToSunday(previousWeekDate)}&page_size=1000`
      );
      let previousEntries = previousWeekRes.data.results || previousWeekRes.data || [];

      // Filter entries for residents in the selected facility
      if (selectedFacility && facilityResidentIds.length > 0) {
        previousEntries = previousEntries.filter(entry => 
          facilityResidentIds.includes(entry.resident)
        );
      }

      if (previousEntries.length === 0) {
        alert('No ADL data found for the previous week');
        setCopyingPreviousWeek(false);
        return;
      }

      // Calculate current week's end date
      const currentWeekEnd = new Date(selectedWeek);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
      const currentWeekEndString = currentWeekEnd.toISOString().split('T')[0];

      // Create new entries for current week
      let copiedCount = 0;
      let skippedCount = 0;

      for (const prevEntry of previousEntries) {
        // Only copy if there's actual data (frequency > 0 or minutes > 0)
        if ((prevEntry.frequency_per_week || 0) > 0 || (prevEntry.minutes_per_occurrence || 0) > 0) {
          try {
            await axios.post(`${API_BASE_URL}/api/weekly-adls/`, {
              resident: prevEntry.resident,
              adl_question: prevEntry.adl_question,
              question_text: prevEntry.question_text,
              week_start_date: selectedWeek,
              week_end_date: currentWeekEndString,
              minutes_per_occurrence: prevEntry.minutes_per_occurrence || 0,
              frequency_per_week: prevEntry.frequency_per_week || 0,
              total_minutes_week: prevEntry.total_minutes_week || 0,
              total_hours_week: prevEntry.total_hours_week || 0,
              per_day_data: prevEntry.per_day_data || {},
              status: 'complete',
              notes: prevEntry.notes || ''
            });
            copiedCount++;
          } catch (err) {
            // Entry might already exist, skip it
            if (err.response?.status !== 400) {
              console.error('Error copying entry:', err);
            }
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      }

      // Refresh ADL data check
      await checkADLData();
      
      // Refresh residents and ADL data
      if (selectedFacility) {
        try {
          const residentsRes = await axios.get(`${API_BASE_URL}/api/residents/?facility_id=${selectedFacility}&page_size=1000`);
          const residentsData = residentsRes.data.results || residentsRes.data || [];
          setResidents(residentsData);

          // Refresh ADL data
          // Convert Monday (frontend) to Sunday (backend format) for query
          const weekStartSunday = mondayToSunday(selectedWeek);
          const weeklyEntriesRes = await axios.get(`${API_BASE_URL}/api/weekly-adls/?week_start_date=${weekStartSunday}&page_size=1000`);
          const allEntries = weeklyEntriesRes.data.results || weeklyEntriesRes.data || [];
          
          // Group by resident
          const grouped = {};
          allEntries.forEach(entry => {
            if (!grouped[entry.resident]) {
              grouped[entry.resident] = [];
            }
            grouped[entry.resident].push(entry);
          });
          setAdlsByResident(grouped);
        } catch (err) {
          console.error('Error refreshing data:', err);
        }
      }

      alert(`Copied ${copiedCount} ADL entries from previous week${skippedCount > 0 ? ` (${skippedCount} skipped - no data)` : ''}`);
    } catch (err) {
      console.error('Error copying previous week data:', err);
      alert('Failed to copy previous week data. Please try again.');
    } finally {
      setCopyingPreviousWeek(false);
    }
  };

  // Scroll tracking for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleToggleADLDataStatus = async (resident, newStatus = null) => {
    const currentStatus = resident.adl_data_status || 'pending';
    const statusToSet = newStatus !== null ? newStatus : (currentStatus === 'completed' ? 'pending' : 'completed');
    try {
      await axios.patch(`${API_BASE_URL}/api/residents/${resident.id}/`, {
        adl_data_status: statusToSet
      });
      // Update the resident in the local state
      setResidents(prev => prev.map(r => 
        r.id === resident.id ? { ...r, adl_data_status: statusToSet } : r
      ));
    } catch (err) {
      console.error('Failed to update ADL data status:', err);
      alert('Failed to update ADL data status');
    }
  };

  const handleAddResident = async () => {
    if (!residentForm.name || !residentForm.name.trim()) {
      setResidentError('Resident name is required');
      return;
    }
    if (!selectedSection) {
      setResidentError('Please select a section first');
      return;
    }
    try {
      const response = await axios.post(`${API_BASE_URL}/api/residents/`, {
        name: residentForm.name.trim(),
        status: residentForm.status || 'Active',
        facility_section: selectedSection.id,
        adl_data_status: 'pending', // New residents default to pending
      });
      
      const newResident = response.data;
      console.log('✅ Created new resident:', newResident);
      
      setResidentDialogOpen(false);
      setResidentForm({ name: '', status: 'Active' });
      setResidentError('');
      
      // Refresh residents - add the new resident immediately and also refresh from server
      if (selectedFacility) {
        try {
          const residentsRes = await axios.get(`${API_BASE_URL}/api/residents/?facility_id=${selectedFacility}&page_size=1000`);
          const residentsData = residentsRes.data.results || residentsRes.data || [];
          setResidents(residentsData);
          console.log('✅ Refreshed residents list, total:', residentsData.length);
          
          // Verify the new resident is in the list
          const foundResident = residentsData.find(r => r.id === newResident.id);
          if (foundResident) {
            console.log('✅ New resident found in refreshed list');
          } else {
            console.warn('⚠️ New resident not found in refreshed list, but it should be available');
          }
        } catch (err) {
          console.error('Error refreshing residents:', err);
          // Even if refresh fails, add the new resident to the list from the response
          if (newResident && newResident.id) {
            setResidents(prev => {
              // Check if resident already exists to avoid duplicates
              const exists = prev.find(r => r.id === newResident.id);
              if (exists) return prev;
              return [...prev, newResident];
            });
          }
        }
      } else if (newResident && newResident.id) {
        // If no facility selected, just add the new resident to the list
        setResidents(prev => {
          const exists = prev.find(r => r.id === newResident.id);
          if (exists) return prev;
          return [...prev, newResident];
        });
      }
    } catch (err) {
      console.error('Error adding resident:', err);
      setResidentError(err.response?.data?.detail || err.response?.data?.name?.[0] || 'Failed to add resident');
    }
  };

  // Handler to save ADL entry
  const handleSaveADLEntry = async () => {
    if (!addingADLForQuestion) return;
    
    const { residentId, questionId } = addingADLForQuestion;
    const question = adlQuestions.find(q => q.id === questionId);
    
    if (!adlEntryForm.minutes) {
      setAdlEntryError('Please fill in minutes');
      return;
    }
    
    setSavingADLEntry(true);
    setAdlEntryError('');
    
    try {
      // Sanitize per_day_shift_times: convert empty strings to 0
      const sanitizedPerDayShiftTimes = {};
      Object.entries(adlEntryForm.per_day_shift_times || {}).forEach(([k, v]) => {
        sanitizedPerDayShiftTimes[k] = v === '' || v === undefined || v === null ? 0 : Number(v);
      });
      
      // Calculate frequency from per_day_shift_times
      const calculatedFrequency = Object.values(sanitizedPerDayShiftTimes).reduce((sum, val) => sum + val, 0);
      
      if (calculatedFrequency === 0) {
        setAdlEntryError('Please enter at least one frequency in the day/shift table');
        setSavingADLEntry(false);
        return;
      }
      
      // Calculate week end date
      // Ensure week_start_date is in YYYY-MM-DD format
      const weekStartDate = selectedWeek.includes('T') ? selectedWeek.split('T')[0] : selectedWeek;
      const weekStart = new Date(weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndDate = weekEnd.toISOString().split('T')[0];
      
      const minutes = Number(adlEntryForm.minutes) || 0;
      const totalMinutes = minutes * calculatedFrequency;
      
      const payload = {
        resident: residentId,
        adl_question: questionId,
        question_text: question?.text || question?.question_text || '',
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        minutes_per_occurrence: minutes,
        frequency_per_week: calculatedFrequency,
        total_minutes_week: totalMinutes,
        per_day_data: sanitizedPerDayShiftTimes,
        status: 'complete'
      };
      
      console.log('🔵 Saving ADL entry with payload:', payload);
      
      // Check if entry already exists (might exist from CSV import)
      let existingEntryId = editingADLEntryId;
      
      if (!existingEntryId) {
        // Try to find existing entry for this resident+question+week
        // Convert Monday (frontend) to Sunday (backend format) for query
        const weekStartSunday = mondayToSunday(weekStartDate);
        try {
          const searchResponse = await axios.get(`${API_BASE_URL}/api/weekly-adls/?resident=${residentId}&adl_question=${questionId}&week_start_date=${weekStartSunday}`);
          const existingEntries = searchResponse.data.results || searchResponse.data || [];
          if (existingEntries.length > 0) {
            existingEntryId = existingEntries[0].id;
            console.log('🔵 Found existing entry from CSV import:', existingEntryId);
          }
        } catch (searchErr) {
          console.log('🔵 No existing entry found, will create new one');
        }
      }
      
      // Update existing entry or create new one
      let savedEntry;
      if (existingEntryId) {
        console.log('🔵 Updating existing entry:', existingEntryId);
        const response = await axios.patch(`${API_BASE_URL}/api/weekly-adls/${existingEntryId}/`, payload);
        if (response.status >= 200 && response.status < 300) {
          savedEntry = response.data;
          console.log('✅ Entry updated successfully:', savedEntry);
        } else {
          throw new Error('Update failed with status: ' + response.status);
        }
      } else {
        console.log('🔵 Creating new entry');
        const response = await axios.post(`${API_BASE_URL}/api/weekly-adls/`, payload);
        if (response.status >= 200 && response.status < 300) {
          savedEntry = response.data;
          console.log('✅ Entry created successfully:', savedEntry);
        } else {
          throw new Error('Create failed with status: ' + response.status);
        }
      }
      
      // Only close dialog if save was successful
      console.log('✅ Save completed, closing dialog and refreshing data');
      setAddingADLForQuestion(null);
      setEditingADLEntryId(null);
      setAdlEntryForm({ minutes: '', per_day_shift_times: {} });
      setAdlEntryError('');
      
      // Small delay to ensure backend has processed the save
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh ADL data for this resident
      if (selectedFacility && selectedWeek) {
        setLoadingADLs(true);
        try {
          const normalizedId = typeof selectedFacility === 'object' ? selectedFacility.id : selectedFacility;
          
          // Convert to Sunday (backend format) for query
          // weekStartDate might be Monday or Sunday, so normalize it
          const refreshWeekStart = weekStartDate ? mondayToSunday(weekStartDate) : mondayToSunday(selectedWeek);
          console.log('🔄 Refreshing ADL data for week:', refreshWeekStart, 'facility:', normalizedId);
          
          // Fetch WeeklyADLEntry for the selected week
          const weeklyEntriesRes = await axios.get(`${API_BASE_URL}/api/weekly-adls/?week_start_date=${refreshWeekStart}&page_size=1000`);
          const weeklyEntries = weeklyEntriesRes.data.results || weeklyEntriesRes.data || [];
          console.log('🔄 Fetched', weeklyEntries.length, 'weekly entries');
          
          // Get all residents for this facility
          const residentsRes = await axios.get(`${API_BASE_URL}/api/residents/?facility_id=${normalizedId}&page_size=1000`);
          let facilityResidents = residentsRes.data.results || residentsRes.data || [];
          
          // If we just saved an entry, ensure the resident is in the list
          if (savedEntry && savedEntry.resident) {
            const savedResidentId = typeof savedEntry.resident === 'object' ? savedEntry.resident?.id : savedEntry.resident;
            const residentExists = facilityResidents.find(r => r.id === savedResidentId);
            if (!residentExists) {
              // Try to fetch the resident directly
              try {
                const residentRes = await axios.get(`${API_BASE_URL}/api/residents/${savedResidentId}/`);
                facilityResidents.push(residentRes.data);
                console.log('✅ Added newly created resident to facility list');
              } catch (err) {
                console.warn('⚠️ Could not fetch resident:', err);
              }
            }
          }
          
          const facilityResidentIds = facilityResidents.map(r => r.id);
          
          // Filter weekly entries for residents in this facility
          const facilityWeeklyEntries = weeklyEntries.filter(entry => {
            const residentId = typeof entry.resident === 'object' ? entry.resident?.id : entry.resident;
            return facilityResidentIds.includes(residentId);
          });
          
          // Start with existing grouped data to preserve entries that were already loaded
          // Deep clone to avoid mutating the state directly
          const grouped = JSON.parse(JSON.stringify(adlsByResident));
          
          // Update or add entries from the refresh query
          facilityWeeklyEntries.forEach(entry => {
            const residentId = typeof entry.resident === 'object' ? entry.resident?.id : entry.resident;
            const questionId = typeof entry.adl_question === 'object' ? entry.adl_question?.id : entry.adl_question;
            
            if (!grouped[residentId]) {
              grouped[residentId] = [];
            }
            
            // Check if this entry already exists (by ID or by resident+question combination)
            const existingIndex = grouped[residentId].findIndex(e => 
              e.id === entry.id || (e.resident === residentId && e.adl_question === questionId)
            );
            
            // Convert WeeklyADLEntry format to display format
            const entryData = {
              id: entry.id,
              resident: residentId,
              adl_question: questionId,
              question_text: entry.question_text,
              minutes: entry.minutes_per_occurrence,
              minutes_per_occurrence: entry.minutes_per_occurrence,
              frequency: entry.frequency_per_week,
              frequency_per_week: entry.frequency_per_week,
              total_hours: entry.total_hours_week,
              total_hours_week: entry.total_hours_week,
              status: entry.status || 'complete',
              per_day_data: entry.per_day_data,
              week_start_date: entry.week_start_date
            };
            
            if (existingIndex >= 0) {
              // Update existing entry
              grouped[residentId][existingIndex] = entryData;
            } else {
              // Add new entry
              grouped[residentId].push(entryData);
            }
          });
          
          console.log('🔄 Refreshed ADL data. Total entries:', facilityWeeklyEntries.length);
          console.log('🔄 Grouped by resident:', Object.keys(grouped).length, 'residents');
          
          // If we have a saved entry, ensure it's included in the grouped data
          if (savedEntry && savedEntry.id) {
            const savedResidentId = typeof savedEntry.resident === 'object' ? savedEntry.resident?.id : savedEntry.resident;
            const savedQuestionId = typeof savedEntry.adl_question === 'object' ? savedEntry.adl_question?.id : savedEntry.adl_question;
            
            // Ensure resident is in facility list
            if (!facilityResidentIds.includes(savedResidentId)) {
              console.log('⚠️ Saved entry resident not in facility list, fetching resident...');
              try {
                const residentRes = await axios.get(`${API_BASE_URL}/api/residents/${savedResidentId}/`);
                facilityResidents.push(residentRes.data);
                facilityResidentIds.push(savedResidentId);
                console.log('✅ Added resident to facility list');
              } catch (err) {
                console.warn('⚠️ Could not fetch resident, but will add entry anyway:', err);
              }
            }
            
            // Check if the entry is already in the grouped data
            if (!grouped[savedResidentId]) {
              grouped[savedResidentId] = [];
            }
            
            const existingIndex = grouped[savedResidentId].findIndex(e => 
              e.id === savedEntry.id || (e.resident === savedResidentId && e.adl_question === savedQuestionId)
            );
            
            const entryData = {
              id: savedEntry.id,
              resident: savedResidentId,
              adl_question: savedQuestionId,
              question_text: savedEntry.question_text,
              minutes: savedEntry.minutes_per_occurrence,
              minutes_per_occurrence: savedEntry.minutes_per_occurrence,
              frequency: savedEntry.frequency_per_week,
              frequency_per_week: savedEntry.frequency_per_week,
              total_hours: savedEntry.total_hours_week,
              total_hours_week: savedEntry.total_hours_week,
              status: savedEntry.status || 'complete',
              per_day_data: savedEntry.per_day_data,
              week_start_date: savedEntry.week_start_date
            };
            
            if (existingIndex >= 0) {
              // Update existing entry
              grouped[savedResidentId][existingIndex] = entryData;
              console.log('✅ Updated saved entry in grouped data');
            } else {
              // Add new entry
              grouped[savedResidentId].push(entryData);
              console.log('✅ Added saved entry to grouped data');
            }
            
            // Also verify it's in the facilityWeeklyEntries for logging
            const savedEntryInRefresh = facilityWeeklyEntries.find(e => {
              const eId = e.id;
              const eResidentId = typeof e.resident === 'object' ? e.resident?.id : e.resident;
              const eQuestionId = typeof e.adl_question === 'object' ? e.adl_question?.id : e.adl_question;
              return eId === savedEntry.id || (eResidentId === savedResidentId && eQuestionId === savedQuestionId);
            });
            
            if (savedEntryInRefresh) {
              console.log('✅ Saved entry found in refresh query results');
            } else {
              console.log('ℹ️ Saved entry not in refresh query results (may be due to filtering), but added to UI anyway');
            }
          }
          
          setAdlsByResident(grouped);
          
          // Trigger chart refresh to show updated caregiving summary
          // Add a small delay to ensure backend has fully processed the save
          setTimeout(() => {
            setChartRefreshKey(prev => prev + 1);
            console.log('🔄 Chart refresh triggered after ADL save (delayed)');
          }, 1000);
        } catch (err) {
          console.error('Error refreshing ADLs:', err);
        } finally {
          setLoadingADLs(false);
        }
      } else {
        console.warn('⚠️ Cannot refresh: missing selectedFacility or selectedWeek');
      }
    } catch (err) {
      console.error('❌ Error saving ADL entry:', err);
      console.error('❌ Error response:', err.response?.data);
      console.error('❌ Error status:', err.response?.status);
      
      // Show detailed error message
      let errorMessage = 'Failed to save ADL entry';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data.non_field_errors) {
          errorMessage = err.response.data.non_field_errors.join(', ');
        } else {
          // Show first field error if available
          const fieldErrors = Object.entries(err.response.data).map(([field, errors]) => {
            if (Array.isArray(errors)) {
              return `${field}: ${errors.join(', ')}`;
            }
            return `${field}: ${errors}`;
          });
          if (fieldErrors.length > 0) {
            errorMessage = fieldErrors.join('; ');
          }
        }
      }
      
      setAdlEntryError(errorMessage);
    } finally {
      setSavingADLEntry(false);
    }
  };

  // Handler to open edit dialog with existing entry data
  const handleEditADLEntry = (resident, question, existingEntry) => {
    console.log('🔵 Opening edit dialog for entry:', existingEntry);
    console.log('🔵 Resident:', resident);
    console.log('🔵 Question:', question);
    
    if (!existingEntry || !existingEntry.id) {
      console.error('❌ No entry ID found in existingEntry:', existingEntry);
      alert('Unable to edit: Entry data is missing. Please refresh the page.');
      return;
    }
    
    // Open dialog immediately
    setAddingADLForQuestion({
      residentId: resident.id,
      questionId: question.id
    });
    setEditingADLEntryId(existingEntry.id);
    setAdlEntryError('');
    
    // Initialize form with basic data
    setAdlEntryForm({
      minutes: existingEntry.minutes || existingEntry.minutes_per_occurrence || '',
      per_day_shift_times: {}
    });
    
    // Fetch the full entry data to get complete per_day_data
    const fetchFullEntry = async () => {
      try {
        let entryData = null;
        const entryId = existingEntry.id;
        
        // Try to fetch by ID first
        if (entryId) {
          try {
            console.log('🔵 Fetching full entry data for ID:', entryId);
            const response = await axios.get(`${API_BASE_URL}/api/weekly-adls/${entryId}/`);
            entryData = response.data;
            console.log('✅ Fetched entry data by ID:', entryData);
          } catch (idError) {
            console.log('⚠️ Failed to fetch by ID, trying by resident+question+week...', idError.response?.data);
          }
        }
        
        // If ID lookup failed, try to find by resident, question, and week
        if (!entryData && selectedWeek) {
          try {
            // Convert Monday (frontend) to Sunday (backend format)
            const weekStartSunday = (() => {
              const date = new Date(selectedWeek);
              date.setDate(date.getDate() - 1); // Go back one day to get Sunday
              return date.toISOString().split('T')[0];
            })();
            
            console.log('🔵 Searching for entry by resident, question, and week...');
            console.log('🔵 Using week_start_date (Sunday):', weekStartSunday, 'from selectedWeek (Monday):', selectedWeek);
            const searchResponse = await axios.get(`${API_BASE_URL}/api/weekly-adls/?resident=${resident.id}&adl_question=${question.id}&week_start_date=${weekStartSunday}`);
            const searchResults = searchResponse.data.results || searchResponse.data || [];
            if (searchResults.length > 0) {
              entryData = searchResults[0];
              console.log('✅ Found entry by search:', entryData);
              // Update the editing ID
              setEditingADLEntryId(entryData.id);
            }
          } catch (searchError) {
            console.error('❌ Failed to search for entry:', searchError);
          }
        }
        
        if (!entryData) {
          console.error('❌ No entry data found');
          setAdlEntryError('Entry not found. Please refresh the page.');
          return;
        }
        
        // Convert per_day_data to per_day_shift_times format
        let fullPerDayShiftTimes = {};
        
        if (entryData.per_day_data && typeof entryData.per_day_data === 'object') {
          // Check if it's in old format (MonShift1Time, MonShift2Time, etc.)
          const oldFormatKeys = Object.keys(entryData.per_day_data);
          const isOldFormat = oldFormatKeys.length > 0 && oldFormatKeys.some(key => 
            typeof key === 'string' && key.includes('Shift') && key.includes('Time')
          );
          
          if (isOldFormat) {
            // Old format: {'MonShift1Time': 1, 'MonShift2Time': 0, ...}
            fullPerDayShiftTimes = { ...entryData.per_day_data };
          } else {
            // New format: {'Monday': {'Day': 1, 'Swing': 0, 'NOC': 1}, ...}
            const shiftMapping = { 'Day': 'Shift1', 'Swing': 'Shift2', 'NOC': 'Shift3' };
            const dayMapping = {
              'Monday': 'Mon', 'Tuesday': 'Tues', 'Wednesday': 'Wed', 'Thursday': 'Thurs',
              'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun'
            };
            
            Object.entries(entryData.per_day_data).forEach(([day, shiftData]) => {
              if (typeof shiftData === 'object' && shiftData !== null) {
                Object.entries(shiftData).forEach(([shiftName, freq]) => {
                  const shiftKey = shiftMapping[shiftName];
                  const dayPrefix = dayMapping[day];
                  if (shiftKey && dayPrefix) {
                    fullPerDayShiftTimes[`${dayPrefix}${shiftKey}Time`] = Number(freq) || 0;
                  }
                });
              }
            });
          }
        }
        
        // Initialize all day/shift combinations to 0 if not present
        days.forEach((day, dayIdx) => {
          const prefix = dayPrefixes[dayIdx];
          shifts.forEach(shift => {
            const field = `${prefix}${shift.key}Time`;
            if (!(field in fullPerDayShiftTimes)) {
              fullPerDayShiftTimes[field] = 0;
            }
          });
        });
        
        // Update form data with complete per_day_data
        setAdlEntryForm({
          minutes: entryData.minutes_per_occurrence || existingEntry.minutes || '',
          per_day_shift_times: fullPerDayShiftTimes
        });
        
        console.log('✅ Form data updated with per_day_shift_times:', fullPerDayShiftTimes);
      } catch (err) {
        console.error('❌ Error fetching entry data:', err);
        setAdlEntryError(err.response?.data?.detail || 'Failed to load entry data. Please try again.');
      }
    };
    
    fetchFullEntry();
  };

  const renderSelectedFacilityPanel = () => {
    if (!selectedFacility) {
      return (
        <Alert severity="info">
          Select a facility above to see contact information, quick actions, and ADL tools for that location.
        </Alert>
      );
    }

    if (!selectedFacilityData) {
      return (
        <Alert severity="warning">
          Loading facility details. Please wait a moment or choose another facility.
        </Alert>
      );
    }

    return (
      <Card sx={{ mb: 1.5 }}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 1.5,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5, display: 'block' }}>
                Facility
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 18, mb: selectedSection ? 1 : 0 }}>
                {selectedFacilityData.name}
              </Typography>
              {(() => {
                // Calculate total weekly hours for all residents in the facility
                // Note: residents are already filtered by selectedFacility when fetched
                let totalFacilityHours = 0;
                residents.forEach(resident => {
                  const residentAdls = adlsByResident[resident.id] || [];
                  const { totalWeeklyHours } = calculateAcuityMetrics(residentAdls, adlQuestions);
                  totalFacilityHours += totalWeeklyHours;
                });
                
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                    {totalFacilityHours > 0 && (
                      <Typography variant="body2" sx={{ color: '#1976d2', fontSize: 14, fontWeight: 600 }}>
                        Total: {totalFacilityHours.toFixed(1)}h/week
                      </Typography>
                    )}
                    {selectedSection && (
                      <Typography variant="body2" sx={{ color: '#6B7280', fontSize: 14 }}>
                        Current Section: {getCleanSectionName(selectedSection.name)}
                      </Typography>
                    )}
                  </Box>
                );
              })()}
            </Box>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            flexWrap="wrap"
            useFlexGap
          >
            {selectedFacilityData.address && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <LocationIcon sx={{ fontSize: 16 }} color="primary" />
                <Typography variant="body2" sx={{ fontSize: 12 }}>
                  {selectedFacilityData.address}
                  {selectedFacilityData.city && `, ${selectedFacilityData.city}`}
                  {selectedFacilityData.state && `, ${selectedFacilityData.state}`}
                  {selectedFacilityData.zip_code && ` ${selectedFacilityData.zip_code}`}
                </Typography>
              </Box>
            )}

            {selectedFacilityData.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <PhoneIcon sx={{ fontSize: 16 }} color="primary" />
                <Typography variant="body2" sx={{ fontSize: 12 }}>{selectedFacilityData.phone}</Typography>
              </Box>
            )}

            {selectedFacilityData.email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <EmailIcon sx={{ fontSize: 16 }} color="primary" />
                <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>
                  {selectedFacilityData.email}
                </Typography>
              </Box>
            )}
          </Stack>

          {selectedFacilityData.admin_name && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontSize: 12 }}>
              Admin contact: {selectedFacilityData.admin_name}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };


  const handleAdminMenuOpen = (event) => {
    setAdminMenuAnchor(event.currentTarget);
  };

  const handleAdminMenuClose = () => {
    setAdminMenuAnchor(null);
  };

  // Show access request prompt if user has no facility access
  if (!hasFacilityAccess || showAccessRequest) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <Box sx={{ maxWidth: 600, width: '100%' }}>
          <Paper sx={{ mb: 3, p: 3 }}>
            <Typography variant="h5" gutterBottom>
              You don't have access to any facilities yet
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              To get started, please request access to a facility. An administrator will review your request.
            </Typography>
            <Button variant="contained" size="large" sx={{ mt: 2, mr: 2 }} onClick={() => setShowAccessRequest(true)}>
              Request Facility Access
            </Button>
            <Button variant="outlined" color="secondary" size="large" sx={{ mt: 2 }} onClick={onLogout}>
              Logout
            </Button>
          </Paper>
          {showAccessRequest && (
            <FacilityAccessRequest onRequestSubmitted={() => setShowAccessRequest(false)} />
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar sx={{ minHeight: { xs: 40, sm: 48 }, py: 0.5 }}>
          <Typography variant="body2" component="div" sx={{ flexGrow: 1, fontWeight: 600, fontSize: { xs: 13, sm: 14 } }}>
            Brighton Care Group - Acuity Based Staffing Tool
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <>
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
                  onClick={handleAdminMenuOpen}
                  sx={{ fontSize: 12, py: 0.5, minHeight: 'auto' }}
                >
                  Admin
                </Button>
                <Menu
                  anchorEl={adminMenuAnchor}
                  open={Boolean(adminMenuAnchor)}
                  onClose={handleAdminMenuClose}
                >
                  <MenuItem onClick={() => { navigate('/paycom'); handleAdminMenuClose(); }}>
                    <SyncIcon sx={{ mr: 1 }} /> Paycom Sync
                  </MenuItem>
                  <MenuItem onClick={() => { navigate('/admin/access-management'); handleAdminMenuClose(); }}>
                    <AdminPanelSettings sx={{ mr: 1 }} /> Access Management
                  </MenuItem>
                </Menu>
              </>
            )}
            
            <IconButton
              size="medium"
              edge="end"
              color="inherit"
              onClick={handleProfileMenuOpen}
            >
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.main', fontSize: 14 }}>
                {user?.first_name?.[0] || user?.username?.[0] || 'U'}
              </Avatar>
          </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem disabled>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="subtitle2">
              {user?.first_name} {user?.last_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
            {user?.role && (
              <Chip 
                label={user.role} 
                size="small" 
                color="primary" 
                sx={{ mt: 0.5 }}
              />
            )}
          </Box>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <LogoutIcon sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>

      <Container maxWidth={false} sx={{ mt: 1, px: { xs: 1.5, sm: 2 }, pb: 2 }}>
        {/* Guided Wizard - Show only if not completed */}
        {!wizardCompleted ? (
          <Paper sx={{ pt: 1.5, px: 3, pb: 3, mb: 1.5, bgcolor: 'background.paper', maxWidth: 600, mx: 'auto' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Step Indicator */}
            <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: 18 }}>
                  Step {wizardStep + 1} of 3
              </Typography>
                <Box sx={{ mb: 2 }}>
                  {/* Progress bars with labels directly underneath each segment */}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 0.5 }}>
                    {[0, 1, 2].map((step) => (
                      <Box
                        key={step}
                        sx={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.75
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: 4,
                            bgcolor: step <= wizardStep ? 'primary.main' : 'divider',
                            borderRadius: 2,
                            transition: 'background-color 0.3s',
                          }}
                        />
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontSize: 11, 
                            color: step <= wizardStep ? 'text.primary' : '#6B7280',
                            fontWeight: step === wizardStep ? 600 : 400,
                            textAlign: 'center',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {step === 0 && 'Step 1: Facility'}
                          {step === 1 && 'Step 2: Task'}
                          {step === 2 && 'Step 3: Week'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>

              {/* Step 1: Select Facility */}
              {wizardStep === 0 && (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: 20 }}>
                    Select Facility
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 3, fontSize: 14, color: '#6B7280' }}>
                    Which building are you working in today?
                  </Typography>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Facility</InputLabel>
                  <Select
                    value={selectedFacility ?? ''}
                    label="Facility"
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      const facilityId = rawValue === '' ? null : Number(rawValue);
                      const facility = facilities.find((f) => String(f.id) === String(facilityId));
                      handleFacilityChange(facilityId, facility?.name || '');
                    }}
                      size="medium"
                  >
                    <MenuItem value="">
                      <em>All Facilities</em>
                    </MenuItem>
                    {facilities.map((facility) => (
                      <MenuItem key={facility.id} value={facility.id}>
                        {facility.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedFacility && (
                    <Typography variant="body2" sx={{ mb: 3, fontSize: 14, color: '#6B7280' }}>
                      You're working in: <strong>{selectedFacilityName}</strong> today.
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={handleWizardNext}
                      disabled={!selectedFacility}
                      size="large"
                      sx={{ minWidth: 120 }}
                    >
                      Next
                    </Button>
              </Box>
            </Box>
              )}

              {/* Step 2: Choose Task */}
              {wizardStep === 1 && (
            <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: 20 }}>
                    Choose Task
              </Typography>
                  <Typography variant="body2" sx={{ mb: 3, fontSize: 14, color: '#6B7280' }}>
                    What would you like to do?
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                <Button
                  variant={mode === 'adl' ? 'contained' : 'outlined'}
                      size="large"
                  onClick={() => handleModeChange('adl')}
                      sx={{ 
                        minHeight: 100, 
                        fontSize: 16,
                        py: 2.5,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 2,
                        textAlign: 'left',
                        textTransform: 'none'
                      }}
                      fullWidth
                    >
                      <AssignmentTurnedInIcon sx={{ fontSize: 40, flexShrink: 0 }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 18, mb: 0.5 }}>
                  ADL Data Entry
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: 14, mb: 0.5 }}>
                          Enter weekly care tasks for each resident
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontSize: 11, 
                            color: mode === 'adl' ? 'rgba(255, 255, 255, 0.8)' : '#6B7280', 
                            fontStyle: 'italic' 
                          }}
                        >
                          Usually done once per week.
                        </Typography>
                      </Box>
                </Button>
                <Button
                  variant={mode === 'scheduling' ? 'contained' : 'outlined'}
                      size="large"
                  onClick={() => handleModeChange('scheduling')}
                      sx={{ 
                        minHeight: 100, 
                        fontSize: 16,
                        py: 2.5,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 2,
                        textAlign: 'left',
                        textTransform: 'none'
                      }}
                      fullWidth
                    >
                      <CalendarTodayIcon sx={{ fontSize: 40, flexShrink: 0 }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 18, mb: 0.5 }}>
                  Staff Scheduling
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: 14, mb: 0.5 }}>
                          Assign caregivers to shifts
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontSize: 11, 
                            color: mode === 'scheduling' ? 'rgba(255, 255, 255, 0.8)' : '#6B7280', 
                            fontStyle: 'italic' 
                          }}
                        >
                          Use after ADLs are updated.
                        </Typography>
                      </Box>
                </Button>
              </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={handleWizardBack}
                      size="large"
                      sx={{ minWidth: 120 }}
                    >
                      Back
                    </Button>
            </Box>
                </Box>
              )}

              {/* Step 3: Select Week */}
              {wizardStep === 2 && (() => {
                const currentWeekMonday = getCurrentWeekMonday();
                const isCurrentWeek = selectedWeek === currentWeekMonday;
                
                return (
            <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: 20 }}>
                      Select Week
              </Typography>
                    <Typography variant="body2" sx={{ mb: 3, fontSize: 14, color: '#6B7280' }}>
                      Choose the week you want to work with
                    </Typography>
                    
                    {/* Primary Week Selector */}
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1, fontSize: 14 }}>
                          Week
                        </Typography>
                <Button
                  variant="outlined"
                          fullWidth
                          size="large"
                          onClick={(e) => {
                            // Always sync month to the selected week's month when opening
                            if (selectedWeek) {
                              const selectedDate = parseDateString(selectedWeek);
                              setWeekPickerMonth(selectedDate);
                            }
                            setWeekPickerAnchor(e.currentTarget);
                          }}
                          sx={{
                            justifyContent: 'space-between',
                            textTransform: 'none',
                            py: 1.5,
                            px: 2,
                            fontSize: 15
                          }}
                          endIcon={<Typography sx={{ fontSize: 18 }}>▾</Typography>}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarTodayIcon sx={{ fontSize: 20 }} />
                            <Typography>{getWeekLabel(selectedWeek)}</Typography>
                          </Box>
                        </Button>
                        
                        {/* Week Picker Menu */}
                        <Menu
                          anchorEl={weekPickerAnchor}
                          open={Boolean(weekPickerAnchor)}
                          onClose={() => setWeekPickerAnchor(null)}
                          PaperProps={{
                            sx: {
                              p: 2,
                              minWidth: 300,
                              maxWidth: 350
                            }
                          }}
                        >
                          <Box>
                            {/* Month Navigation */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const prevMonth = new Date(weekPickerMonth);
                                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                                  setWeekPickerMonth(prevMonth);
                                }}
                              >
                                ←
                              </IconButton>
                              <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
                                {weekPickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const nextMonth = new Date(weekPickerMonth);
                                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                                  setWeekPickerMonth(nextMonth);
                                }}
                              >
                                →
                              </IconButton>
                            </Box>
                            
                            {/* Week List */}
                            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                              {(() => {
                                // Generate weeks for the displayed month only
                                const year = weekPickerMonth.getFullYear();
                                const month = weekPickerMonth.getMonth();
                                
                                // Find the first Monday of the month (or before if month doesn't start on Monday)
                                const firstDay = new Date(year, month, 1);
                                const firstMonday = new Date(firstDay);
                                const dayOfWeek = firstDay.getDay();
                                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                                firstMonday.setDate(firstDay.getDate() - daysToMonday);
                                
                                // Find the last day of the month
                                const lastDay = new Date(year, month + 1, 0);
                                
                                // Generate weeks, but only include weeks where the Monday falls within the month
                                const weeks = [];
                                let weekStart = new Date(firstMonday);
                                
                                // Generate up to 6 weeks (enough to cover any month)
                                for (let i = 0; i < 6; i++) {
                                  // Only include weeks where the Monday (week start) is within the displayed month
                                  // This ensures December weeks don't show up in November view
                                  if (weekStart.getMonth() === month && weekStart.getFullYear() === year) {
                                    // Format week label
                                    const weekStartString = weekStart.toISOString().split('T')[0];
                                    const weekLabel = getWeekLabel(weekStartString);
                                    
                                    // Check if this week is selected
                                    const isSelected = selectedWeek === weekStartString;
                                    
                                    // Check if this is the current week
                                    const currentWeekMonday = getCurrentWeekMonday();
                                    const isCurrentWeek = weekStartString === currentWeekMonday;
                                    
                                    weeks.push({ 
                                      start: weekStartString, 
                                      label: weekLabel, 
                                      isSelected,
                                      isCurrentWeek
                                    });
                                  }
                                  
                                  // Move to next week
                                  weekStart.setDate(weekStart.getDate() + 7);
                                  
                                  // Stop if we've gone past the month
                                  if (weekStart.getMonth() > month || weekStart.getFullYear() > year) {
                                    break;
                                  }
                                }
                                
                                return weeks.map((week, index) => (
                                  <MenuItem
                                    key={`${week.start}-${index}`}
                                    selected={week.isSelected}
                                    onClick={() => {
                                      setSelectedWeek(week.start);
                                      setWeekPickerAnchor(null);
                                    }}
                                    sx={{
                                      py: 1.5,
                                      fontWeight: week.isCurrentWeek ? 600 : 400,
                                      '&.Mui-selected': {
                                        backgroundColor: 'primary.main',
                                        color: 'white',
                                        '&:hover': {
                                          backgroundColor: 'primary.dark',
                                        }
                                      },
                                      '&:hover': {
                                        backgroundColor: week.isSelected ? 'primary.dark' : 'action.hover',
                                      }
                                    }}
                                  >
                                    {week.isCurrentWeek && week.start !== selectedWeek && '● '}
                                    {week.label}
                                    {week.isCurrentWeek && week.start !== selectedWeek && ' (Current)'}
                                  </MenuItem>
                                ));
                              })()}
                            </Box>
                            
                            {/* Quick Actions */}
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => {
                                  const currentWeekMonday = getCurrentWeekMonday();
                                  setSelectedWeek(currentWeekMonday);
                                  setWeekPickerAnchor(null);
                                  // Update month to current week's month
                                  const currentWeekDate = parseDateString(currentWeekMonday);
                                  setWeekPickerMonth(currentWeekDate);
                                }}
                                sx={{ textTransform: 'none', fontSize: 12 }}
                              >
                                Today
                              </Button>
                            </Box>
                          </Box>
                        </Menu>
                      </Box>
                      
                      {/* Link-style navigation */}
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Button
                          variant="text"
                  size="small"
                  onClick={() => {
                    const currentMonday = new Date(selectedWeek);
                    currentMonday.setDate(currentMonday.getDate() - 7);
                    setSelectedWeek(currentMonday.toISOString().split('T')[0]);
                  }}
                          sx={{ textTransform: 'none', fontSize: 13 }}
                >
                          Previous week
                </Button>
                <Button
                          variant="text"
                  size="small"
                  onClick={() => {
                    const currentMonday = new Date(selectedWeek);
                    currentMonday.setDate(currentMonday.getDate() + 7);
                    setSelectedWeek(currentMonday.toISOString().split('T')[0]);
                  }}
                          sx={{ textTransform: 'none', fontSize: 13 }}
                >
                          Next week
                </Button>
                        {!isCurrentWeek && (
                <Button
                            variant="text"
                  size="small"
                  onClick={() => {
                    setSelectedWeek(currentWeekMonday);
                  }}
                            sx={{ textTransform: 'none', fontSize: 13 }}
                >
                            Jump to current week
                </Button>
                        )}
                      </Box>
                      
                      {/* Contextual Alert */}
                      {hasADLDataForWeek ? (
                        <Alert severity="success" sx={{ textAlign: 'left' }}>
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            ADL data already exists for this week. You can review or update it.
                </Typography>
                        </Alert>
                      ) : (
                        <Alert severity="info" sx={{ textAlign: 'left' }}>
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            You're about to work on: <strong>{getWeekLabel(selectedWeek)}</strong>
                          </Typography>
                        </Alert>
                      )}
              </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Button
                        variant="outlined"
                        onClick={handleWizardBack}
                        size="large"
                        sx={{ minWidth: 120 }}
                      >
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleWizardContinue}
                        size="large"
                        sx={{ minWidth: 160 }}
                      >
                        {mode === 'adl' ? 'Start ADL Entry' : mode === 'scheduling' ? 'Open Schedule' : 'Continue'}
                      </Button>
            </Box>
                  </Box>
                );
              })()}
          </Box>
        </Paper>
        ) : (
          /* Quick Access Bar - Show after wizard is completed */
          <Paper sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip 
                  label={`Facility: ${selectedFacilityName || 'All'}`} 
                  color="primary" 
                  variant="outlined"
                />
                <Chip 
                  label={`Task: ${mode === 'adl' ? 'ADL Data Entry' : mode === 'scheduling' ? 'Staff Scheduling' : 'Not Selected'}`} 
                  color="secondary" 
                  variant="outlined"
                />
                <Chip 
                  label={`Week: ${getWeekLabel(selectedWeek)}`} 
                  color="default" 
                  variant="outlined"
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  style={{ display: 'none' }}
                  id="csv-import-input"
                />
                <label htmlFor="csv-import-input">
                  <Button
                    component="span"
                    variant="outlined"
                    size="small"
                    startIcon={<CloudUploadIcon />}
                    disabled={importingCSV || !selectedFacility || !selectedWeek || mode !== 'adl'}
                    sx={{ textTransform: 'none' }}
                  >
                    {importingCSV ? 'Importing...' : 'Import CSV'}
                  </Button>
                </label>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setWizardCompleted(false);
                    setWizardStep(0);
                  }}
                >
                  Change Selection
                </Button>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Main Content Area - Only show after wizard is completed */}
        {wizardCompleted && (
          <>
        {mode === 'adl' ? (
          <Box>
            {/* Caregiving Summary Chart - Analytics Area */}
            <CaregivingSummaryChart 
              key={`main-chart-${selectedFacility}-${selectedWeek}-${chartRefreshKey}`}
              title="Caregiving Time Summary"
              weekLabel={getWeekLabel(selectedWeek)}
              facilityName={selectedFacility ? selectedFacilityName : null}
              endpoint={selectedFacility ? `${API_BASE_URL}/api/facilities/${typeof selectedFacility === 'object' ? selectedFacility.id : selectedFacility}/caregiving_summary/` : null}
              queryParams={{ 
                week_start_date: selectedWeek,
                _refresh: chartRefreshKey  // Force refresh by including refresh key in params
              }}
            />
            
            {/* Week Summary Card */}
            <Paper sx={{
              backgroundColor: hasADLDataForWeek ? '#F3FFF5' : '#FFFFFF',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              p: 2.5,
              mb: 1.5
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                {hasADLDataForWeek ? (
                  <CheckCircleIcon sx={{ color: '#10B981', fontSize: 20 }} />
                ) : (
                  <CalendarTodayIcon sx={{ color: '#3B82F6', fontSize: 20 }} />
                )}
                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 15 }}>
                  Week Summary ({getWeekLabel(selectedWeek)})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ fontSize: 13, color: '#374151', flex: 1 }}>
                  {hasADLDataForWeek
                    ? 'ADL data exists for this week. You can review or update it.'
                    : `You're about to work on: ${getWeekLabel(selectedWeek)}`}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {!hasADLDataForWeek && selectedFacility && (
                    <Button
                      type="button"
                      variant="outlined"
                      size="small"
                      startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
                      onClick={handleCopyPreviousWeek}
                      disabled={copyingPreviousWeek}
                      sx={{ fontSize: 12 }}
                    >
                      {copyingPreviousWeek ? 'Copying...' : 'Keep Same as Previous Week'}
                    </Button>
                  )}
                  {hasADLDataForWeek && selectedFacility && (
                    <Button
                      type="button"
                      variant="contained"
                      size="small"
                      onClick={() => navigate(`/weekly-adl-entry?week=${selectedWeek}&facility=${selectedFacility}`)}
                      sx={{ fontSize: 12 }}
                    >
                      Review ADLs
                    </Button>
                  )}
                </Box>
              </Box>
            </Paper>

            {/* ADL Data Entry Content - Primary Work Area */}
            <Paper sx={{ p: 1.5, mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, fontSize: 18 }}>
                Residents & ADL Data
              </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {renderSelectedFacilityPanel()}
                  {selectedFacility && renderSectionsAndResidents()}
                </Box>
            </Paper>
          </Box>
        ) : mode === 'scheduling' ? (
          /* Scheduling Mode */
          <SchedulingDashboard 
            key={`scheduling-${selectedFacility}-${selectedWeek}`}
            user={user} 
            initialFacilityId={selectedFacility} 
            initialFacilityName={selectedFacilityName} 
          />
        ) : (
          /* Admin Tools Mode */
          <Paper sx={{ mt: 1.5, p: 1.5 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5, fontSize: 14 }}>
              Admin Tools
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SyncIcon sx={{ fontSize: 18 }} />}
                onClick={() => navigate('/paycom')}
                sx={{ py: 0.75, justifyContent: 'flex-start', fontSize: 13 }}
              >
                Paycom Sync
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AdminPanelSettings sx={{ fontSize: 18 }} />}
                onClick={() => navigate('/admin/access-management')}
                sx={{ py: 0.75, justifyContent: 'flex-start', fontSize: 13 }}
              >
                Access Management
              </Button>
            </Box>
          </Paper>
        )}
          </>
        )}
      </Container>

      {/* Back to Top Button */}
      {showBackToTop && (
        <IconButton
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            bgcolor: 'primary.main',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            '&:hover': {
              bgcolor: 'primary.dark',
              boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
            },
            zIndex: 1000,
          }}
          aria-label="Back to top"
        >
          <ArrowUpwardIcon />
        </IconButton>
      )}
      
      {/* Add Section Dialog */}
      <Dialog open={sectionDialogOpen} onClose={() => { setSectionDialogOpen(false); setSectionForm({ name: '' }); setSectionError(''); }} maxWidth="sm" fullWidth>
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
            autoFocus
            sx={{ mt: 2 }}
          />
          {sectionError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {sectionError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSectionDialogOpen(false); setSectionForm({ name: '' }); setSectionError(''); }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSectionAdd}>
            Add Section
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Resident Dialog */}
      <Dialog 
        open={residentDialogOpen} 
        onClose={() => { 
          setResidentDialogOpen(false); 
          setResidentForm({ name: '', status: 'Active' }); 
          setResidentError(''); 
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Add Resident</DialogTitle>
        <DialogContent>
          <TextField
            margin="normal"
            fullWidth
            label="Resident Name"
            name="name"
            value={residentForm.name}
            onChange={(e) => {
              setResidentForm({ ...residentForm, name: e.target.value });
              setResidentError('');
            }}
            required
            autoFocus
            sx={{ mt: 2 }}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={residentForm.status}
              label="Status"
              onChange={(e) => {
                setResidentForm({ ...residentForm, status: e.target.value });
              }}
            >
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="New">New</MenuItem>
              <MenuItem value="Discharged">Discharged</MenuItem>
            </Select>
          </FormControl>
          {selectedSection && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This resident will be added to: <strong>{getCleanSectionName(selectedSection.name)}</strong>
            </Alert>
          )}
          {residentError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {residentError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { 
            setResidentDialogOpen(false); 
            setResidentForm({ name: '', status: 'Active' }); 
            setResidentError(''); 
          }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddResident} disabled={!residentForm.name.trim() || !selectedSection}>
            Add Resident
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add ADL Entry Dialog */}
      {addingADLForQuestion && (() => {
        const resident = residents.find(r => r.id === addingADLForQuestion.residentId);
        const question = adlQuestions.find(q => q.id === addingADLForQuestion.questionId);
        const calculatedFrequency = calculateFrequency(adlEntryForm.per_day_shift_times);
        const calculatedMinutes = Number(adlEntryForm.minutes) || 0;
        const totalTime = calculatedMinutes * calculatedFrequency;
        
        return (
          <Dialog
            open={!!addingADLForQuestion}
            onClose={() => {
              setAddingADLForQuestion(null);
              setEditingADLEntryId(null);
              setAdlEntryForm({ minutes: '', per_day_shift_times: {} });
              setAdlEntryError('');
            }}
            maxWidth={false}
            PaperProps={{
              sx: { width: '700px', maxWidth: '90vw' }
            }}
          >
            <DialogTitle>{question ? `ADL: ${question.text || question.question_text}` : 'Add ADL Data'}</DialogTitle>
            <DialogContent>
              <TextField
                margin="normal"
                fullWidth
                label="Minutes *"
                name="minutes"
                type="number"
                value={adlEntryForm.minutes}
                onChange={(e) => setAdlEntryForm({ ...adlEntryForm, minutes: e.target.value })}
                required
                autoFocus
                inputProps={{ min: 0, step: 1 }}
              />
              
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Frequency: <strong>{calculatedFrequency}</strong> {calculatedFrequency === 1 ? 'time' : 'times'} per week
                </Typography>
                <Typography variant="body2" sx={{ color: '#777', fontSize: 13 }}>
                  Total Time: <strong>{totalTime}</strong> minutes
                </Typography>
              </Box>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  How many times is this activity performed for each day/shift below?
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Each cell = number of times this activity is performed during that shift. Total time = number of times × minutes per event.
                </Typography>
                
                {/* Quick Fill Templates */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>Quick Fill Templates:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('all_mornings_weekdays')} sx={{ fontSize: '0.75rem' }}>
                      All Mornings (Weekdays)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('all_evenings_weekdays')} sx={{ fontSize: '0.75rem' }}>
                      All Evenings (Weekdays)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('all_nights_weekdays')} sx={{ fontSize: '0.75rem' }}>
                      All Nights (Weekdays)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('all_mornings_weekend')} sx={{ fontSize: '0.75rem' }}>
                      All Mornings (Weekend)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('all_evenings_weekend')} sx={{ fontSize: '0.75rem' }}>
                      All Evenings (Weekend)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('all_nights_weekend')} sx={{ fontSize: '0.75rem' }}>
                      All Nights (Weekend)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('all_mornings_7days')} sx={{ fontSize: '0.75rem' }}>
                      All Mornings (7 Days)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('all_evenings_7days')} sx={{ fontSize: '0.75rem' }}>
                      All Evenings (7 Days)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('all_nights_7days')} sx={{ fontSize: '0.75rem' }}>
                      All Nights (7 Days)
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('weekdays_only')} sx={{ fontSize: '0.75rem' }}>
                      Weekdays Only
                    </Button>
                    <Button size="small" variant="contained" onClick={() => applyBulkTemplate('full_week')} sx={{ fontSize: '0.75rem' }}>
                      Full Week
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyBulkTemplate('clear_all')} sx={{ fontSize: '0.75rem' }}>
                      Clear All
                    </Button>
                  </Box>
                </Box>
                
                {/* Day/Shift Frequency Table */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Day</TableCell>
                        {shifts.map((shift, shiftIdx) => (
                          <TableCell 
                            key={shift.key} 
                            align="center"
                            sx={{ 
                              fontWeight: 600,
                              fontSize: 14,
                              bgcolor: shiftIdx === 0 || shiftIdx === 2 ? '#f9fbff' : '#ffffff'
                            }}
                          >
                            {shift.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {days.map((day, dayIdx) => (
                        <TableRow 
                          key={day}
                          sx={{ borderBottom: '1px solid #ececec' }}
                        >
                          <TableCell>{day}</TableCell>
                          {shifts.map((shift, shiftIdx) => {
                            const prefix = dayPrefixes[dayIdx];
                            const field = `${prefix}${shift.key}Time`;
                            return (
                              <TableCell 
                                key={shift.key} 
                                align="center"
                                sx={{ 
                                  bgcolor: shiftIdx === 0 || shiftIdx === 2 ? '#f9fbff' : '#ffffff'
                                }}
                              >
                                <TextField
                                  type="number"
                                  size="small"
                                  value={adlEntryForm.per_day_shift_times[field] || ''}
                                  onChange={(e) => {
                                    const newPerDayShiftTimes = {
                                      ...adlEntryForm.per_day_shift_times,
                                      [field]: e.target.value === '' ? '' : Number(e.target.value)
                                    };
                                    setAdlEntryForm({
                                      ...adlEntryForm,
                                      per_day_shift_times: newPerDayShiftTimes
                                    });
                                  }}
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
              
              {adlEntryError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {adlEntryError}
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button
                onClick={() => {
                  setAddingADLForQuestion(null);
                  setEditingADLEntryId(null);
                  setAdlEntryForm({ minutes: '', per_day_shift_times: {} });
                  setAdlEntryError('');
                }}
                disabled={savingADLEntry}
                sx={{ flex: 0 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveADLEntry}
                disabled={!adlEntryForm.minutes || calculatedFrequency === 0 || savingADLEntry}
                sx={{ 
                  flex: 1,
                  bgcolor: '#2563eb',
                  '&:hover': {
                    bgcolor: '#1e40af'
                  }
                }}
              >
                {savingADLEntry ? 'Saving...' : editingADLEntryId ? 'Save Changes' : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>
        );
      })()}
    </Box>
  );
};

export default Dashboard; 