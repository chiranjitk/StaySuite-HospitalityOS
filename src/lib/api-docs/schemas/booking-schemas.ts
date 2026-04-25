/**
 * Booking API Schemas for OpenAPI Documentation
 */

export const bookingSchemas = {
  // Booking Object
  Booking: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'booking-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      propertyId: {
        type: 'string',
        example: 'property-1',
      },
      confirmationCode: {
        type: 'string',
        example: 'SS-ABC123',
      },
      externalRef: {
        type: 'string',
        nullable: true,
        description: 'External reference from OTA',
        example: 'BKNG-12345',
      },
      primaryGuestId: {
        type: 'string',
        example: 'guest-1',
      },
      roomId: {
        type: 'string',
        nullable: true,
        example: 'room-101',
      },
      roomTypeId: {
        type: 'string',
        example: 'roomtype-1',
      },
      checkIn: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T14:00:00.000Z',
      },
      checkOut: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-18T11:00:00.000Z',
      },
      adults: {
        type: 'integer',
        example: 2,
      },
      children: {
        type: 'integer',
        example: 1,
      },
      infants: {
        type: 'integer',
        example: 0,
      },
      roomRate: {
        type: 'number',
        example: 150.00,
      },
      taxes: {
        type: 'number',
        example: 27.00,
      },
      fees: {
        type: 'number',
        example: 15.00,
      },
      discount: {
        type: 'number',
        example: 0,
      },
      totalAmount: {
        type: 'number',
        example: 192.00,
      },
      currency: {
        type: 'string',
        example: 'USD',
      },
      ratePlanId: {
        type: 'string',
        nullable: true,
        example: 'rateplan-1',
      },
      promoCode: {
        type: 'string',
        nullable: true,
        example: 'SUMMER20',
      },
      source: {
        type: 'string',
        enum: ['direct', 'booking_com', 'airbnb', 'expedia', 'walk_in'],
        example: 'direct',
      },
      channelId: {
        type: 'string',
        nullable: true,
      },
      status: {
        type: 'string',
        enum: ['draft', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
        example: 'confirmed',
      },
      actualCheckIn: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      actualCheckOut: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      specialRequests: {
        type: 'string',
        nullable: true,
        example: 'Late check-in around 10 PM',
      },
      notes: {
        type: 'string',
        nullable: true,
      },
      internalNotes: {
        type: 'string',
        nullable: true,
      },
      groupId: {
        type: 'string',
        nullable: true,
        description: 'Group booking ID',
      },
      isGroupLeader: {
        type: 'boolean',
        example: false,
      },
      preArrivalSent: {
        type: 'boolean',
        example: false,
      },
      preArrivalCompleted: {
        type: 'boolean',
        example: false,
      },
      kycRequired: {
        type: 'boolean',
        example: false,
      },
      kycCompleted: {
        type: 'boolean',
        example: false,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
      primaryGuest: {
        $ref: '#/components/schemas/GuestSummary',
      },
      room: {
        $ref: '#/components/schemas/RoomSummary',
      },
      roomType: {
        $ref: '#/components/schemas/RoomTypeSummary',
      },
    },
  },

  // Guest Summary
  GuestSummary: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'guest-1',
      },
      firstName: {
        type: 'string',
        example: 'John',
      },
      lastName: {
        type: 'string',
        example: 'Doe',
      },
      email: {
        type: 'string',
        format: 'email',
        example: 'john.doe@example.com',
      },
      phone: {
        type: 'string',
        nullable: true,
        example: '+1234567890',
      },
      isVip: {
        type: 'boolean',
        example: false,
      },
    },
  },

  // Room Summary
  RoomSummary: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'room-101',
      },
      number: {
        type: 'string',
        example: '101',
      },
      floor: {
        type: 'integer',
        example: 1,
      },
      roomTypeId: {
        type: 'string',
        example: 'roomtype-1',
      },
    },
  },

  // Room Type Summary
  RoomTypeSummary: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'roomtype-1',
      },
      name: {
        type: 'string',
        example: 'Deluxe King',
      },
      code: {
        type: 'string',
        example: 'DLXK',
      },
      basePrice: {
        type: 'number',
        example: 150.00,
      },
    },
  },

  // Create Booking Request
  CreateBookingRequest: {
    type: 'object',
    required: ['propertyId', 'primaryGuestId', 'roomTypeId', 'checkIn', 'checkOut'],
    properties: {
      tenantId: {
        type: 'string',
        example: 'tenant-1',
        default: 'tenant-1',
      },
      propertyId: {
        type: 'string',
        example: 'property-1',
      },
      primaryGuestId: {
        type: 'string',
        example: 'guest-1',
      },
      roomId: {
        type: 'string',
        nullable: true,
        example: 'room-101',
      },
      roomTypeId: {
        type: 'string',
        example: 'roomtype-1',
      },
      checkIn: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T14:00:00.000Z',
      },
      checkOut: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-18T11:00:00.000Z',
      },
      adults: {
        type: 'integer',
        default: 1,
        example: 2,
      },
      children: {
        type: 'integer',
        default: 0,
        example: 1,
      },
      infants: {
        type: 'integer',
        default: 0,
        example: 0,
      },
      roomRate: {
        type: 'number',
        default: 0,
        example: 150.00,
      },
      taxes: {
        type: 'number',
        default: 0,
        example: 27.00,
      },
      fees: {
        type: 'number',
        default: 0,
        example: 15.00,
      },
      discount: {
        type: 'number',
        default: 0,
        example: 0,
      },
      totalAmount: {
        type: 'number',
        default: 0,
        example: 192.00,
      },
      currency: {
        type: 'string',
        default: 'USD',
        example: 'USD',
      },
      ratePlanId: {
        type: 'string',
        nullable: true,
      },
      promoCode: {
        type: 'string',
        nullable: true,
        example: 'SUMMER20',
      },
      source: {
        type: 'string',
        enum: ['direct', 'booking_com', 'airbnb', 'expedia', 'walk_in'],
        default: 'direct',
        example: 'direct',
      },
      channelId: {
        type: 'string',
        nullable: true,
      },
      status: {
        type: 'string',
        enum: ['draft', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
        default: 'confirmed',
        example: 'confirmed',
      },
      specialRequests: {
        type: 'string',
        nullable: true,
        example: 'Late check-in around 10 PM',
      },
      notes: {
        type: 'string',
        nullable: true,
      },
      internalNotes: {
        type: 'string',
        nullable: true,
      },
      groupId: {
        type: 'string',
        nullable: true,
      },
      isGroupLeader: {
        type: 'boolean',
        default: false,
      },
      idempotencyKey: {
        type: 'string',
        description: 'Unique key to prevent duplicate bookings',
        example: 'idem-abc123',
      },
      lockSessionId: {
        type: 'string',
        description: 'Session ID from inventory lock',
        nullable: true,
      },
      skipLockCheck: {
        type: 'boolean',
        default: false,
        description: 'Skip lock check for internal operations',
      },
    },
  },

  // Update Booking Request
  UpdateBookingRequest: {
    type: 'object',
    properties: {
      roomId: {
        type: 'string',
        nullable: true,
        example: 'room-102',
      },
      status: {
        type: 'string',
        enum: ['draft', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
        example: 'checked_in',
      },
      adults: {
        type: 'integer',
        example: 2,
      },
      children: {
        type: 'integer',
        example: 1,
      },
      specialRequests: {
        type: 'string',
        nullable: true,
      },
      notes: {
        type: 'string',
        nullable: true,
      },
      internalNotes: {
        type: 'string',
        nullable: true,
      },
    },
  },

  // Booking List Response
  BookingListResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Booking',
        },
      },
      pagination: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
            example: 100,
          },
          limit: {
            type: 'integer',
            nullable: true,
            example: 20,
          },
          offset: {
            type: 'integer',
            nullable: true,
            example: 0,
          },
        },
      },
    },
  },

  // Booking Conflict Response
  BookingConflict: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'conflict-1',
      },
      type: {
        type: 'string',
        enum: ['double_booking', 'maintenance', 'lock_conflict'],
        example: 'double_booking',
      },
      roomId: {
        type: 'string',
        example: 'room-101',
      },
      roomNumber: {
        type: 'string',
        example: '101',
      },
      conflictingBookings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            confirmationCode: {
              type: 'string',
            },
            checkIn: {
              type: 'string',
              format: 'date-time',
            },
            checkOut: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
      dateRange: {
        type: 'object',
        properties: {
          start: {
            type: 'string',
            format: 'date-time',
          },
          end: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },

  // Booking Audit Log
  BookingAuditLog: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'log-1',
      },
      bookingId: {
        type: 'string',
        example: 'booking-1',
      },
      action: {
        type: 'string',
        enum: ['created', 'updated', 'checked_in', 'checked_out', 'cancelled', 'room_changed'],
        example: 'checked_in',
      },
      previousStatus: {
        type: 'string',
        nullable: true,
      },
      newStatus: {
        type: 'string',
        nullable: true,
      },
      notes: {
        type: 'string',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },
};

export const bookingParameters = {
  status: {
    name: 'status',
    in: 'query',
    description: 'Filter by booking status',
    schema: {
      type: 'string',
      enum: ['draft', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
    },
  },
  propertyId: {
    name: 'propertyId',
    in: 'query',
    description: 'Filter by property ID',
    schema: {
      type: 'string',
    },
  },
  guestId: {
    name: 'guestId',
    in: 'query',
    description: 'Filter by guest ID',
    schema: {
      type: 'string',
    },
  },
  checkInFrom: {
    name: 'checkInFrom',
    in: 'query',
    description: 'Filter bookings with check-in from this date',
    schema: {
      type: 'string',
      format: 'date',
    },
  },
  checkInTo: {
    name: 'checkInTo',
    in: 'query',
    description: 'Filter bookings with check-in until this date',
    schema: {
      type: 'string',
      format: 'date',
    },
  },
  search: {
    name: 'search',
    in: 'query',
    description: 'Search by confirmation code or guest name',
    schema: {
      type: 'string',
    },
  },
  limit: {
    name: 'limit',
    in: 'query',
    description: 'Maximum number of results',
    schema: {
      type: 'integer',
      default: 20,
    },
  },
  offset: {
    name: 'offset',
    in: 'query',
    description: 'Number of results to skip',
    schema: {
      type: 'integer',
      default: 0,
    },
  },
};
