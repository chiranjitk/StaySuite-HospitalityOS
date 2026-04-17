import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { createLogger } from '../shared/logger'

const prisma = new PrismaClient()
const log = createLogger('availability-service')

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/socket.io',
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Types
interface AuthenticatedSocket extends Socket {
  data: {
    tenantId: string
    userId: string
    propertyIds: string[]
    role: string
  }
}

interface RoomStatusPayload {
  roomId: string
  propertyId: string
  tenantId: string
  status: string
  previousStatus?: string
  timestamp: Date
}

interface BookingPayload {
  bookingId: string
  propertyId: string
  tenantId: string
  roomTypeId: string
  roomId?: string
  checkIn: Date
  checkOut: Date
  guestName: string
  confirmationCode: string
}

interface AvailabilityUpdatePayload {
  propertyId: string
  tenantId: string
  roomTypeId?: string
  date: Date
  availableRooms: number
  totalRooms: number
}

// Tenant rooms for isolation
const tenantRooms = new Map<string, Set<string>>() // tenantId -> Set of socketIds
const propertyRooms = new Map<string, Set<string>>() // propertyId -> Set of socketIds

// Authentication middleware
io.use(async (socket: AuthenticatedSocket, next) => {
  try {
    const { tenantId, userId, token } = socket.handshake.auth as {
      tenantId?: string
      userId?: string
      token?: string
    }

    // Validate required fields
    if (!tenantId || !userId || !token) {
      return next(new Error('Missing authentication credentials'))
    }

    // Validate token against database
    try {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
      })
      if (!session || !session.user || session.user.tenantId !== tenantId) {
        return next(new Error('Invalid session token'))
      }
      socket.data.user = session.user
    } catch (err) {
      return next(new Error('Authentication failed'))
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        status: { in: ['trial', 'active'] }
      }
    })

    if (!tenant) {
      return next(new Error('Invalid tenant or tenant is not active'))
    }

    // Verify user exists and belongs to tenant
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: tenantId
      },
      include: {
        role: true
      }
    })

    if (!user) {
      return next(new Error('Invalid user or user does not belong to tenant'))
    }

    // Get user's accessible properties
    const properties = await prisma.property.findMany({
      where: {
        tenantId: tenantId,
        status: 'active'
      },
      select: { id: true }
    })

    // Attach data to socket
    socket.data = {
      tenantId,
      userId,
      propertyIds: properties.map(p => p.id),
      role: user.role?.name || 'staff'
    }

    next()
  } catch (error) {
    console.error('Authentication error:', error)
    next(new Error('Authentication failed'))
  }
})

// Connection handler
io.on('connection', async (socket: AuthenticatedSocket) => {
  const { tenantId, userId, propertyIds, role } = socket.data

  console.log(`[Availability Service] User connected: ${socket.id}, Tenant: ${tenantId}, User: ${userId}`)

  // Join tenant-specific room
  const tenantRoom = `tenant:${tenantId}`
  socket.join(tenantRoom)

  // Track socket in tenant room
  if (!tenantRooms.has(tenantId)) {
    tenantRooms.set(tenantId, new Set())
  }
  tenantRooms.get(tenantId)!.add(socket.id)

  // Join property-specific rooms
  for (const propertyId of propertyIds) {
    const propertyRoom = `property:${propertyId}`
    socket.join(propertyRoom)

    if (!propertyRooms.has(propertyId)) {
      propertyRooms.set(propertyId, new Set())
    }
    propertyRooms.get(propertyId)!.add(socket.id)
  }

  // Send initial connection confirmation
  socket.emit('connected', {
    message: 'Connected to availability service',
    tenantId,
    propertyIds,
    timestamp: new Date().toISOString()
  })

  // Send initial room availability
  try {
    const rooms = await prisma.room.findMany({
      where: {
        propertyId: { in: propertyIds }
      },
      include: {
        roomType: {
          select: { id: true, name: true, code: true }
        },
        property: {
          select: { id: true, name: true }
        }
      }
    })

    socket.emit('room:initial_state', {
      rooms: rooms.map(room => ({
        id: room.id,
        number: room.number,
        status: room.status,
        floor: room.floor,
        propertyId: room.propertyId,
        roomTypeId: room.roomTypeId,
        roomType: room.roomType,
        property: room.property
      })),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching initial rooms:', error)
  }

  // Handle subscribe to specific property
  socket.on('subscribe:property', async (data: { propertyId: string }) => {
    if (!propertyIds.includes(data.propertyId)) {
      socket.emit('error', { message: 'Access denied to this property' })
      return
    }

    const propertyRoom = `property:${data.propertyId}`
    socket.join(propertyRoom)

    socket.emit('subscribed', {
      type: 'property',
      id: data.propertyId,
      message: `Subscribed to property ${data.propertyId}`
    })
  })

  // Handle unsubscribe from property
  socket.on('unsubscribe:property', (data: { propertyId: string }) => {
    const propertyRoom = `property:${data.propertyId}`
    socket.leave(propertyRoom)

    socket.emit('unsubscribed', {
      type: 'property',
      id: data.propertyId,
      message: `Unsubscribed from property ${data.propertyId}`
    })
  })

  // Handle room status update (from frontend)
  socket.on('room:request_status_change', async (data: {
    roomId: string
    newStatus: string
    propertyId: string
  }) => {
    try {
      // Verify access
      if (!propertyIds.includes(data.propertyId)) {
        socket.emit('error', { message: 'Access denied to this property' })
        return
      }

      // Get current room state
      const room = await prisma.room.findFirst({
        where: {
          id: data.roomId,
          propertyId: data.propertyId
        },
        include: {
          roomType: { select: { id: true, name: true } }
        }
      })

      if (!room) {
        socket.emit('error', { message: 'Room not found' })
        return
      }

      const previousStatus = room.status

      // Update room status in database
      const updatedRoom = await prisma.room.update({
        where: { id: data.roomId },
        data: { status: data.newStatus }
      })

      // Broadcast to all clients in tenant and property rooms
      const payload: RoomStatusPayload = {
        roomId: data.roomId,
        propertyId: data.propertyId,
        tenantId: tenantId,
        status: data.newStatus,
        previousStatus: previousStatus,
        timestamp: new Date()
      }

      io.to(`tenant:${tenantId}`).emit('room:status_changed', payload)
      io.to(`property:${data.propertyId}`).emit('room:status_changed', payload)

      console.log(`[Room Status] Room ${room.number} changed from ${previousStatus} to ${data.newStatus}`)
    } catch (error) {
      console.error('Error updating room status:', error)
      socket.emit('error', { message: 'Failed to update room status' })
    }
  })

  // Handle get availability request
  socket.on('availability:get', async (data: {
    propertyId: string
    startDate: string
    endDate: string
  }) => {
    try {
      if (!propertyIds.includes(data.propertyId)) {
        socket.emit('error', { message: 'Access denied to this property' })
        return
      }

      const startDate = new Date(data.startDate)
      const endDate = new Date(data.endDate)

      // Get all rooms for property
      const rooms = await prisma.room.findMany({
        where: { propertyId: data.propertyId },
        include: { roomType: true }
      })

      // Get bookings in date range
      const bookings = await prisma.booking.findMany({
        where: {
          propertyId: data.propertyId,
          OR: [
            {
              checkIn: { lt: endDate },
              checkOut: { gt: startDate }
            }
          ],
          status: { in: ['confirmed', 'checked_in'] }
        }
      })

      // Calculate availability by room type
      const roomTypes = await prisma.roomType.findMany({
        where: { propertyId: data.propertyId }
      })

      const availability = roomTypes.map(rt => {
        const totalRooms = rooms.filter(r => r.roomTypeId === rt.id).length
        const bookedRooms = bookings.filter(b => b.roomTypeId === rt.id).length
        const availableRooms = totalRooms - bookedRooms

        return {
          roomTypeId: rt.id,
          roomTypeName: rt.name,
          totalRooms,
          bookedRooms,
          availableRooms,
          availabilityPercentage: totalRooms > 0 ? Math.round((availableRooms / totalRooms) * 100) : 0
        }
      })

      socket.emit('availability:data', {
        propertyId: data.propertyId,
        startDate: data.startDate,
        endDate: data.endDate,
        availability,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error getting availability:', error)
      socket.emit('error', { message: 'Failed to get availability' })
    }
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Availability Service] User disconnected: ${socket.id}`)

    // Clean up tenant room tracking
    const tenantSet = tenantRooms.get(tenantId)
    if (tenantSet) {
      tenantSet.delete(socket.id)
      if (tenantSet.size === 0) {
        tenantRooms.delete(tenantId)
      }
    }

    // Clean up property room tracking
    for (const propertyId of propertyIds) {
      const propertySet = propertyRooms.get(propertyId)
      if (propertySet) {
        propertySet.delete(socket.id)
        if (propertySet.size === 0) {
          propertyRooms.delete(propertyId)
        }
      }
    }
  })

  // Handle errors
  socket.on('error', (error) => {
    console.error(`[Availability Service] Socket error (${socket.id}):`, error)
  })
})

// API function to emit room status change (called from API routes)
export function emitRoomStatusChange(payload: RoomStatusPayload) {
  io.to(`tenant:${payload.tenantId}`).emit('room:status_changed', payload)
  io.to(`property:${payload.propertyId}`).emit('room:status_changed', payload)
  console.log(`[Emit] Room status change: ${payload.roomId} -> ${payload.status}`)
}

// API function to emit booking created
export function emitBookingCreated(payload: BookingPayload) {
  io.to(`tenant:${payload.tenantId}`).emit('booking:created', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  io.to(`property:${payload.propertyId}`).emit('booking:created', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  console.log(`[Emit] Booking created: ${payload.confirmationCode}`)
}

// API function to emit booking cancelled
export function emitBookingCancelled(payload: BookingPayload) {
  io.to(`tenant:${payload.tenantId}`).emit('booking:cancelled', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  io.to(`property:${payload.propertyId}`).emit('booking:cancelled', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  console.log(`[Emit] Booking cancelled: ${payload.confirmationCode}`)
}

// API function to emit availability update
export function emitAvailabilityUpdate(payload: AvailabilityUpdatePayload) {
  io.to(`tenant:${payload.tenantId}`).emit('availability:update', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  io.to(`property:${payload.propertyId}`).emit('availability:update', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  console.log(`[Emit] Availability update: Property ${payload.propertyId}`)
}

// Get connection stats
export function getConnectionStats() {
  return {
    totalConnections: io.sockets.sockets.size,
    tenants: Array.from(tenantRooms.entries()).map(([tenantId, sockets]) => ({
      tenantId,
      connections: sockets.size
    })),
    properties: Array.from(propertyRooms.entries()).map(([propertyId, sockets]) => ({
      propertyId,
      connections: sockets.size
    }))
  }
}

const PORT = 3002
httpServer.listen(PORT, () => {
  console.log(`[Availability Service] WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Availability Service] Received SIGTERM signal, shutting down...')
  httpServer.close(() => {
    prisma.$disconnect()
    console.log('[Availability Service] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[Availability Service] Received SIGINT signal, shutting down...')
  httpServer.close(() => {
    prisma.$disconnect()
    console.log('[Availability Service] Server closed')
    process.exit(0)
  })
})

export { io }
