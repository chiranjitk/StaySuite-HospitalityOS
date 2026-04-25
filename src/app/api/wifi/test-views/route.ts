import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Test 1: v_user_usage view
    const usageRows = await db.$queryRawUnsafe<Record<string, unknown>[]>('SELECT username, total_download_bytes, total_upload_bytes, total_sessions, active_sessions, total_session_time, last_session_start FROM v_user_usage ORDER BY total_download_bytes DESC LIMIT 5');
    
    // Test 2: v_session_history view
    const sessionRows = await db.$queryRawUnsafe<Record<string, unknown>[]>('SELECT username, acctstarttime, acctinputoctets, acctoutputoctets, plan_name FROM v_session_history LIMIT 5');
    
    // Test 3: v_active_sessions view
    const activeRows = await db.$queryRawUnsafe<Record<string, unknown>[]>('SELECT username, session_status, acctoutputoctets, acctinputoctets FROM v_active_sessions');
    
    // BigInt-safe serialization
    const safeJson = JSON.stringify({
      userUsage: usageRows,
      sessionHistory: sessionRows,
      activeSessions: activeRows,
    }, (_, v) => typeof v === 'bigint' ? Number(v) : v);

    return new NextResponse(safeJson, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
    }, { status: 500 });
  }
}
