import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/wifi/plans - List all WiFi plans with filtering
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search,  } },
        { description: { contains: search,  } },
      ];
    }

    const plans = await db.wiFiPlan.findMany({
      where,
      include: {
        _count: {
          select: {
            vouchers: true,
            sessions: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.wiFiPlan.count({ where });

    // Calculate summary statistics
    const activePlans = await db.wiFiPlan.count({
      where: { ...where, status: 'active' },
    });

    const avgPrice = await db.wiFiPlan.aggregate({
      where,
      _avg: {
        price: true,
        downloadSpeed: true,
        uploadSpeed: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: plans,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        totalPlans: total,
        activePlans,
        avgPrice: avgPrice._avg.price || 0,
        avgDownloadSpeed: avgPrice._avg.downloadSpeed || 0,
        avgUploadSpeed: avgPrice._avg.uploadSpeed || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching WiFi plans:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch WiFi plans' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/plans - Create a new WiFi plan
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      
      name,
      description,
      downloadSpeed,
      uploadSpeed,
      dataLimit,
      sessionLimit,
      price = 0,
      currency = 'USD',
      priority = 0,
      validityDays = 1,
      status = 'active',
    } = body;

    // Validate required fields
    if (!name || downloadSpeed === undefined || uploadSpeed === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, downloadSpeed, uploadSpeed' } },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existingPlan = await db.wiFiPlan.findFirst({
      where: {
        tenantId,
        name: { equals: name,  },
      },
    });

    if (existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A WiFi plan with this name already exists' } },
        { status: 400 }
      );
    }

    const plan = await db.wiFiPlan.create({
      data: {
        tenantId,
        name,
        description,
        downloadSpeed: parseInt(downloadSpeed, 10),
        uploadSpeed: parseInt(uploadSpeed, 10),
        dataLimit: dataLimit ? parseInt(dataLimit, 10) : null,
        sessionLimit: sessionLimit ? parseInt(sessionLimit, 10) : null,
        price: parseFloat(price),
        currency,
        priority: parseInt(priority, 10),
        validityDays: parseInt(validityDays, 10),
        status,
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error('Error creating WiFi plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create WiFi plan' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/plans - Update a WiFi plan
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 }
      );
    }

    const existingPlan = await db.wiFiPlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify plan belongs to user's tenant
    if (existingPlan.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
        { status: 404 }
      );
    }

    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== existingPlan.name) {
      const duplicateName = await db.wiFiPlan.findFirst({
        where: {
          tenantId: existingPlan.tenantId,
          name: { equals: updateData.name,  },
          id: { not: id },
        },
      });

      if (duplicateName) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_NAME', message: 'A WiFi plan with this name already exists' } },
          { status: 400 }
        );
      }
    }

    const plan = await db.wiFiPlan.update({
      where: { id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.downloadSpeed !== undefined && { downloadSpeed: parseInt(updateData.downloadSpeed, 10) }),
        ...(updateData.uploadSpeed !== undefined && { uploadSpeed: parseInt(updateData.uploadSpeed, 10) }),
        ...(updateData.dataLimit !== undefined && { dataLimit: updateData.dataLimit ? parseInt(updateData.dataLimit, 10) : null }),
        ...(updateData.sessionLimit !== undefined && { sessionLimit: updateData.sessionLimit ? parseInt(updateData.sessionLimit, 10) : null }),
        ...(updateData.price !== undefined && { price: parseFloat(updateData.price) }),
        ...(updateData.currency && { currency: updateData.currency }),
        ...(updateData.priority !== undefined && { priority: parseInt(updateData.priority, 10) }),
        ...(updateData.validityDays !== undefined && { validityDays: parseInt(updateData.validityDays, 10) }),
        ...(updateData.status && { status: updateData.status }),
      },
    });

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error updating WiFi plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update WiFi plan' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/plans - Delete a WiFi plan
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 }
      );
    }

    const existingPlan = await db.wiFiPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            vouchers: true,
            sessions: true,
          },
        },
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify plan belongs to user's tenant
    if (existingPlan.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
        { status: 404 }
      );
    }

    // Check if plan has active vouchers or sessions
    if (existingPlan._count.vouchers > 0 || existingPlan._count.sessions > 0) {
      // Soft delete by setting status to inactive
      const plan = await db.wiFiPlan.update({
        where: { id },
        data: { status: 'inactive' },
      });

      return NextResponse.json({
        success: true,
        data: plan,
        message: 'WiFi plan deactivated (has associated vouchers/sessions)',
      });
    }

    // Hard delete if no associations
    await db.wiFiPlan.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'WiFi plan deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting WiFi plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete WiFi plan' } },
      { status: 500 }
    );
  }
}
