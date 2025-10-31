import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Divider,
  Button,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Assessment as AssessmentIcon,
  AccessTime as TimeIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { useWeek } from '../../contexts/WeekContext';

const ADLAnalytics = ({ facilityId, residentId }) => {
  const { selectedWeek, getWeekLabel } = useWeek();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateADLData = () => {
    navigate(`/weekly-adl-entry?week=${selectedWeek}`);
  };

  useEffect(() => {
    if (selectedWeek && (facilityId || residentId)) {
      fetchAnalytics();
    }
  }, [selectedWeek, facilityId, residentId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        week_start_date: selectedWeek,
        compare_previous_week: true
      };
      
      if (facilityId) {
        params.facility_id = facilityId;
      }
      if (residentId) {
        params.resident_id = residentId;
      }

      const response = await axios.get(`${API_BASE_URL}/api/adls/analytics/`, { params });
      setAnalytics(response.data);
    } catch (err) {
      setError('Failed to fetch ADL analytics');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (change) => {
    if (change > 0) return <TrendingUpIcon color="success" />;
    if (change < 0) return <TrendingDownIcon color="error" />;
    return <TrendingFlatIcon color="action" />;
  };

  const getTrendColor = (change) => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  const formatChange = (change) => {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}`;
  };

  // Show analytics for any week - it will compare with previous week

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading ADL Analytics...
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error" action={
          <IconButton onClick={fetchAnalytics} size="small">
            <RefreshIcon />
          </IconButton>
        }>
          {error}
        </Alert>
      </Paper>
    );
  }

  if (!analytics) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          ADL Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No analytics data available for the selected period.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" gutterBottom>
            ADL Analytics - Week Comparison
          </Typography>
          <IconButton onClick={fetchAnalytics} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Comparing {getWeekLabel(analytics.current_week)} vs {getWeekLabel(analytics.previous_week)}
        </Typography>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Care Hours
                  </Typography>
                  <Typography variant="h4">
                    {analytics.total_hours.current.toFixed(1)}h
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getTrendIcon(analytics.total_hours.change)}
                  <Typography 
                    variant="body2" 
                    color={`${getTrendColor(analytics.total_hours.change)}.main`}
                    sx={{ ml: 1 }}
                  >
                    {formatChange(analytics.total_hours.change)}h
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Completed ADLs
                  </Typography>
                  <Typography variant="h4">
                    {analytics.completed_adls.current}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getTrendIcon(analytics.completed_adls.change)}
                  <Typography 
                    variant="body2" 
                    color={`${getTrendColor(analytics.completed_adls.change)}.main`}
                    sx={{ ml: 1 }}
                  >
                    {formatChange(analytics.completed_adls.change)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Avg. ADL Score
                  </Typography>
                  <Typography variant="h4">
                    {analytics.avg_adl_score.current.toFixed(1)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getTrendIcon(analytics.avg_adl_score.change)}
                  <Typography 
                    variant="body2" 
                    color={`${getTrendColor(analytics.avg_adl_score.change)}.main`}
                    sx={{ ml: 1 }}
                  >
                    {formatChange(analytics.avg_adl_score.change)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Residents Assessed
                  </Typography>
                  <Typography variant="h4">
                    {analytics.residents_assessed.current}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getTrendIcon(analytics.residents_assessed.change)}
                  <Typography 
                    variant="body2" 
                    color={`${getTrendColor(analytics.residents_assessed.change)}.main`}
                    sx={{ ml: 1 }}
                  >
                    {formatChange(analytics.residents_assessed.change)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Daily Care Hours Trend
            </Typography>
            <ResponsiveContainer key={`adl-line-chart-${facilityId}-${selectedWeek}`} width="100%" height={300}>
              <LineChart data={analytics.daily_trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <RechartsTooltip />
                <Line 
                  type="monotone" 
                  dataKey="current_week" 
                  stroke="#1976d2" 
                  strokeWidth={2}
                  name="Current Week"
                />
                <Line 
                  type="monotone" 
                  dataKey="previous_week" 
                  stroke="#666" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Previous Week"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              ADL Category Comparison
            </Typography>
            <ResponsiveContainer key={`adl-bar-chart-${facilityId}-${selectedWeek}`} width="100%" height={300}>
              <BarChart data={analytics.adl_categories}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="current_week" fill="#1976d2" name="Current Week" />
                <Bar dataKey="previous_week" fill="#666" name="Previous Week" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Top Changes */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="success.main">
              <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Biggest Improvements
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ADL Category</TableCell>
                    <TableCell align="right">Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.top_improvements.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CheckIcon color="success" sx={{ mr: 1, fontSize: 16 }} />
                          {item.category}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={`+${item.change.toFixed(1)}h`} 
                          color="success" 
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="error.main">
              <TrendingDownIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Areas Needing Attention
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ADL Category</TableCell>
                    <TableCell align="right">Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.areas_needing_attention.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <WarningIcon color="error" sx={{ mr: 1, fontSize: 16 }} />
                          {item.category}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={`${item.change.toFixed(1)}h`} 
                          color="error" 
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ADLAnalytics;
