'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface TimezoneSettings {
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

interface TimezoneContextType {
  settings: TimezoneSettings;
  formatTime: (time: string | Date) => string;
  formatDate: (date: string | Date) => string;
  formatDateTime: (dateTime: string | Date) => string;
  convertToLocal: (utcDate: Date | string) => Date;
  convertToUTC: (localDate: Date | string) => Date;
  getCurrentLocalTime: () => Date;
  getStartOfDay: (date?: Date) => Date;
  getEndOfDay: (date?: Date) => Date;
  isTimeInRange: (time: string, start: string, end: string) => boolean;
  refreshSettings: () => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: TimezoneSettings = {
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
};

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TimezoneSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/general');
      const data = await response.json();
      
      if (data.success && data.data?.operations) {
        setSettings({
          timezone: data.data.operations.timezone || defaultSettings.timezone,
          dateFormat: data.data.operations.dateFormat || defaultSettings.dateFormat,
          timeFormat: data.data.operations.timeFormat || defaultSettings.timeFormat,
        });
      }
    } catch (error) {
      console.error('Failed to fetch timezone settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSettings = async () => {
    setIsLoading(true);
    await fetchSettings();
  };

  // Convert UTC date to property's local timezone
  const convertToLocal = useCallback((utcDate: Date | string): Date => {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    try {
      // Get the timezone offset for the property's timezone
      const options: Intl.DateTimeFormatOptions = {
        timeZone: settings.timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      };
      
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(date);
      
      const getPart = (type: string) => parts.find(p => p.type === type)?.value;
      
      return new Date(
        parseInt(getPart('year') || '0'),
        parseInt(getPart('month') || '1') - 1,
        parseInt(getPart('day') || '1'),
        parseInt(getPart('hour') || '0'),
        parseInt(getPart('minute') || '0'),
        parseInt(getPart('second') || '0')
      );
    } catch {
      return date;
    }
  }, [settings.timezone]);

  // Convert property's local time to UTC
  const convertToUTC = useCallback((localDate: Date | string): Date => {
    const date = typeof localDate === 'string' ? new Date(localDate) : localDate;
    try {
      // Get current offset in the property timezone
      const now = new Date();
      const utcString = now.toLocaleString('en-US', { timeZone: 'UTC' });
      const propString = now.toLocaleString('en-US', { timeZone: settings.timezone });
      
      const utcDate = new Date(utcString);
      const propDate = new Date(propString);
      const offsetMs = propDate.getTime() - utcDate.getTime();
      
      return new Date(date.getTime() - offsetMs);
    } catch {
      return date;
    }
  }, [settings.timezone]);

  // Format time according to settings
  const formatTime = useCallback((time: string | Date): string => {
    try {
      let date: Date;
      
      if (typeof time === 'string') {
        // Check if it's an ISO date string (contains T and date info)
        if (time.includes('T') && (time.includes('-') || time.includes('Z'))) {
          // It's an ISO date string like "2024-01-15T14:30:00.000Z"
          date = new Date(time);
        } else {
          // It's a time-only string like "14:30" or "14:30:00"
          date = new Date(`2000-01-01T${time}`);
        }
      } else {
        date = time;
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        return typeof time === 'string' ? time : '--:--';
      }
      
      const options: Intl.DateTimeFormatOptions = {
        timeZone: settings.timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: settings.timeFormat === '12h',
      };
      
      return date.toLocaleTimeString('en-US', options);
    } catch {
      return typeof time === 'string' ? time : '--:--';
    }
  }, [settings.timezone, settings.timeFormat]);

  // Format date according to settings
  const formatDate = useCallback((date: string | Date): string => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      
      const options: Intl.DateTimeFormatOptions = {
        timeZone: settings.timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      };
      
      const localDate = d.toLocaleDateString('en-US', options);
      const [month, day, year] = localDate.split('/');
      
      // Pad with zeros
      const pad = (n: string) => n.padStart(2, '0');
      
      switch (settings.dateFormat) {
        case 'MM/DD/YYYY':
          return `${pad(month)}/${pad(day)}/${year}`;
        case 'DD/MM/YYYY':
          return `${pad(day)}/${pad(month)}/${year}`;
        case 'YYYY-MM-DD':
          return `${year}-${pad(month)}-${pad(day)}`;
        default:
          return `${pad(day)}/${pad(month)}/${year}`;
      }
    } catch {
      return typeof date === 'string' ? date : date.toLocaleDateString();
    }
  }, [settings.timezone, settings.dateFormat]);

  // Format date and time combined
  const formatDateTime = useCallback((dateTime: string | Date): string => {
    return `${formatDate(dateTime)} ${formatTime(dateTime)}`;
  }, [formatDate, formatTime]);

  // Get current time in property's timezone
  const getCurrentLocalTime = useCallback((): Date => {
    return convertToLocal(new Date());
  }, [convertToLocal]);

  // Get start of day in property's timezone
  const getStartOfDay = useCallback((date?: Date): Date => {
    const d = date ? new Date(date) : getCurrentLocalTime();
    const localDate = convertToLocal(d);
    localDate.setHours(0, 0, 0, 0);
    return localDate;
  }, [convertToLocal, getCurrentLocalTime]);

  // Get end of day in property's timezone
  const getEndOfDay = useCallback((date?: Date): Date => {
    const d = date ? new Date(date) : getCurrentLocalTime();
    const localDate = convertToLocal(d);
    localDate.setHours(23, 59, 59, 999);
    return localDate;
  }, [convertToLocal, getCurrentLocalTime]);

  // Check if time is within a range (for check-in/check-out validation)
  const isTimeInRange = useCallback((time: string, start: string, end: string): boolean => {
    const timeMinutes = timeToMinutes(time);
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    
    if (startMinutes <= endMinutes) {
      return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
    } else {
      // Range spans midnight
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }
  }, []);

  // Helper function to convert time string to minutes
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  return (
    <TimezoneContext.Provider value={{
      settings,
      formatTime,
      formatDate,
      formatDateTime,
      convertToLocal,
      convertToUTC,
      getCurrentLocalTime,
      getStartOfDay,
      getEndOfDay,
      isTimeInRange,
      refreshSettings,
      isLoading,
    }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}

// Utility function for non-React contexts
export function formatDateDefault(date: Date | string, format: string = 'DD/MM/YYYY'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

// Utility function for time formatting
export function formatTimeDefault(time: string | Date, use24Hour: boolean = false): string {
  const date = typeof time === 'string' ? new Date(`2000-01-01T${time}`) : time;
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24Hour,
  });
}
