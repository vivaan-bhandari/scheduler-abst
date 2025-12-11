import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, CircularProgress, Alert } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label
} from 'recharts';
import axios from 'axios';

const COLORS = {
  Day: '#60a5fa',      // Light Blue (Day)
  Swing: '#0d9488',    // Teal (Swing)
  NOC: '#8b5cf6',      // Purple (NOC)
};

const CaregivingSummaryChart = ({ title, weekLabel, facilityName, endpoint, queryParams = {} }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check authentication
        const token = localStorage.getItem('authToken');
        console.log('📊 CaregivingSummaryChart: Auth token exists:', !!token);
        console.log('📊 CaregivingSummaryChart: Axios headers:', axios.defaults.headers.common);
        
        const params = new URLSearchParams(queryParams);
        const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
        console.log('📊 CaregivingSummaryChart: Fetching data from', url);
        
        // Ensure auth headers are set
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Token ${token}`;
        }
        
        const response = await axios.get(url);
        console.log('📊 CaregivingSummaryChart: Data received', response.data);
        console.log('📊 CaregivingSummaryChart: Response status:', response.status);
        console.log('📊 CaregivingSummaryChart: Response headers:', response.headers);
        
        // Check if we got empty data (likely auth issue)
        if (response.data && response.data.per_shift) {
          const totalHours = response.data.per_shift.reduce((sum, day) => 
            sum + day.Day + day.Swing + day.NOC, 0);
          console.log('📊 CaregivingSummaryChart: Total hours in response:', totalHours);
          console.log('📊 CaregivingSummaryChart: per_shift data:', JSON.stringify(response.data.per_shift, null, 2));
          
          if (totalHours === 0) {
            console.warn('⚠️ CaregivingSummaryChart: Received 0 total hours - checking if data exists in backend');
          } else {
            console.log('✅ CaregivingSummaryChart: Received data with', totalHours, 'total hours');
          }
        } else {
          console.warn('⚠️ CaregivingSummaryChart: No per_shift data in response:', response.data);
        }
        
        setData(response.data);
        console.log('📊 CaregivingSummaryChart: Data set to state:', response.data);
      } catch (err) {
        console.error('Error fetching caregiving summary:', err);
        setError('Failed to load caregiving summary data');
      } finally {
        setLoading(false);
      }
    };
    if (endpoint) {
      console.log('📊 CaregivingSummaryChart: useEffect triggered with params', queryParams);
      fetchData();
    }
  }, [endpoint, JSON.stringify(queryParams)]);

  const cardStyles = {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    maxWidth: '1024px',
    mx: 'auto',
    p: 3,
    mb: 1.5
  };

  if (loading) {
    return (
      <Paper sx={cardStyles}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress size={24} />
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={cardStyles}>
        <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>
      </Paper>
    );
  }

  console.log('📊 CaregivingSummaryChart: Render check - data:', data);
  console.log('📊 CaregivingSummaryChart: Render check - data.per_shift:', data?.per_shift);
  console.log('📊 CaregivingSummaryChart: Render check - isArray:', Array.isArray(data?.per_shift));
  console.log('📊 CaregivingSummaryChart: Render check - length:', data?.per_shift?.length);
  
  if (!data || !data.per_shift || !Array.isArray(data.per_shift) || data.per_shift.length === 0) {
    console.log('📊 CaregivingSummaryChart: Showing "No data" message');
    return (
      <Paper sx={cardStyles}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, fontSize: 18 }}>{title}</Typography>
        {weekLabel && (
          <Typography variant="body2" sx={{ color: '#6B7280', mb: 1.5, fontSize: 14 }}>{weekLabel}</Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>No caregiving summary data available.</Typography>
      </Paper>
    );
  }

  // Section-level: per_shift data present
  if (data.per_shift) {
    // Dynamically determine which shifts are present in the data
    const allShiftKeys = new Set();
    data.per_shift.forEach(day => {
      Object.keys(day).forEach(key => {
        if (key !== 'day' && typeof day[key] === 'number') {
          allShiftKeys.add(key);
        }
      });
    });
    
    // Define shift order and colors
    const shiftOrder = ['Day', 'Swing', 'NOC', 'Night'];
    const availableShifts = shiftOrder.filter(shift => allShiftKeys.has(shift));
    
    const chartData = data.per_shift.map(day => {
      const dayData = { day: day.day };
      availableShifts.forEach(shift => {
        dayData[shift] = day[shift] || 0;
      });
      return dayData;
    });
    
    console.log('📊 CaregivingSummaryChart: Rendering chart with data:', chartData);
    console.log('📊 CaregivingSummaryChart: Available shifts:', availableShifts);
    console.log('📊 CaregivingSummaryChart: Days with data:', chartData.filter(d => availableShifts.some(shift => d[shift] > 0)).length);
    
    // Add Night color if needed
    const colors = {
      ...COLORS,
      Night: '#8b5cf6',  // Purple for Night (same as NOC since they're similar)
    };
    
    return (
      <Paper sx={cardStyles}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, fontSize: 18 }}>{title}</Typography>
        {weekLabel && (
          <Typography variant="body2" sx={{ color: '#6B7280', mb: 1, fontSize: 14 }}>{weekLabel}</Typography>
        )}
        <Typography variant="body2" sx={{ color: '#6B7280', mb: 2.5, fontSize: 13 }}>
          This shows total caregiving hours needed for each day based on ADL entries.
        </Typography>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" fontSize={12} tick={{ fontSize: 12 }}>
              <Label value="Day" offset={-5} position="insideBottom" fontSize={12} />
            </XAxis>
            <YAxis fontSize={12} tick={{ fontSize: 12 }}>
              <Label value="Hours" angle={-90} position="insideLeft" fontSize={12} />
            </YAxis>
            <Tooltip formatter={(value, name) => [`${Math.round(value * 100) / 100} hours`, name]} />
            <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
            {availableShifts.map(shift => (
              <Bar 
                key={shift}
                dataKey={shift} 
                stackId="a" 
                fill={colors[shift] || COLORS.Day} 
                name={shift} 
                barSize={30} 
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Paper>
    );
  }

  // Facility/Resident/All: summary cards
  if (data.total_hours !== undefined) {
    return (
      <Paper sx={cardStyles}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, fontSize: 18 }}>{title}</Typography>
        {weekLabel && (
          <Typography variant="body2" sx={{ color: '#6B7280', mb: 2, fontSize: 14 }}>{weekLabel}</Typography>
        )}
        <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {data.total_hours ? Math.round(data.total_hours * 100) / 100 : 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total Hours</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {data.total_minutes || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total Minutes</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {data.total_adls || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total ADLs</Typography>
          </Box>
        </Box>
      </Paper>
    );
  }

  // Fallback: no recognized data
  return null;
};

export default CaregivingSummaryChart; 