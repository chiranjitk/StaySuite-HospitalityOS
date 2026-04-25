import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { createHash, randomUUID } from 'crypto';

// Generate deterministic UUIDs from seed strings for PostgreSQL @db.Uuid compatibility.
// Same input always produces same UUID, so FK references stay consistent across tables.
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8),                                    // 8 hex chars
    h.slice(8, 12),                                   // 4 hex chars
    '4' + h.slice(12, 15),                            // 4 hex chars (version 4)
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19), // 4 hex chars (variant 10xx)
    h.slice(19, 31)                                   // 12 hex chars
  ].join('-');
};

import { seedWiFiData } from './wifi-seed';

const prisma = new PrismaClient();

// Password hashing using bcrypt (production-grade)
async function seedHashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('Starting database seed...');
  
  // Nuclear cleanup: truncate all tables (PostgreSQL TRUNCATE CASCADE handles FKs)
  console.log('Cleaning all data...');
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE 
      "User", "Role", "Tenant", "Property", "Room", "RoomType", "Guest", 
      "Booking", "RatePlan", "Amenity", "Vendor", "StockItem", 
      "OrderCategory", "MenuItem", "RestaurantTable",
      "Task", "StaffSkill", "Asset", "PreventiveMaintenance", "StaffWorkload",
      "Discount", "Folio", "FolioLineItem", "Payment", "Invoice",
      "CancellationPolicy"
      CASCADE;`);
  } catch (e: any) {
    // Tables may not exist yet on fresh install, that's OK
    console.log('Note: Some tables may not exist yet (fresh install), continuing...');
  }
  
  // Create tenant 1 - Royal Stay Hotels
  console.log('Seeding tenant 1...');
  await prisma.tenant.create({
    data: {
      id: uuid('tenant-1'),
      name: 'Royal Stay Hotels',
      slug: 'royal-stay',
      email: 'admin@royalstay.in',
      phone: '+91-33-40012345',
      address: '234 Park Street',
      city: 'Kolkata',
      country: 'India',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      language: 'en',
      plan: 'enterprise',
      status: 'active',
    },
  });

  // Create tenant 2 - Ocean View Resorts
  console.log('Seeding tenant 2...');
  await prisma.tenant.create({
    data: {
      id: uuid('tenant-2'),
      name: 'Ocean View Resorts',
      slug: 'ocean-view',
      email: 'admin@oceanview.com',
      phone: '+1-305-5550100',
      address: '1200 Ocean Drive',
      city: 'Miami',
      country: 'United States',
      timezone: 'America/New_York',
      currency: 'USD',
      language: 'en',
      plan: 'professional',
      status: 'active',
    },
  });

  // Create roles with comprehensive permissions
  console.log('Seeding roles...');
  await prisma.role.createMany({
    data: [
      { 
        id: uuid('role-1'), 
        tenantId: uuid('tenant-1'), 
        name: 'admin', 
        displayName: 'Administrator', 
        description: 'Full system access - can do everything', 
        permissions: JSON.stringify(['*']), 
        isSystem: true 
      },
      { 
        id: uuid('role-2'), 
        tenantId: uuid('tenant-1'), 
        name: 'manager', 
        displayName: 'Manager', 
        description: 'Operations and reports access', 
        permissions: JSON.stringify([
          'dashboard.*',
          'bookings.*',
          'guests.*',
          'rooms.view',
          'rooms.update',
          'housekeeping.view',
          'billing.view',
          'billing.create',
          'reports.*',
          'wifi.*',
          'frontdesk.*',
          'settings.read',
          'notifications.view',
          'inventory.view',
          'experience.view',
        ]), 
        isSystem: true 
      },
      { 
        id: uuid('role-3'), 
        tenantId: uuid('tenant-1'), 
        name: 'front_desk', 
        displayName: 'Front Desk', 
        description: 'Front desk operations - check-in, check-out, bookings', 
        permissions: JSON.stringify([
          'dashboard.operations',  // Can see operations dashboard (arrivals, departures, room status)
          'bookings.view',
          'bookings.create',
          'bookings.update',
          'guests.view',
          'guests.create',
          'guests.update',
          'rooms.view',
          'frontdesk.*',
          'billing.view',
          'billing.create',
          'experience.view',
          'communication.chat',
        ]), 
        isSystem: true 
      },
      { 
        id: uuid('role-4'), 
        tenantId: uuid('tenant-1'), 
        name: 'housekeeping', 
        displayName: 'Housekeeping', 
        description: 'Housekeeping operations - rooms, tasks, maintenance', 
        permissions: JSON.stringify([
          'dashboard.housekeeping',  // Can only see housekeeping dashboard (tasks, room status)
          'rooms.view',
          'rooms.update_status',  // Can only update room status
          'tasks.*',
          'housekeeping.*',
          'maintenance.view',
          'maintenance.create',
          'assets.view',
        ]), 
        isSystem: true 
      },
    ],
  });

  // Create amenities - organized by category
  console.log('Seeding amenities...');
  const defaultAmenities = [
    // General Amenities
    { name: 'Free WiFi', icon: 'wifi', category: 'general', isDefault: true, sortOrder: 0 },
    { name: '24/7 Front Desk', icon: 'clock', category: 'general', isDefault: true, sortOrder: 1 },
    { name: 'Free Parking', icon: 'car', category: 'general', isDefault: true, sortOrder: 2 },
    { name: 'Airport Shuttle', icon: 'plane', category: 'general', isDefault: false, sortOrder: 3 },
    { name: 'Concierge Service', icon: 'bell', category: 'general', isDefault: false, sortOrder: 4 },
    { name: 'Luggage Storage', icon: 'briefcase', category: 'general', isDefault: false, sortOrder: 5 },
    // Room Amenities
    { name: 'Air Conditioning', icon: 'wind', category: 'room', isDefault: true, sortOrder: 10 },
    { name: 'Flat-screen TV', icon: 'tv', category: 'room', isDefault: true, sortOrder: 11 },
    { name: 'Minibar', icon: 'wine', category: 'room', isDefault: true, sortOrder: 12 },
    { name: 'In-room Safe', icon: 'shield', category: 'room', isDefault: true, sortOrder: 13 },
    { name: 'Work Desk', icon: 'briefcase', category: 'room', isDefault: true, sortOrder: 14 },
    { name: 'Sofa', icon: 'sofa', category: 'room', isDefault: false, sortOrder: 15 },
    { name: 'Coffee Machine', icon: 'coffee', category: 'room', isDefault: true, sortOrder: 16 },
    { name: 'Tea Maker', icon: 'coffee', category: 'room', isDefault: false, sortOrder: 17 },
    { name: 'Iron & Ironing Board', icon: 'shirt', category: 'room', isDefault: true, sortOrder: 18 },
    { name: 'Mini Fridge', icon: 'refrigerator', category: 'room', isDefault: false, sortOrder: 19 },
    { name: 'King Bed', icon: 'bed-double', category: 'room', isDefault: true, sortOrder: 20 },
    { name: 'Twin Beds', icon: 'bed', category: 'room', isDefault: false, sortOrder: 21 },
    { name: 'Sitting Area', icon: 'sofa', category: 'room', isDefault: false, sortOrder: 22 },
    { name: 'Balcony', icon: 'door-open', category: 'room', isDefault: false, sortOrder: 23 },
    { name: 'Telephone', icon: 'phone', category: 'room', isDefault: true, sortOrder: 24 },
    { name: 'Blackout Curtains', icon: 'eye-off', category: 'room', isDefault: false, sortOrder: 25 },
    // Bathroom Amenities
    { name: 'Bathtub', icon: 'bath', category: 'bathroom', isDefault: true, sortOrder: 30 },
    { name: 'Rain Shower', icon: 'droplets', category: 'bathroom', isDefault: true, sortOrder: 31 },
    { name: 'Hair Dryer', icon: 'scissors', category: 'bathroom', isDefault: true, sortOrder: 32 },
    { name: 'Toiletries', icon: 'droplet', category: 'bathroom', isDefault: true, sortOrder: 33 },
    { name: 'Bathrobe', icon: 'shirt', category: 'bathroom', isDefault: false, sortOrder: 34 },
    { name: 'Slippers', icon: 'footprints', category: 'bathroom', isDefault: false, sortOrder: 35 },
    { name: 'Hot Water', icon: 'flame', category: 'bathroom', isDefault: true, sortOrder: 36 },
    { name: 'Bidet', icon: 'droplets', category: 'bathroom', isDefault: false, sortOrder: 37 },
    // View Amenities
    { name: 'Sea View', icon: 'waves', category: 'view', isDefault: false, sortOrder: 40 },
    { name: 'Mountain View', icon: 'mountain', category: 'view', isDefault: false, sortOrder: 41 },
    { name: 'City View', icon: 'building', category: 'view', isDefault: false, sortOrder: 42 },
    { name: 'Garden View', icon: 'trees', category: 'view', isDefault: false, sortOrder: 43 },
    { name: 'Pool View', icon: 'waves', category: 'view', isDefault: false, sortOrder: 44 },
    { name: 'Lake View', icon: 'droplets', category: 'view', isDefault: false, sortOrder: 45 },
    // Services
    { name: 'Room Service', icon: 'utensils', category: 'services', isDefault: true, sortOrder: 50 },
    { name: 'Housekeeping', icon: 'sparkles', category: 'services', isDefault: true, sortOrder: 51 },
    { name: 'Laundry Service', icon: 'shirt', category: 'services', isDefault: false, sortOrder: 52 },
    { name: 'Wake-up Call', icon: 'alarm-clock', category: 'services', isDefault: true, sortOrder: 53 },
    { name: 'Spa Access', icon: 'heart', category: 'services', isDefault: false, sortOrder: 54 },
    { name: 'Gym Access', icon: 'dumbbell', category: 'services', isDefault: false, sortOrder: 55 },
    { name: 'Pool Access', icon: 'waves', category: 'services', isDefault: false, sortOrder: 56 },
    { name: 'Breakfast Included', icon: 'sunrise', category: 'services', isDefault: false, sortOrder: 57 },
    { name: 'Pet Friendly', icon: 'paw-print', category: 'services', isDefault: false, sortOrder: 58 },
  ];

  await prisma.amenity.createMany({
    data: defaultAmenities.map((a) => ({
      ...a,
      tenantId: uuid('tenant-1'),
      isActive: true,
    })),
  });

  // Create users
  console.log('Seeding users...');
  const adminPasswordHash = await seedHashPassword('admin123');
  const staffPasswordHash = await seedHashPassword('staff123');
  
  await prisma.user.createMany({
    data: [
      { id: uuid('user-1'), tenantId: uuid('tenant-1'), email: 'admin@royalstay.in', passwordHash: adminPasswordHash, firstName: 'Rajesh', lastName: 'Sharma', jobTitle: 'General Manager', department: 'Management', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: uuid('role-1') },
      { id: uuid('user-2'), tenantId: uuid('tenant-1'), email: 'frontdesk@royalstay.in', passwordHash: staffPasswordHash, firstName: 'Priya', lastName: 'Das', jobTitle: 'Front Desk Manager', department: 'Front Desk', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: uuid('role-3') },
      { id: uuid('user-3'), tenantId: uuid('tenant-1'), email: 'housekeeping@royalstay.in', passwordHash: staffPasswordHash, firstName: 'Anita', lastName: 'Roy', jobTitle: 'Housekeeping Supervisor', department: 'Housekeeping', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: uuid('role-4') },
      // Platform Admin - can manage all tenants
      { id: uuid('user-platform'), tenantId: uuid('tenant-1'), email: 'platform@staysuite.com', passwordHash: adminPasswordHash, firstName: 'Platform', lastName: 'Admin', jobTitle: 'Platform Administrator', department: 'Platform', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: uuid('role-1'), isPlatformAdmin: true },
    ],
  });

  // Create roles for tenant 2
  console.log('Seeding tenant 2 roles...');
  await prisma.role.createMany({
    data: [
      {
        id: uuid('role-t2-1'),
        tenantId: uuid('tenant-2'),
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full system access',
        permissions: JSON.stringify(['*']),
        isSystem: true,
      },
      {
        id: uuid('role-t2-2'),
        tenantId: uuid('tenant-2'),
        name: 'manager',
        displayName: 'General Manager',
        description: 'Operations and reports',
        permissions: JSON.stringify([
          'dashboard.*',
          'bookings.*',
          'guests.*',
          'rooms.view',
          'rooms.update',
          'housekeeping.view',
          'billing.*',
          'reports.*',
          'frontdesk.*',
          'settings.view',
          'notifications.view',
          'inventory.view',
        ]),
        isSystem: true,
      },
      {
        id: uuid('role-t2-3'),
        tenantId: uuid('tenant-2'),
        name: 'front_desk',
        displayName: 'Front Desk Agent',
        description: 'Front desk operations',
        permissions: JSON.stringify([
          'dashboard.operations',
          'bookings.view',
          'bookings.create',
          'bookings.update',
          'guests.view',
          'guests.create',
          'rooms.view',
          'frontdesk.*',
          'billing.view',
          'communication.chat',
        ]),
        isSystem: true,
      },
    ],
  });

  // Create users for tenant 2
  console.log('Seeding tenant 2 users...');
  await prisma.user.createMany({
    data: [
      { id: uuid('user-t2-1'), tenantId: uuid('tenant-2'), email: 'admin@oceanview.com', passwordHash: adminPasswordHash, firstName: 'Carlos', lastName: 'Rodriguez', jobTitle: 'General Manager', department: 'Management', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: uuid('role-t2-1') },
      { id: uuid('user-t2-2'), tenantId: uuid('tenant-2'), email: 'frontdesk@oceanview.com', passwordHash: staffPasswordHash, firstName: 'Maria', lastName: 'Gonzalez', jobTitle: 'Front Desk Agent', department: 'Front Desk', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: uuid('role-t2-3') },
      { id: uuid('user-t2-3'), tenantId: uuid('tenant-2'), email: 'manager@oceanview.com', passwordHash: staffPasswordHash, firstName: 'James', lastName: 'Wilson', jobTitle: 'Operations Manager', department: 'Operations', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: uuid('role-t2-2') },
    ],
  });

  // Create properties - Indian Hotels
  console.log('Seeding properties...');
  await prisma.property.createMany({
    data: [
      {
        id: uuid('property-1'),
        tenantId: uuid('tenant-1'),
        name: 'Royal Stay Kolkata',
        slug: 'royal-stay-kolkata',
        description: 'A luxury 5-star hotel in the heart of Kolkata with stunning views of Victoria Memorial.',
        type: 'hotel',
        address: '123 Park Street',
        city: 'Kolkata',
        state: 'West Bengal',
        country: 'India',
        postalCode: '700016',
        email: 'kolkata@royalstay.in',
        phone: '+91-33-40012345',
        website: 'https://royalstay.in/kolkata',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        totalRooms: 120,
        totalFloors: 10,
        status: 'active',
      },
      {
        id: uuid('property-2'),
        tenantId: uuid('tenant-1'),
        name: 'Royal Stay Darjeeling',
        slug: 'royal-stay-darjeeling',
        description: 'Boutique hill resort with breathtaking views of the Himalayas and Kanchenjunga.',
        type: 'resort',
        address: '456 Mall Road',
        city: 'Darjeeling',
        state: 'West Bengal',
        country: 'India',
        postalCode: '734101',
        email: 'darjeeling@royalstay.in',
        phone: '+91-354-2256789',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        totalRooms: 50,
        totalFloors: 4,
        status: 'active',
      },
    ],
  });

  // Create room types with INR pricing
  console.log('Seeding room types...');
  await prisma.roomType.createMany({
    data: [
      { id: uuid('roomtype-1'), propertyId: uuid('property-1'), name: 'Standard Room', code: 'STD', description: 'Comfortable room with essential amenities', maxAdults: 2, maxChildren: 1, maxOccupancy: 3, sizeSqMeters: 25, amenities: '[]', basePrice: 3500, currency: 'INR', images: '[]', sortOrder: 1, totalRooms: 40, status: 'active' },
      { id: uuid('roomtype-2'), propertyId: uuid('property-1'), name: 'Deluxe Room', code: 'DLX', description: 'Spacious room with city views', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, sizeSqMeters: 35, amenities: '[]', basePrice: 5500, currency: 'INR', images: '[]', sortOrder: 2, totalRooms: 35, status: 'active' },
      { id: uuid('roomtype-3'), propertyId: uuid('property-1'), name: 'Executive Suite', code: 'EXEC', description: 'Luxurious suite with separate living area', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, sizeSqMeters: 55, amenities: '[]', basePrice: 12000, currency: 'INR', images: '[]', sortOrder: 3, totalRooms: 25, status: 'active' },
      { id: uuid('roomtype-4'), propertyId: uuid('property-1'), name: 'Presidential Suite', code: 'PRES', description: 'Ultimate luxury with panoramic views', maxAdults: 4, maxChildren: 2, maxOccupancy: 6, sizeSqMeters: 120, amenities: '[]', basePrice: 35000, currency: 'INR', images: '[]', sortOrder: 4, totalRooms: 5, status: 'active' },
      { id: uuid('roomtype-5'), propertyId: uuid('property-2'), name: 'Mountain View Room', code: 'MTN', description: 'Cozy room with mountain views', maxAdults: 2, maxChildren: 1, maxOccupancy: 3, sizeSqMeters: 28, amenities: '[]', basePrice: 4500, currency: 'INR', images: '[]', sortOrder: 1, totalRooms: 25, status: 'active' },
      { id: uuid('roomtype-6'), propertyId: uuid('property-2'), name: 'Valley View Suite', code: 'VAL', description: 'Beautiful suite with valley views', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, sizeSqMeters: 45, amenities: '[]', basePrice: 8500, currency: 'INR', images: '[]', sortOrder: 2, totalRooms: 15, status: 'active' },
    ],
  });

  // Create rooms
  console.log('Seeding rooms...');
  
  const specificRooms = [
    { id: uuid('room-501'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-2'), number: '501', name: 'Deluxe Room 501', floor: 5, status: 'occupied', digitalKeyEnabled: true },
    { id: uuid('room-801'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-3'), number: '801', name: 'Executive Suite 801', floor: 8, status: 'occupied', digitalKeyEnabled: true },
    { id: uuid('room-510'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-2'), number: '510', name: 'Deluxe Room 510', floor: 5, status: 'available', digitalKeyEnabled: true },
    { id: uuid('room-1002'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-4'), number: '1002', name: 'Presidential Suite 1002', floor: 10, status: 'available', digitalKeyEnabled: true },
    { id: uuid('room-101'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-1'), number: '101', name: 'Standard Room 101', floor: 1, status: 'available', digitalKeyEnabled: true },
    { id: uuid('room-305'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-1'), number: '305', name: 'Standard Room 305', floor: 3, status: 'occupied', digitalKeyEnabled: true },
  ];
  
  await prisma.room.createMany({ data: specificRooms });
  
  // Create additional rooms
  const additionalRooms: any[] = [];
  let roomNum = 102;
  
  for (let floor = 1; floor <= 4; floor++) {
    for (let i = 0; i < 10; i++) {
      if (roomNum === 305) { roomNum++; continue; }
      additionalRooms.push({
        id: uuid(`room-${roomNum}`),
        propertyId: uuid('property-1'),
        roomTypeId: uuid('roomtype-1'),
        number: String(roomNum),
        name: `Standard Room ${roomNum}`,
        floor,
        status: ['available', 'occupied', 'available', 'maintenance'][i % 4],
        digitalKeyEnabled: true,
      });
      roomNum++;
    }
  }
  
  roomNum = 501;
  for (let floor = 5; floor <= 7; floor++) {
    for (let i = 0; i < 12; i++) {
      if (roomNum === 501 || roomNum === 510) { roomNum++; continue; }
      additionalRooms.push({
        id: uuid(`room-${roomNum}`),
        propertyId: uuid('property-1'),
        roomTypeId: uuid('roomtype-2'),
        number: String(roomNum),
        name: `Deluxe Room ${roomNum}`,
        floor,
        hasBalcony: true,
        status: 'available',
        digitalKeyEnabled: true,
      });
      roomNum++;
    }
  }
  
  roomNum = 801;
  for (let floor = 8; floor <= 9; floor++) {
    for (let i = 0; i < 8; i++) {
      if (roomNum === 801) { roomNum++; continue; }
      additionalRooms.push({
        id: uuid(`room-${roomNum}`),
        propertyId: uuid('property-1'),
        roomTypeId: uuid('roomtype-3'),
        number: String(roomNum),
        name: `Executive Suite ${roomNum}`,
        floor,
        hasBalcony: true,
        status: 'available',
        digitalKeyEnabled: true,
      });
      roomNum++;
    }
  }
  
  roomNum = 1001;
  for (let i = 0; i < 5; i++) {
    if (roomNum === 1002) { roomNum++; continue; }
    additionalRooms.push({
      id: uuid(`room-${roomNum}`),
      propertyId: uuid('property-1'),
      roomTypeId: uuid('roomtype-4'),
      number: String(roomNum),
      name: `Presidential Suite ${roomNum}`,
      floor: 10,
      hasBalcony: true,
      status: 'available',
      digitalKeyEnabled: true,
    });
    roomNum++;
  }
  
  await prisma.room.createMany({ data: additionalRooms });

  // Create guests - Indian guests
  console.log('Seeding guests...');
  await prisma.guest.createMany({
    data: [
      { id: uuid('guest-1'), tenantId: uuid('tenant-1'), firstName: 'Amit', lastName: 'Mukherjee', email: 'amit.m@email.com', phone: '+91-9830012345', nationality: 'India', gender: 'male', address: '45 Lake Gardens', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700045', loyaltyTier: 'gold', loyaltyPoints: 4500, totalStays: 12, totalSpent: 85000, isVip: true, source: 'direct', emailOptIn: true, kycStatus: 'verified' },
      { id: uuid('guest-2'), tenantId: uuid('tenant-1'), firstName: 'Sneha', lastName: 'Gupta', email: 'sneha.g@email.com', phone: '+91-9830023456', nationality: 'India', gender: 'female', address: '78 Salt Lake', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700091', loyaltyTier: 'silver', loyaltyPoints: 2200, totalStays: 5, totalSpent: 32000, isVip: false, source: 'booking_com', emailOptIn: true, kycStatus: 'verified' },
      { id: uuid('guest-3'), tenantId: uuid('tenant-1'), firstName: 'Rahul', lastName: 'Banerjee', email: 'rahul.b@email.com', phone: '+91-9830034567', nationality: 'India', gender: 'male', address: '12 Ballygunge Place', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700019', loyaltyTier: 'platinum', loyaltyPoints: 12500, totalStays: 25, totalSpent: 250000, isVip: true, source: 'direct', emailOptIn: true, kycStatus: 'verified' },
      { id: uuid('guest-4'), tenantId: uuid('tenant-1'), firstName: 'Pooja', lastName: 'Saha', email: 'pooja.s@email.com', phone: '+91-9830045678', nationality: 'India', gender: 'female', address: '23 Behala', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700034', loyaltyTier: 'bronze', loyaltyPoints: 800, totalStays: 2, totalSpent: 6000, isVip: false, source: 'airbnb', emailOptIn: false, kycStatus: 'pending' },
      { id: uuid('guest-5'), tenantId: uuid('tenant-1'), firstName: 'Vikram', lastName: 'Singh', email: 'vikram.s@email.com', phone: '+91-9830056789', nationality: 'India', gender: 'male', address: '56 Sector V', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700091', loyaltyTier: 'gold', loyaltyPoints: 5100, totalStays: 15, totalSpent: 92000, isVip: true, source: 'expedia', emailOptIn: true, kycStatus: 'verified' },
      { id: uuid('guest-6'), tenantId: uuid('tenant-1'), firstName: 'Rina', lastName: 'Chatterjee', email: 'rina.c@email.com', phone: '+91-9830067890', nationality: 'India', gender: 'female', address: '89 Gariahat', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700019', loyaltyTier: 'silver', loyaltyPoints: 1800, totalStays: 4, totalSpent: 24000, isVip: false, source: 'direct', emailOptIn: true, kycStatus: 'verified' },
    ],
  });

  // Create bookings with INR
  console.log('Seeding bookings...');
  const today = new Date();
  
  await prisma.booking.createMany({
    data: [
      {
        id: uuid('booking-1'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        confirmationCode: 'RS-2024-001',
        primaryGuestId: uuid('guest-1'),
        roomId: uuid('room-501'),
        roomTypeId: uuid('roomtype-2'),
        checkIn: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        checkOut: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        adults: 2,
        children: 0,
        roomRate: 5500,
        taxes: 990,
        fees: 500,
        totalAmount: 17990,
        currency: 'INR',
        source: 'direct',
        status: 'checked_in',
        actualCheckIn: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: uuid('booking-2'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        confirmationCode: 'RS-2024-002',
        primaryGuestId: uuid('guest-3'),
        roomId: uuid('room-801'),
        roomTypeId: uuid('roomtype-3'),
        checkIn: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        checkOut: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        adults: 2,
        children: 1,
        roomRate: 12000,
        taxes: 2160,
        fees: 1000,
        totalAmount: 53160,
        currency: 'INR',
        source: 'direct',
        status: 'checked_in',
        actualCheckIn: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: uuid('booking-3'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        confirmationCode: 'RS-2024-003',
        primaryGuestId: uuid('guest-2'),
        roomId: uuid('room-510'),
        roomTypeId: uuid('roomtype-2'),
        checkIn: new Date(),
        checkOut: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
        adults: 2,
        children: 1,
        roomRate: 5500,
        taxes: 990,
        fees: 500,
        totalAmount: 23490,
        currency: 'INR',
        source: 'booking_com',
        status: 'confirmed',
      },
      {
        id: uuid('booking-4'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        confirmationCode: 'RS-2024-004',
        primaryGuestId: uuid('guest-5'),
        roomId: uuid('room-1002'),
        roomTypeId: uuid('roomtype-4'),
        checkIn: new Date(),
        checkOut: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        adults: 2,
        children: 0,
        roomRate: 35000,
        taxes: 6300,
        fees: 2500,
        totalAmount: 113800,
        currency: 'INR',
        source: 'direct',
        status: 'confirmed',
      },
      {
        id: uuid('booking-5'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        confirmationCode: 'RS-2024-005',
        primaryGuestId: uuid('guest-4'),
        roomId: uuid('room-101'),
        roomTypeId: uuid('roomtype-1'),
        checkIn: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        checkOut: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000),
        adults: 1,
        children: 0,
        roomRate: 3500,
        taxes: 630,
        fees: 300,
        totalAmount: 11430,
        currency: 'INR',
        source: 'airbnb',
        status: 'confirmed',
      },
      {
        id: uuid('booking-6'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        confirmationCode: 'RS-2024-006',
        primaryGuestId: uuid('guest-6'),
        roomId: uuid('room-305'),
        roomTypeId: uuid('roomtype-1'),
        checkIn: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
        checkOut: new Date(),
        adults: 2,
        children: 0,
        roomRate: 3500,
        taxes: 630,
        fees: 300,
        totalAmount: 11430,
        currency: 'INR',
        source: 'direct',
        status: 'checked_in',
        actualCheckIn: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // Create rate plans with INR
  console.log('Seeding rate plans...');
  await prisma.ratePlan.createMany({
    data: [
      { id: uuid('rateplan-1'), tenantId: uuid('tenant-1'), roomTypeId: uuid('roomtype-1'), name: 'Best Available Rate', code: 'BAR', description: 'Flexible rate with free cancellation', basePrice: 3500, currency: 'INR', mealPlan: 'room_only', minStay: 1, cancellationPolicy: 'moderate', status: 'active' },
      { id: uuid('rateplan-2'), tenantId: uuid('tenant-1'), roomTypeId: uuid('roomtype-1'), name: 'Non-Refundable', code: 'NRF', description: 'Discounted non-refundable rate', basePrice: 2975, currency: 'INR', mealPlan: 'room_only', minStay: 1, cancellationPolicy: 'non_refundable', status: 'active' },
      { id: uuid('rateplan-3'), tenantId: uuid('tenant-1'), roomTypeId: uuid('roomtype-1'), name: 'Bed & Breakfast', code: 'BB', description: 'Room with daily breakfast', basePrice: 4200, currency: 'INR', mealPlan: 'breakfast', minStay: 1, cancellationPolicy: 'moderate', status: 'active' },
      { id: uuid('rateplan-4'), tenantId: uuid('tenant-1'), roomTypeId: uuid('roomtype-2'), name: 'Best Available Rate', code: 'BAR', description: 'Flexible rate', basePrice: 5500, currency: 'INR', mealPlan: 'room_only', minStay: 1, cancellationPolicy: 'moderate', status: 'active' },
      { id: uuid('rateplan-5'), tenantId: uuid('tenant-1'), roomTypeId: uuid('roomtype-2'), name: 'Non-Refundable', code: 'NRF', description: 'Discounted rate', basePrice: 4675, currency: 'INR', mealPlan: 'room_only', minStay: 2, cancellationPolicy: 'non_refundable', status: 'active' },
      { id: uuid('rateplan-6'), tenantId: uuid('tenant-1'), roomTypeId: uuid('roomtype-3'), name: 'Best Available Rate', code: 'BAR', description: 'Flexible rate with lounge access', basePrice: 12000, currency: 'INR', mealPlan: 'room_only', minStay: 2, cancellationPolicy: 'flexible', status: 'active' },
      { id: uuid('rateplan-7'), tenantId: uuid('tenant-1'), roomTypeId: uuid('roomtype-4'), name: 'Presidential Package', code: 'PRES', description: 'All-inclusive luxury experience', basePrice: 35000, currency: 'INR', mealPlan: 'full_board', minStay: 2, cancellationPolicy: 'flexible', status: 'active' },
    ],
  });

  // WiFi plans are now seeded by wifi-seed.ts (comprehensive 6 plans)
  // See prisma/wifi-seed.ts for full WiFi module data

  // Create vendors
  console.log('Seeding vendors...');
  await prisma.vendor.createMany({
    data: [
      { id: uuid('vendor-1'), tenantId: uuid('tenant-1'), name: 'Premium Linen Supply', contactPerson: 'Rajesh Kumar', email: 'rajesh@premiumlinen.in', phone: '+91-33-24567890', type: 'supplier', paymentTerms: 'Net 30', status: 'active' },
      { id: uuid('vendor-2'), tenantId: uuid('tenant-1'), name: 'CleanPro Services', contactPerson: 'Suman Roy', email: 'suman@cleanpro.in', phone: '+91-33-24678901', type: 'contractor', paymentTerms: 'Net 15', status: 'active' },
      { id: uuid('vendor-3'), tenantId: uuid('tenant-1'), name: 'Tech Solutions India', contactPerson: 'Amit Sharma', email: 'amit@techsolutions.in', phone: '+91-33-24789012', type: 'service', paymentTerms: 'Net 45', status: 'active' },
    ],
  });

  // Create stock items
  console.log('Seeding stock items...');
  await prisma.stockItem.createMany({
    data: [
      { id: uuid('stock-1'), tenantId: uuid('tenant-1'), name: 'Bath Towels', sku: 'TOWEL-BATH', category: 'Linens', unit: 'piece', unitCost: 250, quantity: 200, minQuantity: 50, maxQuantity: 500, reorderPoint: 100, location: 'Main Storage', status: 'active' },
      { id: uuid('stock-2'), tenantId: uuid('tenant-1'), name: 'Hand Towels', sku: 'TOWEL-HAND', category: 'Linens', unit: 'piece', unitCost: 150, quantity: 300, minQuantity: 75, maxQuantity: 600, reorderPoint: 150, location: 'Main Storage', status: 'active' },
      { id: uuid('stock-3'), tenantId: uuid('tenant-1'), name: 'Shampoo Bottles', sku: 'AMEN-SHAM', category: 'Amenities', unit: 'piece', unitCost: 35, quantity: 500, minQuantity: 100, maxQuantity: 1000, reorderPoint: 200, location: 'Amenities Storage', status: 'active' },
      { id: uuid('stock-4'), tenantId: uuid('tenant-1'), name: 'Conditioner Bottles', sku: 'AMEN-COND', category: 'Amenities', unit: 'piece', unitCost: 35, quantity: 500, minQuantity: 100, maxQuantity: 1000, reorderPoint: 200, location: 'Amenities Storage', status: 'active' },
      { id: uuid('stock-5'), tenantId: uuid('tenant-1'), name: 'Toilet Paper', sku: 'PAPER-TP', category: 'Consumables', unit: 'roll', unitCost: 15, quantity: 1000, minQuantity: 200, maxQuantity: 2000, reorderPoint: 400, location: 'Main Storage', status: 'active' },
      { id: uuid('stock-6'), tenantId: uuid('tenant-1'), name: 'Hand Soap', sku: 'AMEN-SOAP', category: 'Amenities', unit: 'bottle', unitCost: 25, quantity: 150, minQuantity: 50, maxQuantity: 300, reorderPoint: 100, location: 'Amenities Storage', status: 'active' },
    ],
  });

  // Create Order Categories
  console.log('Seeding order categories...');
  await prisma.orderCategory.createMany({
    data: [
      { id: uuid('cat-1'), propertyId: uuid('property-1'), name: 'Starters', description: 'Appetizers and starters', sortOrder: 1, status: 'active' },
      { id: uuid('cat-2'), propertyId: uuid('property-1'), name: 'Main Course', description: 'Main dishes', sortOrder: 2, status: 'active' },
      { id: uuid('cat-3'), propertyId: uuid('property-1'), name: 'Desserts', description: 'Sweet treats', sortOrder: 3, status: 'active' },
      { id: uuid('cat-4'), propertyId: uuid('property-1'), name: 'Beverages', description: 'Drinks and refreshments', sortOrder: 4, status: 'active' },
      { id: uuid('cat-5'), propertyId: uuid('property-1'), name: 'Indian Specials', description: 'Authentic Indian cuisine', sortOrder: 5, status: 'active' },
    ],
  });

  // Create Menu Items with INR prices
  console.log('Seeding menu items...');
  await prisma.menuItem.createMany({
    data: [
      // Starters
      { id: uuid('menu-1'), propertyId: uuid('property-1'), categoryId: uuid('cat-1'), name: 'Samosa', description: 'Crispy pastry filled with spiced potatoes', price: 120, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 10, kitchenStation: 'fryer', sortOrder: 1, status: 'active' },
      { id: uuid('menu-2'), propertyId: uuid('property-1'), categoryId: uuid('cat-1'), name: 'Paneer Tikka', description: 'Grilled cottage cheese with spices', price: 280, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 15, kitchenStation: 'tandoor', sortOrder: 2, status: 'active' },
      { id: uuid('menu-3'), propertyId: uuid('property-1'), categoryId: uuid('cat-1'), name: 'Chicken Tikka', description: 'Tender chicken marinated in yogurt and spices', price: 320, currency: 'INR', isAvailable: true, preparationTime: 18, kitchenStation: 'tandoor', sortOrder: 3, status: 'active' },
      { id: uuid('menu-4'), propertyId: uuid('property-1'), categoryId: uuid('cat-1'), name: 'Vegetable Spring Roll', description: 'Crispy rolls with mixed vegetables', price: 180, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 12, kitchenStation: 'fryer', sortOrder: 4, status: 'active' },
      // Main Course
      { id: uuid('menu-5'), propertyId: uuid('property-1'), categoryId: uuid('cat-2'), name: 'Butter Chicken', description: 'Creamy tomato-based curry with tender chicken', price: 420, currency: 'INR', isAvailable: true, preparationTime: 20, kitchenStation: 'curry', sortOrder: 1, status: 'active' },
      { id: uuid('menu-6'), propertyId: uuid('property-1'), categoryId: uuid('cat-2'), name: 'Dal Makhani', description: 'Creamy black lentils slow-cooked overnight', price: 280, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 15, kitchenStation: 'curry', sortOrder: 2, status: 'active' },
      { id: uuid('menu-7'), propertyId: uuid('property-1'), categoryId: uuid('cat-2'), name: 'Fish Curry', description: 'Bengali style fish curry with rohu', price: 480, currency: 'INR', isAvailable: true, preparationTime: 22, kitchenStation: 'curry', sortOrder: 3, status: 'active' },
      { id: uuid('menu-8'), propertyId: uuid('property-1'), categoryId: uuid('cat-2'), name: 'Vegetable Biryani', description: 'Fragrant basmati rice with mixed vegetables', price: 320, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 25, kitchenStation: 'rice', sortOrder: 4, status: 'active' },
      // Desserts
      { id: uuid('menu-9'), propertyId: uuid('property-1'), categoryId: uuid('cat-3'), name: 'Rasgulla', description: 'Soft cottage cheese balls in sugar syrup', price: 120, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 5, kitchenStation: 'dessert', sortOrder: 1, status: 'active' },
      { id: uuid('menu-10'), propertyId: uuid('property-1'), categoryId: uuid('cat-3'), name: 'Gulab Jamun', description: 'Deep-fried milk dumplings in rose syrup', price: 150, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 10, kitchenStation: 'dessert', sortOrder: 2, status: 'active' },
      { id: uuid('menu-11'), propertyId: uuid('property-1'), categoryId: uuid('cat-3'), name: 'Mishti Doi', description: 'Traditional Bengali sweet yogurt', price: 100, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 5, kitchenStation: 'dessert', sortOrder: 3, status: 'active' },
      // Beverages
      { id: uuid('menu-12'), propertyId: uuid('property-1'), categoryId: uuid('cat-4'), name: 'Masala Chai', description: 'Traditional Indian spiced tea', price: 60, currency: 'INR', isVegan: true, isAvailable: true, preparationTime: 5, kitchenStation: 'bar', sortOrder: 1, status: 'active' },
      { id: uuid('menu-13'), propertyId: uuid('property-1'), categoryId: uuid('cat-4'), name: 'Fresh Lime Soda', description: 'Refreshing lime with soda', price: 80, currency: 'INR', isVegan: true, isAvailable: true, preparationTime: 3, kitchenStation: 'bar', sortOrder: 2, status: 'active' },
      { id: uuid('menu-14'), propertyId: uuid('property-1'), categoryId: uuid('cat-4'), name: 'Mango Lassi', description: 'Creamy yogurt drink with mango', price: 120, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 5, kitchenStation: 'bar', sortOrder: 3, status: 'active' },
    ],
  });

  // Create Restaurant Tables
  console.log('Seeding restaurant tables...');
  await prisma.restaurantTable.createMany({
    data: [
      { id: uuid('table-1'), propertyId: uuid('property-1'), number: 'T1', name: 'Window Seat', capacity: 2, area: 'indoor', floor: 1, status: 'available' },
      { id: uuid('table-2'), propertyId: uuid('property-1'), number: 'T2', name: 'Window Seat', capacity: 2, area: 'indoor', floor: 1, status: 'occupied' },
      { id: uuid('table-3'), propertyId: uuid('property-1'), number: 'T3', capacity: 4, area: 'indoor', floor: 1, status: 'available' },
      { id: uuid('table-4'), propertyId: uuid('property-1'), number: 'T4', capacity: 4, area: 'indoor', floor: 1, status: 'reserved' },
      { id: uuid('table-5'), propertyId: uuid('property-1'), number: 'T5', capacity: 6, area: 'indoor', floor: 1, status: 'available' },
      { id: uuid('table-6'), propertyId: uuid('property-1'), number: 'T6', capacity: 4, area: 'patio', floor: 1, status: 'available' },
      { id: uuid('table-7'), propertyId: uuid('property-1'), number: 'T7', capacity: 4, area: 'patio', floor: 1, status: 'occupied' },
      { id: uuid('table-8'), propertyId: uuid('property-1'), number: 'T8', capacity: 8, area: 'vip', floor: 2, name: 'VIP Room', status: 'available' },
      { id: uuid('table-9'), propertyId: uuid('property-1'), number: 'T9', capacity: 6, area: 'bar', floor: 1, status: 'cleaning' },
      { id: uuid('table-10'), propertyId: uuid('property-1'), number: 'T10', capacity: 2, area: 'bar', floor: 1, status: 'available' },
    ],
  });

  // Create Orders with INR
  console.log('Seeding orders...');
  await prisma.order.createMany({
    data: [
      {
        id: uuid('order-1'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        tableId: uuid('table-2'),
        orderNumber: 'ORD-001',
        orderType: 'dine_in',
        subtotal: 740,
        taxes: 133,
        totalAmount: 873,
        status: 'preparing',
        kitchenStatus: 'cooking',
        kitchenStartedAt: new Date(Date.now() - 10 * 60 * 1000),
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        id: uuid('order-2'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        tableId: uuid('table-7'),
        orderNumber: 'ORD-002',
        orderType: 'dine_in',
        guestName: 'Amit Mukherjee',
        subtotal: 1220,
        taxes: 220,
        totalAmount: 1440,
        status: 'pending',
        kitchenStatus: 'pending',
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        id: uuid('order-3'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        orderNumber: 'ORD-003',
        orderType: 'room_service',
        guestName: 'Sneha Gupta',
        guestId: uuid('guest-2'),
        subtotal: 600,
        taxes: 108,
        totalAmount: 708,
        status: 'ready',
        kitchenStatus: 'ready',
        kitchenStartedAt: new Date(Date.now() - 25 * 60 * 1000),
        kitchenCompletedAt: new Date(Date.now() - 5 * 60 * 1000),
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: uuid('order-4'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        orderNumber: 'ORD-004',
        orderType: 'takeout',
        guestName: 'Walk-in Guest',
        subtotal: 380,
        taxes: 68,
        totalAmount: 448,
        status: 'served',
        kitchenStatus: 'ready',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 45 * 60 * 1000),
      },
    ],
  });

  // Create Order Items
  console.log('Seeding order items...');
  await prisma.orderItem.createMany({
    data: [
      // Order 1 items
      { id: uuid('orderitem-1'), orderId: uuid('order-1'), menuItemId: uuid('menu-5'), quantity: 1, unitPrice: 420, totalAmount: 420, status: 'preparing' },
      { id: uuid('orderitem-2'), orderId: uuid('order-1'), menuItemId: uuid('menu-12'), quantity: 2, unitPrice: 60, totalAmount: 120, status: 'preparing' },
      { id: uuid('orderitem-3'), orderId: uuid('order-1'), menuItemId: uuid('menu-14'), quantity: 1, unitPrice: 120, totalAmount: 120, status: 'preparing' },
      // Order 2 items
      { id: uuid('orderitem-4'), orderId: uuid('order-2'), menuItemId: uuid('menu-7'), quantity: 1, unitPrice: 480, totalAmount: 480, status: 'pending' },
      { id: uuid('orderitem-5'), orderId: uuid('order-2'), menuItemId: uuid('menu-1'), quantity: 2, unitPrice: 120, totalAmount: 240, status: 'pending' },
      { id: uuid('orderitem-6'), orderId: uuid('order-2'), menuItemId: uuid('menu-10'), quantity: 2, unitPrice: 150, totalAmount: 300, status: 'pending' },
      { id: uuid('orderitem-7'), orderId: uuid('order-2'), menuItemId: uuid('menu-13'), quantity: 2, unitPrice: 80, totalAmount: 160, status: 'pending' },
      // Order 3 items
      { id: uuid('orderitem-8'), orderId: uuid('order-3'), menuItemId: uuid('menu-8'), quantity: 1, unitPrice: 320, totalAmount: 320, status: 'ready' },
      { id: uuid('orderitem-9'), orderId: uuid('order-3'), menuItemId: uuid('menu-4'), quantity: 1, unitPrice: 180, totalAmount: 180, status: 'ready' },
      { id: uuid('orderitem-10'), orderId: uuid('order-3'), menuItemId: uuid('menu-12'), quantity: 1, unitPrice: 60, totalAmount: 60, status: 'ready' },
      // Order 4 items
      { id: uuid('orderitem-11'), orderId: uuid('order-4'), menuItemId: uuid('menu-6'), quantity: 1, unitPrice: 280, totalAmount: 280, status: 'served' },
      { id: uuid('orderitem-12'), orderId: uuid('order-4'), menuItemId: uuid('menu-13'), quantity: 1, unitPrice: 80, totalAmount: 80, status: 'served' },
    ],
  });

  // === HOUSEKEEPING SEED DATA ===
  console.log('Seeding housekeeping tasks...');

  // Housekeeping Tasks for Tenant 1
  await prisma.task.createMany({
    data: [
      // Today's cleaning tasks
      {
        id: uuid('task-hk-1'),
        tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
        roomId: uuid('room-101'), assignedTo: uuid('user-3'),
        type: 'cleaning', category: 'checkout',
        title: 'Checkout Clean - Room 101',
        description: 'Full checkout cleaning including bathroom deep clean, linen change, restock amenities',
        priority: 'high', status: 'pending',
        scheduledAt: new Date(), estimatedDuration: 45,
        roomStatusBefore: 'occupied', roomStatusAfter: 'available',
        createdBy: uuid('user-2'),
      },
      {
        id: uuid('task-hk-2'),
        tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
        roomId: uuid('room-102'), assignedTo: uuid('user-3'),
        type: 'cleaning', category: 'stayover',
        title: 'Stayover Service - Room 102',
        description: 'Daily stayover service: fresh towels, empty bins, restock, make bed',
        priority: 'medium', status: 'in_progress',
        scheduledAt: new Date(), startedAt: new Date(Date.now() - 15 * 60000),
        estimatedDuration: 20,
        createdBy: uuid('user-2'),
      },
      {
        id: uuid('task-hk-3'),
        tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
        roomId: uuid('room-305'), assignedTo: uuid('user-3'),
        type: 'cleaning', category: 'checkout',
        title: 'Checkout Clean - Room 305',
        description: 'VIP checkout - extra attention to detail, welcome amenities restocked',
        priority: 'urgent', status: 'pending',
        scheduledAt: new Date(), estimatedDuration: 60,
        roomStatusBefore: 'occupied', roomStatusAfter: 'available',
        createdBy: uuid('user-1'),
      },
      {
        id: uuid('task-hk-4'),
        tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
        type: 'inspection', category: 'quality_check',
        title: 'Floor 3 Room Inspection',
        description: 'Inspect all rooms on floor 3 after morning cleaning',
        priority: 'medium', status: 'pending',
        scheduledAt: new Date(Date.now() + 2 * 3600000), estimatedDuration: 30,
        createdBy: uuid('user-1'),
      },
      {
        id: uuid('task-hk-5'),
        tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
        roomId: uuid('room-103'),
        type: 'maintenance', category: 'repair',
        title: 'Fix leaking faucet - Room 103',
        description: 'Bathroom faucet dripping, needs washer replacement',
        priority: 'high', status: 'pending',
        scheduledAt: new Date(Date.now() + 30 * 60000), estimatedDuration: 30,
        createdBy: uuid('user-3'),
      },
      {
        id: uuid('task-hk-6'),
        tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
        roomId: uuid('room-104'), assignedTo: uuid('user-3'),
        type: 'deep_clean', category: 'deep_clean',
        title: 'Deep Clean - Room 104',
        description: 'Monthly deep clean: carpet shampoo, window cleaning, behind furniture',
        priority: 'low', status: 'completed',
        scheduledAt: new Date(Date.now() - 24 * 3600000),
        completedAt: new Date(Date.now() - 20 * 3600000),
        estimatedDuration: 120, actualDuration: 105,
        createdBy: uuid('user-2'),
        completionNotes: 'Carpet shampooed, windows cleaned, all furniture moved and vacuumed behind',
        qualityScore: 5,
      },
      {
        id: uuid('task-hk-7'),
        tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
        type: 'public_area', category: 'lobby',
        title: 'Lobby and Reception Area Cleaning',
        description: 'Vacuum, dust all surfaces, clean entrance glass, restock brochures',
        priority: 'medium', status: 'completed',
        scheduledAt: new Date(Date.now() - 3 * 3600000),
        completedAt: new Date(Date.now() - 2 * 3600000),
        estimatedDuration: 45, actualDuration: 40,
        assignedTo: uuid('user-3'), createdBy: uuid('user-2'),
      },
      {
        id: uuid('task-hk-8'),
        tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
        roomId: uuid('room-501'), assignedTo: uuid('user-3'),
        type: 'cleaning', category: 'stayover',
        title: 'Stayover Service - Room 501 (VIP)',
        description: 'VIP guest - use premium amenities, extra towel set',
        priority: 'high', status: 'in_progress',
        scheduledAt: new Date(), startedAt: new Date(Date.now() - 5 * 60000),
        estimatedDuration: 25, createdBy: uuid('user-1'),
      },
    ],
  });

  console.log('Seeding staff skills...');
  await prisma.staffSkill.createMany({
    data: [
      { id: uuid('skill-1'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), skillName: 'Room Cleaning', skillLevel: 5, category: 'cleaning', certified: true, certifiedAt: new Date() },
      { id: uuid('skill-2'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), skillName: 'Deep Cleaning', skillLevel: 4, category: 'cleaning', certified: true, certifiedAt: new Date() },
      { id: uuid('skill-3'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), skillName: 'Quality Inspection', skillLevel: 3, category: 'inspection', certified: false },
      { id: uuid('skill-4'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), skillName: 'Laundry', skillLevel: 4, category: 'cleaning', certified: false },
      { id: uuid('skill-5'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), skillName: 'Public Area', skillLevel: 3, category: 'cleaning', certified: false },
      { id: uuid('skill-6'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), skillName: 'Chemical Handling', skillLevel: 3, category: 'maintenance', certified: true, certifiedAt: new Date() },
    ],
  });

  console.log('Seeding assets...');
  await prisma.asset.createMany({
    data: [
      { id: uuid('asset-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Industrial Vacuum Cleaner', category: 'cleaning_equipment', description: 'Commercial grade vacuum for corridors', location: 'Storage Room B1', purchasePrice: 25000, purchaseDate: new Date('2024-01-15'), currentValue: 22000, warrantyExpiry: new Date('2026-01-15'), warrantyProvider: 'CleanMax India', maintenanceIntervalDays: 90, nextMaintenanceAt: new Date(Date.now() + 15 * 86400000), status: 'active', serialNumber: 'VC-2024-001', manufacturer: 'CleanMax', conditionScore: 8 },
      { id: uuid('asset-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Floor Buffer/Polisher', category: 'cleaning_equipment', description: 'Heavy duty floor buffer for lobby and restaurant', location: 'Storage Room B1', purchasePrice: 45000, purchaseDate: new Date('2023-06-01'), currentValue: 38000, maintenanceIntervalDays: 60, status: 'active', serialNumber: 'FB-2023-001', manufacturer: 'FloorTech', conditionScore: 7 },
      { id: uuid('asset-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'HVAC Unit - Main Building', category: 'hvac', description: 'Central AC unit serving floors 1-4', purchasePrice: 500000, maintenanceIntervalDays: 180, status: 'active', manufacturer: 'Carrier', conditionScore: 9 },
      { id: uuid('asset-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Linen Cart Set', category: 'furniture', description: 'Set of 5 rolling linen carts', purchasePrice: 35000, purchaseDate: new Date('2024-03-10'), status: 'active', conditionScore: 6 },
      { id: uuid('asset-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Guest Laundry Machines', category: 'laundry', description: '2 commercial washers + 2 dryers', location: 'Laundry Room B2', purchasePrice: 180000, maintenanceIntervalDays: 90, nextMaintenanceAt: new Date(Date.now() - 5 * 86400000), status: 'maintenance', manufacturer: 'Electrolux', conditionScore: 5 },
    ],
  });

  console.log('Seeding preventive maintenance...');
  await prisma.preventiveMaintenance.createMany({
    data: [
      { id: uuid('pm-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), title: 'HVAC Filter Replacement', description: 'Replace air filters in all HVAC units', assetId: uuid('asset-3'), frequency: 'quarterly', assignedRoleId: uuid('role-4'), checklist: JSON.stringify(['Turn off HVAC unit', 'Remove old filters', 'Install new filters', 'Check airflow', 'Turn on and verify', 'Log completion']), lastCompletedAt: new Date(Date.now() - 60 * 86400000), nextDueAt: new Date(Date.now() + 30 * 86400000), status: 'active', estimatedDuration: 120, priority: 'high' },
      { id: uuid('pm-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), title: 'Fire Extinguisher Inspection', description: 'Monthly visual inspection of all fire extinguishers', frequency: 'monthly', checklist: JSON.stringify(['Check pressure gauge', 'Check safety pin', 'Check expiration date', 'Check visible damage', 'Log serial numbers']), lastCompletedAt: new Date(Date.now() - 15 * 86400000), nextDueAt: new Date(Date.now() + 15 * 86400000), status: 'active', estimatedDuration: 60 },
      { id: uuid('pm-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), title: 'Elevator Maintenance', description: 'Quarterly elevator servicing and safety check', frequency: 'quarterly', priority: 'high', checklist: JSON.stringify(['Check door sensors', 'Test emergency button', 'Check cable tension', 'Lubricate rails', 'Test leveling', 'Verify weight limit display']), lastCompletedAt: new Date(Date.now() - 90 * 86400000), nextDueAt: new Date(Date.now() - 5 * 86400000), status: 'active', estimatedDuration: 180 },
      { id: uuid('pm-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), title: 'Deep Clean Kitchen Extractor Hood', description: 'Monthly professional cleaning of kitchen ventilation', frequency: 'monthly', estimatedCost: 5000, priority: 'medium' },
    ],
  });

  console.log('Seeding staff workload...');
  const hkToday = new Date();
  hkToday.setHours(0, 0, 0, 0);
  await prisma.staffWorkload.createMany({
    data: [
      { id: uuid('wl-1'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), propertyId: uuid('property-1'), date: hkToday, totalTasks: 6, completedTasks: 2, totalMinutes: 245, workedMinutes: 60, capacityMinutes: 480, efficiency: 0.85 },
    ],
  });

  // Update room housekeeping statuses based on tasks
  console.log('Updating room housekeeping statuses...');
  // room-101 remains 'available' and 'clean' - booking-5 is confirmed but check-in is 7 days in the future
  await prisma.room.updateMany({ where: { id: uuid('room-102') }, data: { housekeepingStatus: 'cleaning' } });
  await prisma.room.updateMany({ where: { id: uuid('room-305') }, data: { housekeepingStatus: 'dirty', hkPriority: 'vip' } });
  await prisma.room.updateMany({ where: { id: uuid('room-103') }, data: { housekeepingStatus: 'clean' } });
  await prisma.room.updateMany({ where: { id: uuid('room-501') }, data: { housekeepingStatus: 'cleaning', hkPriority: 'high' } });

  console.log('Housekeeping seed data completed!');

  // ─── Discounts ───────────────────────────────────────────────────────────
  console.log('Seeding discounts...');
  const summerEnd = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  const earlyBirdEnd = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const welcomeEnd = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000);
  const fixed50End = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000);
  const compEnd = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);

  await prisma.discount.createMany({
    data: [
      { id: uuid('discount-1'), tenantId: uuid('tenant-1'), name: 'Summer Sale 20% Off', code: 'SUMMER20', type: 'percentage', value: 20, minAmount: 5000, maxDiscount: 10000, applicableTo: 'room', validUntil: summerEnd, maxUses: 200, usedCount: 47, isActive: true },
      { id: uuid('discount-2'), tenantId: uuid('tenant-1'), name: 'Welcome 10% Off', code: 'WELCOME10', type: 'percentage', value: 10, minAmount: 0, applicableTo: 'all', validUntil: welcomeEnd, maxUses: 500, usedCount: 123, isActive: true },
      { id: uuid('discount-3'), tenantId: uuid('tenant-1'), name: 'Early Bird 15% Off', code: 'EARLYBIRD', type: 'percentage', value: 15, minAmount: 3000, maxDiscount: 7500, applicableTo: 'room', validUntil: earlyBirdEnd, maxUses: 100, usedCount: 28, isActive: true },
      { id: uuid('discount-4'), tenantId: uuid('tenant-1'), name: 'Flat $50 Off', code: 'FIXED50', type: 'fixed_amount', value: 50, minAmount: 10000, maxDiscount: 50, applicableTo: 'all', validUntil: fixed50End, maxUses: 150, usedCount: 35, isActive: true },
      { id: uuid('discount-5'), tenantId: uuid('tenant-1'), name: 'Complimentary Stay', code: 'COMP_STAY', type: 'complimentary', value: 100, minAmount: 0, applicableTo: 'room', validUntil: compEnd, maxUses: 10, usedCount: 2, isActive: true },
    ],
  });

  // ─── Billing & Finance Seed Data ───────────────────────────────────────────
  console.log('Seeding folios, line items, payments, and invoices...');

  const todaySeed = new Date();

  // Folios for all 6 bookings
  const folios = [
    // booking-1: checked_in, 3 nights, roomRate=5500
    { id: uuid('folio-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-1'), folioNumber: 'FOL-KOL-0001', guestId: uuid('guest-1'), subtotal: 16500, taxes: 2970, discount: 0, totalAmount: 20970, paidAmount: 10000, balance: 10970, currency: 'INR', status: 'partially_paid', openedAt: new Date(todaySeed.getTime() - 2 * 24 * 60 * 60 * 1000) },
    // booking-2: checked_in, 4 nights, roomRate=12000
    { id: uuid('folio-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-2'), folioNumber: 'FOL-KOL-0002', guestId: uuid('guest-3'), subtotal: 48000, taxes: 8640, discount: 2000, totalAmount: 58640, paidAmount: 58640, balance: 0, currency: 'INR', status: 'paid', openedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), closedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000) },
    // booking-3: confirmed, 4 nights, roomRate=5500
    { id: uuid('folio-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-3'), folioNumber: 'FOL-KOL-0003', guestId: uuid('guest-2'), subtotal: 22000, taxes: 3960, discount: 0, totalAmount: 27960, paidAmount: 0, balance: 27960, currency: 'INR', status: 'open', openedAt: new Date() },
    // booking-4: confirmed, 2 nights, roomRate=35000
    { id: uuid('folio-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-4'), folioNumber: 'FOL-KOL-0004', guestId: uuid('guest-5'), subtotal: 70000, taxes: 12600, discount: 3500, totalAmount: 84100, paidAmount: 84100, balance: 0, currency: 'INR', status: 'paid', openedAt: new Date(), closedAt: new Date() },
    // booking-5: confirmed, 3 nights, roomRate=3500
    { id: uuid('folio-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-5'), folioNumber: 'FOL-KOL-0005', guestId: uuid('guest-4'), subtotal: 10500, taxes: 1890, discount: 0, totalAmount: 13290, paidAmount: 5000, balance: 8290, currency: 'INR', status: 'partially_paid', openedAt: new Date() },
    // booking-6: checked_in, 3 nights, roomRate=3500
    { id: uuid('folio-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-6'), folioNumber: 'FOL-KOL-0006', guestId: uuid('guest-6'), subtotal: 10500, taxes: 1890, discount: 0, totalAmount: 13290, paidAmount: 13290, balance: 0, currency: 'INR', status: 'paid', openedAt: new Date(todaySeed.getTime() - 3 * 24 * 60 * 60 * 1000), closedAt: new Date() },
  ];
  await prisma.folio.createMany({ data: folios });

  // Folio Line Items
  const folioLineItems = [
    // Folio 1 - Room 501, 3 nights
    { id: uuid('fli-1'), folioId: uuid('folio-1'), description: 'Room 501 - Deluxe Room - 3 night(s)', category: 'room_charge', quantity: 3, unitPrice: 5500, totalAmount: 16500, serviceDate: new Date(todaySeed.getTime() - 2 * 24 * 60 * 60 * 1000), taxRate: 18, taxAmount: 2970 },
    { id: uuid('fli-2'), folioId: uuid('folio-1'), description: 'Room Service - Butter Chicken, Naan, Lassi', category: 'food_beverage', quantity: 1, unitPrice: 900, totalAmount: 900, serviceDate: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), taxRate: 5, taxAmount: 45 },
    { id: uuid('fli-3'), folioId: uuid('folio-1'), description: 'Laundry Service - Dry Cleaning (3 items)', category: 'service', quantity: 3, unitPrice: 200, totalAmount: 600, serviceDate: new Date(), taxRate: 18, taxAmount: 108 },
    // Folio 2 - Room 801, 4 nights
    { id: uuid('fli-4'), folioId: uuid('folio-2'), description: 'Room 801 - Executive Suite - 4 night(s)', category: 'room_charge', quantity: 4, unitPrice: 12000, totalAmount: 48000, serviceDate: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), taxRate: 18, taxAmount: 8640 },
    { id: uuid('fli-5'), folioId: uuid('folio-2'), description: 'Mini Bar - Beverages & Snacks', category: 'food_beverage', quantity: 1, unitPrice: 2500, totalAmount: 2500, serviceDate: new Date(todaySeed.getTime() - 12 * 60 * 60 * 1000), taxRate: 5, taxAmount: 125 },
    // Folio 3 - Room 510, 4 nights (upcoming)
    { id: uuid('fli-6'), folioId: uuid('folio-3'), description: 'Room 510 - Deluxe Room - 4 night(s)', category: 'room_charge', quantity: 4, unitPrice: 5500, totalAmount: 22000, serviceDate: new Date(), taxRate: 18, taxAmount: 3960 },
    // Folio 4 - Room 1002, 2 nights
    { id: uuid('fli-7'), folioId: uuid('folio-4'), description: 'Room 1002 - Presidential Suite - 2 night(s)', category: 'room_charge', quantity: 2, unitPrice: 35000, totalAmount: 70000, serviceDate: new Date(), taxRate: 18, taxAmount: 12600 },
    // Folio 5 - Room 101, 3 nights (upcoming)
    { id: uuid('fli-8'), folioId: uuid('folio-5'), description: 'Room 101 - Standard Room - 3 night(s)', category: 'room_charge', quantity: 3, unitPrice: 3500, totalAmount: 10500, serviceDate: new Date(todaySeed.getTime() + 7 * 24 * 60 * 60 * 1000), taxRate: 18, taxAmount: 1890 },
    // Folio 6 - Room 305, 3 nights
    { id: uuid('fli-9'), folioId: uuid('folio-6'), description: 'Room 305 - Standard Room - 3 night(s)', category: 'room_charge', quantity: 3, unitPrice: 3500, totalAmount: 10500, serviceDate: new Date(todaySeed.getTime() - 3 * 24 * 60 * 60 * 1000), taxRate: 18, taxAmount: 1890 },
  ];
  await prisma.folioLineItem.createMany({ data: folioLineItems });

  // Payments
  const payments = [
    { id: uuid('pay-1'), tenantId: uuid('tenant-1'), folioId: uuid('folio-1'), guestId: uuid('guest-1'), amount: 5000, currency: 'INR', method: 'credit_card', gateway: 'stripe', cardType: 'visa', cardLast4: '4242', transactionId: uuid('txn-1'), status: 'completed', processedAt: new Date(todaySeed.getTime() - 2 * 24 * 60 * 60 * 1000) },
    { id: uuid('pay-2'), tenantId: uuid('tenant-1'), folioId: uuid('folio-1'), guestId: uuid('guest-1'), amount: 5000, currency: 'INR', method: 'credit_card', gateway: 'stripe', cardType: 'visa', cardLast4: '4242', transactionId: uuid('txn-2'), status: 'completed', processedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000) },
    { id: uuid('pay-3'), tenantId: uuid('tenant-1'), folioId: uuid('folio-2'), guestId: uuid('guest-3'), amount: 58640, currency: 'INR', method: 'bank_transfer', gateway: 'manual', transactionId: uuid('txn-3'), reference: 'NEFT-REF-78901', status: 'completed', processedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000) },
    { id: uuid('pay-4'), tenantId: uuid('tenant-1'), folioId: uuid('folio-4'), guestId: uuid('guest-5'), amount: 50000, currency: 'INR', method: 'credit_card', gateway: 'stripe', cardType: 'mastercard', cardLast4: '8888', transactionId: uuid('txn-4'), status: 'completed', processedAt: new Date() },
    { id: uuid('pay-5'), tenantId: uuid('tenant-1'), folioId: uuid('folio-4'), guestId: uuid('guest-5'), amount: 34100, currency: 'INR', method: 'upi', gateway: 'manual', transactionId: uuid('txn-5'), status: 'completed', processedAt: new Date() },
    { id: uuid('pay-6'), tenantId: uuid('tenant-1'), folioId: uuid('folio-5'), guestId: uuid('guest-4'), amount: 5000, currency: 'INR', method: 'upi', gateway: 'manual', transactionId: uuid('txn-6'), status: 'completed', processedAt: new Date() },
    { id: uuid('pay-7'), tenantId: uuid('tenant-1'), folioId: uuid('folio-6'), guestId: uuid('guest-6'), amount: 10000, currency: 'INR', method: 'cash', gateway: 'manual', transactionId: uuid('txn-7'), status: 'completed', processedAt: new Date(todaySeed.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { id: uuid('pay-8'), tenantId: uuid('tenant-1'), folioId: uuid('folio-6'), guestId: uuid('guest-6'), amount: 3290, currency: 'INR', method: 'credit_card', gateway: 'stripe', cardType: 'visa', cardLast4: '1234', transactionId: uuid('txn-8'), status: 'completed', processedAt: new Date() },
  ];
  await prisma.payment.createMany({ data: payments });

  // Invoices (for closed/paid folios)
  const invoices = [
    { id: uuid('inv-1'), tenantId: uuid('tenant-1'), invoiceNumber: 'INV-2501-0001', folioId: uuid('folio-2'), customerName: 'Rahul Banerjee', customerEmail: 'rahul.b@email.com', customerAddress: 'Kolkata, India', subtotal: 48000, taxes: 8640, totalAmount: 58640, currency: 'INR', issuedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), dueAt: new Date(todaySeed.getTime() + 29 * 24 * 60 * 60 * 1000), paidAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), status: 'paid', pdfUrl: '/api/invoices/folio-2/pdf' },
    { id: uuid('inv-2'), tenantId: uuid('tenant-1'), invoiceNumber: 'INV-2501-0002', folioId: uuid('folio-4'), customerName: 'Vikram Singh', customerEmail: 'vikram.s@email.com', customerAddress: 'Kolkata, India', subtotal: 70000, taxes: 12600, totalAmount: 84100, currency: 'INR', issuedAt: new Date(), dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), paidAt: new Date(), status: 'paid', pdfUrl: '/api/invoices/folio-4/pdf' },
    { id: uuid('inv-3'), tenantId: uuid('tenant-1'), invoiceNumber: 'INV-2501-0003', folioId: uuid('folio-6'), customerName: 'Rina Chatterjee', customerEmail: 'rina.c@email.com', customerAddress: 'Kolkata, India', subtotal: 10500, taxes: 1890, totalAmount: 13290, currency: 'INR', issuedAt: new Date(), dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), paidAt: new Date(), status: 'paid', pdfUrl: '/api/invoices/folio-6/pdf' },
  ];
  await prisma.invoice.createMany({ data: invoices });

  // Update folios with invoice references
  await prisma.folio.update({ where: { id: uuid('folio-2') }, data: { invoiceNumber: 'INV-2501-0001', invoiceIssuedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000) } });
  await prisma.folio.update({ where: { id: uuid('folio-4') }, data: { invoiceNumber: 'INV-2501-0002', invoiceIssuedAt: new Date() } });
  await prisma.folio.update({ where: { id: uuid('folio-6') }, data: { invoiceNumber: 'INV-2501-0003', invoiceIssuedAt: new Date() } });

  console.log('Billing seed data completed!');

  // === Cancellation Policies ===
  console.log('Seeding cancellation policies...');
  const cancellationPolicies = [
    {
      id: uuid('cp-1'),
      tenantId: uuid('tenant-1'),
      name: 'Standard Flexible',
      description: 'Free cancellation up to 48 hours before check-in. 50% penalty after that.',
      freeCancelHoursBefore: 48,
      penaltyPercent: 50,
      noShowPenaltyPercent: 100,
      penaltyType: 'percentage',
      exceptions: JSON.stringify([{ type: 'loyalty_tier', value: 'gold' }, { type: 'loyalty_tier', value: 'platinum' }]),
      isActive: true,
      sortOrder: 1,
    },
    {
      id: uuid('cp-2'),
      tenantId: uuid('tenant-1'),
      name: 'Non-Refundable',
      description: 'No free cancellation. 100% penalty for any cancellation or no-show.',
      freeCancelHoursBefore: 0,
      penaltyPercent: 100,
      noShowPenaltyPercent: 100,
      penaltyType: 'percentage',
      exceptions: JSON.stringify([{ type: 'loyalty_tier', value: 'platinum' }]),
      isActive: true,
      sortOrder: 2,
    },
    {
      id: uuid('cp-3'),
      tenantId: uuid('tenant-1'),
      name: 'Corporate Rate',
      description: 'Free cancellation up to 24 hours before check-in. First night penalty after.',
      freeCancelHoursBefore: 24,
      penaltyPercent: 0,
      noShowPenaltyPercent: 100,
      penaltyType: 'first_night',
      penaltyNights: 1,
      exceptions: JSON.stringify([{ type: 'segment', value: 'corporate' }]),
      isActive: true,
      sortOrder: 3,
    },
    {
      id: uuid('cp-4'),
      tenantId: uuid('tenant-1'),
      name: 'Long Stay (7+ Nights)',
      description: 'Free cancellation 7 days before. 25% penalty after. 50% no-show.',
      freeCancelHoursBefore: 168,
      penaltyPercent: 25,
      noShowPenaltyPercent: 50,
      penaltyType: 'percentage',
      isActive: true,
      sortOrder: 4,
    },
    {
      id: uuid('cp-5'),
      tenantId: uuid('tenant-2'),
      name: 'Standard - Ocean View',
      description: 'Free cancellation 72 hours before check-in.',
      freeCancelHoursBefore: 72,
      penaltyPercent: 100,
      noShowPenaltyPercent: 100,
      penaltyType: 'percentage',
      isActive: true,
      sortOrder: 1,
    },
  ];
  await prisma.cancellationPolicy.createMany({ data: cancellationPolicies });

  // === Inspection Templates ===
  console.log('Seeding inspection templates...');
  const inspectionTemplates = [
    {
      id: uuid('it-1'),
      tenantId: uuid('tenant-1'),
      name: 'Standard Room Inspection',
      description: 'Comprehensive checklist for standard room cleaning inspection',
      roomType: 'standard',
      category: 'room',
      items: JSON.stringify([
        { id: uuid('bath-1'), name: 'Toilet cleaned and sanitized', category: 'Bathroom', required: true, sortOrder: 1 },
        { id: uuid('bath-2'), name: 'Shower/bathtub cleaned', category: 'Bathroom', required: true, sortOrder: 2 },
        { id: uuid('bath-3'), name: 'Sink and vanity clean', category: 'Bathroom', required: true, sortOrder: 3 },
        { id: uuid('bath-4'), name: 'Mirror spotless', category: 'Bathroom', required: true, sortOrder: 4 },
        { id: uuid('bath-5'), name: 'Towels replaced (2 bath, 2 hand, 1 face)', category: 'Bathroom', required: true, sortOrder: 5 },
        { id: uuid('bath-6'), name: 'Toiletries restocked', category: 'Bathroom', required: true, sortOrder: 6 },
        { id: uuid('bath-7'), name: 'Hair dryer present and working', category: 'Bathroom', required: false, sortOrder: 7 },
        { id: uuid('bed-1'), name: 'Bedsheets changed (fresh, no wrinkles)', category: 'Bedroom', required: true, sortOrder: 8 },
        { id: uuid('bed-2'), name: 'Pillows fluffed and arranged', category: 'Bedroom', required: true, sortOrder: 9 },
        { id: uuid('bed-3'), name: 'Bedspread/duvet clean', category: 'Bedroom', required: true, sortOrder: 10 },
        { id: uuid('bed-4'), name: 'AC working (set to 22°C)', category: 'Bedroom', required: true, sortOrder: 11 },
        { id: uuid('bed-5'), name: 'TV working, remote present', category: 'Bedroom', required: true, sortOrder: 12 },
        { id: uuid('bed-6'), name: 'Minibar restocked', category: 'Bedroom', required: false, sortOrder: 13 },
        { id: uuid('bed-7'), name: 'Safe locked and working', category: 'Bedroom', required: false, sortOrder: 14 },
        { id: uuid('bed-8'), name: 'Dust-free surfaces', category: 'Bedroom', required: true, sortOrder: 15 },
        { id: uuid('room-1'), name: 'Floor vacuumed and mopped', category: 'Room', required: true, sortOrder: 16 },
        { id: uuid('room-2'), name: 'Curtains clean and properly hung', category: 'Room', required: true, sortOrder: 17 },
        { id: uuid('room-3'), name: 'Trash bins emptied', category: 'Room', required: true, sortOrder: 18 },
        { id: uuid('room-4'), name: 'Room fragranced', category: 'Room', required: true, sortOrder: 19 },
        { id: uuid('room-5'), name: 'Welcome amenities placed', category: 'Room', required: true, sortOrder: 20 },
        { id: uuid('room-6'), name: 'Do Not Disturb sign available', category: 'Room', required: true, sortOrder: 21 },
        { id: uuid('room-7'), name: 'No personal items left behind', category: 'Room', required: true, sortOrder: 22 },
        { id: uuid('room-8'), name: 'Furniture properly arranged', category: 'Room', required: true, sortOrder: 23 },
      ]),
      isActive: true,
      sortOrder: 1,
    },
    {
      id: uuid('it-2'),
      tenantId: uuid('tenant-1'),
      name: 'VIP Suite Inspection',
      description: 'Enhanced checklist for VIP suites and premium rooms',
      roomType: 'vip',
      category: 'room',
      items: JSON.stringify([
        { id: uuid('vip-bath-1'), name: 'Premium toiletries stocked (set complete)', category: 'Bathroom', required: true, sortOrder: 1 },
        { id: uuid('vip-bath-2'), name: 'Bathrobe and slippers placed', category: 'Bathroom', required: true, sortOrder: 2 },
        { id: uuid('vip-bath-3'), name: 'Toilet and bathroom spotless', category: 'Bathroom', required: true, sortOrder: 3 },
        { id: uuid('vip-bath-4'), name: 'Fresh flowers arranged', category: 'Bathroom', required: true, sortOrder: 4 },
        { id: uuid('vip-bed-1'), name: 'Premium linen (cotton/silk blend)', category: 'Bedroom', required: true, sortOrder: 5 },
        { id: uuid('vip-bed-2'), name: 'Pillow menu card placed', category: 'Bedroom', required: true, sortOrder: 6 },
        { id: uuid('vip-bed-3'), name: 'Turndown amenities prepared', category: 'Bedroom', required: true, sortOrder: 7 },
        { id: uuid('vip-bed-4'), name: 'Fruit basket and welcome card', category: 'Bedroom', required: true, sortOrder: 8 },
        { id: uuid('vip-bed-5'), name: 'AC at optimal temperature', category: 'Bedroom', required: true, sortOrder: 9 },
        { id: uuid('vip-room-1'), name: 'Floor polished (no marks)', category: 'Room', required: true, sortOrder: 10 },
        { id: uuid('vip-room-2'), name: 'Premium minibar fully stocked', category: 'Room', required: true, sortOrder: 11 },
        { id: uuid('vip-room-3'), name: 'Nespresso machine cleaned and loaded', category: 'Room', required: true, sortOrder: 12 },
        { id: uuid('vip-room-4'), name: 'All lights and electronics working', category: 'Room', required: true, sortOrder: 13 },
        { id: uuid('vip-room-5'), name: 'Balcony clean (if applicable)', category: 'Room', required: true, sortOrder: 14 },
        { id: uuid('vip-room-6'), name: 'Complimentary newspaper/magazine', category: 'Room', required: false, sortOrder: 15 },
      ]),
      isActive: true,
      sortOrder: 2,
    },
    {
      id: uuid('it-3'),
      tenantId: uuid('tenant-1'),
      name: 'Deep Clean Inspection',
      description: 'Thorough inspection after deep cleaning or maintenance',
      roomType: 'deep_clean',
      category: 'room',
      items: JSON.stringify([
        { id: uuid('deep-1'), name: 'Under-bed area cleaned', category: 'Deep Clean', required: true, sortOrder: 1 },
        { id: uuid('deep-2'), name: 'Behind furniture vacuumed', category: 'Deep Clean', required: true, sortOrder: 2 },
        { id: uuid('deep-3'), name: 'Wardrobe interior wiped', category: 'Deep Clean', required: true, sortOrder: 3 },
        { id: uuid('deep-4'), name: 'Drawer interiors cleaned', category: 'Deep Clean', required: true, sortOrder: 4 },
        { id: uuid('deep-5'), name: 'AC vents/filters cleaned', category: 'Deep Clean', required: true, sortOrder: 5 },
        { id: uuid('deep-6'), name: 'Light fixtures cleaned', category: 'Deep Clean', required: true, sortOrder: 6 },
        { id: uuid('deep-7'), name: 'Window tracks cleaned', category: 'Deep Clean', required: true, sortOrder: 7 },
        { id: uuid('deep-8'), name: 'Grout and tile sealant checked', category: 'Deep Clean', required: false, sortOrder: 8 },
        { id: uuid('deep-9'), name: 'Mattress rotated/flipped', category: 'Deep Clean', required: true, sortOrder: 9 },
        { id: uuid('deep-10'), name: 'Upholstery spots treated', category: 'Deep Clean', required: true, sortOrder: 10 },
      ]),
      isActive: true,
      sortOrder: 3,
    },
    {
      id: uuid('it-4'),
      tenantId: uuid('tenant-1'),
      name: 'Public Area Inspection',
      description: 'Checklist for lobby, corridors, and common areas',
      roomType: 'public_area',
      category: 'public_area',
      items: JSON.stringify([
        { id: uuid('pub-1'), name: 'Floors clean and polished', category: 'Lobby', required: true, sortOrder: 1 },
        { id: uuid('pub-2'), name: 'Furniture arranged properly', category: 'Lobby', required: true, sortOrder: 2 },
        { id: uuid('pub-3'), name: 'Restrooms clean and stocked', category: 'Lobby', required: true, sortOrder: 3 },
        { id: uuid('pub-4'), name: 'Plants watered and healthy', category: 'Lobby', required: true, sortOrder: 4 },
        { id: uuid('pub-5'), name: 'Lighting adequate', category: 'Lobby', required: true, sortOrder: 5 },
        { id: uuid('pub-6'), name: 'Signage clean and visible', category: 'Lobby', required: true, sortOrder: 6 },
        { id: uuid('pub-7'), name: 'Elevator clean and functioning', category: 'Common', required: true, sortOrder: 7 },
        { id: uuid('pub-8'), name: 'Corridors vacuumed', category: 'Common', required: true, sortOrder: 8 },
      ]),
      isActive: true,
      sortOrder: 4,
    },
    {
      id: uuid('it-5'),
      tenantId: uuid('tenant-2'),
      name: 'Ocean View Room Inspection',
      description: 'Standard inspection for Ocean View resort',
      roomType: null,
      category: 'room',
      items: JSON.stringify([
        { id: uuid('ov-1'), name: 'Room thoroughly cleaned', category: 'Room', required: true, sortOrder: 1 },
        { id: uuid('ov-2'), name: 'Bathroom sanitized', category: 'Bathroom', required: true, sortOrder: 2 },
        { id: uuid('ov-3'), name: 'Towels and linens replaced', category: 'Bathroom', required: true, sortOrder: 3 },
        { id: uuid('ov-4'), name: 'Balcony clean with ocean view unobstructed', category: 'Room', required: true, sortOrder: 4 },
        { id: uuid('ov-5'), name: 'Minibar restocked', category: 'Room', required: false, sortOrder: 5 },
      ]),
      isActive: true,
      sortOrder: 1,
    },
  ];
  await prisma.inspectionTemplate.createMany({ data: inspectionTemplates });

  // === Inspection Results (sample completed inspections) ===
  console.log('Seeding inspection results...');
  const inspectionResults = [
    {
      id: uuid('ir-1'),
      tenantId: uuid('tenant-1'),
      propertyId: uuid('property-1'),
      roomId: uuid('room-101'),
      taskId: null,
      templateId: uuid('it-1'),
      inspectorId: uuid('user-3'),
      score: 96,
      passed: true,
      items: JSON.stringify([
        { templateItemId: 'bath-1', name: 'Toilet cleaned and sanitized', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bath-2', name: 'Shower/bathtub cleaned', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bath-3', name: 'Sink and vanity clean', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bath-4', name: 'Mirror spotless', passed: false, notes: 'Small water stain on left edge', photoUrl: null },
        { templateItemId: 'bath-5', name: 'Towels replaced', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bath-6', name: 'Toiletries restocked', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bed-1', name: 'Bedsheets changed', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bed-2', name: 'Pillows fluffed', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bed-3', name: 'Bedspread/duvet clean', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bed-4', name: 'AC working', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bed-5', name: 'TV working', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'room-1', name: 'Floor vacuumed', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'room-2', name: 'Curtains clean', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'room-3', name: 'Trash bins emptied', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'room-4', name: 'Room fragranced', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'room-5', name: 'Welcome amenities placed', passed: true, notes: null, photoUrl: null },
      ]),
      notes: 'Minor mirror stain noted, acceptable for standard room',
      completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      reAssigned: false,
    },
    {
      id: uuid('ir-2'),
      tenantId: uuid('tenant-1'),
      propertyId: uuid('property-1'),
      roomId: uuid('room-102'),
      taskId: null,
      templateId: uuid('it-1'),
      inspectorId: uuid('user-3'),
      score: 78,
      passed: false,
      items: JSON.stringify([
        { templateItemId: 'bath-1', name: 'Toilet cleaned', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bath-4', name: 'Mirror spotless', passed: false, notes: 'Heavy water stains, needs re-cleaning', photoUrl: null },
        { templateItemId: 'bath-5', name: 'Towels replaced', passed: false, notes: 'Only 1 bath towel provided, needs 2', photoUrl: null },
        { templateItemId: 'bed-1', name: 'Bedsheets changed', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'bed-4', name: 'AC working', passed: false, notes: 'AC making noise, needs maintenance', photoUrl: null },
        { templateItemId: 'room-1', name: 'Floor vacuumed', passed: true, notes: null, photoUrl: null },
        { templateItemId: 'room-3', name: 'Trash bins emptied', passed: false, notes: 'Bathroom bin not emptied', photoUrl: null },
      ]),
      notes: '3 items failed. Re-cleaning and maintenance required.',
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      reAssigned: true,
    },
  ];
  await prisma.inspectionResult.createMany({ data: inspectionResults });

  console.log('Cancellation policies, inspection templates & results seeded!');

  // ============================================================
  // MISSING MODULE SEED DATA
  // ============================================================

  // ─── IoT Devices ──────────────────────────────────────────
  console.log('Seeding IoT devices...');
  try {
    await prisma.ioTDevice.createMany({
      data: [
        {
          id: uuid('iot-1'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          roomId: uuid('room-101'),
          name: 'Smart Thermostat',
          type: 'thermostat',
          manufacturer: 'Honeywell',
          model: 'T6 Pro',
          serialNumber: 'HT-2024-001',
          protocol: 'wifi',
          status: 'online',
          lastHeartbeat: new Date(Date.now() - 5 * 60 * 1000),
          firmwareVersion: '2.4.1',
          config: JSON.stringify({ targetTemp: 22, minTemp: 16, maxTemp: 30, mode: 'auto' }),
          currentState: JSON.stringify({ currentTemp: 23.5, humidity: 45, mode: 'cooling' }),
        },
        {
          id: uuid('iot-2'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          roomId: uuid('room-102'),
          name: 'Smart Lock',
          type: 'door_lock',
          manufacturer: 'Schlage',
          model: 'Encode Plus',
          serialNumber: 'SL-2024-002',
          protocol: 'wifi',
          status: 'online',
          lastHeartbeat: new Date(Date.now() - 2 * 60 * 1000),
          firmwareVersion: '1.8.3',
          config: JSON.stringify({ autoLock: true, autoLockDelay: 30, lockoutEnabled: false }),
          currentState: JSON.stringify({ locked: true, batteryLevel: 85 }),
        },
        {
          id: uuid('iot-3'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          roomId: null,
          name: 'Motion Sensor',
          type: 'motion_sensor',
          manufacturer: 'Philips Hue',
          model: 'Motion Sensor',
          serialNumber: 'MS-2024-003',
          protocol: 'zigbee',
          status: 'online',
          lastHeartbeat: new Date(Date.now() - 1 * 60 * 1000),
          firmwareVersion: '3.2.0',
          config: JSON.stringify({ sensitivity: 'high', detectionRange: 8 }),
          currentState: JSON.stringify({ motionDetected: false, lastMotionAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), lux: 320 }),
        },
      ],
    });
    console.log('3 IoT devices seeded!');
  } catch (e: any) {
    console.log('IoT devices seed note:', e.message);
  }

  // ─── WiFi Module (plans, users, sessions, vouchers, network, etc.) ───
  // Comprehensive WiFi data seeded by wifi-seed.ts
  // (WiFi module seeded below after new modules)

  // ============================================================
  // NEW MODULE SEED DATA (20 modules)
  // ============================================================

  // ─── 1. Chat Messages (Guest ↔ Staff) ───────────────────────
  console.log('Seeding chat messages...');
  try {
    await prisma.chatConversation.create({
      data: {
        id: uuid('conv-1'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        channel: 'in_app',
        status: 'open',
        priority: 'normal',
        lastMessageAt: new Date(Date.now() - 30 * 60 * 1000),
        lastMessage: 'Thank you so much!',
        unreadCount: 0,
        messages: {
          create: [
            { id: uuid('chat-1'), senderId: null, content: 'Hello, I just checked in to room 501. The room is beautiful!', senderType: 'guest', status: 'read', sentAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
            { id: uuid('chat-2'), senderId: uuid('user-2'), content: 'Welcome to Royal Stay Kolkata, Mr. Mukherjee! We\'re glad you like the room. Is there anything you need?', senderType: 'staff', status: 'read', sentAt: new Date(Date.now() - 2.8 * 60 * 60 * 1000), readAt: new Date(Date.now() - 2.7 * 60 * 60 * 1000) },
            { id: uuid('chat-3'), senderId: null, content: 'Could you send an extra pillow and a blanket to the room?', senderType: 'guest', status: 'read', sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
            { id: uuid('chat-4'), senderId: uuid('user-2'), content: 'Of course! I\'ll have housekeeping send those up right away. Expected in about 10 minutes.', senderType: 'staff', status: 'read', sentAt: new Date(Date.now() - 1.8 * 60 * 60 * 1000), readAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000) },
            { id: uuid('chat-5'), senderId: null, content: 'Also, what time does the restaurant open for dinner?', senderType: 'guest', status: 'read', sentAt: new Date(Date.now() - 1 * 60 * 60 * 1000) },
            { id: uuid('chat-6'), senderId: uuid('user-2'), content: 'Our restaurant opens at 7:00 PM. I\'d recommend trying the Butter Chicken — it\'s a guest favourite! Would you like me to reserve a table?', senderType: 'staff', status: 'delivered', sentAt: new Date(Date.now() - 30 * 60 * 1000) },
          ],
        },
      },
    });
    console.log('6 chat messages seeded in 1 conversation!');
  } catch (e: any) {
    console.log('Chat messages seed error:', e.message);
  }

  // ─── 2. Guest Documents (KYC) ───────────────────────────────
  console.log('Seeding guest documents...');
  try {
    await prisma.guestDocument.createMany({
      data: [
        { id: uuid('doc-1'), guestId: uuid('guest-1'), type: 'aadhaar', name: 'Aadhaar Card', fileUrl: '/uploads/docs/guest-1/aadhaar.jpg', status: 'verified', verifiedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), verifiedBy: 'user-2' },
        { id: uuid('doc-2'), guestId: uuid('guest-2'), type: 'passport', name: 'Indian Passport', fileUrl: '/uploads/docs/guest-2/passport.jpg', status: 'verified', verifiedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), verifiedBy: 'user-2' },
        { id: uuid('doc-3'), guestId: uuid('guest-4'), type: 'driving_license', name: 'Driving License', fileUrl: '/uploads/docs/guest-4/dl.jpg', status: 'pending' },
        { id: uuid('doc-4'), guestId: uuid('guest-3'), type: 'passport', name: 'Indian Passport', fileUrl: '/uploads/docs/guest-3/passport.jpg', status: 'verified', verifiedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), verifiedBy: 'user-2' },
      ],
    });
    console.log('4 guest documents seeded!');
  } catch (e: any) {
    console.log('Guest documents seed error:', e.message);
  }

  // ─── 3. Work Orders (Maintenance) ───────────────────────────
  console.log('Seeding work orders...');
  try {
    await prisma.workOrder.createMany({
      data: [
        { id: uuid('wo-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomId: uuid('room-501'), workOrderNumber: 'WO-2024-001', title: 'Leaking bathroom faucet', description: 'Guest reported slow drip from bathroom faucet in room 501. Needs immediate attention.', type: 'plumbing', priority: 'high', status: 'in_progress', requestedBy: uuid('user-2'), assignedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), startedAt: new Date(today.getTime() - 12 * 60 * 60 * 1000), scheduledDate: new Date(), estimatedCost: 1500, estimatedHours: 2, notes: 'Vendor CleanPro assigned' },
        { id: uuid('wo-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomId: uuid('room-801'), workOrderNumber: 'WO-2024-002', title: 'AC not cooling properly', description: 'Executive Suite 801 AC is blowing warm air. Guest is a VIP platinum member.', type: 'hvac', priority: 'urgent', status: 'in_progress', requestedBy: uuid('user-1'), assignedAt: new Date(today.getTime() - 6 * 60 * 60 * 1000), startedAt: new Date(today.getTime() - 4 * 60 * 60 * 1000), scheduledDate: new Date(), estimatedCost: 5000, estimatedHours: 4, vendorId: uuid('vendor-2'), notes: 'Temp fix applied, replacement part ordered' },
        { id: uuid('wo-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomId: uuid('room-305'), workOrderNumber: 'WO-2024-003', title: 'Replace broken window latch', description: 'Window latch in room 305 is broken and won\'t lock. Security concern.', type: 'carpentry', priority: 'medium', status: 'pending', requestedBy: uuid('user-3'), scheduledDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), estimatedCost: 800, estimatedHours: 1 },
        { id: uuid('wo-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomId: uuid('room-101'), workOrderNumber: 'WO-2024-004', title: 'Electrical outlet sparking', description: 'Guest reported occasional sparking from the bedside outlet in room 101.', type: 'electrical', priority: 'high', status: 'completed', requestedBy: uuid('user-2'), assignedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), startedAt: new Date(today.getTime() - 2.5 * 24 * 60 * 60 * 1000), completedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), estimatedCost: 2000, actualCost: 1800, estimatedHours: 2, actualHours: 1.5, completionNotes: 'Outlet replaced with new one. Tested and working.', vendorId: uuid('vendor-3') },
        { id: uuid('wo-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), workOrderNumber: 'WO-2024-005', title: 'Repaint lobby walls', description: 'Lobby walls have scuff marks and need repainting before the wedding event next week.', type: 'painting', priority: 'low', status: 'pending', requestedBy: uuid('user-1'), scheduledDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), estimatedCost: 15000, estimatedHours: 8, notes: 'Use premium washable paint' },
      ],
    });
    console.log('5 work orders seeded!');
  } catch (e: any) {
    console.log('Work orders seed error:', e.message);
  }

  // ─── 4. Purchase Orders ─────────────────────────────────────
  console.log('Seeding purchase orders...');
  try {
    await prisma.purchaseOrder.createMany({
      data: [
        { id: uuid('po-1'), tenantId: uuid('tenant-1'), vendorId: uuid('vendor-1'), orderNumber: 'PO-2024-001', subtotal: 37500, taxes: 6750, totalAmount: 44250, status: 'delivered', orderDate: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000), expectedDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), receivedDate: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000), approvedBy: uuid('user-1'), approvedAt: new Date(today.getTime() - 11 * 24 * 60 * 60 * 1000), notes: 'Monthly linen supply order' },
        { id: uuid('po-2'), tenantId: uuid('tenant-1'), vendorId: uuid('vendor-2'), orderNumber: 'PO-2024-002', subtotal: 25000, taxes: 4500, totalAmount: 29500, status: 'sent', orderDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), expectedDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), approvedBy: uuid('user-1'), approvedAt: new Date(today.getTime() - 2.5 * 24 * 60 * 60 * 1000), notes: 'Deep cleaning supplies and equipment' },
        { id: uuid('po-3'), tenantId: uuid('tenant-1'), vendorId: uuid('vendor-3'), orderNumber: 'PO-2024-003', subtotal: 85000, taxes: 15300, totalAmount: 100300, status: 'draft', orderDate: new Date(), expectedDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000), notes: 'Network infrastructure upgrade - new routers and access points' },
      ],
    });
    // Create purchase order items
    await prisma.purchaseOrderItem.createMany({
      data: [
        { id: uuid('poi-1'), purchaseOrderId: uuid('po-1'), stockItemId: uuid('stock-1'), quantity: 100, unitPrice: 250, totalAmount: 25000, receivedQuantity: 100 },
        { id: uuid('poi-2'), purchaseOrderId: uuid('po-1'), stockItemId: uuid('stock-2'), quantity: 50, unitPrice: 150, totalAmount: 7500, receivedQuantity: 50 },
        { id: uuid('poi-3'), purchaseOrderId: uuid('po-1'), stockItemId: uuid('stock-3'), quantity: 150, unitPrice: 35, totalAmount: 5250, receivedQuantity: 150 },
        { id: uuid('poi-4'), purchaseOrderId: uuid('po-2'), stockItemId: uuid('stock-5'), quantity: 500, unitPrice: 15, totalAmount: 7500, receivedQuantity: null },
        { id: uuid('poi-5'), purchaseOrderId: uuid('po-2'), stockItemId: uuid('stock-6'), quantity: 200, unitPrice: 25, totalAmount: 5000, receivedQuantity: null },
      ],
    });
    console.log('3 purchase orders with 5 items seeded!');
  } catch (e: any) {
    console.log('Purchase orders seed error:', e.message);
  }

  // ─── 5. Pricing Rules (Revenue Management) ──────────────────
  console.log('Seeding pricing rules...');
  try {
    await prisma.pricingRule.createMany({
      data: [
        { id: uuid('pr-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Weekend Surge', type: 'dynamic', description: '15% markup on weekends for all room types', value: 15, valueType: 'percentage', conditions: JSON.stringify({ dayOfWeek: [0, 5, 6] }), priority: 5, isActive: true, effectiveFrom: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), roomTypes: JSON.stringify(['roomtype-1', 'roomtype-2', 'roomtype-3']), appliedCount: 24, lastAppliedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) },
        { id: uuid('pr-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Durga Puja Season Premium', type: 'seasonal', description: '25% premium during Durga Puja festival season', value: 25, valueType: 'percentage', conditions: JSON.stringify({ startDate: '2024-10-01', endDate: '2024-10-24' }), priority: 10, isActive: true, effectiveFrom: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000), effectiveTo: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000), roomTypes: JSON.stringify(['roomtype-1', 'roomtype-2', 'roomtype-3', 'roomtype-4']), appliedCount: 8 },
        { id: uuid('pr-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'High Occupancy Boost', type: 'occupancy_based', description: '10% increase when occupancy exceeds 85%', value: 10, valueType: 'percentage', conditions: JSON.stringify({ minOccupancy: 85 }), priority: 3, isActive: true, effectiveFrom: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), roomTypes: JSON.stringify(['roomtype-2', 'roomtype-3', 'roomtype-4']), appliedCount: 45, lastAppliedAt: new Date() },
        { id: uuid('pr-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Long Stay Discount', type: 'dynamic', description: '10% discount for stays of 7+ nights', value: -10, valueType: 'percentage', conditions: JSON.stringify({ minNights: 7 }), priority: 2, isActive: true, effectiveFrom: new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000), roomTypes: JSON.stringify(['roomtype-1', 'roomtype-2']), appliedCount: 12 },
      ],
    });
    console.log('4 pricing rules seeded!');
  } catch (e: any) {
    console.log('Pricing rules seed error:', e.message);
  }

  // ─── 6. Waitlist Entries ────────────────────────────────────
  console.log('Seeding waitlist entries...');
  try {
    await prisma.waitlistEntry.createMany({
      data: [
        { id: uuid('wl-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), guestId: uuid('guest-4'), roomTypeId: uuid('roomtype-3'), checkIn: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000), adults: 2, children: 1, priority: 3, status: 'waiting', notes: 'Wants Executive Suite for anniversary weekend' },
        { id: uuid('wl-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), guestId: uuid('guest-6'), roomTypeId: uuid('roomtype-2'), checkIn: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 17 * 24 * 60 * 60 * 1000), adults: 2, children: 0, priority: 1, status: 'waiting', notes: 'Recurring guest, flexible on dates' },
        { id: uuid('wl-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), guestId: uuid('guest-5'), roomTypeId: uuid('roomtype-4'), checkIn: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000), adults: 2, children: 0, priority: 5, status: 'cancelled', notes: 'Booked elsewhere', convertedAt: null },
      ],
    });
    console.log('3 waitlist entries seeded!');
  } catch (e: any) {
    console.log('Waitlist entries seed error:', e.message);
  }

  // ─── 7. Group Bookings ──────────────────────────────────────
  console.log('Seeding group bookings...');
  try {
    await prisma.groupBooking.createMany({
      data: [
        { id: uuid('group-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'TCS Annual Offsite 2024', description: 'Tata Consultancy Services Kolkata team offsite. 3 days of meetings, team building, and gala dinner.', contactName: 'Arjun Mehta', contactEmail: 'arjun.mehta@tcs.com', contactPhone: '+91-9876543210', checkIn: new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 23 * 24 * 60 * 60 * 1000), totalRooms: 15, bookedRooms: 12, totalAmount: 540000, depositAmount: 108000, depositPaid: true, status: 'confirmed', notes: 'Requires meeting room setup with projector for all 3 days. Gala dinner on day 2.' },
        { id: uuid('group-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Mukherjee Wedding Block', description: 'Wedding block booking for Sneha and Rishi\'s wedding reception.', contactName: 'Ananya Mukherjee', contactEmail: 'ananya.m@email.com', contactPhone: '+91-9830011111', checkIn: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 33 * 24 * 60 * 60 * 1000), totalRooms: 8, bookedRooms: 5, totalAmount: 176000, depositAmount: 35200, depositPaid: true, status: 'confirmed', notes: 'Bride and groom in Presidential Suite. Haldi and sangeet events need space.' },
      ],
    });
    // Update booking-3 to belong to group-1
    await prisma.booking.update({
      where: { id: uuid('booking-3') },
      data: { groupId: uuid('group-1'), isGroupLeader: true },
    });
    console.log('2 group bookings seeded, booking-3 linked to group-1!');
  } catch (e: any) {
    console.log('Group bookings seed error:', e.message);
  }

  // ─── 8. Floor Plans ────────────────────────────────────────
  console.log('Seeding floor plans...');
  try {
    await prisma.floorPlan.createMany({
      data: [
        { id: uuid('fp-1'), propertyId: uuid('property-1'), floor: 1, name: 'Ground Floor', width: 800, height: 600, gridSize: 20, svgData: '<svg>...</svg>', roomPositions: JSON.stringify([{ roomId: uuid('room-101'), x: 100, y: 80, width: 120, height: 90 }]) },
        { id: uuid('fp-2'), propertyId: uuid('property-1'), floor: 5, name: 'Fifth Floor - Deluxe Wing', width: 800, height: 600, gridSize: 20, svgData: '<svg>...</svg>', roomPositions: JSON.stringify([{ roomId: uuid('room-501'), x: 100, y: 80, width: 120, height: 90 }, { roomId: uuid('room-510'), x: 260, y: 80, width: 120, height: 90 }]) },
        { id: uuid('fp-3'), propertyId: uuid('property-1'), floor: 8, name: 'Eighth Floor - Executive Wing', width: 800, height: 600, gridSize: 20, svgData: '<svg>...</svg>', roomPositions: JSON.stringify([{ roomId: uuid('room-801'), x: 100, y: 80, width: 150, height: 110 }]) },
      ],
    });
    console.log('3 floor plans seeded!');
  } catch (e: any) {
    console.log('Floor plans seed error:', e.message);
  }

  // ─── 9. Guest Stay Records ──────────────────────────────────
  console.log('Seeding guest stay records...');
  try {
    await prisma.guestStay.createMany({
      data: [
        { id: uuid('stay-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), totalAmount: 17990, roomNights: 3, feedbackGiven: false, reviewGiven: false },
        { id: uuid('stay-2'), guestId: uuid('guest-6'), bookingId: uuid('booking-6'), totalAmount: 11430, roomNights: 3, feedbackGiven: true, reviewGiven: true },
        { id: uuid('stay-3'), guestId: uuid('guest-3'), bookingId: uuid('booking-2'), totalAmount: 53160, roomNights: 4, feedbackGiven: false, reviewGiven: false },
        { id: uuid('stay-4'), guestId: uuid('guest-2'), bookingId: uuid('booking-3'), totalAmount: 23490, roomNights: 4, feedbackGiven: false, reviewGiven: false },
      ],
    });
    console.log('4 guest stay records seeded!');
  } catch (e: any) {
    console.log('Guest stay records seed error:', e.message);
  }

  // ─── 10. Vehicles (Parking) ─────────────────────────────────
  console.log('Seeding parking slots (early, for vehicle FKs)...');
  try {
    await prisma.parkingSlot.createMany({
      data: [
        { id: uuid('park-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), number: 'A1', floor: -1, type: 'standard', vehicleType: 'car', status: 'available', posX: 50, posY: 100 },
        { id: uuid('park-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), number: 'A2', floor: -1, type: 'standard', vehicleType: 'car', status: 'occupied', posX: 150, posY: 100 },
        { id: uuid('park-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), number: 'A3', floor: -1, type: 'ev_charging', vehicleType: 'car', hasCharging: true, chargerType: 'CCS2', status: 'occupied', posX: 250, posY: 100 },
        { id: uuid('park-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), number: 'A4', floor: -1, type: 'standard', vehicleType: 'suv', status: 'occupied', posX: 350, posY: 100 },
        { id: uuid('park-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), number: 'A5', floor: -1, type: 'disabled', vehicleType: 'car', status: 'reserved', posX: 50, posY: 200 },
      ],
    });
    console.log('5 parking slots seeded (early)!');
  } catch (e: any) {
    console.log('Parking slots early seed error:', e.message);
  }

  console.log('Seeding vehicles...');
  try {
    await prisma.vehicle.createMany({
      data: [
        { id: uuid('veh-1'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), licensePlate: 'WB-01-AB-1234', make: 'Hyundai', model: 'Creta', color: 'White', year: 2023, slotId: uuid('park-2'), entryTime: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), parkingFee: 0, status: 'parked' },
        { id: uuid('veh-2'), tenantId: uuid('tenant-1'), guestId: uuid('guest-3'), bookingId: uuid('booking-2'), licensePlate: 'WB-02-CD-5678', make: 'Mercedes-Benz', model: 'E-Class', color: 'Black', year: 2024, slotId: uuid('park-4'), entryTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), parkingFee: 0, status: 'parked' },
        { id: uuid('veh-3'), tenantId: uuid('tenant-1'), guestId: uuid('guest-5'), bookingId: uuid('booking-4'), licensePlate: 'WB-05-EF-9012', make: 'BMW', model: 'X5', color: 'Blue', year: 2023, slotId: null, entryTime: new Date(), parkingFee: 0, status: 'parked' },
        { id: uuid('veh-4'), tenantId: uuid('tenant-1'), guestId: uuid('guest-6'), bookingId: uuid('booking-6'), licensePlate: 'WB-06-GH-3456', make: 'Toyota', model: 'Innova Crysta', color: 'Silver', year: 2022, slotId: uuid('park-1'), entryTime: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), exitTime: new Date(), parkingFee: 300, isPaid: true, status: 'exited' },
        { id: uuid('veh-5'), tenantId: uuid('tenant-1'), guestId: uuid('guest-2'), licensePlate: 'WB-03-IJ-7890', make: 'Honda', model: 'City', color: 'Red', year: 2023, slotId: uuid('park-3'), entryTime: new Date(), parkingFee: 0, status: 'parked' },
      ],
    });
    console.log('5 vehicles seeded!');
  } catch (e: any) {
    console.log('Vehicles seed error:', e.message);
  }

  // ─── 11. Integrations ──────────────────────────────────────
  console.log('Seeding integrations...');
  try {
    await prisma.integration.createMany({
      data: [
        { id: uuid('int-1'), tenantId: uuid('tenant-1'), type: 'payment', provider: 'stripe', name: 'Stripe Payments', config: JSON.stringify({ apiKey: 'sk_live_***', publishableKey: 'pk_live_***', webhookSecret: 'whsec_***', currency: 'INR' }), status: 'active', lastSyncAt: new Date(today.getTime() - 1 * 60 * 60 * 1000) },
        { id: uuid('int-2'), tenantId: uuid('tenant-1'), type: 'payment', provider: 'razorpay', name: 'Razorpay', config: JSON.stringify({ apiKeyId: 'rzp_live_***', apiKeySecret: '***', webhookSecret: '***', currency: 'INR' }), status: 'active', lastSyncAt: new Date(today.getTime() - 2 * 60 * 60 * 1000) },
        { id: uuid('int-3'), tenantId: uuid('tenant-1'), type: 'communication', provider: 'whatsapp', name: 'WhatsApp Business', config: JSON.stringify({ phoneNumber: '+913340012345', apiVersion: 'v18.0', templateNamespace: 'royal_stay' }), status: 'active', lastSyncAt: new Date(today.getTime() - 30 * 60 * 1000) },
        { id: uuid('int-4'), tenantId: uuid('tenant-1'), type: 'channel_manager', provider: 'booking_com', name: 'Booking.com', config: JSON.stringify({ hotelId: '123456', apiKey: '***', syncRates: true, syncAvailability: true, syncRestrictions: true }), status: 'active', lastSyncAt: new Date(today.getTime() - 15 * 60 * 60 * 1000) },
      ],
    });
    console.log('4 integrations seeded!');
  } catch (e: any) {
    console.log('Integrations seed error:', e.message);
  }

  // ─── 11b. POS Integrations ───────────────────────────────
  console.log('Seeding POS integrations...');
  try {
    await prisma.integration.createMany({
      data: [
        { id: uuid('int-pos-1'), tenantId: uuid('tenant-1'), type: 'pos', provider: 'posist', name: 'Ahaar Kitchen POS', config: JSON.stringify({ endpoint: 'https://api.posist.io', apiKey: 'pk_live_***', merchantId: 'MERCHANT_RSK_001', locationId: 'LOC_KOL_001', outlets: 3, menuItems: 48, syncSettings: { syncMenuItems: true, syncOrders: true, syncInventory: false, autoSync: true, syncIntervalMinutes: 30 } }), status: 'active', lastSyncAt: new Date(today.getTime() - 2 * 60 * 60 * 1000) },
        { id: uuid('int-pos-2'), tenantId: uuid('tenant-1'), type: 'pos', provider: 'petpooja', name: 'Terrace Bar POS', config: JSON.stringify({ endpoint: 'https://api.petpooja.com', apiKey: 'pp_live_***', merchantId: 'MERCHANT_RSK_002', locationId: 'LOC_KOL_002', outlets: 1, menuItems: 35, syncSettings: { syncMenuItems: true, syncOrders: true, syncInventory: true, autoSync: true, syncIntervalMinutes: 15 } }), status: 'active', lastSyncAt: new Date(today.getTime() - 4 * 60 * 60 * 1000) },
        { id: uuid('int-pos-3'), tenantId: uuid('tenant-1'), type: 'pos', provider: 'micros', name: 'Banquet POS (MICROS)', config: JSON.stringify({ endpoint: 'https://api.micros.com', apiKey: 'mic_live_***', merchantId: 'MERCHANT_RSK_003', locationId: 'LOC_KOL_003', outlets: 2, menuItems: 22, syncSettings: { syncMenuItems: false, syncOrders: true, syncInventory: false, autoSync: false, syncIntervalMinutes: 60 } }), status: 'pending', lastSyncAt: null },
      ],
    });
    console.log('3 POS integrations seeded!');
  } catch (e: any) {
    console.log('POS integrations seed error:', e.message);
  }

  // ─── 12. Staff Communication Channels ───────────────────────
  console.log('Seeding staff channels...');
  try {
    await prisma.staffChannel.createMany({
      data: [
        { id: uuid('sch-1'), tenantId: uuid('tenant-1'), name: 'Front Desk', description: 'Front desk operations and coordination', type: 'department', department: 'Front Desk', createdBy: uuid('user-1'), isArchived: false, lastMessageAt: new Date(Date.now() - 15 * 60 * 1000), lastMessage: 'VIP guest Rahul Banerjee just arrived.' },
        { id: uuid('sch-2'), tenantId: uuid('tenant-1'), name: 'Maintenance Updates', description: 'Maintenance and work order updates', type: 'team', department: 'Maintenance', createdBy: uuid('user-1'), isArchived: false, lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000), lastMessage: 'AC repair in room 801 is in progress.' },
        { id: uuid('sch-3'), tenantId: uuid('tenant-1'), name: 'General Announcements', description: 'Hotel-wide announcements and updates', type: 'team', createdBy: uuid('user-1'), isArchived: false, lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000), lastMessage: 'Staff meeting tomorrow at 9 AM in the conference room.' },
      ],
    });
    await prisma.staffChannelMember.createMany({
      data: [
        { id: uuid('scm-1'), channelId: uuid('sch-1'), userId: uuid('user-1'), role: 'admin', joinedAt: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000) },
        { id: uuid('scm-2'), channelId: uuid('sch-1'), userId: uuid('user-2'), role: 'member', joinedAt: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000) },
        { id: uuid('scm-3'), channelId: uuid('sch-2'), userId: uuid('user-1'), role: 'admin', joinedAt: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000) },
        { id: uuid('scm-4'), channelId: uuid('sch-2'), userId: uuid('user-3'), role: 'member', joinedAt: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000) },
        { id: uuid('scm-5'), channelId: uuid('sch-3'), userId: uuid('user-1'), role: 'admin', joinedAt: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000) },
        { id: uuid('scm-6'), channelId: uuid('sch-3'), userId: uuid('user-2'), role: 'member', joinedAt: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000) },
        { id: uuid('scm-7'), channelId: uuid('sch-3'), userId: uuid('user-3'), role: 'member', joinedAt: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000) },
      ],
    });
    console.log('3 staff channels with 7 members seeded!');
  } catch (e: any) {
    console.log('Staff channels seed error:', e.message);
  }

  // ─── 13. Competitor Prices ─────────────────────────────────
  console.log('Seeding competitor prices...');
  try {
    await prisma.competitorPrice.createMany({
      data: [
        { id: uuid('cp-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-2'), competitorName: 'Taj Bengal', competitorType: 'luxury', rating: 4.8, date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), price: 8500, currency: 'INR', roomTypeName: 'Deluxe Room', ratePlanName: 'BAR', source: 'channel_manager' },
        { id: uuid('cp-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-2'), competitorName: 'ITC Sonar', competitorType: 'luxury', rating: 4.7, date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), price: 7800, currency: 'INR', roomTypeName: 'Luxury Room', ratePlanName: 'Flexible', source: 'channel_manager' },
        { id: uuid('cp-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-3'), competitorName: 'Taj Bengal', competitorType: 'luxury', rating: 4.8, date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), price: 15000, currency: 'INR', roomTypeName: 'Luxury Suite', ratePlanName: 'BAR', source: 'channel_manager' },
        { id: uuid('cp-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-1'), competitorName: 'FabHotel Park Street', competitorType: 'mid_scale', rating: 4.2, date: new Date(), price: 2800, currency: 'INR', roomTypeName: 'Standard Room', ratePlanName: 'Standard', source: 'manual' },
        { id: uuid('cp-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-2'), competitorName: 'The Oberoi Grand', competitorType: 'luxury', rating: 4.9, date: new Date(), price: 9200, currency: 'INR', roomTypeName: 'Deluxe Suite', ratePlanName: 'Best Available', source: 'channel_manager' },
        { id: uuid('cp-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomTypeId: uuid('roomtype-3'), competitorName: 'ITC Sonar', competitorType: 'luxury', rating: 4.7, date: new Date(), price: 14000, currency: 'INR', roomTypeName: 'Executive Suite', ratePlanName: 'Flexible', source: 'channel_manager' },
      ],
    });
    console.log('6 competitor prices seeded!');
  } catch (e: any) {
    console.log('Competitor prices seed error:', e.message);
  }

  // ─── 14. Demand Forecasts ──────────────────────────────────
  console.log('Seeding demand forecasts...');
  try {
    await prisma.demandForecast.createMany({
      data: [
        { id: uuid('df-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(), demandScore: 75, occupancyForecast: 82, adrForecast: 6800, revparForecast: 5576, confidence: 0.85, generatedBy: 'algorithm', modelVersion: 'v2.1' },
        { id: uuid('df-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), demandScore: 80, occupancyForecast: 85, adrForecast: 7200, revparForecast: 6120, confidence: 0.82, generatedBy: 'algorithm', modelVersion: 'v2.1' },
        { id: uuid('df-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), demandScore: 85, occupancyForecast: 88, adrForecast: 7500, revparForecast: 6600, confidence: 0.78, generatedBy: 'algorithm', modelVersion: 'v2.1', localEvents: JSON.stringify([{ name: 'Kolkata Book Fair', impact: 5 }]), eventsImpact: 5 },
        { id: uuid('df-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), demandScore: 90, occupancyForecast: 92, adrForecast: 8200, revparForecast: 7544, confidence: 0.80, generatedBy: 'algorithm', modelVersion: 'v2.1', localEvents: JSON.stringify([{ name: 'Kolkata Book Fair', impact: 8 }]), eventsImpact: 8 },
        { id: uuid('df-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000), demandScore: 70, occupancyForecast: 75, adrForecast: 6500, revparForecast: 4875, confidence: 0.75, generatedBy: 'algorithm', modelVersion: 'v2.1' },
        { id: uuid('df-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), demandScore: 65, occupancyForecast: 70, adrForecast: 6000, revparForecast: 4200, confidence: 0.70, generatedBy: 'algorithm', modelVersion: 'v2.1' },
        { id: uuid('df-7'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000), demandScore: 60, occupancyForecast: 65, adrForecast: 5800, revparForecast: 3770, confidence: 0.65, generatedBy: 'algorithm', modelVersion: 'v2.1', seasonalFactor: 0.95 },
      ],
    });
    console.log('7 demand forecasts seeded!');
  } catch (e: any) {
    console.log('Demand forecasts seed error:', e.message);
  }

  // ─── 15. Security Settings ─────────────────────────────────
  console.log('Seeding security settings...');
  try {
    await prisma.securitySettings.create({
      data: {
        id: uuid('secset-1'),
        tenantId: uuid('tenant-1'),
        maxConcurrentSessions: 3,
        sessionTimeoutMinutes: 30,
        passwordExpiryDays: 90,
        minPasswordLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        enable2FA: false,
      },
    });
    console.log('1 security settings record seeded!');
  } catch (e: any) {
    console.log('Security settings seed error:', e.message);
  }

  // ─── 16. Energy Metrics ────────────────────────────────────
  console.log('Seeding energy metrics...');
  try {
    await prisma.energyMetric.createMany({
      data: [
        { id: uuid('em-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), electricityKwh: 2400, gasM3: 120, waterM3: 85, electricityCost: 21600, gasCost: 6000, waterCost: 4250, carbonFootprint: 1080 },
        { id: uuid('em-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), electricityKwh: 2350, gasM3: 115, waterM3: 80, electricityCost: 21150, gasCost: 5750, waterCost: 4000, carbonFootprint: 1058 },
        { id: uuid('em-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), electricityKwh: 2500, gasM3: 130, waterM3: 92, electricityCost: 22500, gasCost: 6500, waterCost: 4600, carbonFootprint: 1125 },
        { id: uuid('em-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000), electricityKwh: 2300, gasM3: 110, waterM3: 78, electricityCost: 20700, gasCost: 5500, waterCost: 3900, carbonFootprint: 1035 },
        { id: uuid('em-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), electricityKwh: 2600, gasM3: 140, waterM3: 95, electricityCost: 23400, gasCost: 7000, waterCost: 4750, carbonFootprint: 1170 },
        { id: uuid('em-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), electricityKwh: 2550, gasM3: 135, waterM3: 90, electricityCost: 22950, gasCost: 6750, waterCost: 4500, carbonFootprint: 1148 },
        { id: uuid('em-7'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), electricityKwh: 2450, gasM3: 125, waterM3: 88, electricityCost: 22050, gasCost: 6250, waterCost: 4400, carbonFootprint: 1103 },
        { id: uuid('em-8'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(), electricityKwh: 1800, gasM3: 90, waterM3: 60, electricityCost: 16200, gasCost: 4500, waterCost: 3000, carbonFootprint: 810 },
        { id: uuid('em-9'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), electricityKwh: 2480, gasM3: 128, waterM3: 87, electricityCost: 22320, gasCost: 6400, waterCost: 4350, carbonFootprint: 1116 },
        { id: uuid('em-10'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), electricityKwh: 2420, gasM3: 122, waterM3: 83, electricityCost: 21780, gasCost: 6100, waterCost: 4150, carbonFootprint: 1089 },
      ],
    });
    console.log('10 energy metrics seeded!');
  } catch (e: any) {
    console.log('Energy metrics seed error:', e.message);
  }

  // ─── 17. Guest Journey Events ──────────────────────────────
  console.log('Seeding guest journey events...');
  try {
    await prisma.guestJourney.createMany({
      data: [
        { id: uuid('gj-1'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), stage: 'pre_arrival', eventType: 'pre_arrival', title: 'Booking Confirmed', description: 'Booking RS-2024-001 confirmed for Deluxe Room 501. Pre-arrival email sent.', occurredAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000) },
        { id: uuid('gj-2'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), stage: 'pre_arrival', eventType: 'pre_arrival', title: 'Check-in Reminder Sent', description: 'Automated check-in reminder sent via email 24 hours before arrival.', occurredAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000) },
        { id: uuid('gj-3'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), stage: 'check_in', eventType: 'check_in', title: 'Checked In', description: 'Guest checked in at 2:15 PM. Welcomed by Priya Das. Gold tier benefits applied.', occurredAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), metadata: JSON.stringify({ checkedInBy: 'user-2', checkInTime: '14:15' }) },
        { id: uuid('gj-4'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), stage: 'stay', eventType: 'interaction', title: 'Chat Conversation', description: 'Guest requested extra pillows and inquired about restaurant hours via in-app chat.', occurredAt: new Date(today.getTime() - 3 * 60 * 60 * 1000), metadata: JSON.stringify({ channel: 'in_app', messages: 6 }) },
        { id: uuid('gj-5'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), stage: 'stay', eventType: 'service_request', title: 'Housekeeping Request', description: 'Extra pillow and blanket delivered to room 501.', occurredAt: new Date(today.getTime() - 2.5 * 60 * 60 * 1000), metadata: JSON.stringify({ type: 'housekeeping', resolved: true, responseTimeMinutes: 12 }) },
        { id: uuid('gj-6'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), stage: 'stay', eventType: 'amenity_used', title: 'Restaurant Visit', description: 'Guest dined at the in-house restaurant. Ordered Butter Chicken and Naan.', occurredAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), metadata: JSON.stringify({ outlet: 'restaurant', amount: 1200, items: 3 }) },
        { id: uuid('gj-7'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), stage: 'stay', eventType: 'amenity_used', title: 'Gym Access', description: 'Guest used the fitness center for 45 minutes.', occurredAt: new Date(today.getTime() - 12 * 60 * 60 * 1000), metadata: JSON.stringify({ facility: 'gym', duration: 45 }) },
        { id: uuid('gj-8'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), stage: 'stay', eventType: 'service_request', title: 'Plumbing Issue Reported', description: 'Guest reported leaking bathroom faucet. Work order WO-2024-001 created.', occurredAt: new Date(today.getTime() - 6 * 60 * 60 * 1000), metadata: JSON.stringify({ workOrderId: 'wo-1', priority: 'high' }) },
      ],
    });
    console.log('8 guest journey events seeded!');
  } catch (e: any) {
    console.log('Guest journey events seed error:', e.message);
  }

  // ─── 18. Brand Data ───────────────────────────────────────
  console.log('Seeding brand data...');
  try {
    await prisma.brand.create({
      data: {
        id: uuid('brand-1'),
        tenantId: uuid('tenant-1'),
        name: 'Royal Stay',
        code: 'ROYAL_STAY',
        description: 'Royal Stay Hotels & Resorts — A premium Indian hospitality brand offering luxury accommodations across major cities and tourist destinations.',
        logo: '/brand/royal-stay-logo.png',
        primaryColor: '#1a365d',
        secondaryColor: '#c05621',
        standards: JSON.stringify({ minStarRating: 4, checkInStandard: '14:00', checkOutStandard: '11:00', amenitiesRequired: ['WiFi', 'AC', 'RoomService', 'DailyHousekeeping'], brandingRequired: true }),
        status: 'active',
      },
    });
    console.log('1 brand record seeded!');
  } catch (e: any) {
    console.log('Brand data seed error:', e.message);
  }

  // ─── 19. External Reviews ─────────────────────────────────
  console.log('Seeding external reviews...');
  try {
    await prisma.externalReview.createMany({
      data: [
        { id: uuid('extrev-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), source: 'google', externalId: uuid('extid-g001'), content: 'Excellent stay at Royal Stay Kolkata! The staff was incredibly warm and helpful. Room 501 had a beautiful city view. Breakfast buffet had great variety. Will definitely come back.', rating: 5, reviewerName: 'Sanjay K.', reviewDate: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000), sentimentScore: 0.95, sentimentLabel: 'positive' },
        { id: uuid('extrev-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), source: 'google', externalId: uuid('extid-g002'), content: 'Good hotel, well-maintained rooms. The location on Park Street is perfect. Only minor issue was the Wi-Fi was a bit slow in the evening. Otherwise, a great experience.', rating: 4, reviewerName: 'Meera P.', reviewDate: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000), sentimentScore: 0.78, sentimentLabel: 'positive', responseText: 'Thank you for your feedback, Meera! We\'re working on upgrading our internet bandwidth. Hope to see you again soon!', respondedAt: new Date(today.getTime() - 9 * 24 * 60 * 60 * 1000) },
        { id: uuid('extrev-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), source: 'tripadvisor', externalId: uuid('extid-ta001'), content: 'Fantastic property with top-notch service. The Executive Suite was spacious and well-appointed. The in-house restaurant serves amazing Bengali cuisine. Highly recommended for business travelers.', rating: 5, reviewerName: 'Rajiv M.', reviewDate: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000), sentimentScore: 0.92, sentimentLabel: 'positive', responseText: 'Thank you, Rajiv! We\'re delighted you enjoyed our Bengali cuisine offerings.', respondedAt: new Date(today.getTime() - 19 * 24 * 60 * 60 * 1000) },
        { id: uuid('extrev-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), source: 'booking_com', externalId: uuid('extid-bc001'), content: 'Decent hotel for the price. Rooms are clean and the staff is courteous. The check-in process was smooth. Breakfast could have more options. Overall a satisfactory stay.', rating: 3, reviewerName: 'Anonymous', reviewDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), sentimentScore: 0.55, sentimentLabel: 'neutral' },
        { id: uuid('extrev-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), source: 'google', externalId: uuid('extid-g003'), content: 'Disappointed with our stay. The AC in our room was not working properly and it took 2 hours to get it fixed. The bathroom had some stains. Not what we expected from a 5-star property.', rating: 2, reviewerName: 'Deepak S.', reviewDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), sentimentScore: 0.15, sentimentLabel: 'negative', responseText: 'We sincerely apologize for the inconvenience, Deepak. We have addressed the AC maintenance issue and bathroom cleaning protocols with our team.', respondedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) },
      ],
    });
    console.log('5 external reviews seeded!');
  } catch (e: any) {
    console.log('External reviews seed error:', e.message);
  }

  // ─── 20. Booking Audit Logs ────────────────────────────────
  console.log('Seeding booking audit logs...');
  try {
    await prisma.bookingAuditLog.createMany({
      data: [
        { id: uuid('bal-1'), bookingId: uuid('booking-1'), action: 'created', newStatus: 'confirmed', notes: 'Direct booking by guest Amit Mukherjee', performedBy: 'user-2', performedAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
        { id: uuid('bal-2'), bookingId: uuid('booking-1'), action: 'modified', oldStatus: 'confirmed', newStatus: 'confirmed', notes: 'Room changed from 505 to 501 per guest request', performedBy: 'user-2', performedAt: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000) },
        { id: uuid('bal-3'), bookingId: uuid('booking-1'), action: 'checked_in', oldStatus: 'confirmed', newStatus: 'checked_in', notes: 'Guest arrived at 2:15 PM. ID verified.', performedBy: 'user-2', performedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) },
        { id: uuid('bal-4'), bookingId: uuid('booking-2'), action: 'created', newStatus: 'confirmed', notes: 'Direct booking by VIP Platinum guest Rahul Banerjee', performedBy: 'user-1', performedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000) },
        { id: uuid('bal-5'), bookingId: uuid('booking-2'), action: 'checked_in', oldStatus: 'confirmed', newStatus: 'checked_in', notes: 'Guest checked in at 1:30 PM. VIP welcome amenity arranged.', performedBy: 'user-1', performedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000) },
        { id: uuid('bal-6'), bookingId: uuid('booking-3'), action: 'created', newStatus: 'confirmed', notes: 'Booking.com reservation. Auto-confirmed.', performedBy: 'system', performedAt: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000) },
        { id: uuid('bal-7'), bookingId: uuid('booking-3'), action: 'modified', oldStatus: 'confirmed', newStatus: 'confirmed', notes: 'Added to group booking TCS Annual Offsite 2024 (group-1)', performedBy: 'user-1', performedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) },
        { id: uuid('bal-8'), bookingId: uuid('booking-4'), action: 'created', newStatus: 'confirmed', notes: 'Direct booking by gold tier guest Vikram Singh. Presidential Suite requested.', performedBy: 'user-1', performedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000) },
        { id: uuid('bal-9'), bookingId: uuid('booking-5'), action: 'created', newStatus: 'confirmed', notes: 'Airbnb reservation. Auto-confirmed.', performedBy: 'system', performedAt: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000) },
        { id: uuid('bal-10'), bookingId: uuid('booking-6'), action: 'checked_in', oldStatus: 'confirmed', newStatus: 'checked_in', notes: 'Guest checked in at 3:00 PM. Room 305 assigned.', performedBy: 'user-2', performedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000) },
      ],
    });
    console.log('10 booking audit logs seeded!');
  } catch (e: any) {
    console.log('Booking audit logs seed error:', e.message);
  }

  // ============================================================
  // END NEW MODULE SEED DATA
  // ============================================================

  // ============================================================
  // ADDITIONAL SEED DATA - Covers remaining models for blank pages
  // ============================================================

  // ─── Bank Accounts ─────────────────────────────────────────
  console.log('Seeding bank accounts...');
  try {
    await prisma.bankAccount.createMany({
      data: [
        { id: uuid('bank-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), accountName: 'Royal Stay Kolkata - Operations', accountNumber: '****1234', bankName: 'State Bank of India', bankCode: 'SBIN0001234', accountType: 'checking', currency: 'INR', openingBalance: 500000, currentBalance: 1245000, lastReconciledAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), status: 'active', isDefault: true },
        { id: uuid('bank-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), accountName: 'Royal Stay Kolkata - Escrow', accountNumber: '****5678', bankName: 'HDFC Bank', bankCode: 'HDFC0005678', accountType: 'savings', currency: 'INR', openingBalance: 250000, currentBalance: 680000, lastReconciledAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), status: 'active', isDefault: false },
        { id: uuid('bank-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), accountName: 'Royal Stay Kolkata - Tax', accountNumber: '****9012', bankName: 'ICICI Bank', bankCode: 'ICIC0009012', accountType: 'checking', currency: 'INR', openingBalance: 100000, currentBalance: 245000, status: 'active', isDefault: false },
      ],
    });
    console.log('3 bank accounts seeded!');
  } catch (e: any) {
    console.log('Bank accounts seed error:', e.message);
  }

  // ─── Bank Transactions ────────────────────────────────────
  console.log('Seeding bank transactions...');
  try {
    await prisma.bankTransaction.createMany({
      data: [
        { id: uuid('bt-1'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), transactionDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), transactionType: 'credit', amount: 55000, currency: 'INR', balance: 1190000, description: 'Booking.com payout - batch #4521', reference: 'BDC-4521', payeeName: 'Booking.com', category: 'channel_payout', isReconciled: true, importSource: 'manual' },
        { id: uuid('bt-2'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), transactionDate: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), transactionType: 'credit', amount: 17990, currency: 'INR', balance: 1207990, description: 'Guest payment - Amit Mukherjee - RS-2024-001', payeeName: 'Amit Mukherjee', category: 'guest_payment', isReconciled: true, importSource: 'manual' },
        { id: uuid('bt-3'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), transactionDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), transactionType: 'debit', amount: 45000, currency: 'INR', balance: 1162990, description: 'Vendor payment - Premium Linen Supply', payeeName: 'Premium Linen Supply', category: 'vendor_payment', isReconciled: true, importSource: 'manual' },
        { id: uuid('bt-4'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), transactionDate: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000), transactionType: 'credit', amount: 113800, currency: 'INR', balance: 1276790, description: 'Direct booking payment - Vikram Singh - RS-2024-004', payeeName: 'Vikram Singh', category: 'guest_payment', isReconciled: true, importSource: 'manual' },
        { id: uuid('bt-5'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), transactionDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), transactionType: 'debit', amount: 32000, currency: 'INR', balance: 1244790, description: 'GST tax payment - Q3 advance', category: 'tax_payment', isReconciled: true, importSource: 'manual' },
        { id: uuid('bt-6'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), transactionDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), transactionType: 'credit', amount: 53160, currency: 'INR', balance: 1297950, description: 'Guest payment - Rahul Banerjee - RS-2024-002', payeeName: 'Rahul Banerjee', category: 'guest_payment', isReconciled: false, importSource: 'manual' },
        { id: uuid('bt-7'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), transactionDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), transactionType: 'debit', amount: 52000, currency: 'INR', balance: 1245950, description: 'Monthly salary payouts - staff', category: 'payroll', isReconciled: false, importSource: 'csv' },
        { id: uuid('bt-8'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-2'), transactionDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), transactionType: 'credit', amount: 180000, currency: 'INR', balance: 680000, description: 'Expedia payout - batch #887', reference: 'EXP-887', payeeName: 'Expedia', category: 'channel_payout', isReconciled: true, importSource: 'manual' },
        { id: uuid('bt-9'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-2'), transactionDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), transactionType: 'credit', amount: 23490, currency: 'INR', balance: 703490, description: 'Airbnb payout - batch #1205', reference: 'AIR-1205', payeeName: 'Airbnb', category: 'channel_payout', isReconciled: false, importSource: 'api' },
        { id: uuid('bt-10'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-3'), transactionDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), transactionType: 'credit', amount: 45000, currency: 'INR', balance: 245000, description: 'GST collected from guests - partial remittance', category: 'tax_collection', isReconciled: true, importSource: 'manual' },
      ],
    });
    console.log('10 bank transactions seeded!');
  } catch (e: any) {
    console.log('Bank transactions seed error:', e.message);
  }

  // ─── Reconciliations ───────────────────────────────────────
  console.log('Seeding reconciliations...');
  try {
    await prisma.reconciliation.createMany({
      data: [
        { id: uuid('recon-1'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), bankTransactionId: uuid('bt-1'), paymentId: uuid('pay-1'), folioId: uuid('folio-1'), matchType: 'auto', matchConfidence: 0.95, matchCriteria: JSON.stringify({ amount: true, date: true }), status: 'matched', reconciledAmount: 17990, reconciledBy: 'user-1' },
        { id: uuid('recon-2'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), bankTransactionId: uuid('bt-2'), paymentId: uuid('pay-2'), folioId: uuid('folio-2'), matchType: 'auto', matchConfidence: 0.92, matchCriteria: JSON.stringify({ amount: true, name: true }), status: 'matched', reconciledAmount: 55000, reconciledBy: 'user-1' },
        { id: uuid('recon-3'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), bankTransactionId: uuid('bt-3'), paymentId: null, folioId: null, matchType: 'manual', matchConfidence: 0.88, matchCriteria: JSON.stringify({ amount: true, vendor: true }), status: 'matched', reconciledAmount: 45000, reconciledBy: 'user-1', adjustmentReason: 'Vendor payment matched to purchase order PO-001' },
        { id: uuid('recon-4'), tenantId: uuid('tenant-1'), bankAccountId: uuid('bank-1'), bankTransactionId: uuid('bt-5'), paymentId: null, folioId: null, matchType: 'manual', matchConfidence: 0.85, status: 'matched', reconciledAmount: 32000, reconciledBy: 'user-1', notes: 'GST quarterly advance payment' },
      ],
    });
    console.log('4 reconciliations seeded!');
  } catch (e: any) {
    console.log('Reconciliations seed error:', e.message);
  }

  // ─── Tax Reports ──────────────────────────────────────────
  console.log('Seeding tax reports...');
  try {
    await prisma.taxReport.createMany({
      data: [
        { id: uuid('taxrpt-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), reportNumber: 'GST-2024-Q3-001', reportType: 'gst', jurisdiction: 'india', periodStart: new Date(2024, 6, 1), periodEnd: new Date(2024, 8, 30), filingDueDate: new Date(2024, 9, 20), grossRevenue: 4500000, taxableRevenue: 3825000, taxCollected: 687750, taxPaid: 520000, taxDue: 167750, cgstAmount: 343875, sgstAmount: 343875, igstAmount: 0, cessAmount: 0, transactionCount: 485, exemptTransactions: 12, status: 'draft', notes: 'Quarter 3 GST filing' },
        { id: uuid('taxrpt-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), reportNumber: 'GST-2024-Q2-001', reportType: 'gst', jurisdiction: 'india', periodStart: new Date(2024, 3, 1), periodEnd: new Date(2024, 5, 31), filingDueDate: new Date(2024, 6, 20), grossRevenue: 3800000, taxableRevenue: 3230000, taxCollected: 581400, taxPaid: 581400, taxDue: 0, taxRefundable: 0, cgstAmount: 290700, sgstAmount: 290700, igstAmount: 0, cessAmount: 0, transactionCount: 412, exemptTransactions: 8, status: 'filed', filedAt: new Date(2024, 6, 18), filedBy: 'user-1', filingReference: 'ACK-20240618-12345', paidAt: new Date(2024, 6, 25), paymentReference: 'CHALLAN-20240625-67890' },
        { id: uuid('taxrpt-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), reportNumber: 'TDS-2024-Q3-001', reportType: 'tds', jurisdiction: 'india', periodStart: new Date(2024, 6, 1), periodEnd: new Date(2024, 8, 30), filingDueDate: new Date(2024, 9, 31), grossRevenue: 520000, taxableRevenue: 520000, taxCollected: 52000, taxPaid: 32000, taxDue: 20000, transactionCount: 28, status: 'draft' },
      ],
    });
    console.log('3 tax reports seeded!');
  } catch (e: any) {
    console.log('Tax reports seed error:', e.message);
  }

  // ─── Shift Templates ───────────────────────────────────────
  console.log('Seeding shift templates...');
  try {
    await prisma.shiftTemplate.createMany({
      data: [
        { id: uuid('shift-tpl-1'), tenantId: uuid('tenant-1'), name: 'Morning Shift', code: 'MORNING', startTime: '06:00', endTime: '14:00', breakMinutes: 30, shiftType: 'regular', activeDays: '[1,2,3,4,5,6,7]', department: 'Front Desk', minStaff: 2, maxStaff: 4, color: '#f59e0b', isActive: true },
        { id: uuid('shift-tpl-2'), tenantId: uuid('tenant-1'), name: 'Afternoon Shift', code: 'AFTERNOON', startTime: '14:00', endTime: '22:00', breakMinutes: 30, shiftType: 'regular', activeDays: '[1,2,3,4,5,6,7]', department: 'Front Desk', minStaff: 2, maxStaff: 3, color: '#0d9488', isActive: true },
        { id: uuid('shift-tpl-3'), tenantId: uuid('tenant-1'), name: 'Night Shift', code: 'NIGHT', startTime: '22:00', endTime: '06:00', breakMinutes: 45, shiftType: 'regular', activeDays: '[1,2,3,4,5,6,7]', department: 'Front Desk', minStaff: 1, maxStaff: 2, color: '#6366f1', isActive: true },
        { id: uuid('shift-tpl-4'), tenantId: uuid('tenant-1'), name: 'Housekeeping Morning', code: 'HK-MORNING', startTime: '07:00', endTime: '15:00', breakMinutes: 30, shiftType: 'regular', activeDays: '[1,2,3,4,5,6]', department: 'Housekeeping', minStaff: 4, maxStaff: 8, color: '#10b981', isActive: true },
        { id: uuid('shift-tpl-5'), tenantId: uuid('tenant-1'), name: 'Housekeeping Afternoon', code: 'HK-AFTERNOON', startTime: '15:00', endTime: '23:00', breakMinutes: 30, shiftType: 'regular', activeDays: '[1,2,3,4,5,6]', department: 'Housekeeping', minStaff: 2, maxStaff: 4, color: '#059669', isActive: true },
      ],
    });
    console.log('5 shift templates seeded!');
  } catch (e: any) {
    console.log('Shift templates seed error:', e.message);
  }

  // ─── Staff Schedules ───────────────────────────────────────
  console.log('Seeding staff schedules...');
  try {
    const scheduleDate = new Date();
    await prisma.staffSchedule.createMany({
      data: [
        { id: uuid('sched-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), userId: uuid('user-1'), shiftTemplateId: uuid('shift-tpl-1'), date: scheduleDate, startTime: '09:00', endTime: '18:00', department: 'Management', status: 'active', notes: 'GM on duty' },
        { id: uuid('sched-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), userId: uuid('user-2'), shiftTemplateId: uuid('shift-tpl-1'), date: scheduleDate, startTime: '06:00', endTime: '14:00', department: 'Front Desk', status: 'active' },
        { id: uuid('sched-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), userId: uuid('user-3'), shiftTemplateId: uuid('shift-tpl-4'), date: scheduleDate, startTime: '07:00', endTime: '15:00', department: 'Housekeeping', status: 'active' },
        { id: uuid('sched-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), userId: uuid('user-2'), shiftTemplateId: uuid('shift-tpl-2'), date: new Date(scheduleDate.getTime() + 1 * 24 * 60 * 60 * 1000), startTime: '14:00', endTime: '22:00', department: 'Front Desk', status: 'scheduled' },
        { id: uuid('sched-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), userId: uuid('user-3'), shiftTemplateId: uuid('shift-tpl-4'), date: new Date(scheduleDate.getTime() + 1 * 24 * 60 * 60 * 1000), startTime: '07:00', endTime: '15:00', department: 'Housekeeping', status: 'scheduled' },
      ],
    });
    console.log('5 staff schedules seeded!');
  } catch (e: any) {
    console.log('Staff schedules seed error:', e.message);
  }

  // ─── Staff Leaves ─────────────────────────────────────────
  console.log('Seeding staff leaves...');
  try {
    await prisma.staffLeave.createMany({
      data: [
        { id: uuid('leave-1'), tenantId: uuid('tenant-1'), userId: uuid('user-2'), leaveType: 'casual', startDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 16 * 24 * 60 * 60 * 1000), totalDays: 3, reason: 'Family function in Delhi', status: 'approved', approvedBy: uuid('user-1'), approvedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000) },
        { id: uuid('leave-2'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), leaveType: 'sick', startDate: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() - 9 * 24 * 60 * 60 * 1000), totalDays: 2, reason: 'Food poisoning', status: 'approved', approvedBy: uuid('user-1'), approvedAt: new Date(today.getTime() - 11 * 24 * 60 * 60 * 1000) },
        { id: uuid('leave-3'), tenantId: uuid('tenant-1'), userId: uuid('user-1'), leaveType: 'earned', startDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 34 * 24 * 60 * 60 * 1000), totalDays: 5, reason: 'Planned vacation to Goa', status: 'pending' },
      ],
    });
    console.log('3 staff leaves seeded!');
  } catch (e: any) {
    console.log('Staff leaves seed error:', e.message);
  }

  // ─── Staff Performance Reviews ─────────────────────────────
  console.log('Seeding staff performance...');
  try {
    await prisma.staffPerformance.createMany({
      data: [
        { id: uuid('perf-1'), tenantId: uuid('tenant-1'), userId: uuid('user-2'), reviewPeriod: 'Q3', reviewYear: 2024, overallRating: 4.2, punctualityRating: 4.5, qualityRating: 4.0, teamworkRating: 4.3, communicationRating: 4.1, initiativeRating: 3.8, tasksCompleted: 245, avgResponseTime: 12.5, attendanceRate: 96.5, customerRating: 4.4, goalsSet: 5, goalsAchieved: 4, strengths: 'Excellent guest handling and quick check-in processing', areasOfImprovement: 'Could improve upselling skills', reviewedBy: 'user-1', status: 'published', acknowledgedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000) },
        { id: uuid('perf-2'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), reviewPeriod: 'Q3', reviewYear: 2024, overallRating: 3.8, punctualityRating: 4.0, qualityRating: 3.9, teamworkRating: 4.2, communicationRating: 3.5, initiativeRating: 3.3, tasksCompleted: 520, avgResponseTime: 8.2, attendanceRate: 94.0, customerRating: null, goalsSet: 4, goalsAchieved: 3, strengths: 'Consistent room quality and fast turnaround', areasOfImprovement: 'Communication with front desk team', reviewedBy: 'user-1', status: 'published' },
      ],
    });
    console.log('2 staff performance records seeded!');
  } catch (e: any) {
    console.log('Staff performance seed error:', e.message);
  }

  // ─── Ad Campaigns ─────────────────────────────────────────
  console.log('Seeding ad campaigns...');
  try {
    await prisma.adCampaign.createMany({
      data: [
        { id: uuid('adcampaign-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Durga Puja Special Offer', description: 'Special rates during Durga Puja festival season in Kolkata', type: 'search', platform: 'google', status: 'active', budget: 5000, budgetType: 'daily', spentAmount: 85000, currency: 'INR', startDate: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), bidStrategy: 'enhanced', targetCpa: 350, targeting: JSON.stringify({ locations: ['Kolkata', 'Howrah', 'Durgapur'], radius: '100km' }), keywords: '["kolkata hotel", "luxury hotel kolkata", "5 star hotel park street"]', roomTypes: '["roomtype-1", "roomtype-2"]', ratePlans: '["rateplan-1", "rateplan-3"]', impressions: 125000, clicks: 8750, conversions: 185, revenue: 925000, ctr: 7.0, cpc: 9.71, conversionRate: 2.11, roas: 10.88 },
        { id: uuid('adcampaign-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Corporate Retreats Kolkata', description: 'Targeting corporate bookings for meetings and retreats', type: 'search', platform: 'google', status: 'active', budget: 3000, budgetType: 'daily', spentAmount: 45000, currency: 'INR', startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), endDate: null, bidStrategy: 'manual', bidAmount: 15, targeting: JSON.stringify({ locations: ['Kolkata CBD'], audiences: 'corporate' }), keywords: '["corporate hotel kolkata", "meeting venue kolkata", "business hotel"]', roomTypes: '["roomtype-3", "roomtype-4"]', ratePlans: '["rateplan-6", "rateplan-7"]', impressions: 68000, clicks: 4080, conversions: 62, revenue: 372000, ctr: 6.0, cpc: 11.03, conversionRate: 1.52, roas: 8.27 },
        { id: uuid('adcampaign-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Weekend Getaway - Social', description: 'Facebook and Instagram ads targeting weekend travelers', type: 'display', platform: 'meta', status: 'paused', budget: 2000, budgetType: 'daily', spentAmount: 32000, currency: 'INR', startDate: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), bidStrategy: 'auto', targeting: JSON.stringify({ ageRange: '25-45', interests: ['travel', 'luxury', 'food'] }), impressions: 250000, clicks: 5000, conversions: 45, revenue: 180000, ctr: 2.0, cpc: 6.4, conversionRate: 0.9, roas: 5.63 },
      ],
    });
    console.log('3 ad campaigns seeded!');
  } catch (e: any) {
    console.log('Ad campaigns seed error:', e.message);
  }

  // ─── Google Hotel Ads Connection ───────────────────────────
  console.log('Seeding Google Hotel Ads connection...');
  try {
    await prisma.googleHotelAdsConnection.createMany({
      data: [
        { id: uuid('gha-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), accountId: uuid('gha-acct-1'), hotelId: uuid('gha-hotel-1'), status: 'connected', connectionMode: 'live', partnerId: uuid('gha-partner-1'), hotelCenterId: uuid('gha-hc-1'), priceFeedUrl: 'https://feeds.royalstay.in/prices/kolkata.xml', priceFeedFormat: 'xml', lastPriceFeedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), totalBookings: 142, totalRevenue: 850000, totalSpend: 125000, avgRoas: 6.8, bidStrategy: 'auto', baseBidModifier: 1.2, autoBidEnabled: true },
      ],
    });
    console.log('1 Google Hotel Ads connection seeded!');
  } catch (e: any) {
    console.log('Google Hotel Ads seed error:', e.message);
  }

  // ─── Metasearch Connections ────────────────────────────────
  console.log('Seeding metasearch connections...');
  try {
    await prisma.metasearchConnection.createMany({
      data: [
        { id: uuid('meta-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), platform: 'trivago', externalId: uuid('meta-ext-triv'), status: 'connected', feedFormat: 'xml', lastSyncAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), impressions: 85000, clicks: 5100, bookings: 85, revenue: 340000, cost: 42500, ctr: 6.0, config: JSON.stringify({ commissionModel: 'cpc', bid: 8.33 }) },
        { id: uuid('meta-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), platform: 'tripadvisor', externalId: uuid('meta-ext-ta'), status: 'connected', feedFormat: 'json', lastSyncAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), impressions: 42000, clicks: 2100, bookings: 32, revenue: 128000, cost: 16800, ctr: 5.0, config: JSON.stringify({ commissionModel: 'cpa', commission: 525 }) },
      ],
    });
    console.log('2 metasearch connections seeded!');
  } catch (e: any) {
    console.log('Metasearch connections seed error:', e.message);
  }

  // ─── Communication Channels ───────────────────────────────
  console.log('Seeding communication channels...');
  try {
    await prisma.communicationChannel.createMany({
      data: [
        { id: uuid('comm-1'), tenantId: uuid('tenant-1'), type: 'email', name: 'SMTP Email', provider: 'sendgrid', config: JSON.stringify({ host: 'smtp.sendgrid.net', port: 587, fromEmail: 'noreply@royalstay.in', fromName: 'Royal Stay Hotels' }), status: 'active', capabilities: '["send", "receive"]', messagesSent: 4520, messagesReceived: 1200, lastMessageAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000) },
        { id: uuid('comm-2'), tenantId: uuid('tenant-1'), type: 'sms', name: 'SMS Gateway', provider: 'msg91', config: JSON.stringify({ apiKey: '***masked***', senderId: 'RSTAY' }), status: 'active', capabilities: '["send"]', messagesSent: 8950, lastMessageAt: new Date() },
        { id: uuid('comm-3'), tenantId: uuid('tenant-1'), type: 'whatsapp', name: 'WhatsApp Business', provider: 'meta', config: JSON.stringify({ phoneNumberId: '919830012345', businessAccountId: 'BA-RS-001' }), status: 'active', capabilities: '["send", "receive", "template"]', messagesSent: 3200, messagesReceived: 1800, lastMessageAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) },
        { id: uuid('comm-4'), tenantId: uuid('tenant-1'), type: 'push', name: 'Push Notifications', provider: 'firebase', config: JSON.stringify({ projectId: 'royal-stay-001' }), status: 'active', capabilities: '["send"]', messagesSent: 12500, lastMessageAt: new Date() },
      ],
    });
    console.log('4 communication channels seeded!');
  } catch (e: any) {
    console.log('Communication channels seed error:', e.message);
  }

  // ─── Message Templates ────────────────────────────────────
  console.log('Seeding message templates (additional)...');
  try {
    await prisma.messageTemplate.createMany({
      data: [
        { id: uuid('msgtpl-1'), tenantId: uuid('tenant-1'), name: 'Check-in Reminder', category: 'pre_arrival', channel: 'whatsapp', subject: null, body: 'Dear {{guestName}}, your check-in at {{hotelName}} is tomorrow! Your room {{roomNumber}} is ready from {{checkInTime}}. Please carry a valid ID. We look forward to welcoming you!', variables: '["guestName", "hotelName", "roomNumber", "checkInTime"]', isQuickReply: false, shortcut: 'checkin-remind', isActive: true, usageCount: 450 },
        { id: uuid('msgtpl-2'), tenantId: uuid('tenant-1'), name: 'Review Request', category: 'post_stay', channel: 'email', subject: 'How was your stay at {{hotelName}}?', body: 'Dear {{guestName}},\n\nThank you for choosing {{hotelName}}. We hope you had a wonderful stay with us.\n\nWe would love to hear about your experience. Your feedback helps us improve.\n\nPlease take a moment to review us: {{reviewUrl}}\n\nWarm regards,\n{{hotelName}} Team', variables: '["guestName", "hotelName", "reviewUrl"]', isQuickReply: false, isActive: true, usageCount: 320 },
        { id: uuid('msgtpl-3'), tenantId: uuid('tenant-1'), name: 'Maintenance Update', category: 'internal', channel: 'push', subject: null, body: 'Room {{roomNumber}} maintenance has been completed by {{staffName}}.', variables: '["roomNumber", "staffName"]', isQuickReply: true, shortcut: 'maint-done', isActive: true, usageCount: 180 },
        { id: uuid('msgtpl-4'), tenantId: uuid('tenant-1'), name: 'Welcome Message', category: 'on_property', channel: 'whatsapp', subject: null, body: 'Welcome to {{hotelName}}, {{guestName}}! 🎉 We are delighted to have you. Your room {{roomNumber}} is ready. WiFi: {{wifiNetwork}} | Password: {{wifiPassword}}. Need anything? Just reply here!', variables: '["guestName", "hotelName", "roomNumber", "wifiNetwork", "wifiPassword"]', isQuickReply: false, isActive: true, usageCount: 890 },
      ],
    });
    console.log('4 message templates seeded!');
  } catch (e: any) {
    console.log('Message templates seed error:', e.message);
  }

  // ─── Notification Preferences ──────────────────────────────
  console.log('Seeding notification preferences...');
  try {
    await prisma.notificationPreference.createMany({
      data: [
        { id: uuid('notifpref-1'), tenantId: uuid('tenant-1'), userId: uuid('user-1'), category: 'booking', emailEnabled: true, smsEnabled: true, pushEnabled: true, inAppEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '07:00', quietHoursEnabled: true },
        { id: uuid('notifpref-2'), tenantId: uuid('tenant-1'), userId: uuid('user-1'), category: 'payment', emailEnabled: true, smsEnabled: false, pushEnabled: true, inAppEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '07:00', quietHoursEnabled: true },
        { id: uuid('notifpref-3'), tenantId: uuid('tenant-1'), userId: uuid('user-1'), category: 'housekeeping', emailEnabled: false, smsEnabled: false, pushEnabled: true, inAppEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '07:00', quietHoursEnabled: false },
        { id: uuid('notifpref-4'), tenantId: uuid('tenant-1'), userId: uuid('user-1'), category: 'system', emailEnabled: true, smsEnabled: false, pushEnabled: true, inAppEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '07:00', quietHoursEnabled: true },
        { id: uuid('notifpref-5'), tenantId: uuid('tenant-1'), userId: uuid('user-2'), category: 'booking', emailEnabled: true, smsEnabled: true, pushEnabled: true, inAppEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '08:00', quietHoursEnabled: true },
        { id: uuid('notifpref-6'), tenantId: uuid('tenant-1'), userId: uuid('user-2'), category: 'housekeeping', emailEnabled: false, smsEnabled: true, pushEnabled: true, inAppEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '08:00', quietHoursEnabled: false },
        { id: uuid('notifpref-7'), tenantId: uuid('tenant-1'), userId: uuid('user-3'), category: 'maintenance', emailEnabled: false, smsEnabled: true, pushEnabled: true, inAppEnabled: true, quietHoursEnabled: false },
      ],
    });
    console.log('7 notification preferences seeded!');
  } catch (e: any) {
    console.log('Notification preferences seed error:', e.message);
  }

  // ─── Scheduled Notifications ───────────────────────────────
  console.log('Seeding scheduled notifications...');
  try {
    await prisma.scheduledNotification.createMany({
      data: [
        { id: uuid('schednotif-1'), tenantId: uuid('tenant-1'), recipientType: 'guest', recipientId: uuid('guest-2'), recipientEmail: 'sneha.g@email.com', channels: '["email", "whatsapp"]', subject: 'Your Stay is Coming Up!', body: 'Dear Sneha, your stay at Royal Stay Kolkata is confirmed for tomorrow.', scheduledFor: new Date(today.getTime() + 8 * 60 * 60 * 1000), status: 'pending' },
        { id: uuid('schednotif-2'), tenantId: uuid('tenant-1'), recipientType: 'guest', recipientId: uuid('guest-5'), recipientEmail: 'vikram.s@email.com', channels: '["email"]', subject: 'Exclusive Suite Upgrade Offer', body: 'Dear Vikram, upgrade to our Executive Suite for just INR 3000 more!', scheduledFor: new Date(today.getTime() + 10 * 60 * 60 * 1000), status: 'pending' },
        { id: uuid('schednotif-3'), tenantId: uuid('tenant-1'), recipientType: 'guest', recipientId: uuid('guest-6'), recipientEmail: 'rina.c@email.com', channels: '["email", "push"]', subject: 'Thank You for Your Stay', body: 'Dear Rina, thank you for staying with us. We hope you enjoyed your time at Royal Stay Kolkata.', scheduledFor: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), status: 'pending' },
        { id: uuid('schednotif-4'), tenantId: uuid('tenant-1'), recipientType: 'guest', recipientId: uuid('guest-1'), recipientEmail: 'amit.m@email.com', channels: '["email", "whatsapp"]', subject: 'Checkout Reminder', body: 'Dear Amit, your checkout is tomorrow at 11:00 AM. Express checkout available.', scheduledFor: new Date(today.getTime() + 20 * 60 * 60 * 1000), status: 'pending' },
        { id: uuid('schednotif-5'), tenantId: uuid('tenant-1'), recipientType: 'guest', recipientId: uuid('guest-3'), recipientEmail: 'rahul.b@email.com', channels: '["email", "whatsapp", "push"]', subject: 'Loyalty Points Update', body: 'Dear Rahul, you have earned 500 loyalty points from your recent stay!', scheduledFor: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), status: 'pending' },
      ],
    });
    console.log('5 scheduled notifications seeded!');
  } catch (e: any) {
    console.log('Scheduled notifications seed error:', e.message);
  }

  // ─── Price Overrides ───────────────────────────────────────
  console.log('Seeding price overrides...');
  try {
    await prisma.priceOverride.createMany({
      data: [
        { id: uuid('po-1'), ratePlanId: uuid('rateplan-1'), date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), price: 3200, reason: 'Weekday discount promotion', minStay: 2 },
        { id: uuid('po-2'), ratePlanId: uuid('rateplan-4'), date: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), price: 7500, reason: 'Weekend peak pricing', minStay: 1 },
        { id: uuid('po-3'), ratePlanId: uuid('rateplan-6'), date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), price: 10000, reason: 'Durga Puja special rate - reduced for advance booking', closedToArrival: false, closedToDeparture: false },
        { id: uuid('po-4'), ratePlanId: uuid('rateplan-1'), date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), price: 3800, reason: 'Long weekend surcharge' },
        { id: uuid('po-5'), ratePlanId: uuid('rateplan-4'), date: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000), price: 8000, reason: 'Festival season premium', minStay: 2, closedToArrival: true },
      ],
    });
    console.log('5 price overrides seeded!');
  } catch (e: any) {
    console.log('Price overrides seed error:', e.message);
  }

  // ─── Channel Connection (needed for ChannelMapping/ChannelRestriction) ──
  console.log('Seeding channel connections...');
  try {
    await prisma.channelConnection.createMany({
      data: [
        { id: uuid('channel-conn-1'), tenantId: uuid('tenant-1'), channel: 'booking_com', displayName: 'Booking.com', apiKey: 'BC-***MASKED***', propertyId: uuid('property-1'), hotelId: uuid('ch-hotel-bc'), endpointUrl: 'https://supply.connect.booking.com', status: 'connected', lastSyncAt: new Date(today.getTime() - 30 * 60 * 1000), autoSync: true, syncInterval: 15 },
        { id: uuid('channel-conn-2'), tenantId: uuid('tenant-1'), channel: 'expedia', displayName: 'Expedia', apiKey: 'EXP-***MASKED***', propertyId: uuid('property-1'), hotelId: uuid('ch-hotel-exp'), endpointUrl: 'https://services.expediapartnercentral.com', status: 'connected', lastSyncAt: new Date(today.getTime() - 45 * 60 * 1000), autoSync: true, syncInterval: 30 },
        { id: uuid('channel-conn-3'), tenantId: uuid('tenant-1'), channel: 'airbnb', displayName: 'Airbnb', clientId: uuid('ch-client-ab'), propertyId: uuid('property-1'), listingId: uuid('ch-list-ab'), status: 'connected', lastSyncAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), autoSync: true, syncInterval: 60 },
      ],
    });
    console.log('3 channel connections seeded!');
  } catch (e: any) {
    console.log('Channel connections seed error:', e.message);
  }

  // ─── Channel Mappings ──────────────────────────────────────
  console.log('Seeding channel mappings...');
  try {
    await prisma.channelMapping.createMany({
      data: [
        { id: uuid('chmap-1'), connectionId: uuid('channel-conn-1'), roomTypeId: uuid('roomtype-1'), ratePlanId: uuid('rateplan-1'), externalRoomId: uuid('BC-STD-001'), externalRoomName: 'Standard Double Room', syncInventory: true, syncRates: true, syncRestrictions: true, status: 'active' },
        { id: uuid('chmap-2'), connectionId: uuid('channel-conn-1'), roomTypeId: uuid('roomtype-2'), ratePlanId: uuid('rateplan-4'), externalRoomId: uuid('BC-DLX-001'), externalRoomName: 'Deluxe City View Room', syncInventory: true, syncRates: true, syncRestrictions: true, status: 'active' },
        { id: uuid('chmap-3'), connectionId: uuid('channel-conn-1'), roomTypeId: uuid('roomtype-3'), ratePlanId: uuid('rateplan-6'), externalRoomId: uuid('BC-EXEC-001'), externalRoomName: 'Executive Suite', syncInventory: true, syncRates: true, syncRestrictions: true, status: 'active' },
        { id: uuid('chmap-4'), connectionId: uuid('channel-conn-2'), roomTypeId: uuid('roomtype-1'), ratePlanId: uuid('rateplan-1'), externalRoomId: uuid('EXP-STD-001'), externalRoomName: 'Standard Room', externalRateId: uuid('EXP-RATE-001'), syncInventory: true, syncRates: true, syncRestrictions: true, status: 'active' },
        { id: uuid('chmap-5'), connectionId: uuid('channel-conn-2'), roomTypeId: uuid('roomtype-2'), ratePlanId: uuid('rateplan-4'), externalRoomId: uuid('EXP-DLX-001'), externalRoomName: 'Deluxe Room', externalRateId: uuid('EXP-RATE-002'), syncInventory: true, syncRates: true, syncRestrictions: true, status: 'active' },
        { id: uuid('chmap-6'), connectionId: uuid('channel-conn-3'), roomTypeId: uuid('roomtype-1'), ratePlanId: uuid('rateplan-2'), externalRoomId: uuid('AB-STD-001'), externalRoomName: 'Cozy Standard Room', syncInventory: true, syncRates: true, syncRestrictions: false, status: 'active' },
      ],
    });
    console.log('6 channel mappings seeded!');
  } catch (e: any) {
    console.log('Channel mappings seed error:', e.message);
  }

  // ─── Channel Restrictions ─────────────────────────────────
  console.log('Seeding channel restrictions...');
  try {
    await prisma.channelRestriction.createMany({
      data: [
        { id: uuid('chrestr-1'), connectionId: uuid('channel-conn-1'), roomTypeId: uuid('roomtype-4'), startDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), closed: true, source: 'manual', syncStatus: 'synced', lastSyncedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000) },
        { id: uuid('chrestr-2'), connectionId: uuid('channel-conn-1'), roomTypeId: uuid('roomtype-1'), startDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), closedToArrival: true, minStay: 2, source: 'manual', syncStatus: 'synced', lastSyncedAt: new Date() },
        { id: uuid('chrestr-3'), connectionId: uuid('channel-conn-2'), roomTypeId: uuid('roomtype-3'), startDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), minStay: 3, rateMin: 10000, source: 'manual', syncStatus: 'pending' },
      ],
    });
    console.log('3 channel restrictions seeded!');
  } catch (e: any) {
    console.log('Channel restrictions seed error:', e.message);
  }

  // ─── Channel Retry Queue ──────────────────────────────────
  console.log('Seeding channel retry queue...');
  try {
    await prisma.channelRetryQueue.createMany({
      data: [
        { id: uuid('chretry-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), channelCode: 'booking_com', operation: 'update_rates', payload: JSON.stringify({ roomTypeId: uuid('roomtype-1'), ratePlanId: uuid('rateplan-1'), dates: ['2024-12-15', '2024-12-16'], price: 3800 }), attemptCount: 2, nextRetryAt: new Date(today.getTime() + 5 * 60 * 1000), status: 'pending', lastError: 'Connection timeout', lastAttemptAt: new Date(today.getTime() - 30 * 60 * 1000), priority: 1 },
        { id: uuid('chretry-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), channelCode: 'expedia', operation: 'update_availability', payload: JSON.stringify({ roomTypeId: uuid('roomtype-2'), date: '2024-12-15', available: 8 }), attemptCount: 1, nextRetryAt: new Date(today.getTime() + 10 * 60 * 1000), status: 'pending', lastError: '500 Internal Server Error', lastAttemptAt: new Date(today.getTime() - 15 * 60 * 1000), priority: 2 },
      ],
    });
    console.log('2 channel retry queue items seeded!');
  } catch (e: any) {
    console.log('Channel retry queue seed error:', e.message);
  }

  // ─── Channel Dead Letter Queue ─────────────────────────────
  console.log('Seeding channel dead letter queue...');
  try {
    await prisma.channelDeadLetterQueue.createMany({
      data: [
        { id: uuid('chdead-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), channelCode: 'booking_com', operation: 'create_booking', payload: JSON.stringify({ bookingId: uuid('booking-failed-1'), roomTypeId: uuid('roomtype-1'), dates: ['2024-11-10', '2024-11-12'] }), error: 'Authentication failed - API key expired', attemptCount: 5, originalCreatedAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000) },
        { id: uuid('chdead-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), channelCode: 'airbnb', operation: 'sync_calendar', payload: JSON.stringify({ roomId: uuid('room-501'), dates: ['2024-11-05', '2024-11-08'], status: 'blocked' }), error: 'Invalid listing ID - listing removed from Airbnb', attemptCount: 3, originalCreatedAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
      ],
    });
    console.log('2 channel dead letter queue items seeded!');
  } catch (e: any) {
    console.log('Channel dead letter queue seed error:', e.message);
  }

  // ─── Security Events ──────────────────────────────────────
  console.log('Seeding security events...');
  try {
    // First create camera groups and cameras for references
    await prisma.cameraGroup.createMany({
      data: [
        { id: uuid('camgroup-1'), propertyId: uuid('property-1'), name: 'Lobby', description: 'Lobby and reception area cameras' },
        { id: uuid('camgroup-2'), propertyId: uuid('property-1'), name: 'Parking', description: 'Parking lot and entrance cameras' },
        { id: uuid('camgroup-3'), propertyId: uuid('property-1'), name: 'Floor 1 Corridor', description: 'First floor corridor cameras' },
      ],
    });

    await prisma.camera.createMany({
      data: [
        { id: uuid('cam-1'), propertyId: uuid('property-1'), groupId: uuid('camgroup-1'), name: 'Lobby Main', location: 'Main lobby entrance', streamType: 'rtsp', status: 'online', posX: 50, posY: 30 },
        { id: uuid('cam-2'), propertyId: uuid('property-1'), groupId: uuid('camgroup-1'), name: 'Reception Desk', location: 'Front desk area', streamType: 'rtsp', status: 'online', posX: 200, posY: 30 },
        { id: uuid('cam-3'), propertyId: uuid('property-1'), groupId: uuid('camgroup-2'), name: 'Parking Gate', location: 'Main parking gate', streamType: 'rtsp', isRecording: true, status: 'online', posX: 50, posY: 50 },
        { id: uuid('cam-4'), propertyId: uuid('property-1'), groupId: uuid('camgroup-2'), name: 'Parking Basement', location: 'Basement parking B1', streamType: 'rtsp', isRecording: true, status: 'offline', posX: 150, posY: 50 },
        { id: uuid('cam-5'), propertyId: uuid('property-1'), groupId: uuid('camgroup-3'), name: 'Floor 1 East', location: '1st floor east corridor', streamType: 'rtsp', status: 'online', posX: 50, posY: 70 },
        { id: uuid('cam-6'), propertyId: uuid('property-1'), groupId: uuid('camgroup-3'), name: 'Floor 1 West', location: '1st floor west corridor', streamType: 'rtsp', status: 'online', posX: 200, posY: 70 },
      ],
    });

    await prisma.securityEvent.createMany({
      data: [
        { id: uuid('secevt-1'), tenantId: uuid('tenant-1'), cameraId: uuid('cam-3'), type: 'motion_detected', severity: 'low', description: 'Motion detected at parking gate after midnight', metadata: JSON.stringify({ duration: '15s', confidence: 0.92 }), timestamp: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000) },
        { id: uuid('secevt-2'), tenantId: uuid('tenant-1'), cameraId: uuid('cam-3'), type: 'vehicle_entry', severity: 'info', description: 'Vehicle entered parking - WB 12 AB 3456', metadata: JSON.stringify({ plateNumber: 'WB 12 AB 3456' }), timestamp: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), acknowledged: true, acknowledgedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000), acknowledgedBy: 'user-1' },
        { id: uuid('secevt-3'), tenantId: uuid('tenant-1'), cameraId: uuid('cam-1'), type: 'unauthorized_access', severity: 'high', description: 'Person detected in restricted area near fire exit', metadata: JSON.stringify({ duration: '2m', confidence: 0.87 }), timestamp: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000) },
        { id: uuid('secevt-4'), tenantId: uuid('tenant-1'), cameraId: uuid('cam-4'), type: 'camera_offline', severity: 'medium', description: 'Camera went offline - possible connectivity issue', timestamp: new Date(today.getTime() - 6 * 60 * 60 * 1000), acknowledged: true, acknowledgedAt: new Date(today.getTime() - 5 * 60 * 60 * 1000), acknowledgedBy: 'user-1', notes: 'Network cable checked, issue resolved' },
        { id: uuid('secevt-5'), tenantId: uuid('tenant-1'), cameraId: uuid('cam-5'), type: 'motion_detected', severity: 'low', description: 'Guest movement in corridor at 3 AM', timestamp: new Date(today.getTime() - 12 * 60 * 60 * 1000) },
      ],
    });
    console.log('Security events seeded (cameras, groups, events)!');
  } catch (e: any) {
    console.log('Security events seed error:', e.message);
  }

  // ─── Events / Experiences ─────────────────────────────────
  console.log('Seeding events...');
  try {
    await prisma.event.createMany({
      data: [
        { id: uuid('event-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Durga Puja Gala Dinner', type: 'banquet', description: 'Traditional Bengali feast celebrating Durga Puja with live music and cultural performances', organizerName: 'Royal Stay Events', organizerEmail: 'events@royalstay.in', organizerPhone: '+91-33-40012350', startDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000), setupStart: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000), teardownEnd: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000), expectedAttendance: 150, spaceCharge: 75000, cateringCharge: 120000, avCharge: 25000, otherCharges: 15000, totalAmount: 235000, currency: 'INR', depositAmount: 50000, depositPaid: true, status: 'confirmed', notes: 'Menu finalized with executive chef' },
        { id: uuid('event-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Corporate Workshop - Tech Solutions', type: 'meeting', description: 'Two-day technology workshop for Tech Solutions India annual team meeting', organizerName: 'Amit Sharma', organizerEmail: 'amit@techsolutions.in', organizerPhone: '+91-33-24789012', startDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 17 * 24 * 60 * 60 * 1000), expectedAttendance: 40, spaceCharge: 45000, cateringCharge: 48000, avCharge: 18000, otherCharges: 5000, totalAmount: 116000, currency: 'INR', depositAmount: 25000, depositPaid: true, status: 'confirmed', contractSignedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000) },
        { id: uuid('event-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Wedding Reception - Banerjee Family', type: 'wedding', description: 'Traditional Bengali wedding reception with 500 guests', organizerName: 'Debashis Banerjee', organizerEmail: 'debashis.b@email.com', organizerPhone: '+91-9830098765', startDate: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), expectedAttendance: 500, spaceCharge: 150000, cateringCharge: 750000, avCharge: 85000, otherCharges: 50000, totalAmount: 1035000, currency: 'INR', depositAmount: 200000, depositPaid: true, status: 'confirmed' },
        { id: uuid('event-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Rabindra Jayanti Cultural Evening', type: 'cultural', description: 'Evening of Rabindranath Tagore poetry, songs, and dance performances', organizerName: 'Royal Stay Cultural Committee', organizerEmail: 'culture@royalstay.in', organizerPhone: '+91-33-40012350', startDate: new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), expectedAttendance: 200, spaceCharge: 60000, cateringCharge: 100000, avCharge: 35000, otherCharges: 10000, totalAmount: 205000, currency: 'INR', depositAmount: 0, depositPaid: false, status: 'inquiry' },
      ],
    });
    console.log('4 events seeded!');
  } catch (e: any) {
    console.log('Events seed error:', e.message);
  }

  // ─── GDPR Requests ────────────────────────────────────────
  console.log('Seeding GDPR requests...');
  try {
    await prisma.gDPRRequest.createMany({
      data: [
        { id: uuid('gdpr-1'), tenantId: uuid('tenant-1'), guestId: uuid('guest-4'), requestType: 'export', status: 'completed', requestSource: 'guest', requesterEmail: 'pooja.s@email.com', requesterName: 'Pooja Saha', verifiedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), expiresAt: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000), completedAt: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000), completedBy: 'user-1', downloadUrl: '/api/gdpr/export/gdpr-1' },
        { id: uuid('gdpr-2'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), requestType: 'rectify', status: 'pending', requestSource: 'guest', requesterEmail: 'amit.m@email.com', requesterName: 'Amit Mukherjee', expiresAt: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000), notes: 'Guest wants to update phone number and address' },
        { id: uuid('gdpr-3'), tenantId: uuid('tenant-1'), guestId: null, requestType: 'delete', status: 'processing', requestSource: 'admin', requesterEmail: 'admin@royalstay.in', requesterName: 'Rajesh Sharma', expiresAt: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000), notes: 'Guest checked out from old property management, data cleanup requested' },
      ],
    });
    console.log('3 GDPR requests seeded!');
  } catch (e: any) {
    console.log('GDPR requests seed error:', e.message);
  }

  // ─── Consent Records ───────────────────────────────────────
  console.log('Seeding consent records...');
  try {
    await prisma.consentRecord.createMany({
      data: [
        { id: uuid('consent-1'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), consentType: 'marketing', consentCategory: 'marketing', granted: true, grantedAt: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), grantedVia: 'web', ipAddress: '192.168.1.100', consentVersion: 'v1.0' },
        { id: uuid('consent-2'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), consentType: 'analytics', consentCategory: 'analytics', granted: true, grantedAt: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), grantedVia: 'web', ipAddress: '192.168.1.100', consentVersion: 'v1.0' },
        { id: uuid('consent-3'), tenantId: uuid('tenant-1'), guestId: uuid('guest-1'), consentType: 'third_party', consentCategory: 'third_party', granted: false, grantedVia: 'web', ipAddress: '192.168.1.100', consentVersion: 'v1.0' },
        { id: uuid('consent-4'), tenantId: uuid('tenant-1'), guestId: uuid('guest-2'), consentType: 'marketing', consentCategory: 'marketing', granted: true, grantedAt: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000), grantedVia: 'email', consentVersion: 'v1.0' },
        { id: uuid('consent-5'), tenantId: uuid('tenant-1'), guestId: uuid('guest-2'), consentType: 'analytics', consentCategory: 'analytics', granted: true, grantedAt: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000), grantedVia: 'email', consentVersion: 'v1.0' },
        { id: uuid('consent-6'), tenantId: uuid('tenant-1'), guestId: uuid('guest-3'), consentType: 'marketing', consentCategory: 'marketing', granted: true, grantedAt: new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000), grantedVia: 'portal', consentVersion: 'v1.0' },
        { id: uuid('consent-7'), tenantId: uuid('tenant-1'), guestId: uuid('guest-5'), consentType: 'marketing', consentCategory: 'marketing', granted: true, grantedAt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), grantedVia: 'web', consentVersion: 'v1.0' },
        { id: uuid('consent-8'), tenantId: uuid('tenant-1'), guestId: uuid('guest-5'), consentType: 'third_party', consentCategory: 'third_party', granted: false, grantedVia: 'web', consentVersion: 'v1.0' },
        { id: uuid('consent-9'), tenantId: uuid('tenant-1'), userId: uuid('user-2'), consentType: 'essential', consentCategory: 'essential', granted: true, grantedAt: new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000), grantedVia: 'api', consentVersion: 'v1.0' },
        { id: uuid('consent-10'), tenantId: uuid('tenant-1'), guestId: uuid('guest-4'), consentType: 'marketing', consentCategory: 'marketing', granted: false, grantedVia: 'web', consentVersion: 'v1.0', revoked: true, revokedAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000), revocationReason: 'User opted out of marketing emails' },
      ],
    });
    console.log('10 consent records seeded!');
  } catch (e: any) {
    console.log('Consent records seed error:', e.message);
  }

  // ─── SSO Connections ───────────────────────────────────────
  console.log('Seeding SSO connections...');
  try {
    await prisma.sSOConnection.createMany({
      data: [
        { id: uuid('sso-1'), tenantId: uuid('tenant-1'), name: 'Corporate SSO - Google Workspace', type: 'oidc', status: 'active', oidcClientId: uuid('sso-oidc-gw'), oidcDiscoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration', oidcScopes: 'openid profile email', autoProvision: true, autoProvisionRole: 'role-3', lastSyncAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), lastSyncStatus: 'success', testConnectionAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000), testConnectionStatus: 'success' },
        { id: uuid('sso-2'), tenantId: uuid('tenant-1'), name: 'Enterprise LDAP', type: 'ldap', status: 'testing', ldapUrl: 'ldaps://ldap.royalstay.in', ldapBaseDn: 'dc=royalstay,dc=in', ldapSearchFilter: '(mail={email})', ldapUseSsl: true, autoProvision: true, lastSyncStatus: 'error', lastSyncError: 'Connection timeout', testConnectionStatus: 'failed' },
      ],
    });
    console.log('2 SSO connections seeded!');
  } catch (e: any) {
    console.log('SSO connections seed error:', e.message);
  }

  // ============================================================
  // END ADDITIONAL SEED DATA
  // ============================================================

  await seedWiFiData();

  // ─── Notifications ────────────────────────────────────────
  console.log('Seeding notifications...');
  try {
    await prisma.notification.createMany({
      data: [
        {
          id: uuid('notif-1'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          type: 'booking_alert',
          category: 'warning',
          title: 'New Booking Request',
          message: 'Guest Pooja Saha has submitted a booking request for Standard Room 101 (RS-2024-005).',
          data: JSON.stringify({ bookingId: uuid('booking-5'), guestId: uuid('guest-4') }),
          link: '/bookings/booking-5',
          priority: 'normal',
          readAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        },
        {
          id: uuid('notif-2'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          type: 'housekeeping',
          category: 'info',
          title: 'Inspection Failed - Room 102',
          message: 'Room 102 inspection failed with a score of 78. 3 items need attention including mirror stains and AC noise.',
          data: JSON.stringify({ inspectionId: 'ir-2', roomId: uuid('room-102'), score: 78 }),
          link: '/housekeeping/inspections/ir-2',
          priority: 'high',
          readAt: null,
        },
        {
          id: uuid('notif-3'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          type: 'system',
          category: 'success',
          title: 'Database Backup Complete',
          message: 'Daily automated database backup completed successfully. Backup size: 2.4 GB.',
          data: JSON.stringify({ backupId: 'bak-daily-001', size: '2.4GB' }),
          priority: 'low',
          readAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        },
        {
          id: uuid('notif-4'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          type: 'payment',
          category: 'success',
          title: 'Payment Received',
          message: 'Payment of INR 17,990 received from Amit Mukherjee for booking RS-2024-001.',
          data: JSON.stringify({ paymentId: uuid('pay-1'), bookingId: uuid('booking-1'), amount: 17990 }),
          link: '/billing/payments/pay-1',
          priority: 'normal',
          readAt: null,
        },
        {
          id: uuid('notif-5'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          type: 'crm',
          category: 'info',
          title: 'VIP Guest Arriving Today',
          message: 'Platinum-tier guest Rahul Banerjee (guest-3) is checking in today for booking RS-2024-002. Executive Suite 801.',
          data: JSON.stringify({ guestId: uuid('guest-3'), bookingId: uuid('booking-2'), loyaltyTier: 'platinum' }),
          link: '/guests/guest-3',
          priority: 'high',
          readAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });
    console.log('5 notifications seeded!');
  } catch (e: any) {
    console.log('Notifications seed note:', e.message);
  }

  // ─── Audit Logs ──────────────────────────────────────────
  console.log('Seeding audit logs...');
  try {
    await prisma.auditLog.createMany({
      data: [
        {
          id: uuid('audit-1'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          module: 'auth',
          action: 'login',
          entityType: 'User',
          entityId: uuid('user-1'),
          newValue: JSON.stringify({ email: 'admin@royalstay.in' }),
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
        {
          id: uuid('audit-2'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          module: 'bookings',
          action: 'booking_create',
          entityType: 'Booking',
          entityId: uuid('booking-1'),
          newValue: JSON.stringify({ confirmationCode: 'RS-2024-001', guestId: uuid('guest-1'), roomId: uuid('room-501') }),
          oldValue: null,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          id: uuid('audit-3'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          module: 'billing',
          action: 'payment_received',
          entityType: 'Payment',
          entityId: uuid('pay-1'),
          newValue: JSON.stringify({ amount: 17990, currency: 'INR', method: 'credit_card', status: 'completed' }),
          oldValue: null,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: uuid('audit-4'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          module: 'frontdesk',
          action: 'guest_checkin',
          entityType: 'Booking',
          entityId: uuid('booking-1'),
          newValue: JSON.stringify({ status: 'checked_in', actualCheckIn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }),
          oldValue: JSON.stringify({ status: 'confirmed' }),
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          correlationId: uuid('audit-corr-1'),
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: uuid('audit-5'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-1'),
          module: 'settings',
          action: 'settings_update',
          entityType: 'Property',
          entityId: uuid('property-1'),
          newValue: JSON.stringify({ checkInTime: '14:00', checkOutTime: '11:00' }),
          oldValue: JSON.stringify({ checkInTime: '13:00', checkOutTime: '12:00' }),
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      ],
    });
    console.log('5 audit logs seeded!');
  } catch (e: any) {
    console.log('Audit logs seed note:', e.message);
  }

  // ─── Guest Reviews ────────────────────────────────────────
  console.log('Seeding guest reviews...');
  try {
    await prisma.guestReview.createMany({
      data: [
        {
          id: uuid('review-1'),
          guestId: uuid('guest-1'),
          propertyId: uuid('property-1'),
          overallRating: 5,
          cleanlinessRating: 5,
          serviceRating: 5,
          locationRating: 4,
          valueRating: 4,
          title: 'Excellent stay at Royal Stay Kolkata',
          comment: 'The hotel exceeded all expectations. Impeccable cleanliness, attentive staff, and a prime location near Park Street. The room service was prompt and the breakfast spread was delightful. Will definitely return!',
          source: 'internal',
          sentimentScore: 0.95,
          sentimentLabel: 'positive',
        },
        {
          id: uuid('review-2'),
          guestId: uuid('guest-2'),
          propertyId: uuid('property-1'),
          overallRating: 4,
          cleanlinessRating: 4,
          serviceRating: 4,
          locationRating: 5,
          valueRating: 3,
          title: 'Great location, comfortable rooms',
          comment: 'Beautiful property in a fantastic location. The rooms were well-maintained and the staff was courteous. Only slight issue was the breakfast variety could be better. Overall a wonderful experience.',
          source: 'internal',
          sentimentScore: 0.78,
          sentimentLabel: 'positive',
        },
        {
          id: uuid('review-3'),
          guestId: uuid('guest-3'),
          propertyId: uuid('property-1'),
          overallRating: 5,
          cleanlinessRating: 5,
          serviceRating: 5,
          locationRating: 5,
          valueRating: 4,
          title: 'My favourite hotel in Kolkata',
          comment: 'As a frequent business traveller, Royal Stay Kolkata is my go-to choice. The executive lounge access is a wonderful perk. Consistent quality every single visit. The management team goes above and beyond to ensure guest satisfaction.',
          source: 'internal',
          sentimentScore: 0.92,
          sentimentLabel: 'positive',
        },
      ],
    });
    console.log('3 guest reviews seeded!');
  } catch (e: any) {
    console.log('Guest reviews seed note:', e.message);
  }

  // ─── Guest Feedback ───────────────────────────────────────
  console.log('Seeding guest feedback...');
  try {
    await prisma.guestFeedback.createMany({
      data: [
        {
          id: uuid('feedback-1'),
          guestId: uuid('guest-5'),
          propertyId: uuid('property-1'),
          type: 'complaint',
          category: 'room',
          subject: 'Noisy air conditioning unit',
          description: 'The AC in room-501 makes a rattling noise throughout the night, especially when set to high fan speed. This disturbed my sleep significantly. Requesting maintenance or a room change for my next stay.',
          priority: 'high',
          status: 'open',
        },
        {
          id: uuid('feedback-2'),
          guestId: uuid('guest-1'),
          propertyId: uuid('property-1'),
          type: 'compliment',
          category: 'service',
          subject: 'Outstanding front desk service',
          description: 'Priya at the front desk was incredibly helpful during check-in. She upgraded our room and provided excellent recommendations for local restaurants. The level of hospitality made our anniversary trip truly special.',
          priority: 'low',
          status: 'resolved',
          resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          resolvedBy: 'user-2',
          resolution: 'Thank you noted and shared with Priya. She received an employee recognition award for exceptional service.',
        },
        {
          id: uuid('feedback-3'),
          guestId: uuid('guest-6'),
          propertyId: uuid('property-1'),
          type: 'suggestion',
          category: 'amenities',
          subject: 'Add yoga mats to room amenities',
          description: 'It would be wonderful if the hotel could provide yoga mats in rooms or at least have them available on request. Many business travellers like myself maintain a daily yoga practice and this would be a great wellness amenity.',
          priority: 'medium',
          status: 'open',
        },
      ],
    });
    console.log('3 guest feedback entries seeded!');
  } catch (e: any) {
    console.log('Guest feedback seed note:', e.message);
  }

  // ─── Service Requests ─────────────────────────────────────
  console.log('Seeding service requests...');
  try {
    await prisma.serviceRequest.createMany({
      data: [
        {
          id: uuid('srvreq-1'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          guestId: uuid('guest-1'),
          bookingId: uuid('booking-1'),
          roomId: uuid('room-501'),
          type: 'housekeeping',
          category: 'amenities',
          subject: 'Extra towels requested',
          description: 'We need 2 extra bath towels and 1 extra hand towel for room-501.',
          priority: 'low',
          assignedTo: uuid('user-3'),
          assignedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          status: 'completed',
          requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          rating: 5,
          feedback: 'Very quick response, towels arrived within 15 minutes!',
          source: 'app',
        },
        {
          id: uuid('srvreq-2'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          guestId: uuid('guest-3'),
          bookingId: uuid('booking-2'),
          roomId: uuid('room-801'),
          type: 'maintenance',
          category: 'room',
          subject: 'Room maintenance - bathroom faucet dripping',
          description: 'The bathroom faucet in room-801 has a slow drip. It is keeping us awake at night. Please have maintenance look at it.',
          priority: 'high',
          assignedTo: uuid('user-2'),
          assignedAt: new Date(Date.now() - 30 * 60 * 1000),
          status: 'in_progress',
          requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          source: 'app',
        },
        {
          id: uuid('srvreq-3'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          guestId: uuid('guest-5'),
          bookingId: uuid('booking-4'),
          roomId: uuid('room-1002'),
          type: 'frontdesk',
          category: 'checkout',
          subject: 'Late checkout request',
          description: 'Would like to request a late checkout until 2:00 PM instead of 11:00 AM for our departure tomorrow.',
          priority: 'medium',
          assignedTo: uuid('user-2'),
          assignedAt: new Date(Date.now() - 15 * 60 * 1000),
          status: 'open',
          requestedAt: new Date(Date.now() - 30 * 60 * 1000),
          source: 'app',
        },
      ],
    });
    console.log('3 service requests seeded!');
  } catch (e: any) {
    console.log('Service requests seed note:', e.message);
  }

  // ============================================================
  // ADDON MODULE SEED DATA
  // ============================================================

  // Cleanup addon module data (for re-seed support)
  console.log('Cleaning remaining addon module data...');
  try {
    await prisma.staffChatMessage.deleteMany({});
    await prisma.staffChannelMember.deleteMany({});
    await prisma.staffChannel.deleteMany({});
    await prisma.guestJourney.deleteMany({});
    await prisma.guestStay.deleteMany({});
    await prisma.guestDocument.deleteMany({});
    await prisma.vehicle.deleteMany({});
    await prisma.chatMessage.deleteMany({});
    await prisma.chatConversation.deleteMany({});
    await prisma.workOrder.deleteMany({});
    await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.pricingRule.deleteMany({});
    await prisma.waitlistEntry.deleteMany({});
    await prisma.groupBooking.deleteMany({});
    await prisma.floorPlanRoom.deleteMany({});
    await prisma.floorPlan.deleteMany({});
    await prisma.competitorPrice.deleteMany({});
    await prisma.demandForecast.deleteMany({});
    await prisma.energyMetric.deleteMany({});
    await prisma.integration.deleteMany({});
    await prisma.brand.deleteMany({});
    await prisma.externalReview.deleteMany({});
    await prisma.bookingAuditLog.deleteMany({});
    await prisma.securitySettings.deleteMany({});
    await prisma.loyaltyReward.deleteMany({});
    await prisma.loyaltyTier.deleteMany({});
    await prisma.campaignSegment.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.segmentMembership.deleteMany({});
    await prisma.guestSegment.deleteMany({});
    await prisma.parkingSlot.deleteMany({});
    await prisma.eventSpace.deleteMany({});
    await prisma.channelConnection.deleteMany({});
    await prisma.securityIncident.deleteMany({});
    await prisma.webhookEndpoint.deleteMany({});
    await prisma.automationRule.deleteMany({});
    await prisma.notificationTemplate.deleteMany({});
    console.log('Addon module data cleaned.');
  } catch (e: any) {
    console.log('Addon module cleanup note:', e.message);
  }

  // ─── 1. Notification Templates ─────────────────────────────────
  console.log('Seeding notification templates...');
  try {
    await prisma.notificationTemplate.createMany({
      data: [
        {
          id: uuid('ntmpl-1'),
          tenantId: uuid('tenant-1'),
          name: 'Booking Confirmation',
          type: 'email',
          triggerEvent: 'booking_confirmed',
          subject: 'Your Booking is Confirmed — {{confirmationCode}}',
          body: '<!DOCTYPE html><html><body><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1a365d">Booking Confirmed</h1><p>Dear {{guestName}},</p><p>Your booking <strong>{{confirmationCode}}</strong> has been confirmed.</p><p><strong>Check-in:</strong> {{checkIn}}<br><strong>Check-out:</strong> {{checkOut}}<br><strong>Room:</strong> {{roomName}}<br><strong>Total:</strong> {{totalAmount}}</p><p>We look forward to welcoming you!</p><p>Best regards,<br>{{propertyName}}</p></div></body></html>',
          variables: JSON.stringify(['confirmationCode', 'guestName', 'checkIn', 'checkOut', 'roomName', 'totalAmount', 'propertyName']),
          isActive: true,
        },
        {
          id: uuid('ntmpl-2'),
          tenantId: uuid('tenant-1'),
          name: 'Check-in Reminder',
          type: 'email',
          triggerEvent: 'checkin_reminder',
          subject: 'Your Check-in is Tomorrow — {{confirmationCode}}',
          body: '<!DOCTYPE html><html><body><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#2d7d46">See You Tomorrow!</h1><p>Dear {{guestName}},</p><p>This is a friendly reminder that your check-in is tomorrow.</p><p><strong>Property:</strong> {{propertyName}}<br><strong>Address:</strong> {{propertyAddress}}<br><strong>Check-in Time:</strong> {{checkInTime}}</p><p>Please remember to bring a valid photo ID.</p><p>We can\'t wait to host you!</p></div></body></html>',
          variables: JSON.stringify(['confirmationCode', 'guestName', 'propertyName', 'propertyAddress', 'checkInTime']),
          isActive: true,
        },
        {
          id: uuid('ntmpl-3'),
          tenantId: uuid('tenant-1'),
          name: 'Check-out Thank You',
          type: 'email',
          triggerEvent: 'checkout_completed',
          subject: 'Thank You for Staying With Us!',
          body: '<!DOCTYPE html><html><body><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1a365d">Thank You, {{guestName}}!</h1><p>We hope you enjoyed your stay at <strong>{{propertyName}}</strong>.</p><p>Your check-out is complete. Booking reference: <strong>{{confirmationCode}}</strong>.</p><p>We would love to hear about your experience. If you have a moment, please leave us a review!</p><p>Safe travels and we hope to see you again soon.</p></div></body></html>',
          variables: JSON.stringify(['guestName', 'propertyName', 'confirmationCode']),
          isActive: true,
        },
        {
          id: uuid('ntmpl-4'),
          tenantId: uuid('tenant-1'),
          name: 'Review Request',
          type: 'email',
          triggerEvent: 'review_request',
          subject: 'How Was Your Stay? We\'d Love Your Feedback',
          body: '<!DOCTYPE html><html><body><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#c05621">Share Your Experience</h1><p>Dear {{guestName}},</p><p>You recently stayed at <strong>{{propertyName}}</strong>. We\'d love to hear about your experience!</p><p>Your feedback helps us improve and assists other guests in making informed decisions.</p><div style="text-align:center;margin:30px 0"><a href="{{reviewLink}}" style="background-color:#2d7d46;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:16px">Leave a Review</a></div><p>It only takes a minute and means the world to us.</p><p>Warm regards,<br>{{propertyName}} Team</p></div></body></html>',
          variables: JSON.stringify(['guestName', 'propertyName', 'reviewLink']),
          isActive: true,
        },
        {
          id: uuid('ntmpl-5'),
          tenantId: uuid('tenant-1'),
          name: 'Password Reset',
          type: 'email',
          triggerEvent: 'password_reset',
          subject: 'Reset Your Password — {{appName}}',
          body: '<!DOCTYPE html><html><body><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#c53030">Password Reset Request</h1><p>Hello,</p><p>We received a request to reset your password. Click the button below to set a new password:</p><div style="text-align:center;margin:30px 0"><a href="{{resetLink}}" style="background-color:#c53030;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:16px">Reset Password</a></div><p>This link will expire in 30 minutes. If you didn\'t request this, please ignore this email.</p><p>Stay safe,<br>{{appName}} Security Team</p></div></body></html>',
          variables: JSON.stringify(['appName', 'resetLink']),
          isActive: true,
        },
      ],
    });
    console.log('5 notification templates seeded!');
  } catch (e: any) {
    console.log('Notification templates seed error:', e.message);
  }

  // ─── 2. Automation Rules ──────────────────────────────────────
  console.log('Seeding automation rules...');
  try {
    await prisma.automationRule.createMany({
      data: [
        {
          id: uuid('arule-1'),
          tenantId: uuid('tenant-1'),
          name: 'Auto Check-in Reminder',
          description: 'Automatically sends a check-in reminder email/SMS 24 hours before guest arrival',
          triggerEvent: 'checkin_reminder',
          triggerConditions: JSON.stringify({ hoursBeforeCheckin: 24, channels: ['email', 'sms'] }),
          actions: JSON.stringify([
            { type: 'send_notification', templateId: 'ntmpl-2', channel: 'email' },
            { type: 'send_notification', templateId: 'ntmpl-2', channel: 'sms' },
          ]),
          isActive: true,
        },
        {
          id: uuid('arule-2'),
          tenantId: uuid('tenant-1'),
          name: 'Auto Review Request',
          description: 'Sends a review request email 24 hours after guest checkout',
          triggerEvent: 'review_request',
          triggerConditions: JSON.stringify({ hoursAfterCheckout: 24 }),
          actions: JSON.stringify([
            { type: 'send_notification', templateId: 'ntmpl-4', channel: 'email' },
          ]),
          isActive: true,
        },
        {
          id: uuid('arule-3'),
          tenantId: uuid('tenant-1'),
          name: 'Auto Room Status Update',
          description: 'Automatically sets room status to "cleaning" after guest checkout',
          triggerEvent: 'status_change',
          triggerConditions: JSON.stringify({ fromStatus: 'occupied', toStatus: 'cleaning', trigger: 'checkout' }),
          actions: JSON.stringify([
            { type: 'update_room_status', field: 'housekeepingStatus', value: 'cleaning' },
            { type: 'create_task', taskType: 'housekeeping', priority: 'high' },
          ]),
          isActive: true,
        },
      ],
    });
    console.log('3 automation rules seeded!');
  } catch (e: any) {
    console.log('Automation rules seed error:', e.message);
  }

  // ─── 3. Webhook Endpoints ─────────────────────────────────────
  console.log('Seeding webhook endpoints...');
  try {
    await prisma.webhookEndpoint.createMany({
      data: [
        {
          id: uuid('wh-1'),
          tenantId: uuid('tenant-1'),
          name: 'Booking Webhook',
          url: 'https://api.staysuite.com/webhooks/bookings',
          events: JSON.stringify(['booking.created', 'booking.confirmed', 'booking.cancelled', 'booking.checked_in', 'booking.checked_out']),
          secret: 'whsec_booking_abc123def456ghi789',
          isActive: true,
        },
        {
          id: uuid('wh-2'),
          tenantId: uuid('tenant-1'),
          name: 'Payment Webhook',
          url: 'https://api.staysuite.com/webhooks/payments',
          events: JSON.stringify(['payment.completed', 'payment.failed', 'payment.refunded']),
          secret: 'whsec_payment_xyz789abc456def123',
          isActive: true,
        },
      ],
    });
    console.log('2 webhook endpoints seeded!');
  } catch (e: any) {
    console.log('Webhook endpoints seed error:', e.message);
  }

  // ─── 4. Loyalty Tiers & Rewards ───────────────────────────────
  console.log('Seeding loyalty tiers...');
  try {
    await prisma.loyaltyTier.createMany({
      data: [
        {
          id: uuid('ltier-1'),
          tenantId: uuid('tenant-1'),
          name: 'bronze',
          displayName: 'Bronze Member',
          minPoints: 0,
          maxPoints: 499,
          pointsMultiplier: 1.0,
          benefits: JSON.stringify(['Basic room upgrades', 'Welcome drink on birthday']),
          color: '#cd7f32',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: uuid('ltier-2'),
          tenantId: uuid('tenant-1'),
          name: 'silver',
          displayName: 'Silver Elite',
          minPoints: 500,
          maxPoints: 1999,
          pointsMultiplier: 1.25,
          benefits: JSON.stringify(['Priority check-in', 'Late checkout (2pm)', 'Free WiFi upgrade', 'Room upgrade (subject to availability)']),
          color: '#c0c0c0',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: uuid('ltier-3'),
          tenantId: uuid('tenant-1'),
          name: 'gold',
          displayName: 'Gold Premier',
          minPoints: 2000,
          maxPoints: null,
          pointsMultiplier: 1.5,
          benefits: JSON.stringify(['Express check-in/out', 'Late checkout (4pm)', 'Suite upgrades', 'Free airport transfer', 'Complimentary breakfast', 'Dedicated concierge']),
          color: '#ffd700',
          sortOrder: 3,
          isActive: true,
        },
      ],
    });
    console.log('3 loyalty tiers seeded!');

    console.log('Seeding loyalty rewards...');
    await prisma.loyaltyReward.createMany({
      data: [
        {
          id: uuid('lreward-1'),
          tenantId: uuid('tenant-1'),
          name: 'Free Welcome Drink',
          description: 'Enjoy a complimentary welcome drink at the bar upon arrival',
          category: 'dining',
          pointsCost: 100,
          monetaryValue: 350,
          currency: 'INR',
          isAvailable: true,
          maxRedemptions: null,
          minTierRequired: null,
          sortOrder: 1,
        },
        {
          id: uuid('lreward-2'),
          tenantId: uuid('tenant-1'),
          name: 'Late Checkout',
          description: 'Extend your checkout time to 4:00 PM on your departure day',
          category: 'room',
          pointsCost: 200,
          monetaryValue: 1500,
          currency: 'INR',
          isAvailable: true,
          maxRedemptions: null,
          minTierRequired: 'silver',
          sortOrder: 2,
        },
        {
          id: uuid('lreward-3'),
          tenantId: uuid('tenant-1'),
          name: 'Free Night',
          description: 'Redeem for one free night in a Standard Room, including breakfast',
          category: 'room',
          pointsCost: 5000,
          monetaryValue: 4200,
          currency: 'INR',
          isAvailable: true,
          maxRedemptions: 2,
          minTierRequired: 'gold',
          sortOrder: 3,
        },
      ],
    });
    console.log('3 loyalty rewards seeded!');
  } catch (e: any) {
    console.log('Loyalty tiers & rewards seed error:', e.message);
  }

  // ─── 5. Campaigns ─────────────────────────────────────────────
  console.log('Seeding campaigns...');
  try {
    await prisma.campaign.createMany({
      data: [
        {
          id: uuid('campaign-1'),
          tenantId: uuid('tenant-1'),
          name: 'Summer Special',
          description: 'Summer season promotional campaign offering discounted rates and complimentary upgrades for stays during April–July. Budget: ₹50,000.',
          type: 'promotional',
          subject: '☀️ Summer Special — Save Up to 25%!',
          content: 'Dear {{guestName}},\n\nMake this summer unforgettable with our exclusive Summer Special offer!\n\nEnjoy up to 25% off on all room types when you book between April and July. Plus, get a complimentary room upgrade and free breakfast for stays of 3 nights or more.\n\nUse code SUMMER25 at checkout.\n\nBook now and create lasting memories!',
          targetSegments: JSON.stringify(['all_guests']),
          scheduledAt: new Date(),
          totalRecipients: 450,
          sentCount: 312,
          openedCount: 198,
          clickedCount: 87,
          status: 'sent',
        },
        {
          id: uuid('campaign-2'),
          tenantId: uuid('tenant-1'),
          name: 'Loyalty Bonus',
          description: 'Loyalty program promotion offering double points for bookings made in the current month. Budget: ₹25,000.',
          type: 'loyalty',
          subject: '🌟 Double Points Month — Earn 2X Rewards!',
          content: 'Dear {{guestName}},\n\nAs a valued {{tierName}} member, we\'re excited to offer you DOUBLE POINTS on all stays booked this month!\n\nThat means every ₹100 spent earns you 20 points instead of the usual 10. Stack up your points faster and unlock exclusive rewards like free nights, late checkouts, and dining vouchers.\n\nThis offer is valid for bookings made before month-end. Don\'t miss out!',
          targetSegments: JSON.stringify(['loyalty_members']),
          scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          totalRecipients: 280,
          sentCount: 0,
          openedCount: 0,
          clickedCount: 0,
          status: 'scheduled',
        },
      ],
    });
    console.log('2 campaigns seeded!');
  } catch (e: any) {
    console.log('Campaigns seed error:', e.message);
  }

  // ─── 6. Guest Segments ────────────────────────────────────────
  console.log('Seeding guest segments...');
  try {
    await prisma.guestSegment.createMany({
      data: [
        {
          id: uuid('segment-1'),
          tenantId: uuid('tenant-1'),
          name: 'Business Travelers',
          description: 'Guests who travel primarily for business purposes, typically booking weekday stays and requiring WiFi, workspace amenities.',
          rules: JSON.stringify({
            conditions: [
              { field: 'source', operator: 'in', value: ['direct', 'corporate'] },
              { field: 'preferences.purpose', operator: 'equals', value: 'business' },
            ],
            autoAssign: true,
          }),
          memberCount: 45,
        },
        {
          id: uuid('segment-2'),
          tenantId: uuid('tenant-1'),
          name: 'Leisure Guests',
          description: 'Guests traveling for vacation, leisure, or personal reasons. Often book weekend stays and family rooms.',
          rules: JSON.stringify({
            conditions: [
              { field: 'adults', operator: 'greaterThanOrEqual', value: 2 },
              { field: 'children', operator: 'greaterThan', value: 0 },
            ],
            autoAssign: true,
          }),
          memberCount: 120,
        },
        {
          id: uuid('segment-3'),
          tenantId: uuid('tenant-1'),
          name: 'VIP Guests',
          description: 'High-value guests with VIP status, loyalty tier Gold or above, or total spend exceeding ₹50,000.',
          rules: JSON.stringify({
            conditions: [
              { field: 'isVip', operator: 'equals', value: true },
              { field: 'loyaltyTier', operator: 'in', value: ['gold', 'platinum'] },
              { field: 'totalSpent', operator: 'greaterThan', value: 50000 },
            ],
            matchType: 'any',
            autoAssign: true,
          }),
          memberCount: 18,
        },
      ],
    });
    console.log('3 guest segments seeded!');
  } catch (e: any) {
    console.log('Guest segments seed error:', e.message);
  }

  // ─── 7. Staff Shifts & Attendance ─────────────────────────────
  console.log('Seeding staff shifts...');
  try {
    const shiftDate = new Date();
    shiftDate.setHours(0, 0, 0, 0);

    await prisma.staffShift.createMany({
      data: [
        {
          id: uuid('shift-1'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-2'),
          date: shiftDate,
          startTime: '06:00',
          endTime: '14:00',
          shiftType: 'regular',
          status: 'in_progress',
          clockIn: new Date(shiftDate.getTime() + 6 * 60 * 60 * 1000),
        },
        {
          id: uuid('shift-2'),
          tenantId: uuid('tenant-1'),
          userId: uuid('user-3'),
          date: shiftDate,
          startTime: '14:00',
          endTime: '22:00',
          shiftType: 'regular',
          status: 'scheduled',
        },
      ],
    });
    console.log('2 staff shifts seeded!');

    console.log('Seeding staff attendance...');
    await prisma.staffAttendance.create({
      data: {
        id: uuid('attendance-1'),
        tenantId: uuid('tenant-1'),
        userId: uuid('user-2'),
        date: shiftDate,
        status: 'present',
        checkIn: new Date(shiftDate.getTime() + 6 * 60 * 60 * 1000),
        checkOut: null,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        notes: 'On time for morning shift',
      },
    });
    console.log('1 staff attendance record seeded!');
  } catch (e: any) {
    console.log('Staff shifts & attendance seed error:', e.message);
  }

  // ─── 8. Parking Slots ─────────────────────────────────────────
  console.log('Seeding parking slots...');
  try {
    await prisma.parkingSlot.createMany({
      data: [
        {
          id: uuid('park-1'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          number: 'A1',
          floor: -1,
          type: 'standard',
          vehicleType: 'car',
          status: 'available',
          posX: 50,
          posY: 100,
        },
        {
          id: uuid('park-2'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          number: 'A2',
          floor: -1,
          type: 'standard',
          vehicleType: 'car',
          status: 'occupied',
          posX: 150,
          posY: 100,
        },
        {
          id: uuid('park-3'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          number: 'A3',
          floor: -1,
          type: 'ev_charging',
          vehicleType: 'car',
          hasCharging: true,
          chargerType: 'CCS2',
          status: 'available',
          posX: 250,
          posY: 100,
        },
        {
          id: uuid('park-4'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          number: 'A4',
          floor: -1,
          type: 'standard',
          vehicleType: 'suv',
          status: 'available',
          posX: 350,
          posY: 100,
        },
        {
          id: uuid('park-5'),
          tenantId: uuid('tenant-1'),
          propertyId: uuid('property-1'),
          number: 'A5',
          floor: -1,
          type: 'disabled',
          vehicleType: 'car',
          status: 'reserved',
          posX: 50,
          posY: 200,
        },
      ],
    });
    console.log('5 parking slots seeded!');
  } catch (e: any) {
    console.log('Parking slots seed error:', e.message);
  }

  // ─── 9. Event Spaces ──────────────────────────────────────────
  console.log('Seeding event spaces...');
  try {
    await prisma.eventSpace.createMany({
      data: [
        {
          id: uuid('espace-1'),
          propertyId: uuid('property-1'),
          name: 'Grand Ballroom',
          description: 'Elegant ballroom with crystal chandeliers, suitable for weddings, galas, and large corporate events. Features a built-in stage, premium sound system, and configurable lighting.',
          minCapacity: 100,
          maxCapacity: 500,
          sizeSqMeters: 450,
          hourlyRate: 15000,
          dailyRate: 100000,
          amenities: JSON.stringify(['stage', 'sound_system', 'projector', 'microphone', 'dance_floor', 'wifi', 'air_conditioning', 'valet_parking']),
          images: JSON.stringify([]),
          status: 'active',
        },
        {
          id: uuid('espace-2'),
          propertyId: uuid('property-1'),
          name: 'Meeting Room A',
          description: 'Modern meeting room with natural lighting, ideal for board meetings, training sessions, and presentations. Equipped with video conferencing facilities.',
          minCapacity: 10,
          maxCapacity: 40,
          sizeSqMeters: 60,
          hourlyRate: 3000,
          dailyRate: 20000,
          amenities: JSON.stringify(['projector', 'whiteboard', 'video_conferencing', 'wifi', 'air_conditioning', 'coffee_machine']),
          images: JSON.stringify([]),
          status: 'active',
        },
      ],
    });
    console.log('2 event spaces seeded!');
  } catch (e: any) {
    console.log('Event spaces seed error:', e.message);
  }

  // ─── 10. Channel Connections ──────────────────────────────────
  console.log('Seeding channel connections...');
  try {
    await prisma.channelConnection.createMany({
      data: [
        {
          id: uuid('channel-1'),
          tenantId: uuid('tenant-1'),
          channel: 'booking_com',
          displayName: 'Booking.com',
          propertyId: uuid('property-1'),
          hotelId: uuid('ch2-hotel-bcom'),
          endpointUrl: 'https://supply.connect.booking.com',
          credentials: JSON.stringify({
            username: 'royal_stay_kolkata',
            apiKey: 'bcom_key_xxxxxxxxxxxx',
          }),
          status: 'active',
          lastSyncAt: new Date(Date.now() - 30 * 60 * 1000),
          autoSync: true,
          syncInterval: 60,
        },
        {
          id: uuid('channel-2'),
          tenantId: uuid('tenant-1'),
          channel: 'airbnb',
          displayName: 'Airbnb',
          propertyId: uuid('property-1'),
          listingId: uuid('ch2-list-airbnb'),
          credentials: JSON.stringify({
            clientId: 'airbnb_client_id',
            clientSecret: 'airbnb_client_secret',
          }),
          status: 'active',
          lastSyncAt: new Date(Date.now() - 15 * 60 * 1000),
          autoSync: true,
          syncInterval: 30,
        },
      ],
    });
    console.log('2 channel connections seeded!');
  } catch (e: any) {
    console.log('Channel connections seed error:', e.message);
  }

  // ─── 11. Security Incidents ──────────────────────────────────
  console.log('Seeding security incidents...');
  try {
    await prisma.securityIncident.create({
      data: {
        id: uuid('incident-1'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        type: 'lost_key',
        severity: 'low',
        title: 'Lost Room Key — Room 501',
        description: 'Guest reported losing their room keycard. A new keycard was issued and the old keycard was deactivated in the system. No unauthorized access detected.',
        location: 'Floor 5 — Room 501 corridor',
        reportedBy: 'user-2',
        assignedTo: uuid('user-1'),
        status: 'resolved',
        resolution: 'New keycard issued. Old keycard deactivated. Security footage reviewed — no suspicious activity.',
        resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        resolvedBy: 'user-1',
        incidentDate: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
    });
    console.log('1 security incident seeded!');
  } catch (e: any) {
    console.log('Security incidents seed error:', e.message);
  }

  // ─── 12. Additional Discounts ────────────────────────────────
  console.log('Seeding additional discounts...');
  try {
    const summer25End = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    await prisma.discount.create({
      data: {
        id: uuid('discount-6'),
        tenantId: uuid('tenant-1'),
        name: 'Summer Special 25% Off',
        code: 'SUMMER25',
        type: 'percentage',
        value: 25,
        minAmount: 5000,
        maxDiscount: 15000,
        applicableTo: 'room',
        validUntil: summer25End,
        maxUses: 100,
        usedCount: 15,
        isActive: true,
      },
    });
    console.log('1 additional discount seeded (SUMMER25)!');
  } catch (e: any) {
    console.log('Additional discounts seed error:', e.message);
  }

  // ─── 13. Additional Cancellation Policy ───────────────────────
  console.log('Seeding additional cancellation policies...');
  try {
    await prisma.cancellationPolicy.create({
      data: {
        id: uuid('cp-addon-1'),
        tenantId: uuid('tenant-1'),
        name: 'Standard 48h Free Cancellation',
        description: 'Guests can cancel free of charge up to 48 hours before check-in. Cancellations within 48 hours incur a penalty equal to the first night\'s rate. No-shows are charged the full booking amount.',
        freeCancelHoursBefore: 48,
        penaltyPercent: 100,
        noShowPenaltyPercent: 100,
        penaltyType: 'first_night',
        penaltyNights: 1,
        exceptions: JSON.stringify([{ type: 'loyalty_tier', value: 'gold' }, { type: 'loyalty_tier', value: 'platinum' }]),
        isActive: true,
        sortOrder: 3,
      },
    });
    console.log('1 additional cancellation policy seeded!');
  } catch (e: any) {
    console.log('Additional cancellation policy seed error:', e.message);
  }

  // ─── 14. Additional Inspection Template ───────────────────────
  console.log('Seeding additional inspection templates...');
  try {
    await prisma.inspectionTemplate.create({
      data: {
        id: uuid('it-addon-1'),
        tenantId: uuid('tenant-1'),
        propertyId: uuid('property-1'),
        name: 'Standard Room Inspection',
        description: 'Quick turnaround inspection checklist used after standard room cleaning. Covers bed, bathroom, towels, minibar, and entertainment.',
        roomType: 'standard',
        category: 'room',
        items: JSON.stringify([
          { id: uuid('sri-1'), name: 'Bed Made', category: 'bedroom', required: true, sortOrder: 1 },
          { id: uuid('sri-2'), name: 'Bathroom Clean', category: 'bathroom', required: true, sortOrder: 2 },
          { id: uuid('sri-3'), name: 'Towels Fresh', category: 'bathroom', required: true, sortOrder: 3 },
          { id: uuid('sri-4'), name: 'Minibar Stocked', category: 'amenities', required: true, sortOrder: 4 },
          { id: uuid('sri-5'), name: 'TV Working', category: 'amenities', required: true, sortOrder: 5 },
        ]),
        isActive: true,
        sortOrder: 3,
      },
    });
    console.log('1 additional inspection template seeded!');
  } catch (e: any) {
    console.log('Additional inspection template seed error:', e.message);
  }

  console.log('Addon module seed data completed!');

  // ─── SQLite Views for WiFi Module ────────────────────────────
  // These views provide an abstraction layer between raw data and GUI queries.
  // In production with PostgreSQL, these are database views created by migration.
  // In development with SQLite, we create them here after seeding.
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    console.log('Creating SQLite views for WiFi module...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE VIEW IF NOT EXISTS v_wifi_users AS
        SELECT
          u.id, u.tenantId, u.propertyId, u.guestId, u.bookingId,
          u.username, u.planId, u.status,
          NULL as authMethod, NULL as macAddress,
          u.validFrom, u.validUntil,
          u.totalBytesIn, u.totalBytesOut, u.sessionCount,
          u.lastAccountingAt as lastSeenAt,
          u.createdAt, u.updatedAt,
          (SELECT rc.value FROM radcheck rc WHERE rc.username = u.username AND rc.attribute = 'Cleartext-Password' LIMIT 1) as radius_password,
          (SELECT rg.groupname FROM radusergroup rg WHERE rg.username = u.username LIMIT 1) as radius_group,
          g.firstName as guest_first_name, g.lastName as guest_last_name,
          g.email as guest_email, g.phone as guest_phone,
          g.loyaltyTier as guest_loyalty_tier,
          CASE WHEN g.isVip = 1 THEN 1 ELSE 0 END as guest_is_vip,
          r.number as room_number, r.name as room_name, r.floor as room_floor,
          p.name as property_name,
          wp.name as plan_name, wp.downloadSpeed as plan_download_speed,
          wp.uploadSpeed as plan_upload_speed, wp.dataLimit as plan_data_limit,
          b.confirmationCode as booking_code, b.status as booking_status,
          b.checkIn as booking_check_in, b.checkOut as booking_check_out
        FROM WiFiUser u
        LEFT JOIN Guest g ON u.guestId = g.id
        LEFT JOIN Booking b ON u.bookingId = b.id
        LEFT JOIN Room r ON b.roomId = r.id
        LEFT JOIN Property p ON u.propertyId = p.id
        LEFT JOIN WiFiPlan wp ON u.planId = wp.id
      `);
      await prisma.$executeRawUnsafe(`
        CREATE VIEW IF NOT EXISTS v_session_history AS
        SELECT
          s.id as session_id, s.id as radacctid, s.id as acctsessionid,
          s.tenantId, s.planId, s.guestId, s.bookingId,
          s.macAddress as callingstationid, s.macAddress as wifi_mac,
          s.ipAddress, s.ipAddress as framedipaddress,
          s.deviceName, s.deviceType,
          datetime(s.startTime / 1000, 'unixepoch') as acctstarttime,
          datetime(s.startTime / 1000, 'unixepoch') as acctupdatetime,
          CASE WHEN s.endTime IS NOT NULL THEN datetime(s.endTime / 1000, 'unixepoch') ELSE NULL END as acctstoptime,
          s.dataUsed as total_data_used, s.duration as acctsessiontime,
          s.dataUsed as acctinputoctets, 0 as acctoutputoctets,
          s.authMethod, s.status as session_status, s.status as wifi_user_status, s.status,
          CASE WHEN s.status = 'active' THEN 'User-Request' ELSE 'NAS-Request' END as acctterminatecause,
          datetime(s.createdAt / 1000, 'unixepoch') as createdAt,
          datetime(s.updatedAt / 1000, 'unixepoch') as updatedAt,
          COALESCE(u.username, '') as username,
          COALESCE(g.firstName, '') as guest_first_name, COALESCE(g.lastName, '') as guest_last_name,
          COALESCE(g.email, '') as guest_email, COALESCE(g.phone, '') as guest_phone,
          COALESCE(g.loyaltyTier, '') as guest_loyalty_tier,
          CASE WHEN g.isVip = 1 THEN 1 ELSE 0 END as guest_is_vip,
          COALESCE(r.number, '') as room_number, COALESCE(r.name, '') as room_name, COALESCE(r.floor, 0) as room_floor,
          COALESCE(p.name, '') as property_name,
          COALESCE(wp.name, '') as plan_name,
          wp.downloadSpeed as downloadSpeed, wp.downloadSpeed as plan_download_speed,
          wp.uploadSpeed as uploadSpeed, wp.uploadSpeed as plan_upload_speed,
          wp.dataLimit as dataLimit, wp.dataLimit as plan_data_limit,
          COALESCE(b.confirmationCode, '') as booking_code, COALESCE(b.status, '') as booking_status,
          s.id as acctuniqueid, NULL as framedipv6address,
          '0.0.0.0' as nasipaddress, '' as nasidentifier,
          NULL as nasportid, 'Wireless-802.11' as nasporttype,
          '' as calledstationid, NULL as connectinfo_start, NULL as connectinfo_stop
        FROM WiFiSession s
        LEFT JOIN WiFiUser u ON s.guestId = u.guestId
        LEFT JOIN Guest g ON s.guestId = g.id
        LEFT JOIN Booking b ON s.bookingId = b.id
        LEFT JOIN Room r ON b.roomId = r.id
        LEFT JOIN Property p ON b.propertyId = p.id
        LEFT JOIN WiFiPlan wp ON s.planId = wp.id
      `);
      await prisma.$executeRawUnsafe(`
        CREATE VIEW IF NOT EXISTS v_active_sessions AS
        SELECT * FROM v_session_history WHERE session_status = 'active'
      `);
      await prisma.$executeRawUnsafe(`
        CREATE VIEW IF NOT EXISTS v_user_usage AS
        SELECT
          u.id as user_id, u.tenantId, u.propertyId, u.guestId, u.bookingId,
          u.username, u.planId, u.status,
          u.totalBytesIn, u.totalBytesOut,
          u.totalBytesIn + u.totalBytesOut as total_data_used,
          u.sessionCount, u.lastAccountingAt as lastSeenAt,
          u.createdAt, u.updatedAt,
          COALESCE(g.firstName, '') as guest_first_name, COALESCE(g.lastName, '') as guest_last_name,
          COALESCE(g.email, '') as guest_email,
          COALESCE(g.loyaltyTier, '') as guest_loyalty_tier,
          CASE WHEN g.isVip = 1 THEN 1 ELSE 0 END as guest_is_vip,
          COALESCE(r.number, '') as room_number, COALESCE(r.name, '') as room_name,
          COALESCE(p.name, '') as property_name,
          COALESCE(wp.name, '') as plan_name,
          wp.downloadSpeed as plan_download_speed, wp.uploadSpeed as plan_upload_speed,
          wp.dataLimit as plan_data_limit,
          COALESCE(b.confirmationCode, '') as booking_code, COALESCE(b.status, '') as booking_status
        FROM WiFiUser u
        LEFT JOIN Guest g ON u.guestId = g.id
        LEFT JOIN Booking b ON u.bookingId = b.id
        LEFT JOIN Room r ON b.roomId = r.id
        LEFT JOIN Property p ON u.propertyId = p.id
        LEFT JOIN WiFiPlan wp ON u.planId = wp.id
      `);
      console.log('✅ SQLite WiFi views created (v_wifi_users, v_session_history, v_active_sessions, v_user_usage)');
    } catch (viewError: any) {
      console.log('Note: SQLite view creation skipped:', viewError.message);
    }
  }

  console.log('\n✅ Database seed completed successfully!');

  // IMPORTANT: These demo credentials should be removed or changed before deploying to production.
  // In production, use environment variables or a secure provisioning script to create accounts.
  // The seed file should only be run in development/staging environments.
  if (process.env.NODE_ENV !== 'production') {
    console.log('📍 Demo credentials (development only):');
    console.log('   Admin: admin@royalstay.in / admin123');
    console.log('   Front Desk: frontdesk@royalstay.in / staff123');
    console.log('   Housekeeping: housekeeping@royalstay.in / staff123');
    console.log('   Platform Admin: platform@staysuite.com / admin123 (can manage all tenants)');
    console.log('   Tenant 2 Admin: admin@oceanview.com / admin123');
    console.log('   Tenant 2 Front Desk: frontdesk@oceanview.com / staff123');
    console.log('   Tenant 2 Manager: manager@oceanview.com / staff123');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
