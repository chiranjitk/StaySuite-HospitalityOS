import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/folio/registration-card - Get existing registration card
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookingId = searchParams.get('bookingId');
    const cardId = searchParams.get('cardId');

    if (cardId) {
      const card = await db.registrationCard.findUnique({
        where: { id: cardId },
      });
      if (!card) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Registration card not found' } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: card });
    }

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId or cardId is required' } },
        { status: 400 }
      );
    }

    const card = await db.registrationCard.findFirst({
      where: { bookingId },
    });

    return NextResponse.json({ success: true, data: card });
  } catch (error) {
    console.error('Error fetching registration card:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch registration card' } },
      { status: 500 }
    );
  }
}

// POST /api/folio/registration-card - Generate registration card for a booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, purpose, companions, vehiclePlate } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    // Fetch booking with guest, room, property data
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            nationality: true,
            idType: true,
            idNumber: true,
            address: true,
            city: true,
            state: true,
            country: true,
          },
        },
        room: {
          select: { id: true, number: true, floor: true },
        },
        roomType: {
          select: { id: true, name: true, code: true },
        },
        property: {
          select: { id: true, name: true, address: true, city: true, country: true, phone: true, email: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (!booking.room) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Booking must have a room assigned' } },
        { status: 400 }
      );
    }

    // Check for existing card
    const existingCard = await db.registrationCard.findFirst({
      where: { bookingId },
    });

    // Generate card number: RC-YYYYMMDD-NNN
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todayCards = await db.registrationCard.count({
      where: {
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
    });
    const cardNumber = `RC-${datePrefix}-${String(todayCards + 1).padStart(3, '0')}`;

    const guest = booking.primaryGuest;

    const cardCreateData = {
      tenantId: booking.tenantId,
      propertyId: booking.propertyId,
      bookingId: booking.id,
      guestId: guest.id,
      cardNumber,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      roomNumber: booking.room.number,
      roomType: booking.roomType.name,
      guestName: `${guest.firstName} ${guest.lastName}`,
      guestNationality: guest.nationality,
      guestIdType: guest.idType,
      guestIdNumber: guest.idNumber,
      guestAddress: guest.address
        ? `${guest.address}${guest.city ? ', ' + guest.city : ''}${guest.state ? ', ' + guest.state : ''}${guest.country ? ', ' + guest.country : ''}`
        : null,
      guestPhone: guest.phone,
      guestEmail: guest.email,
      purpose: purpose || null,
      vehiclePlate: vehiclePlate || null,
      companions: JSON.stringify(companions || []),
      specialRequests: booking.specialRequests || null,
      termsAccepted: true,
      acceptedAt: new Date(),
    };

    let card;

    if (existingCard) {
      card = await db.registrationCard.update({
        where: { id: existingCard.id },
        data: cardCreateData,
      });
    } else {
      card = await db.registrationCard.create({
        data: cardCreateData,
      });
    }

    // Generate PDF using jspdf
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const prop = booking.property;
    const margin = 20;
    let y = 20;

    // Header - Hotel name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(prop.name, 105, y, { align: 'center' });
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (prop.address) doc.text(prop.address, 105, y, { align: 'center' });
    y += 4;
    if (prop.city) doc.text(`${prop.city}${prop.country ? ', ' + prop.country : ''}`, 105, y, { align: 'center' });
    y += 4;
    if (prop.phone) doc.text(`Tel: ${prop.phone}`, 105, y, { align: 'center' });
    y += 4;
    if (prop.email) doc.text(`Email: ${prop.email}`, 105, y, { align: 'center' });
    y += 10;

    // Registration Card Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('REGISTRATION CARD', 105, y, { align: 'center' });
    y += 4;

    // Card number and date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Card No: ${card.cardNumber}`, margin, y);
    doc.text(`Date: ${now.toLocaleDateString()}`, 190 - margin, y, { align: 'right' });
    y += 10;

    // Line separator
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, 190 - margin, y);
    y += 8;

    // Guest details section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Guest Information', margin, y);
    y += 6;

    const addField = (label: string, value: string | null | undefined) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(label + ':', margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '-', margin + 50, y);
      y += 5;
    };

    addField('Guest Name', card.guestName);
    addField('Nationality', card.guestNationality);
    addField('ID Type', card.guestIdType);
    addField('ID Number', card.guestIdNumber);
    addField('Address', card.guestAddress);
    addField('Phone', card.guestPhone);
    addField('Email', card.guestEmail);
    y += 2;

    // Stay details section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Stay Details', margin, y);
    y += 6;

    addField('Room No.', card.roomNumber);
    addField('Room Type', card.roomType);
    addField('Check-in', new Date(card.checkInDate).toLocaleDateString());
    addField('Check-out', new Date(card.checkOutDate).toLocaleDateString());

    const nights = Math.ceil(
      (new Date(card.checkOutDate).getTime() - new Date(card.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    addField('Duration', `${nights} night${nights !== 1 ? 's' : ''}`);

    addField('Purpose of Visit', card.purpose);
    addField('Vehicle Plate', card.vehiclePlate);
    y += 2;

    // Companions
    const companionsParsed = JSON.parse(card.companions as string) as Array<{ name: string; idType?: string; idNumber?: string; nationality?: string }>;
    if (companionsParsed && companionsParsed.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Accompanying Guests', margin, y);
      y += 6;

      companionsParsed.forEach((comp, i) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${i + 1}. ${comp.name}${comp.nationality ? ' (' + comp.nationality + ')' : ''}${comp.idNumber ? ' - ID: ' + comp.idNumber : ''}`, margin + 4, y);
        y += 5;
      });
      y += 2;
    }

    // Special requests
    if (card.specialRequests) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Special Requests', margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const reqLines = doc.splitTextToSize(card.specialRequests as string, 150);
      doc.text(reqLines, margin + 4, y);
      y += reqLines.length * 5 + 2;
    }

    // Terms & conditions section
    y = Math.max(y + 8, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const terms = [
      '1. Check-in time is from 14:00 and check-out time is 11:00.',
      '2. Guests are responsible for any damage to hotel property during their stay.',
      '3. All visitors must register at the front desk.',
      '4. The hotel is not responsible for loss or theft of personal belongings.',
      '5. Smoking is only permitted in designated areas.',
      '6. Pets are not allowed unless prior arrangements have been made.',
    ];
    terms.forEach(t => {
      doc.text(t, margin, y);
      y += 4;
    });
    y += 4;

    // Signature lines
    doc.setFontSize(9);
    doc.text('Guest Signature: ___________________________', margin, y);
    doc.text('Authorized Signature: ___________________________', 110, y);
    y += 15;
    doc.setFontSize(8);
    doc.text('Date: _______________', margin, y);
    doc.text('Date: _______________', 110, y);

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`Generated by StaySuite-HospitalityOS | ${card.cardNumber}`, 105, 285, { align: 'center' });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="registration-card-${card.cardNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating registration card:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate registration card' } },
      { status: 500 }
    );
  }
}
