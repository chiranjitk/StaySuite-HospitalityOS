/**
 * OTA Client Factory
 * Factory for creating OTA API clients
 */

import { OTAConfig, OTACredentials, OTAAPIClient } from './types';
import { ALL_OTAS, getOTAById } from './config';
import { BaseOTAClient } from './base-client';

// ============================================
// SPECIFIC OTA CLIENT IMPLEMENTATIONS
// ============================================

/**
 * Booking.com API Client
 * Uses XML-based API with Basic authentication
 */
class BookingComClient extends BaseOTAClient {
  private sessionId: string | null = null;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    
    try {
      // Booking.com uses a login endpoint to get a session
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
          },
          body: this.buildLoginXML(credentials),
        }
      );

      if (response.success !== false) {
        this.sessionId = response.session_id;
        return await this.testConnection();
      }

      return {
        success: false,
        message: 'Failed to authenticate with Booking.com',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Booking.com')],
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.fetchWithRetry(
          `${this.baseUrl}/xml/logout`,
          {
            method: 'POST',
            headers: this.getCommonHeaders(),
          }
        );
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
    }
    this.sessionId = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/hotels`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: this.buildHotelRequestXML(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Booking.com',
        propertyInfo: {
          id: this.credentials?.hotelId || '',
          name: response.hotel?.name || 'Unknown',
          roomCount: response.hotel?.rooms?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')],
      };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const xml = this.buildInventoryRequestXML(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/roomavailability`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseInventoryResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const xml = this.buildInventoryUpdateXML(updates);
    const correlationId = this.generateCorrelationId();
    
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/roomavailability`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const xml = this.buildRateRequestXML(startDate, endDate, roomTypeIds, ratePlanIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/hotelrates`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseRateResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const xml = this.buildRateUpdateXML(updates);
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/hotelrates`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const xml = this.buildRestrictionsRequestXML(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/restrictions`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseRestrictionsResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const xml = this.buildRestrictionsUpdateXML(updates);
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/restrictions`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const xml = this.buildBookingsRequestXML(startDate, endDate, status);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/reservations`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseBookingsResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const xml = this.buildSingleBookingRequestXML(externalId);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/reservations`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseSingleBookingResponse(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      const xml = this.buildConfirmBookingXML(externalId);
      await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/reservations`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      const xml = this.buildCancelBookingXML(externalId, reason);
      await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/reservations`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const eventType = headers['X-Booking-Event'] || 'unknown';
    
    return {
      success: true,
      eventType,
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return `/api/ota/webhooks/booking_com`;
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  // XML Builder methods
  private buildLoginXML(credentials: OTACredentials): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <username>${credentials.username || ''}</username>
  <password>${credentials.password || ''}</password>
</request>`;
  }

  private buildHotelRequestXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${this.credentials?.hotelId || ''}</hotel_id>
</request>`;
  }

  private buildInventoryRequestXML(startDate: Date, endDate: Date, roomTypeIds?: string[]): string {
    const roomsXml = roomTypeIds?.map(id => `<room_id>${id}</room_id>`).join('') || '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${this.credentials?.hotelId || ''}</hotel_id>
  <date_from>${this.formatDate(startDate)}</date_from>
  <date_to>${this.formatDate(endDate)}</date_to>
  <rooms>${roomsXml}</rooms>
</request>`;
  }

  private buildInventoryUpdateXML(updates: any[]): string {
    const updatesXml = updates.map(u => `
    <room>
      <room_id>${u.externalRoomId}</room_id>
      <date>${u.date}</date>
      <availability>${u.availableRooms}</availability>
    </room>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${this.credentials?.hotelId || ''}</hotel_id>
  <rooms>${updatesXml}
  </rooms>
</request>`;
  }

  private buildRateRequestXML(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${this.credentials?.hotelId || ''}</hotel_id>
  <date_from>${this.formatDate(startDate)}</date_from>
  <date_to>${this.formatDate(endDate)}</date_to>
</request>`;
  }

  private buildRateUpdateXML(updates: any[]): string {
    const updatesXml = updates.map(u => `
    <rate>
      <room_id>${u.externalRoomId}</room_id>
      <rate_plan_id>${u.externalRatePlanId}</rate_plan_id>
      <date>${u.date}</date>
      <price>${u.baseRate}</price>
      <currency>${u.currency}</currency>
    </rate>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${this.credentials?.hotelId || ''}</hotel_id>
  <rates>${updatesXml}
  </rates>
</request>`;
  }

  private buildRestrictionsRequestXML(startDate: Date, endDate: Date, roomTypeIds?: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${this.credentials?.hotelId || ''}</hotel_id>
  <date_from>${this.formatDate(startDate)}</date_from>
  <date_to>${this.formatDate(endDate)}</date_to>
</request>`;
  }

  private buildRestrictionsUpdateXML(updates: any[]): string {
    const updatesXml = updates.map(u => `
    <restriction>
      <room_id>${u.externalRoomId}</room_id>
      <date>${u.date}</date>
      <closed_to_arrival>${u.closedToArrival ? 1 : 0}</closed_to_arrival>
      <closed_to_departure>${u.closedToDeparture ? 1 : 0}</closed_to_departure>
      <closed>${u.closed ? 1 : 0}</closed>
      <min_stay>${u.minStayThrough || 1}</min_stay>
    </restriction>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${this.credentials?.hotelId || ''}</hotel_id>
  <restrictions>${updatesXml}
  </restrictions>
</request>`;
  }

  private buildBookingsRequestXML(startDate: Date, endDate: Date, status?: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${this.credentials?.hotelId || ''}</hotel_id>
  <checkin_from>${this.formatDate(startDate)}</checkin_from>
  <checkin_to>${this.formatDate(endDate)}</checkin_to>
</request>`;
  }

  private buildSingleBookingRequestXML(externalId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <reservation_id>${externalId}</reservation_id>
</request>`;
  }

  private buildConfirmBookingXML(externalId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <reservation_id>${externalId}</reservation_id>
  <status>confirmed</status>
</request>`;
  }

  private buildCancelBookingXML(externalId: string, reason: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <reservation_id>${externalId}</reservation_id>
  <status>cancelled</status>
  <cancellation_reason>${reason}</cancellation_reason>
</request>`;
  }

  // Response parsers
  private parseInventoryResponse(response: any): any[] {
    // Parse XML response to inventory data
    return response?.rooms?.map((r: any) => ({
      externalRoomId: r.room_id,
      date: r.date,
      availableRooms: r.availability,
      totalRooms: r.total || r.availability,
    })) || [];
  }

  private parseRateResponse(response: any): any[] {
    return response?.rates?.map((r: any) => ({
      externalRoomId: r.room_id,
      externalRatePlanId: r.rate_plan_id,
      date: r.date,
      baseRate: r.price,
      currency: r.currency,
      available: r.available !== 0,
    })) || [];
  }

  private parseRestrictionsResponse(response: any): any[] {
    return response?.restrictions?.map((r: any) => ({
      externalRoomId: r.room_id,
      date: r.date,
      closedToArrival: r.closed_to_arrival === 1,
      closedToDeparture: r.closed_to_departure === 1,
      closed: r.closed === 1,
      minStay: r.min_stay || 1,
      maxStay: r.max_stay || 99,
    })) || [];
  }

  private parseBookingsResponse(response: any): any[] {
    return response?.reservations?.map(this.parseBooking.bind(this)) || [];
  }

  private parseSingleBookingResponse(response: any): any {
    return this.parseBooking(response?.reservation);
  }

  private parseBooking(r: any): any {
    return {
      guest: {
        firstName: r.guest_first_name,
        lastName: r.guest_last_name,
        email: r.guest_email,
        phone: r.guest_phone,
        country: r.guest_country,
      },
      room: {
        externalRoomId: r.room_id,
        externalRatePlanId: r.rate_plan_id,
      },
      dates: {
        checkIn: r.checkin_date,
        checkOut: r.checkout_date,
      },
      guests: {
        adults: r.num_adults || 1,
        children: r.num_children || 0,
      },
      pricing: {
        roomRate: r.room_rate,
        taxes: r.taxes || 0,
        fees: r.fees || 0,
        discount: r.discount || 0,
        totalAmount: r.total_price,
        currency: r.currency,
        commission: r.commission || 0,
        commissionType: 'percentage' as const,
      },
      payment: {
        method: r.prepaid ? 'prepaid' : 'collect',
      },
      specialRequests: r.special_requests,
      createdAt: r.created_at,
      source: 'booking_com',
    };
  }
}

/**
 * Expedia API Client
 * Uses REST API with OAuth2 authentication
 */
class ExpediaClient extends BaseOTAClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    
    try {
      const tokenResponse = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/auth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            username: credentials.username || '',
            password: credentials.password || '',
          }).toString(),
        }
      );

      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
        return await this.testConnection();
      }

      return {
        success: false,
        message: 'Failed to authenticate with Expedia',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Expedia')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Expedia',
        propertyInfo: {
          id: response.hotelId,
          name: response.name,
          roomCount: response.roomCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/inventory?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}` +
      (roomTypeIds ? `&roomTypeIds=${roomTypeIds.join(',')}` : ''),
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.inventory || [];
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/inventory`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/rates?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.rates || [];
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/rates`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/restrictions?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.restrictions || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/restrictions`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/bookings?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}` +
      (status ? `&status=${status.join(',')}` : ''),
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.bookings || [];
  }

  async getBooking(externalId: string): Promise<any> {
    return await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/bookings/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/bookings/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/bookings/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return {
      success: true,
      eventType: headers['X-Expedia-Event'] || 'unknown',
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return `/api/ota/webhooks/expedia`;
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) {
      return { 'Authorization': `Bearer ${this.accessToken}` };
    }
    return super.getAuthHeaders();
  }
}

/**
 * Generic REST API Client
 * Used for OTAs with similar REST API structures
 */
class GenericRestClient extends BaseOTAClient {
  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    return await this.testConnection();
  }

  async disconnect(): Promise<void> {
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/properties/${this.credentials?.hotelId}`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: `Successfully connected to ${this.config.name}`,
        propertyInfo: {
          id: response.id || this.credentials?.hotelId,
          name: response.name || 'Unknown',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/inventory?` +
      `propertyId=${this.credentials?.hotelId}&` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.data || response.inventory || [];
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/inventory/bulk`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ propertyId: this.credentials?.hotelId, updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/rates?` +
      `propertyId=${this.credentials?.hotelId}&` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.data || response.rates || [];
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/rates/bulk`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ propertyId: this.credentials?.hotelId, updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/restrictions?` +
      `propertyId=${this.credentials?.hotelId}&` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.data || response.restrictions || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/restrictions/bulk`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ propertyId: this.credentials?.hotelId, updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({
      propertyId: this.credentials?.hotelId || '',
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });
    
    if (status?.length) {
      params.append('status', status.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/bookings?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.data || response.bookings || [];
  }

  async getBooking(externalId: string): Promise<any> {
    return await this.fetchWithRetry<any>(
      `${this.baseUrl}/bookings/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/bookings/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/bookings/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return {
      success: true,
      eventType: headers['X-Event-Type'] || 'unknown',
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return `/api/ota/webhooks/${this.config.id}`;
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }
}

// ============================================
// CLIENT FACTORY
// ============================================

export class OTAClientFactory {
  private static clients: Map<string, OTAAPIClient> = new Map();

  /**
   * Create or get an OTA client instance
   */
  static createClient(channelId: string): OTAAPIClient | null {
    // Check if we already have a cached client
    if (this.clients.has(channelId)) {
      return this.clients.get(channelId)!;
    }

    const config = getOTAById(channelId);
    if (!config) {
      console.error(`Unknown OTA channel: ${channelId}`);
      return null;
    }

    let client: OTAAPIClient;

    // Select the appropriate client based on channel
    switch (channelId) {
      case 'booking_com':
        client = new BookingComClient(config);
        break;
      
      case 'expedia':
      case 'hotels_com':
        client = new ExpediaClient(config);
        break;
      
      default:
        client = new GenericRestClient(config);
    }

    this.clients.set(channelId, client);
    return client;
  }

  /**
   * Get a client with credentials set
   */
  static async getAuthenticatedClient(
    channelId: string,
    credentials: OTACredentials
  ): Promise<OTAAPIClient | null> {
    const client = this.createClient(channelId);
    if (!client) return null;

    const result = await client.connect(credentials);
    if (!result.success) {
      console.error(`Failed to authenticate ${channelId}:`, result.message);
      return null;
    }

    return client;
  }

  /**
   * Clear cached client
   */
  static clearClient(channelId: string): void {
    this.clients.delete(channelId);
  }

  /**
   * Clear all cached clients
   */
  static clearAll(): void {
    this.clients.clear();
  }
}

/**
 * Get all available OTA configurations
 */
export function getAllOTAs(): OTAConfig[] {
  return ALL_OTAS;
}

/**
 * Get OTA configuration by ID
 */
export function getOTAConfig(channelId: string): OTAConfig | undefined {
  return getOTAById(channelId);
}
