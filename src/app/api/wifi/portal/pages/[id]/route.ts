import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// PUT /api/wifi/portal/pages/[id] - Update portal page design
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await db.portalPage.findUnique({
      where: { id },
    });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Portal page not found' } },
        { status: 404 }
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.subtitle !== undefined) updatePayload.subtitle = body.subtitle;
    if (body.logoUrl !== undefined) updatePayload.logoUrl = body.logoUrl;
    if (body.backgroundImage !== undefined) updatePayload.backgroundImage = body.backgroundImage;
    if (body.backgroundImageUrl !== undefined) updatePayload.backgroundImage = body.backgroundImageUrl;
    if (body.backgroundColor !== undefined) updatePayload.backgroundColor = body.backgroundColor;
    if (body.textColor !== undefined) updatePayload.textColor = body.textColor;
    if (body.accentColor !== undefined) updatePayload.accentColor = body.accentColor;
    if (body.brandColor !== undefined) updatePayload.accentColor = body.brandColor;
    if (body.termsText !== undefined) updatePayload.termsText = body.termsText;
    if (body.termsUrl !== undefined) updatePayload.termsUrl = body.termsUrl;
    if (body.customCss !== undefined) updatePayload.customCss = body.customCss;
    if (body.customCSS !== undefined) updatePayload.customCss = body.customCSS;
    if (body.customHtml !== undefined) updatePayload.customHtml = body.customHtml;
    if (body.customHTML !== undefined) updatePayload.customHtml = body.customHTML;
    if (body.showSocial !== undefined) updatePayload.showSocial = body.showSocial;
    if (body.showBranding !== undefined) updatePayload.showBranding = body.showBranding;
    if (body.formFields !== undefined) updatePayload.formFields = typeof body.formFields === 'string' ? body.formFields : JSON.stringify(body.formFields);
    if (body.authFlow !== undefined) updatePayload.authFlow = body.authFlow;
    if (body.socialProviders !== undefined) updatePayload.socialProviders = typeof body.socialProviders === 'string' ? body.socialProviders : JSON.stringify(body.socialProviders);
    if (body.socialLogin !== undefined) updatePayload.socialProviders = JSON.stringify(body.socialLogin);
    if (body.voucherTemplate !== undefined) updatePayload.voucherTemplate = body.voucherTemplate;
    if (body.designSettings !== undefined) updatePayload.designSettings = typeof body.designSettings === 'string' ? body.designSettings : JSON.stringify(body.designSettings);

    const updated = await db.portalPage.update({
      where: { id },
      data: updatePayload,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating portal page:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update portal page' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/portal/pages/[id] - Delete portal page design
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.portalPage.findUnique({
      where: { id },
    });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Portal page not found' } },
        { status: 404 }
      );
    }

    await db.portalPage.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Portal page deleted' });
  } catch (error) {
    console.error('Error deleting portal page:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete portal page' } },
      { status: 500 }
    );
  }
}
