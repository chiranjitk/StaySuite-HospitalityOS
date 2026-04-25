/**
 * V1 Folio by ID API Route
 * Re-exports from the main folio route with version headers
 */

import { NextRequest, NextResponse } from 'next/server';
import * as originalRoute from '@/app/api/folios/[id]/route';
import { addVersionHeaders } from '@/lib/api-version';
import { requireAuth } from '@/lib/auth/tenant-context';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

  const response = await originalRoute.GET(request, context);
  addVersionHeaders(response, '1');
  return response;
}

export async function PUT(request: NextRequest, context: RouteContext) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

  const response = await originalRoute.PUT(request, context);
  addVersionHeaders(response, '1');
  return response;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

  const response = await originalRoute.DELETE(request, context);
  addVersionHeaders(response, '1');
  return response;
}
