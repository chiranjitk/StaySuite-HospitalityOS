import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  darkMode: boolean;
  compactMode: boolean;
  language: string;
  timezone: string;
  dateFormat: string;
}

const defaultPreferences: UserPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  marketingEmails: false,
  darkMode: false,
  compactMode: false,
  language: 'en',
  timezone: 'America/New_York',
  dateFormat: 'MM/DD/YYYY',
};

// GET /api/user/preferences - Get user preferences
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            preferences: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // Parse preferences from user
    let preferences: UserPreferences = defaultPreferences;
    try {
      if (session.user.preferences) {
        const parsed = JSON.parse(session.user.preferences);
        preferences = { ...defaultPreferences, ...parsed };
      }
    } catch {
      preferences = defaultPreferences;
    }

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

// PUT /api/user/preferences - Update user preferences
export async function PUT(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;

    // Validate preference keys
    const validKeys = [
      'emailNotifications',
      'pushNotifications',
      'smsNotifications',
      'marketingEmails',
      'darkMode',
      'compactMode',
      'language',
      'timezone',
      'dateFormat',
    ];

    // Get current preferences
    let currentPreferences: UserPreferences = defaultPreferences;
    try {
      if (session.user.preferences) {
        currentPreferences = { ...defaultPreferences, ...JSON.parse(session.user.preferences) };
      }
    } catch {
      currentPreferences = defaultPreferences;
    }

    // Merge with new values
    const updatedPreferences: UserPreferences = { ...currentPreferences };
    for (const key of validKeys) {
      if (body[key] !== undefined) {
        (updatedPreferences as unknown as Record<string, unknown>)[key] = body[key];
      }
    }

    // Update user preferences
    await db.user.update({
      where: { id: userId },
      data: {
        preferences: JSON.stringify(updatedPreferences),
      },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: session.user.tenantId,
          userId: userId,
          module: 'preferences',
          action: 'update',
          entityType: 'user_preferences',
          entityId: userId,
          newValue: JSON.stringify(updatedPreferences),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
