import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Home as HomeIcon,
  BarChart as BarChartIcon,
  Lightbulb as LightbulbIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const AIRecommendations = ({ facilityId }) => {
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
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [viewMode, setViewMode] = useState(0);
  const [targetDate, setTargetDate] = useState('2025-08-22');
  const [analysisType, setAnalysisType] = useState('weekly');
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (facilityId) {
      fetchFacilityInsights();
      // Automatically fetch recommendations when facility changes
      fetchWeeklyRecommendations();
    }
  }, [facilityId]);

  const fetchFacilityInsights = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/scheduling/ai-insights/?facility=${facilityId}`);
      setFacilityInsights(response.data);
    } catch (error) {
      console.error('Error fetching facility insights:', error);
    }
  };

  const fetchWeeklyRecommendations = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/scheduling/ai-recommendations/calculate_from_adl/?facility=${facilityId}&week_start=${getWeekStart(targetDate)}`);
      
      if (response.data.recommendations) {
        setRecommendations(response.data.recommendations);
        setNoDataMessage(''); // Clear any previous no-data message
        
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
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffingAnalysis = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/scheduling/staffing-analysis/?facility=${facilityId}&date=${targetDate}`);
      setRecommendations(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching staffing analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  const getWeekDays = () => {
    const start = getWeekStart(targetDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const handleRefreshAnalysis = () => {
    if (analysisType === 'weekly') {
      fetchWeeklyRecommendations();
    } else {
      fetchStaffingAnalysis();
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
      const response = await axios.post(`${API_BASE_URL}/api/scheduling/ai-recommendations/apply_weekly_recommendations/`, {
        facility: facilityId,
        week_start: getWeekStart(targetDate)
      });
      
      setNotification({
        type: 'success',
        message: `Successfully applied AI recommendations! Created ${response.data.shifts_created} new shifts and updated ${response.data.shifts_updated} existing shifts.`
      });
      
      // Clear notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
      
    } catch (error) {
      console.error('Error applying recommendations:', error);
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
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Please select a facility to view AI recommendations
        </Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Loading AI recommendations...
        </Typography>
        <LinearProgress />
      </Paper>
    );
  }

  const weekDays = getWeekDays();

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', bgcolor: '#f5f5f5', minHeight: '100vh', p: 2 }}>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: '#333', mb: 3 }}>
        AI Recommender
      </Typography>

      {/* Notification */}
      {notification && (
        <Alert 
          severity={notification.type} 
          sx={{ mb: 3 }}
          onClose={() => setNotification(null)}
        >
          {notification.message}
        </Alert>
      )}

      {/* Care Intensity Distribution */}
      <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#333', mb: 2 }}>
          Care Intensity Distribution
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip 
            label={`Low: ${facilityInsights.low_acuity_count || 30}`} 
            sx={{ 
              fontSize: '1rem', 
              height: 36, 
              bgcolor: '#4caf50',
              color: 'white',
              fontWeight: 'bold',
              '& .MuiChip-label': { px: 2 }
            }}
          />
          <Chip 
            label={`Medium: ${facilityInsights.medium_acuity_count || 4}`} 
            sx={{ 
              fontSize: '1rem', 
              height: 36, 
              bgcolor: '#ff9800',
              color: 'white',
              fontWeight: 'bold',
              '& .MuiChip-label': { px: 2 }
            }}
          />
          <Chip 
            label={`High: ${facilityInsights.high_acuity_count || 0}`} 
            sx={{ 
              fontSize: '1rem', 
              height: 36, 
              bgcolor: '#f44336',
              color: 'white',
              fontWeight: 'bold',
              '& .MuiChip-label': { px: 2 }
            }}
          />
        </Box>
      </Paper>

      {/* AI Recommendations */}
      <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#333', mb: 2 }}>
          AI Recommendations
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 20, 
              height: 20, 
              borderRadius: '50%', 
              bgcolor: '#2196f3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>i</Typography>
            </Box>
            <Typography variant="body2" color="#666">
              High care requirements detected - review staffing ratios
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 20, 
              height: 20, 
              borderRadius: '50%', 
              bgcolor: '#2196f3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>i</Typography>
            </Box>
            <Typography variant="body2" color="#666">
              Consider redistributing care hours across shifts for better balance
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* AI Shift Recommendations Controls */}
      <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#333', mb: 2 }}>
          AI Shift Recommendations
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
          <TextField
            label="Target Date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          
          <Button
            size="small"
            variant="outlined"
            sx={{ 
              minWidth: 40,
              borderColor: '#e0e0e0',
              color: '#666'
            }}
          >
            S
          </Button>

          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={fetchWeeklyRecommendations}
            disabled={loading}
            sx={{ 
              bgcolor: '#2196f3',
              '&:hover': { bgcolor: '#1976d2' }
            }}
          >
            Get Weekly Recommendations
          </Button>
          
          <Button
            variant="outlined"
            onClick={fetchStaffingAnalysis}
            disabled={loading}
            sx={{ 
              borderColor: '#e0e0e0',
              color: '#666',
              '&:hover': {
                borderColor: '#999',
                bgcolor: 'rgba(0, 0, 0, 0.02)'
              }
            }}
          >
            Staffing Analysis
          </Button>
        </Box>

        {/* AI Recommendations Week Box */}
        <Box sx={{ 
          bgcolor: '#e3f2fd',
          border: '1px solid #2196f3',
          borderRadius: 2,
          p: 3,
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 1 }}>
            AI Recommendations Week
          </Typography>
          <Typography variant="body1" color="#666">
            Weekly View: Monday - Sunday
          </Typography>
          <Typography variant="body2" color="#666" sx={{ mt: 1 }}>
            Get AI-powered shift recommendations for the entire week
          </Typography>
        </Box>
      </Paper>

      {/* Weekly Shift Recommendations by Day */}
      <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
            Weekly Shift Recommendations by Day
          </Typography>
          <Button
            variant="contained"
            startIcon={applying ? <LinearProgress size={20} /> : <PlayArrowIcon />}
            onClick={handleApplyRecommendations}
            disabled={recommendations.length === 0 || applying}
            sx={{ 
              bgcolor: '#4caf50',
              '&:hover': { bgcolor: '#388e3c' }
            }}
          >
            {applying ? 'Applying...' : 'Apply All Weekly Recommendations'}
          </Button>
        </Box>

        {recommendations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
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
            <Box sx={{ overflow: 'auto' }}>
              <Box sx={{ 
                minWidth: 1200, 
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
                      width: '200px',
                      p: 2, 
                      borderBottom: 1, 
                      borderRight: 1, 
                      borderColor: '#e0e0e0', 
                      bgcolor: '#f5f5f5',
                      minHeight: 60,
                      verticalAlign: 'middle'
                    }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                        Shifts
                      </Typography>
                    </Box>
                    {weekDays.map((day) => (
                      <Box key={day.toISOString()} sx={{ 
                        display: 'table-cell',
                        width: '142.86px',
                        p: 2, 
                        borderBottom: 1, 
                        borderRight: 1, 
                        borderColor: '#e0e0e0', 
                        bgcolor: '#f5f5f5', 
                        textAlign: 'center',
                        minHeight: 60,
                        verticalAlign: 'middle'
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#333' }}>
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </Typography>
                        <Typography variant="body2" color="#666">
                          {day.getDate()} {day.toLocaleDateString('en-US', { month: 'short' })}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Shift Rows */}
                  {['day', 'swing', 'noc'].map((shiftType) => (
                    <Box key={shiftType} sx={{ display: 'table-row' }}>
                      <Box sx={{ 
                        display: 'table-cell',
                        width: '200px',
                        p: 2, 
                        borderBottom: 1, 
                        borderRight: 1, 
                        borderColor: '#e0e0e0', 
                        bgcolor: '#fafafa',
                        minHeight: 120,
                        verticalAlign: 'middle'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: getShiftTypeColor(shiftType),
                            }}
                          />
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                            {shiftType.toUpperCase()}
                          </Typography>
                        </Box>
                      </Box>
                      {weekDays.map((day) => {
                        const dayStr = day.toISOString().split('T')[0];
                        const recommendation = recommendations.find(r => 
                          r.date === dayStr && r.shift_type === shiftType
                        );
                        
                        return (
                          <Box key={`${shiftType}-${day.toISOString()}`} sx={{ 
                            display: 'table-cell',
                            width: '142.86px',
                            p: 2, 
                            borderBottom: 1, 
                            borderRight: 1, 
                            borderColor: '#e0e0e0',
                            minHeight: 120,
                            bgcolor: recommendation ? 'white' : '#f9f9f9',
                            verticalAlign: 'middle',
                            textAlign: 'center'
                          }}>
                            {recommendation ? (
                              <Box sx={{ width: '100%' }}>
                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333', mb: 1 }}>
                                  {recommendation.care_hours}h
                                </Typography>
                                <Typography variant="body2" color="#666" sx={{ mb: 0.5 }}>
                                  Staff: {recommendation.required_staff}
                                </Typography>
                                <Typography variant="body2" color="#666" sx={{ mb: 1 }}>
                                  Residents: {recommendation.resident_count}
                                </Typography>
                                <Chip
                                  label={`${recommendation.confidence}%`}
                                  size="small"
                                  sx={{ 
                                    fontSize: '0.75rem', 
                                    height: 24,
                                    bgcolor: getConfidenceColor(recommendation.confidence),
                                    color: 'white',
                                    fontWeight: 'bold'
                                  }}
                                />
                              </Box>
                            ) : (
                              <Box sx={{ 
                                bgcolor: '#f5f5f5',
                                borderRadius: 1,
                                p: 1,
                                width: '100%'
                              }}>
                                <Typography variant="body2" color="#999">
                                  No data
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

      {/* Weekly Summary */}
      <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#333', mb: 3 }}>
          Weekly Summary
        </Typography>
        <Grid container spacing={3} textAlign="center">
          <Grid item xs={3}>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#2196f3', mb: 1 }}>
              {recommendations.length || 0}
            </Typography>
            <Typography variant="body2" color="#666">
              Total Recommendations
            </Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#4caf50', mb: 1 }}>
              {(facilityInsights.total_care_hours || 0).toFixed(1)}h
            </Typography>
            <Typography variant="body2" color="#666">
              Total Care Hours
            </Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#2196f3', mb: 1 }}>
              {recommendations.reduce((sum, r) => sum + (r.required_staff || 0), 0) || 0}
            </Typography>
            <Typography variant="body2" color="#666">
              Total Staff Required
            </Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#ff9800', mb: 1 }}>
              {recommendations.length > 0 ? Math.round(recommendations.reduce((sum, r) => sum + (r.confidence || 0), 0) / recommendations.length) : 0}%
            </Typography>
            <Typography variant="body2" color="#666">
              Avg Confidence
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="body2" color="#999">
          Last AI analysis: {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString()}
        </Typography>
      </Box>
    </Box>
  );
};

export default AIRecommendations;
