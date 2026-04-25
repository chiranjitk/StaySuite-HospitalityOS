import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logWifi } from '@/lib/audit';
import { wifiUserService } from '@/lib/wifi/services/wifi-user-service';
import { requirePermission } from '@/lib/auth/tenant-context';
import crypto from 'crypto';

// Helper function to generate voucher code using cryptographically secure random bytes
function generateVoucherCode(): string {
  const bytes = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${bytes.slice(0, 5)}-${bytes.slice(5, 10)}`;
}

// GET /api/wifi/vouchers - List all WiFi vouchers with filtering and pagination
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const planId = searchParams.get('planId');
    const guestId = searchParams.get('guestId');
    const bookingId = searchParams.get('bookingId');
    const status = searchParams.get('status');
    const isUsed = searchParams.get('isUsed');
    const validFrom = searchParams.get('validFrom');
    const validUntil = searchParams.get('validUntil');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (planId) {
      where.planId = planId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (bookingId) {
      where.bookingId = bookingId;
    }

    if (status) {
      where.status = status;
    }

    if (isUsed !== null && isUsed !== undefined) {
      where.isUsed = isUsed === 'true';
    }

    if (validFrom || validUntil) {
      where.validFrom = {};
      if (validFrom) {
        (where.validFrom as Record<string, unknown>).gte = new Date(validFrom);
      }
      if (validUntil) {
        (where.validUntil as Record<string, unknown>).lte = new Date(validUntil);
      }
    }

    if (search) {
      where.code = { contains: search,  };
    }

    const vouchers = await db.wiFiVoucher.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
            dataLimit: true,
            sessionLimit: true,
            validityDays: true,
            price: true,
            currency: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.wiFiVoucher.count({ where });

    // Calculate summary statistics
    const statusCounts = await db.wiFiVoucher.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const usageStats = await db.wiFiVoucher.aggregate({
      where,
      _count: {
        isUsed: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: vouchers,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        totalUsed: usageStats._count.isUsed,
      },
    });
  } catch (error) {
    console.error('Error fetching WiFi vouchers:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch WiFi vouchers' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/vouchers - Create new WiFi vouchers
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      
      planId,
      guestId,
      bookingId,
      quantity = 1,
      validFrom,
      validUntil,
      validityDays,
      notes,
    } = body;

    // Validate required fields
    if (!planId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: planId' } },
        { status: 400 }
      );
    }

    // Verify plan exists
    const plan = await db.wiFiPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PLAN', message: 'WiFi plan not found' } },
        { status: 400 }
      );
    }

    // Calculate validity dates
    const voucherValidFrom = validFrom ? new Date(validFrom) : new Date();
    const voucherValidityDays = validityDays || plan.validityDays || 1;
    const voucherValidUntil = validUntil
      ? new Date(validUntil)
      : new Date(voucherValidFrom.getTime() + voucherValidityDays * 24 * 60 * 60 * 1000);

    // Generate unique voucher codes with retry on unique constraint violation
    const vouchers: any[] = [];
    const MAX_RETRIES = 3;

    // Create vouchers with retry logic for unique constraint (P2002)
    let codesGenerated = 0;
    while (codesGenerated < quantity) {
      let currentCode = generateVoucherCode();
      let retries = 0;
       
      let voucher: any = null;

      while (retries < MAX_RETRIES) {
        try {
          voucher = await db.wiFiVoucher.create({
            data: {
              tenantId,
              planId,
              guestId,
              bookingId,
              code: currentCode,
              validFrom: voucherValidFrom,
              validUntil: voucherValidUntil,
              status: 'active',
              notes: notes || null,
            },
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  downloadSpeed: true,
                  uploadSpeed: true,
                  validityDays: true,
                },
              },
            },
          });
          break; // Success, exit retry loop
        } catch (createError: unknown) {
          const prismaError = createError as { code?: string };
          if (prismaError.code === 'P2002') {
            // Unique constraint violation - generate new code and retry
            retries++;
            currentCode = generateVoucherCode();
          } else {
            throw createError; // Re-throw non-constraint errors
          }
        }
      }

      if (!voucher) {
        throw new Error(`Failed to create voucher after ${MAX_RETRIES} retries due to unique constraint conflicts`);
      }

      // ── Create RADIUS radcheck entry so FreeRADIUS can authenticate voucher code ──
      // The voucher code serves as BOTH username and password for RADIUS auth.
      // This is the industry-standard approach for captive portal voucher systems.
      try {
        const expirationDate = voucherValidUntil.toISOString().split('T')[0]; // FreeRADIUS format: YYYY-MM-DD
        const nowISO = new Date().toISOString().replace('T', ' ').split('.')[0]; // SQLite format

        // Insert radcheck entries (raw SQL for FreeRADIUS compatibility — includes required timestamps)
        await db.$executeRawUnsafe(
          `INSERT INTO radcheck (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, 'Cleartext-Password', ':=', ?, 1, ?, ?)`,
          currentCode, currentCode, nowISO, nowISO
        );
        await db.$executeRawUnsafe(
          `INSERT INTO radcheck (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, 'Expiration', ':=', ?, 1, ?, ?)`,
          currentCode, expirationDate, nowISO, nowISO
        );

        // Insert radreply entries for plan enforcement (bandwidth + session timeout)
        if (plan.downloadSpeed) {
          const downBps = plan.downloadSpeed * 1000000; // Mbps to bps
          await db.$executeRawUnsafe(
            `INSERT INTO radreply (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, 'WISPr-Bandwidth-Max-Down', '=', ?, 1, ?, ?)`,
            currentCode, String(downBps), nowISO, nowISO
          );
        }
        if (plan.uploadSpeed) {
          const upBps = plan.uploadSpeed * 1000000;
          await db.$executeRawUnsafe(
            `INSERT INTO radreply (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, 'WISPr-Bandwidth-Max-Up', '=', ?, 1, ?, ?)`,
            currentCode, String(upBps), nowISO, nowISO
          );
        }
        if (plan.sessionLimit) {
          await db.$executeRawUnsafe(
            `INSERT INTO radreply (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, 'Session-Timeout', '=', ?, 1, ?, ?)`,
            currentCode, String(plan.sessionLimit), nowISO, nowISO
          );
        }
        // Always set a session timeout based on validity days if no explicit session limit
        if (!plan.sessionLimit) {
          const sessionTimeoutSec = voucherValidityDays * 24 * 60 * 60;
          await db.$executeRawUnsafe(
            `INSERT INTO radreply (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, 'Session-Timeout', '=', ?, 1, ?, ?)`,
            currentCode, String(sessionTimeoutSec), nowISO, nowISO
          );
        }

        console.log(`[Voucher] Created RADIUS credentials for voucher ${currentCode}`);
      } catch (radiusError) {
        console.error(`[Voucher] FAILED to create RADIUS credentials for voucher ${currentCode}:`, radiusError);
        // Non-fatal: voucher is created but RADIUS auth won't work until manually synced
      }

      vouchers.push(voucher);
      codesGenerated++;
      
      // Log voucher creation to audit log
      try {
        await logWifi(request, 'voucher_create', 'voucher', voucher.id, {
          code: voucher.code,
          planName: voucher.plan?.name,
          validFrom: voucher.validFrom,
          validUntil: voucher.validUntil,
          guestId,
          bookingId,
        }, { tenantId: user.tenantId, userId: user.userId });
      } catch (auditError) {
        console.error('Audit log failed (non-blocking):', auditError);
      }
    }

    return NextResponse.json({
      success: true,
      data: vouchers,
      message: `Created ${vouchers.length} voucher(s) successfully`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating WiFi vouchers:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create WiFi vouchers' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/vouchers - Update or use a voucher
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;
    const { id, code, action, guestId, bookingId, status, propertyId } = body;

    // Find voucher by ID or code
    let voucher;
    if (id) {
      voucher = await db.wiFiVoucher.findFirst({
        where: { id, tenantId },
        include: { plan: true },
      });
    } else if (code) {
      voucher = await db.wiFiVoucher.findFirst({
        where: { code, tenantId },
        include: { plan: true },
      });
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id or code' } },
        { status: 400 }
      );
    }

    if (!voucher) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi voucher not found' } },
        { status: 404 }
      );
    }

    // Handle voucher issuance (tracking when a physical voucher is given to someone)
    if (action === 'issue') {
      if (voucher.status !== 'active') {
        return NextResponse.json(
          { success: false, error: { code: 'VOUCHER_INVALID', message: `Cannot issue a ${voucher.status} voucher` } },
          { status: 400 }
        );
      }

      const { issuedTo: issueRecipient, notes: issueNotes } = body;

      if (!issueRecipient || !issueRecipient.trim()) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Recipient name is required to issue a voucher' } },
          { status: 400 }
        );
      }

      const updatedVoucher = await db.wiFiVoucher.update({
        where: { id: voucher.id },
        data: {
          issuedTo: issueRecipient.trim(),
          issuedAt: new Date(),
          notes: issueNotes ? (voucher.notes ? `${voucher.notes}\n[${new Date().toISOString()}] ${issueNotes}` : issueNotes) : voucher.notes,
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              downloadSpeed: true,
              uploadSpeed: true,
              dataLimit: true,
              sessionLimit: true,
              validityDays: true,
              price: true,
              currency: true,
            },
          },
        },
      });

      // Log issuance to audit log
      try {
        await logWifi(request, 'voucher_issue', 'voucher', updatedVoucher.id, {
          code: updatedVoucher.code,
          planName: updatedVoucher.plan?.name,
          issuedTo: issueRecipient.trim(),
          notes: issueNotes || undefined,
        }, { tenantId: user.tenantId, userId: user.userId });
      } catch (auditError) {
        console.error('Audit log failed (non-blocking):', auditError);
      }

      return NextResponse.json({
        success: true,
        data: updatedVoucher,
        message: `Voucher issued to ${issueRecipient.trim()}`,
      });
    }

    // Handle voucher usage
    if (action === 'use') {
      // Validate voucher is usable
      if (voucher.status !== 'active') {
        return NextResponse.json(
          { success: false, error: { code: 'VOUCHER_INVALID', message: `Voucher is ${voucher.status}` } },
          { status: 400 }
        );
      }

      if (voucher.isUsed) {
        return NextResponse.json(
          { success: false, error: { code: 'VOUCHER_USED', message: 'Voucher has already been used' } },
          { status: 400 }
        );
      }

      const now = new Date();
      if (now < voucher.validFrom || now > voucher.validUntil) {
        return NextResponse.json(
          { success: false, error: { code: 'VOUCHER_EXPIRED', message: 'Voucher is not valid at this time' } },
          { status: 400 }
        );
      }

      // Get the plan details for provisioning
      const plan = voucher.plan;
      if (!plan) {
        return NextResponse.json(
          { success: false, error: { code: 'PLAN_NOT_FOUND', message: 'WiFi plan not found for voucher' } },
          { status: 400 }
        );
      }

      // Determine property ID from booking or get from plan
      let targetPropertyId = propertyId;
      if (!targetPropertyId) {
        // Try to get property from booking
        if (voucher.bookingId) {
          const booking = await db.booking.findUnique({
            where: { id: voucher.bookingId },
            select: { propertyId: true },
          });
          if (booking) {
            targetPropertyId = booking.propertyId;
          }
        }
      }

      if (!targetPropertyId) {
        // Get first property of tenant as fallback
        const property = await db.property.findFirst({
          where: { tenantId: voucher.tenantId },
          select: { id: true },
        });
        if (property) {
          targetPropertyId = property.id;
        }
      }

      if (!targetPropertyId) {
        return NextResponse.json(
          { success: false, error: { code: 'PROPERTY_NOT_FOUND', message: 'No property found for WiFi provisioning' } },
          { status: 400 }
        );
      }

      // Calculate validFrom and validUntil based on plan's validityDays
      const wifiValidFrom = now;
      const wifiValidUntil = new Date(now.getTime() + (plan.validityDays || 1) * 24 * 60 * 60 * 1000);

      // Provision WiFi user with credentials from plan
      let wifiCredentials: {
        username: string;
        password: string;
        validFrom: Date;
        validUntil: Date;
      } | null = null;
       
      let wifiUser: any = null;

      try {
        const provisionResult = await wifiUserService.provisionUser({
          tenantId: voucher.tenantId,
          propertyId: targetPropertyId,
          guestId: guestId || voucher.guestId || undefined,
          bookingId: bookingId || voucher.bookingId || undefined,
          planId: plan.id,
          validFrom: wifiValidFrom,
          validUntil: wifiValidUntil,
          userType: 'guest',
          downloadSpeed: plan.downloadSpeed ? plan.downloadSpeed * 1000000 : undefined, // Convert Mbps to bps
          uploadSpeed: plan.uploadSpeed ? plan.uploadSpeed * 1000000 : undefined,
          dataLimit: plan.dataLimit || undefined,
          sessionLimit: plan.sessionLimit || undefined,
        });

        wifiCredentials = provisionResult.credentials;
        wifiUser = provisionResult.wifiUser;
      } catch (provisionError) {
        console.error('Error provisioning WiFi user:', provisionError);
        // Do NOT mark voucher as used if provisioning fails - return error instead
        return NextResponse.json(
          { success: false, error: { code: 'PROVISION_FAILED', message: 'Failed to provision WiFi user for this voucher. Voucher has not been marked as used.' } },
          { status: 500 }
        );
      }

      // Mark voucher as used ONLY after successful provisioning
      const updatedVoucher = await db.wiFiVoucher.update({
        where: { id: voucher.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
          status: 'used',
          guestId: guestId || voucher.guestId,
          bookingId: bookingId || voucher.bookingId,
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              downloadSpeed: true,
              uploadSpeed: true,
              dataLimit: true,
              sessionLimit: true,
            },
          },
        },
      });

      // Log voucher usage to audit log
      try {
        await logWifi(request, 'voucher_use', 'voucher', updatedVoucher.id, {
          code: updatedVoucher.code,
          planName: updatedVoucher.plan?.name,
          guestId: guestId || voucher.guestId,
          bookingId: bookingId || voucher.bookingId,
          wifiUsername: wifiCredentials?.username,
        }, { tenantId: user.tenantId, userId: user.userId });
      } catch (auditError) {
        console.error('Audit log failed (non-blocking):', auditError);
      }

      // Post charge to folio if voucher is linked to a booking and plan has a price
      try {
        if (updatedVoucher.bookingId && plan.price > 0) {
          let folio = await db.folio.findFirst({
            where: { bookingId: updatedVoucher.bookingId },
          });

          if (!folio) {
            // Get property and guest from the booking to create a folio
            const bookingForFolio = await db.booking.findUnique({
              where: { id: updatedVoucher.bookingId },
              select: { propertyId: true, primaryGuestId: true },
            });

            if (bookingForFolio) {
              const folioNumber = `FOL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
              folio = await db.folio.create({
                data: {
                  tenantId: updatedVoucher.tenantId,
                  propertyId: bookingForFolio.propertyId,
                  bookingId: updatedVoucher.bookingId,
                  guestId: bookingForFolio.primaryGuestId,
                  folioNumber,
                  status: 'open',
                },
              });
            }
          }

          if (folio) {
            await db.folioLineItem.create({
              data: {
                folioId: folio.id,
                description: `WiFi - ${plan.name} (${plan.validityDays} days)`,
                category: 'wifi',
                unitPrice: plan.price,
                quantity: 1,
                totalAmount: plan.price,
              },
            });

            // Update folio total
            const existingLineItems = await db.folioLineItem.findMany({
              where: { folioId: folio.id },
            });
            const newSubtotal = existingLineItems.reduce((sum, item) => sum + item.totalAmount, 0);
            const newTaxes = existingLineItems.reduce((sum, item) => sum + item.taxAmount, 0);
            const newTotal = newSubtotal + newTaxes - (folio.discount || 0);

            await db.folio.update({
              where: { id: folio.id },
              data: {
                subtotal: newSubtotal,
                taxes: newTaxes,
                totalAmount: newTotal,
                balance: newTotal - folio.paidAmount,
              },
            });
          }
        }
      } catch (folioError) {
        console.error('Error posting WiFi charge to folio (non-fatal):', folioError);
      }

      return NextResponse.json({
        success: true,
        data: {
          voucher: updatedVoucher,
          wifiCredentials: wifiCredentials ? {
            username: wifiCredentials.username,
            password: wifiCredentials.password,
            validFrom: wifiCredentials.validFrom,
            validUntil: wifiCredentials.validUntil,
            ssid: 'StaySuite-Guest', // Default SSID
          } : null,
          wifiUser: wifiUser ? {
            id: wifiUser.id,
            username: wifiUser.username,
            status: wifiUser.status,
          } : null,
        },
        message: 'Voucher redeemed successfully',
      });
    }

    // Handle status update
    if (status) {
      const updatedVoucher = await db.wiFiVoucher.update({
        where: { id: voucher.id },
        data: { status },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return NextResponse.json({ success: true, data: updatedVoucher });
    }

    return NextResponse.json(
      { success: false, error: { code: 'NO_ACTION', message: 'No action specified' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating WiFi voucher:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update WiFi voucher' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/vouchers - Revoke a voucher
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 }
      );
    }

    const existingVoucher = await db.wiFiVoucher.findUnique({
      where: { id },
    });

    if (!existingVoucher) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi voucher not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify voucher belongs to user's tenant
    if (existingVoucher.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi voucher not found' } },
        { status: 404 }
      );
    }

    // Can only revoke active vouchers
    if (existingVoucher.status !== 'active') {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_REVOKE', message: 'Can only revoke active vouchers' } },
        { status: 400 }
      );
    }

    // Revoke the voucher
    const voucher = await db.wiFiVoucher.update({
      where: { id },
      data: { status: 'revoked' },
    });

    // Remove RADIUS credentials so the code can no longer authenticate
    try {
      await db.$executeRawUnsafe(`DELETE FROM radcheck WHERE username = ? AND wifiUserId IS NULL`, voucher.code);
      await db.$executeRawUnsafe(`DELETE FROM radreply WHERE username = ? AND wifiUserId IS NULL`, voucher.code);
      console.log(`[Voucher] Removed RADIUS credentials for revoked voucher ${voucher.code}`);
    } catch (radiusError) {
      console.error(`[Voucher] Failed to remove RADIUS credentials for ${voucher.code}:`, radiusError);
    }

    // Log voucher revocation to audit log
    try {
      await logWifi(request, 'delete', 'voucher', id, {
        code: voucher.code,
        reason: 'revoked',
      }, { tenantId: user.tenantId, userId: user.userId });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({
      success: true,
      data: voucher,
      message: 'Voucher revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking WiFi voucher:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke WiFi voucher' } },
      { status: 500 }
    );
  }
}
