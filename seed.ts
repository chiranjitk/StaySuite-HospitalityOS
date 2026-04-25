import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Password hashing using bcrypt (production-grade)
async function seedHashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('Starting database seed...');
  
  // Nuclear cleanup: truncate all tables (PostgreSQL TRUNCATE CASCADE handles FKs)
  console.log('Cleaning all existing data...');
  try {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "Role", "Tenant", "Property", "Room", "RoomType", "Guest", "Booking", "RatePlan", "Amenity", "Vendor", "StockItem", "OrderCategory", "MenuItem", "RestaurantTable" CASCADE;');
    console.log('All tables truncated.');
  } catch (e: any) {
    // Tables may not exist yet on fresh install, that's OK
    console.log('Note: Tables may not exist yet (fresh install), continuing...');
  }

  console.log('Cleaning addon module data...');
  // All data already cleaned via raw SQL above
  
  // Create tenant 1 - Royal Stay Hotels
  console.log('Seeding tenant 1...');
  await prisma.tenant.create({
    data: {
      id: 'tenant-1',
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
      id: 'tenant-2',
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
        id: 'role-1', 
        tenantId: 'tenant-1', 
        name: 'admin', 
        displayName: 'Administrator', 
        description: 'Full system access - can do everything', 
        permissions: JSON.stringify(['*']), 
        isSystem: true 
      },
      { 
        id: 'role-2', 
        tenantId: 'tenant-1', 
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
          'frontdesk.*',
          'settings.read',
          'notifications.view',
          'inventory.view',
          'experience.view',
        ]), 
        isSystem: true 
      },
      { 
        id: 'role-3', 
        tenantId: 'tenant-1', 
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
        id: 'role-4', 
        tenantId: 'tenant-1', 
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
      tenantId: 'tenant-1',
      isActive: true,
    })),
  });

  // Create users
  console.log('Seeding users...');
  const adminPasswordHash = await seedHashPassword('admin123');
  const staffPasswordHash = await seedHashPassword('staff123');
  
  await prisma.user.createMany({
    data: [
      { id: 'user-1', tenantId: 'tenant-1', email: 'admin@royalstay.in', passwordHash: adminPasswordHash, firstName: 'Rajesh', lastName: 'Sharma', jobTitle: 'General Manager', department: 'Management', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: 'role-1' },
      { id: 'user-2', tenantId: 'tenant-1', email: 'frontdesk@royalstay.in', passwordHash: staffPasswordHash, firstName: 'Priya', lastName: 'Das', jobTitle: 'Front Desk Manager', department: 'Front Desk', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: 'role-3' },
      { id: 'user-3', tenantId: 'tenant-1', email: 'housekeeping@royalstay.in', passwordHash: staffPasswordHash, firstName: 'Anita', lastName: 'Roy', jobTitle: 'Housekeeping Supervisor', department: 'Housekeeping', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: 'role-4' },
      // Platform Admin - can manage all tenants
      { id: 'user-platform', tenantId: 'tenant-1', email: 'platform@staysuite.com', passwordHash: adminPasswordHash, firstName: 'Platform', lastName: 'Admin', jobTitle: 'Platform Administrator', department: 'Platform', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: 'role-1', isPlatformAdmin: true },
    ],
  });

  // Create roles for tenant 2
  console.log('Seeding tenant 2 roles...');
  await prisma.role.createMany({
    data: [
      {
        id: 'role-t2-1',
        tenantId: 'tenant-2',
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full system access',
        permissions: JSON.stringify(['*']),
        isSystem: true,
      },
      {
        id: 'role-t2-2',
        tenantId: 'tenant-2',
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
        id: 'role-t2-3',
        tenantId: 'tenant-2',
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
      { id: 'user-t2-1', tenantId: 'tenant-2', email: 'admin@oceanview.com', passwordHash: adminPasswordHash, firstName: 'Carlos', lastName: 'Rodriguez', jobTitle: 'General Manager', department: 'Management', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: 'role-t2-1' },
      { id: 'user-t2-2', tenantId: 'tenant-2', email: 'frontdesk@oceanview.com', passwordHash: staffPasswordHash, firstName: 'Maria', lastName: 'Gonzalez', jobTitle: 'Front Desk Agent', department: 'Front Desk', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: 'role-t2-3' },
      { id: 'user-t2-3', tenantId: 'tenant-2', email: 'manager@oceanview.com', passwordHash: staffPasswordHash, firstName: 'James', lastName: 'Wilson', jobTitle: 'Operations Manager', department: 'Operations', status: 'active', isVerified: true, verifiedAt: new Date(), roleId: 'role-t2-2' },
    ],
  });

  // Create properties - Indian Hotels
  console.log('Seeding properties...');
  await prisma.property.createMany({
    data: [
      {
        id: 'property-1',
        tenantId: 'tenant-1',
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
        id: 'property-2',
        tenantId: 'tenant-1',
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
      { id: 'roomtype-1', propertyId: 'property-1', name: 'Standard Room', code: 'STD', description: 'Comfortable room with essential amenities', maxAdults: 2, maxChildren: 1, maxOccupancy: 3, sizeSqMeters: 25, amenities: '[]', basePrice: 3500, currency: 'INR', images: '[]', sortOrder: 1, totalRooms: 40, status: 'active' },
      { id: 'roomtype-2', propertyId: 'property-1', name: 'Deluxe Room', code: 'DLX', description: 'Spacious room with city views', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, sizeSqMeters: 35, amenities: '[]', basePrice: 5500, currency: 'INR', images: '[]', sortOrder: 2, totalRooms: 35, status: 'active' },
      { id: 'roomtype-3', propertyId: 'property-1', name: 'Executive Suite', code: 'EXEC', description: 'Luxurious suite with separate living area', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, sizeSqMeters: 55, amenities: '[]', basePrice: 12000, currency: 'INR', images: '[]', sortOrder: 3, totalRooms: 25, status: 'active' },
      { id: 'roomtype-4', propertyId: 'property-1', name: 'Presidential Suite', code: 'PRES', description: 'Ultimate luxury with panoramic views', maxAdults: 4, maxChildren: 2, maxOccupancy: 6, sizeSqMeters: 120, amenities: '[]', basePrice: 35000, currency: 'INR', images: '[]', sortOrder: 4, totalRooms: 5, status: 'active' },
      { id: 'roomtype-5', propertyId: 'property-2', name: 'Mountain View Room', code: 'MTN', description: 'Cozy room with mountain views', maxAdults: 2, maxChildren: 1, maxOccupancy: 3, sizeSqMeters: 28, amenities: '[]', basePrice: 4500, currency: 'INR', images: '[]', sortOrder: 1, totalRooms: 25, status: 'active' },
      { id: 'roomtype-6', propertyId: 'property-2', name: 'Valley View Suite', code: 'VAL', description: 'Beautiful suite with valley views', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, sizeSqMeters: 45, amenities: '[]', basePrice: 8500, currency: 'INR', images: '[]', sortOrder: 2, totalRooms: 15, status: 'active' },
    ],
  });

  // Create rooms
  console.log('Seeding rooms...');
  
  const specificRooms = [
    { id: 'room-501', propertyId: 'property-1', roomTypeId: 'roomtype-2', number: '501', name: 'Deluxe Room 501', floor: 5, status: 'occupied', digitalKeyEnabled: true },
    { id: 'room-801', propertyId: 'property-1', roomTypeId: 'roomtype-3', number: '801', name: 'Executive Suite 801', floor: 8, status: 'occupied', digitalKeyEnabled: true },
    { id: 'room-510', propertyId: 'property-1', roomTypeId: 'roomtype-2', number: '510', name: 'Deluxe Room 510', floor: 5, status: 'available', digitalKeyEnabled: true },
    { id: 'room-1002', propertyId: 'property-1', roomTypeId: 'roomtype-4', number: '1002', name: 'Presidential Suite 1002', floor: 10, status: 'available', digitalKeyEnabled: true },
    { id: 'room-101', propertyId: 'property-1', roomTypeId: 'roomtype-1', number: '101', name: 'Standard Room 101', floor: 1, status: 'available', digitalKeyEnabled: true },
    { id: 'room-305', propertyId: 'property-1', roomTypeId: 'roomtype-1', number: '305', name: 'Standard Room 305', floor: 3, status: 'occupied', digitalKeyEnabled: true },
  ];
  
  await prisma.room.createMany({ data: specificRooms });
  
  // Create additional rooms
  const additionalRooms: any[] = [];
  let roomNum = 102;
  
  for (let floor = 1; floor <= 4; floor++) {
    for (let i = 0; i < 10; i++) {
      if (roomNum === 305) { roomNum++; continue; }
      additionalRooms.push({
        id: `room-${roomNum}`,
        propertyId: 'property-1',
        roomTypeId: 'roomtype-1',
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
        id: `room-${roomNum}`,
        propertyId: 'property-1',
        roomTypeId: 'roomtype-2',
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
        id: `room-${roomNum}`,
        propertyId: 'property-1',
        roomTypeId: 'roomtype-3',
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
      id: `room-${roomNum}`,
      propertyId: 'property-1',
      roomTypeId: 'roomtype-4',
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
      { id: 'guest-1', tenantId: 'tenant-1', firstName: 'Amit', lastName: 'Mukherjee', email: 'amit.m@email.com', phone: '+91-9830012345', nationality: 'India', gender: 'male', address: '45 Lake Gardens', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700045', loyaltyTier: 'gold', loyaltyPoints: 4500, totalStays: 12, totalSpent: 85000, isVip: true, source: 'direct', emailOptIn: true, kycStatus: 'verified' },
      { id: 'guest-2', tenantId: 'tenant-1', firstName: 'Sneha', lastName: 'Gupta', email: 'sneha.g@email.com', phone: '+91-9830023456', nationality: 'India', gender: 'female', address: '78 Salt Lake', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700091', loyaltyTier: 'silver', loyaltyPoints: 2200, totalStays: 5, totalSpent: 32000, isVip: false, source: 'booking_com', emailOptIn: true, kycStatus: 'verified' },
      { id: 'guest-3', tenantId: 'tenant-1', firstName: 'Rahul', lastName: 'Banerjee', email: 'rahul.b@email.com', phone: '+91-9830034567', nationality: 'India', gender: 'male', address: '12 Ballygunge Place', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700019', loyaltyTier: 'platinum', loyaltyPoints: 12500, totalStays: 25, totalSpent: 250000, isVip: true, source: 'direct', emailOptIn: true, kycStatus: 'verified' },
      { id: 'guest-4', tenantId: 'tenant-1', firstName: 'Pooja', lastName: 'Saha', email: 'pooja.s@email.com', phone: '+91-9830045678', nationality: 'India', gender: 'female', address: '23 Behala', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700034', loyaltyTier: 'bronze', loyaltyPoints: 800, totalStays: 2, totalSpent: 6000, isVip: false, source: 'airbnb', emailOptIn: false, kycStatus: 'pending' },
      { id: 'guest-5', tenantId: 'tenant-1', firstName: 'Vikram', lastName: 'Singh', email: 'vikram.s@email.com', phone: '+91-9830056789', nationality: 'India', gender: 'male', address: '56 Sector V', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700091', loyaltyTier: 'gold', loyaltyPoints: 5100, totalStays: 15, totalSpent: 92000, isVip: true, source: 'expedia', emailOptIn: true, kycStatus: 'verified' },
      { id: 'guest-6', tenantId: 'tenant-1', firstName: 'Rina', lastName: 'Chatterjee', email: 'rina.c@email.com', phone: '+91-9830067890', nationality: 'India', gender: 'female', address: '89 Gariahat', city: 'Kolkata', state: 'West Bengal', country: 'India', postalCode: '700019', loyaltyTier: 'silver', loyaltyPoints: 1800, totalStays: 4, totalSpent: 24000, isVip: false, source: 'direct', emailOptIn: true, kycStatus: 'verified' },
    ],
  });

  // Create bookings with INR
  console.log('Seeding bookings...');
  const today = new Date();
  
  await prisma.booking.createMany({
    data: [
      {
        id: 'booking-1',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        confirmationCode: 'RS-2024-001',
        primaryGuestId: 'guest-1',
        roomId: 'room-501',
        roomTypeId: 'roomtype-2',
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
        id: 'booking-2',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        confirmationCode: 'RS-2024-002',
        primaryGuestId: 'guest-3',
        roomId: 'room-801',
        roomTypeId: 'roomtype-3',
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
        id: 'booking-3',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        confirmationCode: 'RS-2024-003',
        primaryGuestId: 'guest-2',
        roomId: 'room-510',
        roomTypeId: 'roomtype-2',
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
        id: 'booking-4',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        confirmationCode: 'RS-2024-004',
        primaryGuestId: 'guest-5',
        roomId: 'room-1002',
        roomTypeId: 'roomtype-4',
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
        id: 'booking-5',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        confirmationCode: 'RS-2024-005',
        primaryGuestId: 'guest-4',
        roomId: 'room-101',
        roomTypeId: 'roomtype-1',
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
        id: 'booking-6',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        confirmationCode: 'RS-2024-006',
        primaryGuestId: 'guest-6',
        roomId: 'room-305',
        roomTypeId: 'roomtype-1',
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
      { id: 'rateplan-1', tenantId: 'tenant-1', roomTypeId: 'roomtype-1', name: 'Best Available Rate', code: 'BAR', description: 'Flexible rate with free cancellation', basePrice: 3500, currency: 'INR', mealPlan: 'room_only', minStay: 1, cancellationPolicy: 'moderate', status: 'active' },
      { id: 'rateplan-2', tenantId: 'tenant-1', roomTypeId: 'roomtype-1', name: 'Non-Refundable', code: 'NRF', description: 'Discounted non-refundable rate', basePrice: 2975, currency: 'INR', mealPlan: 'room_only', minStay: 1, cancellationPolicy: 'non_refundable', status: 'active' },
      { id: 'rateplan-3', tenantId: 'tenant-1', roomTypeId: 'roomtype-1', name: 'Bed & Breakfast', code: 'BB', description: 'Room with daily breakfast', basePrice: 4200, currency: 'INR', mealPlan: 'breakfast', minStay: 1, cancellationPolicy: 'moderate', status: 'active' },
      { id: 'rateplan-4', tenantId: 'tenant-1', roomTypeId: 'roomtype-2', name: 'Best Available Rate', code: 'BAR', description: 'Flexible rate', basePrice: 5500, currency: 'INR', mealPlan: 'room_only', minStay: 1, cancellationPolicy: 'moderate', status: 'active' },
      { id: 'rateplan-5', tenantId: 'tenant-1', roomTypeId: 'roomtype-2', name: 'Non-Refundable', code: 'NRF', description: 'Discounted rate', basePrice: 4675, currency: 'INR', mealPlan: 'room_only', minStay: 2, cancellationPolicy: 'non_refundable', status: 'active' },
      { id: 'rateplan-6', tenantId: 'tenant-1', roomTypeId: 'roomtype-3', name: 'Best Available Rate', code: 'BAR', description: 'Flexible rate with lounge access', basePrice: 12000, currency: 'INR', mealPlan: 'room_only', minStay: 2, cancellationPolicy: 'flexible', status: 'active' },
      { id: 'rateplan-7', tenantId: 'tenant-1', roomTypeId: 'roomtype-4', name: 'Presidential Package', code: 'PRES', description: 'All-inclusive luxury experience', basePrice: 35000, currency: 'INR', mealPlan: 'full_board', minStay: 2, cancellationPolicy: 'flexible', status: 'active' },
    ],
  });

  // Create WiFi plans with INR
  console.log('Seeding WiFi plans...');
  await prisma.wiFiPlan.createMany({
    data: [
      { id: 'wifiplan-1', tenantId: 'tenant-1', name: 'Basic', description: 'Standard WiFi for browsing', downloadSpeed: 10, uploadSpeed: 5, dataLimit: 500, price: 0, currency: 'INR', priority: 1, validityDays: 1, status: 'active' },
      { id: 'wifiplan-2', tenantId: 'tenant-1', name: 'Premium', description: 'High-speed WiFi for streaming', downloadSpeed: 50, uploadSpeed: 25, dataLimit: null, price: 199, currency: 'INR', priority: 2, validityDays: 1, status: 'active' },
      { id: 'wifiplan-3', tenantId: 'tenant-1', name: 'Business', description: 'Ultra-fast WiFi for video calls', downloadSpeed: 100, uploadSpeed: 50, dataLimit: null, price: 399, currency: 'INR', priority: 3, validityDays: 1, status: 'active' },
    ],
  });

  // Create vendors
  console.log('Seeding vendors...');
  await prisma.vendor.createMany({
    data: [
      { id: 'vendor-1', tenantId: 'tenant-1', name: 'Premium Linen Supply', contactPerson: 'Rajesh Kumar', email: 'rajesh@premiumlinen.in', phone: '+91-33-24567890', type: 'supplier', paymentTerms: 'Net 30', status: 'active' },
      { id: 'vendor-2', tenantId: 'tenant-1', name: 'CleanPro Services', contactPerson: 'Suman Roy', email: 'suman@cleanpro.in', phone: '+91-33-24678901', type: 'contractor', paymentTerms: 'Net 15', status: 'active' },
      { id: 'vendor-3', tenantId: 'tenant-1', name: 'Tech Solutions India', contactPerson: 'Amit Sharma', email: 'amit@techsolutions.in', phone: '+91-33-24789012', type: 'service', paymentTerms: 'Net 45', status: 'active' },
    ],
  });

  // Create stock items
  console.log('Seeding stock items...');
  await prisma.stockItem.createMany({
    data: [
      { id: 'stock-1', tenantId: 'tenant-1', name: 'Bath Towels', sku: 'TOWEL-BATH', category: 'Linens', unit: 'piece', unitCost: 250, quantity: 200, minQuantity: 50, maxQuantity: 500, reorderPoint: 100, location: 'Main Storage', status: 'active' },
      { id: 'stock-2', tenantId: 'tenant-1', name: 'Hand Towels', sku: 'TOWEL-HAND', category: 'Linens', unit: 'piece', unitCost: 150, quantity: 300, minQuantity: 75, maxQuantity: 600, reorderPoint: 150, location: 'Main Storage', status: 'active' },
      { id: 'stock-3', tenantId: 'tenant-1', name: 'Shampoo Bottles', sku: 'AMEN-SHAM', category: 'Amenities', unit: 'piece', unitCost: 35, quantity: 500, minQuantity: 100, maxQuantity: 1000, reorderPoint: 200, location: 'Amenities Storage', status: 'active' },
      { id: 'stock-4', tenantId: 'tenant-1', name: 'Conditioner Bottles', sku: 'AMEN-COND', category: 'Amenities', unit: 'piece', unitCost: 35, quantity: 500, minQuantity: 100, maxQuantity: 1000, reorderPoint: 200, location: 'Amenities Storage', status: 'active' },
      { id: 'stock-5', tenantId: 'tenant-1', name: 'Toilet Paper', sku: 'PAPER-TP', category: 'Consumables', unit: 'roll', unitCost: 15, quantity: 1000, minQuantity: 200, maxQuantity: 2000, reorderPoint: 400, location: 'Main Storage', status: 'active' },
      { id: 'stock-6', tenantId: 'tenant-1', name: 'Hand Soap', sku: 'AMEN-SOAP', category: 'Amenities', unit: 'bottle', unitCost: 25, quantity: 150, minQuantity: 50, maxQuantity: 300, reorderPoint: 100, location: 'Amenities Storage', status: 'active' },
    ],
  });

  // Create Order Categories
  console.log('Seeding order categories...');
  await prisma.orderCategory.createMany({
    data: [
      { id: 'cat-1', propertyId: 'property-1', name: 'Starters', description: 'Appetizers and starters', sortOrder: 1, status: 'active' },
      { id: 'cat-2', propertyId: 'property-1', name: 'Main Course', description: 'Main dishes', sortOrder: 2, status: 'active' },
      { id: 'cat-3', propertyId: 'property-1', name: 'Desserts', description: 'Sweet treats', sortOrder: 3, status: 'active' },
      { id: 'cat-4', propertyId: 'property-1', name: 'Beverages', description: 'Drinks and refreshments', sortOrder: 4, status: 'active' },
      { id: 'cat-5', propertyId: 'property-1', name: 'Indian Specials', description: 'Authentic Indian cuisine', sortOrder: 5, status: 'active' },
    ],
  });

  // Create Menu Items with INR prices
  console.log('Seeding menu items...');
  await prisma.menuItem.createMany({
    data: [
      // Starters
      { id: 'menu-1', propertyId: 'property-1', categoryId: 'cat-1', name: 'Samosa', description: 'Crispy pastry filled with spiced potatoes', price: 120, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 10, kitchenStation: 'fryer', sortOrder: 1, status: 'active' },
      { id: 'menu-2', propertyId: 'property-1', categoryId: 'cat-1', name: 'Paneer Tikka', description: 'Grilled cottage cheese with spices', price: 280, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 15, kitchenStation: 'tandoor', sortOrder: 2, status: 'active' },
      { id: 'menu-3', propertyId: 'property-1', categoryId: 'cat-1', name: 'Chicken Tikka', description: 'Tender chicken marinated in yogurt and spices', price: 320, currency: 'INR', isAvailable: true, preparationTime: 18, kitchenStation: 'tandoor', sortOrder: 3, status: 'active' },
      { id: 'menu-4', propertyId: 'property-1', categoryId: 'cat-1', name: 'Vegetable Spring Roll', description: 'Crispy rolls with mixed vegetables', price: 180, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 12, kitchenStation: 'fryer', sortOrder: 4, status: 'active' },
      // Main Course
      { id: 'menu-5', propertyId: 'property-1', categoryId: 'cat-2', name: 'Butter Chicken', description: 'Creamy tomato-based curry with tender chicken', price: 420, currency: 'INR', isAvailable: true, preparationTime: 20, kitchenStation: 'curry', sortOrder: 1, status: 'active' },
      { id: 'menu-6', propertyId: 'property-1', categoryId: 'cat-2', name: 'Dal Makhani', description: 'Creamy black lentils slow-cooked overnight', price: 280, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 15, kitchenStation: 'curry', sortOrder: 2, status: 'active' },
      { id: 'menu-7', propertyId: 'property-1', categoryId: 'cat-2', name: 'Fish Curry', description: 'Bengali style fish curry with rohu', price: 480, currency: 'INR', isAvailable: true, preparationTime: 22, kitchenStation: 'curry', sortOrder: 3, status: 'active' },
      { id: 'menu-8', propertyId: 'property-1', categoryId: 'cat-2', name: 'Vegetable Biryani', description: 'Fragrant basmati rice with mixed vegetables', price: 320, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 25, kitchenStation: 'rice', sortOrder: 4, status: 'active' },
      // Desserts
      { id: 'menu-9', propertyId: 'property-1', categoryId: 'cat-3', name: 'Rasgulla', description: 'Soft cottage cheese balls in sugar syrup', price: 120, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 5, kitchenStation: 'dessert', sortOrder: 1, status: 'active' },
      { id: 'menu-10', propertyId: 'property-1', categoryId: 'cat-3', name: 'Gulab Jamun', description: 'Deep-fried milk dumplings in rose syrup', price: 150, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 10, kitchenStation: 'dessert', sortOrder: 2, status: 'active' },
      { id: 'menu-11', propertyId: 'property-1', categoryId: 'cat-3', name: 'Mishti Doi', description: 'Traditional Bengali sweet yogurt', price: 100, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 5, kitchenStation: 'dessert', sortOrder: 3, status: 'active' },
      // Beverages
      { id: 'menu-12', propertyId: 'property-1', categoryId: 'cat-4', name: 'Masala Chai', description: 'Traditional Indian spiced tea', price: 60, currency: 'INR', isVegan: true, isAvailable: true, preparationTime: 5, kitchenStation: 'bar', sortOrder: 1, status: 'active' },
      { id: 'menu-13', propertyId: 'property-1', categoryId: 'cat-4', name: 'Fresh Lime Soda', description: 'Refreshing lime with soda', price: 80, currency: 'INR', isVegan: true, isAvailable: true, preparationTime: 3, kitchenStation: 'bar', sortOrder: 2, status: 'active' },
      { id: 'menu-14', propertyId: 'property-1', categoryId: 'cat-4', name: 'Mango Lassi', description: 'Creamy yogurt drink with mango', price: 120, currency: 'INR', isVegetarian: true, isAvailable: true, preparationTime: 5, kitchenStation: 'bar', sortOrder: 3, status: 'active' },
    ],
  });

  // Create Restaurant Tables
  console.log('Seeding restaurant tables...');
  await prisma.restaurantTable.createMany({
    data: [
      { id: 'table-1', propertyId: 'property-1', number: 'T1', name: 'Window Seat', capacity: 2, area: 'indoor', floor: 1, status: 'available' },
      { id: 'table-2', propertyId: 'property-1', number: 'T2', name: 'Window Seat', capacity: 2, area: 'indoor', floor: 1, status: 'occupied' },
      { id: 'table-3', propertyId: 'property-1', number: 'T3', capacity: 4, area: 'indoor', floor: 1, status: 'available' },
      { id: 'table-4', propertyId: 'property-1', number: 'T4', capacity: 4, area: 'indoor', floor: 1, status: 'reserved' },
      { id: 'table-5', propertyId: 'property-1', number: 'T5', capacity: 6, area: 'indoor', floor: 1, status: 'available' },
      { id: 'table-6', propertyId: 'property-1', number: 'T6', capacity: 4, area: 'patio', floor: 1, status: 'available' },
      { id: 'table-7', propertyId: 'property-1', number: 'T7', capacity: 4, area: 'patio', floor: 1, status: 'occupied' },
      { id: 'table-8', propertyId: 'property-1', number: 'T8', capacity: 8, area: 'vip', floor: 2, name: 'VIP Room', status: 'available' },
      { id: 'table-9', propertyId: 'property-1', number: 'T9', capacity: 6, area: 'bar', floor: 1, status: 'cleaning' },
      { id: 'table-10', propertyId: 'property-1', number: 'T10', capacity: 2, area: 'bar', floor: 1, status: 'available' },
    ],
  });

  // Create Orders with INR
  console.log('Seeding orders...');
  await prisma.order.createMany({
    data: [
      {
        id: 'order-1',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        tableId: 'table-2',
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
        id: 'order-2',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        tableId: 'table-7',
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
        id: 'order-3',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        orderNumber: 'ORD-003',
        orderType: 'room_service',
        guestName: 'Sneha Gupta',
        guestId: 'guest-2',
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
        id: 'order-4',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
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
      { id: 'orderitem-1', orderId: 'order-1', menuItemId: 'menu-5', quantity: 1, unitPrice: 420, totalAmount: 420, status: 'preparing' },
      { id: 'orderitem-2', orderId: 'order-1', menuItemId: 'menu-12', quantity: 2, unitPrice: 60, totalAmount: 120, status: 'preparing' },
      { id: 'orderitem-3', orderId: 'order-1', menuItemId: 'menu-14', quantity: 1, unitPrice: 120, totalAmount: 120, status: 'preparing' },
      // Order 2 items
      { id: 'orderitem-4', orderId: 'order-2', menuItemId: 'menu-7', quantity: 1, unitPrice: 480, totalAmount: 480, status: 'pending' },
      { id: 'orderitem-5', orderId: 'order-2', menuItemId: 'menu-1', quantity: 2, unitPrice: 120, totalAmount: 240, status: 'pending' },
      { id: 'orderitem-6', orderId: 'order-2', menuItemId: 'menu-10', quantity: 2, unitPrice: 150, totalAmount: 300, status: 'pending' },
      { id: 'orderitem-7', orderId: 'order-2', menuItemId: 'menu-13', quantity: 2, unitPrice: 80, totalAmount: 160, status: 'pending' },
      // Order 3 items
      { id: 'orderitem-8', orderId: 'order-3', menuItemId: 'menu-8', quantity: 1, unitPrice: 320, totalAmount: 320, status: 'ready' },
      { id: 'orderitem-9', orderId: 'order-3', menuItemId: 'menu-4', quantity: 1, unitPrice: 180, totalAmount: 180, status: 'ready' },
      { id: 'orderitem-10', orderId: 'order-3', menuItemId: 'menu-12', quantity: 1, unitPrice: 60, totalAmount: 60, status: 'ready' },
      // Order 4 items
      { id: 'orderitem-11', orderId: 'order-4', menuItemId: 'menu-6', quantity: 1, unitPrice: 280, totalAmount: 280, status: 'served' },
      { id: 'orderitem-12', orderId: 'order-4', menuItemId: 'menu-13', quantity: 1, unitPrice: 80, totalAmount: 80, status: 'served' },
    ],
  });

  // === HOUSEKEEPING SEED DATA ===
  console.log('Seeding housekeeping tasks...');

  // Housekeeping Tasks for Tenant 1
  await prisma.task.createMany({
    data: [
      // Today's cleaning tasks
      {
        id: 'task-hk-1',
        tenantId: 'tenant-1', propertyId: 'property-1',
        roomId: 'room-101', assignedTo: 'user-3',
        type: 'cleaning', category: 'checkout',
        title: 'Checkout Clean - Room 101',
        description: 'Full checkout cleaning including bathroom deep clean, linen change, restock amenities',
        priority: 'high', status: 'pending',
        scheduledAt: new Date(), estimatedDuration: 45,
        roomStatusBefore: 'occupied', roomStatusAfter: 'available',
        createdBy: 'user-2',
      },
      {
        id: 'task-hk-2',
        tenantId: 'tenant-1', propertyId: 'property-1',
        roomId: 'room-102', assignedTo: 'user-3',
        type: 'cleaning', category: 'stayover',
        title: 'Stayover Service - Room 102',
        description: 'Daily stayover service: fresh towels, empty bins, restock, make bed',
        priority: 'medium', status: 'in_progress',
        scheduledAt: new Date(), startedAt: new Date(Date.now() - 15 * 60000),
        estimatedDuration: 20,
        createdBy: 'user-2',
      },
      {
        id: 'task-hk-3',
        tenantId: 'tenant-1', propertyId: 'property-1',
        roomId: 'room-305', assignedTo: 'user-3',
        type: 'cleaning', category: 'checkout',
        title: 'Checkout Clean - Room 305',
        description: 'VIP checkout - extra attention to detail, welcome amenities restocked',
        priority: 'urgent', status: 'pending',
        scheduledAt: new Date(), estimatedDuration: 60,
        roomStatusBefore: 'occupied', roomStatusAfter: 'available',
        createdBy: 'user-1',
      },
      {
        id: 'task-hk-4',
        tenantId: 'tenant-1', propertyId: 'property-1',
        type: 'inspection', category: 'quality_check',
        title: 'Floor 3 Room Inspection',
        description: 'Inspect all rooms on floor 3 after morning cleaning',
        priority: 'medium', status: 'pending',
        scheduledAt: new Date(Date.now() + 2 * 3600000), estimatedDuration: 30,
        createdBy: 'user-1',
      },
      {
        id: 'task-hk-5',
        tenantId: 'tenant-1', propertyId: 'property-1',
        roomId: 'room-103',
        type: 'maintenance', category: 'repair',
        title: 'Fix leaking faucet - Room 103',
        description: 'Bathroom faucet dripping, needs washer replacement',
        priority: 'high', status: 'pending',
        scheduledAt: new Date(Date.now() + 30 * 60000), estimatedDuration: 30,
        createdBy: 'user-3',
      },
      {
        id: 'task-hk-6',
        tenantId: 'tenant-1', propertyId: 'property-1',
        roomId: 'room-104', assignedTo: 'user-3',
        type: 'deep_clean', category: 'deep_clean',
        title: 'Deep Clean - Room 104',
        description: 'Monthly deep clean: carpet shampoo, window cleaning, behind furniture',
        priority: 'low', status: 'completed',
        scheduledAt: new Date(Date.now() - 24 * 3600000),
        completedAt: new Date(Date.now() - 20 * 3600000),
        estimatedDuration: 120, actualDuration: 105,
        createdBy: 'user-2',
        completionNotes: 'Carpet shampooed, windows cleaned, all furniture moved and vacuumed behind',
        qualityScore: 5,
      },
      {
        id: 'task-hk-7',
        tenantId: 'tenant-1', propertyId: 'property-1',
        type: 'public_area', category: 'lobby',
        title: 'Lobby and Reception Area Cleaning',
        description: 'Vacuum, dust all surfaces, clean entrance glass, restock brochures',
        priority: 'medium', status: 'completed',
        scheduledAt: new Date(Date.now() - 3 * 3600000),
        completedAt: new Date(Date.now() - 2 * 3600000),
        estimatedDuration: 45, actualDuration: 40,
        assignedTo: 'user-3', createdBy: 'user-2',
      },
      {
        id: 'task-hk-8',
        tenantId: 'tenant-1', propertyId: 'property-1',
        roomId: 'room-501', assignedTo: 'user-3',
        type: 'cleaning', category: 'stayover',
        title: 'Stayover Service - Room 501 (VIP)',
        description: 'VIP guest - use premium amenities, extra towel set',
        priority: 'high', status: 'in_progress',
        scheduledAt: new Date(), startedAt: new Date(Date.now() - 5 * 60000),
        estimatedDuration: 25, createdBy: 'user-1',
      },
    ],
  });

  console.log('Seeding staff skills...');
  await prisma.staffSkill.createMany({
    data: [
      { id: 'skill-1', tenantId: 'tenant-1', userId: 'user-3', skillName: 'Room Cleaning', skillLevel: 5, category: 'cleaning', certified: true, certifiedAt: new Date() },
      { id: 'skill-2', tenantId: 'tenant-1', userId: 'user-3', skillName: 'Deep Cleaning', skillLevel: 4, category: 'cleaning', certified: true, certifiedAt: new Date() },
      { id: 'skill-3', tenantId: 'tenant-1', userId: 'user-3', skillName: 'Quality Inspection', skillLevel: 3, category: 'inspection', certified: false },
      { id: 'skill-4', tenantId: 'tenant-1', userId: 'user-3', skillName: 'Laundry', skillLevel: 4, category: 'cleaning', certified: false },
      { id: 'skill-5', tenantId: 'tenant-1', userId: 'user-3', skillName: 'Public Area', skillLevel: 3, category: 'cleaning', certified: false },
      { id: 'skill-6', tenantId: 'tenant-1', userId: 'user-3', skillName: 'Chemical Handling', skillLevel: 3, category: 'maintenance', certified: true, certifiedAt: new Date() },
    ],
  });

  console.log('Seeding assets...');
  await prisma.asset.createMany({
    data: [
      { id: 'asset-1', tenantId: 'tenant-1', propertyId: 'property-1', name: 'Industrial Vacuum Cleaner', category: 'cleaning_equipment', description: 'Commercial grade vacuum for corridors', location: 'Storage Room B1', purchasePrice: 25000, purchaseDate: new Date('2024-01-15'), currentValue: 22000, warrantyExpiry: new Date('2026-01-15'), warrantyProvider: 'CleanMax India', maintenanceIntervalDays: 90, nextMaintenanceAt: new Date(Date.now() + 15 * 86400000), status: 'active', serialNumber: 'VC-2024-001', manufacturer: 'CleanMax', conditionScore: 8 },
      { id: 'asset-2', tenantId: 'tenant-1', propertyId: 'property-1', name: 'Floor Buffer/Polisher', category: 'cleaning_equipment', description: 'Heavy duty floor buffer for lobby and restaurant', location: 'Storage Room B1', purchasePrice: 45000, purchaseDate: new Date('2023-06-01'), currentValue: 38000, maintenanceIntervalDays: 60, status: 'active', serialNumber: 'FB-2023-001', manufacturer: 'FloorTech', conditionScore: 7 },
      { id: 'asset-3', tenantId: 'tenant-1', propertyId: 'property-1', name: 'HVAC Unit - Main Building', category: 'hvac', description: 'Central AC unit serving floors 1-4', purchasePrice: 500000, maintenanceIntervalDays: 180, status: 'active', manufacturer: 'Carrier', conditionScore: 9 },
      { id: 'asset-4', tenantId: 'tenant-1', propertyId: 'property-1', name: 'Linen Cart Set', category: 'furniture', description: 'Set of 5 rolling linen carts', purchasePrice: 35000, purchaseDate: new Date('2024-03-10'), status: 'active', conditionScore: 6 },
      { id: 'asset-5', tenantId: 'tenant-1', propertyId: 'property-1', name: 'Guest Laundry Machines', category: 'laundry', description: '2 commercial washers + 2 dryers', location: 'Laundry Room B2', purchasePrice: 180000, maintenanceIntervalDays: 90, nextMaintenanceAt: new Date(Date.now() - 5 * 86400000), status: 'maintenance', manufacturer: 'Electrolux', conditionScore: 5 },
    ],
  });

  console.log('Seeding preventive maintenance...');
  await prisma.preventiveMaintenance.createMany({
    data: [
      { id: 'pm-1', tenantId: 'tenant-1', propertyId: 'property-1', title: 'HVAC Filter Replacement', description: 'Replace air filters in all HVAC units', assetId: 'asset-3', frequency: 'quarterly', assignedRoleId: 'role-4', checklist: JSON.stringify(['Turn off HVAC unit', 'Remove old filters', 'Install new filters', 'Check airflow', 'Turn on and verify', 'Log completion']), lastCompletedAt: new Date(Date.now() - 60 * 86400000), nextDueAt: new Date(Date.now() + 30 * 86400000), status: 'active', estimatedDuration: 120, priority: 'high' },
      { id: 'pm-2', tenantId: 'tenant-1', propertyId: 'property-1', title: 'Fire Extinguisher Inspection', description: 'Monthly visual inspection of all fire extinguishers', frequency: 'monthly', checklist: JSON.stringify(['Check pressure gauge', 'Check safety pin', 'Check expiration date', 'Check visible damage', 'Log serial numbers']), lastCompletedAt: new Date(Date.now() - 15 * 86400000), nextDueAt: new Date(Date.now() + 15 * 86400000), status: 'active', estimatedDuration: 60 },
      { id: 'pm-3', tenantId: 'tenant-1', propertyId: 'property-1', title: 'Elevator Maintenance', description: 'Quarterly elevator servicing and safety check', frequency: 'quarterly', priority: 'high', checklist: JSON.stringify(['Check door sensors', 'Test emergency button', 'Check cable tension', 'Lubricate rails', 'Test leveling', 'Verify weight limit display']), lastCompletedAt: new Date(Date.now() - 90 * 86400000), nextDueAt: new Date(Date.now() - 5 * 86400000), status: 'active', estimatedDuration: 180 },
      { id: 'pm-4', tenantId: 'tenant-1', propertyId: 'property-1', title: 'Deep Clean Kitchen Extractor Hood', description: 'Monthly professional cleaning of kitchen ventilation', frequency: 'monthly', estimatedCost: 5000, priority: 'medium' },
    ],
  });

  console.log('Seeding staff workload...');
  const hkToday = new Date();
  hkToday.setHours(0, 0, 0, 0);
  await prisma.staffWorkload.createMany({
    data: [
      { id: 'wl-1', tenantId: 'tenant-1', userId: 'user-3', propertyId: 'property-1', date: hkToday, totalTasks: 6, completedTasks: 2, totalMinutes: 245, workedMinutes: 60, capacityMinutes: 480, efficiency: 0.85 },
    ],
  });

  // Update room housekeeping statuses based on tasks
  console.log('Updating room housekeeping statuses...');
  await prisma.room.updateMany({ where: { id: 'room-101' }, data: { housekeepingStatus: 'dirty', status: 'occupied' } });
  await prisma.room.updateMany({ where: { id: 'room-102' }, data: { housekeepingStatus: 'cleaning' } });
  await prisma.room.updateMany({ where: { id: 'room-305' }, data: { housekeepingStatus: 'dirty', hkPriority: 'vip' } });
  await prisma.room.updateMany({ where: { id: 'room-103' }, data: { housekeepingStatus: 'clean' } });
  await prisma.room.updateMany({ where: { id: 'room-501' }, data: { housekeepingStatus: 'cleaning', hkPriority: 'high' } });

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
      { id: 'discount-1', tenantId: 'tenant-1', name: 'Summer Sale 20% Off', code: 'SUMMER20', type: 'percentage', value: 20, minAmount: 5000, maxDiscount: 10000, applicableTo: 'room', validUntil: summerEnd, maxUses: 200, usedCount: 47, isActive: true },
      { id: 'discount-2', tenantId: 'tenant-1', name: 'Welcome 10% Off', code: 'WELCOME10', type: 'percentage', value: 10, minAmount: 0, applicableTo: 'all', validUntil: welcomeEnd, maxUses: 500, usedCount: 123, isActive: true },
      { id: 'discount-3', tenantId: 'tenant-1', name: 'Early Bird 15% Off', code: 'EARLYBIRD', type: 'percentage', value: 15, minAmount: 3000, maxDiscount: 7500, applicableTo: 'room', validUntil: earlyBirdEnd, maxUses: 100, usedCount: 28, isActive: true },
      { id: 'discount-4', tenantId: 'tenant-1', name: 'Flat $50 Off', code: 'FIXED50', type: 'fixed_amount', value: 50, minAmount: 10000, maxDiscount: 50, applicableTo: 'all', validUntil: fixed50End, maxUses: 150, usedCount: 35, isActive: true },
      { id: 'discount-5', tenantId: 'tenant-1', name: 'Complimentary Stay', code: 'COMP_STAY', type: 'complimentary', value: 100, minAmount: 0, applicableTo: 'room', validUntil: compEnd, maxUses: 10, usedCount: 2, isActive: true },
    ],
  });

  // ─── Billing & Finance Seed Data ───────────────────────────────────────────
  console.log('Seeding folios, line items, payments, and invoices...');

  const todaySeed = new Date();

  // Folios for all 6 bookings
  const folios = [
    // booking-1: checked_in, 3 nights, roomRate=5500
    { id: 'folio-1', tenantId: 'tenant-1', propertyId: 'property-1', bookingId: 'booking-1', folioNumber: 'FOL-KOL-0001', guestId: 'guest-1', subtotal: 16500, taxes: 2970, discount: 0, totalAmount: 20970, paidAmount: 10000, balance: 10970, currency: 'INR', status: 'partially_paid', openedAt: new Date(todaySeed.getTime() - 2 * 24 * 60 * 60 * 1000) },
    // booking-2: checked_in, 4 nights, roomRate=12000
    { id: 'folio-2', tenantId: 'tenant-1', propertyId: 'property-1', bookingId: 'booking-2', folioNumber: 'FOL-KOL-0002', guestId: 'guest-3', subtotal: 48000, taxes: 8640, discount: 2000, totalAmount: 58640, paidAmount: 58640, balance: 0, currency: 'INR', status: 'paid', openedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), closedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000) },
    // booking-3: confirmed, 4 nights, roomRate=5500
    { id: 'folio-3', tenantId: 'tenant-1', propertyId: 'property-1', bookingId: 'booking-3', folioNumber: 'FOL-KOL-0003', guestId: 'guest-2', subtotal: 22000, taxes: 3960, discount: 0, totalAmount: 27960, paidAmount: 0, balance: 27960, currency: 'INR', status: 'open', openedAt: new Date() },
    // booking-4: confirmed, 2 nights, roomRate=35000
    { id: 'folio-4', tenantId: 'tenant-1', propertyId: 'property-1', bookingId: 'booking-4', folioNumber: 'FOL-KOL-0004', guestId: 'guest-5', subtotal: 70000, taxes: 12600, discount: 3500, totalAmount: 84100, paidAmount: 84100, balance: 0, currency: 'INR', status: 'paid', openedAt: new Date(), closedAt: new Date() },
    // booking-5: confirmed, 3 nights, roomRate=3500
    { id: 'folio-5', tenantId: 'tenant-1', propertyId: 'property-1', bookingId: 'booking-5', folioNumber: 'FOL-KOL-0005', guestId: 'guest-4', subtotal: 10500, taxes: 1890, discount: 0, totalAmount: 13290, paidAmount: 5000, balance: 8290, currency: 'INR', status: 'partially_paid', openedAt: new Date() },
    // booking-6: checked_in, 3 nights, roomRate=3500
    { id: 'folio-6', tenantId: 'tenant-1', propertyId: 'property-1', bookingId: 'booking-6', folioNumber: 'FOL-KOL-0006', guestId: 'guest-6', subtotal: 10500, taxes: 1890, discount: 0, totalAmount: 13290, paidAmount: 13290, balance: 0, currency: 'INR', status: 'paid', openedAt: new Date(todaySeed.getTime() - 3 * 24 * 60 * 60 * 1000), closedAt: new Date() },
  ];
  await prisma.folio.createMany({ data: folios });

  // Folio Line Items
  const folioLineItems = [
    // Folio 1 - Room 501, 3 nights
    { id: 'fli-1', folioId: 'folio-1', description: 'Room 501 - Deluxe Room - 3 night(s)', category: 'room_charge', quantity: 3, unitPrice: 5500, totalAmount: 16500, serviceDate: new Date(todaySeed.getTime() - 2 * 24 * 60 * 60 * 1000), taxRate: 18, taxAmount: 2970 },
    { id: 'fli-2', folioId: 'folio-1', description: 'Room Service - Butter Chicken, Naan, Lassi', category: 'food_beverage', quantity: 1, unitPrice: 900, totalAmount: 900, serviceDate: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), taxRate: 5, taxAmount: 45 },
    { id: 'fli-3', folioId: 'folio-1', description: 'Laundry Service - Dry Cleaning (3 items)', category: 'service', quantity: 3, unitPrice: 200, totalAmount: 600, serviceDate: new Date(), taxRate: 18, taxAmount: 108 },
    // Folio 2 - Room 801, 4 nights
    { id: 'fli-4', folioId: 'folio-2', description: 'Room 801 - Executive Suite - 4 night(s)', category: 'room_charge', quantity: 4, unitPrice: 12000, totalAmount: 48000, serviceDate: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), taxRate: 18, taxAmount: 8640 },
    { id: 'fli-5', folioId: 'folio-2', description: 'Mini Bar - Beverages & Snacks', category: 'food_beverage', quantity: 1, unitPrice: 2500, totalAmount: 2500, serviceDate: new Date(todaySeed.getTime() - 12 * 60 * 60 * 1000), taxRate: 5, taxAmount: 125 },
    // Folio 3 - Room 510, 4 nights (upcoming)
    { id: 'fli-6', folioId: 'folio-3', description: 'Room 510 - Deluxe Room - 4 night(s)', category: 'room_charge', quantity: 4, unitPrice: 5500, totalAmount: 22000, serviceDate: new Date(), taxRate: 18, taxAmount: 3960 },
    // Folio 4 - Room 1002, 2 nights
    { id: 'fli-7', folioId: 'folio-4', description: 'Room 1002 - Presidential Suite - 2 night(s)', category: 'room_charge', quantity: 2, unitPrice: 35000, totalAmount: 70000, serviceDate: new Date(), taxRate: 18, taxAmount: 12600 },
    // Folio 5 - Room 101, 3 nights (upcoming)
    { id: 'fli-8', folioId: 'folio-5', description: 'Room 101 - Standard Room - 3 night(s)', category: 'room_charge', quantity: 3, unitPrice: 3500, totalAmount: 10500, serviceDate: new Date(todaySeed.getTime() + 7 * 24 * 60 * 60 * 1000), taxRate: 18, taxAmount: 1890 },
    // Folio 6 - Room 305, 3 nights
    { id: 'fli-9', folioId: 'folio-6', description: 'Room 305 - Standard Room - 3 night(s)', category: 'room_charge', quantity: 3, unitPrice: 3500, totalAmount: 10500, serviceDate: new Date(todaySeed.getTime() - 3 * 24 * 60 * 60 * 1000), taxRate: 18, taxAmount: 1890 },
  ];
  await prisma.folioLineItem.createMany({ data: folioLineItems });

  // Payments
  const payments = [
    { id: 'pay-1', tenantId: 'tenant-1', folioId: 'folio-1', guestId: 'guest-1', amount: 5000, currency: 'INR', method: 'credit_card', gateway: 'stripe', cardType: 'visa', cardLast4: '4242', transactionId: 'TXN-ST-001', status: 'completed', processedAt: new Date(todaySeed.getTime() - 2 * 24 * 60 * 60 * 1000) },
    { id: 'pay-2', tenantId: 'tenant-1', folioId: 'folio-1', guestId: 'guest-1', amount: 5000, currency: 'INR', method: 'credit_card', gateway: 'stripe', cardType: 'visa', cardLast4: '4242', transactionId: 'TXN-ST-002', status: 'completed', processedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000) },
    { id: 'pay-3', tenantId: 'tenant-1', folioId: 'folio-2', guestId: 'guest-3', amount: 58640, currency: 'INR', method: 'bank_transfer', gateway: 'manual', transactionId: 'TXN-BT-001', reference: 'NEFT-REF-78901', status: 'completed', processedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000) },
    { id: 'pay-4', tenantId: 'tenant-1', folioId: 'folio-4', guestId: 'guest-5', amount: 50000, currency: 'INR', method: 'credit_card', gateway: 'stripe', cardType: 'mastercard', cardLast4: '8888', transactionId: 'TXN-ST-003', status: 'completed', processedAt: new Date() },
    { id: 'pay-5', tenantId: 'tenant-1', folioId: 'folio-4', guestId: 'guest-5', amount: 34100, currency: 'INR', method: 'upi', gateway: 'manual', transactionId: 'TXN-UPI-001', status: 'completed', processedAt: new Date() },
    { id: 'pay-6', tenantId: 'tenant-1', folioId: 'folio-5', guestId: 'guest-4', amount: 5000, currency: 'INR', method: 'upi', gateway: 'manual', transactionId: 'TXN-UPI-002', status: 'completed', processedAt: new Date() },
    { id: 'pay-7', tenantId: 'tenant-1', folioId: 'folio-6', guestId: 'guest-6', amount: 10000, currency: 'INR', method: 'cash', gateway: 'manual', transactionId: 'TXN-CSH-001', status: 'completed', processedAt: new Date(todaySeed.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { id: 'pay-8', tenantId: 'tenant-1', folioId: 'folio-6', guestId: 'guest-6', amount: 3290, currency: 'INR', method: 'credit_card', gateway: 'stripe', cardType: 'visa', cardLast4: '1234', transactionId: 'TXN-ST-004', status: 'completed', processedAt: new Date() },
  ];
  await prisma.payment.createMany({ data: payments });

  // Invoices (for closed/paid folios)
  const invoices = [
    { id: 'inv-1', tenantId: 'tenant-1', invoiceNumber: 'INV-2501-0001', folioId: 'folio-2', customerName: 'Rahul Banerjee', customerEmail: 'rahul.b@email.com', customerAddress: 'Kolkata, India', subtotal: 48000, taxes: 8640, totalAmount: 58640, currency: 'INR', issuedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), dueAt: new Date(todaySeed.getTime() + 29 * 24 * 60 * 60 * 1000), paidAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000), status: 'paid', pdfUrl: '/api/invoices/folio-2/pdf' },
    { id: 'inv-2', tenantId: 'tenant-1', invoiceNumber: 'INV-2501-0002', folioId: 'folio-4', customerName: 'Vikram Singh', customerEmail: 'vikram.s@email.com', customerAddress: 'Kolkata, India', subtotal: 70000, taxes: 12600, totalAmount: 84100, currency: 'INR', issuedAt: new Date(), dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), paidAt: new Date(), status: 'paid', pdfUrl: '/api/invoices/folio-4/pdf' },
    { id: 'inv-3', tenantId: 'tenant-1', invoiceNumber: 'INV-2501-0003', folioId: 'folio-6', customerName: 'Rina Chatterjee', customerEmail: 'rina.c@email.com', customerAddress: 'Kolkata, India', subtotal: 10500, taxes: 1890, totalAmount: 13290, currency: 'INR', issuedAt: new Date(), dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), paidAt: new Date(), status: 'paid', pdfUrl: '/api/invoices/folio-6/pdf' },
  ];
  await prisma.invoice.createMany({ data: invoices });

  // Update folios with invoice references
  await prisma.folio.update({ where: { id: 'folio-2' }, data: { invoiceNumber: 'INV-2501-0001', invoiceIssuedAt: new Date(todaySeed.getTime() - 1 * 24 * 60 * 60 * 1000) } });
  await prisma.folio.update({ where: { id: 'folio-4' }, data: { invoiceNumber: 'INV-2501-0002', invoiceIssuedAt: new Date() } });
  await prisma.folio.update({ where: { id: 'folio-6' }, data: { invoiceNumber: 'INV-2501-0003', invoiceIssuedAt: new Date() } });

  console.log('Billing seed data completed!');

  // === Cancellation Policies ===
  console.log('Seeding cancellation policies...');
  const cancellationPolicies = [
    {
      id: 'cp-1',
      tenantId: 'tenant-1',
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
      id: 'cp-2',
      tenantId: 'tenant-1',
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
      id: 'cp-3',
      tenantId: 'tenant-1',
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
      id: 'cp-4',
      tenantId: 'tenant-1',
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
      id: 'cp-5',
      tenantId: 'tenant-2',
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
      id: 'it-1',
      tenantId: 'tenant-1',
      name: 'Standard Room Inspection',
      description: 'Comprehensive checklist for standard room cleaning inspection',
      roomType: 'standard',
      category: 'room',
      items: JSON.stringify([
        { id: 'bath-1', name: 'Toilet cleaned and sanitized', category: 'Bathroom', required: true, sortOrder: 1 },
        { id: 'bath-2', name: 'Shower/bathtub cleaned', category: 'Bathroom', required: true, sortOrder: 2 },
        { id: 'bath-3', name: 'Sink and vanity clean', category: 'Bathroom', required: true, sortOrder: 3 },
        { id: 'bath-4', name: 'Mirror spotless', category: 'Bathroom', required: true, sortOrder: 4 },
        { id: 'bath-5', name: 'Towels replaced (2 bath, 2 hand, 1 face)', category: 'Bathroom', required: true, sortOrder: 5 },
        { id: 'bath-6', name: 'Toiletries restocked', category: 'Bathroom', required: true, sortOrder: 6 },
        { id: 'bath-7', name: 'Hair dryer present and working', category: 'Bathroom', required: false, sortOrder: 7 },
        { id: 'bed-1', name: 'Bedsheets changed (fresh, no wrinkles)', category: 'Bedroom', required: true, sortOrder: 8 },
        { id: 'bed-2', name: 'Pillows fluffed and arranged', category: 'Bedroom', required: true, sortOrder: 9 },
        { id: 'bed-3', name: 'Bedspread/duvet clean', category: 'Bedroom', required: true, sortOrder: 10 },
        { id: 'bed-4', name: 'AC working (set to 22°C)', category: 'Bedroom', required: true, sortOrder: 11 },
        { id: 'bed-5', name: 'TV working, remote present', category: 'Bedroom', required: true, sortOrder: 12 },
        { id: 'bed-6', name: 'Minibar restocked', category: 'Bedroom', required: false, sortOrder: 13 },
        { id: 'bed-7', name: 'Safe locked and working', category: 'Bedroom', required: false, sortOrder: 14 },
        { id: 'bed-8', name: 'Dust-free surfaces', category: 'Bedroom', required: true, sortOrder: 15 },
        { id: 'room-1', name: 'Floor vacuumed and mopped', category: 'Room', required: true, sortOrder: 16 },
        { id: 'room-2', name: 'Curtains clean and properly hung', category: 'Room', required: true, sortOrder: 17 },
        { id: 'room-3', name: 'Trash bins emptied', category: 'Room', required: true, sortOrder: 18 },
        { id: 'room-4', name: 'Room fragranced', category: 'Room', required: true, sortOrder: 19 },
        { id: 'room-5', name: 'Welcome amenities placed', category: 'Room', required: true, sortOrder: 20 },
        { id: 'room-6', name: 'Do Not Disturb sign available', category: 'Room', required: true, sortOrder: 21 },
        { id: 'room-7', name: 'No personal items left behind', category: 'Room', required: true, sortOrder: 22 },
        { id: 'room-8', name: 'Furniture properly arranged', category: 'Room', required: true, sortOrder: 23 },
      ]),
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'it-2',
      tenantId: 'tenant-1',
      name: 'VIP Suite Inspection',
      description: 'Enhanced checklist for VIP suites and premium rooms',
      roomType: 'vip',
      category: 'room',
      items: JSON.stringify([
        { id: 'vip-bath-1', name: 'Premium toiletries stocked (set complete)', category: 'Bathroom', required: true, sortOrder: 1 },
        { id: 'vip-bath-2', name: 'Bathrobe and slippers placed', category: 'Bathroom', required: true, sortOrder: 2 },
        { id: 'vip-bath-3', name: 'Toilet and bathroom spotless', category: 'Bathroom', required: true, sortOrder: 3 },
        { id: 'vip-bath-4', name: 'Fresh flowers arranged', category: 'Bathroom', required: true, sortOrder: 4 },
        { id: 'vip-bed-1', name: 'Premium linen (cotton/silk blend)', category: 'Bedroom', required: true, sortOrder: 5 },
        { id: 'vip-bed-2', name: 'Pillow menu card placed', category: 'Bedroom', required: true, sortOrder: 6 },
        { id: 'vip-bed-3', name: 'Turndown amenities prepared', category: 'Bedroom', required: true, sortOrder: 7 },
        { id: 'vip-bed-4', name: 'Fruit basket and welcome card', category: 'Bedroom', required: true, sortOrder: 8 },
        { id: 'vip-bed-5', name: 'AC at optimal temperature', category: 'Bedroom', required: true, sortOrder: 9 },
        { id: 'vip-room-1', name: 'Floor polished (no marks)', category: 'Room', required: true, sortOrder: 10 },
        { id: 'vip-room-2', name: 'Premium minibar fully stocked', category: 'Room', required: true, sortOrder: 11 },
        { id: 'vip-room-3', name: 'Nespresso machine cleaned and loaded', category: 'Room', required: true, sortOrder: 12 },
        { id: 'vip-room-4', name: 'All lights and electronics working', category: 'Room', required: true, sortOrder: 13 },
        { id: 'vip-room-5', name: 'Balcony clean (if applicable)', category: 'Room', required: true, sortOrder: 14 },
        { id: 'vip-room-6', name: 'Complimentary newspaper/magazine', category: 'Room', required: false, sortOrder: 15 },
      ]),
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 'it-3',
      tenantId: 'tenant-1',
      name: 'Deep Clean Inspection',
      description: 'Thorough inspection after deep cleaning or maintenance',
      roomType: 'deep_clean',
      category: 'room',
      items: JSON.stringify([
        { id: 'deep-1', name: 'Under-bed area cleaned', category: 'Deep Clean', required: true, sortOrder: 1 },
        { id: 'deep-2', name: 'Behind furniture vacuumed', category: 'Deep Clean', required: true, sortOrder: 2 },
        { id: 'deep-3', name: 'Wardrobe interior wiped', category: 'Deep Clean', required: true, sortOrder: 3 },
        { id: 'deep-4', name: 'Drawer interiors cleaned', category: 'Deep Clean', required: true, sortOrder: 4 },
        { id: 'deep-5', name: 'AC vents/filters cleaned', category: 'Deep Clean', required: true, sortOrder: 5 },
        { id: 'deep-6', name: 'Light fixtures cleaned', category: 'Deep Clean', required: true, sortOrder: 6 },
        { id: 'deep-7', name: 'Window tracks cleaned', category: 'Deep Clean', required: true, sortOrder: 7 },
        { id: 'deep-8', name: 'Grout and tile sealant checked', category: 'Deep Clean', required: false, sortOrder: 8 },
        { id: 'deep-9', name: 'Mattress rotated/flipped', category: 'Deep Clean', required: true, sortOrder: 9 },
        { id: 'deep-10', name: 'Upholstery spots treated', category: 'Deep Clean', required: true, sortOrder: 10 },
      ]),
      isActive: true,
      sortOrder: 3,
    },
    {
      id: 'it-4',
      tenantId: 'tenant-1',
      name: 'Public Area Inspection',
      description: 'Checklist for lobby, corridors, and common areas',
      roomType: 'public_area',
      category: 'public_area',
      items: JSON.stringify([
        { id: 'pub-1', name: 'Floors clean and polished', category: 'Lobby', required: true, sortOrder: 1 },
        { id: 'pub-2', name: 'Furniture arranged properly', category: 'Lobby', required: true, sortOrder: 2 },
        { id: 'pub-3', name: 'Restrooms clean and stocked', category: 'Lobby', required: true, sortOrder: 3 },
        { id: 'pub-4', name: 'Plants watered and healthy', category: 'Lobby', required: true, sortOrder: 4 },
        { id: 'pub-5', name: 'Lighting adequate', category: 'Lobby', required: true, sortOrder: 5 },
        { id: 'pub-6', name: 'Signage clean and visible', category: 'Lobby', required: true, sortOrder: 6 },
        { id: 'pub-7', name: 'Elevator clean and functioning', category: 'Common', required: true, sortOrder: 7 },
        { id: 'pub-8', name: 'Corridors vacuumed', category: 'Common', required: true, sortOrder: 8 },
      ]),
      isActive: true,
      sortOrder: 4,
    },
    {
      id: 'it-5',
      tenantId: 'tenant-2',
      name: 'Ocean View Room Inspection',
      description: 'Standard inspection for Ocean View resort',
      roomType: null,
      category: 'room',
      items: JSON.stringify([
        { id: 'ov-1', name: 'Room thoroughly cleaned', category: 'Room', required: true, sortOrder: 1 },
        { id: 'ov-2', name: 'Bathroom sanitized', category: 'Bathroom', required: true, sortOrder: 2 },
        { id: 'ov-3', name: 'Towels and linens replaced', category: 'Bathroom', required: true, sortOrder: 3 },
        { id: 'ov-4', name: 'Balcony clean with ocean view unobstructed', category: 'Room', required: true, sortOrder: 4 },
        { id: 'ov-5', name: 'Minibar restocked', category: 'Room', required: false, sortOrder: 5 },
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
      id: 'ir-1',
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      roomId: 'room-101',
      taskId: null,
      templateId: 'it-1',
      inspectorId: 'user-housekeeping',
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
      id: 'ir-2',
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      roomId: 'room-102',
      taskId: null,
      templateId: 'it-1',
      inspectorId: 'user-housekeeping',
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
  // ADDON MODULE SEED DATA
  // ============================================================

  // Cleanup addon module data (for re-seed support)
  console.log('Cleaning remaining addon module data...');
  try {
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
          id: 'ntmpl-1',
          tenantId: 'tenant-1',
          name: 'Booking Confirmation',
          type: 'email',
          triggerEvent: 'booking_confirmed',
          subject: 'Your Booking is Confirmed — {{confirmationCode}}',
          body: '<!DOCTYPE html><html><body><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1a365d">Booking Confirmed</h1><p>Dear {{guestName}},</p><p>Your booking <strong>{{confirmationCode}}</strong> has been confirmed.</p><p><strong>Check-in:</strong> {{checkIn}}<br><strong>Check-out:</strong> {{checkOut}}<br><strong>Room:</strong> {{roomName}}<br><strong>Total:</strong> {{totalAmount}}</p><p>We look forward to welcoming you!</p><p>Best regards,<br>{{propertyName}}</p></div></body></html>',
          variables: JSON.stringify(['confirmationCode', 'guestName', 'checkIn', 'checkOut', 'roomName', 'totalAmount', 'propertyName']),
          isActive: true,
        },
        {
          id: 'ntmpl-2',
          tenantId: 'tenant-1',
          name: 'Check-in Reminder',
          type: 'email',
          triggerEvent: 'checkin_reminder',
          subject: 'Your Check-in is Tomorrow — {{confirmationCode}}',
          body: '<!DOCTYPE html><html><body><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#2d7d46">See You Tomorrow!</h1><p>Dear {{guestName}},</p><p>This is a friendly reminder that your check-in is tomorrow.</p><p><strong>Property:</strong> {{propertyName}}<br><strong>Address:</strong> {{propertyAddress}}<br><strong>Check-in Time:</strong> {{checkInTime}}</p><p>Please remember to bring a valid photo ID.</p><p>We can\'t wait to host you!</p></div></body></html>',
          variables: JSON.stringify(['confirmationCode', 'guestName', 'propertyName', 'propertyAddress', 'checkInTime']),
          isActive: true,
        },
        {
          id: 'ntmpl-3',
          tenantId: 'tenant-1',
          name: 'Check-out Thank You',
          type: 'email',
          triggerEvent: 'checkout_completed',
          subject: 'Thank You for Staying With Us!',
          body: '<!DOCTYPE html><html><body><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1a365d">Thank You, {{guestName}}!</h1><p>We hope you enjoyed your stay at <strong>{{propertyName}}</strong>.</p><p>Your check-out is complete. Booking reference: <strong>{{confirmationCode}}</strong>.</p><p>We would love to hear about your experience. If you have a moment, please leave us a review!</p><p>Safe travels and we hope to see you again soon.</p></div></body></html>',
          variables: JSON.stringify(['guestName', 'propertyName', 'confirmationCode']),
          isActive: true,
        },
        {
          id: 'ntmpl-4',
          tenantId: 'tenant-1',
          name: 'Review Request',
          type: 'email',
          triggerEvent: 'review_request',
          subject: 'How Was Your Stay? We\'d Love Your Feedback',
          body: '<!DOCTYPE html><html><body><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#c05621">Share Your Experience</h1><p>Dear {{guestName}},</p><p>You recently stayed at <strong>{{propertyName}}</strong>. We\'d love to hear about your experience!</p><p>Your feedback helps us improve and assists other guests in making informed decisions.</p><div style="text-align:center;margin:30px 0"><a href="{{reviewLink}}" style="background-color:#2d7d46;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:16px">Leave a Review</a></div><p>It only takes a minute and means the world to us.</p><p>Warm regards,<br>{{propertyName}} Team</p></div></body></html>',
          variables: JSON.stringify(['guestName', 'propertyName', 'reviewLink']),
          isActive: true,
        },
        {
          id: 'ntmpl-5',
          tenantId: 'tenant-1',
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
          id: 'arule-1',
          tenantId: 'tenant-1',
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
          id: 'arule-2',
          tenantId: 'tenant-1',
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
          id: 'arule-3',
          tenantId: 'tenant-1',
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
          id: 'wh-1',
          tenantId: 'tenant-1',
          name: 'Booking Webhook',
          url: 'https://api.staysuite.com/webhooks/bookings',
          events: JSON.stringify(['booking.created', 'booking.confirmed', 'booking.cancelled', 'booking.checked_in', 'booking.checked_out']),
          secret: 'whsec_booking_abc123def456ghi789',
          isActive: true,
        },
        {
          id: 'wh-2',
          tenantId: 'tenant-1',
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
          id: 'ltier-1',
          tenantId: 'tenant-1',
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
          id: 'ltier-2',
          tenantId: 'tenant-1',
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
          id: 'ltier-3',
          tenantId: 'tenant-1',
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
          id: 'lreward-1',
          tenantId: 'tenant-1',
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
          id: 'lreward-2',
          tenantId: 'tenant-1',
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
          id: 'lreward-3',
          tenantId: 'tenant-1',
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
          id: 'campaign-1',
          tenantId: 'tenant-1',
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
          id: 'campaign-2',
          tenantId: 'tenant-1',
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
          id: 'segment-1',
          tenantId: 'tenant-1',
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
          id: 'segment-2',
          tenantId: 'tenant-1',
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
          id: 'segment-3',
          tenantId: 'tenant-1',
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
          id: 'shift-1',
          tenantId: 'tenant-1',
          userId: 'user-2',
          date: shiftDate,
          startTime: '06:00',
          endTime: '14:00',
          shiftType: 'regular',
          status: 'in_progress',
          clockIn: new Date(shiftDate.getTime() + 6 * 60 * 60 * 1000),
        },
        {
          id: 'shift-2',
          tenantId: 'tenant-1',
          userId: 'user-3',
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
        id: 'attendance-1',
        tenantId: 'tenant-1',
        userId: 'user-2',
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
          id: 'park-1',
          tenantId: 'tenant-1',
          propertyId: 'property-1',
          number: 'A1',
          floor: -1,
          type: 'standard',
          vehicleType: 'car',
          status: 'available',
          posX: 50,
          posY: 100,
        },
        {
          id: 'park-2',
          tenantId: 'tenant-1',
          propertyId: 'property-1',
          number: 'A2',
          floor: -1,
          type: 'standard',
          vehicleType: 'car',
          status: 'occupied',
          posX: 150,
          posY: 100,
        },
        {
          id: 'park-3',
          tenantId: 'tenant-1',
          propertyId: 'property-1',
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
          id: 'park-4',
          tenantId: 'tenant-1',
          propertyId: 'property-1',
          number: 'A4',
          floor: -1,
          type: 'standard',
          vehicleType: 'suv',
          status: 'available',
          posX: 350,
          posY: 100,
        },
        {
          id: 'park-5',
          tenantId: 'tenant-1',
          propertyId: 'property-1',
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
          id: 'espace-1',
          propertyId: 'property-1',
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
          id: 'espace-2',
          propertyId: 'property-1',
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
          id: 'channel-1',
          tenantId: 'tenant-1',
          channel: 'booking_com',
          displayName: 'Booking.com',
          propertyId: 'property-1',
          hotelId: 'bcom-hotel-12345',
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
          id: 'channel-2',
          tenantId: 'tenant-1',
          channel: 'airbnb',
          displayName: 'Airbnb',
          propertyId: 'property-1',
          listingId: 'airbnb-listing-67890',
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
        id: 'incident-1',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        type: 'lost_key',
        severity: 'low',
        title: 'Lost Room Key — Room 501',
        description: 'Guest reported losing their room keycard. A new keycard was issued and the old keycard was deactivated in the system. No unauthorized access detected.',
        location: 'Floor 5 — Room 501 corridor',
        reportedBy: 'user-2',
        assignedTo: 'user-1',
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
        id: 'discount-6',
        tenantId: 'tenant-1',
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
        id: 'cp-addon-1',
        tenantId: 'tenant-1',
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
        id: 'it-addon-1',
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        name: 'Standard Room Inspection',
        description: 'Quick turnaround inspection checklist used after standard room cleaning. Covers bed, bathroom, towels, minibar, and entertainment.',
        roomType: 'standard',
        category: 'room',
        items: JSON.stringify([
          { id: 'sri-1', name: 'Bed Made', category: 'bedroom', required: true, sortOrder: 1 },
          { id: 'sri-2', name: 'Bathroom Clean', category: 'bathroom', required: true, sortOrder: 2 },
          { id: 'sri-3', name: 'Towels Fresh', category: 'bathroom', required: true, sortOrder: 3 },
          { id: 'sri-4', name: 'Minibar Stocked', category: 'amenities', required: true, sortOrder: 4 },
          { id: 'sri-5', name: 'TV Working', category: 'amenities', required: true, sortOrder: 5 },
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
