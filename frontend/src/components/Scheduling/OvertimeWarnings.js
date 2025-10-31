import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Grid
} from '@mui/material';
import {
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';

const OvertimeWarnings = ({ overtimeData, costAnalysis }) => {
  if (!overtimeData || overtimeData.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <TimeIcon color="success" sx={{ mr: 1 }} />
            <Typography variant="h6" color="success.main">
              No Overtime Issues
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            All staff are within normal working hours. No overtime concerns for this week.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const overtimeStaff = overtimeData.filter(warning => warning.overtime_hours > 0);
  const limitedStaff = overtimeData.filter(warning => warning.overtime_hours === 0);

  return (
    <Box>
      {/* Cost Analysis Summary */}
      {costAnalysis && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <MoneyIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">
                Labor Cost Analysis
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Regular Hours
                </Typography>
                <Typography variant="h6" color="success.main">
                  {costAnalysis.total_regular_hours}h
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Overtime Hours
                </Typography>
                <Typography variant="h6" color="warning.main">
                  {costAnalysis.total_overtime_hours}h
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Regular Cost
                </Typography>
                <Typography variant="h6">
                  ${costAnalysis.estimated_regular_cost}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Overtime Cost
                </Typography>
                <Typography variant="h6" color="warning.main">
                  ${costAnalysis.estimated_overtime_cost}
                </Typography>
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                Total Estimated Cost: ${costAnalysis.total_estimated_cost}
              </Typography>
              <Chip
                label={`${costAnalysis.overtime_percentage}% Overtime`}
                color={costAnalysis.overtime_percentage > 10 ? "error" : "warning"}
                size="small"
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Overtime Warnings */}
      {overtimeStaff.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Overtime Alert</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            The following staff members have already worked overtime this week and should not be assigned additional shifts:
          </Typography>
          <List dense>
            {overtimeStaff.map((warning, index) => (
              <ListItem key={index} sx={{ py: 0.5 }}>
                <ListItemText
                  primary={warning.staff_name}
                  secondary={
                    <Box>
                      <Typography variant="body2" component="span">
                        Role: {warning.role} • Total: {warning.total_hours}h • 
                      </Typography>
                      <Chip
                        label={`${warning.overtime_hours}h OT`}
                        color="error"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Limited Hours Warnings */}
      {limitedStaff.length > 0 && (
        <Alert severity="warning">
          <AlertTitle>Limited Availability</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            These staff members have limited hours remaining this week:
          </Typography>
          <List dense>
            {limitedStaff.map((warning, index) => (
              <ListItem key={index} sx={{ py: 0.5 }}>
                <ListItemText
                  primary={warning.staff_name}
                  secondary={`Role: ${warning.role} • Total: ${warning.total_hours}h • ${warning.message.split('only ')[1] || 'Limited availability'}`}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Recommendations */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <WarningIcon color="info" sx={{ mr: 1 }} />
            <Typography variant="h6">
              Recommendations
            </Typography>
          </Box>
          
          {overtimeStaff.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              • Consider hiring additional staff or using agency workers to cover shifts
            </Typography>
          )}
          
          {costAnalysis && costAnalysis.overtime_percentage > 10 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              • High overtime percentage ({costAnalysis.overtime_percentage}%) - review staffing levels
            </Typography>
          )}
          
          <Typography variant="body2" color="text.secondary">
            • Monitor daily time tracking sync to ensure accurate hour calculations
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default OvertimeWarnings;
