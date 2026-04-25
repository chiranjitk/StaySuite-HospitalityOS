# StaySuite User Guide
## Complete Operations Manual

**Version**: 1.0  
**Last Updated**: March 2026

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Property Management](#3-property-management)
4. [Bookings](#4-bookings)
5. [Guest Management](#5-guest-management)
6. [Front Desk Operations](#6-front-desk-operations)
7. [Guest Experience](#7-guest-experience)
8. [WiFi Management](#8-wifi-management)
9. [Billing & Payments](#9-billing--payments)
10. [Restaurant & POS](#10-restaurant--pos)
11. [Housekeeping](#11-housekeeping)
12. [Inventory Management](#12-inventory-management)
13. [Channel Manager](#13-channel-manager)
14. [Reports](#14-reports)
15. [Settings](#15-settings)

---

## 1. Getting Started

### 1.1 System Requirements

| Requirement | Specification |
|-------------|---------------|
| Browser | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| Internet | 5 Mbps minimum |
| Screen | 1366x768 minimum resolution |

### 1.2 Login

1. Navigate to your property URL (e.g., `yourproperty.staysuite.io`)
2. Enter your email address
3. Enter your password
4. If 2FA is enabled, enter the code from your authenticator app
5. Click "Sign In"

### 1.3 Navigation

The sidebar provides access to all modules:

```
🏠 Dashboard
🏨 PMS
📅 Bookings
🧑 Guests
🧑‍💼 Front Desk
🛎 Experience
📶 WiFi
💰 Billing
🍽 Restaurant
🧹 Housekeeping
📦 Inventory
🌐 Channel Manager
📊 Reports
⚙️ Settings
```

### 1.4 Global Search

Use the search bar (or press `Ctrl+K`) to quickly find:
- Bookings
- Guests
- Rooms
- Invoices

---

## 2. Dashboard

### 2.1 Overview Dashboard

The main dashboard displays:

| Widget | Description |
|--------|-------------|
| **KPI Cards** | Today's revenue, occupancy, arrivals, departures |
| **Arrivals** | List of today's check-ins |
| **Departures** | List of today's check-outs |
| **Room Status** | Room status breakdown |
| **Recent Activity** | Latest system events |

### 2.2 Command Center

Real-time operations view:

- Live booking events
- Check-in/check-out status
- Service request alerts
- System notifications
- WiFi session alerts

### 2.3 Alerts Panel

| Alert Type | Description |
|------------|-------------|
| Overbooking | Inventory exceeds capacity |
| Payment Failed | Transaction declined |
| Sync Error | OTA sync failed |
| Low Stock | Inventory below threshold |
| Maintenance | Overdue tasks |

---

## 3. Property Management

### 3.1 Creating a Property

1. Navigate to **PMS → Properties**
2. Click **Add Property**
3. Fill in property details:
   - Name
   - Address
   - Timezone
   - Currency
   - Contact information
4. Configure tax settings
5. Click **Save**

### 3.2 Managing Room Types

1. Navigate to **PMS → Room Types**
2. Click **Add Room Type**
3. Configure:
   - Name (e.g., "Deluxe Room")
   - Base occupancy
   - Max occupancy
   - Base price
   - Amenities
4. Click **Save**

### 3.3 Managing Rooms

1. Navigate to **PMS → Rooms**
2. Click **Add Room**
3. Configure:
   - Room number
   - Room type
   - Floor
   - Features
4. Click **Save**

### 3.4 Room Status Types

| Status | Description |
|--------|-------------|
| Vacant Clean | Ready for check-in |
| Vacant Dirty | Needs cleaning |
| Occupied Clean | Guest checked in, room clean |
| Occupied Dirty | Guest checked in, room dirty |
| Out of Order | Maintenance required |
| Out of Service | Long-term unavailable |

### 3.5 Inventory Calendar

1. Navigate to **PMS → Inventory Calendar**
2. Select date range
3. View availability by room type
4. Click on a date to:
   - Close inventory
   - Set restrictions
   - Adjust pricing

### 3.6 Rate Plans

1. Navigate to **PMS → Rate Plans**
2. Click **Add Rate Plan**
3. Configure:
   - Name (e.g., "Best Available Rate")
   - Room type
   - Base rate
   - Inclusions (breakfast, etc.)
   - Cancellation policy
4. Click **Save**

### 3.7 Pricing Rules

Create dynamic pricing:

1. Navigate to **PMS → Pricing Rules**
2. Click **Add Rule**
3. Set conditions:
   - Date range
   - Day of week
   - Occupancy threshold
   - Lead time
4. Set adjustment:
   - Percentage increase/decrease
   - Fixed amount
5. Click **Save**

---

## 4. Bookings

### 4.1 Creating a Booking

1. Navigate to **Bookings → Calendar View** or **All Bookings**
2. Click **New Booking**
3. Enter guest details:
   - Name
   - Email
   - Phone
   - Address
4. Select room type and room
5. Set check-in and check-out dates
6. Select rate plan
7. Add any extras
8. Click **Confirm Booking**

### 4.2 Booking States

| State | Description |
|-------|-------------|
| Draft | Unconfirmed reservation |
| Confirmed | Confirmed reservation |
| Checked In | Guest has arrived |
| Checked Out | Guest has departed |
| Cancelled | Booking cancelled |

### 4.3 Modifying a Booking

1. Find the booking (search or calendar)
2. Click on the booking
3. Click **Edit**
4. Make changes:
   - Dates
   - Room
   - Guest details
   - Rate plan
5. Click **Save**

### 4.4 Cancelling a Booking

1. Open the booking
2. Click **Cancel**
3. Select cancellation reason
4. Choose refund policy
5. Confirm cancellation

### 4.5 Group Bookings

1. Navigate to **Bookings → Group Bookings**
2. Click **New Group Booking**
3. Enter group details
4. Add rooms:
   - Room type
   - Quantity
   - Dates
5. Set group rate
6. Click **Save**

### 4.6 Waitlist Management

1. Navigate to **Bookings → Waitlist**
2. View waitlisted requests
3. When rooms become available:
   - Select waitlist entry
   - Click **Convert to Booking**
   - Complete booking details

---

## 5. Guest Management

### 5.1 Guest Profiles

1. Navigate to **Guests → Guest List**
2. Search for existing guest or click **Add Guest**
3. Enter guest information:
   - Personal details
   - Contact information
   - Preferences
   - Notes
4. Click **Save**

### 5.2 Guest Preferences

Record guest preferences for future visits:

- Room preference (floor, view)
- Pillow type
- Dietary restrictions
- Newspaper preference
- Early check-in / late check-out

### 5.3 KYC Documents

1. Open guest profile
2. Navigate to **KYC/Documents** tab
3. Click **Upload Document**
4. Select document type:
   - ID Card
   - Passport
   - Driver's License
5. Upload scanned copy
6. Set expiration date

### 5.4 Stay History

View complete guest history:

- All previous stays
- Room types booked
- Total spend
- Services used
- Feedback given

### 5.5 Loyalty Program

1. Navigate to **Guests → Loyalty**
2. Configure tier levels
3. Set earning rules (points per currency)
4. Set redemption rules
5. View member status

---

## 6. Front Desk Operations

### 6.1 Check-In Process

1. Navigate to **Front Desk → Check-In**
2. Find the booking (today's arrivals shown)
3. Verify guest identity
4. Collect/check payment method
5. Assign room (if not pre-assigned)
6. Review special requests
7. Click **Check In**

**Automatic triggers:**
- WiFi access provisioned
- Digital key generated (if enabled)
- Welcome message sent
- Room status updated

### 6.2 Check-Out Process

1. Navigate to **Front Desk → Check-Out**
2. Find the booking
3. Review folio charges
4. Process payment
5. Print/email invoice
6. Click **Check Out**

**Automatic triggers:**
- WiFi access revoked
- Digital key deactivated
- Housekeeping task created
- Feedback request sent

### 6.3 Walk-In Bookings

1. Navigate to **Front Desk → Walk-In**
2. Check availability for dates
3. Create new booking
4. Process payment
5. Check in immediately

### 6.4 Room Grid

Live room status view:

- Color-coded status
- Guest names for occupied rooms
- Quick actions per room
- Drag-drop room assignment

### 6.5 Room Assignment

1. Open booking
2. Click **Assign Room**
3. View available rooms
4. Filter by:
   - Room type
   - Floor
   - Features
5. Select room
6. Click **Assign**

---

## 7. Guest Experience

### 7.1 Service Requests

1. Navigate to **Experience → Service Requests**
2. View incoming requests
3. Filter by status/type
4. Assign to staff
5. Update status as completed

### 7.2 Guest Chat

1. Navigate to **Experience → Guest Chat**
2. View active conversations
3. Select conversation
4. Type message
5. Send to guest

### 7.3 In-Room Portal

Guest can access via QR code:

- View booking details
- Order room service
- Request housekeeping
- View bill
- Check out

### 7.4 Digital Keys

1. Navigate to **Experience → Digital Keys**
2. View active keys
3. Generate new key for guest
4. Set validity period
5. Send to guest app

---

## 8. WiFi Management

### 8.1 WiFi Sessions

1. Navigate to **WiFi → Active Sessions**
2. View connected users:
   - Guest name
   - Room number
   - Device MAC
   - IP address
   - Data usage
   - Session duration
3. Actions:
   - Disconnect user
   - Limit bandwidth
   - View usage history

### 8.2 Voucher Management

1. Navigate to **WiFi → Vouchers**
2. Click **Generate Vouchers**
3. Configure:
   - Quantity
   - Validity period
   - Data limit
   - Speed limit
4. Click **Generate**
5. Print or send vouchers

### 8.3 WiFi Plans

Create bandwidth tiers:

| Plan | Speed | Data Limit | Price |
|------|-------|------------|-------|
| Basic | 5 Mbps | 1 GB/day | Complimentary |
| Standard | 20 Mbps | 5 GB/day | $5/day |
| Premium | 50 Mbps | Unlimited | $10/day |

### 8.4 Usage Reports

1. Navigate to **WiFi → Usage Logs**
2. Filter by date range
3. View:
   - Total sessions
   - Total data consumed
   - Peak usage times
   - Top users

### 8.5 Gateway Configuration

1. Navigate to **WiFi → Gateway Integration**
2. Add RADIUS client:
   - Gateway IP
   - Shared secret
   - Vendor type
3. Test connection
4. Save configuration

---

## 9. Billing & Payments

### 9.1 Folios

A folio is a container for charges linked to a booking.

1. Navigate to **Billing → Folios**
2. Open booking folio
3. View all charges:
   - Room charges
   - Food & beverage
   - Extra services
   - Taxes
4. Add manual charges
5. Post charges from POS

### 9.2 Processing Payments

1. Open folio
2. Click **Add Payment**
3. Select payment method:
   - Credit card
   - Debit card
   - Cash
   - UPI
   - Bank transfer
4. Enter amount
5. Process payment

### 9.3 Invoices

1. Navigate to **Billing → Invoices**
2. Generate invoice from folio
3. Configure:
   - Invoice template
   - Tax breakdown
   - Payment terms
4. Print or email to guest

### 9.4 Refunds

1. Navigate to **Billing → Refunds**
2. Select payment to refund
3. Enter refund amount
4. Select reason
5. Process refund

### 9.5 Discounts

1. Open folio
2. Click **Add Discount**
3. Configure:
   - Discount type (percentage/fixed)
   - Amount
   - Reason
4. Apply to line items

---

## 10. Restaurant & POS

### 10.1 Table Management

1. Navigate to **Restaurant → Tables**
2. View table layout
3. Click table to:
   - Start order
   - View active order
   - Mark as available

### 10.2 Order Management

1. Navigate to **Restaurant → Orders**
2. Create new order:
   - Select table
   - Add items from menu
   - Add special instructions
3. Send to kitchen
4. Mark items as served
5. Close order

### 10.3 Kitchen Display System (KDS)

1. Navigate to **Restaurant → Kitchen**
2. View pending orders
3. Orders displayed by:
   - Order time
   - Priority
   - Station
4. Mark items as:
   - In Progress
   - Ready
   - Served

### 10.4 Menu Management

1. Navigate to **Restaurant → Menu Management**
2. Create categories
3. Add menu items:
   - Name
   - Description
   - Price
   - Category
   - Image
4. Set availability

### 10.5 Post to Folio

1. Close order
2. Select **Post to Folio**
3. Choose guest booking
4. Charges added to room folio

---

## 11. Housekeeping

### 11.1 Task Management

1. Navigate to **Housekeeping → Tasks**
2. View today's tasks
3. Filter by:
   - Status
   - Room
   - Attendant
4. Update task status:
   - Pending → In Progress → Completed

### 11.2 Kanban Board

Visual task management:

| Column | Description |
|--------|-------------|
| To Do | Pending tasks |
| In Progress | Active cleaning |
| Completed | Finished tasks |
| Inspection | Needs inspection |

### 11.3 Room Status Update

1. Navigate to **Housekeeping → Room Status**
2. Select room
3. Update status:
   - Clean
   - Dirty
   - Touch-up
   - Inspected
4. Add notes if needed

### 11.4 Maintenance Requests

1. Navigate to **Housekeeping → Maintenance**
2. Click **New Request**
3. Enter details:
   - Room number
   - Issue description
   - Priority
   - Category
4. Assign to staff
5. Track resolution

### 11.5 Asset Management

1. Navigate to **Housekeeping → Assets**
2. Add assets:
   - Equipment name
   - Location
   - Purchase date
   - Warranty info
3. Schedule maintenance
4. Track service history

---

## 12. Inventory Management

### 12.1 Stock Items

1. Navigate to **Inventory → Stock Items**
2. Add items:
   - Name
   - Category
   - Unit
   - Current stock
   - Reorder level
   - Unit cost
3. Update stock counts

### 12.2 Consumption Tracking

1. Navigate to **Inventory → Consumption**
2. Record usage:
   - Select item
   - Enter quantity
   - Select department
   - Add notes
3. Stock automatically updated

### 12.3 Low Stock Alerts

1. Navigate to **Inventory → Low Stock Alerts**
2. View items below reorder level
3. Generate purchase order

### 12.4 Purchase Orders

1. Navigate to **Inventory → Purchase Orders**
2. Create PO:
   - Select vendor
   - Add items
   - Set quantities
   - Set expected date
3. Submit for approval
4. Receive goods and update stock

---

## 13. Channel Manager

### 13.1 Connecting Channels

1. Navigate to **Channel Manager → OTA Connections**
2. Click **Add Connection**
3. Select channel (e.g., Booking.com)
4. Enter API credentials
5. Test connection
6. Enable connection

### 13.2 Channel Mapping

1. Navigate to **Channel Manager → Mapping**
2. Map room types:
   - Internal room type ↔ OTA room type
3. Map rate plans:
   - Internal rate plan ↔ OTA rate plan
4. Save mappings

### 13.3 Inventory Sync

1. Navigate to **Channel Manager → Inventory Sync**
2. View sync status per channel
3. Manual sync if needed:
   - Select date range
   - Select channels
   - Click **Sync Now**

### 13.4 Rate Sync

1. Navigate to **Channel Manager → Rate Sync**
2. View rate status
3. Update rates across channels
4. Set restrictions:
   - Minimum stay
   - Maximum stay
   - Closed to arrival

### 13.5 Booking Import

1. Navigate to **Channel Manager → Booking Sync**
2. View imported bookings
3. Handle conflicts:
   - View mismatched bookings
   - Resolve mapping issues
   - Confirm import

### 13.6 Sync Logs

1. Navigate to **Channel Manager → Sync Logs**
2. View all sync operations
3. Filter by:
   - Channel
   - Status (success/failed)
   - Date range
4. Retry failed syncs

---

## 14. Reports

### 14.1 Revenue Reports

1. Navigate to **Reports → Revenue**
2. Configure:
   - Date range
   - Property
   - Room type
3. View metrics:
   - Total revenue
   - Room revenue
   - F&B revenue
   - Other revenue
4. Export to Excel/PDF

### 14.2 Occupancy Reports

1. Navigate to **Reports → Occupancy**
2. View:
   - Occupancy percentage
   - Room nights sold
   - Available rooms
   - Segmentation by source

### 14.3 ADR & RevPAR

- **ADR (Average Daily Rate)**: Room revenue / Room nights sold
- **RevPAR**: ADR × Occupancy

### 14.4 Guest Analytics

1. Navigate to **Reports → Guest Analytics**
2. View:
   - Guest demographics
   - Booking patterns
   - Repeat guest ratio
   - Guest lifetime value

### 14.5 Staff Performance

1. Navigate to **Reports → Staff Performance**
2. View metrics:
   - Tasks completed
   - Average response time
   - Customer ratings

### 14.6 Scheduled Reports

1. Navigate to **Reports → Scheduled Reports**
2. Create schedule:
   - Report type
   - Frequency (daily/weekly/monthly)
   - Recipients
   - Format
3. Enable schedule

---

## 15. Settings

### 15.1 General Settings

1. Navigate to **Settings → General**
2. Configure:
   - Property name
   - Contact information
   - Operational settings
   - Check-in/check-out times

### 15.2 Tax & Currency

1. Navigate to **Settings → Tax & Currency**
2. Configure:
   - Default currency
   - Tax rates
   - Tax rules by rate plan

### 15.3 Localization

1. Navigate to **Settings → Localization**
2. Configure:
   - Default language
   - Timezone
   - Date format
   - Number format

### 15.4 Feature Flags

1. Navigate to **Settings → Feature Flags**
2. Enable/disable modules:
   - WiFi Management
   - Restaurant POS
   - Events Management
   - Parking
   - Etc.

### 15.5 Security Settings

1. Navigate to **Settings → Security**
2. Configure:
   - Password policy
   - Two-factor authentication
   - Session timeout
   - IP whitelist

### 15.6 User Management

1. Navigate to **Settings → Users**
2. Add users:
   - Email
   - Role
   - Permissions
3. Manage access per module

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Global search |
| `Ctrl+N` | New booking |
| `Ctrl+S` | Save current form |
| `Esc` | Close modal |
| `?` | Show help |

---

## Support

**Email**: support@cryptsk.com  
**Help Center**: Click `?` in the app

---

*© 2026 Cryptsk Pvt Ltd*
