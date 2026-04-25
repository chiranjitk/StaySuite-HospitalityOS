# StaySuite Data Flow Documentation
## System Data Movement & Event Architecture

**Version**: 1.0  
**Last Updated**: March 2026  
**Author**: Cryptsk Pvt Ltd

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Architecture](#2-data-architecture)
3. [Event-Driven Architecture](#3-event-driven-architecture)
4. [Booking Data Flow](#4-booking-data-flow)
5. [Payment Data Flow](#5-payment-data-flow)
6. [Channel Manager Data Flow](#6-channel-manager-data-flow)
7. [Real-Time Data Sync](#7-real-time-data-sync)
8. [Data Consistency Patterns](#8-data-consistency-patterns)
9. [Data Retention & Archival](#9-data-retention--archival)

---

## 1. Overview

### 1.1 Purpose

This document describes how data flows through the StaySuite platform, including:
- Data movement between modules
- Event-driven communication patterns
- External system integrations
- Data consistency mechanisms

### 1.2 Core Principles

| Principle | Description |
|-----------|-------------|
| **Module Ownership** | Each module owns its data; no cross-module DB writes |
| **Event-Driven** | Modules communicate via events, not direct calls |
| **Idempotency** | All operations safe to retry |
| **Audit Trail** | Every data change logged with context |
| **Tenant Isolation** | Data segregated by tenant_id |

### 1.3 Data Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CORE DATA ENTITIES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FOUNDATION                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │   Tenant    │  │   User      │  │   Role      │                 │   │
│  │  │             │  │             │  │             │                 │   │
│  │  │ • tenant_id │  │ • user_id   │  │ • role_id   │                 │   │
│  │  │ • name      │  │ • email     │  │ • name      │                 │   │
│  │  │ • status    │  │ • role_id   │  │ • perms[]   │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         PROPERTY                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │  Property   │  │  RoomType   │  │   Room      │                 │   │
│  │  │             │  │             │  │             │                 │   │
│  │  │ • prop_id   │  │ • type_id   │  │ • room_id   │                 │   │
│  │  │ • name      │  │ • name      │  │ • number    │                 │   │
│  │  │ • timezone  │  │ • base_rate │  │ • type_id   │                 │   │
│  │  │ • currency  │  │ • capacity  │  │ • status    │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          GUEST                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │   Guest     │  │  Document   │  │ Preference  │                 │   │
│  │  │             │  │   (KYC)     │  │             │                 │   │
│  │  │ • guest_id  │  │ • doc_id    │  │ • pref_id   │                 │   │
│  │  │ • name      │  │ • type      │  │ • guest_id  │                 │   │
│  │  │ • email     │  │ • url       │  │ • key       │                 │   │
│  │  │ • phone     │  │ • status    │  │ • value     │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         BOOKING                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │  Booking    │  │   Folio     │  │  LineItem   │                 │   │
│  │  │             │  │             │  │             │                 │   │
│  │  │ • book_id   │  │ • folio_id  │  │ • item_id   │                 │   │
│  │  │ • guest_id  │  │ • book_id   │  │ • folio_id  │                 │   │
│  │  │ • room_id   │  │ • total     │  │ • amount    │                 │   │
│  │  │ • status    │  │ • balance   │  │ • type      │                 │   │
│  │  │ • dates     │  │ • status    │  │ • metadata  │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         PAYMENT                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │  Payment    │  │  Refund     │  │  Invoice    │                 │   │
│  │  │             │  │             │  │             │                 │   │
│  │  │ • pay_id    │  │ • refund_id │  │ • inv_id    │                 │   │
│  │  │ • folio_id  │  │ • pay_id    │  │ • folio_id  │                 │   │
│  │  │ • amount    │  │ • amount    │  │ • number    │                 │   │
│  │  │ • method    │  │ • reason    │  │ • pdf_url   │                 │   │
│  │  │ • status    │  │ • status    │  │ • status    │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           WIFI                                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │WiFiSession  │  │  Voucher    │  │ WiFiPlan    │                 │   │
│  │  │             │  │             │  │             │                 │   │
│  │  │ • sess_id   │  │ • code      │  │ • plan_id   │                 │   │
│  │  │ • guest_id  │  │ • validity  │  │ • name      │                 │   │
│  │  │ • mac_addr  │  │ • data_limit│  │ • speed_up  │                 │   │
│  │  │ • bytes_in  │  │ • used      │  │ • speed_down│                 │   │
│  │  │ • bytes_out │  │ • status    │  │ • data_limit│                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Architecture

### 2.1 Multi-Tenant Data Isolation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT DATA ISOLATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     REQUEST FLOW                                     │   │
│  │                                                                      │   │
│  │   HTTP Request                                                       │   │
│  │        │                                                             │   │
│  │        ▼                                                             │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │ Middleware  │                                                   │   │
│  │   │             │                                                   │   │
│  │   │ 1. Extract  │                                                   │   │
│  │   │    subdomain│                                                   │   │
│  │   │             │                                                   │   │
│  │   │ 2. Resolve  │                                                   │   │
│  │   │    tenant_id│                                                   │   │
│  │   │             │                                                   │   │
│  │   │ 3. Validate │                                                   │   │
│  │   │    status   │                                                   │   │
│  │   └─────┬───────┘                                                   │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │ Attach      │                                                   │   │
│  │   │ tenant_id   │                                                   │   │
│  │   │ to context  │                                                   │   │
│  │   └─────┬───────┘                                                   │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │ Prisma RLS  │                                                   │   │
│  │   │ Middleware  │                                                   │   │
│  │   │             │                                                   │   │
│  │   │ SET         │                                                   │   │
│  │   │ app.current │                                                   │   │
│  │   │ _tenant_id  │                                                   │   │
│  │   └─────┬───────┘                                                   │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │                    DATABASE QUERY                            │   │   │
│  │   │                                                              │   │   │
│  │   │   SELECT * FROM bookings                                     │   │   │
│  │   │   WHERE tenant_id = current_setting('app.current_tenant_id')│   │   │
│  │   │                                                             │   │   │
│  │   │   -- RLS Policy automatically filters by tenant_id          │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     DATABASE RLS POLICY                              │   │
│  │                                                                      │   │
│  │   CREATE POLICY tenant_isolation ON bookings                        │   │
│  │   USING (tenant_id = current_setting('app.current_tenant_id'));     │   │
│  │                                                                      │   │
│  │   -- Applied to ALL tables with tenant_id                           │   │
│  │   -- Prevents cross-tenant data access at database level            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Data Ownership

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MODULE DATA OWNERSHIP                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │   MODULE           OWNS DATA              ACCESSES (READ)              │  │
│  │   ─────────────────────────────────────────────────────────────────   │  │
│  │                                                                        │  │
│  │   PMS              Property, Room,       ─                             │  │
│  │                    RoomType, Inventory                                  │  │
│  │                                                                        │  │
│  │   Booking          Booking, Folio,       Guest, Room, RatePlan        │  │
│  │                    LineItem                                            │  │
│  │                                                                        │  │
│  │   Guest            Guest, Document,      Booking (for history)        │  │
│  │                    Preference, Loyalty                                 │  │
│  │                                                                        │  │
│  │   Billing          Payment, Refund,      Folio, Booking               │  │
│  │                    Invoice                                             │  │
│  │                                                                        │  │
│  │   WiFi             WiFiSession,          Guest, Booking               │  │
│  │                    Voucher, WiFiPlan                                   │  │
│  │                                                                        │  │
│  │   ChannelManager   ChannelMapping,       Property, Room, RatePlan     │  │
│  │                    SyncLog, IdempotencyKey                             │  │
│  │                                                                        │  │
│  │   Housekeeping     Task, Asset           Room, Booking, Staff         │  │
│  │                                                                        │  │
│  │   CRM              Segment, Campaign,    Guest, Booking               │  │
│  │                    LoyaltyTransaction                                  │  │
│  │                                                                        │  │
│  │   Reports          ─                     ALL (aggregated reads)       │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  RULE: No module writes to another module's data.                           │
│        All cross-module updates via events.                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Event-Driven Architecture

### 3.1 Event System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EVENT-DRIVEN ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        EVENT FLOW                                    │   │
│  │                                                                      │   │
│  │   Producer                    Event Bus                   Consumers   │   │
│  │      │                          │                            │       │   │
│  │      │  1. Emit Event           │                            │       │   │
│  │      │─────────────────────────▶│                            │       │   │
│  │      │                          │                            │       │   │
│  │      │                          │  2. Fan-out to            │       │   │
│  │      │                          │     subscribers           │       │   │
│  │      │                          │                            │       │   │
│  │      │                          │  ┌─────────────────────┐  │       │   │
│  │      │                          │  │ Event Store         │  │       │   │
│  │      │                          │  │ (for replay/audit)  │  │       │   │
│  │      │                          │  └─────────────────────┘  │       │   │
│  │      │                          │                            │       │   │
│  │      │                          │───────────────────────────▶│       │   │
│  │      │                          │                            │       │   │
│  │      │                          │     3. Process Event       │       │   │
│  │      │                          │                            │       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     EVENT FORMAT                                     │   │
│  │                                                                      │   │
│  │   {                                                                  │   │
│  │     "id": "evt_abc123",                    // Unique event ID       │   │
│  │     "type": "booking.created",             // Event type            │   │
│  │     "version": 1,                          // Schema version        │   │
│  │     "timestamp": "2026-03-15T10:00:00Z",   // ISO 8601             │   │
│  │     "tenant_id": "tenant_123",             // Tenant context        │   │
│  │     "correlation_id": "corr_xyz",          // Request trace ID     │   │
│  │     "data": {                              // Event payload         │   │
│  │       "booking_id": "book_456",                                      │   │
│  │       "guest_id": "guest_789",                                        │   │
│  │       "room_id": "room_101",                                          │   │
│  │       "check_in": "2026-03-15",                                       │   │
│  │       "check_out": "2026-03-17"                                       │   │
│  │     },                                                               │   │
│  │     "metadata": {                           // Additional info      │   │
│  │       "source": "booking-service",                                    │   │
│  │       "user_id": "user_001",                                          │   │
│  │       "ip_address": "192.168.1.100"                                   │   │
│  │     }                                                                │   │
│  │   }                                                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core Events Catalog

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CORE EVENTS CATALOG                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BOOKING EVENTS                                                              │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  Event                    Emitted By        Subscribers                     │
│  ───────────────────────────────────────────────────────────────────────    │
│  booking.created          Booking           WiFi, CRM, Channel, Notify      │
│  booking.confirmed        Booking           Channel, Notify, Automation     │
│  booking.modified         Booking           WiFi, Channel, Notify           │
│  booking.cancelled        Booking           WiFi, Channel, Notify, Refund   │
│  booking.checked_in       Booking           WiFi, Housekeeping, Notify      │
│  booking.checked_out      Booking           WiFi, Housekeeping, CRM, Notify │
│  booking.no_show          Booking           Channel, Notify                 │
│                                                                              │
│  PAYMENT EVENTS                                                              │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  Event                    Emitted By        Subscribers                     │
│  ───────────────────────────────────────────────────────────────────────    │
│  payment.initiated        Billing           Notify                          │
│  payment.completed        Billing           Booking, Notify, Automation     │
│  payment.failed           Billing           Notify, Automation              │
│  payment.refunded         Billing           Notify, CRM                     │
│  invoice.generated        Billing           Notify                          │
│                                                                              │
│  WIFI EVENTS                                                                 │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  Event                    Emitted By        Subscribers                     │
│  ───────────────────────────────────────────────────────────────────────    │
│  wifi.session.started     WiFi              Billing (if metered)            │
│  wifi.session.stopped     WiFi              Billing, Usage tracking         │
│  wifi.session.limit       WiFi              Notify, Billing                 │
│  wifi.auth.failed         WiFi              Security, Notify                │
│  wifi.voucher.used        WiFi              Billing (if paid)               │
│                                                                              │
│  GUEST EVENTS                                                                │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  Event                    Emitted By        Subscribers                     │
│  ───────────────────────────────────────────────────────────────────────    │
│  guest.created            Guest             CRM, Notify                     │
│  guest.profile_updated    Guest             CRM, Notify                     │
│  guest.preference_set     Guest             Automation                      │
│  guest.loyalty_updated    CRM               Notify                          │
│  guest.feedback_received  CRM               Notify, Automation              │
│                                                                              │
│  INVENTORY EVENTS                                                            │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  Event                    Emitted By        Subscribers                     │
│  ───────────────────────────────────────────────────────────────────────    │
│  inventory.updated        PMS               Channel                         │
│  inventory.locked         PMS               ─                               │
│  inventory.released       PMS               Channel                         │
│  rate.updated             PMS               Channel                         │
│                                                                              │
│  CHANNEL EVENTS                                                              │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  Event                    Emitted By        Subscribers                     │
│  ───────────────────────────────────────────────────────────────────────    │
│  channel.booking.received ChannelManager    Booking                         │
│  channel.sync.completed   ChannelManager    Notify                          │
│  channel.sync.failed      ChannelManager    Notify, Alert                   │
│                                                                              │
│  HOUSEKEEPING EVENTS                                                         │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  Event                    Emitted By        Subscribers                     │
│  ───────────────────────────────────────────────────────────────────────    │
│  task.created             Housekeeping      Notify, Staff App               │
│  task.assigned            Housekeeping      Notify                          │
│  task.completed           Housekeeping      Notify                          │
│  room.status_changed      Housekeeping      Front Desk                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BOOKING CREATED EVENT FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Booking Module                                                             │
│        │                                                                     │
│        │  booking.created                                                   │
│        │                                                                     │
│        ├──────────────────────────────┐                                     │
│        │                              │                                     │
│        ▼                              ▼                                     │
│   ┌─────────────┐              ┌─────────────┐                             │
│   │Event Store  │              │Event Router │                             │
│   │(Persist)    │              │             │                             │
│   └─────────────┘              └──────┬──────┘                             │
│                                       │                                      │
│           ┌───────────────┬───────────┼───────────┬───────────────┐        │
│           │               │           │           │               │        │
│           ▼               ▼           ▼           ▼               ▼        │
│     ┌───────────┐  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐│
│     │   WiFi    │  │    CRM    │ │  Channel  │ │  Notify   │ │Automation ││
│     │  Module   │  │  Module   │ │  Manager  │ │  Module   │ │  Engine   ││
│     └─────┬─────┘  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘│
│           │              │             │             │             │        │
│           ▼              ▼             ▼             ▼             ▼        │
│     ┌───────────┐  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐│
│     │Pre-prov.  │  │Create     │ │Sync       │ │Send       │ │Trigger    ││
│     │WiFi creds │  │guest      │ │inventory  │ │confirm    │ │workflows  ││
│     │(pending)  │  │profile    │ │to OTAs    │ │email      │ │           ││
│     └───────────┘  └───────────┘ └───────────┘ └───────────┘ └───────────┘│
│                                                                              │
│  Response: Async (fire-and-forget)                                          │
│  Retry: On failure, events re-queued with exponential backoff               │
│  Idempotency: Event ID checked before processing                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHECK-IN EVENT FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Front Desk                                                                 │
│        │                                                                     │
│        │  booking.checked_in                                                │
│        │                                                                     │
│        ▼                                                                     │
│   ┌─────────────┐                                                           │
│   │Event Router │                                                           │
│   └──────┬──────┘                                                           │
│          │                                                                   │
│    ┌─────┼─────┬─────────────┬─────────────┐                               │
│    │     │     │             │             │                               │
│    ▼     ▼     ▼             ▼             ▼                               │
│ ┌──────┐┌──────┐┌──────────┐┌──────────┐┌──────────┐                       │
│ │WiFi  ││House ││ Notify   ││Automation││CRM       │                       │
│ │      ││keep  ││          ││          ││          │                       │
│ └──┬───┘└──┬───┘└────┬─────┘└────┬─────┘└────┬─────┘                       │
│    │       │          │           │           │                             │
│    ▼       ▼          ▼           ▼           ▼                             │
│ ┌──────┐┌──────┐┌──────────┐┌──────────┐┌──────────┐                       │
│ │Enable││Update││Send      ││Trigger   ││Update    │                       │
│ │WiFi  ││room  ││welcome   ││check-in  ││stay      │                       │
│ │access││status││message   ││actions   ││count     │                       │
│ └──────┘└──────┘└──────────┘└──────────┘└──────────┘                       │
│    │                                                                        │
│    │  ┌─────────────────────────────────────────────────────────────┐      │
│    │  │                    WiFi ENABLE DETAIL                       │      │
│    │  │                                                             │      │
│    │  │  1. Create WiFi credentials for guest                       │      │
│    │  │  2. Generate vouchers (if configured)                       │      │
│    │  │  3. Push to RADIUS server                                   │      │
│    │  │  4. Send credentials via SMS/Email                          │      │
│    │  │                                                             │      │
│    │  └─────────────────────────────────────────────────────────────┘      │
│    │                                                                        │
│    ▼                                                                        │
│ ┌─────────────────────────────────────────────────────┐                    │
│ │                RADIUS SERVER                        │                    │
│ │                                                     │                    │
│ │  • Create user account                              │                    │
│ │  • Set bandwidth limits                             │                    │
│ │  • Set session timeout                              │                    │
│ │  • Ready for guest connection                       │                    │
│ │                                                     │                    │
│ └─────────────────────────────────────────────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Booking Data Flow

### 4.1 Complete Booking Lifecycle Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   COMPLETE BOOKING LIFECYCLE DATA FLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    1. BOOKING CREATION                               │   │
│  │                                                                      │   │
│  │   Input: Guest details, dates, room type                            │   │
│  │                                                                      │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐        │   │
│  │   │Validate │───▶│ Check   │───▶│  Lock   │───▶│ Create  │        │   │
│  │   │ Input   │    │Avail.   │    │Inventory│    │Booking  │        │   │
│  │   └─────────┘    └─────────┘    └─────────┘    └─────────┘        │   │
│  │                                        │                            │   │
│  │                                        ▼                            │   │
│  │                                   ┌─────────┐                       │   │
│  │                                   │  Emit   │                       │   │
│  │                                   │ Event   │                       │   │
│  │                                   └─────────┘                       │   │
│  │                                                                      │   │
│  │   Data Written: Booking record (status: DRAFT/CONFIRMED)            │   │
│  │   Events Emitted: booking.created                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    2. PAYMENT PROCESSING                             │   │
│  │                                                                      │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐        │   │
│  │   │Create   │───▶│ Process │───▶│ Update  │───▶│ Confirm │        │   │
│  │   │Folio    │    │Payment  │    │Folio    │    │Booking  │        │   │
│  │   └─────────┘    └─────────┘    └─────────┘    └─────────┘        │   │
│  │                       │                                            │   │
│  │                       ▼                                            │   │
│  │                  ┌─────────┐                                       │   │
│  │                  │Payment  │                                       │   │
│  │                  │Gateway  │                                       │   │
│  │                  └─────────┘                                       │   │
│  │                                                                      │   │
│  │   Data Written: Folio, Payment records                              │   │
│  │   Events Emitted: payment.completed, booking.confirmed              │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    3. PRE-ARRIVAL                                    │   │
│  │                                                                      │   │
│  │   Trigger: Automation (T-48 hours)                                  │   │
│  │                                                                      │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐                        │   │
│  │   │Send Pre │───▶│ Collect │───▶│ Update  │                        │   │
│  │   │Check-in │    │KYC/Prefs│    │Guest    │                        │   │
│  │   │Link     │    │         │    │Profile  │                        │   │
│  │   └─────────┘    └─────────┘    └─────────┘                        │   │
│  │                                                                      │   │
│  │   Data Written: Guest documents, Preferences                        │   │
│  │   Events Emitted: guest.profile_updated                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    4. CHECK-IN                                       │   │
│  │                                                                      │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐        │   │
│  │   │Verify   │───▶│ Assign  │───▶│ Update  │───▶│ Enable  │        │   │
│  │   │Guest    │    │Room     │    │Status   │    │WiFi     │        │   │
│  │   └─────────┘    └─────────┘    └─────────┘    └─────────┘        │   │
│  │                                        │                            │   │
│  │                                        ▼                            │   │
│  │                                   ┌─────────┐                       │   │
│  │                                   │  Emit   │                       │   │
│  │                                   │ Event   │                       │   │
│  │                                   └─────────┘                       │   │
│  │                                                                      │   │
│  │   Data Written: Booking (status: CHECKED_IN), Room status           │   │
│  │   Events Emitted: booking.checked_in, wifi.enabled                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    5. DURING STAY                                    │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │                        SERVICE CHARGES                       │   │   │
│  │   │                                                              │   │   │
│  │   │   POS Order ───▶ Create LineItem ───▶ Add to Folio          │   │   │
│  │   │   Service Request ───▶ Complete ───▶ Charge (if billable)   │   │   │
│  │   │   Mini-bar ───▶ Scan ───▶ Add to Folio                      │   │   │
│  │   │                                                              │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   Data Written: LineItems, WiFi sessions, Service requests          │   │
│  │   Events Emitted: wifi.session.*, service.request.*                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    6. CHECK-OUT                                      │   │
│  │                                                                      │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐        │   │
│  │   │Finalize │───▶│ Process │───▶│Generate │───▶│ Update  │        │   │
│  │   │Folio    │    │Payment  │    │Invoice  │    │Status   │        │   │
│  │   └─────────┘    └─────────┘    └─────────┘    └─────────┘        │   │
│  │                                        │                            │   │
│  │                        ┌───────────────┼───────────────┐           │   │
│  │                        │               │               │           │   │
│  │                        ▼               ▼               ▼           │   │
│  │                   ┌─────────┐   ┌─────────┐   ┌─────────┐         │   │
│  │                   │Disable  │   │Create   │   │Update   │         │   │
│  │                   │WiFi     │   │HK Task  │   │CRM      │         │   │
│  │                   └─────────┘   └─────────┘   └─────────┘         │   │
│  │                                                                      │   │
│  │   Data Written: Booking (status: CHECKED_OUT), Invoice, Payment     │   │
│  │   Events Emitted: booking.checked_out, wifi.disabled, etc.         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Payment Data Flow

### 5.1 Payment Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PAYMENT DATA FLOW                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PAYMENT INITIATION                                │   │
│  │                                                                      │   │
│  │   User                Billing Module           Payment Gateway       │   │
│  │     │                       │                        │               │   │
│  │     │ 1. Request Payment    │                        │               │   │
│  │     │──────────────────────▶│                        │               │   │
│  │     │                       │                        │               │   │
│  │     │                       │ 2. Create Payment      │               │   │
│  │     │                       │    Record (PENDING)    │               │   │
│  │     │                       │                        │               │   │
│  │     │                       │ 3. Select Gateway      │               │   │
│  │     │                       │    (by routing rules)  │               │   │
│  │     │                       │                        │               │   │
│  │     │                       │ 4. Initiate Payment    │               │   │
│  │     │                       │───────────────────────▶│               │   │
│  │     │                       │                        │               │   │
│  │     │ 5. Redirect/Token     │                        │               │   │
│  │     │◀──────────────────────│◀───────────────────────│               │   │
│  │     │                       │                        │               │   │
│  │     │ 6. Complete Auth      │                        │               │   │
│  │     │────────────────────────────────────────────────▶│               │   │
│  │     │                       │                        │               │   │
│  │     │ 7. Auth Result        │                        │               │   │
│  │     │◀────────────────────────────────────────────────│               │   │
│  │     │                       │                        │               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PAYMENT COMPLETION                                │   │
│  │                                                                      │   │
│  │   Payment Gateway      Billing Module           Database             │   │
│  │        │                     │                      │                 │   │
│  │        │ 1. Webhook/Callback │                      │                 │   │
│  │        │───────────────────▶│                      │                 │   │
│  │        │                     │                      │                 │   │
│  │        │                     │ 2. Verify Signature  │                 │   │
│  │        │                     │    & Idempotency     │                 │   │
│  │        │                     │                      │                 │   │
│  │        │                     │ 3. Start Transaction │                 │   │
│  │        │                     │─────────────────────▶│                 │   │
│  │        │                     │                      │                 │   │
│  │        │                     │ 4. Update Payment    │                 │   │
│  │        │                     │    (COMPLETED)       │                 │   │
│  │        │                     │─────────────────────▶│                 │   │
│  │        │                     │                      │                 │   │
│  │        │                     │ 5. Update Folio      │                 │   │
│  │        │                     │    Balance           │                 │   │
│  │        │                     │─────────────────────▶│                 │   │
│  │        │                     │                      │                 │   │
│  │        │                     │ 6. Commit            │                 │   │
│  │        │                     │─────────────────────▶│                 │   │
│  │        │                     │                      │                 │   │
│  │        │                     │ 7. Emit Event        │                 │   │
│  │        │                     │    payment.completed │                 │   │
│  │        │                     │                      │                 │   │
│  │        │ 8. ACK              │                      │                 │   │
│  │        │◀───────────────────│                      │                 │   │
│  │        │                     │                      │                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    GATEWAY FAILOVER                                  │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │                    Gateway Routing Rules                     │   │   │
│  │   │                                                              │   │   │
│  │   │   Priority:                                                 │   │   │
│  │   │   1. Stripe (primary)                                       │   │   │
│  │   │   2. Razorpay (secondary)                                   │   │   │
│  │   │   3. PayPal (fallback)                                      │   │   │
│  │   │                                                              │   │   │
│  │   │   Routing by:                                               │   │   │
│  │   │   • Currency (INR → Razorpay, USD → Stripe)                │   │   │
│  │   │   • Amount (large → direct bank transfer)                   │   │   │
│  │   │   • Card type (Amex → Stripe only)                          │   │   │
│  │   │   • Gateway health (auto-failover if down)                  │   │   │
│  │   │                                                              │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   Payment Failover Flow:                                            │   │
│  │   ─────────────────────────────────────────────────────────────     │   │
│  │                                                                      │   │
│  │   Gateway1 ──▶ Fail ──▶ Log Error ──▶ Try Gateway2 ──▶ Success     │   │
│  │                                                                      │   │
│  │   Data Written:                                                      │   │
│  │   • Payment attempt 1 (FAILED)                                      │   │
│  │   • Payment attempt 2 (COMPLETED)                                   │   │
│  │   • Audit log with both attempts                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Channel Manager Data Flow

### 6.1 Inbound Sync Flow (OTA → StaySuite)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INBOUND CHANNEL SYNC FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OTA           Webhook Handler      Channel Manager      StaySuite          │
│   │                  │                    │                   │              │
│   │ 1. New Booking   │                    │                   │              │
│   │    (Webhook)     │                    │                   │              │
│   │─────────────────▶│                    │                   │              │
│   │                  │                    │                   │              │
│   │                  │ 2. Verify HMAC     │                   │              │
│   │                  │    Signature       │                   │              │
│   │                  │                    │                   │              │
│   │                  │ 3. Check           │                   │              │
│   │                  │    Idempotency Key │                   │              │
│   │                  │                    │                   │              │
│   │                  │ 4. Forward to      │                   │              │
│   │                  │    Channel Manager │                   │              │
│   │                  │───────────────────▶│                   │              │
│   │                  │                    │                   │              │
│   │                  │                    │ 5. Map OTA Data   │              │
│   │                  │                    │    to Internal    │              │
│   │                  │                    │                   │              │
│   │                  │                    │ 6. Find/Create    │              │
│   │                  │                    │    Guest          │              │
│   │                  │                    │──────────────────▶│              │
│   │                  │                    │                   │              │
│   │                  │                    │ 7. Create Booking │              │
│   │                  │                    │    (with source)  │              │
│   │                  │                    │──────────────────▶│              │
│   │                  │                    │                   │              │
│   │                  │                    │ 8. Lock Inventory │              │
│   │                  │                    │──────────────────▶│              │
│   │                  │                    │                   │              │
│   │                  │                    │ 9. Create Folio   │              │
│   │                  │                    │──────────────────▶│              │
│   │                  │                    │                   │              │
│   │ 10. ACK          │                    │                   │              │
│   │◀─────────────────│◀───────────────────│◀──────────────────│              │
│   │                  │                    │                   │              │
│   │                  │ 11. Log Sync       │                   │              │
│   │                  │     (Success)      │                   │              │
│   │                  │                    │                   │              │
│   │                  │ 12. Mark           │                   │              │
│   │                  │     Idempotency    │                   │              │
│   │                  │     as Processed   │                   │              │
│   │                  │                    │                   │              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Outbound Sync Flow (StaySuite → OTA)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OUTBOUND CHANNEL SYNC FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  StaySuite          Event Bus          Channel Manager          OTA         │
│     │                   │                    │                    │         │
│     │ 1. Inventory      │                    │                    │         │
│     │    Updated        │                    │                    │         │
│     │──────────────────▶│                    │                    │         │
│     │                   │                    │                    │         │
│     │                   │ 2. Emit Event      │                    │         │
│     │                   │    inventory.      │                    │         │
│     │                   │    updated         │                    │         │
│     │                   │───────────────────▶│                    │         │
│     │                   │                    │                    │         │
│     │                   │                    │ 3. Queue Sync Job  │         │
│     │                   │                    │    (BullMQ)        │         │
│     │                   │                    │                    │         │
│     │                   │                    │ 4. Process Queue   │         │
│     │                   │                    │                    │         │
│     │                   │                    │ 5. Get Channel     │         │
│     │                   │                    │    Config          │         │
│     │                   │                    │                    │         │
│     │                   │                    │ 6. Format Request  │         │
│     │                   │                    │    per OTA Spec    │         │
│     │                   │                    │                    │         │
│     │                   │                    │ 7. API Request     │         │
│     │                   │                    │───────────────────▶│         │
│     │                   │                    │                    │         │
│     │                   │                    │ 8. API Response    │         │
│     │                   │                    │◀───────────────────│         │
│     │                   │                    │                    │         │
│     │                   │                    │ 9. Update Sync Log │         │
│     │                   │                    │                    │         │
│     │                   │                    │    IF SUCCESS:     │         │
│     │                   │                    │    Mark synced     │         │
│     │                   │                    │                    │         │
│     │                   │                    │    IF FAILED:      │         │
│     │                   │                    │    Retry (exponential│       │
│     │                   │                    │    backoff) or DLQ │         │
│     │                   │                    │                    │         │
│     │                   │                    │                    │         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    RETRY STRATEGY                                    │   │
│  │                                                                      │   │
│  │   Attempt 1: Immediate                                               │   │
│  │   Attempt 2: +30 seconds                                             │   │
│  │   Attempt 3: +2 minutes                                              │   │
│  │   Attempt 4: +10 minutes                                             │   │
│  │   Attempt 5: +1 hour (max)                                           │   │
│  │                                                                      │   │
│  │   After 5 failures → Dead Letter Queue                               │   │
│  │   → Alert sent to operations                                         │   │
│  │   → Manual reprocess button in UI                                    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Real-Time Data Sync

### 7.1 WebSocket Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME DATA SYNC                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    WEBSOCKET ARCHITECTURE                            │   │
│  │                                                                      │   │
│  │   Client A          Socket Server           Event Bus                │   │
│  │      │                    │                     │                     │   │
│  │      │ 1. Connect         │                     │                     │   │
│  │      │───────────────────▶│                     │                     │   │
│  │      │                    │                     │                     │   │
│  │      │ 2. Subscribe        │                     │                     │   │
│  │      │    (room:305)      │                     │                     │   │
│  │      │───────────────────▶│                     │                     │   │
│  │      │                    │                     │                     │   │
│  │                      ...                         │                     │   │
│  │                                                   │                     │   │
│  │   Module X               │                     │                     │   │
│  │      │                    │                     │                     │   │
│  │      │ 3. Event           │                     │                     │   │
│  │      │    booking.        │                     │                     │   │
│  │      │    checked_in      │                     │                     │   │
│  │      │─────────────────────────────────────────▶│                     │   │
│  │      │                    │                     │                     │   │
│  │      │                    │ 4. Fan-out          │                     │   │
│  │      │                    │◀────────────────────│                     │   │
│  │      │                    │                     │                     │   │
│  │      │ 5. Push Update     │                     │                     │   │
│  │      │◀───────────────────│                     │                     │   │
│  │      │                    │                     │                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    REAL-TIME CHANNELS                                │   │
│  │                                                                      │   │
│  │   Channel Pattern         Subscribers            Updates             │   │
│  │   ─────────────────────────────────────────────────────────────     │   │
│  │                                                                      │   │
│  │   tenant:{id}             All users in tenant    System alerts       │   │
│  │                                                                      │   │
│  │   property:{id}           Property staff         Property events     │   │
│  │                                                                      │   │
│  │   frontdesk:{id}          Front desk staff       Check-in/out        │   │
│  │                                                   Arrivals/Dep       │   │
│  │                                                                      │   │
│  │   housekeeping:{id}       Housekeeping staff     Task updates        │   │
│  │                                                   Room status         │   │
│  │                                                                      │   │
│  │   booking:{id}            Booking stakeholders   Booking updates     │   │
│  │                                                                      │   │
│  │   user:{id}               Specific user          Personal notifs     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PUSH NOTIFICATION EXAMPLE                         │   │
│  │                                                                      │   │
│  │   // New check-in notification to front desk                        │   │
│  │   {                                                                  │   │
│  │     "channel": "frontdesk:prop_123",                                │   │
│  │     "event": "booking.checked_in",                                  │   │
│  │     "data": {                                                        │   │
│  │       "booking_id": "book_456",                                      │   │
│  │       "guest_name": "John Doe",                                      │   │
│  │       "room_number": "305",                                          │   │
│  │       "check_in_time": "2026-03-15T14:00:00Z"                        │   │
│  │     },                                                               │   │
│  │     "timestamp": "2026-03-15T14:00:00Z"                              │   │
│  │   }                                                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Data Consistency Patterns

### 8.1 Consistency Guarantees

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA CONSISTENCY PATTERNS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    1. IDEMPOTENCY                                    │   │
│  │                                                                      │   │
│  │   All write operations include an idempotency key:                  │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ POST /api/bookings                                          │   │   │
│  │   │                                                             │   │   │
│  │   │ Headers:                                                    │   │   │
│  │   │   Idempotency-Key: uuid-12345                               │   │   │
│  │   │                                                             │   │   │
│  │   │ Body:                                                       │   │   │
│  │   │   {                                                         │   │   │
│  │   │     "guest_id": "guest_789",                                │   │   │
│  │   │     "room_id": "room_101",                                  │   │   │
│  │   │     ...                                                     │   │   │
│  │   │   }                                                         │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   Processing:                                                        │   │
│  │   1. Check if idempotency key exists                                │   │
│  │   2. If exists → return cached response                             │   │
│  │   3. If not → process request, store key + response                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    2. OPTIMISTIC LOCKING                             │   │
│  │                                                                      │   │
│  │   Updates include version check:                                    │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ PATCH /api/bookings/book_456                                │   │   │
│  │   │                                                             │   │   │
│  │   │ Body:                                                       │   │   │
│  │   │   {                                                         │   │   │
│  │   │     "version": 3,                                           │   │   │
│  │   │     "check_out": "2026-03-18"                               │   │   │
│  │   │   }                                                         │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   SQL:                                                               │   │
│  │   UPDATE bookings                                                    │   │
│  │   SET check_out = '2026-03-18', version = 4                         │   │
│  │   WHERE id = 'book_456' AND version = 3                             │   │
│  │                                                                      │   │
│  │   If version mismatch → 409 Conflict, client must refetch           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    3. PESSIMISTIC LOCKING                            │   │
│  │                                                                      │   │
│  │   For critical operations (inventory):                              │   │
│  │                                                                      │   │
│  │   BEGIN TRANSACTION;                                                 │   │
│  │   SELECT * FROM rooms                                                │   │
│  │   WHERE id = 'room_101' AND status = 'available'                    │   │
│  │   FOR UPDATE;  -- Row lock                                          │   │
│  │                                                                      │   │
│  │   -- Update room status                                              │   │
│  │   UPDATE rooms SET status = 'reserved' WHERE id = 'room_101';       │   │
│  │                                                                      │   │
│  │   -- Create booking                                                  │   │
│  │   INSERT INTO bookings ...;                                          │   │
│  │                                                                      │   │
│  │   COMMIT;                                                            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    4. EVENTUAL CONSISTENCY                           │   │
│  │                                                                      │   │
│  │   For non-critical data (analytics, search index):                  │   │
│  │                                                                      │   │
│  │   • Events emitted to queue                                         │   │
│  │   • Consumers process async                                         │   │
│  │   • Retry on failure                                                │   │
│  │   • Reconciliation cron for drift detection                         │   │
│  │                                                                      │   │
│  │   Example: Search index update                                      │   │
│  │   ─────────────────────────────────────────────────────────────     │   │
│  │                                                                      │   │
│  │   booking.updated → Queue → Search Service → Reindex               │   │
│  │                                                                      │   │
│  │   Reconciliation: Every 6 hours, compare DB vs search index         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Retention & Archival

### 9.1 Data Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA RETENTION POLICY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    RETENTION PERIODS                                 │   │
│  │                                                                      │   │
│  │   Data Type              Retention      Archive      Purge          │   │
│  │   ─────────────────────────────────────────────────────────────     │   │
│  │                                                                      │   │
│  │   Guest profiles         Permanent      N/A          N/A            │   │
│  │   Bookings               7 years        After 3 yrs  After 7 yrs    │   │
│  │   Payments               7 years        After 3 yrs  After 7 yrs    │   │
│  │   Invoices               7 years        After 3 yrs  After 7 yrs    │   │
│  │   WiFi sessions          1 year         After 6 mo   After 1 yr     │   │
│  │   Audit logs             2 years        After 1 yr   After 2 yrs    │   │
│  │   Event logs             90 days        N/A          After 90 days  │   │
│  │   Sync logs              90 days        N/A          After 90 days  │   │
│  │   Analytics (raw)        30 days        After 7 days After 30 days  │   │
│  │   Analytics (aggregated) Permanent      N/A          N/A            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    GDPR COMPLIANCE                                   │   │
│  │                                                                      │   │
│  │   Right to Access:                                                   │   │
│  │   ─────────────────────────────────────────────────────────────     │   │
│  │   GET /api/guests/{id}/export                                        │   │
│  │   → Returns all guest data in JSON format                           │   │
│  │   → Includes: Profile, Bookings, Payments, Preferences              │   │
│  │                                                                      │   │
│  │   Right to Erasure:                                                  │   │
│  │   ─────────────────────────────────────────────────────────────     │   │
│  │   DELETE /api/guests/{id} (with gdpr_delete=true)                   │   │
│  │   → Anonymizes personal data                                        │   │
│  │   → Retains financial records (legal requirement)                   │   │
│  │   → Removes from marketing/CRM                                      │   │
│  │                                                                      │   │
│  │   Data Portability:                                                  │   │
│  │   ─────────────────────────────────────────────────────────────     │   │
│  │   Export formats: JSON, CSV                                          │   │
│  │   → Machine-readable format                                         │   │
│  │   → All guest data included                                         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ARCHIVAL PROCESS                                  │   │
│  │                                                                      │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐        │   │
│  │   │ Active  │───▶│ Archive │───▶│ Cold    │───▶│ Delete  │        │   │
│  │   │ Storage │    │ Storage │    │ Storage │    │         │        │   │
│  │   │ (PG)    │    │ (PG)    │    │ (S3)    │    │         │        │   │
│  │   └─────────┘    └─────────┘    └─────────┘    └─────────┘        │   │
│  │       │              │              │              │               │   │
│  │   Full access   Read-only     Compressed     Gone                 │   │
│  │   Fast queries  Slower       Slowest                             │   │
│  │                                                                      │   │
│  │   Archive Process:                                                   │   │
│  │   1. Identify records past retention threshold                      │   │
│  │   2. Compress and move to archive table/storage                     │   │
│  │   3. Update indexes                                                  │   │
│  │   4. Verify integrity                                                │   │
│  │   5. Log archival action                                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Data Flow Quick Reference

### A.1 Module Communication Summary

| From | To | Method | Events |
|------|-----|--------|--------|
| Booking | WiFi | Event | booking.checked_in/out |
| Booking | Billing | Event | booking.confirmed |
| Booking | Channel | Event | booking.* |
| WiFi | Billing | Event | wifi.session.* |
| Payment | Booking | Event | payment.completed |
| Channel | Booking | API | Create booking |
| PMS | Channel | Event | inventory.updated |

### A.2 Critical Path (Synchronous)

1. Booking creation → Inventory lock
2. Payment processing → Folio update
3. Check-in → Room status change

### A.3 Async Path (Event-Driven)

1. Guest notifications
2. CRM updates
3. Analytics aggregation
4. Search index updates
5. External webhooks

---

**Contact**

**Cryptsk Pvt Ltd**
- **Website**: www.staysuite.io
- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd. All rights reserved.*
