# StaySuite Product Overview
## All-in-One Hospitality Operating System

**Version**: 1.0  
**Last Updated**: March 2026  
**Author**: Cryptsk Pvt Ltd

---

## 1. Executive Summary

### 1.1 Product Definition

**StaySuite** is an enterprise-grade, cloud-native hospitality operating system that unifies all aspects of hotel operations into a single, intelligent platform. Unlike traditional Property Management Systems (PMS), StaySuite is positioned as a complete **Hospitality Operating System** — covering guest journey, revenue, operations, marketing, and intelligence.

### 1.2 Target Market

| Segment | Description |
|---------|-------------|
| **Boutique Hotels** | 10-50 rooms, design-focused properties |
| **Business Hotels** | 50-200 rooms, corporate travelers |
| **Resorts** | 50-300 rooms, leisure destinations |
| **Hotel Chains** | Multi-property groups, 2-100+ properties |
| **Serviced Apartments** | Extended stay properties |
| **Hostels** | Budget accommodations |

### 1.3 Key Differentiators

| Differentiator | Description |
|----------------|-------------|
| **WiFi AAA Gateway** | Industry-first native RADIUS/AAA integration with multi-vendor support |
| **AI Revenue Engine** | Machine learning for dynamic pricing and demand forecasting |
| **Unified Channel Manager** | 46+ OTA connections with real-time sync |
| **Guest Journey Engine** | Complete lifecycle management from discovery to retention |
| **Unified Communication Hub** | Single inbox for OTA, WhatsApp, Email, SMS |

---

## 2. Product Vision

### 2.1 Mission Statement

To modernize hospitality operations with intelligent, reliable, and scalable software that empowers hotels to deliver exceptional guest experiences while maximizing revenue and operational efficiency.

### 2.2 Product Philosophy

1. **Unified Platform**: One system for all operations — no more fragmented tools
2. **AI-First**: Intelligence built into every workflow
3. **Guest-Centric**: Every feature designed around guest experience
4. **Integration-Ready**: Open APIs and extensible architecture
5. **Enterprise-Grade**: Security, reliability, and scalability by design

---

## 3. Product Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    STAYSUITE PLATFORM                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Web App   │  │  Guest App  │  │  Staff App  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                      API Gateway                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │   PMS   │ │Booking  │ │Billing  │ │  WiFi   │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │   CRM   │ │Channel  │ │Revenue  │ │   AI    │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
├─────────────────────────────────────────────────────────────┤
│                    Core Services                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│  │   Auth    │ │  Events   │ │  Queue    │                  │
│  └───────────┘ └───────────┘ └───────────┘                  │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│  │PostgreSQL │ │   Redis   │ │   S3      │                  │
│  └───────────┘ └───────────┘ └───────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 18, TypeScript |
| Backend | Node.js, Next.js API Routes |
| Database | PostgreSQL with Prisma ORM |
| Real-time | WebSocket with Socket.io |
| Queue | BullMQ |
| Cache | Redis |
| Storage | S3-compatible object storage |

### 3.3 Multi-Tenant Architecture

```
Request → Middleware → Resolve Tenant → Attach tenant_id → Enforce RLS → Process
```

- Complete tenant isolation at database level
- Row-Level Security (RLS) enforcement
- Tenant-specific configurations and branding

---

## 4. Core Modules

### 4.1 Property Management System (PMS)

| Module | Description |
|--------|-------------|
| Properties | Multi-property configuration |
| Room Types | Logical room categories |
| Rooms | Physical inventory with status |
| Inventory Calendar | Date-wise availability |
| Rate Plans | Pricing models |
| Pricing Rules | Dynamic adjustments |

### 4.2 Booking Engine

| Module | Description |
|--------|-------------|
| Calendar View | Visual booking interface |
| Bookings | Reservation management |
| Group Bookings | Multi-room bookings |
| Waitlist | Queue management |
| Conflicts | Overlap detection |

### 4.3 Guest Management

| Module | Description |
|--------|-------------|
| Guest Profiles | Guest directory |
| KYC/Documents | Identity management |
| Preferences | Guest preferences |
| Stay History | Visit timeline |
| Loyalty | Rewards program |

### 4.4 Front Desk Operations

| Module | Description |
|--------|-------------|
| Check-in | Arrival processing |
| Check-out | Departure processing |
| Walk-in | Direct bookings |
| Room Grid | Status dashboard |

### 4.5 Guest Experience

| Module | Description |
|--------|-------------|
| Service Requests | Guest requests |
| Guest Chat | Messaging |
| In-Room Portal | QR-based access |
| Digital Keys | Mobile access |

### 4.6 WiFi Management

| Module | Description |
|--------|-------------|
| Sessions | Active connections |
| Vouchers | Access codes |
| Plans | Bandwidth tiers |
| Usage | Data consumption |
| Gateway | Equipment config |

### 4.7 Billing & Payments

| Module | Description |
|--------|-------------|
| Folios | Charge containers |
| Invoices | Billing documents |
| Payments | Transaction tracking |
| Refunds | Reversals |
| Discounts | Price adjustments |

### 4.8 Restaurant & POS

| Module | Description |
|--------|-------------|
| Orders | Order management |
| Tables | Seating |
| Kitchen (KDS) | Display system |
| Menu | Items and pricing |

### 4.9 Housekeeping & Maintenance

| Module | Description |
|--------|-------------|
| Tasks | Cleaning tasks |
| Kanban | Workflow board |
| Room Status | Clean/dirty tracking |
| Maintenance | Issue tracking |
| Assets | Equipment |

### 4.10 Inventory & Procurement

| Module | Description |
|--------|-------------|
| Stock | Inventory items |
| Consumption | Usage tracking |
| Alerts | Low stock |
| Vendors | Suppliers |
| Purchase Orders | Procurement |

### 4.11 Channel Manager

| Module | Description |
|--------|-------------|
| OTA Connections | Channel setup |
| Inventory Sync | Availability push |
| Rate Sync | Pricing push |
| Booking Import | Reservation import |
| Restrictions | Stop-sell rules |
| CRS | Central reservation |

### 4.12 Revenue Management

| Module | Description |
|--------|-------------|
| Pricing Rules | Dynamic rules |
| Demand Forecast | Predictions |
| Competitor Pricing | Rate shopping |
| AI Suggestions | Recommendations |

### 4.13 CRM & Marketing

| Module | Description |
|--------|-------------|
| Segments | Guest grouping |
| Campaigns | Marketing outreach |
| Loyalty Programs | Rewards |
| Feedback | Reviews |

### 4.14 Automation

| Module | Description |
|--------|-------------|
| Workflows | Event-triggered actions |
| Rules Engine | Condition logic |
| Templates | Reusable flows |
| Execution Logs | Run history |

### 4.15 Reports & BI

| Module | Description |
|--------|-------------|
| Revenue | Income reports |
| Occupancy | Room utilization |
| ADR/RevPAR | KPIs |
| Guest Analytics | Behavior |
| Staff Performance | Productivity |

### 4.16 AI Module

| Module | Description |
|--------|-------------|
| Copilot | Natural language queries |
| Insights | AI recommendations |
| Provider Settings | LLM configuration |

---

## 5. Integration Ecosystem

### 5.1 Channel Manager Integrations

- Booking.com, Expedia, Airbnb, Agoda
- MakeMyTrip, Goibibo, Yatra, OYO
- Amadeus, Sabre, Travelport
- Google Hotel Ads, TripAdvisor, Trivago

### 5.2 Payment Gateway Integrations

- Stripe, PayPal, Razorpay
- Square, Adyen, Authorize.net
- CCAvenue, PayU

### 5.3 WiFi Gateway Integrations

- Cisco, MikroTik, Ruckus
- Huawei, Juniper, Fortinet
- Aruba, Ubiquiti, D-Link

### 5.4 Door Lock Integrations

- Assa Abloy, dormakaba, Salto
- ONITY, August

### 5.5 IoT Integrations

- Smart room controls
- Energy management
- Occupancy sensors

---

## 6. Security & Compliance

### 6.1 Authentication

- JWT with refresh tokens
- Two-factor authentication (TOTP)
- SSO (SAML 2.0, OIDC, LDAP)
- Device session management

### 6.2 Authorization

- Role-Based Access Control (RBAC)
- Attribute-Based Access Control (ABAC)
- Granular permissions per module

### 6.3 Data Protection

- TLS 1.3 encryption in transit
- AES-256 encryption at rest
- PCI-compliant tokenization
- GDPR compliance tools

### 6.4 Audit & Compliance

- Complete audit logging
- Soft delete for critical data
- Data export for GDPR
- Retention policies

---

## 7. Deployment Options

| Option | Description |
|--------|-------------|
| **Cloud SaaS** | Multi-tenant hosted |
| **Private Cloud** | Single-tenant dedicated |
| **On-Premise** | Self-hosted |
| **Hybrid** | Mixed deployment |

---

## 8. Support & Maintenance

### 8.1 Support Channels

- Email: support@cryptsk.com
- In-app chat
- Help center
- Documentation portal

### 8.2 Support Tiers

| Priority | Response Time |
|----------|---------------|
| Critical | 15 minutes |
| High | 1 hour |
| Medium | 4 hours |
| Low | 24 hours |

---

## 9. Contact

**Cryptsk Pvt Ltd**

- **Website**: www.staysuite.io
- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd. All rights reserved.*
