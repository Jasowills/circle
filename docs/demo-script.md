# Circle — Demo Script (final, 6-API cut)

**Length:** 10–12 minutes. **Pace:** slow. Hit Send, let the response land, read the Tests tab out loud. This is not a speedrun.

**Collection:** `Circle — demo flow (v2 Ajo)` — 6 requests, in order. Each proves one thing the app promises. Run them top to bottom.

---

### 0. Before you hit record

Reseed so the beats land. One command puts Demo Day Ajo at exactly 1,000,000 / 1,050,000 — one honest tap from paying James — and funds every demo wallet:

```bash
cd apps/api
DATABASE_URL="postgresql://circle:circle@localhost:5432/circle" node prisma/seed.js
```

Have ready: Postman with the 6-request collection and variables cleared, two browser windows (main + incognito) sharing one circle for the live update, and the Expo dev build on the emulator.

Start recording on `/landing`. That's your title card.

---

### 1. Opening — `/landing` (0:00–0:40)

**[ON SCREEN: `/landing` — full tab, nothing else open]**

> Hey, I'm Jason. This is Circle — group savings, built on trust. It's a modern take on Ajo. You find a few people you trust, you all put in the same small amount on the same schedule, and the pot rotates until everyone has taken it once.
>
> I picked it for Abbey because it's not a toy CRUD demo. It's money moving between people who know each other, and that makes the boring parts matter — ledgers, atomicity, fairness. Let me show you how it's built, then how it runs.

Hold two beats. Then —

**[CUE: SWITCH TO — Excalidraw, fullscreen, 110% zoom]**

### 2. Architecture — the diagram is the script (0:40–2:30)

Touch each box as you name it. Walk it like a request does.

> Top row is the surface: Web on React, Mobile on Expo. Same contract, two clients. Neither talks to Google for long — they hand the code to the middle and we give back our own JWT.

> The middle is NestJS. It does two jobs: REST for everything you click, and a WebSocket gateway for everything that moves without a click. Google OAuth sits at the top. It just verifies who you are. We mint access and refresh tokens from there.

> Inside, three engines side by side. Wallet Service. Circle and Rotation Engine — that's the state machine. And the Scheduled Job. All three sit over two append-only ledgers: WalletTransaction on the wallet side, LedgerEntry plus CircleCycle on the circle side. Underneath it all, Postgres. No event store, no clever queue. Postgres transactions.

> On the right, the broadcaster. It owns nothing. The engines do the work, then they push. That's how the other tab updates without polling.

> The flow you care about goes like this. You tap Contribute. We open one transaction. We debit your wallet. We credit the current cycle's pot. Either both happen or neither does. Every write carries an idempotency key, so a retry on a bad network never double-charges. The tests prove it, and I'll show you live in a second.

> Rotation is locked by people, not by a timer. A forming circle can invite all day. Nothing moves until the creator hits Activate. That freezes the roster, draws the payout order once — random by default, manual if the creator set it — and opens cycle one. After that, invites are closed. That's the answer to the first real Ajo question: who decides who goes first, and can someone sneak in after two payouts?

> The job watches. When a pot fills, it credits the right wallet and opens the next cycle. If auto-collect is off, it parks the pot and waits for your tap.

> State on the clients is boring on purpose. React Query. Server is truth, cache is a mirror. When the server pushes — contribution, member joined, payout — the clients invalidate and re-read.

> One boundary, said once: funding here is a demo top-up. In production a rail like Paystack plugs in at the wallet seam. The ledgers never know the difference.

Half-second pause. Then —

**[CUE: SWITCH TO — Postman]**

### 3. Backend — six sends, six stories (2:30–5:30)

> Before I click anything: tokens are minted right here. Request one logs in Ada — she's the creator. The Tests tab quietly mints James behind it, so the next five requests are two real people using the same circle. Watch the variables fill as we go.

**1 — Dev login. Who we are.**

Hit Send on *1. Dev login — Ada*.

> Ada gets a JWT. James gets his too — check the Tests tab, you'll see both tokens set. Every request after this borrows one of them. No mock auth, no header tricks.

**2 — Wallet. What we have, and why it's safe to spend.**

Hit Send on *2. Wallet — derived balance*.

> No balance column anywhere. The response sums the wallet ledger. Ada starts funded for the demo — that's the demo-fund transaction you see in the history. That's what the next tap will spend.

**3 — Circle. What we're saving toward, on what schedule.**

Hit Send on *3. Create circle — 10k daily, 2 members*.

> Video Ajo appears. Ten thousand a day, two members, twice weekly. Goal auto-computes: 10k times seven days times two people — 140k pot. Invite goes to James, James accepts but the circle stays forming. Then I hit Activate — the creator locks it. Order draws once, schedule shows two cycles, cycle one collecting at 140k. After this, no one else can join mid-rotation. Early and late members would otherwise collect different pots for the same buy-in.

**4 — Contribute. One daily step, one atomic move.**

Hit Send on *4. Contribute — one daily step (10k) with idempotency*.

> Ada pays her 10k. Watch: not replayed, entry amount is exactly 10k — the same 10k the circle said a day costs. Wallet down one step, pot up one step. One transaction did both. If this failed halfway, you'd have money missing with nothing credited, or vice versa — so it has to be all or nothing. The key you see in the body is what makes a retry safe.

**5 — Same tap, no double charge.**

Hit Send on *5. Replay same tap*.

> Same amount, same key you just saw. Replay is true. Same ledger entry. Then the wallet audit: exactly one 10k debit for this circle despite two writes. On a flaky mobile network, that one signal matters more than any animation.

**6 — Why you can trust the walls.**

Hit Send on *6. Authorisation — outsider and no-token both fail*.

> Bad token is a 401. No token is a 401. Then we mint a stranger on the fly — Outsider — and ask for Ada's circle. That's a 403. The circle is closed to anyone not in it. Those two failures are the proof.

Don't rush four and five. The second tap of four and the first tap of five are the same key — let that sink in before you move.

**[CUE: SWITCH TO — Web, http://localhost:5173/, logged in as James]**

### 4. Web — in the order a user meets it (5:30–8:30)

> Same two people, now through the product.

**Login → Overview.** Greeting, four totals, a real growth chart for the last fourteen days, and the right rail in priority order: Rotation with who collects next and a countdown, Recent contributors pie, Needs your attention, Closest to goal, Hall of fame. Every number here is derived live.

**Circles.** My circles and Discover side by side. The table is live data. On the right, the create panel shows weekly pot math as you type. Create or join one live.

**Circle detail.** Hero balance, current pot bar with Next payout in, fixed-step button that greys out until your window opens — it literally says Next contribution opens in and the button dims — rotation schedule you can collect from when auto-collect is off, autopilot toggles, members who are now tappable, Invite that finds people on the platform, history, and facts.

**Wallet.** Big emerald balance, in versus out, Fund and Withdraw sharing one amount, per-circle breakdown, then the full history. Both directions are idempotent.

**Activity.** The timeline you just saw in the API, now as a feed. New versus read, per-item tap into its circle, mark all read.

**People + Profile.** Grid of everyone, search by name or email, open Adaeze, invite her from the profile if you own a circle she can join.

**Settings.** Display name, light or dark, demo quick-fund chips, session.

**Live moment.** Keep this tab open. Contribute from the other session — or from the phone you are about to show — and watch this pot and balance move with no refresh. That's the gateway push. Say it once: no polling.

If Demo Day is still armed:

> This one sits at one million of one point zero five. One fifty kay from James finishes it and 1.05 lands straight to his wallet. That's not a counter. That's a ledger credit you'll see in Activity a second later.

**[CUE: SWITCH TO — Mobile — emulator, bottom tabs visible]**

### 5. Mobile — same journey, thumb-shaped (8:30–10:15)

> Same app.

**Onboarding → Join.** Swipe, create with email and password, hit the one-field setup, land on Home.

**Home.** Greeting, hero now shows who collects next and in how many days, attention strip, closest, hall of fame, activity.

**Circles → Detail.** Open Lekki, show the same cycle card and countdown. Contribute the fixed 10k step — watch it grey out with the next window.

**Wallet.** Balance, fund and withdraw, transactions. Same ledger, same rules.

**People.** Search, recent searches remembered, profile, invite.

**Bell.** Unread dot, per-item read, mark all read.

End on the callback:

> Tap Contribute here — ten — and look back at the web tab. Same pot ticking up one daily step. Two surfaces, one ledger.

**[CUE: BACK TO — Web or Mobile, whichever feels warmer, then close to camera]**

### 6. Close (10:15–10:45)

> That's Circle. Append-only ledgers on both sides, atomic wallet-to-pot moves, creator-locked rotations no one can join halfway, contributions that respect the schedule you set, and everything live without polling. The Postman collection you just watched — those six sends — is in the repo so anyone can replay this exact run. Thanks for watching — happy to go deeper on any part.

### Shooting notes — don't skip

- Reseed right before you hit record so Demo Day is one tap from payout and James's wallet is clean.
- Log into mobile with email and password on camera. Don't tap Google in Expo Go. It will block before the picker and you will burn thirty seconds you don't have.
- Let responses breathe. Six Sends, not nineteen. If you rush the second tap of item four, the replay proof vanishes.
