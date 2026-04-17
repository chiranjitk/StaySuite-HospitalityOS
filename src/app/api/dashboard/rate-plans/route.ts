import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'dashboard.view');
  if (user instanceof NextResponse) return user;

  try {
    const tenantId = user.tenantId;
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true },
    });
    const propertyIds = properties.map(p => p.id);

    if (propertyIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          lastUpdated: new Date().toISOString(),
          plans: [],
          bestPerformer: null,
          hasData: false,
        },
      });
    }

    // Fetch real rate plan data from DB
    // RatePlan model: tenantId, roomTypeId, name, code, basePrice, status, deletedAt
    // Relations: roomType -> RoomType, tenant -> Tenant
    // No direct propertyId or property relation — filter through roomType
    const ratePlans = await db.ratePlan.findMany({
      where: {
        tenantId,
        roomType: { propertyId: { in: propertyIds } },
        deletedAt: null,
      },
      include: {
        roomType: {
          select: { name: true, id: true, propertyId: true, property: { select: { name: true } } },
        },
      },
      take: 10,
    });

    if (ratePlans.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          lastUpdated: new Date().toISOString(),
          plans: [],
          bestPerformer: null,
          hasData: false,
        },
      });
    }

    const plans = await Promise.all(ratePlans.map(async (plan) => {
      const rtPropertyId = plan.roomType.propertyId;

      // Count rooms for this room type
      const totalRooms = await db.room.count({
        where: {
          roomTypeId: plan.roomTypeId,
          propertyId: rtPropertyId,
          deletedAt: null,
        },
      });

      const occupiedRooms = await db.room.count({
        where: {
          roomTypeId: plan.roomTypeId,
          propertyId: rtPropertyId,
          status: 'occupied',
          deletedAt: null,
        },
      });

      // Count bookings for this rate plan
      const bookings = await db.booking.findMany({
        where: {
          ratePlanId: plan.id,
          propertyId: rtPropertyId,
          status: { notIn: ['cancelled'] },
          deletedAt: null,
        },
        select: { totalAmount: true },
      });

      const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
      const occupancy = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
      const avgRate = bookings.length > 0 ? Math.round(totalRevenue / bookings.length) : plan.basePrice;

      return {
        id: plan.id,
        name: plan.name,
        baseRate: plan.basePrice,
        avgRate,
        occupancy,
        revenue: totalRevenue,
        roomsBooked: bookings.length,
        totalRooms,
        trend: 0,
      };
    }));

    const bestPerformer = plans.length > 0
      ? plans.reduce((best, p) => p.revenue > best.revenue ? p : best, plans[0])?.id || null
      : null;

    return NextResponse.json({
      success: true,
      data: {
        lastUpdated: new Date().toISOString(),
        plans,
        bestPerformer,
        hasData: true,
      },
    });
  } catch (error) {
    console.error('[Rate Plans API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rate plan data' } },
      { status: 500 }
    );
  }
}
