import React, { useState, useEffect } from 'react';
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
  Schedule as ScheduleIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import api from '../../services/api';

const PaycomSyncControls = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  useEffect(() => {
    fetchSyncLogs();
  }, []);

  const fetchSyncLogs = async () => {
    try {
      console.log('Fetching sync logs...');
      console.log('Auth token:', localStorage.getItem('authToken'));
      const response = await api.get('/api/paycom/sync-logs/');
      console.log('Sync logs response:', response);
      setSyncLogs(response.data.results || response.data);
    } catch (err) {
      console.error('Error fetching sync logs:', err);
      console.error('Error details:', err.response?.data);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);

      console.log('Starting sync...');
      console.log('Auth token:', localStorage.getItem('authToken'));
      const response = await api.post('/api/paycom/sync/start_sync/', {
        report_type: 'all'
      });

      console.log('Sync response:', response);
      setSyncStatus(response.data);
      setSuccess('Sync started successfully! Check the status below.');
      
      // Refresh sync logs after a short delay
      setTimeout(() => {
        fetchSyncLogs();
      }, 2000);

    } catch (err) {
      console.error('Error starting sync:', err);
      console.error('Error details:', err.response?.data);
      setError(`Failed to start sync: ${err.message || err.response?.data?.detail || 'Please try again.'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRunMigrations = async () => {
    try {
      setMigrating(true);
      setError(null);
      setSuccess(null);
      setMigrationResult(null);

      console.log('Running migrations...');
      const response = await api.post('/api/paycom/run-migrations/');

      console.log('Migration response:', response);
      setMigrationResult(response.data);
      setSuccess('Migrations completed successfully! Please refresh the page.');
      
      // Refresh the page after 2 seconds to show updated admin panel
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (err) {
      console.error('Error running migrations:', err);
      console.error('Error details:', err.response?.data);
      const errorMsg = err.response?.data?.message || err.response?.data?.error_details || err.message || 'Please try again.';
      setError(`Failed to run migrations: ${errorMsg}`);
      if (err.response?.data) {
        setMigrationResult(err.response.data);
      }
    } finally {
      setMigrating(false);
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
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={syncing ? <CircularProgress size={20} /> : <DownloadIcon />}
              onClick={handleSync}
              disabled={syncing}
              color="primary"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>

            <Button
              variant="outlined"
              startIcon={migrating ? <CircularProgress size={20} /> : <StorageIcon />}
              onClick={handleRunMigrations}
              disabled={migrating}
              color="secondary"
            >
              {migrating ? 'Running Migrations...' : 'Run Database Migrations'}
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

          {migrationResult && (
            <Paper sx={{ mt: 2, p: 2, bgcolor: migrationResult.status === 'success' ? 'success.light' : 'error.light' }}>
              <Typography variant="subtitle2" gutterBottom>
                Migration Result: {migrationResult.status === 'success' ? '✓ Success' : '✗ Error'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {migrationResult.message}
              </Typography>
              {migrationResult.output && (
                <Paper sx={{ p: 1, bgcolor: 'background.paper', maxHeight: 200, overflow: 'auto', mt: 1 }}>
                  <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {migrationResult.output}
                  </Typography>
                </Paper>
              )}
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
