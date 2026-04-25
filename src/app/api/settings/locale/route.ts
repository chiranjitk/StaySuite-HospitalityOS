import { NextRequest, NextResponse } from 'next/server';
import { locales, type Locale, isValidLocale } from '@/i18n/config';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET - Get current locale from cookie
export async function GET(request: NextRequest) {
  const localeCookie = request.cookies.get('locale');
  
  let locale = localeCookie?.value || 'en';
  
  if (!isValidLocale(locale)) {
    locale = 'en';
  }
  
  return NextResponse.json({ locale });
}

// POST - Set locale in cookie
export async function POST(request: NextRequest) {    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { locale } = body;
    
    if (!locale || !isValidLocale(locale)) {
      return NextResponse.json(
        { error: 'Invalid locale' },
        { status: 400 }
      );
    }
    
    const response = NextResponse.json({ 
      success: true, 
      locale: locale as Locale 
    });
    
    // Set cookie with 1 year expiration
    response.cookies.set('locale', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
      httpOnly: false, // Allow client-side access
    });
    
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Failed to set locale' },
      { status: 500 }
    );
  }
}
