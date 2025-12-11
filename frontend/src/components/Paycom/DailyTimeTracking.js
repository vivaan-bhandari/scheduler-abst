import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  AccessTime as ClockIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useWeek } from '../../contexts/WeekContext';
import api from '../../services/api';

const DailyTimeTracking = ({ facilityId }) => {
  const { selectedWeek, getWeekLabel } = useWeek();
  const [timeTrackingData, setTimeTrackingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(facilityId || '');

  // Calculate week days from selectedWeek
  const getWeekDays = () => {
    if (!selectedWeek) return [];
    
    // Parse the date string directly to avoid timezone issues
    const [year, month, day] = selectedWeek.split('-').map(Number);
    const startDate = new Date(year, month - 1, day); // month is 0-indexed
    const days = [];
    
    console.log('🔍 getWeekDays - selectedWeek:', selectedWeek);
    console.log('🔍 getWeekDays - startDate:', startDate);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      // Use local date formatting to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      console.log(`🔍 getWeekDays - Day ${i}:`, dateString);
      days.push(dateString);
    }
    
    console.log('🔍 getWeekDays - final days array:', days);
    return days;
  };

  const weekDays = getWeekDays();

  useEffect(() => {
    fetchFacilities();
    if (weekDays.length > 0) {
      console.log('🔍 Setting initial selectedDate to:', weekDays[0]);
      setSelectedDate(weekDays[0]); // Default to first day of week
    }
  }, [selectedWeek]);

  useEffect(() => {
    if (selectedDate && selectedFacility) {
      fetchTimeTrackingData();
    }
  }, [selectedDate, selectedFacility]);

  const fetchFacilities = async () => {
    try {
      console.log('🔍 Fetching facilities...');
      const response = await api.get('/api/facilities/');
      console.log('🔍 Facilities response:', response.data);
      // Handle paginated response - extract results array
      const facilitiesData = response.data.results || response.data;
      setFacilities(facilitiesData);
      if (facilitiesData.length > 0 && !selectedFacility) {
        setSelectedFacility(facilitiesData[0].id);
      }
    } catch (err) {
      console.error('Error fetching facilities:', err);
    }
  };

  const fetchTimeTrackingData = async () => {
    if (!selectedDate || !selectedFacility) return;

    setLoading(true);
    setError('');

    try {
      console.log('🔍 Fetching time tracking data for:', { selectedDate, selectedFacility });
      console.log('🔍 Auth token:', localStorage.getItem('authToken') ? 'Present' : 'Missing');
      
      const response = await api.get('/api/scheduling/time-tracking/', {
        params: {
          date: selectedDate,
          facility: selectedFacility
        }
      });

      console.log('🔍 Time tracking response:', response.data);
      // Handle paginated response - extract results array
      const data = response.data.results || response.data;
      console.log('🔍 Processed data:', data);
      console.log('🔍 Data length:', data.length);
      setTimeTrackingData(data);
    } catch (err) {
      console.error('Error fetching time tracking data:', err);
      console.error('Error details:', err.response?.data);
      setError('Failed to load time tracking data');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return 'N/A';
    }
  };

  const calculateHours = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return 0;
    try {
      const start = new Date(clockIn);
      const end = new Date(clockOut);
      const diffMs = end - start;
      const diffHours = diffMs / (1000 * 60 * 60);
      return Math.round(diffHours * 10) / 10; // Round to 1 decimal
    } catch {
      return 0;
    }
  };

  const getStatusColor = (clockOut) => {
    return clockOut ? 'success' : 'warning';
  };

  const getStatusText = (clockOut) => {
    return clockOut ? 'Clocked Out' : 'Currently Working';
  };

  const handleRefresh = () => {
    fetchTimeTrackingData();
  };

  const handleDateChange = (date) => {
    console.log('🔍 handleDateChange called with:', date);
    // Ensure we always work with string dates (YYYY-MM-DD format)
    let dateString;
    if (date instanceof Date) {
      dateString = date.toISOString().split('T')[0];
    } else {
      dateString = date;
    }
    console.log('🔍 Setting selectedDate to:', dateString);
    setSelectedDate(dateString);
  };

  if (!selectedWeek) {
    return (
      <Box sx={{ width: '100%', maxWidth: 'none', mx: 0 }}>
        <Alert severity="info">
          Please select a week to view daily time tracking data.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', mx: 0 }}>
      <Card sx={{ maxWidth: 'none', width: '100%' }}>
        <CardContent sx={{ px: 4, py: 3 }}>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box display="flex" alignItems="center">
              <ClockIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              <Typography variant="h5" component="h2">
                Daily Time Tracking - {getWeekLabel(selectedWeek)}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {/* Filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Facility</InputLabel>
                <Select
                  value={selectedFacility}
                  onChange={(e) => setSelectedFacility(e.target.value)}
                  label="Facility"
                >
                  {facilities.map((facility) => (
                    <MenuItem key={facility.id} value={facility.id}>
                      {facility.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={8}>
              <Box display="flex" gap={1} flexWrap="wrap">
                {weekDays.map((day) => {
                  // Parse the date string directly to avoid timezone issues
                  const [year, month, dayNum] = day.split('-').map(Number);
                  const date = new Date(year, month - 1, dayNum);
                  const isSelected = selectedDate === day;
                  return (
                    <Button
                      key={day}
                      variant={isSelected ? "contained" : "outlined"}
                      size="small"
                      onClick={() => {
                        console.log('🔍 Button clicked for day:', day);
                        console.log('🔍 Button clicked for date object:', date);
                        handleDateChange(day);
                      }}
                      sx={{ minWidth: 100 }}
                    >
                      {date.toLocaleDateString('en-US', { 
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </Button>
                  );
                })}
              </Box>
            </Grid>
          </Grid>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Loading */}
          {loading && (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}

          {/* Time Tracking Table */}
          {!loading && !error && (
            <>
              {(() => {
                console.log('🔍 Render check - timeTrackingData:', timeTrackingData);
                console.log('🔍 Render check - timeTrackingData.length:', timeTrackingData.length);
                console.log('🔍 Render check - selectedDate:', selectedDate);
                console.log('🔍 Render check - selectedFacility:', selectedFacility);
                return null;
              })()}
              {timeTrackingData.length === 0 ? (
                <Alert severity="info">
                  No time tracking data found for {selectedDate && new Date(selectedDate).toLocaleDateString()}.
                  This could mean no employees have clocked in/out on this date, or the Time Detail Report hasn't been processed yet.
                </Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell>Facility</TableCell>
                        <TableCell>Clock In</TableCell>
                        <TableCell>Clock Out</TableCell>
                        <TableCell>Hours Worked</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Hourly Rate</TableCell>
                        <TableCell>Regular Hours</TableCell>
                        <TableCell>Overtime Hours</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {timeTrackingData.map((entry) => (
                        <TableRow key={`${entry.staff}-${entry.date}`}>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {entry.staff_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {entry.staff_id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <LocationIcon sx={{ mr: 0.5, fontSize: 14 }} />
                              {entry.facility_name}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {formatTime(entry.clock_in)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {formatTime(entry.clock_out)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {entry.total_hours_worked || calculateHours(entry.clock_in, entry.clock_out)}h
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusText(entry.clock_out)}
                              color={getStatusColor(entry.clock_out)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {entry.hourly_rate ? `$${parseFloat(entry.hourly_rate).toFixed(2)}` : 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="success.main">
                              {entry.regular_hours || 0}h
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="error.main">
                              {entry.overtime_hours || 0}h
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Summary Stats */}
              {timeTrackingData.length > 0 && (
                <Box mt={3} p={2} bgcolor="grey.50" borderRadius={1}>
                  <Typography variant="h6" gutterBottom>
                    <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Daily Summary - {selectedDate && new Date(selectedDate).toLocaleDateString()}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        Total Employees
                      </Typography>
                      <Typography variant="h6">
                        {timeTrackingData.length}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        Total Hours
                      </Typography>
                      <Typography variant="h6">
                        {timeTrackingData.reduce((sum, entry) => sum + (entry.total_hours_worked || 0), 0).toFixed(1)}h
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        Regular Hours
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {timeTrackingData.reduce((sum, entry) => sum + (entry.regular_hours || 0), 0).toFixed(1)}h
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        Overtime Hours
                      </Typography>
                      <Typography variant="h6" color="error.main">
                        {timeTrackingData.reduce((sum, entry) => sum + (entry.overtime_hours || 0), 0).toFixed(1)}h
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DailyTimeTracking;
