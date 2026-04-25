import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// In-memory rate limiting (30 searches per IP per 15 minutes)
const availabilityRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkAvailabilityRateLimit(identifier: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = availabilityRateLimitMap.get(identifier);
  if (!entry || now > entry.resetAt) {
    availabilityRateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count++;
  return true;
}

function getAvailabilityRateLimitReset(identifier: string): number | null {
  const entry = availabilityRateLimitMap.get(identifier);
  if (!entry) return null;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
}

// GET - Public availability check (no auth required)
export async function GET(request: NextRequest) {
  try {
    // Rate limit check (30 searches per IP per 15 minutes)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown';
    if (!checkAvailabilityRateLimit(clientIp, 30, 15 * 60 * 1000)) {
      const retryAfter = getAvailabilityRateLimitReset(clientIp) || 900;
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = parseInt(searchParams.get('adults') || '1');
    const children = parseInt(searchParams.get('children') || '0');

    // Validate required parameters
    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Missing required parameters: propertyId, checkIn, checkOut' },
        { status: 400 }
      );
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      );
    }

    if (checkInDate < new Date()) {
      return NextResponse.json(
        { error: 'Check-in date cannot be in the past' },
        { status: 400 }
      );
    }

    // Get property details
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        currency: true,
        checkInTime: true,
        checkOutTime: true,
        timezone: true,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Get all room types for this property
    const roomTypes = await db.roomType.findMany({
      where: {
        propertyId,
        status: 'active',
      },
      include: {
        rooms: {
          where: { status: 'available' },
        },
        ratePlans: {
          where: { status: 'active' },
          orderBy: { basePrice: 'asc' },
        },
      },
    });

    // Get existing bookings for the date range
    const existingBookings = await db.booking.findMany({
      where: {
        propertyId,
        status: { in: ['confirmed', 'checked_in'] },
        OR: [
          {
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
        ],
      },
      select: {
        roomId: true,
        roomTypeId: true,
        checkIn: true,
        checkOut: true,
      },
    });

    // Get inventory locks for the date range
    const inventoryLocks = await db.inventoryLock.findMany({
      where: {
        propertyId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
        AND: [
          { startDate: { lt: checkOutDate } },
          { endDate: { gt: checkInDate } },
        ],
      },
      select: {
        roomId: true,
        roomTypeId: true,
        lockType: true,
      },
    });

    // Calculate availability for each room type
    const availability = roomTypes.map(roomType => {
      const totalRooms = roomType.rooms.length;
      
      // Count booked rooms
      const bookedRoomIds = new Set(
        existingBookings
          .filter(b => b.roomTypeId === roomType.id && b.roomId)
          .map(b => b.roomId)
      );

      // Count locked rooms
      const lockedRoomIds = new Set(
        inventoryLocks
          .filter(l => l.roomTypeId === roomType.id && l.roomId)
          .map(l => l.roomId)
      );

      // Calculate available rooms
      const availableRooms = roomType.rooms.filter(
        room => !bookedRoomIds.has(room.id) && !lockedRoomIds.has(room.id)
      );

      // Calculate nights
      const nights = Math.ceil(
        (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get best available rate
      const bestRate = roomType.ratePlans.length > 0 ? roomType.ratePlans[0] : null;

      // Calculate total price
      const basePrice = bestRate ? bestRate.basePrice * nights : roomType.basePrice * nights;

      // Check capacity
      const fitsCapacity = adults + children <= roomType.maxOccupancy;

      return {
        roomType: {
          id: roomType.id,
          name: roomType.name,
          code: roomType.code,
          description: roomType.description,
          maxAdults: roomType.maxAdults,
          maxChildren: roomType.maxChildren,
          maxOccupancy: roomType.maxOccupancy,
          sizeSqMeters: roomType.sizeSqMeters,
          amenities: JSON.parse(roomType.amenities || '[]'),
          images: JSON.parse(roomType.images || '[]'),
          basePrice: roomType.basePrice,
          currency: roomType.currency,
        },
        availability: {
          totalRooms,
          availableRooms: availableRooms.length,
          bookedRooms: bookedRoomIds.size,
          lockedRooms: lockedRoomIds.size,
          isAvailable: availableRooms.length > 0 && fitsCapacity,
        },
        pricing: {
          nights,
          pricePerNight: bestRate?.basePrice || roomType.basePrice,
          totalPrice: basePrice,
          currency: property.currency,
          ratePlan: bestRate ? {
            id: bestRate.id,
            name: bestRate.name,
            mealPlan: bestRate.mealPlan,
            cancellationPolicy: bestRate.cancellationPolicy,
          } : null,
        },
        fitsCapacity,
      };
    });

    // Calculate overall statistics
    const stats = {
      totalRoomTypes: availability.length,
      availableRoomTypes: availability.filter(a => a.availability.isAvailable).length,
      totalRooms: availability.reduce((sum, a) => sum + a.availability.totalRooms, 0),
      availableRooms: availability.reduce((sum, a) => sum + a.availability.availableRooms, 0),
      minPrice: Math.min(...availability.filter(a => a.availability.isAvailable).map(a => a.pricing.pricePerNight)),
      maxPrice: Math.max(...availability.filter(a => a.availability.isAvailable).map(a => a.pricing.pricePerNight)),
    };

    return NextResponse.json({
      property,
      searchCriteria: {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        adults,
        children,
        nights: Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
      availability,
      stats,
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    );
  }
}
