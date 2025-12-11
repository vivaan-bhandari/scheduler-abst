import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, Chip, Stepper, Step, StepLabel, IconButton } from '@mui/material';
import axios from 'axios';
import CloseIcon from '@mui/icons-material/Close';
import { API_BASE_URL } from '../../config';

const days = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'];

const ADLList = ({ facilityId }) => {
  const [residents, setResidents] = useState([]);
  const [adlsByResident, setAdlsByResident] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedResident, setSelectedResident] = useState('');
  const [adls, setAdls] = useState([]);
  const [facility, setFacility] = useState(null); // Store facility data for shift_format
  const [editOpen, setEditOpen] = useState(false);
  const [editAdl, setEditAdl] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [wizardForm, setWizardForm] = useState({});
  
  // Get shift labels and mapping based on facility format
  const getShiftLabels = () => {
    if (facility?.shift_format === '2_shift') {
      return ['Day', 'NOC'];
    }
    return ['Day', 'Swing', 'NOC'];
  };
  
  const getShiftMapping = () => {
    if (facility?.shift_format === '2_shift') {
      return {
        'Day': 'Shift1',
        'NOC': 'Shift3'
      };
    }
    return {
      'Day': 'Shift1',
      'Swing': 'Shift2', 
      'NOC': 'Shift3'
    };
  };
  
  const shiftLabels = getShiftLabels();
  const shiftMapping = getShiftMapping();

  useEffect(() => {
    if (facilityId) {
      setLoading(true);
      // Fetch facility data to get shift_format
      axios.get(`${API_BASE_URL}/api/facilities/${facilityId}/`).then(facilityRes => {
        setFacility(facilityRes.data);
      }).catch(err => {
        console.error('Error fetching facility data:', err);
      });
      
      // First get all residents
      axios.get(`${API_BASE_URL}/api/residents/?facility_id=${facilityId}&page_size=1000`).then(res => {
        const allResidents = res.data.results || res.data;
        setResidents(allResidents);
        
        // Then get all ADLs for the facility in one call
        const residentIds = allResidents.map(r => r.id);
        if (residentIds.length > 0) {
          axios.get(`${API_BASE_URL}/api/adls/by_facility/?facility_id=${facilityId}&page_size=1000`).then(adlRes => {
            const allAdls = adlRes.data.results || adlRes.data;
            // Group ADLs by resident
            const grouped = {};
            allAdls.forEach(adl => {
              if (!grouped[adl.resident]) {
                grouped[adl.resident] = [];
              }
              grouped[adl.resident].push(adl);
            });
            setAdlsByResident(grouped);
            setLoading(false);
          });
        } else {
          setAdlsByResident({});
      setLoading(false);
    }
      });
    }
  }, [facilityId]);

  useEffect(() => {
    if (selectedResident) {
      axios.get(`${API_BASE_URL}/api/adls/?resident=${selectedResident}&page_size=1000`).then(res => {
        setAdls(res.data.results || res.data);
      });
    } else {
      setAdls([]);
    }
  }, [selectedResident]);

  const handleEdit = (adl) => {
    setEditAdl(adl);
    setEditForm({
      minutes: adl.minutes,
      frequency: adl.frequency,
      per_day_shift_times: adl.per_day_shift_times || {},
    });
    setEditOpen(true);
  };

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePerDayShiftChange = (day, shift, value) => {
    setEditForm(prev => ({
      ...prev,
      per_day_shift_times: {
        ...prev.per_day_shift_times,
        [`${day}${shiftMapping[shift]}Time`]: value,
      },
    }));
  };

  // Bulk fill templates for common patterns (now fills '1' for selected cells)
  const applyBulkTemplate = (template, formType = 'edit') => {
    const targetForm = formType === 'edit' ? editForm : wizardForm;
    const setTargetForm = formType === 'edit' ? setEditForm : setWizardForm;
    const newPerDayShiftTimes = { ...targetForm.per_day_shift_times };
    switch (template) {
      case 'all_mornings_weekdays':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
        });
        break;
      case 'all_evenings_weekdays':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
        });
        break;
      case 'all_nights_weekdays':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'all_mornings_weekend':
        ['Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
        });
        break;
      case 'all_evenings_weekend':
        ['Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
        });
        break;
      case 'all_nights_weekend':
        ['Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'all_mornings_7days':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
        });
        break;
      case 'all_evenings_7days':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
        });
        break;
      case 'all_nights_7days':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'full_week':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'weekdays_only':
        ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri'].forEach(day => {
          newPerDayShiftTimes[`${day}Shift1Time`] = 1;
          newPerDayShiftTimes[`${day}Shift2Time`] = 1;
          newPerDayShiftTimes[`${day}Shift3Time`] = 1;
        });
        break;
      case 'clear_all':
        Object.keys(newPerDayShiftTimes).forEach(key => {
          newPerDayShiftTimes[key] = 0;
        });
        break;
    }
    setTargetForm(prev => ({
      ...prev,
      per_day_shift_times: newPerDayShiftTimes,
    }));
  };

  // Calculate frequency as the sum of all per-day/shift values (number of times)
  const calculatedFrequency = Object.values(editForm.per_day_shift_times || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const calculatedMinutes = Number(editForm.minutes) || 0;
  const totalTime = calculatedMinutes * calculatedFrequency;
  // For wizardForm:
  const wizardFrequency = Object.values(wizardForm.per_day_shift_times || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const wizardMinutes = Number(wizardForm.minutes) || 0;
  const wizardTotalTime = wizardMinutes * wizardFrequency;

  const handleEditSave = async () => {
    try {
      await axios.patch(`${API_BASE_URL}/api/adls/${editAdl.id}/`, editForm);
      
      // Refresh the list
      axios.get(`${API_BASE_URL}/api/adls/?resident=${selectedResident}&page_size=1000`).then(res => {
        setAdls(res.data.results || res.data);
      });
      
      setEditOpen(false);
      setEditForm({});
    } catch (err) {
      console.error('Error updating ADL:', err);
    }
  };

  const openWizard = () => {
    setWizardIndex(0);
    if (adls.length > 0) {
      setWizardForm({ ...adls[0] });
    }
    setWizardOpen(true);
  };

  const handleWizardChange = (field, value) => {
    setWizardForm(prev => ({ ...prev, [field]: value }));
  };

  const handleWizardPerDayShiftChange = (day, shift, value) => {
    setWizardForm(prev => ({
      ...prev,
      per_day_shift_times: {
        ...prev.per_day_shift_times,
        [`${day}${shiftMapping[shift]}Time`]: value,
      },
    }));
  };

  const saveWizardStep = async () => {
    if (adls[wizardIndex]) {
      try {
        await axios.patch(`${API_BASE_URL}/api/adls/${adls[wizardIndex].id}/`, wizardForm);
        
        // Move to next ADL or finish
        if (wizardIndex < adls.length - 1) {
          setWizardIndex(wizardIndex + 1);
          setWizardForm({});
        } else {
          setWizardOpen(false);
          setWizardIndex(0);
          setWizardForm({});
          
          // Refresh the list
          axios.get(`${API_BASE_URL}/api/adls/?resident=${selectedResident}&page_size=1000`).then(res => {
            setAdls(res.data.results || res.data);
          });
        }
      } catch (err) {
        console.error('Error updating ADL:', err);
      }
    }
  };

  const handleWizardNext = async () => {
    await saveWizardStep();
    if (wizardIndex < adls.length - 1) {
      setWizardIndex(wizardIndex + 1);
      setWizardForm({ ...adls[wizardIndex + 1] });
    }
  };

  const handleWizardPrev = async () => {
    await saveWizardStep();
    if (wizardIndex > 0) {
      setWizardIndex(wizardIndex - 1);
      setWizardForm({ ...adls[wizardIndex - 1] });
    }
  };

  const handleWizardSaveExit = async () => {
    await saveWizardStep();
    setWizardOpen(false);
    // Refresh ADLs
    axios.get(`${API_BASE_URL}/api/adls/?resident=${selectedResident}&page_size=1000`).then(res => {
      setAdls(res.data.results || res.data);
    });
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>ADL Data by Resident</Typography>
      <Paper sx={{ p: 2 }}>
        <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Resident</TableCell>
              <TableCell>Question</TableCell>
                <TableCell>Task Time</TableCell>
                <TableCell>Frequency/Week</TableCell>
                <TableCell>Per-Day/Shift</TableCell>
                <TableCell>Caregiving Time/Week</TableCell>
              <TableCell>Status</TableCell>
                <TableCell>Edit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
              {residents.map(r => (
                adlsByResident[r.id] && adlsByResident[r.id].length > 0 ? (
                  <React.Fragment key={r.id}>
                    <TableRow>
                      <TableCell colSpan={8} style={{ fontWeight: 'bold', background: '#f5f5f5' }}>{r.name}</TableCell>
                    </TableRow>
                    {adlsByResident[r.id].map((adl, idx) => (
              <TableRow key={adl.id}>
                        <TableCell></TableCell>
                <TableCell>{adl.question_text}</TableCell>
                        <TableCell>{adl.minutes} min</TableCell>
                <TableCell>{adl.frequency}</TableCell>
                <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            {days.map(day => (
                              <Box key={day} sx={{ display: 'flex', gap: 1 }}>
                                <Typography variant="caption" sx={{ minWidth: 60 }}>{day}:</Typography>
                                {shiftLabels.map(shift => (
                  <Chip
                                    key={shift}
                    size="small"
                                    label={`${shift}: ${adl.per_day_shift_times?.[`${day}${shiftMapping[shift]}Time`] || 0}`}
                                    sx={{ mr: 0.5 }}
                                  />
                                ))}
                              </Box>
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {adl.total_minutes ? `${(adl.total_minutes / 60).toFixed(2)} hours` : '0 hours'}
                </TableCell>
                <TableCell>
                          <Chip label={adl.status || 'Incomplete'} color={adl.status === 'Complete' ? 'success' : 'warning'} size="small" />
                </TableCell>
                <TableCell>
                          <Button variant="outlined" size="small" onClick={() => handleEdit(adl)}>Edit</Button>
                </TableCell>
              </TableRow>
                    ))}
                  </React.Fragment>
                ) : null
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      </Paper>
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit ADL Entry</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography>{editAdl?.question_text}</Typography>
            </Grid>
            <Grid item xs={6}>
            <TextField
                label="Task Time (min)"
                type="number"
                value={editForm.minutes || ''}
                onChange={e => handleEditFormChange('minutes', e.target.value)}
              fullWidth
              margin="normal"
            />
            </Grid>
            <Grid item xs={6}>
            <TextField
                label="Frequency/Week"
                type="number"
                value={calculatedFrequency || ''}
                onChange={e => handleEditFormChange('frequency', e.target.value)}
              fullWidth
              margin="normal"
            />
            </Grid>
            <Grid item xs={12}>
              <Typography sx={{ mt: 2, mb: 1 }}>Number of times per shift (not minutes)</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>Each cell = number of times this activity is performed during that shift. Total time = number of times × minutes per event.</Typography>
              
              {/* Bulk Fill Templates */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>Quick Fill Templates:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_mornings_weekdays', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Mornings (Weekdays)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_evenings_weekdays', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Evenings (Weekdays)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_nights_weekdays', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Nights (Weekdays)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_mornings_weekend', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Mornings (Weekend)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_evenings_weekend', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Evenings (Weekend)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_nights_weekend', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Nights (Weekend)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_mornings_7days', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Mornings (7 Days)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_evenings_7days', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Evenings (7 Days)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_nights_7days', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Nights (7 Days)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('weekdays_only', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Weekdays Only
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('full_week', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Full Week
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    color="error"
                    onClick={() => applyBulkTemplate('clear_all', 'edit')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Clear All
                  </Button>
                </Box>
              </Box>
              
              <Grid container spacing={1}>
                {days.map(day => (
                  <Grid item xs={12} sm={6} md={4} key={day}>
                    <Typography variant="caption">{day}</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {shiftLabels.map(shift => (
                        <TextField
                          key={shift}
                          label={shift}
                          type="number"
                          size="small"
                          value={editForm.per_day_shift_times?.[`${day}${shiftMapping[shift]}Time`] || ''}
                          onChange={e => handlePerDayShiftChange(day, shift, e.target.value)}
                          sx={{ width: 70 }}
                        />
                      ))}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={wizardOpen} onClose={handleWizardSaveExit} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {`Question ${wizardIndex + 1}`}
          <IconButton onClick={handleWizardSaveExit}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontWeight: 'bold' }}>{wizardForm.question_text}</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
            <TextField
                label="Task Time (min)"
                type="number"
                value={wizardForm.minutes || ''}
                onChange={e => handleWizardChange('minutes', e.target.value)}
              fullWidth
              margin="normal"
            />
            </Grid>
            <Grid item xs={6}>
            <TextField
                label="Additional Time (min)"
                type="number"
                value={wizardForm.additional_time || ''}
                onChange={e => handleWizardChange('additional_time', e.target.value)}
              fullWidth
              margin="normal"
            />
            </Grid>
            <Grid item xs={12}>
              <Typography sx={{ mt: 2, mb: 1 }}>Number of times per shift (not minutes)</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>Each cell = number of times this activity is performed during that shift. Total time = number of times × minutes per event.</Typography>
              
              {/* Bulk Fill Templates */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>Quick Fill Templates:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_mornings_weekdays', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Mornings (Weekdays)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_evenings_weekdays', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Evenings (Weekdays)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_nights_weekdays', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Nights (Weekdays)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_mornings_weekend', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Mornings (Weekend)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_evenings_weekend', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Evenings (Weekend)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_nights_weekend', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Nights (Weekend)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_mornings_7days', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Mornings (7 Days)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_evenings_7days', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Evenings (7 Days)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('all_nights_7days', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    All Nights (7 Days)
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('weekdays_only', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Weekdays Only
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => applyBulkTemplate('full_week', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Full Week
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    color="error"
                    onClick={() => applyBulkTemplate('clear_all', 'wizard')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Clear All
                  </Button>
                </Box>
              </Box>
              
              <Grid container spacing={1}>
                {days.map(day => (
                  <Grid item xs={12} sm={6} md={4} key={day}>
                    <Typography variant="caption">{day}</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {shiftLabels.map(shift => (
                        <TextField
                          key={shift}
                          label={shift}
                          type="number"
                          size="small"
                          value={wizardForm.per_day_shift_times?.[`${day}${shiftMapping[shift]}Time`] || ''}
                          onChange={e => handleWizardPerDayShiftChange(day, shift, e.target.value)}
                          sx={{ width: 70 }}
                        />
                      ))}
          </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleWizardPrev} disabled={wizardIndex === 0}>Previous</Button>
          <Button onClick={handleWizardNext} disabled={wizardIndex === adls.length - 1}>Next</Button>
          <Button onClick={handleWizardSaveExit} variant="contained">Save & Exit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ADLList; 