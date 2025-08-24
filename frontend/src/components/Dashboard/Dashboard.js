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
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import FacilityList from '../Facility/FacilityList';
import Analytics from './Analytics';
import FacilityAccessRequest from '../Auth/FacilityAccessRequest';
import AccessManagement from '../Auth/AccessManagement';
import CaregivingSummaryChart from './CaregivingSummaryChart';
import SchedulingDashboard from '../Scheduling/SchedulingDashboard';
import { API_BASE_URL } from '../../config';

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [hasFacilityAccess, setHasFacilityAccess] = useState(true);
  const [userAccess, setUserAccess] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedFacilityName, setSelectedFacilityName] = useState('');

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
    
    // Reset facility selection when switching to Facility tab
    if (newValue === 0) {
      setSelectedFacility(null);
      setSelectedFacilityName('');
    }
  };

  const handleFacilityChange = (facilityId, facilityName) => {
    setSelectedFacility(facilityId);
    setSelectedFacilityName(facilityName);
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

      <Container maxWidth="xl" sx={{ mt: 3 }}>

        {/* Caregiving Summary Chart */}
        <CaregivingSummaryChart 
          title={selectedFacility ? `Caregiving Time Summary - ${selectedFacilityName}` : "Caregiving Time Summary - All Facilities"}
          endpoint={`${API_BASE_URL}/api/adls/caregiving_summary/`}
          queryParams={selectedFacility ? { facility_id: selectedFacility } : {}}
        />

        {/* Main Content Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 3 }}>
            <Tab label="Facility" />
            <Tab label="Scheduling" />
            {user.is_staff || user.role === 'admin' || user.role === 'superadmin' ? (
              <Tab label="Admin" />
            ) : null}
          </Tabs>

          <Box sx={{ p: 3 }}>
            {tab === 0 && <FacilityList />}
            {tab === 1 && <SchedulingDashboard user={user} onLogout={onLogout} onFacilityChange={handleFacilityChange} />}
            {tab === 2 && (user.is_staff || user.role === 'admin' || user.role === 'superadmin') && <AccessManagement />}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Dashboard; 