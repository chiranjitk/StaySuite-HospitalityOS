import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/communication/conversations/[id]/messages - Get messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: conversationId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '100';
    const offset = searchParams.get('offset') || '0';

    // Verify conversation exists and belongs to user's tenant
    const conversation = await db.chatConversation.findFirst({
      where: { id: conversationId, tenantId: user.tenantId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    const messages = await db.chatMessage.findMany({
      where: { conversationId },
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
      orderBy: { sentAt: 'asc' },
      take: Math.min(parseInt(limit), 200),
      skip: parseInt(offset),
    });

    // Mark messages as read
    await db.chatMessage.updateMany({
      where: {
        conversationId,
        senderType: 'guest',
        status: { not: 'read' },
      },
      data: { status: 'read', readAt: new Date() },
    });

    // Reset unread count
    await db.chatConversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });

    // Parse attachments for each message
    const enrichedMessages = messages.map((msg) => {
      let attachments: { name: string; url: string; type: string }[] = [];
      try {
        attachments = msg.attachments ? JSON.parse(msg.attachments) : [];
      } catch {
        attachments = [];
      }
      return {
        ...msg,
        attachments,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedMessages,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch messages' } },
      { status: 500 }
    );
  }
}

// POST /api/communication/conversations/[id]/messages - Send a new message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: conversationId } = await params;
    const body = await request.json();

    const {
      content,
      senderType = 'staff',
      messageType = 'text',
      attachments,
    } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Message content is required' } },
        { status: 400 }
      );
    }

    // Verify conversation exists and belongs to user's tenant
    const conversation = await db.chatConversation.findFirst({
      where: { id: conversationId, tenantId: user.tenantId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    // Create message
    const message = await db.chatMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        senderType,
        content,
        messageType,
        status: 'sent',
        sentAt: new Date(),
        attachments: attachments ? JSON.stringify(attachments) : '[]',
      },
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
    });

    // Update conversation last message
    await db.chatConversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content,
        lastMessageAt: new Date(),
      },
    });

    // TODO: Send message through channel (WhatsApp, SMS, Email) if senderType is 'staff'
    // This would call the appropriate integration service

    return NextResponse.json({
      success: true,
      data: {
        ...message,
        attachments: attachments || [],
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' } },
      { status: 500 }
    );
  }
}
