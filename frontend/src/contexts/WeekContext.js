import React, { createContext, useContext, useState } from 'react';

const WeekContext = createContext();

export const useWeek = () => {
  const context = useContext(WeekContext);
  if (!context) {
    throw new Error('useWeek must be used within a WeekProvider');
  }
  return context;
};

export const WeekProvider = ({ children }) => {
  // Helper function to get current week's Monday in LA timezone
  const getCurrentWeekMonday = () => {
    // Get current time
    const now = new Date();
    
    // Get LA time components using Intl.DateTimeFormat
    const laFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long'
    });
    
    // Format to get LA date string
    const laDateParts = laFormatter.formatToParts(now);
    const laYear = parseInt(laDateParts.find(part => part.type === 'year').value);
    const laMonth = parseInt(laDateParts.find(part => part.type === 'month').value);
    const laDay = parseInt(laDateParts.find(part => part.type === 'day').value);
    const weekdayName = laDateParts.find(part => part.type === 'weekday').value.toLowerCase();
    
    // Map weekday name to number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const weekdayMap = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    const dayOfWeek = weekdayMap[weekdayName] || 1;
    
    // Calculate days to Monday (if Sunday, go back 6 days; otherwise go back dayOfWeek - 1 days)
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Create Monday date (using UTC date constructor to avoid timezone issues)
    const mondayUTC = new Date(Date.UTC(laYear, laMonth - 1, laDay - daysToMonday));
    
    // Format as YYYY-MM-DD
    const year = mondayUTC.getUTCFullYear();
    const month = String(mondayUTC.getUTCMonth() + 1).padStart(2, '0');
    const day = String(mondayUTC.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // Initialize with default week (current week in LA time)
  const [selectedWeek, setSelectedWeek] = useState(() => {
    return getCurrentWeekMonday();
  });

  // Helper function to get week label
  const getWeekLabel = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00'); // Force local timezone
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 6);
    const result = `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    console.log(`🔍 getWeekLabel(${dateString}) = ${result}`);
    return result;
  };

  // Helper function to ensure we always use Monday dates
  const normalizeToMonday = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(date);
    monday.setDate(date.getDate() - daysToMonday);
    return monday.toISOString().split('T')[0];
  };

  return (
    <WeekContext.Provider value={{ selectedWeek, setSelectedWeek, getWeekLabel, normalizeToMonday }}>
      {children}
    </WeekContext.Provider>
  );
};
