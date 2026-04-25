# StaySuite Network Architecture Documentation
## WiFi AAA Gateway & Network Flow

**Version**: 1.0  
**Last Updated**: March 2026  
**Author**: Cryptsk Pvt Ltd

---

## Table of Contents

1. [Overview](#1-overview)
2. [Network Architecture](#2-network-architecture)
3. [WiFi AAA Gateway](#3-wifi-aaa-gateway)
4. [Authentication Flows](#4-authentication-flows)
5. [RADIUS Integration](#5-radius-integration)
6. [Session Management](#6-session-management)
7. [Bandwidth Management](#7-bandwidth-management)
8. [Security Architecture](#8-security-architecture)
9. [Supported Vendors](#9-supported-vendors)

---

## 1. Overview

### 1.1 Purpose

StaySuite's WiFi AAA Gateway integration is a unique differentiator that enables seamless guest internet access management directly from the PMS. This document explains the network architecture, authentication flows, and integration patterns.

### 1.2 Key Features

| Feature | Description |
|---------|-------------|
| **RADIUS Authentication** | Industry-standard AAA protocol |
| **Multi-Vendor Support** | 12+ gateway vendors supported |
| **Guest Auto-Provisioning** | Automatic WiFi access on check-in |
| **Voucher System** | Pre-paid access codes |
| **Bandwidth Tiers** | QoS-based speed management |
| **Session Tracking** | Real-time usage monitoring |
| **Billing Integration** | Charge for premium access |

### 1.3 Terminology

| Term | Definition |
|------|------------|
| **AAA** | Authentication, Authorization, Accounting |
| **RADIUS** | Remote Authentication Dial-In User Service |
| **NAS** | Network Access Server (Gateway) |
| **Captive Portal** | Login page for network access |
| **CoA** | Change of Authorization |
| **DM** | Disconnect Message |

---

## 2. Network Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAYSUITE NETWORK ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                         GUEST DEVICES                                │  │
│    │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐            │  │
│    │   │ Laptop  │   │ Phone   │   │ Tablet  │   │  IoT    │            │  │
│    │   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘            │  │
│    └────────┼─────────────┼─────────────┼─────────────┼──────────────────┘  │
│             │             │             │             │                      │
│             └─────────────┴──────┬──────┴─────────────┘                      │
│                                  │ WiFi Association                         │
│                                  ▼                                          │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      WiFi ACCESS POINTS                             │  │
│    │   ┌─────────────────────────────────────────────────────────────┐   │  │
│    │   │                    SSID: Hotel-Guest                        │   │  │
│    │   │                    SSID: Hotel-Staff                        │   │  │
│    │   │                    SSID: Hotel-Admin                        │   │  │
│    │   └─────────────────────────────────────────────────────────────┘   │  │
│    └────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      NETWORK GATEWAY (NAS)                          │  │
│    │   ┌─────────────────────────────────────────────────────────────┐   │  │
│    │   │  • Captive Portal (Captive DNS)                             │   │  │
│    │   │  • Traffic Routing & NAT                                    │   │  │
│    │   │  • Bandwidth Shaping (QoS)                                  │   │  │
│    │   │  • RADIUS Client                                            │   │  │
│    │   │  • DHCP Server                                              │   │  │
│    │   └─────────────────────────────────────────────────────────────┘   │  │
│    │                                                                     │  │
│    │  Supported: MikroTik, Cisco, Aruba, Ruckus, Huawei, Juniper,        │  │
│    │             Fortinet, Ubiquiti, D-Link, HP, Dell, Extreme           │  │
│    └────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                                     │ RADIUS Protocol (UDP 1812/1813)       │
│                                     ▼                                       │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                    STAYSUITE RADIUS SERVER                          │  │
│    │   ┌─────────────────────────────────────────────────────────────┐   │  │
│    │   │  • Authentication Server                                    │   │  │
│    │   │  • Authorization Policies                                   │   │  │
│    │   │  • Accounting Handler                                       │   │  │
│    │   │  • CoA/DM Handler                                           │   │  │
│    │   └─────────────────────────────────────────────────────────────┘   │  │
│    └────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                                     │ REST API / Database                   │
│                                     ▼                                       │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │                      STAYSUITE CORE PLATFORM                        │  │
│    │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │  │
│    │   │   PMS       │ │  Guest      │ │  Billing    │ │   WiFi      │  │  │
│    │   │   Module    │ │  Module     │ │  Module     │ │  Module     │  │  │
│    │   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Network Zones

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NETWORK SECURITY ZONES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    UNTRUSTED ZONE (Guest Network)                     │   │
│  │                                                                       │   │
│  │   ┌─────────────┐          ┌─────────────┐                           │   │
│  │   │   Guest     │          │   Guest     │                           │   │
│  │   │   WiFi      │──────────│   VLAN      │                           │   │
│  │   │   (10.1.x.x)│          │   (VLAN 10) │                           │   │
│  │   └─────────────┘          └─────────────┘                           │   │
│  │          │                         │                                  │   │
│  │          │    Internet Access Only │                                  │   │
│  │          │    (Firewall Rules)     │                                  │   │
│  │          ▼                         ▼                                  │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │                     INTERNET                                │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    TRUSTED ZONE (Staff Network)                       │   │
│  │                                                                       │   │
│  │   ┌─────────────┐          ┌─────────────┐                           │   │
│  │   │   Staff     │          │   Staff     │                           │   │
│  │   │   WiFi      │──────────│   VLAN      │                           │   │
│  │   │   (10.2.x.x)│          │   (VLAN 20) │                           │   │
│  │   └─────────────┘          └─────────────┘                           │   │
│  │          │                         │                                  │   │
│  │          │    Internal Systems +   │                                  │   │
│  │          │    Limited Internet     │                                  │   │
│  │          ▼                         ▼                                  │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │              INTERNAL NETWORK + INTERNET                    │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    MANAGEMENT ZONE (Admin Network)                    │   │
│  │                                                                       │   │
│  │   ┌─────────────┐          ┌─────────────┐                           │   │
│  │   │   Admin     │          │   Admin     │                           │   │
│  │   │   Network   │──────────│   VLAN      │                           │   │
│  │   │   (10.3.x.x)│          │   (VLAN 30) │                           │   │
│  │   └─────────────┘          └─────────────┘                           │   │
│  │          │                         │                                  │   │
│  │          │    Full Access to       │                                  │   │
│  │          │    Management Systems   │                                  │   │
│  │          ▼                         ▼                                  │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │                MANAGEMENT NETWORK                           │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. WiFi AAA Gateway

### 3.1 AAA Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION, AUTHORIZATION, ACCOUNTING                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        AUTHENTICATION                                  │ │
│  │                                                                        │ │
│  │   "Who are you?"                                                       │ │
│  │                                                                        │ │
│  │   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐        │ │
│  │   │  Guest  │────▶│  Portal │────▶│ RADIUS  │────▶│ Database│        │ │
│  │   │ Device  │     │  Login  │     │  Auth   │     │ Lookup  │        │ │
│  │   └─────────┘     └─────────┘     └─────────┘     └─────────┘        │ │
│  │                                                                        │ │
│  │   Methods: Room+Name, Voucher, Social Login, MAC Auth                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        AUTHORIZATION                                   │ │
│  │                                                                        │ │
│  │   "What can you access?"                                               │ │
│  │                                                                        │ │
│  │   ┌─────────────────────────────────────────────────────────────┐     │ │
│  │   │  Return Attributes:                                          │     │ │
│  │   │  • Session-Timeout (duration)                                │     │ │
│  │   │  • Bandwidth-Limit (speed)                                   │     │ │
│  │   │  • Data-Limit (volume)                                       │     │ │
│  │   │  • VLAN-Assignment (network)                                 │     │ │
│  │   │  • Filter-Id (access level)                                  │     │ │
│  │   └─────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        ACCOUNTING                                      │ │
│  │                                                                        │ │
│  │   "What did you do?"                                                   │ │
│  │                                                                        │ │
│  │   ┌─────────────────────────────────────────────────────────────┐     │ │
│  │   │  Session Data Collected:                                     │     │ │
│  │   │  • Start/Stop time                                           │     │ │
│  │   │  • Bytes In/Out (data usage)                                 │     │ │
│  │   │  • Packets In/Out                                            │     │ │
│  │   │  • Session duration                                          │     │ │
│  │   │  • Termination reason                                        │     │ │
│  │   └─────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Gateway Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GATEWAY INTEGRATION ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                    ┌─────────────────────────────┐                          │
│                    │      STAYSUITE CLOUD        │                          │
│                    │                             │                          │
│                    │  ┌───────────────────────┐  │                          │
│                    │  │   RADIUS Server       │  │                          │
│                    │  │   (UDP 1812/1813)     │  │                          │
│                    │  └───────────┬───────────┘  │                          │
│                    │              │              │                          │
│                    │  ┌───────────▼───────────┐  │                          │
│                    │  │   WiFi Module API     │  │                          │
│                    │  └───────────┬───────────┘  │                          │
│                    │              │              │                          │
│                    │  ┌───────────▼───────────┐  │                          │
│                    │  │   Guest & Booking DB  │  │                          │
│                    │  └───────────────────────┘  │                          │
│                    └──────────────┬──────────────┘                          │
│                                   │                                          │
│                                   │ Internet                                 │
│                                   │                                          │
│    ┌──────────────────────────────┼──────────────────────────────────────┐  │
│    │                    HOTEL NETWORK                                     │  │
│    │                              │                                       │  │
│    │    ┌─────────────────────────┼─────────────────────────────┐        │  │
│    │    │                    FIREWALL                           │        │  │
│    │    │                         │                              │        │  │
│    │    │   Allowed Ports:        │                              │        │  │
│    │    │   • UDP 1812 (Auth)     │                              │        │  │
│    │    │   • UDP 1813 (Acct)     │                              │        │  │
│    │    │   • UDP 3799 (CoA)      │                              │        │  │
│    │    └─────────────────────────┬─────────────────────────────┘        │  │
│    │                              │                                       │  │
│    │    ┌─────────────────────────▼─────────────────────────────┐        │  │
│    │    │                 NETWORK GATEWAY                        │        │  │
│    │    │                                                        │        │  │
│    │    │  ┌──────────────────────────────────────────────────┐ │        │  │
│    │    │  │  RADIUS Client Configuration:                    │ │        │  │
│    │    │  │  • Server: radius.staysuite.io                   │ │        │  │
│    │    │  │  • Secret: [Per-property shared secret]          │ │        │  │
│    │    │  │  • Auth Port: 1812                               │ │        │  │
│    │    │  │  • Acct Port: 1813                               │ │        │  │
│    │    │  │  • Timeout: 5s                                   │ │        │  │
│    │    │  │  • Retries: 3                                    │ │        │  │
│    │    │  └──────────────────────────────────────────────────┘ │        │  │
│    │    │                                                        │        │  │
│    │    │  Supported Vendors:                                    │        │  │
│    │    │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │        │  │
│    │    │  │Cisco │ │MikroTik│ │Aruba│ │Ruckus│ │Huawei│        │        │  │
│    │    │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │        │  │
│    │    │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │        │  │
│    │    │  │Juniper│ │Fortinet│ │Ubiquiti│ │D-Link│ │HP   │        │        │  │
│    │    │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │        │  │
│    │    └────────────────────────────────────────────────────────┘        │  │
│    │                              │                                       │  │
│    │    ┌─────────────────────────▼─────────────────────────────┐        │  │
│    │    │                  ACCESS POINTS                         │        │  │
│    │    │                                                        │        │  │
│    │    │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │        │  │
│    │    │   │ AP  │ │ AP  │ │ AP  │ │ AP  │ │ AP  │ │ AP  │    │        │  │
│    │    │   │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │    │        │  │
│    │    │   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │        │  │
│    │    │                                                        │        │  │
│    │    │   SSIDs:                                               │        │  │
│    │    │   • Hotel-Guest (Captive Portal)                       │        │  │
│    │    │   • Hotel-Staff (WPA2-Enterprise)                      │        │  │
│    │    │   • Hotel-Admin (WPA2-Enterprise)                      │        │  │
│    │    └────────────────────────────────────────────────────────┘        │  │
│    │                              │                                       │  │
│    │    ┌─────────────────────────▼─────────────────────────────┐        │  │
│    │    │                    GUESTS                              │        │  │
│    │    │                                                        │        │  │
│    │    │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐            │        │  │
│    │    │   │📱   │ │💻   │ │📱   │ │📺   │ │🎮   │            │        │  │
│    │    │   │Phone│ │Laptop│ │Tablet│ │SmartTV│ │Game │            │        │  │
│    │    │   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘            │        │  │
│    │    └────────────────────────────────────────────────────────┘        │  │
│    │                                                                        │  │
│    └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Authentication Flows

### 4.1 Guest Captive Portal Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CAPTIVE PORTAL AUTHENTICATION FLOW                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Guest           AP/Gateway        RADIUS Server       StaySuite            │
│  Device                             (StaySuite)          Database            │
│    │                  │                    │                  │              │
│    │ 1. Connect to    │                    │                  │              │
│    │    "Hotel-Guest" │                    │                  │              │
│    │─────────────────▶│                    │                  │              │
│    │                  │                    │                  │              │
│    │ 2. DHCP Request  │                    │                  │              │
│    │◀─────────────────│                    │                  │              │
│    │    (Get IP)      │                    │                  │              │
│    │                  │                    │                  │              │
│    │ 3. HTTP Request  │                    │                  │              │
│    │    (any URL)     │                    │                  │              │
│    │─────────────────▶│                    │                  │              │
│    │                  │                    │                  │              │
│    │ 4. Redirect to   │                    │                  │              │
│    │    Captive Portal│                    │                  │              │
│    │◀─────────────────│                    │                  │              │
│    │    (302)         │                    │                  │              │
│    │                  │                    │                  │              │
│    │ 5. Portal Page   │                    │                  │              │
│    │    (Login Form)  │                    │                  │              │
│    │◀─────────────────────────────────────────────────────────│              │
│    │                  │                    │                  │              │
│    │ 6. Enter Room #  │                    │                  │              │
│    │    + Last Name   │                    │                  │              │
│    │─────────────────────────────────────────────────────────▶│              │
│    │                  │                    │                  │              │
│    │                  │                    │ 7. Validate      │              │
│    │                  │                    │    Guest         │              │
│    │                  │                    │◀─────────────────│              │
│    │                  │                    │                  │              │
│    │                  │                    │ 8. Generate      │              │
│    │                  │                    │    Credentials   │              │
│    │                  │                    │                  │              │
│    │                  │ 9. RADIUS Access-Request              │              │
│    │                  │    (User: guest_123, Pass: xxx)       │              │
│    │                  │───────────────────▶│                  │              │
│    │                  │                    │                  │              │
│    │                  │                    │ 10. Verify       │              │
│    │                  │                    │     Credentials  │              │
│    │                  │                    │─────────────────▶│              │
│    │                  │                    │                  │              │
│    │                  │                    │ 11. Return       │              │
│    │                  │                    │     Attributes   │              │
│    │                  │                    │◀─────────────────│              │
│    │                  │                    │                  │              │
│    │                  │ 12. Access-Accept  │                  │              │
│    │                  │     + Attributes   │                  │              │
│    │                  │◀───────────────────│                  │              │
│    │                  │                    │                  │              │
│    │ 13. Internet     │                    │                  │              │
│    │     Access       │                    │                  │              │
│    │◀─────────────────│                    │                  │              │
│    │     Granted      │                    │                  │              │
│    │                  │                    │                  │              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Voucher Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VOUCHER AUTHENTICATION FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Guest           AP/Gateway        RADIUS Server       StaySuite            │
│  Device                             (StaySuite)          Database            │
│    │                  │                    │                  │              │
│    │                  │                    │                  │              │
│    │  ┌────────────────────────────────────────────────────────────────┐   │
│    │  │               VOUCHER GENERATION (Admin)                       │   │
│    │  │                                                                │   │
│    │  │  Admin → Generate Vouchers → Database stores:                  │   │
│    │  │  {                                                            │   │
│    │  │    code: "WIFI-ABCD-1234",                                    │   │
│    │  │    validity: "24h",                                           │   │
│    │  │    data_limit: "1GB",                                         │   │
│    │  │    speed_limit: "10Mbps",                                     │   │
│    │  │    status: "unused"                                           │   │
│    │  │  }                                                            │   │
│    │  └────────────────────────────────────────────────────────────────┘   │
│    │                  │                    │                  │              │
│    │ 1. Connect to    │                    │                  │              │
│    │    WiFi          │                    │                  │              │
│    │─────────────────▶│                    │                  │              │
│    │                  │                    │                  │              │
│    │ 2. Portal Page   │                    │                  │              │
│    │◀─────────────────│                    │                  │              │
│    │                  │                    │                  │              │
│    │ 3. Enter Voucher │                    │                  │              │
│    │    Code          │                    │                  │              │
│    │─────────────────────────────────────────────────────────▶│              │
│    │                  │                    │                  │              │
│    │                  │ 4. RADIUS Auth     │                  │              │
│    │                  │    Request         │                  │              │
│    │                  │───────────────────▶│                  │              │
│    │                  │                    │                  │              │
│    │                  │                    │ 5. Validate      │              │
│    │                  │                    │    Voucher       │              │
│    │                  │                    │─────────────────▶│              │
│    │                  │                    │                  │              │
│    │                  │                    │ 6. Mark Used &   │              │
│    │                  │                    │    Return Attrs  │              │
│    │                  │                    │◀─────────────────│              │
│    │                  │                    │                  │              │
│    │                  │ 7. Access-Accept   │                  │              │
│    │                  │    + Limits        │                  │              │
│    │                  │◀───────────────────│                  │              │
│    │                  │                    │                  │              │
│    │ 8. Internet      │                    │                  │              │
│    │    Access        │                    │                  │              │
│    │◀─────────────────│                    │                  │              │
│    │                  │                    │                  │              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 MAC Authentication Bypass (MAB)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MAC AUTHENTICATION BYPASS (MAB) FLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Guest           AP/Gateway        RADIUS Server       StaySuite            │
│  Device                             (StaySuite)          Database            │
│    │                  │                    │                  │              │
│    │ 1. Connect to    │                    │                  │              │
│    │    WiFi          │                    │                  │              │
│    │─────────────────▶│                    │                  │              │
│    │                  │                    │                  │              │
│    │                  │ 2. Detect MAC      │                  │              │
│    │                  │    Address         │                  │              │
│    │                  │                    │                  │              │
│    │                  │ 3. RADIUS Access-  │                  │              │
│    │                  │    Request         │                  │              │
│    │                  │    (User: MAC,     │                  │              │
│    │                  │     Pass: MAC)     │                  │              │
│    │                  │───────────────────▶│                  │              │
│    │                  │                    │                  │              │
│    │                  │                    │ 4. Lookup MAC    │              │
│    │                  │                    │    in DB         │              │
│    │                  │                    │─────────────────▶│              │
│    │                  │                    │                  │              │
│    │                  │                    │ 5. Is MAC        │              │
│    │                  │                    │    Authorized?   │              │
│    │                  │                    │◀─────────────────│              │
│    │                  │                    │                  │              │
│    │                  │        ┌───────────┴───────────┐      │              │
│    │                  │        │                       │      │              │
│    │                  │  YES   │                       │ NO   │              │
│    │                  │        ▼                       ▼      │              │
│    │                  │  ┌───────────┐          ┌───────────┐ │              │
│    │                  │  │Access-    │          │Access-    │ │              │
│    │                  │  │Accept     │          │Reject     │ │              │
│    │                  │  │(Auto-auth)│          │(Show portal│ │              │
│    │                  │  └───────────┘          └───────────┘ │              │
│    │                  │         │                     │       │              │
│    │ 6. Auto-connect  │         │    6. Captive Portal│       │              │
│    │    (No login)    │◀────────┘    shown           │       │              │
│    │◀─────────────────│                     ────────▶│       │              │
│    │                  │                             │       │              │
│    │                  │                    │                  │              │
│    │  USE CASE: Previously authenticated devices,                   │         │
│    │           Trusted IoT devices, VIP guests                      │         │
│    │                  │                    │                  │              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. RADIUS Integration

### 5.1 RADIUS Message Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RADIUS MESSAGE TYPES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AUTHENTICATION MESSAGES (UDP 1812)                                          │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  ┌─────────────────┐                          ┌─────────────────┐           │
│  │ Access-Request  │ ───────────────────────▶ │ Access-Accept   │           │
│  │                 │                          │ Access-Reject   │           │
│  │                 │                          │ Access-Challenge│           │
│  └─────────────────┘                          └─────────────────┘           │
│                                                                              │
│  Code 1: Access-Request     (Client → Server)                               │
│  Code 2: Access-Accept      (Server → Client) - Auth success                │
│  Code 3: Access-Reject      (Server → Client) - Auth failed                 │
│  Code 11: Access-Challenge  (Server → Client) - Need more info              │
│                                                                              │
│  ACCOUNTING MESSAGES (UDP 1813)                                              │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  ┌─────────────────┐                          ┌─────────────────┐           │
│  │ Accounting-     │ ───────────────────────▶ │ Accounting-     │           │
│  │ Request         │                          │ Response        │           │
│  └─────────────────┘                          └─────────────────┘           │
│                                                                              │
│  Code 4: Accounting-Request (Client → Server)                               │
│  Code 5: Accounting-Response (Server → Client)                              │
│                                                                              │
│  Accounting Status Types:                                                    │
│  • Start (1)   - Session started                                            │
│  • Stop (2)    - Session ended                                              │
│  • Interim (3) - Periodic update                                            │
│                                                                              │
│  CHANGE OF AUTHORIZATION (UDP 3799)                                          │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  ┌─────────────────┐                          ┌─────────────────┐           │
│  │ CoA-Request     │ ───────────────────────▶ │ CoA-ACK         │           │
│  │ DM-Request      │                          │ CoA-NAK         │           │
│  │ (Disconnect)    │                          │ DM-ACK         │           │
│  └─────────────────┘                          │ DM-NAK         │           │
│                                               └─────────────────┘           │
│                                                                              │
│  Code 43: CoA-Request    (Server → Client) - Change session attrs           │
│  Code 44: CoA-ACK        (Client → Server) - Change accepted                │
│  Code 45: CoA-NAK        (Client → Server) - Change rejected                │
│  Code 40: DM-Request     (Server → Client) - Disconnect user                │
│  Code 41: DM-ACK         (Client → Server) - Disconnect done                │
│  Code 42: DM-NAK         (Client → Server) - Disconnect failed              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 RADIUS Attributes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STANDARD RADIUS ATTRIBUTES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AUTHENTICATION ATTRIBUTES                                                   │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  ┌───────┬────────────────────┬────────────────────────────────────────┐   │
│  │ Attr  │ Name               │ Description                            │   │
│  ├───────┼────────────────────┼────────────────────────────────────────┤   │
│  │ 1     │ User-Name          │ Guest identifier (room_guest)          │   │
│  │ 2     │ User-Password      │ Auth password (PAP)                    │   │
│  │ 3     │ CHAP-Password      │ Auth password (CHAP)                   │   │
│  │ 4     │ NAS-IP-Address     │ Gateway IP address                     │   │
│  │ 5     │ NAS-Port           │ Physical port number                   │   │
│  │ 6     │ Service-Type       │ Framed-User (2)                        │   │
│  │ 8     │ Framed-IP-Address  │ Assigned IP to client                  │   │
│  │ 30    │ Called-Station-Id  │ AP MAC address (SSID)                  │   │
│  │ 31    │ Calling-Station-Id │ Client MAC address                     │   │
│  │ 60    │ NAS-Identifier     │ Gateway hostname                       │   │
│  │ 61    │ NAS-Port-Type      │ Wireless (19)                          │   │
│  └───────┴────────────────────┴────────────────────────────────────────┘   │
│                                                                              │
│  AUTHORIZATION ATTRIBUTES (Returned by Server)                               │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  ┌───────┬────────────────────┬────────────────────────────────────────┐   │
│  │ Attr  │ Name               │ Description                            │   │
│  ├───────┼────────────────────┼────────────────────────────────────────┤   │
│  │ 27    │ Session-Timeout    │ Max session duration (seconds)         │   │
│  │ 28    │ Idle-Timeout       │ Disconnect after idle (seconds)        │   │
│  │ 11    │ Filter-Id          │ Access control list name               │   │
│  │ 64    │ Tunnel-Type        │ VLAN (13)                              │   │
│  │ 65    │ Tunnel-Medium-Type │ IPv4 (1)                               │   │
│  │ 81    │ Tunnel-Private-Group-Id │ VLAN ID number                    │   │
│  └───────┴────────────────────┴────────────────────────────────────────┘   │
│                                                                              │
│  VENDOR-SPECIFIC ATTRIBUTES (VSA)                                            │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  MikroTik (Vendor ID: 14988):                                                │
│  ┌───────┬────────────────────┬────────────────────────────────────────┐   │
│  │ Attr  │ Name               │ Description                            │   │
│  ├───────┼────────────────────┼────────────────────────────────────────┤   │
│  │ 8     │ MikroTik-Rate-Limit│ "10M/10M" (up/down speed)              │   │
│  │ 9     │ MikroTik-Recv-Limit│ Data limit in bytes                    │   │
│  │ 10    │ MikroTik-Xmit-Limit│ Data limit in bytes                    │   │
│  └───────┴────────────────────┴────────────────────────────────────────┘   │
│                                                                              │
│  Cisco (Vendor ID: 9):                                                       │
│  ┌───────┬────────────────────┬────────────────────────────────────────┐   │
│  │ Attr  │ Name               │ Description                            │   │
│  ├───────┼────────────────────┼────────────────────────────────────────┤   │
│  │ 1     │ Cisco-AVPair       │ "bandwidth-control=10mbps"             │   │
│  │ 2     │ Cisco-AVPair       │ "session-timeout=86400"                │   │
│  └───────┴────────────────────┴────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Session Accounting Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SESSION ACCOUNTING FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Gateway                RADIUS Server              StaySuite                 │
│    │                         │                        │                     │
│    │                         │                        │                     │
│    │  ┌──────────────────────┼────────────────────────┼────────────────┐   │
│    │  │ SESSION START         │                        │                │   │
│    │  │                       │                        │                │   │
│    │  │ Accounting-Request    │                        │                │   │
│    │  │ (Acct-Status-Type=Start)                       │                │   │
│    │  │ ├─ User-Name: guest_305                        │                │   │
│    │  │ ├─ Acct-Session-Id: 123456                     │                │   │
│    │  │ ├─ Calling-Station-Id: AA:BB:CC:DD:EE:FF      │                │   │
│    │  │ ├─ Framed-IP-Address: 10.1.1.100               │                │   │
│    │  │ └─ Event-Timestamp: 2026-03-15T10:00:00Z       │                │   │
│    │  └──────────────────────┼────────────────────────┼────────────────┘   │
│    │────────────────────────▶│                        │                     │
│    │                         │                        │                     │
│    │                         │  Create Session        │                     │
│    │                         │───────────────────────▶│                     │
│    │                         │                        │                     │
│    │  Accounting-Response    │                        │                     │
│    │◀────────────────────────│                        │                     │
│    │                         │                        │                     │
│    │  ┌──────────────────────┼────────────────────────┼────────────────┐   │
│    │  │ INTERIM UPDATES (Every 5-10 mins)             │                │   │
│    │  │                       │                        │                │   │
│    │  │ Accounting-Request    │                        │                │   │
│    │  │ (Acct-Status-Type=Interim)                     │                │   │
│    │  │ ├─ Acct-Session-Id: 123456                     │                │   │
│    │  │ ├─ Acct-Input-Octets: 52428800 (50MB)          │                │   │
│    │  │ ├─ Acct-Output-Octets: 104857600 (100MB)       │                │   │
│    │  │ ├─ Acct-Input-Packets: 50000                   │                │   │
│    │  │ ├─ Acct-Output-Packets: 45000                  │                │   │
│    │  │ └─ Acct-Session-Time: 1800 (30 mins)           │                │   │
│    │  └──────────────────────┼────────────────────────┼────────────────┘   │
│    │────────────────────────▶│                        │                     │
│    │                         │                        │                     │
│    │                         │  Update Usage          │                     │
│    │                         │───────────────────────▶│                     │
│    │                         │                        │                     │
│    │  Accounting-Response    │                        │                     │
│    │◀────────────────────────│                        │                     │
│    │                         │                        │                     │
│    │  ┌──────────────────────┼────────────────────────┼────────────────┐   │
│    │  │ SESSION STOP          │                        │                │   │
│    │  │                       │                        │                │   │
│    │  │ Accounting-Request    │                        │                │   │
│    │  │ (Acct-Status-Type=Stop)                        │                │   │
│    │  │ ├─ Acct-Session-Id: 123456                     │                │   │
│    │  │ ├─ Acct-Input-Octets: 524288000 (500MB)        │                │   │
│    │  │ ├─ Acct-Output-Octets: 1073741824 (1GB)        │                │   │
│    │  │ ├─ Acct-Session-Time: 86400 (24 hrs)           │                │   │
│    │  │ └─ Acct-Terminate-Cause: User-Request (1)      │                │   │
│    │  └──────────────────────┼────────────────────────┼────────────────┘   │
│    │────────────────────────▶│                        │                     │
│    │                         │                        │                     │
│    │                         │  Close Session         │                     │
│    │                         │  Calculate Total       │                     │
│    │                         │  Update Billing        │                     │
│    │                         │───────────────────────▶│                     │
│    │                         │                        │                     │
│    │  Accounting-Response    │                        │                     │
│    │◀────────────────────────│                        │                     │
│    │                         │                        │                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Session Management

### 6.1 Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SESSION LIFECYCLE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   Check-In ─────▶ WiFi Enable ─────▶ Session Start                  │  │
│   │                                                                  │    │  │
│   │                                                                  │    │  │
│   │   ┌──────────────────────────────────────────────────────────┐    │    │  │
│   │   │                    ACTIVE SESSION                        │    │    │  │
│   │   │                                                          │    │    │  │
│   │   │   • User authenticated                                   │    │    │  │
│   │   │   • Bandwidth limits applied                             │    │    │  │
│   │   │   • Data usage tracked                                   │    │    │  │
│   │   │   • Time remaining counted                               │    │    │  │
│   │   │                                                          │    │    │  │
│   │   │   Limits Enforced:                                       │    │    │  │
│   │   │   ┌─────────────────────────────────────────────────┐   │    │    │  │
│   │   │   │ Time Limit    │ Disconnect when reached         │   │    │    │  │
│   │   │   │ Data Limit    │ Throttle or disconnect          │   │    │    │  │
│   │   │   │ Speed Limit   │ Shape traffic                    │   │    │    │  │
│   │   │   │ Idle Timeout  │ Disconnect after inactivity     │   │    │    │  │
│   │   │   └─────────────────────────────────────────────────┘   │    │    │  │
│   │   └──────────────────────────────────────────────────────────┘    │    │  │
│   │                                                                  │    │  │
│   │   Session End Triggers:                                          │    │  │
│   │   ├── Check-out (automatic)                                      │    │  │
│   │   ├── Time limit reached                                         │    │  │
│   │   ├── Data limit reached                                         │    │  │
│   │   ├── Manual disconnect (admin)                                  │    │  │
│   │   ├── Idle timeout                                               │    │  │
│   │   └── Guest disconnects                                          │    │  │
│   │                                                                  │    │  │
│   │   Check-Out ◀──── WiFi Disable ◀──── Session Stop               │    │  │
│   │                                                                      │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Real-Time Session Control (CoA)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CHANGE OF AUTHORIZATION (CoA) FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  StaySuite           RADIUS Server              Gateway                      │
│     │                      │                       │                         │
│     │ 1. Trigger Event     │                       │                         │
│     │    (Check-out,       │                       │                         │
│     │     Upgrade,         │                       │                         │
│     │     Limit Change)    │                       │                         │
│     │                      │                       │                         │
│     │ 2. Request CoA       │                       │                         │
│     │─────────────────────▶│                       │                         │
│     │                      │                       │                         │
│     │                      │ 3. CoA-Request        │                         │
│     │                      │    (Disconnect or     │                         │
│     │                      │     Update Attrs)     │                         │
│     │                      │──────────────────────▶│                         │
│     │                      │                       │                         │
│     │                      │                       │ 4. Apply Change         │
│     │                      │                       │    • Disconnect user    │
│     │                      │                       │    • Update bandwidth   │
│     │                      │                       │    • Change VLAN        │
│     │                      │                       │                         │
│     │                      │ 5. CoA-ACK/NAK        │                         │
│     │                      │◀──────────────────────│                         │
│     │                      │                       │                         │
│     │ 6. Confirmation      │                       │                         │
│     │◀─────────────────────│                       │                         │
│     │                      │                       │                         │
│     │                      │                       │                         │
│  USE CASES:                                                                 │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Check-out       │  │ Plan Upgrade    │  │ Policy Violation│             │
│  │                 │  │                 │  │                 │             │
│  │ → Disconnect    │  │ → Increase      │  │ → Throttle      │             │
│  │   immediately   │  │   bandwidth     │  │   bandwidth     │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Data Limit      │  │ Time Warning    │  │ Payment Issue   │             │
│  │ Reached         │  │ (15 min left)   │  │                 │             │
│  │                 │  │                 │  │                 │             │
│  │ → Throttle to   │  │ → Send warning  │  │ → Disconnect    │             │
│  │   lower speed   │  │   via portal    │  │   user          │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Bandwidth Management

### 7.1 Bandwidth Tiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BANDWIDTH MANAGEMENT TIERS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         PLAN DEFINITIONS                             │  │
│  │                                                                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │   BASIC     │  │  STANDARD   │  │  PREMIUM    │  │   ULTRA     │ │  │
│  │  │   (Free)    │  │   ($5/day)  │  │  ($10/day)  │  │  ($20/day)  │ │  │
│  │  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤ │  │
│  │  │ 5 Mbps      │  │ 20 Mbps     │  │ 50 Mbps     │  │ 100 Mbps    │ │  │
│  │  │ Down        │  │ Down        │  │ Down        │  │ Down        │ │  │
│  │  │             │  │             │  │             │  │             │ │  │
│  │  │ 2 Mbps Up   │  │ 10 Mbps Up  │  │ 25 Mbps Up  │  │ 50 Mbps Up  │ │  │
│  │  │             │  │             │  │             │  │             │ │  │
│  │  │ 1 GB/day    │  │ 5 GB/day    │  │ Unlimited   │  │ Unlimited   │ │  │
│  │  │             │  │             │  │             │  │             │ │  │
│  │  │ 1 Device    │  │ 2 Devices   │  │ 4 Devices   │  │ 8 Devices   │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  BANDWIDTH SHAPING:                                                         │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  Guest Traffic                                                       │  │
│  │       │                                                              │  │
│  │       ▼                                                              │  │
│  │  ┌─────────────┐                                                    │  │
│  │  │   QoS       │   Rate Limiting: MikroTik-Rate-Limit attribute     │  │
│  │  │   Queue     │   Format: "upload/download burst-upload/burst-down"│  │
│  │  │             │                                                    │  │
│  │  │ Priority:   │   Example: "10M/20M 12M/24M 256k/256k 8 8"        │  │
│  │  │ • Premium   │                                                    │  │
│  │  │ • Standard  │                                                    │  │
│  │  │ • Basic     │                                                    │  │
│  │  └─────────────┘                                                    │  │
│  │       │                                                              │  │
│  │       ▼                                                              │  │
│  │  ┌─────────────┐                                                    │  │
│  │  │  Internet   │                                                    │  │
│  │  └─────────────┘                                                    │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Device Limits Per Guest

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DEVICE LIMIT ENFORCEMENT                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    DEVICE LIMIT CHECK                                │  │
│  │                                                                      │  │
│  │  Guest: John Doe (Room 305)                                          │  │
│  │  Plan: Premium (4 devices allowed)                                   │  │
│  │                                                                      │  │
│  │  Active Sessions:                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │ Device 1: iPhone (AA:BB:CC:11:22:33) - Active              │    │  │
│  │  │ Device 2: Laptop (AA:BB:CC:44:55:66) - Active              │    │  │
│  │  │ Device 3: iPad (AA:BB:CC:77:88:99) - Active                │    │  │
│  │  │ Device 4: Smart TV (AA:BB:CC:AA:BB:CC) - Active            │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                      │  │
│  │  New Device Request:                                                 │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │ Device 5: Gaming Console (DD:EE:FF:11:22:33)               │    │  │
│  │  │                                                             │    │  │
│  │  │ ❌ REJECTED: Device limit reached (4/4)                     │    │  │
│  │  │                                                             │    │  │
│  │  │ Options:                                                    │    │  │
│  │  │ • Disconnect an existing device                             │    │  │
│  │  │ • Upgrade plan for more devices                             │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Security Architecture

### 8.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SECURITY ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     LAYER 1: NETWORK                                 │  │
│  │                                                                      │  │
│  │  • VLAN isolation (Guest/Staff/Admin)                               │  │
│  │  • Firewall rules                                                    │  │
│  │  • WPA2/WPA3 encryption (Staff/Admin)                                │  │
│  │  • Client isolation                                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     LAYER 2: AUTHENTICATION                          │  │
│  │                                                                      │  │
│  │  • RADIUS shared secret (per property)                              │  │
│  │  • HMAC message signing                                              │  │
│  │  • TLS for CoA (recommended)                                        │  │
│  │  • Rate limiting on auth attempts                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     LAYER 3: AUTHORIZATION                           │  │
│  │                                                                      │  │
│  │  • Check-in validation (guest must be checked in)                   │  │
│  │  • Date range validation (within stay dates)                        │  │
│  │  • Device count validation                                           │  │
│  │  • Plan limits enforcement                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     LAYER 4: DATA                                    │  │
│  │                                                                      │  │
│  │  • Tenant isolation (RLS)                                           │  │
│  │  • Encrypted credential storage                                     │  │
│  │  • Audit logging                                                    │  │
│  │  • GDPR compliance                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Captive Portal Security

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CAPTIVE PORTAL SECURITY FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │   Guest          Captive Portal           StaySuite                  │  │
│  │     │                   │                     │                       │  │
│  │     │ 1. HTTP Request   │                     │                       │  │
│  │     │──────────────────▶│                     │                       │  │
│  │     │                   │                     │                       │  │
│  │     │ 2. Redirect +     │                     │                       │  │
│  │     │    Session Token  │                     │                       │  │
│  │     │◀──────────────────│                     │                       │  │
│  │     │                   │                     │                       │  │
│  │     │ 3. Submit Form    │                     │                       │  │
│  │     │    + CSRF Token   │                     │                       │  │
│  │     │──────────────────▶│                     │                       │  │
│  │     │                   │                     │                       │  │
│  │     │                   │ 4. Validate         │                       │  │
│  │     │                   │    • CSRF           │                       │  │
│  │     │                   │    • Rate Limit     │                       │  │
│  │     │                   │    • Input          │                       │  │
│  │     │                   │                     │                       │  │
│  │     │                   │ 5. API Call         │                       │  │
│  │     │                   │    (HTTPS + API Key)│                       │  │
│  │     │                   │────────────────────▶│                       │  │
│  │     │                   │                     │                       │  │
│  │     │                   │ 6. Validate Guest   │                       │  │
│  │     │                   │◀────────────────────│                       │  │
│  │     │                   │                     │                       │  │
│  │     │                   │ 7. Return Creds     │                       │  │
│  │     │                   │    (One-time token) │                       │  │
│  │     │◀──────────────────│                     │                       │  │
│  │     │                   │                     │                       │  │
│  │     │ 8. RADIUS Auth    │                     │                       │  │
│  │     │    (Auto)         │                     │                       │  │
│  │     │─────────────────────────────────────────────────────────────▶ │  │
│  │     │                   │                     │                       │  │
│  │     │ 9. Access Granted │                     │                       │  │
│  │     │◀───────────────────────────────────────────────────────────── │  │
│  │     │                   │                     │                       │  │
│  │                                                                      │  │
│  │  Security Measures:                                                   │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • HTTPS enforced on portal                                          │  │
│  │  • CSRF tokens on all forms                                          │  │
│  │  • Rate limiting (5 attempts / minute)                               │  │
│  │  • Input validation (room number, name)                              │  │
│  │  • One-time authentication tokens                                    │  │
│  │  • Session timeout (configurable)                                    │  │
│  │  • Audit logging of all attempts                                    │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Supported Vendors

### 9.1 Gateway Vendor Configuration Matrix

| Vendor | RADIUS Support | CoA Support | VSA Support | Configuration |
|--------|---------------|-------------|-------------|---------------|
| **MikroTik** | ✓ Full | ✓ Full | ✓ Rate-Limit | RouterOS config |
| **Cisco** | ✓ Full | ✓ Full | ✓ AVPair | ISE/WLC config |
| **Aruba** | ✓ Full | ✓ Full | ✓ AirGroup | ClearPass config |
| **Ruckus** | ✓ Full | ✓ Full | ✓ ZoneFlex | ZoneDirector config |
| **Huawei** | ✓ Full | ✓ Full | ✓ QoS | Agile Controller |
| **Juniper** | ✓ Full | ✓ Full | ✓ CoA | Mist/Marvis config |
| **Fortinet** | ✓ Full | ✓ Full | ✓ FortiGate | FortiGate config |
| **Ubiquiti** | ✓ Full | ✓ Partial | ✓ Rate-Limit | UniFi controller |
| **D-Link** | ✓ Full | ✓ Partial | ✓ QoS | D-Link Central |
| **HP/Aruba** | ✓ Full | ✓ Full | ✓ AVPair | ClearPass config |
| **Dell** | ✓ Full | ✓ Partial | ✓ QoS | Dell EMC config |
| **Extreme** | ✓ Full | ✓ Full | ✓ Policy | ExtremeCloud |

### 9.2 Vendor-Specific Configuration Examples

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MIKROTIK CONFIGURATION EXAMPLE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  /radius                                                                     │
│  add address=radius.staysuite.io \                                          │
│      secret=your-shared-secret \                                             │
│      service=login \                                                         │
│      authentication-port=1812 \                                              │
│      accounting-port=1813 \                                                  │
│      timeout=5s \                                                            │
│      realm=staysuite                                                         │
│                                                                              │
│  /ip hotspot profile                                                         │
│  set [find name=hsprof1] \                                                   │
│      login-by=http-chap,http-pap,cookie \                                    │
│      radius-default-domain=staysuite \                                       │
│      use-radius=yes                                                          │
│                                                                              │
│  /ip hotspot user profile                                                    │
│  add name="guest-basic" \                                                    │
│      rate-limit="5M/2M" \                                                    │
│      session-timeout=24h \                                                   │
│      on-login=":do {:local user \$user; /ip hotspot active set [find user=\$│
│  user] rate-limit=\"5M/2M\"; };"                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      CISCO WLC CONFIGURATION EXAMPLE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  config radius auth add 1 radius.staysuite.io 1812 ascii your-shared-secret │
│  config radius acct add 1 radius.staysuite.io 1813 ascii your-shared-secret │
│                                                                              │
│  config wlan create 2 Hotel-Guest Hotel-Guest                               │
│  config wlan interface 2 management                                          │
│  config wlan security wpa2 enable 2                                          │
│  config wlan radius_server auth add 2 1                                      │
│  config wlan radius_server acct add 2 1                                      │
│                                                                              │
│  config wlan mac-filtering enable 2                                          │
│  config wlan mobility anchor add 2 <controller-ip>                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     ARUBA CONTROLLER CONFIGURATION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  aaa authentication-server radius "StaySuite-RADIUS"                        │
│      host radius.staysuite.io                                               │
│      key your-shared-secret                                                  │
│      auth-port 1812                                                          │
│      acct-port 1813                                                          │
│      timeout 5                                                               │
│      retry 3                                                                 │
│  !                                                                           │
│                                                                              │
│  aaa server-group "StaySuite-SG"                                            │
│      auth-server StaySuite-RADIUS                                           │
│  !                                                                           │
│                                                                              │
│  wlan hotspot-profile "Hotel-Guest"                                         │
│      ssid-profile "Hotel-Guest-SSID"                                        │
│      aaa-authentication "StaySuite-SG"                                      │
│      captive-portal-profile "default"                                       │
│  !                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Network Ports Reference

| Port | Protocol | Purpose |
|------|----------|---------|
| 1812 | UDP | RADIUS Authentication |
| 1813 | UDP | RADIUS Accounting |
| 3799 | UDP | RADIUS CoA/DM |
| 443 | TCP | Captive Portal (HTTPS) |
| 80 | TCP | Captive Portal Redirect |
| 53 | UDP/TCP | DNS (for captive portal detection) |
| 67 | UDP | DHCP |

---

## Appendix B: Troubleshooting Guide

### B.1 Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Auth failed | Wrong shared secret | Verify secret on both ends |
| No accounting data | Firewall blocking | Open UDP 1813 |
| CoA not working | Port blocked | Open UDP 3799 |
| Slow captive portal | DNS issues | Check DNS resolution |
| Session not terminating | CoA disabled | Enable CoA on gateway |

### B.2 Debug Commands

```bash
# Test RADIUS connectivity
radtest guest_305 password radius.staysuite.io 1812 shared-secret

# Monitor RADIUS traffic
tcpdump -i eth0 udp port 1812 or udp port 1813

# Check session status
# Via StaySuite API
GET /api/wifi/sessions?status=active

# Manual CoA test
echo "User-Name=guest_305" | radclient gateway-ip:3799 coa shared-secret
```

---

**Contact**

**Cryptsk Pvt Ltd**
- **Website**: www.staysuite.io
- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd. All rights reserved.*
