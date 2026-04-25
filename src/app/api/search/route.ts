import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

interface SearchResult {
  bookings: Array<{
    id: string;
    confirmationCode: string;
    guestName: string;
    status: string;
    checkIn: string;
    checkOut: string;
    roomNumber?: string;
    propertyId: string;
    propertyName: string;
  }>;
  guests: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    loyaltyTier: string;
    isVip: boolean;
    totalStays: number;
  }>;
  rooms: Array<{
    id: string;
    number: string;
    name: string | null;
    floor: number;
    status: string;
    roomTypeName: string;
    propertyId: string;
    propertyName: string;
  }>;
  properties: Array<{
    id: string;
    name: string;
    type: string;
    city: string;
    country: string;
    status: string;
    totalRooms: number;
  }>;
  users: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string | null;
    department: string | null;
    status: string;
  }>;
}

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, 'dashboard.view');
    if (session instanceof NextResponse) return session;

    const tenantId = session.tenantId;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limitParam = parseInt(searchParams.get('limit') || '10');
    const limit = Math.min(limitParam, MAX_LIMIT);
    const skip = (page - 1) * limit;

    if (!query.trim()) {
      return NextResponse.json({
        success: true,
        data: {
          bookings: [],
          guests: [],
          rooms: [],
          properties: [],
          users: [],
        },
      });
    }

    const searchTerm = query.toLowerCase().trim();

    const result: SearchResult = {
      bookings: [],
      guests: [],
      rooms: [],
      properties: [],
      users: [],
    };

    // Search Bookings
    const bookings = await db.booking.findMany({
      where: {
        tenantId,
        OR: [
          { confirmationCode: { contains: searchTerm } },
          { externalRef: { contains: searchTerm } },
          { primaryGuest: { firstName: { contains: searchTerm } } },
          { primaryGuest: { lastName: { contains: searchTerm } } },
          { primaryGuest: { email: { contains: searchTerm } } },
        ],
      },
      take: limit,
      skip,
      include: {
        primaryGuest: true,
        room: true,
        roomType: {
          include: {
            property: true,
          },
        },
      },
    });

    result.bookings = bookings.map((booking) => ({
      id: booking.id,
      confirmationCode: booking.confirmationCode,
      guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
      status: booking.status,
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      roomNumber: booking.room?.number,
      propertyId: booking.roomType?.propertyId || '',
      propertyName: booking.roomType?.property?.name || '',
    }));

    // Search Guests
    const guests = await db.guest.findMany({
      where: {
        tenantId,
        OR: [
          { firstName: { contains: searchTerm } },
          { lastName: { contains: searchTerm } },
          { email: { contains: searchTerm } },
          { phone: { contains: searchTerm } },
          { alternatePhone: { contains: searchTerm } },
        ],
      },
      take: limit,
      skip,
    });

    result.guests = guests.map((guest) => ({
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      phone: guest.phone,
      loyaltyTier: guest.loyaltyTier,
      isVip: guest.isVip,
      totalStays: guest.totalStays,
    }));

    // Search Rooms - need to get tenantId from property
    const properties = await db.property.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const propertyIds = properties.map((p) => p.id);

    const rooms = await db.room.findMany({
      where: {
        roomType: { propertyId: { in: propertyIds } },
        OR: [
          { number: { contains: searchTerm } },
          { name: { contains: searchTerm } },
        ],
      },
      take: limit,
      skip,
      include: {
        roomType: {
          include: {
            property: true,
          },
        },
      },
    });

    result.rooms = rooms.map((room) => ({
      id: room.id,
      number: room.number,
      name: room.name,
      floor: room.floor,
      status: room.status,
      roomTypeName: room.roomType?.name || '',
      propertyId: room.roomType?.propertyId || '',
      propertyName: room.roomType?.property?.name || '',
    }));

    // Search Properties
    const propertiesResult = await db.property.findMany({
      where: {
        tenantId,
        OR: [
          { name: { contains: searchTerm } },
          { city: { contains: searchTerm } },
          { country: { contains: searchTerm } },
          { address: { contains: searchTerm } },
        ],
      },
      take: limit,
      skip,
    });

    result.properties = propertiesResult.map((property) => ({
      id: property.id,
      name: property.name,
      type: property.type,
      city: property.city,
      country: property.country,
      status: property.status,
      totalRooms: property.totalRooms,
    }));

    // Search Users (only if user has permission)
    const hasUserPermission = session.permissions?.includes('users:read') || 
                              session.permissions?.includes('users:all');
    
    if (hasUserPermission) {
      const users = await db.user.findMany({
        where: {
          tenantId,
          OR: [
            { firstName: { contains: searchTerm } },
            { lastName: { contains: searchTerm } },
            { email: { contains: searchTerm } },
          ],
        },
        take: limit,
        skip,
      });

      result.users = users.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        jobTitle: user.jobTitle,
        department: user.department,
        status: user.status,
      }));
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to perform search' } },
      { status: 500 }
    );
  }
}
