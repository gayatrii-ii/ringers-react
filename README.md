# 🔔 Ringers

> **Smart Hyperlocal Commerce & On-Demand Delivery Platform**

[![React Native](https://img.shields.io/badge/React%20Native-0.74+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-Real--Time-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

---

## 📖 Overview

**Ringers** is a full-stack, real-time hyperlocal commerce and delivery platform engineered to connect local merchants, customers, and delivery partners seamlessly. 

The ecosystem features a customer mobile app, merchant management portal, rider dispatch app, and a robust administrative control center backed by high-throughput microservices and real-time event streaming.

---

## 🏗 System Architecture

```mermaid
graph TD
    subgraph Client Applications
        A[📱 React Native / Expo Mobile App<br/>Customers & Delivery Partners]
        B[💻 Next.js Web Dashboard<br/>Store Owners & Admins]
    end

    subgraph Backend Services
        C[🚀 Node.js / Express REST API]
        D[⚡ Socket.IO Real-Time Engine]
        E[🔴 Redis In-Memory Cache & Pub/Sub]
    end

    subgraph Data & Storage
        F[(🐘 PostgreSQL Database)]
        G[💎 Prisma ORM]
        H[☁️ Cloudinary Media Storage]
    end

    subgraph External Integrations
        I[💳 Razorpay Payment Gateway]
        J[🗺️ Google Maps Navigation & Geofencing]
        K[🔥 Firebase Cloud Messaging]
    end

    A <-->|REST & WebSockets| C
    A <-->|Live Coordinates| D
    B <-->|REST & WebSockets| C
    C <--> G <--> F
    C <--> E
    D <--> E
    C --> I
    C --> H
    C --> K
    A --> J
```

---

## 🌟 Key Features

### 🛒 Customer Experience
- **Hyperlocal Discovery**: Geo-aware store discovery, categorized product catalog browsing, and instant search.
- **Cart & Checkout**: Real-time pricing, coupons/promotions, delivery fee computation, and multiple address management.
- **Secure Payments**: Frictionless checkout powered by **Razorpay** (UPI, Cards, NetBanking, Wallets).
- **Live Order Tracking**: Interactive map powered by **Google Maps API** and **Socket.IO** for live rider location updates and ETAs.
- **Push Notifications**: Real-time order progress alerts powered by **Firebase Cloud Messaging (FCM)**.

### 🏪 Merchant & Store Portal
- **Inventory & Catalog Management**: Add products, bulk update variants, prices, and upload optimized product imagery via **Cloudinary**.
- **Real-Time Order Desk**: Audio/visual order notifications, one-click accept/prepare/dispatch workflows.
- **Analytics & Revenue**: Daily sales metrics, best-selling items, and settlement tracking.

### 🛵 Delivery Fleet App
- **Automated Dispatch**: Proximity-based order assignment with accept/reject timers.
- **Turn-by-Turn Navigation**: Seamless Google Maps routing from merchant pickup to customer doorstep.
- **Proof of Delivery**: In-app digital verification and OTP confirmation.

### 🛡 Core & Infrastructure
- **High-Performance Caching**: **Redis** caching for store menus, session tokens, and geospatial query results.
- **Data Integrity**: **PostgreSQL** paired with **Prisma ORM** ensuring relational consistency and type-safe schemas.
- **Stateless Auth**: Role-Based Access Control (RBAC) via **JWT** and secure refresh token rotation.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Mobile App** | [React Native](https://reactnative.dev/), [Expo](https://expo.dev/) | Cross-platform iOS & Android apps |
| **Web & Admin** | [Next.js](https://nextjs.org/), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/) | Store manager & super-admin portal |
| **Backend API** | [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/) | RESTful services, business logic & controllers |
| **Real-Time** | [Socket.IO](https://socket.io/) | Bidirectional low-latency tracking and chat |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/), [Prisma](https://www.prisma.io/) | Relational database & type-safe data modeling |
| **Cache & Queue** | [Redis](https://redis.io/) | In-memory key-value caching & socket pub/sub |
| **Payments** | [Razorpay](https://razorpay.com/) | Seamless payment processing & webhooks |
| **Maps & Location** | [Google Maps Platform](https://developers.google.com/maps) | Geocoding, Places API & route optimization |
| **Media Storage** | [Cloudinary](https://cloudinary.com/) | Image and media optimization and CDN delivery |
| **Notifications** | [Firebase Cloud Messaging](https://firebase.google.com/) | Instant push notifications for order updates |
| **Authentication** | [JWT](https://jwt.io/), [Bcrypt](https://www.npmjs.com/package/bcrypt) | Token-based security and password hashing |

---

## 📂 Project Structure

```text
ringers/
├── apps/
│   ├── mobile/             # React Native / Expo application (Customers & Riders)
│   │   ├── src/
│   │   │   ├── components/ # Reusable UI components
│   │   │   ├── screens/    # App screens (Home, Cart, Tracking, Profile)
│   │   │   ├── navigation/ # React Navigation stacks & tabs
│   │   │   ├── services/   # Socket client & API requests
│   │   │   └── hooks/      # Custom React hooks
│   │   └── package.json
│   │
│   ├── web/                # Next.js Web Admin & Merchant Portal
│   │   ├── src/
│   │   │   ├── app/        # App router pages & layouts
│   │   │   ├── components/ # Dashboard UI components
│   │   │   └── lib/        # Utilities & API clients
│   │   └── package.json
│   │
│   └── server/             # Express.js Backend Server
│       ├── src/
│       │   ├── controllers/# Request handlers
│       │   ├── routes/     # Express route definitions
│       │   ├── middlewares/# Auth (JWT), validation & error handlers
│       │   ├── sockets/    # Socket.IO handlers (tracking, orders)
│       │   ├── services/   # Razorpay, Redis, Cloudinary, Firebase services
│       │   └── config/     # Environment configurations
│       ├── prisma/
│       │   ├── schema.prisma # PostgreSQL Prisma schema
│       │   └── migrations/   # Database migrations
│       └── package.json
│
├── .gitignore
├── README.md
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) / [pnpm](https://pnpm.io/)
- [PostgreSQL](https://www.postgresql.org/) (running locally or a cloud instance like Supabase / Neon)
- [Redis](https://redis.io/) (running locally or via Upstash)
- [Expo Go App](https://expo.dev/go) (for testing mobile app on physical devices)

---

### 1. Clone & Setup Repository

```bash
git clone https://github.com/gayatrii-ii/ringers-react.git
cd ringers-react
```

### 2. Environment Configuration

Create a `.env` file in the server directory based on the following template:

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Database (PostgreSQL via Prisma)
DATABASE_URL="postgresql://username:password@localhost:5432/ringers_db?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Firebase Admin (FCM)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"
```

### 3. Database Migration

```bash
cd apps/server
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name init

# (Optional) Seed initial categories & sample data
npx prisma db seed
```

### 4. Running the Backend Server

```bash
# Start the Express & Socket.IO server
npm run dev
# Server will run on http://localhost:5000
```

### 5. Running the Web Portal (Next.js)

```bash
cd ../web
npm install
npm run dev
# Web app will run on http://localhost:3000
```

### 6. Running the Mobile App (Expo)

```bash
cd ../mobile
npm install
npx expo start
```
Scan the QR code with **Expo Go** on Android or camera on iOS to launch the application.

---

## 📡 Socket.IO Real-Time Events

| Event Name | Direction | Description |
|---|---|---|
| `order:join` | Client ➔ Server | Joins the room for a specific order tracking session |
| `rider:location_update` | Rider ➔ Server | Transmits high-frequency GPS coordinates |
| `order:location_broadcast` | Server ➔ Customer | Broadcasts the updated rider location on the map |
| `order:status_changed` | Server ➔ Customer/Merchant | Emits changes in order lifecycle (`CONFIRMED`, `PREPARING`, `DISPATCHED`, `DELIVERED`) |

---

## 🔒 Security Best Practices

- **Token Protection**: JWT stored in secure HTTP-only cookies on web and encrypted `SecureStore` on mobile.
- **Payment Verification**: Webhook signatures verified via HMAC-SHA256 before updating order status.
- **Input Sanitization**: Request bodies sanitized and validated using schema validators (Zod / Joi).
- **Rate Limiting**: Critical endpoints (Auth, Orders) protected using Redis-backed rate limiters.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👨‍💻 Author

- **gayatrii-ii** — [GitHub Profile](https://github.com/gayatrii-ii)
