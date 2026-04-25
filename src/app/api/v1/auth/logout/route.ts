/**
 * V1 Auth Logout API Route
 * Re-exports from the main auth logout route with version headers
 */

import { NextRequest, NextResponse } from 'next/server';
import * as originalRoute from '@/app/api/auth/logout/route';
import { addVersionHeaders } from '@/lib/api-version';

export async function POST(request: NextRequest) {
  const response = await originalRoute.POST(request);
  addVersionHeaders(response, '1');
  return response;
}
