# StaySuite Process Flow Documentation
## Operational Workflows & Business Processes

**Version**: 1.0  
**Last Updated**: March 2026  
**Author**: Cryptsk Pvt Ltd

---

## Table of Contents

1. [Overview](#1-overview)
2. [Front Desk Processes](#2-front-desk-processes)
3. [Housekeeping Processes](#3-housekeeping-processes)
4. [Billing Processes](#4-billing-processes)
5. [Reservation Processes](#5-reservation-processes)
6. [Guest Service Processes](#6-guest-service-processes)
7. [Reporting Processes](#7-reporting-processes)
8. [Automation Workflows](#8-automation-workflows)

---

## 1. Overview

### 1.1 Purpose

This document defines the standard operational processes and workflows that drive daily hotel operations within StaySuite. Each process includes:
- Step-by-step flow
- System interactions
- Decision points
- Exception handling

### 1.2 Process Categories

| Category | Description |
|----------|-------------|
| **Front Desk** | Check-in, check-out, walk-in processes |
| **Housekeeping** | Room cleaning, maintenance, inspections |
| **Billing** | Payment processing, invoicing, refunds |
| **Reservation** | Booking creation, modification, cancellation |
| **Guest Service** | Requests, complaints, special arrangements |
| **Reporting** | Daily reports, analytics, audits |

---

## 2. Front Desk Processes

### 2.1 Guest Check-In Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GUEST CHECK-IN PROCESS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Guest Arrives at Front Desk                                         │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │   Guest     │                                                   │
│           │   Arrives   │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐     ┌─────────────┐                              │
│           │  Greeting   │────▶│  Ask for    │                              │
│           │             │     │ Reservation │                              │
│           └─────────────┘     │   Details   │                              │
│                               └──────┬──────┘                              │
│                                      │                                       │
│                    ┌─────────────────┼─────────────────┐                   │
│                    │                 │                 │                   │
│              Has Booking       Walk-in Guest     Search Failed            │
│                    │                 │                 │                   │
│                    ▼                 ▼                 ▼                   │
│           ┌─────────────┐   ┌─────────────┐   ┌─────────────┐             │
│           │   Search    │   │  Create New │   │  Manual     │             │
│           │   Booking   │   │  Booking    │   │  Search     │             │
│           └──────┬──────┘   └──────┬──────┘   └──────┬──────┘             │
│                  │                 │                 │                     │
│                  └─────────────────┼─────────────────┘                     │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌─────────────┐                                  │
│                           │  Verify     │                                  │
│                           │  Identity   │                                  │
│                           │  (ID/Passport)                                 │
│                           └──────┬──────┘                                  │
│                                  │                                          │
│                       ┌──────────┴──────────┐                              │
│                       │                     │                              │
│                  ID Verified           ID Not Valid                         │
│                       │                     │                              │
│                       ▼                     ▼                              │
│                ┌─────────────┐        ┌─────────────┐                     │
│                │  Continue   │        │  Request    │                     │
│                │             │        │  Alternative│                     │
│                └──────┬──────┘        └─────────────┘                     │
│                       │                                                    │
│                       ▼                                                    │
│                ┌─────────────┐                                             │
│                │  Review     │                                             │
│                │  Booking    │                                             │
│                │  Details    │                                             │
│                └──────┬──────┘                                             │
│                       │                                                    │
│         ┌─────────────┼─────────────┐                                     │
│         │             │             │                                     │
│    Pre-paid      Pay at Hotel   Payment                               │
│    Booking       (Deposit)       Issues                                   │
│         │             │             │                                     │
│         ▼             ▼             ▼                                     │
│    ┌─────────┐  ┌─────────┐  ┌─────────────┐                             │
│    │Continue │  │ Collect │  │ Resolve     │                             │
│    │         │  │ Payment │  │ Payment     │                             │
│    └────┬────┘  └────┬────┘  │ (Alt method)│                             │
│         │            │       └─────────────┘                             │
│         └─────┬──────┘                                                    │
│               │                                                            │
│               ▼                                                            │
│        ┌─────────────┐                                                    │
│        │  Assign     │                                                    │
│        │  Room       │                                                    │
│        └──────┬──────┘                                                    │
│               │                                                            │
│    ┌──────────┴──────────┐                                                │
│    │                     │                                                │
│ Room Ready         Room Not Ready                                          │
│    │                     │                                                │
│    ▼                     ▼                                                │
│ ┌─────────┐      ┌─────────────────┐                                      │
│ │Continue │      │ Offer           │                                      │
│ │         │      │ Alternatives:   │                                      │
│ └────┬────┘      │ • Different room│                                      │
│      │           │ • Wait in lobby │                                      │
│      │           │ • Early check-in│                                      │
│      │           │   fee           │                                      │
│      │           └────────┬────────┘                                      │
│      │                    │                                                │
│      └────────────────────┘                                                │
│               │                                                            │
│               ▼                                                            │
│        ┌─────────────┐                                                    │
│        │  Check-In   │                                                    │
│        │  Action     │──────────────────────────────────────────┐         │
│        │  (System)   │                                          │         │
│        └──────┬──────┘                                          │         │
│               │                                                 │         │
│               │  SYSTEM AUTOMATION:                             │         │
│               │  ─────────────────────────────────────────────│         │
│               │  • Update booking status → CHECKED_IN         │         │
│               │  • Update room status → OCCUPIED              │         │
│               │  • Enable WiFi access                         │         │
│               │  • Generate digital key (if enabled)          │         │
│               │  • Send welcome message                       │         │
│               │  • Create housekeeping check-in record        │         │
│               │  • Update guest profile (stay count)          │         │
│               │                                                 │         │
│               ▼                                                 │         │
│        ┌─────────────┐                                         │         │
│        │  Hand Over  │                                         │         │
│        │  Key Card   │                                         │         │
│        └──────┬──────┘                                         │         │
│               │                                                 │         │
│               ▼                                                 │         │
│        ┌─────────────┐                                         │         │
│        │  Provide    │                                         │         │
│        │  Information│                                         │         │
│        │  • Room #   │                                         │         │
│        │  • WiFi     │                                         │         │
│        │  • Amenities│                                         │         │
│        │  • Services │                                         │         │
│        └──────┬──────┘                                         │         │
│               │                                                 │         │
│               ▼                                                 │         │
│        ┌─────────────┐                                         │         │
│        │  END:       │                                         │         │
│        │  Guest      │                                         │         │
│        │  Checked In │                                         │         │
│        └─────────────┘                                         │         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Guest Check-Out Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GUEST CHECK-OUT PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Guest Requests Check-Out                                            │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │   Guest     │                                                   │
│           │   Requests  │                                                   │
│           │   Check-Out │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Retrieve   │                                                   │
│           │  Booking    │                                                   │
│           │  (Room # or Name)                                               │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Review     │                                                   │
│           │  Folio      │                                                   │
│           │  • Room charges                                                │
│           │  • F&B charges                                                 │
│           │  • Extra services                                              │
│           │  • Taxes                                                       │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐     ┌─────────────┐                              │
│           │  Present    │────▶│  Guest      │                              │
│           │  Folio      │     │  Review     │                              │
│           │  Summary    │     │             │                              │
│           └─────────────┘     └──────┬──────┘                              │
│                                        │                                     │
│                          ┌─────────────┼─────────────┐                      │
│                          │             │             │                      │
│                     Approved      Dispute       Add Charges                 │
│                          │             │             │                      │
│                          ▼             ▼             ▼                      │
│                   ┌───────────┐ ┌───────────┐ ┌───────────┐                │
│                   │ Continue  │ │ Investigate│ │ Add Item  │                │
│                   │           │ │ & Resolve  │ │ to Folio  │                │
│                   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘                │
│                         │             │             │                       │
│                         └─────────────┼─────────────┘                       │
│                                       │                                      │
│                                       ▼                                      │
│                              ┌─────────────┐                                │
│                              │  Calculate  │                                │
│                              │  Balance    │                                │
│                              └──────┬──────┘                                │
│                                     │                                        │
│                      ┌──────────────┼──────────────┐                        │
│                      │              │              │                        │
│                 Balance=0     Credit Due     Payment Due                    │
│                      │              │              │                        │
│                      ▼              ▼              ▼                        │
│               ┌───────────┐  ┌───────────┐  ┌───────────┐                  │
│               │ Generate  │  │ Process   │  │ Process   │                  │
│               │ Invoice   │  │ Refund    │  │ Payment   │                  │
│               │ Only      │  │           │  │           │                  │
│               └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                  │
│                     │              │              │                         │
│                     └──────────────┼──────────────┘                         │
│                                    │                                        │
│                                    ▼                                        │
│                             ┌─────────────┐                                │
│                             │  Generate   │                                │
│                             │  Invoice    │                                │
│                             └──────┬──────┘                                │
│                                    │                                        │
│                                    ▼                                        │
│                             ┌─────────────┐                                │
│                             │  Deliver    │                                │
│                             │  Invoice    │                                │
│                             │  (Print/Email)                               │
│                             └──────┬──────┘                                │
│                                    │                                        │
│                                    ▼                                        │
│                             ┌─────────────┐                                │
│                             │  Check-Out  │                                │
│                             │  Action     │────────────────────────────┐   │
│                             │  (System)   │                            │   │
│                             └──────┬──────┘                            │   │
│                                    │                                    │   │
│                                    │  SYSTEM AUTOMATION:                │   │
│                                    │  ────────────────────────────────│   │
│                                    │  • Update booking → CHECKED_OUT  │   │
│                                    │  • Update room → VACANT_DIRTY    │   │
│                                    │  • Disable WiFi access           │   │
│                                    │  • Revoke digital key            │   │
│                                    │  • Create housekeeping task      │   │
│                                    │  • Send feedback request         │   │
│                                    │  • Update guest profile          │   │
│                                    │  • Credit loyalty points         │   │
│                                    │                                    │   │
│                                    ▼                                    │   │
│                             ┌─────────────┐                            │   │
│                             │  Collect    │                            │   │
│                             │  Key Card   │                            │   │
│                             └──────┬──────┘                            │   │
│                                    │                                    │   │
│                                    ▼                                    │   │
│                             ┌─────────────┐                            │   │
│                             │  Thank      │                            │   │
│                             │  Guest      │                            │   │
│                             └──────┬──────┘                            │   │
│                                    │                                    │   │
│                                    ▼                                    │   │
│                             ┌─────────────┐                            │   │
│                             │  END:       │                            │   │
│                             │  Check-Out  │                            │   │
│                             │  Complete   │                            │   │
│                             └─────────────┘                            │   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Walk-In Booking Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WALK-IN BOOKING PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Guest Arrives Without Reservation                                   │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │   Walk-in   │                                                   │
│           │   Guest     │                                                   │
│           │   Arrives   │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Ask for    │                                                   │
│           │  Stay Dates │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Check      │                                                   │
│           │  Availability│                                                  │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│        ┌─────────┴─────────┐                                                │
│        │                   │                                                │
│   Rooms Available    No Availability                                         │
│        │                   │                                                │
│        ▼                   ▼                                                │
│ ┌─────────────┐     ┌─────────────┐                                        │
│ │ Show        │     │ Offer       │                                        │
│ │ Available   │     │ Alternatives│                                        │
│ │ Rooms       │     │ • Waitlist  │                                        │
│ └──────┬──────┘     │ • Nearby    │                                        │
│        │            │   hotels    │                                        │
│        │            │ • Different │                                        │
│        │            │   dates     │                                        │
│        │            └─────────────┘                                        │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐                                                             │
│ │ Present     │                                                             │
│ │ Options     │                                                             │
│ │ • Room types│                                                             │
│ │ • Rates     │                                                             │
│ └──────┬──────┘                                                             │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐                                                             │
│ │ Guest       │                                                             │
│ │ Selection   │                                                             │
│ └──────┬──────┘                                                             │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐                                                             │
│ │ Collect     │                                                             │
│ │ Guest Info  │                                                             │
│ │ • Name      │                                                             │
│ │ • Phone     │                                                             │
│ │ • Email     │                                                             │
│ │ • ID        │                                                             │
│ └──────┬──────┘                                                             │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐                                                             │
│ │ Create      │                                                             │
│ │ Booking     │                                                             │
│ │ (Status:    │                                                             │
│ │  CONFIRMED) │                                                             │
│ └──────┬──────┘                                                             │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐     ┌─────────────┐                                        │
│ │ Collect     │────▶│ Payment     │                                        │
│ │ Payment     │     │ Confirmed   │                                        │
│ └─────────────┘     └──────┬──────┘                                        │
│                            │                                                 │
│                            ▼                                                 │
│                     ┌─────────────┐                                         │
│                     │ Immediate   │                                         │
│                     │ Check-In    │                                         │
│                     │ (See        │                                         │
│                     │  Check-In   │                                         │
│                     │  Process)   │                                         │
│                     └─────────────┘                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Housekeeping Processes

### 3.1 Daily Housekeeping Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DAILY HOUSEKEEPING WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Morning Shift Begin                                                 │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │   Shift     │                                                   │
│           │   Start     │                                                   │
│           │   (7:00 AM) │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Staff      │                                                   │
│           │  Login      │                                                   │
│           │  (Staff App)│                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────────────────────────────────────────────────┐       │
│           │                  VIEW TASK LIST                          │       │
│           │                                                          │       │
│           │   Priority Order:                                        │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   1. Check-outs (Departures today)                      │       │
│           │   2. Stay-overs (Guests continuing stay)                │       │
│           │   3. Vacant dirty rooms                                 │       │
│           │   4. Special requests                                   │       │
│           │                                                          │       │
│           └──────────────────────────────────────────────────────────┘       │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Start      │                                                   │
│           │  First Task │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│         ┌────────┴────────┐                                                 │
│         │                 │                                                 │
│    Check-Out         Stay-Over                                              │
│    Room              Room                                                   │
│         │                 │                                                 │
│         ▼                 ▼                                                 │
│  ┌──────────────┐  ┌──────────────┐                                        │
│  │ Full Clean   │  │ Light Clean  │                                        │
│  │              │  │              │                                        │
│  │ • Strip bed  │  │ • Make bed   │                                        │
│  │ • Fresh linen│  │ • Empty trash│                                        │
│  │ • Clean bath │  │ • Quick wipe │                                        │
│  │ • Dust all   │  │ • Check      │                                        │
│  │ • Vacuum     │  │   amenities  │                                        │
│  │ • Check mini │  │              │                                        │
│  │   bar        │  │              │                                        │
│  └──────┬───────┘  └──────┬───────┘                                        │
│         │                 │                                                 │
│         └────────┬────────┘                                                 │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Issues     │     ┌─────────────┐                              │
│           │  Found?     │────▶│ Yes         │                              │
│           └─────────────┘     │             │                              │
│                  │            │ ┌─────────┐ │                              │
│                  No           │ │Report   │ │                              │
│                  │            │ │Issue    │ │                              │
│                  │            │ │• Maint. │ │                              │
│                  │            │ │• Damage │ │                              │
│                  │            │ │• Lost & │ │                              │
│                  │            │ │  Found  │ │                              │
│                  │            │ └────┬────┘ │                              │
│                  │            └─────┼──────┘                              │
│                  │                  │                                      │
│                  └──────────────────┘                                      │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                               │
│                              │  Update     │                               │
│                              │  Room Status│                               │
│                              │  → CLEAN    │                               │
│                              └──────┬──────┘                               │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                               │
│                              │  Complete   │                               │
│                              │  Task in    │                               │
│                              │  System     │                               │
│                              └──────┬──────┘                               │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                               │
│                              │  More       │     ┌─────────────┐          │
│                              │  Tasks?     │────▶│ Yes         │          │
│                              └─────────────┘     │             │          │
│                                     │            │ Next Task   │          │
│                                     No           │             │          │
│                                     │            └──────┬──────┘          │
│                                     │                   │                  │
│                                     │    ┌──────────────┘                  │
│                                     │    │                                 │
│                                     │    └────────────────────┐            │
│                                     │                         │            │
│                                     │                         ▼            │
│                                     │                  ┌─────────────┐    │
│                                     │                  │   Process   │    │
│                                     │                  │   Next Task │    │
│                                     │                  └─────────────┘    │
│                                     │                                    │
│                                     ▼                                    │
│                              ┌─────────────┐                            │
│                              │  END:       │                            │
│                              │  Shift      │                            │
│                              │  Complete   │                            │
│                              └─────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Room Status State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ROOM STATUS STATE MACHINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                          ┌─────────────────┐                                │
│                          │   VACANT_DIRTY  │                                │
│                          │                 │                                │
│                          │  Room empty,    │                                │
│                          │  needs cleaning │                                │
│                          └────────┬────────┘                                │
│                                   │                                          │
│                      Housekeeping │ Clean                                    │
│                                   │ Complete                                 │
│                                   ▼                                          │
│                          ┌─────────────────┐                                │
│                          │   VACANT_CLEAN  │                                │
│                          │                 │                                │
│                          │  Room ready     │                                │
│                          │  for guest      │                                │
│                          └────────┬────────┘                                │
│                                   │                                          │
│                        Guest Check│-In                                       │
│                                   │                                          │
│                                   ▼                                          │
│              ┌────────────────────────────────────────────┐                 │
│              │                                             │                 │
│              │            OCCUPIED                         │                 │
│              │                                             │                 │
│              │   ┌─────────────┐    ┌─────────────┐       │                 │
│              │   │ OCCUPIED_   │◀──▶│ OCCUPIED_   │       │                 │
│              │   │ CLEAN       │    │ DIRTY       │       │                 │
│              │   │             │    │             │       │                 │
│              │   │ Guest in,   │    │ Guest in,   │       │                 │
│              │   │ room clean  │    │ needs clean │       │                 │
│              │   └─────────────┘    └─────────────┘       │                 │
│              │                                             │                 │
│              └──────────────────────┬─────────────────────┘                 │
│                                     │                                        │
│                        Guest Check-Out                                      │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌─────────────────┐                                │
│                          │   VACANT_DIRTY  │                                │
│                          │   (Loop back)   │                                │
│                          └─────────────────┘                                │
│                                                                              │
│              ┌─────────────────────────────────────────────┐                │
│              │                                             │                │
│              │            SPECIAL STATUSES                  │                │
│              │                                             │                │
│              │   ┌─────────────────┐  ┌─────────────────┐ │                │
│              │   │ OUT_OF_ORDER    │  │ OUT_OF_SERVICE  │ │                │
│              │   │                 │  │                 │ │                │
│              │   │ Maintenance     │  │ Long-term       │ │                │
│              │   │ required        │  │ unavailable     │ │                │
│              │   │ (repair)        │  │ (renovation)    │ │                │
│              │   └─────────────────┘  └─────────────────┘ │                │
│              │                                             │                │
│              └─────────────────────────────────────────────┘                │
│                                                                              │
│  Transitions:                                                               │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  From              To                  Trigger                              │
│  ─────────────────────────────────────────────────────────────────────     │
│  VACANT_DIRTY   → VACANT_CLEAN      → Housekeeping complete               │
│  VACANT_CLEAN   → OCCUPIED_CLEAN    → Guest check-in                      │
│  OCCUPIED_CLEAN → OCCUPIED_DIRTY    → After time / guest request          │
│  OCCUPIED_DIRTY → OCCUPIED_CLEAN    → Housekeeping complete               │
│  OCCUPIED_*     → VACANT_DIRTY      → Guest check-out                     │
│  ANY            → OUT_OF_ORDER      → Maintenance issue reported          │
│  OUT_OF_ORDER   → VACANT_DIRTY      → Maintenance complete                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Billing Processes

### 4.1 Folio Management Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FOLIO MANAGEMENT PROCESS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FOLIO STRUCTURE                                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         GUEST FOLIO                                  │   │
│  │                                                                      │   │
│  │   Date        Description              Debit      Credit    Balance │   │
│  │   ─────────────────────────────────────────────────────────────────│   │
│  │   Mar 15      Room Charge - Deluxe     $150.00              $150.00 │   │
│  │   Mar 15      Room Service             $35.00               $185.00 │   │
│  │   Mar 16      Room Charge - Deluxe     $150.00              $335.00 │   │
│  │   Mar 16      Mini Bar                 $25.00               $360.00 │   │
│  │   Mar 16      Deposit                            $200.00    $160.00 │   │
│  │   Mar 17      Room Charge - Deluxe     $150.00              $310.00 │   │
│  │   Mar 17      Tax (12%)                $37.20               $347.20 │   │
│  │   ─────────────────────────────────────────────────────────────────│   │
│  │   TOTAL DUE:                                        $347.20          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  CHARGE TYPES                                                               │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ ROOM CHARGES    │  │ F&B CHARGES     │  │ SERVICE CHARGES │            │
│  │                 │  │                 │  │                 │            │
│  │ • Nightly rate  │  │ • Restaurant    │  │ • Laundry       │            │
│  │ • Extra person  │  │ • Room service  │  │ • Spa           │            │
│  │ • Rollaway bed  │  │ • Mini bar      │  │ • Transportation│            │
│  │ • Early/Late    │  │ • Bar           │  │ • Tours         │            │
│  │   check-in/out  │  │                 │  │ • Business ctr  │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ ADJUSTMENTS     │  │ PAYMENTS        │  │ REFUNDS         │            │
│  │                 │  │                 │  │                 │            │
│  │ • Discounts     │  │ • Cash          │  │ • Cancellation  │            │
│  │ • Corrections   │  │ • Credit card   │  │ • Service issue │            │
│  │ • Write-offs    │  │ • Debit card    │  │ • Overcharge    │            │
│  │ • Comps         │  │ • UPI/Wallet    │  │                 │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
│  FOLIO SPLITTING                                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Single Folio                    Split Folio                       │   │
│  │                                                                      │   │
│  │   ┌─────────────────┐            ┌─────────────────┐               │   │
│  │   │  Master Folio   │            │  Room Folio     │               │   │
│  │   │                 │            │  (Company pays) │               │   │
│  │   │  All charges    │            │  • Room         │               │   │
│  │   │  to one account │            │  • Tax          │               │   │
│  │   └─────────────────┘            └─────────────────┘               │   │
│  │                                           │                         │   │
│  │                                           ▼                         │   │
│  │                                   ┌─────────────────┐               │   │
│  │                                   │  Incidentals    │               │   │
│  │                                   │  (Guest pays)   │               │   │
│  │                                   │  • F&B          │               │   │
│  │                                   │  • Services     │               │   │
│  │                                   │  • Mini bar     │               │   │
│  │                                   └─────────────────┘               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Reservation Processes

### 5.1 Booking Modification Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BOOKING MODIFICATION PROCESS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Modification Request Received                                       │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │  Request    │                                                   │
│           │  to Modify  │                                                   │
│           │  Booking    │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Retrieve   │                                                   │
│           │  Booking    │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Check      │                                                   │
│           │  Status     │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│       ┌──────────┼──────────┐                                               │
│       │          │          │                                               │
│  CONFIRMED   CHECKED_IN  CANCELLED                                          │
│       │          │          │                                               │
│       │          │          └────▶ Cannot modify                            │
│       │          │                   cancelled bookings                      │
│       │          │                                                          │
│       │          ▼                                                          │
│       │    ┌─────────────────────────────┐                                  │
│       │    │  Limited modifications      │                                  │
│       │    │  allowed during stay:       │                                  │
│       │    │  • Extend stay (if avail.)  │                                  │
│       │    │  • Add services             │                                  │
│       │    │  • Update guest info        │                                  │
│       │    └─────────────────────────────┘                                  │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────┐                                                           │
│  │  Determine  │                                                           │
│  │  Change Type│                                                           │
│  └──────┬──────┘                                                           │
│         │                                                                   │
│    ┌────┼────────────────┬────────────────┬─────────────┐                 │
│    │    │                │                │             │                 │
│ Dates Room           Guest Info      Rate Plan      Cancel                           │
│    │    │                │                │             │                 │
│    ▼    ▼                ▼                ▼             ▼                 │
│ ┌──────┴──────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐         │
│ │ Check       │   │ Update    │   │ Change    │   │ Process   │         │
│ │ Availability│   │ Details   │   │ Rate      │   │ Cancel    │         │
│ │             │   │           │   │           │   │ (Separate │         │
│ │ If new dates│   │ No        │   │ Recalc    │   │  flow)    │         │
│ │ available:  │   │ inventory │   │ charges   │   └───────────┘         │
│ │ • Lock new  │   │ impact    │   │           │                          │
│ │ • Release   │   │           │   │           │                          │
│ │   old       │   │           │   │           │                          │
│ └──────┬──────┘   └─────┬─────┘   └─────┬─────┘                          │
│        │                │               │                                  │
│        └────────────────┴───────────────┘                                  │
│                         │                                                   │
│                         ▼                                                   │
│                  ┌─────────────┐                                            │
│                  │  Calculate  │                                            │
│                  │  Price Diff │                                            │
│                  └──────┬──────┘                                            │
│                         │                                                   │
│              ┌──────────┼──────────┐                                       │
│              │          │          │                                       │
│         No Change   Guest Owes   Guest Due                                  │
│              │          │          │                                       │
│              │          ▼          ▼                                       │
│              │    ┌─────────┐ ┌─────────┐                                  │
│              │    │ Collect │ │ Process │                                  │
│              │    │ Payment │ │ Refund  │                                  │
│              │    └────┬────┘ └────┬────┘                                  │
│              │         │           │                                        │
│              └─────────┴───────────┘                                        │
│                        │                                                    │
│                        ▼                                                    │
│                 ┌─────────────┐                                             │
│                 │  Update     │                                             │
│                 │  Booking    │                                             │
│                 │  Record     │                                             │
│                 └──────┬──────┘                                             │
│                        │                                                    │
│                        ▼                                                    │
│                 ┌─────────────┐                                             │
│                 │  Log Audit  │                                             │
│                 │  Entry      │                                             │
│                 └──────┬──────┘                                             │
│                        │                                                    │
│                        ▼                                                    │
│                 ┌─────────────┐                                             │
│                 │  Send       │                                             │
│                 │  Confirmation│                                            │
│                 │  (Email/SMS)│                                             │
│                 └──────┬──────┘                                             │
│                        │                                                    │
│                        ▼                                                    │
│                 ┌─────────────┐                                             │
│                 │  END:       │                                             │
│                 │  Modified   │                                             │
│                 │  Successfully                                             │
│                 └─────────────┘                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Guest Service Processes

### 6.1 Service Request Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SERVICE REQUEST PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Guest Submits Request                                               │
│                                                                              │
│           ┌─────────────────────────────────────────────────────────────┐  │
│           │                    REQUEST CHANNELS                          │  │
│           │                                                              │  │
│           │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │  │
│           │  │ In-Room │  │ Guest   │  │ Phone   │  │ Front   │       │  │
│           │  │ Portal  │  │ App     │  │ Call    │  │ Desk    │       │  │
│           │  │ (QR)    │  │         │  │         │  │         │       │  │
│           │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │  │
│           │       │            │            │            │              │  │
│           │       └────────────┴────────────┴────────────┘              │  │
│           │                            │                                 │  │
│           │                            ▼                                 │  │
│           │                    ┌─────────────┐                           │  │
│           │                    │  Request    │                           │  │
│           │                    │  Received   │                           │  │
│           │                    └─────────────┘                           │  │
│           │                                                              │  │
│           └──────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                               │
│                              │  Categorize │                               │
│                              │  Request    │                               │
│                              └──────┬──────┘                               │
│                                     │                                       │
│          ┌──────────────┬───────────┼───────────┬──────────────┐          │
│          │              │           │           │              │          │
│     Housekeeping  Room Service  Maintenance  Concierge   Other            │
│          │              │           │           │              │          │
│          ▼              ▼           ▼           ▼              ▼          │
│    ┌───────────┐  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐  │
│    │ • Clean   │  │ • Food    │ │ • Repair  │ │ • Transport│ │Custom │  │
│    │ • Towels  │  │ • Drinks  │ │ • AC      │ │ • Booking  │ │Task   │  │
│    │ • Amenities│ │ • Special │ │ • Plumbing│ │ • Info     │ │       │  │
│    └─────┬─────┘  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───┬────┘  │
│          │              │             │             │           │        │
│          └──────────────┴──────┬──────┴─────────────┴───────────┘        │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Assign     │                                    │
│                         │  Priority   │                                    │
│                         │  (1-5)      │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Route to   │                                    │
│                         │  Department │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Notify     │                                    │
│                         │  Staff      │                                    │
│                         │  (Push/SMS) │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Staff      │                                    │
│                         │  Accepts    │───────▶ Timeout? ─────▶ Reassign   │
│                         │  Task       │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  In         │                                    │
│                         │  Progress   │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Complete   │                                    │
│                         │  Task       │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Update     │                                    │
│                         │  Status     │                                    │
│                         │  → Done     │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Notify     │                                    │
│                         │  Guest      │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Request    │                                    │
│                         │  Rating     │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  END:       │                                    │
│                         │  Request    │                                    │
│                         │  Closed     │                                    │
│                         └─────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Reporting Processes

### 7.1 Daily Operations Report Generation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DAILY OPERATIONS REPORT                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REPORT SCHEDULE                                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Time        Report                    Recipients                  │   │
│  │   ─────────────────────────────────────────────────────────────────│   │
│  │                                                                      │   │
│  │   06:00       Night Audit Summary     GM, Accounting               │   │
│  │   07:00       Arrivals Preview        Front Desk, HK               │   │
│  │   08:00       Housekeeping Status     HK Manager                   │   │
│  │   12:00       Occupancy Update        GM, Sales                    │   │
│  │   15:00       Revenue Flash           GM, Finance                  │   │
│  │   18:00       Departures Summary      Front Desk, HK               │   │
│  │   23:00       Night Audit Begin       Night Auditor                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  REPORT CONTENTS                                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    MORNING ARRIVALS REPORT                           │   │
│  │                                                                      │   │
│  │   Property: Grand Hotel Downtown     Date: March 15, 2026           │   │
│  │                                                                      │   │
│  │   ════════════════════════════════════════════════════════════════  │   │
│  │                                                                      │   │
│  │   SUMMARY                                                            │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Total Arrivals:        15                                          │   │
│  │   VIP Guests:            2                                           │   │
│  │   Early Check-in Req:    3                                           │   │
│  │   Special Requests:      5                                           │   │
│  │                                                                      │   │
│  │   ROOM STATUS                                                         │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Ready:                 12                                          │   │
│  │   Not Ready:             3 (Estimated ready: 11:00 AM)              │   │
│  │                                                                      │   │
│  │   ARRIVALS DETAIL                                                     │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Time     Guest          Room  Type      Requests      Status      │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   14:00    John Smith     305   Deluxe    High floor    Ready      │   │
│  │   15:00    Sarah Jones    410   Suite     ⭐ VIP         Ready      │   │
│  │   15:30    Mike Brown     302   Deluxe    Late arrival  Ready      │   │
│  │   ...                                                                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    NIGHT AUDIT REPORT                                │   │
│  │                                                                      │   │
│  │   Date: March 14, 2026    Audit Period: 00:00 - 23:59               │   │
│  │                                                                      │   │
│  │   ════════════════════════════════════════════════════════════════  │   │
│  │                                                                      │   │
│  │   OCCUPANCY                                                           │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Rooms Available:       100                                         │   │
│  │   Rooms Sold:            78                                          │   │
│  │   Occupancy:             78%                                         │   │
│  │   Average Guests/Room:   1.4                                         │   │
│  │                                                                      │   │
│  │   REVENUE                                                             │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Room Revenue:          $9,750.00                                   │   │
│  │   F&B Revenue:           $1,250.00                                   │   │
│  │   Other Revenue:         $350.00                                     │   │
│  │   Tax Collected:         $1,362.00                                   │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   TOTAL REVENUE:         $12,712.00                                  │   │
│  │                                                                      │   │
│  │   KEY METRICS                                                         │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   ADR (Avg Daily Rate):  $125.00                                     │   │
│  │   RevPAR:                $97.50                                      │   │
│  │   Total Arrivals:        12                                          │   │
│  │   Total Departures:      8                                           │   │
│  │   Reservations:          5 (Online: 4, Phone: 1)                    │   │
│  │   Cancellations:         1                                           │   │
│  │                                                                      │   │
│  │   PAYMENTS                                                            │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Credit Card:           $8,500.00                                   │   │
│  │   Cash:                  $1,200.00                                   │   │
│  │   UPI/Digital:           $3,012.00                                   │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   TOTAL PAYMENTS:        $12,712.00                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Automation Workflows

### 8.1 Pre-Defined Automation Rules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AUTOMATION WORKFLOW EXAMPLES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PRE-ARRIVAL AUTOMATION                            │   │
│  │                                                                      │   │
│  │   Trigger: 72 hours before check-in                                 │   │
│  │   Condition: Booking status = CONFIRMED                             │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Send pre-arrival email with check-in link                │   │   │
│  │   │ 2. Create pre-arrival task for front desk                   │   │   │
│  │   │ 3. IF VIP guest → Alert manager                              │   │   │
│  │   │ 4. IF special requests → Alert relevant departments         │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CHECK-IN AUTOMATION                               │   │
│  │                                                                      │   │
│  │   Trigger: Booking status → CHECKED_IN                              │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Enable WiFi access for guest                              │   │   │
│  │   │ 2. Generate digital key (if configured)                      │   │   │
│  │   │ 3. Send welcome SMS                                          │   │   │
│  │   │ 4. Update room status → OCCUPIED                             │   │   │
│  │   │ 5. Add loyalty points (if member)                            │   │   │
│  │   │ 6. Create housekeeping check-in record                       │   │   │
│  │   │ 7. Update CRS/inventory                                      │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CHECK-OUT AUTOMATION                              │   │
│  │                                                                      │   │
│  │   Trigger: Booking status → CHECKED_OUT                             │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Disable WiFi access                                       │   │   │
│  │   │ 2. Revoke digital key                                        │   │   │
│  │   │ 3. Update room status → VACANT_DIRTY                         │   │   │
│  │   │ 4. Create housekeeping task                                  │   │   │
│  │   │ 5. Send feedback request email                               │   │   │
│  │   │ 6. Update guest profile (stay count, LTV)                    │   │   │
│  │   │ 7. Credit loyalty points for stay                            │   │   │
│  │   │ 8. Update CRS/inventory                                      │   │   │
│  │   │ 9. Sync to OTAs                                              │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    BIRTHDAY AUTOMATION                               │   │
│  │                                                                      │   │
│  │   Trigger: Daily at 08:00                                           │   │
│  │   Condition: Guest birthday = today                                 │   │
│  │                AND guest is currently staying                       │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Send birthday greeting to guest                          │   │   │
│  │   │ 2. Create task for housekeeping (special amenities)          │   │   │
│  │   │ 3. Alert front desk for personal greeting                    │   │   │
│  │   │ 4. IF loyalty member → add bonus points                      │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LOW INVENTORY ALERT                               │   │
│  │                                                                      │   │
│  │   Trigger: Inventory update                                         │   │
│  │   Condition: Available rooms < 5 for any date in next 7 days        │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Send alert to revenue manager                             │   │   │
│  │   │ 2. Suggest rate increase (AI recommendation)                 │   │   │
│  │   │ 3. Close inventory on low-demand OTAs                        │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PAYMENT FAILURE AUTOMATION                        │   │
│  │                                                                      │   │
│  │   Trigger: Payment status → FAILED                                  │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Retry payment (automatic, 3 attempts)                     │   │   │
│  │   │ 2. IF all retries fail:                                      │   │   │
│  │   │    - Alert front desk                                        │   │   │
│  │   │    - Send payment reminder to guest                          │   │   │
│  │   │    - Create follow-up task                                   │   │   │
│  │   │ 3. IF booking guaranteed by card:                            │   │   │
│  │   │    - Attempt card on file                                    │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Process Quick Reference

### A.1 Check-In Checklist

- [ ] Verify reservation exists
- [ ] Check guest ID
- [ ] Collect/review payment
- [ ] Assign room
- [ ] Hand over key card
- [ ] Provide WiFi credentials
- [ ] Explain amenities
- [ ] Offer assistance with luggage

### A.2 Check-Out Checklist

- [ ] Review folio charges
- [ ] Process payment
- [ ] Generate invoice
- [ ] Collect key card
- [ ] Ask about stay experience
- [ ] Process loyalty points
- [ ] Thank guest

### A.3 Emergency Contacts

| Situation | Contact |
|-----------|---------|
| System down | IT Support |
| Payment failure | Finance |
| Guest complaint | Manager on Duty |
| Security issue | Security Team |

---

**Contact**

**Cryptsk Pvt Ltd**
- **Website**: www.staysuite.io
- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd. All rights reserved.*
