# Audit Log Module Implementation

## Overview

The Audit Log module provides comprehensive activity tracking across all major modules in StaySuite-HospitalityOS. It captures user activities, system events, and data changes for compliance, security, and debugging purposes.

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUDIT LOG ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   API       │    │   Audit     │    │   Database          │  │
│  │   Routes    │───▶│   Service   │───▶│   (AuditLog Table)  │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│         │                  │                                     │
│         ▼                  ▼                                     │
│  ┌─────────────┐    ┌─────────────┐                             │
│  │   Audit     │    │   Helper    │                             │
│  │   Viewer UI │    │   Functions │                             │
│  └─────────────┘    └─────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/
├── lib/
│   ├── audit/
│   │   ├── index.ts              # Audit module exports
│   │   └── middleware.ts         # Logging helpers for each module
│   └── services/
│       └── audit-service.ts      # Core audit service (existed)
│
├── app/api/
│   ├── audit-logs/
│   │   ├── route.ts              # GET/POST audit logs
│   │   ├── stats/route.ts        # Statistics endpoint
│   │   └── export/route.ts       # Export functionality
│   ├── auth/
│   │   ├── login/route.ts        # Login/logout audit
│   │   └── logout/route.ts       # Logout audit
│   ├── bookings/
│   │   ├── route.ts              # Booking creation audit
│   │   └── [id]/route.ts         # Booking update/delete audit
│   ├── guests/
│   │   ├── route.ts              # Guest creation audit
│   │   └── [id]/route.ts         # Guest update/delete audit
│   ├── rooms/
│   │   ├── route.ts              # Room creation audit
│   │   └── [id]/route.ts         # Room update/delete audit
│   ├── payments/
│   │   └── route.ts              # Payment audit
│   └── wifi/
│       └── vouchers/
│           └── route.ts          # WiFi voucher audit
│
└── components/
    └── audit/
        └── audit-logs-viewer.tsx # UI component (existed)
```

---

## Database Schema

### AuditLog Model (Prisma)

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  tenantId      String
  userId        String?
  module        String           // Module name (auth, bookings, guests, etc.)
  action        String           // Action performed (create, update, delete, login, etc.)
  entityType    String           // Type of entity (booking, guest, room, payment, etc.)
  entityId      String?          // ID of the affected entity
  oldValue      String?          // JSON string of previous value
  newValue      String?          // JSON string of new value
  ipAddress     String?          // Client IP address
  userAgent     String?          // Browser/device info
  correlationId String?          // Links related operations
  createdAt     DateTime @default(now())
  
  user          User?    @relation(fields: [userId], references: [id])
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([userId])
  @@index([entityType, entityId])
}
```

### Fields Captured

| Field | Type | Description |
|-------|------|-------------|
| `tenantId` | String | Multi-tenant isolation |
| `userId` | String? | Who performed the action |
| `module` | String | Module category (auth, bookings, guests, etc.) |
| `action` | String | Specific action (create, update, login_failed, etc.) |
| `entityType` | String | Type of affected entity |
| `entityId` | String? | ID of the affected entity |
| `oldValue` | JSON? | State before change |
| `newValue` | JSON? | State after change |
| `ipAddress` | String? | Client IP address |
| `userAgent` | String? | Browser/device information |
| `correlationId` | String? | Links related operations |
| `createdAt` | DateTime | Timestamp of the event |

---

## Modules with Audit Logging

### 1. Authentication Module

**File:** `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`

**Actions Logged:**
| Action | Description | Metadata Captured |
|--------|-------------|-------------------|
| `login` | Successful login | email, roleName, tenantName |
| `login_failed` | Failed login attempt | email, reason, failedAttempts |
| `logout` | User logout | email |
| `2fa_verified` | 2FA verification | email |
| `password_reset` | Password reset | email |

**Example Usage:**
```typescript
import { logAuth } from '@/lib/audit';

// Log successful login
await logAuth(request, 'login', user.id, {
  email: user.email,
  roleName: user.role?.name,
  tenantName: user.tenant.name
});

// Log failed login
await logAuth(request, 'login_failed', undefined, {
  email: email.toLowerCase(),
  reason: 'user_not_found'
});
```

---

### 2. Guests Module

**File:** `src/app/api/guests/route.ts`, `src/app/api/guests/[id]/route.ts`

**Actions Logged:**
| Action | Description | Old/New Values |
|--------|-------------|----------------|
| `create` | Guest created | New: firstName, lastName, email, phone, source, isVip |
| `update` | Guest updated | Old & New: firstName, lastName, email, phone, loyaltyTier, isVip, kycStatus |
| `delete` | Guest soft-deleted | Old: firstName, lastName, email, phone |

**Example Usage:**
```typescript
import { logGuest } from '@/lib/audit';

// Log guest creation
await logGuest(request, 'create', guest.id, undefined, {
  firstName: guest.firstName,
  lastName: guest.lastName,
  email: guest.email,
  phone: guest.phone,
  source: guest.source,
  isVip: guest.isVip,
});
```

---

### 3. Rooms Module

**File:** `src/app/api/rooms/route.ts`, `src/app/api/rooms/[id]/route.ts`

**Actions Logged:**
| Action | Description | Old/New Values |
|--------|-------------|----------------|
| `create` | Room created | New: number, floor, roomTypeName, propertyId, status |
| `update` | Room updated | Old & New: number, floor, status, roomTypeId |
| `status_change` | Room status changed | Old & New: status, previousStatus |
| `delete` | Room soft-deleted | Old: number, floor, status |

**Example Usage:**
```typescript
import { logRoom } from '@/lib/audit';

// Log room status change
await logRoom(request, 'status_change', room.id, 
  { status: 'available', previousStatus: 'dirty' },
  { status: 'occupied', previousStatus: 'available' }
);
```

---

### 4. Bookings Module

**File:** `src/app/api/bookings/route.ts`, `src/app/api/bookings/[id]/route.ts`

**Actions Logged:**
| Action | Description | Metadata Captured |
|--------|-------------|-------------------|
| `create` | Booking created | confirmationCode, guestName, roomNumber, checkIn, checkOut, totalAmount, status, source |
| `update` | Booking updated | confirmationCode, guestName, status, roomNumber |
| `check_in` | Guest checked in | confirmationCode, guestName, status, roomNumber |
| `check_out` | Guest checked out | confirmationCode, guestName, status, roomNumber |
| `cancel` | Booking cancelled | confirmationCode, guestName, status, roomNumber |
| `confirm` | Booking confirmed | confirmationCode, guestName, status, roomNumber |
| `no_show` | Guest no-show | confirmationCode, guestName, status, roomNumber |

**Example Usage:**
```typescript
import { logBooking } from '@/lib/audit';

// Log booking creation
await logBooking(request, 'create', booking.id, undefined, {
  confirmationCode: booking.confirmationCode,
  guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
  roomNumber: booking.room?.number,
  checkIn: booking.checkIn,
  checkOut: booking.checkOut,
  totalAmount: booking.totalAmount,
  status: booking.status,
  source: booking.source,
});
```

---

### 5. Payments Module

**File:** `src/app/api/payments/route.ts`

**Actions Logged:**
| Action | Description | Metadata Captured |
|--------|-------------|-------------------|
| `payment` | Payment processed | amount, currency, method, gateway, transactionId, folioNumber, guestName |
| `refund` | Refund processed | amount, currency, transactionId, folioNumber |
| `void` | Payment voided | amount, transactionId |

**Example Usage:**
```typescript
import { logPayment } from '@/lib/audit';

// Log payment
await logPayment(request, 'payment', payment.id, {
  amount,
  currency,
  method,
  gateway,
  transactionId,
  folioNumber: payment.folio?.folioNumber,
  guestName: payment.guest ? `${payment.guest.firstName} ${payment.guest.lastName}` : undefined,
});
```

---

### 6. WiFi Module

**File:** `src/app/api/wifi/vouchers/route.ts`

**Actions Logged:**
| Action | Description | Metadata Captured |
|--------|-------------|-------------------|
| `voucher_create` | Voucher created | code, planName, validFrom, validUntil, guestId, bookingId |
| `voucher_use` | Voucher redeemed | code, planName, guestId, bookingId |
| `delete` | Voucher revoked | code, reason |

**Example Usage:**
```typescript
import { logWifi } from '@/lib/audit';

// Log voucher creation
await logWifi(request, 'voucher_create', 'voucher', voucher.id, {
  code: voucher.code,
  planName: voucher.plan?.name,
  validFrom: voucher.validFrom,
  validUntil: voucher.validUntil,
  guestId,
  bookingId,
});
```

---

## Helper Functions

### Location: `src/lib/audit/middleware.ts`

### Available Helpers

| Function | Module | Usage |
|----------|--------|-------|
| `logAuth()` | Authentication | Login, logout, 2FA events |
| `logGuest()` | Guests | Guest CRUD operations |
| `logRoom()` | Rooms | Room CRUD and status changes |
| `logBooking()` | Bookings | Booking lifecycle events |
| `logPayment()` | Payments | Payment processing events |
| `logFolio()` | Billing | Folio operations |
| `logUser()` | Users | User management events |
| `logWifi()` | WiFi | WiFi voucher/session events |
| `logInventory()` | Inventory | Stock operations |
| `logSettings()` | Settings | Settings changes |
| `logTask()` | Housekeeping | Task operations |
| `logChannel()` | Channel Manager | OTA sync events |
| `logSecurity()` | Security | Security alerts and events |
| `logSystem()` | System | Automated operations |
| `audit()` | Generic | Any module/action |

### Request Context Extraction

```typescript
export interface RequestContext {
  ipAddress: string;
  userAgent: string | null;
  tenantId: string;
  userId?: string;
}

export function extractRequestContext(request: NextRequest): RequestContext
```

---

## API Endpoints

### GET /api/audit-logs

Query audit logs with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |
| `module` | string | Filter by module |
| `action` | string | Filter by action |
| `userId` | string | Filter by user |
| `entityType` | string | Filter by entity type |
| `entityId` | string | Filter by entity ID |
| `ipAddress` | string | Filter by IP address |
| `dateFrom` | string | Start date (ISO format) |
| `dateTo` | string | End date (ISO format) |
| `search` | string | Search in user/entity |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx123...",
      "userId": "user123",
      "module": "bookings",
      "action": "create",
      "entityType": "booking",
      "entityId": "booking123",
      "oldValue": null,
      "newValue": { "confirmationCode": "SS-ABC123", ... },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2025-01-15T10:30:00Z",
      "userName": "John Doe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "totalPages": 25
  }
}
```

### GET /api/audit-logs/stats

Get audit log statistics for dashboard.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `days` | number | Number of days to include (default: 30) |

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5420,
    "byModule": {
      "auth": 1250,
      "bookings": 2100,
      "guests": 850,
      "payments": 720,
      "wifi": 500
    },
    "byAction": {
      "create": 2100,
      "update": 1800,
      "login": 850,
      "delete": 320
    },
    "byUser": [
      { "userId": "user1", "userName": "John Doe", "count": 450 }
    ],
    "recentActivity": [
      { "date": "2025-01-15", "count": 180 }
    ],
    "topIpAddresses": [
      { "ipAddress": "192.168.1.1", "count": 250 }
    ],
    "securityEventsCount": 45,
    "failedLoginsCount": 12
  }
}
```

### GET /api/audit-logs/export

Export audit logs to JSON or CSV.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | Export format: 'json' or 'csv' |
| `limit` | number | Max records (default: 10000) |
| All filters from GET endpoint | | |

### POST /api/audit-logs

Create a custom audit log entry.

**Request Body:**
```json
{
  "module": "custom",
  "action": "custom_action",
  "entityType": "custom_entity",
  "entityId": "entity123",
  "oldValue": { "status": "old" },
  "newValue": { "status": "new" },
  "metadata": { "customField": "value" }
}
```

---

## UI Component

### Location: `src/components/audit/audit-logs-viewer.tsx`

### Features

1. **Statistics Cards**
   - Total Events (30 days)
   - Security Events
   - Failed Logins
   - Active Users

2. **Filtering**
   - Search by user, IP, entity
   - Filter by module
   - Filter by action
   - Date range filter

3. **Data Table**
   - Timestamp
   - User
   - Module (with icon and color)
   - Action (with icon)
   - Entity
   - IP Address
   - Details button

4. **Detail Dialog**
   - Full audit log details
   - Old/New value comparison (JSON view)
   - User agent information
   - Correlation ID

5. **Export**
   - Export to JSON
   - Export to CSV

### Module Icons & Colors

| Module | Icon | Color |
|--------|------|-------|
| auth | Key | Blue |
| admin | Shield | Purple |
| bookings | Calendar | Green |
| guests | Users | Cyan |
| rooms | Building2 | Orange |
| billing | CreditCard | Amber |
| inventory | Package | Rose |
| housekeeping | History | Teal |
| channel | Globe | Indigo |
| security | Shield | Red |

---

## Menu Locations

The Audit Log viewer is accessible from:

| Section | Menu Item | Route |
|---------|-----------|-------|
| Security Center | Audit Logs | `#security-audit-logs` |
| Bookings | Audit Logs | `#bookings-audit` |

---

## Implementation Checklist

### Completed Modules ✅

- [x] Authentication (login, logout, login_failed, 2fa_verified)
- [x] Guests (create, update, delete)
- [x] Rooms (create, update, delete, status_change)
- [x] Bookings (create, update, check_in, check_out, cancel, confirm, no_show)
- [x] Payments (payment, refund, void)
- [x] WiFi (voucher_create, voucher_use, delete)

### Pending Modules (Future Implementation)

- [ ] Inventory (stock_add, stock_remove, stock_adjust)
- [ ] Settings (settings_update, feature_toggle)
- [ ] Housekeeping (task_create, task_assign, task_complete)
- [ ] Channel Manager (sync, connection, rate_sync)
- [ ] Users (create, update, delete, role_change) - partial
- [ ] Folios (create, update, close, invoice)
- [ ] IoT (device_control, energy_event)
- [ ] Reports (report_generate, report_export)

---

## Best Practices

### 1. Always Log Meaningful Data

```typescript
// ✅ Good - Includes relevant context
await logBooking(request, 'create', booking.id, undefined, {
  confirmationCode: booking.confirmationCode,
  guestName: `${guest.firstName} ${guest.lastName}`,
  totalAmount: booking.totalAmount,
});

// ❌ Bad - Missing context
await logBooking(request, 'create', booking.id);
```

### 2. Include Old and New Values for Updates

```typescript
// Capture old values before update
const oldValue = {
  status: existingBooking.status,
  totalAmount: existingBooking.totalAmount,
};

// Perform update
const updated = await db.booking.update(...);

// Log with both values
await logBooking(request, 'update', booking.id, oldValue, {
  status: updated.status,
  totalAmount: updated.totalAmount,
});
```

### 3. Use Appropriate Actions

```typescript
// Use specific actions instead of generic 'update'
if (status === 'checked_in') {
  await logBooking(request, 'check_in', booking.id, oldValue, newValue);
} else if (status === 'cancelled') {
  await logBooking(request, 'cancel', booking.id, oldValue, newValue);
}
```

### 4. Handle Logging Errors Gracefully

```typescript
// Don't let audit logging failures affect the main operation
try {
  await logBooking(request, 'create', booking.id, undefined, metadata);
} catch (auditError) {
  console.error('Audit logging failed:', auditError);
  // Continue with response
}
```

---

## Performance Considerations

1. **Asynchronous Logging**: All audit log operations are non-blocking
2. **Database Indexes**: Indexes on `tenantId`, `userId`, `entityType`, `entityId`, `createdAt`
3. **Pagination**: Default limit of 50 records per page
4. **Export Limits**: Maximum 10,000 records per export

---

## Security Considerations

1. **Tenant Isolation**: All queries are scoped by `tenantId`
2. **Sensitive Data**: Passwords and tokens are never logged
3. **IP Tracking**: Captures real IP behind proxies (x-forwarded-for, x-real-ip)
4. **User Agent**: Full user agent string for forensic analysis

---

## Retention Policy

The audit service includes a `deleteOlderThan` method for implementing retention policies:

```typescript
// Delete audit logs older than 90 days
const deleted = await auditLogService.deleteOlderThan(90, tenantId);
console.log(`Deleted ${deleted} old audit logs`);
```

---

## Future Enhancements

1. **Real-time Audit Stream**: WebSocket-based live audit log viewer
2. **Audit Log Alerts**: Configurable alerts for suspicious activities
3. **Compliance Reports**: GDPR, SOC2 compliance report generation
4. **Audit Log Signatures**: Cryptographic signing for tamper-proof logs
5. **External Storage**: Integration with external log storage (ELK, Splunk)
6. **AI-powered Analysis**: Anomaly detection in audit patterns

---

## Troubleshooting

### Common Issues

1. **Missing User ID**
   - Ensure `x-user-id` header is set by authentication middleware
   - Check session validity

2. **IP Address Shows "unknown"**
   - Check proxy configuration
   - Verify `x-forwarded-for` or `x-real-ip` headers

3. **Large JSON Values**
   - Consider truncating large `oldValue`/`newValue` objects
   - Exclude binary data from logging

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-15 | Initial implementation with Auth, Guests, Rooms, Bookings, Payments, WiFi modules |

---

## Contact

For questions or issues related to the Audit Log module, contact the development team or create an issue in the project repository.
