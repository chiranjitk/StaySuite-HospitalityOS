/**
 * OpenAPI 3.0 Specification for StaySuite-HospitalityOS
 * Comprehensive API Documentation
 */

import { authSchemas } from './schemas/auth-schemas';
import { bookingSchemas, bookingParameters } from './schemas/booking-schemas';
import { guestSchemas, guestParameters } from './schemas/guest-schemas';
import { propertySchemas, propertyParameters } from './schemas/property-schemas';
import { wifiSchemas, wifiParameters } from './schemas/wifi-schemas';
import { billingSchemas, billingParameters } from './schemas/billing-schemas';
import { webhookSchemas, webhookParameters } from './schemas/webhook-schemas';
import { channelSchemas, channelParameters } from './schemas/channel-schemas';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'StaySuite-HospitalityOS API',
    description: `
# StaySuite-HospitalityOS API Documentation

Comprehensive API for hospitality management including bookings, guests, properties, WiFi, billing, and channel management.

## API Versioning

This API supports multiple versioning strategies:

### URL-Based Versioning
Include the version in the URL path: \`/api/v1/bookings\`, \`/api/v2/bookings\`

### Header-Based Versioning
Use the \`Accept-Version\` header: \`Accept-Version: 1\`

### Version Information
- **Current Version**: v1
- **Default Version**: v1 (used when no version is specified)
- **Deprecated Versions**: None

All responses include an \`X-API-Version\` header indicating the API version used.

## Authentication

Most endpoints require authentication via session cookie. Include the \`session_token\` cookie in your requests.

## Rate Limiting

API requests are rate-limited to 100 requests per minute per user.

## Pagination

List endpoints support pagination with \`limit\` and \`offset\` query parameters.

## Error Handling

All errors follow a standard format with \`success: false\` and an \`error\` object containing \`code\` and \`message\`.
    `,
    version: '1.0.0',
    contact: {
      name: 'StaySuite API Support',
      email: 'api@staysuite.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Current server (relative) - Default version',
    },
    {
      url: '/api/v1',
      description: 'Version 1 API (explicit)',
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Development server',
    },
    {
      url: 'https://api.staysuite.com/api',
      description: 'Production server',
    },
  ],
  tags: [
    { name: 'API Version', description: 'API versioning and information' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Bookings', description: 'Booking management' },
    { name: 'Guests', description: 'Guest management' },
    { name: 'Properties', description: 'Property and room management' },
    { name: 'WiFi', description: 'WiFi session and voucher management' },
    { name: 'Billing', description: 'Folio, invoice, and payment management' },
    { name: 'Channel Manager', description: 'OTA integration and sync' },
    { name: 'Webhooks', description: 'Webhook endpoints and events' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'session_token',
        description: 'Session token cookie for authentication',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Bearer token for API access',
      },
    },
    schemas: {
      // Auth schemas
      LoginRequest: authSchemas.LoginRequest,
      LoginResponse: authSchemas.LoginResponse,
      User: authSchemas.User,
      Tenant: authSchemas.Tenant,
      TwoFactorSetupResponse: authSchemas.TwoFactorSetupResponse,
      Session: authSchemas.Session,
      SessionsListResponse: authSchemas.SessionsListResponse,
      LogoutResponse: authSchemas.LogoutResponse,
      ErrorResponse: authSchemas.ErrorResponse,

      // Booking schemas
      Booking: bookingSchemas.Booking,
      GuestSummary: bookingSchemas.GuestSummary,
      RoomSummary: bookingSchemas.RoomSummary,
      RoomTypeSummary: bookingSchemas.RoomTypeSummary,
      CreateBookingRequest: bookingSchemas.CreateBookingRequest,
      UpdateBookingRequest: bookingSchemas.UpdateBookingRequest,
      BookingListResponse: bookingSchemas.BookingListResponse,
      BookingConflict: bookingSchemas.BookingConflict,
      BookingAuditLog: bookingSchemas.BookingAuditLog,

      // Guest schemas
      Guest: guestSchemas.Guest,
      CreateGuestRequest: guestSchemas.CreateGuestRequest,
      UpdateGuestRequest: guestSchemas.UpdateGuestRequest,
      GuestPreferences: guestSchemas.GuestPreferences,
      GuestLoyalty: guestSchemas.GuestLoyalty,
      GuestJourney: guestSchemas.GuestJourney,
      GuestListResponse: guestSchemas.GuestListResponse,

      // Property schemas
      Property: propertySchemas.Property,
      CreatePropertyRequest: propertySchemas.CreatePropertyRequest,
      RoomType: propertySchemas.RoomType,
      Room: propertySchemas.Room,
      RoomAvailability: propertySchemas.RoomAvailability,
      PropertyListResponse: propertySchemas.PropertyListResponse,

      // WiFi schemas
      WiFiSession: wifiSchemas.WiFiSession,
      WiFiPlanSummary: wifiSchemas.WiFiPlanSummary,
      WiFiPlan: wifiSchemas.WiFiPlan,
      WiFiVoucher: wifiSchemas.WiFiVoucher,
      CreateWiFiSessionRequest: wifiSchemas.CreateWiFiSessionRequest,
      UpdateWiFiSessionRequest: wifiSchemas.UpdateWiFiSessionRequest,
      WiFiSessionListResponse: wifiSchemas.WiFiSessionListResponse,

      // Billing schemas
      Folio: billingSchemas.Folio,
      FolioLineItem: billingSchemas.FolioLineItem,
      Payment: billingSchemas.Payment,
      CreateFolioRequest: billingSchemas.CreateFolioRequest,
      AddLineItemRequest: billingSchemas.AddLineItemRequest,
      CreatePaymentRequest: billingSchemas.CreatePaymentRequest,
      Invoice: billingSchemas.Invoice,
      FolioListResponse: billingSchemas.FolioListResponse,

      // Webhook schemas
      WebhookEndpoint: webhookSchemas.WebhookEndpoint,
      CreateWebhookRequest: webhookSchemas.CreateWebhookRequest,
      UpdateWebhookRequest: webhookSchemas.UpdateWebhookRequest,
      WebhookEventTypes: webhookSchemas.WebhookEventTypes,
      WebhookPayload: webhookSchemas.WebhookPayload,
      BookingCreatedPayload: webhookSchemas.BookingCreatedPayload,
      WebhookDeliveryLog: webhookSchemas.WebhookDeliveryLog,
      WebhookListResponse: webhookSchemas.WebhookListResponse,

      // Channel Manager schemas
      ChannelConnection: channelSchemas.ChannelConnection,
      OTAMetadata: channelSchemas.OTAMetadata,
      CreateChannelConnectionRequest: channelSchemas.CreateChannelConnectionRequest,
      UpdateChannelConnectionRequest: channelSchemas.UpdateChannelConnectionRequest,
      ChannelMapping: channelSchemas.ChannelMapping,
      ChannelSyncLog: channelSchemas.ChannelSyncLog,
      RateSyncRequest: channelSchemas.RateSyncRequest,
      InventorySyncRequest: channelSchemas.InventorySyncRequest,
      ChannelConnectionListResponse: channelSchemas.ChannelConnectionListResponse,
    },
  },
  paths: {
    // ============================================
    // API VERSION ENDPOINT
    // ============================================
    '/version': {
      get: {
        tags: ['API Version'],
        summary: 'Get API version information',
        description: 'Returns comprehensive information about supported API versions, deprecation status, and versioning styles.',
        responses: {
          '200': {
            description: 'API version information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        currentVersion: { type: 'string', example: '1' },
                        defaultVersion: { type: 'string', example: '1' },
                        baseUrl: { type: 'string', example: '/api' },
                        docsUrl: { type: 'string', example: '/api/docs' },
                        versions: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              version: { type: 'string' },
                              name: { type: 'string' },
                              status: { type: 'string', enum: ['current', 'supported', 'deprecated', 'sunset'] },
                              releasedAt: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                        versioningStyles: {
                          type: 'object',
                          properties: {
                            urlBased: {
                              type: 'object',
                              properties: {
                                description: { type: 'string' },
                                example: { type: 'string' },
                                supported: { type: 'boolean' },
                              },
                            },
                            headerBased: {
                              type: 'object',
                              properties: {
                                description: { type: 'string' },
                                example: { type: 'string' },
                                supported: { type: 'boolean' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ============================================
    // AUTH ENDPOINTS
    // ============================================
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'User login',
        description: 'Authenticate user with email and password. Returns session token on success. If 2FA is enabled, returns tempToken for 2FA verification.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              examples: {
                basic: {
                  summary: 'Basic login',
                  value: { email: 'admin@staysuite.com', password: 'password123' },
                },
                with2fa: {
                  summary: 'Login with 2FA verification',
                  value: { email: 'admin@staysuite.com', password: 'password123', twoFactorCode: '123456', tempToken: 'abc123...' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '401': {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '403': {
            description: 'Account locked or inactive',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'User logout',
        description: 'Invalidate the current session and log out the user.',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'Logout successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LogoutResponse' } } },
          },
        },
      },
    },
    '/auth/2fa/setup': {
      post: {
        tags: ['Auth'],
        summary: 'Setup two-factor authentication',
        description: 'Generate a new TOTP secret and QR code for 2FA setup.',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: '2FA setup initiated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TwoFactorSetupResponse' } } },
          },
        },
      },
    },
    '/auth/2fa/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Verify 2FA code',
        description: 'Verify a TOTP code to complete 2FA setup or authenticate.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: { type: 'string', example: '123456' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '2FA verified successfully' },
          '400': { description: 'Invalid code' },
        },
      },
    },
    '/auth/2fa/disable': {
      post: {
        tags: ['Auth'],
        summary: 'Disable two-factor authentication',
        description: 'Disable 2FA for the current user.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: {
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '2FA disabled' },
          '400': { description: 'Invalid password' },
        },
      },
    },
    '/auth/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'List active sessions',
        description: 'Get all active sessions for the current user.',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of sessions',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionsListResponse' } } },
          },
        },
      },
    },
    '/auth/sessions/{id}': {
      delete: {
        tags: ['Auth'],
        summary: 'Revoke a session',
        description: 'Revoke a specific session by ID.',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Session revoked' },
          '404': { description: 'Session not found' },
        },
      },
    },

    // ============================================
    // BOOKING ENDPOINTS
    // ============================================
    '/bookings': {
      get: {
        tags: ['Bookings'],
        summary: 'List all bookings',
        description: 'Retrieve a list of bookings with optional filtering.',
        security: [{ cookieAuth: [] }],
        parameters: [
          bookingParameters.status,
          bookingParameters.propertyId,
          bookingParameters.guestId,
          bookingParameters.checkInFrom,
          bookingParameters.checkInTo,
          bookingParameters.search,
          bookingParameters.limit,
          bookingParameters.offset,
        ],
        responses: {
          '200': {
            description: 'List of bookings',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingListResponse' } } },
          },
        },
      },
      post: {
        tags: ['Bookings'],
        summary: 'Create a new booking',
        description: 'Create a new booking with concurrency control. Supports idempotency keys to prevent duplicate bookings.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateBookingRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Booking created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Booking' },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error' },
          '409': { description: 'Booking conflict or lock conflict' },
          '410': { description: 'Lock expired' },
        },
      },
    },
    '/bookings/{id}': {
      get: {
        tags: ['Bookings'],
        summary: 'Get a booking by ID',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Booking details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Booking' },
                  },
                },
              },
            },
          },
          '404': { description: 'Booking not found' },
        },
      },
      put: {
        tags: ['Bookings'],
        summary: 'Update a booking',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateBookingRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Booking updated' },
          '404': { description: 'Booking not found' },
        },
      },
      delete: {
        tags: ['Bookings'],
        summary: 'Delete a booking (soft delete)',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Booking deleted' },
          '404': { description: 'Booking not found' },
        },
      },
    },
    '/bookings/conflicts': {
      get: {
        tags: ['Bookings'],
        summary: 'List booking conflicts',
        description: 'Get all detected booking conflicts for resolution.',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of conflicts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/BookingConflict' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/bookings/audit-logs': {
      get: {
        tags: ['Bookings'],
        summary: 'Get booking audit logs',
        description: 'Retrieve audit logs for booking changes.',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'bookingId',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by booking ID',
          },
        ],
        responses: {
          '200': {
            description: 'Audit logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/BookingAuditLog' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ============================================
    // GUEST ENDPOINTS
    // ============================================
    '/guests': {
      get: {
        tags: ['Guests'],
        summary: 'List all guests',
        description: 'Retrieve a list of guests with optional filtering.',
        security: [{ cookieAuth: [] }],
        parameters: [
          guestParameters.search,
          guestParameters.status,
          guestParameters.loyaltyTier,
          guestParameters.isVip,
          guestParameters.limit,
          guestParameters.offset,
        ],
        responses: {
          '200': {
            description: 'List of guests',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GuestListResponse' } } },
          },
        },
      },
      post: {
        tags: ['Guests'],
        summary: 'Create a new guest',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateGuestRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Guest created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Guest' },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error or duplicate email' },
        },
      },
    },
    '/guests/{id}': {
      get: {
        tags: ['Guests'],
        summary: 'Get a guest by ID',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Guest details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Guest' },
                  },
                },
              },
            },
          },
          '404': { description: 'Guest not found' },
        },
      },
      put: {
        tags: ['Guests'],
        summary: 'Update a guest',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateGuestRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Guest updated' },
          '404': { description: 'Guest not found' },
        },
      },
      delete: {
        tags: ['Guests'],
        summary: 'Delete a guest (soft delete)',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Guest deleted' },
          '404': { description: 'Guest not found' },
        },
      },
    },
    '/guests/{id}/loyalty': {
      get: {
        tags: ['Guests'],
        summary: 'Get guest loyalty information',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Loyalty information',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GuestLoyalty' } } },
          },
        },
      },
    },
    '/guests/{id}/preferences': {
      get: {
        tags: ['Guests'],
        summary: 'Get guest preferences',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Guest preferences',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GuestPreferences' } } },
          },
        },
      },
    },
    '/guests/{id}/journey': {
      get: {
        tags: ['Guests'],
        summary: 'Get guest journey history',
        description: 'Retrieve the complete guest journey including all touchpoints.',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Guest journey',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GuestJourney' } } },
          },
        },
      },
    },
    '/guests/{id}/stays': {
      get: {
        tags: ['Guests'],
        summary: 'Get guest stay history',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Stay history',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Booking' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ============================================
    // PROPERTY ENDPOINTS
    // ============================================
    '/properties': {
      get: {
        tags: ['Properties'],
        summary: 'List all properties',
        security: [{ cookieAuth: [] }],
        parameters: [propertyParameters.status, propertyParameters.type],
        responses: {
          '200': {
            description: 'List of properties',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PropertyListResponse' } } },
          },
        },
      },
      post: {
        tags: ['Properties'],
        summary: 'Create a new property',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePropertyRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Property created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Property' },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error or duplicate slug' },
        },
      },
    },
    '/properties/{id}': {
      get: {
        tags: ['Properties'],
        summary: 'Get a property by ID',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Property details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Property' },
                  },
                },
              },
            },
          },
          '404': { description: 'Property not found' },
        },
      },
      put: {
        tags: ['Properties'],
        summary: 'Update a property',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Property updated' },
          '404': { description: 'Property not found' },
        },
      },
      delete: {
        tags: ['Properties'],
        summary: 'Delete a property',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Property deleted' },
          '404': { description: 'Property not found' },
        },
      },
    },
    '/rooms': {
      get: {
        tags: ['Properties'],
        summary: 'List all rooms',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'propertyId',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'roomTypeId',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['available', 'occupied', 'maintenance', 'out_of_order', 'dirty'],
            },
          },
        ],
        responses: {
          '200': {
            description: 'List of rooms',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Room' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/room-types': {
      get: {
        tags: ['Properties'],
        summary: 'List all room types',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'propertyId',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'List of room types',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/RoomType' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ============================================
    // WIFI ENDPOINTS
    // ============================================
    '/wifi/sessions': {
      get: {
        tags: ['WiFi'],
        summary: 'List WiFi sessions',
        security: [{ cookieAuth: [] }],
        parameters: [
          wifiParameters.tenantId,
          wifiParameters.planId,
          wifiParameters.guestId,
          wifiParameters.bookingId,
          wifiParameters.status,
          wifiParameters.authMethod,
          wifiParameters.deviceType,
          wifiParameters.macAddress,
          wifiParameters.startTimeFrom,
          wifiParameters.startTimeTo,
          wifiParameters.search,
        ],
        responses: {
          '200': {
            description: 'List of WiFi sessions',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/WiFiSessionListResponse' } } },
          },
        },
      },
      post: {
        tags: ['WiFi'],
        summary: 'Start a WiFi session',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWiFiSessionRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Session started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/WiFiSession' },
                  },
                },
              },
            },
          },
          '400': { description: 'Session already exists or validation error' },
        },
      },
      put: {
        tags: ['WiFi'],
        summary: 'Update/End a WiFi session',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateWiFiSessionRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Session updated' },
          '404': { description: 'Session not found' },
        },
      },
    },
    '/wifi/plans': {
      get: {
        tags: ['WiFi'],
        summary: 'List WiFi plans',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of WiFi plans',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/WiFiPlan' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/wifi/vouchers': {
      get: {
        tags: ['WiFi'],
        summary: 'List WiFi vouchers',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of WiFi vouchers',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/WiFiVoucher' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['WiFi'],
        summary: 'Create WiFi vouchers',
        description: 'Generate WiFi vouchers for guests.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['planId', 'count'],
                properties: {
                  planId: { type: 'string' },
                  count: { type: 'integer', minimum: 1, maximum: 100 },
                  guestId: { type: 'string', nullable: true },
                  bookingId: { type: 'string', nullable: true },
                  validFrom: { type: 'string', format: 'date-time' },
                  validUntil: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Vouchers created' },
        },
      },
    },

    // ============================================
    // BILLING ENDPOINTS
    // ============================================
    '/folios': {
      get: {
        tags: ['Billing'],
        summary: 'List folios',
        security: [{ cookieAuth: [] }],
        parameters: [
          billingParameters.tenantId,
          billingParameters.propertyId,
          billingParameters.bookingId,
          billingParameters.guestId,
          billingParameters.status,
          billingParameters.search,
        ],
        responses: {
          '200': {
            description: 'List of folios',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/FolioListResponse' } } },
          },
        },
      },
      post: {
        tags: ['Billing'],
        summary: 'Create a folio',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateFolioRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Folio created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Folio' },
                  },
                },
              },
            },
          },
          '400': { description: 'Folio already exists or validation error' },
        },
      },
    },
    '/folios/{id}': {
      get: {
        tags: ['Billing'],
        summary: 'Get a folio by ID',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Folio details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Folio' },
                  },
                },
              },
            },
          },
          '404': { description: 'Folio not found' },
        },
      },
    },
    '/folios/{id}/line-items': {
      post: {
        tags: ['Billing'],
        summary: 'Add a line item to folio',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddLineItemRequest' },
            },
          },
        },
        responses: {
          '201': { description: 'Line item added' },
          '400': { description: 'Folio is closed' },
        },
      },
    },
    '/payments': {
      get: {
        tags: ['Billing'],
        summary: 'List payments',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of payments',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Payment' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Billing'],
        summary: 'Record a payment',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePaymentRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Payment recorded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Payment' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/invoices': {
      get: {
        tags: ['Billing'],
        summary: 'List invoices',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of invoices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Invoice' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/invoices/{id}/pdf': {
      get: {
        tags: ['Billing'],
        summary: 'Download invoice PDF',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Invoice PDF',
            content: {
              'application/pdf': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '404': { description: 'Invoice not found' },
        },
      },
    },

    // ============================================
    // CHANNEL MANAGER ENDPOINTS
    // ============================================
    '/channels/connections': {
      get: {
        tags: ['Channel Manager'],
        summary: 'List channel connections',
        security: [{ cookieAuth: [] }],
        parameters: [
          channelParameters.tenantId,
          channelParameters.status,
          channelParameters.channel,
          channelParameters.region,
          channelParameters.priority,
        ],
        responses: {
          '200': {
            description: 'List of connections',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ChannelConnectionListResponse' } } },
          },
        },
      },
      post: {
        tags: ['Channel Manager'],
        summary: 'Create a channel connection',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateChannelConnectionRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Connection created (pending activation)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/ChannelConnection' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid channel or duplicate connection' },
        },
      },
      put: {
        tags: ['Channel Manager'],
        summary: 'Update a channel connection',
        description: 'Update connection or perform actions like connect, disconnect, sync, or test.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateChannelConnectionRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Connection updated' },
          '404': { description: 'Connection not found' },
        },
      },
      delete: {
        tags: ['Channel Manager'],
        summary: 'Delete a channel connection',
        security: [{ cookieAuth: [] }],
        parameters: [channelParameters.id],
        responses: {
          '200': { description: 'Connection deleted' },
          '400': { description: 'Connection ID required' },
        },
      },
    },
    '/channels/mapping': {
      get: {
        tags: ['Channel Manager'],
        summary: 'List channel mappings',
        description: 'Get room type mappings between internal and OTA systems.',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of mappings',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ChannelMapping' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/channels/rate-sync': {
      post: {
        tags: ['Channel Manager'],
        summary: 'Sync rates to channels',
        description: 'Push rate updates to connected OTAs.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RateSyncRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Rate sync initiated' },
        },
      },
    },
    '/channels/inventory-sync': {
      post: {
        tags: ['Channel Manager'],
        summary: 'Sync inventory to channels',
        description: 'Push availability updates to connected OTAs.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InventorySyncRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Inventory sync initiated' },
        },
      },
    },
    '/channels/sync-logs': {
      get: {
        tags: ['Channel Manager'],
        summary: 'List sync logs',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of sync logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ChannelSyncLog' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ============================================
    // WEBHOOK ENDPOINTS
    // ============================================
    '/webhooks/events': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhook endpoints',
        security: [{ cookieAuth: [] }],
        parameters: [webhookParameters.tenantId, webhookParameters.status],
        responses: {
          '200': {
            description: 'List of webhook endpoints',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookListResponse' } } },
          },
        },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Create a webhook endpoint',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWebhookRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Webhook endpoint created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/WebhookEndpoint' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['Webhooks'],
        summary: 'Update a webhook endpoint',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateWebhookRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Webhook endpoint updated' },
          '404': { description: 'Webhook not found' },
        },
      },
      delete: {
        tags: ['Webhooks'],
        summary: 'Delete a webhook endpoint',
        security: [{ cookieAuth: [] }],
        parameters: [webhookParameters.id],
        responses: {
          '200': { description: 'Webhook endpoint deleted' },
          '400': { description: 'Webhook ID required' },
        },
      },
    },
    '/webhooks/delivery': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhook delivery logs',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of delivery logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/WebhookDeliveryLog' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default openApiSpec;
