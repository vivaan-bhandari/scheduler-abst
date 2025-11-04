import React, { useState, useEffect } from 'react';
import { 
  Card, CardContent, Typography, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Paper, Chip, TextField, 
  InputAdornment, Box, CircularProgress, Alert, Pagination, 
  FormControl, InputLabel, Select, MenuItem, Grid, Button,
  Switch, FormControlLabel
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FilterListIcon from '@mui/icons-material/FilterList';
import api from '../../services/api';
import { useWeek } from '../../contexts/WeekContext';

const PaycomEmployeeList = () => {
  const { selectedWeek, getWeekLabel } = useWeek();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  
  // Filters state
  const [filters, setFilters] = useState({
    status: '',
    facility: '',
    role_type: '',
    zip_code: '',
    available_only: false,
    overtime_eligible: '',
    has_phone: false,
    has_email: false
  });
  
  // Filter options
  const [filterOptions, setFilterOptions] = useState({
    facilities: [],
    roleTypes: ['MedTech', 'Caregiver', 'MedTech/Caregiver', 'Nursing', 'Other'],
    statuses: ['active', 'inactive', 'terminated', 'on_leave']
  });

  // Fetch filter options once on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []); // Only run once on mount

  // Fetch employees when filters/pagination change
  useEffect(() => {
    fetchEmployees();
  }, [currentPage, pageSize, searchTerm, filters, selectedWeek]);

  // Check if selected week is in the future or has no data
  const isFutureWeek = () => {
    if (!selectedWeek) return false;
    const selectedDate = new Date(selectedWeek);
    const today = new Date();
    return selectedDate > today;
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      // If it's a future week, don't fetch data
      if (isFutureWeek()) {
        setEmployees([]);
        setTotalPages(0);
        setTotalCount(0);
        setError(null);
        setLoading(false);
        return;
      }
      
      console.log('🔍 PaycomEmployeeList: Fetching employees with pagination and filters...');
      
      // Check authentication token
      const token = localStorage.getItem('authToken');
      console.log('🔍 PaycomEmployeeList: Auth token exists:', !!token);
      console.log('🔍 PaycomEmployeeList: Auth token preview:', token ? token.substring(0, 20) + '...' : 'None');
      console.log('🔍 PaycomEmployeeList: Full token:', token);
      
      // Check if the token is being added to the request
      console.log('🔍 PaycomEmployeeList: API service headers:', api.defaults.headers);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
        week_start_date: selectedWeek, // Add week filtering
      });
      
      // Add search term
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== false) {
          params.append(key, value.toString());
        }
      });
      
      const url = `/api/paycom/employees/?${params.toString()}`;
      console.log('🔍 PaycomEmployeeList: Making request to:', url);
      
      const response = await api.get(url);
      console.log('🔍 PaycomEmployeeList: Response received:', response.status, response.data);
      
      setEmployees(response.data.results || []);
      setTotalPages(Math.ceil(response.data.count / pageSize));
      setTotalCount(response.data.count);
      setError(null);
    } catch (err) {
      console.error('🚨 PaycomEmployeeList: Error fetching employees:', err);
      console.error('🚨 PaycomEmployeeList: Error response:', err.response?.status, err.response?.data);
      console.error('🚨 PaycomEmployeeList: Error config:', err.config);
      
      if (err.response?.status === 401) {
        setError('Authentication required. Please refresh the page and log in again.');
      } else if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to view employee data.');
      } else if (err.response?.status === 404) {
        setError('Employee data not found. The Paycom integration may not be set up yet.');
      } else {
        setError(`Failed to load employee data: ${err.message || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      console.log('Fetching filter options...');
      
      // Get facility options from the new endpoint
      const facilityResponse = await api.get('/api/paycom/employees/facility_options/');
      const facilities = facilityResponse.data.facilities || [];
      console.log('Facilities loaded:', facilities);
      
      // Get unique values for other filter dropdowns
      const response = await api.get('/api/paycom/employees/?page_size=1000');
      const allEmployees = response.data.results || [];
      console.log('Employees loaded:', allEmployees.length);
      
      console.log('Setting filter options...');
      
      const options = {
        facilities: facilities.sort(),
        roleTypes: ['MedTech', 'Caregiver', 'MedTech/Caregiver', 'Nursing', 'Other'],
        statuses: ['active', 'inactive', 'terminated', 'on_leave']
      };
      
      console.log('Setting filter options:', options);
      setFilterOptions(options);
    } catch (err) {
      console.error('Error fetching filter options:', err);
      // Don't set error state for filter options, just log it
      // The main employee fetch will handle the error display
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handlePageChange = (event, page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (event) => {
    setPageSize(event.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      facility: '',
      role_type: '',
      zip_code: '',
      available_only: false,
      overtime_eligible: '',
      has_phone: false,
      has_email: false
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  const mapPaycomLocationToFacility = (paycomLocation) => {
    const mapping = {
      'Buena Vista': 'Buena Vista',
      'Murray Highland': 'Murray Highland',
      'Posada SL': 'La Posada Senior Living',
      'Markham': 'Markham House Assisted Living',
      'Arbor MC': 'Mill View Memory Care',
      'Corporate': 'Buena Vista',
    };
    
    if (!paycomLocation) return 'N/A';
    
    const location = paycomLocation.trim();
    return mapping[location] || location;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'v':
        return 'success';
      case 'inactive':
      case 't':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'v':
        return 'Active';
      case 't':
        return 'Inactive';
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      default:
        return status || 'Unknown';
    }
  };

  const getRoleTypeColor = (roleType) => {
    switch (roleType?.toLowerCase()) {
      case 'medtech':
        return 'primary';
      case 'caregiver':
        return 'success';
      case 'medtech/caregiver':
        return 'secondary';
      case 'nursing':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  // Show message for future weeks
  if (isFutureWeek()) {
    return (
      <Box sx={{ width: '100%', maxWidth: 'none', mx: 0 }}>
        <Card sx={{ maxWidth: 'none', width: '100%' }}>
          <CardContent sx={{ px: 4, py: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" component="h2">
                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Nursing Staff - {getWeekLabel(selectedWeek)}
              </Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                No Employee Data Available
              </Typography>
              <Typography variant="body2">
                Employee roster data is not available for future weeks. 
                Select a current or past week to view employee information and availability.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

      return (
        <Box sx={{ width: '100%', maxWidth: 'none', mx: 0 }}>
          <Card sx={{ maxWidth: 'none', width: '100%' }}>
            <CardContent sx={{ px: 4, py: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" component="h2">
            <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Nursing Staff - {getWeekLabel(selectedWeek)}
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2" color="text.secondary">
              {totalCount.toLocaleString()} employees total
            </Typography>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <InputLabel>Per Page</InputLabel>
              <Select
                value={pageSize}
                label="Per Page"
                onChange={handlePageSizeChange}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        <TextField
          fullWidth
          placeholder="Search nursing staff by name, ID, role, facility, phone, email, zip code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Filters Section - Always Visible */}
        <Paper elevation={1} sx={{ 
          p: 3, 
          mb: 3, 
          bgcolor: 'white', 
          border: '1px solid #e0e0e0',
          borderRadius: 2
        }}>
          <Box display="flex" alignItems="center" mb={2}>
            <FilterListIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              Filters
            </Typography>
            <Button 
              size="small" 
              variant="outlined"
              onClick={clearFilters}
              sx={{ ml: 2 }}
            >
              Reset to Nursing
            </Button>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <FormControl fullWidth variant="outlined" sx={{ minHeight: 56 }}>
                <InputLabel shrink>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  displayEmpty
                  sx={{ height: 40 }}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {(filterOptions.statuses || ['active', 'inactive', 'terminated', 'on_leave']).map(status => (
                    <MenuItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <FormControl fullWidth variant="outlined" sx={{ minHeight: 56 }}>
                <InputLabel shrink>Facility</InputLabel>
                <Select
                  value={filters.facility}
                  label="Facility"
                  onChange={(e) => handleFilterChange('facility', e.target.value)}
                  displayEmpty
                  sx={{ height: 40 }}
                >
                  <MenuItem value="">All Facilities</MenuItem>
                  {(filterOptions.facilities || []).map(facility => (
                    <MenuItem key={facility} value={facility}>
                      {facility}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={6} lg={2}>
              <FormControl fullWidth variant="outlined" sx={{ minHeight: 56 }}>
                <InputLabel shrink>Role Type</InputLabel>
                <Select
                  value={filters.role_type}
                  label="Role Type"
                  onChange={(e) => handleFilterChange('role_type', e.target.value)}
                  displayEmpty
                  sx={{ height: 40 }}
                >
                  <MenuItem value="">All Role Types</MenuItem>
                  {(filterOptions.roleTypes || ['MedTech', 'Caregiver', 'MedTech/Caregiver', 'Nursing', 'Other']).map(role => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={6} lg={2}>
              <TextField
                fullWidth
                variant="outlined"
                label="Zip Code"
                value={filters.zip_code}
                onChange={(e) => handleFilterChange('zip_code', e.target.value)}
                placeholder="e.g., 97219"
                sx={{ minHeight: 56 }}
                InputLabelProps={{ shrink: true }}
                inputProps={{ style: { height: 40 } }}
              />
            </Grid>
          </Grid>
          
          {/* Toggle Filters Row */}
          <Box mt={3} display="flex" flexWrap="wrap" gap={3} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={filters.available_only}
                  onChange={(e) => handleFilterChange('available_only', e.target.checked)}
                  color="success"
                />
              }
              label="Available Only"
              sx={{ minWidth: 140, ml: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={filters.has_phone}
                  onChange={(e) => handleFilterChange('has_phone', e.target.checked)}
                  color="primary"
                />
              }
              label="Has Phone"
              sx={{ minWidth: 120, ml: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={filters.has_email}
                  onChange={(e) => handleFilterChange('has_email', e.target.checked)}
                  color="secondary"
                />
              }
              label="Has Email"
              sx={{ minWidth: 120, ml: 1 }}
            />
          </Box>
        </Paper>

        <TableContainer component={Paper} sx={{ maxHeight: 600, width: '100%' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1800 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 100 }}>ID</TableCell>
                <TableCell sx={{ minWidth: 180 }}>Name</TableCell>
                <TableCell sx={{ minWidth: 100 }}>Status</TableCell>
                <TableCell sx={{ minWidth: 140 }}>Role Type</TableCell>
                <TableCell sx={{ minWidth: 180 }}>Position</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Department</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Location</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Zip Code</TableCell>
                <TableCell sx={{ minWidth: 160 }}>Contact</TableCell>
                <TableCell sx={{ minWidth: 140 }}>Hire Date</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Availability</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                      {employee.employee_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 'medium' }}>
                        {employee.first_name} {employee.last_name}
                      </Typography>
                      {employee.nickname && (
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          "{employee.nickname}"
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(employee.status)}
                      color={getStatusColor(employee.status)}
                      size="small"
                      sx={{ fontSize: '0.75rem', height: 20 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={employee.role_type || 'Other'}
                      color={getRoleTypeColor(employee.role_type)}
                      size="small"
                      sx={{ fontSize: '0.75rem', height: 20 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                      {employee.position_description || 'N/A'}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {employee.position_family || ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                      {employee.department_description || 'N/A'}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {employee.department_code || ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <LocationOnIcon sx={{ mr: 0.5, fontSize: 14, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          {mapPaycomLocationToFacility(employee.location_description)}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {employee.location_code || ''}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 'medium',
                      color: employee.zip_code ? 'primary.main' : 'text.secondary',
                      fontSize: '0.875rem'
                    }}>
                      {employee.zip_code || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      {employee.phone_number && (
                        <Box display="flex" alignItems="center" mb={0.5}>
                          <PhoneIcon sx={{ mr: 0.5, fontSize: 12, color: 'text.secondary' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                            {employee.phone_number}
                          </Typography>
                        </Box>
                      )}
                      {employee.work_email && (
                        <Box display="flex" alignItems="center">
                          <EmailIcon sx={{ mr: 0.5, fontSize: 12, color: 'text.secondary' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                            {employee.work_email}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                      {formatDate(employee.hire_date)}
                    </Typography>
                    {employee.birth_date && (
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        Born: {formatDate(employee.birth_date)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box>
                      {employee.hours_worked_current_period !== undefined && employee.max_hours_per_week && (
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', display: 'block' }}>
                          {employee.hours_worked_current_period}/{employee.max_hours_per_week}h
                        </Typography>
                      )}
                      {employee.part_time_to_full_time && (
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: 'success.main' }}>
                          PT→FT
                        </Typography>
                      )}
                      {employee.on_leave_date && (
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: 'warning.main' }}>
                          On Leave
                        </Typography>
                      )}
                      {employee.termination_date && (
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: 'error.main' }}>
                          Terminated
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {employees.length === 0 && !loading && (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="text.secondary">
              No employees found matching your criteria.
            </Typography>
          </Box>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Box display="flex" justifyContent="center" mt={3}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
            />
          </Box>
        )}

        {/* Results summary */}
        {totalCount > 0 && (
          <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <Typography variant="body2" color="text.secondary">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} employees
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Page {currentPage} of {totalPages}
            </Typography>
          </Box>
        )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaycomEmployeeList;
