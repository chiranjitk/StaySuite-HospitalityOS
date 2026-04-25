/**
 * Availability Service - Socket.io Client Integration
 * 
 * This module provides integration with the availability WebSocket service.
 * It's used by API routes to emit real-time events.
 */

import { io, Socket } from 'socket.io-client'

// Singleton socket instance for server-to-server communication
let serviceSocket: Socket | null = null

interface RoomStatusPayload {
  roomId: string
  propertyId: string
  tenantId: string
  status: string
  previousStatus?: string
  timestamp: Date | string
}

interface BookingPayload {
  bookingId: string
  propertyId: string
  tenantId: string
  roomTypeId: string
  roomId?: string
  checkIn: Date | string
  checkOut: Date | string
  guestName: string
  confirmationCode: string
  status?: string
}

interface AvailabilityUpdatePayload {
  propertyId: string
  tenantId: string
  roomTypeId?: string
  date: Date | string
  availableRooms: number
  totalRooms: number
}

interface TaskPayload {
  taskId: string
  propertyId: string
  tenantId: string
  assignedTo?: string
  title: string
  type: string
  priority: string
  status: string
  roomNumber?: string
}

interface NotificationPayload {
  id: string
  tenantId: string
  userId?: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  actionUrl?: string
}

interface DashboardUpdatePayload {
  type: 'stats' | 'arrivals' | 'departures' | 'activity' | 'alerts'
  tenantId: string
  data: Record<string, unknown>
}

/**
 * Get or create a socket connection to the availability service
 * This is used for server-to-server communication (from API routes)
 */
export function getAvailabilityServiceSocket(): Socket {
  if (!serviceSocket || !serviceSocket.connected) {
    // Connect to the availability service (port 3002) via the Caddy gateway proxy
    // Using XTransformPort query parameter for gateway routing
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    serviceSocket = io(`${appUrl}/?XTransformPort=3002`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000
    })

    serviceSocket.on('connect', () => {
      console.log('[Availability Client] Connected to availability service')
    })

    serviceSocket.on('disconnect', () => {
      console.log('[Availability Client] Disconnected from availability service')
    })

    serviceSocket.on('connect_error', (error) => {
      console.error('[Availability Client] Connection error:', error.message)
    })
  }

  return serviceSocket
}

/**
 * Emit a room status change event
 * Call this from API routes when room status is updated
 */
export function emitRoomStatusChange(data: {
  roomId: string
  propertyId: string
  tenantId: string
  status: string
  previousStatus?: string
}): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    const payload: RoomStatusPayload = {
      ...data,
      timestamp: new Date()
    }

    // Emit to the service which will broadcast to all connected clients
    socket.emit('room:status_changed', payload)
    
    console.log(`[Availability Client] Emitted room status change: ${data.roomId} -> ${data.status}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting room status change:', error)
  }
}

/**
 * Emit a booking created event
 * Call this from API routes when a new booking is created
 */
export function emitBookingCreated(data: {
  bookingId: string
  propertyId: string
  tenantId: string
  roomTypeId: string
  roomId?: string
  checkIn: Date
  checkOut: Date
  guestName: string
  confirmationCode: string
}): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    const payload: BookingPayload = {
      ...data,
      checkIn: data.checkIn instanceof Date ? data.checkIn.toISOString() : data.checkIn,
      checkOut: data.checkOut instanceof Date ? data.checkOut.toISOString() : data.checkOut
    }

    socket.emit('booking:created', payload)
    
    console.log(`[Availability Client] Emitted booking created: ${data.confirmationCode}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting booking created:', error)
  }
}

/**
 * Emit a booking cancelled event
 * Call this from API routes when a booking is cancelled
 */
export function emitBookingCancelled(data: {
  bookingId: string
  propertyId: string
  tenantId: string
  roomTypeId: string
  roomId?: string
  checkIn: Date
  checkOut: Date
  guestName: string
  confirmationCode: string
}): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    const payload: BookingPayload = {
      ...data,
      checkIn: data.checkIn instanceof Date ? data.checkIn.toISOString() : data.checkIn,
      checkOut: data.checkOut instanceof Date ? data.checkOut.toISOString() : data.checkOut
    }

    socket.emit('booking:cancelled', payload)
    
    console.log(`[Availability Client] Emitted booking cancelled: ${data.confirmationCode}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting booking cancelled:', error)
  }
}

/**
 * Emit an availability update event
 * Call this when room availability changes significantly
 */
export function emitAvailabilityUpdate(data: {
  propertyId: string
  tenantId: string
  roomTypeId?: string
  date: Date
  availableRooms: number
  totalRooms: number
}): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    const payload: AvailabilityUpdatePayload = {
      ...data,
      date: data.date instanceof Date ? data.date.toISOString() : data.date
    }

    socket.emit('availability:update', payload)
    
    console.log(`[Availability Client] Emitted availability update: Property ${data.propertyId}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting availability update:', error)
  }
}

/**
 * Disconnect from the availability service
 * Call this during graceful shutdown
 */
export function disconnectAvailabilityService(): void {
  if (serviceSocket && serviceSocket.connected) {
    serviceSocket.disconnect()
    serviceSocket = null
    console.log('[Availability Client] Disconnected from availability service')
  }
}

/**
 * Emit a booking checked in event
 * Call this when a guest checks in
 */
export function emitBookingCheckedIn(data: {
  bookingId: string
  propertyId: string
  tenantId: string
  roomTypeId: string
  roomId?: string
  checkIn: Date
  checkOut: Date
  guestName: string
  confirmationCode: string
}): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    const payload: BookingPayload = {
      ...data,
      status: 'checked_in',
      checkIn: data.checkIn instanceof Date ? data.checkIn.toISOString() : data.checkIn,
      checkOut: data.checkOut instanceof Date ? data.checkOut.toISOString() : data.checkOut
    }

    socket.emit('booking:checked_in', payload)
    
    console.log(`[Availability Client] Emitted booking checked in: ${data.confirmationCode}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting booking checked in:', error)
  }
}

/**
 * Emit a booking checked out event
 * Call this when a guest checks out
 */
export function emitBookingCheckedOut(data: {
  bookingId: string
  propertyId: string
  tenantId: string
  roomTypeId: string
  roomId?: string
  checkIn: Date
  checkOut: Date
  guestName: string
  confirmationCode: string
}): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    const payload: BookingPayload = {
      ...data,
      status: 'checked_out',
      checkIn: data.checkIn instanceof Date ? data.checkIn.toISOString() : data.checkIn,
      checkOut: data.checkOut instanceof Date ? data.checkOut.toISOString() : data.checkOut
    }

    socket.emit('booking:checked_out', payload)
    
    console.log(`[Availability Client] Emitted booking checked out: ${data.confirmationCode}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting booking checked out:', error)
  }
}

/**
 * Emit a task assigned event
 * Call this when a task is assigned to a user
 */
export function emitTaskAssigned(data: TaskPayload): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    socket.emit('task:assigned', {
      ...data,
      timestamp: new Date().toISOString()
    })
    
    console.log(`[Availability Client] Emitted task assigned: ${data.title}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting task assigned:', error)
  }
}

/**
 * Emit a notification event
 * Call this to send real-time notifications
 */
export function emitNotification(data: NotificationPayload): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    socket.emit('notification:alert', {
      ...data,
      timestamp: new Date().toISOString()
    })
    
    console.log(`[Availability Client] Emitted notification: ${data.title}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting notification:', error)
  }
}

/**
 * Emit a dashboard update event
 * Call this when dashboard stats change
 */
export function emitDashboardUpdate(data: DashboardUpdatePayload): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    socket.emit('dashboard:update', {
      ...data,
      timestamp: new Date().toISOString()
    })
    
    console.log(`[Availability Client] Emitted dashboard update: ${data.type}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting dashboard update:', error)
  }
}

/**
 * Emit an availability changed event
 * Call this when room availability changes
 */
export function emitAvailabilityChanged(data: AvailabilityUpdatePayload): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    const payload = {
      ...data,
      date: data.date instanceof Date ? data.date.toISOString() : data.date,
      timestamp: new Date().toISOString()
    }

    socket.emit('availability:changed', payload)
    
    console.log(`[Availability Client] Emitted availability changed: Property ${data.propertyId}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting availability changed:', error)
  }
}

/**
 * Emit a booking updated event
 * Call this when a booking is modified
 */
export function emitBookingUpdated(data: {
  bookingId: string
  propertyId: string
  tenantId: string
  roomTypeId: string
  roomId?: string
  checkIn: Date
  checkOut: Date
  guestName: string
  confirmationCode: string
  status?: string
  updates?: Record<string, unknown>
}): void {
  try {
    const socket = getAvailabilityServiceSocket()
    
    const payload: BookingPayload & { updates?: Record<string, unknown> } = {
      ...data,
      checkIn: data.checkIn instanceof Date ? data.checkIn.toISOString() : data.checkIn,
      checkOut: data.checkOut instanceof Date ? data.checkOut.toISOString() : data.checkOut
    }

    socket.emit('booking:updated', payload)
    
    console.log(`[Availability Client] Emitted booking updated: ${data.confirmationCode}`)
  } catch (error) {
    console.error('[Availability Client] Error emitting booking updated:', error)
  }
}

// Export types
export type { 
  RoomStatusPayload, 
  BookingPayload, 
  AvailabilityUpdatePayload,
  TaskPayload,
  NotificationPayload,
  DashboardUpdatePayload
}
