import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// OTA Webhook Handler - Handles inbound reservations from Booking.com, Airbnb, Expedia

interface OTAWebhookPayload {
  event_type: 'reservation_created' | 'reservation_modified' | 'reservation_cancelled';
  event_id: string;
  timestamp: string;
  data: {
    reservation_id: string;
    channel: 'booking_com' | 'airbnb' | 'expedia';
    property_id?: string;
    room_type_id?: string;
    guest: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      country?: string;
    };
    check_in: string;
    check_out: string;
    guests: number;
    total_amount: number;
    currency: string;
    special_requests?: string;
    status: string;
  };
}

// Verify webhook signature using HMAC-SHA256
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// Generate idempotency key
function generateIdempotencyKey(channel: string, eventId: string): string {
  return `${channel}:${eventId}`;
}

// POST /api/ota/webhooks - Handle OTA webhooks
export async function POST(request: NextRequest) {
  try {
    const rawPayload = await request.text();
    let payload: OTAWebhookPayload;
    
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Get signature from header
    const signature = request.headers.get('x-ota-signature') || 
                      request.headers.get('x-booking-signature') ||
                      request.headers.get('x-airbnb-signature') ||
                      request.headers.get('x-expedia-signature') || '';
    const channel = payload.data.channel;

    // Get channel connection to verify signature
    const connection = await db.channelConnection.findFirst({
      where: {
        channel,
        status: 'active',
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Channel not configured or inactive' },
        { status: 400 }
      );
    }

    // Verify signature in production
    if (process.env.NODE_ENV === 'production') {
      // Get webhook secret from connection config or environment
      const config = connection.apiSecret || process.env[`${channel.toUpperCase()}_WEBHOOK_SECRET`];
      
      if (config) {
        if (!verifySignature(rawPayload, signature, config)) {
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }
      }
    }

    // Check idempotency
    const idempotencyKey = generateIdempotencyKey(channel, payload.event_id);
    const existingLog = await db.channelSyncLog.findFirst({
      where: {
        connectionId: connection.id,
        correlationId: idempotencyKey,
      },
    });

    if (existingLog) {
      // Already processed, return success
      // Parse bookingId from response payload
      let bookingId = 'unknown';
      try {
        const responseData = JSON.parse(existingLog.responsePayload || '{}');
        bookingId = responseData.bookingId || 'unknown';
      } catch {
        // Keep default
      }
      
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        bookingId,
      });
    }

    // Process based on event type
    let booking;
    const tenantId = connection.tenantId;

    switch (payload.event_type) {
      case 'reservation_created':
        booking = await handleReservationCreated(tenantId, connection, payload);
        break;
      case 'reservation_modified':
        booking = await handleReservationModified(tenantId, connection, payload);
        break;
      case 'reservation_cancelled':
        booking = await handleReservationCancelled(tenantId, connection, payload);
        break;
      default:
        return NextResponse.json(
          { error: 'Unknown event type' },
          { status: 400 }
        );
    }

    // Log sync
    await db.channelSyncLog.create({
      data: {
        connectionId: connection.id,
        syncType: 'booking',
        direction: 'inbound',
        status: 'success',
        correlationId: idempotencyKey,
        requestPayload: rawPayload,
        responsePayload: JSON.stringify({ bookingId: booking.id }),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        module: 'channel_manager',
        action: `ota_${payload.event_type}`,
        entityType: 'booking',
        entityId: booking.id,
        newValue: JSON.stringify({
          channel,
          reservationId: payload.data.reservation_id,
          guest: payload.data.guest,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      confirmationCode: booking.confirmationCode,
    });
  } catch (error) {
    console.error('OTA webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleReservationCreated(
  tenantId: string,
  connection: { id: string; channel: string; tenantId: string },
  payload: OTAWebhookPayload
) {
  const { data } = payload;

  // Find or create guest (email is not unique, so use findFirst)
  let guest = data.guest.email ? await db.guest.findFirst({
    where: { email: data.guest.email, tenantId },
  }) : null;

  if (!guest) {
    guest = await db.guest.create({
      data: {
        tenantId,
        firstName: data.guest.first_name,
        lastName: data.guest.last_name,
        email: data.guest.email,
        phone: data.guest.phone,
        nationality: data.guest.country,
        source: data.channel === 'booking_com' ? 'booking_com' : 
                data.channel === 'airbnb' ? 'airbnb' : 'expedia',
        kycStatus: 'pending',
      },
    });
  }

  // Find room type mapping
  const mapping = await db.channelMapping.findFirst({
    where: {
      connectionId: connection.id,
      externalRoomId: data.room_type_id,
    },
    include: { roomType: true },
  });

  if (!mapping) {
    throw new Error('Room type mapping not found');
  }

  // Find available room
  const checkIn = new Date(data.check_in);
  const checkOut = new Date(data.check_out);

  // Check for available rooms
  const bookedRoomIds = await db.booking.findMany({
    where: {
      tenantId,
      roomTypeId: mapping.roomTypeId,
      status: { notIn: ['cancelled', 'no_show'] },
      OR: [
        {
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      ],
    },
    select: { roomId: true },
  });

  const bookedIds = bookedRoomIds.map(b => b.roomId).filter((id): id is string => id !== null);

  const availableRoom = await db.room.findFirst({
    where: {
      roomTypeId: mapping.roomTypeId,
      id: { notIn: bookedIds },
      status: 'available',
    },
  });

  if (!availableRoom) {
    throw new Error('No available room for this booking');
  }

  // Generate confirmation code
  const confirmationCode = `OTA-${Date.now().toString(36).toUpperCase()}`;

  // Calculate nights and room rate
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  const roomRate = data.total_amount / nights;

  // Create booking
  const booking = await db.booking.create({
    data: {
      tenantId,
      propertyId: mapping.roomType.propertyId,
      confirmationCode,
      primaryGuestId: guest.id,
      roomId: availableRoom.id,
      roomTypeId: mapping.roomTypeId,
      checkIn,
      checkOut,
      adults: data.guests,
      children: 0,
      roomRate,
      taxes: 0,
      fees: 0,
      totalAmount: data.total_amount,
      currency: data.currency || 'USD',
      source: data.channel === 'booking_com' ? 'booking_com' : 
              data.channel === 'airbnb' ? 'airbnb' : 'expedia',
      externalRef: data.reservation_id,
      status: 'confirmed',
      specialRequests: data.special_requests,
    },
  });

  return booking;
}

async function handleReservationModified(
  tenantId: string,
  connection: { id: string; channel: string; tenantId: string },
  payload: OTAWebhookPayload
) {
  const { data } = payload;

  // Find existing booking by OTA reservation ID
  const existingBooking = await db.booking.findFirst({
    where: {
      tenantId,
      externalRef: data.reservation_id,
    },
  });

  if (!existingBooking) {
    // If not found, create new reservation
    return handleReservationCreated(tenantId, connection, payload);
  }

  // Update booking
  const updatedBooking = await db.booking.update({
    where: { id: existingBooking.id },
    data: {
      checkIn: new Date(data.check_in),
      checkOut: new Date(data.check_out),
      adults: data.guests,
      totalAmount: data.total_amount,
      specialRequests: data.special_requests,
    },
  });

  return updatedBooking;
}

async function handleReservationCancelled(
  tenantId: string,
  connection: { id: string; channel: string; tenantId: string },
  payload: OTAWebhookPayload
) {
  const { data } = payload;

  // Find existing booking
  const existingBooking = await db.booking.findFirst({
    where: {
      tenantId,
      externalRef: data.reservation_id,
    },
  });

  if (!existingBooking) {
    return { id: 'not_found', confirmationCode: 'N/A' };
  }

  const booking = await db.booking.update({
    where: { id: existingBooking.id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: 'Cancelled via OTA webhook',
    },
  });

  return booking;
}

// GET /api/ota/webhooks - List recent webhook events (requires auth)
export async function GET(request: NextRequest) {
  // This endpoint requires authentication
  const token = request.cookies.get('session_token')?.value;
  
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { tenantId: true, status: true } } },
  });

  if (!session || session.expiresAt < new Date() || session.user.status !== 'active') {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    );
  }

  const tenantId = session.user.tenantId;

  const logs = await db.channelSyncLog.findMany({
    where: {
      connection: { tenantId },
      syncType: 'booking',
      direction: 'inbound',
    },
    include: {
      connection: {
        select: {
          displayName: true,
          channel: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ 
    success: true,
    logs: logs.map(log => ({
      ...log,
      channelName: log.connection.displayName,
      channelType: log.connection.channel,
    }))
  });
}
