# Implementation Plans

The complete route from the current build to GDD v2's Hypothesis Playable and
beyond. Generated 2026-07-08 against commit `14fd915`, from the revised
[ROADMAP.md](../ROADMAP.md) (North Star and sequencing derive from
[GDD.md](../GDD.md) v2). Every roadmap item now has a self-contained execution
plan. Each executor: read the plan fully before starting, honor its STOP
conditions, and update the plan's status row below when done.

**Execution model: sequential, on `main`, no feature branches.** Run plans in
the order given, each ending in a commit checkpoint with all three gates green
(`pnpm check`, `pnpm lint`, `pnpm test`). Staged plans may checkpoint per
stage. Plans are anchored at `14fd915`; because earlier plans move code (009
splits `screens.js`, others add modules), **re-locate every cited symbol by
name at execution time — line numbers drift by construction.** Each plan's
drift-check command is the first thing to run.

**Previous batch**: plans 001–008 (Phase 0, the characterization net, the
fixed-grid sidebar layout, the `BALANCE` table) were executed, merged to main,
and their files deleted. Recover from git: `git show 97ef00b:plans/README.md`.

## Execution order & status

Numeric order is the execution order **with one exception**: plan 020 (which
creates the `js/beats.js` deck floor) must land before plans 013 and 021, its
deck consumers. See dependency notes.

### Milestone HP0 — the Hypothesis Playable (GDD §10)

| Plan | Title | Roadmap ID | Pri | Effort | Depends on | Status |
|------|-------|-----------|-----|--------|------------|--------|
| 009 | Split `screens.js` into `js/ui/` modules | P1-5 (+P5-3) | P1 | L | — | TODO |
| 010 | Campaign store: versioned cross-run persistence | HP-1 | P1 | M-L | — | TODO |
| 011 | Menace + the scouting report | HP-5 | P1 | M-L | 008✓ | TODO |
| 012 | Cast v2: resolve bands, wants, scars, medic, weapon slot | HP-2 | P1 | L | 009, 010 | TODO |
| 015 | The sapper + counterplay-cost pass | HP-6 | P1 | M | 011 | TODO |
| 016 | Endings: Last Stand & the Torch | HP-7 | P1 | M-L | 010 | TODO |
| 018 | The Beacon as priced wager | HP-9 | P1 | M | 011 | TODO |
| 019 | Winter for real (verb-flip + season-aware `walkable`) | HP-10 | P1 | M-L | 011 | TODO |
| 020 | Supporting systems: trader memory · proc floor · first-loss unlock | HP0 supp. | P1 | M | 010, 011 | TODO |
| 013 | Arrivals as decisions | HP-3 | P1 | M | 010, 012, **020** | TODO |
| 021 | Ambitions v0 + event deck v0 | HP0 content | P1 | M | 012, **020** | TODO |
| 014 | The torchbearer (embodied dusk) | HP-4 | P1 | L | 009, 012 | TODO |
| 017 | The campaign layer: wagon camp, map v0, aging, founding draft | HP-8 | P1 | L | 010, 016 | TODO |

**► HP0 exit playtest** — the gate. Success = playtesters who lose a
settlement found the next one, and by settlement ~5 talk about band members by
name (GDD P1/P6 falsifiers). Everything below waits on this verdict for
*priority*, though the enablement items are safe to pull earlier if one blocks
you.

### Enablement (P1-6..P1-9) & Reach (P5) — after HP0

| Plan | Title | Roadmap ID | Pri | Effort | Depends on | Status |
|------|-------|-----------|-----|--------|------------|--------|
| 022 | Untangle the `game.js` barrel | P1-6 | P2 | M | 009 | TODO |
| 023 | Deduplicate renderer logic (`js/render-shared.js`) | P1-7 | P2 | M | — | TODO |
| 024 | Job-scan performance index (`js/tileindex.js`) | P1-8 | P2 | M | — | TODO |
| 026 | Readability pass + morale-"why" key/pad path | P5-1, P0-4 | P2 | M | 009 | TODO |
| 025 | Renderer idle cost (dirty-cell compositing) | P1-9 | P3 | M | 023 rec. | TODO |
| 027 | Screen-reader affordance (`aria-live` mirror) | P5-2 | P3 | M | — | TODO |
| 028 | Touch support spike (tablet enablement) | P5-4 | P3 | L | 009 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

## Dependency notes

- **The 013/021 ↔ 020 inversion**: plan 020 builds `js/beats.js` (the
  `registerDeck({id, tryProc})` / `noteBeat` per-day proc floor). Plans 013
  (arrival deck) and 021 (ambition + event decks) register on it. Land 020
  before either — this is the only place execution order departs from numeric
  order.
- **Three parallel tracks** collapse into the linear order above: persistence
  (010→016→017), the threat (011→015/018/019), and the cast/dusk
  (012→013/014). Any order that respects the "Depends on" column is valid; the
  table gives one that does.
- **P1-5 (009) before the UI-heavy items** (012, 014, 017, 026): they add
  substantial new screens and should land on the split `js/ui/` structure, not
  the 1,099-line monolith.

## Cross-plan coordination (read before executing any HP0 plan)

These were designed independently and share seams. Honor them or the plans
collide:

- **`SAVE_VERSION` bumps are sequential — never hardcode the number.** Many
  HP0 plans add a save field and bump the version (011→2, 012→3, 013→4, …);
  each plan states the number *as drafted against its predecessor*. At
  execution time, **bump to the next integer above the current value**,
  whatever it is, and write the migration from that actual predecessor. 019's
  "v3" and 013's "v4" are illustrative, not literal.
- **`CAMPAIGN_VERSION` starts at 1 (010) and should stay there through HP0.**
  013, 017, 020, 021 all add campaign-store fields *without* a version bump,
  relying on 010's always-merge backfill. Keep that discipline; only a
  breaking shape change bumps it.
- **`addLog` gains an optional `urgent` arg in plan 027.** If 027 lands before
  the endings/arrival notices you want announced assertively, pass the flag at
  those sites; if after, 027's own step flags the six existing urgent sites.
- **Legacy `PERKS` are reconciled in 017**, not 010: the flat stat perks
  become the GDD-sanctioned opt-in *assist valve* (labeled, off the diegetic
  path); campaign-layer spend buys qualitative *options* only. Don't add a new
  modifier anywhere in the HP0 set (GDD §9.1 — a review gate in 010/012/017).

## Known open items (not blockers, but owed)

- **The §6 labor invariant has no executable-test home.** GDD §6 makes it
  binding — "minimum viable defense at cast 6–9 crewable by ≤ half the band" —
  like the Menace inequality (011) and the Last Stand EV bound (016), it
  should be a test over `BALANCE`. Plan 015 references it but tests the
  counterplay matrix, not this. Assign it to 015's or 012's test suite when
  executing, or add a small standalone plan.
- **Arrivals: band vs. run** (013). The GDD says accepting an arrival "joins
  the *band*, not the *run*" — so a stranger at the gate reinforces future
  settlements, not the current defense. Plan 013 follows the literal GDD
  reading and documents how to flip it if playtests want gate-arrivals to help
  the active settlement. An owner call before or during 013.
- **Equipment depth** stays vLater (one weapon slot ships in 012). **Creeds
  (0–2), Trials (scalar), assist-mode polish** are GDD content-table targets
  not in the §10 "requires" list — deliberately post-HP0. Revisit only if the
  exit playtest says the minimum feel needs one.

## Findings considered and rejected

- **Seeded/persisted RNG** — save-scumming is plausibly by-design (autosave-
  at-dawn + delete-on-death bounds it). Revisit only for daily challenges or
  reproducible bug reports.
- **Fit-to-window layout** — rejected by owner decision (plans 005): the fixed
  100×45 CRT container is part of the game's identity. Do not re-propose.
- **Legacy `bed` tile cruft** — harmless; bundle into any future save-shape
  change.
- **World screen not pausing the sim** — intentional (expeditions travel while
  you plan).
