import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  Menu,
  MenuItem,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  EventAvailable as AvailabilityIcon,
  GridOn as GridIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  TrendingUp as AIIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
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

const SchedulingDashboard = ({ user, initialFacilityId, initialFacilityName }) => {
  const navigate = useNavigate();
  const { selectedWeek, getWeekLabel } = useWeek();
  const [tab, setTab] = useState(0);
  const [selectedFacility, setSelectedFacility] = useState(initialFacilityId || '');
  const [selectedFacilityName, setSelectedFacilityName] = useState(initialFacilityName || '');
  const [stats, setStats] = useState({
    totalStaff: 0,
    totalShifts: 0,
    totalAssignments: 0,
    understaffedShifts: 0,
  });
  const [loading, setLoading] = useState(false);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);

  useEffect(() => {
    if (selectedFacility) {
      fetchStats();
    }
  }, [selectedFacility]);

  const handleMoreMenuOpen = (event) => {
    setMoreMenuAnchor(event.currentTarget);
  };

  const handleMoreMenuClose = () => {
    setMoreMenuAnchor(null);
  };

  const handleMoreMenuSelect = (tabIndex) => {
    setTab(tabIndex);
    handleMoreMenuClose();
  };

  // Sync with parent component's facility selection
  useEffect(() => {
    if (initialFacilityId && initialFacilityId !== selectedFacility) {
      setSelectedFacility(initialFacilityId);
    }
    if (!initialFacilityId) {
      setSelectedFacility('');
    }
    if (typeof initialFacilityName !== 'undefined') {
      setSelectedFacilityName(initialFacilityName || '');
    }
  }, [initialFacilityId, initialFacilityName]);

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

  const handleGoToAI = () => {
    setTab(0);
  };
  
  const handleGoToPlanner = () => {
    setTab(1);
    setStep1Completed(true);
    // Scroll to planner
    setTimeout(() => {
      if (plannerRef.current) {
        plannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleStep1Click = () => {
    setStep1Completed(true);
    setTab(0);
    // If recommendations exist, auto-advance to planner
    if (hasRecommendations) {
      setTimeout(() => {
        handleGoToPlanner();
      }, 300);
    }
  };

  const renderSelectedFacilitySummary = () => {
    if (!selectedFacility) {
      return (
        <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }}>
          Please select a facility to start building your schedule.
        </Alert>
      );
    }

    return (
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0 }}>
          <BusinessIcon color="primary" sx={{ fontSize: 18 }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>
              {selectedFacilityName || 'Selected Facility'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
              {getWeekLabel(selectedWeek)}
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
  };

  const renderSchedulingFlow = () => (
                <Box
                  sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        bgcolor: '#ffffff',
        borderBottom: '2px solid',
        borderColor: '#e5e7eb',
        py: 1.5,
        px: 2,
        mb: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {/* Step 1 Button */}
        <Button
          variant={tab === 0 ? 'contained' : step1Completed ? 'outlined' : 'outlined'}
          color={step1Completed ? 'success' : 'primary'}
          onClick={() => {
            setTab(0);
            if (!step1Completed) {
              handleStep1Click();
            }
          }}
          startIcon={step1Completed ? <CheckCircleIcon /> : null}
            sx={{
            minWidth: 220,
            py: 1,
            borderRadius: 2,
            fontWeight: 600,
            textTransform: 'none',
            borderWidth: step1Completed ? 2 : 1,
            ...(step1Completed && {
              borderColor: 'success.main',
              '&:hover': {
                borderColor: 'success.dark',
                bgcolor: 'success.light',
              }
            })
          }}
        >
          Review AI Recommendations
          {step1Completed && (
            <Chip 
              label="Done" 
              size="small" 
              color="success"
              sx={{ ml: 1, height: 20, fontSize: 10 }}
            />
          )}
        </Button>

        {/* Arrow */}
        <ArrowForwardIcon 
          sx={{ 
            color: step1Completed ? 'success.main' : 'grey.400',
            fontSize: 24,
            transition: 'color 0.3s ease'
          }} 
        />

        {/* Step 2 Button */}
        <Button
          variant={tab === 1 ? 'contained' : 'outlined'}
          color="primary"
            onClick={handleGoToPlanner}
          disabled={!step1Completed}
                  sx={{
            minWidth: 220,
            py: 1,
            borderRadius: 2,
            fontWeight: 600,
            textTransform: 'none',
            opacity: step1Completed ? 1 : 0.5,
            ...(hasRecommendations && step1Completed && {
              borderWidth: 2,
              borderColor: 'success.main',
            })
                  }}
                >
          Open Schedule Planner
          {hasRecommendations && step1Completed && (
            <Chip 
              label="Ready" 
              size="small" 
              color="success"
              sx={{ ml: 1, height: 18, fontSize: 10 }}
            />
          )}
        </Button>
                </Box>
                </Box>
  );

  // Add refs to access child component methods
  const weeklyPlannerRef = useRef(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [plannerCurrentWeek, setPlannerCurrentWeek] = useState(null);
  const [hasRecommendations, setHasRecommendations] = useState(false);
  const [step1Completed, setStep1Completed] = useState(false);
  const plannerRef = useRef(null);

  // Auto-open planner when recommendations exist
  useEffect(() => {
    if (hasRecommendations && tab === 0) {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        setTab(1);
        setStep1Completed(true);
        // Scroll to planner after a brief delay
        setTimeout(() => {
          if (plannerRef.current) {
            plannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      }, 500);
    }
  }, [hasRecommendations]);

  // Update planner current week whenever the tab changes or component mounts
  useEffect(() => {
    if (tab === 1 && weeklyPlannerRef.current && weeklyPlannerRef.current.getCurrentWeek) {
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
        return (
          <AIRecommendations
            facilityId={selectedFacility}
            onRecommendationsApplied={handleRefreshPlanner}
            currentWeek={plannerCurrentWeek}
            onRecommendationsLoaded={(hasRecs) => setHasRecommendations(hasRecs)}
          />
        );
      case 1:
        return (
          <WeeklyPlanner
            ref={weeklyPlannerRef}
            facilityId={selectedFacility}
            refreshTrigger={refreshTrigger}
          />
        );
      case 2:
        return <StaffAssignments facilityId={selectedFacility} />;
      case 3:
        return <StaffManagement facilityId={selectedFacility} />;
      case 4:
        return <ShiftTemplates facilityId={selectedFacility} />;
      case 5:
        return <StaffAvailability facilityId={selectedFacility} />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>


      <Container maxWidth={false} sx={{ mt: 1, px: { xs: 1.5, sm: 2 }, pb: 2 }}>


        {renderSelectedFacilitySummary()}
        {renderSchedulingFlow()}

        {/* Main Navigation Tabs - Only show the two main tabs */}
        <Paper sx={{ width: '100%', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.75 }}>
            <Tabs 
              value={tab < 2 ? tab : false} 
              onChange={(e, newValue) => {
                if (newValue !== false) {
                  handleTabChange(e, newValue);
                }
              }}
            >
              <Tab
                label="Recommendations"
                icon={<AIIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                sx={{ minHeight: 40, fontSize: 12, py: 1 }}
              />
              <Tab
                label="Schedule Planner"
                icon={<GridIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                sx={{ minHeight: 40, fontSize: 12, py: 1 }}
              />
            </Tabs>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {tab >= 2 && (
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  {tab === 2 && 'Viewing: Assignments'}
                  {tab === 3 && 'Viewing: Staff Management'}
                  {tab === 4 && 'Viewing: Shift Templates'}
                  {tab === 5 && 'Viewing: Staff Availability'}
                </Typography>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={handleMoreMenuOpen}
                startIcon={<MoreVertIcon />}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                More Options
              </Button>
              <Menu
                anchorEl={moreMenuAnchor}
                open={Boolean(moreMenuAnchor)}
                onClose={handleMoreMenuClose}
              >
                <MenuItem 
                  onClick={() => handleMoreMenuSelect(2)}
                  selected={tab === 2}
                >
                  <ScheduleIcon sx={{ mr: 1 }} />
                  View Assignments
                </MenuItem>
                <MenuItem 
                  onClick={() => handleMoreMenuSelect(3)}
                  selected={tab === 3}
                >
                  <PeopleIcon sx={{ mr: 1 }} />
                  Manage Staff
                </MenuItem>
                <Divider />
                <MenuItem 
                  onClick={() => handleMoreMenuSelect(4)}
                  selected={tab === 4}
                >
                  <AssignmentIcon sx={{ mr: 1 }} />
                  Shift Templates
                </MenuItem>
                <MenuItem 
                  onClick={() => handleMoreMenuSelect(5)}
                  selected={tab === 5}
                >
                  <AvailabilityIcon sx={{ mr: 1 }} />
                  Staff Availability
                </MenuItem>
              </Menu>
            </Box>
          </Box>
        </Paper>

        {/* Tab Content */}
        <Box ref={plannerRef}>
        {renderTabContent()}
        </Box>
      </Container>
    </Box>
  );
};

export default SchedulingDashboard;
