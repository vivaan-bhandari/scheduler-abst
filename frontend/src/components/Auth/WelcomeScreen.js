import React from 'react';
import { Box, Button, Typography, Card, CardContent } from '@mui/material';

const WelcomeScreen = ({ onLogin, onSignUp }) => (
  <Box
    sx={{
      minHeight: '100vh',
      minWidth: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'background.default',
      background: 'linear-gradient(135deg, #e3f0ff 0%, #f8fafc 100%)',
    }}
  >
    <Card
      sx={{
        maxWidth: 420,
        width: '100%',
        boxShadow: 6,
        borderRadius: 4,
        mx: 2,
        background: 'rgba(255,255,255,0.95)',
      }}
    >
      <CardContent sx={{ p: 5, textAlign: 'center' }}>
        <Typography variant="h3" fontWeight={700} gutterBottom sx={{ letterSpacing: 1 }}>
          Welcome to ABST
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3, fontSize: 18 }}>
          Acuity Based Staffing Tool for Senior Care Facilities
        </Typography>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          sx={{ mb: 2, py: 1.5, fontWeight: 600, fontSize: 18, borderRadius: 2 }}
          onClick={onLogin}
        >
          Login
        </Button>
        <Button
          variant="outlined"
          color="primary"
          fullWidth
          size="large"
          sx={{ py: 1.5, fontWeight: 600, fontSize: 18, borderRadius: 2 }}
          onClick={onSignUp}
        >
          Sign Up
        </Button>
      </CardContent>
    </Card>
  </Box>
);

export default WelcomeScreen; 