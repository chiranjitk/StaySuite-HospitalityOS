# StaySuite API Documentation
## REST API Reference

**Version**: v1  
**Base URL**: `https://api.staysuite.io/v1`  
**Last Updated**: March 2026

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Rate Limits](#2-rate-limits)
3. [Response Format](#3-response-format)
4. [Pagination](#4-pagination)
5. [Errors](#5-errors)
6. [Bookings API](#6-bookings-api)
7. [Guests API](#7-guests-api)
8. [Rooms API](#8-rooms-api)
9. [Availability API](#9-availability-api)
10. [Payments API](#10-payments-api)
11. [WiFi API](#11-wifi-api)
12. [Webhooks](#12-webhooks)

---

## 1. Authentication

### 1.1 API Key Authentication

Include API key in the header:

```http
Authorization: Bearer YOUR_API_KEY
X-Tenant-ID: YOUR_TENANT_ID
```

### 1.2 Getting API Keys

1. Navigate to **Settings → Integrations → API**
2. Click **Generate API Key**
3. Set permissions (scopes)
4. Copy key (shown only once)

### 1.3 Scopes

| Scope | Description |
|-------|-------------|
| `bookings:read` | Read bookings |
| `bookings:write` | Create/update bookings |
| `guests:read` | Read guest data |
| `guests:write` | Create/update guests |
| `payments:read` | Read payments |
| `payments:write` | Process payments |
| `wifi:read` | Read WiFi sessions |
| `wifi:write` | Manage WiFi access |

---

## 2. Rate Limits

| Plan | Requests/minute | Requests/day |
|------|-----------------|--------------|
| Starter | 60 | 1,000 |
| Professional | 300 | 10,000 |
| Enterprise | 1,000 | Unlimited |

Rate limit headers:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1678900000
```

---

## 3. Response Format

All responses are JSON:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

## 4. Pagination

Query parameters:

| Parameter | Default | Max |
|-----------|---------|-----|
| `page` | 1 | - |
| `limit` | 20 | 100 |
| `sort` | created_at | - |
| `order` | desc | asc/desc |

Example:

```http
GET /v1/bookings?page=2&limit=50&sort=check_in&order=asc
```

---

## 5. Errors

Error response format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format",
    "details": {
      "field": "check_in",
      "expected": "YYYY-MM-DD"
    }
  }
}
```

Error codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid/missing credentials |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 6. Bookings API

### 6.1 List Bookings

```http
GET /v1/bookings
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `check_in_from` | date | Check-in date from |
| `check_in_to` | date | Check-in date to |
| `guest_id` | string | Filter by guest |
| `room_id` | string | Filter by room |
| `source` | string | Filter by source |

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "bk_123456",
      "confirmation_number": "SS-2026-001234",
      "status": "confirmed",
      "check_in": "2026-04-01",
      "check_out": "2026-04-03",
      "room": {
        "id": "rm_001",
        "number": "101",
        "type": "Deluxe Room"
      },
      "guest": {
        "id": "gst_001",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "rate_plan": {
        "id": "rp_001",
        "name": "Best Available Rate"
      },
      "total_amount": 500.00,
      "currency": "USD",
      "source": "direct",
      "created_at": "2026-03-15T10:00:00Z",
      "updated_at": "2026-03-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### 6.2 Get Booking

```http
GET /v1/bookings/{id}
```

Response: Single booking object

### 6.3 Create Booking

```http
POST /v1/bookings
```

Request body:

```json
{
  "guest": {
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+1234567890"
  },
  "room_type_id": "rt_001",
  "rate_plan_id": "rp_001",
  "check_in": "2026-04-01",
  "check_out": "2026-04-03",
  "adults": 2,
  "children": 0,
  "special_requests": "Late check-in around 10 PM",
  "source": "api",
  "idempotency_key": "unique-request-id"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "bk_123456",
    "confirmation_number": "SS-2026-001234",
    "status": "confirmed",
    // ... full booking object
  }
}
```

### 6.4 Update Booking

```http
PATCH /v1/bookings/{id}
```

Request body:

```json
{
  "check_out": "2026-04-04",
  "special_requests": "Extended stay by 1 night"
}
```

### 6.5 Cancel Booking

```http
POST /v1/bookings/{id}/cancel
```

Request body:

```json
{
  "reason": "Guest request",
  "refund": true
}
```

### 6.6 Check In

```http
POST /v1/bookings/{id}/check-in
```

Request body:

```json
{
  "room_id": "rm_101",
  "actual_check_in_time": "2026-04-01T14:30:00Z"
}
```

### 6.7 Check Out

```http
POST /v1/bookings/{id}/check-out
```

---

## 7. Guests API

### 7.1 List Guests

```http
GET /v1/guests
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name/email |
| `vip` | boolean | Filter VIP guests |
| `created_from` | date | Created from date |
| `created_to` | date | Created to date |

### 7.2 Get Guest

```http
GET /v1/guests/{id}
```

### 7.3 Create Guest

```http
POST /v1/guests
```

Request body:

```json
{
  "email": "jane@example.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "US",
    "postal_code": "10001"
  },
  "preferences": {
    "room_floor": "high",
    "pillow_type": "firm",
    "newspaper": "NYT"
  },
  "vip": true,
  "notes": "Prefers quiet rooms"
}
```

### 7.4 Update Guest

```http
PATCH /v1/guests/{id}
```

### 7.5 Get Guest Stay History

```http
GET /v1/guests/{id}/stays
```

### 7.6 Get Guest Loyalty

```http
GET /v1/guests/{id}/loyalty
```

---

## 8. Rooms API

### 8.1 List Rooms

```http
GET /v1/rooms
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `room_type_id` | string | Filter by type |
| `status` | string | Filter by status |
| `floor` | integer | Filter by floor |

### 8.2 Get Room

```http
GET /v1/rooms/{id}
```

### 8.3 Update Room Status

```http
PATCH /v1/rooms/{id}/status
```

Request body:

```json
{
  "status": "clean",
  "notes": "Deep cleaning completed"
}
```

---

## 9. Availability API

### 9.1 Check Availability

```http
GET /v1/availability
```

Query parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `check_in` | date | Yes | Check-in date |
| `check_out` | date | Yes | Check-out date |
| `room_type_id` | string | No | Filter by room type |
| `adults` | integer | No | Number of adults |
| `children` | integer | No | Number of children |

Response:

```json
{
  "success": true,
  "data": {
    "check_in": "2026-04-01",
    "check_out": "2026-04-03",
    "available": [
      {
        "room_type": {
          "id": "rt_001",
          "name": "Deluxe Room",
          "max_occupancy": 2
        },
        "available_rooms": 5,
        "total_rooms": 10,
        "rates": [
          {
            "date": "2026-04-01",
            "rate": 150.00
          },
          {
            "date": "2026-04-02",
            "rate": 150.00
          }
        ],
        "total": 300.00,
        "currency": "USD"
      }
    ]
  }
}
```

---

## 10. Payments API

### 10.1 Process Payment

```http
POST /v1/payments
```

Request body:

```json
{
  "booking_id": "bk_123456",
  "amount": 300.00,
  "currency": "USD",
  "payment_method": {
    "type": "card",
    "token": "tok_visa_xxx"
  },
  "idempotency_key": "unique-payment-id"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "pay_001",
    "status": "completed",
    "amount": 300.00,
    "currency": "USD",
    "payment_method": "card",
    "last_four": "4242",
    "created_at": "2026-03-15T10:00:00Z"
  }
}
```

### 10.2 List Payments

```http
GET /v1/payments
```

### 10.3 Refund Payment

```http
POST /v1/payments/{id}/refund
```

Request body:

```json
{
  "amount": 150.00,
  "reason": "Partial cancellation"
}
```

---

## 11. WiFi API

### 11.1 Create WiFi User

```http
POST /v1/wifi/users
```

Request body:

```json
{
  "booking_id": "bk_123456",
  "username": "guest_101",
  "password": "auto",
  "plan_id": "wp_standard",
  "devices_limit": 3
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "wu_001",
    "username": "guest_101",
    "password": "Abc123xyz",
    "plan": "Standard",
    "devices_limit": 3,
    "valid_from": "2026-04-01T14:00:00Z",
    "valid_until": "2026-04-03T11:00:00Z",
    "status": "active"
  }
}
```

### 11.2 List WiFi Sessions

```http
GET /v1/wifi/sessions
```

### 11.3 Disconnect WiFi Session

```http
POST /v1/wifi/sessions/{id}/disconnect
```

### 11.4 Create Vouchers

```http
POST /v1/wifi/vouchers
```

Request body:

```json
{
  "quantity": 10,
  "plan_id": "wp_basic",
  "validity_hours": 24
}
```

Response:

```json
{
  "success": true,
  "data": {
    "vouchers": [
      "WIFI-ABCD1234",
      "WIFI-EFGH5678",
      // ... more vouchers
    ],
    "plan": "Basic",
    "validity_hours": 24,
    "created_at": "2026-03-15T10:00:00Z"
  }
}
```

---

## 12. Webhooks

### 12.1 Webhook Events

| Event | Description |
|-------|-------------|
| `booking.created` | New booking created |
| `booking.modified` | Booking updated |
| `booking.cancelled` | Booking cancelled |
| `booking.checked_in` | Guest checked in |
| `booking.checked_out` | Guest checked out |
| `payment.completed` | Payment successful |
| `payment.failed` | Payment failed |
| `payment.refunded` | Payment refunded |
| `wifi.session.started` | WiFi session began |
| `wifi.session.stopped` | WiFi session ended |
| `guest.created` | New guest profile |
| `inventory.updated` | Availability changed |

### 12.2 Webhook Payload

```json
{
  "event": "booking.created",
  "id": "evt_123456",
  "tenant_id": "tn_001",
  "data": {
    "id": "bk_123456",
    "confirmation_number": "SS-2026-001234",
    // ... full booking object
  },
  "timestamp": "2026-03-15T10:00:00Z",
  "signature": "sha256=abc123..."
}
```

### 12.3 Signature Verification

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${expected}` === signature;
}
```

### 12.4 Retry Policy

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 2 minutes |
| 4 | 10 minutes |
| 5 | 1 hour |

After 5 failures, webhook is disabled and alert sent.

---

## SDK Examples

### JavaScript/Node.js

```javascript
const StaySuite = require('@staysuite/sdk');

const client = new StaySuite({
  apiKey: 'your-api-key',
  tenantId: 'your-tenant-id'
});

// Create booking
const booking = await client.bookings.create({
  guest: {
    email: 'guest@example.com',
    first_name: 'John',
    last_name: 'Doe'
  },
  room_type_id: 'rt_001',
  rate_plan_id: 'rp_001',
  check_in: '2026-04-01',
  check_out: '2026-04-03'
});
```

### Python

```python
from staysuite import Client

client = Client(
    api_key='your-api-key',
    tenant_id='your-tenant-id'
)

# Check availability
availability = client.availability.check(
    check_in='2026-04-01',
    check_out='2026-04-03',
    adults=2
)
```

---

## OpenAPI Specification

Full OpenAPI 3.0 specification available at:
```
GET /v1/docs/openapi.json
```

Interactive documentation at:
```
GET /v1/docs
```

---

## Support

- **Email**: support@cryptsk.com
- **Documentation**: docs.staysuite.io

---

*© 2026 Cryptsk Pvt Ltd*
