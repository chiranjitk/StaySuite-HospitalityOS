import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission } from '@/lib/auth/tenant-context';// Allowed locales - whitelist to prevent path traversal
const ALLOWED_LOCALES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko',
  'ar', 'hi', 'th', 'vi', 'id', 'ms', 'tr', 'pl', 'sv', 'da', 'no',
  'fi', 'cs', 'sk', 'hu', 'ro', 'bg', 'hr', 'sr', 'sl', 'et', 'lv',
  'lt', 'uk', 'he', 'fa', 'ur', 'bn', 'ta', 'te', 'ml', 'sw', 'af'
];

// Maximum translation file size (500KB)
const MAX_FILE_SIZE = 500 * 1024;

export async function GET(request: NextRequest) {
    const user = await requirePermission(request, 'settings.manage');
    if (user instanceof NextResponse) return user;

    

  const searchParams = request.nextUrl.searchParams;
  const locale = searchParams.get('locale') || 'en';
  
  // Validate locale against whitelist to prevent path traversal
  if (!ALLOWED_LOCALES.includes(locale)) {
    return NextResponse.json(
      { error: 'Invalid locale' },
      { status: 400 }
    );
  }
  
  try {
    // Construct the file path safely
    const messagesDir = path.join(process.cwd(), 'messages');
    const filePath = path.join(messagesDir, `${locale}.json`);
    
    // Ensure the resolved path is still within messages directory (double-check)
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(messagesDir))) {
      return NextResponse.json(
        { error: 'Invalid locale path' },
        { status: 400 }
      );
    }
    
    if (!fs.existsSync(filePath)) {
      // Fallback to English if locale file doesn't exist
      const fallbackPath = path.join(messagesDir, 'en.json');
      
      // Check fallback path is also safe
      const resolvedFallback = path.resolve(fallbackPath);
      if (!resolvedFallback.startsWith(path.resolve(messagesDir))) {
        return NextResponse.json(
          { error: 'Invalid fallback path' },
          { status: 500 }
        );
      }
      
      if (!fs.existsSync(fallbackPath)) {
        return NextResponse.json(
          { error: 'Translation file not found' },
          { status: 404 }
        );
      }
      
      const fallbackData = fs.readFileSync(fallbackPath, 'utf-8');
      return NextResponse.json(JSON.parse(fallbackData));
    }
    
    // Check file size before reading
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Translation file too large' },
        { status: 500 }
      );
    }
    
    const data = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error loading translations:', error);
    return NextResponse.json(
      { error: 'Failed to load translations' },
      { status: 500 }
    );
  }
}
