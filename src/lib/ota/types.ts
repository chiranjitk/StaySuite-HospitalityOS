/**
 * OTA (Online Travel Agency) Integration Types
 * Production-ready types for 48+ OTA channels
 */

// ============================================
// CORE OTA TYPES
// ============================================

export type OTARegion = 'global' | 'india' | 'asia_pacific' | 'europe' | 'middle_east' | 'africa' | 'americas';
export type OTAType = 'ota' | 'vacation_rental' | 'metasearch' | 'gds' | 'wholesale';
export type OTAPriority = 'critical' | 'high' | 'medium' | 'low';

export interface OTAConfig {
  id: string;
  name: string;
  displayName: string;
  logo: string;
  color: string;
  region: OTARegion;
  type: OTAType;
  priority: OTAPriority;
  features: OTAFeature[];
  commission: {
    min: number;
    max: number;
    type: 'percentage' | 'fixed' | 'hybrid';
  };
  apiConfig: OTAAPIConfig;
  supportedLanguages: string[];
  supportedCurrencies: string[];
  website: string;
  documentation: string;
  marketShare?: number;
  monthlyVisitors?: number;
}

export type OTAFeature = 'inventory' | 'rates' | 'restrictions' | 'bookings' | 'reviews' | 'payments' | 'messaging';

export interface OTAAPIConfig {
  type: 'rest' | 'soap' | 'graphql' | 'xml' | 'json';
  authType: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'signature' | 'certificate';
  baseUrl: string;
  sandboxUrl?: string;
  rateLimit: {
    requests: number;
    period: 'second' | 'minute' | 'hour';
  };
  timeout: number;
  retryAttempts: number;
  requiresApproval: boolean;
  webhookSupport: boolean;
  realTimeSync: boolean;
}

// ============================================
// CONNECTION TYPES
// ============================================

export interface OTAConnection {
  id: string;
  tenantId: string;
  channelId: string;
  displayName: string;
  credentials: OTACredentials;
  hotelMapping: OTAHotelMapping;
  settings: OTASettings;
  status: OTAConnectionStatus;
  health: OTAHealthStatus;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
  lastError?: string;
}

export interface OTACredentials {
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  hotelId?: string;
  propertyId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  certificate?: string;
  signature?: string;
  additionalFields?: Record<string, string>;
}

export interface OTAHotelMapping {
  internalPropertyId: string;
  externalPropertyId: string;
  externalPropertyName?: string;
  roomMappings: OTARoomMapping[];
  rateMappings: OTARateMapping[];
}

export interface OTARoomMapping {
  internalRoomTypeId: string;
  internalRoomTypeName: string;
  externalRoomId: string;
  externalRoomName: string;
  isActive: boolean;
}

export interface OTARateMapping {
  internalRatePlanId: string;
  internalRatePlanName: string;
  externalRatePlanId: string;
  externalRatePlanName: string;
  mealPlan?: string;
  isActive: boolean;
}

export interface OTASettings {
  autoSync: boolean;
  syncInterval: number; // minutes
  syncInventory: boolean;
  syncRates: boolean;
  syncRestrictions: boolean;
  syncBookings: boolean;
  syncImages: boolean;
  imageResize?: {
    maxWidth: number;
    maxHeight: number;
  };
  notificationEmails: string[];
  notifyOnError: boolean;
  notifyOnBooking: boolean;
  notifyOnModification: boolean;
  notifyOnCancellation: boolean;
}

export type OTAConnectionStatus = 'pending' | 'connecting' | 'active' | 'error' | 'disconnected' | 'suspended';
export type OTAHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// ============================================
// SYNC TYPES
// ============================================

export interface OTASyncRequest {
  connectionId: string;
  syncType: OTASyncType;
  direction: 'inbound' | 'outbound';
  data: OTASyncData;
  correlationId: string;
  idempotencyKey?: string;
}

export type OTASyncType = 'inventory' | 'rates' | 'restrictions' | 'bookings' | 'full' | 'delta';

export interface OTASyncData {
  inventory?: OTAInventoryUpdate[];
  rates?: OTARateUpdate[];
  restrictions?: OTARestrictionUpdate[];
  bookings?: OTABookingUpdate[];
}

export interface OTAInventoryUpdate {
  roomTypeId: string;
  externalRoomId: string;
  date: string; // YYYY-MM-DD
  availableRooms: number;
  totalRooms: number;
}

export interface OTARateUpdate {
  roomTypeId: string;
  ratePlanId: string;
  externalRoomId: string;
  externalRatePlanId: string;
  date: string;
  baseRate: number;
  currency: string;
  extraAdultRate?: number;
  extraChildRate?: number;
  minLOS?: number;
  maxLOS?: number;
  minAdvanceBooking?: number;
  cancellationPolicyId?: string;
}

export interface OTARestrictionUpdate {
  roomTypeId: string;
  externalRoomId: string;
  date: string;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  closed: boolean;
  minStayThrough?: number;
  maxStayThrough?: number;
  minStayArrival?: number;
  maxStayArrival?: number;
}

export interface OTABookingUpdate {
  action: 'create' | 'modify' | 'cancel';
  externalBookingId: string;
  externalReservationId?: string;
  bookingData: OTABookingData;
}

export interface OTABookingData {
  guest: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    country?: string;
    language?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  room: {
    externalRoomId: string;
    externalRatePlanId?: string;
  };
  dates: {
    checkIn: string;
    checkOut: string;
  };
  guests: {
    adults: number;
    children: number;
    infants?: number;
  };
  pricing: {
    roomRate: number;
    taxes: number;
    fees: number;
    discount: number;
    totalAmount: number;
    currency: string;
    commission: number;
    commissionType: 'percentage' | 'fixed';
  };
  payment: {
    method: 'prepaid' | 'collect' | 'deposit';
    prepaidAmount?: number;
    collectAmount?: number;
    depositAmount?: number;
    depositDueDate?: string;
  };
  specialRequests?: string;
  comments?: string;
  internalNotes?: string;
  createdAt: string;
  modifiedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  source: string;
}

// ============================================
// SYNC RESPONSE TYPES
// ============================================

export interface OTASyncResponse {
  success: boolean;
  connectionId: string;
  syncType: OTASyncType;
  direction: 'inbound' | 'outbound';
  correlationId: string;
  timestamp: Date;
  results: OTASyncResult[];
  errors?: OTAError[];
  warnings?: string[];
}

export interface OTASyncResult {
  type: 'inventory' | 'rates' | 'restrictions' | 'bookings';
  success: boolean;
  count: number;
  failed: number;
  details?: Record<string, unknown>;
}

export interface OTAError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  context?: Record<string, unknown>;
  retryable: boolean;
}

// ============================================
// API CLIENT INTERFACE
// ============================================

export interface OTAAPIClient {
  // Connection
  connect(credentials: OTACredentials): Promise<OTAConnectionTestResult>;
  disconnect(): Promise<void>;
  testConnection(): Promise<OTAConnectionTestResult>;
  
  // Inventory
  getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<OTAInventoryData[]>;
  updateInventory(updates: OTAInventoryUpdate[]): Promise<OTASyncResponse>;
  
  // Rates
  getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<OTARateData[]>;
  updateRates(updates: OTARateUpdate[]): Promise<OTASyncResponse>;
  
  // Restrictions
  getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<OTARestrictionData[]>;
  updateRestrictions(updates: OTARestrictionUpdate[]): Promise<OTASyncResponse>;
  
  // Bookings
  getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<OTABookingData[]>;
  getBooking(externalId: string): Promise<OTABookingData>;
  confirmBooking(externalId: string): Promise<boolean>;
  cancelBooking(externalId: string, reason: string): Promise<boolean>;
  
  // Webhooks
  processWebhook(payload: unknown, headers: Record<string, string>): Promise<OTAWebhookResult>;
  getWebhookUrl(): string;
  
  // Health
  getHealthStatus(): Promise<OTAHealthStatus>;
}

export interface OTAConnectionTestResult {
  success: boolean;
  message: string;
  propertyInfo?: {
    id: string;
    name: string;
    address?: string;
    roomCount?: number;
  };
  availableRooms?: {
    id: string;
    name: string;
  }[];
  availableRatePlans?: {
    id: string;
    name: string;
    roomId: string;
  }[];
  errors?: OTAError[];
}

export interface OTAInventoryData {
  externalRoomId: string;
  date: string;
  availableRooms: number;
  totalRooms: number;
}

export interface OTARateData {
  externalRoomId: string;
  externalRatePlanId: string;
  date: string;
  baseRate: number;
  currency: string;
  available: boolean;
}

export interface OTARestrictionData {
  externalRoomId: string;
  date: string;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  closed: boolean;
  minStay: number;
  maxStay: number;
}

export interface OTAWebhookResult {
  success: boolean;
  eventType: string;
  data?: unknown;
  response: {
    statusCode: number;
    body?: string;
  };
}

// ============================================
// SYNC LOG TYPES
// ============================================

export interface OTASyncLog {
  id: string;
  connectionId: string;
  syncType: OTASyncType;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'processing' | 'success' | 'partial' | 'failed';
  requestPayload?: string;
  responsePayload?: string;
  statusCode?: number;
  errorMessage?: string;
  attemptCount: number;
  correlationId: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  recordsProcessed: number;
  recordsFailed: number;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export type OTAWebhookEventType = 
  | 'booking.created'
  | 'booking.modified'
  | 'booking.cancelled'
  | 'booking.no_show'
  | 'payment.received'
  | 'payment.refunded'
  | 'review.posted'
  | 'inventory.updated'
  | 'rate.updated';

export interface OTAWebhookPayload {
  eventId: string;
  eventType: OTAWebhookEventType;
  timestamp: string;
  channelId: string;
  hotelId: string;
  data: unknown;
  signature?: string;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface OTAAnalytics {
  channelId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalBookings: number;
    totalRevenue: number;
    averageRate: number;
    occupancyRate: number;
    commissionPaid: number;
    cancellationRate: number;
    averageLeadTime: number;
    averageLOS: number;
  };
  byRoomType: Record<string, {
    bookings: number;
    revenue: number;
    avgRate: number;
  }>;
  byRatePlan: Record<string, {
    bookings: number;
    revenue: number;
    avgRate: number;
  }>;
  trends: {
    date: string;
    bookings: number;
    revenue: number;
    avgRate: number;
  }[];
}
