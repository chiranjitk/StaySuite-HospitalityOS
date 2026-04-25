import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/properties/[id]/tax-settings - Get property tax settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'settings.manage');
    if (user instanceof NextResponse) return user;

    


  try {
    const { id } = await params;
    
    const property = await db.property.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        taxId: true,
        taxType: true,
        defaultTaxRate: true,
        taxComponents: true,
        serviceChargePercent: true,
        includeTaxInPrice: true,
        currency: true,
      },
    });
    
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }
    
    // Parse tax components
    let taxComponents = [];
    if (property.taxComponents) {
      try {
        taxComponents = JSON.parse(property.taxComponents);
      } catch {
        taxComponents = [];
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...property,
        taxComponents,
      },
    });
  } catch (error) {
    console.error('Error fetching tax settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tax settings' } },
      { status: 500 }
    );
  }
}

// PUT /api/properties/[id]/tax-settings - Update property tax settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'settings.manage');
    if (user instanceof NextResponse) return user;

    


  try {
    const { id } = await params;
    const body = await request.json();
    
    const existingProperty = await db.property.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        taxId: true,
        taxType: true,
        defaultTaxRate: true,
        taxComponents: true,
        serviceChargePercent: true,
        includeTaxInPrice: true,
      },
    });
    
    if (!existingProperty) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }
    
    const {
      taxId,
      taxType,
      defaultTaxRate,
      taxComponents,
      serviceChargePercent,
      includeTaxInPrice,
    } = body;
    
    const oldValue = {
      taxId: existingProperty.taxId,
      taxType: existingProperty.taxType,
      defaultTaxRate: existingProperty.defaultTaxRate,
      taxComponents: existingProperty.taxComponents,
      serviceChargePercent: existingProperty.serviceChargePercent,
      includeTaxInPrice: existingProperty.includeTaxInPrice,
    };
    
    const property = await db.property.update({
      where: { id },
      data: {
        ...(taxId !== undefined && { taxId }),
        ...(taxType !== undefined && { taxType }),
        ...(defaultTaxRate !== undefined && { defaultTaxRate: parseFloat(defaultTaxRate) || 0 }),
        ...(taxComponents !== undefined && { taxComponents: JSON.stringify(taxComponents) }),
        ...(serviceChargePercent !== undefined && { serviceChargePercent: parseFloat(serviceChargePercent) || 0 }),
        ...(includeTaxInPrice !== undefined && { includeTaxInPrice }),
      },
      select: {
        id: true,
        name: true,
        taxId: true,
        taxType: true,
        defaultTaxRate: true,
        taxComponents: true,
        serviceChargePercent: true,
        includeTaxInPrice: true,
        currency: true,
      },
    });
    
    // Parse tax components for response
    let parsedTaxComponents = [];
    if (property.taxComponents) {
      try {
        parsedTaxComponents = JSON.parse(property.taxComponents);
      } catch {
        parsedTaxComponents = [];
      }
    }
    
    // Log audit
    try {
      await logAudit(request, 'update', 'property', 'property', id, oldValue, {
        taxId: property.taxId,
        taxType: property.taxType,
        defaultTaxRate: property.defaultTaxRate,
        taxComponents: property.taxComponents,
        serviceChargePercent: property.serviceChargePercent,
        includeTaxInPrice: property.includeTaxInPrice,
      }, { tenantId: user.tenantId, userId: user.userId });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...property,
        taxComponents: parsedTaxComponents,
      },
    });
  } catch (error) {
    console.error('Error updating tax settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update tax settings' } },
      { status: 500 }
    );
  }
}
