const config = {
  development: {
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000',
  },
  production: {
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'https://scheduler-abst-production.up.railway.app',
  },
  test: {
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000',
  },
};

// Get the current environment
const getCurrentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return config[env as keyof typeof config] || config.development;
};

// Export the current API base URL
export const API_BASE_URL = getCurrentConfig().API_BASE_URL;

// Export the full config object
export default config; 