import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function seed() {
  console.log('Seeding help categories...');

  const categories = [
    { name: 'Getting Started', slug: 'getting-started', icon: 'rocket', sortOrder: 0, description: 'Onboarding and initial setup guides' },
    { name: 'Bookings', slug: 'bookings', icon: 'calendar', sortOrder: 1, description: 'Booking management and reservation workflows' },
    { name: 'Guests', slug: 'guests', icon: 'users', sortOrder: 2, description: 'Guest profiles, communication, and loyalty' },
    { name: 'Housekeeping', slug: 'housekeeping', icon: 'wrench', sortOrder: 3, description: 'Room cleaning, inspections, and maintenance' },
    { name: 'Revenue', slug: 'revenue', icon: 'dollar-sign', sortOrder: 4, description: 'Pricing, billing, and financial management' },
    { name: 'Reports', slug: 'reports', icon: 'bar-chart', sortOrder: 5, description: 'Analytics, dashboards, and data exports' },
    { name: 'Settings', slug: 'settings', icon: 'settings', sortOrder: 6, description: 'System configuration and preferences' },
    { name: 'Integrations', slug: 'integrations', icon: 'puzzle', sortOrder: 7, description: 'Third-party connections and API integrations' },
  ];

  for (const cat of categories) {
    const existing = await p.helpCategory.findUnique({ where: { slug: cat.slug } });
    if (!existing) {
      await p.helpCategory.create({ data: cat });
      console.log(`  Created category: ${cat.name}`);
    } else {
      console.log(`  Category exists: ${cat.name}`);
    }
  }

  console.log('\nSeeding help articles...');

  const tenantId = 'tenant-1';

  const articles = [
    {
      title: 'Getting Started with StaySuite',
      slug: 'getting-started-with-staysuite',
      content: `# Getting Started with StaySuite

Welcome to StaySuite! This guide will walk you through the essential steps to get your property up and running.

## Step 1: Configure Your Property

Navigate to **Settings > Property** to set up your property details:
- Property name and address
- Contact information
- Check-in and check-out times
- Currency and timezone settings
- Amenities and services offered

## Step 2: Set Up Room Types

Create room types that match your property's inventory:
- Go to **PMS > Room Types**
- Define each room type (Standard, Suite, Deluxe, etc.)
- Set base prices, maximum occupancy, and amenities
- Upload photos for each room type

## Step 3: Add Your Rooms

After creating room types, add individual rooms:
- Navigate to **PMS > Rooms**
- Assign each room to a room type
- Set floor numbers and room features
- Configure housekeeping status defaults

## Step 4: Create Your First Booking

With rooms set up, you're ready to accept reservations:
- Go to **Bookings > New Booking**
- Enter guest details and select a room
- Set check-in/out dates and apply rates
- Confirm the booking

## Step 5: Configure Notifications

Set up automated guest communications:
- Navigate to **Settings > Notifications**
- Configure email and SMS templates
- Set triggers for booking confirmations, reminders, and follow-ups`,
      excerpt: 'Complete onboarding guide — configure your property, rooms, and first booking in 5 steps.',
      category: 'getting-started',
      status: 'published',
      viewCount: 342,
      helpfulCount: 89,
      notHelpfulCount: 3,
    },
    {
      title: 'Understanding the Dashboard',
      slug: 'understanding-the-dashboard',
      content: `# Understanding the Dashboard

The StaySuite dashboard is your command center for daily hotel operations.

## KPI Cards

The top row of cards displays key performance indicators:
- **Occupancy Rate**: Current percentage of occupied rooms vs total available
- **Today's Revenue**: Total revenue generated today from all sources
- **Active Bookings**: Number of bookings currently in progress
- **Tasks Due**: Pending housekeeping and maintenance tasks

## Quick Actions

Quick action buttons let you perform common operations instantly:
- **New Booking**: Jump straight to the booking creation form
- **Check-In**: Process a guest arrival
- **Check-Out**: Complete a guest departure
- **New Task**: Create a housekeeping or maintenance task

## Charts and Analytics

The dashboard includes interactive charts:
- **Occupancy Trend**: 7-day or 30-day occupancy visualization
- **Revenue Chart**: Daily revenue breakdown
- **Room Status**: Visual overview of room conditions
- **Upcoming Arrivals/Departures**: Today's expected guest movements

## Activity Feed

The activity feed shows recent system events:
- New bookings created
- Check-ins and check-outs
- Room status changes
- Payment transactions`,
      excerpt: 'Learn how to read and customize your main dashboard — KPIs, charts, quick actions, and activity feed.',
      category: 'getting-started',
      status: 'published',
      viewCount: 256,
      helpfulCount: 67,
      notHelpfulCount: 5,
    },
    {
      title: 'User Roles and Permissions',
      slug: 'user-roles-and-permissions',
      content: `# User Roles and Permissions

StaySuite uses a role-based access control (RBAC) system to manage user access.

## Default Roles

| Role | Access Level |
|------|-------------|
| **Admin** | Full access to all modules and settings |
| **Manager** | Access to operations, reports, and guest management |
| **Front Desk** | Bookings, check-in/out, guest lookup |
| **Housekeeping** | Room tasks, inspections, and status updates |
| **Revenue Manager** | Pricing, rates, and financial reports |

## Managing Roles

To assign or modify roles:
1. Go to **Settings > User Management**
2. Select a user from the list
3. Click **Edit** and choose a role
4. Save changes

## Custom Permissions

Admins can create custom roles with granular permissions:
- Navigate to **Settings > Roles & Permissions**
- Click **Create Role**
- Select which modules and actions the role can access
- Assign the role to users`,
      excerpt: 'Complete guide to RBAC — default roles, custom permissions, and managing user access levels.',
      category: 'getting-started',
      status: 'published',
      viewCount: 198,
      helpfulCount: 54,
      notHelpfulCount: 2,
    },
    {
      title: 'How to Create a New Booking',
      slug: 'how-to-create-new-booking',
      content: `# How to Create a New Booking

Creating bookings in StaySuite is straightforward.

## Manual Booking

1. Navigate to **Bookings** in the sidebar
2. Click the **New Booking** button
3. Fill in the guest information:
   - First name and last name
   - Email address
   - Phone number
   - Special requests (optional)
4. Select check-in and check-out dates
5. Choose a room type or specific room
6. Review the rate and applicable charges
7. Click **Confirm Booking**

## Booking Statuses

| Status | Description |
|--------|-------------|
| **Confirmed** | Reservation is confirmed and guaranteed |
| **Checked In** | Guest has arrived and room is occupied |
| **Checked Out** | Guest has departed |
| **Cancelled** | Reservation was cancelled |
| **No Show** | Guest did not arrive |

## Modifying a Booking

To change dates, rooms, or guest details:
1. Find the booking in the list
2. Click on it to open details
3. Click **Edit**
4. Make your changes and save

## Cancellation Policies

Cancellation policies are applied automatically based on the rate plan rules.`,
      excerpt: 'Step-by-step guide to creating, modifying, and managing reservations in StaySuite.',
      category: 'bookings',
      status: 'published',
      viewCount: 423,
      helpfulCount: 112,
      notHelpfulCount: 8,
    },
    {
      title: 'Managing Group Bookings and Blocks',
      slug: 'managing-group-bookings',
      content: `# Managing Group Bookings and Blocks

Group bookings allow you to block multiple rooms for events, conferences, or tour groups.

## Creating a Group Block

1. Go to **Bookings > Group Bookings**
2. Click **New Group Block**
3. Enter group details:
   - Group name and contact person
   - Event dates
   - Room type and quantity needed
   - Special requirements
4. Set cut-off date (last day to release unbooked rooms)
5. Configure rate and payment terms

## Managing Room Inventory

- Blocked rooms are excluded from general availability
- Release rooms back to inventory as the cut-off date approaches
- Override individual room assignments within the block

## Best Practices

- Set realistic cut-off dates to maximize revenue
- Use naming conventions for easy identification
- Track pickup regularly and release rooms early if needed`,
      excerpt: 'Learn how to create room blocks, manage group inventory, and track group booking performance.',
      category: 'bookings',
      status: 'published',
      viewCount: 156,
      helpfulCount: 41,
      notHelpfulCount: 1,
    },
    {
      title: 'Guest Profile Management',
      slug: 'guest-profile-management',
      content: `# Guest Profile Management

Guest profiles are the foundation of personalized hospitality.

## Automatic Profile Creation

A guest profile is created when:
- A new booking is made
- A guest checks in
- An inquiry is submitted

## Profile Information

Each profile contains:
- **Personal Info**: Name, email, phone, address
- **Preferences**: Room type, floor, pillow type, dietary needs
- **Stay History**: All past and upcoming visits
- **Communication Log**: Emails, SMS, and notes
- **Loyalty Data**: Points balance, tier status, perks
- **Special Flags**: VIP, Do Not Rent, preferences

## Guest Segmentation

Use tags and segments to organize your guest database:
- **VIP**: High-value guests requiring special attention
- **Corporate**: Business travelers with company accounts
- **Leisure**: Vacation and holiday guests
- **Extended Stay**: Long-term residents

## Privacy and GDPR

- Guests can request data access or deletion
- All data processing activities are logged
- Consent management is built into communication flow`,
      excerpt: 'How to create, manage, and segment guest profiles for personalized service delivery.',
      category: 'guests',
      status: 'published',
      viewCount: 187,
      helpfulCount: 63,
      notHelpfulCount: 4,
    },
    {
      title: 'Housekeeping Task Management',
      slug: 'housekeeping-task-management',
      content: `# Housekeeping Task Management

The housekeeping module helps you maintain room quality efficiently.

## Automatic Task Generation

Tasks are created automatically when:
- A guest checks out (trigger cleaning)
- A room inspection fails (trigger re-cleaning)
- A maintenance issue is reported

## Task Types

| Type | Description |
|------|-------------|
| **Cleaning** | Standard room cleaning after checkout or stay-over |
| **Deep Clean** | Thorough cleaning including furniture, carpets, windows |
| **Inspection** | Quality check using a checklist template |
| **Maintenance** | Repair or service request |

## Priority Levels

- **Urgent**: Immediate attention needed (maintenance issue)
- **High**: VIP room or early arrival expected
- **Normal**: Standard turnaround
- **Low**: Non-urgent deep clean or seasonal task

## Performance Tracking

- Average cleaning time per room type
- Task completion rate
- Inspection pass rate
- Staff productivity metrics`,
      excerpt: 'Complete guide to managing housekeeping tasks, priorities, and performance metrics.',
      category: 'housekeeping',
      status: 'published',
      viewCount: 278,
      helpfulCount: 85,
      notHelpfulCount: 6,
    },
    {
      title: 'Room Inspection Checklists',
      slug: 'room-inspection-checklists',
      content: `# Room Inspection Checklists

Inspection checklists ensure consistent room quality across your property.

## Built-in Templates

- **Standard Room Inspection**: 23 items covering bathroom, bedroom, and general areas
- **VIP Suite Inspection**: 15 items with additional luxury checks
- **Deep Clean Inspection**: 10 items for thorough cleaning verification
- **Public Area Inspection**: 8 items for lobbies and common areas

## Creating Custom Templates

1. Go to **Housekeeping > Inspection Checklists**
2. Switch to the **Templates** tab
3. Click **New Template**
4. Define your checklist items with categories and required flags
5. Save and activate

## Conducting an Inspection

1. Go to **Inspect Room** tab
2. Select a property, room, and template
3. Mark each item as Pass or Fail
4. Add notes for failed items
5. Submit the inspection

## Scoring

- Score = (Passed Required Items / Total Required Items) x 100
- Only 100% score passes (strict quality standard)
- Failed inspections auto-assign re-cleaning tasks`,
      excerpt: 'How to create, customize, and use inspection checklists for quality assurance.',
      category: 'housekeeping',
      status: 'published',
      viewCount: 198,
      helpfulCount: 72,
      notHelpfulCount: 2,
    },
    {
      title: 'Setting Up Pricing and Rate Plans',
      slug: 'setting-up-pricing-rate-plans',
      content: `# Setting Up Pricing and Rate Plans

Effective pricing is key to maximizing revenue.

## Rate Plan Types

| Plan | Use Case |
|------|----------|
| **BAR** | Default public rate |
| **Corporate** | Negotiated rates for business clients |
| **Package** | Room + amenity bundles |
| **Promotional** | Limited-time discounts |
| **Group** | Group booking rates |

## Creating a Rate Plan

1. Go to **Revenue > Rate Plans**
2. Click **Create Rate Plan**
3. Define name, room types, base rate, restrictions
4. Activate the plan

## Seasonal Pricing

1. Go to **Revenue > Pricing Rules**
2. Click **Create Rule**
3. Set date ranges and rate modifiers
4. Apply to specific room types or all rooms

## Dynamic Pricing Tips

- Monitor competitor rates regularly
- Adjust for local events and holidays
- Set minimum rate thresholds to protect margins
- Review and adjust rates at least weekly`,
      excerpt: 'Learn how to create rate plans, set seasonal pricing, and implement revenue optimization.',
      category: 'revenue',
      status: 'published',
      viewCount: 167,
      helpfulCount: 48,
      notHelpfulCount: 3,
    },
    {
      title: 'Reports and Analytics Overview',
      slug: 'reports-analytics-overview',
      content: `# Reports and Analytics Overview

StaySuite provides comprehensive reporting tools for data-driven decisions.

## Available Reports

### Operational Reports
- **Occupancy Report**: Daily, weekly, monthly occupancy rates
- **Arrivals & Departures**: Upcoming guest movements
- **Room Status Report**: Current condition of all rooms
- **Housekeeping Performance**: Cleaning times and inspection results

### Financial Reports
- **Revenue Report**: Total revenue by source and period
- **ADR**: Average Daily Rate performance metric
- **RevPAR**: Revenue Per Available Room efficiency metric
- **Payment Summary**: Collections by payment method

### Guest Reports
- **Guest Demographics**: Origin, purpose of visit, preferences
- **Loyalty Program**: Points and tier distribution
- **Stay History**: Repeat guest analysis

## Exporting Reports

All reports can be exported as PDF, CSV, or Excel.

## Scheduled Reports

Set up automated report delivery with configurable frequency and recipients.`,
      excerpt: 'Overview of all available reports, custom report builder, and export/scheduling options.',
      category: 'reports',
      status: 'published',
      viewCount: 234,
      helpfulCount: 71,
      notHelpfulCount: 4,
    },
    {
      title: 'System Configuration Guide',
      slug: 'system-configuration-guide',
      content: `# System Configuration Guide

Key configuration options in StaySuite settings.

## Property Settings

- Property name, address, and contact details
- Star rating and property type
- Check-in and check-out times
- Timezone and currency
- Tax rates and billing rules

## Notification Templates

Customize automated messages with variables:
- Booking confirmation
- Pre-arrival reminder
- Check-in instructions
- Post-stay thank you
- Cancellation notice

## Integration Settings

- Payment gateways (API keys, webhooks)
- Channel manager settings
- CRM connections
- Email service provider (SMTP)

## Recommended Setup Checklist

- [ ] Set property details and contact info
- [ ] Configure check-in/out times
- [ ] Set up tax rules
- [ ] Customize notification templates
- [ ] Connect payment gateway
- [ ] Configure user roles
- [ ] Set up backup schedule`,
      excerpt: 'Complete configuration guide — property settings, notifications, integrations, and security.',
      category: 'settings',
      status: 'published',
      viewCount: 176,
      helpfulCount: 58,
      notHelpfulCount: 3,
    },
    {
      title: 'Payment Gateway Integration',
      slug: 'payment-gateway-integration',
      content: `# Payment Gateway Integration

StaySuite integrates with popular payment processors.

## Supported Gateways

| Gateway | Online | POS | Refunds |
|---------|--------|-----|---------|
| **Stripe** | Yes | Yes | Yes |
| **PayPal** | Yes | No | Yes |
| **Square** | Yes | Yes | Yes |
| **Adyen** | Yes | Yes | Yes |

## Setting Up Stripe

1. Go to **Settings > Integrations > Payment Gateways**
2. Select **Stripe**
3. Enter your API keys (Publishable Key and Secret Key)
4. Configure webhook endpoint
5. Test with a small transaction
6. Enable for production

## Webhook Configuration

Payment gateways use webhooks to notify StaySuite of:
- Payment succeeded / failed
- Refund processed
- Dispute opened

## Testing

Always test in sandbox mode before going live:
1. Enable test mode in gateway settings
2. Use test card numbers
3. Verify payment recording
4. Test refund processing
5. Switch to live mode`,
      excerpt: 'How to connect and configure payment gateways — Stripe, PayPal, Square, and Adyen.',
      category: 'integrations',
      status: 'published',
      viewCount: 203,
      helpfulCount: 61,
      notHelpfulCount: 7,
    },
  ];

  for (const article of articles) {
    const existing = await p.helpArticle.findFirst({ where: { slug: article.slug, tenantId } });
    if (!existing) {
      await p.helpArticle.create({
        data: {
          tenantId,
          ...article,
          tags: '[]',
          publishedAt: new Date('2026-03-15'),
          createdAt: new Date('2026-03-15'),
          updatedAt: new Date('2026-04-01'),
        },
      });
      console.log(`  Created article: ${article.title}`);
    } else {
      console.log(`  Article exists: ${article.title}`);
    }
  }

  console.log('\nDone! Help content seeded successfully.');
}

seed()
  .catch(console.error)
  .finally(() => p.$disconnect());
