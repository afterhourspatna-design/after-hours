# After Hours Gaming Parlour — Management System

A premium, high-performance PWA for managing gaming parlour operations. Built with **Next.js 15**, **Prisma**, **PostgreSQL**, and **NextAuth.js**.

---

## 🎮 Core Functionalities

### 1. Multi-Role Dashboard
*   **Admin**: Full control over revenue analytics, staff accounts, game catalog, and system settings.
*   **Staff**: Streamlined interface for managing daily bookings, searching customers, and checking unit availability.
*   **Customer**: (Optional Portal) Allows customers to view their booking history and book sessions online.

### 2. Intelligent Booking System
*   **Real-time Calendar**: Visual drag-and-drop calendar for tracking all active and upcoming sessions.
*   **Smart Hold Logic**: Bookings automatically go on a **15-minute hold** until payment is confirmed or staff approves.
*   **Resource Management**: Automatically generates resource units (e.g., Console 1, PC 5) for games.
*   **Walk-in & Registered**: Support for quick guest bookings (walk-ins) and permanent customer accounts.

### 3. Comprehensive Management
*   **Game Catalog**: Manage games with custom pricing, descriptions, and automatic resource unit scaling.
*   **User/Staff Control**: 10-digit phone validation, secure password hashing, and role-based permissions.
*   **Revenue Tracking**: Track earnings across different time periods (Today, Week, Month).

### 4. Premium User Experience
*   **Aesthetic Design**: Sleek dark-mode interface with glassmorphism and smooth micro-animations.
*   **PWA Ready**: Installable on mobile and desktop for a native-app feel.
*   **Optimized Performance**: Optimized database queries and centralized Prisma connection pooling for snappiness.

---

## 🛠️ Technology Stack
*   **Frontend**: Next.js 15 (App Router), Tailwind CSS, Lucide Icons.
*   **Backend**: Next.js Server Actions & API Routes.
*   **Database**: PostgreSQL with Prisma ORM.
*   **Auth**: NextAuth.js v5 (JWT Strategy).
*   **UI Components**: Sonner (toasts), Lucide (icons), custom glassmorphism system.

---

## 🚀 Deployment Guide (Step-by-Step)

### Step 1: Prepare Environment Variables
Create a `.env` file in your production environment with the following:
```env
# Database
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"

# Auth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-random-32-char-secret"

# Feature Flags
NEXT_PUBLIC_FEATURE_CUSTOMER_PORTAL="true"
```

### Step 2: Database Setup
1. Ensure your PostgreSQL instance is running.
2. Run migrations to create the schema:
   ```bash
   npx prisma migrate deploy
   ```
3. (Optional) Seed the initial admin account:
   ```bash
   npx prisma db seed
   ```

### Step 3: Build the Application
Run the build command to generate an optimized production bundle:
```bash
npm run build
```

### Step 4: Deploy (Choose your platform)

#### Option A: Vercel (Recommended)
1. Push your code to GitHub/GitLab.
2. Connect the repo to Vercel.
3. Add the Environment Variables in the Vercel Dashboard.
4. Vercel will handle the build and deployment automatically.

#### Option B: VPS (Docker)
Use the included `docker-compose.yml`:
```bash
docker-compose up -d --build
```

### Step 5: Post-Deployment Verification
1. Access your domain.
2. Log in with the Admin credentials.
3. Verify that the Sidebar and Dashboard load without errors.
4. Test a "Guest Booking" to ensure the database connection is stable.

---

## 🔒 Security Best Practices
*   **Passwords**: All staff and user passwords are encrypted using `bcryptjs`.
*   **Middleware**: Routes are protected by a role-gate in `middleware.ts`.
*   **API Security**: Critical API routes check for active sessions before performing operations.
