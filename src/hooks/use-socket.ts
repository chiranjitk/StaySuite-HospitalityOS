'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Types for socket events
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
  timestamp: string;
}

export interface AvailabilityUpdateEvent {
  propertyId: string;
  tenantId: string;
  roomTypeId?: string;
  date: string;
  availableRooms: number;
  totalRooms: number;
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

interface UseSocketOptions {
  tenantId: string;
  userId: string;
  autoConnect?: boolean;
  onRoomStatusChange?: (event: RoomStatusEvent) => void;
  onBookingCreated?: (event: BookingEvent) => void;
  onBookingCancelled?: (event: BookingEvent) => void;
  onAvailabilityUpdate?: (event: AvailabilityUpdateEvent) => void;
  onInitialState?: (state: RoomInitialState) => void;
  onError?: (error: { message: string }) => void;
}

interface UseSocketReturn {
  connectionStatus: ConnectionStatus;
  subscribeToProperty: (propertyId: string) => void;
  unsubscribeFromProperty: (propertyId: string) => void;
  requestRoomStatusChange: (roomId: string, newStatus: string, propertyId: string) => void;
  getAvailability: (propertyId: string, startDate: string, endDate: string) => void;
  reconnect: () => void;
  disconnect: () => void;
}

// Internal function to create a configured socket
function createSocketConnection(tenantId: string, userId: string): Socket {
  return io('/?XTransformPort=3003', {
    path: '/',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    auth: {
      tenantId,
      userId
    }
  });
}

export function useSocket(options: UseSocketOptions): UseSocketReturn {
  const {
    tenantId,
    userId,
    autoConnect = true,
    onRoomStatusChange,
    onBookingCreated,
    onBookingCancelled,
    onAvailabilityUpdate,
    onInitialState,
    onError
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    authenticated: false
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
    onBookingCancelled,
    onAvailabilityUpdate,
    onInitialState,
    onError
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onRoomStatusChange,
      onBookingCreated,
      onBookingCancelled,
      onAvailabilityUpdate,
      onInitialState,
      onError
    };
  }, [onRoomStatusChange, onBookingCreated, onBookingCancelled, onAvailabilityUpdate, onInitialState, onError]);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect || !tenantId || !userId) {
      return;
    }

    // Create socket
    const newSocket = createSocketConnection(tenantId, userId);
    socketRef.current = newSocket;

    // Connection handlers
    newSocket.on('connect', () => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useSocket] Connected to realtime service'); }
      setConnectionStatus({
        connected: true,
        authenticated: true
      });
      reconnectAttempts.current = 0;
      connectErrorCount.current = 0;
      intentionalDisconnect.current = false;
    });

    newSocket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useSocket] Disconnected:', reason); }
      setConnectionStatus({
        connected: false,
        authenticated: false
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
            if (process.env.NODE_ENV !== 'production') { console.log(`[useSocket] Reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`); }
            newSocket.connect();
          }, delay);
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn('[useSocket] Max reconnect attempts reached. Manual reconnect required.');
        }
      }
    });

    newSocket.on('connect_error', (error) => {
      connectErrorCount.current++;
      // Only log the first 3 errors to avoid console spam during reconnection attempts
      if (connectErrorCount.current <= 3) {
        console.warn(`[useSocket] Real-time service unavailable (attempt ${connectErrorCount.current}). Live updates paused. Error: ${error.message}`);
      }
      setConnectionStatus({
        connected: false,
        authenticated: false,
        error: connectErrorCount.current === 1 ? 'Real-time service unavailable' : undefined
      });

      // Notify the consumer once about the initial failure
      if (connectErrorCount.current === 1) {
        callbacksRef.current.onError?.({ message: error.message });
      }
    });

    // Initial state
    newSocket.on('room:initial_state', (state: RoomInitialState) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useSocket] Received initial room state:', state.rooms.length, 'rooms'); }
      callbacksRef.current.onInitialState?.(state);
    });

    // Room status change event
    newSocket.on('room:status_changed', (event: RoomStatusEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useSocket] Room status changed:', event.roomId, '->', event.status); }
      callbacksRef.current.onRoomStatusChange?.(event);
    });

    // Booking created event
    newSocket.on('booking:created', (event: BookingEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useSocket] Booking created:', event.confirmationCode); }
      callbacksRef.current.onBookingCreated?.(event);
    });

    // Booking cancelled event
    newSocket.on('booking:cancelled', (event: BookingEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useSocket] Booking cancelled:', event.confirmationCode); }
      callbacksRef.current.onBookingCancelled?.(event);
    });

    // Availability update event
    newSocket.on('availability:update', (event: AvailabilityUpdateEvent) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useSocket] Availability update:', event.propertyId); }
      callbacksRef.current.onAvailabilityUpdate?.(event);
    });

    // Error event
    newSocket.on('error', (error: { message: string }) => {
      console.error('[useSocket] Error:', error.message);
      callbacksRef.current.onError?.(error);
    });

    // Connected confirmation
    newSocket.on('connected', (data: { message: string; tenantId: string; propertyIds: string[] }) => {
      if (process.env.NODE_ENV !== 'production') { console.log('[useSocket] Server confirmed connection:', data.message); }
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [autoConnect, tenantId, userId]);

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
        propertyId
      });
    }
  }, []);

  // Get availability data
  const getAvailability = useCallback((propertyId: string, startDate: string, endDate: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('availability:get', {
        propertyId,
        startDate,
        endDate
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
    disconnect
  };
}

// Export a simpler hook for just room status updates
interface UseRoomStatusOptions {
  tenantId: string;
  userId: string;
  onStatusChange?: (event: RoomStatusEvent) => void;
}

export function useRoomStatus(options: UseRoomStatusOptions) {
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
        previousStatus: event.previousStatus
      });
      return newRooms;
    });
    options.onStatusChange?.(event);
  }, [options]);

  const socketHook = useSocket({
    tenantId: options.tenantId,
    userId: options.userId,
    onInitialState: handleInitialState,
    onRoomStatusChange: handleStatusChange
  });

  return {
    ...socketHook,
    rooms,
    getRoomStatus: (roomId: string) => rooms.get(roomId)?.status,
    getRoomPreviousStatus: (roomId: string) => rooms.get(roomId)?.previousStatus
  };
}

export default useSocket;
