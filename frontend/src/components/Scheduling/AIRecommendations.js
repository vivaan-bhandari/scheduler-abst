import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  Tooltip,
} from '@mui/material';
import { 
  PlayArrow as PlayArrowIcon,
  AccessTime as ClockIcon,
  Badge as BadgeIcon,
  AttachMoney as DollarIcon,
  CheckCircle as CheckIcon,
  LocalHospital as MedTechIcon,
  Person as CaregiverIcon,
  HealthAndSafety as RNIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { useWeek } from '../../contexts/WeekContext';

const AIRecommendations = ({ facilityId, onRecommendationsApplied, currentWeek, refreshTrigger, onRecommendationsLoaded }) => {
  const { selectedWeek, getWeekLabel } = useWeek();
  
  // Use the currentWeek from the planner grid if provided, otherwise fall back to selectedWeek
  const effectiveWeek = currentWeek || selectedWeek;
  
  console.log('🔍 AIRecommendations: Week sources:', {
    currentWeek,
    selectedWeek,
    effectiveWeek
  });
  const [recommendations, setRecommendations] = useState([]);
  const [noDataMessage, setNoDataMessage] = useState('');
  const [facilityInsights, setFacilityInsights] = useState({
    total_residents: 0,
    total_care_hours: 0,
    avg_acuity_score: 0,
    staffing_efficiency: 0,
    low_acuity_count: 0,
    medium_acuity_count: 0,
    high_acuity_count: 0,
  });
  const [facility, setFacility] = useState(null); // Store facility data to determine shift format
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyingCell, setApplyingCell] = useState(null); // Track which cell is being applied
  const [viewMode, setViewMode] = useState(0);
  const [analysisType, setAnalysisType] = useState('weekly');
  const [notification, setNotification] = useState(null);

  // Get shift types based on facility format
  const getShiftTypes = () => {
    if (facility?.shift_format === '2_shift') {
      return ['day', 'noc']; // 2-shift: Day and NOC only (no Swing)
    }
    return ['day', 'swing', 'noc']; // 3-shift: Day, Swing, and NOC
  };

  useEffect(() => {
    if (facilityId) {
      fetchFacility();
      fetchFacilityInsights();
      // Automatically fetch recommendations when facility or week changes
      fetchWeeklyRecommendations();
    }
  }, [facilityId, effectiveWeek, refreshTrigger]); // Added refreshTrigger to dependencies

  const fetchFacility = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/facilities/${facilityId}/`);
      setFacility(response.data);
    } catch (error) {
      console.error('Error fetching facility:', error);
    }
  };

  const fetchFacilityInsights = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/scheduling/ai-insights/?facility=${facilityId}`);
      setFacilityInsights(response.data);
    } catch (error) {
      console.error('Error fetching facility insights:', error);
    }
  };

  const fetchWeeklyRecommendations = async () => {
    console.log('🔍 AIRecommendations: fetchWeeklyRecommendations called');
    console.log('🔍 AIRecommendations: facilityId:', facilityId);
    console.log('🔍 AIRecommendations: effectiveWeek:', effectiveWeek);
    console.log('🔍 AIRecommendations: weekStart:', effectiveWeek); // effectiveWeek is already the Monday date
    
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/api/scheduling/ai-recommendations/calculate_from_adl/?facility=${facilityId}&week_start=${effectiveWeek}`;
      console.log('🔍 AIRecommendations: Making request to:', url);
      
      const response = await axios.get(url);
      console.log('🔍 AIRecommendations: Response status:', response.status);
      console.log('🔍 AIRecommendations: Response data:', response.data);
      
      if (response.data.recommendations) {
        setRecommendations(response.data.recommendations);
        setNoDataMessage(''); // Clear any previous no-data message
        
        // Notify parent that recommendations are loaded
        if (onRecommendationsLoaded) {
          onRecommendationsLoaded(response.data.recommendations.length > 0);
        }
        
        // Update facility insights with real data
        if (response.data.care_intensity) {
          setFacilityInsights(prev => ({
            ...prev,
            low_acuity_count: response.data.care_intensity.low_acuity_count || 0,
            medium_acuity_count: response.data.care_intensity.medium_acuity_count || 0,
            high_acuity_count: response.data.care_intensity.high_acuity_count || 0,
            total_care_hours: response.data.weekly_summary?.total_care_hours || 0,
          }));
        }
      } else if (response.data.message) {
        // Handle case when there's no data
        setRecommendations([]);
        setNoDataMessage(response.data.message);
        if (onRecommendationsLoaded) {
          onRecommendationsLoaded(false);
        }
        setFacilityInsights(prev => ({
          ...prev,
          low_acuity_count: 0,
          medium_acuity_count: 0,
          high_acuity_count: 0,
          total_care_hours: 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffingAnalysis = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/scheduling/staffing-analysis/?facility=${facilityId}&date=${effectiveWeek}`);
      setRecommendations(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching staffing analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday = 1
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().split('T')[0];
  };

  // Helper function to parse date string (YYYY-MM-DD) without timezone conversion
  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed, creates local date
  };

  // Helper function to format date as YYYY-MM-DD string
  const formatDateString = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekDays = () => {
    // effectiveWeek should be a Monday date string (YYYY-MM-DD)
    if (!effectiveWeek) return [];
    
    // Parse week start date string (YYYY-MM-DD) without timezone conversion
    const startDate = parseDateString(effectiveWeek);
    
    if (!startDate) return [];
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    
    // Debug logging
    console.log('🔍 AIRecommendations getWeekDays: effectiveWeek=', effectiveWeek, 'days=', days.map(d => formatDateString(d)));
    
    return days;
  };

  const handleRefreshAnalysis = () => {
    if (analysisType === 'weekly') {
      fetchWeeklyRecommendations();
    } else {
      fetchStaffingAnalysis();
    }
  };

  const handleApplySingleRecommendation = async (recommendation) => {
    if (!recommendation || !recommendation.suggested_staff || recommendation.suggested_staff.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No staff recommendations available for this shift.'
      });
      return;
    }

    const cellId = `${recommendation.shift_type}-${recommendation.date}`;
    setApplyingCell(cellId);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/scheduling/ai-recommendations/apply_weekly_recommendations/`, {
        facility: facilityId,
        week_start: effectiveWeek,
        recommendations: [{
          date: recommendation.date,
          shift_type: recommendation.shift_type,
          suggested_staff: recommendation.suggested_staff
        }]
      });
      
      setNotification({
        type: 'success',
        message: `Applied recommendations for ${recommendation.shift_type} shift on ${new Date(recommendation.date).toLocaleDateString()}`
      });
      
      if (onRecommendationsApplied) {
        onRecommendationsApplied();
      }
      
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Error applying single recommendation:', error);
      setNotification({
        type: 'error',
        message: error.response?.data?.error || 'Failed to apply recommendation. Please try again.'
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setApplyingCell(null);
    }
  };

  const handleApplyRecommendations = async () => {
    if (recommendations.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No recommendations to apply. Please generate AI recommendations first.'
      });
      return;
    }

    setApplying(true);
    try {
      console.log('🔍 AIRecommendations: Applying recommendations for week:', effectiveWeek);
      console.log('🔍 AIRecommendations: Facility ID:', facilityId);
      console.log('🔍 AIRecommendations: Number of recommendations:', recommendations.length);
      
      // Prepare recommendations with suggested_staff for backend
      const recommendationsWithStaff = recommendations.map(rec => {
        const staffList = rec.suggested_staff || [];
        console.log('🔍 AIRecommendations: Recommendation for', rec.date, rec.shift_type, 'has', staffList.length, 'suggested staff');
        if (staffList.length > 0) {
          console.log('🔍 AIRecommendations: First staff member:', staffList[0]);
        }
        return {
          date: rec.date,
          shift_type: rec.shift_type,
          suggested_staff: staffList
        };
      });
      
      console.log('🔍 AIRecommendations: Sending', recommendationsWithStaff.length, 'recommendations with suggested_staff to backend');
      
      const response = await axios.post(`${API_BASE_URL}/api/scheduling/ai-recommendations/apply_weekly_recommendations/`, {
        facility: facilityId,
        week_start: effectiveWeek,
        recommendations: recommendationsWithStaff
      });
      
      console.log('🔍 AIRecommendations: Apply response:', response.data);
      
      const assignmentsMsg = response.data.assignments_created 
        ? ` Assigned ${response.data.assignments_created} staff members.`
        : '';
      setNotification({
        type: 'success',
        message: `Successfully applied AI recommendations! Created ${response.data.shifts_created} new shifts${assignmentsMsg}`
      });
      
      // Trigger refresh in the planner grid
      if (onRecommendationsApplied) {
        console.log('🔍 AIRecommendations: Calling onRecommendationsApplied callback');
        onRecommendationsApplied();
      } else {
        console.log('🔍 AIRecommendations: onRecommendationsApplied callback not provided');
      }
      
      // Clear notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
      
    } catch (error) {
      console.error('Error applying recommendations:', error);
      console.error('Error response:', error.response?.data);
      setNotification({
        type: 'error',
        message: error.response?.data?.error || 'Failed to apply recommendations. Please try again.'
      });
      
      // Clear error notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setApplying(false);
    }
  };

  const getShiftTypeColor = (type) => {
    switch (type) {
      case 'day':
        return '#4caf50';
      case 'swing':
        return '#ff9800';
      case 'noc':
        return '#9c27b0';
      default:
        return '#666';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 85) return '#4caf50';
    if (confidence >= 70) return '#ff9800';
    return '#f44336';
  };

  if (!facilityId) {
    return (
      <Paper sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: 14 }}>
          Please select a facility to view AI recommendations
        </Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Paper sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontSize: 14, mb: 1 }}>
          Loading AI recommendations...
        </Typography>
        <LinearProgress />
      </Paper>
    );
  }

  // Check if selected week has data by looking at recommendations
  const hasDataForWeek = recommendations.length > 0 || noDataMessage === '';

  if (!hasDataForWeek && !loading) {
    return (
      <Paper sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography variant="subtitle2" gutterBottom color="warning.main" sx={{ fontSize: 14, mb: 1 }}>
          No AI recommendations available for {getWeekLabel(effectiveWeek)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
          No ADL data available for this week to generate AI recommendations. 
          Please ensure ADL data has been entered for residents in this facility for this week.
        </Typography>
      </Paper>
    );
  }

  const weekDays = getWeekDays();
  const totalRecommendations = recommendations.length || 0;
  const totalCareHours = Number(facilityInsights.total_care_hours || 0).toFixed(1);
  const totalStaffRequired = recommendations.reduce((sum, r) => sum + (r.required_staff || 0), 0);
  const avgConfidence = totalRecommendations > 0
    ? Math.round(recommendations.reduce((sum, r) => sum + (r.confidence || 0), 0) / totalRecommendations)
    : 0;
  const totalWeeklyCost = recommendations.reduce((sum, r) => sum + (r.estimated_cost || 0), 0);

  return (
    <Box sx={{ width: '100%', px: 1, py: 0.5 }}>
      <Stack spacing={0.75}>
        {notification && (
          <Alert
            severity={notification.type}
            onClose={() => setNotification(null)}
            sx={{ mb: 0, py: 0.5 }}
          >
            {notification.message}
          </Alert>
        )}

        {/* Ultra-compact single-line summary bar */}
        <Paper sx={{ p: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Chip label={`L:${facilityInsights.low_acuity_count || 0}`} size="small" sx={{ bgcolor: '#4caf50', color: 'white', height: 20, fontSize: '0.65rem' }} />
              <Chip label={`M:${facilityInsights.medium_acuity_count || 0}`} size="small" sx={{ bgcolor: '#ff9800', color: 'white', height: 20, fontSize: '0.65rem' }} />
              <Chip label={`H:${facilityInsights.high_acuity_count || 0}`} size="small" sx={{ bgcolor: '#f44336', color: 'white', height: 20, fontSize: '0.65rem' }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#2196f3', fontSize: '0.85rem', display: 'block' }}>{totalRecommendations}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#666' }}>Recs</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#388e3c', fontSize: '0.85rem', display: 'block' }}>{totalCareHours}h</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#666' }}>Hours</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '0.85rem', display: 'block' }}>{totalStaffRequired}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#666' }}>Staff</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#f57c00', fontSize: '0.85rem', display: 'block' }}>{totalWeeklyCost > 0 ? `$${parseFloat(totalWeeklyCost).toFixed(2)}` : '—'}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#666' }}>Cost</Typography>
              </Box>
            </Box>
            <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={fetchWeeklyRecommendations} disabled={loading} sx={{ fontSize: '0.7rem', py: 0.25, px: 1, minWidth: 'auto' }}>
              Refresh
            </Button>
          </Box>
        </Paper>

        {/* Compact table header with action button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
            {getWeekLabel(effectiveWeek)}
          </Typography>
          <Button
            variant="contained"
            color="success"
            size="small"
            onClick={handleApplyRecommendations}
            disabled={applying || recommendations.length === 0}
            sx={{ fontSize: '0.7rem', py: 0.25, px: 1, minWidth: 'auto' }}
          >
            {applying ? 'Applying...' : 'Apply All'}
          </Button>
        </Box>

        <Paper sx={{ p: 0.25, maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
        {recommendations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No AI recommendations available.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {noDataMessage || 'This facility has no resident data or ADL care requirements. AI recommendations require actual facility data to calculate staffing needs.'}
            </Typography>
          </Box>
        ) : (
          <>
            {/* Weekly Calendar Grid */}
            <Box sx={{ overflowX: 'auto', overflowY: 'visible' }}>
              <Box sx={{ 
                minWidth: 1000, 
                width: '100%',
                tableLayout: 'fixed'
              }}>
                <Box sx={{ 
                  display: 'table',
                  width: '100%',
                  borderCollapse: 'collapse'
                }}>
                  {/* Header Row */}
                  <Box sx={{ display: 'table-row' }}>
                    <Box sx={{ 
                      display: 'table-cell',
                      width: '90px',
                      p: 0.5, 
                      borderBottom: 1, 
                      borderRight: 1, 
                      borderColor: '#e0e0e0', 
                      bgcolor: '#f5f5f5',
                      textAlign: 'center',
                      verticalAlign: 'middle'
                    }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.7rem' }}>
                        Shifts
                      </Typography>
                    </Box>
                    {weekDays.map((day) => {
                      const dayStr = formatDateString(day);
                      return (
                      <Box key={dayStr} sx={{ 
                        display: 'table-cell',
                        width: '105px',
                        p: 0.4, 
                        borderBottom: 1, 
                        borderRight: 1, 
                        borderColor: '#e0e0e0', 
                        bgcolor: '#f5f5f5', 
                        textAlign: 'center',
                        verticalAlign: 'middle'
                      }}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#333', display: 'block', fontSize: '0.65rem', lineHeight: 1.2 }}>
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </Typography>
                        <Typography variant="caption" color="#666" sx={{ fontSize: '0.6rem' }}>
                          {day.getDate()}/{day.getMonth() + 1}
                        </Typography>
                      </Box>
                    )})}
                  </Box>

                  {/* Shift Rows */}
                  {getShiftTypes().map((shiftType) => (
                    <Box key={shiftType} sx={{ display: 'table-row' }}>
                      <Box sx={{ 
                        display: 'table-cell',
                        width: '90px',
                        p: 0.5, 
                        borderBottom: 1, 
                        borderRight: 1, 
                        borderColor: '#e0e0e0', 
                        bgcolor: '#fafafa',
                        verticalAlign: 'middle'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, justifyContent: 'center' }}>
                          <Box
                            sx={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              bgcolor: getShiftTypeColor(shiftType),
                            }}
                          />
                          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.7rem' }}>
                            {shiftType.toUpperCase()}
                          </Typography>
                        </Box>
                      </Box>
                      {weekDays.map((day) => {
                        // Format day as YYYY-MM-DD for comparison (avoid timezone issues)
                        const dayStr = formatDateString(day);
                        const recommendation = recommendations.find(r => {
                          // Compare date strings directly to avoid timezone conversion issues
                          const recDateStr = r.date ? (r.date.split('T')[0] || r.date) : null;
                          return recDateStr === dayStr && r.shift_type === shiftType;
                        });
                        
                        // Calculate coverage percentage based on suggested staff vs required
                        let coveragePercentage = 100;
                        if (recommendation) {
                          const suggestedCount = recommendation.suggested_staff?.length || 0;
                          const requiredCount = recommendation.required_staff || 1;
                          coveragePercentage = Math.min(100, Math.round((suggestedCount / requiredCount) * 100));
                        }
                        
                        // Use pale blue background for AI-recommended blocks
                        let bgColor = '#f9f9f9';
                        if (recommendation) {
                          bgColor = '#e3f2fd'; // pale blue for AI recommendations
                        }
                        
                        return (
                          <Box key={`${shiftType}-${formatDateString(day)}`} sx={{ 
                            display: 'table-cell',
                            width: '105px',
                            p: 0.5, 
                            borderBottom: 1, 
                            borderRight: 1, 
                            borderColor: '#e0e0e0',
                            bgcolor: bgColor,
                            textAlign: 'center',
                            verticalAlign: 'top',
                            position: 'relative'
                          }}>
                            {recommendation ? (
                              <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
                                {/* Top line: Staff needed (big, bold) with icon */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                  <BadgeIcon sx={{ fontSize: 14, color: '#1976d2' }} />
                                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#333', lineHeight: 1.2, fontSize: '0.8rem' }}>
                                    {recommendation.required_staff} staff needed
                                </Typography>
                                </Box>
                                
                                {/* Second line: Hours and cost with icons */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
                                    <ClockIcon sx={{ fontSize: 11, color: '#666' }} />
                                    <Typography variant="caption" sx={{ color: '#666', fontSize: '0.65rem', lineHeight: 1.2 }}>
                                      {parseFloat(recommendation.care_hours).toFixed(1)}h
                                  </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
                                    <DollarIcon sx={{ fontSize: 11, color: '#666' }} />
                                    <Typography variant="caption" sx={{ color: '#666', fontSize: '0.65rem', lineHeight: 1.2 }}>
                                      ${recommendation.estimated_cost ? parseFloat(recommendation.estimated_cost).toFixed(2) : '0.00'}
                                    </Typography>
                                  </Box>
                                </Box>
                                
                                {/* Third line: Role chips with icons and colors */}
                                {recommendation.role_requirements && (
                                  <Box sx={{ display: 'flex', gap: 0.3, justifyContent: 'center', mb: 0.2 }}>
                                    {recommendation.role_requirements.med_tech > 0 && (
                                      <Tooltip title="MedTech" arrow>
                                      <Chip 
                                        icon={<MedTechIcon sx={{ fontSize: 10, color: 'white' }} />}
                                        label={`${recommendation.role_requirements.med_tech}MT`}
                                        size="small"
                                        sx={{ 
                                          height: 18,
                                          fontSize: '0.65rem',
                                          bgcolor: '#3b82f6',
                                          color: 'white',
                                          fontWeight: '600',
                                          border: '1px solid #2563eb',
                                          '& .MuiChip-icon': {
                                            color: 'white',
                                            fontSize: 10
                                          },
                                          '& .MuiChip-label': { px: 0.5 }
                                        }}
                                      />
                                      </Tooltip>
                                    )}
                                    {recommendation.role_requirements.caregiver > 0 && (
                                      <Tooltip title="Caregiver" arrow>
                                      <Chip 
                                        icon={<CaregiverIcon sx={{ fontSize: 10, color: 'white' }} />}
                                        label={`${recommendation.role_requirements.caregiver}CG`}
                                        size="small"
                                        sx={{ 
                                          height: 18,
                                          fontSize: '0.65rem',
                                          bgcolor: '#059669',
                                          color: 'white',
                                          fontWeight: '600',
                                          border: '1px solid #047857',
                                          '& .MuiChip-icon': {
                                            color: 'white',
                                            fontSize: 10
                                          },
                                          '& .MuiChip-label': { px: 0.5 }
                                        }}
                                      />
                                      </Tooltip>
                                    )}
                                  </Box>
                                )}
                                
                                {/* Fourth line: Recommended count and percentage */}
                                {recommendation.suggested_staff && recommendation.suggested_staff.length > 0 && (
                                  <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.3, alignItems: 'center' }}>
                                    <Typography
                                      component="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const dayStr = formatDateString(day);
                                        const cellId = `${shiftType}-${dayStr}-staff`;
                                        const element = document.getElementById(cellId);
                                        if (element) {
                                          element.style.display = element.style.display === 'none' ? 'block' : 'none';
                                        }
                                      }}
                                      sx={{ 
                                        fontSize: '0.6rem',
                                        color: '#1976d2',
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: 'none',
                                        textDecoration: 'underline',
                                        '&:hover': { color: '#1565c0' },
                                        fontWeight: 500
                                      }}
                                    >
                                      {recommendation.suggested_staff.length} recommended · {coveragePercentage}%
                                    </Typography>
                                    
                                    {/* Apply button for this cell */}
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="primary"
                                      startIcon={applyingCell === `${shiftType}-${formatDateString(day)}` ? <CircularProgress size={12} sx={{ color: 'white' }} /> : <CheckIcon sx={{ fontSize: 12 }} />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleApplySingleRecommendation(recommendation);
                                      }}
                                      disabled={applyingCell === `${shiftType}-${formatDateString(day)}` || applying}
                                      sx={{
                                        fontSize: '0.6rem',
                                        py: 0.25,
                                        px: 1,
                                        minWidth: 'auto',
                                        height: 20,
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        '& .MuiButton-startIcon': {
                                          marginRight: 0.3,
                                          marginLeft: 0
                                        }
                                      }}
                                    >
                                      Apply
                                    </Button>
                                    <Box 
                                      id={`${shiftType}-${formatDateString(day)}-staff`}
                                      sx={{ 
                                        display: 'none',
                                        mt: 0.3,
                                        p: 0.4,
                                        bgcolor: '#fafafa',
                                        borderRadius: 0.5,
                                        border: '1px solid #e0e0e0',
                                        maxHeight: 70,
                                        overflowY: 'auto',
                                        fontSize: '0.55rem'
                                      }}
                                    >
                                      {recommendation.suggested_staff.map((staff, idx) => {
                                        // Determine role badge color and icon
                                        const role = staff.role || 'caregiver';
                                        const roleConfig = {
                                          'med_tech': { color: '#3b82f6', bg: '#dbeafe', icon: <MedTechIcon sx={{ fontSize: 10 }} />, label: 'MT' },
                                          'caregiver': { color: '#059669', bg: '#d1fae5', icon: <CaregiverIcon sx={{ fontSize: 10 }} />, label: 'CG' },
                                          'rn': { color: '#8b5cf6', bg: '#ede9fe', icon: <RNIcon sx={{ fontSize: 10 }} />, label: 'RN' },
                                        };
                                        const roleInfo = roleConfig[role] || roleConfig['caregiver'];
                                        
                                        return (
                                        <Box key={idx} sx={{ 
                                          display: 'flex', 
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          mb: 0.15,
                                            fontSize: '0.55rem',
                                            gap: 0.3
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flex: 1 }}>
                                              {/* Role Badge */}
                                              <Chip
                                                icon={roleInfo.icon}
                                                label={roleInfo.label}
                                                size="small"
                                                sx={{
                                                  height: 14,
                                                  fontSize: '0.5rem',
                                                  bgcolor: roleInfo.bg,
                                                  color: roleInfo.color,
                                                  fontWeight: '600',
                                                  border: `1px solid ${roleInfo.color}40`,
                                                  '& .MuiChip-icon': {
                                                    color: roleInfo.color,
                                                    fontSize: 8
                                                  },
                                                  '& .MuiChip-label': {
                                                    px: 0.3
                                                  }
                                                }}
                                              />
                                              <Typography variant="caption" sx={{ color: '#333', fontSize: '0.55rem', lineHeight: 1.2, textAlign: 'left' }}>
                                            {staff.name}
                                          </Typography>
                                            </Box>
                                            <Typography variant="caption" sx={{ color: '#666', fontSize: '0.5rem', flexShrink: 0 }}>
                                            ${staff.rate ? parseFloat(staff.rate).toFixed(2) : 'N/A'}
                                          </Typography>
                                        </Box>
                                        );
                                      })}
                                    </Box>
                                  </Box>
                                )}
                                
                                {/* Show percentage if no suggested staff */}
                                {(!recommendation.suggested_staff || recommendation.suggested_staff.length === 0) && (
                                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#666' }}>
                                    0 recommended · 0%
                                  </Typography>
                                )}
                              </Box>
                            ) : (
                              <Box sx={{ 
                                bgcolor: 'transparent',
                                borderRadius: 1,
                                p: 1.5,
                                width: '100%'
                              }}>
                                <Typography variant="caption" color="#999" sx={{ fontSize: '0.65rem' }}>
                                  No ADL data for this shift
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </>
        )}
        </Paper>
      </Stack>
    </Box>
  );
};

export default AIRecommendations;
