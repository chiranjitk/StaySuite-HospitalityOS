import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/staff/channels/[id]/messages - Get messages for a channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'staff.view') && !hasPermission(user, 'chat.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view messages' } },
        { status: 403 }
      );
    }

    const { id: channelId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const before = searchParams.get('before'); // Message ID for pagination

    // Check if channel exists and belongs to user's tenant
    const channel = await db.staffChannel.findFirst({
      where: { id: channelId, tenantId: user.tenantId },
    });

    if (!channel) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Channel not found' } },
        { status: 404 }
      );
    }

    // Check if user is a member of the channel (for non-announcement channels)
    if (channel.type !== 'announcement') {
      const membership = await db.staffChannelMember.findUnique({
        where: {
          channelId_userId: {
            channelId,
            userId: user.id,
          },
        },
      });

      if (!membership) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'You are not a member of this channel' } },
          { status: 403 }
        );
      }
    }

    // Build where clause for pagination
    const where: Record<string, unknown> = {
      channelId,
      isDeleted: false,
    };

    if (before) {
      const beforeMessage = await db.staffChatMessage.findUnique({
        where: { id: before },
        select: { sentAt: true },
      });
      if (beforeMessage) {
        where.sentAt = { lt: beforeMessage.sentAt };
      }
    }

    // Get messages from database
    const messages = await db.staffChatMessage.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          }
        },
        replies: {
          where: { isDeleted: false },
          take: 5,
          orderBy: { sentAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              }
            }
          }
        }
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });

    // Update last read timestamp for the user
    await db.staffChannelMember.updateMany({
      where: {
        channelId,
        userId: user.id,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    // Format messages for response
    const formattedMessages = messages.reverse().map(msg => ({
      id: msg.id,
      content: msg.content,
      senderId: msg.senderId,
      senderName: `${msg.sender.firstName} ${msg.sender.lastName}`,
      senderAvatar: msg.sender.avatar,
      timestamp: msg.sentAt,
      type: msg.messageType,
      attachments: JSON.parse(msg.attachments || '[]'),
      isEdited: msg.isEdited,
      editedAt: msg.editedAt,
      replyToId: msg.replyToId,
      readBy: JSON.parse(msg.readBy || '[]'),
      replies: msg.replies.map((reply: { id: string; content: string; senderId: string; sender: { id: string; firstName: string; lastName: string; avatar: string | null }; sentAt: Date; messageType: string }) => ({
        id: reply.id,
        content: reply.content,
        senderId: reply.senderId,
        senderName: `${reply.sender.firstName} ${reply.sender.lastName}`,
        senderAvatar: reply.sender.avatar,
        timestamp: reply.sentAt,
        type: reply.messageType,
      })),
    }));

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch messages' } },
      { status: 500 }
    );
  }
}

// POST /api/staff/channels/[id]/messages - Send a message to a channel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'staff.view') && !hasPermission(user, 'chat.send')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to send messages' } },
        { status: 403 }
      );
    }

    const { id: channelId } = await params;
    const body = await request.json();
    const { content, messageType = 'text', attachments = [], replyToId } = body;

    // Validate required fields
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Message content is required' } },
        { status: 400 }
      );
    }

    // Check if channel exists and belongs to user's tenant
    const channel = await db.staffChannel.findFirst({
      where: { id: channelId, tenantId: user.tenantId },
    });

    if (!channel) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Channel not found' } },
        { status: 404 }
      );
    }

    // Check if user is a member of the channel
    const membership = await db.staffChannelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You are not a member of this channel' } },
        { status: 403 }
      );
    }

    // Validate replyToId if provided
    if (replyToId) {
      const replyToMessage = await db.staffChatMessage.findFirst({
        where: { id: replyToId, channelId },
      });
      if (!replyToMessage) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_REPLY', message: 'Reply message not found' } },
          { status: 400 }
        );
      }
    }

    // Create the message
    const message = await db.staffChatMessage.create({
      data: {
        channelId,
        senderId: user.id,
        content: content.trim(),
        messageType,
        attachments: JSON.stringify(attachments),
        replyToId,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          }
        }
      }
    });

    // Update channel's last message
    await db.staffChannel.update({
      where: { id: channelId },
      data: {
        lastMessage: content.trim().substring(0, 100),
        lastMessageAt: new Date(),
      }
    });

    // Format response
    const formattedMessage = {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderName: `${message.sender.firstName} ${message.sender.lastName}`,
      senderAvatar: message.sender.avatar,
      timestamp: message.sentAt,
      type: message.messageType,
      attachments: JSON.parse(message.attachments || '[]'),
      isEdited: message.isEdited,
      replyToId: message.replyToId,
    };

    return NextResponse.json({
      success: true,
      message: formattedMessage,
    }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' } },
      { status: 500 }
    );
  }
}
