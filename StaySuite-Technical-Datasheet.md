# StaySuite Technical Datasheet
## Enterprise Hospitality Platform Specifications

---

## Product Overview

**StaySuite** by **Cryptsk Pvt Ltd** is a cloud-native, multi-tenant SaaS platform — an All-in-One Hospitality Operating System built on modern technologies for reliability, scalability, and security.

---

## 🏗 Technical Architecture

### Platform Stack

| Layer | Technology |
|-------|------------|
| **Frontend Framework** | Next.js 16 (React 18) with TypeScript |
| **Backend Runtime** | Node.js with Next.js API Routes |
| **Database** | PostgreSQL (Production) / SQLite (Development) |
| **ORM** | Prisma 6 |
| **Real-time** | WebSocket with Socket.io |
| **Queue System** | BullMQ for background jobs |
| **Cache Layer** | In-memory caching with Redis support |
| **File Storage** | Cloud storage (S3-compatible) |
| **Authentication** | JWT + NextAuth.js with OAuth 2.0/OIDC |

### Deployment Options

| Option | Description |
|--------|-------------|
| **Cloud SaaS** | Multi-tenant hosted solution |
| **Private Cloud** | Single-tenant dedicated instance |
| **On-Premise** | Self-hosted with enterprise support |
| **Hybrid** | Cloud management with local processing |

---

## 🔌 WiFi AAA Gateway Specifications

### Supported Network Vendors

| Vendor | Protocols | Integration Type |
|--------|-----------|------------------|
| **Cisco** | RADIUS, CoA | WLC, ISE |
| **MikroTik** | RADIUS, API | Hotspot, User Manager |
| **Ruckus** | RADIUS, CoA | ZoneDirector, SmartZone |
| **Huawei** | RADIUS | AC Integration |
| **Juniper** | RADIUS, CoA | Mist Cloud Support |
| **Fortinet** | RADIUS, API | FortiGate, FortiWiFi |
| **Aruba** | RADIUS, CoA | Mobility Controller |
| **D-Link** | RADIUS | Unified Wireless |
| **Netgear** | RADIUS | Insight Integration |
| **Grandstream** | RADIUS | GWN Series |
| **Ubiquiti** | RADIUS | UniFi Controller |

### Authentication Methods

| Method | Description |
|--------|-------------|
| **Room-Based** | Guest name + room number |
| **Voucher-Based** | Pre-paid access codes |
| **Social Auth** | Google, Facebook, WhatsApp |
| **Email/SMS OTP** | One-time password verification |
| **LDAP/AD** | Corporate guest accounts |
| **Captive Portal** | Custom branded login pages |

### AAA Features

| Feature | Capability |
|---------|------------|
| Session Tracking | Start/stop times, duration |
| Data Usage | Upload/download bytes |
| Bandwidth Control | Rate limiting per user |
| Session Timeout | Auto-disconnect policies |
| Idle Timeout | Inactivity detection |
| CoA Support | Dynamic policy changes |
| Accounting | RADIUS radacct synchronization |

### WiFi Flow

```
Check-in → Create WiFi User → Gateway Auth → Session Start → Usage Track → Session End → Billing
```

---

## 📡 Channel Manager Integration

### Supported Channels

#### Global OTAs
- Booking.com
- Expedia (Hotels.com, Vrbo)
- Agoda
- Airbnb
- TripAdvisor
- Hostelworld

#### Regional OTAs (India/Asia)
- MakeMyTrip
- Goibibo
- Yatra
- OYO
- Cleartrip
- EaseMyTrip
- Travelguru
- FabHotels
- Treebo

#### Regional OTAs (EMEA/Americas)
- HRS
- Hotel.de
- Despegar
- Decolar
- Jalan
- Rakuten Travel

#### GDS Networks
- Amadeus
- Sabre
- Travelport (Galileo, Apollo, Worldspan)

#### Metasearch
- Google Hotel Ads
- TripAdvisor
- Trivago
- Kayak
- Skyscanner

### Sync Capabilities

| Feature | Description |
|---------|-------------|
| Inventory Sync | Real-time availability updates |
| Rate Sync | Dynamic pricing synchronization |
| Restrictions | Stop-sell, MLOS, closed to arrival |
| Booking Import | Automatic reservation creation |
| Channel Mapping | Room type and rate plan mapping |
| Conflict Handling | Automated resolution with alerts |
| Retry Queue | Exponential backoff (5 retries) |
| Reconciliation | Periodic full sync (every 6h) |

### OTA Webhook Handling

**Security**:
- HMAC signature validation
- IP allowlist support
- Rate limiting
- Replay protection with timestamps

**Idempotency**:
- All operations use idempotency keys
- Safe retry mechanisms
- No double-bookings

---

## 💳 Payment Gateway Integration

### Supported Gateways

| Gateway | Regions | Features |
|---------|---------|----------|
| **Stripe** | 46+ countries | Cards, Apple Pay, Google Pay |
| **PayPal** | 200+ countries | PayPal, Venmo, Cards |
| **Razorpay** | India | UPI, Cards, NetBanking |
| **Square** | US, Canada, others | Cards, Afterpay |
| **Adyen** | Global | 250+ payment methods |
| **Authorize.net** | US, Canada | Cards, eCheck |
| **CCAvenue** | India | Multi-bank support |
| **PayU** | 50+ countries | Local payment methods |

### Payment Features

| Feature | Capability |
|---------|------------|
| Tokenization | Secure card storage |
| 3D Secure 2.0 | SCA compliance |
| Multi-Currency | Local currency processing |
| Failover Routing | Gateway1 fail → Gateway2 |
| Split Payments | Multiple payment methods |
| Scheduled Payments | Future-dated charges |
| Auto Reconciliation | Matching with bookings |

---

## 🏨 Property Management Specifications

### Booking State Machine

```
Draft → Confirmed → Checked_In → Checked_Out → Cancelled
```

### Inventory Management

| Feature | Specification |
|---------|---------------|
| Room Types | Unlimited |
| Rooms | Unlimited |
| Room Status | 12+ status types |
| Floor Plans | Visual editor with drag-drop |
| Inventory Locking | DB-level row locking |
| Overbooking | Configurable thresholds |

### Rate Management

| Feature | Specification |
|---------|---------------|
| Rate Plans | Unlimited |
| Pricing Rules | Condition-based engine |
| Seasonality | Multiple seasons per year |
| Derivative Rates | Percentage/fixed adjustments |
| Promotions | Discount codes, packages |

---

## 🤖 AI & Machine Learning

### Revenue AI

| Feature | Capability |
|---------|------------|
| Demand Forecasting | Occupancy predictions |
| Dynamic Pricing | Real-time rate recommendations |
| Competitor Analysis | Rate shopping across channels |
| Event Detection | Local events impacting demand |
| Market Intelligence | Weekly market reports |

### Operations AI

| Feature | Capability |
|---------|------------|
| Task Optimization | AI-assigned housekeeping routes |
| Predictive Maintenance | Equipment failure prediction |
| Guest Sentiment | Review sentiment analysis |
| AI Copilot | Natural language queries |
| Smart Recommendations | Personalized suggestions |

---

## 🔐 Security & Compliance

### Data Security

| Feature | Specification |
|---------|---------------|
| Encryption | AES-256 at rest, TLS 1.3 in transit |
| Tokenization | PCI-compliant payment data |
| Backup | Daily automated backups |
| Disaster Recovery | Cross-region failover |
| Audit Logging | Complete activity trail |
| Soft Delete | No hard deletes for critical data |

### Authentication

| Method | Support |
|--------|---------|
| Password | Bcrypt hashing, complexity rules |
| Two-Factor | TOTP, SMS, Email |
| SSO | SAML 2.0, OIDC, LDAP |
| Session | JWT with refresh tokens |
| Device Trust | Device fingerprinting |

### Compliance

| Standard | Status |
|----------|--------|
| GDPR | Full compliance |
| SOC2 | Ready |
| PCI-DSS | Level 1 Service Provider |

---

## 📱 Guest-Facing Applications

### Mobile Web App (PWA)

| Feature | Specification |
|---------|---------------|
| Installable | Works on any device |
| Offline Mode | Basic functionality offline |
| Languages | 15+ languages supported |
| White-label | Custom branding available |

### Digital Key Integration

| Vendor | Protocol |
|--------|----------|
| Assa Abloy | BLE, NFC |
| dormakaba | BLE |
| Salto | BLE, NFC |
| ONITY | BLE |

---

## 📊 API & Integration

### REST API

| Feature | Specification |
|---------|---------------|
| Versioning | URL-based (/v1, /v2) |
| Authentication | OAuth 2.0, API Keys |
| Rate Limiting | Per tenant, user, endpoint |
| Documentation | OpenAPI 3.0 (Swagger) |

### API Endpoints (Core)

```
/api/v1/bookings
/api/v1/guests
/api/v1/rooms
/api/v1/room-types
/api/v1/properties
/api/v1/invoices
/api/v1/folios
/api/v1/payments
/api/v1/wifi/users
/api/v1/wifi/vouchers
/api/v1/wifi/sessions
/api/v1/auth/login
/api/v1/auth/session
/api/v1/availability
```

### Webhooks

| Event Category | Events |
|----------------|--------|
| Booking | created, modified, cancelled, checked_in, checked_out |
| Payment | initiated, completed, failed, refunded |
| Guest | created, updated, loyalty_updated |
| WiFi | session_started, session_stopped, limit_reached |
| Inventory | updated, low_stock |

### Webhook Contract

```json
{
  "event": "booking.created",
  "tenant_id": "xxx",
  "data": {},
  "timestamp": "2026-03-15T10:00:00Z",
  "signature": "sha256=xxx"
}
```

---

## 🌍 Localization

### Supported Languages

| Language | Code | Language | Code |
|----------|------|----------|------|
| English | en | Hindi | hi |
| Bengali | bn | Tamil | ta |
| Telugu | te | Marathi | mr |
| Gujarati | gu | Malayalam | ml |
| Spanish | es | French | fr |
| German | de | Portuguese | pt |
| Arabic | ar | Chinese | zh |
| Japanese | ja | | |

---

## 📈 Performance & Scalability

### System Performance

| Metric | Target |
|--------|--------|
| Uptime SLA | 99.9% |
| API Response Time | < 200ms (p95) |
| Page Load Time | < 2s |
| Concurrent Users | 10,000+ |
| Transactions/Second | 1,000+ |

### Scalability

| Resource | Scaling Model |
|----------|---------------|
| Compute | Horizontal auto-scaling |
| Database | Read replicas |
| Cache | Distributed cache |
| Storage | Unlimited |

---

## 📋 System Requirements

### For Cloud SaaS
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Stable internet connection (5 Mbps+)

### For On-Premise

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 16 GB | 32+ GB |
| Storage | 100 GB SSD | 500+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

---

## 📞 Technical Support

### Support Channels

| Channel | Contact |
|---------|---------|
| Sales | sales@cryptsk.com |
| Support | support@cryptsk.com |
| Documentation | docs.staysuite.io |

---

*Document Version: 2.0*
*Last Updated: March 2026*
*© 2026 Cryptsk Pvt Ltd*
