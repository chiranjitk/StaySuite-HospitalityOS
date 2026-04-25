import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/billing/exchange-rates/convert?amount=100&from=EUR&to=USD&tenantId=xxx
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
    const amountStr = searchParams.get('amount');
    const fromCurrency = searchParams.get('from');
    const toCurrency = searchParams.get('to');

    if (!amountStr || !fromCurrency || !toCurrency) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required params: amount, from, to' } },
        { status: 400 }
      );
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid amount' } },
        { status: 400 }
      );
    }

    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    // Same currency - no conversion needed
    if (from === to) {
      return NextResponse.json({
        success: true,
        data: {
          originalAmount: amount,
          fromCurrency: from,
          toCurrency: to,
          rate: 1,
          convertedAmount: amount,
        },
      });
    }

    // Find the latest active rate
    const rateRecord = await db.exchangeRate.findFirst({
      where: {
        tenantId,
        fromCurrency: from,
        toCurrency: to,
        isActive: true,
        validUntil: {
          gte: new Date(),
        },
      },
      orderBy: { validFrom: 'desc' },
    });

    // If no direct rate, try reverse
    let rate = rateRecord?.rate || null;
    let rateSource = rateRecord?.source || null;
    let rateId = rateRecord?.id || null;

    if (!rate) {
      const reverseRate = await db.exchangeRate.findFirst({
        where: {
          tenantId,
          fromCurrency: to,
          toCurrency: from,
          isActive: true,
          validUntil: {
            gte: new Date(),
          },
        },
        orderBy: { validFrom: 'desc' },
      });

      if (reverseRate) {
        rate = 1 / reverseRate.rate;
        rateSource = reverseRate.source;
        rateId = reverseRate.id;
      }
    }

    // If still no rate, try without validUntil check (use latest)
    if (!rate) {
      const anyRate = await db.exchangeRate.findFirst({
        where: {
          tenantId,
          fromCurrency: from,
          toCurrency: to,
        },
        orderBy: { validFrom: 'desc' },
      });

      if (anyRate) {
        rate = anyRate.rate;
        rateSource = anyRate.source;
        rateId = anyRate.id;
      }
    }

    if (!rate) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_RATE', message: `No exchange rate found for ${from} to ${to}` } },
        { status: 404 }
      );
    }

    const convertedAmount = amount * rate;

    return NextResponse.json({
      success: true,
      data: {
        originalAmount: amount,
        fromCurrency: from,
        toCurrency: to,
        rate,
        rateSource,
        rateId,
        convertedAmount: Math.round(convertedAmount * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error converting currency:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to convert currency' } },
      { status: 500 }
    );
  }
}
