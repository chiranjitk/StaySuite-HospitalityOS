import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

// Room status event
interface RoomStatusPayload {
  roomId: string
  propertyId: string
  tenantId: string
  status: string
  previousStatus?: string
  timestamp: Date
}

// Booking event
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
  status?: string
}

// Availability update event
interface AvailabilityUpdatePayload {
  propertyId: string
  tenantId: string
  roomTypeId?: string
  date: Date
  availableRooms: number
  totalRooms: number
}

// Chat message event
interface ChatMessagePayload {
  conversationId: string
  messageId: string
  tenantId: string
  guestId?: string
  content: string
  senderType: 'guest' | 'staff' | 'system'
  senderId?: string
  senderName?: string
  messageType: 'text' | 'image' | 'file'
  timestamp: Date
}

// Kitchen order event
interface KitchenOrderPayload {
  orderId: string
  tenantId: string
  propertyId: string
  orderNumber: string
  orderType: string
  kitchenStatus: 'pending' | 'cooking' | 'ready' | 'completed'
  previousStatus?: string
  tableNumber?: string
  guestName?: string
  items: Array<{
    name: string
    quantity: number
    notes?: string
  }>
  timestamp: Date
}

// Notification event
interface NotificationPayload {
  id: string
  tenantId: string
  userId?: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  actionUrl?: string
  timestamp: Date
}

// Task event
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
  timestamp: Date
}

// Dashboard update event
interface DashboardUpdatePayload {
  type: 'stats' | 'arrivals' | 'departures' | 'activity' | 'alerts'
  tenantId: string
  data: Record<string, unknown>
  timestamp: Date
}

// Tenant rooms for isolation
const tenantRooms = new Map<string, Set<string>>() // tenantId -> Set of socketIds
const propertyRooms = new Map<string, Set<string>>() // propertyId -> Set of socketIds
const userRooms = new Map<string, Set<string>>() // userId -> Set of socketIds

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

  console.log(`[Realtime Service] User connected: ${socket.id}, Tenant: ${tenantId}, User: ${userId}`)

  // Join tenant-specific room
  const tenantRoom = `tenant:${tenantId}`
  socket.join(tenantRoom)

  // Track socket in tenant room
  if (!tenantRooms.has(tenantId)) {
    tenantRooms.set(tenantId, new Set())
  }
  tenantRooms.get(tenantId)!.add(socket.id)

  // Join user-specific room
  const userRoom = `user:${userId}`
  socket.join(userRoom)
  if (!userRooms.has(userId)) {
    userRooms.set(userId, new Set())
  }
  userRooms.get(userId)!.add(socket.id)

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
    message: 'Connected to realtime service',
    tenantId,
    propertyIds,
    userId,
    timestamp: new Date().toISOString()
  })

  // ============ ROOM STATUS EVENTS ============
  
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

  // Handle room status update request
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

      io.to(`tenant:${tenantId}`).emit('room:status', payload)
      io.to(`property:${data.propertyId}`).emit('room:status', payload)

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

  // ============ CHAT EVENTS ============

  // Handle subscribe to chat conversation
  socket.on('chat:subscribe', (data: { conversationId: string }) => {
    const conversationRoom = `conversation:${data.conversationId}`
    socket.join(conversationRoom)
    socket.emit('chat:subscribed', { conversationId: data.conversationId })
  })

  // Handle unsubscribe from chat conversation
  socket.on('chat:unsubscribe', (data: { conversationId: string }) => {
    const conversationRoom = `conversation:${data.conversationId}`
    socket.leave(conversationRoom)
    socket.emit('chat:unsubscribed', { conversationId: data.conversationId })
  })

  // Handle send chat message
  socket.on('chat:send_message', async (data: {
    conversationId: string
    content: string
    messageType?: 'text' | 'image' | 'file'
  }) => {
    try {
      const messageType = data.messageType || 'text'

      // Get conversation to verify access
      const conversation = await prisma.chatConversation.findFirst({
        where: {
          id: data.conversationId,
          tenantId: tenantId
        },
        include: {
          guest: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      })

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' })
        return
      }

      // Get user info for sender name
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true }
      })

      // Create message in database
      const message = await prisma.chatMessage.create({
        data: {
          conversationId: data.conversationId,
          content: data.content,
          senderType: 'staff',
          senderId: userId,
          messageType: messageType,
          status: 'sent',
          sentAt: new Date()
        }
      })

      // Update conversation's last message
      await prisma.chatConversation.update({
        where: { id: data.conversationId },
        data: {
          lastMessage: data.content,
          lastMessageAt: new Date()
        }
      })

      // Create payload
      const payload: ChatMessagePayload = {
        conversationId: data.conversationId,
        messageId: message.id,
        tenantId: tenantId,
        guestId: conversation.guestId || undefined,
        content: data.content,
        senderType: 'staff',
        senderId: userId,
        senderName: user ? `${user.firstName} ${user.lastName}` : 'Staff',
        messageType: messageType,
        timestamp: new Date()
      }

      // Emit to conversation room
      io.to(`conversation:${data.conversationId}`).emit('chat:message', payload)

      // Also emit to tenant room for notification
      io.to(`tenant:${tenantId}`).emit('chat:message', payload)

      console.log(`[Chat] Message sent in conversation ${data.conversationId}`)
    } catch (error) {
      console.error('Error sending chat message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  // Handle typing indicator
  socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
    socket.to(`conversation:${data.conversationId}`).emit('chat:typing', {
      conversationId: data.conversationId,
      userId: userId,
      isTyping: data.isTyping
    })
  })

  // ============ KITCHEN ORDER EVENTS ============

  // Handle subscribe to kitchen orders
  socket.on('kitchen:subscribe', (data: { propertyId: string }) => {
    if (!propertyIds.includes(data.propertyId)) {
      socket.emit('error', { message: 'Access denied to this property' })
      return
    }
    const kitchenRoom = `kitchen:${data.propertyId}`
    socket.join(kitchenRoom)
    socket.emit('kitchen:subscribed', { propertyId: data.propertyId })
  })

  // Handle unsubscribe from kitchen orders
  socket.on('kitchen:unsubscribe', (data: { propertyId: string }) => {
    const kitchenRoom = `kitchen:${data.propertyId}`
    socket.leave(kitchenRoom)
    socket.emit('kitchen:unsubscribed', { propertyId: data.propertyId })
  })

  // Handle kitchen order status update
  socket.on('kitchen:update_status', async (data: {
    orderId: string
    propertyId: string
    kitchenStatus: 'pending' | 'cooking' | 'ready' | 'completed'
  }) => {
    try {
      if (!propertyIds.includes(data.propertyId)) {
        socket.emit('error', { message: 'Access denied to this property' })
        return
      }

      // Get order
      const order = await prisma.order.findFirst({
        where: {
          id: data.orderId,
          tenantId: tenantId
        },
        include: {
          items: {
            include: {
              menuItem: { select: { name: true } }
            }
          },
          table: { select: { number: true } }
        }
      })

      if (!order) {
        socket.emit('error', { message: 'Order not found' })
        return
      }

      const previousStatus = order.kitchenStatus

      // Update order status
      const updatedOrder = await prisma.order.update({
        where: { id: data.orderId },
        data: {
          kitchenStatus: data.kitchenStatus,
          kitchenStartedAt: data.kitchenStatus === 'cooking' ? new Date() : order.kitchenStartedAt,
          kitchenCompletedAt: data.kitchenStatus === 'ready' ? new Date() : order.kitchenCompletedAt,
          status: data.kitchenStatus === 'ready' ? 'ready' : data.kitchenStatus === 'cooking' ? 'preparing' : order.status
        }
      })

      // Create payload
      const payload: KitchenOrderPayload = {
        orderId: data.orderId,
        tenantId: tenantId,
        propertyId: data.propertyId,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        kitchenStatus: data.kitchenStatus,
        previousStatus: previousStatus || undefined,
        tableNumber: order.table?.number,
        guestName: order.guestName || undefined,
        items: order.items.map(item => ({
          name: item.menuItem.name,
          quantity: item.quantity,
          notes: item.notes || undefined
        })),
        timestamp: new Date()
      }

      // Emit to kitchen room
      io.to(`kitchen:${data.propertyId}`).emit('kitchen:order', payload)

      // Also emit to tenant room
      io.to(`tenant:${tenantId}`).emit('kitchen:order', payload)

      console.log(`[Kitchen] Order ${order.orderNumber} status: ${previousStatus} -> ${data.kitchenStatus}`)
    } catch (error) {
      console.error('Error updating kitchen order:', error)
      socket.emit('error', { message: 'Failed to update order status' })
    }
  })

  // ============ NOTIFICATION EVENTS ============

  // Handle notification acknowledgment
  socket.on('notification:acknowledge', async (data: { notificationId: string }) => {
    try {
      // Mark notification as read in database
      await prisma.notification.updateMany({
        where: {
          id: data.notificationId,
          userId: userId
        },
        data: {
          read: true,
          readAt: new Date()
        }
      })

      socket.emit('notification:acknowledged', { notificationId: data.notificationId })
    } catch (error) {
      console.error('Error acknowledging notification:', error)
    }
  })

  // ============ BOOKING EVENTS ============

  // Handle booking update request
  socket.on('booking:request_update', async (data: {
    bookingId: string
    updates: Record<string, unknown>
  }) => {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          id: data.bookingId,
          tenantId: tenantId
        },
        include: {
          guest: { select: { firstName: true, lastName: true } },
          room: { select: { number: true } }
        }
      })

      if (!booking) {
        socket.emit('error', { message: 'Booking not found' })
        return
      }

      // Whitelist allowed booking update fields
      const ALLOWED_BOOKING_FIELDS = ['status', 'roomAssigned', 'notes', 'checkedIn', 'checkedOut', 'internalNotes']
      const sanitizedUpdates: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(data.updates)) {
        if (ALLOWED_BOOKING_FIELDS.includes(key)) {
          sanitizedUpdates[key] = value
        }
      }
      if (Object.keys(sanitizedUpdates).length === 0) {
        return socket.emit('error', { message: 'No valid fields to update' })
      }

      // Update booking with tenant ownership enforcement
      const updatedBooking = await prisma.booking.update({
        where: { id: data.bookingId, tenantId: socket.data.tenantId },
        data: sanitizedUpdates
      })

      // Emit update event
      io.to(`tenant:${tenantId}`).emit('booking:update', {
        bookingId: data.bookingId,
        propertyId: booking.propertyId,
        tenantId: tenantId,
        updates: data.updates,
        timestamp: new Date().toISOString()
      })

      // Also emit to property room
      io.to(`property:${booking.propertyId}`).emit('booking:update', {
        bookingId: data.bookingId,
        propertyId: booking.propertyId,
        tenantId: tenantId,
        updates: data.updates,
        timestamp: new Date().toISOString()
      })

      console.log(`[Booking] Booking ${booking.confirmationCode} updated`)
    } catch (error) {
      console.error('Error updating booking:', error)
      socket.emit('error', { message: 'Failed to update booking' })
    }
  })

  // ============ DISCONNECT HANDLER ============

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Realtime Service] User disconnected: ${socket.id}`)

    // Clean up tenant room tracking
    const tenantSet = tenantRooms.get(tenantId)
    if (tenantSet) {
      tenantSet.delete(socket.id)
      if (tenantSet.size === 0) {
        tenantRooms.delete(tenantId)
      }
    }

    // Clean up user room tracking
    const userSet = userRooms.get(userId)
    if (userSet) {
      userSet.delete(socket.id)
      if (userSet.size === 0) {
        userRooms.delete(userId)
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
    console.error(`[Realtime Service] Socket error (${socket.id}):`, error)
  })
})

// ============ EXPORTED EMIT FUNCTIONS ============

// Room status change
export function emitRoomStatusChange(payload: RoomStatusPayload) {
  io.to(`tenant:${payload.tenantId}`).emit('room:status', payload)
  io.to(`property:${payload.propertyId}`).emit('room:status', payload)
  console.log(`[Emit] Room status change: ${payload.roomId} -> ${payload.status}`)
}

// Booking created
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

// Booking cancelled
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

// Booking update
export function emitBookingUpdate(payload: BookingPayload & { updates?: Record<string, unknown> }) {
  io.to(`tenant:${payload.tenantId}`).emit('booking:update', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  io.to(`property:${payload.propertyId}`).emit('booking:update', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  console.log(`[Emit] Booking update: ${payload.confirmationCode}`)
}

// Availability update
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

// Chat message
export function emitChatMessage(payload: ChatMessagePayload) {
  io.to(`tenant:${payload.tenantId}`).emit('chat:message', payload)
  io.to(`conversation:${payload.conversationId}`).emit('chat:message', payload)
  console.log(`[Emit] Chat message: ${payload.conversationId}`)
}

// Kitchen order update
export function emitKitchenOrderUpdate(payload: KitchenOrderPayload) {
  io.to(`tenant:${payload.tenantId}`).emit('kitchen:order', payload)
  io.to(`kitchen:${payload.propertyId}`).emit('kitchen:order', payload)
  console.log(`[Emit] Kitchen order: ${payload.orderNumber} -> ${payload.kitchenStatus}`)
}

// Notification
export function emitNotification(payload: NotificationPayload) {
  if (payload.userId) {
    io.to(`user:${payload.userId}`).emit('notification:alert', payload)
  } else {
    io.to(`tenant:${payload.tenantId}`).emit('notification:alert', payload)
  }
  console.log(`[Emit] Notification: ${payload.title}`)
}

// Booking checked in
export function emitBookingCheckedIn(payload: BookingPayload) {
  io.to(`tenant:${payload.tenantId}`).emit('booking:checked_in', {
    ...payload,
    status: 'checked_in',
    timestamp: new Date().toISOString()
  })
  io.to(`property:${payload.propertyId}`).emit('booking:checked_in', {
    ...payload,
    status: 'checked_in',
    timestamp: new Date().toISOString()
  })
  console.log(`[Emit] Booking checked in: ${payload.confirmationCode}`)
}

// Booking checked out
export function emitBookingCheckedOut(payload: BookingPayload) {
  io.to(`tenant:${payload.tenantId}`).emit('booking:checked_out', {
    ...payload,
    status: 'checked_out',
    timestamp: new Date().toISOString()
  })
  io.to(`property:${payload.propertyId}`).emit('booking:checked_out', {
    ...payload,
    status: 'checked_out',
    timestamp: new Date().toISOString()
  })
  console.log(`[Emit] Booking checked out: ${payload.confirmationCode}`)
}

// Task assigned
export function emitTaskAssigned(payload: TaskPayload) {
  io.to(`tenant:${payload.tenantId}`).emit('task:assigned', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  if (payload.propertyId) {
    io.to(`property:${payload.propertyId}`).emit('task:assigned', {
      ...payload,
      timestamp: new Date().toISOString()
    })
  }
  if (payload.assignedTo) {
    io.to(`user:${payload.assignedTo}`).emit('task:assigned', {
      ...payload,
      timestamp: new Date().toISOString()
    })
  }
  console.log(`[Emit] Task assigned: ${payload.title}`)
}

// Dashboard update
export function emitDashboardUpdate(payload: DashboardUpdatePayload) {
  io.to(`tenant:${payload.tenantId}`).emit('dashboard:update', {
    ...payload,
    timestamp: new Date().toISOString()
  })
  console.log(`[Emit] Dashboard update: ${payload.type}`)
}

// Availability changed (renamed for consistency)
export function emitAvailabilityChanged(payload: AvailabilityUpdatePayload) {
  io.to(`tenant:${payload.tenantId}`).emit('availability:changed', {
    ...payload,
    date: payload.date instanceof Date ? payload.date.toISOString() : payload.date,
    timestamp: new Date().toISOString()
  })
  io.to(`property:${payload.propertyId}`).emit('availability:changed', {
    ...payload,
    date: payload.date instanceof Date ? payload.date.toISOString() : payload.date,
    timestamp: new Date().toISOString()
  })
  console.log(`[Emit] Availability changed: Property ${payload.propertyId}`)
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
    })),
    users: Array.from(userRooms.entries()).map(([userId, sockets]) => ({
      userId,
      connections: sockets.size
    }))
  }
}

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[Realtime Service] WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Realtime Service] Received SIGTERM signal, shutting down...')
  httpServer.close(() => {
    prisma.$disconnect()
    console.log('[Realtime Service] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[Realtime Service] Received SIGINT signal, shutting down...')
  httpServer.close(() => {
    prisma.$disconnect()
    console.log('[Realtime Service] Server closed')
    process.exit(0)
  })
})

export { io }
