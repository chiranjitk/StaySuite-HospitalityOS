import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';// Cache exchange rates for 1 hour to avoid API limits
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

interface ExchangeRateCache {
  rates: Record<string, number>;
  timestamp: number;
  base: string;
}

let cachedRates: ExchangeRateCache | null = null;

// Free exchange rate API (no API key required)
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';

// Fallback rates in case API is unavailable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.12,
  AED: 3.67,
  SGD: 1.34,
  AUD: 1.53,
  CAD: 1.36,
  JPY: 149.50,
  CNY: 7.24,
  CHF: 0.88,
  HKD: 7.82,
  NZD: 1.64,
  SEK: 10.42,
  KRW: 1320.50,
  MXN: 17.15,
  BRL: 4.97,
  ZAR: 18.65,
  RUB: 92.50,
  TRY: 32.15,
  THB: 35.80,
  MYR: 4.72,
  PHP: 56.20,
  IDR: 15750,
  VND: 24500,
  SAR: 3.75,
  EGP: 30.90,
  NGN: 1550,
  KES: 153.50,
  GHS: 12.45,
  UAH: 37.25,
  PLN: 3.95,
  NOK: 10.65,
  DKK: 6.87,
  CZK: 22.85,
  HUF: 355.50,
  RON: 4.58,
  BGN: 1.80,
  HRK: 6.95,
  ILS: 3.65,
  CLP: 878.50,
  COP: 3950,
  PEN: 3.72,
  ARS: 870.50,
  TWD: 31.45,
  BDT: 110.25,
  PKR: 278.50,
  LKR: 322.50,
  NPR: 133.25,
  MUR: 45.50,
  FJD: 2.25,
};

// Currency metadata
export const CURRENCY_METADATA: Record<string, { name: string; symbol: string; decimalPlaces: number }> = {
  USD: { name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  EUR: { name: 'Euro', symbol: '€', decimalPlaces: 2 },
  GBP: { name: 'British Pound', symbol: '£', decimalPlaces: 2 },
  INR: { name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
  AED: { name: 'UAE Dirham', symbol: 'د.إ', decimalPlaces: 2 },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', decimalPlaces: 2 },
  AUD: { name: 'Australian Dollar', symbol: 'A$', decimalPlaces: 2 },
  CAD: { name: 'Canadian Dollar', symbol: 'C$', decimalPlaces: 2 },
  JPY: { name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 },
  CNY: { name: 'Chinese Yuan', symbol: '¥', decimalPlaces: 2 },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', decimalPlaces: 2 },
  HKD: { name: 'Hong Kong Dollar', symbol: 'HK$', decimalPlaces: 2 },
  NZD: { name: 'New Zealand Dollar', symbol: 'NZ$', decimalPlaces: 2 },
  SEK: { name: 'Swedish Krona', symbol: 'kr', decimalPlaces: 2 },
  KRW: { name: 'South Korean Won', symbol: '₩', decimalPlaces: 0 },
  MXN: { name: 'Mexican Peso', symbol: 'MX$', decimalPlaces: 2 },
  BRL: { name: 'Brazilian Real', symbol: 'R$', decimalPlaces: 2 },
  ZAR: { name: 'South African Rand', symbol: 'R', decimalPlaces: 2 },
  RUB: { name: 'Russian Ruble', symbol: '₽', decimalPlaces: 2 },
  TRY: { name: 'Turkish Lira', symbol: '₺', decimalPlaces: 2 },
  THB: { name: 'Thai Baht', symbol: '฿', decimalPlaces: 2 },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM', decimalPlaces: 2 },
  PHP: { name: 'Philippine Peso', symbol: '₱', decimalPlaces: 2 },
  IDR: { name: 'Indonesian Rupiah', symbol: 'Rp', decimalPlaces: 0 },
  VND: { name: 'Vietnamese Dong', symbol: '₫', decimalPlaces: 0 },
  SAR: { name: 'Saudi Riyal', symbol: '﷼', decimalPlaces: 2 },
  EGP: { name: 'Egyptian Pound', symbol: '£', decimalPlaces: 2 },
  NGN: { name: 'Nigerian Naira', symbol: '₦', decimalPlaces: 2 },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh', decimalPlaces: 2 },
  GHS: { name: 'Ghanaian Cedi', symbol: '₵', decimalPlaces: 2 },
  UAH: { name: 'Ukrainian Hryvnia', symbol: '₴', decimalPlaces: 2 },
  PLN: { name: 'Polish Zloty', symbol: 'zł', decimalPlaces: 2 },
  NOK: { name: 'Norwegian Krone', symbol: 'kr', decimalPlaces: 2 },
  DKK: { name: 'Danish Krone', symbol: 'kr', decimalPlaces: 2 },
  CZK: { name: 'Czech Koruna', symbol: 'Kč', decimalPlaces: 2 },
  HUF: { name: 'Hungarian Forint', symbol: 'Ft', decimalPlaces: 0 },
  RON: { name: 'Romanian Leu', symbol: 'lei', decimalPlaces: 2 },
  BGN: { name: 'Bulgarian Lev', symbol: 'лв', decimalPlaces: 2 },
  HRK: { name: 'Croatian Kuna', symbol: 'kn', decimalPlaces: 2 },
  ILS: { name: 'Israeli Shekel', symbol: '₪', decimalPlaces: 2 },
  CLP: { name: 'Chilean Peso', symbol: 'CLP$', decimalPlaces: 0 },
  COP: { name: 'Colombian Peso', symbol: 'COL$', decimalPlaces: 0 },
  PEN: { name: 'Peruvian Sol', symbol: 'S/', decimalPlaces: 2 },
  ARS: { name: 'Argentine Peso', symbol: 'AR$', decimalPlaces: 2 },
  TWD: { name: 'Taiwan Dollar', symbol: 'NT$', decimalPlaces: 2 },
  BDT: { name: 'Bangladeshi Taka', symbol: '৳', decimalPlaces: 2 },
  PKR: { name: 'Pakistani Rupee', symbol: 'Rs', decimalPlaces: 2 },
  LKR: { name: 'Sri Lankan Rupee', symbol: 'Rs', decimalPlaces: 2 },
  NPR: { name: 'Nepalese Rupee', symbol: 'रू', decimalPlaces: 2 },
  MUR: { name: 'Mauritian Rupee', symbol: 'Rs', decimalPlaces: 2 },
  FJD: { name: 'Fijian Dollar', symbol: 'FJ$', decimalPlaces: 2 },
};

async function fetchExchangeRates(): Promise<ExchangeRateCache> {
  // Check cache first
  if (cachedRates && Date.now() - cachedRates.timestamp < CACHE_DURATION) {
    return cachedRates;
  }

  try {
    const response = await fetch(EXCHANGE_RATE_API, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();
    
    cachedRates = {
      rates: data.rates,
      timestamp: Date.now(),
      base: data.base,
    };

    return cachedRates;
  } catch (error) {
    console.error('Error fetching exchange rates, using fallback:', error);
    
    // Use fallback rates
    cachedRates = {
      rates: FALLBACK_RATES,
      timestamp: Date.now(),
      base: 'USD',
    };

    return cachedRates;
  }
}

// GET - Get all exchange rates
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'settings.view'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    const tenantId = user.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const baseCurrency = searchParams.get('base') || 'USD';
    const targetCurrency = searchParams.get('target');

    const rateData = await fetchExchangeRates();
    const usdRates = rateData.rates;

    // If requesting specific conversion
    if (targetCurrency && baseCurrency !== 'all') {
      const fromRate = usdRates[baseCurrency] || 1;
      const toRate = usdRates[targetCurrency] || 1;
      const rate = toRate / fromRate;

      return NextResponse.json({
        success: true,
        data: {
          from: baseCurrency,
          to: targetCurrency,
          rate,
          timestamp: rateData.timestamp,
          isRealTime: rateData.rates !== FALLBACK_RATES,
        },
      });
    }

    // Convert rates to have the requested base currency
    let rates = usdRates;
    if (baseCurrency !== 'USD' && baseCurrency !== 'all') {
      const baseRate = usdRates[baseCurrency] || 1;
      rates = {};
      for (const [currency, rate] of Object.entries(usdRates)) {
        rates[currency] = rate / baseRate;
      }
    }

    // Build supported currencies with metadata
    const supportedCurrencies = Object.keys(rates).map(code => ({
      code,
      name: CURRENCY_METADATA[code]?.name || code,
      symbol: CURRENCY_METADATA[code]?.symbol || code,
      rate: rates[code],
      decimalPlaces: CURRENCY_METADATA[code]?.decimalPlaces ?? 2,
    }));

    return NextResponse.json({
      success: true,
      data: {
        base: baseCurrency === 'all' ? 'USD' : baseCurrency,
        rates,
        supportedCurrencies: supportedCurrencies.sort((a, b) => a.code.localeCompare(b.code)),
        timestamp: rateData.timestamp,
        isRealTime: rateData.rates !== FALLBACK_RATES,
        lastUpdated: new Date(rateData.timestamp).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in exchange rates API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}

// Convert amount between currencies
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'settings.view'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    const tenantId = user.tenantId;

    const body = await request.json();
    const { amount, from, to } = body;

    if (!amount || !from || !to) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: amount, from, to' } },
        { status: 400 }
      );
    }

    // Validate amount is a positive number
    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Amount must be a positive number' } },
        { status: 400 }
      );
    }

    const rateData = await fetchExchangeRates();
    const usdRates = rateData.rates;

    const fromRate = usdRates[from] || 1;
    const toRate = usdRates[to] || 1;

    // Convert to USD first, then to target currency
    const amountInUsd = amount / fromRate;
    const convertedAmount = amountInUsd * toRate;
    const exchangeRate = toRate / fromRate;

    return NextResponse.json({
      success: true,
      data: {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount,
        targetCurrency: to,
        exchangeRate,
        timestamp: rateData.timestamp,
        isRealTime: rateData.rates !== FALLBACK_RATES,
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
