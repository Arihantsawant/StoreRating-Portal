# StoreRating Portal

React, Express, and PostgreSQL application for role-based store ratings.

## Run locally

1. Copy `server/.env.example` to `server/.env` and set a strong `JWT_SECRET`.
2. Start PostgreSQL, create the `store_rating_portal` database, then run `pnpm install`, `node server/src/migrate.js`, `pnpm run seed`, and `pnpm run dev`.
3. Open `http://localhost:5173`. Seed login: `admin@storerating.local` / `Welcome@123`.

## Deploy

Set `JWT_SECRET` (32+ random characters) and a strong `POSTGRES_PASSWORD` in a root `.env`, then run `docker compose up --build`. Before public deployment, replace the seeded password and use a managed PostgreSQL database with backups.
