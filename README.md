# Dhaka Tesla Pool (ঢাকা টেসলা পুল) — Server API

> **High-Performance NestJS Backend for Electric Autonomous Corridor Ridesharing in Dhaka City**  
> *Developed for RobanDevs Engineering Internship Evaluation · P0 Submission*

[![NestJS](https://img.shields.io/badge/NestJS-10.0-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.0-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.0-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Vitest-100%25_Passing-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel&logoColor=white)](https://dhaka-tesla-pool-client.vercel.app)

---

## 🌐 Live Deployment & Demo Links

- **🚀 Live Web Application (Vercel):** [https://dhaka-tesla-pool-client.vercel.app](https://dhaka-tesla-pool-client.vercel.app)
- **📹 6-Minute Demonstration Video:**  
  > 🎥 **[Watch 6-Minute Project Walkthrough Video](https://drive.google.com/file/d/1ZXjkyd79Nad3e8RiXJkZr1K2dZENKWdG/view?usp=sharing)**  
  > *Demonstrates corridor matching, concurrency row-locking under load, manual driver acceptance, and Poysha wallet deduction.*

---

## 📸 System Showcase & Visuals

### 1. Home & Corridor Overview
Interactive corridor map, origin/destination selector, and instant role switcher between Passenger and Captain.

![Home Page](assets/home-page.png)

---

### 2. Live Ride Booking & TeslaPay Wallet
Corridor ride booking with real-time pricing quote, 25% pooled discount, seat capacity selector, payment method toggle (TeslaPay vs Cash), and instant top-up.

![Book Ride](assets/book-ride.png)

---

### 3. Completed Trips, Audit Logs & Receipts
Historical ride archive showing completed trips, designated captain details, Poysha-accurate receipts, and immutable FSM audit status logs.

![Ride History](assets/ride-history.png)

---

## 📌 Executive Summary & Problem Statement

Dhaka is one of the densest and most congestion-choked megacities in the world. Key arteries like the **Airport Road, Bir Uttam Mir Shawkat Sarak, Pragati Sarani, and Mirpur Road** suffer daily from single-occupancy vehicle gridlock.

**Dhaka Tesla Pool** reimagines urban mobility in Dhaka:
1. **Dynamic Corridor Pooling:** Aggregates commuters heading along the same geographic corridor (e.g. Banani ➔ Mohakhali / Gulshan) into high-efficiency electric Tesla Model Y vehicles ("Bullet").
2. **Strict Physical Capacity (Max 3 Seats):** Bullet accommodates at most 3 passengers per trip.
3. **Pessimistic Concurrency Row-Locking:** Eliminates race conditions so overbooking is physically impossible at the database level.
4. **Poysha-Accurate FinTech Billing:** Currency math is computed in integer Poysha (1 BDT = 100 Poysha), preventing floating-point drift and supporting exact micro-discounts.
5. **Captain Manual Acceptance Workflow:** Drivers explicitly accept or decline incoming corridor ride requests before dispatch.

---

## ⚙️ Environment Variables & Project Setup

### Server `.env` Configuration
Create a `.env` file in the `server` root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Configure the following environment variables:

| Variable | Description | Example / Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Local Docker, Colima, or Cloud DB) | `postgresql://postgres:postgres@localhost:5432/dhaka_tesla_pool?schema=public` |
| `JWT_SECRET` | Secret key used to sign and verify JSON Web Tokens | `your-super-secret-jwt-key-dhaka-tesla-2026` |
| `JWT_EXPIRES_IN` | Token expiration period | `7d` |
| `PORT` | Port number for the NestJS API server | `4000` |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins | `http://localhost:3000,https://dhaka-tesla-pool-client.vercel.app` |
| `NODE_ENV` | Environment mode | `development` or `production` |

---

## 👥 Pre-Seeded Demo Credentials (PRD Section 4)

All accounts are pre-seeded in the database with password: `Tesla2026!`

| Role | Name | Email | Password | Initial State / Preloaded Balance |
|---|---|---|---|---|
| **Driver Captain** | Jashim Uddin | `jashim@tesla.dhaka` | `Tesla2026!` | Vehicle: Bullet (Tesla Model Y) · Banani Zone · Online |
| **Passenger 1** | Nusrat Jahan | `nusrat@tesla.dhaka` | `Tesla2026!` | ৳500.00 (`50,000` Poysha) |
| **Passenger 2** | Rafiqul Islam | `rafiq@tesla.dhaka` | `Tesla2026!` | ৳350.00 (`35,000` Poysha) |
| **Passenger 3** | Shirin Akter | `shirin@tesla.dhaka` | `Tesla2026!` | ৳500.00 (`50,000` Poysha) |

---

## 🏛️ System Architecture & Database Design

### End-to-End Architecture
```mermaid
flowchart TD
    subgraph ClientApp ["1. Frontend Client Layer (Next.js 16 + Tailwind CSS)"]
        PassengerUI["Passenger Web App<br/>(Corridor Booking & Live State Tracker)"]
        DriverUI["Driver Captain Console<br/>(Dispatch Alerts & Passenger Manifest)"]
    end

    subgraph ApiGateway ["2. NestJS API Controllers & Routing"]
        RidesCtrl["Rides Controller<br/>(POST /rides/request)"]
        DriverCtrl["Driver Controller<br/>(POST /driver/rides/:id/accept)"]
    end

    subgraph CoreServices ["3. Business Logic & Concurrency Engine"]
        PricingSvc["Pricing Module<br/>(Dhaka Corridors & Poysha Fare Engine)"]
        RidesSvc["Rides Module<br/>(FSM Lifecycle: REQUESTED ➔ MATCHED ➔ COMPLETED)"]
        PoolsSvc["Pools Module<br/>(Pessimistic Row Locking 'SELECT FOR UPDATE')"]
    end

    subgraph DataStore ["4. Persistence Layer (Neon PostgreSQL 16)"]
        PoolTable[("pools Table<br/>(occupied_seats, vehicle capacity: 3)")]
        UserTable[("users Table<br/>(wallet_balance_poysha)")]
        RideTable[("ride_requests Table<br/>(status, passenger_id, poysha)")]
        AuditTable[("ride_status_logs Table<br/>(immutable audit log trail)")]
    end

    %% Vertical Cross-Layer Data Flow
    PassengerUI -->|"1. Submit Booking Request"| RidesCtrl
    DriverUI -->|"1. Accept / Advance Trip"| DriverCtrl

    RidesCtrl -->|"2. Compute Fare & Validate"| PricingSvc
    PricingSvc -->|"3. Forward Booking Payload"| RidesSvc
    DriverCtrl -->|"2. Advance FSM State"| RidesSvc

    RidesSvc -->|"4. Atomic Lock & Seat Allocation"| PoolsSvc

    PoolsSvc -->|"5. SELECT FOR UPDATE Row Lock"| PoolTable
    PoolsSvc -->|"6. Atomic Wallet Deduction"| UserTable
    RidesSvc -->|"7. Persist Ride Record"| RideTable
    RidesSvc -->|"8. Append State Transition Log"| AuditTable
```

### Entity-Relationship Diagram (ERD)
```mermaid
erDiagram
    User ||--o| Vehicle : drives
    User ||--o{ RideRequest : books
    Vehicle ||--o{ Pool : assigned
    Pool ||--o{ RideRequest : contains
    RideRequest ||--o{ RideStatusLog : tracks

    User {
        string id PK
        string email UK
        string passwordHash
        string name
        enum role "PASSENGER, DRIVER"
        int walletBalancePoysha "Default: 50000 (৳500.00)"
        datetime createdAt
    }

    Vehicle {
        string id PK
        string driverId FK, UK
        string name "Bullet"
        int maxCapacity "3"
        boolean isOnline
        string currentZone "Banani"
        datetime updatedAt
    }

    Pool {
        string id PK
        string vehicleId FK
        enum status "OPEN, FULL, IN_TRANSIT, COMPLETED, CANCELLED"
        int occupiedSeats "0-3"
        string pickupZone
        string corridor
        datetime createdAt
    }

    RideRequest {
        string id PK
        string passengerId FK
        string poolId FK
        string pickupZone
        string destinationZone
        int seatsRequested "1-3"
        enum status "REQUESTED, MATCHED, DRIVER_ARRIVED, STARTED, COMPLETED, CANCELLED"
        int baseFarePoysha
        int distanceChargePoysha
        int poolDiscountPoysha
        int totalFarePoysha
        enum paymentMethod "TESLAPAY, CASH"
        enum paymentStatus "PENDING, PAID, REFUNDED"
        datetime createdAt
    }

    RideStatusLog {
        string id PK
        string rideId FK
        string previousStatus
        string newStatus
        string changedBy
        datetime createdAt
    }
```

---

## 🔒 The Concurrency Problem & Pessimistic Row-Level Locking

### The Race Condition Scenario
In high-demand Dhaka corridors, two passengers (e.g. Nusrat and Rafiq) may click **"Request Bullet"** at the exact same millisecond when only **1 seat** remains in the vehicle.

In standard ORM queries:
1. Thread A reads: `occupiedSeats = 2` (Capacity is 3 ➔ OK to book).
2. Thread B reads: `occupiedSeats = 2` (Capacity is 3 ➔ OK to book).
3. Thread A saves: `occupiedSeats = 3`.
4. Thread B saves: `occupiedSeats = 4` 💥 **OVERBOOKING DISASTER (Illegal physical state in a 3-seat car).**

### How We Solved It: PostgreSQL Pessimistic Row Lock (`SELECT FOR UPDATE`)
We bypassed standard non-blocking ORM reads by executing an atomic pessimistic row lock inside a Prisma `$transaction`:

```typescript
// server/src/modules/pools/pools.service.ts
return await this.prisma.$transaction(async (tx) => {
  const pools = await tx.$queryRaw<Array<{
    id: string;
    occupied_seats: number;
    status: PoolStatus;
  }>>`
    SELECT id, vehicle_id, status, occupied_seats, pickup_zone, corridor
    FROM "pools"
    WHERE id = ${poolId}
    FOR UPDATE
  `;

  const currentPool = pools[0];
  if (currentPool.occupied_seats + seatsRequested > 3) {
    throw new ConflictException(
      `Pool capacity exceeded. Only ${3 - currentPool.occupied_seats} seat(s) available in Bullet.`
    );
  }

  // Safe reservation & seat increment
  const newOccupiedSeats = currentPool.occupied_seats + seatsRequested;
  await tx.pool.update({
    where: { id: poolId },
    data: {
      occupiedSeats: newOccupiedSeats,
      status: newOccupiedSeats === 3 ? PoolStatus.FULL : PoolStatus.OPEN,
    },
  });
});
```
- The first transaction obtains an exclusive row lock at the PostgreSQL kernel level.
- The second transaction is suspended until the first commits, then immediately reads `occupiedSeats = 3` and is cleanly rejected with HTTP 409 Conflict.

---

## 💰 Poysha-Accurate Integer Pricing Engine & FinTech Architecture

### Why IEEE 754 Floating-Point Math Fails
In JavaScript/Node.js, floating-point arithmetic introduces severe precision drift:
```javascript
0.1 + 0.2 === 0.30000000000000004 // True!
```
Over thousands of micro-transactions, floating-point rounding causes ledger imbalances and fractional Taka loss.

### Architectural Decision: AI Recommendation vs. Developer Refinement
- **AI's Initial Suggestion:** The AI assistant suggested using integer math for monetary values to eliminate float drift.
- **My Engineering Decision:** While AI recommended basic integer calculations (often rounding directly to whole Taka), I rejected rounding to whole Taka because ride fares have fractional rates and percentage discounts. Instead, **I engineered the entire database and math engine in sub-unit integer Poysha (1 BDT = 100 Poysha)**:
  - **Base Fare:** ৳25.00 ➔ `2500` Poysha
  - **Rate per km:** ৳15.00/km ➔ `1500` Poysha
  - **Pooling Discount:** 25% ➔ `poolDiscountPoysha = Math.round(subtotal * 0.25)`
  - **Formula:**  
    $$\text{Total Poysha} = \text{Base} + (\text{DistanceKm} \times 1500) - \text{Discount}$$
  - **Example (Banani ➔ Mohakhali, 3.5 km):**  
    `2500 + 5250 = 7750` Poysha. Discount (25%) = `1938` Poysha.  
    Total = `5812` Poysha = **৳58.12**.

### Atomic Balance Deduction on Trip Completion
When Captain Jashim marks the trip `COMPLETED`, if the passenger selected `TESLAPAY`, their wallet balance is atomically decremented:
```typescript
// server/src/modules/driver/driver.service.ts
if (targetStatus === RideStatus.COMPLETED) {
  for (const ride of activeRides) {
    if (ride.paymentMethod === PaymentMethod.TESLAPAY) {
      await tx.user.update({
        where: { id: ride.passengerId },
        data: {
          walletBalancePoysha: {
            decrement: ride.totalFarePoysha,
          },
        },
      });
    }
  }
}
```

---

## 🤖 AI Usage & Engineering Methodology (PRD Section 10)

In compliance with Section 10 of the PRD, this project transparently details all AI assistance and engineering workflows:

1. **Pre-Project Professional Dev Docs:**
   - Before writing any code, I created a comprehensive, professional **Dev Docs** suite (Epics, Stories, Architectural Decision Records, and PRD breakdown).
   - This dev documentation guided the entire project lifecycle, established clear acceptance criteria, and organized the sequential development of both backend and frontend.

2. **AI Tool Used:**
   - **Free Gemini / Antigravity CLI:** Used as the sole AI pair programming engine for proper AI-assisted development, architectural refinement, and automated test harness verification. No external third-party tools like Claude or Copilot were used.

3. **Where AI Helped:**
   - **Architecture & System Refinement:** Gemini assisted in designing the decoupled modular architecture, corridor state transitions, and concurrency protection models.
   - **UI & Frontend Layout:** Assisted in structuring the responsive Next.js 16 App Router interface and Tailwind CSS layouts with dark-mode support.
   - **Backend Vitest Unit Testing:** Gemini helped generate test fixtures, mock factories, and boundary edge cases, enabling a 100% test pass rate across all 65 Vitest unit tests.

4. **Accepted AI Suggestion:**
   - AI suggested moving away from JavaScript `Number` floats to integer storage to avoid floating-point drift in account balances.

5. **Rejected / Refined AI Suggestion:**
   - **Rejection of Whole Taka Rounding ➔ Moved to Poysha:** AI originally suggested keeping integer balances as rounded whole Taka (BDT). I rejected this because ride-hailing pricing requires fractional precision (e.g. ৳58.12) to handle 25% corridor pooling discounts without rounding distortion. Instead, **I engineered the system in sub-unit Integer Poysha (1 BDT = 100 Poysha)** across the database schema, pricing calculations, and wallet deductions for true FinTech accuracy.
   - **Rejection of WebSockets for MVP:** AI suggested using Socket.io for driver-passenger communication. I intentionally deferred WebSockets in favor of **stateless REST polling (2s-3s polling)**, ensuring zero connection dropping on serverless/free-tier edge architectures while keeping the system simple and highly reliable.

---

## 🚀 Bonus Section: "If Oi Tesla Goes Viral" (Scaling to 1M Passengers & 100k Drivers)

If Dhaka Tesla Pool explodes in popularity across Dhaka, the single-instance monolithic architecture will evolve into a distributed system:

1. **Spatial Hexagonal Indexing (Uber H3 & PostGIS):**
   - Replace static zone lookup with Uber H3 hexagonal spatial grids (Resolution 8/9).
   - Match passengers and drivers within adjacent H3 cells in $<10\text{ms}$ using spatial indexing.
2. **Distributed Locking (Redis Redlock):**
   - Replace single-database `SELECT FOR UPDATE` locks with distributed Redis locks across microservices.
3. **Event-Driven Dispatch via Apache Kafka / RabbitMQ:**
   - Queue incoming ride requests into corridor-partitioned Kafka topics (`rides.requests.southeast`).
   - Match vehicles asynchronously with event streams, buffering peak rush-hour traffic surges.
4. **Database Read Replicas & Connection Pooling:**
   - Deploy Neon/Aurora PostgreSQL read replicas for read-heavy operations (quotes, manifests, history).
   - Utilize PgBouncer connection pooling to handle 50,000+ concurrent database connections.
5. **Edge Caching for Static Route Topologies:**
   - Cache corridor distance matrices and fare rules on Cloudflare / Vercel Edge CDN nodes with sub-millisecond response times.

---

## 🛠️ Local Development & Setup Guide

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (or Colima on macOS)
- npm

### Option A: Local Native Run
```bash
# 1. Clone repository
git clone https://github.com/ranak8811/Dhaka-Tesla-Pool-Server.git
cd Dhaka-Tesla-Pool-Server

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Configure DATABASE_URL in .env

# 4. Run migrations and database seed
npx prisma db push
npm run db:seed

# 5. Start development server
npm run start:dev
# API will be active at http://localhost:4000/api/v1
```

### Option B: Local Docker Compose (One-Click Run)
```bash
# From the server directory
docker compose up --build
```
This boots PostgreSQL 16, automatically runs Prisma migrations, seeds Jashim and the passengers, and starts the NestJS API with zero manual setup.

### Running Automated Tests
```bash
npm test
```
All **65 Vitest unit tests** execute in $<1.5\text{s}$ with 100% pass rate.
