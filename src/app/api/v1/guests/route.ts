/**
 * V1 Guests API Route
 * Re-exports from the main guests route with version headers
 */

import { NextRequest, NextResponse } from 'next/server';
import * as originalRoute from '@/app/api/guests/route';
import { addVersionHeaders } from '@/lib/api-version';
import { requireAuth } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

  const response = await originalRoute.GET(request);
  addVersionHeaders(response, '1');
  return response;
}

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

  const response = await originalRoute.POST(request);
  addVersionHeaders(response, '1');
  return response;
}
