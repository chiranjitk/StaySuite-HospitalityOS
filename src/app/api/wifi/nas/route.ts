/**
 * RADIUS NAS (Network Access Server) API Route
 * 
 * Manages RADIUS NAS clients - routers, access points, controllers.
 * These are the devices that send RADIUS requests to the RADIUS server.
 * 
 * Proxies all CRUD operations to the RADIUS service on port 3010,
 * which handles both database persistence and config sync + reload.
 * 
 * Transforms data between frontend format (flat fields) and backend
 * format (nested ports object + sharedSecret).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';

const RADIUS_SERVICE_URL = process.env.RADIUS_SERVICE_URL || 'http://localhost:3010';

// Helper to proxy requests to RADIUS service
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

/**
 * Transform backend NAS format → frontend format
 * Backend:  { ports: { auth, acct, coa }, sharedSecret, ... }
 * Frontend: { authPort, acctPort, coaPort, secret, ... }
 */
function toFrontend(client: Record<string, unknown>): Record<string, unknown> {
  const ports = (client.ports as Record<string, number>) || {};
  return {
    ...client,
    authPort: ports.auth ?? 1812,
    acctPort: ports.acct ?? 1813,
    coaPort: ports.coa ?? 3799,
    secret: client.sharedSecret || '',
    coaEnabled: client.coaEnabled ?? true,
    status: 'active',
  };
}

/**
 * Transform frontend NAS format → backend format
 * Frontend: { authPort, acctPort, coaPort, secret, ... }
 * Backend:  { ports: { auth, acct, coa }, sharedSecret, ... }
 */
function toBackend(body: Record<string, unknown>): Record<string, unknown> {
  const { authPort, acctPort, coaPort, secret, ...rest } = body;
  return {
    ...rest,
    sharedSecret: secret || rest.sharedSecret,
    ports: {
      auth: authPort || 1812,
      acct: acctPort || 1813,
      coa: coaPort || 3799,
    },
  };
}

// GET /api/wifi/nas - List all NAS clients
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const result = await nasServiceRequest(`/api/nas?tenantId=${encodeURIComponent(context.tenantId)}`);
    
    // Transform backend format → frontend format
    if (result.data.success && Array.isArray(result.data.data)) {
      result.data.data = result.data.data.map((c: Record<string, unknown>) => toFrontend(c));
    }
    
    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error('Error fetching NAS clients from RADIUS service:', error);
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

    // Proxy to RADIUS service - it handles DB insert + config sync + reload
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

    // Transform response to frontend format
    if (result.data.success && result.data.data) {
      result.data.data = toFrontend(result.data.data);
    }

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

    // Transform frontend flat format → backend nested format
    const backendData = toBackend(updateData);

    // Proxy to RADIUS service - it handles DB update + config sync + reload
    const result = await nasServiceRequest(`/api/nas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(backendData),
    });

    // Transform response to frontend format
    if (result.data.success && result.data.data) {
      result.data.data = toFrontend(result.data.data);
    }

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

    // Proxy to RADIUS service with tenant context for authorization
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
