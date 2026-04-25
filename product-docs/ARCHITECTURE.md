# StaySuite HospitalityOS — Complete Architecture Guide

> **AI DEVELOPER INSTRUCTIONS: READ THIS FILE FIRST BEFORE MAKING ANY CHANGES**
>
> This document contains everything you need to understand the project. Do NOT guess.
> Do NOT refactor the loading system. Do NOT install new packages without permission.
> Follow the patterns described below exactly.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Section Loading System (CRITICAL)](#4-section-loading-system-critical)
5. [Authentication System](#5-authentication-system)
6. [State Management](#6-state-management)
7. [Permissions & Feature Flags](#7-permissions--feature-flags)
8. [Layout & Navigation](#8-layout--navigation)
9. [API Routes Pattern](#9-api-routes-pattern)
10. [Database & Prisma](#10-database--prisma)
11. [Mini Services](#11-mini-services)
12. [i18n / Localization](#12-i18n--localization)
13. [Common & UI Components](#13-common--ui-components)
14. [Contexts Reference](#14-contexts-reference)
15. [Development Rules (MUST FOLLOW)](#15-development-rules-must-follow)
16. [Known Constraints & Pitfalls](#16-known-constraints--pitfalls)
17. [Section Registry (All 192 Sections)](#17-section-registry-all-192-sections)
18. [API Route Registry (All 289 Routes)](#18-api-route-registry-all-289-routes)

---

## 1. Project Overview

**StaySuite HospitalityOS** is a full-featured, multi-tenant hotel management system (PMS) with:

- **192 navigable sections** (pages/views) across 20+ modules
- **289 API routes** covering all business operations
- **802 TypeScript/TSX source files**
- **201 feature component files** (excluding UI primitives)
- **Multi-tenant architecture** with tenant isolation at DB, API, and UI levels
- **15 locales** supported (8 Indian + 7 Global)
- **3 mini-services** (realtime WebSocket, availability, FreeRADIUS)

### Key Statistics

| Metric | Count |
|---|---|
| Navigable sections | 192 |
| Unique component files | 159 |
| API routes | 289 |
| Source files (.ts/.tsx) | 802 |
| Prisma models | 100+ |
| Mini services | 3 |
| Locales | 15 |
| React contexts | 8 |
| shadcn/ui components | 51 |

---

## 2. Tech Stack

### Core (NON-NEGOTIABLE — Do NOT change)

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.1+ | Framework with App Router |
| **TypeScript** | 5 | Language (strict mode) |
| **React** | 19 | UI library |
| **Tailwind CSS** | 4 | Styling |
| **Prisma** | 6.x | ORM (SQLite only) |
| **Bun** | latest | Package manager & runtime |

### Libraries (Use these, do NOT add alternatives)

| Category | Library | Purpose |
|---|---|---|
| UI Components | `shadcn/ui` (New York style) | 51 components in `src/components/ui/` |
| Icons | `lucide-react` | All icons |
| State | `zustand` | Client state (5 stores) |
| Server State | `@tanstack/react-query` | API data caching |
| Tables | `@tanstack/react-table` | Data tables |
| Charts | `recharts` | All visualizations |
| Forms | `react-hook-form` + `zod` | Form handling + validation |
| Animations | `framer-motion` | Transitions |
| Dates | `date-fns` | Date manipulation |
| Auth | `next-auth` v4 | Session management |
| Toast | `sonner` | Notifications |
| i18n | `next-intl` | Internationalization |
| Theme | `next-themes` | Dark/light mode |
| PDF | `jspdf` + `jspdf-autotable` | PDF generation |
| WebSocket | `socket.io-client` | Real-time communication |
| PDF/Docs | `docx` | Word document generation |
| QR Codes | `qrcode` | QR generation |

### Path Alias

```json
{ "@/*": ["./src/*"] }
```
- `@/components/` → `src/components/`
- `@/lib/` → `src/lib/`
- `@/contexts/` → `src/contexts/`
- `@/store/` → `src/store/`
- `@/app/` → `src/app/`

---

## 3. Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # SINGLE page — uses hash-based routing + dynamic imports
│   ├── layout.tsx                # Root layout (providers, theme, auth)
│   ├── login/                    # Login page (separate route)
│   └── api/                      # 289 API routes
│       ├── auth/                 # Authentication (login, logout, session, 2FA, SSO)
│       ├── admin/                # Admin operations (tenants, usage, revenue, health)
│       ├── bookings/             # Booking CRUD, conflicts, audit
│       ├── guests/               # Guest management, behavior, loyalty
│       ├── rooms/                # Room & room-type management
│       ├── dashboard/            # Dashboard statistics
│       ├── users/                # User CRUD
│       ├── channels/             # Channel manager (OTA, CRS)
│       ├── ...                   # 20+ API modules
│       └── v1/                   # REST API version 1
│
├── components/
│   ├── layout/                   # AppLayout, Sidebar, Header
│   ├── common/                   # ErrorBoundary, SectionGuard, FeatureGuard
│   ├── ui/                       # 51 shadcn/ui components (DO NOT MODIFY)
│   ├── sections/                 # Section loading system (CRITICAL — see Section 4)
│   │   └── loaders/              # 3-tier dynamic import chain
│   ├── admin/                    # Admin components (user-mgmt, usage, tenants, roles)
│   ├── dashboard/                # Dashboard components (overview, KPI, command center)
│   ├── bookings/                 # Booking components (calendar, groups, waitlist)
│   ├── guests/                   # Guest components (list, KYC, preferences, loyalty)
│   ├── pms/                      # PMS components (properties, rooms, rates, inventory)
│   ├── frontdesk/                # Front desk (check-in, check-out, walk-in, room-grid)
│   ├── housekeeping/             # HK (tasks, kanban, room-status, maintenance)
│   ├── billing/                  # Billing (folios, invoices, payments, refunds)
│   ├── pos/                      # POS (orders, tables, kitchen, menu)
│   ├── channels/                 # Channel manager UI
│   ├── revenue/                  # Revenue management (pricing, forecasting, competitor)
│   ├── crm/                      # CRM (segments, campaigns, loyalty, feedback)
│   ├── reports/                  # Reports (revenue, occupancy, ADR, staff)
│   ├── security/                 # Security (cameras, incidents, 2FA, sessions)
│   ├── settings/                 # Settings (general, tax, localization, features)
│   ├── ...                       # 20+ component directories
│   └── theme/                    # Theme configuration
│
├── contexts/                     # 8 React contexts
│   ├── AuthContext.tsx            # User session
│   ├── PermissionContext.tsx      # Permission checking
│   ├── FeatureFlagsContext.tsx    # Plan-based features
│   ├── SettingsContext.tsx        # Tenant settings
│   ├── TimezoneContext.tsx        # Per-tenant timezone
│   ├── CurrencyContext.tsx        # Per-tenant currency
│   ├── TaxContext.tsx             # Per-tenant tax
│   └── I18nContext.tsx            # Client-side i18n
│
├── lib/                          # Utility functions & configs
│   ├── db.ts                     # Prisma client singleton
│   ├── db-tenant-middleware.ts    # Tenant isolation middleware
│   ├── auth/                     # Auth helpers (getUserFromRequest, etc.)
│   │   └── tenant-context.ts     # getTenantContext, requireAuth, requirePermission
│   └── ...                       # Various utility modules
│
├── store/                        # Zustand stores
│   └── index.ts                  # All 5 stores (auth, UI, dashboard, notifications, activeTenant)
│
├── i18n/                         # Internationalization
│   ├── config.ts                 # 15 locales config
│   ├── request.ts                # next-intl request config
│   └── client.ts                 # Client-side i18n
│
└── types/                        # TypeScript type definitions

prisma/
├── schema.prisma                 # 100+ models, 4296 lines
└── seed.ts                       # Database seed script

db/
└── custom.db                     # SQLite database file

mini-services/                    # Independent Bun services
├── realtime-service/             # Port 3003 — Socket.IO
├── availability-service/         # Port 3002 — Socket.IO
├── freeradius-service/           # Port 3010 — Hono REST
└── start-services.sh             # Startup script
```

---

## 4. Section Loading System (CRITICAL)

> **WARNING: This is the most sensitive part of the codebase. DO NOT refactor without understanding the full history.**

### The Problem
Turbopack (Next.js 16's bundler) **statically analyzes ALL `import()` calls** in the entire dependency tree at compile time. With 192 sections, putting import() calls directly in `page.tsx` or in statically imported files causes **Turbopack to crash** (OOM / silent death).

### The Solution: 3-Tier Lazy Loading

```
page.tsx (1 import inside useEffect → NOT statically analyzed)
  └── master-loader.tsx (5 import() calls → tier2)
        ├── tier2-core.tsx (5 import() → individual loaders)
        │     ├── load-dashboard.tsx (7 sections)
        │     ├── load-pms.tsx (13 sections)
        │     ├── load-bookings.tsx (6 sections)
        │     ├── load-frontdesk.tsx (5 sections)
        │     └── load-revenue.tsx (9 sections)
        ├── tier2-admin.tsx (5 import() → individual loaders)
        │     ├── load-admin.tsx (8 sections)
        │     ├── load-settings.tsx (6 sections)
        │     ├── load-security.tsx (9 sections)
        │     ├── load-chain.tsx (3 sections)
        │     └── load-channels.tsx (8 sections)
        ├── tier2-guest.tsx (5 import() → individual loaders)
        ├── tier2-ops.tsx (6 import() → individual loaders)
        └── tier2-other.tsx (14 import() → individual loaders)
```

### How It Works

1. **page.tsx** has exactly **ONE** `import()` call inside `useEffect`:
   ```tsx
   import('@/components/sections/loaders/master-loader')
   ```
   Because it's inside useEffect, Turbopack does NOT statically analyze it.

2. **master-loader.tsx** routes to one of 5 tier2 loaders based on section prefix.

3. **tier2-*.tsx** files each have 5-7 `import()` calls to individual loaders.

4. **load-*.tsx** files each have 2-13 `import()` calls to actual components.

5. Each tier is compiled **independently on demand** — only when a user navigates to that section.

### Key File: `src/app/page.tsx`

```tsx
'use client';
import { useState, useEffect } from 'react';
// ... other imports

function SectionContent({ section }: { section: string }) {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setComp(null);

    const timeout = setTimeout(() => {
      if (!cancelled) setError(`Loading timed out for: ${section}`);
    }, 30000);

    import('@/components/sections/loaders/master-loader')  // ONLY import in this file
      .then(async (masterModule) => {
        const mod = await masterModule.default(section);
        const Component = mod?.default || Object.values(mod || {}).find(
          (v: any) => typeof v === 'function' && v.toString().length > 0
        ) as React.ComponentType<any>;
        if (Component) setComp(() => Component);
        else setError(`No component found for: ${section}`);
      })
      .catch((err: any) => setError(`Failed: ${section}: ${err?.message}`));

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [section]);

  if (error) return <ErrorDisplay />;
  if (!Comp) return <LoadingSpinner />;
  return <ErrorBoundary section={section}><Comp /></ErrorBoundary>;
}
```

### Key File: `src/components/sections/loaders/master-loader.tsx`

```tsx
export default async function masterLoader(section: string) {
  const prefix = section.split('-')[0];
  switch (prefix) {
    case 'dashboard': case 'overview': case 'pms': case 'bookings':
    case 'frontdesk': case 'revenue':
      return (await import('./tier2-core')).default(section);
    case 'admin': case 'settings': case 'security': case 'chain': case 'channel':
      return (await import('./tier2-admin')).default(section);
    case 'guests': case 'experience': case 'crm': case 'marketing': case 'events':
      return (await import('./tier2-guest')).default(section);
    case 'billing': case 'saas': case 'pos': case 'inventory':
    case 'housekeeping': case 'staff': case 'reports':
      return (await import('./tier2-ops')).default(section);
    default:
      return (await import('./tier2-other')).default(section);
  }
}
```

### DO NOT:
- ❌ Add any `import()` calls directly in `page.tsx`
- ❌ Import section files statically in `page.tsx`
- ❌ Create nested dynamic imports (dynamic import that itself dynamically imports)
- ❌ Use `import(/* webpackIgnore: true */ ...)` — it breaks `@/` alias resolution
- ❌ Consolidate all imports into one file (causes Turbopack OOM)
- ❌ Put more than ~10 `import()` calls in any single file that's statically reachable

### DO:
- ✅ Add new sections by editing the appropriate `load-*.tsx` file
- ✅ If creating a new category, add a new `load-*.tsx` and register it in the appropriate `tier2-*.tsx`
- ✅ Keep import() calls inside functions/switches (reduces Turbopack's static analysis scope)
- ✅ Test with `bun run lint` after any changes

### Section Registration Flow (Adding a New Section)

1. Create the component file: `src/components/mycategory/my-new-feature.tsx`
2. Find the appropriate `load-*.tsx` file in `src/components/sections/loaders/`
3. Add a case to the switch statement:
   ```tsx
   case 'mycategory-new-feature':
     return import('@/components/mycategory/my-new-feature');
   ```
4. If it's a brand new category, create a new `load-mycategory.tsx` and add it to `tier2-other.tsx`

### Navigation: Hash-Based Routing

- Navigation uses `window.location.hash` (e.g., `#overview`, `#admin-users`, `#bookings-calendar`)
- `useUIStore().activeSection` is synced to/from the URL hash
- Changing `activeSection` updates the hash; hash change updates `activeSection`
- `key={activeSection}` on `<SectionContent>` forces remount on section change

---

## 5. Authentication System

### Architecture: Custom Session-Based Auth

The project uses a **custom session-based auth** (not standard NextAuth despite the package being installed).

### Login Flow

```
1. POST /api/auth/login with { email, password }
2. Validate credentials via bcrypt
3. Create Session record in DB (token = 32-byte random hex)
4. Set session_token as httpOnly cookie
5. Return { user, token }
```

### Session Validation Flow (Every API Request)

```
1. Read session_token cookie
2. Look up Session table → join User → Role → Tenant
3. Validate: not expired, user active, not soft-deleted
4. Check idle timeout (tenant.sessionTimeoutMinutes, default 30 min)
5. Check password expiry (tenant.passwordExpiryDays, default 90 days)
6. Update session.lastActive
7. Proceed with request
```

### Security Features
- Account lockout: 5 failed attempts → 30 min lock
- Idle session timeout (configurable per tenant)
- Password expiry (configurable per tenant)
- 2FA support (TOTP with backup codes)
- Legacy SHA256 password migration
- Password strength: 8+ chars, upper/lower/digit/special
- Session token rotation on refresh

### `useAuth()` Hook

```typescript
// From src/contexts/AuthContext.tsx
const { user, isLoading, isAuthenticated, isPlatformAdmin,
        login, completeTwoFactorLogin, logout, refreshUser } = useAuth();
```

| Field | Type | Description |
|---|---|---|
| `user` | `User \| null` | Full user object with tenant, role, permissions |
| `isLoading` | `boolean` | Initial session fetch in progress |
| `isAuthenticated` | `boolean` | Derived: `!!user` |
| `isPlatformAdmin` | `boolean` | Derived: `!!user?.isPlatformAdmin` |
| `login(email, pw, rememberMe?)` | `Promise<LoginResult>` | Login with credentials |
| `logout()` | `Promise<void>` | Clear session |
| `refreshUser()` | `Promise<void>` | Refetch user data |

### User Object Shape

```typescript
{
  id, email, name, firstName, lastName, avatar, phone, jobTitle, department,
  twoFactorEnabled, roleId, roleName, permissions: string[],
  tenantId, isPlatformAdmin,
  tenant: { id, name, slug, plan, status }
}
```

### Getting tenantId

- **Client-side**: `useAuth().user.tenantId`
- **Server-side**: `getTenantContext(request)` from `src/lib/auth/tenant-context.ts`

---

## 6. State Management

### Zustand Stores (`src/store/index.ts`)

#### Store 1: `useAuthStore` (persisted → `localStorage: staysuite-auth`)
```typescript
const { user, tenant, currentProperty, properties, isAuthenticated, isLoading,
        setUser, setTenant, setCurrentProperty, setProperties, setLoading, logout } = useAuthStore();
```

#### Store 2: `useUIStore` (NOT persisted)
```typescript
const { sidebarOpen, sidebarCollapsed, activeSection, commandPaletteOpen,
        notificationsPanelOpen,
        toggleSidebar, setSidebarOpen, setSidebarCollapsed, setActiveSection,
        setCommandPaletteOpen, setNotificationsPanelOpen } = useUIStore();
```
- `activeSection` defaults to `'overview'`
- `setActiveSection(s)` also sets `window.location.hash = s`

#### Store 3: `useDashboardStore` (NOT persisted)
```typescript
const { stats, recentActivities, isLoading,
        setStats, setRecentActivities, setLoading } = useDashboardStore();
```

#### Store 4: `useNotificationsStore` (NOT persisted)
```typescript
const { notifications, unreadCount,
        addNotification, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotificationsStore();
```

#### Store 5: `useActiveTenantStore` (persisted → `localStorage: staysuite-active-tenant`)
```typescript
const { activeTenantId, setActiveTenantId } = useActiveTenantStore();
```

---

## 7. Permissions & Feature Flags

### Three-Layer Access Control

```
Layer 1: Authentication (is user logged in?)
  └── Layer 2: Permissions (does user have permission X?)
        └── Layer 3: Feature Flags (is feature X enabled for this plan?)
```

### Permission Format

```
"module.action"  — e.g., "bookings.view", "rooms.manage"
"*"              — all permissions (admin/superadmin)
"module.*"       — all actions in module
```

### 9 Default Roles

| Role | Permissions |
|---|---|
| `admin` | `['*']` — full access |
| `manager` | dashboard, bookings, guests, rooms, housekeeping, billing, reports, frontdesk |
| `front_desk` | dashboard ops, bookings CRUD, guests CRUD, rooms view, frontdesk, billing, chat |
| `housekeeping` | dashboard HK, rooms view/status, tasks, housekeeping, maintenance, assets |
| `night_auditor` | dashboard ops, bookings view, guests view, billing, reports, checkin/checkout |
| `revenue_manager` | dashboard, reports, revenue, pricing, channels, bookings view, inventory |
| `marketing` | dashboard, guests, CRM, marketing, reports, communication |
| `accountant` | dashboard, billing, reports revenue/occupancy, invoices, payments |
| `maintenance` | dashboard HK, rooms view, tasks, maintenance, assets, IoT |

### Using Permissions in Components

```tsx
// Option 1: SectionGuard (recommended for section wrappers)
<SectionGuard permission="admin.users">
  <UserManagement />
</SectionGuard>

// Option 2: Hook-based
const { hasPermission } = usePermissions();
if (!hasPermission('bookings.view')) return <AccessDenied />;

// Option 3: FeatureGuard (plan-based)
<FeatureGuard feature="pos">
  <POSModule />
</FeatureGuard>
```

### Feature Flags (Plan-Based)

Plans: `trial` → `starter` → `professional` → `enterprise`

**Base features** (always on): dashboard, pms, bookings, frontdesk, guests, housekeeping, billing, settings, help

**Addon features**: guest_experience, pos, inventory, parking, surveillance, iot, wifi, revenue_management, channel_manager, crm, marketing, reports, events, staff_management, security_center, integrations, automation, ai_features, admin, chain_management, saas_billing, notifications, webhooks

---

## 8. Layout & Navigation

### Layout Structure

```
┌──────────────────────────────────────────┐
│ Header (sticky, z-50, h-14)              │
│   Logo | Search/Command | Notifications  │
│   Profile | Theme Toggle                  │
├──────────┬───────────────────────────────┤
│ Sidebar  │ Main Content                  │
│ (64px    │ (pt-14 pb-2 px-2 lg:px-3)    │
│ collapsed│                               │
│ or 256px │   <SectionContent />          │
│ expanded)│                               │
├──────────┴───────────────────────────────┤
│ Decorative gradient background (z-0)     │
└──────────────────────────────────────────┘
```

### How Navigation Works

1. User clicks sidebar item → calls `useUIStore().setActiveSection('admin-users')`
2. `setActiveSection` sets `window.location.hash = '#admin-users'`
3. `page.tsx` reads `activeSection` from `useUIStore()`
4. `SectionContent` triggers useEffect → imports `master-loader` → resolves component
5. Component renders inside `<AppLayout>` → `<ErrorBoundary>`
6. Hash change events (browser back/forward) also update `activeSection`

### Responsive Behavior

- **Mobile**: Sidebar is hidden by default, opened via hamburger menu, body scroll locked when open
- **Tablet**: Sidebar collapsed (icons only)
- **Desktop**: Sidebar expanded (icons + labels)

---

## 9. API Routes Pattern

### Standard API Route Template

```typescript
// src/app/api/[module]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantContext, requireAuth, requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  // 1. Authentication
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Permission check (optional, depends on route)
  if (!ctx.permissions.some(p => p === 'users.view' || p === 'admin.*' || p === '*')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Tenant scoping (CRITICAL — always scope data to tenant)
  const where = { deletedAt: null, tenantId: ctx.tenantId };

  // 4. Query
  const data = await db.model.findMany({ where, include: { /* relations */ } });

  // 5. Return
  return NextResponse.json({ data });
}
```

### Canonical Auth Helpers (`src/lib/auth/tenant-context.ts`)

| Helper | Returns | Purpose |
|---|---|---|
| `getTenantContext(req)` | `TenantContext \| null` | Get full auth context |
| `getTenantIdFromSession(req)` | `string \| null` | Quick tenant ID lookup |
| `requireAuth(req)` | `TenantContext \| 401 Response` | Auth required |
| `requirePlatformAdmin(req)` | `TenantContext \| 403 Response` | Platform admin required |
| `requirePermission(req, perm)` | `TenantContext \| 403 Response` | Specific permission required |
| `tenantWhere(ctx, extra?)` | `{ tenantId, ...extra }` | Build scoped where clause |
| `hasPermission(ctx, perm)` | `boolean` | Check permission |

### Tenant Scoping Rule

**ALWAYS scope queries to the current tenant's data:**
```typescript
// WRONG:
const users = await db.user.findMany({ where: { deletedAt: null } });

// RIGHT:
const users = await db.user.findMany({
  where: { deletedAt: null, tenantId: ctx.tenantId }
});

// Platform admin exception (if needed):
const where = ctx.isPlatformAdmin
  ? { deletedAt: null }
  : { deletedAt: null, tenantId: ctx.tenantId };
```

### Mutation Audit Logging

For data mutations, create audit log entries:
```typescript
await db.auditLog.create({
  data: {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    module: 'users',
    action: 'update',
    entityType: 'User',
    entityId: id,
    newValue: JSON.stringify(updatedFields),
  }
});
```

---

## 10. Database & Prisma

### Configuration

- **Database**: SQLite at `file:/home/z/my-project/db/custom.db`
- **Schema**: `prisma/schema.prisma` (4296 lines, 100+ models)
- **Client**: `import { db } from '@/lib/db'` — singleton pattern
- **Migrations**: `bun run db:push` (use this, not `db:migrate` for dev)

### Prisma Client Singleton (`src/lib/db.ts`)

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

### Tenant Isolation Middleware (`src/lib/db-tenant-middleware.ts`)

```typescript
import { withTenantScope, tenantScopedWhere } from '@/lib/db-tenant-middleware';

// Auto-inject tenantId into Prisma queries
const result = await withTenantScope(ctx, () => {
  return db.user.findMany({ where: { deletedAt: null } });
  // tenantId is automatically injected
});

// Or manually build where clause
const where = tenantScopedWhere(ctx, 'User');
// Returns: { tenantId: ctx.tenantId }
```

### Key Models

| Category | Models |
|---|---|
| **Core** | Tenant, User, Session, Role, AuditLog, Property |
| **PMS** | RoomType, Room, FloorPlan, FloorPlanRoom, RatePlan, PriceOverride, InventoryLock |
| **Bookings** | Booking, GroupBooking, WaitlistEntry, CancellationPolicy |
| **Guests** | Guest, GuestDocument, GuestStay, GuestBehavior, GuestJourney |
| **Billing** | Folio, FolioLineItem, Payment, Invoice, Discount |
| **Housekeeping** | Task, Asset, WorkOrder, PreventiveMaintenance, InspectionTemplate, InspectionResult |
| **POS** | MenuItem, Order, OrderCategory, RestaurantTable |
| **Inventory** | StockItem, Vendor, PurchaseOrder |
| **Revenue** | PricingRule, CompetitorPrice, DemandForecast, AISuggestion |
| **CRM** | Campaign, GuestSegment, GuestFeedback, GuestReview, LoyaltyTier, LoyaltyReward |
| **Channels** | ChannelMapping, ChannelRestriction, ChannelRetryQueue |
| **WiFi** | WiFiSession, WiFiVoucher, WiFiPlan, WiFiGateway, WiFiAAAConfig |
| **Security** | Camera, CameraGroup, CameraEvent, SecurityEvent, SecurityIncident |
| **IoT** | IoTDevice, EnergyMetric |
| **Staff** | StaffSchedule, StaffShift, StaffAttendance, StaffPerformance, StaffSkill, StaffChannel |
| **Notifications** | Notification, NotificationTemplate, NotificationPreference |
| **GDPR** | GDPRRequest, ConsentRecord |
| **Automation** | AutomationRule, WebhookEndpoint |
| **Events** | Event, EventSpace |

### Schema Rules

- All tenant-scoped models have a `tenantId` field
- All models have `createdAt` and `updatedAt` (auto-managed)
- Soft delete: `deletedAt` field (nullable DateTime) — DO NOT use hard deletes
- Prisma schema primitive types CANNOT be lists (use String with JSON.parse for arrays)

---

## 11. Mini Services

### Port Allocation

| Service | Port | Protocol | Purpose |
|---|---|---|
| Next.js (main) | 3000 | HTTP | Main application |
| availability-service | 3002 | Socket.IO | Room availability WebSocket |
| realtime-service | 3003 | Socket.IO | Real-time updates (bookings, chat, tasks, notifications) |
| freeradius-service | 3010 | HTTP (Hono) | FreeRADIUS management API |
| Caddy (gateway) | 81 | HTTP | Reverse proxy |

### Gateway (Caddy)

All external traffic goes through Caddy on port 81. To route to mini-services, use `XTransformPort` query param:

```typescript
// FRONTEND — CORRECT:
const socket = io('/?XTransformPort=3003');           // WebSocket
const res = await fetch('/api/data?XTransformPort=3002'); // HTTP

// FRONTEND — WRONG:
const socket = io('http://localhost:3003');            // ❌ Direct URL blocked
const res = await fetch('http://localhost:3002/api');  // ❌ Direct URL blocked
```

### Mini Service Pattern

Each mini service is an independent Bun project:
- Has its own `package.json` and `node_modules`
- Entry file: `index.ts` or `server.ts`
- Started with `bun --hot index.ts` (auto-restart on file change)
- Must be started via `mini-services/start-services.sh` or manually in background

### Realtime Service (Port 3003)

Socket.IO server with tenant/property/user room isolation:
- Room status updates
- Booking events
- Chat messages
- Kitchen order updates
- Task notifications
- Dashboard KPI updates

Auth: `handshake.auth = { tenantId, userId }`

### Availability Service (Port 3002)

Dedicated WebSocket for room availability:
- Room status change events
- Availability queries by date range
- Tenant/property isolation

---

## 12. i18n / Localization

### Supported Locales (15)

| Group | Locales |
|---|---|
| Indian | `en`, `hi`, `bn`, `ta`, `te`, `mr`, `gu`, `ml` |
| Global | `es`, `fr`, `ar`, `pt`, `de`, `zh`, `ja` |

### Configuration

- **Default locale**: `en`
- **RTL**: Arabic (`ar`)
- **Locale source**: `locale` cookie (not URL path)
- **Messages**: `messages/${locale}.json` files
- **Library**: `next-intl`

### Usage

```typescript
// Server-side (API route)
import { getLocale } from 'next-intl/server';

// Client-side
const { t } = useTranslations('namespace');
```

---

## 13. Common & UI Components

### Common Components (`src/components/common/`)

| Component | Purpose | Usage |
|---|---|---|
| `ErrorBoundary` | Catches render errors, shows retry | `<ErrorBoundary section="name">` |
| `SectionGuard` | Permission gate | `<SectionGuard permission="admin.users">` |
| `FeatureGuard` | Feature flag gate | `<FeatureGuard feature="pos">` |
| `FeatureBadge` | "Premium" badge | `<FeatureBadge feature="ai" />` |

### UI Components (`src/components/ui/`)

51 shadcn/ui (New York style) components. **DO NOT modify these** — they follow shadcn conventions.

Key components used frequently:
- `Button`, `Input`, `Select`, `Dialog`, `Sheet`, `DropdownMenu`
- `Card`, `Table`, `Tabs`, `Badge`, `Separator`, `ScrollArea`
- `Command` (for command palette), `Sidebar`
- `Form` (react-hook-form integration), `Toast` (via sonner)

### Design System

- **Colors**: Teal primary (`teal-600`), no indigo/blue unless specified
- **Dark mode**: Supported via `next-themes`
- **Responsive**: Mobile-first, breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- **Footer**: Must be sticky (`min-h-screen flex flex-col` + `mt-auto`)
- **Icons**: Always use `lucide-react`

---

## 14. Contexts Reference

| Context | File | Hook | Persisted |
|---|---|---|---|
| Auth | `AuthContext.tsx` | `useAuth()` | No (session cookie) |
| Permissions | `PermissionContext.tsx` | `usePermissions()` | No |
| Feature Flags | `FeatureFlagsContext.tsx` | `useFeatureFlags()` | No |
| Settings | `SettingsContext.tsx` | — | No |
| Timezone | `TimezoneContext.tsx` | — | No |
| Currency | `CurrencyContext.tsx` | — | No |
| Tax | `TaxContext.tsx` | — | No |
| i18n | `I18nContext.tsx` | — | No |

---

## 15. Development Rules (MUST FOLLOW)

### Before Starting Any Work

1. **Read this file** (`ARCHITECTURE.md`)
2. **Read the worklog**: `/home/z/my-project/worklog.md`
3. **Understand what changed last** — don't revert previous fixes
4. **Ask for scope** — one task per session

### While Working

1. **Use existing components** — shadcn/ui, common components, existing patterns
2. **Follow API patterns** — auth check → permission check → tenant scope → query → audit log
3. **Use TypeScript strict** — no `any` unless absolutely necessary
4. **Use `'use client'`** for interactive components, `'use server'` for server code
5. **Run lint** after changes: `bun run lint`
6. **Test** the dev server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`

### After Finishing

1. **Verify the server is still running**
2. **Verify the specific feature works**
3. **Verify nothing else broke** (check related pages)
4. **Git commit** with clear message
5. **Update worklog.md** with what was done

### Forbidden Actions

| ❌ Don't | Why |
|---|---|
| Modify `src/components/ui/` | shadcn managed files |
| Add import() directly in page.tsx | Turbopack will crash |
| Use webpackIgnore in imports | Breaks @/ alias resolution |
| Hard delete records | Use soft delete (deletedAt) |
| Skip tenant scoping | Data leak between tenants |
| Import new packages without asking | Keeps bundle lean |
| Modify the 3-tier loader system | Fragile, well-tested |
| Use `nohup` or `| tee` for dev server | Process dies; use `start-dev.sh` |
| Run `bun run build` | Use `bun run dev` only (sandbox constraint) |

---

## 16. Known Constraints & Pitfalls

### Turbopack (Next.js 16 Bundler)

- **Crashes with >10 static import() calls** in one compilation unit
- **Silent crashes** — no error message, process just dies
- **import() inside useEffect** is NOT statically analyzed (safe to use)
- **Memory limit**: Must set `NODE_OPTIONS="--max-old-space-size=2048"` for dev
- **First compile**: ~13 seconds, subsequent: ~35-40ms

### Environment Constraints

- **Port 3000** only for Next.js (sandbox restriction)
- **Single external port** — Caddy gateway on port 81 handles routing
- **SQLite only** — no MySQL/PostgreSQL
- **No build** — use `bun run dev` only

### Common Mistakes

| Mistake | Fix |
|---|---|
| `import('@/comp')` in top-level page.tsx code | Move inside useEffect or async function |
| useEffect depends on `isLoading` state that toggle causes re-fetch | Use `useRef` skip pattern |
| Nested dynamic imports (dynamic → dynamic) | Flatten to single level |
| Forgetting `key={activeSection}` on SectionContent | Component won't remount |
| Setting state synchronously in useEffect cleanup | Use cancelled flag pattern |
| `bun run build` in sandbox | Use `bun run dev` only |

### Infinite Loop Prevention

```typescript
// WRONG — causes infinite loop:
useEffect(() => {
  fetchUsers().then(() => setIsLoading(false));
}, [isLoading]); // isLoading changes → re-runs → infinite

// RIGHT:
const hasFetched = useRef(false);
useEffect(() => {
  if (hasFetched.current) return;
  hasFetched.current = true;
  fetchUsers().then(() => setIsLoading(false));
}, []);
```

---

## 17. Section Registry (All 192 Sections)

### Dashboard (7)
| Key | Component |
|---|---|
| `overview`, `dashboard-overview` | `overview-dashboard` |
| `dashboard-operations` | `frontdesk-dashboard` |
| `dashboard-housekeeping` | `housekeeping-dashboard` |
| `dashboard-command-center` | `command-center` |
| `dashboard-alerts` | `alerts-panel` |
| `dashboard-kpi` | `kpi-dashboard-enhanced` |

### Admin (8)
| Key | Component |
|---|---|
| `admin-tenants` | `tenant-management` |
| `admin-tenant-lifecycle`, `admin-lifecycle` | `tenant-lifecycle` |
| `admin-users` | `user-management` |
| `admin-usage` | `usage-tracking` |
| `admin-revenue` | `revenue-analytics` |
| `admin-health` | `system-health` |
| `admin-roles` | `role-permissions` |

### PMS (13)
| Key | Component |
|---|---|
| `pms-properties` | `properties-list` |
| `pms-room-types` | `room-types-manager` |
| `pms-rooms` | `rooms-manager` |
| `pms-floor-plans` | `floor-plans` |
| `pms-inventory-calendar` | `inventory-calendar` |
| `pms-pricing-rules`, `pms-rate-plans`, `pms-rate-plans-pricing` | `rate-plans-pricing-rules` |
| `pms-availability` | `availability-control` |
| `pms-locking` | `inventory-locking` |
| `pms-overbooking` | `overbooking-settings` |
| `pms-bulk-price` | `bulk-price-update` |
| `pms-revenue` | `revenue-dashboard` |

### Bookings (6)
| Key | Component |
|---|---|
| `bookings-calendar` | `bookings-calendar-list` |
| `bookings-groups` | `group-bookings` |
| `bookings-waitlist` | `waitlist` |
| `bookings-audit` | `audit-logs` |
| `bookings-conflicts` | `conflicts` |
| `bookings-no-show` | `no-show-automation` |

### Guests (6)
| Key | Component |
|---|---|
| `guests-list` | `guests-list` |
| `guests-kyc` | `kyc-management` |
| `guests-preferences` | `preferences-management` |
| `guests-stay-history`, `guests-history` | `stay-history-management` |
| `guests-loyalty` | `loyalty-management` |

### Front Desk (5)
| Key | Component |
|---|---|
| `frontdesk-checkin` | `check-in` |
| `frontdesk-checkout` | `check-out` |
| `frontdesk-walkin` | `walk-in` |
| `frontdesk-room-grid` | `room-grid` |
| `frontdesk-assignment` | `room-assignment` |

### WiFi (6)
| Key | Component |
|---|---|
| `wifi-sessions` | `sessions` |
| `wifi-vouchers` | `vouchers` |
| `wifi-plans` | `plans` |
| `wifi-logs` | `usage-logs` |
| `wifi-gateway` | `gateway-integration` |
| `wifi-aaa` | `aaa-config` |

### Billing (12)
| Key | Component |
|---|---|
| `billing-folios` | `folios` |
| `billing-invoices` | `invoices` |
| `billing-payments` | `payments` |
| `billing-refunds` | `refunds` |
| `billing-discounts` | `discounts` |
| `billing-cancellation-policies` | `cancellation-policies` |
| `billing-saas-plans`, `saas-plans` | `saas-plans` |
| `billing-saas-subs`, `saas-subscriptions` | `subscriptions` |
| `billing-saas-usage`, `saas-usage` | `usage-billing` |

### Inventory (6)
| Key | Component |
|---|---|
| `inventory-stock` | `stock-items` |
| `inventory-consumption` | `consumption-logs` |
| `inventory-alerts` | `low-stock-alerts` |
| `inventory-vendors` | `vendors` |
| `inventory-purchase-orders`, `inventory-po` | `purchase-orders` |

### Housekeeping (8)
| Key | Component |
|---|---|
| `housekeeping-tasks` | `tasks-list` |
| `housekeeping-kanban` | `kanban-board` |
| `housekeeping-status` | `room-status` |
| `housekeeping-maintenance`, `housekeeping-preventive` | `maintenance` |
| `housekeeping-assets` | `assets` |
| `housekeeping-automation` | `housekeeping-automation` |
| `housekeeping-inspections` | `inspection-checklists` |

### POS (5)
| Key | Component |
|---|---|
| `pos-orders` | `orders` |
| `pos-tables` | `tables` |
| `pos-kitchen` | `kitchen-display` |
| `pos-menu` | `menu-management` |
| `pos-billing` | `billing` |

### Experience (7)
| Key | Component |
|---|---|
| `experience-requests` | `service-requests` |
| `experience-inbox` | `unified-inbox` |
| `experience-chat` | `guest-chat` |
| `experience-keys` | `digital-keys` |
| `experience-portal` | `in-room-portal` |
| `experience-app`, `experience-app-controls` | `guest-app-controls` |

### Parking (4)
| Key | Component |
|---|---|
| `parking-slots` | `slots` |
| `parking-tracking`, `parking-mapping`, `parking-billing` | `vehicle-tracking` |

### Security (9)
| Key | Component |
|---|---|
| `security-live` | `live-camera` |
| `security-playback` | `camera-playback` |
| `security-alerts`, `security-incidents` | `incidents` |
| `security-overview` | `security-overview` |
| `security-audit-logs` | `audit-logs-viewer` |
| `security-2fa` | `two-factor-setup` |
| `security-sessions` | `device-sessions` |
| `security-sso` | `sso-config` |

### Channels (8)
| Key | Component |
|---|---|
| `channel-ota` | `ota-connections` |
| `channel-inventory` | `inventory-sync` |
| `channel-rate` | `rate-sync` |
| `channel-booking` | `booking-sync` |
| `channel-restrictions` | `restrictions` |
| `channel-mapping` | `mapping` |
| `channel-logs` | `sync-logs` |
| `channel-crs` | `crs` |

### Reports (8)
| Key | Component |
|---|---|
| `reports-revenue` | `revenue-reports` |
| `reports-occupancy` | `occupancy-reports` |
| `reports-adr`, `reports-revpar` | `adr-revpar` |
| `reports-guest`, `reports-guests` | `guest-analytics-reports` |
| `reports-staff` | `staff-performance` |
| `reports-scheduled` | `scheduled-reports` |

### Revenue (9)
| Key | Component |
|---|---|
| `revenue-pricing`, `revenue-rules` | `rate-plans-pricing-rules` |
| `revenue-forecast`, `revenue-demand`, `revenue-forecasting` | `demand-forecasting-page` |
| `revenue-competitor`, `revenue-compset` | `competitor-pricing` |
| `revenue-ai`, `revenue-suggestions` | `ai-suggestions` |

### CRM (5)
| Key | Component |
|---|---|
| `crm-segments` | `guest-segments` |
| `crm-campaigns` | `campaigns` |
| `crm-loyalty` | `loyalty-programs` |
| `crm-feedback` | `feedback-reviews` |
| `crm-retention` | `retention-analytics` |

### Settings (6)
| Key | Component |
|---|---|
| `settings-general` | `general` |
| `settings-tax` | `tax-currency` |
| `settings-localization` | `localization` |
| `settings-features` | `feature-flags` |
| `settings-security` | `security` |
| `settings-integrations` | `system-integrations` |

### Chain (3)
| Key | Component |
|---|---|
| `chain-brands` | `brand-management` |
| `chain-dashboard` | `chain-dashboard` |
| `chain-analytics` | `cross-property-analytics` |

### Marketing (5)
| Key | Component |
|---|---|
| `marketing-reputation` | `reputation-dashboard` |
| `marketing-reviews`, `marketing-sources` | `review-sources` |
| `marketing-promotions` | `campaigns` |
| `marketing-booking-engine` | `direct-booking-engine` |

### Events (4)
| Key | Component |
|---|---|
| `events-spaces` | `event-spaces` |
| `events-calendar` | `event-calendar` |
| `events-booking` | `event-booking` |
| `events-resources` | `event-resources` |

### IoT (3)
| Key | Component |
|---|---|
| `iot-devices` | `device-management` |
| `iot-controls` | `room-controls` |
| `iot-energy` | `energy-dashboard` |

### Staff (6)
| Key | Component |
|---|---|
| `staff-shifts` | `shift-scheduling` |
| `staff-attendance` | `attendance-tracking` |
| `staff-tasks` | `task-assignment` |
| `staff-communication` | `internal-communication` |
| `staff-performance` | `staff-performance` |
| `staff-skills` | `skills-management` |

### Other (38)
| Key | Component |
|---|---|
| `settings-gdpr`, `admin-gdpr`, `gdpr-compliance` | `gdpr-manager` |
| `automation-workflow`, `automation-workflows` | `workflow-builder` |
| `automation-rules` | `rules-engine` |
| `automation-templates` | `templates` |
| `automation-logs` | `execution-logs` |
| `integrations-payment`, `integrations-payments` | `payment-gateways-page` |
| `integrations-wifi` | `wifi-gateways` |
| `integrations-pos` | `pos-systems` |
| `integrations-apis` | `third-party-apis` |
| `notifications-templates` | `templates` |
| `notifications-logs` | `delivery-logs` |
| `notifications-settings` | `settings` |
| `webhooks-events` | `events` |
| `webhooks-delivery` | `delivery` |
| `webhooks-retry` | `retry-queue` |
| `ai-copilot` | `copilot` |
| `ai-provider`, `ai-settings` | `provider-settings` |
| `ai-insights` | `insights` |
| `help-center`, `help-articles`, `help-tutorials` | `help-center` |
| `profile`, `profile-user` | `user-profile` |
| `ui-showcase` | `ui-style-showcase` |
| `ads-campaigns` | `ad-campaigns` |
| `ads-google` | `google-hotel-ads` |
| `ads-performance` | `performance-tracking` |
| `ads-roi` | `roi-analytics` |

---

## 18. API Route Registry (All 289 Routes)

### Authentication (15 routes)
`/api/auth/login` POST, `/api/auth/logout` POST, `/api/auth/session` GET|POST, `/api/auth/signup` POST, `/api/auth/forgot-password` POST, `/api/auth/reset-password` POST, `/api/auth/verify-email` POST, `/api/auth/2fa/setup` POST, `/api/auth/2fa/verify` POST, `/api/auth/2fa/disable` POST, `/api/auth/sessions` GET, `/api/auth/sessions/[id]` DELETE, `/api/auth/sso/connections` GET|POST, `/api/auth/sso/ldap/[connectionId]` ALL, `/api/auth/sso/oidc/[connectionId]` ALL, `/api/auth/sso/saml/[connectionId]` ALL, `/api/auth/google` GET, `/api/auth/google/callback` GET, `/api/auth/[...nextauth]` ALL

### Admin (5 routes)
`/api/admin/tenants` ALL, `/api/admin/usage` GET, `/api/admin/usage/init` POST, `/api/admin/revenue` GET, `/api/admin/system-health` GET, `/api/admin/ensure-platform-admin` POST

### Bookings (5 routes)
`/api/bookings` GET|POST, `/api/bookings/[id]` GET|PUT|DELETE, `/api/bookings/audit-logs` GET, `/api/bookings/conflicts` GET, `/api/group-bookings` GET|POST, `/api/group-bookings/[id]` GET|PUT|DELETE, `/api/group-bookings/book-rooms` POST, `/api/waitlist` GET|POST|DELETE, `/api/waitlist/auto-process` POST

### Guests (10 routes)
`/api/guests` GET|POST, `/api/guests/[id]` GET|PUT|DELETE, `/api/guests/[id]/stays` GET, `/api/guests/[id]/documents` ALL, `/api/guests/[id]/behavior` GET, `/api/guests/[id]/journey` GET, `/api/guests/[id]/loyalty` GET|POST, `/api/guests/[id]/reviews` GET, `/api/guests/analytics` GET, `/api/guest-app` ALL

### Rooms & PMS (12 routes)
`/api/rooms` GET|POST, `/api/rooms/[id]` GET|PUT|DELETE, `/api/rooms/available` GET, `/api/room-types` GET|POST, `/api/room-types/[id]` GET|PUT|DELETE, `/api/properties` GET|POST, `/api/properties/[id]` GET|PUT|DELETE, `/api/properties/[id]/tax-settings` GET|PUT, `/api/floor-plans` ALL, `/api/rate-plans` ALL, `/api/rate-plans/[id]` ALL, `/api/inventory` ALL, `/api/inventory/[id]` ALL, `/api/inventory/stock` ALL, `/api/inventory/consumption` GET, `/api/inventory/lock` ALL, `/api/inventory/purchase-orders` ALL, `/api/inventory/vendors` ALL, `/api/inventory-locks` ALL, `/api/price-overrides` ALL, `/api/price-overrides/[id]` ALL

### Billing & Payments (6 routes)
`/api/folios` GET|POST, `/api/folios/[id]` GET|PUT|DELETE, `/api/folios/[id]/line-items` ALL, `/api/invoices` GET|POST, `/api/invoices/[id]/pdf` GET, `/api/payments` GET|POST, `/api/payments/[id]` GET|PUT|DELETE, `/api/cancellation-policies` ALL, `/api/cancellation-policies/[id]` ALL, `/api/settings/discounts` ALL

### Dashboard (1 route)
`/api/dashboard` GET, `/api/frontdesk/dashboard` GET

### Users & Roles (3 routes)
`/api/users` GET|POST, `/api/users/[id]` GET|PUT|DELETE, `/api/users/[id]/reset-password` POST, `/api/roles` GET|POST

### Channels (8 routes)
`/api/channels/connections` GET, `/api/channels/inventory-sync` ALL, `/api/channels/rate-sync` ALL, `/api/channels/booking-sync` ALL, `/api/channels/restrictions` ALL, `/api/channels/mapping` ALL, `/api/channels/sync-logs` GET, `/api/channels/crs` ALL, `/api/channel-manager/push` POST

### Reports (4 routes)
`/api/reports/revenue` GET, `/api/reports/occupancy` GET, `/api/reports/export` POST, `/api/reports/scheduled` ALL

### Revenue (4 routes)
`/api/revenue/pricing-rules` ALL, `/api/revenue/demand-forecast` GET, `/api/revenue/competitor-pricing` ALL, `/api/revenue/ai-suggestions` GET

### CRM (2 routes)
`/api/campaigns` ALL, `/api/crm/feedback` GET, `/api/crm/reviews` GET, `/api/segments` ALL, `/api/loyalty/*` ALL

### Housekeeping (4 routes)
`/api/tasks` ALL, `/api/tasks/[id]` GET|PUT|DELETE, `/api/housekeeping/dashboard` GET, `/api/housekeeping/workload` GET, `/api/housekeeping/routes` GET, `/api/housekeeping/optimization` GET, `/api/inspections` ALL, `/api/inspections/[id]` ALL, `/api/inspections/stats` GET, `/api/inspection-templates` ALL, `/api/inspection-templates/[id]` ALL, `/api/assets` ALL, `/api/assets/[id]` ALL, `/api/maintenance/work-orders` ALL, `/api/maintenance/work-orders/[id]` ALL, `/api/preventive-maintenance` ALL, `/api/preventive-maintenance/[id]` ALL, `/api/service-requests` ALL

### POS (4 routes)
`/api/orders` ALL, `/api/orders/[id]` GET|PUT|DELETE, `/api/orders/[id]/post-to-folio` POST, `/api/tables` ALL, `/api/menu-items` ALL, `/api/menu-categories` ALL

### WiFi (12 routes)
`/api/wifi/sessions` GET, `/api/wifi/vouchers` ALL, `/api/wifi/plans` ALL, `/api/wifi/users` ALL, `/api/wifi/users/[id]` ALL, `/api/wifi/nas` ALL, `/api/wifi/radius-server` ALL, `/api/wifi/aaa` ALL, `/api/wifi/freeradius` ALL, `/api/wifi/sync` POST

### Security (3 routes)
`/api/security/cameras` ALL, `/api/security/cameras/[id]` ALL, `/api/security/cameras/[id]/recordings` GET, `/api/security/incidents` ALL, `/api/security/events` GET

### Settings (8 routes)
`/api/settings/general` GET|PUT, `/api/settings/tax-currency` GET|PUT, `/api/settings/localization` GET|PUT, `/api/settings/locale` GET|POST, `/api/settings/feature-flags` ALL, `/api/settings/security` GET|PUT, `/api/settings/integrations` ALL, `/api/settings/integrations/[id]` ALL, `/api/settings/shift-config` GET|PUT

### Notifications (4 routes)
`/api/notifications` GET, `/api/notifications/send` POST, `/api/notifications/templates` ALL, `/api/notifications/delivery-logs` GET, `/api/notifications/settings` ALL

### Integrations (5 routes)
`/api/integrations/payment-gateways` ALL, `/api/integrations/pos-systems` ALL, `/api/integrations/pos-systems/[id]/sync` POST, `/api/integrations/wifi-gateways` ALL, `/api/integrations/third-party-apis` ALL

### Automation (2 routes)
`/api/automation/rules` ALL, `/api/automation/execution-logs` GET

### Webhooks (4 routes)
`/api/webhooks/events` ALL, `/api/webhooks/delivery` GET, `/api/webhooks/retry-queue` ALL, `/api/webhooks/stripe` POST, `/api/webhooks/paypal` POST

### IoT (3 routes)
`/api/iot/devices` ALL, `/api/iot/devices/[id]` ALL, `/api/iot/devices/[id]/command` POST, `/api/iot/energy` GET

### Staff (9 routes)
`/api/staff/shifts` ALL, `/api/staff/shifts/[id]` ALL, `/api/staff/attendance` GET, `/api/staff/performance` GET, `/api/staff/tasks` ALL, `/api/staff/tasks/[id]` ALL, `/api/staff/skills` ALL, `/api/staff/channels` ALL, `/api/staff/channels/[id]/messages` ALL

### Events (5 routes)
`/api/events` ALL, `/api/events/[id]` ALL, `/api/events/[id]/resources` ALL, `/api/events/spaces` ALL, `/api/events/spaces/[id]` ALL

### Other (10+ routes)
`/api/parking` ALL, `/api/parking/billing` ALL, `/api/vehicles` ALL, `/api/digital-keys` ALL, `/api/gdpr/*` ALL, `/api/audit-logs` ALL, `/api/audit-logs/stats` GET, `/api/audit-logs/export` POST, `/api/chain/dashboard` GET, `/api/chain/analytics` GET, `/api/brands` ALL, `/api/vendors` ALL, `/api/translations` GET, `/api/upload` POST, `/api/search` GET, `/api/health` GET, `/api/version` GET, `/api/docs` GET, `/api/profile` GET|PUT, `/api/user/preferences` GET|PUT, `/api/help/articles` ALL, `/api/communication/*` ALL, `/api/chat-conversations` ALL, `/api/exchange-rates` GET, `/api/accounting/*` ALL, `/api/ads/*` ALL, `/api/ai/*` ALL, `/api/reputation/*` ALL, `/api/cron/*` GET, `/api/booking-engine/*` ALL, `/api/portal/*` ALL, `/api/v1/*` (versioned API)

---

## Quick Start Template for AI Sessions

When starting a new AI session, paste this:

```
## Project: StaySuite HospitalityOS
## Read First: /home/z/my-project/ARCHITECTURE.md (FULL architecture guide)
## Read Second: /home/z/my-project/worklog.md (what was done in previous sessions)

## Current Task: [describe ONE specific task]

## Tech Stack: Next.js 16, TypeScript, Tailwind CSS 4, Prisma (SQLite), Zustand, shadcn/ui
## Key Constraint: 3-tier lazy loading system — DO NOT modify section loading mechanism
## Server Start: bun run dev (port 3000, already running in background)
## Lint Check: bun run lint
## Database: bun run db:push

## RESTRICTIONS:
- Do NOT modify src/components/ui/ (shadcn managed)
- Do NOT modify the 3-tier section loader system
- Do NOT add import() calls directly in page.tsx
- Do NOT install new packages without asking
- Do NOT skip tenant scoping in API routes
- Only modify files related to [specific area]
- Always run bun run lint after changes
```
