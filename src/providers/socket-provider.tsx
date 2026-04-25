'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

// Event Types
export interface RoomStatusEvent {
  roomId: string;
  propertyId: string;
  tenantId: string;
  status: string;
  previousStatus?: string;
  timestamp: string;
}

export interface BookingEvent {
  bookingId: string;
  propertyId: string;
  tenantId: string;
  roomTypeId: string;
  roomId?: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  confirmationCode: string;
  status?: string;
  timestamp: string;
}

export interface TaskEvent {
  taskId: string;
  propertyId: string;
  tenantId: string;
  assignedTo?: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  roomNumber?: string;
  timestamp: string;
}

export interface NotificationEvent {
  id: string;
  tenantId: string;
  userId?: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actionUrl?: string;
  timestamp: string;
}

export interface AvailabilityEvent {
  propertyId: string;
  tenantId: string;
  roomTypeId?: string;
  date: string;
  availableRooms: number;
  totalRooms: number;
  timestamp: string;
}

export interface DashboardUpdateEvent {
  type: 'stats' | 'arrivals' | 'departures' | 'activity' | 'alerts';
  data: Record<string, unknown>;
  timestamp: string;
}

interface SocketContextType {
  // Connection state
  connected: boolean;
  authenticated: boolean;
  error?: string;
  
  // Socket instance
  socket: Socket | null;
  
  // Connection methods
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  
  // Subscription methods
  subscribeToProperty: (propertyId: string) => void;
  unsubscribeFromProperty: (propertyId: string) => void;
  
  // Event emission methods
  emitRoomStatusChange: (roomId: string, status: string, propertyId: string) => void;
  emitBookingUpdate: (bookingId: string, updates: Record<string, unknown>) => void;
  
  // Event listeners registration
  onRoomStatusChange: (callback: (event: RoomStatusEvent) => void) => () => void;
  onBookingCreated: (callback: (event: BookingEvent) => void) => () => void;
  onBookingUpdated: (callback: (event: BookingEvent) => void) => () => void;
  onBookingCancelled: (callback: (event: BookingEvent) => void) => () => void;
  onBookingCheckedIn: (callback: (event: BookingEvent) => void) => () => void;
  onBookingCheckedOut: (callback: (event: BookingEvent) => void) => () => void;
  onTaskAssigned: (callback: (event: TaskEvent) => void) => () => void;
  onNotification: (callback: (event: NotificationEvent) => void) => () => void;
  onAvailabilityChange: (callback: (event: AvailabilityEvent) => void) => () => void;
  onDashboardUpdate: (callback: (event: DashboardUpdateEvent) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  
  const [connectionState, setConnectionState] = useState({
    connected: false,
    authenticated: false,
    error: undefined as string | undefined,
  });

  // Create socket connection
  const createSocket = useCallback(() => {
    if (!user?.tenantId || !user?.id) return null;

    const socket = io('/?XTransformPort=3003', {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        tenantId: user.tenantId,
        userId: user.id,
      },
    });

    return socket;
  }, [user]);

  // Initialize socket
  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = createSocket();
    if (!socket) return;
    
    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      if (process.env.NODE_ENV !== 'production') { console.log('[SocketProvider] Connected to realtime service'); }
      setConnectionState({
        connected: true,
        authenticated: true,
        error: undefined,
      });
    });

    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[SocketProvider] Disconnected:', reason); }
      setConnectionState(prev => ({
        ...prev,
        connected: false,
        authenticated: false,
      }));
    });

    socket.on('connect_error', (error) => {
      // Only log once to avoid console spam during reconnection
      console.warn('[SocketProvider] Real-time service unavailable. Live updates paused.');
      setConnectionState(prev => ({
        ...prev,
        connected: false,
        authenticated: false,
        error: prev.error || 'Real-time service unavailable',
      }));
    });

    // Register event listeners
    const eventTypes = [
      'room:status_changed',
      'booking:created',
      'booking:updated',
      'booking:cancelled',
      'booking:checked_in',
      'booking:checked_out',
      'task:assigned',
      'notification:alert',
      'availability:changed',
      'dashboard:update',
    ];

    eventTypes.forEach(eventType => {
      socket.on(eventType, (data: unknown) => {
        const callbacks = callbacksRef.current.get(eventType);
        if (callbacks) {
          callbacks.forEach(callback => callback(data));
        }
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user, createSocket]);

  // Register callback for event
  const registerCallback = useCallback((eventType: string, callback: (data: unknown) => void) => {
    if (!callbacksRef.current.has(eventType)) {
      callbacksRef.current.set(eventType, new Set());
    }
    const callbacks = callbacksRef.current.get(eventType);
    if (callbacks) callbacks.add(callback);
    else callbacksRef.current.set(eventType, new Set([callback]));

    // Return unsubscribe function
    return () => {
      const callbacks = callbacksRef.current.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }, []);

  // Connection methods
  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  // Subscription methods
  const subscribeToProperty = useCallback((propertyId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:property', { propertyId });
    }
  }, []);

  const unsubscribeFromProperty = useCallback((propertyId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:property', { propertyId });
    }
  }, []);

  // Event emission methods
  const emitRoomStatusChange = useCallback((roomId: string, status: string, propertyId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:request_status_change', { roomId, newStatus: status, propertyId });
    }
  }, []);

  const emitBookingUpdate = useCallback((bookingId: string, updates: Record<string, unknown>) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('booking:request_update', { bookingId, updates });
    }
  }, []);

  // Typed event listeners
  const onRoomStatusChange = useCallback((callback: (event: RoomStatusEvent) => void) => {
    return registerCallback('room:status_changed', callback as (data: unknown) => void);
  }, [registerCallback]);

  const onBookingCreated = useCallback((callback: (event: BookingEvent) => void) => {
    return registerCallback('booking:created', callback as (data: unknown) => void);
  }, [registerCallback]);

  const onBookingUpdated = useCallback((callback: (event: BookingEvent) => void) => {
    return registerCallback('booking:updated', callback as (data: unknown) => void);
  }, [registerCallback]);

  const onBookingCancelled = useCallback((callback: (event: BookingEvent) => void) => {
    return registerCallback('booking:cancelled', callback as (data: unknown) => void);
  }, [registerCallback]);

  const onBookingCheckedIn = useCallback((callback: (event: BookingEvent) => void) => {
    return registerCallback('booking:checked_in', callback as (data: unknown) => void);
  }, [registerCallback]);

  const onBookingCheckedOut = useCallback((callback: (event: BookingEvent) => void) => {
    return registerCallback('booking:checked_out', callback as (data: unknown) => void);
  }, [registerCallback]);

  const onTaskAssigned = useCallback((callback: (event: TaskEvent) => void) => {
    return registerCallback('task:assigned', callback as (data: unknown) => void);
  }, [registerCallback]);

  const onNotification = useCallback((callback: (event: NotificationEvent) => void) => {
    return registerCallback('notification:alert', callback as (data: unknown) => void);
  }, [registerCallback]);

  const onAvailabilityChange = useCallback((callback: (event: AvailabilityEvent) => void) => {
    return registerCallback('availability:changed', callback as (data: unknown) => void);
  }, [registerCallback]);

  const onDashboardUpdate = useCallback((callback: (event: DashboardUpdateEvent) => void) => {
    return registerCallback('dashboard:update', callback as (data: unknown) => void);
  }, [registerCallback]);

  // Get socket instance (use outside of render)
  const getSocket = useCallback(() => socketRef.current, []);

  const value: SocketContextType = {
    ...connectionState,
    socket: null, // Don't expose socket in context value to avoid render-time ref access
    connect,
    disconnect,
    reconnect,
    subscribeToProperty,
    unsubscribeFromProperty,
    emitRoomStatusChange,
    emitBookingUpdate,
    onRoomStatusChange,
    onBookingCreated,
    onBookingUpdated,
    onBookingCancelled,
    onBookingCheckedIn,
    onBookingCheckedOut,
    onTaskAssigned,
    onNotification,
    onAvailabilityChange,
    onDashboardUpdate,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}

export default SocketProvider;
