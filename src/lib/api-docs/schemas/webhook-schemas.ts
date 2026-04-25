/**
 * Webhook & Integration API Schemas for OpenAPI Documentation
 */

export const webhookSchemas = {
  // Webhook Endpoint Object
  WebhookEndpoint: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'webhook-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      name: {
        type: 'string',
        example: 'Booking Notifications',
      },
      url: {
        type: 'string',
        format: 'uri',
        example: 'https://example.com/webhooks/bookings',
      },
      secret: {
        type: 'string',
        example: 'whsec_abc123...',
      },
      events: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['booking.created', 'booking.cancelled', 'guest.check_in'],
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive'],
        example: 'active',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      lastTriggered: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      totalTriggers: {
        type: 'integer',
        example: 150,
      },
      successRate: {
        type: 'number',
        example: 98.5,
      },
    },
  },

  // Create Webhook Request
  CreateWebhookRequest: {
    type: 'object',
    required: ['name', 'url', 'events'],
    properties: {
      tenantId: {
        type: 'string',
        default: 'tenant-1',
      },
      name: {
        type: 'string',
        example: 'Booking Notifications',
      },
      url: {
        type: 'string',
        format: 'uri',
        example: 'https://example.com/webhooks/bookings',
      },
      secret: {
        type: 'string',
        description: 'Secret key for signature verification (auto-generated if not provided)',
        nullable: true,
      },
      events: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'List of events to subscribe to',
        example: ['booking.created', 'booking.cancelled'],
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive'],
        default: 'active',
      },
    },
  },

  // Update Webhook Request
  UpdateWebhookRequest: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      url: {
        type: 'string',
        format: 'uri',
      },
      secret: {
        type: 'string',
      },
      events: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive'],
      },
    },
  },

  // Webhook Event Types
  WebhookEventTypes: {
    type: 'object',
    properties: {
      bookings: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['booking.created', 'booking.updated', 'booking.cancelled', 'booking.checked_in', 'booking.checked_out'],
      },
      guests: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['guest.created', 'guest.updated', 'guest.check_in', 'guest.check_out'],
      },
      payments: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['payment.received', 'payment.failed', 'payment.refunded'],
      },
      folios: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['folio.created', 'folio.closed', 'invoice.generated'],
      },
      wifi: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['wifi.session.started', 'wifi.session.ended', 'wifi.voucher.used'],
      },
      housekeeping: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['task.created', 'task.completed', 'room.status_changed'],
      },
    },
  },

  // Webhook Payload
  WebhookPayload: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique event ID',
        example: 'evt_abc123',
      },
      type: {
        type: 'string',
        description: 'Event type',
        example: 'booking.created',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Event timestamp',
        example: '2024-01-15T14:30:00.000Z',
      },
      data: {
        type: 'object',
        description: 'Event data (varies by event type)',
        additionalProperties: true,
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      propertyId: {
        type: 'string',
        nullable: true,
        example: 'property-1',
      },
    },
  },

  // Booking Created Webhook Payload
  BookingCreatedPayload: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'evt_abc123',
      },
      type: {
        type: 'string',
        example: 'booking.created',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
      },
      data: {
        type: 'object',
        properties: {
          booking: {
            $ref: '#/components/schemas/Booking',
          },
          guest: {
            $ref: '#/components/schemas/GuestSummary',
          },
        },
      },
      tenantId: {
        type: 'string',
      },
    },
  },

  // Webhook Delivery Log
  WebhookDeliveryLog: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'delivery-1',
      },
      webhookEndpointId: {
        type: 'string',
        example: 'webhook-1',
      },
      eventType: {
        type: 'string',
        example: 'booking.created',
      },
      payload: {
        type: 'object',
        additionalProperties: true,
      },
      statusCode: {
        type: 'integer',
        nullable: true,
        example: 200,
      },
      response: {
        type: 'string',
        nullable: true,
      },
      duration: {
        type: 'integer',
        description: 'Duration in milliseconds',
        example: 150,
      },
      status: {
        type: 'string',
        enum: ['pending', 'success', 'failed', 'retrying'],
        example: 'success',
      },
      attempts: {
        type: 'integer',
        example: 1,
      },
      deliveredAt: {
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

  // Webhook List Response
  WebhookListResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'object',
        properties: {
          endpoints: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/WebhookEndpoint',
            },
          },
          stats: {
            type: 'object',
            properties: {
              total: {
                type: 'integer',
              },
              active: {
                type: 'integer',
              },
              totalTriggers: {
                type: 'integer',
              },
              avgSuccessRate: {
                type: 'number',
              },
            },
          },
        },
      },
    },
  },
};

export const webhookParameters = {
  tenantId: {
    name: 'tenantId',
    in: 'query',
    description: 'Filter by tenant ID',
    schema: {
      type: 'string',
    },
  },
  status: {
    name: 'status',
    in: 'query',
    description: 'Filter by webhook status',
    schema: {
      type: 'string',
      enum: ['active', 'inactive'],
    },
  },
  id: {
    name: 'id',
    in: 'query',
    description: 'Webhook endpoint ID (for delete)',
    schema: {
      type: 'string',
    },
  },
};
