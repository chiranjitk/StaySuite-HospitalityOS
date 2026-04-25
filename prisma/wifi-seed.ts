import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Generate deterministic UUIDs from seed strings for PostgreSQL @db.Uuid compatibility.
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31)
  ].join('-');
};

const prisma = new PrismaClient();

const TENANT_ID = uuid('tenant-1');
const PROPERTY_ID = uuid('property-1');

// WiFi Plan IDs
const PLAN_IDS = {
  free: uuid('wifiplan-1'),
  basic: uuid('wifiplan-2'),
  standard: uuid('wifiplan-3'),
  premium: uuid('wifiplan-4'),
  vip: uuid('wifiplan-5'),
  conference: uuid('wifiplan-6'),
};

// Network Interface IDs
const IFACE_IDS = {
  eth0: uuid('netif-eth0'),
  eth1: uuid('netif-eth1'),
  br0: uuid('netif-br0'),
  bond0: uuid('netif-bond0'),
  wlan0: uuid('netif-wlan0'),
  eth2: uuid('netif-eth2'),
};

// VLAN IDs
const VLAN_IDS = {
  guest: uuid('vlan-10'),
  staff: uuid('vlan-20'),
  pos: uuid('vlan-30'),
  iot: uuid('vlan-40'),
  mgmt: uuid('vlan-50'),
};

// DHCP Subnet IDs
const SUBNET_IDS = {
  guest: uuid('dhcp-sub-guest'),
  staff: uuid('dhcp-sub-staff'),
  iot: uuid('dhcp-sub-iot'),
  mgmt: uuid('dhcp-sub-mgmt'),
};

// DNS Zone IDs
const ZONE_IDS = {
  main: uuid('dnszone-main'),
  guest: uuid('dnszone-guest'),
};

// Captive Portal IDs
const PORTAL_IDS = {
  hotel: uuid('portal-hotel'),
  staff: uuid('portal-staff'),
};

// Firewall Zone IDs
const FW_ZONE_IDS = {
  wan: uuid('fwzone-wan'),
  lan: uuid('fwzone-lan'),
  guest: uuid('fwzone-guest'),
};

// Firewall Schedule IDs
const FW_SCHED_IDS = {
  business: uuid('fwsched-business'),
  night: uuid('fwsched-night'),
};

// Bandwidth Policy IDs
const BW_POLICY_IDS = {
  free: uuid('bwpolicy-free'),
  standard: uuid('bwpolicy-standard'),
  premium: uuid('bwpolicy-premium'),
};

// Bandwidth Pool IDs
const BW_POOL_IDS = {
  guest: uuid('bwpool-guest'),
  staff: uuid('bwpool-staff'),
};

export async function seedWiFiData() {
  console.log('\n📡 Seeding comprehensive WiFi module data...');

  // ─── Clean existing WiFi module data ───────────────────────────
  console.log('Cleaning WiFi module data...');
  try {
    // Order matters due to FK constraints
    await prisma.natLog.deleteMany({});
    await prisma.bandwidthUsageSession.deleteMany({});
    await prisma.bandwidthUsageDaily.deleteMany({});
    await prisma.bandwidthPolicy.deleteMany({});
    await prisma.bandwidthPool.deleteMany({});
    await prisma.contentFilter.deleteMany({});
    await prisma.scheduleAccess.deleteMany({});
    await prisma.macFilter.deleteMany({});
    await prisma.firewallRule.deleteMany({});
    await prisma.firewallSchedule.deleteMany({});
    await prisma.firewallZone.deleteMany({});
    await prisma.portalAuthentication.deleteMany({});
    await prisma.portalPage.deleteMany({});
    await prisma.portalMapping.deleteMany({});
    await prisma.portalTemplate.deleteMany({});
    await prisma.captivePortal.deleteMany({});
    await prisma.dnsRedirectRule.deleteMany({});
    await prisma.dnsRecord.deleteMany({});
    await prisma.dnsZone.deleteMany({});
    await prisma.dhcpOption.deleteMany({});
    await prisma.dhcpLease.deleteMany({});
    await prisma.dhcpReservation.deleteMany({});
    await prisma.dhcpSubnet.deleteMany({});
    await prisma.portForwardRule.deleteMany({});
    await prisma.wanFailover.deleteMany({});
    await prisma.bondMember.deleteMany({});
    await prisma.bondConfig.deleteMany({});
    await prisma.bridgeConfig.deleteMany({});
    await prisma.vlanConfig.deleteMany({});
    await prisma.interfaceConfig.deleteMany({});
    await prisma.interfaceRole.deleteMany({});
    await prisma.networkInterface.deleteMany({});
    await prisma.networkConfigBackup.deleteMany({});
    await prisma.systemNetworkHealth.deleteMany({});
    await prisma.syslogServer.deleteMany({});
    await prisma.radiusServerConfig.deleteMany({});
    await prisma.radiusNAS.deleteMany({});
    await prisma.wiFiAAAConfig.deleteMany({});
    await prisma.wiFiGateway.deleteMany({});
    await prisma.wiFiSession.deleteMany({});
    await prisma.wiFiVoucher.deleteMany({});
    await prisma.radUserGroup.deleteMany({});
    await prisma.radReply.deleteMany({});
    await prisma.radCheck.deleteMany({});
    await prisma.wiFiUser.deleteMany({});
    await prisma.wiFiPlan.deleteMany({});
    console.log('WiFi module data cleaned.');
  } catch (e: any) {
    console.log('WiFi cleanup note:', e.message);
  }

  const now = new Date();
  const day = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
  const hour = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);
  const min = (m: number) => new Date(now.getTime() + m * 60 * 1000);

  // ═══════════════════════════════════════════════════════════════
  // 1. WiFi PLANS (6)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Plans (6)...');
  await prisma.wiFiPlan.createMany({
    data: [
      {
        id: PLAN_IDS.free,
        tenantId: TENANT_ID,
        name: 'Free WiFi',
        description: 'Complimentary basic WiFi for all guests. Suitable for browsing and email.',
        downloadSpeed: 5,
        uploadSpeed: 2,
        dataLimit: null, // unlimited
        sessionLimit: 1,
        price: 0,
        currency: 'INR',
        priority: 1,
        validityDays: 1,
        status: 'active',
      },
      {
        id: PLAN_IDS.basic,
        tenantId: TENANT_ID,
        name: 'Basic Plan',
        description: 'Entry-level paid plan with 2GB data. Good for light streaming.',
        downloadSpeed: 10,
        uploadSpeed: 5,
        dataLimit: 2048, // 2GB in MB
        sessionLimit: 2,
        price: 99,
        currency: 'INR',
        priority: 2,
        validityDays: 1,
        status: 'active',
      },
      {
        id: PLAN_IDS.standard,
        tenantId: TENANT_ID,
        name: 'Standard Plan',
        description: 'Mid-tier plan with 5GB data. Great for video calls and streaming.',
        downloadSpeed: 25,
        uploadSpeed: 10,
        dataLimit: 5120, // 5GB in MB
        sessionLimit: 3,
        price: 199,
        currency: 'INR',
        priority: 3,
        validityDays: 3,
        status: 'active',
      },
      {
        id: PLAN_IDS.premium,
        tenantId: TENANT_ID,
        name: 'Premium Plan',
        description: 'High-speed plan with 15GB data. Ideal for business travelers.',
        downloadSpeed: 50,
        uploadSpeed: 25,
        dataLimit: 15360, // 15GB in MB
        sessionLimit: 5,
        price: 399,
        currency: 'INR',
        priority: 4,
        validityDays: 5,
        status: 'active',
      },
      {
        id: PLAN_IDS.vip,
        tenantId: TENANT_ID,
        name: 'VIP Suite Plan',
        description: 'Unlimited high-speed WiFi for VIP and suite guests. Premium experience.',
        downloadSpeed: 100,
        uploadSpeed: 50,
        dataLimit: null, // unlimited
        sessionLimit: 10,
        price: 599,
        currency: 'INR',
        priority: 5,
        validityDays: 7,
        status: 'active',
      },
      {
        id: PLAN_IDS.conference,
        tenantId: TENANT_ID,
        name: 'Conference Plan',
        description: 'Optimized for conference rooms and events. 10GB shared data per session.',
        downloadSpeed: 30,
        uploadSpeed: 15,
        dataLimit: 10240, // 10GB in MB
        sessionLimit: 25,
        price: 299,
        currency: 'INR',
        priority: 3,
        validityDays: 1,
        status: 'active',
      },
    ],
  });
  console.log('✓ 6 WiFi Plans seeded');

  // ═══════════════════════════════════════════════════════════════
  // 2. WiFi USERS (8)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Users (8)...');
  await prisma.wiFiUser.createMany({
    data: [
      {
        id: uuid('wifiuser-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.amit.mukherjee',
        password: 'hashed_password_1',
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        userType: 'guest',
        planId: PLAN_IDS.premium,
        validFrom: day(-2),
        validUntil: day(1),
        maxSessions: 5,
        sessionCount: 2,
        totalBytesIn: 524288000, // ~500MB
        totalBytesOut: 104857600, // ~100MB
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-2),
        lastAccountingAt: min(-15),
      },
      {
        id: uuid('wifiuser-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.rahul.banerjee',
        password: 'hashed_password_2',
        guestId: uuid('guest-3'),
        bookingId: uuid('booking-2'),
        userType: 'guest',
        planId: PLAN_IDS.vip,
        validFrom: day(-1),
        validUntil: day(3),
        maxSessions: 10,
        sessionCount: 3,
        totalBytesIn: 2000000000, // ~2GB
        totalBytesOut: 500000000,
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-1),
        lastAccountingAt: min(-5),
      },
      {
        id: uuid('wifiuser-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.sneha.gupta',
        password: 'hashed_password_3',
        guestId: uuid('guest-2'),
        bookingId: uuid('booking-3'),
        userType: 'guest',
        planId: PLAN_IDS.standard,
        validFrom: day(0),
        validUntil: day(4),
        maxSessions: 3,
        sessionCount: 1,
        totalBytesIn: 157286400, // ~150MB
        totalBytesOut: 52428800,
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-4),
        lastAccountingAt: min(-30),
      },
      {
        id: uuid('wifiuser-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.vikram.singh',
        password: 'hashed_password_4',
        guestId: uuid('guest-5'),
        bookingId: uuid('booking-4'),
        userType: 'guest',
        planId: PLAN_IDS.vip,
        validFrom: day(0),
        validUntil: day(2),
        maxSessions: 10,
        sessionCount: 1,
        totalBytesIn: 78643200, // ~75MB
        totalBytesOut: 26214400,
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-3),
        lastAccountingAt: min(-20),
      },
      {
        id: uuid('wifiuser-5'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'staff.priya.das',
        password: 'hashed_password_5',
        guestId: null,
        bookingId: null,
        userType: 'staff',
        planId: PLAN_IDS.premium,
        validFrom: day(-30),
        validUntil: day(30),
        maxSessions: 3,
        sessionCount: 1,
        totalBytesIn: 314572800, // ~300MB
        totalBytesOut: 104857600,
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-6),
        lastAccountingAt: min(-45),
      },
      {
        id: uuid('wifiuser-6'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'staff.anita.roy',
        password: 'hashed_password_6',
        guestId: null,
        bookingId: null,
        userType: 'staff',
        planId: PLAN_IDS.standard,
        validFrom: day(-30),
        validUntil: day(30),
        maxSessions: 2,
        sessionCount: 0,
        totalBytesIn: 0,
        totalBytesOut: 0,
        status: 'active',
        radiusSynced: false,
        radiusSyncedAt: null,
        lastAccountingAt: null,
      },
      {
        id: uuid('wifiuser-7'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.rina.chatterjee',
        password: 'hashed_password_7',
        guestId: uuid('guest-6'),
        bookingId: uuid('booking-6'),
        userType: 'guest',
        planId: PLAN_IDS.basic,
        validFrom: day(-3),
        validUntil: day(0),
        maxSessions: 2,
        sessionCount: 0,
        totalBytesIn: 1048576, // ~1MB
        totalBytesOut: 524288,
        status: 'expired',
        radiusSynced: true,
        radiusSyncedAt: day(-2),
        lastAccountingAt: day(-1),
      },
      {
        id: uuid('wifiuser-8'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'conference.room1',
        password: 'hashed_password_8',
        guestId: null,
        bookingId: null,
        userType: 'event',
        planId: PLAN_IDS.conference,
        validFrom: day(0),
        validUntil: day(1),
        maxSessions: 25,
        sessionCount: 8,
        totalBytesIn: 1000000000, // ~1GB
        totalBytesOut: 500000000, // ~500MB
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-1),
        lastAccountingAt: min(-10),
      },
    ],
  });
  console.log('✓ 8 WiFi Users seeded');

  // ═══════════════════════════════════════════════════════════════
  // 2b. RADIUS CREDENTIALS (RadCheck + RadReply + RadUserGroup)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding RADIUS credentials for WiFi users...');

  // RadCheck — authentication records (Cleartext-Password)
  await prisma.radCheck.createMany({
    data: [
      // Active guest users
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'Cleartext-Password', op: ':=', value: 'Amit@2024', isActive: true },
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'Cleartext-Password', op: ':=', value: 'Rahul@2024', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'Cleartext-Password', op: ':=', value: 'Sneha@2024', isActive: true },
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'Cleartext-Password', op: ':=', value: 'Vikram@2024', isActive: true },
      // Staff users
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'Cleartext-Password', op: ':=', value: 'Staff@Priya', isActive: true },
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'Cleartext-Password', op: ':=', value: 'Staff@Anita', isActive: true },
      // Event user
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'Cleartext-Password', op: ':=', value: 'Conf@2024', isActive: true },
    ],
  });
  console.log('✓ RadCheck records seeded');

  // RadReply — authorization attributes (bandwidth, data limits)
  await prisma.radReply.createMany({
    data: [
      // guest.amit.mukherjee — Premium (50Mbps/25Mbps)
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'Mikrotik-Rate-Limit', op: ':=', value: '50M/25M', isActive: true },
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'Mikrotik-Total-Limit', op: ':=', value: '16106127360', isActive: true },

      // guest.rahul.banerjee — VIP (100Mbps/50Mbps, unlimited data)
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '100000000', isActive: true },
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'Mikrotik-Rate-Limit', op: ':=', value: '100M/50M', isActive: true },

      // guest.sneha.gupta — Standard (25Mbps/10Mbps)
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '10000000', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'Mikrotik-Rate-Limit', op: ':=', value: '25M/10M', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'Mikrotik-Total-Limit', op: ':=', value: '5368709120', isActive: true },

      // guest.vikram.singh — VIP (100Mbps/50Mbps)
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '100000000', isActive: true },
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'Mikrotik-Rate-Limit', op: ':=', value: '100M/50M', isActive: true },

      // staff.priya.das — Premium (50Mbps/25Mbps)
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'Mikrotik-Rate-Limit', op: ':=', value: '50M/25M', isActive: true },

      // staff.anita.roy — Standard (25Mbps/10Mbps)
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '10000000', isActive: true },
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'Mikrotik-Rate-Limit', op: ':=', value: '25M/10M', isActive: true },

      // conference.room1 — Conference (30Mbps/15Mbps)
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '30000000', isActive: true },
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '15000000', isActive: true },
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'Mikrotik-Rate-Limit', op: ':=', value: '30M/15M', isActive: true },
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'Mikrotik-Total-Limit', op: ':=', value: '10737418240', isActive: true },
    ],
  });
  console.log('✓ RadReply records seeded');

  // RadUserGroup — group mappings for each user
  await prisma.radUserGroup.createMany({
    data: [
      { username: 'guest.amit.mukherjee', groupname: 'premium_plan', priority: 0 },
      { username: 'guest.rahul.banerjee', groupname: 'vip_suite_plan', priority: 0 },
      { username: 'guest.sneha.gupta', groupname: 'standard_plan', priority: 0 },
      { username: 'guest.vikram.singh', groupname: 'vip_suite_plan', priority: 0 },
      { username: 'staff.priya.das', groupname: 'premium_plan', priority: 0 },
      { username: 'staff.anita.roy', groupname: 'standard_plan', priority: 0 },
      { username: 'conference.room1', groupname: 'conference_plan', priority: 0 },
    ],
  });
  console.log('✓ RadUserGroup records seeded');

  // ═══════════════════════════════════════════════════════════════
  // 3. WiFi SESSIONS (10)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Sessions (10)...');
  await prisma.wiFiSession.createMany({
    data: [
      // Active sessions (3)
      {
        id: uuid('wifisession-1'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.premium,
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        macAddress: 'AA:BB:CC:11:22:33',
        ipAddress: '192.168.10.105',
        deviceName: 'Amit-iPhone',
        deviceType: 'smartphone',
        startTime: hour(-3),
        endTime: null,
        dataUsed: 262144000, // ~250MB
        duration: 10800, // 3 hours
        authMethod: 'room_number',
        status: 'active',
      },
      {
        id: uuid('wifisession-2'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.vip,
        guestId: uuid('guest-3'),
        bookingId: uuid('booking-2'),
        macAddress: 'AA:BB:CC:44:55:66',
        ipAddress: '192.168.10.110',
        deviceName: 'Rahul-MacBook',
        deviceType: 'laptop',
        startTime: hour(-5),
        endTime: null,
        dataUsed: 1073741824, // ~1GB
        duration: 18000, // 5 hours
        authMethod: 'room_number',
        status: 'active',
      },
      {
        id: uuid('wifisession-3'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.conference,
        guestId: null,
        bookingId: null,
        macAddress: 'DD:EE:FF:11:22:33',
        ipAddress: '192.168.10.200',
        deviceName: 'ConfRoom-Display',
        deviceType: 'other',
        startTime: hour(-1),
        endTime: null,
        dataUsed: 52428800, // ~50MB
        duration: 3600, // 1 hour
        authMethod: 'voucher',
        status: 'active',
      },
      // Ended sessions (5)
      {
        id: uuid('wifisession-4'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.standard,
        guestId: uuid('guest-2'),
        bookingId: uuid('booking-3'),
        macAddress: 'AA:BB:CC:77:88:99',
        ipAddress: '192.168.10.115',
        deviceName: 'Sneha-Galaxy-S23',
        deviceType: 'smartphone',
        startTime: hour(-8),
        endTime: hour(-2),
        dataUsed: 314572800, // ~300MB
        duration: 21600, // 6 hours
        authMethod: 'voucher',
        status: 'ended',
      },
      {
        id: uuid('wifisession-5'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.premium,
        guestId: uuid('guest-5'),
        bookingId: uuid('booking-4'),
        macAddress: 'AA:BB:CC:AA:BB:CC',
        ipAddress: '192.168.10.120',
        deviceName: 'Vikram-ThinkPad',
        deviceType: 'laptop',
        startTime: day(-1),
        endTime: day(-1).getTime() + 8 * 60 * 60 * 1000 > now.getTime() ? now : new Date(day(-1).getTime() + 8 * 60 * 60 * 1000),
        dataUsed: 524288000, // ~500MB
        duration: 28800, // 8 hours
        authMethod: 'room_number',
        status: 'ended',
      },
      {
        id: uuid('wifisession-6'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.free,
        guestId: uuid('guest-6'),
        bookingId: uuid('booking-6'),
        macAddress: 'AA:BB:CC:DD:EE:FF',
        ipAddress: '192.168.10.125',
        deviceName: 'Rina-iPad',
        deviceType: 'tablet',
        startTime: day(-2),
        endTime: new Date(day(-2).getTime() + 4 * 60 * 60 * 1000),
        dataUsed: 104857600, // ~100MB
        duration: 14400, // 4 hours
        authMethod: 'sms_otp',
        status: 'ended',
      },
      {
        id: uuid('wifisession-7'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.standard,
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        macAddress: 'AA:BB:CC:11:22:34',
        ipAddress: '192.168.10.106',
        deviceName: 'Amit-Surface-Pro',
        deviceType: 'laptop',
        startTime: day(-1),
        endTime: new Date(day(-1).getTime() + 6 * 60 * 60 * 1000),
        dataUsed: 786432000, // ~750MB
        duration: 21600, // 6 hours
        authMethod: 'room_number',
        status: 'ended',
      },
      {
        id: uuid('wifisession-8'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.basic,
        guestId: uuid('guest-4'),
        bookingId: null,
        macAddress: '11:22:33:44:55:66',
        ipAddress: '192.168.10.130',
        deviceName: 'Unknown-Device',
        deviceType: 'smartphone',
        startTime: day(-3),
        endTime: new Date(day(-3).getTime() + 2 * 60 * 60 * 1000),
        dataUsed: 52428800, // ~50MB
        duration: 7200, // 2 hours
        authMethod: 'voucher',
        status: 'ended',
      },
      // Terminated sessions (2)
      {
        id: uuid('wifisession-9'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.free,
        guestId: null,
        bookingId: null,
        macAddress: '22:33:44:55:66:77',
        ipAddress: '192.168.10.140',
        deviceName: 'Suspicious-Client',
        deviceType: 'other',
        startTime: hour(-6),
        endTime: hour(-5),
        dataUsed: 1048576, // ~1MB
        duration: 3600,
        authMethod: 'mac_auth',
        status: 'terminated',
      },
      {
        id: uuid('wifisession-10'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.basic,
        guestId: null,
        bookingId: null,
        macAddress: '33:44:55:66:77:88',
        ipAddress: '192.168.10.141',
        deviceName: 'Rogue-AP-Client',
        deviceType: 'other',
        startTime: day(-1),
        endTime: new Date(day(-1).getTime() + 30 * 60 * 1000),
        dataUsed: 524288, // ~0.5MB
        duration: 1800, // 30 min
        authMethod: 'voucher',
        status: 'terminated',
      },
    ],
  });
  console.log('✓ 10 WiFi Sessions seeded');

  // ═══════════════════════════════════════════════════════════════
  // 4. WiFi VOUCHERS (10)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Vouchers (10)...');
  await prisma.wiFiVoucher.createMany({
    data: [
      // Active vouchers (4)
      {
        id: uuid('wifivoucher-1'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.premium,
        code: 'RS-PREM-A1B2C3',
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        isUsed: true,
        usedAt: hour(-3),
        validFrom: day(-2),
        validUntil: day(1),
        status: 'active',
      },
      {
        id: uuid('wifivoucher-2'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.vip,
        code: 'RS-VIP-D4E5F6',
        guestId: uuid('guest-3'),
        bookingId: uuid('booking-2'),
        isUsed: true,
        usedAt: hour(-5),
        validFrom: day(-1),
        validUntil: day(3),
        status: 'active',
      },
      {
        id: uuid('wifivoucher-3'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.standard,
        code: 'RS-STD-G7H8I9',
        guestId: uuid('guest-2'),
        bookingId: uuid('booking-3'),
        isUsed: true,
        usedAt: hour(-8),
        validFrom: day(0),
        validUntil: day(4),
        status: 'active',
      },
      {
        id: uuid('wifivoucher-4'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.conference,
        code: 'RS-CONF-J1K2L3',
        guestId: null,
        bookingId: null,
        isUsed: false,
        usedAt: null,
        validFrom: day(0),
        validUntil: day(1),
        status: 'active',
      },
      // Used vouchers (3)
      {
        id: uuid('wifivoucher-5'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.premium,
        code: 'RS-PREM-M4N5O6',
        guestId: uuid('guest-5'),
        bookingId: uuid('booking-4'),
        isUsed: true,
        usedAt: day(-1),
        validFrom: day(-1),
        validUntil: day(2),
        status: 'used',
      },
      {
        id: uuid('wifivoucher-6'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.basic,
        code: 'RS-BASIC-P7Q8R9',
        guestId: uuid('guest-4'),
        bookingId: null,
        isUsed: true,
        usedAt: day(-3),
        validFrom: day(-3),
        validUntil: day(-2),
        status: 'used',
      },
      {
        id: uuid('wifivoucher-7'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.free,
        code: 'RS-FREE-S1T2U3',
        guestId: uuid('guest-6'),
        bookingId: uuid('booking-6'),
        isUsed: true,
        usedAt: day(-2),
        validFrom: day(-3),
        validUntil: day(0),
        status: 'used',
      },
      // Expired vouchers (2)
      {
        id: uuid('wifivoucher-8'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.standard,
        code: 'RS-STD-V4W5X6',
        guestId: null,
        bookingId: null,
        isUsed: false,
        usedAt: null,
        validFrom: day(-10),
        validUntil: day(-7),
        status: 'expired',
      },
      {
        id: uuid('wifivoucher-9'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.basic,
        code: 'RS-BASIC-Y7Z8A9',
        guestId: null,
        bookingId: null,
        isUsed: false,
        usedAt: null,
        validFrom: day(-5),
        validUntil: day(-4),
        status: 'expired',
      },
      // Revoked voucher (1)
      {
        id: uuid('wifivoucher-10'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.conference,
        code: 'RS-CONF-B1C2D3',
        guestId: null,
        bookingId: null,
        isUsed: false,
        usedAt: null,
        validFrom: day(-1),
        validUntil: day(1),
        status: 'revoked',
      },
    ],
  });
  console.log('✓ 10 WiFi Vouchers seeded');

  // ═══════════════════════════════════════════════════════════════
  // 5. WiFi GATEWAYS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Gateways (2)...');
  await prisma.wiFiGateway.createMany({
    data: [
      {
        id: uuid('wifigw-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Main Controller (Cisco Meraki)',
        description: 'Primary WiFi controller managing all guest and staff access points across 10 floors.',
        ipAddress: '10.0.0.1',
        macAddress: '00:1A:2B:3C:4D:5E',
        vendor: 'cisco',
        model: 'Meraki MR46',
        version: '28.1.1',
        radiusSecret: 'rs_secret_main_2024',
        radiusAuthPort: 1812,
        radiusAcctPort: 1813,
        coaEnabled: true,
        coaPort: 3799,
        coaSecret: 'coa_secret_main',
        captivePortalEnabled: true,
        captivePortalUrl: 'https://wifi.royalstay.in/portal',
        defaultVlan: 10,
        guestVlan: 10,
        staffVlan: 20,
        managementUrl: 'https://meraki.royalstay.in',
        apiUsername: 'pms_api_user',
        apiPassword: 'encrypted_api_pass_1',
        apiPort: 443,
        status: 'active',
        lastSeenAt: min(-2),
        firmwareVersion: '28.1.1',
        totalClients: 47,
        totalSessions: 156,
      },
      {
        id: uuid('wifigw-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Backup Controller (Ubiquiti)',
        description: 'Secondary controller for conference rooms and outdoor areas. Currently offline for maintenance.',
        ipAddress: '10.0.0.2',
        macAddress: '00:1A:2B:3C:4D:5F',
        vendor: 'ubiquiti',
        model: 'UniFi U6-Pro',
        version: '7.0.23',
        radiusSecret: 'rs_secret_backup_2024',
        radiusAuthPort: 1812,
        radiusAcctPort: 1813,
        coaEnabled: true,
        coaPort: 3799,
        captivePortalEnabled: true,
        captivePortalUrl: 'https://wifi.royalstay.in/portal-backup',
        defaultVlan: 10,
        guestVlan: 10,
        staffVlan: 20,
        managementUrl: 'https://unifi.royalstay.in',
        status: 'disconnected',
        lastSeenAt: day(-2),
        firmwareVersion: '7.0.23',
        totalClients: 0,
        totalSessions: 42,
      },
    ],
  });
  console.log('✓ 2 WiFi Gateways seeded');

  // ═══════════════════════════════════════════════════════════════
  // 6. WiFi AAA CONFIG (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi AAA Config (1)...');
  await prisma.wiFiAAAConfig.create({
    data: {
      id: uuid('aaa-config-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      defaultPlanId: PLAN_IDS.free,
      defaultDownloadSpeed: 5,
      defaultUploadSpeed: 2,
      defaultSessionLimit: 1,
      defaultDataLimit: null,
      autoProvisionOnCheckin: true,
      autoDeprovisionOnCheckout: true,
      autoDeprovisionDelay: 30,
      authMethod: 'pap',
      allowMacAuth: true,
      accountingSyncInterval: 5,
      lastSyncAt: min(-5),
      lastSyncId: 'sync-2024-001',
      maxConcurrentSessions: 3,
      sessionTimeoutPolicy: 'hard',
      portalEnabled: true,
      portalTitle: 'Royal Stay WiFi',
      portalLogo: '/assets/wifi-logo.png',
      portalTerms: 'By using our WiFi service, you agree to our terms of service and acceptable use policy.',
      portalRedirectUrl: 'https://www.royalstay.in/welcome',
      portalBrandColor: '#8B5E3C',
      status: 'active',
    },
  });
  console.log('✓ 1 WiFi AAA Config seeded');

  // ═══════════════════════════════════════════════════════════════
  // 7. RADIUS NAS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Radius NAS (2)...');
  await prisma.radiusNAS.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'MikroTik Router - Main',
        shortname: 'mikrotik-main',
        ipAddress: '10.0.1.1',
        type: 'mikrotik',
        ports: 1812,
        secret: 'nas_secret_mikrotik_1',
        community: 'public_ro',
        description: 'Main MikroTik CCR2004 router handling guest and staff VLANs.',
        coaEnabled: true,
        coaPort: 3799,
        authPort: 1812,
        acctPort: 1813,
        status: 'active',
        lastSeenAt: min(-1),
        totalAuths: 4523,
        totalAccts: 38910,
      },
      {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Aruba Controller - Conference',
        shortname: 'aruba-conf',
        ipAddress: '10.0.1.2',
        type: 'aruba',
        ports: 1812,
        secret: 'nas_secret_aruba_1',
        community: 'public_ro',
        description: 'Aruba 7008 controller for conference and event spaces.',
        coaEnabled: true,
        coaPort: 3799,
        authPort: 1812,
        acctPort: 1813,
        status: 'active',
        lastSeenAt: min(-3),
        totalAuths: 1247,
        totalAccts: 8564,
      },
    ],
  });
  console.log('✓ 2 Radius NAS seeded');

  // ═══════════════════════════════════════════════════════════════
  // 8. RADIUS SERVER CONFIG (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Radius Server Config (1)...');
  await prisma.radiusServerConfig.create({
    data: {
      id: uuid('radius-server-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      serverIp: '127.0.0.1',
      serverHostname: 'radius.royalstay.local',
      authPort: 1812,
      acctPort: 1813,
      coaPort: 3799,
      listenAllInterfaces: true,
      bindAddress: '0.0.0.0',
      maxAuthWait: 30,
      maxAcctWait: 30,
      cleanupSessions: true,
      sessionCleanupInterval: 3600,
      logAuth: true,
      logAuthBadpass: false,
      logAuthGoodpass: false,
      logDestination: 'files',
      logLevel: 'info',
      status: 'active',
    },
  });
  console.log('✓ 1 Radius Server Config seeded');

  // ═══════════════════════════════════════════════════════════════
  // 9. NETWORK INTERFACES (6)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Network Interfaces (6)...');
  await prisma.networkInterface.createMany({
    data: [
      {
        id: IFACE_IDS.eth0,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'eth0',
        type: 'ethernet',
        hwAddress: '00:1A:2B:3C:4D:01',
        mtu: 1500,
        speed: '1000M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'Primary WAN uplink - ISP Airtel Fibre',
      },
      {
        id: IFACE_IDS.eth1,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'eth1',
        type: 'ethernet',
        hwAddress: '00:1A:2B:3C:4D:02',
        mtu: 1500,
        speed: '1000M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'Primary LAN - Connected to main switch',
      },
      {
        id: IFACE_IDS.br0,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'br0',
        type: 'bridge',
        hwAddress: '00:1A:2B:3C:4D:03',
        mtu: 1500,
        speed: '1000M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'Main bridge - LAN + Guest',
      },
      {
        id: IFACE_IDS.bond0,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'bond0',
        type: 'bond',
        hwAddress: '00:1A:2B:3C:4D:04',
        mtu: 1500,
        speed: '2000M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'LACP bond of eth0 + backup WAN',
      },
      {
        id: IFACE_IDS.wlan0,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'wlan0',
        type: 'wireless',
        hwAddress: '00:1A:2B:3C:4D:05',
        mtu: 1500,
        speed: '867M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'WiFi radio - 5GHz',
      },
      {
        id: IFACE_IDS.eth2,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'eth2',
        type: 'ethernet',
        hwAddress: '00:1A:2B:3C:4D:06',
        mtu: 1500,
        speed: '1000M',
        status: 'down',
        carrier: false,
        isManagement: false,
        description: 'Backup WAN - Jio Fibre (standby)',
      },
    ],
  });
  console.log('✓ 6 Network Interfaces seeded');

  // ═══════════════════════════════════════════════════════════════
  // 10. INTERFACE ROLES (6)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Interface Roles (6)...');
  await prisma.interfaceRole.createMany({
    data: [
      {
        id: uuid('ifrole-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth0,
        role: 'wan',
        priority: 1,
        isPrimary: true,
        enabled: true,
      },
      {
        id: uuid('ifrole-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth1,
        role: 'lan',
        priority: 0,
        isPrimary: true,
        enabled: true,
      },
      {
        id: uuid('ifrole-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.br0,
        role: 'dmz',
        priority: 0,
        isPrimary: false,
        enabled: true,
      },
      {
        id: uuid('ifrole-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.bond0,
        role: 'management',
        priority: 0,
        isPrimary: false,
        enabled: true,
      },
      {
        id: uuid('ifrole-5'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.wlan0,
        role: 'wifi',
        priority: 0,
        isPrimary: true,
        enabled: true,
      },
      {
        id: uuid('ifrole-6'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth2,
        role: 'unused',
        priority: 2,
        isPrimary: false,
        enabled: false,
      },
    ],
  });
  console.log('✓ 6 Interface Roles seeded');

  // ═══════════════════════════════════════════════════════════════
  // 11. VLAN CONFIGS (5)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding VLAN Configs (5)...');
  await prisma.vlanConfig.createMany({
    data: [
      {
        id: VLAN_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 10,
        subInterface: 'eth1.10',
        description: 'Guest WiFi VLAN - Internet only, no LAN access',
        mtu: 1500,
        enabled: true,
      },
      {
        id: VLAN_IDS.staff,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 20,
        subInterface: 'eth1.20',
        description: 'Staff VLAN - Full LAN and internet access',
        mtu: 1500,
        enabled: true,
      },
      {
        id: VLAN_IDS.pos,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 30,
        subInterface: 'eth1.30',
        description: 'POS/Payment VLAN - Isolated for PCI compliance',
        mtu: 1500,
        enabled: true,
      },
      {
        id: VLAN_IDS.iot,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 40,
        subInterface: 'eth1.40',
        description: 'IoT Devices VLAN - Smart locks, thermostats, sensors',
        mtu: 1500,
        enabled: true,
      },
      {
        id: VLAN_IDS.mgmt,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 50,
        subInterface: 'eth1.50',
        description: 'Management VLAN - Network devices and admin access',
        mtu: 1500,
        enabled: true,
      },
    ],
  });
  console.log('✓ 5 VLAN Configs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 12. INTERFACE CONFIGS (for key interfaces)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Interface Configs...');
  await prisma.interfaceConfig.createMany({
    data: [
      {
        id: uuid('ifcfg-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth0,
        mode: 'dhcp',
        ipAddress: null,
        netmask: null,
        gateway: null,
        dnsPrimary: null,
        dnsSecondary: null,
        enabled: true,
      },
      {
        id: uuid('ifcfg-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth1,
        mode: 'static',
        ipAddress: '192.168.1.1',
        netmask: '255.255.255.0',
        gateway: '192.168.1.254',
        dnsPrimary: '8.8.8.8',
        dnsSecondary: '1.1.1.1',
        enabled: true,
      },
      {
        id: uuid('ifcfg-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth2,
        mode: 'disabled',
        ipAddress: null,
        netmask: null,
        gateway: null,
        dnsPrimary: null,
        dnsSecondary: null,
        enabled: false,
      },
    ],
  });
  console.log('✓ Interface Configs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 13. BRIDGE CONFIGS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bridge Configs (2)...');
  await prisma.bridgeConfig.createMany({
    data: [
      {
        id: uuid('bridge-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'br0',
        memberInterfaces: JSON.stringify(['eth1', 'wlan0']),
        stpEnabled: true,
        forwardDelay: 15,
        helloTime: 2,
        maxAge: 20,
        enabled: true,
      },
      {
        id: uuid('bridge-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'br-guest',
        memberInterfaces: JSON.stringify(['eth1.10']),
        stpEnabled: false,
        forwardDelay: 15,
        helloTime: 2,
        maxAge: 20,
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 Bridge Configs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 14. BOND CONFIG (1) + BOND MEMBERS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bond Config (1)...');
  await prisma.bondConfig.create({
    data: {
      id: uuid('bond-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      name: 'bond0',
      mode: '802.3ad',
      miimon: 100,
      lacpRate: 'slow',
      primaryMember: IFACE_IDS.eth0,
      enabled: true,
    },
  });
  // Add bond members
  await prisma.bondMember.createMany({
    data: [
      {
        id: uuid('bondmember-1'),
        bondConfigId: uuid('bond-1'),
        interfaceId: IFACE_IDS.eth0,
        priority: 1,
      },
      {
        id: uuid('bondmember-2'),
        bondConfigId: uuid('bond-1'),
        interfaceId: IFACE_IDS.eth2,
        priority: 2,
      },
    ],
  });
  console.log('✓ 1 Bond Config + 2 members seeded');

  // ═══════════════════════════════════════════════════════════════
  // 15. PORT FORWARD RULES (4)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Port Forward Rules (4)...');
  await prisma.portForwardRule.createMany({
    data: [
      {
        id: uuid('pfwd-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Web Server',
        protocol: 'tcp',
        externalPort: 80,
        internalIp: '192.168.1.10',
        internalPort: 80,
        interfaceId: IFACE_IDS.eth0,
        enabled: true,
        description: 'Hotel website and booking portal',
      },
      {
        id: uuid('pfwd-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'HTTPS Server',
        protocol: 'tcp',
        externalPort: 443,
        internalIp: '192.168.1.10',
        internalPort: 443,
        interfaceId: IFACE_IDS.eth0,
        enabled: true,
        description: 'Secure web services and PMS access',
      },
      {
        id: uuid('pfwd-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'PMS Remote Access',
        protocol: 'tcp',
        externalPort: 8443,
        internalIp: '192.168.1.20',
        internalPort: 443,
        interfaceId: IFACE_IDS.eth0,
        enabled: true,
        description: 'Remote PMS management access',
      },
      {
        id: uuid('pfwd-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'VPN Server',
        protocol: 'udp',
        externalPort: 1194,
        internalIp: '192.168.1.30',
        internalPort: 1194,
        interfaceId: IFACE_IDS.eth0,
        enabled: true,
        description: 'WireGuard VPN for remote staff access',
      },
    ],
  });
  console.log('✓ 4 Port Forward Rules seeded');

  // ═══════════════════════════════════════════════════════════════
  // 16. WAN FAILOVER (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WAN Failover...');
  await prisma.wanFailover.create({
    data: {
      id: uuid('wanfo-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      primaryWanId: IFACE_IDS.eth0,
      backupWanId: IFACE_IDS.eth2,
      healthCheckUrl: 'https://1.1.1.1',
      healthCheckInterval: 30,
      failoverThreshold: 3,
      autoSwitchback: true,
      switchbackDelay: 300,
      enabled: true,
    },
  });
  console.log('✓ 1 WAN Failover seeded');

  // ═══════════════════════════════════════════════════════════════
  // 17. DHCP SUBNETS (4)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DHCP Subnets (4)...');
  await prisma.dhcpSubnet.createMany({
    data: [
      {
        id: SUBNET_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Guest WiFi Subnet',
        subnet: '192.168.10.0/24',
        gateway: '192.168.10.1',
        poolStart: '192.168.10.100',
        poolEnd: '192.168.10.254',
        leaseTime: 3600,
        vlanId: 10,
        vlanConfigId: VLAN_IDS.guest,
        domainName: 'guest.royalstay.local',
        dnsServers: JSON.stringify(['192.168.1.1', '8.8.8.8']),
        ntpServers: JSON.stringify(['pool.ntp.org']),
        enabled: true,
        description: 'DHCP pool for guest WiFi clients on VLAN 10',
      },
      {
        id: SUBNET_IDS.staff,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Staff LAN Subnet',
        subnet: '192.168.20.0/24',
        gateway: '192.168.20.1',
        poolStart: '192.168.20.50',
        poolEnd: '192.168.20.254',
        leaseTime: 86400,
        vlanId: 20,
        vlanConfigId: VLAN_IDS.staff,
        domainName: 'staff.royalstay.local',
        dnsServers: JSON.stringify(['192.168.1.1', '8.8.8.8']),
        ntpServers: JSON.stringify(['pool.ntp.org']),
        enabled: true,
        description: 'DHCP pool for staff devices on VLAN 20',
      },
      {
        id: SUBNET_IDS.iot,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'IoT Devices Subnet',
        subnet: '192.168.40.0/24',
        gateway: '192.168.40.1',
        poolStart: '192.168.40.100',
        poolEnd: '192.168.40.200',
        leaseTime: 604800,
        vlanId: 40,
        vlanConfigId: VLAN_IDS.iot,
        domainName: 'iot.royalstay.local',
        dnsServers: JSON.stringify(['192.168.1.1']),
        ntpServers: JSON.stringify(['pool.ntp.org']),
        enabled: true,
        description: 'DHCP pool for IoT devices on VLAN 40. Long lease for stability.',
      },
      {
        id: SUBNET_IDS.mgmt,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Management Subnet',
        subnet: '192.168.50.0/24',
        gateway: '192.168.50.1',
        poolStart: '192.168.50.10',
        poolEnd: '192.168.50.50',
        leaseTime: 86400,
        vlanId: 50,
        vlanConfigId: VLAN_IDS.mgmt,
        domainName: 'mgmt.royalstay.local',
        dnsServers: JSON.stringify(['192.168.1.1', '8.8.8.8']),
        ntpServers: JSON.stringify(['pool.ntp.org']),
        enabled: true,
        description: 'DHCP pool for management network devices on VLAN 50',
      },
    ],
  });
  console.log('✓ 4 DHCP Subnets seeded');

  // ═══════════════════════════════════════════════════════════════
  // 18. DHCP RESERVATIONS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DHCP Reservations (3)...');
  await prisma.dhcpReservation.createMany({
    data: [
      {
        id: uuid('dhcpres-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.iot,
        macAddress: 'AA:BB:CC:DD:01:01',
        ipAddress: '192.168.40.101',
        hostname: 'Room101-SmartLock',
        leaseTime: null,
        linkedType: 'room',
        linkedId: uuid('room-101'),
        description: 'Smart lock for Room 101 - always needs same IP',
        enabled: true,
      },
      {
        id: uuid('dhcpres-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.iot,
        macAddress: 'AA:BB:CC:DD:01:02',
        ipAddress: '192.168.40.102',
        hostname: 'Room101-Thermostat',
        leaseTime: null,
        linkedType: 'room',
        linkedId: uuid('room-101'),
        description: 'Smart thermostat for Room 101',
        enabled: true,
      },
      {
        id: uuid('dhcpres-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.staff,
        macAddress: 'AA:BB:CC:DD:02:01',
        ipAddress: '192.168.20.51',
        hostname: 'Priya-Laptop',
        leaseTime: null,
        linkedType: 'staff',
        linkedId: uuid('user-2'),
        description: 'Front desk manager laptop - fixed IP for printer access',
        enabled: true,
      },
    ],
  });
  console.log('✓ 3 DHCP Reservations seeded');

  // ═══════════════════════════════════════════════════════════════
  // 19. DHCP LEASES (5)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DHCP Leases (5)...');
  await prisma.dhcpLease.createMany({
    data: [
      {
        id: uuid('dhcplease-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.guest,
        macAddress: 'AA:BB:CC:11:22:33',
        ipAddress: '192.168.10.105',
        hostname: 'Amit-iPhone',
        clientId: '01:aabb:cc11:2233',
        leaseStart: hour(-3),
        leaseEnd: hour(1),
        state: 'active',
        lastSeenAt: min(-5),
      },
      {
        id: uuid('dhcplease-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.guest,
        macAddress: 'AA:BB:CC:44:55:66',
        ipAddress: '192.168.10.110',
        hostname: 'Rahul-MacBook',
        clientId: '01:aabb:cc44:5566',
        leaseStart: hour(-5),
        leaseEnd: hour(-1),
        state: 'active',
        lastSeenAt: min(-2),
      },
      {
        id: uuid('dhcplease-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.guest,
        macAddress: 'AA:BB:CC:DD:EE:FF',
        ipAddress: '192.168.10.125',
        hostname: 'Rina-iPad',
        clientId: '01:aabb:ccdd:eeff',
        leaseStart: day(-2),
        leaseEnd: day(-1),
        state: 'expired',
        lastSeenAt: day(-1),
      },
      {
        id: uuid('dhcplease-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.staff,
        macAddress: 'AA:BB:CC:DD:02:01',
        ipAddress: '192.168.20.51',
        hostname: 'Priya-Laptop',
        clientId: '01:aabb:ccdd:0201',
        leaseStart: day(-1),
        leaseEnd: day(1),
        state: 'active',
        lastSeenAt: min(-15),
      },
      {
        id: uuid('dhcplease-5'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.iot,
        macAddress: 'AA:BB:CC:DD:01:01',
        ipAddress: '192.168.40.101',
        hostname: 'Room101-SmartLock',
        clientId: null,
        leaseStart: day(-7),
        leaseEnd: day(0),
        state: 'released',
        lastSeenAt: hour(-6),
      },
    ],
  });
  console.log('✓ 5 DHCP Leases seeded');

  // ═══════════════════════════════════════════════════════════════
  // 20. DHCP OPTIONS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DHCP Options (3)...');
  await prisma.dhcpOption.createMany({
    data: [
      {
        id: uuid('dhcpopt-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: null, // Global
        code: 6,
        name: 'DNS Servers',
        value: '8.8.8.8, 1.1.1.1',
        type: 'ip',
        enabled: true,
        description: 'Default DNS servers for all subnets',
      },
      {
        id: uuid('dhcpopt-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: null, // Global
        code: 42,
        name: 'NTP Server',
        value: 'pool.ntp.org',
        type: 'string',
        enabled: true,
        description: 'Network time protocol server for time synchronization',
      },
      {
        id: uuid('dhcpopt-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.guest,
        code: 15,
        name: 'Domain Name',
        value: 'guest.royalstay.local',
        type: 'string',
        enabled: true,
        description: 'Domain name for guest WiFi subnet',
      },
    ],
  });
  console.log('✓ 3 DHCP Options seeded');

  // ═══════════════════════════════════════════════════════════════
  // 21. DNS ZONES (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DNS Zones (2)...');
  await prisma.dnsZone.createMany({
    data: [
      {
        id: ZONE_IDS.main,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        domain: 'staysuite.local',
        description: 'Main internal DNS zone for hotel services',
        vlanId: 20,
        enabled: true,
      },
      {
        id: ZONE_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        domain: 'guest.staysuite.local',
        description: 'Guest-facing DNS zone for captive portal and services',
        vlanId: 10,
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 DNS Zones seeded');

  // ═══════════════════════════════════════════════════════════════
  // 22. DNS RECORDS (4)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DNS Records (4)...');
  await prisma.dnsRecord.createMany({
    data: [
      {
        id: uuid('dnsrec-1'),
        tenantId: TENANT_ID,
        zoneId: ZONE_IDS.guest,
        name: 'portal',
        type: 'A',
        value: '192.168.10.1',
        ttl: 300,
        priority: null,
        enabled: true,
      },
      {
        id: uuid('dnsrec-2'),
        tenantId: TENANT_ID,
        zoneId: ZONE_IDS.guest,
        name: 'dns',
        type: 'A',
        value: '192.168.1.1',
        ttl: 300,
        priority: null,
        enabled: true,
      },
      {
        id: uuid('dnsrec-3'),
        tenantId: TENANT_ID,
        zoneId: ZONE_IDS.main,
        name: 'portal',
        type: 'A',
        value: '192.168.1.10',
        ttl: 300,
        priority: null,
        enabled: true,
      },
      {
        id: uuid('dnsrec-4'),
        tenantId: TENANT_ID,
        zoneId: ZONE_IDS.main,
        name: 'dns',
        type: 'A',
        value: '192.168.1.1',
        ttl: 300,
        priority: null,
        enabled: true,
      },
    ],
  });
  console.log('✓ 4 DNS Records seeded');

  // ═══════════════════════════════════════════════════════════════
  // 23. DNS REDIRECT RULES (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DNS Redirect Rules (2)...');
  await prisma.dnsRedirectRule.createMany({
    data: [
      {
        id: uuid('dnsredir-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Captive Portal Detection',
        matchPattern: '*',
        targetIp: '192.168.10.1',
        applyTo: 'unauthenticated',
        priority: 1,
        enabled: true,
        description: 'Redirect all DNS from unauthenticated clients to captive portal',
      },
      {
        id: uuid('dnsredir-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'All DNS Redirect',
        matchPattern: '*',
        targetIp: '0.0.0.0',
        applyTo: 'all',
        priority: 0,
        enabled: false,
        description: 'Emergency: Block all DNS resolution (disabled by default)',
      },
    ],
  });
  console.log('✓ 2 DNS Redirect Rules seeded');

  // ═══════════════════════════════════════════════════════════════
  // 24. CAPTIVE PORTALS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Captive Portals (2)...');
  await prisma.captivePortal.createMany({
    data: [
      {
        id: PORTAL_IDS.hotel,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Lobby - Hotel Guest Portal',
        description: 'Main captive portal for hotel guests in lobby area with voucher and room number authentication.',
        slug: 'lobby',
        roamingMode: 'auth_origin',
        allowsRoamingFrom: '[]',
        authMethod: 'voucher',
        maxBandwidthDown: 5242880,
        maxBandwidthUp: 1048576,
        bandwidthPolicy: 'zone',
        ssidList: '["RoyalStay-Guest", "RoyalStay-Lobby"]',
        listenIp: '0.0.0.0',
        listenPort: 80,
        useSsl: false,
        enabled: true,
        maxConcurrent: 500,
        sessionTimeout: 86400,
        idleTimeout: 3600,
        redirectUrl: 'https://www.royalstay.in/welcome',
        successMessage: 'Welcome to Royal Stay! Enjoy your complimentary WiFi.',
        failMessage: 'Authentication failed. Please check your credentials or contact the front desk.',
      },
      {
        id: PORTAL_IDS.staff,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Pool Area Portal',
        description: 'Captive portal for pool/garden area with seamless roaming from lobby.',
        slug: 'pool',
        roamingMode: 'seamless',
        allowsRoamingFrom: '["lobby"]',
        authMethod: 'room_number',
        maxBandwidthDown: 3145728,
        maxBandwidthUp: 524288,
        bandwidthPolicy: 'origin',
        ssidList: '["RoyalStay-Pool"]',
        listenIp: '0.0.0.0',
        listenPort: 80,
        useSsl: false,
        enabled: true,
        maxConcurrent: 200,
        sessionTimeout: 86400,
        idleTimeout: 3600,
        redirectUrl: 'https://www.royalstay.in/welcome',
        successMessage: 'Welcome! Pool WiFi connected.',
        failMessage: 'Authentication failed. Please contact the front desk.',
      },
    ],
  });
  console.log('✓ 2 Captive Portals seeded');

  // ═══════════════════════════════════════════════════════════════
  // 25. PORTAL AUTH METHODS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Auth Methods (3)...');
  await prisma.portalAuthentication.createMany({
    data: [
      {
        id: uuid('portalauth-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.hotel,
        method: 'voucher',
        enabled: true,
        priority: 1,
        config: JSON.stringify({ autoGenerate: true, codeLength: 8, codeFormat: 'alphanumeric' }),
      },
      {
        id: uuid('portalauth-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.hotel,
        method: 'room_number',
        enabled: true,
        priority: 2,
        config: JSON.stringify({ requireLastName: true, maxAttempts: 3, lockoutMinutes: 5 }),
      },
      {
        id: uuid('portalauth-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.hotel,
        method: 'sms_otp',
        enabled: true,
        priority: 3,
        config: JSON.stringify({ otpLength: 6, otpExpiry: 300, maxRetries: 3, senderId: 'ROYLST' }),
      },
    ],
  });
  console.log('✓ 3 Portal Auth Methods seeded');

  // ═══════════════════════════════════════════════════════════════
  // 26. PORTAL MAPPINGS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Mappings (2)...');
  await prisma.portalMapping.createMany({
    data: [
      {
        id: uuid('portmap-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.hotel,
        vlanId: 10,
        vlanConfigId: VLAN_IDS.guest,
        ssid: 'RoyalStay-Guest',
        subnet: '192.168.10.0/24',
        priority: 1,
        fallbackPortalId: null,
        enabled: true,
      },
      {
        id: uuid('portmap-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.staff,
        vlanId: 20,
        vlanConfigId: VLAN_IDS.staff,
        ssid: 'RoyalStay-Staff',
        subnet: '192.168.20.0/24',
        priority: 1,
        fallbackPortalId: null,
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 Portal Mappings seeded');

  // ═══════════════════════════════════════════════════════════════
  // 27. PORTAL PAGES (2 - one per portal)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Pages (2)...');
  await prisma.portalPage.createMany({
    data: [
      {
        id: uuid('portalpage-1'),
        tenantId: TENANT_ID,
        portalId: PORTAL_IDS.hotel,
        language: 'en',
        title: 'Welcome to Royal Stay WiFi',
        subtitle: 'Connect to complimentary high-speed internet',
        logoUrl: '/assets/royal-stay-logo.png',
        backgroundImage: null,
        backgroundColor: '#1a1a2e',
        textColor: '#ffffff',
        accentColor: '#8B5E3C',
        termsText: 'By connecting, you agree to our Acceptable Use Policy.',
        termsUrl: 'https://www.royalstay.in/terms',
        customCss: '',
        customHtml: '',
        showSocial: false,
        showBranding: true,
      },
      {
        id: uuid('portalpage-2'),
        tenantId: TENANT_ID,
        portalId: PORTAL_IDS.staff,
        language: 'en',
        title: 'Staff WiFi Login',
        subtitle: 'Use your PMS credentials to connect',
        logoUrl: '/assets/royal-stay-logo.png',
        backgroundImage: null,
        backgroundColor: '#f8fafc',
        textColor: '#1f2937',
        accentColor: '#0d9488',
        termsText: 'Staff WiFi is for authorized personnel only.',
        termsUrl: 'https://staff.royalstay.in/policy',
        customCss: '',
        customHtml: '',
        showSocial: false,
        showBranding: true,
      },
    ],
  });
  console.log('✓ 2 Portal Pages seeded');

  // ═══════════════════════════════════════════════════════════════
  // 28. PORTAL TEMPLATES (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Templates (2)...');
  await prisma.portalTemplate.createMany({
    data: [
      {
        id: uuid('portaltemplate-1'),
        tenantId: TENANT_ID,
        name: 'Hotel Luxury',
        description: 'Elegant dark theme with gold accents, perfect for luxury hotels.',
        category: 'hotel',
        thumbnail: '/templates/hotel-luxury-thumb.png',
        htmlContent: '<div class="portal-container"><div class="logo-section"><img src="{{logoUrl}}" alt="Logo"/></div><h1>{{title}}</h1><p>{{subtitle}}</p><div class="auth-section">{{authMethods}}</div><div class="terms">{{termsText}}</div></div>',
        cssContent: '.portal-container{max-width:480px;margin:0 auto;padding:2rem;text-align:center;background:#1a1a2e;color:#fff;border-radius:16px;}.logo-section img{max-height:80px;margin-bottom:1.5rem;}h1{font-size:1.8rem;color:#8B5E3C;margin-bottom:0.5rem;}p{color:#a0a0b0;margin-bottom:2rem;}',
        isBuiltIn: true,
      },
      {
        id: uuid('portaltemplate-2'),
        tenantId: TENANT_ID,
        name: 'Corporate Clean',
        description: 'Clean professional look with teal accents, ideal for business hotels.',
        category: 'corporate',
        thumbnail: '/templates/corporate-clean-thumb.png',
        htmlContent: '<div class="portal-container"><div class="logo-section"><img src="{{logoUrl}}" alt="Logo"/></div><h1>{{title}}</h1><p>{{subtitle}}</p><div class="auth-section">{{authMethods}}</div><div class="terms">{{termsText}}</div></div>',
        cssContent: '.portal-container{max-width:480px;margin:0 auto;padding:2rem;text-align:center;background:#f8fafc;color:#1f2937;border-radius:8px;border:1px solid #e5e7eb;}.logo-section img{max-height:60px;margin-bottom:1.5rem;}h1{font-size:1.5rem;color:#0d9488;}',
        isBuiltIn: true,
      },
    ],
  });
  console.log('✓ 2 Portal Templates seeded');

  // ═══════════════════════════════════════════════════════════════
  // 29. FIREWALL ZONES (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Firewall Zones (3)...');
  await prisma.firewallZone.createMany({
    data: [
      {
        id: FW_ZONE_IDS.wan,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'wan',
        interfaces: JSON.stringify(['eth0', 'eth2']),
        inputPolicy: 'accept',
        forwardPolicy: 'drop',
        outputPolicy: 'accept',
        masquerade: true,
        description: 'WAN zone - Internet facing interfaces with masquerade (NAT)',
      },
      {
        id: FW_ZONE_IDS.lan,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'lan',
        interfaces: JSON.stringify(['eth1', 'br0']),
        inputPolicy: 'accept',
        forwardPolicy: 'accept',
        outputPolicy: 'accept',
        masquerade: false,
        description: 'LAN zone - Internal trusted network for staff and management',
      },
      {
        id: FW_ZONE_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'guest',
        interfaces: JSON.stringify(['eth1.10', 'br-guest']),
        inputPolicy: 'accept',
        forwardPolicy: 'drop',
        outputPolicy: 'accept',
        masquerade: false,
        description: 'Guest zone - Internet only, no LAN forwarding by default',
      },
    ],
  });
  console.log('✓ 3 Firewall Zones seeded');

  // ═══════════════════════════════════════════════════════════════
  // 30. FIREWALL RULES (6)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Firewall Rules (6)...');
  await prisma.firewallRule.createMany({
    data: [
      {
        id: uuid('fwrule-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.wan,
        chain: 'input',
        protocol: 'tcp',
        sourceIp: null,
        sourcePort: null,
        destIp: null,
        destPort: 80,
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow HTTP from WAN',
        priority: 10,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.wan,
        chain: 'input',
        protocol: 'tcp',
        sourceIp: null,
        sourcePort: null,
        destIp: null,
        destPort: 443,
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow HTTPS from WAN',
        priority: 11,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.guest,
        chain: 'forward',
        protocol: null,
        sourceIp: '192.168.10.0/24',
        sourcePort: null,
        destIp: '192.168.20.0/24',
        destPort: null,
        action: 'drop',
        jumpTarget: null,
        logPrefix: 'GUEST-LAN-DROP:',
        enabled: true,
        comment: 'Drop guest-to-LAN traffic (isolation)',
        priority: 5,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.guest,
        chain: 'forward',
        protocol: null,
        sourceIp: '192.168.10.0/24',
        sourcePort: null,
        destIp: null,
        destPort: 53,
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow DNS from guest to all',
        priority: 1,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-5'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.wan,
        chain: 'input',
        protocol: 'icmp',
        sourceIp: null,
        sourcePort: null,
        destIp: null,
        destPort: null,
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow ICMP (ping) from WAN',
        priority: 20,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-6'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.lan,
        chain: 'forward',
        protocol: null,
        sourceIp: null,
        sourcePort: null,
        destIp: null,
        destPort: 53,
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow DNS from all zones',
        priority: 1,
        scheduleId: null,
      },
    ],
  });
  console.log('✓ 6 Firewall Rules seeded');

  // ═══════════════════════════════════════════════════════════════
  // 31. FIREWALL SCHEDULES (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Firewall Schedules (2)...');
  await prisma.firewallSchedule.createMany({
    data: [
      {
        id: FW_SCHED_IDS.business,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Business Hours',
        daysOfWeek: '1,2,3,4,5',
        startTime: '08:00',
        endTime: '18:00',
        timezone: 'Asia/Kolkata',
        enabled: true,
      },
      {
        id: FW_SCHED_IDS.night,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Night Mode',
        daysOfWeek: '1,2,3,4,5,6,7',
        startTime: '23:00',
        endTime: '06:00',
        timezone: 'Asia/Kolkata',
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 Firewall Schedules seeded');

  // ═══════════════════════════════════════════════════════════════
  // 32. MAC FILTERS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding MAC Filters (3)...');
  await prisma.macFilter.createMany({
    data: [
      {
        id: uuid('macfilter-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        macAddress: '22:33:44:55:66:77',
        action: 'deny',
        listType: 'blacklist',
        description: 'Suspicious device detected on guest network',
        linkedType: null,
        linkedId: null,
        expiresAt: null,
        enabled: true,
      },
      {
        id: uuid('macfilter-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        macAddress: '33:44:55:66:77:88',
        action: 'deny',
        listType: 'blacklist',
        description: 'Known rogue AP client - banned permanently',
        linkedType: null,
        linkedId: null,
        expiresAt: null,
        enabled: true,
      },
      {
        id: uuid('macfilter-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        macAddress: 'AA:BB:CC:DD:02:01',
        action: 'allow',
        listType: 'whitelist',
        description: 'Front desk manager laptop - always allowed',
        linkedType: 'staff',
        linkedId: uuid('user-2'),
        expiresAt: null,
        enabled: true,
      },
    ],
  });
  console.log('✓ 3 MAC Filters seeded');

  // ═══════════════════════════════════════════════════════════════
  // 33. BANDWIDTH POLICIES (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bandwidth Policies (3)...');
  await prisma.bandwidthPolicy.createMany({
    data: [
      {
        id: BW_POLICY_IDS.free,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Free Tier',
        downloadKbps: 2048, // 2 Mbps
        uploadKbps: 1024, // 1 Mbps
        burstDownloadKbps: 4096,
        burstUploadKbps: 2048,
        priority: 8,
        planId: PLAN_IDS.free,
        description: 'Basic bandwidth for free WiFi users',
        enabled: true,
      },
      {
        id: BW_POLICY_IDS.standard,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Standard Tier',
        downloadKbps: 25600, // 25 Mbps
        uploadKbps: 10240, // 10 Mbps
        burstDownloadKbps: 51200,
        burstUploadKbps: 20480,
        priority: 5,
        planId: PLAN_IDS.standard,
        description: 'Standard bandwidth for paid WiFi plans',
        enabled: true,
      },
      {
        id: BW_POLICY_IDS.premium,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Premium Tier',
        downloadKbps: 51200, // 50 Mbps
        uploadKbps: 25600, // 25 Mbps
        burstDownloadKbps: 102400,
        burstUploadKbps: 51200,
        priority: 2,
        planId: PLAN_IDS.premium,
        description: 'Premium bandwidth for VIP and business users',
        enabled: true,
      },
    ],
  });
  console.log('✓ 3 Bandwidth Policies seeded');

  // ═══════════════════════════════════════════════════════════════
  // 34. BANDWIDTH POOLS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bandwidth Pools (2)...');
  await prisma.bandwidthPool.createMany({
    data: [
      {
        id: BW_POOL_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Guest Pool',
        subnet: '192.168.10.0/24',
        vlanId: 10,
        totalDownloadKbps: 200000, // 200 Mbps shared
        totalUploadKbps: 100000,
        perUserDownloadKbps: 51200, // 50 Mbps per user max
        perUserUploadKbps: 25600,
        enabled: true,
      },
      {
        id: BW_POOL_IDS.staff,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Staff Pool',
        subnet: '192.168.20.0/24',
        vlanId: 20,
        totalDownloadKbps: 100000, // 100 Mbps shared
        totalUploadKbps: 50000,
        perUserDownloadKbps: 25600, // 25 Mbps per user
        perUserUploadKbps: 10240,
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 Bandwidth Pools seeded');

  // ═══════════════════════════════════════════════════════════════
  // 35. BANDWIDTH DAILY USAGE (7) - last 7 days
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bandwidth Daily Usage (7)...');
  const dailyUsage = [
    { dayOffset: -6, dl: 125000.5, ul: 42000.3, users: 45, peak: 38, peakTime: '20:00' },
    { dayOffset: -5, dl: 132000.7, ul: 45000.1, users: 52, peak: 44, peakTime: '21:00' },
    { dayOffset: -4, dl: 98000.2, ul: 33000.8, users: 38, peak: 32, peakTime: '19:00' },
    { dayOffset: -3, dl: 145000.9, ul: 51000.5, users: 58, peak: 49, peakTime: '22:00' },
    { dayOffset: -2, dl: 158000.3, ul: 55000.2, users: 63, peak: 54, peakTime: '20:00' },
    { dayOffset: -1, dl: 141000.6, ul: 48000.7, users: 55, peak: 47, peakTime: '21:00' },
    { dayOffset: 0,  dl: 89000.4, ul: 30000.9, users: 35, peak: 28, peakTime: '10:00' },
  ];

  await prisma.bandwidthUsageDaily.createMany({
    data: dailyUsage.map((d, i) => ({
      id: uuid(`bwudaily-${i + 1}`),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      date: day(d.dayOffset),
      totalDownloadMb: d.dl,
      totalUploadMb: d.ul,
      uniqueUsers: d.users,
      peakUsers: d.peak,
      peakTime: d.peakTime,
    })),
  });
  console.log('✓ 7 Bandwidth Daily Usage records seeded');

  // ═══════════════════════════════════════════════════════════════
  // 36. CONTENT FILTERS (4)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Content Filters (4)...');
  await prisma.contentFilter.createMany({
    data: [
      {
        id: uuid('contentfilter-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Social Media Block',
        category: 'social_media',
        domains: JSON.stringify(['facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com', 'snapchat.com']),
        enabled: false,
        scheduleId: null,
      },
      {
        id: uuid('contentfilter-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Adult Content Block',
        category: 'adult',
        domains: JSON.stringify(['*adult*', '*porn*', '*xxx*']),
        enabled: true,
        scheduleId: null,
      },
      {
        id: uuid('contentfilter-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Malware Protection',
        category: 'malware',
        domains: JSON.stringify(['*malware*', '*phishing*', '*ransomware*']),
        enabled: true,
        scheduleId: null,
      },
      {
        id: uuid('contentfilter-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Ad Blocker',
        category: 'ads',
        domains: JSON.stringify(['*doubleclick*', '*googlesyndication*', '*adnxs*', '*adserv*']),
        enabled: true,
        scheduleId: FW_SCHED_IDS.night,
      },
    ],
  });
  console.log('✓ 4 Content Filters seeded');

  // ═══════════════════════════════════════════════════════════════
  // 37. SYSLOG SERVER (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Syslog Server (1)...');
  await prisma.syslogServer.create({
    data: {
      id: uuid('syslog-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      name: 'Local Syslog Server',
      protocol: 'udp',
      host: '127.0.0.1',
      port: 514,
      format: 'ietf',
      facility: 'local1',
      severity: 'info',
      categories: JSON.stringify(['auth', 'firewall', 'dhcp', 'dns', 'portal']),
      enabled: true,
      tlsCertPath: null,
      tlsVerify: true,
    },
  });
  console.log('✓ 1 Syslog Server seeded');

  // ═══════════════════════════════════════════════════════════════
  // 38. NAT LOGS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding NAT Logs (3)...');
  await prisma.natLog.createMany({
    data: [
      {
        id: uuid('natlog-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        timestamp: hour(-2),
        sourceIp: '192.168.10.105',
        sourcePort: 54321,
        destIp: '142.250.80.46',
        destPort: 443,
        protocol: 'tcp',
        destDomain: 'www.google.com',
        action: 'allow',
        bytes: 524288,
        sessionId: uuid('wifisession-1'),
      },
      {
        id: uuid('natlog-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        timestamp: hour(-4),
        sourceIp: '192.168.10.110',
        sourcePort: 54322,
        destIp: '13.107.42.14',
        destPort: 443,
        protocol: 'tcp',
        destDomain: 'api.microsoft.com',
        action: 'allow',
        bytes: 1048576,
        sessionId: uuid('wifisession-2'),
      },
      {
        id: uuid('natlog-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        timestamp: hour(-6),
        sourceIp: '192.168.10.140',
        sourcePort: 54323,
        destIp: '45.33.32.156',
        destPort: 443,
        protocol: 'tcp',
        destDomain: 'suspicious-domain.xyz',
        action: 'deny',
        bytes: 0,
        sessionId: uuid('wifisession-9'),
      },
    ],
  });
  console.log('✓ 3 NAT Logs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 39. NETWORK CONFIG BACKUPS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Network Config Backups (2)...');
  await prisma.networkConfigBackup.createMany({
    data: [
      {
        id: uuid('netbackup-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Weekly Auto-Backup',
        configData: JSON.stringify({
          interfaces: { eth0: { type: 'wan', ip: 'dhcp' }, eth1: { type: 'lan', ip: '192.168.1.1/24' } },
          vlans: { 10: 'Guest', 20: 'Staff', 30: 'POS', 40: 'IoT', 50: 'Management' },
          dhcp: { guest: '192.168.10.0/24', staff: '192.168.20.0/24' },
          firewall: { defaultPolicy: 'drop', rules: 6 },
        }),
        version: 12,
        autoBackup: true,
        createdAt: day(-1),
      },
      {
        id: uuid('netbackup-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Manual Pre-Maintenance Backup',
        configData: JSON.stringify({
          interfaces: { eth0: { type: 'wan', ip: 'dhcp' }, eth1: { type: 'lan', ip: '192.168.1.1/24' } },
          vlans: { 10: 'Guest', 20: 'Staff', 30: 'POS', 40: 'IoT', 50: 'Management' },
          note: 'Pre-maintenance snapshot before firmware upgrade',
        }),
        version: 11,
        autoBackup: false,
        createdAt: day(-5),
      },
    ],
  });
  console.log('✓ 2 Network Config Backups seeded');

  // ═══════════════════════════════════════════════════════════════
  // 40. SYSTEM NETWORK HEALTH (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding System Network Health (1)...');
  await prisma.systemNetworkHealth.create({
    data: {
      id: uuid('syshealth-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      hostname: 'gateway.royalstay.local',
      kernelVersion: '6.1.0-17-amd64',
      uptime: 864000, // 10 days
      cpuUsage: 23.5,
      ramTotal: 8192,
      ramUsed: 3276,
      diskTotal: 128000,
      diskUsed: 42000,
      cpuTemperature: 48.2,
      services: JSON.stringify({
        freeradius: { running: true, pid: 1234, uptime: 864000 },
        kea: { running: true, pid: 5678, uptime: 864000 },
        dnsmasq: { running: true, pid: 9012, uptime: 864000 },
        nftables: { running: true, rules: 24 },
        nginx: { running: true, pid: 3456, uptime: 864000 },
      }),
      lastUpdated: min(-1),
    },
  });
  console.log('✓ 1 System Network Health seeded');

  console.log('\n📡 WiFi module seed data completed! All 40 categories seeded.');
}
