/**
 * Segment Rule Evaluator
 * 
 * Parses segment rules and builds database queries to find matching guests.
 * Supports multiple rule types:
 * - loyalty_tier: Filter by tier level
 * - total_stays: Filter by number of stays
 * - total_spent: Filter by amount spent
 * - last_stay_date: Filter by date range
 * - booking_source: Filter by source
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// Types
export interface SegmentRule {
  type: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: unknown;
  field?: string;
}

export interface SegmentRuleGroup {
  operator: 'and' | 'or';
  rules: (SegmentRule | SegmentRuleGroup)[];
}

export interface SegmentDefinition {
  operator: 'and' | 'or';
  rules: SegmentRule[];
}

export interface EvaluationResult {
  segmentId: string;
  matchedCount: number;
  guestIds: string[];
  evaluatedAt: Date;
  ruleSummary: string;
}

// Rule type handlers
type RuleHandler = (
  rule: SegmentRule,
  tenantId: string
) => Prisma.GuestWhereInput;

/**
 * Segment Evaluator Class
 */
export class SegmentEvaluator {
  private ruleHandlers: Record<string, RuleHandler> = {
    loyalty_tier: this.handleLoyaltyTier,
    total_stays: this.handleTotalStays,
    total_spent: this.handleTotalSpent,
    last_stay_date: this.handleLastStayDate,
    booking_source: this.handleBookingSource,
    email_opt_in: this.handleEmailOptIn,
    sms_opt_in: this.handleSmsOptIn,
    is_vip: this.handleIsVip,
    nationality: this.handleNationality,
    created_date: this.handleCreatedDate,
    tags: this.handleTags,
  };

  /**
   * Evaluate segment rules and return matching guest IDs
   */
  async evaluateSegmentRules(
    segmentId: string,
    options?: {
      updateMemberCount?: boolean;
      syncMemberships?: boolean;
    }
  ): Promise<EvaluationResult> {
    // Get segment
    const segment = await db.guestSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }

    // Parse rules
    let rules: SegmentDefinition;
    try {
      rules = JSON.parse(segment.rules);
    } catch {
      throw new Error(`Invalid segment rules format for segment: ${segmentId}`);
    }

    // Build query from rules
    const where = this.buildWhereClause(rules, segment.tenantId);

    // Execute query
    const guests = await db.guest.findMany({
      where,
      select: { id: true },
    });

    const guestIds = guests.map(g => g.id);
    const matchedCount = guestIds.length;

    // Update segment member count if requested
    if (options?.updateMemberCount) {
      await db.guestSegment.update({
        where: { id: segmentId },
        data: { memberCount: matchedCount },
      });
    }

    // Sync segment memberships if requested
    if (options?.syncMemberships) {
      await this.syncSegmentMemberships(segmentId, guestIds);
    }

    return {
      segmentId,
      matchedCount,
      guestIds,
      evaluatedAt: new Date(),
      ruleSummary: this.generateRuleSummary(rules),
    };
  }

  /**
   * Evaluate rules without segment ID (for preview)
   */
  async evaluateRules(
    tenantId: string,
    rules: SegmentDefinition
  ): Promise<{
    matchedCount: number;
    guestIds: string[];
    ruleSummary: string;
  }> {
    const where = this.buildWhereClause(rules, tenantId);

    const guests = await db.guest.findMany({
      where,
      select: { id: true },
    });

    return {
      matchedCount: guests.length,
      guestIds: guests.map(g => g.id),
      ruleSummary: this.generateRuleSummary(rules),
    };
  }

  /**
   * Build Prisma where clause from rules
   */
  private buildWhereClause(
    definition: SegmentDefinition,
    tenantId: string
  ): Prisma.GuestWhereInput {
    const conditions: Prisma.GuestWhereInput[] = [];

    for (const rule of definition.rules) {
      const handler = this.ruleHandlers[rule.type];
      if (handler) {
        conditions.push(handler.call(this, rule, tenantId));
      }
    }

    if (definition.operator === 'and') {
      return {
        tenantId,
        AND: conditions,
      };
    } else {
      return {
        tenantId,
        OR: conditions,
      };
    }
  }

  /**
   * Sync segment memberships
   */
  private async syncSegmentMemberships(
    segmentId: string,
    guestIds: string[]
  ): Promise<void> {
    // Get existing memberships
    const existing = await db.segmentMembership.findMany({
      where: { segmentId },
      select: { guestId: true },
    });

    const existingIds = new Set(existing.map(m => m.guestId));
    const newIds = new Set(guestIds);

    // Find guests to add
    const toAdd = guestIds.filter(id => !existingIds.has(id));

    // Find guests to remove
    const toRemove = existing.filter(m => !newIds.has(m.guestId)).map(m => m.guestId);

    // Add new members
    if (toAdd.length > 0) {
      await db.segmentMembership.createMany({
        data: toAdd.map(guestId => ({
          segmentId,
          guestId,
        })),
        skipDuplicates: true as never,
      });
    }

    // Remove old members
    if (toRemove.length > 0) {
      await db.segmentMembership.deleteMany({
        where: {
          segmentId,
          guestId: { in: toRemove },
        },
      });
    }
  }

  /**
   * Generate human-readable rule summary
   */
  private generateRuleSummary(definition: SegmentDefinition): string {
    const summaries = definition.rules.map(rule => {
      switch (rule.type) {
        case 'loyalty_tier':
          return `Loyalty tier ${rule.operator} ${rule.value}`;
        case 'total_stays':
          return `Total stays ${rule.operator} ${rule.value}`;
        case 'total_spent':
          return `Total spent ${rule.operator} ${rule.value}`;
        case 'last_stay_date':
          return `Last stay ${rule.operator} ${rule.value}`;
        case 'booking_source':
          return `Booking source ${rule.operator} ${rule.value}`;
        case 'email_opt_in':
          return `Email opt-in ${rule.value ? 'yes' : 'no'}`;
        case 'sms_opt_in':
          return `SMS opt-in ${rule.value ? 'yes' : 'no'}`;
        case 'is_vip':
          return `VIP status ${rule.value ? 'yes' : 'no'}`;
        case 'nationality':
          return `Nationality ${rule.operator} ${rule.value}`;
        case 'created_date':
          return `Created ${rule.operator} ${rule.value}`;
        case 'tags':
          return `Has tags ${rule.value}`;
        default:
          return `${rule.type} ${rule.operator} ${rule.value}`;
      }
    });

    return summaries.join(` ${definition.operator} `);
  }

  // Rule handlers

  private handleLoyaltyTier(rule: SegmentRule): Prisma.GuestWhereInput {
    const tiers = Array.isArray(rule.value) ? rule.value : [rule.value];
    
    switch (rule.operator) {
      case 'equals':
      case 'in':
        return { loyaltyTier: { in: tiers } };
      case 'not_equals':
      case 'not_in':
        return { loyaltyTier: { notIn: tiers } };
      default:
        return { loyaltyTier: { in: tiers } };
    }
  }

  private handleTotalStays(rule: SegmentRule): Prisma.GuestWhereInput {
    const value = Number(rule.value);
    
    switch (rule.operator) {
      case 'equals':
        return { totalStays: value };
      case 'not_equals':
        return { NOT: { totalStays: value } };
      case 'greater_than':
        return { totalStays: { gt: value } };
      case 'less_than':
        return { totalStays: { lt: value } };
      case 'between':
        const [min, max] = rule.value as [number, number];
        return { totalStays: { gte: min, lte: max } };
      default:
        return { totalStays: { gte: value } };
    }
  }

  private handleTotalSpent(rule: SegmentRule): Prisma.GuestWhereInput {
    const value = Number(rule.value);
    
    switch (rule.operator) {
      case 'equals':
        return { totalSpent: value };
      case 'not_equals':
        return { NOT: { totalSpent: value } };
      case 'greater_than':
        return { totalSpent: { gt: value } };
      case 'less_than':
        return { totalSpent: { lt: value } };
      case 'between':
        const [min, max] = rule.value as [number, number];
        return { totalSpent: { gte: min, lte: max } };
      default:
        return { totalSpent: { gte: value } };
    }
  }

  private handleLastStayDate(rule: SegmentRule): Prisma.GuestWhereInput {
    const value = rule.value as string | { from: string; to: string };
    
    // Last stay date needs to be calculated from bookings
    // For simplicity, we'll use a subquery approach
    const daysAgo = typeof value === 'string' ? parseInt(value) : 0;
    const dateValue = new Date();
    
    switch (rule.operator) {
      case 'greater_than':
        // Last stay was more than X days ago
        dateValue.setDate(dateValue.getDate() - daysAgo);
        return {
          stays: {
            some: {
              createdAt: { lt: dateValue },
            },
          },
        };
      case 'less_than':
        // Last stay was within X days
        dateValue.setDate(dateValue.getDate() - daysAgo);
        return {
          stays: {
            some: {
              createdAt: { gte: dateValue },
            },
          },
        };
      case 'between':
        if (typeof value === 'object' && 'from' in value && 'to' in value) {
          const from = new Date(value.from);
          const to = new Date(value.to);
          return {
            stays: {
              some: {
                createdAt: { gte: from, lte: to },
              },
            },
          };
        }
        return {};
      default:
        return {};
    }
  }

  private handleBookingSource(rule: SegmentRule): Prisma.GuestWhereInput {
    const sources = Array.isArray(rule.value) ? rule.value : [rule.value];
    
    switch (rule.operator) {
      case 'equals':
      case 'in':
        return { 
          OR: [
            { source: { in: sources } },
            { bookings: { some: { source: { in: sources } } } },
          ],
        };
      case 'not_equals':
      case 'not_in':
        return {
          AND: [
            { source: { notIn: sources } },
            { bookings: { none: { source: { in: sources } } } },
          ],
        };
      default:
        return { source: { in: sources } };
    }
  }

  private handleEmailOptIn(rule: SegmentRule): Prisma.GuestWhereInput {
    return { emailOptIn: Boolean(rule.value) };
  }

  private handleSmsOptIn(rule: SegmentRule): Prisma.GuestWhereInput {
    return { smsOptIn: Boolean(rule.value) };
  }

  private handleIsVip(rule: SegmentRule): Prisma.GuestWhereInput {
    return { isVip: Boolean(rule.value) };
  }

  private handleNationality(rule: SegmentRule): Prisma.GuestWhereInput {
    const nationalities = Array.isArray(rule.value) ? rule.value : [rule.value];
    
    switch (rule.operator) {
      case 'equals':
      case 'in':
        return { nationality: { in: nationalities } };
      case 'not_equals':
      case 'not_in':
        return { nationality: { notIn: nationalities } };
      default:
        return { nationality: { in: nationalities } };
    }
  }

  private handleCreatedDate(rule: SegmentRule): Prisma.GuestWhereInput {
    const value = rule.value as string | { from: string; to: string };
    
    switch (rule.operator) {
      case 'greater_than':
        return { createdAt: { gt: new Date(value as string) } };
      case 'less_than':
        return { createdAt: { lt: new Date(value as string) } };
      case 'between':
        if (typeof value === 'object' && 'from' in value && 'to' in value) {
          return {
            createdAt: {
              gte: new Date(value.from),
              lte: new Date(value.to),
            },
          };
        }
        return {};
      default:
        return {};
    }
  }

  private handleTags(rule: SegmentRule): Prisma.GuestWhereInput {
    const tags = Array.isArray(rule.value) ? rule.value : [rule.value];
    
    // Tags are stored as JSON string, need to check if any tag is present
    // This is a simplified approach - in production, you might need a proper JSON query
    return {
      OR: tags.map(tag => ({
        tags: { contains: tag as string },
      })),
    };
  }
}

// Singleton instance
export const segmentEvaluator = new SegmentEvaluator();

// Convenience functions
export const evaluateSegment = (segmentId: string, options?: { updateMemberCount?: boolean; syncMemberships?: boolean }) => 
  segmentEvaluator.evaluateSegmentRules(segmentId, options);
export const evaluateRulesPreview = (tenantId: string, rules: SegmentDefinition) => 
  segmentEvaluator.evaluateRules(tenantId, rules);
