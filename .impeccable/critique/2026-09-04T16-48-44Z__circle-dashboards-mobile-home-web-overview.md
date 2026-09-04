---
target: circle dashboards mobile home web overview
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/jasonamadi/circle/circle dashboards mobile home web overview"
timestamp: 2026-09-04T16-48-44Z
slug: circle-dashboards-mobile-home-web-overview
---
Method: dual-agent (A: ses_f92af9565ffeTHJpa1CILWbCRC · B: ses_f92af94f0ffeyVGigJakgFQI3N)

# Critique — Circle dashboards: mobile Home + web Overview (Operate)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Bars glide but no turn position, due date, or you-are-here in rotation |
| 2 | Match System / Real World | 2 | Ajo words present, but Cycle/Collecting/system slugs leak; no plain-language payout framing |
| 3 | User Control and Freedom | 1 | Whole attention card is one tap target; feed rows look like text but navigate; no per-item action |
| 4 | Consistency and Standards | 2 | Emerald disciplined, but Naira hardcoded in places, currency elsewhere; mislabeled nav actions |
| 5 | Error Prevention | 1 | Growth and mix charts built from sampled slices, presented as complete totals |
| 6 | Recognition Rather Than Recall | 1 | Attention rows truncate to one line; dues hide amount/date without a tap |
| 7 | Flexibility and Efficiency | 2 | No primary next action; experts scroll past hero + tiles to reach anything useful |
| 8 | Aesthetic and Minimalist Design | 3 | Strong tokens, restrained motion, editorial type — but too many same-weight sections |
| 9 | Error Recovery | 1 | Mobile query failures go silent; empty states are dead ends with no retry or create path |
| 10 | Help and Documentation | 0 | Zero rotation explainer for first-timers; empty states don't teach |
| **Total** | | **16/40** | **Poor** |

## Design Specificity Verdict

Half-authored. The Ajo-specific parts are real (closest-to-goal, rotation stepper, hall of fame, contribution mix), but the hierarchy answers generic fintech: totals and counts first, payout order buried (card 6+ on web, absent on mobile hero). Strip the words Ajo/Rotation/Cycle and either dashboard could ship as a group vault or expense tracker. Neither dashboard leads with the one question that moves money: who collects now, and when do I.

Deterministic scan: zero findings on all six files (was 2 warnings pre-redesign; both resolved). No browser overlay possible here. Mechanical checks confirm real gaps: web has focus-visible but Overview has zero ARIA roles; charts have img roles but no data alternative; money figures lack tabular numerals on both platforms; mobile animations ignore reduced-motion entirely (web covers it partially).

## Overall Impression

The system looks designed; the pages don't yet behave designed. Strongest foundations in the repo (tokens, motion restraint, editorial type) serve pages that list rather than prioritize. Single biggest opportunity: make each dashboard answer "what do I owe, who collects, what's next" before anything else.

## What's Working

1. Token discipline across platforms (mono + one emerald, 4px, currentColor icons) — the emerald actually means money everywhere it appears.
2. Motion with meaning — 450ms entrances, 700ms money glides, eased web transitions; progress never jumps.
3. Editorial type system — Fraunces for figures and headlines against Inter body reads like a ledger book, genuinely distinct from default fintech.

## Priority Issues

- **[P1] No whose-day hero.** Both dashboards lead with totals; rotation position is buried or absent. Fix: mobile hero becomes next-payout (who, avatar, in N days, your position); web moves the rotation card first and binds it to the most urgent collecting circle.
- **[P1] Attention card is unusable.** Single tap target, truncated titles, hidden amounts/dates. Fix: per-row targets with title + amount + due label, max 2 rows plus view-all.
- **[P1] Sampled data presented as totals.** Growth and mix derive from capped ledger slices with no label. Fix: relabel as recent-window views ("Recent contributors", last-14-days growth) or lift the caps.
- **[P2] Navigation mislabels and traps.** Find-people inside activity, New-circle pointing at a list, text rows that secretly navigate, web rows unreachable by keyboard. Fix: relocate, rename, add affordances and focusability.
- **[P2] Money formatting splits.** Hardcoded ₦ in places, currency codes elsewhere, no tabular numerals, locale-dependent dates. Fix: one money helper + relative dates for dues/activity.

## Persona Red Flags

Jordan: empty states read as failure (0 circles, 0 members) with no start path; rotation jargon unexplained; chart empties have no nearby action. Casey: 200px hero pushes actions below the fold; truncated attention rows with faint chevrons; whole-card tap target misfires; no skeletons on slow networks; Find-people hijacks the activity header. Sam: attention and goal cards lack roles/labels; amounts conveyed by green color alone; web feed/attention/hall rows unfocusable and keyboard-dead; charts have no data-table alternative; timeline status is color/animation only.

## Minor Observations

Goals-hit emerald vs white members implies a hierarchy that may not be intended; Home avatar disc ignores light theme; hero photo has no offline fallback; stat figures jitter without tabular numerals; PulseDot built but unused on Home; light-mode placeholder contrast suspect.

## Questions to Consider

- If total saved disappeared tomorrow, would members act any differently — or is payout date the only number that moves money?
- Does "Who's carrying" celebrate contribution or surveil quiet payers in a trust circle?
- Is Hall of fame a victory lap or a reminder to everyone still paying that they are behind?
