# Project Init: After Hours Gaming Parlour

The **After Hours Gaming Parlour** management system is a premium, high-performance web application designed for gaming parlours. It features a multi-role layout (Admin, Staff, Customer), real-time booking calendars, custom progressive-style pricing calculations, database tracking, and automatic resource unit assignment.

---

## 📂 Project Structure

Here is an overview of the key directories and files in the codebase:

```text
after-hours/
├── app/                      # Next.js 15 App Router pages & layouts
│   ├── (auth)/               # Authentication pages (Login, Signup)
│   ├── admin/                # Admin portal pages (Dashboard, bookings, reports, settings)
│   ├── staff/                # Staff portal pages (Daily bookings, calendar, check-ins)
│   ├── customer/             # Customer portal pages (Booking history, feedback)
│   ├── api/                  # API routes for backend endpoints
│   ├── globals.css           # Global CSS and Design Tokens
│   ├── layout.tsx            # Main layout wrapper with context providers
│   └── page.tsx              # Landing / routing logic page
├── components/               # Reusable UI & Layout Components
├── lib/                      # Business logic, helpers, and utilities
│   ├── auth-helpers.ts       # Auth checking and validation helper methods
│   ├── booking-helpers.ts    # Booking availability checks & hold expiry logic
│   ├── pricing.ts            # Detailed pricing and discount calculations
│   ├── prisma.ts             # Centralized database client connection pooling
│   ├── utils.ts              # Global formatters and Tailwind helper classes
│   └── whatsapp.ts           # Text templates for WhatsApp booking confirmations
├── prisma/                   # Database modeling & migrations
│   ├── schema.prisma         # Prisma database schema definition
│   ├── seed.ts               # Database seed script for mock data
│   └── update-ps5.ts         # Script for updating specific PS5 database features
├── public/                   # Static assets & PWA configuration files
├── auth.ts                   # NextAuth.js configuration
├── auth.config.ts            # NextAuth middleware options
├── package.json              # NPM dependencies & task run scripts
├── tailwind.config.ts        # Tailwind styling themes and custom properties
└── tsconfig.json             # TypeScript configuration
```

---

## 🎮 Core Features

1. **Multi-Role Portal**:
   - **Admin**: Revenue analytics, reports, staff management, game catalog configuration, global settings, and coupon codes.
   - **Staff**: Interactive calendar dashboard, customer search, snack ordering, and booking updates.
   - **Customer**: Manage profile, view booking history, and submit feedback.
2. **Intelligent Booking Engine**:
   - **Real-Time Calendar**: Interactive calendar view for booking sessions and checking availability.
   - **Hold & Hold Expiry**: Holds bookings temporarily (default: 15 minutes) pending payment confirmation. Stale holds are automatically expired using server utilities.
   - **Resource Allocation**: Automatic assignment of free resource units (e.g. *PS5 - Unit 1*, *Pool Table - 2*) to avoid overbookings.
3. **Advanced Pricing Logic (`lib/pricing.ts`)**:
   - Custom, game-specific rate structures (e.g., PS5 controller count surcharges, event hourly rates based on Peak/Off-peak times).
   - Coupon codes supporting both percentage and fixed amount discounts.
4. **WhatsApp Integration (`lib/whatsapp.ts`)**:
   - Standard booking confirmation text generator supporting localized dates, times, and payment status.
5. **Referral Reward System**:
   - Rewards tracking system on `AppUser` for user-referred signups.

---

## 🚀 How to Run & Set Up

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **PostgreSQL** database (running locally, inside Docker, or via a cloud provider like Supabase/Railway)

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
# Database connection
DATABASE_URL="postgresql://username:password@localhost:5432/afterhours?schema=public"

# Authentication secret (Generate using: openssl rand -base64 32)
NEXTAUTH_SECRET="your-32-character-secret"
NEXTAUTH_URL="http://localhost:3000"

# Feature Flags
NEXT_PUBLIC_FEATURE_CUSTOMER_PORTAL="true"
```

### 3. Install Dependencies
```bash
npm install
```
*Note: The `postinstall` script runs `prisma generate` automatically to set up the Prisma client types.*

### 4. Database Setup & Seeding
Push the schema structure to your database and seed it with test accounts:
```bash
# Push schema changes
npm run db:push

# Run seed script
npm run db:seed
```

### 5. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🔑 Seed User Accounts
You can test the system using these pre-seeded accounts:

| Role | Username / Email | Password | Phone |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@afterhours.in` | `admin123` | `+91-300-1111111` |
| **Staff** | `bilal@afterhours.in` | `staff123` | `+91-300-2222222` |
| **Staff** | `sara@afterhours.in` | `staff123` | `+91-300-3333333` |
| **Customer** | `ahmed@example.com` | `customer123` | `+91-333-1001001` |
| **Customer** | `fatima@example.com` | `customer123` | `+91-333-2002002` |
