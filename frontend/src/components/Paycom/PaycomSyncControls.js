import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Box, 
  Alert, 
  CircularProgress, 
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Grid,
  Paper
} from '@mui/material';
import { 
  Sync as SyncIcon, 
  CloudDownload as DownloadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import api from '../../services/api';

const PaycomSyncControls = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    fetchSyncLogs();
    return () => {
      // Cleanup polling interval on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const fetchSyncLogs = async () => {
    try {
      console.log('Fetching sync logs...');
      console.log('Auth token:', localStorage.getItem('authToken'));
      const response = await api.get('/api/paycom/sync-logs/');
      console.log('Sync logs response:', response);
      setSyncLogs(response.data.results || response.data);
      return response.data.results || response.data;
    } catch (err) {
      console.error('Error fetching sync logs:', err);
      console.error('Error details:', err.response?.data);
      return [];
    }
  };

  const checkSyncCompletion = async (startTime) => {
    const logs = await fetchSyncLogs();
    if (logs && logs.length > 0) {
      const latestLog = logs[0];
      // Check if sync completed (has completed_at timestamp)
      if (latestLog.completed_at) {
        const completedTime = new Date(latestLog.completed_at);
        const syncStartTime = new Date(startTime);
        // Only consider it complete if it finished after we started the sync
        if (completedTime >= syncStartTime) {
          setSyncInProgress(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setSuccess('Sync completed successfully! Check the logs below for details.');
          return true;
        }
      }
      // Check if sync failed
      if (latestLog.status === 'failed' || latestLog.status === 'error') {
        const failedTime = new Date(latestLog.started_at);
        const syncStartTime = new Date(startTime);
        if (failedTime >= syncStartTime) {
          setSyncInProgress(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setError(`Sync failed: ${latestLog.error_message || 'Unknown error'}`);
          return true;
        }
      }
    }
    return false;
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncInProgress(true);
      setError(null);
      setSuccess(null);

      console.log('Starting sync...');
      console.log('Auth token:', localStorage.getItem('authToken'));
      const response = await api.post('/api/paycom/sync/start_sync/', {
        report_type: 'all'
      });

      console.log('Sync response:', response);
      setSyncStatus(response.data);
      const startTime = new Date().toISOString();
      setSuccess('Sync started in background. This may take a few minutes. Monitoring progress...');
      
      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Poll for sync completion every 5 seconds
      const interval = setInterval(async () => {
        const completed = await checkSyncCompletion(startTime);
        if (completed) {
          clearInterval(interval);
        }
      }, 5000);

      pollingIntervalRef.current = interval;
      
      // Also refresh logs immediately
      setTimeout(() => {
        fetchSyncLogs();
      }, 2000);

    } catch (err) {
      console.error('Error starting sync:', err);
      console.error('Error details:', err.response?.data);
      setError(`Failed to start sync: ${err.message || err.response?.data?.detail || 'Please try again.'}`);
      setSyncInProgress(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    } finally {
      setSyncing(false);
    }
  };


  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'success';
      case 'failed':
      case 'error':
        return 'error';
      case 'in_progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return <CheckIcon />;
      case 'failed':
      case 'error':
        return <ErrorIcon />;
      case 'in_progress':
        return <CircularProgress size={16} />;
      default:
        return <InfoIcon />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const latestSync = syncLogs.length > 0 ? syncLogs[0] : null;

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <SyncIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Paycom Sync Controls
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Manually trigger a sync to download the latest employee data from Paycom SFTP.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity={syncInProgress ? "info" : "success"} sx={{ mb: 2 }}>
              {syncInProgress && (
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={16} />
                  <Typography component="span">{success}</Typography>
                </Box>
              )}
              {!syncInProgress && success}
            </Alert>
          )}

          <Box display="flex" gap={2} alignItems="center">
            <Button
              variant="contained"
              startIcon={syncing || syncInProgress ? <CircularProgress size={20} /> : <DownloadIcon />}
              onClick={handleSync}
              disabled={syncing || syncInProgress}
              color="primary"
            >
              {syncing ? 'Starting...' : syncInProgress ? 'Sync in Progress...' : 'Sync Now'}
            </Button>

            {latestSync && (
              <Chip
                icon={getStatusIcon(latestSync.status)}
                label={`Last sync: ${formatDate(latestSync.started_at)}`}
                color={getStatusColor(latestSync.status)}
                variant="outlined"
              />
            )}
          </Box>

          {syncStatus && (
            <Paper sx={{ mt: 2, p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                Sync Status
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Status:</strong> {syncStatus.status}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Files Processed:</strong> {syncStatus.files_processed || 0}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Files Successful:</strong> {syncStatus.files_successful || 0}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Files Failed:</strong> {syncStatus.files_failed || 0}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Sync History
          </Typography>
          
          {syncLogs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No sync history available.
            </Typography>
          ) : (
            <List>
              {syncLogs.slice(0, 10).map((log, index) => (
                <React.Fragment key={log.id}>
                  <ListItem>
                    <ListItemIcon>
                      {getStatusIcon(log.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            {log.report_type} sync
                          </Typography>
                          <Chip
                            label={log.status}
                            color={getStatusColor(log.status)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            Started: {formatDate(log.started_at)}
                          </Typography>
                          {log.completed_at && (
                            <Typography variant="caption" display="block">
                              Completed: {formatDate(log.completed_at)}
                            </Typography>
                          )}
                          <Typography variant="caption" display="block">
                            Files: {log.files_processed} processed, {log.files_successful} successful, {log.files_failed} failed
                          </Typography>
                          {log.error_message && (
                            <Typography variant="caption" color="error" display="block">
                              Error: {log.error_message}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < syncLogs.slice(0, 10).length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaycomSyncControls;
