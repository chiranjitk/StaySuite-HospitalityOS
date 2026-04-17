/**
 * Billing API Schemas for OpenAPI Documentation
 */

export const billingSchemas = {
  // Folio Object
  Folio: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'folio-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      propertyId: {
        type: 'string',
        example: 'property-1',
      },
      bookingId: {
        type: 'string',
        example: 'booking-1',
      },
      folioNumber: {
        type: 'string',
        example: 'FOL-ABC123-XYZ',
      },
      guestId: {
        type: 'string',
        example: 'guest-1',
      },
      subtotal: {
        type: 'number',
        example: 450.00,
      },
      taxes: {
        type: 'number',
        example: 81.00,
      },
      discount: {
        type: 'number',
        example: 0,
      },
      totalAmount: {
        type: 'number',
        example: 531.00,
      },
      paidAmount: {
        type: 'number',
        example: 531.00,
      },
      balance: {
        type: 'number',
        example: 0,
      },
      currency: {
        type: 'string',
        example: 'USD',
      },
      status: {
        type: 'string',
        enum: ['open', 'closed', 'partially_paid', 'paid'],
        example: 'paid',
      },
      openedAt: {
        type: 'string',
        format: 'date-time',
      },
      closedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      invoiceNumber: {
        type: 'string',
        nullable: true,
        example: 'INV-2024-001',
      },
      invoiceUrl: {
        type: 'string',
        nullable: true,
      },
      invoiceIssuedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      booking: {
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
          primaryGuest: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      },
      lineItems: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/FolioLineItem',
        },
      },
      payments: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Payment',
        },
      },
    },
  },

  // Folio Line Item
  FolioLineItem: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'item-1',
      },
      folioId: {
        type: 'string',
        example: 'folio-1',
      },
      description: {
        type: 'string',
        example: 'Room Charge - Deluxe King',
      },
      category: {
        type: 'string',
        enum: ['room', 'food', 'beverage', 'service', 'tax', 'discount'],
        example: 'room',
      },
      quantity: {
        type: 'integer',
        example: 3,
      },
      unitPrice: {
        type: 'number',
        example: 150.00,
      },
      totalAmount: {
        type: 'number',
        example: 450.00,
      },
      serviceDate: {
        type: 'string',
        format: 'date-time',
      },
      referenceType: {
        type: 'string',
        enum: ['order', 'booking', 'service'],
        nullable: true,
      },
      referenceId: {
        type: 'string',
        nullable: true,
      },
      taxRate: {
        type: 'number',
        example: 18,
      },
      taxAmount: {
        type: 'number',
        example: 81.00,
      },
      postedBy: {
        type: 'string',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  // Payment Object
  Payment: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'payment-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      folioId: {
        type: 'string',
        example: 'folio-1',
      },
      amount: {
        type: 'number',
        example: 531.00,
      },
      currency: {
        type: 'string',
        example: 'USD',
      },
      method: {
        type: 'string',
        enum: ['card', 'cash', 'bank_transfer', 'wallet', 'check'],
        example: 'card',
      },
      gateway: {
        type: 'string',
        nullable: true,
        example: 'stripe',
      },
      cardType: {
        type: 'string',
        nullable: true,
        example: 'visa',
      },
      cardLast4: {
        type: 'string',
        nullable: true,
        example: '4242',
      },
      cardExpiry: {
        type: 'string',
        nullable: true,
        example: '12/25',
      },
      transactionId: {
        type: 'string',
        nullable: true,
        example: 'txn_abc123',
      },
      reference: {
        type: 'string',
        nullable: true,
      },
      status: {
        type: 'string',
        enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
        example: 'completed',
      },
      refundAmount: {
        type: 'number',
        example: 0,
      },
      refundedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      refundReason: {
        type: 'string',
        nullable: true,
      },
      guestId: {
        type: 'string',
        nullable: true,
      },
      processedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  // Create Folio Request
  CreateFolioRequest: {
    type: 'object',
    required: ['propertyId', 'bookingId', 'guestId'],
    properties: {
      tenantId: {
        type: 'string',
        default: 'tenant-1',
      },
      propertyId: {
        type: 'string',
        example: 'property-1',
      },
      bookingId: {
        type: 'string',
        example: 'booking-1',
      },
      guestId: {
        type: 'string',
        example: 'guest-1',
      },
      currency: {
        type: 'string',
        default: 'USD',
        example: 'USD',
      },
    },
  },

  // Add Line Item Request
  AddLineItemRequest: {
    type: 'object',
    required: ['description', 'category', 'quantity', 'unitPrice'],
    properties: {
      description: {
        type: 'string',
        example: 'Room Service - Dinner',
      },
      category: {
        type: 'string',
        enum: ['room', 'food', 'beverage', 'service', 'tax', 'discount'],
        example: 'food',
      },
      quantity: {
        type: 'integer',
        example: 1,
      },
      unitPrice: {
        type: 'number',
        example: 45.00,
      },
      serviceDate: {
        type: 'string',
        format: 'date-time',
      },
      referenceType: {
        type: 'string',
        enum: ['order', 'booking', 'service'],
        nullable: true,
      },
      referenceId: {
        type: 'string',
        nullable: true,
      },
      taxRate: {
        type: 'number',
        default: 0,
      },
      notes: {
        type: 'string',
        nullable: true,
      },
    },
  },

  // Create Payment Request
  CreatePaymentRequest: {
    type: 'object',
    required: ['folioId', 'amount', 'method'],
    properties: {
      tenantId: {
        type: 'string',
        default: 'tenant-1',
      },
      folioId: {
        type: 'string',
        example: 'folio-1',
      },
      amount: {
        type: 'number',
        example: 531.00,
      },
      currency: {
        type: 'string',
        default: 'USD',
      },
      method: {
        type: 'string',
        enum: ['card', 'cash', 'bank_transfer', 'wallet', 'check'],
        example: 'card',
      },
      gateway: {
        type: 'string',
        nullable: true,
      },
      cardType: {
        type: 'string',
        nullable: true,
      },
      cardLast4: {
        type: 'string',
        nullable: true,
      },
      transactionId: {
        type: 'string',
        nullable: true,
      },
      reference: {
        type: 'string',
        nullable: true,
      },
      guestId: {
        type: 'string',
        nullable: true,
      },
    },
  },

  // Invoice Object
  Invoice: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'invoice-1',
      },
      folioId: {
        type: 'string',
        example: 'folio-1',
      },
      invoiceNumber: {
        type: 'string',
        example: 'INV-2024-001',
      },
      issuedAt: {
        type: 'string',
        format: 'date-time',
      },
      dueDate: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      pdfUrl: {
        type: 'string',
        nullable: true,
      },
      status: {
        type: 'string',
        enum: ['draft', 'issued', 'paid', 'cancelled'],
        example: 'issued',
      },
    },
  },

  // Folio List Response
  FolioListResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Folio',
        },
      },
      pagination: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
          },
          limit: {
            type: 'integer',
            nullable: true,
          },
          offset: {
            type: 'integer',
            nullable: true,
          },
        },
      },
    },
  },
};

export const billingParameters = {
  tenantId: {
    name: 'tenantId',
    in: 'query',
    description: 'Filter by tenant ID',
    schema: {
      type: 'string',
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
  bookingId: {
    name: 'bookingId',
    in: 'query',
    description: 'Filter by booking ID',
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
  status: {
    name: 'status',
    in: 'query',
    description: 'Filter by folio status',
    schema: {
      type: 'string',
      enum: ['open', 'closed', 'partially_paid', 'paid'],
    },
  },
  search: {
    name: 'search',
    in: 'query',
    description: 'Search by folio number or invoice number',
    schema: {
      type: 'string',
    },
  },
};
