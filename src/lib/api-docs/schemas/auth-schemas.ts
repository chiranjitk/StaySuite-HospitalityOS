/**
 * Authentication API Schemas for OpenAPI Documentation
 */

export const authSchemas = {
  // Login Request
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
        example: 'admin@staysuite.com',
      },
      password: {
        type: 'string',
        format: 'password',
        description: 'User password',
        example: 'password123',
      },
      twoFactorCode: {
        type: 'string',
        description: 'Two-factor authentication code (if 2FA is enabled)',
        example: '123456',
      },
      tempToken: {
        type: 'string',
        description: 'Temporary token from 2FA step',
        example: 'a1b2c3d4e5f6...',
      },
    },
  },

  // Login Response
  LoginResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      requireTwoFactor: {
        type: 'boolean',
        description: 'Whether 2FA is required',
        example: false,
      },
      tempToken: {
        type: 'string',
        description: 'Temporary token for 2FA verification',
      },
      user: {
        $ref: '#/components/schemas/User',
      },
    },
  },

  // User Object
  User: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'user-1',
      },
      email: {
        type: 'string',
        format: 'email',
        example: 'admin@staysuite.com',
      },
      name: {
        type: 'string',
        example: 'John Doe',
      },
      firstName: {
        type: 'string',
        example: 'John',
      },
      lastName: {
        type: 'string',
        example: 'Doe',
      },
      avatar: {
        type: 'string',
        nullable: true,
        example: 'https://example.com/avatar.jpg',
      },
      roleId: {
        type: 'string',
        nullable: true,
        example: 'role-1',
      },
      roleName: {
        type: 'string',
        example: 'admin',
      },
      permissions: {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['bookings:read', 'bookings:write', 'guests:read'],
      },
      tenantId: {
        type: 'string',
        example: 'tenant-1',
      },
      tenant: {
        $ref: '#/components/schemas/Tenant',
      },
    },
  },

  // Tenant Object
  Tenant: {
    type: 'object',
    properties: {
      id: {
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
      plan: {
        type: 'string',
        enum: ['trial', 'starter', 'professional', 'enterprise'],
        example: 'professional',
      },
      status: {
        type: 'string',
        enum: ['trial', 'active', 'suspended', 'cancelled', 'archived'],
        example: 'active',
      },
    },
  },

  // 2FA Setup Response
  TwoFactorSetupResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      secret: {
        type: 'string',
        description: 'TOTP secret key',
        example: 'JBSWY3DPEHPK3PXP',
      },
      qrCode: {
        type: 'string',
        description: 'Data URL for QR code image',
        example: 'data:image/png;base64,...',
      },
      backupCodes: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Backup codes for account recovery',
        example: ['ABC123', 'DEF456', 'GHI789'],
      },
    },
  },

  // Session Object
  Session: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: 'session-1',
      },
      userId: {
        type: 'string',
        example: 'user-1',
      },
      token: {
        type: 'string',
        description: 'Session token (masked in responses)',
        example: 'abc123...',
      },
      userAgent: {
        type: 'string',
        nullable: true,
        example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      ipAddress: {
        type: 'string',
        nullable: true,
        example: '192.168.1.1',
      },
      expiresAt: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-02T00:00:00.000Z',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-01T00:00:00.000Z',
      },
    },
  },

  // Sessions List Response
  SessionsListResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Session',
        },
      },
    },
  },

  // Logout Response
  LogoutResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      message: {
        type: 'string',
        example: 'Logged out successfully',
      },
    },
  },

  // Error Response
  ErrorResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: false,
      },
      error: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            example: 'VALIDATION_ERROR',
          },
          message: {
            type: 'string',
            example: 'Invalid credentials',
          },
          details: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  },
};

export const authParameters = {
  sessionToken: {
    name: 'session_token',
    in: 'cookie',
    description: 'Session token for authentication',
    required: true,
    schema: {
      type: 'string',
    },
  },
};
