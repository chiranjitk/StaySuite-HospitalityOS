import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST: Upload KYC document
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, type, name, fileUrl, expiryDate } = body;

    if (!token || !type || !name || !fileUrl) {
      return NextResponse.json(
        { success: false, error: { message: 'Token, type, name, and fileUrl are required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        deletedAt: null,
      },
      include: { primaryGuest: true },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid or expired token' } },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (booking.portalTokenExpires && new Date() > booking.portalTokenExpires) {
      return NextResponse.json(
        { success: false, error: { message: 'Portal link has expired' } },
        { status: 410 }
      );
    }

    // Create document for the guest
    const document = await db.guestDocument.create({
      data: {
        guestId: booking.primaryGuestId,
        type,
        name,
        fileUrl,
        status: 'pending',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: document.id,
        type: document.type,
        name: document.name,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    console.error('Error uploading KYC document:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to upload document' } },
      { status: 500 }
    );
  }
}

// PUT: Update guest details
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, guestData } = body;

    if (!token || !guestData) {
      return NextResponse.json(
        { success: false, error: { message: 'Token and guestData are required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        deletedAt: null,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid or expired token' } },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (booking.portalTokenExpires && new Date() > booking.portalTokenExpires) {
      return NextResponse.json(
        { success: false, error: { message: 'Portal link has expired' } },
        { status: 410 }
      );
    }

    // Prepare guest update data
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      'firstName', 'lastName', 'email', 'phone', 'alternatePhone',
      'nationality', 'dateOfBirth', 'gender', 'idType', 'idNumber',
      'idExpiry', 'idCountry', 'address', 'city', 'state', 'country',
      'postalCode', 'dietaryRequirements', 'specialRequests',
    ];

    for (const field of allowedFields) {
      if (guestData[field] !== undefined) {
        if (field === 'dateOfBirth' || field === 'idExpiry') {
          updateData[field] = guestData[field] ? new Date(guestData[field]) : null;
        } else {
          updateData[field] = guestData[field];
        }
      }
    }

    // Update guest
    const updatedGuest = await db.guest.update({
      where: { id: booking.primaryGuestId },
      data: updateData,
    });

    // Update booking pre-arrival status if essential details are complete
    if (updatedGuest.email && updatedGuest.phone) {
      await db.booking.update({
        where: { id: booking.id },
        data: { preArrivalCompleted: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedGuest.id,
        firstName: updatedGuest.firstName,
        lastName: updatedGuest.lastName,
        email: updatedGuest.email,
        phone: updatedGuest.phone,
        nationality: updatedGuest.nationality,
        dateOfBirth: updatedGuest.dateOfBirth,
        gender: updatedGuest.gender,
        idType: updatedGuest.idType,
        idNumber: updatedGuest.idNumber,
        address: updatedGuest.address,
        city: updatedGuest.city,
        country: updatedGuest.country,
        postalCode: updatedGuest.postalCode,
      },
    });
  } catch (error) {
    console.error('Error updating guest details:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update guest details' } },
      { status: 500 }
    );
  }
}
