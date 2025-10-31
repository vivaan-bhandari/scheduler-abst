import React, { useState, useEffect, useRef } from 'react';
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
  Card,
  CardContent,
  Grid,
  Select,
  FormControl,
  InputLabel,
  MenuItem as MuiMenuItem,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  GridOn as GridIcon,
  EventAvailable as AvailabilityIcon,
  TrendingUp as AIIcon,
  AdminPanelSettings,
  AccessTime as ClockIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import StaffManagement from './StaffManagement';
import ShiftTemplates from './ShiftTemplates';
import StaffAssignments from './StaffAssignments';
import WeeklyPlanner from './WeeklyPlanner';
import StaffAvailability from './StaffAvailability';
import AIRecommendations from './AIRecommendations';
import { API_BASE_URL } from '../../config';
import { useWeek } from '../../contexts/WeekContext';

const SchedulingDashboard = ({ user, onLogout, onFacilityChange, initialFacilityId, initialFacilityName }) => {
  const navigate = useNavigate();
  const { selectedWeek, getWeekLabel } = useWeek();
  const [tab, setTab] = useState(0);
  const [selectedFacility, setSelectedFacility] = useState(initialFacilityId || '');
  const [facilities, setFacilities] = useState([]);
  const [stats, setStats] = useState({
    totalStaff: 0,
    totalShifts: 0,
    totalAssignments: 0,
    understaffedShifts: 0,
  });
  const [loading, setLoading] = useState(false);
  const [facilitiesLoading, setFacilitiesLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    fetchFacilities();
  }, []);

  useEffect(() => {
    if (selectedFacility) {
      fetchStats();
    }
  }, [selectedFacility]);

  // Sync with parent component's facility selection
  useEffect(() => {
    if (initialFacilityId && initialFacilityId !== selectedFacility) {
      setSelectedFacility(initialFacilityId);
    }
  }, [initialFacilityId]);

  const fetchFacilities = async () => {
    setFacilitiesLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/facilities/`);
      const facilitiesData = response.data.results || response.data || [];
      
      console.log('🔍 DEBUG - Facilities fetched:', facilitiesData);
      console.log('🔍 DEBUG - First facility:', facilitiesData[0]);
      
      setFacilities(facilitiesData);
      if (facilitiesData.length > 0 && !selectedFacility && !initialFacilityId) {
        const firstFacility = facilitiesData[0];
        console.log('🔍 DEBUG - Auto-selecting first facility:', firstFacility.id, firstFacility.name);
        setSelectedFacility(firstFacility.id);
        
        // Notify parent component about initial facility selection
        if (onFacilityChange) {
          console.log('🔄 SchedulingDashboard: Auto-selecting initial facility', firstFacility.id, firstFacility.name);
          onFacilityChange(firstFacility.id, firstFacility.name);
        }
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
      // Set empty array as fallback to prevent map errors
      setFacilities([]);
    } finally {
      setFacilitiesLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedFacility) return;
    
    setLoading(true);
    try {
      const [staffResponse, shiftsResponse, assignmentsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/scheduling/staff/?facility=${selectedFacility}`),
        axios.get(`${API_BASE_URL}/api/scheduling/shifts/?facility=${selectedFacility}`),
        axios.get(`${API_BASE_URL}/api/scheduling/assignments/?facility=${selectedFacility}`),
      ]);

      const totalStaff = staffResponse.data.count || staffResponse.data.length || 0;
      const totalShifts = shiftsResponse.data.count || shiftsResponse.data.length || 0;
      const totalAssignments = assignmentsResponse.data.count || assignmentsResponse.data.length || 0;
      const understaffedShifts = totalShifts - totalAssignments;

      setStats({
        totalStaff,
        totalShifts,
        totalAssignments,
        understaffedShifts: Math.max(0, understaffedShifts),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Set default stats on error
      setStats({
        totalStaff: 0,
        totalShifts: 0,
        totalAssignments: 0,
        understaffedShifts: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
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

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.is_staff;

  // Add refs to access child component methods
  const weeklyPlannerRef = useRef(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [plannerCurrentWeek, setPlannerCurrentWeek] = useState(null);

  // Update planner current week whenever the tab changes or component mounts
  useEffect(() => {
    if (tab === 5 && weeklyPlannerRef.current && weeklyPlannerRef.current.getCurrentWeek) {
      const currentWeek = weeklyPlannerRef.current.getCurrentWeek();
      setPlannerCurrentWeek(currentWeek);
      console.log('🔍 SchedulingDashboard: Updated plannerCurrentWeek to:', currentWeek);
    }
  }, [tab]);

  // Also update when refresh trigger changes
  useEffect(() => {
    if (weeklyPlannerRef.current && weeklyPlannerRef.current.getCurrentWeek) {
      const currentWeek = weeklyPlannerRef.current.getCurrentWeek();
      setPlannerCurrentWeek(currentWeek);
      console.log('🔍 SchedulingDashboard: Updated plannerCurrentWeek from refresh trigger:', currentWeek);
    }
  }, [refreshTrigger]);

  const handleRefreshPlanner = () => {
    console.log('🔍 SchedulingDashboard: handleRefreshPlanner called');
    console.log('🔍 SchedulingDashboard: weeklyPlannerRef.current:', weeklyPlannerRef.current);
    
    // Get the current week from the planner
    if (weeklyPlannerRef.current && weeklyPlannerRef.current.getCurrentWeek) {
      const currentWeek = weeklyPlannerRef.current.getCurrentWeek();
      setPlannerCurrentWeek(currentWeek);
      console.log('🔍 SchedulingDashboard: Got current week from planner:', currentWeek);
    }
    
    // Trigger refresh by updating the refresh trigger
    setRefreshTrigger(prev => prev + 1);
    console.log('🔍 SchedulingDashboard: Updated refreshTrigger to:', refreshTrigger + 1);
    
    // Also try to call the method directly if the component is mounted
    if (weeklyPlannerRef.current && weeklyPlannerRef.current.refreshData) {
      console.log('🔍 SchedulingDashboard: Calling weeklyPlannerRef.current.refreshData()');
      weeklyPlannerRef.current.refreshData();
    } else {
      console.log('🔍 SchedulingDashboard: weeklyPlannerRef.current or refreshData method not available (component not mounted)');
    }
  };

  const renderTabContent = () => {
    switch (tab) {
      case 0:
        return <StaffManagement facilityId={selectedFacility} />;
      case 1:
        return <ShiftTemplates facilityId={selectedFacility} />;
      case 2:
        return <StaffAssignments facilityId={selectedFacility} />;
      case 3:
        return <WeeklyPlanner ref={weeklyPlannerRef} facilityId={selectedFacility} refreshTrigger={refreshTrigger} />;
      case 4:
        return <StaffAvailability facilityId={selectedFacility} />;
      case 5:
        return <AIRecommendations facilityId={selectedFacility} onRecommendationsApplied={handleRefreshPlanner} currentWeek={plannerCurrentWeek} />;
      default:
        return <StaffManagement facilityId={selectedFacility} />;
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>


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


        {/* Facility Selection */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select Facility
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Choose a facility to manage its scheduling, staff, and shifts
          </Typography>
          <FormControl sx={{ minWidth: 300, mt: 2 }}>
            <InputLabel>Select Facility</InputLabel>
            <Select
              value={selectedFacility}
              label="Select Facility"
              onChange={(e) => {
                const facilityId = e.target.value;
                const facility = facilities.find(f => f.id === facilityId);
                console.log('🔍 DEBUG - Facility selected:', facilityId);
                console.log('🔍 DEBUG - Selected facility object:', facility);
                setSelectedFacility(facilityId);
                
                // Notify parent component about facility change immediately
                if (onFacilityChange && facility) {
                  console.log('🔄 SchedulingDashboard: Notifying parent of facility change', facilityId, facility.name);
                  onFacilityChange(facilityId, facility.name);
                }
              }}
              disabled={facilitiesLoading || !facilities || facilities.length === 0}
            >
              {facilitiesLoading ? (
                <MuiMenuItem disabled>Loading facilities...</MuiMenuItem>
              ) : (facilities || []).map((facility) => (
                <MuiMenuItem key={facility.id} value={facility.id}>
                  {facility.name}
                </MuiMenuItem>
              ))}
            </Select>
          </FormControl>
          {facilitiesLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Loading facilities...
            </Typography>
          )}
          {!facilitiesLoading && (!facilities || facilities.length === 0) && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No facilities available. Please check your access permissions or contact an administrator.
            </Typography>
          )}
        </Paper>

        {/* Dynamic scheduling data check - removed hardcoded week restriction */}

        {/* Summary Statistics */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Staff
                </Typography>
                <Typography variant="h4">
                  {loading ? '...' : stats.totalStaff}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Shifts
                </Typography>
                <Typography variant="h4">
                  {loading ? '...' : stats.totalShifts}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Assignments
                </Typography>
                <Typography variant="h4">
                  {loading ? '...' : stats.totalAssignments}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Understaffed Shifts
                </Typography>
                <Typography variant="h4" color="error">
                  {loading ? '...' : stats.understaffedShifts}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Scheduling Navigation Tabs */}
        <Paper sx={{ width: '100%', mb: 3 }}>
          <Tabs value={tab} onChange={handleTabChange} sx={{ px: 2 }}>
            <Tab 
              label="Staff Management" 
              icon={<PeopleIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Shift Templates" 
              icon={<AssignmentIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Staff Assignments" 
              icon={<ScheduleIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Planner (Grid)" 
              icon={<GridIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Staff Availability" 
              icon={<AvailabilityIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="AI Recommendations" 
              icon={<AIIcon />} 
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {renderTabContent()}
      </Container>
    </Box>
  );
};

export default SchedulingDashboard;
