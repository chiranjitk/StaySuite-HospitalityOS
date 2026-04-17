StaySuite Hospitality OS

**Database Migration Guide**

SQLite → PostgreSQL

Production Readiness Checklist & Code Fixes

Version 1.0 \| 2026-03-31

Confidential --- Internal Use Only

**Table of Contents**

1\. Overview 1

> 1.1 Why PostgreSQL? 1
>
> 1.2 Scope of Changes 2

2\. Step-by-Step Migration 3

> 2.1 Step 1 --- Set Up PostgreSQL 3
>
> 2.2 Step 2 --- Update Prisma Schema Provider 3
>
> 2.3 Step 3 --- Generate and Apply Migration 4
>
> 2.4 Step 4 --- Re-seed the Database 4
>
> 2.5 Step 5 --- Verify the Application 4

3\. Code Fixes to Revert for PostgreSQL 5

> 3.1 Case-Insensitive Department Filter 5
>
> 3.2 Full-Text Search Upgrade 6
>
> 3.3 JSON Field Type Upgrades 7
>
> 3.4 Boolean Default Values 7

4\. Mini-Services Database Migration 8

5\. Complete File Change Reference 9

> 5.1 Must Change (Configuration) 9
>
> 5.2 Should Revert (SQLite Workarounds) 9
>
> 5.3 May Need Review 10

6\. Pre-Flight Checklist 11

> 6.1 Infrastructure 11
>
> 6.2 Configuration 11
>
> 6.3 Code Changes 12
>
> 6.4 Data Migration 12
>
> 6.5 Testing 12
>
> 6.6 Performance 13
>
> 6.7 Rollback Plan 13

7\. Rollback Procedure 14

8\. Post-Migration Optimizations 15

> 8.1 Database Indexes 15
>
> 8.2 Connection Pooling 15
>
> 8.3 Enum Types 16

Note: Right-click the TOC and select "Update Field" to refresh page
numbers.

**1. Overview**

This document provides a complete, step-by-step guide for migrating
StaySuite Hospitality OS from SQLite to PostgreSQL in production. It
covers configuration changes, code fixes required, data migration steps,
and a pre-flight checklist to ensure nothing is missed.

StaySuite currently uses SQLite as the database backend during
development. While SQLite is excellent for rapid prototyping, PostgreSQL
is required for production due to its superior concurrency, data
integrity, and scalability features.

**1.1 Why PostgreSQL?**

  ------------------------------------------------------------------------
  **Feature**           **SQLite (Current)**     **PostgreSQL (Target)**
  --------------------- ------------------------ -------------------------
  Concurrent Writes     Single writer only       Multi-writer support

  Case-insensitive      Not supported (manual    Native mode:
  Search                workaround)              \'insensitive\'

  Full-text Search      Basic LIKE only          Native tsvector / search
                                                 index

  JSON Queries          Stored as String, parsed Native Json type with
                        in app                   query ops

  Array Fields          Comma-separated strings  Native String\[\] /
                                                 Int\[\]

  Migrations            db push only             Full migration system
                        (destructive)            (safe)

  Connection Pooling    N/A                      PgBouncer / built-in
                                                 pooling

  Production Ready      Not recommended          Enterprise-grade,
                                                 battle-tested
  ------------------------------------------------------------------------

Table 1: Feature comparison between SQLite and PostgreSQL

**1.2 Scope of Changes**

The migration affects the following areas:

-   Database configuration (.env and schema.prisma)

-   Prisma migration strategy (db push → prisma migrate)

-   Code workarounds that must be reverted (case-insensitive search,
    JSON string parsing)

-   Schema type upgrades (String → Json for JSON fields)

-   Seed script adjustments (if any)

-   Mini-services that use SQLite (freeradius-service,
    availability-service, realtime-service)

**2. Step-by-Step Migration**

**2.1 Step 1 --- Set Up PostgreSQL**

Provision a PostgreSQL database. Example for common providers:

**2.2 Step 2 --- Update Prisma Schema Provider**

Open prisma/schema.prisma and change the provider:

> **WARNING:** Do NOT change field types in the schema yet. First
> generate the migration, then upgrade types in a follow-up migration.

**2.3 Step 3 --- Generate and Apply Migration**

Stop using db push. PostgreSQL supports proper migrations:

> **TIP:** Run prisma migrate dev in development first to test. Use
> prisma migrate deploy in CI/CD pipelines for production.

**2.4 Step 4 --- Re-seed the Database**

The seed script (prisma/seed.ts) uses Prisma Client and works
identically with PostgreSQL. No changes needed.

**2.5 Step 5 --- Verify the Application**

**3. Code Fixes to Revert for PostgreSQL**

During development, several SQLite-specific workarounds were added to
the codebase. These MUST be reverted when moving to PostgreSQL to
leverage native features and improve performance.

**3.1 Case-Insensitive Department Filter**

**File: src/app/api/users/route.ts**

Current code uses a post-filter workaround because SQLite does not
support Prisma\'s mode: \'insensitive\':

**Current (SQLite workaround):**

**Change to (PostgreSQL native):**

> **WARNING:** If you forget to revert this, it will still work on
> PostgreSQL but with degraded performance (fetches all users then
> filters in Node.js instead of at the database level).

**3.2 Full-Text Search Upgrade**

**File: src/app/api/tasks/route.ts (GET handler)**

The current search uses basic contains:

**Current (works on both, but limited):**

**Upgrade to (PostgreSQL native full-text):**

> **TIP:** The search syntax is the same, just replace contains with
> search. PostgreSQL will use GIN indexes for much faster results.

**3.3 JSON Field Type Upgrades (Recommended)**

Several fields store JSON as String in the schema. PostgreSQL supports
native Json type:

  ----------------------------------------------------------------------------
  **Model**   **Field**        **Current    **Recommended   **Impact**
                               Type**       Type**          
  ----------- ---------------- ------------ --------------- ------------------
  Role        permissions      String       Json            Query permissions
                                                            natively

  Task        attachments      String       Json            Query attachment
                                                            metadata

  Task        recurrenceRule   String       Json            Query recurrence
                                                            rules

  Task        subtasks         String       Json            Query subtask
                                                            status
  ----------------------------------------------------------------------------

Table 2: JSON field type upgrade recommendations

To upgrade, create a new migration after the initial one:

In the schema, change the field types. For example in Role model:

> **WARNING:** When changing String to Json, you MUST ensure existing
> data is valid JSON. Run a data migration or re-seed after the schema
> change.

**3.4 Boolean Default Values**

SQLite stores booleans as integers (0/1). PostgreSQL uses native
boolean. If any boolean fields were added with integer defaults, update
them:

> **TIP:** Prisma abstracts the boolean difference between SQLite and
> PostgreSQL. No changes needed unless you wrote raw SQL.

**4. Mini-Services Database Migration**

StaySuite has several mini-services in the mini-services/ directory.
Each may need its own database migration:

  ------------------------------------------------------------------------------
  **Service**            **Port**   **Has Database**   **Action Required**
  ---------------------- ---------- ------------------ -------------------------
  availability-service   3001       Yes (SQLite)       Update DATABASE_URL to
                                                       PostgreSQL

  freeradius-service     3002       Yes (SQLite)       Update DATABASE_URL to
                                                       PostgreSQL

  realtime-service       3003       No (in-memory)     No action needed
  ------------------------------------------------------------------------------

Table 3: Mini-services database status

For each service with a database:

1.  Update the DATABASE_URL environment variable to point to PostgreSQL

2.  If using Prisma, update the provider in schema.prisma

3.  Run prisma migrate dev to create migrations

4.  Restart the service

**5. Complete File Change Reference**

This section lists every file that needs modification when migrating to
PostgreSQL:

**5.1 Must Change (Configuration)**

  -------------------------------------------------------------------------------
  **File**                 **Change**                              **Priority**
  ------------------------ --------------------------------------- --------------
  .env                     Update DATABASE_URL to PostgreSQL       CRITICAL
                           connection string                       

  prisma/schema.prisma     Change provider from \"sqlite\" to      CRITICAL
                           \"postgresql\"                          
  -------------------------------------------------------------------------------

Table 4: Configuration files that must change

**5.2 Should Revert (SQLite Workarounds)**

  -----------------------------------------------------------------------------------
  **File**                     **Change**                              **Priority**
  ---------------------------- --------------------------------------- --------------
  src/app/api/users/route.ts   Remove post-filter for department; add  HIGH
                               mode: \'insensitive\' back to where     
                               clause                                  

  src/app/api/tasks/route.ts   Consider upgrading search from contains MEDIUM
                               to search for full-text                 

  prisma/schema.prisma         Upgrade String JSON fields to native    MEDIUM
                               Json type (permissions, attachments,    
                               recurrenceRule, subtasks)               
  -----------------------------------------------------------------------------------

Table 5: SQLite workarounds to revert

**5.3 May Need Review**

  --------------------------------------------------------------------------------------------
  **File**                              **Why Review**                          **Priority**
  ------------------------------------- --------------------------------------- --------------
  mini-services/availability-service/   May have its own SQLite database        MEDIUM

  mini-services/freeradius-service/     May have its own SQLite database        MEDIUM

  src/lib/housekeeping-automation.ts    Uses Prisma queries, verify             LOW
                                        compatibility                           

  src/lib/housekeeping-workflows.ts     Uses Prisma transactions, verify        LOW
                                        compatibility                           
  --------------------------------------------------------------------------------------------

Table 6: Files to review for compatibility

**6. Pre-Flight Checklist**

Use this checklist before deploying PostgreSQL in production. Check off
each item:

**6.1 Infrastructure**

> ☐ PostgreSQL server provisioned and accessible
>
> ☐ Database created (e.g., CREATE DATABASE staysuite;)
>
> ☐ Database user created with appropriate permissions
>
> ☐ SSL/TLS configured for production connections
>
> ☐ Connection pooling configured (PgBouncer or built-in)
>
> ☐ Automated backups configured
>
> ☐ Connection string tested from application server

**6.2 Configuration**

> ☐ .DATABASE_URL updated in .env to postgresql://\...
>
> ☐ schema.prisma provider changed to postgresql
>
> ☐ prisma migrate dev tested in staging/development
>
> ☐ prisma generate run successfully
>
> ☐ Mini-services DATABASE_URL updated (if applicable)

**6.3 Code Changes**

> ☐ Department post-filter removed from /api/users/route.ts
>
> ☐ mode: \'insensitive\' added back to where clause
>
> ☐ JSON field types upgraded (permissions, attachments, etc.)
>
> ☐ All JSON.parse() / JSON.stringify() calls verified for Json type
>
> ☐ Raw SQL queries (if any) checked for SQLite-specific syntax
>
> ☐ Full-text search upgraded (contains → search)

**6.4 Data Migration**

> ☐ Production data exported from SQLite
>
> ☐ Data transformed for PostgreSQL compatibility
>
> ☐ Data imported into PostgreSQL
>
> ☐ Record counts verified between SQLite and PostgreSQL
>
> ☐ Seed data applied (prisma db seed)
>
> ☐ Foreign key integrity verified

**6.5 Testing**

> ☐ User authentication works (login/logout)
>
> ☐ Housekeeping tasks: create, assign, update, cancel
>
> ☐ Housekeeping staff filter returns correct results
>
> ☐ Room status transitions work correctly
>
> ☐ Kanban board loads and drag-drop works
>
> ☐ Maintenance requests CRUD works
>
> ☐ Asset management CRUD works
>
> ☐ Mini-services connectivity verified
>
> ☐ No console errors in browser
>
> ☐ No server-side errors in logs

**6.6 Performance**

> ☐ Query response times acceptable (\< 200ms for list APIs)
>
> ☐ No N+1 query issues (check Prisma logs)
>
> ☐ Connection pool not exhausted under load

**6.7 Rollback Plan**

> ☐ SQLite database backup preserved
>
> ☐ Previous .env configuration saved
>
> ☐ Rollback procedure documented and tested
>
> ☐ Downtime window communicated to stakeholders

**7. Rollback Procedure**

If issues arise after migration, follow these steps to roll back:

1.  Stop the application: stop the Node.js/Bun process

2.  Revert .env: change DATABASE_URL back to file:./db/custom.db

3.  Revert schema.prisma: change provider back to \"sqlite\"

4.  Run bunx prisma generate to regenerate the SQLite client

5.  Start the application again

6.  Verify the SQLite database is intact and application works

> **WARNING:** If you upgraded JSON fields from String to Json, the
> rollback will require reverting those schema changes as well. Keep a
> backup of the schema.prisma file before making any changes.

**8. Post-Migration Optimizations**

After the migration is stable, consider these optimizations that
PostgreSQL enables:

**8.1 Database Indexes**

Add indexes for frequently queried fields:

**8.2 Connection Pooling**

**8.3 Enum Types**

Convert string fields with known values to PostgreSQL enums for data
integrity:

> **TIP:** Add enums as a separate follow-up migration. Do not mix with
> the initial PostgreSQL migration.

--- End of Document ---
