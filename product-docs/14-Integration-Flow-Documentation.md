# StaySuite Integration Flow Documentation
## External System Connections & Integration Architecture

**Version**: 1.0  
**Last Updated**: March 2026  
**Author**: Cryptsk Pvt Ltd

---

## Table of Contents

1. [Overview](#1-overview)
2. [Integration Architecture](#2-integration-architecture)
3. [OTA Integrations](#3-ota-integrations)
4. [Payment Gateway Integrations](#4-payment-gateway-integrations)
5. [WiFi Gateway Integrations](#5-wifi-gateway-integrations)
6. [Door Lock Integrations](#6-door-lock-integrations)
7. [Third-Party API Integrations](#7-third-party-api-integrations)
8. [Webhook System](#8-webhook-system)
9. [Integration Monitoring](#9-integration-monitoring)

---

## 1. Overview

### 1.1 Integration Philosophy

StaySuite follows a modular integration architecture that:
- Uses adapters for external systems
- Maintains clear boundaries between internal and external data
- Provides failover and retry mechanisms
- Logs all integration activities for troubleshooting

### 1.2 Integration Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **Channel Manager** | OTA connectivity | Booking.com, Airbnb, Expedia |
| **Payment** | Transaction processing | Stripe, Razorpay, PayPal |
| **WiFi** | Network access control | MikroTik, Cisco, Aruba |
| **Access Control** | Door lock management | Assa Abloy, Salto, dormakaba |
| **Communication** | Messaging channels | WhatsApp, Email, SMS |
| **Analytics** | Data export | Google Analytics, Custom BI |

### 1.3 Integration Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       INTEGRATION CAPABILITY MATRIX                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Integration Type      Count    Status        Protocol                      │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  OTA Channels          46+      ✅ Production  REST API, Webhooks           │
│  Payment Gateways      10+      ✅ Production  REST API                     │
│  WiFi Gateways         12+      ✅ Production  RADIUS                       │
│  Door Locks            5+       🟡 Beta       REST API, MQTT                │
│  Communication         4        ✅ Production  REST API                     │
│  Analytics             3        ✅ Production  REST API                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Integration Architecture

### 2.1 High-Level Integration Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTEGRATION ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    EXTERNAL SYSTEMS                                  │   │
│  │                                                                      │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │   OTA   │ │ Payment │ │  WiFi   │ │  Locks  │ │  Email  │       │   │
│  │  │Channels │ │Gateways │ │Gateways │ │         │ │   SMS   │       │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │   │
│  └───────┼───────────┼───────────┼───────────┼───────────┼─────────────┘   │
│          │           │           │           │           │                  │
│          │           │           │           │           │                  │
│  ┌───────┴───────────┴───────────┴───────────┴───────────┴─────────────┐   │
│  │                     ADAPTER LAYER                                    │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Integration Hub                           │   │   │
│  │  │                                                              │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │  │  │   OTA    │ │ Payment  │ │  WiFi    │ │  Access  │       │   │   │
│  │  │  │ Adapters │ │ Adapters │ │ Adapters │ │ Adapters │       │   │   │
│  │  │  │          │ │          │ │          │ │          │       │   │   │
│  │  │  │•Booking  │ │•Stripe   │ │•MikroTik │ │•AssaAbloy│       │   │   │
│  │  │  │•Airbnb   │ │•Razorpay │ │•Cisco    │ │•Salto    │       │   │   │
│  │  │  │•Expedia  │ │•PayPal   │ │•Aruba    │ │•dormakaba│       │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │  │                                                              │   │   │
│  │  │  Features:                                                   │   │   │
│  │  │  • Unified interface per category                            │   │   │
│  │  │  • Protocol translation                                      │   │   │
│  │  │  • Error handling & retry                                    │   │   │
│  │  │  • Rate limiting                                             │   │   │
│  │  │  • Logging & monitoring                                      │   │   │
│  │  │                                                              │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      │                                       │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                     STAYSUITE CORE                                    │  │
│  │                                                                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │  │
│  │  │   Channel   │ │   Billing   │ │    WiFi     │ │  Experience │    │  │
│  │  │  Manager    │ │   Module    │ │   Module    │ │   Module    │    │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Adapter Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ADAPTER PATTERN                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │                     StaySuite Core                                   │   │
│  │                          │                                           │   │
│  │                          │ Calls                                     │   │
│  │                          ▼                                           │   │
│  │             ┌────────────────────────┐                              │   │
│  │             │   Interface            │                              │   │
│  │             │   (e.g., IPaymentGateway)                             │   │
│  │             │                        │                              │   │
│  │             │  + processPayment()    │                              │   │
│  │             │  + refundPayment()     │                              │   │
│  │             │  + getStatus()         │                              │   │
│  │             └───────────┬────────────┘                              │   │
│  │                         │                                            │   │
│  │          ┌──────────────┼──────────────┐                            │   │
│  │          │              │              │                            │   │
│  │          ▼              ▼              ▼                            │   │
│  │   ┌───────────┐  ┌───────────┐  ┌───────────┐                     │   │
│  │   │  Stripe   │  │ Razorpay  │  │  PayPal   │                     │   │
│  │   │  Adapter  │  │  Adapter  │  │  Adapter  │                     │   │
│  │   │           │  │           │  │           │                     │   │
│  │   │ Translates│  │ Translates│  │ Translates│                     │   │
│  │   │ internal  │  │ internal  │  │ internal  │                     │   │
│  │   │ calls to  │  │ calls to  │  │ calls to  │                     │   │
│  │   │ Stripe API│  │Razor API  │  │PayPal API │                     │   │
│  │   └───────────┘  └───────────┘  └───────────┘                     │   │
│  │          │              │              │                            │   │
│  │          ▼              ▼              ▼                            │   │
│  │   ┌───────────┐  ┌───────────┐  ┌───────────┐                     │   │
│  │   │  Stripe   │  │ Razorpay  │  │  PayPal   │                     │   │
│  │   │   API     │  │   API     │  │   API     │                     │   │
│  │   └───────────┘  └───────────┘  └───────────┘                     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Benefits:                                                                  │
│  • Easy to add new providers                                                │
│  • Internal code doesn't change when provider changes                       │
│  • Failover to alternative providers                                        │
│  • Centralized error handling                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. OTA Integrations

### 3.1 OTA Connection Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OTA INTEGRATION ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SUPPORTED OTAs                                    │   │
│  │                                                                      │   │
│  │  Global OTAs:                                                        │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │   │
│  │  │ Booking.  │ │  Airbnb   │ │  Expedia  │ │   Agoda   │           │   │
│  │  │    com    │ │           │ │           │ │           │           │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘           │   │
│  │                                                                      │   │
│  │  Regional OTAs:                                                      │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │   │
│  │  │MakeMyTrip │ │  Goibibo  │ │   Yatra   │ │   OYO     │           │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘           │   │
│  │                                                                      │   │
│  │  GDS:                                                                │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                          │   │
│  │  │  Amadeus  │ │   Sabre   │ │Travelport │                          │   │
│  │  └───────────┘ └───────────┘ └───────────┘                          │   │
│  │                                                                      │   │
│  │  Metasearch:                                                         │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                          │   │
│  │  │  Google   │ │TripAdvisor│ │  Trivago  │                          │   │
│  │  │Hotel Ads  │ │           │ │           │                          │   │
│  │  └───────────┘ └───────────┘ └───────────┘                          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DATA SYNC TYPES                                   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                    INBOUND (OTA → StaySuite)                  │   │   │
│  │  │                                                               │   │   │
│  │  │  • New reservations                                           │   │   │
│  │  │  • Reservation modifications                                  │   │   │
│  │  │  • Cancellations                                              │   │   │
│  │  │  • Guest messages                                             │   │   │
│  │  │  • Reviews                                                    │   │   │
│  │  │                                                               │   │   │
│  │  │  Method: Webhooks (real-time) + Polling (fallback)            │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                    OUTBOUND (StaySuite → OTA)                 │   │   │
│  │  │                                                               │   │   │
│  │  │  • Inventory updates (availability)                           │   │   │
│  │  │  • Rate updates (pricing)                                     │   │   │
│  │  │  • Restrictions (MLOS, stop-sell)                             │   │   │
│  │  │  • Booking confirmations                                      │   │   │
│  │  │  • Content updates (photos, descriptions)                     │   │   │
│  │  │                                                               │   │   │
│  │  │  Method: REST API (push) + XML/JSON                           │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 OTA Booking Import Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OTA BOOKING IMPORT FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OTA            Webhook Handler      Channel Manager       StaySuite        │
│   │                  │                     │                    │           │
│   │                  │                     │                    │           │
│   │  ┌────────────────────────────────────────────────────────────────┐   │
│   │  │ 1. OTA sends reservation.created webhook                       │   │
│   │  └────────────────────────────────────────────────────────────────┘   │
│   │                  │                     │                    │           │
│   │  POST /webhooks/│                     │                    │           │
│   │  booking-com    │                     │                    │           │
│   │────────────────▶│                     │                    │           │
│   │                 │                     │                    │           │
│   │  Headers:       │                     │                    │           │
│   │  X-Signature:   │                     │                    │           │
│   │  [HMAC-SHA256]  │                     │                    │           │
│   │                 │                     │                    │           │
│   │  Body:          │                     │                    │           │
│   │  {              │                     │                    │           │
│   │   "event":"res. │                     │                    │           │
│   │    created",    │                     │                    │           │
│   │   "reservation":│                     │                    │           │
│   │   {id, guest,   │                     │                    │           │
│   │    dates, ...}  │                     │                    │           │
│   │  }              │                     │                    │           │
│   │                 │                     │                    │           │
│   │                 │  ┌───────────────────────────────────────────────┐  │
│   │                 │  │ 2. Validate                                    │  │
│   │                 │  │    • Verify HMAC signature                    │  │
│   │                 │  │    • Check timestamp (replay protection)      │  │
│   │                 │  │    • Check idempotency key                    │  │
│   │                 │  └───────────────────────────────────────────────┘  │
│   │                 │                     │                    │           │
│   │                 │  3. Forward to      │                    │           │
│   │                 │     Channel Manager │                    │           │
│   │                 │────────────────────▶│                    │           │
│   │                 │                     │                    │           │
│   │                 │                     │  ┌─────────────────────────┐  │
│   │                 │                     │  │ 4. Map OTA data          │  │
│   │                 │                     │  │    • OTA room type       │  │
│   │                 │                     │  │      → Internal room     │  │
│   │                 │                     │  │    • OTA rate plan       │  │
│   │                 │                     │  │      → Internal rate     │  │
│   │                 │                     │  │    • OTA guest data      │  │
│   │                 │                     │  │      → Guest profile     │  │
│   │                 │                     │  └─────────────────────────┘  │
│   │                 │                     │                    │           │
│   │                 │                     │  5. Create/Find    │           │
│   │                 │                     │     Guest          │           │
│   │                 │                     │───────────────────▶│           │
│   │                 │                     │                    │           │
│   │                 │                     │  6. Create Booking │           │
│   │                 │                     │     (source: OTA)  │           │
│   │                 │                     │───────────────────▶│           │
│   │                 │                     │                    │           │
│   │                 │                     │  7. Lock Inventory │           │
│   │                 │                     │───────────────────▶│           │
│   │                 │                     │                    │           │
│   │                 │                     │  8. Create Folio   │           │
│   │                 │                     │───────────────────▶│           │
│   │                 │                     │                    │           │
│   │                 │                     │  9. Update         │           │
│   │                 │                     │     Idempotency    │           │
│   │                 │                     │     (processed)    │           │
│   │                 │                     │                    │           │
│   │  10. HTTP 200   │                     │                    │           │
│   │     OK          │◀────────────────────│◀───────────────────│           │
│   │                 │                     │                    │           │
│   │  Response:      │                     │                    │           │
│   │  {"status":     │                     │                    │           │
│   │   "confirmed",  │                     │                    │           │
│   │   "booking_id": │                     │                    │           │
│   │   "book_123"}   │                     │                    │           │
│   │◀────────────────│                     │                    │           │
│   │                 │                     │                    │           │
│   │                 │  11. Log Sync       │                    │           │
│   │                 │      Success        │                    │           │
│   │                 │                     │                    │           │
│   │                 │  12. Emit Events    │                    │           │
│   │                 │      (booking.      │                    │           │
│   │                 │       created)      │                    │           │
│   │                 │                     │                    │           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 OTA Inventory Sync Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OTA INVENTORY SYNC FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  StaySuite        Event Bus        Channel Manager         OTA              │
│     │                 │                  │                   │              │
│     │ 1. Room status  │                  │                   │              │
│     │    changed      │                  │                   │              │
│     │────────────────▶│                  │                   │              │
│     │                 │                  │                   │              │
│     │                 │ 2. Emit event    │                   │              │
│     │                 │    inventory.    │                   │              │
│     │                 │    updated       │                   │              │
│     │                 │─────────────────▶│                   │              │
│     │                 │                  │                   │              │
│     │                 │                  │  ┌──────────────────────────┐   │
│     │                 │                  │  │ 3. Enqueue sync job      │   │
│     │                 │                  │  │    (BullMQ queue)        │   │
│     │                 │                  │  │                          │   │
│     │                 │                  │  │    Job data:             │   │
│     │                 │                  │  │    {                     │   │
│     │                 │                  │  │      tenant_id: "...",   │   │
│     │                 │                  │  │      room_type_id: "...",│   │
│     │                 │                  │  │      channels: [         │   │
│     │                 │                  │  │        "booking.com",    │   │
│     │                 │                  │  │        "expedia"         │   │
│     │                 │                  │  │      ],                  │   │
│     │                 │                  │  │      date_range: {...}   │   │
│     │                 │                  │  │    }                     │   │
│     │                 │                  │  └──────────────────────────┘   │
│     │                 │                  │                   │              │
│     │                 │                  │  4. Worker picks  │              │
│     │                 │                  │     job from queue│              │
│     │                 │                  │                   │              │
│     │                 │                  │  5. For each OTA: │              │
│     │                 │                  │                   │              │
│     │                 │                  │     ┌─────────────────────┐     │
│     │                 │                  │     │ a. Get OTA mapping  │     │
│     │                 │                  │     │ b. Format request   │     │
│     │                 │                  │     │    per OTA spec     │     │
│     │                 │                  │     │ c. Send API call    │     │
│     │                 │                  │     │ d. Handle response  │     │
│     │                 │                  │     └─────────────────────┘     │
│     │                 │                  │                   │              │
│     │                 │                  │  6. OTA API call  │              │
│     │                 │                  │─────────────────▶│              │
│     │                 │                  │                   │              │
│     │                 │                  │  7. Response      │              │
│     │                 │                  │◀─────────────────│              │
│     │                 │                  │                   │              │
│     │                 │                  │  ┌──────────────────────────┐   │
│     │                 │                  │  │ 8. Update sync log       │   │
│     │                 │                  │  │                          │   │
│     │                 │                  │  │    IF SUCCESS:           │   │
│     │                 │                  │  │    status: "completed"   │   │
│     │                 │                  │  │    response_time: 245ms  │   │
│     │                 │                  │  │                          │   │
│     │                 │                  │  │    IF FAILED:            │   │
│     │                 │                  │  │    status: "failed"      │   │
│     │                 │                  │  │    error: "..."          │   │
│     │                 │                  │  │    retry_at: +30s        │   │
│     │                 │                  │  └──────────────────────────┘   │
│     │                 │                  │                   │              │
│     │                 │                  │  9. If failed,    │              │
│     │                 │                  │     re-enqueue    │              │
│     │                 │                  │     with backoff  │              │
│     │                 │                  │                   │              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Payment Gateway Integrations

### 4.1 Supported Payment Gateways

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PAYMENT GATEWAY SUPPORT                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Global Gateways:                                                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Stripe    │ │   PayPal    │ │    Adyen    │ │ Authorize.  │          │
│  │             │ │             │ │             │ │     net     │          │
│  │ ✅ Full     │ │ ✅ Full     │ │ ✅ Full     │ │ ✅ Full     │          │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                                              │
│  India Gateways:                                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Razorpay   │ │  CCAvenue   │ │    PayU     │ │   Paytm     │          │
│  │             │ │             │ │             │ │             │          │
│  │ ✅ Full     │ │ ✅ Full     │ │ ✅ Full     │ │ 🟡 Partial  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                                              │
│  Regional Gateways:                                                         │
│  ┌─────────────┐ ┌─────────────┐                                            │
│  │   Square    │ │   Braintree │                                            │
│  │             │ │             │                                            │
│  │ ✅ Full     │ │ ✅ Full     │                                            │
│  └─────────────┘ └─────────────┘                                            │
│                                                                              │
│  Feature Support:                                                           │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  Feature              Stripe  Razorpay  PayPal  Adyen                       │
│  ────────────────────────────────────────────────────────────────           │
│  Card payments        ✅      ✅        ✅      ✅                          │
│  UPI                  ✅      ✅        ❌      ✅                          │
│  Net banking          ❌      ✅        ❌      ✅                          │
│  Wallets              ❌      ✅        ✅      ✅                          │
│  EMI                  ✅      ✅        ❌      ✅                          │
│  Recurring            ✅      ✅        ✅      ✅                          │
│  Pre-auth             ✅      ✅        ✅      ✅                          │
│  Refunds              ✅      ✅        ✅      ✅                          │
│  Webhooks             ✅      ✅        ✅      ✅                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Payment Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PAYMENT PROCESSING FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PAYMENT INITIATION                                │   │
│  │                                                                      │   │
│  │   User          Frontend         Billing API         Gateway        │   │
│  │     │               │                │                   │           │   │
│  │     │ 1. Pay Now    │                │                   │           │   │
│  │     │──────────────▶│                │                   │           │   │
│  │     │               │                │                   │           │   │
│  │     │               │ 2. Create      │                   │           │   │
│  │     │               │    Payment     │                   │           │   │
│  │     │               │    Intent      │                   │           │   │
│  │     │               │───────────────▶│                   │           │   │
│  │     │               │                │                   │           │   │
│  │     │               │                │ 3. Select         │           │   │
│  │     │               │                │    Gateway        │           │   │
│  │     │               │                │    (by rules)     │           │   │
│  │     │               │                │                   │           │   │
│  │     │               │                │ 4. Create Intent  │           │   │
│  │     │               │                │──────────────────▶│           │   │
│  │     │               │                │                   │           │   │
│  │     │               │                │ 5. Return         │           │   │
│  │     │               │                │    client_secret  │           │   │
│  │     │               │                │◀──────────────────│           │   │
│  │     │               │                │                   │           │   │
│  │     │               │ 6. Return      │                   │           │   │
│  │     │               │    client_     │                   │           │   │
│  │     │               │    secret      │                   │           │   │
│  │     │               │◀───────────────│                   │           │   │
│  │     │               │                │                   │           │   │
│  │     │ 7. Collect    │                │                   │           │   │
│  │     │    card       │                │                   │           │   │
│  │     │    details    │                │                   │           │   │
│  │     │──────────────▶│                │                   │           │   │
│  │     │               │                │                   │           │   │
│  │     │               │ 8. Securely    │                   │           │   │
│  │     │               │    submit to   │                   │           │   │
│  │     │               │    gateway     │                   │           │   │
│  │     │               │────────────────────────────────────▶│           │   │
│  │     │               │                │                   │           │   │
│  │     │               │ 9. Payment     │                   │           │   │
│  │     │               │    result      │                   │           │   │
│  │     │               │◀────────────────────────────────────│           │   │
│  │     │               │                │                   │           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    WEBHOOK HANDLING                                  │   │
│  │                                                                      │   │
│  │   Gateway            Billing API               Database             │   │
│  │     │                    │                        │                  │   │
│  │     │ 1. Payment         │                        │                  │   │
│  │     │    completed       │                        │                  │   │
│  │     │    webhook         │                        │                  │   │
│  │     │───────────────────▶│                        │                  │   │
│  │     │                    │                        │                  │   │
│  │     │                    │ 2. Verify signature    │                  │   │
│  │     │                    │                        │                  │   │
│  │     │                    │ 3. Check idempotency   │                  │   │
│  │     │                    │                        │                  │   │
│  │     │                    │ 4. Update payment      │                  │   │
│  │     │                    │    (status: COMPLETED) │                  │   │
│  │     │                    │───────────────────────▶│                  │   │
│  │     │                    │                        │                  │   │
│  │     │                    │ 5. Update folio        │                  │   │
│  │     │                    │───────────────────────▶│                  │   │
│  │     │                    │                        │                  │   │
│  │     │                    │ 6. Emit events         │                  │   │
│  │     │                    │    payment.completed   │                  │   │
│  │     │                    │                        │                  │   │
│  │     │ 7. ACK             │                        │                  │   │
│  │     │◀───────────────────│                        │                  │   │
│  │     │                    │                        │                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Gateway Failover Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GATEWAY FAILOVER STRATEGY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ROUTING RULES                                     │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ Currency-based Routing:                                      │   │   │
│  │   │                                                              │   │   │
│  │   │   INR → Razorpay (primary) → Stripe (fallback)              │   │   │
│  │   │   USD → Stripe (primary) → PayPal (fallback)                │   │   │
│  │   │   EUR → Adyen (primary) → Stripe (fallback)                 │   │   │
│  │   │   GBP → Stripe (primary) → Adyen (fallback)                 │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ Amount-based Routing:                                        │   │   │
│  │   │                                                              │   │   │
│  │   │   < $500 → Card processing                                   │   │   │
│  │   │   $500-$5000 → Card with 3DS                                │   │   │
│  │   │   > $5000 → Bank transfer / Wire                            │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ Health-based Routing:                                        │   │   │
│  │   │                                                              │   │   │
│  │   │   Gateway health checked every 30 seconds                   │   │   │
│  │   │   If gateway down → Auto-switch to fallback                 │   │   │
│  │   │   When recovered → Auto-switch back (gradual)               │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    FAILOVER FLOW                                     │   │
│  │                                                                      │   │
│  │   Payment Request                                                    │   │
│  │        │                                                             │   │
│  │        ▼                                                             │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │ Try Primary │                                                   │   │
│  │   │ Gateway     │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                           │   │
│  │     ┌────┴────┐                                                     │   │
│  │     │         │                                                     │   │
│  │  Success   Fail                                                     │   │
│  │     │         │                                                     │   │
│  │     ▼         ▼                                                     │   │
│  │   ┌───┐   ┌─────────────┐                                           │   │
│  │   │ ✓ │   │ Log Error   │                                           │   │
│  │   └───┘   │ Try Fallback│                                           │   │
│  │           └──────┬──────┘                                           │   │
│  │                  │                                                   │   │
│  │             ┌────┴────┐                                             │   │
│  │             │         │                                             │   │
│  │          Success   Fail                                             │   │
│  │             │         │                                             │   │
│  │             ▼         ▼                                             │   │
│  │           ┌───┐   ┌─────────────┐                                   │   │
│  │           │ ✓ │   │ Queue for   │                                   │   │
│  │           └───┘   │ Retry       │                                   │   │
│  │                   │ Alert Staff │                                   │   │
│  │                   └─────────────┘                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. WiFi Gateway Integrations

### 5.1 Supported WiFi Gateways

| Vendor | RADIUS | CoA | Captive Portal | VSA Support |
|--------|--------|-----|----------------|-------------|
| MikroTik | ✅ | ✅ | Built-in | ✅ Full |
| Cisco | ✅ | ✅ | ISE/WLC | ✅ Full |
| Aruba | ✅ | ✅ | ClearPass | ✅ Full |
| Ruckus | ✅ | ✅ | ZoneDirector | ✅ Full |
| Huawei | ✅ | ✅ | Agile Controller | ✅ Full |
| Juniper | ✅ | ✅ | Mist | ✅ Full |
| Fortinet | ✅ | ✅ | FortiGate | ✅ Full |
| Ubiquiti | ✅ | 🟡 | UniFi | ✅ Full |

*(Detailed WiFi integration flows covered in Network Architecture Documentation)*

---

## 6. Door Lock Integrations

### 6.1 Supported Lock Vendors

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DOOR LOCK INTEGRATIONS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SUPPORTED VENDORS                                 │   │
│  │                                                                      │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │  Assa Abloy │ │  dormakaba  │ │    Salto    │ │   ONITY     │   │   │
│  │  │             │ │             │ │             │ │             │   │   │
│  │  │ ✅ Full     │ │ ✅ Full     │ │ ✅ Full     │ │ 🟡 Beta     │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  │                                                                      │   │
│  │  ┌─────────────┐ ┌─────────────┐                                    │   │
│  │  │   August    │ │   Yale      │                                    │   │
│  │  │             │ │             │                                    │   │
│  │  │ 🟡 Beta     │ │ 🟡 Beta     │                                    │   │
│  │  └─────────────┘ └─────────────┘                                    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DIGITAL KEY FLOW                                  │   │
│  │                                                                      │   │
│  │   StaySuite            Lock API             Lock System             │   │
│  │       │                    │                     │                   │   │
│  │       │ 1. Check-in event  │                     │                   │   │
│  │       │                    │                     │                   │   │
│  │       │ 2. Generate        │                     │                   │   │
│  │       │    Digital Key     │                     │                   │   │
│  │       │                    │                     │                   │   │
│  │       │ 3. Create Key      │                     │                   │   │
│  │       │───────────────────▶│                     │                   │   │
│  │       │                    │                     │                   │   │
│  │       │                    │ 4. Provision Key    │                   │   │
│  │       │                    │───────────────────▶│                   │   │
│  │       │                    │                     │                   │   │
│  │       │                    │ 5. Key Activated    │                   │   │
│  │       │                    │◀───────────────────│                   │   │
│  │       │                    │                     │                   │   │
│  │       │ 6. Key ID/Token    │                     │                   │   │
│  │       │◀───────────────────│                     │                   │   │
│  │       │                    │                     │                   │   │
│  │       │ 7. Send to Guest   │                     │                   │   │
│  │       │    App (Push)      │                     │                   │   │
│  │       │                    │                     │                   │   │
│  │       │                    │                     │                   │   │
│  │   Guest App               │                     │                   │   │
│  │       │                    │                     │                   │   │
│  │       │ 8. Unlock Door     │                     │                   │   │
│  │       │    (via Bluetooth/ │                     │                   │   │
│  │       │     NFC)           │                     │                   │   │
│  │       │────────────────────────────────────────▶│                   │   │
│  │       │                    │                     │                   │   │
│  │       │ 9. Door Unlocked   │                     │                   │   │
│  │       │◀────────────────────────────────────────│                   │   │
│  │       │                    │                     │                   │   │
│  │       │                    │ 10. Log Access      │                   │   │
│  │       │                    │◀───────────────────│                   │   │
│  │       │                    │                     │                   │   │
│  │       │ 11. Access Logged  │                     │                   │   │
│  │       │◀───────────────────│                     │                   │   │
│  │       │                    │                     │                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Third-Party API Integrations

### 7.1 Communication Channels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMMUNICATION INTEGRATIONS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SUPPORTED CHANNELS                                │   │
│  │                                                                      │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │   Email     │ │    SMS      │ │  WhatsApp   │ │  Push Notif │   │   │
│  │  │             │ │             │ │             │ │             │   │   │
│  │  │ SendGrid    │ │ Twilio      │ │ Twilio API  │ │ Firebase    │   │   │
│  │  │ AWS SES     │ │ MSG91       │ │ Business API│ │ APNs        │   │   │
│  │  │ Mailgun     │ │ TextLocal   │ │             │ │             │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED COMMUNICATION HUB                         │   │
│  │                                                                      │   │
│  │   StaySuite                                                         │   │
│  │       │                                                              │   │
│  │       │ Send notification                                           │   │
│  │       ▼                                                              │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │                 Notification Router                          │   │   │
│  │   │                                                              │   │   │
│  │   │  1. Check guest preferences                                  │   │   │
│  │   │  2. Select optimal channel                                   │   │   │
│  │   │  3. Format message per channel                               │   │   │
│  │   │  4. Send via appropriate adapter                             │   │   │
│  │   │  5. Log delivery status                                      │   │   │
│  │   │                                                              │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │       │                                                              │   │
│  │       ├─────────────┬─────────────┬─────────────┐                  │   │
│  │       │             │             │              │                  │   │
│  │       ▼             ▼             ▼              ▼                  │   │
│  │   ┌───────┐   ┌───────┐   ┌───────────┐   ┌─────────┐             │   │
│  │   │ Email │   │  SMS  │   │ WhatsApp  │   │   Push  │             │   │
│  │   └───────┘   └───────┘   └───────────┘   └─────────┘             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Use Cases:                                                                 │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  Event                   Channel        Template                           │
│  ─────────────────────────────────────────────────────────────────────     │
│  Booking confirmed       Email          booking-confirmation.html          │
│  Pre-arrival reminder    SMS            pre-arrival.txt                    │
│  Check-in complete       WhatsApp       check-in-welcome.txt               │
│  Service request update  Push           service-update.json                │
│  Check-out reminder      SMS            check-out-reminder.txt             │
│  Feedback request        Email          feedback-request.html              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Webhook System

### 8.1 Outbound Webhooks

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OUTBOUND WEBHOOK SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    WEBHOOK EVENTS                                    │   │
│  │                                                                      │   │
│  │   Event Category        Events                                      │   │
│  │   ─────────────────────────────────────────────────────────────     │   │
│  │                                                                      │   │
│  │   Booking              booking.created                              │   │
│  │                        booking.confirmed                             │   │
│  │                        booking.modified                              │   │
│  │                        booking.cancelled                             │   │
│  │                        booking.checked_in                            │   │
│  │                        booking.checked_out                           │   │
│  │                                                                      │   │
│  │   Payment              payment.initiated                             │   │
│  │                        payment.completed                             │   │
│  │                        payment.failed                                │   │
│  │                        payment.refunded                              │   │
│  │                                                                      │   │
│  │   Guest                guest.created                                 │   │
│  │                        guest.updated                                 │   │
│  │                        guest.feedback_received                       │   │
│  │                                                                      │   │
│  │   WiFi                 wifi.session.started                          │   │
│  │                        wifi.session.ended                            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    WEBHOOK DELIVERY                                  │   │
│  │                                                                      │   │
│  │   StaySuite                                                          │   │
│  │       │                                                              │   │
│  │       │ Event occurs                                                │   │
│  │       ▼                                                              │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │   Event     │                                                   │   │
│  │   │   Emitter   │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                           │   │
│  │          ▼                                                           │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Webhook    │                                                   │   │
│  │   │  Queue      │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                           │   │
│  │          ▼                                                           │   │
│  │   ┌─────────────┐      ┌─────────────┐                             │   │
│  │   │   HTTP      │─────▶│  Client     │                             │   │
│  │   │   POST      │      │  Endpoint   │                             │   │
│  │   └─────────────┘      └─────────────┘                             │   │
│  │          │                    │                                      │   │
│  │          │                    │                                      │   │
│  │     Success?              Response                                  │   │
│  │          │                    │                                      │   │
│  │     ┌────┴────┐               │                                      │   │
│  │     │         │               │                                      │   │
│  │   Yes        No              │                                      │   │
│  │     │         │               │                                      │   │
│  │     ▼         ▼               ▼                                      │   │
│  │   ┌───┐   ┌───────────┐   ┌───────────┐                            │   │
│  │   │Log│   │  Retry    │   │  Update   │                            │   │
│  │   │   │   │  (backoff)│   │  Delivery │                            │   │
│  │   └───┘   └───────────┘   │  Log      │                            │   │
│  │           │               └───────────┘                            │   │
│  │           │                                                         │   │
│  │           ▼                                                         │   │
│  │       After 5                                                      │   │
│  │       failures:                                                    │   │
│  │       → DLQ                                                        │   │
│  │       → Alert                                                      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Webhook Format:                                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  POST {client_webhook_url}                                                  │
│  Headers:                                                                   │
│    Content-Type: application/json                                           │
│    X-Signature: HMAC-SHA256(payload, secret)                               │
│    X-Event-Type: booking.created                                            │
│    X-Delivery-ID: del_12345                                                 │
│                                                                              │
│  Body:                                                                      │
│  {                                                                          │
│    "id": "evt_abc123",                                                      │
│    "type": "booking.created",                                               │
│    "timestamp": "2026-03-15T10:00:00Z",                                     │
│    "data": {                                                                │
│      "booking_id": "book_456",                                              │
│      "guest_name": "John Doe",                                              │
│      "check_in": "2026-03-15",                                              │
│      "check_out": "2026-03-17"                                              │
│    }                                                                        │
│  }                                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Integration Monitoring

### 9.1 Health Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      INTEGRATION MONITORING                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    HEALTH STATUS                                     │   │
│  │                                                                      │   │
│  │   Integration         Status    Latency    Success Rate   Last Sync │   │
│  │   ─────────────────────────────────────────────────────────────────│   │
│  │                                                                      │   │
│  │   Booking.com         🟢 OK      245ms      99.8%         2s ago    │   │
│  │   Airbnb              🟢 OK      312ms      99.5%         5s ago    │   │
│  │   Expedia             🟡 Degraded 1.2s       95.2%         30s ago   │   │
│  │   Stripe              🟢 OK      180ms      99.9%         1s ago    │   │
│  │   Razorpay            🟢 OK      210ms      99.7%         2s ago    │   │
│  │   WiFi Gateway        🟢 OK      15ms       100%          Live      │   │
│  │   Door Locks          🟢 OK      45ms       99.5%         10s ago   │   │
│  │   SendGrid            🟢 OK      120ms      99.9%         5s ago    │   │
│  │   Twilio              🟢 OK      95ms       99.8%         3s ago    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ALERT THRESHOLDS                                  │   │
│  │                                                                      │   │
│  │   Metric              Warning     Critical     Action               │   │
│  │   ─────────────────────────────────────────────────────────────────│   │
│  │                                                                      │   │
│  │   Latency             > 1s        > 3s         Alert ops team      │   │
│  │   Success Rate        < 98%       < 95%        Auto-failover       │   │
│  │   Error Rate          > 2%        > 5%         Alert + disable     │   │
│  │   Queue Backlog       > 100       > 500        Scale workers       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    METRICS COLLECTED                                 │   │
│  │                                                                      │   │
│  │   • Request count (per minute/hour/day)                             │   │
│  │   • Average response time                                            │   │
│  │   • Error count by type                                              │   │
│  │   • Retry count                                                      │   │
│  │   • Queue depth                                                      │   │
│  │   • Last successful sync                                             │   │
│  │   • Webhook delivery success rate                                    │   │
│  │   • Data throughput                                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Integration Quick Reference

### A.1 Supported Integrations by Category

| Category | Providers | Protocol | Status |
|----------|-----------|----------|--------|
| OTA | 46+ | REST/XML | Production |
| Payment | 10+ | REST | Production |
| WiFi | 12+ | RADIUS | Production |
| Door Locks | 5+ | REST/MQTT | Beta |
| Email | 3+ | REST | Production |
| SMS | 3+ | REST | Production |
| WhatsApp | 1 | REST | Production |

### A.2 Integration Configuration Checklist

- [ ] API credentials configured
- [ ] Webhook URLs registered
- [ ] IP whitelist configured (if required)
- [ ] Test transaction completed
- [ ] Error handling verified
- [ ] Monitoring enabled
- [ ] Documentation reviewed

---

**Contact**

**Cryptsk Pvt Ltd**
- **Website**: www.staysuite.io
- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd. All rights reserved.*
