---
Task ID: 1
Agent: Main Agent
Task: Fix PostgreSQL UUID compatibility errors in audit logging after check-in WiFi provisioning

Work Log:
- Analyzed the error: `Invalid prisma.auditLog.create() invocation: Inconsistent column data: Error creating UUID, invalid character: expected an optional prefix of urn:uuid: followed by [0-9a-fA-F-], found 'r' at 1`
- Root cause: PostgreSQL schema uses `@db.Uuid` for AuditLog fields (tenantId, userId, entityId, correlationId) but the SQLite schema uses plain `String`. Non-UUID values like usernames (`room_510_jpbx`), setting keys, gateway refs, and fallback strings like `'tenant-1'`/`'system'` pass fine in SQLite but fail in PostgreSQL.
- Fixed 7 files with 12 specific issues

Stage Summary:
- **wifi-user-service.ts**: Changed `entityId: params.username` → `entityId: params.bookingId || undefined`; removed hardcoded `'tenant-1'` fallback; added username to newValue JSON
- **audit/middleware.ts**: Added `isValidUUID()` and `safeUUID()` helper functions; fixed `logSettings()` to store `settingKey` in newValue JSON instead of entityId; added UUID-safe userId handling
- **audit-service.ts**: Fixed `logSettingsEvent()` same as middleware — settingKey moved to newValue JSON
- **payments/router.ts**: Changed `entityId: log.gatewayRef` → `entityId: undefined`; moved gatewayRef into newValue JSON
- **webhooks/stripe/route.ts**: Removed hardcoded `tenantId: 'system'`; made tenantId optional with guard; moved gatewayEventId to newValue JSON; updated caller to resolve tenantId from PaymentGateway
- **webhooks/paypal/route.ts**: Same pattern as stripe — removed hardcoded `tenantId: 'system'`; added guard; moved gatewayEventId to newValue JSON
- **jobs/expiration-job.ts**: Removed `'system'` fallback for tenantId; pre-fetched wifiUser once instead of 3 separate queries; added guard to skip audit log if no tenantId
- All changes pass lint check. Server restarted and running successfully.
