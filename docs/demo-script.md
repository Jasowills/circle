# Circle — Demo Video Script (v3, shooting script)
Target length: 10–12 minutes. Supersedes v2. Follows the Postman collection
(`Circle — demo flow (v2 Ajo)`, 19 requests) sequentially, then walks every
page of web and mobile in the order a user meets them.

## 0. Prep before recording

- Reseed: `node prisma/seed.js` in `apps/api` (restores Demo Day Ajo to
  1,000,000/1,050,000 and all demo wallets).
- API on `:3000`, web on `:5173`, emulator booted with the Expo dev build.
- Postman collection open, variables empty (tokens mint on requests 1–2).
- Two browser sessions ready (main + incognito) sharing one circle, for the
  live-update moment.

## 1. Intro (0:00–0:50)

> "Hi, I'm Jason — this is my submission for Abbey's Full Stack Engineer
> challenge. I built **Circle**, a digital version of Ajo — the traditional
> Nigerian rotating savings system, also called Esusu or thrift. A group
> contributes fixed amounts on a schedule, and each cycle one member takes
> the whole pot, until everyone has collected.
>
> I picked it because it's genuinely relevant to Abbey's world, and because
> money movement plus group trust is a domain worth engineering properly —
> not a themed CRUD app. Plan: backend first through Postman, then every
> page of the web app in order, then the same journey on mobile."

## 2. Architecture (0:50–2:50)

> "Four decisions I'd want a reviewer to notice. **One: every balance is
> derived, never stored** — wallets and circle pots are sums over
> append-only ledgers, which gives a full audit trail and removes an entire
> class of race bugs. **Two: contributing is one atomic transaction** —
> wallet debit plus pot credit, all or nothing, guarded by an idempotency
> key you'll see me replay in a minute. **Three: the rotation is locked
> explicitly** — the creator activates the circle when the roster is set,
> the payout order draws once, and nobody can join mid-rotation after that.
> **Four: a scheduled job watches every cycle** — full pot means automatic
> payout and advance, no manual step.
>
> One boundary, stated once: wallet funding here is a demo top-up. In
> production a provider like Paystack plugs in at exactly that seam —
> the ledger and rotation logic never change."

## 3. Backend, request by request (2:50–5:30)

> "Everything I'm about to click runs top to bottom, 19 requests. First,
> authentication: requests 1 and 2 mint JWTs for two test users — Ada, who
> will create and own the circle, and James, who will join it. Every later
> request reuses those tokens, so you're watching two real sessions."

1. **Requests 1–3 — auth.** Dev-login both users, `GET /me` proves the JWT.
2. **Requests 4–5 — wallet.** Derived balance plus the demo-fund transaction in history, then a fresh 100k top-up.
3. **Requests 6–10 — the circle lifecycle.** Create a rotation circle (10k daily, 2 members, twice weekly — note the goal auto-computes to a 140k pot), invite James, James accepts *and stays forming*, creator activates to lock the rotation, then the schedule endpoint showing the locked order with cycle 1 collecting.
   > "That accept-then-activate split is the fairness guarantee: nobody pays into a pot whose payout order doesn't exist yet."
4. **Requests 11–13 — the idempotency demo, slow down.** Contribute 140k, show the wallet drop and pot fill. Fire the identical request again: `replayed: true`, same entry, balance untouched. Wallet audit shows exactly one debit.
   > "On a flaky mobile network with real money moving, a retried tap must never double-charge. This is that proof."
5. **Request 14 — payout.** Cycle 1 completes, cycle 2 opens automatically.
6. **Requests 15–16 — cadence.** A fresh-cycle tap is accepted; the immediate re-tap fails with *Next contribution opens in…* — the schedule is enforced, not suggested.
7. **Requests 17–19 — guards and discovery.** A nine-figure tap fails on insufficient balance, Discover lists open circles, Notifications shows the timeline the apps render.

## 4. Web app, page by page (5:30–8:30)

> "Same two users, now through the product. I land on…"

1. **Login / onboarding.** Three auto-advancing slides, then Join vs Sign in — one Continue with Google, one email form. "Join creates the account and routes new users to profile setup; returning users skip it."
2. **Overview.** Greeting, four stat tiles, growth chart, and the right rail in priority order: Rotation (most urgent payout first), Recent contributors pie, Needs your attention, Closest to goal, Hall of fame. "Every number here is derived live — no cached balances anywhere."
3. **Circles.** My/Discover tabs, data table, and the create panel with the weekly-pot math preview. Create or join one live.
4. **Circle detail.** Hero balance, current-cycle pot bar with countdown, fixed-step contribute button (greyed with reopen time when the cadence blocks you), rotation schedule, autopilot toggles, members with profiles.
5. **Wallet.** Balance, in/out totals, Fund and Withdraw side by side, per-circle breakdown, transaction history.
6. **Activity.** The notifications timeline, per-item read states, mark-all-read.
7. **People + profile.** Platform search, open Adaeze, invite her somewhere from the profile.
8. **Settings.** Profile, appearance toggle, demo tools, session.
9. **Live-update moment.** With the second session open: contribute in Tab B, watch Tab A's pot and balance move with no refresh. "WebSocket — no polling."
10. **Payout beat (if armed).** On Demo Day Ajo, James's single ₦50k tap completes the pot — show the ₦1.05M landing in his wallet. Best possible closing image for this section.

## 5. Mobile app, same journey (8:30–10:30)

> "Same app, thumb-shaped. Bottom tabs: Home, Circles, Wallet, People, Settings."

1. **Onboarding + Join.** Swipe the slides, create the account with email and password, land on profile setup, then Home.
2. **Home.** Greeting, next-payout hero, attention card, closest-to-goal, hall of fame, activity.
3. **Circles + detail.** Open Lekki, show the cycle card, countdown, schedule, members with tappable profiles. Contribute the fixed step.
4. **Wallet tab.** Balance, fund and withdraw, transactions.
5. **Notifications bell.** Unread badge, per-item read, mark-all-read.
6. **Callback beat.** Contribute on mobile, show it land on the still-open web tab.

## 6. Close (10:30–11:00)

> "That's Circle — rotating savings with production discipline: immutable audit trails on both ledgers, atomic idempotent money movement, creator-locked rotations nobody can join halfway, scheduled contributions with teeth, and real-time everything. The repo is public on GitHub, the README gets it running from a clean clone, and the Postman collection you just watched is committed alongside the code so anyone can replay this exact demo. Thanks for the opportunity — happy to go deeper on any part."

## Delivery notes

- Rehearse requests 11–14 once; the replay-then-payout chain is the highest-value 60 seconds and the easiest to fumble.
- Reseed right before recording so Demo Day Ajo is armed and James's wallet is fresh.
- Mobile login on camera is email + password — Google sign-in needs a dev build, not Expo Go. Say nothing about it; just log in.
- Keep the architecture to ~2 minutes. The diagram is your voice, not a second script.
