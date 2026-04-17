import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/guests/[id]/documents - Get guest documents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const user = await requirePermission(request, 'guests.view');
    if (user instanceof NextResponse) return user;


  try {
    const { id } = await params;
    const tenantId = user.tenantId;

    // Verify guest belongs to tenant
    const guest = await db.guest.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    const documents = await db.guestDocument.findMany({
      where: { guestId: id },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch documents' } },
      { status: 500 }
    );
  }
}

// POST /api/guests/[id]/documents - Upload a document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const user = await requirePermission(request, 'guests.edit');
    if (user instanceof NextResponse) return user;


  try {
    const { id } = await params;
    const tenantId = user.tenantId;
    const body = await request.json();
    
    const { type, name, fileUrl, expiryDate } = body;
    
    if (!type || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Document type and name are required' } },
        { status: 400 }
      );
    }
    
    // Verify guest exists and belongs to tenant
    const guest = await db.guest.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    
    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }
    
    const document = await db.guestDocument.create({
      data: {
        guestId: id,
        type,
        name,
        fileUrl: fileUrl || '',
        status: 'pending',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });
    
    return NextResponse.json({ 
      success: true, 
      data: document 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create document' } },
      { status: 500 }
    );
  }
}

// PUT /api/guests/[id]/documents - Update document status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const user = await requirePermission(request, 'guests.edit');
    if (user instanceof NextResponse) return user;


  try {
    const { id } = await params;
    const tenantId = user.tenantId;
    const body = await request.json();
    const { documentId, status, rejectionReason, verifiedBy } = body;

    // Verify guest belongs to tenant
    const guestCheck = await db.guest.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!guestCheck) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }
    
    if (!documentId || !status) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Document ID and status are required' } },
        { status: 400 }
      );
    }
    
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'verified') {
      updateData.verifiedAt = new Date();
      updateData.verifiedBy = verifiedBy || 'system';
    } else if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason;
    }
    
    const document = await db.guestDocument.update({
      where: { id: documentId, guestId: id },
      data: updateData,
    });
    
    // Update guest KYC status if all documents are verified
    if (status === 'verified') {
      const allDocs = await db.guestDocument.findMany({
        where: { guestId: id },
      });
      const allVerified = allDocs.every(doc => doc.status === 'verified');
      
      if (allVerified) {
        await db.guest.update({
          where: { id },
          data: { 
            kycStatus: 'verified',
            kycVerifiedAt: new Date(),
          },
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: document 
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update document' } },
      { status: 500 }
    );
  }
}

// DELETE /api/guests/[id]/documents - Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const user = await requirePermission(request, 'guests.edit');
    if (user instanceof NextResponse) return user;


  try {
    const { id } = await params;
    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);

    // Verify guest belongs to tenant
    const guestCheck = await db.guest.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!guestCheck) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }
    const documentId = searchParams.get('documentId');
    
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Document ID is required' } },
        { status: 400 }
      );
    }
    
    await db.guestDocument.delete({
      where: { id: documentId, guestId: id },
    });
    
    return NextResponse.json({ 
      success: true, 
      data: { id: documentId } 
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete document' } },
      { status: 500 }
    );
  }
}
