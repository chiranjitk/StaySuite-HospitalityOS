/**
 * Timezone utility functions for backend operations
 * These functions handle timezone-aware date operations for multi-tenant scenarios
 */

/**
 * Get the current date in the tenant's timezone as a YYYY-MM-DD string
 * This is useful for comparing dates without time components
 */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  
  return `${year}-${month}-${day}`;
}

/**
 * Get the current datetime in the tenant's timezone
 */
export function getNowInTimezone(timezone: string): Date {
  const now = new Date();
  return convertToTimezone(now, timezone);
}

/**
 * Convert a UTC date to the tenant's timezone
 */
export function convertToTimezone(utcDate: Date, timezone: string): Date {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(utcDate);
    
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    
    return new Date(
      parseInt(getPart('year')),
      parseInt(getPart('month')) - 1,
      parseInt(getPart('day')),
      parseInt(getPart('hour')),
      parseInt(getPart('minute')),
      parseInt(getPart('second'))
    );
  } catch {
    return utcDate;
  }
}

/**
 * Convert a local date in the tenant's timezone to UTC
 */
export function convertFromTimezone(localDate: Date, timezone: string): Date {
  try {
    // Get the offset for the timezone
    const now = new Date();
    const utcString = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzString = now.toLocaleString('en-US', { timeZone: timezone });
    
    const utcDate = new Date(utcString);
    const tzDate = new Date(tzString);
    const offsetMs = tzDate.getTime() - utcDate.getTime();
    
    return new Date(localDate.getTime() - offsetMs);
  } catch {
    return localDate;
  }
}

/**
 * Get start of day in the tenant's timezone
 */
export function getStartOfDayInTimezone(date: Date | string, timezone: string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localDate = convertToTimezone(d, timezone);
  localDate.setHours(0, 0, 0, 0);
  return convertFromTimezone(localDate, timezone);
}

/**
 * Get end of day in the tenant's timezone
 */
export function getEndOfDayInTimezone(date: Date | string, timezone: string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localDate = convertToTimezone(d, timezone);
  localDate.setHours(23, 59, 59, 999);
  return convertFromTimezone(localDate, timezone);
}

/**
 * Check if a date string (YYYY-MM-DD) is in the past relative to the tenant's timezone
 */
export function isDateInPast(dateString: string, timezone: string): boolean {
  const todayInTz = getTodayInTimezone(timezone);
  return dateString < todayInTz;
}

/**
 * Check if a date string (YYYY-MM-DD) is today in the tenant's timezone
 */
export function isDateToday(dateString: string, timezone: string): boolean {
  const todayInTz = getTodayInTimezone(timezone);
  return dateString === todayInTz;
}

/**
 * Format a date according to the tenant's date format setting
 */
export function formatDateWithFormat(date: Date | string, format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Format time according to the tenant's time format setting
 */
export function formatTimeWithFormat(time: string | Date, use24Hour: boolean): string {
  let date: Date;
  
  if (typeof time === 'string') {
    if (time.includes('T')) {
      date = new Date(time);
    } else {
      date = new Date(`2000-01-01T${time}`);
    }
  } else {
    date = time;
  }
  
  if (isNaN(date.getTime())) {
    return typeof time === 'string' ? time : '--:--';
  }
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24Hour,
  });
}

/**
 * Get the IANA timezone identifier from a common timezone name or offset
 */
export function normalizeTimezone(timezone: string): string {
  // Common timezone mappings
  const timezoneMap: Record<string, string> = {
    'IST': 'Asia/Kolkata',
    'PST': 'America/Los_Angeles',
    'PDT': 'America/Los_Angeles',
    'EST': 'America/New_York',
    'EDT': 'America/New_York',
    'CST': 'America/Chicago',
    'CDT': 'America/Chicago',
    'MST': 'America/Denver',
    'MDT': 'America/Denver',
    'GMT': 'UTC',
    'UTC': 'UTC',
  };
  
  return timezoneMap[timezone] || timezone;
}

/**
 * Get a list of common timezones for dropdowns
 */
export function getCommonTimezones(): Array<{ value: string; label: string; offset: string }> {
  return [
    { value: 'UTC', label: 'UTC', offset: '+00:00' },
    { value: 'America/New_York', label: 'Eastern Time (US)', offset: '-05:00/-04:00' },
    { value: 'America/Chicago', label: 'Central Time (US)', offset: '-06:00/-05:00' },
    { value: 'America/Denver', label: 'Mountain Time (US)', offset: '-07:00/-06:00' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US)', offset: '-08:00/-07:00' },
    { value: 'Europe/London', label: 'London', offset: '+00:00/+01:00' },
    { value: 'Europe/Paris', label: 'Paris', offset: '+01:00/+02:00' },
    { value: 'Europe/Berlin', label: 'Berlin', offset: '+01:00/+02:00' },
    { value: 'Asia/Dubai', label: 'Dubai', offset: '+04:00' },
    { value: 'Asia/Kolkata', label: 'Mumbai/Kolkata', offset: '+05:30' },
    { value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong', offset: '+08:00' },
    { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00' },
    { value: 'Australia/Sydney', label: 'Sydney', offset: '+10:00/+11:00' },
    { value: 'Pacific/Auckland', label: 'Auckland', offset: '+12:00/+13:00' },
  ];
}
