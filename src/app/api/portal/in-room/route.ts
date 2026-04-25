import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/portal/in-room - Get in-room portal data for a room (token or session required)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomNumber = searchParams.get('roomNumber');
    const portalToken = searchParams.get('token');

    // Require authentication: either a portalToken in query OR a session cookie
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!portalToken && !sessionToken) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required: provide a valid token or session' } },
        { status: 401 }
      );
    }

    // Find room by number or by booking token
    let room: any = null;
    let booking: any = null;

    if (roomNumber) {
      room = await db.room.findFirst({
        where: { number: roomNumber },
        include: {
          roomType: {
            include: { property: true },
          },
          iotDevices: true,
          bookings: {
            where: {
              status: 'checked_in',
            },
            orderBy: { checkIn: 'desc' },
            take: 1,
            include: {
              primaryGuest: true,
            },
          },
        },
      });

      if (room && room.bookings.length > 0) {
        booking = room.bookings[0];
      }
    } else if (portalToken) {
      booking = await db.booking.findFirst({
        where: {
          portalToken: portalToken,
          status: 'checked_in',
        },
        include: {
          primaryGuest: true,
          room: {
            include: {
              roomType: {
                include: { property: true },
              },
              iotDevices: true,
            },
          },
        },
      });

      if (booking) {
        room = booking.room;
      }
    }

    // If no room found, return minimal response
    if (!room) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active room or booking found' },
      }, { status: 404 });
    }

    // Get IoT devices and create controls
    const controls: Array<{ id: string; name: string; type: string; enabled: boolean; value?: number | string; unit?: string }> = [];
    if (room.iotDevices) {
      for (const device of room.iotDevices) {
        const state = device.currentState ? JSON.parse(device.currentState) : {};
        controls.push({
          id: device.id,
          name: device.name,
          type: device.type,
          enabled: state.power || false,
          value: state.value || state.brightness || state.temperature,
          unit: device.type === 'ac' ? '°C' : device.type === 'light' ? '%' : undefined,
        });
      }
    }

    // If no IoT devices, create default controls from room config
    if (controls.length === 0) {
      const roomConfig = room.smartRoomConfig ? JSON.parse(room.smartRoomConfig) : {};
      controls.push(
        { id: 'ctrl-1', name: 'Main Lights', type: 'light', enabled: roomConfig.mainLights ?? true, value: roomConfig.mainLightsValue ?? 80, unit: '%' },
        { id: 'ctrl-2', name: 'AC Temperature', type: 'ac', enabled: roomConfig.acEnabled ?? true, value: roomConfig.acTemp ?? 22, unit: '°C' },
        { id: 'ctrl-3', name: 'TV', type: 'tv', enabled: roomConfig.tvEnabled ?? false },
        { id: 'ctrl-4', name: 'Blackout Curtains', type: 'curtain', enabled: roomConfig.curtainsEnabled ?? false, value: roomConfig.curtainsValue ?? 0, unit: '%' },
        { id: 'ctrl-5', name: 'Do Not Disturb', type: 'dnd', enabled: roomConfig.dnd ?? false },
        { id: 'ctrl-6', name: 'Privacy Mode', type: 'privacy', enabled: roomConfig.privacyMode ?? false },
      );
    }

    // Get service items from menu items
    const propertyId = room.roomType?.propertyId;
    const services: Array<{ id: string; name: string; category: string; description: string; price: number; available: boolean; preparationTime: number }> = [];

    if (propertyId) {
      const menuItems = await db.menuItem.findMany({
        where: {
          propertyId,
          isAvailable: true,
        },
        take: 20,
      });

      services.push(...menuItems.map(item => ({
        id: item.id,
        name: item.name,
        category: 'food',
        description: item.description || '',
        price: item.price,
        available: true,
        preparationTime: item.preparationTime || 25,
      })));
    }

    // Get recent service orders
    const recentOrders = await db.serviceRequest.findMany({
      where: {
        roomId: room.id,
        type: 'room_service',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const formattedOrders = recentOrders.map(order => ({
      id: order.id,
      subject: order.subject,
      items: [{ name: order.subject, quantity: 1 }],
      status: order.status === 'completed' ? 'delivered' : order.status === 'in_progress' ? 'preparing' : 'pending',
      orderedAt: order.createdAt.toISOString(),
      estimatedDelivery: order.status === 'pending' ? '30 mins' : undefined,
      roomNumber: room.number,
      specialRequests: order.description,
    }));

    const portalData = {
      roomNumber: room.number,
      roomType: room.roomType?.name || 'Standard Room',
      floor: room.floor,
      guestName: booking?.primaryGuest ? 
        `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}` : 'Guest',
      checkIn: booking?.checkIn?.toISOString() || null,
      checkOut: booking?.checkOut?.toISOString() || null,
      roomId: room.id,
      property: room.roomType?.property ? {
        id: room.roomType.property.id,
        name: room.roomType.property.name,
        phone: room.roomType.property.phone,
        checkInTime: room.roomType.property.checkInTime,
        checkOutTime: room.roomType.property.checkOutTime,
      } : null,
      controls,
      services,
      recentOrders: formattedOrders,
    };

    return NextResponse.json({
      success: true,
      data: portalData,
    });
  } catch (error) {
    console.error('Error fetching portal data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch portal data' } },
      { status: 500 }
    );
  }
}

// PUT /api/portal/in-room - Update room control (PUBLIC - token required)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, roomId, enabled, value, controlType, token } = body;

    // Require token for security
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Token required' } },
        { status: 401 }
      );
    }

    // Verify token belongs to a booking for this room
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: 'checked_in',
        roomId,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token for room' } },
        { status: 401 }
      );
    }

    if (deviceId) {
      // Check if it's an IoT device
      const device = await db.ioTDevice.findUnique({
        where: { id: deviceId },
      });

      if (device && device.roomId === roomId) {
        const currentState = device.currentState ? JSON.parse(device.currentState) : {};
        const newState = {
          ...currentState,
          power: enabled !== undefined ? enabled : currentState.power,
          value: value !== undefined ? value : currentState.value,
        };

        await db.ioTDevice.update({
          where: { id: deviceId },
          data: {
            currentState: JSON.stringify(newState),
            lastHeartbeat: new Date(),
          },
        });
      }
    }

    // Also update room's smart room config if roomId provided
    if (roomId && controlType) {
      const room = await db.room.findUnique({
        where: { id: roomId },
      });

      if (room) {
        const config = room.smartRoomConfig ? JSON.parse(room.smartRoomConfig) : {};
        
        switch (controlType) {
          case 'light':
            config.mainLights = enabled;
            if (value !== undefined) config.mainLightsValue = value;
            break;
          case 'ac':
            config.acEnabled = enabled;
            if (value !== undefined) config.acTemp = value;
            break;
          case 'tv':
            config.tvEnabled = enabled;
            break;
          case 'curtain':
            config.curtainsEnabled = enabled;
            if (value !== undefined) config.curtainsValue = value;
            break;
          case 'dnd':
            config.dnd = enabled;
            // Also update room status for DND
            if (enabled) {
              await db.room.update({
                where: { id: roomId },
                data: { status: 'do_not_disturb' },
              });
            }
            break;
          case 'privacy':
            config.privacyMode = enabled;
            break;
        }

        await db.room.update({
          where: { id: roomId },
          data: {
            smartRoomConfig: JSON.stringify(config),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Control updated',
    });
  } catch (error) {
    console.error('Error updating control:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update control' } },
      { status: 500 }
    );
  }
}
