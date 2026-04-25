import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/rooms/maintenance-blocks/[id]/complete - Mark maintenance block as completed
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['rooms.manage', 'admin.*', 'housekeeping.manage'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const { id } = await params;
    const body = await request.json();
    const { actualCost } = body;

    const block = await db.maintenanceBlock.findFirst({
      where: { id, tenantId },
    });

    if (!block) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Maintenance block not found' } }, { status: 404 });
    }

    if (block.status === 'completed' || block.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot complete a ${block.status} block` } },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const updatedBlock = await tx.maintenanceBlock.update({
        where: { id },
        data: {
          status: 'completed',
          actualCost: actualCost ? parseFloat(String(actualCost)) : null,
        },
      });

      // Check if there are other active blocks for this room
      const otherActiveBlocks = await tx.maintenanceBlock.count({
        where: {
          roomId: block.roomId,
          status: { in: ['scheduled', 'active'] },
          id: { not: id },
        },
      });

      // Only set room back to available if no other active blocks
      if (otherActiveBlocks === 0) {
        await tx.room.update({
          where: { id: block.roomId },
          data: { status: 'available' },
        });
      }

      return updatedBlock;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error completing maintenance block:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to complete maintenance block' } },
      { status: 500 }
    );
  }
}
