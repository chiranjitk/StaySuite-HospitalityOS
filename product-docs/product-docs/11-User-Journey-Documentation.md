# StaySuite User Journey Documentation
## Complete User Lifecycle & Experience Flows

**Version**: 1.0  
**Last Updated**: March 2026  
**Author**: Cryptsk Pvt Ltd

---

## Table of Contents

1. [Overview](#1-overview)
2. [Guest Journey](#2-guest-journey)
3. [Staff Journey](#3-staff-journey)
4. [Administrator Journey](#4-administrator-journey)
5. [Property Manager Journey](#5-property-manager-journey)
6. [Channel Partner Journey](#6-channel-partner-journey)

---

## 1. Overview

### 1.1 User Types

| User Type | Description | Primary Touchpoints |
|-----------|-------------|---------------------|
| **Guest** | End customer staying at property | Booking engine, Guest app, In-room portal |
| **Staff** | Hotel employees | Staff app, Web dashboard |
| **Administrator** | System administrators | Admin dashboard, Settings |
| **Property Manager** | Hotel owners/managers | Web dashboard, Reports |
| **Channel Partner** | OTA and booking channels | API endpoints |

### 1.2 Journey Touchpoints

```
┌─────────────────────────────────────────────────────────────────┐
│                     GUEST JOURNEY TOUCHPOINTS                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Discovery → Booking → Pre-Arrival → Stay → Post-Stay          │
│       │          │          │          │          │              │
│       ▼          ▼          ▼          ▼          ▼              │
│   Website    Booking    Email/     In-Room    Review/           │
│   OTA        Engine     SMS        Portal     Loyalty           │
│   Ads                   App        WiFi                          │
│                                  Digital Key                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Guest Journey

### 2.1 Complete Guest Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         GUEST LIFECYCLE FLOW                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐│
│  │Discovery │──▶│ Booking  │──▶│Pre-Arrival│──▶│   Stay   │──▶│Post-Stay ││
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘│
│       │              │              │              │              │       │
│       ▼              ▼              ▼              ▼              ▼       │
│   Awareness      Reservation    Preparation    Experience   Retention    │
│   Interest       Confirmation   Documentation  Services     Loyalty      │
│   Consideration  Payment        Preferences    Support      Feedback     │
│                                                                   Referral│
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Phase 1: Discovery Journey

#### 2.2.1 Discovery Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISCOVERY PHASE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐                                                     │
│  │ Travel  │                                                     │
│  │  Need   │                                                     │
│  └────┬────┘                                                     │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────┐                    │
│  │           SEARCH CHANNELS               │                    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │                    │
│  │  │   OTA   │ │  Meta   │ │ Direct  │   │                    │
│  │  │(Booking)│ │(Google) │ │(Website)│   │                    │
│  │  └─────────┘ └─────────┘ └─────────┘   │                    │
│  └─────────────────────────────────────────┘                    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                             │
│  │ Property Listing│◀──── StaySuite Channel Manager Feed        │
│  │   (Photos,      │      (Real-time availability & rates)     │
│  │    Rates,       │                                             │
│  │    Reviews)     │                                             │
│  └────────┬────────┘                                             │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │   Comparison    │                                             │
│  │   & Decision    │                                             │
│  └────────┬────────┘                                             │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │  Select Room    │                                             │
│  │  & Rate Plan    │                                             │
│  └─────────────────┘                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 Discovery Touchpoints

| Channel | StaySuite Integration | Data Sync |
|---------|----------------------|-----------|
| Booking.com | Channel Manager API | Real-time |
| Airbnb | Channel Manager API | Real-time |
| Expedia | Channel Manager API | Real-time |
| Google Hotel Ads | Metasearch API | Real-time |
| Direct Website | Booking Engine Widget | Instant |
| Social Media | Tracking Pixels | Event-based |

### 2.3 Phase 2: Booking Journey

#### 2.3.1 Booking Flow (Direct)

```
┌─────────────────────────────────────────────────────────────────┐
│                    DIRECT BOOKING FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest            StaySuite            Payment          Property│
│    │                  │                   │                │    │
│    │  1. Select Dates │                   │                │    │
│    │─────────────────▶│                   │                │    │
│    │                  │                   │                │    │
│    │  2. Availability │                   │                │    │
│    │◀─────────────────│                   │                │    │
│    │                  │                   │                │    │
│    │  3. Select Room  │                   │                │    │
│    │─────────────────▶│                   │                │    │
│    │                  │                   │                │    │
│    │  4. Enter Details│                   │                │    │
│    │─────────────────▶│                   │                │    │
│    │                  │                   │                │    │
│    │  5. Validate     │                   │                │    │
│    │                  │──▶ Validate ◀────▶│                │    │
│    │                  │    & Hold         │                │    │
│    │                  │    Inventory      │                │    │
│    │                  │                   │                │    │
│    │  6. Payment      │                   │                │    │
│    │─────────────────▶│──────────────────▶│                │    │
│    │                  │                   │                │    │
│    │                  │                   │ 7. Process     │    │
│    │                  │                   │    Payment     │    │
│    │                  │                   │                │    │
│    │                  │◀──────────────────│                │    │
│    │                  │   Payment Success │                │    │
│    │                  │                   │                │    │
│    │                  │ 8. Confirm Booking                │    │
│    │                  │──────────────────────────────────▶│    │
│    │                  │                   │                │    │
│    │  9. Confirmation │                   │                │    │
│    │◀─────────────────│                   │                │    │
│    │                  │                   │                │    │
│    │  10. Email/SMS   │                   │                │    │
│    │◀═════════════════│                   │                │    │
│    │                  │                   │                │    │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.2 Booking Flow (OTA)

```
┌─────────────────────────────────────────────────────────────────┐
│                      OTA BOOKING FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OTA           Channel Manager        StaySuite      Property   │
│   │                   │                   │              │      │
│   │ 1. Guest Books    │                   │              │      │
│   │ on OTA Platform   │                   │              │      │
│   │                   │                   │              │      │
│   │ 2. Webhook        │                   │              │      │
│   │──────────────────▶│                   │              │      │
│   │  (Reservation)    │                   │              │      │
│   │                   │                   │              │      │
│   │                   │ 3. Verify HMAC    │              │      │
│   │                   │    Signature      │              │      │
│   │                   │                   │              │      │
│   │                   │ 4. Check          │              │      │
│   │                   │    Idempotency    │              │      │
│   │                   │                   │              │      │
│   │                   │ 5. Map OTA Data   │              │      │
│   │                   │    to Internal    │              │      │
│   │                   │                   │              │      │
│   │                   │ 6. Create Booking │              │      │
│   │                   │──────────────────▶│              │      │
│   │                   │                   │              │      │
│   │                   │                   │ 7. Lock      │      │
│   │                   │                   │    Inventory │      │
│   │                   │                   │─────────────▶│      │
│   │                   │                   │              │      │
│   │                   │                   │ 8. Create    │      │
│   │                   │                   │    Folio     │      │
│   │                   │                   │              │      │
│   │                   │ 9. Booking Created│              │      │
│   │                   │◀──────────────────│              │      │
│   │                   │                   │              │      │
│   │ 10. ACK Response  │                   │              │      │
│   │◀──────────────────│                   │              │      │
│   │                   │                   │              │      │
│   │                   │ 11. Update        │              │      │
│   │                   │     Availability  │              │      │
│   │                   │─────────────────────────────────────────▶│
│   │                   │                   │              │      │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.3 Booking State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOOKING STATE MACHINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                     ┌─────────┐                                  │
│                     │  DRAFT  │                                  │
│                     └────┬────┘                                  │
│                          │ Confirm                               │
│                          ▼                                       │
│                     ┌─────────┐                                  │
│           ┌────────│CONFIRMED│────────┐                          │
│           │        └────┬────┘        │                          │
│           │             │             │                          │
│        Cancel        Check-in     No-show                        │
│           │             │             │                          │
│           ▼             ▼             ▼                          │
│      ┌─────────┐  ┌──────────┐  ┌─────────┐                     │
│      │CANCELLED│  │CHECKED_IN│  │ NO-SHOW │                     │
│      └─────────┘  └────┬─────┘  └─────────┘                     │
│                        │                                        │
│                    Check-out                                    │
│                        │                                        │
│                        ▼                                        │
│                  ┌───────────┐                                  │
│                  │CHECKED_OUT│                                  │
│                  └───────────┘                                  │
│                                                                  │
│  State Rules:                                                    │
│  ─────────────────────────────────────────────────────────────  │
│  • DRAFT → Initial state, can be edited freely                  │
│  • CONFIRMED → Inventory locked, modification restricted        │
│  • CHECKED_IN → Guest on property, WiFi active, folio open      │
│  • CHECKED_OUT → Final state, folio closed, archived            │
│  • CANCELLED → Inventory released, refund processed             │
│  • NO-SHOW → Auto-cancellation after cut-off time               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Phase 3: Pre-Arrival Journey

#### 2.4.1 Pre-Arrival Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRE-ARRIVAL PHASE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Timeline: 48-72 hours before check-in                          │
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Booking        │                                              │
│  │ Confirmed      │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐      ┌────────────────┐                     │
│  │ Pre-Arrival    │      │ Email/SMS with │                     │
│  │ Automation     │─────▶│ Pre-Check-in   │                     │
│  │ Triggered      │      │ Link           │                     │
│  └────────────────┘      └───────┬────────┘                     │
│                                  │                              │
│          ┌───────────────────────┘                              │
│          ▼                                                      │
│  ┌────────────────┐                                              │
│  │ Guest Receives │                                              │
│  │ Pre-Arrival    │                                              │
│  │ Link           │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               PRE-CHECK-IN PORTAL                          │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 1. Verify Identity (Phone/Email OTP)                 │  │ │
│  │  │ 2. Complete Guest Details                            │  │ │
│  │  │ 3. Upload ID Documents (KYC)                         │  │ │
│  │  │ 4. Add Preferences (Room, Food, etc.)                │  │ │
│  │  │ 5. Add Special Requests                              │  │ │
│  │  │ 6. Payment Method (Pre-auth)                         │  │ │
│  │  │ 7. Digital Signature (Terms & Conditions)            │  │ │
│  │  │ 8. Early Check-in Request (if available)             │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Pre-Check-in   │                                              │
│  │ Complete       │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Digital Key    │      (If enabled & early check-in complete) │
│  │ Generated      │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Welcome Message│      (Scheduled for arrival day)            │
│  │ Sent           │                                              │
│  └────────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.4.2 Pre-Arrival Automation Triggers

| Trigger | Timing | Action |
|---------|--------|--------|
| Booking Confirmed | Immediate | Confirmation email |
| 72 hours before | T-72h | Pre-arrival email with check-in link |
| 48 hours before | T-48h | Reminder if pre-check-in incomplete |
| 24 hours before | T-24h | Final reminder |
| Day of arrival | T-0 | Welcome message + WiFi credentials |
| VIP Guest | Immediate | Alert to management |

### 2.5 Phase 4: Stay Journey

#### 2.5.1 Check-In Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHECK-IN FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest          Front Desk         StaySuite        Systems     │
│    │                │                  │               │        │
│    │ 1. Arrive at   │                  │               │        │
│    │    Property    │                  │               │        │
│    │───────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 2. Find Booking  │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │ 3. Verify ID     │               │        │
│    │◀──────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 4. Review Folio  │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │ 5. Collect       │               │        │
│    │                │    Payment       │               │        │
│    │◀──────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 6. Assign Room   │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │                  │ 7. Update     │        │
│    │                │                  │    Room Status│        │
│    │                │                  │──────────────▶│        │
│    │                │                  │               │        │
│    │                │ 8. Check-In      │               │        │
│    │                │    Action        │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │                  │ ┌────────────────────┐ │
│    │                │                  │ │ AUTOMATIC TRIGGERS │ │
│    │                │                  │ ├────────────────────┤ │
│    │                │                  │ │ • WiFi Enable      │ │
│    │                │                  │ │ • Digital Key Gen  │ │
│    │                │                  │ │ • Room Status      │ │
│    │                │                  │ │ • Welcome Message  │ │
│    │                │                  │ │ • Loyalty Points   │ │
│    │                │                  │ │ • Upsell Offers    │ │
│    │                │                  │ └────────────────────┘ │
│    │                │                  │               │        │
│    │ 9. Key Card /  │                  │               │        │
│    │    Digital Key │                  │               │        │
│    │◀───────────────│                  │               │        │
│    │                │                  │               │        │
│    │ 10. Room       │                  │               │        │
│    │     Directions │                  │               │        │
│    │◀───────────────│                  │               │        │
│    │                │                  │               │        │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.5.2 During Stay - Service Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   SERVICE REQUEST FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest            In-Room         Staff          StaySuite      │
│    │               Portal            App              │         │
│    │                 │                │               │         │
│    │ 1. Open In-Room │                │               │         │
│    │    Portal (QR)  │                │               │         │
│    │────────────────▶│                │               │         │
│    │                 │                │               │         │
│    │ 2. Select       │                │               │         │
│    │    Service      │                │               │         │
│    │────────────────▶│                │               │         │
│    │                 │                │               │         │
│    │                 │ 3. Submit      │               │         │
│    │                 │    Request     │               │         │
│    │                 │───────────────────────────────▶│         │
│    │                 │                │               │         │
│    │                 │                │ 4. Notify     │         │
│    │                 │                │    Staff      │         │
│    │                 │                │◀──────────────│         │
│    │                 │                │               │         │
│    │                 │                │ 5. Accept     │         │
│    │                 │                │    Request    │         │
│    │                 │                │──────────────▶│         │
│    │                 │                │               │         │
│    │ 6. Status       │                │               │         │
│    │    Update       │                │               │         │
│    │◀────────────────────────────────────────────────│         │
│    │                 │                │               │         │
│    │                 │                │ 7. Complete   │         │
│    │                 │                │    Service    │         │
│    │                 │                │──────────────▶│         │
│    │                 │                │               │         │
│    │ 8. Request      │                │               │         │
│    │    Complete     │                │               │         │
│    │◀────────────────────────────────────────────────│         │
│    │                 │                │               │         │
│    │ 9. Rating       │                │               │         │
│    │    Request      │                │               │         │
│    │◀────────────────────────────────────────────────│         │
│    │                 │                │               │         │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.5.3 During Stay - WiFi Experience

```
┌─────────────────────────────────────────────────────────────────┐
│                    GUEST WIFI EXPERIENCE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest               Network             StaySuite              │
│    │                    │                    │                   │
│    │ 1. Connect to      │                    │                   │
│    │    "Hotel-Guest"   │                    │                   │
│    │    WiFi SSID       │                    │                   │
│    │───────────────────▶│                    │                   │
│    │                    │                    │                   │
│    │ 2. Redirect to     │                    │                   │
│    │    Captive Portal  │                    │                   │
│    │◀───────────────────│                    │                   │
│    │                    │                    │                   │
│    │ 3. Enter Room #    │                    │                   │
│    │    & Last Name     │                    │                   │
│    │───────────────────▶│                    │                   │
│    │                    │                    │                   │
│    │                    │ 4. RADIUS Auth     │                   │
│    │                    │    Request         │                   │
│    │                    │───────────────────▶│                   │
│    │                    │                    │                   │
│    │                    │                    │ 5. Verify Guest   │
│    │                    │                    │    (Checked-in)   │
│    │                    │                    │                   │
│    │                    │ 6. Auth Success    │                   │
│    │                    │    + Bandwidth     │                   │
│    │                    │◀───────────────────│                   │
│    │                    │                    │                   │
│    │ 7. Internet Access │                    │                   │
│    │    Granted         │                    │                   │
│    │◀───────────────────│                    │                   │
│    │                    │                    │                   │
│    │ 8. Browse Internet │                    │                   │
│    │───────────────────▶│ 9. Log Session     │                   │
│    │                    │───────────────────▶│                   │
│    │                    │                    │                   │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.5.4 Check-Out Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHECK-OUT FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest          Front Desk         StaySuite        Systems     │
│    │                │                  │               │        │
│    │ 1. Request     │                  │               │        │
│    │    Check-out   │                  │               │        │
│    │───────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 2. Retrieve      │               │        │
│    │                │    Booking       │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │ 3. Review Folio  │               │        │
│    │                │    (All Charges) │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │ 4. Review      │                  │               │        │
│    │    Charges     │                  │               │        │
│    │◀──────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 5. Process       │               │        │
│    │                │    Final Payment │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │ 6. Generate      │               │        │
│    │                │    Invoice       │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │ 7. Print/Email │                  │               │        │
│    │    Invoice     │                  │               │        │
│    │◀───────────────│                  │               │        │
│    │                │                  │               │        │
│    │                │ 8. Check-Out     │               │        │
│    │                │    Action        │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │                  │ ┌────────────────────┐ │
│    │                │                  │ │ AUTOMATIC TRIGGERS │ │
│    │                │                  │ ├────────────────────┤ │
│    │                │                  │ │ • WiFi Disable     │ │
│    │                │                  │ │ • Digital Key Revk │ │
│    │                │                  │ │ • Room Dirty Status│ │
│    │                │                  │ │ • Housekeeping Task│ │
│    │                │                  │ │ • Feedback Request │ │
│    │                │                  │ │ • Loyalty Update   │ │
│    │                │                  │ │ • OTA Sync         │ │
│    │                │                  │ └────────────────────┘ │
│    │                │                  │               │        │
│    │ 9. Check-out   │                  │               │        │
│    │    Complete    │                  │               │        │
│    │◀───────────────│                  │               │        │
│    │                │                  │               │        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 Phase 5: Post-Stay Journey

#### 2.6.1 Post-Stay Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     POST-STAY PHASE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Timeline: After check-out                                      │
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Check-out      │                                              │
│  │ Complete       │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 IMMEDIATE ACTIONS                          │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ • Thank you email with invoice                        │  │ │
│  │  │ • Loyalty points credited                             │  │ │
│  │  │ • Feedback request scheduled                          │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐      (24 hours after)                       │
│  │ Feedback       │                                              │
│  │ Request Sent   │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  FEEDBACK LOOP                             │ │
│  │                                                            │ │
│  │   Guest ──▶ Rating (1-5) ──▶ Comments ──▶ Submit          │ │
│  │                                                            │ │
│  │   ┌─────────────────────────────────────────────────────┐  │ │
│  │   │ IF Rating ≥ 4:                                       │  │ │
│  │   │   → Prompt for Google/OTA review                     │  │ │
│  │   │   → Add to VIP segment                               │  │ │
│  │   │   → Send referral offer                              │  │ │
│  │   └─────────────────────────────────────────────────────┘  │ │
│  │   ┌─────────────────────────────────────────────────────┐  │ │
│  │   │ IF Rating ≤ 3:                                       │  │ │
│  │   │   → Alert management                                 │  │ │
│  │   │   → Create follow-up task                            │  │ │
│  │   │   → Send apology email                               │  │ │
│  │   └─────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  CRM SEGMENTATION                          │ │
│  │                                                            │ │
│  │   Guest Profile Updated:                                   │ │
│  │   ┌────────────────────────────────────────────────────┐   │ │
│  │   │ • Total stays count                                 │   │ │
│  │   │ • Total lifetime value                              │   │ │
│  │   │ • Preferences captured                              │   │ │
│  │   │ • Segment assignment (VIP, Repeat, Corporate, etc.) │   │ │
│  │   │ • Loyalty tier                                      │   │ │
│  │   └────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                RETENTION MARKETING                         │ │
│  │                                                            │ │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │ │
│  │   │ Birthday    │ │ Anniversary │ │ Seasonal    │         │ │
│  │   │ Offer       │ │ Offer       │ │ Promotions  │         │ │
│  │   └─────────────┘ └─────────────┘ └─────────────┘         │ │
│  │                                                            │ │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │ │
│  │   │ Abandoned   │ │ Last-Minute │ │ Loyalty     │         │ │
│  │   │ Cart        │ │ Deals       │ │ Rewards     │         │ │
│  │   └─────────────┘ └─────────────┘ └─────────────┘         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Staff Journey

### 3.1 Staff Login & Daily Operations

```
┌─────────────────────────────────────────────────────────────────┐
│                    STAFF DAILY JOURNEY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Shift Start    │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   LOGIN & SETUP                            │ │
│  │                                                            │ │
│  │  1. Open Staff App / Web Portal                            │ │
│  │  2. Login with credentials                                 │ │
│  │  3. 2FA verification (if enabled)                          │ │
│  │  4. View assigned tasks                                    │ │
│  │  5. Check notifications                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 ROLE-BASED DASHBOARD                       │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Front Desk      │  │ Housekeeping    │                 │ │
│  │  │ • Arrivals      │  │ • Room Tasks    │                 │ │
│  │  │ • Departures    │  │ • Status Updates│                 │ │
│  │  │ • In-House      │  │ • Requests      │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Restaurant      │  │ Maintenance     │                 │ │
│  │  │ • Orders        │  │ • Tickets       │                 │ │
│  │  │ • Reservations  │  │ • Work Orders   │                 │ │
│  │  │ • Tables        │  │ • Assets        │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 TASK EXECUTION                             │ │
│  │                                                            │ │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐    │ │
│  │  │ Receive │──▶│ Accept  │──▶│ Execute │──▶│ Complete│    │ │
│  │  │  Task   │   │  Task   │   │  Task   │   │  Task   │    │ │
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────┘    │ │
│  │       │                                          │         │ │
│  │       │          ┌─────────────────┐             │         │ │
│  │       └─────────▶│   Notify Next   │◀────────────┘         │ │
│  │                   │   Staff/Manager │                      │ │
│  │                   └─────────────────┘                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Shift End      │                                              │
│  │ • Clock out    │                                              │
│  │ • Handover     │                                              │
│  │ • Log out      │                                              │
│  └────────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Housekeeping Staff Journey

```
┌─────────────────────────────────────────────────────────────────┐
│              HOUSEKEEPING STAFF FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   MORNING ROUTINE                           ││
│  │                                                             ││
│  │  1. Login to Staff App                                      ││
│  │  2. View assigned rooms                                     ││
│  │  3. Check priority (check-outs first)                       ││
│  │  4. Collect supplies                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   ROOM CLEANING                              ││
│  │                                                             ││
│  │   Room ──▶ Update ──▶ Clean ──▶ Mark ──▶ Request           ││
│  │   Selected   Status      Room     Clean    Inspection      ││
│  │                                                             ││
│  │   Status Options:                                           ││
│  │   ┌────────────┐ ┌────────────┐ ┌────────────┐            ││
│  │   │ Occupied   │ │ Vacant     │ │ Out of     │            ││
│  │   │ Clean      │ │ Clean      │ │ Order      │            ││
│  │   └────────────┘ └────────────┘ └────────────┘            ││
│  │   ┌────────────┐ ┌────────────┐ ┌────────────┐            ││
│  │   │ Occupied   │ │ Vacant     │ │ Out of     │            ││
│  │   │ Dirty      │ │ Dirty      │ │ Service    │            ││
│  │   └────────────┘ └────────────┘ └────────────┘            ││
│  └─────────────────────────────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   ISSUE REPORTING                            ││
│  │                                                             ││
│  │   Found Issue ──▶ Report in App ──▶ Add Photo ──▶ Submit   ││
│  │                                                             ││
│  │   Issue Types:                                              ││
│  │   • Maintenance required                                    ││
│  │   • Missing amenities                                       ││
│  │   • Damaged items                                           ││
│  │   • Lost & found                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   SHIFT COMPLETION                           ││
│  │                                                             ││
│  │   • Complete all assigned tasks                             ││
│  │   • Submit handover notes                                   ││
│  │   • Log out                                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Administrator Journey

### 4.1 Admin Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              PROPERTY ADMINISTRATION SETUP                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Tenant Created │                                              │
│  │ (by Platform)  │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  INITIAL SETUP                             │ │
│  │                                                            │ │
│  │  1. Welcome email with login link                          │ │
│  │  2. First login (force password change)                    │ │
│  │  3. Property details wizard                                │ │
│  │     ├── Property name & address                            │ │
│  │     ├── Timezone & currency                                │ │
│  │     ├── Contact information                                │ │
│  │     └── Tax configuration                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                PROPERTY CONFIGURATION                      │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Room Types      │  │ Rooms           │                 │ │
│  │  │ • Define types  │  │ • Add rooms     │                 │ │
│  │  │ • Set pricing   │  │ • Assign types  │                 │ │
│  │  │ • Amenities     │  │ • Features      │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Rate Plans      │  │ Users & Roles   │                 │ │
│  │  │ • Create plans  │  │ • Add staff     │                 │ │
│  │  │ • Restrictions  │  │ • Assign roles  │                 │ │
│  │  │ • Policies      │  │ • Permissions   │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                INTEGRATION SETUP                           │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Payment Gateway │  │ WiFi Gateway    │                 │ │
│  │  │ • API keys      │  │ • RADIUS config │                 │ │
│  │  │ • Merchant ID   │  │ • Shared secret │                 │ │
│  │  │ • Test trans.   │  │ • Test auth     │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ OTA Channels    │  │ Door Locks      │                 │ │
│  │  │ • Connect OTAs  │  │ • Lock vendor   │                 │ │
│  │  │ • Map rooms     │  │ • API config    │                 │ │
│  │  │ • Test sync     │  │ • Test unlock   │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Setup Complete │                                              │
│  │ Ready to Go    │                                              │
│  └────────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Property Manager Journey

### 5.1 Daily Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              PROPERTY MANAGER DAILY FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    MORNING REVIEW                          │ │
│  │                                                            │ │
│  │  1. Login to Dashboard                                     │ │
│  │  2. Review overnight activity                              │ │
│  │  3. Check occupancy & revenue                              │ │
│  │  4. Review alerts                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  OPERATIONS REVIEW                         │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │                TODAY'S METRICS                       │   │ │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │ │
│  │  │  │Arrivals │ │Departures│ │Occupancy│ │ Revenue │   │   │ │
│  │  │  │   12    │ │    8    │ │   78%   │ │ $4,250  │   │   │ │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │                  ALERTS                              │   │ │
│  │  │  • Low inventory alert (2 rooms left for weekend)    │   │ │
│  │  │  • OTA sync error (Booking.com - needs attention)    │   │ │
│  │  │  • VIP arrival today (Room 305)                      │   │ │
│  │  │  • Maintenance overdue (Room 210)                    │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  DECISION MAKING                           │ │
│  │                                                            │ │
│  │  • Adjust pricing (based on demand)                        │ │
│  │  • Manage overbooking                                      │ │
│  │  • Approve upgrades                                        │ │
│  │  • Handle complaints                                       │ │
│  │  • Review staff performance                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  REPORTS & ANALYTICS                       │ │
│  │                                                            │ │
│  │  Daily:                                                    │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ Occupancy   │ │ Revenue     │ │ Staff       │          │ │
│  │  │ Report      │ │ Report      │ │ Performance │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  │                                                            │ │
│  │  Weekly/Monthly:                                           │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ Channel     │ │ Guest       │ │ Forecast    │          │ │
│  │  │ Analysis    │ │ Analytics   │ │ Report      │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Channel Partner Journey

### 6.1 OTA Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  CHANNEL PARTNER INTEGRATION                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OTA             Channel Manager           StaySuite            │
│   │                     │                      │                 │
│   │  1. Connection      │                      │                 │
│   │     Established     │                      │                 │
│   │◀───────────────────▶│                      │                 │
│   │                     │                      │                 │
│   │  2. Room Mapping    │                      │                 │
│   │◀───────────────────▶│◀────────────────────▶│                 │
│   │                     │                      │                 │
│   │  3. Rate Mapping    │                      │                 │
│   │◀───────────────────▶│◀────────────────────▶│                 │
│   │                     │                      │                 │
│   │                     │                      │                 │
│   │  ┌─────────────────────────────────────────────────────┐   │
│   │  │              ONGOING SYNCHRONIZATION                │   │
│   │  │                                                     │   │
│   │  │   INBOUND (OTA → StaySuite):                        │   │
│   │  │   ┌───────────────────────────────────────────┐     │   │
│   │  │   │ • New bookings (webhooks)                 │     │   │
│   │  │   │ • Booking modifications                   │     │   │
│   │  │   │ • Cancellations                           │     │   │
│   │  │   │ • Guest inquiries                         │     │   │
│   │  │   └───────────────────────────────────────────┘     │   │
│   │  │                                                     │   │
│   │  │   OUTBOUND (StaySuite → OTA):                       │   │
│   │  │   ┌───────────────────────────────────────────┐     │   │
│   │  │   │ • Inventory updates                       │     │   │
│   │  │   │ • Rate changes                            │     │   │
│   │  │   │ • Restrictions (MLOS, stop-sell)         │     │   │
│   │  │   │ • Booking confirmations                   │     │   │
│   │  │   └───────────────────────────────────────────┘     │   │
│   │  └─────────────────────────────────────────────────────┘   │
│   │                     │                      │                 │
│   │  4. Reconciliation  │                      │                 │
│   │     (Periodic)      │                      │                 │
│   │◀───────────────────▶│◀────────────────────▶│                 │
│   │                     │                      │                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: User Journey Quick Reference

### A.1 Guest Journey Summary

| Phase | Actions | System Triggers |
|-------|---------|-----------------|
| Discovery | Search, Compare, Select | OTA display, Rate sync |
| Booking | Reserve, Pay, Confirm | Inventory lock, Email confirm |
| Pre-Arrival | Pre-check-in, Upload docs | Automation triggers |
| Stay | Check-in, Services, Check-out | WiFi enable, Digital key |
| Post-Stay | Feedback, Loyalty | CRM update, Campaigns |

### A.2 Staff Journey Summary

| Role | Primary Actions | Dashboard Focus |
|------|-----------------|-----------------|
| Front Desk | Check-in/out, Reservations | Arrivals, Departures |
| Housekeeping | Cleaning, Status updates | Task list, Room grid |
| Restaurant | Orders, Billing | Kitchen display, Tables |
| Maintenance | Repairs, Assets | Work orders, Tickets |

### A.3 Admin Journey Summary

| Phase | Actions | Tools |
|-------|---------|-------|
| Setup | Configure property | Setup wizard |
| Users | Manage access | User management |
| Integrations | Connect systems | Integration hub |
| Monitoring | Health check | Admin dashboard |

---

## Appendix B: Event Triggers Reference

### B.1 Booking Events

| Event | Triggers |
|-------|----------|
| `booking.created` | Inventory lock, Email confirm, CRM update |
| `booking.confirmed` | OTA sync, Pre-arrival schedule |
| `booking.modified` | Inventory recheck, Rate adjustment |
| `booking.cancelled` | Inventory release, Refund process |
| `booking.checked_in` | WiFi enable, Digital key, Room status |
| `booking.checked_out` | WiFi disable, Housekeeping task, Feedback |

### B.2 Payment Events

| Event | Triggers |
|-------|----------|
| `payment.initiated` | Gateway selection, Fraud check |
| `payment.completed` | Invoice generate, Booking confirm |
| `payment.failed` | Alert, Retry, Alternative gateway |
| `refund.processed` | Inventory release, Notification |

### B.3 WiFi Events

| Event | Triggers |
|-------|----------|
| `wifi.session.started` | Usage tracking start |
| `wifi.session.stopped` | Usage calculation, Billing |
| `wifi.auth.failed` | Alert, Logging |

---

**Contact**

**Cryptsk Pvt Ltd**
- **Website**: www.staysuite.io
- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd. All rights reserved.*
