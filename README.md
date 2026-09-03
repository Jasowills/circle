# Circle — event-sourced group savings

Submission for the **Abbey Mortgage Bank Full Stack Engineer Challenge**.
Users form small trusted "circles" and contribute toward one shared savings goal
(e.g. a mortgage deposit). Balances are **derived from an immutable ledger**, never
stored as a mutable column.

| Pillar | Implementation |
|---|---|
| Authentication | Google OAuth 2.0 only. Backend issues its own JWT access + refresh pair. Refresh token in httpOnly cookie on web, `expo-secure-store` on mobile. `POST /auth/logout` revokes server-side. |
| Accounts | User profile (Google: name, email, avatar) + derived wallet per circle (`SUM(ledger)`). |
| Relationships | Circle membership `invited → active`, roles `creator/member`, circle state machine `forming → active → goal_reached → closed` (server-enforced in `CircleStateService`). |

**Platforms:** web (React + TS) + mobile (React Native + Expo) against one NestJS API.

## The one detail worth knowing

`LedgerEntry` rows are **append-only**. There is no `ledgerEntry.update` / `ledgerEntry.delete`
anywhere in the codebase — corrections are new `adjustment` rows. Contributions are
**idempotent**: the client sends a UUID `idempotencyKey`; retries return the original row
(`replayed: true`) instead of double-writing. The demo video shows both in Postman.

## Quick start (clean clone)

Prerequisites: Node 20+, Docker, (for mobile) Expo Go on an emulator/device.

```bash
# 1. Database
docker compose up -d postgres

# 2. API (http://localhost:3000)
cd apps/api
cp .env.example .env
npm install
npx prisma migrate dev        # creates tables
npm run start:dev

# 3. Web (http://localhost:5173) — new terminal
cd apps/web
cp .env.example .env
npm install
npm run dev

# 4. Mobile — new terminal
cd apps/mobile
cp .env.example .env
npm install
npx expo start                # scan QR with Expo Go, or press `a`/`i` for emulator
```

### Without Google credentials (local demo)

The full Google OAuth flow needs a Google Cloud client ID/secret
(`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `apps/api/.env`, plus
`EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` in `apps/mobile/.env`). Until those are set:

- `POST /auth/dev-login {email, name?}` issues a real JWT pair — the web login
  page and the mobile login screen both expose this. Every downstream path
  (circles, ledger, idempotency, state machine, WebSockets) is identical.
- Google routes return a clear error instead of crashing when unconfigured.

Set `ALLOW_DEV_LOGIN=false` in production.

### API smoke test (Postman or curl)

Import `apps/api/circle.postman_collection.json` — it runs the whole demo flow
top to bottom with assertions, including the idempotency replay (requests 7–8)
and the "exactly 2 entries despite 3 writes" ledger check (request 11).
Or by hand:

```bash
A=$(curl -s -X POST localhost:3000/auth/dev-login -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
B=$(curl -s -X POST localhost:3000/auth/dev-login -H 'Content-Type: application/json' \
  -d '{"email":"bayo@example.com"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

# create → invite → accept (circle flips forming → active on 2nd active member)
CID=$(curl -s -X POST localhost:3000/circles -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d '{"name":"Mortgage deposit","goalAmount":1000}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -X POST localhost:3000/circles/$CID/invite -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d '{"email":"bayo@example.com"}' > /dev/null
curl -s -X POST localhost:3000/circles/$CID/accept -H "Authorization: Bearer $B" > /dev/null

# contribute, then fire the SAME request again → replayed:true, no duplicate
KEY=$(python3 -c "import uuid;print(uuid.uuid4())")
curl -s -X POST localhost:3000/circles/$CID/contribute -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d "{\"amount\":400,\"idempotencyKey\":\"$KEY\"}"
curl -s -X POST localhost:3000/circles/$CID/contribute -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d "{\"amount\":400,\"idempotencyKey\":\"$KEY\"}"
```

Full endpoint list: `GET /auth/google`, `GET /auth/google/callback`,
`POST /auth/google/id-token` (mobile), `POST /auth/refresh`, `POST /auth/logout`,
`GET /me`, `POST /circles`, `GET /circles`, `GET /circles/:id`,
`POST /circles/:id/invite|accept|contribute|close`, `GET /circles/:id/ledger`,
WebSocket room `circle:<id>` (`join` with `{circleId, token}` →
`contribution.created`, `member.joined`, `circle.status_changed`).

## Architecture

```
apps/api/src
  auth/       Google OAuth (passport) + ID-token verify (mobile) + JWT pair + rotation
  circles/    CRUD, invite/accept, CircleStateService (the ONLY place transitions live)
  ledger/     the ONLY ledger write path — idempotent append, no update/delete exists
  realtime/   Socket.IO gateway (rooms circle:<id>) + decoupled CircleEvents bus
  progress/   @Cron recompute job — safety net behind synchronous transitions
apps/web      React + React Query + socket.io-client (full feature set incl. create)
apps/mobile   Expo + same API (view, contribute, live feed; create lives on web)
```

- **Derived, never stored:** circle balance = `SUM(amount)`, progress = balance/goal.
- **State machine** (`forming → active` on ≥2 active members, `active → goal_reached`
  when the sum crosses the goal, creator-only `→ closed`) runs synchronously on
  writes; the cron job re-runs it every 2 min (`PROGRESS_CRON`) as a safety net.
- **Observability:** structured JSON logs on the ledger write path (`ledger.appended`,
  `ledger.replayed`), transitions (`circle.status_changed`) and WS broadcasts
  (`ws.broadcast`) — grep one `circleId` to trace any discrepancy end to end.
- **Tests:** `npm test` in `apps/api` runs unit (state machine) + in-process e2e
  (auth → invite/accept → idempotent writes → live WS event → audit trail).
  Needs Postgres up and `ALLOW_DEV_LOGIN=true`.

## Documented trade-offs

1. **Circle creation UI is web-only.** Mobile covers auth, list, detail, contribute,
   live feed (per the brief's "as simple as possible"); creation from mobile is a
   small follow-up since it hits the same `POST /circles`.
2. **`accepted` vs `active`:** invites flip `invited → active` atomically on accept
   (passing through `accepted` semantically); the enum keeps `accepted` for a future
   two-step onboarding.
3. **Refresh tokens are opaque** (hashed at rest, rotated on use) rather than JWTs —
   simpler revocation story for a savings app.
4. **No payment gateway / passwords / multi-currency / payouts** — explicitly out of
   scope; contributions record intent against the ledger.

## Deploy

- API → Azure App Service (or Render/Railway): set `DATABASE_URL`, JWT secrets,
  Google creds, `WEB_APP_URL`, `ALLOW_DEV_LOGIN=false`; run `prisma migrate deploy`.
- Web → Azure Static Web Apps (or Vercel) with `VITE_API_URL` pointing at the API.
- Mobile → Expo EAS build, or run locally in an emulator for the demo video.

## Submission checklist

- [x] Ledger genuinely append-only (no update/delete paths in code)
- [x] Idempotency demonstrably prevents duplicates (`replayed: true`)
- [x] WebSocket live updates (verified: `contribution.created` received live)
- [x] State machine `forming → active → goal_reached` (verified via API)
- [x] Google OAuth end-to-end (web + mobile ID-token path; dev-login for local demo)
- [ ] Hosted and reachable (deployment step)
- [ ] Demo video: browser + Postman + mobile emulator
- [ ] Email to c.nnadika@abbeymortgagebank.com before Tue 8th Sept 2026, 12:00pm
- [ ] "Pre-Interview form (007).docx" filled and returned
