# StaySuite Release Notes
## Version History

**Last Updated**: March 2026

---

## Version 1.0.0 (March 2026)

### Initial Release

StaySuite 1.0 is the first production release of the All-in-One Hospitality Operating System.

### Core Modules

**Property Management System (PMS)**
- Multi-property support
- Room type and room management
- Inventory calendar
- Rate plans and pricing rules
- Overbooking settings

**Booking Engine**
- Calendar view with drag-drop
- Booking lifecycle management
- Group bookings
- Waitlist management
- Conflict detection

**Guest Management**
- Guest profiles
- KYC/document management
- Preferences tracking
- Stay history
- Loyalty program

**Front Desk**
- Check-in/check-out workflow
- Walk-in booking
- Room grid
- Room assignment

**Guest Experience**
- Service requests
- Guest chat
- In-room portal
- Digital keys

**WiFi Management**
- Multi-vendor gateway support
- Voucher management
- Bandwidth plans
- Usage tracking
- Captive portal

**Billing & Payments**
- Folio management
- Invoice generation
- Multi-gateway payments
- Refunds
- Discounts

**Channel Manager**
- OTA connections (Booking.com, Airbnb, Expedia)
- Inventory sync
- Rate sync
- Booking import
- CRS

**Revenue Management**
- Dynamic pricing
- Pricing rules engine
- Demand forecasting
- AI recommendations

**Housekeeping**
- Task management
- Kanban board
- Room status
- Maintenance requests
- Asset management

**Reports**
- Revenue reports
- Occupancy reports
- ADR/RevPAR
- Guest analytics
- Staff performance
- Scheduled reports

### Integrations

**Payment Gateways**
- Stripe
- PayPal
- Razorpay
- Square
- Adyen

**WiFi Gateways**
- Cisco
- MikroTik
- Ruckus
- Huawei
- Juniper
- Fortinet
- Aruba

**Door Locks**
- Assa Abloy
- dormakaba
- Salto
- ONITY

### Security

- JWT authentication
- Two-factor authentication (TOTP)
- Role-based access control (RBAC)
- Audit logging
- GDPR compliance tools

### Localization

- 15+ languages
- Multi-currency
- Timezone support

---

## Upcoming Features

### Version 1.1 (Planned)

- WhatsApp Business API integration
- Google Hotel Ads integration
- Advanced AI Copilot
- Kitchen Display System (KDS) enhancements
- Mobile app (iOS/Android)

### Version 1.2 (Planned)

- SAML SSO
- Advanced revenue management
- Competitor rate shopping
- Reputation management dashboard
- Energy management IoT

---

## Release Notes Archive

### Version 0.9.0 (Beta - February 2026)

- Beta release for testing
- Core PMS functionality
- Basic booking engine
- Initial WiFi integration

### Version 0.8.0 (Alpha - January 2026)

- Alpha release
- Basic property management
- Guest profiles
- Front desk operations

---

## Upgrade Notes

### Upgrading to 1.0.0

For existing beta users:

1. Backup database
2. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```
3. Clear cache:
   ```bash
   redis-cli FLUSHALL
   ```
4. Restart application

### Breaking Changes

- API v1 endpoints changed
- Webhook payload format updated
- Authentication flow modified

### Deprecations

- Legacy API endpoints removed
- Old webhook format no longer supported

---

## Known Issues

### Version 1.0.0

| Issue | Workaround | Fix Version |
|-------|------------|-------------|
| None reported | - | - |

---

## Changelog Format

```
## [version] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Deprecated
- Features to be removed

### Removed
- Features removed

### Fixed
- Bug fixes

### Security
- Security improvements
```

---

## Support

For questions about releases:
- **Support**: support@cryptsk.com
- **Documentation**: docs.staysuite.io

---

*© 2026 Cryptsk Pvt Ltd*
