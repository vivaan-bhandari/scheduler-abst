import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  FileUpload as FileUploadIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const ADLUpload = ({ onSuccess, selectedWeek }) => {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importDetails, setImportDetails] = useState(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setSelectedFile(file);
    setUploading(true);
    setImportDetails(null);
    setError('');
    setSuccess('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Add week dates if selectedWeek is provided
    if (selectedWeek) {
      // selectedWeek is in format 'YYYY-MM-DD' (Monday of the week)
      const weekStart = new Date(selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Sunday
      
      formData.append('week_start_date', selectedWeek);
      formData.append('week_end_date', weekEnd.toISOString().split('T')[0]);
    }
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/adls/upload/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportDetails(response.data.details);
      setSuccess('File uploaded successfully!');
      // Trigger parent refresh if provided
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload file. Please check the file format and try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCloseDialog = () => {
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setError('');
    setSuccess('');
    setImportDetails(null);
    setUploading(false);
  };

  return (
    <Box>
      <Button
        variant="contained"
        startIcon={<FileUploadIcon />}
        onClick={() => setUploadDialogOpen(true)}
        sx={{ mb: 2 }}
      >
        Upload ADL Data
      </Button>

      <Dialog open={uploadDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Upload ADL Data</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}
            
            {!success && (
              <>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Upload Real-World ADL Data
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Upload an Excel (.xlsx, .xls) or CSV file containing ADL data from your facility. 
                  The system supports the Mill View Memory Care format with columns like:
                </Typography>
                
                <Box component="ul" sx={{ mb: 2, pl: 2 }}>
                  <li><strong>ResidentName</strong> - Resident's name (can be blank for repeated entries)</li>
                  <li><strong>QuestionText</strong> - ADL activity description</li>
                  <li><strong>TaskTime</strong> - Time per task in minutes</li>
                  <li><strong>TotalFrequency</strong> - Number of times per week</li>
                  <li><strong>TotalTaskTime</strong> - Total time for this activity</li>
                  <li><strong>TotalCaregivingTime</strong> - Total caregiving time</li>
                  <li><strong>MonShift1Time, MonShift2Time, MonShift3Time</strong> - Per-day/shift times (Day/Swing/NOC)</li>
                  <li><strong>ResidentStatus</strong> - Resident status (Complete, etc.)</li>
                </Box>

                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Note:</strong> The system will automatically detect new residents when ResidentName is provided 
                    and group all ADL activities for each resident together.
                  </Typography>
                </Alert>
              </>
            )}

            {importDetails && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                  <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                  Import Summary
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary={`${importDetails.created_residents} new residents created`}
                      secondary="Residents found in the uploaded file"
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary={`${importDetails.created_adls} new ADL entries created`}
                      secondary="New ADL activities added to the system"
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary={`${importDetails.updated_adls} ADL entries updated`}
                      secondary="Existing ADL activities that were updated"
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText 
                      primary={`${importDetails.total_processed} total entries processed`}
                      secondary="Total number of ADL activities processed"
                    />
                  </ListItem>
                </List>
              </Box>
            )}

            <input
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              id="adl-upload-file"
              type="file"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setSelectedFile(file);
                  setError('');
                  setSuccess('');
                  setImportDetails(null);
                }
              }}
            />
            <label htmlFor="adl-upload-file">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                fullWidth
                sx={{ mb: 2 }}
                disabled={uploading}
              >
                Choose File
              </Button>
            </label>
            
            {selectedFile && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Selected file: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={uploading}>
            {success ? 'Close' : 'Cancel'}
          </Button>
          {!success && (
            <Button
              variant="contained"
              onClick={handleFileSelect}
              disabled={!selectedFile || uploading}
              startIcon={uploading ? <CircularProgress size={16} /> : null}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ADLUpload; 