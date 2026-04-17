import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { OTAClientFactory } from '@/lib/ota';

// POST /api/ota/webhooks/[channel] - Handle OTA webhooks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await params;
    const body = await request.json();
    const headers = Object.fromEntries(request.headers.entries());

    // Get all connections for this channel
    const connections = await db.channelConnection.findMany({
      where: {
        channel,
        status: 'active',
      },
    });

    if (connections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active connections for this channel' },
        { status: 404 }
      );
    }

    // Get the appropriate client
    const client = OTAClientFactory.createClient(channel);
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Unknown channel type' },
        { status: 400 }
      );
    }

    // Process the webhook
    const result = await client.processWebhook(body, headers);

    // Handle different webhook event types
    if (result.success && result.data) {
      const eventData = result.data as Record<string, unknown>;

      switch (result.eventType) {
        case 'booking.created':
        case 'reservation.created':
          await handleBookingCreated(channel, eventData);
          break;
        
        case 'booking.modified':
        case 'reservation.modified':
          await handleBookingModified(channel, eventData);
          break;
        
        case 'booking.cancelled':
        case 'reservation.cancelled':
          await handleBookingCancelled(channel, eventData);
          break;
        
        case 'booking.no_show':
          await handleBookingNoShow(channel, eventData);
          break;
      }

      // Log the webhook
      await db.channelSyncLog.create({
        data: {
          connectionId: connections[0].id,
          syncType: 'booking',
          direction: 'inbound',
          status: 'success',
          requestPayload: JSON.stringify(headers),
          responsePayload: JSON.stringify(body),
          correlationId: `webhook-${Date.now()}`,
        },
      });
    }

    return NextResponse.json(result.response);
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// GET /api/ota/webhooks/[channel] - Webhook verification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  const { channel } = await params;
  const searchParams = request.nextUrl.searchParams;

  // Handle verification challenges from different OTAs
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  
  if (mode === 'subscribe' && token && challenge) {
    // Verify the token matches our expected token
    const expectedToken = process.env[`${channel.toUpperCase()}_VERIFY_TOKEN`];
    if (expectedToken && token === expectedToken) {
      return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
  }

  // Return webhook URL info
  const webhookUrl = `/api/ota/webhooks/${channel}`;
  return NextResponse.json({
    channel,
    webhookUrl,
    message: 'Webhook endpoint active',
  });
}

// Webhook event handlers
async function handleBookingCreated(channel: string, eventData: Record<string, unknown>): Promise<void> {
  const connection = await db.channelConnection.findFirst({
    where: { channel, status: 'active' },
  });

  if (!connection) return;

  const reservationId = eventData.reservationId as string || eventData.bookingId as string;
  const guestData = eventData.guest as Record<string, unknown> | undefined;

  // Check for existing booking
  const existingBooking = await db.booking.findFirst({
    where: {
      tenantId: connection.tenantId,
      externalRef: reservationId,
    },
  });

  if (existingBooking) return;

  // Find or create guest
  let guest: Awaited<ReturnType<typeof db.guest.findFirst>> = null;
  if (guestData?.email) {
    guest = await db.guest.findFirst({
      where: {
        tenantId: connection.tenantId,
        email: guestData.email as string,
      },
    });

    if (!guest) {
      guest = await db.guest.create({
        data: {
          tenantId: connection.tenantId,
          firstName: (guestData.firstName as string) || 'Unknown',
          lastName: (guestData.lastName as string) || 'Guest',
          email: guestData.email as string,
          phone: guestData.phone as string | undefined,
          nationality: guestData.country as string | undefined,
          source: channel,
        },
      });
    }
  }
}

async function handleBookingModified(channel: string, eventData: Record<string, unknown>): Promise<void> {
  const connection = await db.channelConnection.findFirst({
    where: { channel, status: 'active' },
  });

  if (!connection) return;

  const reservationId = eventData.reservationId as string || eventData.bookingId as string;

  const booking = await db.booking.findFirst({
    where: {
      tenantId: connection.tenantId,
      externalRef: reservationId,
    },
  });

  if (!booking) {
    await handleBookingCreated(channel, eventData);
    return;
  }

  // Update booking
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  
  if (eventData.checkIn) updateData.checkIn = new Date(eventData.checkIn as string);
  if (eventData.checkOut) updateData.checkOut = new Date(eventData.checkOut as string);
  
  const guests = eventData.guests as Record<string, number> | undefined;
  if (guests?.adults) updateData.adults = guests.adults;
  if (guests?.children) updateData.children = guests.children;

  await db.booking.update({
    where: { id: booking.id },
    data: updateData,
  });
}

async function handleBookingCancelled(channel: string, eventData: Record<string, unknown>): Promise<void> {
  const connection = await db.channelConnection.findFirst({
    where: { channel, status: 'active' },
  });

  if (!connection) return;

  const reservationId = eventData.reservationId as string || eventData.bookingId as string;

  const booking = await db.booking.findFirst({
    where: {
      tenantId: connection.tenantId,
      externalRef: reservationId,
    },
  });

  if (!booking) return;

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: (eventData.cancellationReason as string) || 'Cancelled via OTA',
      updatedAt: new Date(),
    },
  });
}

async function handleBookingNoShow(channel: string, eventData: Record<string, unknown>): Promise<void> {
  const connection = await db.channelConnection.findFirst({
    where: { channel, status: 'active' },
  });

  if (!connection) return;

  const reservationId = eventData.reservationId as string || eventData.bookingId as string;

  const booking = await db.booking.findFirst({
    where: {
      tenantId: connection.tenantId,
      externalRef: reservationId,
    },
  });

  if (!booking) return;

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: 'no_show',
      updatedAt: new Date(),
    },
  });
}
