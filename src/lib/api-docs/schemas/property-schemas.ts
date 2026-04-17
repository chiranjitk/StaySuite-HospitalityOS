/**
 * Property & Room API Schemas for OpenAPI Documentation
 */

export const propertySchemas = {
  // Property Object
  Property: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'property-1',
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      name: {
        type: 'string',
        example: 'Grand Hotel',
      },
      slug: {
        type: 'string',
        example: 'grand-hotel',
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'A luxurious 5-star hotel in the heart of the city',
      },
      type: {
        type: 'string',
        enum: ['hotel', 'resort', 'hostel', 'apartment', 'villa'],
        example: 'hotel',
      },
      address: {
        type: 'string',
        example: '123 Main Street',
      },
      city: {
        type: 'string',
        example: 'New York',
      },
      state: {
        type: 'string',
        nullable: true,
        example: 'NY',
      },
      country: {
        type: 'string',
        example: 'USA',
      },
      postalCode: {
        type: 'string',
        nullable: true,
        example: '10001',
      },
      latitude: {
        type: 'number',
        nullable: true,
        example: 40.7128,
      },
      longitude: {
        type: 'number',
        nullable: true,
        example: -74.0060,
      },
      email: {
        type: 'string',
        format: 'email',
        nullable: true,
        example: 'info@grandhotel.com',
      },
      phone: {
        type: 'string',
        nullable: true,
        example: '+1234567890',
      },
      website: {
        type: 'string',
        nullable: true,
        example: 'https://grandhotel.com',
      },
      logo: {
        type: 'string',
        nullable: true,
      },
      primaryColor: {
        type: 'string',
        nullable: true,
        example: '#1E40AF',
      },
      secondaryColor: {
        type: 'string',
        nullable: true,
        example: '#3B82F6',
      },
      checkInTime: {
        type: 'string',
        example: '14:00',
      },
      checkOutTime: {
        type: 'string',
        example: '11:00',
      },
      timezone: {
        type: 'string',
        example: 'America/New_York',
      },
      currency: {
        type: 'string',
        example: 'USD',
      },
      totalRooms: {
        type: 'integer',
        example: 150,
      },
      totalFloors: {
        type: 'integer',
        example: 10,
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'maintenance'],
        example: 'active',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
      totalRoomTypes: {
        type: 'integer',
        example: 8,
      },
    },
  },

  // Create Property Request
  CreatePropertyRequest: {
    type: 'object',
    required: ['name', 'slug', 'address', 'city', 'country'],
    properties: {
      name: {
        type: 'string',
        example: 'Grand Hotel',
      },
      slug: {
        type: 'string',
        example: 'grand-hotel',
      },
      description: {
        type: 'string',
        nullable: true,
      },
      type: {
        type: 'string',
        enum: ['hotel', 'resort', 'hostel', 'apartment', 'villa'],
        default: 'hotel',
      },
      address: {
        type: 'string',
        example: '123 Main Street',
      },
      city: {
        type: 'string',
        example: 'New York',
      },
      state: {
        type: 'string',
        nullable: true,
      },
      country: {
        type: 'string',
        example: 'USA',
      },
      postalCode: {
        type: 'string',
        nullable: true,
      },
      latitude: {
        type: 'number',
        nullable: true,
      },
      longitude: {
        type: 'number',
        nullable: true,
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
      website: {
        type: 'string',
        nullable: true,
      },
      logo: {
        type: 'string',
        nullable: true,
      },
      primaryColor: {
        type: 'string',
        nullable: true,
      },
      secondaryColor: {
        type: 'string',
        nullable: true,
      },
      checkInTime: {
        type: 'string',
        default: '14:00',
      },
      checkOutTime: {
        type: 'string',
        default: '11:00',
      },
      timezone: {
        type: 'string',
        default: 'Asia/Kolkata',
      },
      currency: {
        type: 'string',
        default: 'USD',
      },
      taxId: {
        type: 'string',
        nullable: true,
      },
      taxType: {
        type: 'string',
        default: 'gst',
      },
      defaultTaxRate: {
        type: 'number',
        default: 0,
      },
      taxComponents: {
        type: 'array',
        items: {
          type: 'object',
        },
        default: [],
      },
      serviceChargePercent: {
        type: 'number',
        default: 0,
      },
      includeTaxInPrice: {
        type: 'boolean',
        default: false,
      },
      totalFloors: {
        type: 'integer',
        default: 1,
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active',
      },
    },
  },

  // Room Type Object
  RoomType: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'roomtype-1',
      },
      propertyId: {
        type: 'string',
        example: 'property-1',
      },
      name: {
        type: 'string',
        example: 'Deluxe King Room',
      },
      code: {
        type: 'string',
        example: 'DLXK',
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'Spacious room with king-size bed and city view',
      },
      maxAdults: {
        type: 'integer',
        example: 2,
      },
      maxChildren: {
        type: 'integer',
        example: 2,
      },
      maxOccupancy: {
        type: 'integer',
        example: 4,
      },
      sizeSqMeters: {
        type: 'number',
        nullable: true,
        example: 35,
      },
      sizeSqFeet: {
        type: 'number',
        nullable: true,
        example: 377,
      },
      amenities: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['WiFi', 'Air Conditioning', 'Mini Bar', 'Safe'],
      },
      basePrice: {
        type: 'number',
        example: 150.00,
      },
      currency: {
        type: 'string',
        example: 'USD',
      },
      images: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['https://example.com/room1.jpg'],
      },
      sortOrder: {
        type: 'integer',
        example: 1,
      },
      totalRooms: {
        type: 'integer',
        example: 20,
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive'],
        example: 'active',
      },
    },
  },

  // Room Object
  Room: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'room-101',
      },
      propertyId: {
        type: 'string',
        example: 'property-1',
      },
      roomTypeId: {
        type: 'string',
        example: 'roomtype-1',
      },
      number: {
        type: 'string',
        example: '101',
      },
      name: {
        type: 'string',
        nullable: true,
        example: 'Deluxe King 101',
      },
      floor: {
        type: 'integer',
        example: 1,
      },
      isAccessible: {
        type: 'boolean',
        example: false,
      },
      isSmoking: {
        type: 'boolean',
        example: false,
      },
      hasBalcony: {
        type: 'boolean',
        example: true,
      },
      hasSeaView: {
        type: 'boolean',
        example: false,
      },
      hasMountainView: {
        type: 'boolean',
        example: false,
      },
      status: {
        type: 'string',
        enum: ['available', 'occupied', 'maintenance', 'out_of_order', 'dirty'],
        example: 'available',
      },
      digitalKeyEnabled: {
        type: 'boolean',
        example: true,
      },
      roomType: {
        $ref: '#/components/schemas/RoomType',
      },
    },
  },

  // Room Availability
  RoomAvailability: {
    type: 'object',
    properties: {
      roomTypeId: {
        type: 'string',
        example: 'roomtype-1',
      },
      date: {
        type: 'string',
        format: 'date',
        example: '2024-01-15',
      },
      totalRooms: {
        type: 'integer',
        example: 20,
      },
      availableRooms: {
        type: 'integer',
        example: 15,
      },
      bookedRooms: {
        type: 'integer',
        example: 5,
      },
      blockedRooms: {
        type: 'integer',
        example: 0,
      },
      price: {
        type: 'number',
        example: 150.00,
      },
      currency: {
        type: 'string',
        example: 'USD',
      },
      minStay: {
        type: 'integer',
        example: 1,
      },
      restrictions: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['no_arrival', 'no_departure'],
      },
    },
  },

  // Property List Response
  PropertyListResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Property',
        },
      },
    },
  },
};

export const propertyParameters = {
  status: {
    name: 'status',
    in: 'query',
    description: 'Filter by property status',
    schema: {
      type: 'string',
      enum: ['active', 'inactive', 'maintenance'],
    },
  },
  type: {
    name: 'type',
    in: 'query',
    description: 'Filter by property type',
    schema: {
      type: 'string',
      enum: ['hotel', 'resort', 'hostel', 'apartment', 'villa'],
    },
  },
};
