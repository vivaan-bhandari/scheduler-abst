import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Tabs,
  Tab,
  Button,
  Avatar,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  QuestionAnswer as QuestionIcon,
  Business as BusinessIcon,
  Analytics as AnalyticsIcon,
  AdminPanelSettings,
  Dashboard as DashboardIcon,
  Add,
  Upload,
  List,
  Person,
  Sync as SyncIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import FacilityList from '../Facility/FacilityList';
import Analytics from './Analytics';
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
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [hasFacilityAccess, setHasFacilityAccess] = useState(true);
  const [userAccess, setUserAccess] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  
  // Global week selection state
  const { selectedWeek, setSelectedWeek } = useWeek();
  const [selectedFacilityName, setSelectedFacilityName] = useState('');

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

  const isAdmin = user?.role === 'admin' || user?.is_staff;

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    
    // Note: Removed facility reset logic to preserve user selection
    // across different tabs
  };

  const handleFacilityChange = (facilityId, facilityName) => {
    console.log('🔄 Dashboard: Facility changed to', facilityId, facilityName);
    setSelectedFacility(facilityId);
    setSelectedFacilityName(facilityName);
    
    // Force a small delay to ensure state updates are processed
    setTimeout(() => {
      console.log('✅ Dashboard: Facility state updated', { facilityId, facilityName });
    }, 100);
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
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Brighton Care Group - Acuity Based Staffing Tool
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isAdmin && (
              <Button
                color="inherit"
                startIcon={<AdminPanelSettings />}
                onClick={() => window.location.href = `${API_BASE_URL}/admin/access-management`}
              >
                Access Management
              </Button>
            )}
            
            <IconButton
              size="large"
              edge="end"
              color="inherit"
              onClick={handleProfileMenuOpen}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
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

      <Container maxWidth={false} sx={{ mt: 3 }}>

        {/* Global Week Selector */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" color="primary.main">
                📅 Current Week: {getWeekLabel(selectedWeek)} (Debug: {selectedWeek})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All data below is filtered for this week (Monday to Sunday)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  const currentMonday = new Date(selectedWeek);
                  currentMonday.setDate(currentMonday.getDate() - 7);
                  setSelectedWeek(currentMonday.toISOString().split('T')[0]);
                }}
              >
                ← Previous Week
              </Button>
              <input
                type="date"
                value={selectedWeek}
                onChange={(e) => {
                  const normalizedMonday = normalizeToMonday(e.target.value);
                  setSelectedWeek(normalizedMonday);
                }}
                style={{
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  const currentMonday = new Date(selectedWeek);
                  currentMonday.setDate(currentMonday.getDate() + 7);
                  setSelectedWeek(currentMonday.toISOString().split('T')[0]);
                }}
              >
                Next Week →
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  const currentWeekMonday = getCurrentWeekMonday();
                  setSelectedWeek(currentWeekMonday);
                }}
                sx={{ ml: 1 }}
              >
                Current Week
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Caregiving Summary Chart */}
        <CaregivingSummaryChart 
          key={`main-chart-${selectedFacility}-${selectedWeek}-${tab}`}
          title={selectedFacility ? `Caregiving Time Summary - ${selectedFacilityName} - ${getWeekLabel(selectedWeek)}` : `Caregiving Time Summary - All Facilities - ${getWeekLabel(selectedWeek)}`}
          endpoint={`${API_BASE_URL}/api/adls/caregiving_summary/`}
          queryParams={{ 
            ...(selectedFacility ? { facility_id: selectedFacility } : {}),
            week_start_date: selectedWeek 
          }}
        />
        {console.log('📊 Dashboard: Rendering chart with params:', { 
          selectedFacility, 
          selectedWeek, 
          tab, 
          facilityName: selectedFacilityName,
          queryParams: { 
            ...(selectedFacility ? { facility_id: selectedFacility } : {}),
            week_start_date: selectedWeek 
          }
        })}

        {/* Main Content Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 3 }}>
            <Tab label="Facility" />
            <Tab label="Scheduling" />
            <Tab label="ADL Analytics" />
            {user.is_staff || user.is_superuser || user.role === 'admin' || user.role === 'superadmin' ? (
              <Tab label="Paycom" />
            ) : null}
            {user.is_staff || user.is_superuser || user.role === 'admin' || user.role === 'superadmin' ? (
              <Tab label="Admin" />
            ) : null}
          </Tabs>

          <Box sx={{ p: 3 }}>
            {tab === 0 && <FacilityList key={`facility-list-${selectedWeek}`} />}
            {tab === 1 && <SchedulingDashboard key={`scheduling-${selectedFacility}-${selectedWeek}`} user={user} onLogout={onLogout} onFacilityChange={handleFacilityChange} initialFacilityId={selectedFacility} initialFacilityName={selectedFacilityName} />}
            {tab === 2 && <ADLAnalytics key={`adl-analytics-${selectedFacility}-${selectedWeek}`} facilityId={selectedFacility} />}
            {tab === 3 && (user.is_staff || user.is_superuser || user.role === 'admin' || user.role === 'superadmin') && <PaycomDashboard key={`paycom-${selectedWeek}`} />}
            {tab === 4 && (user.is_staff || user.is_superuser || user.role === 'admin' || user.role === 'superadmin') && <AccessManagement key={`admin-${selectedWeek}`} />}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Dashboard; 