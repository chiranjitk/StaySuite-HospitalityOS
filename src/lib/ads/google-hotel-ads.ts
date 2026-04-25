/**
 * Google Hotel Ads Service
 * Handles integration with Google Hotel Ads API for property feeds,
 * rate submissions, booking integration, and performance data retrieval.
 */

import { db } from '@/lib/db';

// Types for Google Hotel Ads
export interface HotelProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  website?: string;
  currency: string;
}

export interface RoomRate {
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string;
  ratePlanName: string;
  date: Date;
  price: number;
  currency: string;
  available: boolean;
  minStay?: number;
  maxStay?: number;
  cancellationPolicy?: string;
}

export interface BookingData {
  bookingId: string;
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
  roomTypeId: string;
  ratePlanId: string;
  guestName: string;
  guestEmail: string;
  totalPrice: number;
  currency: string;
  commission: number;
  status: 'confirmed' | 'cancelled';
}

export interface PerformanceMetrics {
  date: Date;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export class GoogleHotelAdsService {
  private tenantId: string;
  private propertyId: string;
  private connection: any;

  constructor(tenantId: string, propertyId: string) {
    this.tenantId = tenantId;
    this.propertyId = propertyId;
  }

  /**
   * Initialize the service by loading connection details
   */
  async initialize(): Promise<boolean> {
    try {
      this.connection = await db.googleHotelAdsConnection.findUnique({
        where: {
          tenantId_propertyId: {
            tenantId: this.tenantId,
            propertyId: this.propertyId,
          },
        },
      });

      return !!this.connection && this.connection.status === 'connected';
    } catch (error) {
      console.error('Error initializing Google Hotel Ads service:', error);
      return false;
    }
  }

  /**
   * Generate property feed in Google Hotel Ads format
   */
  async generatePropertyFeed(): Promise<{
    success: boolean;
    data?: HotelProperty;
    xml?: string;
    error?: string;
  }> {
    try {
      const property = await db.property.findUnique({
        where: { id: this.propertyId },
        include: {
          roomTypes: {
            where: { deletedAt: null },
          },
        },
      });

      if (!property) {
        return { success: false, error: 'Property not found' };
      }

      const hotelProperty: HotelProperty = {
        id: property.id,
        name: property.name,
        address: property.address,
        city: property.city,
        state: property.state || undefined,
        country: property.country,
        postalCode: property.postalCode || undefined,
        latitude: property.latitude || undefined,
        longitude: property.longitude || undefined,
        phone: property.phone || undefined,
        email: property.email || undefined,
        website: property.website || undefined,
        currency: property.currency,
      };

      // Generate XML feed
      const xml = this.generatePropertyXML(hotelProperty, property.roomTypes);

      return {
        success: true,
        data: hotelProperty,
        xml,
      };
    } catch (error: any) {
      console.error('Error generating property feed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate property XML in Google Hotel Ads format
   */
  private generatePropertyXML(property: HotelProperty, roomTypes: any[]): string {
    const roomTypeElements = roomTypes
      .map(
        (rt) => `
    <RoomID>${rt.id}</RoomID>
    <Name>${rt.name}</Name>
    <Description>${rt.description || ''}</Description>
    <Capacity>${rt.maxOccupancy}</Capacity>
    <PhotoURL>
      <URL>${JSON.parse(rt.images || '[]')[0] || ''}</URL>
    </PhotoURL>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Transaction timestamp="${new Date().toISOString()}">
  <PropertyDataSet>
    <Property>${property.id}</Property>
    <Name>${property.name}</Name>
    <Address>
      <Address1>${property.address}</Address1>
      <City>${property.city}</City>
      <State>${property.state || ''}</State>
      <Country>${property.country}</Country>
      <PostalCode>${property.postalCode || ''}</PostalCode>
    </Address>
    <Geolocation>
      <Latitude>${property.latitude || 0}</Latitude>
      <Longitude>${property.longitude || 0}</Longitude>
    </Geolocation>
    <Phone>${property.phone || ''}</Phone>
    <Email>${property.email || ''}</Email>
    <Website>${property.website || ''}</Website>
    <Currency>${property.currency}</Currency>
    <RoomTypes>
      ${roomTypeElements}
    </RoomTypes>
  </PropertyDataSet>
</Transaction>`;
  }

  /**
   * Generate rate feed for a date range
   */
  async generateRateFeed(
    startDate: Date,
    endDate: Date,
    roomTypeId?: string
  ): Promise<{
    success: boolean;
    data?: RoomRate[];
    xml?: string;
    error?: string;
  }> {
    try {
      const property = await db.property.findUnique({
        where: { id: this.propertyId },
        include: {
          roomTypes: {
            where: roomTypeId
              ? { id: roomTypeId, deletedAt: null }
              : { deletedAt: null },
            include: {
              ratePlans: {
                where: { deletedAt: null },
                include: {
                  priceOverrides: {
                    where: {
                      date: {
                        gte: startDate,
                        lte: endDate,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!property) {
        return { success: false, error: 'Property not found' };
      }

      const rates: RoomRate[] = [];

      // Generate rates for each room type and rate plan
      for (const roomType of property.roomTypes) {
        for (const ratePlan of roomType.ratePlans) {
          // Generate daily rates
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            // Check for price override
            const priceOverride = ratePlan.priceOverrides.find(
              (po) => po.date.toDateString() === currentDate.toDateString()
            );

            const price = priceOverride?.price || ratePlan.basePrice;

            rates.push({
              roomTypeId: roomType.id,
              roomTypeName: roomType.name,
              ratePlanId: ratePlan.id,
              ratePlanName: ratePlan.name,
              date: new Date(currentDate),
              price,
              currency: ratePlan.currency,
              available: true,
              minStay: ratePlan.minStay || undefined,
              maxStay: ratePlan.maxStay || undefined,
              cancellationPolicy: ratePlan.cancellationPolicy || undefined,
            });

            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }

      // Generate XML feed
      const xml = this.generateRateXML(property.id, rates);

      // Update last price feed timestamp
      if (this.connection) {
        await db.googleHotelAdsConnection.update({
          where: { id: this.connection.id },
          data: { lastPriceFeedAt: new Date() },
        });
      }

      return {
        success: true,
        data: rates,
        xml,
      };
    } catch (error: any) {
      console.error('Error generating rate feed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate rate XML in Google Hotel Ads format
   */
  private generateRateXML(propertyId: string, rates: RoomRate[]): string {
    const rateElements = rates
      .map(
        (rate) => `
    <Rate>
      <RoomID>${rate.roomTypeId}</RoomID>
      <RatePlanID>${rate.ratePlanId}</RatePlanID>
      <Date>${rate.date.toISOString().split('T')[0]}</Date>
      <Price>${rate.price}</Price>
      <Currency>${rate.currency}</Currency>
      <Availability>${rate.available ? 'available' : 'unavailable'}</Availability>
      ${rate.minStay ? `<MinStay>${rate.minStay}</MinStay>` : ''}
      ${rate.maxStay ? `<MaxStay>${rate.maxStay}</MaxStay>` : ''}
    </Rate>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Transaction timestamp="${new Date().toISOString()}">
  <Property>${propertyId}</Property>
  <Rates>
    ${rateElements}
  </Rates>
</Transaction>`;
  }

  /**
   * Submit booking data to Google Hotel Ads
   */
  async submitBooking(booking: BookingData): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // In a real implementation, this would call the Google Hotel Ads API
      // For now, we'll just update our tracking
      if (this.connection) {
        await db.googleHotelAdsConnection.update({
          where: { id: this.connection.id },
          data: {
            totalBookings: { increment: 1 },
            totalRevenue: { increment: booking.totalPrice },
            lastBookingFeedAt: new Date(),
          },
        });
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error submitting booking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve performance data from Google Hotel Ads
   */
  async getPerformanceData(
    startDate: Date,
    endDate: Date
  ): Promise<{
    success: boolean;
    data?: PerformanceMetrics[];
    error?: string;
  }> {
    try {
      // Get performance data from our stored metrics
      const campaigns = await db.adCampaign.findMany({
        where: {
          tenantId: this.tenantId,
          platform: 'google',
          performance: {
            some: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
        include: {
          performance: {
            where: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { date: 'asc' },
          },
        },
      });

      // Aggregate performance by date
      const performanceByDate = new Map<string, PerformanceMetrics>();

      for (const campaign of campaigns) {
        for (const perf of campaign.performance) {
          const dateKey = perf.date.toISOString().split('T')[0];
          const existing = performanceByDate.get(dateKey) || {
            date: perf.date,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            cost: 0,
            revenue: 0,
            ctr: 0,
            cpc: 0,
            roas: 0,
          };

          existing.impressions += perf.impressions;
          existing.clicks += perf.clicks;
          existing.conversions += perf.conversions;
          existing.cost += perf.cost;
          existing.revenue += perf.revenue;

          performanceByDate.set(dateKey, existing);
        }
      }

      // Calculate derived metrics
      const result = Array.from(performanceByDate.values()).map((perf) => ({
        ...perf,
        ctr: perf.impressions > 0 ? (perf.clicks / perf.impressions) * 100 : 0,
        cpc: perf.clicks > 0 ? perf.cost / perf.clicks : 0,
        roas: perf.cost > 0 ? perf.revenue / perf.cost : 0,
      }));

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error('Error retrieving performance data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate optimal bid based on historical performance
   */
  async calculateOptimalBid(
    roomTypeId: string,
    targetRoas: number = 2.0
  ): Promise<{
    success: boolean;
    bid?: number;
    recommendation?: string;
    error?: string;
  }> {
    try {
      // Get historical performance for the room type
      const campaigns = await db.adCampaign.findMany({
        where: {
          tenantId: this.tenantId,
          platform: 'google',
          roomTypes: { contains: roomTypeId },
        },
        include: {
          performance: {
            orderBy: { date: 'desc' },
            take: 30,
          },
        },
      });

      if (campaigns.length === 0) {
        return {
          success: true,
          bid: 2.0, // Default bid
          recommendation: 'No historical data. Starting with default bid.',
        };
      }

      // Calculate average ROAS
      let totalRevenue = 0;
      let totalCost = 0;

      for (const campaign of campaigns) {
        for (const perf of campaign.performance) {
          totalRevenue += perf.revenue;
          totalCost += perf.cost;
        }
      }

      const currentRoas = totalCost > 0 ? totalRevenue / totalCost : 0;
      const avgCpc = campaigns.reduce((sum, c) => sum + c.cpc, 0) / campaigns.length;

      // Adjust bid based on target ROAS
      let recommendedBid = avgCpc;
      if (currentRoas > targetRoas) {
        // Increase bid to capture more traffic
        recommendedBid *= 1.1;
      } else if (currentRoas < targetRoas && currentRoas > 0) {
        // Decrease bid to improve ROAS
        recommendedBid *= 0.9;
      }

      // Apply base bid modifier if set
      if (this.connection?.baseBidModifier) {
        recommendedBid *= this.connection.baseBidModifier;
      }

      return {
        success: true,
        bid: Math.round(recommendedBid * 100) / 100,
        recommendation: `Current ROAS: ${currentRoas.toFixed(
          2
        )}x. Target: ${targetRoas.toFixed(2)}x. ${
          currentRoas > targetRoas
            ? 'Increasing bid to capture more traffic.'
            : currentRoas < targetRoas
            ? 'Decreasing bid to improve ROAS.'
            : 'Bid is optimal.'
        }`,
      };
    } catch (error: any) {
      console.error('Error calculating optimal bid:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply automated bidding rules
   */
  async applyAutoBiddingRules(): Promise<{
    success: boolean;
    adjustments?: Array<{
      campaignId: string;
      oldBid: number;
      newBid: number;
      reason: string;
    }>;
    error?: string;
  }> {
    try {
      if (!this.connection?.autoBidEnabled) {
        return { success: true, adjustments: [] };
      }

      const adjustments: Array<{
        campaignId: string;
        oldBid: number;
        newBid: number;
        reason: string;
      }> = [];

      // Get all active Google campaigns
      const campaigns = await db.adCampaign.findMany({
        where: {
          tenantId: this.tenantId,
          platform: 'google',
          status: 'active',
        },
      });

      for (const campaign of campaigns) {
        const currentRoas = campaign.roas;
        const targetRoas = campaign.targetRoas || 2.0;
        const currentBid = campaign.bidAmount || 0;

        let newBid = currentBid;

        // Apply bidding rules
        if (currentRoas > targetRoas * 1.2) {
          // ROAS is significantly above target - increase bid
          newBid = currentBid * 1.15;
          adjustments.push({
            campaignId: campaign.id,
            oldBid: currentBid,
            newBid,
            reason: 'ROAS significantly above target, increasing bid',
          });
        } else if (currentRoas < targetRoas * 0.8 && currentRoas > 0) {
          // ROAS is below target - decrease bid
          newBid = currentBid * 0.85;
          adjustments.push({
            campaignId: campaign.id,
            oldBid: currentBid,
            newBid,
            reason: 'ROAS below target, decreasing bid',
          });
        }

        // Apply base modifier
        newBid *= this.connection.baseBidModifier;

        // Update campaign bid
        if (newBid !== currentBid) {
          await db.adCampaign.update({
            where: { id: campaign.id },
            data: { bidAmount: Math.round(newBid * 100) / 100 },
          });
        }
      }

      return { success: true, adjustments };
    } catch (error: any) {
      console.error('Error applying auto bidding rules:', error);
      return { success: false, error: error.message };
    }
  }
}

export default GoogleHotelAdsService;
