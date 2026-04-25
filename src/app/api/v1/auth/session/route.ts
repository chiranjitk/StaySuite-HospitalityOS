/**
 * V1 Auth Session API Route
 * Re-exports from the main auth session route with version headers
 */

import { NextRequest, NextResponse } from 'next/server';
import * as originalRoute from '@/app/api/auth/session/route';
import { addVersionHeaders } from '@/lib/api-version';

export async function GET(request: NextRequest) {
  const response = await originalRoute.GET(request);
  addVersionHeaders(response, '1');
  return response;
}
