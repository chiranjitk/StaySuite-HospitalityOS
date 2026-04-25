import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/billing/exchange-rates?tenantId=xxx - List exchange rates
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'billing.view', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active');

    const where: Record<string, unknown> = { tenantId };
    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const rates = await db.exchangeRate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: rates });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch exchange rates' } },
      { status: 500 }
    );
  }
}

// POST /api/billing/exchange-rates - Create or update exchange rate
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const body = await request.json();
    const {
      fromCurrency,
      toCurrency,
      rate,
      source,
      validUntil,
    } = body;

    if (!fromCurrency || !toCurrency || !rate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: fromCurrency, toCurrency, rate' } },
        { status: 400 }
      );
    }

    const parsedRate = parseFloat(String(rate));
    if (parsedRate <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rate must be a positive number' } },
        { status: 400 }
      );
    }

    // Deactivate existing rates for this pair
    await db.exchangeRate.updateMany({
      where: {
        tenantId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        isActive: true,
      },
      data: { isActive: false },
    });

    const exchangeRate = await db.exchangeRate.create({
      data: {
        tenantId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        rate: parsedRate,
        source: source || 'manual',
        validFrom: new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: exchangeRate }, { status: 201 });
  } catch (error) {
    console.error('Error creating exchange rate:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create exchange rate' } },
      { status: 500 }
    );
  }
}
