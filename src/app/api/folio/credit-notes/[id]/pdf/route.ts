import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/folio/credit-notes/[id]/pdf - Generate credit note PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'billing.view', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const { id } = await params;

    const creditNote = await db.creditNote.findFirst({
      where: { id, tenantId },
      include: {
        folio: {
          select: {
            folioNumber: true,
            currency: true,
            booking: {
              select: {
                confirmationCode: true,
                primaryGuest: {
                  select: { firstName: true, lastName: true, email: true, phone: true },
                },
              },
            },
          },
        },
        property: {
          select: { name: true, address: true, phone: true, email: true },
        },
      },
    });

    if (!creditNote) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Credit note not found' } }, { status: 404 });
    }

    const items = JSON.parse(creditNote.items as string) as Array<{ description: string; amount: number }>;

    // Generate HTML for the PDF
    const property = creditNote.property;
    const folio = creditNote.folio;
    const guest = folio.booking?.primaryGuest;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, Helvetica, sans-serif; margin: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header .cn-number { font-size: 18px; color: #666; margin-top: 5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f9f9f9; padding: 15px; border-radius: 6px; }
          .info-box h3 { margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #888; }
          .info-box p { margin: 3px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { text-align: left; padding: 10px; background: #f0f0f0; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
          td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
          .amount-cell { text-align: right; }
          .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #333; background: #f9f9f9; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; color: white; }
          .badge-issued { background: #3b82f6; }
          .badge-applied { background: #10b981; }
          .badge-cancelled { background: #ef4444; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>CREDIT NOTE</h1>
            <div class="cn-number">${creditNote.creditNoteNumber}</div>
          </div>
          <div style="text-align: right;">
            <span class="badge badge-${creditNote.status}">${creditNote.status.toUpperCase()}</span>
            <div style="margin-top: 10px; font-size: 13px; color: #666;">
              Issued: ${new Date(creditNote.createdAt).toLocaleDateString()}<br/>
              ${creditNote.approvedAt ? `Applied: ${new Date(creditNote.approvedAt).toLocaleDateString()}` : ''}
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Property</h3>
            <p><strong>${property?.name || 'StaySuite Hotel'}</strong></p>
            <p>${property?.address || ''}</p>
            ${property?.phone ? `<p>Tel: ${property.phone}</p>` : ''}
            ${property?.email ? `<p>Email: ${property.email}</p>` : ''}
          </div>
          <div class="info-box">
            <h3>Guest</h3>
            <p><strong>${guest?.firstName || ''} ${guest?.lastName || ''}</strong></p>
            <p>${guest?.email || ''}</p>
            <p>Folio: ${folio.folioNumber}</p>
            <p>Booking: ${folio.booking?.confirmationCode || ''}</p>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <strong>Reason:</strong> ${creditNote.reason.replace(/_/g, ' ').toUpperCase()}<br/>
          ${creditNote.description ? `<strong>Description:</strong> ${creditNote.description}` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th class="amount-cell">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.description}</td>
                <td class="amount-cell">${creditNote.currency} ${item.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="2" class="amount-cell" style="text-align: right;">Total Credit</td>
              <td class="amount-cell">${creditNote.currency} ${creditNote.totalAmount.toFixed(2)}</td>
            </tr>
            ${creditNote.appliedAmount > 0 ? `
              <tr>
                <td colspan="2" class="amount-cell" style="text-align: right; color: #10b981;">Applied Amount</td>
                <td class="amount-cell" style="color: #10b981;">-${creditNote.currency} ${creditNote.appliedAmount.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${creditNote.remainingAmount > 0 ? `
              <tr>
                <td colspan="2" class="amount-cell" style="text-align: right; color: #888;">Remaining</td>
                <td class="amount-cell" style="color: #888;">${creditNote.currency} ${creditNote.remainingAmount.toFixed(2)}</td>
              </tr>
            ` : ''}
          </tfoot>
        </table>

        <div class="footer">
          <p>This credit note was generated by StaySuite HospitalityOS</p>
          <p>${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error generating credit note PDF:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate credit note PDF' } },
      { status: 500 }
    );
  }
}
