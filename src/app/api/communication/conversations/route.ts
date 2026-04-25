import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/communication/conversations - List all conversations
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'communication.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const guestId = searchParams.get('guestId');
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

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
      ...(limit && { take: Math.min(parseInt(limit), 100) }),
      ...(offset && { skip: parseInt(offset) }),
    });

    // Fetch guest, booking, and assigned user info separately
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        let guest: any = null;
        let booking: any = null;
        let assignedToUser: any = null;

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

        if (conv.assignedTo) {
          assignedToUser = await db.user.findUnique({
            where: { id: conv.assignedTo },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          }) as any;
        }

        // Parse tags from JSON string
        let tags: string[] = [];
        try {
          tags = conv.tags ? JSON.parse(conv.tags) : [];
        } catch {
          tags = [];
        }

        return {
          ...conv,
          guest,
          booking,
          assignedTo: assignedToUser,
          tags,
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
        const guestData = conv.guest;
        return (
          guestData?.firstName?.toLowerCase().includes(searchLower) ||
          guestData?.lastName?.toLowerCase().includes(searchLower) ||
          guestData?.email?.toLowerCase().includes(searchLower) ||
          guestData?.phone?.includes(search) ||
          conv.subject?.toLowerCase().includes(searchLower) ||
          conv.lastMessage?.toLowerCase().includes(searchLower)
        );
      });
    }

    const total = await db.chatConversation.count({ where });

    // Calculate stats
    const [openCount, pendingCount, resolvedCount] = await Promise.all([
      db.chatConversation.count({ where: { ...where, status: 'open' } }),
      db.chatConversation.count({ where: { ...where, status: 'pending' } }),
      db.chatConversation.count({ where: { ...where, status: 'resolved' } }),
    ]);

    const totalUnread = await db.chatConversation.aggregate({
      where,
      _sum: { unreadCount: true },
    });

    return NextResponse.json({
      success: true,
      data: filteredConversations,
      pagination: {
        total,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : null,
      },
      stats: {
        total: filteredConversations.length,
        open: openCount,
        pending: pendingCount,
        resolved: resolvedCount,
        totalUnread: totalUnread._sum.unreadCount || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch conversations' } },
      { status: 500 }
    );
  }
}

// POST /api/communication/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'communication.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      propertyId,
      guestId,
      bookingId,
      channel = 'app',
      subject,
      assignedTo,
      priority = 'normal',
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found or access denied' } },
        { status: 400 }
      );
    }

    const conversation = await db.chatConversation.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        guestId,
        bookingId,
        channel,
        subject,
        assignedTo,
        status: 'open',
        priority,
        unreadCount: 0,
        tags: '[]',
      },
    });

    return NextResponse.json({ success: true, data: conversation }, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create conversation' } },
      { status: 500 }
    );
  }
}

// PUT /api/communication/conversations - Update conversation
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'communication.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, assignedTo, unreadCount, priority, tags, subject } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Conversation ID is required' } },
        { status: 400 }
      );
    }

    const existingConversation = await db.chatConversation.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingConversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
    }

    if (assignedTo !== undefined) {
      // Verify assignee exists if provided
      if (assignedTo) {
        const assigneeUser = await db.user.findFirst({
          where: { id: assignedTo, tenantId: user.tenantId },
        });
        if (!assigneeUser) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_USER', message: 'Assigned user not found' } },
            { status: 400 }
          );
        }
      }
      updateData.assignedTo = assignedTo || null;
    }

    if (unreadCount !== undefined) {
      updateData.unreadCount = unreadCount;
    }

    if (priority) {
      updateData.priority = priority;
    }

    if (tags) {
      updateData.tags = Array.isArray(tags) ? JSON.stringify(tags) : tags;
    }

    if (subject !== undefined) {
      updateData.subject = subject;
    }

    const updatedConversation = await db.chatConversation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updatedConversation });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update conversation' } },
      { status: 500 }
    );
  }
}
