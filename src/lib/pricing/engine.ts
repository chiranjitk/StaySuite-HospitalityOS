import { db } from '@/lib/db';

// Types
export interface PricingRule {
  id: string;
  tenantId: string;
  propertyId: string | null;
  name: string;
  type: string;
  description: string | null;
  value: number;
  valueType: string; // 'percentage' | 'fixed'
  conditions: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  roomTypes: string;
  appliedCount: number;
  lastAppliedAt: Date | null;
}

export interface PricingRuleCondition {
  minNights?: number;
  maxNights?: number;
  minOccupancy?: number;
  maxOccupancy?: number;
  daysOfWeek?: number[]; // 0-6, Sunday to Saturday
  months?: number[]; // 1-12
  bookingChannel?: string[];
  guestType?: string[];
  advanceBookingDaysMin?: number;
  advanceBookingDaysMax?: number;
}

export interface PriceBreakdown {
  basePrice: number;
  adjustments: Array<{
    ruleId: string;
    ruleName: string;
    type: string;
    value: number;
    amount: number;
  }>;
  subtotal: number;
  taxes: number;
  fees: number;
  totalAmount: number;
  currency: string;
  nights: number;
  pricePerNight: number;
}

export interface PricingContext {
  roomTypeId: string;
  propertyId: string;
  tenantId: string;
  checkIn: Date;
  checkOut: Date;
  basePrice: number;
  adults?: number;
  children?: number;
  bookingChannel?: string;
  guestId?: string;
  promoCode?: string;
  ratePlanId?: string;
}

/**
 * Calculate the final price for a booking with all applicable rules
 */
export async function calculatePrice(context: PricingContext): Promise<PriceBreakdown> {
  const {
    roomTypeId,
    propertyId,
    checkIn,
    checkOut,
    basePrice,
    adults = 1,
    children = 0,
    bookingChannel = 'direct',
    promoCode,
    ratePlanId,
  } = context;

  // Calculate nights
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  // Get room type for currency
  const roomType = await db.roomType.findUnique({
    where: { id: roomTypeId },
    select: { currency: true, propertyId: true },
  });

  const currency = roomType?.currency || 'USD';

  // Start with base price
  let currentPricePerNight = basePrice;
  const adjustments: PriceBreakdown['adjustments'] = [];

  // Load applicable pricing rules (scoped to tenant)
  const applicableRules = await loadApplicableRules({
    tenantId: roomType ? await getPropertyTenantId(propertyId) : '',
    propertyId,
    roomTypeId,
    checkIn,
    checkOut,
    basePrice,
    adults,
    children,
    bookingChannel,
    promoCode,
  });

  // Sort by priority (higher priority first)
  applicableRules.sort((a, b) => b.priority - a.priority);

  // Apply rules in priority order
  for (const rule of applicableRules) {
    const result = applyRule(rule, currentPricePerNight, nights, context);
    if (result.applied) {
      adjustments.push({
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        value: rule.value,
        amount: result.amount,
      });
      currentPricePerNight = result.newPrice;

      // Update rule applied count
      await db.pricingRule.update({
        where: { id: rule.id },
        data: {
          appliedCount: { increment: 1 },
          lastAppliedAt: new Date(),
        },
      });
    }
  }

  // Calculate totals
  const subtotal = currentPricePerNight * nights;

  // Get property tax settings
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      defaultTaxRate: true,
      taxComponents: true,
      serviceChargePercent: true,
    },
  });

  // Calculate taxes
  let taxes = 0;
  if (property) {
    if (property.taxComponents) {
      try {
        const components = JSON.parse(property.taxComponents);
        if (Array.isArray(components) && components.length > 0) {
          for (const component of components) {
            taxes += subtotal * (component.rate / 100);
          }
        }
      } catch {
        // Fall back to default tax rate
        if (property.defaultTaxRate) {
          taxes = subtotal * (property.defaultTaxRate / 100);
        }
      }
    } else if (property.defaultTaxRate) {
      taxes = subtotal * (property.defaultTaxRate / 100);
    }
  }

  // Calculate service charge
  const fees = property?.serviceChargePercent
    ? subtotal * (property.serviceChargePercent / 100)
    : 0;

  const totalAmount = subtotal + taxes + fees;

  return {
    basePrice,
    adjustments,
    subtotal,
    taxes,
    fees,
    totalAmount,
    currency,
    nights,
    pricePerNight: currentPricePerNight,
  };
}

/**
 * Get the tenant ID for a property
 */
async function getPropertyTenantId(propertyId: string): Promise<string> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { tenantId: true },
  });
  return property?.tenantId || '';
}

/**
 * Load applicable pricing rules for a booking context (tenant-scoped)
 */
async function loadApplicableRules(
  context: PricingContext
): Promise<PricingRule[]> {
  const {
    tenantId,
    propertyId,
    roomTypeId,
    checkIn,
    checkOut,
    adults,
    children,
    bookingChannel,
    promoCode,
  } = context;

  const now = new Date();

  // Build base query - scoped to tenant
  const rules = await db.pricingRule.findMany({
    where: {
      isActive: true,
      tenantId,
      OR: [
        { propertyId: null }, // Global rules for this tenant
        { propertyId },
      ],
      effectiveFrom: { lte: now },
      effectiveTo: null,
    },
    orderBy: { priority: 'desc' },
  });

  // Filter rules based on conditions
  const applicableRules: PricingRule[] = [];

  for (const rule of rules) {
    // Check room type applicability
    if (rule.roomTypes) {
      try {
        const roomTypeIds = JSON.parse(rule.roomTypes);
        if (Array.isArray(roomTypeIds) && roomTypeIds.length > 0) {
          if (!roomTypeIds.includes(roomTypeId)) {
            continue;
          }
        }
      } catch {
        // If parsing fails, assume all room types
      }
    }

    // Check conditions
    if (rule.conditions) {
      try {
        const conditions: PricingRuleCondition = JSON.parse(rule.conditions);

        // Check if rule applies
        if (!checkRuleConditions(conditions, {
          checkIn,
          checkOut,
          adults,
          children,
          bookingChannel,
          promoCode,
        })) {
          continue;
        }
      } catch {
        // If parsing fails, apply rule anyway
      }
    }

    applicableRules.push(rule as PricingRule);
  }

  return applicableRules;
}

/**
 * Check if rule conditions match the booking context
 */
function checkRuleConditions(
  conditions: PricingRuleCondition,
  context: {
    checkIn: Date;
    checkOut: Date;
    adults?: number;
    children?: number;
    bookingChannel?: string;
    promoCode?: string;
  }
): boolean {
  const nights = Math.ceil(
    (context.checkOut.getTime() - context.checkIn.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check min nights
  if (conditions.minNights !== undefined && nights < conditions.minNights) {
    return false;
  }

  // Check max nights
  if (conditions.maxNights !== undefined && nights > conditions.maxNights) {
    return false;
  }

  // Check min occupancy
  if (conditions.minOccupancy !== undefined && (context.adults ?? 1) < conditions.minOccupancy) {
    return false;
  }

  // Check max occupancy
  if (conditions.maxOccupancy !== undefined && (context.adults ?? 1) > conditions.maxOccupancy) {
    return false;
  }

  // Check days of week
  if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
    const checkInDay = context.checkIn.getDay();
    if (!conditions.daysOfWeek.includes(checkInDay)) {
      return false;
    }
  }

  // Check months
  if (conditions.months && conditions.months.length > 0) {
    const checkInMonth = context.checkIn.getMonth() + 1;
    if (!conditions.months.includes(checkInMonth)) {
      return false;
    }
  }

  // Check booking channel
  if (conditions.bookingChannel && conditions.bookingChannel.length > 0) {
    if (!conditions.bookingChannel.includes(context.bookingChannel || 'direct')) {
      return false;
    }
  }

  // Check advance booking days
  if (conditions.advanceBookingDaysMin !== undefined || conditions.advanceBookingDaysMax !== undefined) {
    const now = new Date();
    const advanceDays = Math.ceil(
      (context.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (conditions.advanceBookingDaysMin !== undefined && advanceDays < conditions.advanceBookingDaysMin) {
      return false;
    }

    if (conditions.advanceBookingDaysMax !== undefined && advanceDays > conditions.advanceBookingDaysMax) {
      return false;
    }
  }

  return true;
}

/**
 * Apply a single pricing rule to a price
 */
function applyRule(
  rule: PricingRule,
  currentPrice: number,
  nights: number,
  context: PricingContext
): { applied: boolean; amount: number; newPrice: number } {
  let amount = 0;
  let newPrice = currentPrice;
  const now = new Date();

  switch (rule.type) {
    case 'discount_percentage':
      // Apply percentage discount
      amount = currentPrice * (rule.value / 100);
      newPrice = currentPrice - amount;
      break;

    case 'discount_fixed':
      // Apply fixed discount per night
      amount = rule.value;
      newPrice = Math.max(0, currentPrice - amount);
      break;

    case 'surcharge_percentage':
      // Apply percentage surcharge
      amount = currentPrice * (rule.value / 100);
      newPrice = currentPrice + amount;
      break;

    case 'surcharge_fixed':
      // Apply fixed surcharge per night
      amount = rule.value;
      newPrice = currentPrice + amount;
      break;

    case 'markup':
      // Apply percentage markup (increase price)
      // E.g., value=10 means price goes up by 10%
      amount = currentPrice * (rule.value / 100);
      newPrice = currentPrice + amount;
      break;

    case 'markdown':
      // Apply percentage markdown (decrease price)
      // E.g., value=15 means price goes down by 15%
      amount = currentPrice * (rule.value / 100);
      newPrice = Math.max(0, currentPrice - amount);
      break;

    case 'early_bird':
      // Early bird discount - check advance booking days
      const earlyBirdDays = Math.ceil(
        (context.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (earlyBirdDays >= 7) { // At least 7 days in advance
        amount = currentPrice * (rule.value / 100);
        newPrice = currentPrice - amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;

    case 'last_minute':
      // Last minute discount
      const lmAdvanceDays = Math.ceil(
        (context.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (lmAdvanceDays <= 3 && lmAdvanceDays >= 0) { // Within 3 days
        amount = currentPrice * (rule.value / 100);
        newPrice = currentPrice - amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;

    case 'long_stay':
      // Long stay discount
      if (nights >= 7) { // At least 7 nights
        amount = currentPrice * (rule.value / 100);
        newPrice = currentPrice - amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;

    case 'weekend':
      // Weekend surcharge/discount
      const checkInDay = context.checkIn.getDay();
      if (checkInDay === 5 || checkInDay === 6) { // Friday or Saturday
        amount = currentPrice * (rule.value / 100);
        newPrice = currentPrice + amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;

    case 'seasonal':
      // Seasonal pricing - check if within effective dates
      if (rule.effectiveFrom && rule.effectiveTo) {
        const effectiveFrom = new Date(rule.effectiveFrom);
        const effectiveTo = new Date(rule.effectiveTo);
        if (context.checkIn >= effectiveFrom && context.checkIn <= effectiveTo) {
          // For seasonal, the value is typically the new price or multiplier
          if (rule.valueType === 'percentage') {
            amount = currentPrice * (rule.value / 100);
            newPrice = currentPrice + amount;
          } else {
            // Fixed seasonal price
            amount = rule.value - currentPrice;
            newPrice = rule.value;
          }
        } else {
          return { applied: false, amount: 0, newPrice: currentPrice };
        }
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;

    case 'promo_code':
      // Promo code discount - check if promo code matches
      // This would need the promo code from conditions
      if (context.promoCode) {
        amount = currentPrice * (rule.value / 100);
        newPrice = currentPrice - amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;

    case 'occupancy':
      // Occupancy-based pricing
      const totalGuests = (context.adults ?? 1) + ((context.children) || 0);
      if (totalGuests > 2) { // More than 2 guests
        amount = rule.value * (totalGuests - 2); // Extra person charge
        newPrice = currentPrice + amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;

    default:
      // Unknown rule type, don't apply
      return { applied: false, amount: 0, newPrice: currentPrice };
  }

  return { applied: true, amount, newPrice };
}

/**
 * Get all active pricing rules for a property (tenant-scoped)
 */
export async function getActivePricingRules(propertyId: string, tenantId: string): Promise<PricingRule[]> {
  const now = new Date();

  return db.pricingRule.findMany({
    where: {
      tenantId,
      OR: [
        { propertyId: null },
        { propertyId },
      ],
      isActive: true,
      effectiveFrom: { lte: now },
      effectiveTo: null,
    },
    orderBy: { priority: 'desc' },
  }) as Promise<PricingRule[]>;
}

/**
 * Preview pricing for a potential booking
 */
export async function previewPricing(
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  adults: number = 1,
  children: number = 0,
  promoCode?: string
): Promise<PriceBreakdown | null> {
  try {
    // Get room type
    const roomType = await db.roomType.findUnique({
      where: { id: roomTypeId },
      include: { property: true },
    });

    if (!roomType) {
      return null;
    }

    return calculatePrice({
      roomTypeId,
      propertyId: roomType.propertyId,
      tenantId: roomType.property?.tenantId || '',
      checkIn,
      checkOut,
      basePrice: roomType.basePrice,
      adults,
      children,
      promoCode,
    });
  } catch (error) {
    console.error('Error previewing pricing:', error);
    return null;
  }
}
