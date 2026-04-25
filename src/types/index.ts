// CRYPTSK STAYSUITE - Type Definitions

// ============================================
// Core Types
// ============================================

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled' | 'archived';
export type TenantPlan = 'trial' | 'starter' | 'professional' | 'enterprise';

export type BookingStatus = 'draft' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'out_of_order' | 'dirty';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type FolioStatus = 'open' | 'closed' | 'partially_paid' | 'paid';

// ============================================
// Navigation Types
// ============================================

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  badge?: string | number;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardStats {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    change: number;
  };
  occupancy: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    change: number;
  };
  bookings: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    pending: number;
  };
  guests: {
    checkedIn: number;
    arriving: number;
    departing: number;
    total: number;
  };
}

export interface RecentActivity {
  id: string;
  type: 'booking' | 'check_in' | 'check_out' | 'payment' | 'service_request';
  title: string;
  description: string;
  timestamp: Date;
  status?: string;
}

// ============================================
// Property Types
// ============================================

export interface Property {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  type: 'hotel' | 'resort' | 'hostel' | 'apartment' | 'villa';
  address: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  email?: string;
  phone?: string;
  website?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
  currency: string;
  totalRooms: number;
  totalFloors: number;
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomType {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  description?: string;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  sizeSqMeters?: number;
  sizeSqFeet?: number;
  amenities: string[];
  basePrice: number;
  currency: string;
  images: string[];
  sortOrder: number;
  totalRooms: number;
  status: 'active' | 'inactive';
}

export interface Room {
  id: string;
  propertyId: string;
  roomTypeId: string;
  number: string;
  name?: string;
  floor: number;
  isAccessible: boolean;
  isSmoking: boolean;
  hasBalcony: boolean;
  hasSeaView: boolean;
  hasMountainView: boolean;
  status: RoomStatus;
  digitalKeyEnabled: boolean;
}

// ============================================
// Booking Types
// ============================================

export interface Booking {
  id: string;
  tenantId: string;
  propertyId: string;
  confirmationCode: string;
  externalRef?: string;
  primaryGuestId: string;
  roomId?: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  infants: number;
  roomRate: number;
  taxes: number;
  fees: number;
  discount: number;
  totalAmount: number;
  currency: string;
  ratePlanId?: string;
  promoCode?: string;
  source: 'direct' | 'booking_com' | 'airbnb' | 'expedia' | 'walk_in';
  channelId?: string;
  status: BookingStatus;
  actualCheckIn?: Date;
  actualCheckOut?: Date;
  checkedInBy?: string;
  checkedOutBy?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  specialRequests?: string;
  notes?: string;
  internalNotes?: string;
  groupId?: string;
  isGroupLeader: boolean;
  preArrivalSent: boolean;
  preArrivalCompleted: boolean;
  kycRequired: boolean;
  kycCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Guest Types
// ============================================

export interface Guest {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  nationality?: string;
  dateOfBirth?: Date;
  gender?: string;
  idType?: 'passport' | 'national_id' | 'driver_license';
  idNumber?: string;
  idExpiry?: Date;
  idCountry?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  preferences: Record<string, unknown>;
  dietaryRequirements?: string;
  specialRequests?: string;
  avatar?: string;
  notes?: string;
  tags: string[];
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  loyaltyPoints: number;
  totalStays: number;
  totalSpent: number;
  isVip: boolean;
  vipLevel?: string;
  source: 'direct' | 'booking_com' | 'airbnb' | 'expedia' | 'other';
  sourceId?: string;
  emailOptIn: boolean;
  smsOptIn: boolean;
  kycStatus: 'pending' | 'verified' | 'rejected';
  kycVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Billing Types
// ============================================

export interface Folio {
  id: string;
  tenantId: string;
  propertyId: string;
  bookingId: string;
  folioNumber: string;
  guestId: string;
  subtotal: number;
  taxes: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: FolioStatus;
  openedAt: Date;
  closedAt?: Date;
  invoiceNumber?: string;
  invoiceUrl?: string;
  invoiceIssuedAt?: Date;
}

export interface FolioLineItem {
  id: string;
  folioId: string;
  description: string;
  category: 'room' | 'food' | 'beverage' | 'service' | 'tax' | 'discount';
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  serviceDate: Date;
  referenceType?: 'order' | 'booking' | 'service';
  referenceId?: string;
  taxRate: number;
  taxAmount: number;
  postedBy?: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  folioId: string;
  amount: number;
  currency: string;
  method: 'card' | 'cash' | 'bank_transfer' | 'wallet' | 'check';
  gateway?: string;
  cardType?: string;
  cardLast4?: string;
  cardExpiry?: string;
  transactionId?: string;
  reference?: string;
  status: PaymentStatus;
  refundAmount: number;
  refundedAt?: Date;
  refundReason?: string;
  guestId?: string;
  processedAt?: Date;
}

// ============================================
// WiFi Types
// ============================================

export interface WiFiSession {
  id: string;
  tenantId: string;
  planId?: string;
  guestId?: string;
  bookingId?: string;
  macAddress: string;
  ipAddress?: string;
  deviceName?: string;
  deviceType?: string;
  startTime: Date;
  endTime?: Date;
  dataUsed: number;
  duration: number;
  authMethod: 'voucher' | 'social' | 'portal';
  status: 'active' | 'ended' | 'terminated';
}

export interface WiFiVoucher {
  id: string;
  tenantId: string;
  planId: string;
  code: string;
  guestId?: string;
  bookingId?: string;
  isUsed: boolean;
  usedAt?: Date;
  validFrom: Date;
  validUntil: Date;
  status: 'active' | 'used' | 'expired' | 'revoked';
}

// ============================================
// Task Types
// ============================================

export interface Task {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId?: string;
  assignedTo?: string;
  type: 'cleaning' | 'maintenance' | 'inspection' | 'other';
  category: 'routine' | 'deep_clean' | 'maintenance' | 'emergency';
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  roomStatusBefore?: string;
  roomStatusAfter?: string;
  notes?: string;
  completionNotes?: string;
  attachments: string[];
  isRecurring: boolean;
  recurrenceRule?: string;
}

// ============================================
// Chart/Report Types
// ============================================

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    fill?: boolean;
  }[];
}

export interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
  occupancy: number;
}

export interface OccupancyData {
  date: string;
  occupied: number;
  available: number;
  occupancyRate: number;
}
