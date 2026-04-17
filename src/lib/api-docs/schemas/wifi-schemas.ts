/**
 * WiFi API Schemas for OpenAPI Documentation
 */

export const wifiSchemas = {
  // WiFi Session Object
  WiFiSession: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'session-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      planId: {
        type: 'string',
        nullable: true,
        example: 'plan-1',
      },
      guestId: {
        type: 'string',
        nullable: true,
        example: 'guest-1',
      },
      bookingId: {
        type: 'string',
        nullable: true,
        example: 'booking-1',
      },
      macAddress: {
        type: 'string',
        example: '00:1A:2B:3C:4D:5E',
      },
      ipAddress: {
        type: 'string',
        nullable: true,
        example: '192.168.1.100',
      },
      deviceName: {
        type: 'string',
        nullable: true,
        example: 'John\'s iPhone',
      },
      deviceType: {
        type: 'string',
        nullable: true,
        enum: ['smartphone', 'tablet', 'laptop', 'desktop', 'other'],
        example: 'smartphone',
      },
      startTime: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T14:00:00.000Z',
      },
      endTime: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      dataUsed: {
        type: 'integer',
        description: 'Data used in bytes',
        example: 1073741824,
      },
      duration: {
        type: 'integer',
        description: 'Session duration in seconds',
        example: 3600,
      },
      authMethod: {
        type: 'string',
        enum: ['voucher', 'social', 'portal'],
        example: 'voucher',
      },
      status: {
        type: 'string',
        enum: ['active', 'ended', 'terminated'],
        example: 'active',
      },
      plan: {
        $ref: '#/components/schemas/WiFiPlanSummary',
      },
    },
  },

  // WiFi Plan Summary
  WiFiPlanSummary: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'plan-1',
      },
      name: {
        type: 'string',
        example: 'Premium WiFi',
      },
      downloadSpeed: {
        type: 'integer',
        description: 'Download speed in Mbps',
        example: 50,
      },
      uploadSpeed: {
        type: 'integer',
        description: 'Upload speed in Mbps',
        example: 25,
      },
      dataLimit: {
        type: 'integer',
        description: 'Data limit in bytes (0 = unlimited)',
        example: 10737418240,
      },
      sessionLimit: {
        type: 'integer',
        description: 'Session duration limit in minutes (0 = unlimited)',
        example: 1440,
      },
    },
  },

  // WiFi Plan Object
  WiFiPlan: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'plan-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      name: {
        type: 'string',
        example: 'Premium WiFi',
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'High-speed WiFi for business travelers',
      },
      downloadSpeed: {
        type: 'integer',
        description: 'Download speed in Mbps',
        example: 50,
      },
      uploadSpeed: {
        type: 'integer',
        description: 'Upload speed in Mbps',
        example: 25,
      },
      dataLimit: {
        type: 'integer',
        description: 'Data limit in bytes (0 = unlimited)',
        example: 10737418240,
      },
      sessionLimit: {
        type: 'integer',
        description: 'Session duration limit in minutes',
        example: 1440,
      },
      price: {
        type: 'number',
        example: 9.99,
      },
      currency: {
        type: 'string',
        example: 'USD',
      },
      isDefault: {
        type: 'boolean',
        example: false,
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive'],
        example: 'active',
      },
    },
  },

  // WiFi Voucher Object
  WiFiVoucher: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'voucher-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      planId: {
        type: 'string',
        example: 'plan-1',
      },
      code: {
        type: 'string',
        example: 'WIFI-ABCD1234',
      },
      guestId: {
        type: 'string',
        nullable: true,
      },
      bookingId: {
        type: 'string',
        nullable: true,
      },
      isUsed: {
        type: 'boolean',
        example: false,
      },
      usedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      validFrom: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T00:00:00.000Z',
      },
      validUntil: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-18T00:00:00.000Z',
      },
      status: {
        type: 'string',
        enum: ['active', 'used', 'expired', 'revoked'],
        example: 'active',
      },
    },
  },

  // Create WiFi Session Request
  CreateWiFiSessionRequest: {
    type: 'object',
    required: ['macAddress'],
    properties: {
      tenantId: {
        type: 'string',
        default: 'tenant-1',
        example: 'tenant-1',
      },
      planId: {
        type: 'string',
        nullable: true,
        example: 'plan-1',
      },
      guestId: {
        type: 'string',
        nullable: true,
      },
      bookingId: {
        type: 'string',
        nullable: true,
      },
      macAddress: {
        type: 'string',
        example: '00:1A:2B:3C:4D:5E',
      },
      ipAddress: {
        type: 'string',
        nullable: true,
      },
      deviceName: {
        type: 'string',
        nullable: true,
      },
      deviceType: {
        type: 'string',
        enum: ['smartphone', 'tablet', 'laptop', 'desktop', 'other'],
        nullable: true,
      },
      authMethod: {
        type: 'string',
        enum: ['voucher', 'social', 'portal'],
        default: 'voucher',
      },
    },
  },

  // Update WiFi Session Request
  UpdateWiFiSessionRequest: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        example: 'session-1',
      },
      status: {
        type: 'string',
        enum: ['active', 'ended', 'terminated'],
      },
      dataUsed: {
        type: 'integer',
        description: 'Data used in bytes',
      },
      duration: {
        type: 'integer',
        description: 'Session duration in seconds',
      },
      endTime: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  // WiFi Session List Response
  WiFiSessionListResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/WiFiSession',
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
      summary: {
        type: 'object',
        properties: {
          totalDataUsed: {
            type: 'integer',
            description: 'Total data used in bytes',
          },
          totalDuration: {
            type: 'integer',
            description: 'Total duration in seconds',
          },
          count: {
            type: 'integer',
          },
          byStatus: {
            type: 'object',
            additionalProperties: {
              type: 'integer',
            },
          },
        },
      },
    },
  },
};

export const wifiParameters = {
  tenantId: {
    name: 'tenantId',
    in: 'query',
    description: 'Filter by tenant ID',
    schema: {
      type: 'string',
    },
  },
  planId: {
    name: 'planId',
    in: 'query',
    description: 'Filter by WiFi plan ID',
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
  bookingId: {
    name: 'bookingId',
    in: 'query',
    description: 'Filter by booking ID',
    schema: {
      type: 'string',
    },
  },
  status: {
    name: 'status',
    in: 'query',
    description: 'Filter by session status',
    schema: {
      type: 'string',
      enum: ['active', 'ended', 'terminated'],
    },
  },
  authMethod: {
    name: 'authMethod',
    in: 'query',
    description: 'Filter by authentication method',
    schema: {
      type: 'string',
      enum: ['voucher', 'social', 'portal'],
    },
  },
  deviceType: {
    name: 'deviceType',
    in: 'query',
    description: 'Filter by device type',
    schema: {
      type: 'string',
      enum: ['smartphone', 'tablet', 'laptop', 'desktop', 'other'],
    },
  },
  macAddress: {
    name: 'macAddress',
    in: 'query',
    description: 'Filter by MAC address (partial match)',
    schema: {
      type: 'string',
    },
  },
  startTimeFrom: {
    name: 'startTimeFrom',
    in: 'query',
    description: 'Filter sessions starting from this date',
    schema: {
      type: 'string',
      format: 'date-time',
    },
  },
  startTimeTo: {
    name: 'startTimeTo',
    in: 'query',
    description: 'Filter sessions starting until this date',
    schema: {
      type: 'string',
      format: 'date-time',
    },
  },
  search: {
    name: 'search',
    in: 'query',
    description: 'Search by MAC address, IP, or device name',
    schema: {
      type: 'string',
    },
  },
};
