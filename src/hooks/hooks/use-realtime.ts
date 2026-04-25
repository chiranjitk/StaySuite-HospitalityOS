'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';

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

export interface RoomInitialState {
  rooms: Array<{
    id: string;
    number: string;
    status: string;
    floor: number;
    propertyId: string;
    roomTypeId: string;
    roomType: {
      id: string;
      name: string;
      code: string;
    };
    property: {
      id: string;
      name: string;
    };
  }>;
  timestamp: string;
}

export interface ConnectionStatus {
  connected: boolean;
  authenticated: boolean;
  error?: string;
}

// Hook options
interface UseRealtimeOptions {
  autoConnect?: boolean;
  showToasts?: boolean;
  onRoomStatusChange?: (event: RoomStatusEvent) => void;
  onBookingCreated?: (event: BookingEvent) => void;
  onBookingUpdated?: (event: BookingEvent) => void;
  onBookingCancelled?: (event: BookingEvent) => void;
  onBookingCheckedIn?: (event: BookingEvent) => void;
  onBookingCheckedOut?: (event: BookingEvent) => void;
  onTaskAssigned?: (event: TaskEvent) => void;
  onNotification?: (event: NotificationEvent) => void;
  onAvailabilityChange?: (event: AvailabilityEvent) => void;
  onDashboardUpdate?: (event: DashboardUpdateEvent) => void;
  onInitialState?: (state: RoomInitialState) => void;
  onError?: (error: { message: string }) => void;
}

// Hook return type
interface UseRealtimeReturn {
  connectionStatus: ConnectionStatus;
  subscribeToProperty: (propertyId: string) => void;
  unsubscribeFromProperty: (propertyId: string) => void;
  requestRoomStatusChange: (roomId: string, newStatus: string, propertyId: string) => void;
  getAvailability: (propertyId: string, startDate: string, endDate: string) => void;
  reconnect: () => void;
  disconnect: () => void;
  socket: Socket | null;
}

/**
 * Comprehensive real-time hook for StaySuite
 * Provides socket connection management and event handling
 */
export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const {
    autoConnect = true,
    showToasts = true,
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
    onInitialState,
    onError,
  } = options;

  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    authenticated: false,
  });
  
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectErrorCount = useRef(0);
  const intentionalDisconnect = useRef(false);
  
  // Store callbacks in refs to avoid reconnection on callback changes
  const callbacksRef = useRef({
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
    onInitialState,
    onError,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
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
      onInitialState,
      onError,
    };
  }, [
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
    onInitialState,
    onError,
  ]);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect || !user?.tenantId || !user?.id || !isAuthenticated) {
      return;
    }

    // Create socket
    const newSocket = io('/?XTransformPort=3003', {
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
    
    socketRef.current = newSocket;

    // Connection handlers
    newSocket.on('connect', () => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Connected to realtime service'); }
      setConnectionStatus({
        connected: true,
        authenticated: true,
      });
      reconnectAttempts.current = 0;
      connectErrorCount.current = 0;
      intentionalDisconnect.current = false;
      
      if (showToasts) {
        toast({
          title: 'Connected',
          description: 'Real-time updates are now active',
          duration: 2000,
        });
      }
    });

    newSocket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Disconnected:', reason); }
      setConnectionStatus({
        connected: false,
        authenticated: false,
      });

      // Skip auto-reconnect if intentionally disconnected
      if (intentionalDisconnect.current) return;

      // Socket.IO handles reconnection for transport disconnects automatically.
      // Only manually reconnect on 'io server disconnect' (server kicked us).
      if (reason === 'io server disconnect') {
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            if (process.env.NODE_ENV !== 'production') { console.log(`[useRealtime] Reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`); }
            newSocket.connect();
          }, delay);
        }
      }
    });

    newSocket.on('connect_error', (error) => {
      connectErrorCount.current++;
      // Only log the first 3 errors to avoid console spam during reconnection attempts
      if (connectErrorCount.current <= 3) {
        console.warn(`[useRealtime] Real-time service unavailable (attempt ${connectErrorCount.current}). Live updates paused. Error: ${error.message}`);
      }
      setConnectionStatus({
        connected: false,
        authenticated: false,
        error: connectErrorCount.current === 1 ? 'Real-time service unavailable' : undefined,
      });
      
      // Notify the consumer once about the initial failure
      if (connectErrorCount.current === 1) {
        callbacksRef.current.onError?.({ message: error.message });
      }
    });

    // Initial state
    newSocket.on('room:initial_state', (state: RoomInitialState) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Received initial room state:', state.rooms.length, 'rooms'); }
      callbacksRef.current.onInitialState?.(state);
    });

    // Room status change event
    newSocket.on('room:status_changed', (event: RoomStatusEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Room status changed:', event.roomId, '->', event.status); }
      callbacksRef.current.onRoomStatusChange?.(event);
      
      if (showToasts) {
        toast({
          title: 'Room Status Updated',
          description: `Room status changed to ${event.status}`,
          duration: 3000,
        });
      }
    });

    // Booking created event
    newSocket.on('booking:created', (event: BookingEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Booking created:', event.confirmationCode); }
      callbacksRef.current.onBookingCreated?.(event);
      
      if (showToasts) {
        toast({
          title: 'New Booking',
          description: `Booking ${event.confirmationCode} created for ${event.guestName}`,
        });
      }
    });

    // Booking updated event
    newSocket.on('booking:updated', (event: BookingEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Booking updated:', event.confirmationCode); }
      callbacksRef.current.onBookingUpdated?.(event);
    });

    // Booking cancelled event
    newSocket.on('booking:cancelled', (event: BookingEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Booking cancelled:', event.confirmationCode); }
      callbacksRef.current.onBookingCancelled?.(event);
      
      if (showToasts) {
        toast({
          title: 'Booking Cancelled',
          description: `Booking ${event.confirmationCode} has been cancelled`,
          variant: 'destructive',
        });
      }
    });

    // Booking checked in event
    newSocket.on('booking:checked_in', (event: BookingEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Booking checked in:', event.confirmationCode); }
      callbacksRef.current.onBookingCheckedIn?.(event);
      
      if (showToasts) {
        toast({
          title: 'Guest Checked In',
          description: `${event.guestName} has checked in`,
        });
      }
    });

    // Booking checked out event
    newSocket.on('booking:checked_out', (event: BookingEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Booking checked out:', event.confirmationCode); }
      callbacksRef.current.onBookingCheckedOut?.(event);
      
      if (showToasts) {
        toast({
          title: 'Guest Checked Out',
          description: `${event.guestName} has checked out`,
        });
      }
    });

    // Task assigned event
    newSocket.on('task:assigned', (event: TaskEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Task assigned:', event.taskId); }
      callbacksRef.current.onTaskAssigned?.(event);
      
      if (showToasts) {
        toast({
          title: 'New Task Assigned',
          description: event.title,
        });
      }
    });

    // Notification event
    newSocket.on('notification:alert', (event: NotificationEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Notification:', event.title); }
      callbacksRef.current.onNotification?.(event);
      
      if (showToasts) {
        toast({
          title: event.title,
          description: event.message,
          variant: event.type === 'error' ? 'destructive' : 'default',
        });
      }
    });

    // Availability update event
    newSocket.on('availability:changed', (event: AvailabilityEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Availability update:', event.propertyId); }
      callbacksRef.current.onAvailabilityChange?.(event);
    });

    // Dashboard update event
    newSocket.on('dashboard:update', (event: DashboardUpdateEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Dashboard update:', event.type); }
      callbacksRef.current.onDashboardUpdate?.(event);
    });

    // Connected confirmation
    newSocket.on('connected', (data: { message: string; tenantId: string; propertyIds: string[] }) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useRealtime] Server confirmed connection:', data.message); }
    });

    // Error event
    newSocket.on('error', (error: { message: string }) => {
      console.error('[useRealtime] Error:', error.message);
      callbacksRef.current.onError?.(error);
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [autoConnect, user?.tenantId, user?.id, isAuthenticated, showToasts, toast]);

  // Subscribe to property updates
  const subscribeToProperty = useCallback((propertyId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('subscribe:property', { propertyId });
    }
  }, []);

  // Unsubscribe from property updates
  const unsubscribeFromProperty = useCallback((propertyId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('unsubscribe:property', { propertyId });
    }
  }, []);

  // Request room status change
  const requestRoomStatusChange = useCallback((roomId: string, newStatus: string, propertyId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('room:request_status_change', {
        roomId,
        newStatus,
        propertyId,
      });
    }
  }, []);

  // Get availability data
  const getAvailability = useCallback((propertyId: string, startDate: string, endDate: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('availability:get', {
        propertyId,
        startDate,
        endDate,
      });
    }
  }, []);

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    connectErrorCount.current = 0;
    intentionalDisconnect.current = false;
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }, []);

  // Manual disconnect
  const disconnect = useCallback(() => {
    intentionalDisconnect.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }, []);

  return {
    connectionStatus,
    subscribeToProperty,
    unsubscribeFromProperty,
    requestRoomStatusChange,
    getAvailability,
    reconnect,
    disconnect,
    socket: null, // Don't expose socket to avoid render-time ref access
  };
}

/**
 * Simplified hook for room status updates only
 */
export function useRoomStatus(options: {
  tenantId: string;
  userId: string;
  onStatusChange?: (event: RoomStatusEvent) => void;
}) {
  const [rooms, setRooms] = useState<Map<string, { status: string; previousStatus?: string }>>(new Map());

  const handleInitialState = useCallback((state: RoomInitialState) => {
    const newRooms = new Map<string, { status: string; previousStatus?: string }>();
    state.rooms.forEach(room => {
      newRooms.set(room.id, { status: room.status });
    });
    setRooms(newRooms);
  }, []);

  const handleStatusChange = useCallback((event: RoomStatusEvent) => {
    setRooms(prev => {
      const newRooms = new Map(prev);
      newRooms.set(event.roomId, {
        status: event.status,
        previousStatus: event.previousStatus,
      });
      return newRooms;
    });
    options.onStatusChange?.(event);
  }, [options]);

  const realtimeHook = useRealtime({
    onInitialState: handleInitialState,
    onRoomStatusChange: handleStatusChange,
  });

  return {
    ...realtimeHook,
    rooms,
    getRoomStatus: (roomId: string) => rooms.get(roomId)?.status,
    getRoomPreviousStatus: (roomId: string) => rooms.get(roomId)?.previousStatus,
  };
}

/**
 * Hook for booking real-time updates
 */
export function useBookingRealtime(options: {
  onBookingCreated?: (event: BookingEvent) => void;
  onBookingUpdated?: (event: BookingEvent) => void;
  onBookingCancelled?: (event: BookingEvent) => void;
  onBookingCheckedIn?: (event: BookingEvent) => void;
  onBookingCheckedOut?: (event: BookingEvent) => void;
} = {}) {
  const [recentBookings, setRecentBookings] = useState<BookingEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleBookingCreated = useCallback((event: BookingEvent) => {
    setRecentBookings(prev => [event, ...prev].slice(0, 50));
    setUnreadCount(prev => prev + 1);
    options.onBookingCreated?.(event);
  }, [options]);

  const handleBookingCancelled = useCallback((event: BookingEvent) => {
    options.onBookingCancelled?.(event);
  }, [options]);

  const handleBookingCheckedIn = useCallback((event: BookingEvent) => {
    options.onBookingCheckedIn?.(event);
  }, [options]);

  const handleBookingCheckedOut = useCallback((event: BookingEvent) => {
    options.onBookingCheckedOut?.(event);
  }, [options]);

  const realtimeHook = useRealtime({
    onBookingCreated: handleBookingCreated,
    onBookingCancelled: handleBookingCancelled,
    onBookingCheckedIn: handleBookingCheckedIn,
    onBookingCheckedOut: handleBookingCheckedOut,
    onBookingUpdated: options.onBookingUpdated,
  });

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearRecentBookings = useCallback(() => {
    setRecentBookings([]);
    setUnreadCount(0);
  }, []);

  return {
    ...realtimeHook,
    recentBookings,
    unreadCount,
    markAllRead,
    clearRecentBookings,
  };
}

/**
 * Hook for notifications
 */
export function useNotifications(options: {
  onNotification?: (event: NotificationEvent) => void;
} = {}) {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleNotification = useCallback((event: NotificationEvent) => {
    setNotifications(prev => [event, ...prev].slice(0, 100));
    setUnreadCount(prev => prev + 1);
    options.onNotification?.(event);
  }, [options]);

  const realtimeHook = useRealtime({
    onNotification: handleNotification,
  });

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    ...realtimeHook,
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    clearNotifications,
  };
}

export default useRealtime;
