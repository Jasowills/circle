# Circle — Demo Script (final)

Total: ~9 minutes. Keep it conversational, not presentational.

## Cue 0 — On screen: /landing — full tab, no other windows
0:00 - 0:35 — Intro

> Hey, I'm Jason. This is Circle. The pitch is simple: group savings, built on trust. It's a modern Ajo — you gather a small circle of people you trust, you all put in the same amount on the same schedule, and the pot rotates until everyone has taken it once.
>
> I chose it for Abbey because it's not a generic CRUD demo. It's money moving between people who know each other, and that forces you to get the boring parts right: ledgers, atomicity, fairness. I'll show you the thinking, then the thing working.

Stay on /landing for two beats after that line. Then —

## Cue 1 — Switch to: Excalidraw diagram — fullscreen, 110% zoom
0:35 - 2:30 — Architecture. Touch each box as you name it.

> Let's walk the diagram the way a request actually walks the system.
>
> Top row is the surface: Web on React, Mobile on Expo. Same contract, two clients. Neither talks to Google directly for long — they hand the code to the middle.
>
> That middle is NestJS. It's both a REST API and a WebSocket gateway. Google OAuth lives at the top — it just hands us a verified identity and we issue our own JWT pair, access plus refresh. Everything after that is our JWT.
>
> Inside Nest is where it gets interesting. Three engines side by side.
>
> First, the Wallet Service. Second, the Circle and Rotation Engine — that's your state machine. Third, the Scheduled Job. All three sit over two append-only ledgers: WalletTransaction on the wallet side, and LedgerEntry plus CircleCycle on the circle side. At the very bottom, Postgres. Nothing fancy, just Postgres doing what it's good at: transactions.
>
> On the right, the WebSocket broadcaster. It doesn't own state. The engines do their work, then they push.
>
> So here's the flow everyone cares about. You tap Contribute. The API opens a single database transaction. It debits your wallet, it credits the current cycle's pot. Either both happen or neither does. No half-written money. Every write is idempotent — same key, same result — so a retry on a bad network never charges twice. That's not a frontend trick, that's the ledger constraint.
>
> Rotation is locked by people, not by time. A forming circle can invite and accept all day. Nothing moves until the creator hits Activate. That moment freezes the roster, draws the payout order — random by default, manual if the creator set it — and opens cycle one. After that, invites are closed. That's the fairness answer to your first question in a real Ajo: who decides who goes first, and can someone sneak in after two payouts?
>
> The job watches cycles. When a pot fills, it credits the recipient's wallet, marks the cycle paid, and opens the next one. If auto-collect is off, it parks the payout and waits for a tap.
>
> State on the clients is boring on purpose. React Query. Server is truth, cache is a mirror. When the server pushes — contribution created, member joined, status changed, payout completed — the clients just invalidate and re-read. No optimistic accounting.
>
> One last boundary. Funding in this build is a demo top-up. That's honest. A real rail like Paystack plugs in at exactly the wallet seam and the ledgers never know the difference.

Pause half a second. Then —

## Cue 2 — Switch to: Postman — collection "Circle — demo flow (v2 Ajo)" — run top to bottom
2:30 - 5:00 — Backend. Narrate the tokens as you mint them.

> Let's make that concrete. These 19 requests run in order on a live local API.
>
> First, who are we. Requests one and two mint two JWTs — Ada, the creator, and James, the member. Every request after this borrows one of those two tokens. You're literally watching two people use the same system.
>
> Request three proves Ada's token works. Four and five are the wallet — derived balance, not stored, and a 100k top-up so we have runway.
>
> Six to ten is the lifecycle you need to see. Six creates a rotation circle — ten thousand daily, two members, twice a week, goal auto-computes to a 140k pot. Seven invites James. Eight, James accepts — and notice, the circle stays forming. Nine is the moment: Creator activates. That locks the roster and opens the schedule. Ten shows that locked schedule — two cycles, collecting, 140k target.
>
> Eleven to thirteen is the 30-second talk. Eleven contributes 140k and fills the pot. Twelve is the exact same request, same key — replayed is true, same entry, balance doesn't move. Thirteen is the receipt: one debit in the wallet, not two. On a flaky mobile network, that one signal matters more than any animation.
>
> Fourteen — the payout already happened. Cycle one completed, cycle two is collecting. Fifteen is cadence with teeth: first tap in the new cycle goes through, the immediate next tap fails with Next contribution opens in. Seventeen to nineteen are the guards: overdraw fails, discover lists what James could still join, notifications is the timeline the apps actually render.

Click through at a human pace. Don't rush eleven to thirteen — let the replay sit for a beat.

## Cue 3 — Switch to: Web — http://localhost:5173/ — logged in as James
5:00 - 7:45 — Web, page order as a user meets them.

> Same two people, now through the product. Watch it in order.

> Landing and onboarding. Then Overview — greeting, four totals, growth over fourteen days, attention strip, closest to goal, the contributors pie, and the rotation stepper. Every number here is derived live.

> Circles — My and Discover side by side. The table is real data. On the right, the create panel shows the weekly pot math as you type — daily times seven times members. Pick Ajo rotation, choose weekly or twice weekly, set the length, create. The discover rows join in place.

> Circle detail — hero balance, current cycle with pot bar and a countdown — Next payout in two days — fixed step contribute, locked until the window opens. Below that, autopilot. Contribution and collect both have an Auto toggle. Turn it on and the job does it for you when due. Members are tappable — each row opens a profile — then Invite finds people on the platform, rotation schedule with Collect buttons for waiting pots, history, and facts.

> Wallet — big balance in emerald, in versus out totals, side-by-side Fund and Withdraw sharing one amount, per-circle breakdown, then every transaction.

> Activity — this is the notifications page you saw in the API. Dues, countdowns, invites, joins, payouts. Per-item new states, mark all read.

> People — grid of everyone on the platform. Search by name or email, open any profile, invite them to a circle you own right from there.

> Settings — display name, light or dark, demo quick-fund buttons, session.

> Now the live bit. Keep this tab open, do the next tap from the other session — or later from the phone — and watch this pot and balance move with no refresh. That's WebSocket — the server pushed, the client didn't poll.

If Demo Day Ajo is armed:

> One more beat — Demo Day Ajo sits at one million of one point zero five. One fifty kay tap from James completes it and the 1.05 goes straight to his wallet. That's not a counter increment, that's real ledger credit you'll see in Activity.

## Cue 4 — Switch to: Mobile — emulator, bottom tabs visible
7:45 - 9:30 — Mobile, thumb-shaped, same story.

> Same app, bottom tab shape. Home, Circles, Wallet, People, Settings.

Walk Home — greeting, hero now shows next payout and your position, not just a total — attention, closest, hall of fame, activity.

Circles — My and Discover with Join in place. Open one, show the same cycle card and countdown. Wallet — balance, fund and withdraw, transactions. People — search, recent searches remembered, profile, invite.

End on the callback:

> Tap Contribute here — fifty kay — and look back at the web tab. Same pot completing, same payout landing. Two surfaces, one ledger.

## Cue 5 — Stay on mobile or back to web — whichever feels warmer, then close to camera
9:30 - 10:00

> That's Circle. Immutable ledgers on both sides, atomic wallet to pot moves, creator-locked rotations nobody can join halfway, cadence that actually blocks early taps, and everything live without polling. The Postman collection you just watched is in the repo so anyone can replay this exact run. Thanks for watching — happy to walk through any part deeper.

## Delivery notes

- Reseed right before you hit record so Demo Day Ajo is armed and James's wallet is clean.
- Log into mobile on camera with email and password — don't tap Google in Expo Go, it will block before the account picker and you will burn thirty seconds recovering.
- Keep architecture to two minutes. The diagram is your voice, not a second script.
