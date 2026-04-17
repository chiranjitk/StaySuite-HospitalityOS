import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/chat-conversations/[id]/messages - Get messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'communication.chat');
    if (user instanceof NextResponse) return user;

      try {
    const { id: conversationId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    // Verify conversation exists and belongs to user's tenant
    const conversation = await db.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    if (conversation.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
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
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
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

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch messages' } },
      { status: 500 }
    );
  }
}

// POST /api/chat-conversations/[id]/messages - Send a new message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'communication.chat');
    if (user instanceof NextResponse) return user;

      try {
    const { id: conversationId } = await params;
    const body = await request.json();

    const { content, senderId, senderType = 'staff', messageType = 'text' } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Message content is required' } },
        { status: 400 }
      );
    }

    // Verify conversation exists and belongs to user's tenant
    const conversation = await db.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    if (conversation.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Create message
    const message = await db.chatMessage.create({
      data: {
        conversationId,
        senderId,
        senderType,
        content,
        messageType,
        status: 'sent',
        sentAt: new Date(),
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

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' } },
      { status: 500 }
    );
  }
}
