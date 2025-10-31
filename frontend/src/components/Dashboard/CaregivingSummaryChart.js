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

const CaregivingSummaryChart = ({ title, endpoint, queryParams = {} }) => {
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
          
          if (totalHours === 0) {
            console.warn('⚠️ CaregivingSummaryChart: Received 0 total hours - possible auth issue');
          }
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

  if (loading) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Alert severity="error">{error}</Alert>
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
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Typography color="text.secondary">No caregiving summary data available.</Typography>
      </Paper>
    );
  }

  // Section-level: per_shift data present
  if (data.per_shift) {
    const chartData = data.per_shift.map(day => ({
      day: day.day,
      Day: day.Day,
      Swing: day.Swing,
      NOC: day.NOC,
    }));
    
    console.log('📊 CaregivingSummaryChart: Rendering chart with data:', chartData);
    console.log('📊 CaregivingSummaryChart: Days with data:', chartData.filter(d => d.Day > 0 || d.Swing > 0 || d.NOC > 0).length);
    
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ textAlign: 'center', fontWeight: 600, fontSize: 22 }}>{title}</Typography>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 30, right: 40, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" fontSize={16} tick={{ fontSize: 16 }}>
              <Label value="Day" offset={-10} position="insideBottom" fontSize={16} />
            </XAxis>
            <YAxis fontSize={16} tick={{ fontSize: 16 }}>
              <Label value="Hours" angle={-90} position="insideLeft" fontSize={16} />
            </YAxis>
            <Tooltip formatter={(value, name) => [`${Math.round(value * 100) / 100} hours`, name]} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 16 }} />
            <Bar dataKey="Day" stackId="a" fill={COLORS.Day} name="Day" barSize={40} />
            <Bar dataKey="Swing" stackId="a" fill={COLORS.Swing} name="Swing" barSize={40} />
            <Bar dataKey="NOC" stackId="a" fill={COLORS.NOC} name="NOC" barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>
    );
  }

  // Facility/Resident/All: summary cards
  if (data.total_hours !== undefined) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>{title}</Typography>
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