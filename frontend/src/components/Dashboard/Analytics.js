import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const COLORS = ['#1e3a8a', '#10b981', '#60a5fa', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const CHART_HEIGHT = 500;
const AXIS_FONT = { fontSize: 18, fontWeight: 'bold' };
const LABEL_FONT = { fontSize: 16 };

const chartTabs = [
  { label: 'Top ADL Activities', key: 'adl' },
  { label: 'Time by Day', key: 'day' },
  { label: 'Time by Day (Bar)', key: 'daybar' },
  { label: 'Time by Shift', key: 'shift' },
  { label: 'Resident Workload', key: 'resident' },
  { label: 'Facility Workload', key: 'facility' },
  { label: 'Status Distribution', key: 'status' },
];

const shiftColors = {
  Day: '#60a5fa',      // Light Blue (Day)
  Swing: '#0d9488',    // Teal (Swing)
  NOC: '#8b5cf6',      // Purple (NOC)
};

const Analytics = ({ facilityId }) => {
  const [adlData, setAdlData] = useState([]);
  const [residents, setResidents] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFacility, setSelectedFacility] = useState('all');
  const [selectedResident, setSelectedResident] = useState('all');
  const [activeChart, setActiveChart] = useState(0);
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (adlData.length > 0) {
      setLoading(false);
    }
  }, [adlData]);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch caregiving summary for the facility
        const res = await axios.get(`${API_BASE_URL}/api/adls/summary/?facility_id=${facilityId}`);
        // Assume backend returns per_shift: [{ day: 'Monday', Day: 54, Swing: 29, NOC: 0 }, ...]
        setData(res.data.per_shift || []);
      } catch (err) {
        setError('Failed to load analytics.');
      }
      setLoading(false);
    };
    if (facilityId) fetchSummary();
  }, [facilityId]);

  const fetchData = async () => {
    try {
      const [adlRes, residentsRes, facilitiesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/adls/`),
        axios.get(`${API_BASE_URL}/api/residents/`),
        axios.get(`${API_BASE_URL}/api/facilities/`),
      ]);

      setAdlData(adlRes.data.results || adlRes.data);
      setResidents(residentsRes.data.results || residentsRes.data);
      setFacilities(facilitiesRes.data.results || facilitiesRes.data);
    } catch (err) {
      setError('Failed to fetch data for analytics');
      setLoading(false);
    }
  };

  // Filter data based on selections
  const filteredData = adlData.filter(adl => {
    if (selectedFacility !== 'all') {
      const resident = residents.find(r => r.id === adl.resident);
      if (!resident || resident.facility_id !== selectedFacility) return false;
    }
    if (selectedResident !== 'all' && adl.resident !== parseInt(selectedResident)) {
      return false;
    }
    return true;
  });

  // Chart data helpers (same as before)
  const getADLTimeByQuestion = () => {
    const questionTotals = {};
    filteredData.forEach(adl => {
      const question = adl.question_text || 'Unknown';
      questionTotals[question] = (questionTotals[question] || 0) + (adl.total_minutes || 0);
    });
    return Object.entries(questionTotals)
      .map(([question, total]) => ({
        question,
        shortLabel: question.length > 12 ? question.substring(0, 12) + '…' : question,
        totalMinutes: total,
        totalHours: (total / 60).toFixed(1),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 10);
  };
  const getTimeByDayOfWeek = () => {
    const dayTotals = {
      'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
      'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };
    filteredData.forEach(adl => {
      const times = adl.per_day_shift_times || {};
      Object.entries(times).forEach(([key, value]) => {
        if (key.includes('Mon')) dayTotals['Monday'] += value || 0;
        else if (key.includes('Tues')) dayTotals['Tuesday'] += value || 0;
        else if (key.includes('Wed')) dayTotals['Wednesday'] += value || 0;
        else if (key.includes('Thurs')) dayTotals['Thursday'] += value || 0;
        else if (key.includes('Fri')) dayTotals['Friday'] += value || 0;
        else if (key.includes('Sat')) dayTotals['Saturday'] += value || 0;
        else if (key.includes('Sun')) dayTotals['Sunday'] += value || 0;
      });
    });
    return Object.entries(dayTotals).map(([day, total]) => ({
      day,
      totalMinutes: total,
      totalHours: (total / 60).toFixed(1),
    }));
  };
  const getTimeByShift = () => {
    const shiftTotals = { 'Day': 0, 'Swing': 0, 'NOC': 0 };
    filteredData.forEach(adl => {
      const times = adl.per_day_shift_times || {};
      Object.entries(times).forEach(([key, value]) => {
        if (key.includes('Shift1')) shiftTotals['Day'] += value || 0;
        else if (key.includes('Shift2')) shiftTotals['Swing'] += value || 0;
        else if (key.includes('Shift3')) shiftTotals['NOC'] += value || 0;
      });
    });
    return Object.entries(shiftTotals).map(([shift, total]) => ({
      shift,
      totalMinutes: total,
      totalHours: (total / 60).toFixed(1),
    }));
  };
  const getResidentWorkload = () => {
    const residentTotals = {};
    filteredData.forEach(adl => {
      const resident = residents.find(r => r.id === adl.resident);
      if (resident) {
        const name = resident.name || 'Unknown';
        residentTotals[name] = (residentTotals[name] || 0) + (adl.total_minutes || 0);
      }
    });
    return Object.entries(residentTotals)
      .map(([name, total]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        totalMinutes: total,
        totalHours: (total / 60).toFixed(1),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 8);
  };
  const getFacilityComparison = () => {
    const facilityTotals = {};
    filteredData.forEach(adl => {
      const resident = residents.find(r => r.id === adl.resident);
      if (resident) {
        const facilityName = resident.facility_name || 'Unknown';
        facilityTotals[facilityName] = (facilityTotals[facilityName] || 0) + (adl.total_minutes || 0);
      }
    });
    return Object.entries(facilityTotals).map(([facility, total]) => ({
      facility: facility.length > 20 ? facility.substring(0, 20) + '...' : facility,
      totalMinutes: total,
      totalHours: (total / 60).toFixed(1),
    }));
  };
  const getStatusDistribution = () => {
    const statusCounts = {};
    filteredData.forEach(adl => {
      const status = adl.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  const NoData = () => (
    <Box display="flex" justifyContent="center" alignItems="center" height={CHART_HEIGHT}>
      <Typography color="textSecondary">No data</Typography>
    </Box>
  );

  // Chart renderers
  const renderChart = () => {
    switch (chartTabs[activeChart].key) {
      case 'adl':
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {getADLTimeByQuestion().length === 0 ? <NoData /> : (
              <BarChart data={getADLTimeByQuestion()} margin={{ left: 30, right: 30, top: 40, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shortLabel" angle={-90} textAnchor="end" height={180} style={AXIS_FONT} interval={0} />
                <YAxis style={AXIS_FONT} />
                <Tooltip
                  formatter={(value, name, props) => [`${value} min`, 'Total Time']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      return getADLTimeByQuestion().find(q => q.shortLabel === label)?.question || label;
                    }
                    return label;
                  }}
                  wrapperStyle={LABEL_FONT}
                />
                <Legend wrapperStyle={LABEL_FONT} />
                <Bar dataKey="totalMinutes" fill="#1e3a8a" name="Minutes" />
              </BarChart>
            )}
          </ResponsiveContainer>
        );
      case 'day':
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {getTimeByDayOfWeek().every(d => d.totalMinutes === 0) ? <NoData /> : (
              <LineChart data={getTimeByDayOfWeek()} margin={{ left: 30, right: 30, top: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" style={AXIS_FONT} />
                <YAxis style={AXIS_FONT} />
                <Tooltip formatter={(value) => [`${value} min`, 'Total Time']} wrapperStyle={LABEL_FONT} />
                <Legend wrapperStyle={LABEL_FONT} />
                <Line type="monotone" dataKey="totalMinutes" stroke="#1e3a8a" strokeWidth={4} name="Minutes" />
              </LineChart>
            )}
          </ResponsiveContainer>
        );
      case 'daybar':
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {getTimeByDayOfWeek().every(d => d.totalMinutes === 0) ? <NoData /> : (
              <BarChart data={getTimeByDayOfWeek()} margin={{ left: 30, right: 30, top: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" style={AXIS_FONT} />
                <YAxis style={AXIS_FONT} label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => [`${(value/60).toFixed(1)} h`, 'Total Time']} wrapperStyle={LABEL_FONT} />
                <Legend wrapperStyle={LABEL_FONT} />
                <Bar dataKey="totalMinutes" fill="#10b981" name="Hours" minPointSize={2} isAnimationActive />
              </BarChart>
            )}
          </ResponsiveContainer>
        );
      case 'shift':
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {getTimeByShift().every(s => s.totalMinutes === 0) ? <NoData /> : (
              <PieChart>
                <Pie
                  data={getTimeByShift()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ shift, totalHours }) => `${shift}: ${totalHours}h`}
                  outerRadius={180}
                  fill="#60a5fa"
                  dataKey="totalMinutes"
                  style={LABEL_FONT}
                >
                  {getTimeByShift().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} min`, 'Total Time']} wrapperStyle={LABEL_FONT} />
                <Legend wrapperStyle={LABEL_FONT} />
              </PieChart>
            )}
          </ResponsiveContainer>
        );
      case 'resident':
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {getResidentWorkload().length === 0 ? <NoData /> : (
              <BarChart data={getResidentWorkload()} layout="horizontal" margin={{ left: 60, right: 30, top: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" style={AXIS_FONT} />
                <YAxis dataKey="name" type="category" width={180} style={AXIS_FONT} />
                <Tooltip formatter={(value) => [`${value} min`, 'Total Time']} wrapperStyle={LABEL_FONT} />
                <Legend wrapperStyle={LABEL_FONT} />
                <Bar dataKey="totalMinutes" fill="#10b981" name="Minutes" />
              </BarChart>
            )}
          </ResponsiveContainer>
        );
      case 'facility':
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {getFacilityComparison().length === 0 ? <NoData /> : (
              <AreaChart data={getFacilityComparison()} margin={{ left: 30, right: 30, top: 40, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="facility" angle={-20} textAnchor="end" height={120} style={AXIS_FONT} interval={0} tickFormatter={v => v.length > 22 ? v.slice(0, 22) + '…' : v} />
                <YAxis style={AXIS_FONT} />
                <Tooltip formatter={(value) => [`${value} min`, 'Total Time']} wrapperStyle={LABEL_FONT} />
                <Legend wrapperStyle={LABEL_FONT} />
                <Area type="monotone" dataKey="totalMinutes" stroke="#1e3a8a" fill="#60a5fa" fillOpacity={0.6} name="Minutes" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        );
      case 'status':
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {getStatusDistribution().length === 0 ? <NoData /> : (
              <PieChart>
                <Pie
                  data={getStatusDistribution()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={180}
                  fill="#1e3a8a"
                  dataKey="count"
                  style={LABEL_FONT}
                >
                  {getStatusDistribution().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Count']} wrapperStyle={LABEL_FONT} />
                <Legend wrapperStyle={LABEL_FONT} />
              </PieChart>
            )}
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics Dashboard
      </Typography>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Facility</InputLabel>
              <Select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                label="Facility"
              >
                <MenuItem value="all">All Facilities</MenuItem>
                {facilities.map((facility) => (
                  <MenuItem key={facility.id} value={facility.id}>
                    {facility.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Resident</InputLabel>
              <Select
                value={selectedResident}
                onChange={(e) => setSelectedResident(e.target.value)}
                label="Resident"
              >
                <MenuItem value="all">All Residents</MenuItem>
                {residents.map((resident) => (
                  <MenuItem key={resident.id} value={resident.id}>
                    {resident.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
      {/* Chart Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeChart}
          onChange={(_, v) => setActiveChart(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          {chartTabs.map((tab, idx) => (
            <Tab key={tab.key} label={tab.label} />
          ))}
        </Tabs>
      </Paper>
      {/* Chart Display */}
      <Card sx={{ boxShadow: 4, borderRadius: 3, p: 3, minHeight: CHART_HEIGHT + 80 }}>
        <CardContent>
          {renderChart()}
        </CardContent>
      </Card>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: 'white', bgcolor: 'green', p: 1, borderRadius: 1 }}>
            Graphical Summary
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <Box sx={{ width: '100%', height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 32, right: 32, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Day" fill={shiftColors.Day} name="Day" />
                  <Bar dataKey="Swing" fill={shiftColors.Swing} name="Swing" />
                  <Bar dataKey="NOC" fill={shiftColors.NOC} name="NOC" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Analytics; 