/**
 * Channel Manager API Schemas for OpenAPI Documentation
 */

export const channelSchemas = {
  // Channel Connection Object
  ChannelConnection: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'connection-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      channel: {
        type: 'string',
        example: 'booking_com',
        description: 'OTA channel identifier',
      },
      displayName: {
        type: 'string',
        example: 'Booking.com',
      },
      hotelId: {
        type: 'string',
        nullable: true,
        description: 'Hotel ID in OTA system',
      },
      propertyId: {
        type: 'string',
        nullable: true,
        description: 'Property ID in OTA system',
      },
      listingId: {
        type: 'string',
        nullable: true,
        description: 'Listing ID (for Airbnb)',
      },
      endpointUrl: {
        type: 'string',
        nullable: true,
      },
      status: {
        type: 'string',
        enum: ['pending', 'active', 'error', 'disconnected'],
        example: 'active',
      },
      autoSync: {
        type: 'boolean',
        example: true,
      },
      syncInterval: {
        type: 'integer',
        description: 'Sync interval in minutes',
        example: 60,
      },
      lastSyncAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      lastError: {
        type: 'string',
        nullable: true,
      },
      mappingCount: {
        type: 'integer',
        example: 25,
      },
      syncCount: {
        type: 'integer',
        example: 150,
      },
      successfulSyncs: {
        type: 'integer',
        example: 145,
      },
      failedSyncs: {
        type: 'integer',
        example: 5,
      },
      channelMeta: {
        $ref: '#/components/schemas/OTAMetadata',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  // OTA Metadata
  OTAMetadata: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'booking_com',
      },
      name: {
        type: 'string',
        example: 'booking_com',
      },
      displayName: {
        type: 'string',
        example: 'Booking.com',
      },
      logo: {
        type: 'string',
        example: 'B',
      },
      color: {
        type: 'string',
        example: '#003580',
      },
      region: {
        type: 'string',
        enum: ['global', 'asia_pacific', 'europe', 'americas', 'middle_east'],
        example: 'global',
      },
      type: {
        type: 'string',
        enum: ['ota', 'metasearch', 'gds', 'direct'],
        example: 'ota',
      },
      priority: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low'],
        example: 'critical',
      },
      commission: {
        type: 'object',
        properties: {
          min: {
            type: 'number',
            example: 15,
          },
          max: {
            type: 'number',
            example: 18,
          },
          type: {
            type: 'string',
            enum: ['percentage', 'fixed'],
            example: 'percentage',
          },
        },
      },
      features: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['instant_booking', 'real_time_sync', 'reviews'],
      },
    },
  },

  // Create Channel Connection Request
  CreateChannelConnectionRequest: {
    type: 'object',
    required: ['channel'],
    properties: {
      tenantId: {
        type: 'string',
        default: 'tenant-1',
      },
      channel: {
        type: 'string',
        description: 'OTA channel identifier',
        example: 'booking_com',
      },
      displayName: {
        type: 'string',
        description: 'Custom display name',
        nullable: true,
      },
      apiKey: {
        type: 'string',
        nullable: true,
        description: 'API key for authentication',
      },
      apiSecret: {
        type: 'string',
        nullable: true,
        description: 'API secret for authentication',
      },
      username: {
        type: 'string',
        nullable: true,
        description: 'Username for basic auth',
      },
      password: {
        type: 'string',
        nullable: true,
        description: 'Password for basic auth',
      },
      clientId: {
        type: 'string',
        nullable: true,
        description: 'OAuth client ID',
      },
      clientSecret: {
        type: 'string',
        nullable: true,
        description: 'OAuth client secret',
      },
      accessToken: {
        type: 'string',
        nullable: true,
        description: 'OAuth access token',
      },
      refreshToken: {
        type: 'string',
        nullable: true,
        description: 'OAuth refresh token',
      },
      hotelId: {
        type: 'string',
        nullable: true,
        description: 'Hotel ID in OTA system',
      },
      propertyId: {
        type: 'string',
        nullable: true,
        description: 'Property ID in OTA system',
      },
      listingId: {
        type: 'string',
        nullable: true,
        description: 'Listing ID (for Airbnb)',
      },
      partnerId: {
        type: 'string',
        nullable: true,
      },
      endpointUrl: {
        type: 'string',
        nullable: true,
      },
      autoSync: {
        type: 'boolean',
        default: true,
      },
      syncInterval: {
        type: 'integer',
        default: 60,
        description: 'Sync interval in minutes',
      },
    },
  },

  // Update Channel Connection Request
  UpdateChannelConnectionRequest: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
      },
      action: {
        type: 'string',
        enum: ['connect', 'disconnect', 'sync', 'test'],
        description: 'Action to perform on the connection',
      },
      channel: {
        type: 'string',
      },
      credentials: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', nullable: true },
          apiSecret: { type: 'string', nullable: true },
          username: { type: 'string', nullable: true },
          password: { type: 'string', nullable: true },
          hotelId: { type: 'string', nullable: true },
          propertyId: { type: 'string', nullable: true },
          listingId: { type: 'string', nullable: true },
          accessToken: { type: 'string', nullable: true },
        },
      },
      autoSync: {
        type: 'boolean',
      },
      syncInterval: {
        type: 'integer',
      },
    },
  },

  // Channel Mapping Object
  ChannelMapping: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'mapping-1',
      },
      connectionId: {
        type: 'string',
        example: 'connection-1',
      },
      roomTypeId: {
        type: 'string',
        example: 'roomtype-1',
        description: 'Internal room type ID',
      },
      channelRoomId: {
        type: 'string',
        example: '12345',
        description: 'Room type ID in OTA system',
      },
      channelRoomName: {
        type: 'string',
        example: 'Deluxe King Room',
      },
      ratePlanId: {
        type: 'string',
        nullable: true,
        description: 'Internal rate plan ID',
      },
      channelRatePlanId: {
        type: 'string',
        nullable: true,
        description: 'Rate plan ID in OTA system',
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'error'],
        example: 'active',
      },
      lastSyncAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
    },
  },

  // Channel Sync Log
  ChannelSyncLog: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'synclog-1',
      },
      connectionId: {
        type: 'string',
        example: 'connection-1',
      },
      syncType: {
        type: 'string',
        enum: ['inventory', 'rates', 'restrictions', 'bookings', 'full'],
        example: 'inventory',
      },
      direction: {
        type: 'string',
        enum: ['inbound', 'outbound'],
        example: 'outbound',
      },
      status: {
        type: 'string',
        enum: ['pending', 'success', 'failed', 'partial'],
        example: 'success',
      },
      recordsProcessed: {
        type: 'integer',
        example: 25,
      },
      recordsFailed: {
        type: 'integer',
        example: 0,
      },
      errorMessage: {
        type: 'string',
        nullable: true,
      },
      duration: {
        type: 'integer',
        description: 'Duration in milliseconds',
        example: 2500,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  // Rate Sync Request
  RateSyncRequest: {
    type: 'object',
    properties: {
      connectionId: {
        type: 'string',
        example: 'connection-1',
      },
      roomTypeId: {
        type: 'string',
        nullable: true,
      },
      dateFrom: {
        type: 'string',
        format: 'date',
      },
      dateTo: {
        type: 'string',
        format: 'date',
      },
      rates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              format: 'date',
            },
            roomTypeId: {
              type: 'string',
            },
            rate: {
              type: 'number',
            },
            currency: {
              type: 'string',
            },
            minStay: {
              type: 'integer',
              nullable: true,
            },
            maxStay: {
              type: 'integer',
              nullable: true,
            },
          },
        },
      },
    },
  },

  // Inventory Sync Request
  InventorySyncRequest: {
    type: 'object',
    properties: {
      connectionId: {
        type: 'string',
      },
      roomTypeId: {
        type: 'string',
        nullable: true,
      },
      dateFrom: {
        type: 'string',
        format: 'date',
      },
      dateTo: {
        type: 'string',
        format: 'date',
      },
      availability: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              format: 'date',
            },
            roomTypeId: {
              type: 'string',
            },
            available: {
              type: 'integer',
            },
          },
        },
      },
    },
  },

  // Channel Connection List Response
  ChannelConnectionListResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ChannelConnection',
        },
      },
      availableChannels: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/OTAMetadata',
        },
        description: 'Unconnected channels available for connection',
      },
      allChannels: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/OTAMetadata',
        },
        description: 'All supported OTA channels',
      },
      pagination: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
          },
        },
      },
      stats: {
        type: 'object',
        properties: {
          totalConnections: {
            type: 'integer',
          },
          activeConnections: {
            type: 'integer',
          },
          pendingConnections: {
            type: 'integer',
          },
          errorConnections: {
            type: 'integer',
          },
        },
      },
    },
  },
};

export const channelParameters = {
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
    description: 'Filter by connection status',
    schema: {
      type: 'string',
      enum: ['pending', 'active', 'error', 'disconnected'],
    },
  },
  channel: {
    name: 'channel',
    in: 'query',
    description: 'Filter by OTA channel',
    schema: {
      type: 'string',
    },
  },
  region: {
    name: 'region',
    in: 'query',
    description: 'Filter by region',
    schema: {
      type: 'string',
      enum: ['global', 'asia_pacific', 'europe', 'americas', 'middle_east'],
    },
  },
  priority: {
    name: 'priority',
    in: 'query',
    description: 'Filter by priority',
    schema: {
      type: 'string',
      enum: ['critical', 'high', 'medium', 'low'],
    },
  },
  id: {
    name: 'id',
    in: 'query',
    description: 'Connection ID (for delete)',
    schema: {
      type: 'string',
    },
  },
};
