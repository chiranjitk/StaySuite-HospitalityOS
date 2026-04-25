# StaySuite Administrator Guide
## System Administration Manual

**Version**: 1.0  
**Last Updated**: March 2026

---

## Table of Contents

1. [Tenant Management](#1-tenant-management)
2. [User & Role Management](#2-user--role-management)
3. [Security Configuration](#3-security-configuration)
4. [Integration Setup](#4-integration-setup)
5. [WiFi Gateway Configuration](#5-wifi-gateway-configuration)
6. [Channel Manager Setup](#6-channel-manager-setup)
7. [Payment Gateway Setup](#7-payment-gateway-setup)
8. [Backup & Recovery](#8-backup--recovery)
9. [System Monitoring](#9-system-monitoring)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tenant Management

### 1.1 Creating a New Tenant

1. Navigate to **Admin → Tenant Management**
2. Click **Add Tenant**
3. Configure tenant details:

| Field | Description |
|-------|-------------|
| Tenant Name | Organization name |
| Subdomain | `tenant.staysuite.io` |
| Plan | Subscription tier |
| Admin Email | Primary admin contact |
| Max Properties | Property limit |
| Max Users | User limit |
| Max Rooms | Room inventory limit |

4. Click **Create Tenant**

### 1.2 Tenant Lifecycle

```
Trial → Active → Suspended → Cancelled → Archived
```

| State | Description |
|-------|-------------|
| **Trial** | Free trial period (14 days) |
| **Active** | Paid subscription active |
| **Suspended** | Payment failed or manual suspend |
| **Cancelled** | Subscription terminated |
| **Archived** | Data archived, tenant inactive |

### 1.3 Tenant Configuration

1. Open tenant from list
2. Configure:

**General Settings:**
- Timezone
- Currency
- Language
- Logo
- Branding colors

**Resource Limits:**
- Storage quota
- API rate limits
- User limits
- Property limits

**Feature Flags:**
- Enable/disable modules per tenant

### 1.4 Usage Tracking

1. Navigate to **Admin → Usage Tracking**
2. View metrics per tenant:
   - API calls
   - Storage used
   - Active users
   - Booking count
   - WiFi sessions

---

## 2. User & Role Management

### 2.1 Role Configuration

Default roles:

| Role | Access Level |
|------|--------------|
| **Admin** | Full system access |
| **Manager** | Operations + Reports |
| **Front Desk** | Bookings, Check-in/out |
| **Housekeeping** | Tasks, Room status |
| **Accountant** | Billing, Reports |
| **Guest** | Self-service only |

### 2.2 Creating Custom Roles

1. Navigate to **Admin → Role Permissions**
2. Click **Add Role**
3. Set permissions per module:

```
┌─────────────────┬───────┬───────┬───────┬───────┐
│ Module          │ View  │ Create│ Edit  │ Delete│
├─────────────────┼───────┼───────┼───────┼───────┤
│ Bookings        │  ✓    │  ✓    │  ✓    │  ✗    │
│ Guests          │  ✓    │  ✓    │  ✓    │  ✗    │
│ Billing         │  ✓    │  ✓    │  ✓    │  ✗    │
│ Reports         │  ✓    │  ✗    │  ✗    │  ✗    │
│ Settings        │  ✗    │  ✗    │  ✗    │  ✗    │
└─────────────────┴───────┴───────┴───────┴───────┘
```

4. Save role

### 2.3 User Provisioning

1. Navigate to **Admin → User Management**
2. Click **Add User**
3. Configure:
   - Email
   - Name
   - Role
   - Properties (if multi-property)
   - Two-factor requirement
4. Send invitation

### 2.4 SSO Configuration

**SAML 2.0 Setup:**

1. Navigate to **Settings → Security → SSO**
2. Click **Add SAML Connection**
3. Configure:
   - Identity Provider URL
   - SSO URL
   - Certificate
   - Attribute mapping
4. Test connection
5. Enable for users

**OIDC Setup:**

1. Click **Add OIDC Connection**
2. Configure:
   - Discovery URL
   - Client ID
   - Client Secret
   - Scope
3. Test and enable

**LDAP Setup:**

1. Click **Add LDAP Connection**
2. Configure:
   - Server URL
   - Bind DN
   - Base DN
   - Filter
   - Attribute mapping
3. Test connection

---

## 3. Security Configuration

### 3.1 Password Policy

1. Navigate to **Settings → Security**
2. Configure password requirements:

| Setting | Value |
|---------|-------|
| Minimum Length | 8-16 characters |
| Require Uppercase | Yes/No |
| Require Lowercase | Yes/No |
| Require Numbers | Yes/No |
| Require Special Chars | Yes/No |
| Password Expiry | Days (0 = never) |
| Password History | Remember last N passwords |

### 3.2 Two-Factor Authentication

1. Navigate to **Settings → Security → 2FA**
2. Configure:
   - Require 2FA for all users
   - Require 2FA for admins only
   - Allowed methods (TOTP, SMS, Email)

### 3.3 Session Management

1. Navigate to **Settings → Security → Sessions**
2. Configure:
   - Session timeout (minutes)
   - Concurrent sessions limit
   - Force logout on password change

### 3.4 IP Whitelist

1. Navigate to **Settings → Security → IP Whitelist**
2. Add allowed IP ranges:
   - IP/CIDR notation
   - Description
3. Enable whitelist enforcement

### 3.5 Audit Logs

1. Navigate to **Admin → Audit Logs**
2. View all system activity:
   - User actions
   - Data changes
   - Login attempts
   - API calls
3. Filter by:
   - User
   - Module
   - Action type
   - Date range
4. Export logs

---

## 4. Integration Setup

### 4.1 API Access

1. Navigate to **Settings → Integrations → API**
2. Generate API keys:
   - Key name
   - Expiration date
   - Scopes/permissions
3. Copy and store securely (shown only once)

### 4.2 Webhooks

1. Navigate to **Settings → Integrations → Webhooks**
2. Add webhook endpoint:
   - URL
   - Secret (for signature verification)
   - Events to subscribe
3. Test webhook
4. Enable

### 4.3 Third-Party API Connections

1. Navigate to **Settings → Integrations → Third-Party APIs**
2. Configure external services:
   - API endpoint
   - Authentication method
   - Rate limits
   - Retry policy

---

## 5. WiFi Gateway Configuration

### 5.1 Gateway Setup Overview

```
┌─────────────┐     RADIUS      ┌─────────────┐
│   Gateway   │ ◄─────────────► │  StaySuite  │
│ (MikroTik)  │                 │   Server    │
└─────────────┘                 └─────────────┘
       │
       │ Captive Portal
       ▼
┌─────────────┐
│   Guest     │
│   Device    │
└─────────────┘
```

### 5.2 Adding a WiFi Gateway

1. Navigate to **Integrations → WiFi Gateways**
2. Click **Add Gateway**
3. Select vendor type
4. Configure:

**RADIUS Settings:**
| Setting | Description |
|---------|-------------|
| NAS IP | Gateway IP address |
| Shared Secret | RADIUS shared secret |
| Auth Port | Typically 1812 |
| Acct Port | Typically 1813 |

**Captive Portal:**
| Setting | Description |
|---------|-------------|
| Portal URL | Login page URL |
| Splash Page | Custom HTML/branding |
| Redirect URL | Post-login redirect |

5. Test connection
6. Save configuration

### 5.3 Vendor-Specific Configurations

**MikroTik:**
```
/radius add address=staysuite.io secret=SHARED_SECRET service=hotspot
/ip hotspot profile set [find] login-by=http-chap,http-pap,cookie
/ip hotspot user profile set [find] rate-limit=5M/5M
```

**Cisco WLC:**
```
config radius auth add 1 staysuite.io 1812 SHARED_SECRET
config radius acct add 1 staysuite.io 1813 SHARED_SECRET
config wlan create 2 GuestWiFi
config wlan security web-auth enable 2
```

**Ruckus:**
```
ZoneDirector → Configure → RADIUS
Add Server:
  - Auth Server: staysuite.io:1812
  - Acct Server: staysuite.io:1813
  - Secret: SHARED_SECRET
```

### 5.4 Bandwidth Plans

1. Navigate to **WiFi → Plans**
2. Create plans:

| Plan Name | Download | Upload | Data Cap | Price |
|-----------|----------|--------|----------|-------|
| Basic | 5 Mbps | 2 Mbps | 1 GB | Free |
| Standard | 20 Mbps | 10 Mbps | 5 GB | $5 |
| Premium | 50 Mbps | 25 Mbps | Unlimited | $10 |

3. Map plans to RADIUS attributes:
   - `WISPr-Bandwidth-Max-Down`
   - `WISPr-Bandwidth-Max-Up`

### 5.5 Captive Portal Customization

1. Navigate to **WiFi → Gateway Integration**
2. Edit portal template
3. Customize:
   - Logo
   - Background image
   - Colors
   - Welcome text
   - Terms & conditions
4. Preview changes
5. Publish

### 5.6 FreeRADIUS Integration (Self-Hosted)

1. Navigate to **WiFi → Radius Server**
2. Configure FreeRADIUS settings:
   - Database connection
   - SQL queries
   - Accounting interval
3. Download configuration files
4. Deploy to FreeRADIUS server

---

## 6. Channel Manager Setup

### 6.1 Connecting Booking.com

1. Navigate to **Channel Manager → OTA Connections**
2. Click **Add Connection → Booking.com**
3. Enter credentials:
   - Hotel ID
   - API Key
   - API Secret
4. Test connection
5. Enable connection

### 6.2 Connecting Airbnb

1. Click **Add Connection → Airbnb**
2. Authorize via OAuth:
   - Click "Connect with Airbnb"
   - Login to Airbnb
   - Grant permissions
3. Map listings

### 6.3 Connecting Expedia

1. Click **Add Connection → Expedia**
2. Enter credentials:
   - Hotel ID
   - API Key
   - API Secret
3. Configure rate plans
4. Enable connection

### 6.4 Channel Mapping

1. Navigate to **Channel Manager → Mapping**
2. For each channel:
   - Map room types
   - Map rate plans
   - Set default values
3. Verify mappings
4. Enable sync

### 6.5 Sync Configuration

1. Navigate to **Channel Manager → Sync Settings**
2. Configure:

| Setting | Value |
|---------|-------|
| Sync Mode | Real-time / Scheduled |
| Sync Interval | 5 minutes (if scheduled) |
| Retry Attempts | 5 |
| Retry Delay | Exponential backoff |
| Conflict Resolution | Prefer OTA / Prefer PMS |

---

## 7. Payment Gateway Setup

### 7.1 Stripe Integration

1. Navigate to **Integrations → Payment Gateways**
2. Click **Add Gateway → Stripe**
3. Configure:
   - API Key (Publishable)
   - API Key (Secret)
   - Webhook Secret
4. Set webhook URL in Stripe dashboard
5. Test payment
6. Enable

### 7.2 Razorpay Integration (India)

1. Click **Add Gateway → Razorpay**
2. Configure:
   - Key ID
   - Key Secret
   - Webhook Secret
3. Enable payment methods:
   - Cards
   - UPI
   - NetBanking
   - Wallets
4. Test and enable

### 7.3 PayPal Integration

1. Click **Add Gateway → PayPal**
2. Configure:
   - Client ID
   - Client Secret
   - Sandbox/Live mode
3. Set webhook URL
4. Test and enable

### 7.4 Multi-Gateway Routing

1. Navigate to **Integrations → Payment Gateways → Routing**
2. Configure routing rules:
   - Primary gateway
   - Fallback gateway
   - Routing by currency
   - Routing by amount
3. Enable routing

---

## 8. Backup & Recovery

### 8.1 Automated Backups

Backups are configured automatically:

| Type | Frequency | Retention |
|------|-----------|-----------|
| Full | Daily | 30 days |
| Incremental | Hourly | 7 days |
| Transaction Logs | Continuous | 24 hours |

### 8.2 Manual Backup

1. Navigate to **Admin → Backup & Recovery**
2. Click **Create Backup**
3. Select scope:
   - Full backup
   - Database only
   - Files only
4. Download backup file

### 8.3 Data Export (GDPR)

1. Navigate to **Admin → GDPR → Export Data**
2. Select tenant
3. Choose data scope
4. Generate export
5. Download archive

### 8.4 Recovery

1. Navigate to **Admin → Backup & Recovery**
2. Select backup from list
3. Click **Restore**
4. Confirm restoration
5. Verify data integrity

---

## 9. System Monitoring

### 9.1 Health Dashboard

1. Navigate to **Admin → System Health**
2. View metrics:

| Metric | Description |
|--------|-------------|
| API Response Time | Average API latency |
| Database Connections | Active DB connections |
| Queue Backlog | Pending jobs in queue |
| Memory Usage | Server memory |
| CPU Usage | Server CPU load |
| Storage | Disk space used |

### 9.2 Alert Configuration

1. Navigate to **Admin → Alerts**
2. Configure alerts:

| Alert | Threshold | Notification |
|-------|-----------|--------------|
| High API Latency | > 500ms | Email, Slack |
| Queue Backlog | > 100 jobs | Email |
| High Memory | > 85% | Email |
| Low Storage | < 10% | Email |
| Sync Failure | Any | Email |

### 9.3 Log Management

1. Navigate to **Admin → Logs**
2. View logs by type:
   - Application logs
   - API logs
   - Error logs
   - Access logs
3. Filter and search
4. Export logs

---

## 10. Troubleshooting

### 10.1 Common Issues

**OTA Sync Failures:**

| Issue | Solution |
|-------|----------|
| Authentication error | Verify API credentials |
| Mapping missing | Check room/rate mappings |
| Rate limit exceeded | Wait and retry |
| Invalid data | Check required fields |

**Payment Failures:**

| Issue | Solution |
|-------|----------|
| Gateway timeout | Check gateway status |
| Invalid card | Verify card details |
| 3DS failure | Check 3DS configuration |
| Webhook not received | Verify webhook URL |

**WiFi Issues:**

| Issue | Solution |
|-------|----------|
| User can't connect | Check RADIUS config |
| Bandwidth not applied | Verify plan mapping |
| Session not tracked | Check accounting config |
| Portal not loading | Check captive portal URL |

### 10.2 Diagnostic Tools

1. **API Test**: Test API endpoints directly
2. **Webhook Test**: Send test webhook
3. **RADIUS Test**: Test authentication
4. **Connection Test**: Test gateway connections

### 10.3 Support Escalation

| Priority | Response | Contact |
|----------|----------|---------|
| P1 - Critical | 15 min | support@cryptsk.com |
| P2 - High | 1 hour | support@cryptsk.com |
| P3 - Medium | 4 hours | support@cryptsk.com |
| P4 - Low | 24 hours | support@cryptsk.com |

---

*© 2026 Cryptsk Pvt Ltd*
