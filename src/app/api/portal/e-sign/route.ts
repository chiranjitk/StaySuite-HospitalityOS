import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST: Save e-signature
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, signature, agreedToTerms, termsVersion } = body;

    if (!token || !signature) {
      return NextResponse.json(
        { success: false, error: { message: 'Token and signature are required' } },
        { status: 400 }
      );
    }

    if (!agreedToTerms) {
      return NextResponse.json(
        { success: false, error: { message: 'You must agree to the terms and conditions' } },
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

    // Update booking with e-signature
    const updatedBooking = await db.booking.update({
      where: { id: booking.id },
      data: {
        eSignature: signature,
        eSignedAt: new Date(),
        // Store terms version in internalNotes for audit
        internalNotes: booking.internalNotes
          ? `${booking.internalNotes}\nTerms agreed: ${termsVersion || 'v1.0'} at ${new Date().toISOString()}`
          : `Terms agreed: ${termsVersion || 'v1.0'} at ${new Date().toISOString()}`,
      },
    });

    // Create audit log
    await db.bookingAuditLog.create({
      data: {
        bookingId: booking.id,
        action: 'e_signature_completed',
        notes: `Guest signed terms and conditions (version: ${termsVersion || 'v1.0'})`,
        performedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        signedAt: updatedBooking.eSignedAt,
        message: 'Signature saved successfully',
      },
    });
  } catch (error) {
    console.error('Error saving e-signature:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to save signature' } },
      { status: 500 }
    );
  }
}

// GET: Get terms and conditions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { message: 'Token is required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        deletedAt: null,
      },
      include: {
        roomType: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid or expired token' } },
        { status: 404 }
      );
    }

    // Return terms and conditions based on property
    const property = booking.roomType?.property;
    
    const terms = {
      version: '1.0',
      lastUpdated: '2024-01-01',
      property: {
        name: property?.name || 'Our Hotel',
        address: property?.address || '',
        city: property?.city || '',
      },
      sections: [
        {
          title: 'Reservation Terms',
          content: `By completing this check-in process, you agree to the following terms and conditions for your stay at ${property?.name || 'our property'}.

1. CHECK-IN AND CHECK-OUT
   - Check-in time: ${property?.checkInTime || '14:00'}
   - Check-out time: ${property?.checkOutTime || '11:00'}
   - Early check-in or late check-out may be available upon request and subject to additional charges.

2. GUEST RESPONSIBILITIES
   - Valid government-issued identification is required at check-in.
   - Guests must be at least 18 years of age to check in.
   - The guest named on the reservation must be present at check-in.

3. PAYMENT
   - A valid credit card is required for all reservations.
   - The hotel reserves the right to pre-authorize your credit card prior to arrival.
   - Additional charges may apply for room service, minibar, damages, or other hotel services.

4. CANCELLATION POLICY
   - Cancellations must be made at least 48 hours before the scheduled arrival date.
   - Late cancellations or no-shows may result in a charge equivalent to one night's stay.

5. PROPERTY RULES
   - No smoking in guest rooms or non-designated areas.
   - No pets allowed unless pre-arranged with the property.
   - Noise must be kept to a minimum between 10:00 PM and 8:00 AM.
   - Guests are responsible for any damages caused to hotel property.

6. LIABILITY
   - The hotel is not responsible for loss or damage to personal belongings.
   - Valuables should be stored in the room safe or at the front desk.

7. DIGITAL KEY USAGE
   - Digital key access is provided for convenience.
   - Sharing digital key access with non-registered guests is prohibited.
   - Report any technical issues immediately to the front desk.`,
        },
      ],
      signatureStatus: {
        hasSigned: !!booking.eSignedAt,
        signedAt: booking.eSignedAt,
      },
    };

    return NextResponse.json({
      success: true,
      data: terms,
    });
  } catch (error) {
    console.error('Error fetching terms:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch terms' } },
      { status: 500 }
    );
  }
}
