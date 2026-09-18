# Ringers Platform — Master Technical Documentation
### Complete Architectural & Engineering Reference: Phases 1 to 8 (Production-Ready)
**Version:** 2.5.0 | **Date:** September 2026 | **Repository:** [https://github.com/gayatrii-ii/ringers-react](https://github.com/gayatrii-ii/ringers-react)  
**Current Branch:** `main` (Merged & Verified: Commit `386e021` via PR #9)  
**Core Team:** Karan Khot, Gayatri, Karansinh, Pradnya, Gauri

---

## 📑 Table of Contents

1. [Executive Summary & Platform Architecture](#1-executive-summary--platform-architecture)
2. [Technology Stack & Design Principles](#2-technology-stack--design-principles)
3. [Project Directory & Codebase Layout](#3-project-directory--codebase-layout)
4. [Phase-by-Phase Comprehensive Breakdown](#4-phase-by-phase-comprehensive-breakdown)
   - [Phase 1: Database Architecture & PostgreSQL Migrations (16 Migrations)](#phase-1-database-architecture--postgresql-migrations)
   - [Phase 2: Multi-Role Authentication, JWT Lifecycle & RBAC](#phase-2-multi-role-authentication-jwt-lifecycle--rbac)
   - [Phase 3A: Vendor Storefront Management & Hierarchical Catalog](#phase-3a-vendor-storefront-management--hierarchical-catalog)
   - [Phase 3B: Super Admin Governance, Key Engine & UPI Payments](#phase-3b-super-admin-governance-key-engine--upi-payments)
   - [Phase 4: Customer Profile, Address Book & Delivery Fleet Network](#phase-4-customer-profile-address-book--delivery-fleet-network)
   - [Phase 5: Cart Calculation Engine, Immutable Snapshots & Order State Machine](#phase-5-cart-calculation-engine-immutable-snapshots--order-state-machine)
   - [Phase 6: Payment Gateway, Razorpay Integration & Double-Entry Wallet](#phase-6-payment-gateway-razorpay-integration--double-entry-wallet)
   - [Phase 7: Multi-Language Notifications (i18n EN/HI/MR), Customer Reviews & Analytics](#phase-7-multi-language-notifications-i18n-enhimr-customer-reviews--analytics)
   - [Phase 8: Operational Flows, Customer Onboarding & Delivery Execution](#phase-8-operational-flows-customer-onboarding--delivery-execution)
     - [8.1 Customer Dual-Flow Onboarding (Flow A & Flow B)](#81-customer-dual-flow-onboarding)
     - [8.2 Customer-Specific Products & Custom Pricing Engine](#82-customer-specific-products--custom-pricing-engine)
     - [8.3 Vendor-Only Delivery Dispatch & Fleet Handover Lifecycle](#83-vendor-only-delivery-dispatch--fleet-handover-lifecycle)
     - [8.4 Connected Delivery Boy Job Application Pipeline](#84-connected-delivery-boy-job-application-pipeline)
     - [8.5 Vendor Referral Program & Rewards](#85-vendor-referral-program--rewards)
     - [8.6 Support & Issue Ticket System](#86-support--issue-ticket-system)
     - [8.7 Migration V17: Schema Extensions & Indexes](#87-migration-v17-schema-extensions--indexes)
5. [Complete Master API Reference (77+ Endpoints)](#5-complete-master-api-reference)
6. [Automated Test Verification Report (329 / 329 Tests)](#6-automated-test-verification-report)
7. [Git Branch & Merge History](#7-git-branch--merge-history)
8. [Next Step 1: Production Environment Credentials Setup Guide](#8-next-step-1-production-environment-credentials-setup-guide)
   - [Razorpay Live Payment Gateway Keys & Webhooks](#1-razorpay-live-payment-gateway-keys--webhooks)
   - [Firebase Cloud Messaging (FCM) Service Account](#2-firebase-cloud-messaging-fcm-service-account)
   - [Transactional Email Gateway (SendGrid / AWS SES / Gmail)](#3-transactional-email-gateway)
   - [SMS Gateway (Twilio / Fast2SMS)](#4-sms-gateway)
   - [Free Map Services Configuration](#5-free-map-services-configuration)
   - [Cloudinary Media Storage](#6-cloudinary-media-storage)
   - [PostgreSQL Production Database & JWT Secrets](#7-postgresql-production-database--jwt-secrets)
   - [Step-by-Step Guide to Updating `.env` & Dependent Backend Files](#8-step-by-step-guide-to-updating-env--dependent-backend-files)
9. [Next Step 2: Frontend Applications Implementation Plan](#9-next-step-2-frontend-applications-implementation-plan)
   - [Customer Mobile & Web Application](#app-1-customer-mobile--web-application)
   - [Vendor Storefront Management Portal](#app-2-vendor-storefront-management-portal)
   - [Delivery Partner Fleet Mobile Application](#app-3-delivery-partner-fleet-mobile-application)
   - [Super Admin Operations Control Center](#app-4-super-admin-operations-control-center)

---

## 1. Executive Summary & Platform Architecture

**Ringers** is an enterprise-grade, multi-role hyperlocal quick-commerce ecosystem engineered to connect **10+ local vendors**, **20+ active delivery riders**, **10,000+ customers**, and **Super Admin platform operators**.

### Core Architecture: Modular Monolith
Rather than introducing the operational overhead of microservices prematurely, Ringers is implemented as a **Modular Monolith** in **Node.js 20+** and **TypeScript 5.8 (Strict Mode)**. Every business capability (Auth, Vendor, Catalog, Customer, Delivery, Orders, Payments, Notifications, Reviews, Analytics) is partitioned into isolated modules sharing a single PostgreSQL connection pool. This design enables clean domain encapsulation, zero network serialization lag, single-transaction atomic integrity, and zero-downtime extraction into standalone microservices when traffic scales beyond 100,000+ daily orders.

### High-Scale Safeguards (10,000+ Users & Fleet Operations)
- **Zero Race Conditions:** Critical financial and inventory operations (Wallet Debits, Payouts, Review Aggregations, Private Key Usage) utilize PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) inside atomic transactions (`withTransaction`).
- **Idempotency Everywhere:** Payment initiation, Razorpay webhook ingest, and vendor delivery commissions verify unique reference IDs to prevent duplicate debits or double payouts.
- **Tamper-Proof Immutable Order Snapshots:** At checkout, product titles, variant names, unit prices, discounts, GST rates, and delivery coordinates are permanently frozen into `JSONB` column snapshots in the database. Future price changes or merchant catalog edits cannot alter placed orders.
- **Scale Performance Indexing:** Composite and partial B-Tree indexes on high-frequency query columns (`user_id`, `status`, `created_at`, `vendor_id`, `order_id`) ensure sub-millisecond query latency under high load.

---

## 2. Technology Stack & Design Principles

| Layer | Technology | Specification / Implementation |
|---|---|---|
| **Runtime** | Node.js | v20.18+ LTS |
| **Language** | TypeScript | v5.8.2 (Strict mode, ES Modules, `noImplicitAny: true`) |
| **Web Framework** | Express.js | v4.21.2 (JSON parser, Raw Body Webhook preservation, URI encoding) |
| **Database** | PostgreSQL | v16.x with `uuid-ossp`, `pgcrypto`, and JSONB support |
| **Database Access** | `pg` (node-postgres) | Direct parameterized SQL with custom typed `query<T>()` and `withTransaction()` wrapper |
| **Authentication** | JWT & BCrypt | 15-minute Access Tokens + 7-day DB-persisted Refresh Tokens (`bcryptjs` cost factor 12) |
| **Validation** | Zod | v3.24.2 (Strict, schema-first, type-inferred request validation) |
| **Database Migrations** | Flyway-compatible SQL | 17 versioned migrations (`V1__` to `V17__`) |
| **Security** | Helmet & CORS | HTTP security headers, CORS origin whitelist, parameter sanitization |
| **Payment Gateway** | Razorpay REST API | Zero-SDK native HTTPS client, timing-safe HMAC-SHA256 signature verification |
| **Localization (i18n)** | Custom i18n Engine | In-memory 3-language translation catalog (**English**, **Hindi**, **Marathi**) |
| **Real-time / Push** | Socket.IO (v4.8) & FCM | Real-time order lifecycle events, location beacons, FCM push alerts |
| **Testing** | `tsx` runner | 8 custom verification suites, 329 assertions covering 100% of business logic |

---

## 3. Project Directory & Codebase Layout

```
ringers-react/
├── apps/                                  ← Future Frontend workspaces
├── backend/                               ← Core Backend Modular Monolith
│   ├── dist/                              ← Compiled production JavaScript
│   ├── scripts/                           ← Automated phase test suites
│   │   ├── test-auth-flow.ts              ← Phase 2 verification (10 tests)
│   │   ├── test-vendor-catalog-flow.ts    ← Phase 3A verification (16 tests)
│   │   ├── test-admin-governance-flow.ts  ← Phase 3B verification (23 tests)
│   │   ├── test-customer-delivery-flow.ts ← Phase 4 verification (22 tests)
│   │   ├── test-order-flow.ts             ← Phase 5 verification (23 tests)
│   │   ├── test-payment-flow.ts           ← Phase 6 verification (46 tests)
│   │   ├── test-phase7-flow.ts            ← Phase 7 verification (111 tests)
│   │   └── test-phase8-flow.ts            ← Phase 8 verification (78 tests)
│   ├── src/
│   │   ├── app.ts                         ← Express app factory, raw body capture & middleware
│   │   ├── server.ts                      ← HTTP server & Socket.IO initialization
│   │   ├── config/                        ← Configurations (DB pool, env, Razorpay, etc.)
│   │   ├── constants/                     ← Platform-wide constants (Roles, Statuses)
│   │   ├── middlewares/                   ← Auth, Role RBAC, Validation, Global Error
│   │   ├── modules/                       ← Domain modules
│   │   │   ├── admin/                     ← Super Admin governance & key generation
│   │   │   ├── analytics/                 ← GMV, Leaderboards & fleet reporting
│   │   │   ├── auth/                      ← JWT auth, BCrypt, token rotation
│   │   │   ├── customer/                  ← Customer profiles & GPS address book
│   │   │   ├── delivery/                  ← Rider vehicle profiles, duty switch & tracking
│   │   │   ├── notifications/             ← i18n engine (EN/HI/MR), FCM tokens, broadcasts
│   │   │   ├── orders/                    ← Cart calculation, state machine, snapshots
│   │   │   ├── payment/                   ← Razorpay gateway, double-entry wallet ledger
│   │   │   ├── products/                  ← Hierarchical category & product catalog
│   │   │   ├── reviews/                   ← Customer ratings, review masking & statistics
│   │   │   ├── support/                   ← Customer & vendor support ticketing engine
│   │   │   └── vendors/                   ← Vendor storefronts, customer pricing, referrals, delivery onboarding
│   │   ├── routes/                        ← Express router mounts
│   │   │   ├── admin.routes.ts            ← /api/v1/admin/*
│   │   │   ├── analytics.routes.ts        ← /api/v1/analytics/*
│   │   │   ├── auth.routes.ts             ← /api/v1/auth/*
│   │   │   ├── category.routes.ts         ← /api/v1/categories/*
│   │   │   ├── customer.routes.ts         ← /api/v1/customers/*
│   │   │   ├── delivery.routes.ts         ← /api/v1/delivery/*
│   │   │   ├── index.ts                   ← Master router aggregator
│   │   │   ├── notification.routes.ts     ← /api/v1/notifications/*
│   │   │   ├── order.routes.ts            ← /api/v1/orders/*
│   │   │   ├── payment.routes.ts          ← /api/v1/payments/* & /api/v1/wallet/*
│   │   │   ├── product.routes.ts          ← /api/v1/products/*
│   │   │   ├── public.routes.ts           ← /api/v1/public/*
│   │   │   ├── review.routes.ts           ← /api/v1/reviews/*
│   │   │   ├── support.routes.ts          ← /api/v1/support/*
│   │   │   └── vendor.routes.ts           ← /api/v1/vendors/*
│   │   └── utils/                         ← Shared utilities (slug generator, etc.)
│   ├── .env                               ← Local development environment variables
│   ├── .env.example                       ← Documented environment template
│   ├── package.json                       ← Scripts (`build`, `dev`, `lint`, `test:all`)
│   └── tsconfig.json                      ← Strict TypeScript configuration
├── database/                              ← Database migrations
│   └── db/migration/                      ← 17 Flyway SQL migrations (V1 to V17)
└── docs/                                  ← Master documentation files
```

---

## 4. Phase-by-Phase Comprehensive Breakdown

---

### Phase 1: Database Architecture & PostgreSQL Migrations

**Status:** Completed & Merged  
**Goal:** Design an enterprise-grade schema partitioned into 9 logical PostgreSQL schemas to enforce clean domain separation and prepare for horizontal scalability.

#### The 9 PostgreSQL Schemas
1. `identity`: Users, roles, permissions, OTP sessions, refresh tokens, and private registration keys.
2. `vendor`: Vendor store profiles, storefront addresses, staff assignments, operating hours, registration requests, and UPI settings.
3. `catalog`: Category hierarchy trees, product details, product variants, and gallery images.
4. `customer`: Customer profiles, GPS address books, and order reviews.
5. `order_management`: Orders, line items, and audit timeline state history.
6. `delivery`: Rider profiles, vehicle registration, active assignments, GPS location snapshots, and job requests.
7. `payment`: Payment transactions, double-entry wallets, wallet transaction ledgers, and admin audit logs.
8. `notification`: In-app notification logs, push notification logs, and user device FCM tokens.
9. `audit`: Platform-wide administrative audit trail logs.

#### Complete Migration Inventory (V1 to V16)
| Migration File | Tables & Structures Created | Core Purpose |
|---|---|---|
| `V1__init_extensions_and_schemas.sql` | `uuid-ossp`, `pgcrypto`, 9 Schemas | Enables UUID generator and schema boundaries |
| `V2__create_identity_tables.sql` | `users`, `roles`, `user_roles`, `otp_codes`, `user_sessions` | Core identity and multi-role mapping tables |
| `V3__create_vendor_tables.sql` | `vendors`, `vendor_addresses`, `vendor_users`, `vendor_business_hours` | Vendor store profiles, staff, and operating hours |
| `V4__create_catalog_tables.sql` | `categories`, `products`, `product_variants`, `product_images` | Multi-tier catalog with variant pricing and images |
| `V5__create_customer_tables.sql` | `customer_profiles`, `addresses` | Customer personal profiles and multi-address book |
| `V6__create_order_tables.sql` | `orders`, `order_items`, `order_status_history` | Order storage with immutable price snapshots & state logs |
| `V7__create_delivery_tables.sql` | `delivery_partners`, `delivery_partner_locations`, `delivery_assignments` | Fleet management, live GPS tracking, order assignments |
| `V8__create_payment_tables.sql` | `payment_transactions` | Core transaction log for payment attempts |
| `V9__create_notification_tables.sql` | `notifications` | In-app notification log with read/unread tracking |
| `V10__create_audit_tables.sql` | `audit_logs` | Immutable governance audit trail with actor logging |
| `V11__create_performance_indexes.sql` | Composite B-Tree Indexes | Indexes on `city`, `status`, `vendor_id`, `created_at` |
| `V12__seed_roles_and_admin.sql` | Seeded Roles & Super Admin User | Inserts `SUPER_ADMIN`, `ADMIN`, `VENDOR`, `DELIVERY_BOY`, `CUSTOMER` |
| `V13__create_auth_supporting_tables.sql` | `refresh_tokens`, `private_registration_keys` | Secure token rotation and vendor private registration keys |
| `V14__create_vendor_payment_and_admin_requests.sql` | `vendor_registration_requests`, `delivery_boy_job_requests`, UPI columns | Public onboarding forms and merchant UPI configuration |
| `V15__extend_payment_tables.sql` | `wallets`, `wallet_transactions`, Razorpay columns | Double-entry wallet ledger and Razorpay metadata fields |
| `V16__create_notification_analytics_review_tables.sql` | `user_device_tokens`, `reviews`, Scale Analytics Indexes | FCM push device registry, 1-5★ order reviews, scale indexes |

---

### Phase 2: Multi-Role Authentication, JWT Lifecycle & RBAC

**Status:** Completed & Merged  
**Goal:** Implement a secure, multi-role authentication system allowing a single user account to hold multiple roles simultaneously (e.g., both a Vendor and a Customer) with strict RBAC guards.

#### Key Architectural Features
- **Simultaneous Multi-Role Support:** A user can place orders as a `CUSTOMER` while managing a shop as a `VENDOR`. The JWT payload contains an array of roles (`roles: ['VENDOR', 'CUSTOMER']`).
- **Cryptographic Hashing:** Passwords hashed using `bcryptjs` with salt rounds = 12.
- **Dual-Token Rotation:**
  - **Access Token:** Short-lived (15 minutes or 1 hour), signed with `JWT_SECRET`. Contains `userId`, `email`, and `roles`.
  - **Refresh Token:** Long-lived (7 days), signed with `JWT_REFRESH_SECRET`. Stored in `identity.refresh_tokens` as a SHA256 hash. When refreshed, the old token is invalidated and a fresh pair is issued.
- **Vendor Registration Private Key Guard:** Vendor registration cannot be performed publicly. It requires a valid, unexpired, single-use Private Registration Key generated by the Super Admin.

---

### Phase 3A: Vendor Storefront Management & Hierarchical Catalog

**Status:** Completed & Merged  
**Goal:** Build complete vendor storefront operations and a multi-level product catalog with variant pricing and image galleries.

#### Key Architectural Features
- **Public Marketplace Discovery:** `GET /api/v1/vendors` supports text search, city filtering, and pagination.
- **Store Profile & Operating Hours:** Vendors manage store descriptions, support phone, opening/closing hours per day of the week, and holiday closures.
- **Store Staff Delegation:** Shop owners can assign platform users to roles inside their store: `MANAGER`, `STAFF`, or `CHEF`.
- **Hierarchical Category Tree:** Categories support recursive nesting (`parent_id`) with automatic slug generation (`/dairy/milk-cheese/butter`).
- **Product Variant Matrix:** Products can have multiple variants (e.g., 500ml, 1L; Small, Large; 1kg pack) with distinct regular prices, discount prices, and inventory availability (`AVAILABLE`, `OUT_OF_STOCK`).
- **Vendor Scoping Protection:** Security middleware ensures a vendor can never update or delete products belonging to another merchant.

---

### Phase 3B: Super Admin Governance, Key Engine & UPI Payments

**Status:** Completed & Merged  
**Goal:** Equip Super Admins with onboarding governance, private key generation, delivery partner job assignments, and merchant UPI payment configurations.

#### Key Architectural Features
- **Private Registration Key Engine:** Generates single-use keys (`RNG-VND-XXXXXX`) with custom validity (1 to 365 days). Marked `USED` atomically via `SELECT ... FOR UPDATE`.
- **Public Application Portals:** Public forms allow prospective vendors and delivery riders to submit onboarding requests without authentication (`/api/v1/public/*`).
- **Administrative Review Workflow:** Super Admin reviews requests. Approving a vendor request automatically generates and links a private registration key; rejecting records audit notes.
- **Vendor UPI Direct Payment:** Vendors can configure their UPI ID (`store@upi`), Cloudinary QR code URL, and app deep-link (`upi://pay?pa=...`) for instant UPI transactions.

---

### Phase 4: Customer Profile, Address Book & Delivery Fleet Network

**Status:** Completed & Merged  
**Goal:** Complete customer account lifecycle, validated GPS delivery addresses, delivery partner onboarding, vehicle profiles, and active duty status tracking.

#### Key Architectural Features
- **Customer Personal Profile:** Management of full name, avatar image URL, gender, and date of birth (with future-date rejection).
- **GPS Address Book with PIN Validation:** Customers save multiple delivery addresses (`HOME`, `WORK`, `OTHER`). Enforces 6-digit Indian PIN format (`/^[1-9][0-9]{5}$/`) and valid GPS coordinate ranges (Latitude: -90° to +90°, Longitude: -180° to +180°).
- **Default Address Auto-Promotion:** When a primary default address is deleted, the database automatically promotes the customer's next saved address to default.
- **Delivery Partner Vehicle Profiles:** Registration of vehicle type (`BIKE`, `SCOOTER`, `CYCLE`, `ELECTRIC_VEHICLE`), registration number, and driving license.
- **Duty Status Toggles:** Riders switch duty status between `ONLINE` (ready for order dispatch), `OFFLINE` (off-duty), and `BUSY` (delivering order).
- **GPS Location Ping Ingest:** High-frequency coordinate updates recorded in `delivery.delivery_partner_locations` for live customer order tracking.

---

### Phase 5: Cart Calculation Engine, Immutable Snapshots & Order State Machine

**Status:** Completed & Merged  
**Goal:** Construct an immutable order engine, dynamic Haversine distance-based delivery fee calculations, GST tax computation, and an enforced order status lifecycle.

#### Key Architectural Features
- **Haversine GPS Distance Calculation:** Calculates exact geodesic distance between store and delivery coordinates:
  $$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$
  - Delivery radius capped at a safe 25 km limit.
  - Delivery Fee: Base ₹30.00 for the first 2 km + ₹10.00 per additional km.
- **Collision-Proof Order Numbers:** Human-readable order numbers formatted as `RNG-ORD-YYYYMMDD-XXXXXX` using crypto-random hexadecimal suffixes.
- **Immutable JSONB Snapshots:** At order creation, product names, variant snapshot strings, unit prices, discounts, tax amounts, and customer addresses are frozen into the order record.
- **Order Lifecycle State Machine:**
  $$\text{PENDING} \longrightarrow \text{CONFIRMED} \longrightarrow \text{PREPARING} \longrightarrow \text{READY} \longrightarrow \text{OUT\_FOR\_DELIVERY} \longrightarrow \text{DELIVERED}$$
  - Direct transitions to `CANCELLED` are permitted from early states with mandatory cancellation reasons.
  - Every status change writes an audit record to `order_management.order_status_history`.

---

### Phase 6: Payment Gateway, Razorpay Integration & Double-Entry Wallet

**Status:** Completed & Merged  
**Goal:** Implement bank-grade payment processing with Razorpay, webhook verification, a double-entry customer/vendor wallet ledger, and automated vendor payouts.

#### Key Architectural Features
- **Zero External SDK Dependency:** Direct native HTTPS client interacting with Razorpay API endpoints with 15-second socket timeouts and Basic Auth.
- **Timing-Safe HMAC Signature Verification:** Verifies payment callback signatures (`order_id|payment_id`) using `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
- **Server Webhooks with Raw Body Capture:** Captures `req.rawBody` before JSON parsing to cryptographically verify Razorpay webhooks (`payment.captured`, `payment.failed`, `refund.processed`).
- **Double-Entry Wallet Ledger (`payment.wallets` & `payment.wallet_transactions`):**
  - Balance updates enforce `CHECK (balance >= 0)`.
  - All debit and credit operations lock the wallet row via `SELECT ... FOR UPDATE` inside a database transaction.
  - Every modification logs a ledger row with `balance_before`, `amount`, and `balance_after`.
- **Automated Vendor Payouts:** When an order reaches `DELIVERED` status, a background hook calculates a 90% payout to the vendor's wallet (10% platform commission) with idempotency checks to prevent duplicate payouts.
- **Admin Gateway Refunds:** Admin can initiate full or partial refunds calling Razorpay's refund API, updating the order payment status, and crediting the customer wallet.

---

### Phase 7: Multi-Language Notifications (i18n EN/HI/MR), Customer Reviews & Analytics

**Status:** Completed & Merged  
**Goal:** Deliver a 3-language localized push/in-app notification engine, verified customer review system, and comprehensive analytics dashboards for Admins and Vendors.

#### Key Architectural Features
- **Multi-Language Localization Engine (i18n):**
  - Native support for **English (`EN`)**, **Hindi (`HI` - हिन्दी)**, and **Marathi (`MR` - मराठी)**.
  - Pre-translated templates for 11 platform events: `ORDER_PLACED`, `ORDER_CONFIRMED`, `ORDER_PREPARING`, `ORDER_READY`, `ORDER_OUT_FOR_DELIVERY`, `ORDER_DELIVERED`, `ORDER_CANCELLED`, `WALLET_CREDIT`, `WALLET_DEBIT`, `NEW_ORDER_VENDOR`, `RIDER_ASSIGNED`.
  - Automatic template parameter interpolation (`{orderNumber}`, `{vendorName}`, `{amount}`, `{riderName}`, etc.).
- **Push Notification Registry (FCM):**
  - `notification.user_device_tokens` stores device tokens for `ANDROID`, `IOS`, and `WEB`.
  - In-app notification feed with unread count badge counter and bulk "Mark All as Read" capabilities.
- **Automated Order Notification Triggers:** Hooked into `OrderService` so every placement and status progression automatically dispatches localized notifications asynchronously.
- **Verified Order Reviews & Reputation:**
  - Customers can only review orders that have status = `DELIVERED`.
  - Unique constraint `uq_order_review UNIQUE (order_id)` prevents duplicate reviews for the same order.
  - Separate 1-to-5 star ratings for the vendor and the delivery driver.
  - Atomic database transactions recalculate the merchant's aggregate `rating` and `total_reviews` count.
  - Public review feed masks customer names for privacy (`K*** S.`) and outputs star rating distribution (`1★`, `2★`, `3★`, `4★`, `5★`).
- **Comprehensive Analytics Dashboards:**
  - **Super Admin Overview:** Real-time GMV, net platform revenue, active user counts, and wallet liquidity.
  - **Vendor Leaderboard:** Top merchants ranked by completed revenue and order count.
  - **Fleet Performance:** Average delivery turnaround times, completion percentages, and top rider rankings.
  - **Vendor Store Overview:** Merchant sales, net payout, top 5 selling items by volume and revenue, and store ratings.
  - **Parameterized Date Filtering:** Instant metrics for `today`, `week`, `month`, `year`, or `custom` date ranges.


---

### Phase 8: Operational Flows, Customer Onboarding & Delivery Execution

**Status:** Completed, Audited & Merged  
**Goal:** Implement all remaining operational workflows required for end-to-end production operations connecting 10+ vendors, 20+ delivery partners, and 10,000+ customers: customer-specific custom pricing, dual-flow customer onboarding, vendor-only delivery dispatch, dual delivery completion (OTP & customer confirmation), delivery partner job pipeline, vendor referral program, support ticketing, and Socket.IO real-time tracking.

#### 8.1 Customer Dual-Flow Onboarding
The platform supports two distinct customer onboarding channels tailored for local neighborhood commerce:
1. **Flow A (Vendor-Initiated Onboarding):**
   - **Step 1:** Merchant registers regular customer details (first name, last name, phone, email, photo URL, delivery address, notes) via `POST /api/v1/vendors/customers/register`.
   - **Step 2:** System creates `customer.registration_requests` record with `initiated_by = 'VENDOR'` and status `PENDING`.
   - **Step 3:** System generates and dispatches a 4-digit SMS OTP to customer's mobile number.
   - **Step 4:** Merchant verifies OTP via `POST /api/v1/vendors/customers/:requestId/verify-otp`. Request transitions to `OTP_VERIFIED`.
   - **Step 5:** Merchant configures customer-specific product availability & custom pricing, sets initial password, and activates account via `POST /api/v1/vendors/customers/:requestId/activate`.
   - **Step 6 (Atomic Activation):** With transaction lock (`FOR UPDATE`), system creates `identity.users` with role `CUSTOMER`, creates `customer.customer_profiles`, default delivery address in `customer.addresses`, initializes wallet with ₹0.00 in `payment.wallets`, associates custom product pricing in `vendor.customer_products`, and marks request `ACTIVATED`.

2. **Flow B (Customer-Direct Public Registration Request):**
   - **Step 1:** Prospective customer selects a vendor and submits registration request via public endpoint `POST /api/v1/customers/registration-requests`.
   - **Step 2:** System checks phone is not already registered, creates request record (`initiated_by = 'CUSTOMER'`, `status = 'PENDING'`), and notifies vendor store owner.
   - **Step 3:** Merchant reviews pending requests on store dashboard via `GET /api/v1/vendors/customers/registration-requests`.
   - **Step 4:** Merchant activates the account and provides credentials via `POST /api/v1/vendors/customers/:requestId/activate` or rejects with reason via `PATCH /api/v1/vendors/customers/registration-requests/:requestId/reject`.

#### 8.2 Customer-Specific Products & Custom Pricing Engine
- **Per-Customer Pricing (`vendor.customer_products`):** Vendors can enable/disable individual catalog products for specific customers and configure customized unit prices (e.g. ₹42.00/L for Customer A vs ₹46.00/L catalog rate).
- **Cart & Checkout Calculation Integration:** Modified `OrderService.calculateOrder` to fetch customer product configuration. When calculating line items:
  - If custom price is configured: `effectiveUnitPrice = custProductConfig.customPrice`.
  - Discount is computed automatically if regular price > custom price.
- **Vendor Catalog Restriction Mode (`restrict_customer_catalog`):**
  - Configurable boolean toggle on `vendor.vendors` (`PATCH /api/v1/vendors/:vendorId/catalog-restriction`).
  - When enabled, customers can **only** browse and order products that have been explicitly enabled for their account by the merchant. Any attempt to order unassigned products returns `403 PRODUCT_NOT_PERMITTED`.

#### 8.3 Vendor-Only Delivery Dispatch & Fleet Handover Lifecycle
- **Strict Vendor-Only Assignment Authority:**
  - `POST /api/v1/orders/:id/assign-delivery` enforces that **only** the merchant owning the order can assign delivery riders. Super Admin and third parties are blocked with `403 VENDOR_ONLY_ACTION`.
  - Verifies rider exists, has `DELIVERY_BOY` role, and is currently `ONLINE`.
  - Atomically transitions order `delivery_status = 'ASSIGNED'`, creates `delivery.delivery_assignments` in `ASSIGNED` status, and emits real-time `assignment:created` event.
- **Rider Assignment Acceptance & Decline:**
  - `POST /api/v1/delivery/assignments/:id/accept`: Rider accepts. Assignment & order `delivery_status` transition to `ACCEPTED`. Rider status switches to `BUSY`. Real-time `assignment:accepted` emitted.
  - `POST /api/v1/delivery/assignments/:id/reject`: Rider declines with mandatory reason. Assignment marked `REJECTED`, order `delivery_status` resets to `UNASSIGNED`, rider remains `ONLINE`. Merchant is immediately alerted via WebSocket and push notification to reassign.
- **Order Pickup Handover:**
  - `POST /api/v1/delivery/assignments/:id/pickup`: Rider marks package collected at store. Assignment transitions to `PICKED_UP`, order transitions to `OUT_FOR_DELIVERY`. Automatically triggers 4-digit `DELIVERY_CONFIRMATION` OTP to customer phone and emits `order:out_for_delivery`.
- **Dual Delivery Completion Channels:**
  - **Path A (Rider submits customer OTP):** `POST /api/v1/delivery/orders/:id/complete-delivery`. Verifies 4-digit OTP. Atomically marks assignment & order `DELIVERED`, resets rider duty to `ONLINE`, and triggers automated 90% vendor payout.
  - **Path B (Customer direct app confirmation):** `POST /api/v1/orders/:id/confirm-delivery`. Customer directly clicks "Confirm Delivery Received" in mobile app. Atomically completes order, resets rider to `ONLINE`, and triggers vendor payout.
- **Delivery Failure Reporting:**
  - `POST /api/v1/delivery/assignments/:id/fail`: Rider reports delivery failure with standardized codes: `CUSTOMER_UNAVAILABLE`, `WRONG_ADDRESS`, `CUSTOMER_REFUSED`, `CANNOT_CONTACT_CUSTOMER`, `OTHER`.
  - Assignment set to `CANCELLED`, order set to `CANCELLED` with `delivery_status = 'FAILED'`, rider reset to `ONLINE`, and merchant notified.
- **Live GPS Tracking & Location Beacons:**
  - `POST /api/v1/delivery/location`: Rider sends GPS coordinates (latitude, longitude, accuracy). Saved to append-only `delivery.delivery_locations` table and emitted via WebSocket `location:update` to tracking customer.
  - `GET /api/v1/delivery/track/:id`: Unified tracking endpoint returning order status, delivery partner info, vehicle type, and latest GPS coordinate.

#### 8.4 Connected Delivery Boy Job Application Pipeline
- **Public Submission:** Prospective riders apply via `POST /api/v1/public/delivery-job-request` (name, phone, vehicle type: `BIKE`, `SCOOTER`, `CYCLE`, `ELECTRIC_VEHICLE`, license number).
- **Admin Fleet Connection:** Super Admin reviews applicants via `GET /api/v1/admin/delivery-boy-requests` and connects rider to a merchant fleet (`status = 'CONNECTED'`).
- **Vendor Storefront Activation:** Connected merchants view requests via `GET /api/v1/vendors/delivery-boys/job-requests`, provision login credentials, and activate account via `POST /api/v1/vendors/delivery-boys/activate`.

#### 8.5 Vendor Referral Program & Rewards
- **Referral Code Engine:** Vendors obtain a unique referral code (`REF-XXXX-XXXX`) and shareable invite link (`GET /api/v1/vendors/referral`).
- **Invitations:** Merchants invite prospective merchants via phone or email (`POST /api/v1/vendors/referrals/invite`).
- **Reward Lifecycle:** `PENDING` → `APPROVED` → `PAID` / `CANCELLED`.
- **Governance:** Super Admin monitors platform referrals (`GET /api/v1/admin/referrals`) and approves reward amounts (`PATCH /api/v1/admin/referrals/:id/reward`).

#### 8.6 Support & Issue Ticket System
- **Ticket Creation:** Authenticated customers, vendors, and riders submit support tickets via `POST /api/v1/support/tickets` (categories: `ORDER_ISSUE`, `PAYMENT_ISSUE`, `DELIVERY_ISSUE`, `GENERAL`; priorities: `LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **Collision-Proof Ticket Numbers:** Automatically generated as `RNG-TCK-YYYYMMDD-XXXX`.
- **User Dashboard:** Users view ticket history via `GET /api/v1/support/tickets/my`.
- **Admin Resolution Workflow:** Super Admin triages tickets via `GET /api/v1/support/admin/tickets` and resolves with recorded response via `PATCH /api/v1/support/admin/tickets/:id/resolve`.

#### 8.7 Migration V17: Schema Extensions & Indexes
- **Migration:** `V17__create_phase8_operational_tables.sql`
- **Tables Created / Extended:**
  1. `support.tickets`: Customer and vendor support tickets with status and priority constraints.
  2. `vendor.customer_products`: Per-customer product enablement and custom price overrides with unique constraint `uq_vendor_customer_product (vendor_id, customer_user_id, product_id)`.
  3. `customer.registration_requests`: Dual-flow registration tracking with `initiated_by IN ('VENDOR', 'CUSTOMER')`.
  4. `vendor.referrals`: Referral program tracking with referee contact, status, and reward tracking.
  5. `vendor.vendors`: Extended with `restrict_customer_catalog BOOLEAN DEFAULT FALSE` and `referral_code VARCHAR(50) UNIQUE`.
  6. `delivery.delivery_boy_job_requests`: Extended with `status IN ('PENDING', 'CONNECTED', 'ACTIVATED', 'REJECTED')` and `activated_user_id`.
  7. `delivery.delivery_assignments`: Extended with `rejection_reason`, `failure_reason`, `failure_notes`, `rejected_at`, `failed_at`.
  8. `order_management.orders`: Extended `delivery_status` check constraint to include `ACCEPTED`.

---

## 5. Complete Master API Reference

**Base URL:** `http://localhost:5000/api/v1`  
**Authentication:** Bearer Token via Header: `Authorization: Bearer <access_token>`

### 1. Authentication Module (`/api/v1/auth`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register standard Customer account |
| `POST` | `/auth/register/vendor` | Public (Requires Key) | Register Vendor account using Super Admin Private Key |
| `POST` | `/auth/login` | Public | Authenticate user; returns JWT Access Token + Refresh Token |
| `POST` | `/auth/refresh` | Public | Rotate Refresh Token and receive new Access Token |
| `POST` | `/auth/logout` | Authenticated | Invalidate active refresh token session |
| `GET` | `/auth/me` | Authenticated | Get current authenticated user details and active roles |

### 2. Vendor Management (`/api/v1/vendors`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `GET` | `/vendors` | Public | Public marketplace store directory (search, city filter, page) |
| `GET` | `/vendors/:id` | Public | Get public storefront details and operating hours |
| `GET` | `/vendors/profile/me` | `VENDOR` | Retrieve logged-in vendor's own store profile |
| `PUT` | `/vendors/profile/me` | `VENDOR` | Update store name, description, phone, and hours |
| `GET` | `/vendors/profile/me/addresses` | `VENDOR` | List all storefront branch addresses |
| `POST` | `/vendors/profile/me/addresses` | `VENDOR` | Add new storefront branch address with GPS coordinates |
| `PUT` | `/vendors/profile/me/addresses/:id` | `VENDOR` | Update storefront address |
| `DELETE`| `/vendors/profile/me/addresses/:id` | `VENDOR` | Remove storefront address |
| `GET` | `/vendors/profile/me/staff` | `VENDOR` | List assigned staff members for the store |
| `POST` | `/vendors/profile/me/staff` | `VENDOR` | Assign platform user to store as `MANAGER`, `STAFF`, or `CHEF` |
| `DELETE`| `/vendors/profile/me/staff/:userId` | `VENDOR` | Remove staff member from store |
| `GET` | `/vendors/profile/me/payment-settings`| `VENDOR` | View store UPI ID, QR code URL, and deep-link |
| `PUT` | `/vendors/profile/me/payment-settings`| `VENDOR` | Update store UPI payment details |
| `PATCH`| `/vendors/:id/status` | `SUPER_ADMIN` | Approve, activate, or block vendor account |
| `PUT` | `/vendors/:id` | `SUPER_ADMIN` | Administrative override of vendor profile |
| `POST` | `/vendors/customers/register` | `VENDOR` | Flow A: Vendor initiates customer registration & triggers OTP |
| `POST` | `/vendors/customers/:requestId/verify-otp` | `VENDOR` | Flow A: Vendor verifies customer SMS OTP |
| `POST` | `/vendors/customers/:requestId/activate` | `VENDOR` | Flow A/B: Vendor activates customer account with password & pricing |
| `GET` | `/vendors/customers/registration-requests` | `VENDOR` | Vendor lists incoming customer registration requests |
| `PATCH`| `/vendors/customers/registration-requests/:requestId/reject` | `VENDOR` | Vendor rejects customer registration request with reason |
| `GET` | `/vendors/:vendorId/customers/:customerId/products` | `VENDOR` | View customer-specific product availability & custom pricing |
| `PUT` | `/vendors/:vendorId/customers/:customerId/products` | `VENDOR` | Batch configure customer products & custom unit pricing |
| `PATCH`| `/vendors/:vendorId/catalog-restriction` | `VENDOR` | Toggle customer catalog restriction setting ON/OFF |
| `GET` | `/vendors/delivery-boys/job-requests` | `VENDOR` | View delivery boy applications connected to vendor fleet |
| `POST` | `/vendors/delivery-boys/activate` | `VENDOR` | Activate connected delivery boy account with login credentials |
| `GET` | `/vendors/referral` | `VENDOR` | Get vendor referral dashboard profile, metrics, and invite code |
| `POST` | `/vendors/referrals/invite` | `VENDOR` | Invite prospective merchant via phone or email |
| `GET` | `/vendors/referrals` | `VENDOR` | List all referrals dispatched by vendor |

### 3. Categories & Catalog (`/api/v1/categories`, `/api/v1/products`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `GET` | `/categories` | Public | Get complete hierarchical category tree |
| `POST` | `/categories` | `SUPER_ADMIN` | Create root category or nested subcategory |
| `PUT` | `/categories/:id` | `SUPER_ADMIN` | Update category name, slug, or parent |
| `DELETE`| `/categories/:id` | `SUPER_ADMIN` | Delete category |
| `GET` | `/products` | Public | Search catalog with vendor, category, and price filters |
| `GET` | `/products/:id` | Public | Get detailed product profile with variants and images |
| `POST` | `/products` | `VENDOR` | Create new product in vendor's own store |
| `PUT` | `/products/:id` | `VENDOR` | Update product details, price, discount, or tax rate |
| `DELETE`| `/products/:id` | `VENDOR` | Soft-delete product from store catalog |
| `POST` | `/products/:id/variants` | `VENDOR` | Add variant option (size, weight, pack) with custom price |
| `POST` | `/products/:id/images` | `VENDOR` | Add product image to gallery with primary display flag |

### 4. Super Admin Governance & Public Requests (`/api/v1/admin`, `/api/v1/public`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `GET` | `/admin/metrics` | `SUPER_ADMIN` | High-level operational platform metrics dashboard |
| `POST` | `/admin/keys/generate` | `SUPER_ADMIN` | Generate single-use alphanumeric Vendor Registration Key |
| `GET` | `/admin/keys` | `SUPER_ADMIN` | List all registration keys (filter: `AVAILABLE`, `USED`, `REVOKED`) |
| `PATCH`| `/admin/keys/:id/revoke` | `SUPER_ADMIN` | Revoke unused vendor registration key |
| `GET` | `/admin/vendor-requests` | `SUPER_ADMIN` | List public vendor registration applications |
| `PATCH`| `/admin/vendor-requests/:id/review` | `SUPER_ADMIN` | Approve (auto-issues key) or reject application |
| `GET` | `/admin/delivery-boy-requests` | `SUPER_ADMIN` | List public delivery partner job applications |
| `PATCH`| `/admin/delivery-boy-requests/:id/assign` | `SUPER_ADMIN` | Approve rider and link to vendor's delivery fleet |
| `GET` | `/admin/referrals` | `SUPER_ADMIN` | List all merchant referrals across platform |
| `PATCH`| `/admin/referrals/:id/reward` | `SUPER_ADMIN` | Approve, pay, or cancel referral reward amount |
| `POST` | `/public/vendor-request` | Public | Open form for merchants to apply for onboarding |
| `POST` | `/public/delivery-job-request` | Public | Open form for delivery riders to apply for jobs |

### 5. Customer Profile & Address Book (`/api/v1/customers`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `POST` | `/customers/registration-requests` | Public | Flow B: Customer submits direct registration request to vendor |
| `GET` | `/customers/profile/me` | `CUSTOMER` | View customer profile (name, email, phone, DOB, gender) |
| `PUT` | `/customers/profile/me` | `CUSTOMER` | Update personal details and profile picture |
| `GET` | `/customers/addresses` | `CUSTOMER` | List saved delivery addresses (default address first) |
| `POST` | `/customers/addresses` | `CUSTOMER` | Add new delivery address with GPS coordinates and Indian PIN |
| `GET` | `/customers/addresses/:id` | `CUSTOMER` | View single saved address |
| `PUT` | `/customers/addresses/:id` | `CUSTOMER` | Update delivery address details |
| `DELETE`| `/customers/addresses/:id` | `CUSTOMER` | Soft-delete address (auto-promotes next address if default) |
| `PATCH`| `/customers/addresses/:id/default`| `CUSTOMER` | Designate address as primary delivery destination |

### 6. Delivery Fleet Management (`/api/v1/delivery`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `GET` | `/delivery/profile/me` | `DELIVERY_BOY` | View rider vehicle profile, license, and duty status |
| `PUT` | `/delivery/profile/me` | `DELIVERY_BOY` | Update vehicle type, license number, and registration |
| `PATCH`| `/delivery/duty-status` | `DELIVERY_BOY` | Toggle duty between `ONLINE`, `OFFLINE`, and `BUSY` |
| `GET` | `/delivery/stats` | `DELIVERY_BOY` | View delivery count, active assignment, and metrics |
| `POST` | `/delivery/assignments/:id/accept` | `DELIVERY_BOY` | Rider accepts delivery assignment (duty switches to BUSY) |
| `POST` | `/delivery/assignments/:id/reject` | `DELIVERY_BOY` | Rider rejects assignment with reason (order returned to vendor) |
| `POST` | `/delivery/assignments/:id/pickup` | `DELIVERY_BOY` | Rider marks picked up (triggers delivery confirmation OTP to customer) |
| `POST` | `/delivery/orders/:id/complete-delivery` | `DELIVERY_BOY` | Path A: Rider enters customer OTP to complete delivery & trigger payout |
| `POST` | `/delivery/assignments/:id/fail` | `DELIVERY_BOY` | Rider reports delivery failure with standardized reason codes |
| `POST` | `/delivery/location` | `DELIVERY_BOY` | Ingest live GPS coordinates (latitude, longitude, heading) |
| `GET` | `/delivery/track/:id` | Authenticated | Real-time order tracking with driver info and latest GPS beacon |
| `GET` | `/delivery/admin/riders` | `SUPER_ADMIN` | List all platform delivery partners with status filters |
| `PATCH`| `/delivery/admin/riders/:id/status` | `SUPER_ADMIN` | Administrative rider suspension or status override |

### 7. Cart & Order Management (`/api/v1/orders`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `POST` | `/orders/calculate` | `CUSTOMER` | Validates cart, calculates GST taxes, and computes GPS distance fee |
| `POST` | `/orders` | `CUSTOMER` | Places order with immutable JSON price & address snapshots |
| `GET` | `/orders/my-orders` | `CUSTOMER` | Paginated customer past and active order history |
| `GET` | `/orders/vendor/live` | `VENDOR` | Live merchant order desk (`PENDING`, `PREPARING`, `READY`) |
| `GET` | `/orders/admin/all` | `SUPER_ADMIN` | Global platform-wide order monitor with filters |
| `GET` | `/orders/:id` | Authenticated | Scoped receipt view with timeline audit history |
| `PATCH`| `/orders/:id/status` | Multi-Role | State machine transition (`CONFIRMED`, `PREPARING`, `READY`, etc.) |
| `PATCH`| `/orders/:id/cancel` | Authenticated | Customer or Vendor order cancellation with reason |
| `POST` | `/orders/:id/assign-delivery` | `VENDOR` | Vendor assigns delivery rider to order (Vendor-only authority) |
| `POST` | `/orders/:id/confirm-delivery` | `CUSTOMER` | Path B: Customer directly confirms delivery received in app |

### 8. Payment Gateway & Wallet (`/api/v1/payments`, `/api/v1/wallet`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `POST` | `/payments/initiate` | `CUSTOMER` | Idempotently creates Razorpay payment order for a placed order |
| `POST` | `/payments/verify` | `CUSTOMER` | Verifies Razorpay HMAC-SHA256 signature and marks order `PAID` |
| `POST` | `/payments/webhook` | Public (HMAC) | Razorpay server-to-server webhook callback listener |
| `GET` | `/payments/order/:orderId` | `CUSTOMER` / `ADMIN` | Get payment transaction history for a specific order |
| `POST` | `/payments/refund` | `SUPER_ADMIN` | Triggers Razorpay refund and credits customer wallet |
| `GET` | `/wallet/balance` | `CUSTOMER` / `VENDOR` | Get wallet balance (lazy initialization on first access) |
| `POST` | `/wallet/topup` | `CUSTOMER` | Initiates Razorpay payment order to top up wallet balance |
| `POST` | `/wallet/topup/verify` | `CUSTOMER` | Verifies top-up signature and credits wallet balance atomically |
| `POST` | `/wallet/pay` | `CUSTOMER` | Debits wallet balance to pay for order with row lock |
| `GET` | `/wallet/transactions` | `CUSTOMER` / `VENDOR` | Paginated wallet transaction ledger (`CREDIT`/`DEBIT` filter) |

### 9. Notifications Module (`/api/v1/notifications`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `GET` | `/notifications` | Authenticated | Paginated in-app notification feed with unread filter |
| `GET` | `/notifications/unread-count` | Authenticated | Quick badge count for app header & navigation bar |
| `PATCH`| `/notifications/:id/read` | Authenticated | Mark a single notification as read |
| `PATCH`| `/notifications/read-all` | Authenticated | Mark all user notifications as read in bulk |
| `POST` | `/notifications/device-token` | Authenticated | Register/update FCM token (`ANDROID`, `IOS`, `WEB`) |
| `POST` | `/notifications/admin/broadcast` | `SUPER_ADMIN` | Broadcast announcement to target user role group |

### 10. Customer Reviews & Ratings (`/api/v1/reviews`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `POST` | `/reviews` | `CUSTOMER` | Submit 1-5★ rating and reviews for a `DELIVERED` order |
| `GET` | `/reviews/vendor/:vendorId` | Public | Paginated vendor reviews with star breakdown & masked customer names |
| `GET` | `/reviews/my-reviews` | `CUSTOMER` | List of all reviews submitted by the authenticated customer |

### 11. Analytics & Reporting (`/api/v1/analytics`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `GET` | `/analytics/admin/overview` | `SUPER_ADMIN` | Platform GMV, commission, refunds, net revenue, active users |
| `GET` | `/analytics/admin/vendors-leaderboard`| `SUPER_ADMIN` | Top vendors ranked by sales revenue and orders |
| `GET` | `/analytics/admin/delivery-performance`| `SUPER_ADMIN` | Fleet completion rates, average delivery minutes, top riders |
| `GET` | `/analytics/vendor/overview` | `VENDOR` | Store GMV, net payout (90%), top 5 selling items, store rating |


### 12. Support & Issue Tickets Module (`/api/v1/support`)
| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `POST` | `/support/tickets` | Authenticated | Submit new support ticket with category and priority |
| `GET` | `/support/tickets/my` | Authenticated | View authenticated user's submitted support tickets |
| `GET` | `/support/tickets/:id` | Authenticated | View single ticket details and resolution audit history |
| `GET` | `/support/admin/tickets` | `SUPER_ADMIN` / `ADMIN` | List all platform tickets with priority sorting |
| `PATCH`| `/support/admin/tickets/:id/resolve` | `SUPER_ADMIN` / `ADMIN` | Resolve or close support ticket with recorded admin response |

---

## 6. Automated Test Verification Report

Every phase includes an automated end-to-end integration test suite located in `backend/scripts/`. All tests can be executed concurrently or via the unified `npm run test:all` script on `main`.

### Unified Test Results Table
| Phase | Domain / Feature | Test Script | Passing Tests | Status |
|:---:|---|---|:---:|:---:|
| **Phase 1 & 2** | Multi-Role Authentication, BCrypt & JWT Token Rotation | `test-auth-flow.ts` | **10 / 10** | ✅ PASS |
| **Phase 3A** | Vendor Storefronts, Hierarchical Catalog & Variants | `test-vendor-catalog-flow.ts` | **16 / 16** | ✅ PASS |
| **Phase 3B** | Super Admin Governance, Key Engine & UPI Settings | `test-admin-governance-flow.ts` | **23 / 23** | ✅ PASS |
| **Phase 4** | Customer Profile, GPS Address Book & Delivery Fleet | `test-customer-delivery-flow.ts` | **22 / 22** | ✅ PASS |
| **Phase 5** | Cart Engine, Snapshots & Order State Machine | `test-order-flow.ts` | **23 / 23** | ✅ PASS |
| **Phase 6** | Payment Gateway, Razorpay & Double-Entry Wallet | `test-payment-flow.ts` | **46 / 46** | ✅ PASS |
| **Phase 7** | Notifications (i18n EN/HI/MR), Reviews & Analytics | `test-phase7-flow.ts` | **111 / 111** | ✅ PASS |
| **Phase 8** | Customer Onboarding, Custom Pricing, Handover, Support | `test-phase8-flow.ts` | **78 / 78** | ✅ PASS |
| **TOTAL** | **Full Platform Regression Suite (8 Phases)** | `npm run test:all` | **329 / 329** | **✅ 100% PASS** |

- **TypeScript Strict Compile (`npx tsc --noEmit`):** `0 errors`
- **Production Bundle Build (`npm run build`):** `dist/ generated cleanly with 0 errors`

---

## 7. Git Branch & Merge History

All development was performed on dedicated feature branches, verified with automated tests, and merged into `main` via pull requests on GitHub:

| Branch Name | PR # | Merged By | Description |
|---|:---:|:---:|---|
| `karanwriteAuthentication-Multi-Role-Middleware` | PR #1 | Team | Phase 2: Auth, JWT, Multi-Role RBAC, Refresh tokens |
| `phase-3-vendor-management-and-catalog` | PR #2 | Team | Phase 3A: Vendor storefront, Hierarchical catalog, Variants |
| `karan-complete-phase-3-admin-and-vendor-setup` | PR #3 | Karan | Phase 3B: Admin governance, Key engine, UPI payments, Public forms |
| `karansinh-phase-4-customer-and-delivery-profiles`| PR #4 | Team | Phase 4: Customer profiles, GPS address book, Delivery fleet |
| `phase-5-cart-and-order-engine` | PR #5 | Team | Phase 5: Cart calculation, Snapshots, Order state machine |
| `phase-6-payment-and-wallet` | PR #6 | Team | Phase 6: Razorpay gateway, Webhooks, Wallet ledger, Vendor payouts |
| `phase-7-notifications-analytics-and-reviews` | PR #7 | Team | Phase 7: i18n notifications, Customer reviews, Analytics dashboards |
| `phase-8-missing-backend-delivery-and-auth-flows` | PR #9 | Karan | Phase 8: Operational flows, dual onboarding, pricing, delivery handover, referrals, support |
| **`main`** | — | — | **Stable Production Branch (Latest Commit: `386e021`)** |

---

## 8. Next Step 1: Production Environment Credentials Setup Guide

Before deploying the backend to live production, you must replace the development placeholder credentials in `.env` with live third-party API keys. Below is the complete step-by-step guide for obtaining and configuring every required key.

---

### 1. Razorpay Live Payment Gateway Keys & Webhooks

Razorpay powers online payments (UPI, Cards, Net Banking) and Wallet top-ups.

- **Website / Portal:** [https://dashboard.razorpay.com/](https://dashboard.razorpay.com/)
- **Target Variables:**
  ```env
  RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
  RAZORPAY_KEY_SECRET=YYYYYYYYYYYYYYYYYYYYYYYY
  RAZORPAY_WEBHOOK_SECRET=your_custom_webhook_secret_phrase
  ```

#### Step-by-Step Instructions:
1. **Sign Up / Log In:** Go to [Razorpay Dashboard](https://dashboard.razorpay.com/) and complete KYC business verification.
2. **Switch to Live Mode:** In the top header toggle, switch from **Test Mode** to **Live Mode**.
3. **Generate API Keys:**
   - In the left sidebar, navigate to **Account & Settings** → **API Keys** (under *Website and App Settings*).
   - Click **Generate Key** (or *Regenerate Key* if already created).
   - You will see **Key ID** (`rzp_live_...`) and **Key Secret**.
   - **Important:** Copy and save the Key Secret immediately. It will not be shown again.
4. **Configure Webhook:**
   - In the left sidebar, navigate to **Account & Settings** → **Webhooks**.
   - Click **Add New Webhook**.
   - **Webhook URL:** Enter your production API domain: `https://api.yourdomain.com/api/v1/payments/webhook`.
   - **Secret:** Enter a strong random secret phrase (e.g. `ringers_prod_webhook_sec_2026!`). Paste this exact phrase into `RAZORPAY_WEBHOOK_SECRET` in `.env`.
   - **Active Events:** Check:
     - `payment.captured`
     - `payment.failed`
     - `refund.processed`
   - Click **Create Webhook**.

---

### 2. Firebase Cloud Messaging (FCM) Service Account

Firebase sends real-time push notifications to Android, iOS, and Web devices.

- **Website / Portal:** [https://console.firebase.google.com/](https://console.firebase.google.com/)
- **Target Variables:**
  ```env
  FIREBASE_PROJECT_ID=ringers-platform-prod
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@ringers-platform-prod.iam.gserviceaccount.com
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD...\n-----END PRIVATE KEY-----\n"
  ```

#### Step-by-Step Instructions:
1. **Create Project:** Open [Firebase Console](https://console.firebase.google.com/), click **Add Project**, name it `ringers-platform-prod`, and accept terms.
2. **Open Project Settings:** Click the **Gear icon (⚙️)** next to *Project Overview* in the left sidebar → select **Project settings**.
3. **Generate Service Account Private Key:**
   - Click on the **Service accounts** tab.
   - Ensure **Node.js** is selected.
   - Click **Generate new private key**, then click **Generate key** in the confirmation modal.
   - A `.json` file will download to your computer.
4. **Extract Credentials:** Open the downloaded JSON file in a text editor:
   - Copy `project_id` → paste into `FIREBASE_PROJECT_ID`.
   - Copy `client_email` → paste into `FIREBASE_CLIENT_EMAIL`.
   - Copy `private_key` → paste into `FIREBASE_PRIVATE_KEY` (keep the `\n` characters intact inside quotation marks).
5. **Web Push Certificates (for Web PWA):**
   - Click on the **Cloud Messaging** tab.
   - Under *Web configuration* → *Web Push certificates*, click **Generate key pair**.
   - Copy the public key string (this will be used as the `VAPID Key` on the web frontend).

---

### 3. Transactional Email Gateway

Used for sending email receipts, order confirmations, and password reset links.

- **Recommended Provider:** [SendGrid](https://sendgrid.com/) or [Amazon SES](https://aws.amazon.com/ses/) or [Brevo](https://www.brevo.com/)
- **Website / Portal:** [https://app.sendgrid.com/](https://app.sendgrid.com/)
- **Target Variables:**
  ```env
  SMTP_HOST=smtp.sendgrid.net
  SMTP_PORT=587
  SMTP_USER=apikey
  SMTP_PASSWORD=SG.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  EMAIL_FROM=support@ringers.com
  ```

#### Step-by-Step Instructions (SendGrid):
1. Sign up or log into [SendGrid](https://app.sendgrid.com/).
2. In the left menu, go to **Settings** → **Sender Authentication**. Authenticate your custom business domain (e.g. `ringers.com`) by adding the CNAME records in your DNS provider (Cloudflare/GoDaddy).
3. In the left menu, go to **Settings** → **API Keys**.
4. Click **Create API Key**, name it `Ringers Backend Production`, select **Full Access** (or *Restricted Access* with *Mail Send* enabled), and click **Create & View**.
5. Copy the generated key (starts with `SG.`) and assign it to `SMTP_PASSWORD`.
6. Set `SMTP_USER=apikey` and `SMTP_HOST=smtp.sendgrid.net`.

---

### 4. SMS Gateway

Used for instant mobile OTP verification and driver dispatch SMS alerts.

- **Recommended Provider:** [Twilio](https://www.twilio.com/) (Global) or [Fast2SMS](https://www.fast2sms.com/) (India DLT Compliant)
- **Website / Portal:** [https://console.twilio.com/](https://console.twilio.com/)
- **Target Variables:**
  ```env
  TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  TWILIO_AUTH_TOKEN=YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY
  TWILIO_PHONE_NUMBER=+1234567890
  ```

#### Step-by-Step Instructions:
1. Log into [Twilio Console](https://console.twilio.com/).
2. On your Console Dashboard, locate **Project Info**:
   - Copy **Account SID** → paste into `TWILIO_ACCOUNT_SID`.
   - Copy **Auth Token** → paste into `TWILIO_AUTH_TOKEN`.
3. Go to **Phone Numbers** → **Manage** → **Active numbers** (or buy a dedicated sender number).
4. Copy the purchased phone number in E.164 format (e.g., `+19876543210`) → paste into `TWILIO_PHONE_NUMBER`.
5. *(For India DLT SMS compliance with Fast2SMS)*: Register on [Fast2SMS](https://www.fast2sms.com/), obtain an Indian DLT sender header, and copy the authorization key from **Dev API**.

---

### 5. Free Map Services Configuration

Used for distance calculation, address geocoding, and visual rider tracking. We use 100% free, open-source alternatives.

- **Providers:** OpenStreetMap (OSM), Nominatim, and OSRM/OpenRouteService
- **Target Variables:**
  ```env
  MAP_SERVICE_PROVIDER=openstreetmap
  OSM_TILE_SERVER_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
  OSM_NOMINATIM_URL=https://nominatim.openstreetmap.org
  OSRM_ROUTING_URL=https://router.project-osrm.org
  OPENROUTESERVICE_API_KEY=
  ```

#### Setup & Usage:
1. **OSM Tile Server:** Used for frontend map rendering. URL is free and requires no API key.
2. **Nominatim:** Used for address-to-GPS geocoding. 100% free; requires setting a generic User-Agent header in the app.
3. **OSRM:** Open Source Routing Machine demo server calculates driving distance matrices for free.
4. *(Optional)* **OpenRouteService:** If you exceed OSRM demo limits, sign up at [https://openrouteservice.org/](https://openrouteservice.org/) to get a free API key (2,000 req/day). Paste it into `OPENROUTESERVICE_API_KEY`.

---

### 6. Cloudinary Media Storage

Used for uploading product catalog images, merchant storefront banners, and delivery driver KYC licenses.

- **Website / Portal:** [https://cloudinary.com/](https://cloudinary.com/)
- **Target Variables:**
  ```env
  CLOUDINARY_CLOUD_NAME=your_cloud_name
  CLOUDINARY_API_KEY=123456789012345
  CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123
  ```

#### Step-by-Step Instructions:
1. Sign up or log into [Cloudinary Dashboard](https://cloudinary.com/users/login).
2. On the main **Dashboard** home screen, look at the **Product Environment Credentials** card.
3. Copy **Cloud Name**, **API Key**, and click the eye icon to copy **API Secret**.
4. Paste each into their respective `.env` variables.

---

### 7. PostgreSQL Production Database & JWT Secrets

- **Target Variables:**
  ```env
  NODE_ENV=production
  PORT=5000
  DATABASE_URL=postgresql://db_user:strong_password@db-host.provider.com:5432/ringers_production?sslmode=require
  DB_HOST=db-host.provider.com
  DB_PORT=5432
  DB_USER=db_user
  DB_PASSWORD=strong_password
  DB_NAME=ringers_production
  DB_POOL_MAX=50
  DB_POOL_IDLE_TIMEOUT_MS=30000

  JWT_SECRET=super_strong_at_least_64_characters_random_hex_string_for_access_token_security_2026
  JWT_ACCESS_EXPIRY=1h
  JWT_REFRESH_SECRET=super_strong_at_least_64_characters_random_hex_string_for_refresh_token_security_2026
  JWT_REFRESH_EXPIRY=7d
  ```

> [!IMPORTANT]
> To generate cryptographically secure 64-character JWT secrets on your machine, run this command in terminal:
> ```powershell
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

### 8. Step-by-Step Guide to Updating `.env` & Dependent Backend Files

#### How to edit the file safely on your system:
1. In the `backend` folder, duplicate `.env.example` to `.env` if not already present:
   ```powershell
   cd "backend"
   copy .env.example .env
   ```
2. Open `backend/.env` in VS Code or your preferred text editor:
   ```powershell
   code .env
   ```
3. Paste all the real keys obtained from the steps above. Save the file.
4. **Safety Rule:** Ensure `.env` is listed in `backend/.gitignore`. Never push `.env` to GitHub.

#### Which backend source files validate and read these variables?
- [`backend/src/config/env.ts`](file:///c:/Users/karan/Desktop/New%20folder%20%283%29/ringers-react/backend/src/config/env.ts): The central Zod schema that validates all environment variables at server boot. If any required variable is missing or invalid, the server halts immediately with an explanatory error.
- [`backend/src/config/database.ts`](file:///c:/Users/karan/Desktop/New%20folder%20%283%29/ringers-react/backend/src/config/database.ts): Connects to PostgreSQL using `DATABASE_URL` or `DB_*` connection parameters and pool size configs.
- [`backend/src/config/razorpay.ts`](file:///c:/Users/karan/Desktop/New%20folder%20%283%29/ringers-react/backend/src/config/razorpay.ts): Reads `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` for payment orders, HMAC verification, and refunds.
- [`backend/src/modules/auth/token.service.ts`](file:///c:/Users/karan/Desktop/New%20folder%20%283%29/ringers-react/backend/src/modules/auth/token.service.ts): Reads `JWT_SECRET` and `JWT_REFRESH_SECRET` to sign and verify access and refresh tokens.

---

## 9. Next Step 2: Frontend Applications Implementation Plan

With all backend APIs, database tables, and validation rules in place, the platform is ready for the frontend development phase.

The frontend consists of **4 dedicated client applications** sharing the common design system, API client, and authentication state:

```
ringers-react/
├── apps/
│   ├── customer-web/          ← Client App 1: Customer Web Storefront & PWA (React + Vite)
│   ├── vendor-dashboard/      ← Client App 2: Vendor Merchant Store Portal (React + Vite)
│   ├── delivery-app/          ← Client App 3: Delivery Partner Rider App (React Native / Expo)
│   └── admin-portal/          ← Client App 4: Super Admin Governance Platform (React + Vite)
└── packages/
    ├── api-client/            ← Shared Axios/Fetch client with automatic JWT token refresh
    ├── types/                 ← Shared TypeScript interfaces generated from backend
    └── ui/                    ← Shared UI component library (Buttons, Modals, Inputs, Cards)
```

---

### App 1: Customer Mobile & Web Application
- **Target:** Web (Desktop & Mobile Browser) + Progressive Web App (PWA) + Android/iOS Mobile App.
- **Tech Stack:** React 19, Vite, TailwindCSS (Dark/Light mode), TanStack Query, Zustand.
- **Core Screens & Capabilities:**
  1. **Store Discovery & Category Browser:** Location-based nearby store listing, category carousel, product search with instant debounced filtering.
  2. **Product Page & Variant Selector:** Product photo gallery, size/weight/variant selector with live pricing updates, nutritional info, customer reviews with 1-5★ breakdown.
  3. **Cart & Delivery Fee Estimator:** Live cart drawer, dynamic delivery fee calculation via `/orders/calculate` showing exact distance in km and fee breakdown.
  4. **Multi-Payment Checkout:** Razorpay Checkout modal (UPI, Cards, Net Banking, COD) + Instant 1-click payment using Ringers Wallet balance.
  5. **Live Order Tracking:** Step-by-step progress bar synced with order state machine (`CONFIRMED` → `PREPARING` → `READY` → `OUT_FOR_DELIVERY` → `DELIVERED`), interactive map tracking the assigned rider.
  6. **Customer Wallet Screen:** View balance, add money top-up modal, paginated ledger of credits and debits.
  7. **Multi-Language Switcher:** Global language toggle in header/settings supporting **English**, **Hindi (हिंदी)**, and **Marathi (मराठी)**.

---

### App 2: Vendor Storefront Management Portal
- **Target:** Web Tablet / Desktop Dashboard (optimized for iPad/POS displays in shops).
- **Tech Stack:** React, Vite, TailwindCSS, Socket.IO Client, Lucide Icons.
- **Core Screens & Capabilities:**
  1. **Live Kitchen / Store Orders Desk (Kanban Board):**
     - Three active columns: *New Incoming (`PENDING`)*, *In Preparation (`PREPARING`)*, *Ready for Pickup (`READY`)*.
     - Audio alert bell rings when a customer places a new order.
     - Single-click action buttons: "Accept Order", "Mark as Ready", "Dispatch".
  2. **Product & Inventory Catalog Manager:** Add new products, toggle out-of-stock switches, adjust prices, manage variants (sizes, flavors), upload gallery photos.
  3. **Store Profile & Operating Hours:** Edit business name, contact info, set daily opening/closing schedules, toggle store online/offline.
  4. **Staff Management:** Add shop employees and assign roles (`MANAGER`, `STAFF`, `CHEF`).
  5. **Financials & UPI Settings:** Configure store UPI ID, view 90% automated payouts credited to vendor wallet on delivery, request bank withdrawal.
  6. **Store Analytics Dashboard:** Visual graphs showing daily sales GMV, top 5 selling items, customer rating average, and review feedback.

---

### App 3: Delivery Partner Fleet Mobile Application
- **Target:** Mobile App for Android & iOS (optimized for low-battery consumption on two-wheelers).
- **Tech Stack:** React Native with Expo (or React PWA with Geolocation APIs).
- **Core Screens & Capabilities:**
  1. **Duty Status Switcher:** Big toggle button to switch duty between `ONLINE` (ready to receive jobs) and `OFFLINE`.
  2. **Order Dispatch Notification Modal:** When assigned an order, rider hears alert sound with floating card displaying store name, customer delivery address, distance in km, and earnings payout. "Accept" or "Decline" buttons with 30-second countdown timer.
  3. **Delivery Navigation & Order Flow:**
     - Step 1: Navigate to Vendor Store → Click "Arrived at Store".
     - Step 2: Pickup items → Click "Order Picked Up" (transitions status to `OUT_FOR_DELIVERY`).
     - Step 3: Navigate to Customer Address with standard GPS geo deep-link navigation (OsmAnd, Waze, etc).
     - Step 4: Handover package → Enter customer 4-digit OTP → Click "Order Delivered" (triggers vendor wallet payout).
  4. **Live Background GPS Beacon:** Reports coordinates every 10 seconds to `/api/v1/delivery/location` so customers can track rider position.
  5. **Rider Earnings & Trip History:** Daily completed delivery tally, total earnings, and tips.

---

### App 4: Super Admin Operations Control Center
- **Target:** Desktop Web Portal for Platform Founders and Operations Managers.
- **Tech Stack:** React, Vite, TailwindCSS, Chart.js / Recharts.
- **Core Screens & Capabilities:**
  1. **Platform Executive Overview:** Real-time metrics counters: Total Gross Merchandise Value (GMV), 10% Platform Commission Revenue, Total Active Users, Total Deliveries.
  2. **Private Key Generator Tool:** Single-click generation of 30-day single-use vendor registration keys (`RNG-VND-XXXXXX`) with copy-to-clipboard button.
  3. **Vendor Onboarding Approval Desk:** Review incoming public vendor registration applications. Preview store photos, owner details, phone, and click "Approve" (auto-attaches registration key) or "Reject".
  4. **Delivery Partner Onboarding & Assignment:** Review incoming rider applications, inspect driving licenses, and assign riders to specific vendor delivery fleets.
  5. **Global Order Monitor:** Real-time table of all platform orders with status badges and ability to issue customer refunds via Razorpay API.
  6. **Platform Broadcast Tool:** Send system announcements and promotional notifications to all customers, vendors, or riders simultaneously.

---

## 🏁 Summary & Verification Checklist

- [x] **Phase 1: Database Architecture:** 16 SQL Migrations, 9 PostgreSQL Schemas, High-scale B-Tree indexes.
- [x] **Phase 2: Authentication & RBAC:** Multi-Role JWT, Token rotation, BCrypt, Role Guards.
- [x] **Phase 3A: Vendor & Catalog:** Storefronts, Operating Hours, Staff delegation, Categories, Variants, Products.
- [x] **Phase 3B: Admin Governance:** Private Key generation, Vendor review, Rider assignment, UPI config.
- [x] **Phase 4: Customer & Delivery:** Profile, GPS address book with Indian PIN check, Fleet vehicles, Duty switcher.
- [x] **Phase 5: Cart & Order Engine:** Haversine distance pricing, Immutable snapshots, State machine.
- [x] **Phase 6: Payments & Wallet:** Native Razorpay client, Webhook HMAC verification, Double-entry wallet ledger, 90% vendor payout.
- [x] **Phase 7: Notifications & Reviews:** 3-Language i18n (EN/HI/MR), FCM device tokens, 1-5★ verified reviews, Analytics.
- [x] **Phase 8: Operational Flows:** Dual customer onboarding, custom product pricing, delivery handover (OTP & confirmation), rider job pipeline, vendor referrals, support tickets.
- [x] **Automated Tests Passing:** **329 / 329 (100%)** via `npm run test:all`.
- [x] **Git Status:** Merged into `main` (Commit `386e021`), 0 conflicts, 0 errors.
- [x] **Documentation Artifacts:** Master document generated, production credentials guide and frontend roadmap fully specified.
