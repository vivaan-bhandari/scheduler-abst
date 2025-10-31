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
  // Initialize with default week
  const [selectedWeek, setSelectedWeek] = useState(() => {
    return '2025-07-28'; // Default to current week (July 28 - August 3, 2025)
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
