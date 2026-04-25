import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { emailService } from '@/lib/services/email-service';
import { smsService } from '@/lib/services/sms-service';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

const MAX_LIMIT = 100;

// GET /api/campaigns - List campaigns
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), MAX_LIMIT);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = {
      tenantId,
      ...(status && { status }),
      ...(type && { type }),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      } : undefined),
    } as Prisma.CampaignWhereInput;

    const [campaigns, total] = await Promise.all([
      db.campaign.findMany({
        where,
        include: {
          segments: {
            include: {
              segment: {
                select: {
                  id: true,
                  name: true,
                  memberCount: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.campaign.count({ where }),
    ]);

    // Calculate stats
    const allCampaigns = await db.campaign.findMany({
      where: { tenantId },
      select: {
        status: true,
        totalRecipients: true,
        sentCount: true,
        openedCount: true,
        clickedCount: true,
      },
    });

    const stats = {
      total: allCampaigns.length,
      draft: allCampaigns.filter((c) => c.status === 'draft').length,
      scheduled: allCampaigns.filter((c) => c.status === 'scheduled').length,
      sent: allCampaigns.filter((c) => c.status === 'sent').length,
      totalRecipients: allCampaigns.reduce((acc, c) => acc + c.totalRecipients, 0),
      totalSent: allCampaigns.reduce((acc, c) => acc + c.sentCount, 0),
      avgOpenRate: calculateRate(allCampaigns, 'opened'),
      avgClickRate: calculateRate(allCampaigns, 'clicked'),
    };

    return NextResponse.json({
      success: true,
      data: {
        campaigns: campaigns.map((c) => ({
          ...c,
          openRate: c.sentCount > 0 ? Math.round((c.openedCount / c.sentCount) * 100) : 0,
          clickRate: c.sentCount > 0 ? Math.round((c.clickedCount / c.sentCount) * 100) : 0,
        })),
        total,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch campaigns' } },
      { status: 500 }
    );
  }
}

function calculateRate(campaigns: { sentCount: number; openedCount?: number; clickedCount?: number }[], type: 'opened' | 'clicked') {
  const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
  if (totalSent === 0) return 0;
  
  const totalAction = campaigns.reduce((acc, c) => {
    return acc + (type === 'opened' ? c.openedCount || 0 : c.clickedCount || 0);
  }, 0);
  
  return Math.round((totalAction / totalSent) * 100);
}

// POST /api/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'campaigns.create') && !hasPermission(user, 'marketing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      name,
      description,
      type,
      subject,
      content,
      templateId,
      segmentIds = [],
      scheduledAt,
    } = body;

    if (!name || !type || !content) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, type, and content are required' } },
        { status: 400 }
      );
    }

    // Validate campaign type
    const validTypes = ['email', 'sms', 'both'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid campaign type. Must be email, sms, or both' } },
        { status: 400 }
      );
    }

    // Validate email subject for email campaigns
    if ((type === 'email' || type === 'both') && !subject) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Subject is required for email campaigns' } },
        { status: 400 }
      );
    }

    // Determine initial status
    let status = 'draft';
    if (scheduledAt) {
      status = 'scheduled';
    }

    // Validate scheduled date is in the future
    if (scheduledAt && new Date(scheduledAt) <= new Date()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Scheduled date must be in the future' } },
        { status: 400 }
      );
    }

    // Get total recipients from segments
    let totalRecipients = 0;
    if (segmentIds.length > 0) {
      const segments = await db.guestSegment.findMany({
        where: { id: { in: segmentIds }, tenantId },
        select: { memberCount: true },
      });
      totalRecipients = segments.reduce((acc, s) => acc + s.memberCount, 0);
    }

    const campaign = await db.campaign.create({
      data: {
        tenantId,
        name,
        description,
        type,
        subject,
        content,
        templateId,
        targetSegments: JSON.stringify(segmentIds),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status,
        totalRecipients,
        segments: {
          create: segmentIds.map((segmentId: string) => ({
            segmentId,
          })),
        },
      },
      include: {
        segments: {
          include: {
            segment: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create campaign' } },
      { status: 500 }
    );
  }
}

// PUT /api/campaigns - Update campaign
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'campaigns.edit') && !hasPermission(user, 'marketing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      id,
      name,
      description,
      type,
      subject,
      content,
      templateId,
      segmentIds,
      scheduledAt,
      status,
      // Stats updates
      sentCount,
      openedCount,
      clickedCount,
      bouncedCount,
      unsubscribedCount,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required' } },
        { status: 400 }
      );
    }

    // Get existing campaign
    const existing = await db.campaign.findUnique({
      where: { id },
      include: { 
        segments: {
          include: {
            segment: {
              include: {
                members: {
                  include: {
                    guest: {
                      select: {
                        id: true,
                        email: true,
                        phone: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    // Verify campaign belongs to user's tenant
    if (existing.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Validate status transitions
    if (status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['scheduled', 'cancelled', 'sending'],
        scheduled: ['sending', 'cancelled'],
        sending: ['sent', 'cancelled'],
        sent: [],
        cancelled: ['draft'],
      };

      if (!validTransitions[existing.status]?.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Cannot transition from ${existing.status} to ${status}` } },
          { status: 400 }
        );
      }
    }

    // Handle sending campaign
    if (status === 'sending' && existing.status !== 'sending') {
      return await sendCampaign(existing, subject, content, templateId);
    }

    // Handle immediate send: if status is 'scheduled' but no scheduledAt or scheduledAt is in the past,
    // treat as immediate send (the Send button was pressed without scheduling for later)
    if (status === 'scheduled' && existing.status === 'draft') {
      const isImmediate = !scheduledAt || new Date(scheduledAt) <= new Date();
      if (isImmediate) {
        return await sendCampaign(existing, subject, content, templateId);
      }
    }

    // Update segments if provided
    if (segmentIds && Array.isArray(segmentIds)) {
      // Delete existing segment associations
      await db.campaignSegment.deleteMany({
        where: { campaignId: id },
      });

      // Create new associations
      await db.campaignSegment.createMany({
        data: segmentIds.map((segmentId: string) => ({
          campaignId: id,
          segmentId,
        })),
      });
    }

    // Calculate total recipients if segments changed
    let totalRecipients = existing.totalRecipients;
    if (segmentIds && segmentIds.length > 0) {
      const segments = await db.guestSegment.findMany({
        where: { id: { in: segmentIds }, tenantId },
        select: { memberCount: true },
      });
      totalRecipients = segments.reduce((acc, s) => acc + s.memberCount, 0);
    }

    const campaign = await db.campaign.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(type && { type }),
        ...(subject !== undefined && { subject }),
        ...(content && { content }),
        ...(templateId !== undefined && { templateId }),
        ...(segmentIds && { targetSegments: JSON.stringify(segmentIds), totalRecipients }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(status && { 
          status,
          ...(status === 'sent' && { sentAt: new Date() }),
        }),
        ...(sentCount !== undefined && { sentCount }),
        ...(openedCount !== undefined && { openedCount }),
        ...(clickedCount !== undefined && { clickedCount }),
        ...(bouncedCount !== undefined && { bouncedCount }),
        ...(unsubscribedCount !== undefined && { unsubscribedCount }),
      },
      include: {
        segments: {
          include: {
            segment: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update campaign' } },
      { status: 500 }
    );
  }
}

/**
 * Send campaign emails/SMS to segment members
 */
async function sendCampaign(
  campaign: {
    id: string;
    tenantId: string;
    type: string;
    subject: string | null;
    content: string;
    templateId: string | null;
    segments: Array<{
      segment: {
        members: Array<{
          guest: {
            id: string;
            email: string | null;
            phone: string | null;
            firstName: string;
            lastName: string;
          };
        }>;
      };
    }>;
  },
  overrideSubject?: string,
  overrideContent?: string,
  overrideTemplateId?: string
): Promise<NextResponse> {
  try {
    // Collect all unique recipients from segments
    const recipientMap = new Map<string, {
      email: string | null;
      phone: string | null;
      firstName: string;
      lastName: string;
    }>();

    for (const segment of campaign.segments) {
      for (const member of segment.segment.members) {
        if (!recipientMap.has(member.guest.id)) {
          recipientMap.set(member.guest.id, {
            email: member.guest.email,
            phone: member.guest.phone,
            firstName: member.guest.firstName,
            lastName: member.guest.lastName,
          });
        }
      }
    }

    const subject = overrideSubject || campaign.subject || '';
    const content = overrideContent || campaign.content;
    const templateId = overrideTemplateId || campaign.templateId;

    let sentCount = 0;
    let bouncedCount = 0;
    const errors: string[] = [];

    // Send based on campaign type
    if (campaign.type === 'email') {
      // Prepare email recipients
      const emailRecipients = Array.from(recipientMap.values())
        .filter(r => r.email)
        .map(r => ({
          email: r.email!,
          name: `${r.firstName} ${r.lastName}`,
          variables: {
            firstName: r.firstName,
            lastName: r.lastName,
            name: `${r.firstName} ${r.lastName}`,
          },
        }));

      // Send campaign emails
      const result = await emailService.sendCampaign(
        campaign.id,
        campaign.tenantId,
        emailRecipients,
        {
          subject,
          html: content,
          templateId: templateId || undefined,
        }
      );

      sentCount = result.queued;
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }
    } else if (campaign.type === 'sms') {
      // Prepare SMS recipients
      const smsRecipients = Array.from(recipientMap.values())
        .filter(r => r.phone)
        .map(r => ({
          phone: r.phone!,
          name: `${r.firstName} ${r.lastName}`,
          variables: {
            firstName: r.firstName,
            lastName: r.lastName,
            name: `${r.firstName} ${r.lastName}`,
          },
        }));

      // Send campaign SMS
      const result = await smsService.sendCampaign(
        campaign.id,
        campaign.tenantId,
        smsRecipients,
        {
          message: content,
          templateId: templateId || undefined,
        }
      );

      sentCount = result.queued;
      bouncedCount = result.invalid;
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }
    } else if (campaign.type === 'both') {
      // Send both email and SMS
      const emailRecipients = Array.from(recipientMap.values())
        .filter(r => r.email)
        .map(r => ({
          email: r.email!,
          name: `${r.firstName} ${r.lastName}`,
          variables: {
            firstName: r.firstName,
            lastName: r.lastName,
            name: `${r.firstName} ${r.lastName}`,
          },
        }));

      const smsRecipients = Array.from(recipientMap.values())
        .filter(r => r.phone)
        .map(r => ({
          phone: r.phone!,
          name: `${r.firstName} ${r.lastName}`,
          variables: {
            firstName: r.firstName,
            lastName: r.lastName,
            name: `${r.firstName} ${r.lastName}`,
          },
        }));

      // Send emails
      const emailResult = await emailService.sendCampaign(
        campaign.id,
        campaign.tenantId,
        emailRecipients,
        {
          subject,
          html: content,
          templateId: templateId || undefined,
        }
      );

      // Send SMS
      const smsResult = await smsService.sendCampaign(
        campaign.id,
        campaign.tenantId,
        smsRecipients,
        {
          message: content,
          templateId: templateId || undefined,
        }
      );

      sentCount = emailResult.queued + smsResult.queued;
      bouncedCount = smsResult.invalid;
      errors.push(...emailResult.errors, ...smsResult.errors);
    }

    // Update campaign status and stats
    const updatedCampaign = await db.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        sentCount,
        bouncedCount,
        totalRecipients: recipientMap.size,
      },
      include: {
        segments: {
          include: {
            segment: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedCampaign,
        sentCount,
        bouncedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `Campaign sent to ${sentCount} recipients`,
    });
  } catch (error) {
    console.error('Error sending campaign:', error);
    
    // Update campaign status to failed
    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'cancelled',
      },
    });

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send campaign' } },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns - Delete campaign
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'campaigns.delete') && !hasPermission(user, 'marketing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required' } },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    // Verify campaign belongs to user's tenant
    if (campaign.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Only allow deletion of draft or cancelled campaigns
    if (!['draft', 'cancelled'].includes(campaign.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Can only delete draft or cancelled campaigns' } },
        { status: 400 }
      );
    }

    // Delete segment associations first
    await db.campaignSegment.deleteMany({
      where: { campaignId: id },
    });

    // Delete campaign
    await db.campaign.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Campaign deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete campaign' } },
      { status: 500 }
    );
  }
}
