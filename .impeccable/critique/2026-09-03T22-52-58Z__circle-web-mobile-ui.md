---
target: circle web + mobile UI
total_score: 12
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/jasonamadi/circle/circle web + mobile UI"
timestamp: 2026-09-03T22-52-58Z
slug: circle-web-mobile-ui
---
Method: dual-agent (A: ses_f96874c54ffeMRhOna456PLHdn · B: ses_f96874bc7ffeZ2Q2Rjl5gNYq1m)

# Critique — Circle web + mobile UI (Operate mode)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Live feed has no connection state; contributions confirm with a flat text line |
| 2 | Match System / Real World | 1 | "Ledger", "idempotency key", "replayed", raw status strings leak system language |
| 3 | User Control and Freedom | 1 | No undo for contributions; Close circle has no confirm or consequence explainer |
| 4 | Consistency and Standards | 2 | Web/mobile diverge (currency format, pill styles, back nav); no keyboard focus anywhere |
| 5 | Error Prevention | 1 | Bare number inputs for money; no confirm step before moving money |
| 6 | Recognition Rather Than Recall | 1 | Must recall invite context, past contributions, what "invited vs active" means |
| 7 | Flexibility and Efficiency | 1 | No quick amounts, defaults, or power flows; every contribution retyped |
| 8 | Aesthetic and Minimalist Design | 2 | Clean cards but CircleDetail stacks 6 equal-weight cards with no hierarchy |
| 9 | Error Recovery | 1 | Raw API errors verbatim; session expiry hard-redirects to /login |
| 10 | Help and Documentation | 0 | Zero onboarding; login dominated by dev-login config text |
| **Total** | | **12/40** | **Poor** |

## Design Specificity Verdict

Category-interchangeable. Coherent dark fintech system (shared tokens web/mobile), but swap "circle" for "project" and nothing feels wrong: Inter/system-ui, green=good, generic card/row/pill/progress for every concept, members rendered like a server log, avatars fetched but never shown. Biggest misses: no shared-goal embodiment (no milestone map for "Mortgage deposit"), no social presence (no faces, no recent-contributor warmth), no ritual around money (contribution is input + button), and engineering copy ("immutable ledger", "idempotency key") where reassurance should be.

Deterministic scan: 2 warnings on web (Inter overuse — taste, not defect; width-transition on progress fill — negligible, rule's alternative doesn't apply). Mobile scan clean. No browser overlay available (no browser automation in this environment); CLI + mechanical grep only.

Mechanically confirmed: zero `:focus`/`focus-visible` rules in web CSS; zero `aria-*`/`role=` in web; zero `accessibility*` props in mobile. Keyboard and screen-reader support is absent, not just weak.

## Overall Impression

The foundation is honest (real balances, real idempotency, platform-appropriate auth) but the interface reads as a developer demo, not a product people trust with money. The single biggest opportunity: make the contribution moment feel safe and meaningful — confirm, receipt, and shared momentum.

## What's Working

1. Honest progress + personal share co-located in the detail header (group balance/goal/percent AND "Your share" in one glance — answers "where does my money sit" without navigation).
2. Web/mobile conceptual parity with idiomatic auth on each (httpOnly cookie + silent refresh on web; SecureStore + expo-auth-session on mobile).
3. Idempotent contribute per tap (crypto.randomUUID both platforms) — the hardest money-anxiety failure (double-charge on retry) is already prevented at protocol level; only the copy needs humanizing.

## Priority Issues

- **[P1] Money movement has no confirm, receipt, or meaning.** Contribute is amount input + button → flat "Contribution recorded." Disabled state unexplained. No amount echo, new totals, or social acknowledgement. Fix: two-step contribute (amount + quick chips 1000/5000/10000 + live preview "₦5,000 → group 42%→43%") → confirm sheet → success with check + new totals. Suggested: /impeccable harden + /impeccable clarify.
- **[P1] Trust language is engineering language.** "Immutable ledger", "idempotency key", "replayed", "append-only audit trail", raw goal_reached strings. Fix: "Activity" not "Ledger history"; "Safe to retry — never charged twice for one tap"; humanized statuses with one-line explainers. Suggested: /impeccable clarify.
- **[P2] CircleDetail is a wall of 6 equal cards.** No hierarchy; users can't answer "what next". Fix: hero goal card → primary Contribute card (accent border) → condensed members → tabbed Activity (Live|History); demote Close to overflow + confirm. Suggested: /impeccable layout.
- **[P2] Invite/accept is a black box.** No inviter, goal, members, or obligations before accepting; no pending-invite list or resend. Fix: accept screen shows circle, goal, members, inviter + "contribute after accepting"; invite shows pending list + what the email contains. Suggested: /impeccable onboard.
- **[P2] Login leads with developer scaffolding.** ALLOW_DEV_LOGIN/API_URL/client-ID copy dominates; Google button disabled-silently on mobile. Fix: collapse dev login behind "Trouble signing in?" disclosure; plain "Google unavailable in this build" fallback. Suggested: /impeccable clarify.

## Persona Red Flags

Jordan (first-timer): jargon at login, blind accept (no inviter/goal/members), unexplained disabled Contribute, success text teaches nothing. Casey (mobile): no quick amounts, invisible disabled states, "Waiting for live events…" with no reconnect cue, feed can silently die on sleep/wake, small header targets, mobile pills lack color coding. Sam (a11y): unassociated labels (no htmlFor/id), progress bars without role/values, live feed without aria-live, color-only status pills, no focus rings, raw errors without role=alert, mobile touch targets without accessibility roles/labels.

## Minor Observations

Currency format inconsistent (web ₦-prefix vs "12345 NGN"; mobile "of goal currency") — use Intl.NumberFormat everywhere. Ledger fixed at 20 rows, no More button. Success/error share one msg slot and overwrite each other. Mobile msg misuses card style as text container. No pagination, no breadcrumbs (mobile "Circle ‹" hack), no avatar rendering despite avatarUrl available.

## Questions to Consider

- What would the 50% and 95% progress moments look and feel like for the whole group, not just the contributor?
- What fear must the invite email and accept screen remove for a first-timer to invite a friend within 60 seconds of creating a circle?
- If every number had to justify itself to a distracted parent on a bus, which survive — and what replaces the ledger as proof "my money is safe"?
