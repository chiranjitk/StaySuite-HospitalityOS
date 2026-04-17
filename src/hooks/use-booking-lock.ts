'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
export interface BookingLockOptions {
  propertyId: string;
  roomId?: string;
  roomTypeId?: string;
  checkIn: Date | null;
  checkOut: Date | null;
  durationMinutes?: number;
  autoReleaseOnUnmount?: boolean;
  heartbeatInterval?: number; // in seconds
  onLockAcquired?: (lock: LockInfo) => void;
  onLockExpired?: () => void;
  onLockError?: (error: Error) => void;
  onConflict?: (message: string) => void;
}

export interface LockInfo {
  id: string;
  sessionId: string;
  propertyId: string;
  roomId: string | null;
  roomTypeId: string | null;
  startDate: Date;
  endDate: Date;
  expiresAt: Date;
  remainingSeconds: number;
}

export interface LockState {
  isLocked: boolean;
  isLoading: boolean;
  error: string | null;
  lockInfo: LockInfo | null;
  remainingSeconds: number;
}

// Default heartbeat interval
const DEFAULT_HEARTBEAT_INTERVAL = 60; // seconds

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Hook for managing booking session locks
 * 
 * Features:
 * - Auto-acquire lock when dates/room are selected
 * - Auto-release on unmount
 * - Heartbeat to extend lock before expiry
 * - Conflict handling
 */
export function useBookingLock(options: BookingLockOptions) {
  const {
    propertyId,
    roomId,
    roomTypeId,
    checkIn,
    checkOut,
    durationMinutes = 15,
    autoReleaseOnUnmount = true,
    heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL,
    onLockAcquired,
    onLockExpired,
    onLockError,
    onConflict,
  } = options;

  // State
  const [state, setState] = useState<LockState>({
    isLocked: false,
    isLoading: false,
    error: null,
    lockInfo: null,
    remainingSeconds: 0,
  });

  // Refs
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAcquiringRef = useRef(false);
  const prevLockParamsRef = useRef<string>('');

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Start countdown timer
  const startCountdown = useCallback((expiresAt: Date) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      
      setState(prev => ({
        ...prev,
        remainingSeconds: remaining,
      }));

      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current!);
        setState(prev => ({
          ...prev,
          isLocked: false,
          lockInfo: null,
          error: 'Lock expired',
        }));
        onLockExpired?.();
      }
    }, 1000);
  }, [onLockExpired]);

  // Start heartbeat to extend lock
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(async () => {
      if (!sessionIdRef.current) return;

      try {
        const response = await fetch('/api/inventory/lock', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            additionalMinutes: durationMinutes,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setState(prev => ({
            ...prev,
            remainingSeconds: data.data.remainingSeconds,
            lockInfo: prev.lockInfo
              ? { ...prev.lockInfo, expiresAt: new Date(data.data.newExpiry) }
              : null,
          }));
          startCountdown(new Date(data.data.newExpiry));
        }
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, heartbeatInterval * 1000);
  }, [durationMinutes, heartbeatInterval, startCountdown]);

  // Acquire lock
  const acquireLock = useCallback(async () => {
    // Skip if already acquiring or missing required data
    if (isAcquiringRef.current) return;
    if (!propertyId || !checkIn || !checkOut) return;
    if (!roomId && !roomTypeId) return;

    isAcquiringRef.current = true;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/inventory/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomId,
          roomTypeId,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          sessionId: sessionIdRef.current || undefined,
          durationMinutes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const lockInfo: LockInfo = {
          id: data.data.id,
          sessionId: data.data.sessionId,
          propertyId: data.data.propertyId,
          roomId: data.data.roomId,
          roomTypeId: data.data.roomTypeId,
          startDate: new Date(data.data.startDate),
          endDate: new Date(data.data.endDate),
          expiresAt: new Date(data.data.expiresAt),
          remainingSeconds: data.data.remainingSeconds,
        };

        sessionIdRef.current = data.data.sessionId;

        setState({
          isLocked: true,
          isLoading: false,
          error: null,
          lockInfo,
          remainingSeconds: data.data.remainingSeconds,
        });

        startCountdown(lockInfo.expiresAt);
        startHeartbeat();
        onLockAcquired?.(lockInfo);
      } else {
        const errorCode = data.error?.code;
        const errorMessage = data.error?.message || 'Failed to acquire lock';

        setState({
          isLocked: false,
          isLoading: false,
          error: errorMessage,
          lockInfo: null,
          remainingSeconds: 0,
        });

        if (errorCode === 'LOCK_CONFLICT' || errorCode === 'BOOKING_CONFLICT') {
          onConflict?.(errorMessage);
        }

        onLockError?.(new Error(errorMessage));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to acquire lock';
      
      setState({
        isLocked: false,
        isLoading: false,
        error: errorMessage,
        lockInfo: null,
        remainingSeconds: 0,
      });

      onLockError?.(new Error(errorMessage));
    } finally {
      isAcquiringRef.current = false;
    }
  }, [propertyId, roomId, roomTypeId, checkIn, checkOut, durationMinutes, startCountdown, startHeartbeat, onLockAcquired, onLockError, onConflict]);

  // Release lock
  const releaseLock = useCallback(async () => {
    if (!sessionIdRef.current) return;

    clearTimers();

    try {
      await fetch(`/api/inventory/lock?sessionId=${sessionIdRef.current}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error releasing lock:', error);
    }

    sessionIdRef.current = null;
    setState({
      isLocked: false,
      isLoading: false,
      error: null,
      lockInfo: null,
      remainingSeconds: 0,
    });
  }, [clearTimers]);

  // Extend lock manually
  const extendLock = useCallback(async (additionalMinutes?: number) => {
    if (!sessionIdRef.current) return false;

    try {
      const response = await fetch('/api/inventory/lock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          additionalMinutes: additionalMinutes || durationMinutes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          remainingSeconds: data.data.remainingSeconds,
          lockInfo: prev.lockInfo
            ? { ...prev.lockInfo, expiresAt: new Date(data.data.newExpiry) }
            : null,
        }));
        startCountdown(new Date(data.data.newExpiry));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error extending lock:', error);
      return false;
    }
  }, [durationMinutes, startCountdown]);

  // Check availability without acquiring lock
  const checkAvailability = useCallback(async () => {
    if (!propertyId || !checkIn || !checkOut) return null;
    if (!roomId && !roomTypeId) return null;

    try {
      const params = new URLSearchParams({
        propertyId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        ...(roomId && { roomId }),
        ...(roomTypeId && { roomTypeId }),
        ...(sessionIdRef.current && { sessionId: sessionIdRef.current }),
        active: 'true',
      });

      const response = await fetch(`/api/inventory/lock?${params}`);
      const data = await response.json();

      if (data.success) {
        return {
          isAvailable: data.data.isAvailable,
          hasConflicts: data.data.hasConflicts,
          conflictingLocks: data.data.conflictingLocks,
        };
      }
      return null;
    } catch (error) {
      console.error('Error checking availability:', error);
      return null;
    }
  }, [propertyId, roomId, roomTypeId, checkIn, checkOut]);

  // Auto-acquire lock when dates/room change
  useEffect(() => {
    const lockParams = `${propertyId}-${roomId}-${roomTypeId}-${checkIn?.getTime()}-${checkOut?.getTime()}`;
    
    if (propertyId && checkIn && checkOut && (roomId || roomTypeId)) {
      // Only acquire if params changed
      if (prevLockParamsRef.current !== lockParams) {
        prevLockParamsRef.current = lockParams;
        
        // Release existing lock first, then acquire new one
        if (sessionIdRef.current) {
          releaseLock().then(() => {
            acquireLock();
          });
        } else {
          acquireLock();
        }
      }
    }
  }, [propertyId, roomId, roomTypeId, checkIn, checkOut, acquireLock, releaseLock]);

  // Auto-release on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (autoReleaseOnUnmount && sessionIdRef.current) {
        // Use sendBeacon for reliable cleanup on page unload
        const url = `/api/inventory/lock?sessionId=${sessionIdRef.current}`;
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, JSON.stringify({ method: 'DELETE' }));
        } else {
          // Fallback for browsers without sendBeacon
          fetch(url, { method: 'DELETE' }).catch(console.error);
        }
      }
    };
  }, [autoReleaseOnUnmount, clearTimers]);

  // Handle visibility change - refresh lock when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionIdRef.current) {
        extendLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [extendLock]);

  return {
    // State
    isLocked: state.isLocked,
    isLoading: state.isLoading,
    error: state.error,
    lockInfo: state.lockInfo,
    remainingSeconds: state.remainingSeconds,
    
    // Formatted time
    formattedTime: formatTime(state.remainingSeconds),
    
    // Actions
    acquireLock,
    releaseLock,
    extendLock,
    checkAvailability,
    
    // Session ID (for booking API)
    sessionId: sessionIdRef.current,
  };
}

/**
 * Hook for checking availability without lock management
 */
export function useAvailabilityCheck(options: {
  propertyId: string;
  roomId?: string;
  roomTypeId?: string;
  checkIn: Date | null;
  checkOut: Date | null;
}) {
  const [availability, setAvailability] = useState<{
    isAvailable: boolean;
    isLoading: boolean;
    error: string | null;
  }>({
    isAvailable: true,
    isLoading: false,
    error: null,
  });

  const { propertyId, roomId, roomTypeId, checkIn, checkOut } = options;

  const checkAvailabilityFn = useCallback(async () => {
    if (!propertyId || !checkIn || !checkOut) {
      setAvailability({ isAvailable: true, isLoading: false, error: null });
      return;
    }
    if (!roomId && !roomTypeId) {
      setAvailability({ isAvailable: true, isLoading: false, error: null });
      return;
    }

    setAvailability(prev => ({ ...prev, isLoading: true }));

    try {
      const params = new URLSearchParams({
        propertyId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        active: 'true',
        ...(roomId && { roomId }),
        ...(roomTypeId && { roomTypeId }),
      });

      const response = await fetch(`/api/inventory/lock?${params}`);
      const data = await response.json();

      if (data.success) {
        setAvailability({
          isAvailable: data.data.isAvailable,
          isLoading: false,
          error: data.data.isAvailable ? null : data.data.conflictingLocks?.[0]?.reason || 'Not available',
        });
      } else {
        setAvailability({
          isAvailable: false,
          isLoading: false,
          error: data.error?.message || 'Failed to check availability',
        });
      }
    } catch (error) {
      setAvailability({
        isAvailable: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check availability',
      });
    }
  }, [propertyId, roomId, roomTypeId, checkIn, checkOut]);

  useEffect(() => {
    let mounted = true;
    
    const doCheck = async () => {
      if (!propertyId || !checkIn || !checkOut || (!roomId && !roomTypeId)) {
        if (mounted) {
          setAvailability({ isAvailable: true, isLoading: false, error: null });
        }
        return;
      }

      if (mounted) {
        setAvailability(prev => ({ ...prev, isLoading: true }));
      }

      try {
        const params = new URLSearchParams({
          propertyId,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          active: 'true',
          ...(roomId && { roomId }),
          ...(roomTypeId && { roomTypeId }),
        });

        const response = await fetch(`/api/inventory/lock?${params}`);
        const data = await response.json();

        if (mounted) {
          if (data.success) {
            setAvailability({
              isAvailable: data.data.isAvailable,
              isLoading: false,
              error: data.data.isAvailable ? null : data.data.conflictingLocks?.[0]?.reason || 'Not available',
            });
          } else {
            setAvailability({
              isAvailable: false,
              isLoading: false,
              error: data.error?.message || 'Failed to check availability',
            });
          }
        }
      } catch (error) {
        if (mounted) {
          setAvailability({
            isAvailable: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to check availability',
          });
        }
      }
    };

    doCheck();

    return () => {
      mounted = false;
    };
  }, [propertyId, roomId, roomTypeId, checkIn, checkOut]);

  return {
    ...availability,
    recheck: checkAvailabilityFn,
  };
}

export default useBookingLock;
