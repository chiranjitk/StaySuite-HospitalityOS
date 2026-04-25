/**
 * GDPR Compliance Service
 * 
 * Comprehensive GDPR compliance features for StaySuite HospitalityOS
 * 
 * Features:
 * - Data export (JSON/CSV) for data portability
 * - Data deletion (soft delete and hard delete)
 * - Data anonymization while preserving analytics
 * - Consent management
 * - Request tracking and audit trail
 */

import { db } from '@/lib/db';
import type { Guest, Booking, Payment, GDPRRequest, ConsentRecord } from '@prisma/client';
import { randomUUID } from 'crypto';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export type GDPRRequestType = 'export' | 'delete' | 'anonymize' | 'rectify' | 'restrict';
export type GDPRRequestStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'failed';
export type ConsentType = 'marketing' | 'analytics' | 'third_party' | 'cookies' | 'essential' | 'profiling';
export type ConsentCategory = 'preferences' | 'marketing' | 'analytics' | 'third_party' | 'essential';

export interface ExportDataOptions {
  format: 'json' | 'csv';
  includeBookings: boolean;
  includePayments: boolean;
  includePreferences: boolean;
  includeDocuments: boolean;
  includeCommunications: boolean;
  maxRecords?: number; // Limit records per section to prevent timeout
}

export interface CreateGDPRRequestInput {
  tenantId: string;
  guestId?: string;
  requestType: GDPRRequestType;
  requestSource?: string;
  requesterEmail?: string;
  requesterName?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
}

export interface CreateConsentInput {
  tenantId: string;
  guestId?: string;
  userId?: string;
  consentType: ConsentType;
  consentCategory?: ConsentCategory;
  granted: boolean;
  grantedVia?: string;
  ipAddress?: string;
  userAgent?: string;
  consentText?: string;
  consentVersion?: string;
}

export interface GuestExportData {
  profile: Record<string, unknown>;
  bookings: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  preferences: Record<string, unknown>;
  documents: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
  feedback: Record<string, unknown>[];
  loyaltyTransactions: Record<string, unknown>[];
  stays: Record<string, unknown>[];
  exportMetadata: {
    exportedAt: string;
    format: string;
    guestId: string;
  };
}

// =====================================================
// GDPR SERVICE CLASS
// =====================================================

class GDPRService {
  /**
   * Create a new GDPR request
   */
  async createRequest(input: CreateGDPRRequestInput): Promise<GDPRRequest> {
    const verificationToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days to complete

    const request = await db.gDPRRequest.create({
      data: {
        tenantId: input.tenantId,
        guestId: input.guestId,
        requestType: input.requestType,
        requestSource: input.requestSource || 'guest',
        requesterEmail: input.requesterEmail,
        requesterName: input.requesterName,
        verificationToken,
        expiresAt,
        priority: input.priority || 'normal',
        notes: input.notes,
        status: 'pending',
      },
    });

    return request;
  }

  /**
   * Get GDPR request by ID
   */
  async getRequest(id: string, tenantId: string): Promise<GDPRRequest | null> {
    return db.gDPRRequest.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Get all GDPR requests for a tenant
   */
  async getRequests(tenantId: string, filters?: {
    status?: GDPRRequestStatus;
    requestType?: GDPRRequestType;
    guestId?: string;
  }): Promise<GDPRRequest[]> {
    return db.gDPRRequest.findMany({
      where: {
        tenantId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.requestType && { requestType: filters.requestType }),
        ...(filters?.guestId && { guestId: filters.guestId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update GDPR request status
   */
  async updateRequestStatus(
    id: string,
    tenantId: string,
    status: GDPRRequestStatus,
    updates?: {
      notes?: string;
      rejectionReason?: string;
      completedBy?: string;
      downloadUrl?: string;
      downloadExpiresAt?: Date;
    }
  ): Promise<GDPRRequest> {
    return db.gDPRRequest.update({
      where: { id },
      data: {
        status,
        ...(status === 'completed' && { completedAt: new Date() }),
        ...(status === 'completed' && updates?.completedBy && { completedBy: updates.completedBy }),
        ...(updates?.notes && { notes: updates.notes }),
        ...(updates?.rejectionReason && { rejectionReason: updates.rejectionReason }),
        ...(updates?.downloadUrl && { downloadUrl: updates.downloadUrl }),
        ...(updates?.downloadExpiresAt && { downloadExpiresAt: updates.downloadExpiresAt }),
      },
    });
  }

  /**
   * Export all guest data for GDPR data portability
   */
  async exportGuestData(
    guestId: string,
    tenantId: string,
    options: ExportDataOptions = {
      format: 'json',
      includeBookings: true,
      includePayments: true,
      includePreferences: true,
      includeDocuments: true,
      includeCommunications: true,
    }
  ): Promise<GuestExportData> {
    // Get guest profile
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId, deletedAt: null },
      include: {
        documents: true,
        reviews: true,
        feedback: true,
        loyaltyTransactions: true,
        stays: {
          include: {
            booking: {
              include: {
                roomType: { select: { name: true } },
                room: { select: { number: true } },
              },
            },
          },
        },
        behavior: true,
        journeyEvents: true,
        recommendations: true,
        segmentMemberships: {
          include: {
            segment: { select: { name: true } },
          },
        },
      },
    });

    if (!guest) {
      throw new Error('Guest not found');
    }

    // Get bookings
    let bookings: Record<string, unknown>[] = [];
    if (options.includeBookings) {
      const bookingsData = await db.booking.findMany({
        where: { primaryGuestId: guestId, deletedAt: null },
        include: {
          roomType: { select: { name: true, code: true } },
          room: { select: { number: true, floor: true } },
          folios: {
            include: {
              lineItems: true,
            },
          },
          auditLogs: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      bookings = bookingsData.map(b => this.sanitizeForExport(b));
    }

    // Get payments
    let payments: Record<string, unknown>[] = [];
    if (options.includePayments) {
      const paymentsData = await db.payment.findMany({
        where: { guestId },
        orderBy: { createdAt: 'desc' },
      });
      payments = paymentsData.map(p => this.sanitizeForExport(p));
    }

    // Parse preferences
    const preferences = guest.preferences ? JSON.parse(guest.preferences) : {};

    // Build export data
    const exportData: GuestExportData = {
      profile: this.sanitizeForExport({
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        alternatePhone: guest.alternatePhone,
        nationality: guest.nationality,
        dateOfBirth: guest.dateOfBirth,
        gender: guest.gender,
        address: guest.address,
        city: guest.city,
        state: guest.state,
        country: guest.country,
        postalCode: guest.postalCode,
        loyaltyTier: guest.loyaltyTier,
        loyaltyPoints: guest.loyaltyPoints,
        totalStays: guest.totalStays,
        totalSpent: guest.totalSpent,
        isVip: guest.isVip,
        source: guest.source,
        emailOptIn: guest.emailOptIn,
        smsOptIn: guest.smsOptIn,
        createdAt: guest.createdAt,
      }),
      bookings,
      payments,
      preferences,
      documents: options.includeDocuments 
        ? guest.documents.map(d => ({
            id: d.id,
            type: d.type,
            name: d.name,
            status: d.status,
            verifiedAt: d.verifiedAt,
            createdAt: d.createdAt,
          }))
        : [],
      reviews: guest.reviews.map(r => this.sanitizeForExport(r)),
      feedback: guest.feedback.map(f => this.sanitizeForExport(f)),
      loyaltyTransactions: guest.loyaltyTransactions.map(t => this.sanitizeForExport(t)),
      stays: guest.stays.map(s => this.sanitizeForExport(s)),
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        format: options.format,
        guestId,
      },
    };

    return exportData;
  }

  /**
   * Convert export data to CSV format
   */
  exportToCSV(data: GuestExportData, section: keyof GuestExportData): string {
    const sectionData = data[section];
    if (!Array.isArray(sectionData) || sectionData.length === 0) {
      return '';
    }

    const headers = Object.keys(sectionData[0]);
    const csvRows = [headers.join(',')];

    for (const row of sectionData) {
      const values = headers.map(header => {
        const value = (row as Record<string, unknown>)[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Anonymize guest data while preserving analytics
   */
  async anonymizeGuestData(
    guestId: string,
    tenantId: string,
    options: {
      preserveAnalytics?: boolean;
      preserveFinancialRecords?: boolean;
    } = {}
  ): Promise<{ success: boolean; anonymizedFields: string[] }> {
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId, deletedAt: null },
    });

    if (!guest) {
      throw new Error('Guest not found');
    }

    // Capture snapshot before anonymization
    const dataSnapshot = JSON.stringify(this.sanitizeForExport(guest));

    const anonymizedFields: string[] = [];

    // Generate anonymous identifier
    const anonymousId = `anon_${randomUUID().split('-')[0]}`;

    // Update guest record with anonymized data
    const updateData: Record<string, unknown> = {
      firstName: 'Anonymous',
      lastName: 'Guest',
      email: `${anonymousId}@anonymized.invalid`,
      phone: null,
      alternatePhone: null,
      dateOfBirth: null,
      gender: null,
      idType: null,
      idNumber: null,
      idExpiry: null,
      idCountry: null,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      avatar: null,
      notes: null,
      specialRequests: null,
    };

    anonymizedFields.push(...Object.keys(updateData));

    // If preserving analytics, keep aggregated data
    if (!options.preserveAnalytics) {
      updateData.preferences = '{}';
      updateData.tags = '[]';
      updateData.totalStays = 0;
      updateData.totalSpent = 0;
      updateData.loyaltyPoints = 0;
    }

    await db.guest.update({
      where: { id: guestId },
      data: updateData,
    });

    // Delete or anonymize related records
    await db.guestDocument.deleteMany({
      where: { guestId },
    });

    await db.guestReview.updateMany({
      where: { guestId },
      data: {
        title: null,
        comment: null,
      },
    });

    await db.guestFeedback.updateMany({
      where: { guestId },
      data: {
        subject: '[Anonymized]',
        description: '[Content removed for privacy]',
      },
    });

    // Delete behavior data
    await db.guestBehavior.deleteMany({
      where: { guestId },
    });

    await db.guestJourney.deleteMany({
      where: { guestId },
    });

    await db.guestRecommendation.deleteMany({
      where: { guestId },
    });

    // Update GDPR request with snapshot
    await db.gDPRRequest.updateMany({
      where: { guestId, tenantId, requestType: 'anonymize', status: 'processing' },
      data: { dataSnapshot },
    });

    return { success: true, anonymizedFields };
  }

  /**
   * Delete guest data (soft delete by default, hard delete with option)
   */
  async deleteGuestData(
    guestId: string,
    tenantId: string,
    options: {
      hardDelete?: boolean;
      preserveFinancialRecords?: boolean;
    } = {}
  ): Promise<{ success: boolean; deletedRecords: string[] }> {
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId, deletedAt: null },
      include: {
        bookings: {
          where: {
            status: { in: ['confirmed', 'checked_in'] },
          },
        },
      },
    });

    if (!guest) {
      throw new Error('Guest not found');
    }

    // Check for active bookings
    if (guest.bookings.length > 0) {
      throw new Error('Cannot delete guest with active bookings');
    }

    // Capture snapshot before deletion
    const dataSnapshot = JSON.stringify(this.sanitizeForExport(guest));

    const deletedRecords: string[] = [];

    if (options.hardDelete) {
      // Hard delete - remove all related records
      await db.guestDocument.deleteMany({ where: { guestId } });
      deletedRecords.push('documents');

      await db.guestReview.deleteMany({ where: { guestId } });
      deletedRecords.push('reviews');

      await db.guestFeedback.deleteMany({ where: { guestId } });
      deletedRecords.push('feedback');

      await db.guestBehavior.deleteMany({ where: { guestId } });
      deletedRecords.push('behavior');

      await db.guestJourney.deleteMany({ where: { guestId } });
      deletedRecords.push('journey');

      await db.guestRecommendation.deleteMany({ where: { guestId } });
      deletedRecords.push('recommendations');

      await db.segmentMembership.deleteMany({ where: { guestId } });
      deletedRecords.push('segment_memberships');

      await db.guestStay.deleteMany({ where: { guestId } });
      deletedRecords.push('stays');

      await db.loyaltyPointTransaction.deleteMany({ where: { guestId } });
      deletedRecords.push('loyalty_transactions');

      await db.loyaltyRedemption.deleteMany({ where: { guestId } });
      deletedRecords.push('loyalty_redemptions');

      if (!options.preserveFinancialRecords) {
        // Anonymize payments instead of deleting (for accounting purposes)
        await db.payment.updateMany({
          where: { guestId },
          data: { guestId: null },
        });
        deletedRecords.push('payment_links');
      }

      // Finally delete the guest
      await db.guest.delete({ where: { id: guestId } });
      deletedRecords.push('profile');
    } else {
      // Soft delete
      await db.guest.update({
        where: { id: guestId },
        data: { deletedAt: new Date() },
      });
      deletedRecords.push('profile (soft delete)');
    }

    // Update GDPR request with snapshot
    await db.gDPRRequest.updateMany({
      where: { guestId, tenantId, requestType: 'delete', status: 'processing' },
      data: { dataSnapshot },
    });

    return { success: true, deletedRecords };
  }

  /**
   * Create consent record
   */
  async createConsent(input: CreateConsentInput): Promise<ConsentRecord> {
    // Check if consent already exists for this type
    const existingConsent = await db.consentRecord.findFirst({
      where: {
        tenantId: input.tenantId,
        guestId: input.guestId,
        userId: input.userId,
        consentType: input.consentType,
      },
    });

    if (existingConsent) {
      // Update existing consent
      return db.consentRecord.update({
        where: { id: existingConsent.id },
        data: {
          granted: input.granted,
          grantedAt: input.granted ? new Date() : existingConsent.grantedAt,
          grantedVia: input.grantedVia,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          consentText: input.consentText,
          consentVersion: input.consentVersion,
          revoked: !input.granted,
          revokedAt: !input.granted ? new Date() : null,
          revokedVia: !input.granted ? input.grantedVia : null,
        },
      });
    }

    return db.consentRecord.create({
      data: {
        tenantId: input.tenantId,
        guestId: input.guestId,
        userId: input.userId,
        consentType: input.consentType,
        consentCategory: input.consentCategory || 'preferences',
        granted: input.granted,
        grantedAt: input.granted ? new Date() : null,
        grantedVia: input.grantedVia,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        consentText: input.consentText,
        consentVersion: input.consentVersion,
        revoked: false,
      },
    });
  }

  /**
   * Revoke consent
   */
  async revokeConsent(
    consentId: string,
    tenantId: string,
    options: {
      revokedVia?: string;
      reason?: string;
    } = {}
  ): Promise<ConsentRecord> {
    return db.consentRecord.update({
      where: { id: consentId, tenantId },
      data: {
        granted: false,
        revoked: true,
        revokedAt: new Date(),
        revokedVia: options.revokedVia,
        revocationReason: options.reason,
      },
    });
  }

  /**
   * Get consent records for a guest or user
   */
  async getConsentRecords(
    tenantId: string,
    filters: {
      guestId?: string;
      userId?: string;
      consentType?: ConsentType;
    }
  ): Promise<ConsentRecord[]> {
    return db.consentRecord.findMany({
      where: {
        tenantId,
        ...(filters.guestId && { guestId: filters.guestId }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.consentType && { consentType: filters.consentType }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Check if consent is granted for a specific type
   */
  async hasConsent(
    tenantId: string,
    consentType: ConsentType,
    filters: {
      guestId?: string;
      userId?: string;
    }
  ): Promise<boolean> {
    const consent = await db.consentRecord.findFirst({
      where: {
        tenantId,
        consentType,
        ...(filters.guestId && { guestId: filters.guestId }),
        ...(filters.userId && { userId: filters.userId }),
        granted: true,
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    return !!consent;
  }

  /**
   * Get consent statistics for a tenant
   */
  async getConsentStats(tenantId: string): Promise<{
    total: number;
    byType: Record<string, { granted: number; revoked: number }>;
    byCategory: Record<string, number>;
    recentGrants: number;
    recentRevocations: number;
  }> {
    const consents = await db.consentRecord.findMany({
      where: { tenantId },
    });

    const byType: Record<string, { granted: number; revoked: number }> = {};
    const byCategory: Record<string, number> = {};
    let recentGrants = 0;
    let recentRevocations = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const consent of consents) {
      // By type
      if (!byType[consent.consentType]) {
        byType[consent.consentType] = { granted: 0, revoked: 0 };
      }
      if (consent.granted && !consent.revoked) {
        byType[consent.consentType].granted++;
      } else if (consent.revoked) {
        byType[consent.consentType].revoked++;
      }

      // By category
      const category = consent.consentCategory || 'unknown';
      byCategory[category] = (byCategory[category] || 0) + 1;

      // Recent activity
      if (consent.grantedAt && consent.grantedAt > thirtyDaysAgo) {
        recentGrants++;
      }
      if (consent.revokedAt && consent.revokedAt > thirtyDaysAgo) {
        recentRevocations++;
      }
    }

    return {
      total: consents.length,
      byType,
      byCategory,
      recentGrants,
      recentRevocations,
    };
  }

  /**
   * Sanitize data for export (remove sensitive internal fields)
   */
  private sanitizeForExport(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...data };
    const sensitiveFields = ['passwordHash', 'twoFactorSecret', 'digitalKeySecret', 'portalToken'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    return sanitized;
  }

  /**
   * Process pending GDPR requests (can be called by a cron job)
   */
  async processPendingRequests(): Promise<{
    processed: number;
    failed: number;
  }> {
    const pendingRequests = await db.gDPRRequest.findMany({
      where: {
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      take: 10, // Process in batches
    });

    let processed = 0;
    let failed = 0;

    for (const request of pendingRequests) {
      try {
        await db.gDPRRequest.update({
          where: { id: request.id },
          data: { status: 'processing' },
        });

        switch (request.requestType) {
          case 'export':
            if (request.guestId) {
              await this.exportGuestData(request.guestId, request.tenantId);
            }
            break;
          case 'delete':
            if (request.guestId) {
              await this.deleteGuestData(request.guestId, request.tenantId);
            }
            break;
          case 'anonymize':
            if (request.guestId) {
              await this.anonymizeGuestData(request.guestId, request.tenantId);
            }
            break;
        }

        await db.gDPRRequest.update({
          where: { id: request.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });
        processed++;
      } catch (error) {
        await db.gDPRRequest.update({
          where: { id: request.id },
          data: {
            status: 'failed',
            notes: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        failed++;
      }
    }

    return { processed, failed };
  }
}

// Export singleton instance
export const gdprService = new GDPRService();

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Create an export request for a guest
 */
export async function createExportRequest(
  tenantId: string,
  guestId: string,
  requesterEmail?: string
): Promise<GDPRRequest> {
  return gdprService.createRequest({
    tenantId,
    guestId,
    requestType: 'export',
    requesterEmail,
  });
}

/**
 * Create a deletion request for a guest
 */
export async function createDeletionRequest(
  tenantId: string,
  guestId: string,
  requesterEmail?: string
): Promise<GDPRRequest> {
  return gdprService.createRequest({
    tenantId,
    guestId,
    requestType: 'delete',
    requesterEmail,
  });
}

/**
 * Create an anonymization request for a guest
 */
export async function createAnonymizationRequest(
  tenantId: string,
  guestId: string,
  requesterEmail?: string
): Promise<GDPRRequest> {
  return gdprService.createRequest({
    tenantId,
    guestId,
    requestType: 'anonymize',
    requesterEmail,
  });
}

/**
 * Record marketing consent for a guest
 */
export async function recordMarketingConsent(
  tenantId: string,
  guestId: string,
  granted: boolean,
  metadata: {
    grantedVia?: string;
    ipAddress?: string;
    userAgent?: string;
    consentText?: string;
  }
): Promise<ConsentRecord> {
  return gdprService.createConsent({
    tenantId,
    guestId,
    consentType: 'marketing',
    consentCategory: 'marketing',
    granted,
    ...metadata,
  });
}

/**
 * Record analytics consent for a guest
 */
export async function recordAnalyticsConsent(
  tenantId: string,
  guestId: string,
  granted: boolean,
  metadata: {
    grantedVia?: string;
    ipAddress?: string;
    userAgent?: string;
    consentText?: string;
  }
): Promise<ConsentRecord> {
  return gdprService.createConsent({
    tenantId,
    guestId,
    consentType: 'analytics',
    consentCategory: 'analytics',
    granted,
    ...metadata,
  });
}

export default gdprService;
