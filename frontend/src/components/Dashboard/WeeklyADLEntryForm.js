import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Container,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Assessment as AssessmentIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  CheckCircle,
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { useWeek } from '../../contexts/WeekContext';

const WeeklyADLEntryForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedWeek, getWeekLabel, setSelectedWeek } = useWeek();
  const [activeStep, setActiveStep] = useState(0);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [residents, setResidents] = useState([]);
  const [selectedResidents, setSelectedResidents] = useState([]);
  const [adlQuestions, setAdlQuestions] = useState([]);
  const [adlEntries, setAdlEntries] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const weekFromUrl = searchParams.get('week');
  const targetWeek = weekFromUrl || selectedWeek;

  useEffect(() => {
    if (weekFromUrl) {
      setSelectedWeek(weekFromUrl);
    }
    fetchFacilities();
    fetchADLQuestions();
  }, [weekFromUrl, setSelectedWeek]);

  useEffect(() => {
    if (selectedFacility) {
      fetchSections(selectedFacility);
    }
  }, [selectedFacility]);

  useEffect(() => {
    if (selectedSection) {
      fetchResidents(selectedSection);
    }
  }, [selectedSection]);

  const fetchFacilities = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/facilities/`);
      setFacilities(response.data.results || response.data);
    } catch (err) {
      setError('Failed to fetch facilities');
    }
  };

  const fetchADLQuestions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/adl-questions/`);
      setAdlQuestions(response.data.results || response.data);
    } catch (err) {
      setError('Failed to fetch ADL questions');
    }
  };

  const fetchSections = async (facilityId) => {
    try {
      // Use the existing facility sections endpoint
      const response = await axios.get(`${API_BASE_URL}/api/facility-sections/?facility=${facilityId}`);
      setSections(response.data.results || response.data);
    } catch (err) {
      console.error('Failed to fetch sections:', err);
      setError('Failed to fetch sections');
    }
  };

  const fetchResidents = async (sectionId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/residents/?facility_section=${sectionId}`);
      setResidents(response.data.results || response.data);
    } catch (err) {
      console.error('Failed to fetch residents:', err);
      setError('Failed to fetch residents');
    }
  };

  // Check if we're working with a week that has existing data
  const hasExistingData = targetWeek === '2025-07-21';

  const handleResidentSelect = (residentId) => {
    setSelectedResidents(prev => {
      if (prev.includes(residentId)) {
        return prev.filter(id => id !== residentId);
      } else {
        return [...prev, residentId];
      }
    });
  };

  const handleADLEntryChange = (residentId, questionId, field, value) => {
    setAdlEntries(prev => ({
      ...prev,
      [`${residentId}_${questionId}`]: {
        ...prev[`${residentId}_${questionId}`],
        resident: residentId,
        adl_question: questionId,
        week_start_date: targetWeek,
        week_end_date: getWeekEndDate(targetWeek),
        [field]: value
      }
    }));
  };

  const getWeekEndDate = (weekStart) => {
    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return endDate.toISOString().split('T')[0];
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    
    try {
      const entries = Object.values(adlEntries).filter(entry => 
        entry.minutes_per_occurrence && entry.frequency_per_week
      );

      if (entries.length === 0) {
        setError('Please fill in at least one ADL entry');
        return;
      }

      const response = await axios.post(`${API_BASE_URL}/api/weekly-adl-entries/`, entries);
      
      setSuccess(`Successfully created ${entries.length} ADL entries for ${getWeekLabel(targetWeek)}`);
      
      // Navigate back to dashboard after a short delay
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (err) {
      setError('Failed to save ADL entries: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Select Facility', 'Choose Residents', 'Enter ADL Data', 'Review & Save'];

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Facility
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Facility</InputLabel>
              <Select
                value={selectedFacility}
                label="Facility"
                onChange={(e) => setSelectedFacility(e.target.value)}
              >
                {facilities.map((facility) => (
                  <MenuItem key={facility.id} value={facility.id}>
                    {facility.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {selectedFacility && (
              <FormControl fullWidth>
                <InputLabel>Section</InputLabel>
                <Select
                  value={selectedSection}
                  label="Section"
                  onChange={(e) => setSelectedSection(e.target.value)}
                >
                  {sections.map((section) => (
                    <MenuItem key={section.id} value={section.id}>
                      {section.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Residents for ADL Assessment
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select the residents you want to create ADL entries for in {getWeekLabel(targetWeek)}
            </Typography>
            
            {residents.length > 0 ? (
              <Grid container spacing={2}>
                {residents.map((resident) => (
                  <Grid item xs={12} sm={6} md={4} key={resident.id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        border: selectedResidents.includes(resident.id) ? 2 : 1,
                        borderColor: selectedResidents.includes(resident.id) ? 'primary.main' : 'grey.300'
                      }}
                      onClick={() => handleResidentSelect(resident.id)}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <PersonIcon sx={{ mr: 1 }} />
                          <Typography variant="subtitle1">
                            {resident.first_name} {resident.last_name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Room: {resident.room_number || 'N/A'}
                        </Typography>
                        {selectedResidents.includes(resident.id) && (
                          <Chip label="Selected" color="primary" size="small" sx={{ mt: 1 }} />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Alert severity="info">
                <Typography variant="body2">
                  {!hasExistingData 
                    ? "No residents found for this section. This may be because there's no existing data for this week."
                    : "No residents found for the selected section."
                  }
                </Typography>
              </Alert>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Enter ADL Data for Selected Residents
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Fill in the ADL assessment data for each selected resident
            </Typography>

            {selectedResidents.map((residentId) => {
              const resident = residents.find(r => r.id === residentId);
              return (
                <Card key={residentId} sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      {resident?.first_name} {resident?.last_name}
                    </Typography>
                    
                    <Grid container spacing={2}>
                      {adlQuestions.map((question) => (
                        <Grid item xs={12} md={6} key={question.id}>
                          <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              {question.question_text}
                            </Typography>
                            
                            <Grid container spacing={2}>
                              <Grid item xs={6}>
                                <TextField
                                  label="Minutes per occurrence"
                                  type="number"
                                  size="small"
                                  value={adlEntries[`${residentId}_${question.id}`]?.minutes_per_occurrence || ''}
                                  onChange={(e) => handleADLEntryChange(residentId, question.id, 'minutes_per_occurrence', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  label="Frequency per week"
                                  type="number"
                                  size="small"
                                  value={adlEntries[`${residentId}_${question.id}`]?.frequency_per_week || ''}
                                  onChange={(e) => handleADLEntryChange(residentId, question.id, 'frequency_per_week', e.target.value)}
                                />
                              </Grid>
                            </Grid>
                            
                            <FormControl fullWidth sx={{ mt: 2 }}>
                              <InputLabel>Status</InputLabel>
                              <Select
                                value={adlEntries[`${residentId}_${question.id}`]?.status || 'In Progress'}
                                label="Status"
                                size="small"
                                onChange={(e) => handleADLEntryChange(residentId, question.id, 'status', e.target.value)}
                              >
                                <MenuItem value="In Progress">In Progress</MenuItem>
                                <MenuItem value="Complete">Complete</MenuItem>
                                <MenuItem value="Needs Review">Needs Review</MenuItem>
                              </Select>
                            </FormControl>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review ADL Entries
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Review your ADL entries before saving
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                You are about to create ADL entries for {selectedResidents.length} residents 
                for the week of {getWeekLabel(targetWeek)}. 
                This will create {Object.keys(adlEntries).length} total ADL entries.
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={loading}
                size="large"
              >
                {loading ? 'Saving...' : 'Save ADL Entries'}
              </Button>
              
              <Button
                variant="outlined"
                onClick={() => setActiveStep(2)}
                size="large"
              >
                Back to Edit
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  if (success) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            ADL Data Created Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {success}
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/')}
            sx={{ mt: 3 }}
          >
            Return to Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" gutterBottom>
            Create Weekly ADL Data
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {getWeekLabel(targetWeek)}
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!hasExistingData && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Creating new ADL data for {getWeekLabel(targetWeek)}</strong><br />
            This week doesn't have existing ADL data. You can create new weekly ADL entries for the selected residents.
          </Typography>
        </Alert>
      )}

      {hasExistingData && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Adding to existing ADL data for {getWeekLabel(targetWeek)}</strong><br />
            This week already has ADL data. You can add additional entries or update existing ones.
          </Typography>
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mb: 3 }}>
          {renderStepContent(activeStep)}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={() => setActiveStep(activeStep - 1)}
          >
            Back
          </Button>
          
          {activeStep < steps.length - 1 && (
            <Button
              variant="contained"
              onClick={() => setActiveStep(activeStep + 1)}
              disabled={
                (activeStep === 0 && !selectedSection) ||
                (activeStep === 1 && selectedResidents.length === 0)
              }
            >
              Next
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default WeeklyADLEntryForm;
