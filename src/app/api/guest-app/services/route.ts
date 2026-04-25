import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/guest-app/services - Get available services for guest
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const category = searchParams.get('category');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Token is required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token to get property
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: { in: ['confirmed', 'checked_in'] },
      },
      select: {
        id: true,
        propertyId: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid token' } },
        { status: 404 }
      );
    }

    // Get menu items as services (room service, spa, etc.)
    const menuCategories = await db.orderCategory.findMany({
      where: {
        propertyId: booking.propertyId,
        status: 'active',
      },
      include: {
        menuItems: {
          where: {
            isAvailable: true,
            status: 'active',
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Transform into service catalog format
    const services = menuCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      imageUrl: cat.imageUrl,
      items: cat.menuItems.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        currency: item.currency,
        imageUrl: item.imageUrl,
        preparationTime: item.preparationTime,
        dietary: {
          isVegetarian: item.isVegetarian,
          isVegan: item.isVegan,
          isGlutenFree: item.isGlutenFree,
        },
      })),
    }));

    // Filter by category if provided
    const filteredServices = category
      ? services.filter(s => s.name.toLowerCase().includes(category.toLowerCase()))
      : services;

    // Get existing service requests for this booking
    const existingRequests = await db.serviceRequest.findMany({
      where: {
        bookingId: booking.id,
        status: { in: ['pending', 'assigned', 'in_progress'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        categories: filteredServices,
        existingRequests: existingRequests.map(req => ({
          id: req.id,
          type: req.type,
          subject: req.subject,
          description: req.description,
          status: req.status,
          priority: req.priority,
          createdAt: req.createdAt,
          startedAt: req.startedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch services' } },
      { status: 500 }
    );
  }
}

// POST /api/guest-app/services - Create a service request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, type, subject, description, priority, menuItemId, quantity, specialRequests } = body;

    if (!token || !type || !subject) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Token, type, and subject are required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: { in: ['confirmed', 'checked_in'] },
      },
      include: {
        room: true,
        primaryGuest: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid token' } },
        { status: 404 }
      );
    }

    // Get menu item if provided
     
    let menuItem: any = null;
    if (menuItemId) {
      menuItem = await db.menuItem.findUnique({
        where: { id: menuItemId },
      });
    }

    // Create service request
    const serviceRequest = await db.serviceRequest.create({
      data: {
        tenantId: booking.tenantId,
        propertyId: booking.propertyId,
        bookingId: booking.id,
        guestId: booking.primaryGuestId,
        roomId: booking.roomId,
        type,
        category: menuItem?.name || type,
        subject,
        description: description || (menuItem ? `${quantity || 1}x ${menuItem.name}${specialRequests ? ` - ${specialRequests}` : ''}` : undefined),
        priority: priority || 'medium',
        status: 'pending',
        source: 'guest_app',
      },
    });

    // Create folio line item if it's a paid service
    if (menuItem && menuItem.price > 0) {
      // Get or create folio
      let folio = await db.folio.findFirst({
        where: {
          bookingId: booking.id,
          status: { in: ['open', 'partially_paid'] },
        },
      });

      if (!folio) {
        folio = await db.folio.create({
          data: {
            tenantId: booking.tenantId,
            propertyId: booking.propertyId,
            bookingId: booking.id,
            folioNumber: `FOL-${booking.confirmationCode}`,
            guestId: booking.primaryGuestId,
            currency: 'USD',
          },
        });
      }

      // Create line item
      const qty = quantity || 1;
      await db.folioLineItem.create({
        data: {
          folioId: folio.id,
          description: `${menuItem.name} x${qty}`,
          category: 'food_beverage',
          quantity: qty,
          unitPrice: menuItem.price,
          totalAmount: menuItem.price * qty,
          serviceDate: new Date(),
          referenceType: 'service_request',
          referenceId: serviceRequest.id,
        },
      });

      // Update folio totals
      await db.folio.update({
        where: { id: folio.id },
        data: {
          subtotal: { increment: menuItem.price * qty },
          totalAmount: { increment: menuItem.price * qty },
          balance: { increment: menuItem.price * qty },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: serviceRequest.id,
        type: serviceRequest.type,
        subject: serviceRequest.subject,
        status: serviceRequest.status,
        createdAt: serviceRequest.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating service request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create service request' } },
      { status: 500 }
    );
  }
}
