# Deployment Checklist & Guide

Follow these steps to deploy the **After Hours Gaming Parlour** application to a production environment.

## 1. Database Provisioning
You need a PostgreSQL database. You can use:
*   **Vercel Postgres** (Easy integration)
*   **Supabase** (Free tier available)
*   **Railway/Render** (Managed PostgreSQL)
*   **Self-hosted Docker** (Using the provided `docker-compose.yml`)

**Note:** Ensure your database URL includes `?sslmode=require` if using a cloud provider.

## 2. Environment Configuration
Set these variables in your hosting provider's dashboard (e.g., Vercel, Netlify, or your VPS `.env`):

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Full connection string | `postgresql://...` |
| `NEXTAUTH_SECRET` | 32+ character random string | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your production URL | `https://afterhours.com` |
| `NODE_ENV` | Environment mode | `production` |

## 3. Deployment Steps

### Phase A: Migration
Before the app goes live, the database schema must be applied.
```bash
# Run this on your CI/CD or locally once
npx prisma migrate deploy
```

### Phase B: Build & Start
If you are using a standard Node.js environment:
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the production server
npm start
```

## 4. Troubleshooting
*   **White Screen / 500 Error**: Check if `DATABASE_URL` is correct and the database is accessible from your host.
*   **Login Loops**: Ensure `NEXTAUTH_URL` matches your actual domain exactly (including `https://`).
*   **Missing Icons**: Ensure all dependencies were installed with `npm install`.

## 5. Maintenance
*   **Backups**: Schedule daily backups of your PostgreSQL database.
*   **Logs**: Monitor Vercel logs or Docker logs (`docker logs -f afterhours_app`) for any runtime errors.
