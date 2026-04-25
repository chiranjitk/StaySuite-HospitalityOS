import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/guest-app/chat - Get chat messages for guest
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const before = searchParams.get('before');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Token is required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: { in: ['confirmed', 'checked_in'] },
      },
      select: {
        id: true,
        primaryGuestId: true,
        tenantId: true,
        propertyId: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid token' } },
        { status: 404 }
      );
    }

    // Get or create chat conversation for this booking
    let conversation = await db.chatConversation.findFirst({
      where: {
        bookingId: booking.id,
      },
    });

    if (!conversation) {
      conversation = await db.chatConversation.create({
        data: {
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          guestId: booking.primaryGuestId,
          bookingId: booking.id,
          channel: 'app',
          status: 'open',
        },
      });
    }

    // Get messages
    const messages = await db.chatMessage.findMany({
      where: {
        conversationId: conversation.id,
        ...(before && { createdAt: { lt: new Date(before) } }),
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
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Mark messages as read
    await db.chatMessage.updateMany({
      where: {
        conversationId: conversation.id,
        senderType: 'staff',
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    // Get unread count for staff messages
    const unreadFromStaff = messages.filter(m => m.senderType === 'staff' && !m.readAt).length;

    return NextResponse.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          status: conversation.status,
          createdAt: conversation.createdAt,
        },
        messages: messages.reverse().map(msg => ({
          id: msg.id,
          content: msg.content,
          isFromStaff: msg.senderType === 'staff',
          sender: msg.sender ? {
            id: msg.sender.id,
            name: `${msg.sender.firstName} ${msg.sender.lastName}`,
            avatar: msg.sender.avatar,
          } : null,
          readAt: msg.readAt,
          createdAt: msg.createdAt,
        })),
        unreadCount: unreadFromStaff,
      },
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch messages' } },
      { status: 500 }
    );
  }
}

// POST /api/guest-app/chat - Send a message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, content, attachments } = body;

    if (!token || !content) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Token and content are required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: { in: ['confirmed', 'checked_in'] },
      },
      select: {
        id: true,
        primaryGuestId: true,
        tenantId: true,
        propertyId: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid token' } },
        { status: 404 }
      );
    }

    // Get or create conversation
    let conversation = await db.chatConversation.findFirst({
      where: {
        bookingId: booking.id,
      },
    });

    if (!conversation) {
      conversation = await db.chatConversation.create({
        data: {
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          guestId: booking.primaryGuestId,
          bookingId: booking.id,
          channel: 'app',
          status: 'open',
        },
      });
    }

    // Create message
    const message = await db.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: null,
        content,
        senderType: 'guest',
        messageType: 'text',
        attachments: attachments ? JSON.stringify(attachments) : undefined,
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

    // Update conversation
    await db.chatConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: message.id,
        content: message.content,
        isFromStaff: message.senderType === 'staff',
        sender: message.sender ? {
          id: message.sender.id,
          name: `${message.sender.firstName} ${message.sender.lastName}`,
          avatar: message.sender.avatar,
        } : null,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' } },
      { status: 500 }
    );
  }
}
