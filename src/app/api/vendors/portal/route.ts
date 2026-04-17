import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

// Helper to generate portal token
function generatePortalToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Helper to generate payment number
async function generatePaymentNumber(tenantId: string): Promise<string> {
  const prefix = 'VP';
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const count = await db.vendorPayment.count({
    where: {
      tenantId,
      createdAt: {
        gte: new Date(year, new Date().getMonth(), 1),
        lt: new Date(year, new Date().getMonth() + 1, 1),
      },
    },
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}${month}-${sequence}`;
}

// GET /api/vendors/portal - Vendor portal data (assigned work orders, payments)
export async function GET(request: NextRequest) {
    const tenantId = await getTenantIdFromSession(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const vendorId = searchParams.get('vendorId');

    // Validate authentication
    let authenticatedVendorId = vendorId;

    if (token) {
      // Verify token
      const vendor = await db.vendor.findFirst({
        where: {
          portalToken: token,
          portalTokenExpires: { gt: new Date() },
          deletedAt: null,
          status: 'active',
        },
      });

      if (!vendor) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
          { status: 401 }
        );
      }

      authenticatedVendorId = vendor.id;
    }

    if (!authenticatedVendorId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // When using session auth (not vendor token), verify the vendor belongs to user's tenant
    if (!token && authenticatedVendorId) {
      const vendorBelongsToTenant = await db.vendor.findFirst({
        where: { id: authenticatedVendorId, tenantId: user.tenantId, deletedAt: null },
      });
      if (!vendorBelongsToTenant) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Vendor does not belong to your tenant' } },
          { status: 403 }
        );
      }
    }

    // Get vendor details
    const vendor = await db.vendor.findFirst({
      where: { id: authenticatedVendorId, deletedAt: null },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        phone: true,
        address: true,
        type: true,
        paymentTerms: true,
        status: true,
        portalEmail: true,
        lastPortalLogin: true,
        createdAt: true,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } },
        { status: 404 }
      );
    }

    // Get assigned work orders
    const workOrders = await db.workOrder.findMany({
      where: {
        vendorId: authenticatedVendorId,
        deletedAt: null,
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { scheduledDate: 'asc' },
      ],
      take: 50,
    });

    // Get payments
    const payments = await db.vendorPayment.findMany({
      where: { vendorId: authenticatedVendorId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Calculate statistics
    const totalWorkOrders = workOrders.length;
    const pendingWorkOrders = workOrders.filter(wo => ['pending', 'assigned'].includes(wo.status)).length;
    const inProgressWorkOrders = workOrders.filter(wo => wo.status === 'in_progress').length;
    const completedWorkOrders = workOrders.filter(wo => wo.status === 'completed').length;

    const totalEarnings = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayments = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        vendor,
        workOrders,
        payments,
        stats: {
          totalWorkOrders,
          pendingWorkOrders,
          inProgressWorkOrders,
          completedWorkOrders,
          totalEarnings,
          pendingPayments,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching vendor portal data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch portal data' } },
      { status: 500 }
    );
  }
}

// POST /api/vendors/portal - Vendor login/auth
export async function POST(request: NextRequest) {
    const tenantId = await getTenantIdFromSession(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {
    const body = await request.json();
    const { action, portalEmail, portalPassword, vendorId } = body;

    // Login action
    if (action === 'login' || (!action && portalEmail && portalPassword)) {
      if (!portalEmail || !portalPassword) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } },
          { status: 400 }
        );
      }

      // Find vendor by portal email
      const vendor = await db.vendor.findUnique({
        where: { portalEmail },
      });

      if (!vendor || vendor.deletedAt || vendor.status !== 'active') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
          { status: 401 }
        );
      }

      // Verify password
      if (!vendor.portalPassword) {
        return NextResponse.json(
          { success: false, error: { code: 'ACCOUNT_NOT_SETUP', message: 'Account not properly configured' } },
          { status: 400 }
        );
      }

      const passwordValid = await bcrypt.compare(portalPassword, vendor.portalPassword);
      if (!passwordValid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
          { status: 401 }
        );
      }

      // Generate new token
      const token = generatePortalToken();
      const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Update vendor with new token and last login
      await db.vendor.update({
        where: { id: vendor.id },
        data: {
          portalToken: token,
          portalTokenExpires: tokenExpires,
          lastPortalLogin: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          token,
          expiresAt: tokenExpires,
          vendor: {
            id: vendor.id,
            name: vendor.name,
            email: vendor.email,
            type: vendor.type,
          },
        },
      });
    }

    // Request password reset
    if (action === 'request-reset') {
      if (!portalEmail) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Email is required' } },
          { status: 400 }
        );
      }

      const vendor = await db.vendor.findUnique({
        where: { portalEmail },
      });

      if (!vendor || vendor.deletedAt) {
        // Don't reveal if email exists or not
        return NextResponse.json({
          success: true,
          message: 'If the email exists, a reset link will be sent',
        });
      }

      // Generate reset token
      const resetToken = generatePortalToken();
      const resetTokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

      await db.vendor.update({
        where: { id: vendor.id },
        data: {
          portalToken: resetToken,
          portalTokenExpires: resetTokenExpires,
        },
      });

      // In a real system, send email with reset link
      // For now, return token (in production, this would be sent via email)
      return NextResponse.json({
        success: true,
        message: 'Reset token generated',
        data: { resetToken }, // In production, remove this and send email
      });
    }

    // Logout action
    if (action === 'logout') {
      if (!vendorId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor ID is required' } },
          { status: 400 }
        );
      }

      await db.vendor.update({
        where: { id: vendorId },
        data: {
          portalToken: null,
          portalTokenExpires: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Logged out successfully',
      });
    }

    // Create payment request
    if (action === 'request-payment') {
      const { workOrderId, amount, notes } = body;

      if (!vendorId || !amount) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor ID and amount are required' } },
          { status: 400 }
        );
      }

      // Verify vendor exists
      const vendor = await db.vendor.findFirst({
        where: { id: vendorId, deletedAt: null, status: 'active' },
      });

      if (!vendor) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } },
          { status: 404 }
        );
      }

      // Generate payment number
      const paymentNumber = await generatePaymentNumber(vendor.tenantId);

      const payment = await db.vendorPayment.create({
        data: {
          tenantId: vendor.tenantId,
          vendorId,
          workOrderId,
          paymentNumber,
          amount: parseFloat(amount),
          status: 'pending',
          notes,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      return NextResponse.json({ success: true, data: payment }, { status: 201 });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action specified' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in vendor portal:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    );
  }
}

// PUT /api/vendors/portal - Vendor profile update
export async function PUT(request: NextRequest) {
    const tenantId = await getTenantIdFromSession(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {
    const body = await request.json();
    const { vendorId, token, ...updates } = body;

    // Validate authentication
    let authenticatedVendorId = vendorId;

    if (token) {
      const vendor = await db.vendor.findFirst({
        where: {
          portalToken: token,
          portalTokenExpires: { gt: new Date() },
          deletedAt: null,
        },
      });

      if (!vendor) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
          { status: 401 }
        );
      }

      authenticatedVendorId = vendor.id;
    }

    if (!authenticatedVendorId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Allowed fields for vendor self-update
    const allowedUpdates: Record<string, unknown> = {};
    const allowedFields = ['contactPerson', 'phone', 'address', 'notes'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        allowedUpdates[field] = updates[field];
      }
    }

    // Handle password change
    if (updates.currentPassword && updates.newPassword) {
      const vendor = await db.vendor.findUnique({
        where: { id: authenticatedVendorId },
      });

      if (!vendor || !vendor.portalPassword) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } },
          { status: 404 }
        );
      }

      const passwordValid = await bcrypt.compare(updates.currentPassword, vendor.portalPassword);
      if (!passwordValid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } },
          { status: 400 }
        );
      }

      allowedUpdates.portalPassword = await bcrypt.hash(updates.newPassword, 12);
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No valid updates provided' } },
        { status: 400 }
      );
    }

    const vendor = await db.vendor.update({
      where: { id: authenticatedVendorId },
      data: allowedUpdates,
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        phone: true,
        address: true,
        type: true,
        paymentTerms: true,
        status: true,
        portalEmail: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Error updating vendor profile:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } },
      { status: 500 }
    );
  }
}
