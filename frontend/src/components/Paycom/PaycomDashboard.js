import React, { useState } from 'react';
import { 
  Box, 
  Tabs, 
  Tab, 
  Typography, 
  Paper,
  Card,
  CardContent,
  Grid,
  Chip
} from '@mui/material';
import { 
  People as PeopleIcon, 
  Sync as SyncIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import PaycomEmployeeList from './PaycomEmployeeList';
import DailyTimeTracking from './DailyTimeTracking';
import PaycomSyncControls from './PaycomSyncControls';

const PaycomDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const TabPanel = ({ children, value, index, ...other }) => {
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`paycom-tabpanel-${index}`}
        aria-labelledby={`paycom-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3 }}>
            {children}
          </Box>
        )}
      </div>
    );
  };

  return (
    <Box>
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Paycom Integration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage employee data synchronization from Paycom SFTP and view imported employee records.
          </Typography>
        </Box>
        
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          aria-label="paycom dashboard tabs"
          sx={{ px: 3 }}
        >
          <Tab 
            icon={<PeopleIcon />} 
            label="Employees" 
            id="paycom-tab-0"
            aria-controls="paycom-tabpanel-0"
          />
          <Tab 
            icon={<TimeIcon />} 
            label="Daily Time Tracking" 
            id="paycom-tab-1"
            aria-controls="paycom-tabpanel-1"
          />
          <Tab 
            icon={<SyncIcon />} 
            label="Sync Controls" 
            id="paycom-tab-2"
            aria-controls="paycom-tabpanel-2"
          />
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index={0}>
        <PaycomEmployeeList />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <DailyTimeTracking />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <PaycomSyncControls />
      </TabPanel>
    </Box>
  );
};

export default PaycomDashboard;
