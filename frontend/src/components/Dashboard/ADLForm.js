import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../config";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  MenuItem,
  Alert,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import axios from 'axios';

const initialForm = {
  resident: '',
  question_text: '',
  minutes: '',
  frequency: '',
  status: '',
};

const ADLForm = ({ onSuccess }) => {
  const [form, setForm] = useState(initialForm);
  const [residents, setResidents] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchResidents();
  }, []);

  const fetchResidents = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/residents/`);
      setResidents(res.data.results || res.data);
    } catch (err) {
      setError('Failed to fetch residents');
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    // Validation
    if (!form.resident || !form.question_text || !form.minutes || !form.frequency || !form.status) {
      setError('All fields are required.');
      setLoading(false);
      return;
    }
    if (form.minutes < 0 || form.frequency < 0) {
      setError('Minutes and frequency must be positive numbers.');
      setLoading(false);
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/adls/`, {
        ...form,
        minutes: parseInt(form.minutes),
        frequency: parseInt(form.frequency),
      });
      setSuccess('ADL record added successfully!');
      setForm(initialForm);
      onSuccess?.();
    } catch (err) {
      setError('Failed to add ADL record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Add ADL Record
      </Typography>
      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
        <form onSubmit={handleSubmit}>
          <FormControl fullWidth margin="normal">
            <InputLabel id="resident-label">Resident</InputLabel>
            <Select
              labelId="resident-label"
              name="resident"
              value={form.resident}
              label="Resident"
              onChange={handleChange}
              required
            >
              {residents.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="normal"
            fullWidth
            label="Question Text"
            name="question_text"
            value={form.question_text}
            onChange={handleChange}
            required
          />
          <TextField
            margin="normal"
            fullWidth
            label="Minutes"
            name="minutes"
            type="number"
            value={form.minutes}
            onChange={handleChange}
            required
          />
          <TextField
            margin="normal"
            fullWidth
            label="Frequency"
            name="frequency"
            type="number"
            value={form.frequency}
            onChange={handleChange}
            required
          />
          <TextField
            margin="normal"
            fullWidth
            label="Status"
            name="status"
            value={form.status}
            onChange={handleChange}
            required
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Add ADL'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default ADLForm; 