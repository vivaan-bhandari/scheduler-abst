import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL } from '../config';

// Create axios instance with default configuration
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/users/login/',
  REGISTER: '/api/users/register/',
  LOGOUT: '/api/users/logout/',
  
  // Users
  USERS: '/api/users/',
  USER_PROFILE: '/api/users/profile/',
  
  // Facilities
  FACILITIES: '/api/facilities/',
  FACILITY_SECTIONS: '/api/facilitysections/',
  
  // Residents
  RESIDENTS: '/api/residents/',
  
  // ADLs
  ADLS: '/api/adls/',
  ADL_QUESTIONS: '/api/adls/questions/',
  
  // Scheduling
  STAFF: '/api/scheduling/staff/',
  SHIFT_TEMPLATES: '/api/scheduling/shift-templates/',
  SHIFTS: '/api/scheduling/shifts/',
  STAFF_ASSIGNMENTS: '/api/scheduling/assignments/',
  STAFF_AVAILABILITY: '/api/scheduling/availability/',
  AI_INSIGHTS: '/api/scheduling/ai-insights/',
  AI_RECOMMENDATIONS: '/api/scheduling/ai-recommendations/',
  SCHEDULING_DASHBOARD: '/api/scheduling/dashboard/',
  
  // Facility Access
  FACILITY_ACCESS: '/api/facility-access/',
};

// Generic API methods
export const apiService = {
  // GET request
  get: async <T>(url: string, params?: any): Promise<T> => {
    try {
      const response = await api.get(url, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // POST request
  post: async <T>(url: string, data?: any): Promise<T> => {
    try {
      const response = await api.post(url, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // PUT request
  put: async <T>(url: string, data?: any): Promise<T> => {
    try {
      const response = await api.put(url, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // PATCH request
  patch: async <T>(url: string, data?: any): Promise<T> => {
    try {
      const response = await api.patch(url, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // DELETE request
  delete: async <T>(url: string): Promise<T> => {
    try {
      const response = await api.delete(url);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

// Error handling
const handleApiError = (error: any): Error => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.message || error.response.data?.detail || 'Server error';
    return new Error(message);
  } else if (error.request) {
    // Request made but no response
    return new Error('No response from server');
  } else {
    // Something else happened
    return new Error(error.message || 'Unknown error');
  }
};

export default api;
