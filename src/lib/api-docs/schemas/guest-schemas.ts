/**
 * Guest API Schemas for OpenAPI Documentation
 */

export const guestSchemas = {
  // Guest Object
  Guest: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'guest-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
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
        nullable: true,
        example: 'john.doe@example.com',
      },
      phone: {
        type: 'string',
        nullable: true,
        example: '+1234567890',
      },
      alternatePhone: {
        type: 'string',
        nullable: true,
      },
      nationality: {
        type: 'string',
        nullable: true,
        example: 'US',
      },
      dateOfBirth: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      gender: {
        type: 'string',
        nullable: true,
        enum: ['male', 'female', 'other'],
      },
      idType: {
        type: 'string',
        nullable: true,
        enum: ['passport', 'national_id', 'driver_license'],
        example: 'passport',
      },
      idNumber: {
        type: 'string',
        nullable: true,
        example: 'P12345678',
      },
      idExpiry: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      idCountry: {
        type: 'string',
        nullable: true,
      },
      address: {
        type: 'string',
        nullable: true,
        example: '123 Main St',
      },
      city: {
        type: 'string',
        nullable: true,
        example: 'New York',
      },
      state: {
        type: 'string',
        nullable: true,
        example: 'NY',
      },
      country: {
        type: 'string',
        nullable: true,
        example: 'USA',
      },
      postalCode: {
        type: 'string',
        nullable: true,
        example: '10001',
      },
      preferences: {
        type: 'object',
        additionalProperties: true,
        example: { roomType: 'king', floor: 'high', quiet: true },
      },
      dietaryRequirements: {
        type: 'string',
        nullable: true,
        example: 'Vegetarian',
      },
      specialRequests: {
        type: 'string',
        nullable: true,
      },
      avatar: {
        type: 'string',
        nullable: true,
      },
      notes: {
        type: 'string',
        nullable: true,
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['VIP', 'Returning Guest'],
      },
      loyaltyTier: {
        type: 'string',
        enum: ['bronze', 'silver', 'gold', 'platinum'],
        example: 'gold',
      },
      loyaltyPoints: {
        type: 'integer',
        example: 1500,
      },
      totalStays: {
        type: 'integer',
        example: 5,
      },
      totalSpent: {
        type: 'number',
        example: 2500.00,
      },
      isVip: {
        type: 'boolean',
        example: false,
      },
      vipLevel: {
        type: 'string',
        nullable: true,
      },
      source: {
        type: 'string',
        enum: ['direct', 'booking_com', 'airbnb', 'expedia', 'other'],
        example: 'direct',
      },
      sourceId: {
        type: 'string',
        nullable: true,
      },
      emailOptIn: {
        type: 'boolean',
        example: true,
      },
      smsOptIn: {
        type: 'boolean',
        example: false,
      },
      kycStatus: {
        type: 'string',
        enum: ['pending', 'verified', 'rejected'],
        example: 'verified',
      },
      kycVerifiedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
      totalBookings: {
        type: 'integer',
        example: 5,
      },
    },
  },

  // Create Guest Request
  CreateGuestRequest: {
    type: 'object',
    required: ['firstName', 'lastName'],
    properties: {
      tenantId: {
        type: 'string',
        default: 'tenant-1',
        example: 'tenant-1',
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
        nullable: true,
        example: 'john.doe@example.com',
      },
      phone: {
        type: 'string',
        nullable: true,
        example: '+1234567890',
      },
      alternatePhone: {
        type: 'string',
        nullable: true,
      },
      nationality: {
        type: 'string',
        nullable: true,
        example: 'US',
      },
      dateOfBirth: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      gender: {
        type: 'string',
        nullable: true,
        enum: ['male', 'female', 'other'],
      },
      idType: {
        type: 'string',
        nullable: true,
        enum: ['passport', 'national_id', 'driver_license'],
      },
      idNumber: {
        type: 'string',
        nullable: true,
      },
      idExpiry: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      idCountry: {
        type: 'string',
        nullable: true,
      },
      address: {
        type: 'string',
        nullable: true,
      },
      city: {
        type: 'string',
        nullable: true,
      },
      state: {
        type: 'string',
        nullable: true,
      },
      country: {
        type: 'string',
        nullable: true,
      },
      postalCode: {
        type: 'string',
        nullable: true,
      },
      preferences: {
        type: 'object',
        additionalProperties: true,
        default: {},
      },
      dietaryRequirements: {
        type: 'string',
        nullable: true,
      },
      specialRequests: {
        type: 'string',
        nullable: true,
      },
      avatar: {
        type: 'string',
        nullable: true,
      },
      notes: {
        type: 'string',
        nullable: true,
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
        },
        default: [],
      },
      loyaltyTier: {
        type: 'string',
        enum: ['bronze', 'silver', 'gold', 'platinum'],
        default: 'bronze',
      },
      loyaltyPoints: {
        type: 'integer',
        default: 0,
      },
      isVip: {
        type: 'boolean',
        default: false,
      },
      vipLevel: {
        type: 'string',
        nullable: true,
      },
      source: {
        type: 'string',
        enum: ['direct', 'booking_com', 'airbnb', 'expedia', 'other'],
        default: 'direct',
      },
      sourceId: {
        type: 'string',
        nullable: true,
      },
      emailOptIn: {
        type: 'boolean',
        default: false,
      },
      smsOptIn: {
        type: 'boolean',
        default: false,
      },
    },
  },

  // Update Guest Request
  UpdateGuestRequest: {
    type: 'object',
    properties: {
      firstName: {
        type: 'string',
      },
      lastName: {
        type: 'string',
      },
      email: {
        type: 'string',
        format: 'email',
        nullable: true,
      },
      phone: {
        type: 'string',
        nullable: true,
      },
      nationality: {
        type: 'string',
        nullable: true,
      },
      idType: {
        type: 'string',
        nullable: true,
        enum: ['passport', 'national_id', 'driver_license'],
      },
      idNumber: {
        type: 'string',
        nullable: true,
      },
      idExpiry: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      address: {
        type: 'string',
        nullable: true,
      },
      city: {
        type: 'string',
        nullable: true,
      },
      state: {
        type: 'string',
        nullable: true,
      },
      country: {
        type: 'string',
        nullable: true,
      },
      postalCode: {
        type: 'string',
        nullable: true,
      },
      preferences: {
        type: 'object',
        additionalProperties: true,
      },
      dietaryRequirements: {
        type: 'string',
        nullable: true,
      },
      specialRequests: {
        type: 'string',
        nullable: true,
      },
      notes: {
        type: 'string',
        nullable: true,
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      loyaltyTier: {
        type: 'string',
        enum: ['bronze', 'silver', 'gold', 'platinum'],
      },
      isVip: {
        type: 'boolean',
      },
      emailOptIn: {
        type: 'boolean',
      },
      smsOptIn: {
        type: 'boolean',
      },
    },
  },

  // Guest Preferences
  GuestPreferences: {
    type: 'object',
    properties: {
      roomType: {
        type: 'string',
        description: 'Preferred room type',
        example: 'king',
      },
      floor: {
        type: 'string',
        description: 'Preferred floor level',
        example: 'high',
      },
      quiet: {
        type: 'boolean',
        description: 'Prefers quiet room',
        example: true,
      },
      view: {
        type: 'string',
        description: 'Preferred view',
        example: 'sea',
      },
      bedType: {
        type: 'string',
        description: 'Preferred bed type',
        example: 'king',
      },
      smoking: {
        type: 'boolean',
        description: 'Smoking preference',
        example: false,
      },
      accessibility: {
        type: 'boolean',
        description: 'Requires accessible room',
        example: false,
      },
      extraPillows: {
        type: 'boolean',
        description: 'Requests extra pillows',
        example: true,
      },
      temperature: {
        type: 'string',
        description: 'Preferred room temperature',
        example: 'cool',
      },
    },
  },

  // Guest Loyalty
  GuestLoyalty: {
    type: 'object',
    properties: {
      tier: {
        type: 'string',
        enum: ['bronze', 'silver', 'gold', 'platinum'],
        example: 'gold',
      },
      points: {
        type: 'integer',
        example: 1500,
      },
      totalEarned: {
        type: 'integer',
        example: 5000,
      },
      totalRedeemed: {
        type: 'integer',
        example: 3500,
      },
      nextTier: {
        type: 'string',
        example: 'platinum',
      },
      pointsToNextTier: {
        type: 'integer',
        example: 500,
      },
      benefits: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['Free breakfast', 'Late checkout', 'Room upgrade'],
      },
    },
  },

  // Guest Journey
  GuestJourney: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'journey-1',
      },
      guestId: {
        type: 'string',
        example: 'guest-1',
      },
      touchpoints: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['booking', 'check_in', 'service_request', 'feedback', 'check_out'],
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            propertyId: {
              type: 'string',
            },
            propertyName: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            sentiment: {
              type: 'string',
              enum: ['positive', 'neutral', 'negative'],
            },
          },
        },
      },
      totalStays: {
        type: 'integer',
        example: 5,
      },
      totalSpent: {
        type: 'number',
        example: 2500.00,
      },
      avgRating: {
        type: 'number',
        example: 4.5,
      },
    },
  },

  // Guest List Response
  GuestListResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Guest',
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

export const guestParameters = {
  search: {
    name: 'search',
    in: 'query',
    description: 'Search by name, email, or phone',
    schema: {
      type: 'string',
    },
  },
  status: {
    name: 'status',
    in: 'query',
    description: 'Filter by KYC status',
    schema: {
      type: 'string',
      enum: ['pending', 'verified', 'rejected'],
    },
  },
  loyaltyTier: {
    name: 'loyaltyTier',
    in: 'query',
    description: 'Filter by loyalty tier',
    schema: {
      type: 'string',
      enum: ['bronze', 'silver', 'gold', 'platinum'],
    },
  },
  isVip: {
    name: 'isVip',
    in: 'query',
    description: 'Filter VIP guests only',
    schema: {
      type: 'boolean',
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
