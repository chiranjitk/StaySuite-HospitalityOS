/**
 * Bond Config API Route
 *
 * List and create bond configurations for a property.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { createBond, persistBond } from '@/lib/network';

// GET /api/wifi/network/bonds - List all bond configs
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const bonds = await db.bondConfig.findMany({
      where,
      include: {
        members: {
          include: {
            networkInterface: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return NextResponse.json({ success: true, data: bonds });
  } catch (error) {
    console.error('Error fetching bond configs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bond configs' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/bonds - Create a new bond config
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      name,
      mode = 'active-backup',
      miimon = 100,
      lacpRate = 'slow',
      primaryMember,
      enabled = true,
      members = [],
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 },
      );
    }

    // Check for duplicate name within the property
    const existing = await db.bondConfig.findFirst({
      where: { propertyId, name, tenantId },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A bond with this name already exists on this property' } },
        { status: 400 },
      );
    }

    // Resolve member interface names from IDs for the shell script
    const ifaceNames: string[] = [];
    if (members.length > 0) {
      const ifaceRecords = await db.networkInterface.findMany({
        where: { id: { in: members }, tenantId },
        select: { name: true },
      });
      ifaceRecords.forEach((r) => ifaceNames.push(r.name));
      if (ifaceNames.length !== members.length) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'One or more member interface IDs not found' } },
          { status: 400 },
        );
      }
    }

    // Execute OS-level bond creation via shell script
    try {
      const osResult = createBond({
        name,
        mode,
        miimon,
        lacpRate,
        primary: primaryMember,
        members: ifaceNames,
      });
      if (!osResult.success) {
        return NextResponse.json(
          { success: false, error: { code: 'OS_ERROR', message: `Failed to create bond at OS level: ${osResult.error}` } },
          { status: 500 },
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: `Failed to create bond at OS level: ${msg}` } },
        { status: 500 },
      );
    }

    // Persist to /etc/network/interfaces
    try {
      const persistResult = persistBond({ name, mode, miimon, lacpRate, primary: primaryMember, members: ifaceNames });
      if (!persistResult.success) {
        console.warn(`Bond persistence warning for ${name}:`, persistResult.error);
      }
    } catch (err) {
      console.warn(`Bond persistence error for ${name}:`, err instanceof Error ? err.message : err);
    }

    // Create bond with optional members
    const bond = await db.bondConfig.create({
      data: {
        tenant: { connect: { id: tenantId } },
        property: { connect: { id: propertyId } },
        name,
        mode,
        miimon,
        lacpRate,
        primaryMember,
        enabled,
        members: {
          create: members.map((ifaceId: string, idx: number) => ({
            interfaceId: ifaceId,
            priority: idx,
          })),
        },
      },
      include: {
        members: {
          include: {
            networkInterface: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: bond }, { status: 201 });
  } catch (error) {
    console.error('Error creating bond config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create bond config' } },
      { status: 500 },
    );
  }
}
