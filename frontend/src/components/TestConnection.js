import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { apiService, API_ENDPOINTS } from '../services/api';

const TestConnection = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [facilities, setFacilities] = useState([]);
  const [testResults, setTestResults] = useState({});

  const testAPIEndpoints = async () => {
    setLoading(true);
    setError('');
    setTestResults({});

    try {
      // Test basic connectivity
      const results = {};

      // Test facilities endpoint
      try {
        const facilitiesData = await apiService.get(API_ENDPOINTS.FACILITIES);
        results.facilities = '✅ Success';
        setFacilities(facilitiesData.results || facilitiesData);
      } catch (err) {
        results.facilities = `❌ Failed: ${err.message}`;
      }

      // Test ADL questions endpoint
      try {
        const adlQuestions = await apiService.get(API_ENDPOINTS.ADL_QUESTIONS);
        results.adlQuestions = '✅ Success';
      } catch (err) {
        results.adlQuestions = `❌ Failed: ${err.message}`;
      }

      // Test users endpoint
      try {
        const users = await apiService.get(API_ENDPOINTS.USERS);
        results.users = '✅ Success';
      } catch (err) {
        results.users = `❌ Failed: ${err.message}`;
      }

      setTestResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testAPIEndpoints();
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        API Connection Test
      </Typography>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Test Results
          </Typography>
          
          {Object.keys(testResults).length > 0 && (
            <List>
              {Object.entries(testResults).map(([endpoint, result]) => (
                <ListItem key={endpoint}>
                  <ListItemText 
                    primary={`${endpoint}: ${result}`}
                    primaryTypographyProps={{
                      color: result.includes('✅') ? 'success.main' : 'error.main'
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          
          <Button
            variant="contained"
            onClick={testAPIEndpoints}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Test Again'}
          </Button>
        </CardContent>
      </Card>

      {facilities.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Facilities Data (Sample)
            </Typography>
            <List>
              {facilities.slice(0, 3).map((facility) => (
                <ListItem key={facility.id}>
                  <ListItemText
                    primary={facility.name}
                    secondary={`ID: ${facility.id} | Type: ${facility.facility_type || 'N/A'}`}
                  />
                </ListItem>
              ))}
            </List>
            <Typography variant="body2" color="text.secondary">
              Showing {Math.min(facilities.length, 3)} of {facilities.length} facilities
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default TestConnection;
