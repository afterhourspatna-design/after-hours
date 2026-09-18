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

### Phase A: Schema (`prisma db push`)
This project does not use Prisma migration files. Do NOT run `prisma migrate deploy`.
Schema changes are applied to production with `prisma db push`, by one person, from `main`.

1. Back up the production database (`pg_dump` or a host snapshot).
2. Preview the SQL a push would run, and read it:
   ```bash
   npm run db:diff
   ```
3. Apply it. If Prisma warns about data loss, stop and review. Never pass `--accept-data-loss` without reading the diff.
   ```bash
   npx prisma db push
   ```

> **Warning:** the Prisma CLI reads `DATABASE_URL` from `.env`. If your `.env` points at the production database, then `npx prisma db push` (and `npm run db:push`) run against production, from any branch. Check which database `.env` points at before running any Prisma command, and prefer a separate local database for development.

Rules:
- Only push from `main`, after the PR is merged.
- Additive changes (new tables, nullable or defaulted columns) are safe. Renames, drops, type changes and new required columns on existing tables need hand-written SQL: save it under `scripts/sql/` and run it before updating the schema.
- Do not run ad-hoc queries against production without saving them in the repo.
- Develop against a separate local database, not production. After pulling `main`, run `npx prisma db push` against that local database to keep it in sync.

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
