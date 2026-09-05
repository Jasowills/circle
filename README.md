# Circle

Event-sourced group savings, modeled on the Nigerian Ajo rotating savings system. Members contribute fixed daily steps toward weekly pots; each cycle pays one member in rotation order until everyone has collected.

| Pillar | Implementation |
|---|---|
| Authentication | Google OAuth 2.0 + email/password (bcrypt). JWT access + rotating refresh pair, server-side logout. |
| Accounts | Profile plus one derived wallet per user. Balances are computed, never stored. |
| Relationships | Circle membership with roles, a server-enforced rotation state machine, and live updates. |

## Design notes

- **Append-only ledgers.** `LedgerEntry` and `WalletTransaction` are never updated or deleted. Corrections are new rows.
- **Atomic contributions.** Each tap debits the wallet and credits the cycle pot in one Postgres transaction, guarded by an idempotency key and the circle's cadence rules.
- **Locked rotations.** The creator activates the circle, freezing the roster and drawing the payout order once. No mid-rotation joiners.
- **Derived everything.** Balances, pot progress, and notifications are computed from history, not stored.

## Run it

Prerequisites: Node 20+, Docker. For mobile: Expo Go or an emulator.

```bash
docker compose up -d postgres

cd apps/api && cp .env.example .env && npm install
npx prisma migrate dev && npm run start:dev

cd apps/web && cp .env.example .env && npm install && npm run dev
# → http://localhost:5173

cd apps/mobile && cp .env.example .env && npm install && npx expo start
```

Seed the demo world (rotation circles, funded wallets, payout moments):

```bash
cd apps/api
DATABASE_URL="postgresql://circle:circle@localhost:5432/circle" node prisma/seed.js
```

Demo accounts: `james@circle.com` / `12345678`, or any `@circle.com` address via Google OAuth once client IDs are configured (see `apps/api/.env.example`).

## Layout

```
apps/api     NestJS + Prisma + PostgreSQL + Socket.IO
apps/web     React + TypeScript + React Query
apps/mobile  React Native (Expo) + React Query
```

## Deploy

API to App Service (or Render/Railway) with `prisma migrate deploy`, `ALLOW_DEV_LOGIN=false`, and real secrets — production refuses to boot without them. Web to Static Web Apps (or Vercel) with `VITE_API_URL` set. Mobile via EAS build.
