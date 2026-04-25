import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/properties/[id] - Get a single property
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'properties.view') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    
    const property = await db.property.findUnique({
      where: { id, deletedAt: null },
      include: {
        roomTypes: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        rooms: {
          where: { deletedAt: null },
          include: {
            roomType: true,
          },
        },
        _count: {
          select: {
            rooms: true,
            roomTypes: true,
          },
        },
      },
    });
    
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    if (property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...property,
        totalRooms: property._count.rooms,
        totalRoomTypes: property._count.roomTypes,
      },
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch property' } },
      { status: 500 }
    );
  }
}

// PUT /api/properties/[id] - Update a property
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'properties.update') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    const body = await request.json();
    
    const existingProperty = await db.property.findUnique({
      where: { id, deletedAt: null },
    });
    
    if (!existingProperty) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    if (existingProperty.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }
    
    const {
      name,
      slug,
      description,
      type,
      address,
      city,
      state,
      country,
      postalCode,
      latitude,
      longitude,
      email,
      phone,
      website,
      logo,
      primaryColor,
      secondaryColor,
      checkInTime,
      checkOutTime,
      timezone,
      currency,
      // Tax configuration
      taxId,
      taxType,
      defaultTaxRate,
      taxComponents,
      serviceChargePercent,
      includeTaxInPrice,
      totalFloors,
      status,
    } = body;
    
    const property = await db.$transaction(async (tx) => {
      // If slug is being changed, check for conflicts
      if (slug && slug !== existingProperty.slug) {
        const slugConflict = await tx.property.findUnique({
          where: {
            tenantId_slug: {
              tenantId: existingProperty.tenantId,
              slug,
            },
          },
        });
        
        if (slugConflict) {
          throw new Error('DUPLICATE_SLUG');
        }
      }
      
      return tx.property.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(slug && { slug }),
          ...(description !== undefined && { description }),
          ...(type && { type }),
          ...(address && { address }),
          ...(city && { city }),
          ...(state !== undefined && { state }),
          ...(country && { country }),
          ...(postalCode !== undefined && { postalCode }),
          ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
          ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(website !== undefined && { website }),
          ...(logo !== undefined && { logo }),
          ...(primaryColor !== undefined && { primaryColor }),
          ...(secondaryColor !== undefined && { secondaryColor }),
          ...(checkInTime && { checkInTime }),
          ...(checkOutTime && { checkOutTime }),
          ...(timezone && { timezone }),
          ...(currency && { currency }),
          // Tax configuration
          ...(taxId !== undefined && { taxId }),
          ...(taxType !== undefined && { taxType }),
          ...(defaultTaxRate !== undefined && { defaultTaxRate: parseFloat(defaultTaxRate) || 0 }),
          ...(taxComponents !== undefined && { taxComponents: JSON.stringify(taxComponents) }),
          ...(serviceChargePercent !== undefined && { serviceChargePercent: parseFloat(serviceChargePercent) || 0 }),
          ...(includeTaxInPrice !== undefined && { includeTaxInPrice }),
          ...(totalFloors !== undefined && { totalFloors }),
          ...(status && { status }),
        },
      });
    });
    
    return NextResponse.json({ success: true, data: property });
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_SLUG') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_SLUG', message: 'A property with this slug already exists' } },
        { status: 400 }
      );
    }
    console.error('Error updating property:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update property' } },
      { status: 500 }
    );
  }
}

// DELETE /api/properties/[id] - Soft delete a property
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'properties.delete') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    
    const existingProperty = await db.property.findUnique({
      where: { id, deletedAt: null },
    });
    
    if (!existingProperty) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    if (existingProperty.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }
    
    // Soft delete in a transaction for atomicity
    await db.$transaction(async (tx) => {
      await tx.property.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
    
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting property:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete property' } },
      { status: 500 }
    );
  }
}
