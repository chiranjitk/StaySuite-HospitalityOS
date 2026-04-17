/**
 * V1 Auth Login API Route
 * Re-exports from the main auth login route with version headers
 */

import { NextRequest, NextResponse } from 'next/server';
import * as originalRoute from '@/app/api/auth/login/route';
import { addVersionHeaders } from '@/lib/api-version';

export async function POST(request: NextRequest) {
  const response = await originalRoute.POST(request);
  addVersionHeaders(response, '1');
  return response;
}
