import React, { useState, useEffect, useMemo } from 'react';
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
import { useWeek } from '../../contexts/WeekContext';

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
  const { selectedWeek } = useWeek();
  const [adlData, setAdlData] = useState([]);
  const [residents, setResidents] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFacility, setSelectedFacility] = useState(facilityId || 'all');
  const [selectedResident, setSelectedResident] = useState('all');
  const [activeChart, setActiveChart] = useState(0);

  // Update selectedFacility when facilityId prop changes
  useEffect(() => {
    if (facilityId) {
      setSelectedFacility(facilityId);
    } else {
      setSelectedFacility('all');
    }
  }, [facilityId]);

  useEffect(() => {
    fetchData();
  }, [facilityId, selectedWeek]);

  useEffect(() => {
    if (adlData.length > 0) {
      setLoading(false);
    }
  }, [adlData]);


  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // If no week selected, show empty data
      if (!selectedWeek) {
        setAdlData([]);
        setResidents([]);
        setFacilities([]);
        setLoading(false);
        return;
      }
      
      // Build query params
      const params = { week_start_date: selectedWeek };
      
      if (facilityId) {
        // Get residents for the facility first
        const residentsRes = await axios.get(`${API_BASE_URL}/api/residents/?facility_id=${facilityId}`);
        const facilityResidents = residentsRes.data.results || residentsRes.data;
        setResidents(facilityResidents);
        
        if (facilityResidents.length > 0) {
          // Try multiple data sources in order of preference
          let foundData = false;
          
          // 1. Try regular ADL data first (most likely to have CSV-imported data)
          try {
            const adlRes = await axios.get(`${API_BASE_URL}/api/adls/by_facility/?facility_id=${facilityId}`);
            const adlData = adlRes.data || [];
            if (adlData.length > 0) {
              const convertedData = adlData.map(adl => ({
                ...adl,
                total_minutes_week: adl.total_minutes || 0,
                total_hours_week: adl.total_hours || 0,
                minutes_per_occurrence: adl.minutes || 0,
                frequency_per_week: adl.frequency || 0,
                question_text: adl.question_text || adl.adl_question_text || 'Unknown',
                per_day_data: adl.per_day_shift_times || {},
              }));
              setAdlData(convertedData);
              foundData = true;
              console.log('Using ADL data:', convertedData.length, 'entries');
            }
          } catch (adlErr) {
            console.log('ADL fetch failed, trying WeeklyADLEntry...', adlErr);
          }
          
          // 2. If no ADL data, try WeeklyADLEntry (for manually entered weekly data)
          if (!foundData) {
            try {
              const entriesRes = await axios.get(`${API_BASE_URL}/api/weekly-adls/`, { params });
              const allEntries = entriesRes.data.results || entriesRes.data || [];
              const residentIds = new Set(facilityResidents.map(r => r.id));
              const facilityEntries = allEntries.filter(entry => {
                const residentId = typeof entry.resident === 'object' ? entry.resident?.id : entry.resident;
                return residentId && residentIds.has(residentId);
              });
              
              if (facilityEntries.length > 0) {
                setAdlData(facilityEntries);
                foundData = true;
                console.log('Using WeeklyADLEntry data:', facilityEntries.length, 'entries');
              }
            } catch (entryErr) {
              console.log('WeeklyADLEntry fetch failed, trying resident total_shift_times...', entryErr);
            }
          }
          
          // 3. If still no data, create synthetic entries from resident.total_shift_times
          // This is the same data source the caregiving summary uses
          if (!foundData) {
            try {
              console.log('Attempting to create synthetic entries from resident.total_shift_times...');
              const syntheticEntries = [];
              const dayMapping = {
                'Mon': 'Monday', 'Tues': 'Tuesday', 'Wed': 'Wednesday', 'Thurs': 'Thursday',
                'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
              };
              const shiftMapping = {
                'Shift1Time': 'Day',
                'Shift2Time': 'Swing',
                'Shift3Time': 'NOC'
              };
              
              // Get unique residents by name (avoid duplicates)
              const uniqueResidents = {};
              facilityResidents.forEach(r => {
                const key = r.name?.toLowerCase().trim();
                if (key && (!uniqueResidents[key] || (r.total_shift_times && Object.keys(r.total_shift_times).length > 0))) {
                  uniqueResidents[key] = r;
                }
              });
              
              console.log('Unique residents with potential data:', Object.keys(uniqueResidents).length);
              
              Object.values(uniqueResidents).forEach(resident => {
                if (resident.total_shift_times && Object.keys(resident.total_shift_times).length > 0) {
                  console.log(`Processing resident ${resident.name} with total_shift_times:`, Object.keys(resident.total_shift_times).length, 'keys');
                  
                  // Create synthetic entries for each day/shift combination
                  // Group by day to create more meaningful analytics
                  const dayData = {};
                  let totalMinutes = 0;
                  
                  Object.entries(resident.total_shift_times).forEach(([key, value]) => {
                    if (value && value > 0) {
                      // Parse key like "ResidentTotalMonShift1Time" -> day="Mon", shift="Shift1Time"
                      for (const [dayPrefix, fullDay] of Object.entries(dayMapping)) {
                        if (key.includes(dayPrefix)) {
                          if (!dayData[fullDay]) {
                            dayData[fullDay] = {};
                          }
                          // Find which shift
                          for (const [shiftKey, shiftName] of Object.entries(shiftMapping)) {
                            if (key.includes(shiftKey)) {
                              dayData[fullDay][shiftName] = (dayData[fullDay][shiftName] || 0) + value;
                              totalMinutes += value;
                              break;
                            }
                          }
                          break;
                        }
                      }
                    }
                  });
                  
                  if (totalMinutes > 0) {
                    // Create a single entry for the resident with all per_day_data
                    // This matches the format expected by the analytics functions
                    const perDayData = {};
                    Object.entries(resident.total_shift_times).forEach(([key, value]) => {
                      if (value && value > 0) {
                        perDayData[key] = value;
                      }
                    });
                    
                    syntheticEntries.push({
                      resident: resident.id,
                      question_text: 'Total Caregiving Time',
                      total_minutes_week: totalMinutes,
                      total_hours_week: totalMinutes / 60,
                      minutes_per_occurrence: Math.round(totalMinutes / 7), // Average per day
                      frequency_per_week: 7, // Daily
                      per_day_data: perDayData,
                      status: 'complete',
                    });
                  }
                }
              });
              
              if (syntheticEntries.length > 0) {
                setAdlData(syntheticEntries);
                foundData = true;
                console.log('✅ Using resident total_shift_times data:', syntheticEntries.length, 'synthetic entries');
                console.log('Sample entry:', syntheticEntries[0]);
              } else {
                console.log('❌ No synthetic entries created - residents may not have total_shift_times data');
              }
            } catch (synthErr) {
              console.error('Error creating synthetic entries:', synthErr);
            }
          }
          
          if (!foundData) {
            console.log('No data found from any source');
            setAdlData([]);
          }
        } else {
          setAdlData([]);
        }
      } else {
        // No facility filter - get all data
        try {
          const [entriesRes, residentsRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/weekly-adls/`, { params }),
            axios.get(`${API_BASE_URL}/api/residents/`),
          ]);
          const entries = entriesRes.data.results || entriesRes.data || [];
          if (entries.length > 0) {
            setAdlData(entries);
          } else {
            // Try ADL fallback
            const adlRes = await axios.get(`${API_BASE_URL}/api/adls/`);
            const adlData = adlRes.data.results || adlRes.data || [];
            if (adlData.length > 0) {
              const convertedData = adlData.map(adl => ({
                ...adl,
                total_minutes_week: adl.total_minutes || 0,
                total_hours_week: adl.total_hours || 0,
                minutes_per_occurrence: adl.minutes || 0,
                frequency_per_week: adl.frequency || 0,
                question_text: adl.question_text || adl.adl_question_text || 'Unknown',
                per_day_data: adl.per_day_shift_times || {},
              }));
              setAdlData(convertedData);
            }
          }
          setResidents(residentsRes.data.results || residentsRes.data || []);
        } catch (entryErr) {
          console.error('Error fetching data:', entryErr);
          setAdlData([]);
          const residentsRes = await axios.get(`${API_BASE_URL}/api/residents/`);
          setResidents(residentsRes.data.results || residentsRes.data || []);
        }
      }
      
      // Always get facilities list
      try {
        const facilitiesRes = await axios.get(`${API_BASE_URL}/api/facilities/`);
        setFacilities(facilitiesRes.data.results || facilitiesRes.data || []);
      } catch (facErr) {
        console.error('Error fetching facilities:', facErr);
        setFacilities([]);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(`Failed to fetch data for analytics: ${err.response?.data?.detail || err.message}`);
      setLoading(false);
    }
  };

  // Filter data based on selections (for WeeklyADLEntry)
  const filteredData = useMemo(() => {
    console.log('🔍 Filtering data - adlData length:', adlData.length, 'selectedFacility:', selectedFacility, 'selectedResident:', selectedResident);
    console.log('🔍 Sample adlData entry:', adlData[0]);
    console.log('🔍 Residents count:', residents.length);
    
    // If we have facilityId prop, we've already filtered by facility, so just filter by resident if needed
    const filtered = adlData.filter(entry => {
      // Handle resident field - could be ID or object
      const residentId = typeof entry.resident === 'object' ? entry.resident?.id : entry.resident;
      
      // If facilityId prop is provided, we've already filtered by facility in fetchData
      // So only filter by resident if needed
      if (!facilityId && selectedFacility !== 'all') {
        const resident = residents.find(r => r.id === residentId);
        if (!resident) {
          // Try to get facility_id from resident object if it exists
          const residentFacilityId = typeof entry.resident === 'object' 
            ? entry.resident?.facility_section?.facility 
            : null;
          if (!residentFacilityId || String(residentFacilityId) !== String(selectedFacility)) {
            return false;
          }
        } else if (String(resident.facility_id) !== String(selectedFacility)) {
          return false;
        }
      }
      
      if (selectedResident !== 'all' && String(residentId) !== String(selectedResident)) {
        return false;
      }
      return true;
    });
    
    console.log('✅ Filtered data length:', filtered.length);
    if (filtered.length > 0) {
      console.log('✅ Sample filtered entry:', filtered[0]);
    } else {
      console.log('❌ No data after filtering - check filters and data structure');
    }
    return filtered;
  }, [adlData, selectedFacility, selectedResident, residents, facilityId]);

  // Chart data helpers (updated for WeeklyADLEntry)
  const getADLTimeByQuestion = () => {
    const questionTotals = {};
    console.log('📊 getADLTimeByQuestion - filteredData length:', filteredData.length);
    console.log('📊 Sample filteredData entry:', filteredData[0]);
    
    if (filteredData.length === 0) {
      console.log('❌ No filtered data available');
      return [];
    }
    
    filteredData.forEach((entry, index) => {
      // Handle both WeeklyADLEntry and ADL formats
      const question = entry.question_text || 
                       entry.adl_question_text || 
                       (entry.adl_question && typeof entry.adl_question === 'object' ? entry.adl_question.text : null) ||
                       'Unknown';
      
      // Calculate minutes - handle both WeeklyADLEntry and ADL formats
      let minutes = 0;
      if (entry.total_minutes_week !== undefined && entry.total_minutes_week !== null) {
        minutes = entry.total_minutes_week;
      } else if (entry.total_hours_week !== undefined && entry.total_hours_week !== null) {
        minutes = entry.total_hours_week * 60;
      } else if (entry.total_minutes !== undefined && entry.total_minutes !== null) {
        minutes = entry.total_minutes;
      } else if (entry.total_hours !== undefined && entry.total_hours !== null) {
        minutes = entry.total_hours * 60;
      } else if (entry.minutes_per_occurrence && entry.frequency_per_week) {
        minutes = entry.minutes_per_occurrence * entry.frequency_per_week;
      } else if (entry.minutes && entry.frequency) {
        minutes = entry.minutes * entry.frequency;
      }
      
      if (minutes > 0) {
        questionTotals[question] = (questionTotals[question] || 0) + minutes;
        if (index < 3) {
          console.log(`📊 Entry ${index}: question="${question}", minutes=${minutes}`);
        }
      } else {
        if (index < 3) {
          console.log(`⚠️ Entry ${index}: question="${question}", minutes=0 (skipped)`);
        }
      }
    });
    
    const result = Object.entries(questionTotals)
      .map(([question, total]) => ({
        question,
        shortLabel: question.length > 20 ? question.substring(0, 20) + '…' : question,
        totalMinutes: total,
        totalHours: (total / 60).toFixed(1),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 10);
    console.log('✅ getADLTimeByQuestion result:', result.length, 'items');
    return result;
  };
  const getTimeByDayOfWeek = () => {
    const dayTotals = {
      'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
      'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };
    
    // Map of CSV format day names to standard day names
    const dayMapping = {
      'Mon': 'Monday',
      'Tues': 'Tuesday',
      'Wed': 'Wednesday',
      'Thurs': 'Thursday',
      'Fri': 'Friday',
      'Sat': 'Saturday',
      'Sun': 'Sunday'
    };
    
    filteredData.forEach(entry => {
      // Handle both WeeklyADLEntry and ADL formats
      const perDayData = entry.per_day_data || entry.per_day_shift_times || {};
      const totalHours = entry.total_hours_week || entry.total_hours || 0;
      const totalMinutes = entry.total_minutes_week || entry.total_minutes || (totalHours * 60);
      
      // If per_day_data exists, try to parse it
      if (Object.keys(perDayData).length > 0) {
        // per_day_data might be in CSV format like {"MonShift1Time": 1, "TuesShift1Time": 1, ...}
        // or standard format like {"Monday": 2.5, "Tuesday": 2.3, ...}
        Object.entries(perDayData).forEach(([key, value]) => {
          // Try to extract day name from key
          let dayName = null;
          
          // Check if it's already a standard day name
          if (dayTotals.hasOwnProperty(key)) {
            dayName = key;
          } else {
            // Try to extract from CSV format (e.g., "MonShift1Time" -> "Mon" -> "Monday")
            for (const [shortDay, fullDay] of Object.entries(dayMapping)) {
              if (key.startsWith(shortDay)) {
                dayName = fullDay;
                break;
              }
            }
          }
          
          if (dayName && dayTotals.hasOwnProperty(dayName)) {
            // If value is a frequency count, convert to minutes using minutes_per_occurrence
            // Otherwise assume it's already in hours or minutes
            const minutesPerOccurrence = entry.minutes_per_occurrence || entry.minutes || 0;
            let minutes = 0;
            if (typeof value === 'number') {
              if (value < 100 && minutesPerOccurrence > 0) {
                // Likely a frequency count
                minutes = value * minutesPerOccurrence;
              } else if (value < 1000) {
                // Likely already in minutes
                minutes = value;
              } else {
                // Likely in seconds or some other unit, convert to minutes
                minutes = value / 60;
              }
            }
            dayTotals[dayName] += minutes;
          }
        });
      } else if (totalMinutes > 0) {
        // Distribute evenly across 7 days
        const minutesPerDay = totalMinutes / 7;
        Object.keys(dayTotals).forEach(day => {
          dayTotals[day] += minutesPerDay;
        });
      }
    });
    return Object.entries(dayTotals).map(([day, total]) => ({
      day,
      totalMinutes: total,
      totalHours: (total / 60).toFixed(1),
    }));
  };
  const getTimeByShift = () => {
    const shiftTotals = { 'Day': 0, 'Swing': 0, 'NOC': 0 };
    const shiftMap = {
      'Shift1': 'Day',
      'Shift2': 'Swing',
      'Shift3': 'NOC',
      'Shift1Time': 'Day',
      'Shift2Time': 'Swing',
      'Shift3Time': 'NOC',
    };
    
    filteredData.forEach(entry => {
      const perDayData = entry.per_day_data || entry.per_day_shift_times || {};
      const totalHours = entry.total_hours_week || entry.total_hours || 0;
      const totalMinutes = entry.total_minutes_week || entry.total_minutes || (totalHours * 60);
      
      // Try to extract shift data from per_day_data
      let hasShiftData = false;
      if (Object.keys(perDayData).length > 0) {
        Object.entries(perDayData).forEach(([key, value]) => {
          // Check if this key contains shift information
          for (const [shiftKey, shiftName] of Object.entries(shiftMap)) {
            if (key.includes(shiftKey)) {
              hasShiftData = true;
              const minutesPerOccurrence = entry.minutes_per_occurrence || entry.minutes || 0;
              let minutes = 0;
              if (typeof value === 'number') {
                if (value < 100 && minutesPerOccurrence > 0) {
                  minutes = value * minutesPerOccurrence;
                } else if (value < 1000) {
                  minutes = value;
                } else {
                  minutes = value / 60;
                }
              }
              shiftTotals[shiftName] += minutes;
            }
          }
        });
      }
      
      // If no shift data found, distribute evenly
      if (!hasShiftData && totalMinutes > 0) {
        // Simple distribution: 60% Day, 30% NOC, 10% Swing
        shiftTotals['Day'] += (totalMinutes * 0.6);
        shiftTotals['NOC'] += (totalMinutes * 0.3);
        shiftTotals['Swing'] += (totalMinutes * 0.1);
      }
    });
    return Object.entries(shiftTotals).map(([shift, total]) => ({
      shift,
      totalMinutes: total,
      totalHours: (total / 60).toFixed(1),
    }));
  };
  const getResidentWorkload = () => {
    const residentTotals = {};
    filteredData.forEach(entry => {
      const residentId = typeof entry.resident === 'object' ? entry.resident?.id : entry.resident;
      const resident = residents.find(r => r.id === residentId);
      if (resident) {
        const name = resident.name || 'Unknown';
        // Handle both WeeklyADLEntry and ADL formats
        const minutes = entry.total_minutes_week || 
                       entry.total_minutes || 
                       (entry.total_hours_week ? entry.total_hours_week * 60 : 0) ||
                       (entry.total_hours ? entry.total_hours * 60 : 0);
        if (minutes > 0) {
          residentTotals[name] = (residentTotals[name] || 0) + minutes;
        }
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
    filteredData.forEach(entry => {
      const residentId = typeof entry.resident === 'object' ? entry.resident?.id : entry.resident;
      const resident = residents.find(r => r.id === residentId);
      if (resident) {
        const facilityName = resident.facility_name || 
                            (resident.facility_section && resident.facility_section.facility ? resident.facility_section.facility.name : null) ||
                            'Unknown';
        // Handle both WeeklyADLEntry and ADL formats
        const minutes = entry.total_minutes_week || 
                       entry.total_minutes || 
                       (entry.total_hours_week ? entry.total_hours_week * 60 : 0) ||
                       (entry.total_hours ? entry.total_hours * 60 : 0);
        if (minutes > 0) {
          facilityTotals[facilityName] = (facilityTotals[facilityName] || 0) + minutes;
        }
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

  // Chart renderers
  const renderChart = () => {
    switch (chartTabs[activeChart].key) {
      case 'adl':
        const adlData = getADLTimeByQuestion();
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {adlData.length === 0 ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                <Typography color="textSecondary" variant="h6" gutterBottom>No ADL data available</Typography>
                <Typography color="textSecondary" variant="body2">
                  {selectedWeek ? `No data found for the selected week (${selectedWeek})` : 'Please select a week to view analytics'}
                </Typography>
              </Box>
            ) : (
              <BarChart data={adlData} margin={{ left: 30, right: 30, top: 40, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shortLabel" angle={-90} textAnchor="end" height={180} style={AXIS_FONT} interval={0} />
                <YAxis style={AXIS_FONT} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toFixed(1)} min (${(Number(value) / 60).toFixed(1)} hrs)`, 'Total Time']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      return adlData.find(q => q.shortLabel === label)?.question || label;
                    }
                    return label;
                  }}
                  wrapperStyle={LABEL_FONT}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
                <Legend wrapperStyle={LABEL_FONT} />
                <Bar dataKey="totalMinutes" fill="#1e3a8a" name="Total Minutes" />
              </BarChart>
            )}
          </ResponsiveContainer>
        );
      case 'day':
        const dayData = getTimeByDayOfWeek();
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {dayData.every(d => d.totalMinutes === 0) ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                <Typography color="textSecondary" variant="h6" gutterBottom>No time data by day</Typography>
                <Typography color="textSecondary" variant="body2">
                  {selectedWeek ? `No data found for the selected week (${selectedWeek})` : 'Please select a week to view analytics'}
                </Typography>
              </Box>
            ) : (
              <LineChart data={dayData} margin={{ left: 30, right: 30, top: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" style={AXIS_FONT} />
                <YAxis style={AXIS_FONT} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value) => [`${Number(value).toFixed(1)} min (${(Number(value) / 60).toFixed(1)} hrs)`, 'Total Time']} 
                  wrapperStyle={LABEL_FONT}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
                <Legend wrapperStyle={LABEL_FONT} />
                <Line type="monotone" dataKey="totalMinutes" stroke="#1e3a8a" strokeWidth={4} name="Total Minutes" dot={{ r: 6 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        );
      case 'daybar':
        const dayBarData = getTimeByDayOfWeek();
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {dayBarData.every(d => d.totalMinutes === 0) ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                <Typography color="textSecondary" variant="h6" gutterBottom>No time data by day</Typography>
                <Typography color="textSecondary" variant="body2">
                  {selectedWeek ? `No data found for the selected week (${selectedWeek})` : 'Please select a week to view analytics'}
                </Typography>
              </Box>
            ) : (
              <BarChart data={dayBarData} margin={{ left: 30, right: 30, top: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" style={AXIS_FONT} />
                <YAxis style={AXIS_FONT} label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value) => [`${(Number(value)/60).toFixed(1)} hrs (${Number(value).toFixed(1)} min)`, 'Total Time']} 
                  wrapperStyle={LABEL_FONT}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
                <Legend wrapperStyle={LABEL_FONT} />
                <Bar dataKey="totalMinutes" fill="#10b981" name="Total Hours" minPointSize={2} isAnimationActive />
              </BarChart>
            )}
          </ResponsiveContainer>
        );
      case 'shift':
        const shiftData = getTimeByShift();
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {shiftData.every(s => s.totalMinutes === 0) ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                <Typography color="textSecondary" variant="h6" gutterBottom>No shift data available</Typography>
                <Typography color="textSecondary" variant="body2">
                  {selectedWeek ? `No data found for the selected week (${selectedWeek})` : 'Please select a week to view analytics'}
                </Typography>
              </Box>
            ) : (
              <PieChart>
                <Pie
                  data={shiftData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ shift, totalHours, totalMinutes }) => `${shift}: ${totalHours}h (${totalMinutes.toFixed(0)}m)`}
                  outerRadius={180}
                  fill="#60a5fa"
                  dataKey="totalMinutes"
                  style={LABEL_FONT}
                >
                  {shiftData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={shiftColors[entry.shift] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${Number(value).toFixed(1)} min (${(Number(value) / 60).toFixed(1)} hrs)`, 'Total Time']} 
                  wrapperStyle={LABEL_FONT}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
                <Legend wrapperStyle={LABEL_FONT} />
              </PieChart>
            )}
          </ResponsiveContainer>
        );
      case 'resident':
        const residentData = getResidentWorkload();
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {residentData.length === 0 ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                <Typography color="textSecondary" variant="h6" gutterBottom>No resident workload data</Typography>
                <Typography color="textSecondary" variant="body2">
                  {selectedWeek ? `No data found for the selected week (${selectedWeek})` : 'Please select a week to view analytics'}
                </Typography>
              </Box>
            ) : (
              <BarChart data={residentData} layout="horizontal" margin={{ left: 60, right: 30, top: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" style={AXIS_FONT} label={{ value: 'Minutes', position: 'insideBottom', offset: -5 }} />
                <YAxis dataKey="name" type="category" width={180} style={AXIS_FONT} />
                <Tooltip 
                  formatter={(value) => [`${Number(value).toFixed(1)} min (${(Number(value) / 60).toFixed(1)} hrs)`, 'Total Time']} 
                  wrapperStyle={LABEL_FONT}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
                <Legend wrapperStyle={LABEL_FONT} />
                <Bar dataKey="totalMinutes" fill="#10b981" name="Total Minutes" />
              </BarChart>
            )}
          </ResponsiveContainer>
        );
      case 'facility':
        const facilityData = getFacilityComparison();
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {facilityData.length === 0 ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                <Typography color="textSecondary" variant="h6" gutterBottom>No facility comparison data</Typography>
                <Typography color="textSecondary" variant="body2">
                  {selectedWeek ? `No data found for the selected week (${selectedWeek})` : 'Please select a week to view analytics'}
                </Typography>
              </Box>
            ) : (
              <AreaChart data={facilityData} margin={{ left: 30, right: 30, top: 40, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="facility" angle={-20} textAnchor="end" height={120} style={AXIS_FONT} interval={0} tickFormatter={v => v.length > 22 ? v.slice(0, 22) + '…' : v} />
                <YAxis style={AXIS_FONT} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value) => [`${Number(value).toFixed(1)} min (${(Number(value) / 60).toFixed(1)} hrs)`, 'Total Time']} 
                  wrapperStyle={LABEL_FONT}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
                <Legend wrapperStyle={LABEL_FONT} />
                <Area type="monotone" dataKey="totalMinutes" stroke="#1e3a8a" fill="#60a5fa" fillOpacity={0.6} name="Total Minutes" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        );
      case 'status':
        const statusData = getStatusDistribution();
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {statusData.length === 0 ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                <Typography color="textSecondary" variant="h6" gutterBottom>No status distribution data</Typography>
                <Typography color="textSecondary" variant="body2">
                  {selectedWeek ? `No data found for the selected week (${selectedWeek})` : 'Please select a week to view analytics'}
                </Typography>
              </Box>
            ) : (
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={180}
                  fill="#1e3a8a"
                  dataKey="count"
                  style={LABEL_FONT}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [value, 'Count']} 
                  wrapperStyle={LABEL_FONT}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
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
          {!facilityId && (
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
          )}
          <Grid item xs={12} md={facilityId ? 12 : 6}>
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
    </Box>
  );
};

export default Analytics; 