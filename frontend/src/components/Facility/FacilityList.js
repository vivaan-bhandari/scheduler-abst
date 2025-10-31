import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Skeleton,
  Alert,
  Container,
  Button,
} from '@mui/material';
import {
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { useWeek } from '../../contexts/WeekContext';

const FacilityList = () => {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { selectedWeek, getWeekLabel } = useWeek();

  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/facilities/`);
      setFacilities(response.data.results || response.data);
    } catch (err) {
      setError('Failed to fetch facilities');
      console.error('Error fetching facilities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFacilityClick = (facilityId) => {
    navigate(`/facility/${facilityId}`);
  };

  const handleCreateADLData = () => {
    // Navigate to a new weekly ADL entry form for the selected week
    navigate(`/weekly-adl-entry?week=${selectedWeek}`);
  };

  const getFacilityTypeColor = (type) => {
    const colors = {
      'Memory Care': 'primary',
      'Assisted Living': 'secondary',
      'Skilled Nursing': 'error',
      'Independent Living': 'success',
      'default': 'default'
    };
    return colors[type] || colors.default;
  };

  if (loading) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Facilities
        </Typography>
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={item}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="40%" height={24} />
                  <Skeleton variant="text" width="80%" height={20} />
                  <Skeleton variant="text" width="60%" height={20} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // Check if selected week has ADL data (only Sept 21-27, 2025 has ADL data)
  const hasADLDataForWeek = selectedWeek === '2025-07-21';

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Facilities
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Select a facility to view its sections and manage residents
      </Typography>

      {!hasADLDataForWeek && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Week: {getWeekLabel(selectedWeek)}</strong><br />
            ADL data is not available for this week. You can view facilities and residents, but ADL assessments will be empty. 
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleCreateADLData}
              sx={{ ml: 2 }}
            >
              Create ADL Data
            </Button>
          </Typography>
        </Alert>
      )}

      {hasADLDataForWeek && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Week: {getWeekLabel(selectedWeek)}</strong><br />
            This week has existing ADL data. You can view and manage ADL assessments for residents.
          </Typography>
        </Alert>
      )}

      {facilities.length === 0 ? (
        <Alert severity="info">
          No facilities found. Please contact an administrator to add facilities.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {facilities.map((facility) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={facility.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  }
                }}
              >
                <CardActionArea 
                  onClick={() => handleFacilityClick(facility.id)}
                  sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                        {facility.name}
                      </Typography>
                    </Box>

                    <Box sx={{ space: 1 }}>
                      {facility.address && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <LocationIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {facility.address}
                            {facility.city && `, ${facility.city}`}
                            {facility.state && `, ${facility.state}`}
                          </Typography>
                        </Box>
                      )}

                      {facility.phone && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <PhoneIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {facility.phone}
                          </Typography>
                        </Box>
                      )}

                      {facility.email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <EmailIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {facility.email}
                          </Typography>
                        </Box>
                      )}

                      {facility.admin_name && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Admin: {facility.admin_name}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default FacilityList; 