import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import Dashboard from './components/Dashboard/Dashboard';
import FacilityPage from './components/Facility/FacilityPage';
import FacilitySectionDetails from './components/Facility/FacilitySectionDetails';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import FacilityAccessRequest from './components/Auth/FacilityAccessRequest';
import AccessManagement from './components/Auth/AccessManagement';
import WelcomeScreen from './components/Auth/WelcomeScreen';
import ResidentDetails from './components/Dashboard/ResidentDetails';
import TestConnection from './components/TestConnection';
import WeeklyADLEntryForm from './components/Dashboard/WeeklyADLEntryForm';
import PaycomDashboard from './components/Paycom/PaycomDashboard';
import { WeekProvider } from './contexts/WeekContext';

import axios from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showAccessRequest, setShowAccessRequest] = useState(false);

  useEffect(() => {
    // Check for existing authentication on app load
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      axios.defaults.headers.common['Authorization'] = `Token ${savedToken}`;
      setShowWelcome(false);
    }
  }, []);

  const handleLogin = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    axios.defaults.headers.common['Authorization'] = `Token ${authToken}`;
    setAuthMode('login');
    setShowWelcome(false);
  };

  const handleRegister = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    axios.defaults.headers.common['Authorization'] = `Token ${authToken}`;
    setAuthMode('login');
    setShowWelcome(false);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setShowWelcome(true);
  };

  const handleSwitchToRegister = () => {
    setAuthMode('register');
    setShowWelcome(false);
  };

  const handleSwitchToLogin = () => {
    setAuthMode('login');
    setShowWelcome(false);
  };

  // If not authenticated, show welcome screen, login, or register
  if (!user || !token) {
    if (showWelcome) {
      return (
        <Box sx={{ display: 'flex' }}>
          <CssBaseline />
          <WelcomeScreen 
            onLogin={handleSwitchToLogin} 
            onSignUp={handleSwitchToRegister} 
          />
        </Box>
      );
    }
    return (
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        {authMode === 'login' ? (
          <Login onLogin={handleLogin} onSwitchToRegister={handleSwitchToRegister} />
        ) : (
          <Register onRegister={handleRegister} onSwitchToLogin={handleSwitchToLogin} />
        )}
      </Box>
    );
  }

  // If authenticated but no facility access, show access request
  if (showAccessRequest) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CssBaseline />
        <Box sx={{ flex: 1, p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FacilityAccessRequest 
            onRequestSubmitted={() => setShowAccessRequest(false)}
          />
        </Box>
      </Box>
    );
  }

  // Main authenticated app
  return (
    <WeekProvider>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <Routes>
          <Route 
            path="/" 
            element={
              <Dashboard 
                user={user} 
                onLogout={handleLogout}
              />
            } 
          />

          <Route path="/facility/:facilityId" element={<FacilityPage />} />
          <Route path="/facility-section/:sectionId" element={<FacilitySectionDetails />} />
          <Route 
            path="/admin/access-management" 
            element={<AccessManagement />} 
          />
          <Route path="/resident/:residentId" element={<ResidentDetails />} />
          <Route path="/weekly-adl-entry" element={<WeeklyADLEntryForm />} />
          <Route path="/paycom" element={<PaycomDashboard />} />
          <Route path="/test" element={<TestConnection />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </WeekProvider>
  );
}

export default App;
// Trigger Vercel rebuild
