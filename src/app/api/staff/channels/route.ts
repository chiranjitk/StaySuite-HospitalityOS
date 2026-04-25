import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Valid channel types
const VALID_CHANNEL_TYPES = ['team', 'department', 'direct', 'announcement'];

// GET /api/staff/channels - Get chat channels
export async function GET(request: NextRequest) {
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view channels' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || user.id;
    const type = searchParams.get('type');
    const limit = searchParams.get('limit');

    // Build where clause with tenant scoping
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      isArchived: false,
    };

    // Filter by channel type if specified
    if (type) {
      where.type = type;
    }

    // Get channels where user is a member or all tenant channels if no userId specified
    const channels = await db.staffChannel.findMany({
      where: {
        ...where,
        ...(userId ? {
          members: {
            some: {
              userId
            }
          }
        } : {}),
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                jobTitle: true,
                avatar: true,
              }
            }
          }
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: {
            content: true,
            sentAt: true,
            sender: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      },
      orderBy: { lastMessageAt: 'desc' },
      ...(limit && { take: Math.min(parseInt(limit, 10), 100) }),
    });

    // Format channels for response
    const formattedChannels = channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      description: channel.description,
      department: channel.department,
      members: channel.members.map(m => ({
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        department: m.user.department,
        jobTitle: m.user.jobTitle,
        avatar: m.user.avatar,
        role: m.role,
      })),
      unreadCount: userId ? channel.members.find(m => m.userId === userId)?.lastReadAt
        ? channel.messages.filter(m => m.sentAt > (channel.members.find(mem => mem.userId === userId)?.lastReadAt || new Date(0))).length
        : channel.messages.length
        : 0,
      lastMessage: channel.messages[0] ? {
        content: channel.messages[0].content,
        senderName: `${channel.messages[0].sender.firstName} ${channel.messages[0].sender.lastName}`,
        sentAt: channel.messages[0].sentAt,
      } : null,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      channels: formattedChannels,
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch channels' } },
      { status: 500 }
    );
  }
}

// POST /api/staff/channels - Create a new channel
export async function POST(request: NextRequest) {
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
    if (!hasPermission(user, 'staff.manage') && !hasPermission(user, 'chat.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create channels' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, type = 'team', description, department, memberIds } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Channel name is required' } },
        { status: 400 }
      );
    }

    // Validate channel type
    if (!VALID_CHANNEL_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Channel type must be one of: ${VALID_CHANNEL_TYPES.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate member IDs if provided
    if (memberIds && memberIds.length > 0) {
      const validMembers = await db.user.findMany({
        where: {
          id: { in: memberIds },
          tenantId: user.tenantId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (validMembers.length !== memberIds.length) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_MEMBERS', message: 'Some members do not exist or do not belong to your tenant' } },
          { status: 400 }
        );
      }
    }

    // Create the channel with members
    const channel = await db.staffChannel.create({
      data: {
        tenantId: user.tenantId,
        name: name.trim(),
        type,
        description,
        department,
        createdBy: user.id,
        members: memberIds && memberIds.length > 0 ? {
          create: memberIds.map((userId: string) => ({
            userId,
            role: 'member',
          }))
        } : {
          create: {
            userId: user.id,
            role: 'admin',
          }
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                jobTitle: true,
                avatar: true,
              }
            }
          }
        }
      }
    });

    // Format response
    const formattedChannel = {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      description: channel.description,
      department: channel.department,
      members: channel.members.map(m => ({
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        department: m.user.department,
        jobTitle: m.user.jobTitle,
        avatar: m.user.avatar,
        role: m.role,
      })),
      unreadCount: 0,
      lastMessage: null,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    };

    return NextResponse.json({
      success: true,
      channel: formattedChannel,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create channel' } },
      { status: 500 }
    );
  }
}
