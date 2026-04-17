/**
 * RADIUS NAS (Network Access Server) API Route
 * 
 * Manages FreeRADIUS NAS clients - routers, access points, controllers.
 * These are the devices that send RADIUS requests to FreeRADIUS server.
 * 
 * Proxies all CRUD operations to the FreeRADIUS service on port 3010,
 * which handles both database persistence and config sync + reload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';

const RADIUS_SERVICE_URL = process.env.RADIUS_SERVICE_URL || 'http://localhost:3010';

// Helper to proxy requests to FreeRADIUS service
async function nasServiceRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${RADIUS_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

// GET /api/wifi/nas - List all NAS clients
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const result = await nasServiceRequest(`/api/nas?tenantId=${encodeURIComponent(context.tenantId)}`);
    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error('Error fetching NAS clients from FreeRADIUS service:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch NAS clients',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

// POST /api/wifi/nas - Create a new NAS client
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      shortname,
      ipAddress,
      type,
      secret,
      sharedSecret,
      coaEnabled,
      coaPort,
      authPort,
      acctPort,
      description,
    } = body;

    // Validate required fields
    if (!name || !ipAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, ipAddress' },
        { status: 400 }
      );
    }

    // Proxy to FreeRADIUS service - it handles DB insert + config sync + reload
    const result = await nasServiceRequest('/api/nas', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: context.tenantId,
        propertyId: propertyId || 'default',
        name,
        shortname: shortname || name.replace(/\s+/g, '_').toLowerCase(),
        ipAddress,
        type: type || 'other',
        sharedSecret: sharedSecret || secret,
        coaEnabled,
        coaPort,
        authPort,
        acctPort,
        description,
      }),
    });

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error('Error creating NAS client:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create NAS client',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/nas - Update a NAS client
export async function PUT(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'NAS id is required' },
        { status: 400 }
      );
    }

    // Proxy to FreeRADIUS service - it handles DB update + config sync + reload
    const result = await nasServiceRequest(`/api/nas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error('Error updating NAS client:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update NAS client',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/nas - Delete a NAS client
export async function DELETE(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'NAS id is required' },
        { status: 400 }
      );
    }

    // Proxy to FreeRADIUS service with tenant context for authorization
    const result = await nasServiceRequest(`/api/nas/${id}?tenantId=${encodeURIComponent(context.tenantId)}`, {
      method: 'DELETE',
    });

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error('Error deleting NAS client:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete NAS client',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
