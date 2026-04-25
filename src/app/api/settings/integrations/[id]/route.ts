/**
 * Delete a system integration config
 *
 * DELETE /api/settings/integrations/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(_request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 },
      );
    }

    const { id } = await params;

    // Verify the integration belongs to the current tenant
    const integration = await db.integration.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Integration not found' },
        { status: 404 },
      );
    }

    await db.integration.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Integration deleted successfully',
    });
  } catch (error) {
    console.error('[Integrations] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete integration' },
      { status: 500 },
    );
  }
}
