import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { useWeek } from '../../contexts/WeekContext';
import api from '../../services/api';

const SchedulingRecommendations = () => {
  const { selectedWeek, getWeekLabel } = useWeek();
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [facilities, setFacilities] = useState([]);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);

  useEffect(() => {
    fetchFacilities();
    fetchRecommendations();
  }, [selectedFacility, selectedWeek]);

  const fetchFacilities = async () => {
    try {
      const response = await api.get('/api/facilities/');
      setFacilities(response.data.results || response.data);
    } catch (err) {
      console.error('Error fetching facilities:', err);
    }
  };

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (selectedFacility) {
        params.append('facility_id', selectedFacility);
      }
      // Use the selected week from the top navigation
      params.append('week_start_date', selectedWeek);
      
      const response = await api.get(`/api/paycom/employees/scheduling_recommendations/?${params.toString()}`);
      setRecommendations(response.data);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError(`Failed to load scheduling recommendations: ${err.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchRecommendations();
  };

  const handleApplyRecommendations = async () => {
    if (!recommendations || !selectedFacility) {
      setError('Please select a facility and ensure recommendations are loaded');
      return;
    }

    try {
      setApplying(true);
      setError(null);
      setApplyResult(null);

      const response = await api.post('/api/paycom/employees/apply_recommendations/', {
        facility_id: selectedFacility,
        week_start_date: selectedWeek,
        recommendations: recommendations
      });

      setApplyResult(response.data);
      
      // Refresh recommendations to show updated data
      await fetchRecommendations();
      
    } catch (err) {
      console.error('Error applying recommendations:', err);
      setError(`Failed to apply recommendations: ${err.response?.data?.detail || err.message}`);
    } finally {
      setApplying(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'adequate':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'adequate':
        return <CheckCircleIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'error':
        return <WarningIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  const formatShiftTime = (shiftType) => {
    switch (shiftType) {
      case 'day':
        return 'Day Shift (6 AM - 2 PM)';
      case 'swing':
        return 'Swing Shift (2 PM - 10 PM)';
      case 'noc':
        return 'NOC Shift (10 PM - 6 AM)';
      default:
        return shiftType;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const renderWeeklyRecommendations = (data) => {
    const { daily_recommendations, weekly_summary, facility_name } = data;
    
    return (
      <Box>
        {/* Weekly Summary Card */}
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" color="primary.main">
                <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Weekly Scheduling Summary - {facility_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getWeekLabel(selectedWeek)}
              </Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Required (Week)</Typography>
                <Typography variant="h6">{weekly_summary?.total_required_staff || 0}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Recommended (Week)</Typography>
                <Typography variant="h6" color="primary.main">
                  {weekly_summary?.total_recommended_staff || 0}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Average Coverage</Typography>
                <Typography variant="h6" color={weekly_summary?.is_week_adequately_staffed ? 'success.main' : 'warning.main'}>
                  {Math.round(weekly_summary?.average_coverage_percentage || 0)}%
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Days with Issues</Typography>
                <Typography variant="h6" color={weekly_summary?.days_with_warnings > 0 ? 'warning.main' : 'success.main'}>
                  {weekly_summary?.days_with_warnings || 0}/7
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Daily Recommendations */}
        {Object.entries(daily_recommendations).map(([dateStr, dayData]) => (
          <Accordion key={dateStr} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" width="100%">
                <Box flexGrow={1}>
                  <Typography variant="h6">
                    {formatDate(dateStr)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {dayData.shift_recommendations ? 
                      `Required: ${Object.values(dayData.shift_recommendations).reduce((sum, shift) => sum + shift.required_count, 0)} | 
                       Recommended: ${Object.values(dayData.shift_recommendations).reduce((sum, shift) => sum + shift.recommended_count, 0)}` :
                      'No shift data available'
                    }
                  </Typography>
                </Box>
                <Chip
                  icon={getStatusIcon(dayData.summary?.is_adequately_staffed ? 'adequate' : 'warning')}
                  label={`${Math.round(dayData.summary?.coverage_percentage || 0)}% Coverage`}
                  color={getStatusColor(dayData.summary?.is_adequately_staffed ? 'adequate' : 'warning')}
                  size="small"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {dayData.shift_recommendations && Object.entries(dayData.shift_recommendations).map(([shiftType, shiftData]) => (
                <Box key={shiftType} sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    {formatShiftTime(shiftType)}
                  </Typography>
                  
                  {shiftData.warnings && shiftData.warnings.length > 0 && (
                    <Box mb={2}>
                      {shiftData.warnings.map((warning, index) => (
                        <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                          {warning}
                        </Alert>
                      ))}
                    </Box>
                  )}
                  
                  {shiftData.staff && shiftData.staff.length > 0 ? (
                    <TableContainer sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Phone</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Availability</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {shiftData.staff.map((staff, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Box display="flex" alignItems="center">
                                  <PersonIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                                  <Typography variant="body2" fontWeight="medium">
                                    {staff.name}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={staff.role}
                                  size="small"
                                  color={
                                    staff.role === 'MedTech' ? 'primary' :
                                    staff.role === 'MedTech/Caregiver' ? 'secondary' :
                                    'default'
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                {staff.phone && (
                                  <Box display="flex" alignItems="center">
                                    <PhoneIcon sx={{ mr: 0.5, fontSize: 12, color: 'text.secondary' }} />
                                    <Typography variant="caption">
                                      {staff.phone}
                                    </Typography>
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell>
                                {staff.email && (
                                  <Box display="flex" alignItems="center">
                                    <EmailIcon sx={{ mr: 0.5, fontSize: 12, color: 'text.secondary' }} />
                                    <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                                      {staff.email}
                                    </Typography>
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">
                                  {Math.round((staff.availability_score || 0) * 100)}% available
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Alert severity="info">
                      No staff recommendations available for this shift.
                    </Alert>
                  )}
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  const renderSingleFacilityRecommendations = (data) => {
    // Check if this is weekly data structure
    if (data.daily_recommendations) {
      return renderWeeklyRecommendations(data);
    }
    
    // Fallback to single day structure
    if (!data.shift_recommendations) {
      return (
        <Alert severity="info">
          No scheduling recommendations available for this facility and date.
        </Alert>
      );
    }

    return (
      <Box>
        {/* Summary Card */}
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" color="primary.main">
                <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Scheduling Summary - {data.facility_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getWeekLabel(selectedWeek)}
              </Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Required</Typography>
                <Typography variant="h6">{data.summary?.total_required_staff || 0}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Recommended</Typography>
                <Typography variant="h6" color="primary.main">
                  {data.summary?.total_recommended_staff || 0}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Coverage</Typography>
                <Typography variant="h6" color={data.summary?.is_adequately_staffed ? 'success.main' : 'warning.main'}>
                  {Math.round(data.summary?.coverage_percentage || 0)}%
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Status</Typography>
                <Chip
                  icon={getStatusIcon(data.summary?.is_adequately_staffed ? 'adequate' : 'warning')}
                  label={data.summary?.is_adequately_staffed ? 'Adequate' : 'Needs Attention'}
                  color={getStatusColor(data.summary?.is_adequately_staffed ? 'adequate' : 'warning')}
                  size="small"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* ADL Requirements */}
        {data.adl_requirements && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ADL-Based Requirements
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(data.adl_requirements).map(([shift, count]) => (
                  <Grid item xs={12} sm={4} key={shift}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {formatShiftTime(shift)}
                      </Typography>
                      <Typography variant="h4" color="primary.main">
                        {count}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        staff needed
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Shift Recommendations */}
        {Object.entries(data.shift_recommendations).map(([shiftType, shiftData]) => (
          <Accordion key={shiftType} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" width="100%">
                <Box flexGrow={1}>
                  <Typography variant="h6">
                    {formatShiftTime(shiftType)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Required: {shiftData.required_count} | Recommended: {shiftData.recommended_count}
                  </Typography>
                </Box>
                <Chip
                  icon={getStatusIcon(shiftData.coverage_ratio >= 1 ? 'adequate' : 'warning')}
                  label={`${Math.round(shiftData.coverage_ratio * 100)}% Coverage`}
                  color={getStatusColor(shiftData.coverage_ratio >= 1 ? 'adequate' : 'warning')}
                  size="small"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {shiftData.warnings && shiftData.warnings.length > 0 && (
                <Box mb={2}>
                  {shiftData.warnings.map((warning, index) => (
                    <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                      {warning}
                    </Alert>
                  ))}
                </Box>
              )}
              
              {shiftData.staff && shiftData.staff.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Availability</TableCell>
                        <TableCell>Experience</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shiftData.staff.map((staff, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <PersonIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2" fontWeight="medium">
                                {staff.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={staff.role}
                              size="small"
                              color={
                                staff.role === 'MedTech' ? 'primary' :
                                staff.role === 'MedTech/Caregiver' ? 'secondary' :
                                'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {staff.phone && (
                              <Box display="flex" alignItems="center">
                                <PhoneIcon sx={{ mr: 0.5, fontSize: 12, color: 'text.secondary' }} />
                                <Typography variant="caption">
                                  {staff.phone}
                                </Typography>
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>
                            {staff.email && (
                              <Box display="flex" alignItems="center">
                                <EmailIcon sx={{ mr: 0.5, fontSize: 12, color: 'text.secondary' }} />
                                <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                                  {staff.email}
                                </Typography>
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {Math.round((staff.availability_score || 0) * 100)}% available
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {staff.experience_months} months
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">
                  No staff recommendations available for this shift.
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  const renderMultiFacilityWeeklyRecommendations = (data) => {
    const { facilities, weekly_summary } = data;
    
    return (
      <Box>
        {/* Overall Weekly Summary */}
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent>
            <Typography variant="h6" color="primary.main" gutterBottom>
              <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Multi-Facility Weekly Scheduling Summary
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Facilities</Typography>
                <Typography variant="h6">{weekly_summary?.total_facilities || 0}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Required (Week)</Typography>
                <Typography variant="h6">{weekly_summary?.total_required_staff || 0}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Recommended (Week)</Typography>
                <Typography variant="h6" color="primary.main">
                  {weekly_summary?.total_recommended_staff || 0}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Overall Coverage</Typography>
                <Typography variant="h6" color="primary.main">
                  {Math.round(weekly_summary?.overall_coverage_percentage || 0)}%
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Facility Weekly Cards */}
        <Grid container spacing={3}>
          {Object.entries(facilities).map(([facilityId, facilityData]) => (
            <Grid item xs={12} md={6} lg={4} key={facilityId}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {facilityData.facility_name}
                  </Typography>
                  
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      Required: {facilityData.weekly_summary?.total_required_staff || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Recommended: {facilityData.weekly_summary?.total_recommended_staff || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Days with Issues: {facilityData.weekly_summary?.days_with_warnings || 0}/7
                    </Typography>
                  </Box>
                  
                  <Chip
                    icon={getStatusIcon(facilityData.weekly_summary?.is_week_adequately_staffed ? 'adequate' : 'warning')}
                    label={`${Math.round(facilityData.weekly_summary?.average_coverage_percentage || 0)}% Coverage`}
                    color={getStatusColor(facilityData.weekly_summary?.is_week_adequately_staffed ? 'adequate' : 'warning')}
                    size="small"
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  const renderMultiFacilityRecommendations = (data) => {
    if (!data.facilities) {
      return (
        <Alert severity="info">
          No scheduling recommendations available.
        </Alert>
      );
    }

    // Check if this is weekly data structure
    if (data.weekly_summary) {
      return renderMultiFacilityWeeklyRecommendations(data);
    }

    return (
      <Box>
        {/* Overall Summary */}
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent>
            <Typography variant="h6" color="primary.main" gutterBottom>
              <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Multi-Facility Scheduling Summary
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Facilities</Typography>
                <Typography variant="h6">{data.summary?.total_facilities || 0}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Required</Typography>
                <Typography variant="h6">{data.summary?.total_required_staff || 0}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Total Recommended</Typography>
                <Typography variant="h6" color="primary.main">
                  {data.summary?.total_recommended_staff || 0}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Overall Coverage</Typography>
                <Typography variant="h6" color="primary.main">
                  {Math.round(data.summary?.overall_coverage_percentage || 0)}%
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Facility Cards */}
        <Grid container spacing={3}>
          {Object.entries(data.facilities).map(([facilityId, facilityData]) => (
            <Grid item xs={12} md={6} lg={4} key={facilityId}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {facilityData.facility_name}
                  </Typography>
                  
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      Required: {facilityData.summary?.total_required_staff || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Recommended: {facilityData.summary?.total_recommended_staff || 0}
                    </Typography>
                  </Box>
                  
                  <Chip
                    icon={getStatusIcon(facilityData.summary?.is_adequately_staffed ? 'adequate' : 'warning')}
                    label={`${Math.round(facilityData.summary?.coverage_percentage || 0)}% Coverage`}
                    color={getStatusColor(facilityData.summary?.is_adequately_staffed ? 'adequate' : 'warning')}
                    size="small"
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" component="h2">
              <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Scheduling Recommendations
            </Typography>
            <Tooltip title="Refresh Recommendations">
              <IconButton onClick={handleRefresh} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Controls */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>Facility</InputLabel>
                <Select
                  value={selectedFacility}
                  label="Facility"
                  onChange={(e) => setSelectedFacility(e.target.value)}
                >
                  <MenuItem value="">All Facilities</MenuItem>
                  {facilities.map((facility) => (
                    <MenuItem key={facility.id} value={facility.id}>
                      {facility.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={8}>
              <Box sx={{ display: 'flex', alignItems: 'center', height: '56px' }}>
                <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body1" color="text.secondary">
                  Based on ADL data for: <strong>{getWeekLabel(selectedWeek)}</strong>
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {applyResult && (
            <Alert severity={applyResult.success ? "success" : "error"} sx={{ mb: 3 }}>
              {applyResult.message || applyResult.error}
              {applyResult.applied_shifts > 0 && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Created {applyResult.applied_shifts} shifts and {applyResult.applied_assignments} assignments
                </Typography>
              )}
            </Alert>
          )}

          {/* Apply Recommendations Button */}
          {recommendations && selectedFacility && (
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleApplyRecommendations}
                disabled={applying || loading}
                startIcon={applying ? <CircularProgress size={20} /> : <ScheduleIcon />}
                sx={{ 
                  minWidth: 280,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                {applying ? 'Applying Recommendations...' : 'Apply All Weekly Recommendations'}
              </Button>
            </Box>
          )}

          {/* Recommendations */}
          {recommendations && (
            <>
              {selectedFacility ? 
                renderSingleFacilityRecommendations(recommendations) :
                renderMultiFacilityRecommendations(recommendations)
              }
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SchedulingRecommendations;
