# Circle — Demo Script (final, 5-API cut)

**Length:** 10–12 minutes. **Pace:** slow. You hit Send on every request and let the response breathe. This is not a speedrun.

**Postman collection:** `Circle — demo flow (v2 Ajo)` — 5 requests, in order. Each proves one real guarantee.

---

### 0. Before you hit record

Reseed the demo world so the beats land:

```bash
cd apps/api
DATABASE_URL="postgresql://circle:circle@localhost:5432/circle" node prisma/seed.js
```

That puts Demo Day Ajo at exactly 1,000,000 / 1,050,000 — one honest tap from paying James — and funds every demo wallet.

Have ready: Postman open with the 5-request collection and variables cleared, two browser windows (main + incognito) for the live update, and the Expo dev build on the emulator.

Start recording on `/landing`. That's your title card.

---

### 1. Opening — `/landing` (0:00–0:40)

**[ON SCREEN: `/landing` — full tab, no other windows]**

> Hey, I'm Jason. This is Circle — group savings, built on trust. It's a modern take on Ajo. You form a small circle with people you trust, you all chip in the same amount on the same schedule, and the pot rotates until everyone has taken it once.
>
> I picked it for Abbey because it's not a toy CRUD app. It's money moving between people who know each other, and that forces the boring parts to be correct — ledgers, atomicity, fairness. Let me show you how it's built, then how it runs.

Hold on the landing for two beats. Then —

**[CUE: SWITCH TO — Excalidraw, fullscreen, 110% zoom]**

### 2. Architecture — the diagram is the script (0:40–2:40)

Touch each box as you name it. Don't read the diagram. Walk it like a request does.

> Top row is the surface: Web on React, Mobile on Expo. Same contract, two clients. Neither talks to Google for long — they hand the code to the middle and we hand back our own JWT.

> The middle is NestJS. It's doing two jobs: REST for everything you click, and a WebSocket gateway for everything that moves without a click. Google OAuth sits at the top. It just verifies who you are. We mint access and refresh tokens from there.

> Inside, three engines side by side. Wallet Service. Circle and Rotation Engine — that's the state machine. And the Scheduled Job. All three read and write two append-only ledgers: WalletTransaction on the wallet side, LedgerEntry plus CircleCycle on the circle side. Underneath it all, Postgres. No event store, no clever queue. Postgres transactions.

> On the right, the broadcaster. It owns nothing. The engines do the work, then they push. That's how the other tab updates without polling.

> The flow you care about goes like this. You tap Contribute. We open one database transaction. We debit your wallet. We credit the current cycle's pot. Both happen or neither does. Every write carries an idempotency key, so a retry on a bad network never double-charges. The tests prove it, and I'll show you live in Postman.

> Rotation is locked by people, not by a timer. A forming circle can invite all day. Nothing moves until the creator hits Activate. That freezes the roster, draws the order once — random by default, or the creator's manual order — and opens cycle one. After that, invites are closed. That's the answer to the first real Ajo question: who decides who goes first, and can someone sneak in after two payouts?

> The job watches. When a pot fills, it credits the right wallet and opens the next cycle. If auto-collect is off, it parks the pot and waits for a tap.

> State on the clients is boring on purpose. React Query. The server is truth, the cache is a mirror. When the server pushes — just joined, contribution, status changed, payout — the clients invalidate and re-read.

> One boundary, said once: funding here is a demo top-up. In production a rail like Paystack plugs in at the wallet seam. The ledgers never know the difference.

Half-second pause. Then —

**[CUE: SWITCH TO — Postman]**

### 3. Backend — five sends, five stories (2:40–5:30)

> Before I click anything: tokens are minted in request one for two real people. Ada creates and owns the circle. James joins it. Every request after borrows one of those two JWTs. You're watching two sessions.

**1 — Auth + Wallet. Who we are and what we have.**

Hit Send. Ada logs in. Inside the Tests tab, James is minted right behind her and the wallet is fetched.

> Two accounts, two tokens. Wallet is derived, not stored — summed from the ledger — and it starts funded for the demo. That's what the next taps spend.

**2 — Circle lifecycle. Create, invite, accept, lock.**

Hit Send. A Video Ajo appears: 10k daily, two members, twice weekly — goal auto-computes to a 140k pot.

> Invite goes to James. James accepts — notice the circle stays forming. That's on purpose. The roster isn't frozen until the creator locks it.

The same Tests tab fires accept, then activate.

> Now it's active. The order draws once and the schedule endpoint shows two cycles, cycle one collecting at 140k. After this point, no one else can join mid-rotation. Early and late members would otherwise collect different pots for the same buy-in.

**3 — Contribute. One atomic move.**

Hit Send. Ada contributes the full 140k pot in one tap.

> Watch the response: not replayed, wallet down 140k, circle balance at 140k. One transaction did both.

**4 — Same tap, no double charge — and the payout you get for free.**

Hit Send again. Same amount, same idempotency key you saw in the last request.

> Replay is true. Same ledger entry, same wallet debit. The audit shows exactly one 140k debit for this circle despite two writes. And because the pot just filled, the next calls already show cycle one paid and cycle two collecting. Payout happened without a second click.

**5 — Guards, discover, and the timeline.**

Hit Send. New cycle accepts a fresh 10k.

> Then the immediate re-tap fails — Next contribution opens in — cadence has teeth. Overdraw fails. Discover lists what James could still join. Notifications is the timeline the apps actually render.

Don't rush. You just proved idempotency, payout, and cadence in under a minute.

**[CUE: SWITCH TO — Web, http://localhost:5173/, logged in as James]**

### 4. Web — page by page, in the order a user meets them (5:30–8:30)

> Same two people, now through the product.

**Landing → Onboarding → Auth.** Already behind you. On the auth card, Join creates the account and routes new users to a one-field profile setup. Returning users skip it.

**Overview.** Greeting, four totals, a real growth chart, and the right rail in priority order: Rotation with who collects next and a countdown, Recent contributors pie, Needs your attention, Closest to goal, Hall of fame. Every number here is derived live.

**Circles.** My circles and Discover side by side. The table is live data. On the right, the create panel shows weekly pot math as you type — daily times seven times members. Create or join one live.

**Circle detail.** Hero balance, current pot bar with Next payout in, fixed-step button that greys out until your window opens, rotation schedule you can collect from, autopilot toggles. Members are tappable — each row opens a profile — then Invite finds people on the platform, history, and facts.

**Wallet.** Big emerald balance, in versus out, Fund and Withdraw sharing one amount, per-circle breakdown, then the full history. Fund and withdraw are both idempotent.

**Activity.** The notifications you saw in Postman, now as a timeline. New versus read, per-item tap into its circle, mark all read.

**People + Profile.** Grid of everyone, search by name or email, open Adaeze, invite her from the profile if you own a circle she can join.

**Settings.** Display name, light or dark, demo top-up chips, session.

**Live moment.** Keep this tab open. Contribute from the other session — or from the phone you are about to show — and watch this pot and balance move with no refresh. That's the gateway push. Say it once: no polling.

If Demo Day is still armed:

> This one sits at one million of one point zero five. One fifty kay from James finishes it and 1.05 lands straight to his wallet. That's not a counter. That's a ledger credit you'll see in Activity a second later.

**[CUE: SWITCH TO — Mobile — emulator, bottom tabs visible]**

### 5. Mobile — the same journey, thumb-shaped (8:30–10:15)

> Same app.

**Onboarding → Join.** Swipe, create with email and password, hit the one-field setup, land on Home.

**Home.** Greeting, hero now shows who collects next and in how many days, attention strip, closest, hall of fame, activity.

**Circles → Detail.** Open Lekki, show the same cycle card and countdown. Contribute the fixed step — watch it grey out with the next window.

**Wallet.** Balance, fund and withdraw, transactions. Same ledger, same rules.

**People.** Search, recent searches remembered, profile, invite.

**Bell.** Unread dot, per-item read, mark all read.

End on the callback:

> Tap Contribute here — fifty — and look back at the web tab. Same pot completing, same payout landing. Two surfaces, one ledger.

**[CUE: BACK TO — Web or Mobile, whichever feels warmer, then close to camera]**

### 6. Close (10:15–10:45)

> That's Circle. Append-only ledgers on both sides, atomic wallet to pot moves, creator-locked rotations no one can join halfway, contributions that respect the schedule, and everything live without polling. The Postman collection you just watched — those five sends — is in the repo so anyone can replay this exact run. Thanks for watching — happy to go deeper on any part.

### Shooting notes — don't skip

- Reseed right before you hit record so Demo Day is one tap from payout and James's wallet is clean.
- Log into mobile with email and password on camera. Don't tap Google in Expo Go. It will block before the picker and you will burn thirty seconds you don't have.
- Let responses breathe. The demo is five Sends, not nineteen. If you rush the second tap of request four, the replay proof vanishes.
