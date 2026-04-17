/**
 * Metasearch Client Service
 * Handles connectivity to metasearch platforms including TripAdvisor, Trivago, and Kayak.
 * Provides unified interface for rate feeds, availability updates, and performance tracking.
 */

import { db } from '@/lib/db';

// Platform types
export type MetasearchPlatform = 'tripadvisor' | 'trivago' | 'kayak' | 'skyscanner';

// Types for metasearch integration
export interface MetasearchConfig {
  platform: MetasearchPlatform;
  externalId?: string;
  connectionUrl?: string;
  feedFormat: 'xml' | 'json';
  apiKey?: string;
  hotelId?: string;
}

export interface MetasearchRate {
  roomTypeId: string;
  roomTypeName: string;
  date: Date;
  price: number;
  currency: string;
  available: boolean;
  deepLinkUrl?: string;
}

export interface MetasearchPerformance {
  platform: MetasearchPlatform;
  impressions: number;
  clicks: number;
  bookings: number;
  revenue: number;
  cost: number;
  ctr: number;
  conversionRate: number;
}

export interface ConnectionStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastError?: string;
  impressions: number;
  clicks: number;
  bookings: number;
}

// Platform-specific configurations
const PLATFORM_CONFIGS = {
  tripadvisor: {
    name: 'TripAdvisor',
    feedUrl: 'https://api.tripadvisor.com/api/partner',
    requiredFields: ['hotelId', 'apiKey'],
    supportedFormats: ['xml', 'json'],
  },
  trivago: {
    name: 'Trivago',
    feedUrl: 'https://affiliate.trivago.com/api/feeds',
    requiredFields: ['hotelId'],
    supportedFormats: ['xml'],
  },
  kayak: {
    name: 'Kayak',
    feedUrl: 'https://api.kayak.com/hotels',
    requiredFields: ['hotelId'],
    supportedFormats: ['xml', 'json'],
  },
  skyscanner: {
    name: 'Skyscanner',
    feedUrl: 'https://partners.skyscanner.net/hotels',
    requiredFields: ['hotelId', 'apiKey'],
    supportedFormats: ['xml', 'json'],
  },
};

export class MetasearchClient {
  private tenantId: string;
  private propertyId: string;
  private connections: Map<MetasearchPlatform, any>;

  constructor(tenantId: string, propertyId: string) {
    this.tenantId = tenantId;
    this.propertyId = propertyId;
    this.connections = new Map();
  }

  /**
   * Initialize the client by loading all connections
   */
  async initialize(): Promise<void> {
    try {
      const connections = await db.metasearchConnection.findMany({
        where: {
          tenantId: this.tenantId,
          propertyId: this.propertyId,
        },
      });

      for (const conn of connections) {
        this.connections.set(conn.platform as MetasearchPlatform, conn);
      }
    } catch (error) {
      console.error('Error initializing metasearch client:', error);
    }
  }

  /**
   * Get connection status for a platform
   */
  async getConnectionStatus(platform: MetasearchPlatform): Promise<ConnectionStatus> {
    const connection = this.connections.get(platform);

    if (!connection) {
      return {
        connected: false,
        impressions: 0,
        clicks: 0,
        bookings: 0,
      };
    }

    return {
      connected: connection.status === 'connected',
      lastSyncAt: connection.lastSyncAt || undefined,
      lastError: connection.lastError || undefined,
      impressions: connection.impressions,
      clicks: connection.clicks,
      bookings: connection.bookings,
    };
  }

  /**
   * Connect to a metasearch platform
   */
  async connectPlatform(config: MetasearchConfig): Promise<{
    success: boolean;
    connection?: any;
    error?: string;
  }> {
    try {
      const platformConfig = PLATFORM_CONFIGS[config.platform];

      // Validate required fields
      const missingFields = platformConfig.requiredFields.filter(
        (field) => !(field in config) || !(config as any)[field]
      );

      if (missingFields.length > 0) {
        return {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        };
      }

      // Check for existing connection
      const existing = await db.metasearchConnection.findUnique({
        where: {
          tenantId_propertyId_platform: {
            tenantId: this.tenantId,
            propertyId: this.propertyId,
            platform: config.platform,
          },
        },
      });

      let connection;

      if (existing) {
        // Update existing connection
        connection = await db.metasearchConnection.update({
          where: { id: existing.id },
          data: {
            externalId: config.externalId || existing.externalId,
            connectionUrl: config.connectionUrl || existing.connectionUrl,
            feedFormat: config.feedFormat,
            config: JSON.stringify(config),
            status: 'connected',
            lastError: null,
            lastErrorAt: null,
          },
        });
      } else {
        // Create new connection
        connection = await db.metasearchConnection.create({
          data: {
            tenantId: this.tenantId,
            propertyId: this.propertyId,
            platform: config.platform,
            externalId: config.externalId || null,
            connectionUrl: config.connectionUrl || null,
            feedFormat: config.feedFormat,
            config: JSON.stringify(config),
            status: 'connected',
          },
        });
      }

      this.connections.set(config.platform, connection);

      return { success: true, connection };
    } catch (error: any) {
      console.error('Error connecting to metasearch platform:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from a metasearch platform
   */
  async disconnectPlatform(platform: MetasearchPlatform): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await db.metasearchConnection.updateMany({
        where: {
          tenantId: this.tenantId,
          propertyId: this.propertyId,
          platform,
        },
        data: {
          status: 'disconnected',
        },
      });

      this.connections.delete(platform);

      return { success: true };
    } catch (error: any) {
      console.error('Error disconnecting from metasearch platform:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate rate feed for all connected platforms
   */
  async generateRateFeeds(startDate: Date, endDate: Date): Promise<{
    success: boolean;
    feeds?: Map<MetasearchPlatform, { xml?: string; json?: string }>;
    error?: string;
  }> {
    try {
      const property = await db.property.findUnique({
        where: { id: this.propertyId },
        include: {
          roomTypes: {
            where: { deletedAt: null },
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

      const feeds = new Map<MetasearchPlatform, { xml?: string; json?: string }>();

      // Generate rates
      const rates: MetasearchRate[] = [];
      for (const roomType of property.roomTypes) {
        for (const ratePlan of roomType.ratePlans) {
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const priceOverride = ratePlan.priceOverrides.find(
              (po) => po.date.toDateString() === currentDate.toDateString()
            );

            const price = priceOverride?.price || ratePlan.basePrice;

            rates.push({
              roomTypeId: roomType.id,
              roomTypeName: roomType.name,
              date: new Date(currentDate),
              price,
              currency: ratePlan.currency,
              available: true,
              deepLinkUrl: `${property.website}/book?room=${roomType.id}&rate=${ratePlan.id}&date=${currentDate.toISOString()}`,
            });

            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }

      // Generate feeds for each connected platform
      for (const [platform, connection] of this.connections) {
        if (connection.status !== 'connected') continue;

        const platformFeed: { xml?: string; json?: string } = {};

        if (connection.feedFormat === 'xml' || connection.feedFormat === 'xml') {
          platformFeed.xml = this.generateXMLFeed(platform, property, rates);
        }

        if (connection.feedFormat === 'json') {
          platformFeed.json = JSON.stringify(
            this.generateJSONFeed(platform, property, rates),
            null,
            2
          );
        }

        feeds.set(platform, platformFeed);

        // Update last sync
        await db.metasearchConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });
      }

      return { success: true, feeds };
    } catch (error: any) {
      console.error('Error generating rate feeds:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate XML feed for a platform
   */
  private generateXMLFeed(
    platform: MetasearchPlatform,
    property: any,
    rates: MetasearchRate[]
  ): string {
    const platformName = PLATFORM_CONFIGS[platform].name;

    const rateElements = rates
      .map(
        (rate) => `
    <Rate>
      <RoomType>${rate.roomTypeName}</RoomType>
      <Date>${rate.date.toISOString().split('T')[0]}</Date>
      <Price>${rate.price}</Price>
      <Currency>${rate.currency}</Currency>
      <Available>${rate.available}</Available>
      ${rate.deepLinkUrl ? `<DeepLink>${rate.deepLinkUrl}</DeepLink>` : ''}
    </Rate>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<HotelFeed xmlns="http://www.${platform}.com/hotel-feed">
  <Hotel>
    <Id>${property.id}</Id>
    <Name>${property.name}</Name>
    <Address>${property.address}</Address>
    <City>${property.city}</City>
    <Country>${property.country}</Country>
    <Currency>${property.currency}</Currency>
  </Hotel>
  <Rates>
    ${rateElements}
  </Rates>
</HotelFeed>`;
  }

  /**
   * Generate JSON feed for a platform
   */
  private generateJSONFeed(
    platform: MetasearchPlatform,
    property: any,
    rates: MetasearchRate[]
  ): object {
    return {
      hotel: {
        id: property.id,
        name: property.name,
        address: property.address,
        city: property.city,
        country: property.country,
        currency: property.currency,
      },
      rates: rates.map((rate) => ({
        roomType: rate.roomTypeName,
        date: rate.date.toISOString().split('T')[0],
        price: rate.price,
        currency: rate.currency,
        available: rate.available,
        deepLink: rate.deepLinkUrl,
      })),
    };
  }

  /**
   * Update performance metrics for a platform
   */
  async updatePerformance(
    platform: MetasearchPlatform,
    metrics: Partial<MetasearchPerformance>
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const connection = this.connections.get(platform);

      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const updateData: any = {};

      if (metrics.impressions !== undefined) {
        updateData.impressions = connection.impressions + metrics.impressions;
      }
      if (metrics.clicks !== undefined) {
        updateData.clicks = connection.clicks + metrics.clicks;
      }
      if (metrics.bookings !== undefined) {
        updateData.bookings = connection.bookings + metrics.bookings;
      }
      if (metrics.revenue !== undefined) {
        updateData.revenue = connection.revenue + metrics.revenue;
      }
      if (metrics.cost !== undefined) {
        updateData.cost = connection.cost + metrics.cost;
      }
      if (metrics.clicks !== undefined && metrics.impressions !== undefined) {
        updateData.ctr =
          metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
      }

      await db.metasearchConnection.update({
        where: { id: connection.id },
        data: updateData,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error updating performance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get aggregated performance across all platforms
   */
  async getAggregatedPerformance(): Promise<{
    success: boolean;
    data?: {
      platforms: MetasearchPerformance[];
      totals: {
        impressions: number;
        clicks: number;
        bookings: number;
        revenue: number;
        cost: number;
        avgCtr: number;
        avgConversionRate: number;
      };
    };
    error?: string;
  }> {
    try {
      const connections = await db.metasearchConnection.findMany({
        where: {
          tenantId: this.tenantId,
          propertyId: this.propertyId,
        },
      });

      const platforms: MetasearchPerformance[] = connections.map((conn) => ({
        platform: conn.platform as MetasearchPlatform,
        impressions: conn.impressions,
        clicks: conn.clicks,
        bookings: conn.bookings,
        revenue: conn.revenue,
        cost: conn.cost,
        ctr: conn.ctr,
        conversionRate: conn.clicks > 0 ? (conn.bookings / conn.clicks) * 100 : 0,
      }));

      const totals = {
        impressions: platforms.reduce((sum, p) => sum + p.impressions, 0),
        clicks: platforms.reduce((sum, p) => sum + p.clicks, 0),
        bookings: platforms.reduce((sum, p) => sum + p.bookings, 0),
        revenue: platforms.reduce((sum, p) => sum + p.revenue, 0),
        cost: platforms.reduce((sum, p) => sum + p.cost, 0),
        avgCtr: 0,
        avgConversionRate: 0,
      };

      totals.avgCtr =
        totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      totals.avgConversionRate =
        totals.clicks > 0 ? (totals.bookings / totals.clicks) * 100 : 0;

      return {
        success: true,
        data: {
          platforms,
          totals,
        },
      };
    } catch (error: any) {
      console.error('Error getting aggregated performance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync rate data to all connected platforms
   */
  async syncToAllPlatforms(startDate: Date, endDate: Date): Promise<{
    success: boolean;
    results?: Map<MetasearchPlatform, { success: boolean; error?: string }>;
    error?: string;
  }> {
    try {
      const feedResult = await this.generateRateFeeds(startDate, endDate);

      if (!feedResult.success || !feedResult.feeds) {
        return { success: false, error: feedResult.error };
      }

      const results = new Map<MetasearchPlatform, { success: boolean; error?: string }>();

      for (const [platform, feed] of feedResult.feeds) {
        // In a real implementation, this would make API calls to each platform
        // For now, we'll just mark it as successful
        results.set(platform, { success: true });
      }

      return { success: true, results };
    } catch (error: any) {
      console.error('Error syncing to platforms:', error);
      return { success: false, error: error.message };
    }
  }
}

export default MetasearchClient;
