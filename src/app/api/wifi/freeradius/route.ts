/**
 * FreeRADIUS Integration API Route
 * 
 * Proxies requests to the FreeRADIUS management service running on port 3010.
 * Provides endpoints for:
 * - Service status and control (start/stop/restart)
 * - Connection testing
 * - Configuration export/import
 * - Statistics & monitoring
 * - Accounting records
 * - WiFi sessions
 * - FreeRADIUS logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';

const RADIUS_SERVICE_URL = process.env.RADIUS_SERVICE_URL || 'http://localhost:3010';

// Helper to make requests to FreeRADIUS service
async function freeradiusRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${RADIUS_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      parsedError = { error: errorBody };
    }
    return { success: false, status: response.status, ...parsedError };
  }
  
  return response.json();
}

// GET /api/wifi/freeradius - Get FreeRADIUS service data
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    switch (action) {
      case 'status': {
        const data = await freeradiusRequest('/api/status');
        return NextResponse.json(data);
      }

      case 'stats': {
        const data = await freeradiusRequest('/api/stats');
        return NextResponse.json(data);
      }

      case 'config': {
        const data = await freeradiusRequest('/api/config/export');
        return NextResponse.json(data);
      }

      case 'default': {
        const data = await freeradiusRequest('/api/config/default');
        return NextResponse.json(data);
      }

      case 'groups': {
        const data = await freeradiusRequest('/api/groups');
        return NextResponse.json(data);
      }

      case 'accounting': {
        const limit = searchParams.get('limit') || '50';
        const offset = searchParams.get('offset') || '0';
        const data = await freeradiusRequest(`/api/accounting?limit=${limit}&offset=${offset}`);
        return NextResponse.json(data);
      }

      case 'sessions': {
        const limit = searchParams.get('limit') || '50';
        const data = await freeradiusRequest(`/api/sessions?limit=${limit}`);
        return NextResponse.json(data);
      }

      case 'active-sessions': {
        const data = await freeradiusRequest('/api/sessions/active');
        return NextResponse.json(data);
      }

      case 'active-accounting': {
        const data = await freeradiusRequest('/api/accounting/active');
        return NextResponse.json(data);
      }

      case 'logs': {
        const lines = searchParams.get('lines') || '50';
        const data = await freeradiusRequest(`/api/logs?lines=${lines}`);
        return NextResponse.json(data);
      }

      default: {
        // Default: return service status
        const data = await freeradiusRequest('/api/status');
        return NextResponse.json(data);
      }
    }
  } catch (error) {
    console.error('Error communicating with FreeRADIUS service:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to communicate with FreeRADIUS service',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure the FreeRADIUS service is running on port 3010'
      },
      { status: 503 }
    );
  }
}

// POST /api/wifi/freeradius - Control FreeRADIUS service or test connection
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'start': {
        const result = await freeradiusRequest('/api/service/start', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'stop': {
        const result = await freeradiusRequest('/api/service/stop', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'restart': {
        const result = await freeradiusRequest('/api/service/restart', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'test': {
        const result = await freeradiusRequest('/api/test', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'import': {
        const result = await freeradiusRequest('/api/config/import', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'generate-secret': {
        const result = await freeradiusRequest('/api/nas/generate-secret', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'sync': {
        const result = await freeradiusRequest('/api/sync', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'sync-users': {
        const result = await freeradiusRequest('/api/sync/users', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'sync-clients': {
        const result = await freeradiusRequest('/api/sync/clients', { method: 'POST' });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Supported: start, stop, restart, test, import, generate-secret, sync, sync-users, sync-clients' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in FreeRADIUS operation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform FreeRADIUS operation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
