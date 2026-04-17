# StaySuite Integration Guide
## Third-Party Integration Manual

**Version**: 1.0  
**Last Updated**: March 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Door Lock Integration](#2-door-lock-integration)
3. [Payment Gateway Integration](#3-payment-gateway-integration)
4. [WiFi Gateway Integration](#4-wifi-gateway-integration)
5. [Channel Manager Integration](#5-channel-manager-integration)
6. [IoT Device Integration](#6-iot-device-integration)
7. [POS System Integration](#7-pos-system-integration)
8. [Custom Integrations](#8-custom-integrations)

---

## 1. Overview

StaySuite provides multiple integration options:

| Integration Type | Methods |
|------------------|---------|
| Door Locks | BLE/NFC, API |
| Payment Gateways | API, Webhooks |
| WiFi Gateways | RADIUS, API |
| OTAs | API, Webhooks |
| IoT Devices | MQTT, API |
| POS Systems | API, Webhooks |
| Custom | REST API, Webhooks |

---

## 2. Door Lock Integration

### 2.1 Supported Lock Vendors

| Vendor | Protocol | Integration Type |
|--------|----------|------------------|
| Assa Abloy | BLE, NFC | API |
| dormakaba | BLE | API |
| Salto | BLE, NFC | API |
| ONITY | BLE | API |
| August | BLE | API |

### 2.2 Digital Key Flow

```
┌──────────┐     API      ┌──────────┐     BLE     ┌──────────┐
│StaySuite │ ──────────► │Lock Cloud│ ◄─────────► │  Guest   │
│          │             │          │             │  Phone   │
└──────────┘             └──────────┘             └──────────┘
     │                        │
     │   Check-in Event       │
     └───────────────────────►│
                              │
     ┌────────────────────────┤
     │   Generate Key         │
     │   - Key ID             │
     │   - Validity           │
     │   - Room Number        │
     └───────────────────────►│
```

### 2.3 Assa Abloy Integration

**Prerequisites:**
- Assa Abloy Vision Access account
- Property ID
- API credentials

**Configuration:**

1. Navigate to **Integrations → Door Locks → Assa Abloy**
2. Enter credentials:
   - Client ID
   - Client Secret
   - Property ID
3. Configure mapping:
   - Room number ↔ Lock ID
4. Test connection
5. Enable integration

**API Endpoints:**

```http
POST /api/integrations/door-locks/assa-abloy/generate-key
```

Request:
```json
{
  "booking_id": "bk_123",
  "room_number": "101",
  "valid_from": "2026-04-01T14:00:00Z",
  "valid_until": "2026-04-03T11:00:00Z"
}
```

Response:
```json
{
  "success": true,
  "key_id": "key_abc123",
  "mobile_key_url": "staysuite://key/abc123"
}
```

### 2.4 Salto Integration

**Configuration:**

1. Navigate to **Integrations → Door Locks → Salto**
2. Enter Salto KS credentials:
   - Site ID
   - API Key
3. Configure lock mapping
4. Enable integration

**Key Generation:**

Keys are automatically generated on:
- Check-in event
- Manual trigger from booking

Keys are automatically revoked on:
- Check-out event
- Manual revocation

---

## 3. Payment Gateway Integration

### 3.1 Stripe Integration

**Setup:**

1. Create Stripe account at stripe.com
2. Get API keys from Dashboard
3. Configure webhook endpoint

**StaySuite Configuration:**

1. Navigate to **Integrations → Payment Gateways → Stripe**
2. Enter credentials:
   - Publishable Key
   - Secret Key
   - Webhook Signing Secret
3. Set webhook URL in Stripe:
   ```
   https://api.staysuite.io/webhooks/stripe
   ```
4. Select events to receive:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `customer.source.expiring`

**Testing:**

Use Stripe test cards:
| Card Number | Result |
|-------------|--------|
| 4242424242424242 | Success |
| 4000000000000002 | Decline |
| 4000000000009995 | Insufficient funds |

### 3.2 Razorpay Integration (India)

**Setup:**

1. Create Razorpay account
2. Generate API keys
3. Configure webhook

**StaySuite Configuration:**

1. Navigate to **Integrations → Payment Gateways → Razorpay**
2. Enter credentials:
   - Key ID
   - Key Secret
   - Webhook Secret
3. Configure webhook URL:
   ```
   https://api.staysuite.io/webhooks/paypal
   ```

**Payment Methods:**

| Method | Supported |
|--------|-----------|
| Credit/Debit Cards | ✅ |
| UPI | ✅ |
| NetBanking | ✅ |
| Wallets | ✅ |
| EMI | ✅ |

### 3.3 Multi-Gateway Routing

Configure automatic failover:

```json
{
  "routing": {
    "primary": "stripe",
    "fallback": ["razorpay", "paypal"],
    "rules": [
      {
        "currency": "INR",
        "gateway": "razorpay"
      },
      {
        "amount_min": 10000,
        "gateway": "stripe"
      }
    ]
  }
}
```

---

## 4. WiFi Gateway Integration

### 4.1 RADIUS Configuration

**Architecture:**

```
┌──────────┐    Auth     ┌──────────┐    Auth    ┌──────────┐
│  Guest   │ ──────────► │  NAS     │ ────────► │StaySuite │
│  Device  │             │ (Gateway)│            │  RADIUS  │
└──────────┘             └──────────┘            └──────────┘
                               │
                               │ Acct
                               ▼
                         ┌──────────┐
                         │  Usage   │
                         │   DB     │
                         └──────────┘
```

**RADIUS Parameters:**

| Parameter | Value |
|-----------|-------|
| Auth Port | 1812 |
| Acct Port | 1813 |
| Protocol | RADIUS |
| Authentication | PAP/CHAP |

**Attributes Used:**

| Attribute | Description |
|-----------|-------------|
| User-Name | Guest username |
| User-Password | Guest password |
| NAS-IP-Address | Gateway IP |
| NAS-Identifier | Gateway name |
| Called-Station-Id | SSID |
| Acct-Session-Id | Session ID |
| Acct-Input-Octets | Download bytes |
| Acct-Output-Octets | Upload bytes |

### 4.2 MikroTik Configuration

**Step 1: Configure RADIUS**

```
/radius
add address=radius.staysuite.io \
    secret=YOUR_SHARED_SECRET \
    service=hotspot \
    authentication-port=1812 \
    accounting-port=1813 \
    timeout=3000ms
```

**Step 2: Configure Hotspot**

```
/ip hotspot profile
set [find name=default] \
    login-by=http-chap,http-pap,cookie \
    html-directory=hotspot \
    radius-default-domain="" \
    use-radius=yes
```

**Step 3: Configure Walled Garden**

```
/ip hotspot walled-garden
add dst-host="*.staysuite.io" action=allow
add dst-host="*.google.com" action=allow
add dst-host="*.facebook.com" action=allow
```

### 4.3 Cisco WLC Configuration

**Step 1: Add RADIUS Server**

```
config radius auth add 1 radius.staysuite.io 1812 YOUR_SECRET
config radius acct add 1 radius.staysuite.io 1813 YOUR_SECRET
```

**Step 2: Configure WLAN**

```
config wlan create 2 GuestWiFi
config wlan security web-auth enable 2
config wlan radius_server auth add 2 1
config wlan radius_server acct add 2 1
```

**Step 3: Configure ACL**

```
config acl create GuestACL
config acl rule add GuestACL 1 permit any any
config wlan acl 2 GuestACL
```

### 4.4 Captive Portal Customization

**Portal URL:**

Guests are redirected to:
```
https://wifi.staysuite.io/portal/{tenant_id}
```

**Custom Branding:**

1. Navigate to **WiFi → Portal Settings**
2. Upload:
   - Logo (PNG, max 200KB)
   - Background image (max 1MB)
3. Customize:
   - Primary color
   - Welcome text
   - Terms & conditions
   - Privacy policy link

---

## 5. Channel Manager Integration

### 5.1 OTA Connection Flow

```
┌──────────┐   Push    ┌──────────┐   API    ┌──────────┐
│StaySuite │ ────────► │  CRS     │ ───────► │   OTA    │
│   PMS    │           │          │          │ (B.com)  │
└──────────┘           └──────────┘          └──────────┘
      ▲                                            │
      │              Webhook                       │
      └────────────────────────────────────────────┘
```

### 5.2 Booking.com Integration

**Prerequisites:**
- Booking.com hotel ID
- API credentials from Connectivity Partner

**Configuration:**

1. Navigate to **Channel Manager → OTA Connections**
2. Click **Add Connection → Booking.com**
3. Enter:
   - Hotel ID
   - API Key
   - API Secret
4. Test connection

**Mapping:**

```json
{
  "room_mappings": [
    {
      "internal_id": "rt_001",
      "ota_id": "1234567",
      "name": "Deluxe Room"
    }
  ],
  "rate_mappings": [
    {
      "internal_id": "rp_001",
      "ota_id": "2345678",
      "name": "Best Available Rate"
    }
  ]
}
```

### 5.3 Airbnb Integration

**OAuth Flow:**

1. Navigate to **Channel Manager → Airbnb**
2. Click **Connect with Airbnb**
3. Authorize StaySuite
4. Select listings to connect

**Webhook Events:**

| Event | Action |
|-------|--------|
| `reservation_created` | Import booking |
| `reservation_updated` | Update booking |
| `reservation_cancelled` | Cancel booking |

### 5.4 Inventory Sync

**Real-time Sync:**

Inventory changes are pushed immediately:
- Booking created → Decrease availability
- Booking cancelled → Increase availability
- Manual update → Push to all channels

**Conflict Resolution:**

When OTA booking conflicts with PMS:
1. Log conflict
2. Alert operations team
3. Apply configurable policy:
   - Prefer OTA (auto-reallocate)
   - Prefer PMS (reject OTA)
   - Manual resolution

---

## 6. IoT Device Integration

### 6.1 Supported Devices

| Type | Vendors |
|------|---------|
| Thermostats | Nest, Ecobee, Honeywell |
| Lighting | Philips Hue, LIFX |
| Blinds/Curtains | Somfy, Lutron |
| Sensors | Occupancy, Door/Window |

### 6.2 Smart Room Flow

```
Check-in Event
     │
     ├──► Set temperature to guest preference
     ├──► Turn on lights
     ├──► Close curtains
     └──► Enable voice assistant

Check-out Event
     │
     ├──► Set temperature to eco mode
     ├──► Turn off all lights
     ├──► Open curtains
     └──► Reset voice assistant
```

### 6.3 MQTT Integration

**Configuration:**

1. Navigate to **Integrations → IoT → MQTT**
2. Configure broker:
   - Host
   - Port (1883/8883)
   - Username/Password
   - TLS settings

**Topics:**

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `staysuite/{tenant}/room/{room}/command` | Publish | Send commands |
| `staysuite/{tenant}/room/{room}/status` | Subscribe | Receive status |
| `staysuite/{tenant}/room/{room}/sensor` | Subscribe | Sensor data |

**Command Examples:**

```json
{
  "command": "set_temperature",
  "value": 22,
  "unit": "celsius"
}
```

```json
{
  "command": "set_lights",
  "value": {
    "on": true,
    "brightness": 80,
    "color": "#FFFFFF"
  }
}
```

---

## 7. POS System Integration

### 7.1 POS Integration Flow

```
┌──────────┐   Order    ┌──────────┐   Post    ┌──────────┐
│  POS     │ ─────────► │StaySuite │ ────────► │  Folio   │
│  System  │            │   API    │           │          │
└──────────┘            └──────────┘           └──────────┘
```

### 7.2 Generic POS Integration

**API Endpoint:**

```http
POST /api/v1/pos/orders
```

Request:
```json
{
  "booking_id": "bk_123",
  "room_number": "101",
  "order_id": "POS-001",
  "items": [
    {
      "name": "Room Service - Breakfast",
      "quantity": 2,
      "price": 25.00
    }
  ],
  "total": 50.00,
  "tax": 5.00,
  "timestamp": "2026-03-15T10:00:00Z"
}
```

### 7.3 Order Posting Rules

1. Order is created in POS
2. POS sends to StaySuite API
3. StaySuite validates booking is active
4. Charge posted to guest folio
5. Confirmation sent back to POS

---

## 8. Custom Integrations

### 8.1 Using the REST API

See API Documentation for complete reference.

**Quick Start:**

```bash
# Get access token
curl -X POST https://api.staysuite.io/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Create booking
curl -X POST https://api.staysuite.io/v1/bookings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"guest":{"email":"guest@example.com"},...}'
```

### 8.2 Using Webhooks

**Setup:**

1. Navigate to **Settings → Integrations → Webhooks**
2. Add endpoint URL
3. Select events
4. Set secret for signature verification

**Verification:**

```javascript
const crypto = require('crypto');

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-staysuite-signature'];
  const secret = 'YOUR_WEBHOOK_SECRET';
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== `sha256=${expected}`) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  const { event, data } = req.body;
  
  // Respond quickly
  res.status(200).send('OK');
  
  // Process asynchronously
  processWebhook(event, data);
});
```

---

## Support

For integration support:

- **Email**: integrations@cryptsk.com
- **Documentation**: docs.staysuite.io/integrations

---

*© 2026 Cryptsk Pvt Ltd*
