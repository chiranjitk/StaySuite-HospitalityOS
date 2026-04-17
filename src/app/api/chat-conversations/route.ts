import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/chat-conversations - List all chat conversations
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

  // Permission check for chat operations
  if (!hasPermission(user, 'chat.view')) {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } }, { status: 403 });
  }


  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const propertyId = searchParams.get('propertyId');
    const guestId = searchParams.get('guestId');
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (status) {
      where.status = status;
    }

    if (channel) {
      where.channel = channel;
    }

    const conversations = await db.chatConversation.findMany({
      where,
      include: {
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { createdAt: 'desc' },
      ],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Fetch guest and booking info separately since those are in different tables
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        let guest: any = null;
        let booking: any = null;

        if (conv.guestId) {
          guest = await db.guest.findUnique({
            where: { id: conv.guestId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
            },
          });
        }

        if (conv.bookingId) {
          booking = await db.booking.findUnique({
            where: { id: conv.bookingId },
            select: {
              confirmationCode: true,
              room: {
                select: { number: true },
              },
            },
          }) as any;
        }

        return {
          ...conv,
          guest,
          booking,
          lastMessage: conv.lastMessage || conv.messages[0]?.content,
          lastMessageAt: conv.lastMessageAt || conv.messages[0]?.sentAt,
        };
      })
    );

    // Filter by search if provided
    let filteredConversations = enrichedConversations;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredConversations = enrichedConversations.filter((conv) => {
        const guest = conv.guest;
        return (
          guest?.firstName?.toLowerCase().includes(searchLower) ||
          guest?.lastName?.toLowerCase().includes(searchLower) ||
          guest?.email?.toLowerCase().includes(searchLower) ||
          guest?.phone?.includes(search)
        );
      });
    }

    const total = await db.chatConversation.count({ where });

    // Calculate stats
    const openConversations = await db.chatConversation.count({
      where: { ...where, status: 'open' },
    });

    const totalUnread = await db.chatConversation.aggregate({
      where,
      _sum: { unreadCount: true },
    });

    return NextResponse.json({
      success: true,
      data: filteredConversations,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        total: filteredConversations.length,
        open: openConversations,
        totalUnread: totalUnread._sum.unreadCount || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching chat conversations:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch chat conversations' } },
      { status: 500 }
    );
  }
}

// POST /api/chat-conversations - Create a new conversation
export async function POST(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

  // Permission check for chat operations
  if (!hasPermission(user, 'chat.write')) {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } }, { status: 403 });
  }

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      
      propertyId,
      guestId,
      bookingId,
      channel = 'app',
      assignedTo,
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    const conversation = await db.chatConversation.create({
      data: {
        tenantId,
        propertyId,
        guestId,
        bookingId,
        channel,
        assignedTo,
        status: 'open',
        unreadCount: 0,
      },
    });

    return NextResponse.json({ success: true, data: conversation }, { status: 201 });
  } catch (error) {
    console.error('Error creating chat conversation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create chat conversation' } },
      { status: 500 }
    );
  }
}

// PUT /api/chat-conversations - Update conversation
export async function PUT(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

  // Permission check for chat operations
  if (!hasPermission(user, 'chat.write')) {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } }, { status: 403 });
  }

  try {
    const body = await request.json();
    const tenantId = user.tenantId;
    const { id, status, assignedTo, unreadCount } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Conversation ID is required' } },
        { status: 400 }
      );
    }

    const existingConversation = await db.chatConversation.findUnique({
      where: { id },
    });

    if (!existingConversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    // Verify conversation belongs to user's tenant
    if (existingConversation.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
    }

    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo;
    }

    if (unreadCount !== undefined) {
      updateData.unreadCount = unreadCount;
    }

    const updatedConversation = await db.chatConversation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updatedConversation });
  } catch (error) {
    console.error('Error updating chat conversation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update chat conversation' } },
      { status: 500 }
    );
  }
}
