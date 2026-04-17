# StaySuite Security Documentation
## Security and Compliance Manual

**Version**: 1.0  
**Last Updated**: March 2026

---

## Table of Contents

1. [Security Architecture](#1-security-architecture)
2. [Authentication](#2-authentication)
3. [Authorization](#3-authorization)
4. [Data Protection](#4-data-protection)
5. [Network Security](#5-network-security)
6. [GDPR Compliance](#6-gdpr-compliance)
7. [Audit Logging](#7-audit-logging)
8. [Incident Response](#8-incident-response)
9. [Security Best Practices](#9-security-best-practices)

---

## 1. Security Architecture

### 1.1 Security Layers

```
┌─────────────────────────────────────────────────────┐
│                   Application Layer                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │    Input    │  │    Auth     │  │   Output    │ │
│  │ Validation  │  │   Checks    │  │ Sanitization│ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────┤
│                    Service Layer                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   RBAC/ABAC │  │   Audit     │  │   Rate      │ │
│  │   Controls  │  │   Logging   │  │   Limiting  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────┤
│                     Data Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Encryption  │  │    Row      │  │   Backup    │ │
│  │ at Rest     │  │  Security   │  │   & DR      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 1.2 Security Principles

| Principle | Implementation |
|-----------|----------------|
| **Defense in Depth** | Multiple security layers |
| **Least Privilege** | RBAC + ABAC |
| **Zero Trust** | Verify every request |
| **Defense by Default** | Secure defaults |
| **Fail Securely** | Deny on failure |

---

## 2. Authentication

### 2.1 Authentication Methods

| Method | Use Case |
|--------|----------|
| Email/Password | Default |
| Two-Factor (TOTP) | Enhanced security |
| SSO (SAML) | Enterprise |
| SSO (OIDC) | Enterprise |
| SSO (LDAP) | Corporate |
| OAuth (Google) | User convenience |

### 2.2 Password Requirements

| Requirement | Value |
|-------------|-------|
| Minimum Length | 8 characters |
| Maximum Length | 128 characters |
| Complexity | Configurable |
| History | Last 5 passwords |
| Expiry | Configurable (default: none) |

### 2.3 Session Management

| Setting | Default |
|---------|---------|
| Session Timeout | 12 hours |
| Absolute Timeout | 7 days |
| Concurrent Sessions | 5 sessions |
| Refresh Token Life | 30 days |

### 2.4 Two-Factor Authentication

**Supported Methods:**
- TOTP (Google Authenticator, Authy)
- SMS (fallback)
- Email (backup)

**Configuration:**

1. Navigate to **Settings → Security → 2FA**
2. Enable for all users or specific roles
3. Configure recovery codes
4. Set backup methods

### 2.5 Single Sign-On (SSO)

**SAML 2.0:**

```xml
<EntityDescriptor>
  <SPSSODescriptor>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Location="https://tenant.staysuite.io/auth/saml/acs"/>
  </SPSSODescriptor>
</EntityDescriptor>
```

**OIDC:**

```json
{
  "issuer": "https://tenant.staysuite.io",
  "authorization_endpoint": "https://tenant.staysuite.io/auth/oidc/authorize",
  "token_endpoint": "https://tenant.staysuite.io/auth/oidc/token",
  "userinfo_endpoint": "https://tenant.staysuite.io/auth/oidc/userinfo"
}
```

---

## 3. Authorization

### 3.1 Role-Based Access Control (RBAC)

**Default Roles:**

| Role | Permissions |
|------|-------------|
| Super Admin | Full system access |
| Admin | Property management |
| Manager | Operations + reports |
| Front Desk | Bookings, check-in/out |
| Housekeeping | Tasks, room status |
| Accountant | Billing, reports |
| Guest | Self-service |

### 3.2 Attribute-Based Access Control (ABAC)

Conditions for access:

```json
{
  "condition": {
    "user.role": "manager",
    "resource.type": "booking",
    "resource.property_id": "user.assigned_properties",
    "action": "read"
  }
}
```

### 3.3 Permission Matrix

| Module | Admin | Manager | Front Desk |
|--------|-------|---------|------------|
| Bookings | CRUD | CRUD | CRU |
| Guests | CRUD | CRU | CRU |
| Billing | CRUD | CRU | R |
| Reports | Full | Property | Limited |
| Settings | Full | Limited | None |

---

## 4. Data Protection

### 4.1 Encryption Standards

| Data State | Encryption |
|------------|------------|
| In Transit | TLS 1.3 |
| At Rest | AES-256-GCM |
| Database | PostgreSQL encryption |
| Backups | AES-256 |

### 4.2 Sensitive Data Handling

**Encrypted Fields:**
- Guest identification numbers
- Payment card tokens
- Passwords (bcrypt)
- Personal notes

**Masked Fields:**
- Card numbers (show last 4)
- Phone numbers (partial)
- Email addresses (partial)

### 4.3 Payment Card Data

**PCI-DSS Compliance:**
- No raw card data stored
- Tokenization via payment gateways
- Secure transmission only
- Regular security scans

### 4.4 Data Retention

| Data Type | Retention | After Retention |
|-----------|-----------|-----------------|
| Booking Data | 7 years | Archived |
| Payment Records | 7 years | Archived |
| Guest Profiles | Until deletion request | Anonymized |
| Audit Logs | 2 years | Deleted |
| Session Data | 30 days | Deleted |

---

## 5. Network Security

### 5.1 Firewall Rules

**Inbound:**

| Port | Source | Purpose |
|------|--------|---------|
| 443 | Any | HTTPS |
| 80 | Any | HTTP → HTTPS redirect |

**Outbound:**

| Port | Destination | Purpose |
|------|-------------|---------|
| 443 | Payment gateways | Payment processing |
| 443 | OTA APIs | Channel sync |
| 1812/1813 | WiFi gateways | RADIUS |

### 5.2 IP Whitelisting

1. Navigate to **Settings → Security → IP Whitelist**
2. Add IP ranges:
   - CIDR notation (e.g., 192.168.1.0/24)
   - Description
3. Enable enforcement

### 5.3 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Authentication | 10 | 1 minute |
| API | 300 | 1 minute |
| Webhooks | 100 | 1 minute |

---

## 6. GDPR Compliance

### 6.1 Data Subject Rights

| Right | Implementation |
|-------|----------------|
| Access | Export via API/UI |
| Rectification | Edit in UI |
| Erasure | Delete with audit |
| Portability | JSON/CSV export |
| Objection | Opt-out mechanisms |

### 6.2 Consent Management

1. Navigate to **Settings → GDPR → Consent**
2. Configure consent types:
   - Marketing emails
   - Analytics tracking
   - Third-party sharing
3. Set default consent policy

### 6.3 Data Export

**API Endpoint:**

```http
POST /api/v1/gdpr/export
```

Response includes:
- Guest profile
- Booking history
- Payment history
- Preferences
- Communications

### 6.4 Right to Erasure

1. Navigate to **Guests → [Profile] → GDPR**
2. Click **Delete Personal Data**
3. Confirm with reason
4. Data anonymized within 30 days

### 6.5 Data Processing Records

Maintained automatically for:
- Data categories
- Processing purposes
- Third-party sharing
- Retention periods

---

## 7. Audit Logging

### 7.1 Logged Events

| Category | Events |
|----------|--------|
| Authentication | Login, logout, password change, 2FA |
| Authorization | Role change, permission update |
| Data Access | View sensitive data, export data |
| Data Modification | Create, update, delete operations |
| System | Configuration changes, integrations |

### 7.2 Log Format

```json
{
  "timestamp": "2026-03-15T10:00:00Z",
  "tenant_id": "tn_001",
  "user_id": "usr_001",
  "action": "booking.update",
  "resource": {
    "type": "booking",
    "id": "bk_123"
  },
  "changes": {
    "before": { "status": "confirmed" },
    "after": { "status": "checked_in" }
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "correlation_id": "req_abc123"
}
```

### 7.3 Log Retention

| Period | Storage |
|--------|---------|
| 0-90 days | Hot storage |
| 90 days - 2 years | Cold storage |
| 2+ years | Deleted |

### 7.4 Log Access

1. Navigate to **Admin → Audit Logs**
2. Filter by:
   - User
   - Action type
   - Date range
   - Resource
3. Export for compliance

---

## 8. Incident Response

### 8.1 Incident Categories

| Severity | Examples |
|----------|----------|
| Critical | Data breach, system compromise |
| High | Unauthorized access, data leak |
| Medium | Failed login attempts, policy violation |
| Low | Suspicious activity |

### 8.2 Response Procedure

**Step 1: Identification**
- Detect incident via monitoring
- Validate severity
- Begin documentation

**Step 2: Containment**
- Isolate affected systems
- Revoke compromised credentials
- Block malicious IPs

**Step 3: Eradication**
- Remove threat
- Patch vulnerabilities
- Update credentials

**Step 4: Recovery**
- Restore from backup if needed
- Monitor for recurrence
- Resume operations

**Step 5: Lessons Learned**
- Document incident
- Update procedures
- Train team

### 8.3 Contact Information

| Role | Contact |
|------|---------|
| Security Team | security@cryptsk.com |
| Emergency | +91 XXX XXX XXXX |

---

## 9. Security Best Practices

### 9.1 For Administrators

- [ ] Enable 2FA for all admin accounts
- [ ] Review audit logs weekly
- [ ] Rotate API keys quarterly
- [ ] Update passwords every 90 days
- [ ] Review user access quarterly
- [ ] Test backup restoration monthly

### 9.2 For Users

- [ ] Use strong, unique passwords
- [ ] Enable 2FA on your account
- [ ] Lock computer when away
- [ ] Report suspicious activity
- [ ] Don't share credentials

### 9.3 Security Checklist

**Daily:**
- Monitor security alerts
- Review failed login attempts

**Weekly:**
- Review audit logs
- Check integration health

**Monthly:**
- User access review
- Password policy compliance
- Backup verification

**Quarterly:**
- Penetration testing
- Vulnerability scan
- Security training

---

## 10. Compliance Certifications

### 10.1 SOC 2 Type II

StaySuite is SOC 2 Type II compliant covering:
- Security
- Availability
- Confidentiality

### 10.2 GDPR

Full GDPR compliance with:
- Data subject rights
- Processing records
- Consent management
- Data protection impact assessments

### 10.3 PCI-DSS

PCI-DSS Level 1 Service Provider for payment processing.

---

## Security Contact

**Security Team**: security@cryptsk.com  
**Bug Bounty**: security@cryptsk.com  
**Compliance**: compliance@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd*
