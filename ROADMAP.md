# HEARTHFALL Roadmap

Written against commit `3ee106c` (2026-07-07). Produced by a full multi-agent audit
(correctness, architecture/performance, UI/UX, game design) plus genre research on
roguelite meta-progression and colony-sim pressure design. Every code claim below was
verified against source; every design principle cites the game it comes from.

Each item has an ID for reference — the plan is to break items into detailed,
self-contained execution plans one at a time. Effort: **S** = hours, **M** = a
day-ish, **L** = multi-day. Verification gates for all code work: `pnpm check`,
`pnpm lint`, `pnpm test` (all green today; keep them green).

---

> **Note (2026-07-07, reconciled):** the design destination lives in
> [GDD.md](GDD.md) (v2, survived four adversarial reviews). Its campaign flip
> — *persistent band, disposable settlements* — reshaped this roadmap: the
> old Phases 2–4 are replaced below by **Milestone HP0 (the Hypothesis
> Playable)**, a direct translation of GDD §10, plus a post-HP0 backlog.
> Phases 0–1 (bugs, tests, refactors, layout) are unchanged and still come
> first.

## North star — identity, USP, and the idea of fun

**Identity.** HEARTHFALL is the *session-sized commune roguelike*: a 30–90
minute run you start in a browser tab (or on the couch with a pad), keeping a
dozen **named** people alive through nights with a **heartbeat** — day is
agency, dusk is consequence, dawn is story — until the commune falls and feeds
the next one's legacy, or you light the Beacon and *choose* to take the final
exam.

**USP** — the combination no genre neighbor offers: Against the Storm has
session-structured colony runs but no combat heartbeat, no named-person
stakes, no browser. RimWorld/DF have the people-stories inside 20-hour opaque
sandboxes. They Are Billions has the wave rhythm with zero attachment. The
wedge is **zero-install + session-sized + dusk-rhythm defense + named-people
stakes + a player-invoked ending** (the Beacon — declare your own final exam —
is already built and is the rarest mechanic here).

**Idea of fun** — the loop feeling to protect: daylight = plans that matter,
dusk = the line holds or breaks, dawn = who was wounded, who deserted, what
the Elder says, death = investment in the next run. Fun dies four ways, and
each maps to a pillar below.

**The four pillars** (every non-enablement item must serve one):

| # | Pillar | Fun dies when… | Served by |
|---|--------|----------------|-----------|
| I | **Dusk stays scary** | raids are solved (turtle-and-snipe, hard cap) | HP-5, HP-6, HP-9, HP-10 |
| II | **People, not population** | settlers become interchangeable labor | HP-2, HP-3, HP-4 |
| III | **Death feeds the next run** | legacy is just a shrinking shopping list | HP-1, HP-7, HP-8 |
| IV | **Instant, anywhere** | install friction, broken pad, cramped screen | P0-1..P0-8, P1-10, P5-* |

(GDD v2 sharpened pillars II and III into the campaign flip: the *band*
persists across settlements — see GDD §2 P1–P8 for the full revised set.)

Phases 0–1 are otherwise **enablement**: the safety net (tests, CI) and the
tuning surface (balance table) that let Pillars I–III be executed aggressively
without breaking the game. The cut test for any future item: *name its pillar
or its enablement role, or cut it.* Applied to the current list, one item
scores weakest — **P4-3 (workshop depth) is justified only as Pillar I**
(an armor/defense axis that feeds dusk tension); if it drifts toward generic
crafting content, cut it.

The three README promises the code doesn't keep yet — "death feeds the next
run" (legacy is currency-only, `meta.js`), "State of Decay community pressure"
(one global morale scalar), and a challenge that holds (raids cap at ~10 into
a 16-settler economy) — are Pillars III, II, and I respectively. The genre
research prescriptions woven into Phases 2–4: meta spends on **options, not
stats**; pressure scales on **visible player choices, not wealth**; raids vary
by **vector, not just number**; death **pays out story**.

**Convergence check.** After Phase 0 + P1-10 land (playable on pad, roomy on a
real screen), run real playtests against the pillar list before building the
HP0 milestone — the Odd Realm lesson (one-on-one player interviews were that
solo dev's highest-leverage steering tool). HP0 itself ends in a second,
sharper playtest gate (its exit test). When this section stabilizes, promote
it and GDD §2 to a `PRODUCT.md` so future audits treat them as settled
intent.

---

## Phase 0 — Stop the bleeding (bugs, parity, safety net)

Small, high-confidence fixes plus the infrastructure that makes every later phase
safe to execute. Do these first; most are hours each.

| ID | Item | Effort | Notes |
|----|------|--------|-------|
| **P0-1** | **Fix controller build/demolish** — A emits `Paint` in BUILD mode but item selection only listens for `Enter`/`a–e` (`gamepad.js:57-58`, `screens.js:344-352`); demolish requires a non-drag press the pad never sends (`screens.js:254,397`). Controller cannot place a single building today. | S | README's "full controller support" is broken at the core loop. |
| **P0-2** | **Give the pad the missing actions** — no binding for alarm `r`, trade `e`, minimap `n`, save-quit `Q` (`gamepad.js:60-68`). Alarm is the primary raid response. | S | Pair with P0-1; update README controller table. |
| **P0-3** | **Fix Continue camera** — `cam` is excluded from saves (`save.js:16-18`) and load never re-centers, so Continue opens on empty top-left corner. | S | One-line fix: `centerCam(G.camp.x, G.camp.y)` after `loadGame()`. |
| **P0-4** | **Keyboard-accessible morale "why"** — `moraleWhy()` is reachable only by mouse-clicking the bar (`screens.js:300-302`). Add a key + pad path. | S | |
| **P0-5** | **Suppress game keys under Ctrl/Cmd/Alt** — `dispatchKey` forwards only shift (`ui.js:91-94`); Cmd+R rings the alarm while reloading. | S | |
| **P0-6** | **Decide + unify modal pause semantics** — trade and workshop lack `pausesSim`; all six other modals have it (`screens.js:811-1066`). If the time pressure is intentional, surface it; otherwise add the flag. | S | Design decision needed, then trivial. |
| **P0-7** | **Cap survivor rescues at pop 16** — `world.js:163-169` pushes a rescued settler with no `< 16` check; the tagalong branch has one. | S | |
| **P0-8** | **Numeric sort in mapgen percentiles** — `pct()` uses default lexicographic sort on a Float32Array (`map.js:38`), skewing biome thresholds at the extremes. | S | `(a, b) => a - b`. |
| **P0-9** | **CI workflow** — no `.github/`; nothing enforces the green `check`/`lint`/`test` gates on push/PR despite the README inviting PRs. | S | Node 20, pnpm frozen lockfile, three commands. |
| **P0-10** | **AGENTS.md / CLAUDE.md** — capture the conventions every plan needs: `G` singleton model, screen-object contract (`ui.js:1-9`), per-minute cache pattern, verification commands, `ff()` debug hooks. | S | Multiplies the success rate of every later item. |
| **P0-11** | **Fix the stale README code map** — it still says `game.js` holds pathfinding/AI/save-load that now live in 9 other modules; ~15 modules unlisted. | S | |

## Phase 1 — Characterization tests, then refactors

The sim has exactly one test file. Lock down current behavior **before** touching
architecture, then do the refactors that unblock balance and content work.

| ID | Item | Effort | Notes |
|----|------|--------|-------|
| **P1-1** | **Characterization tests: the money paths** — `endRun` scoring/feat bonuses/ledger multiplier (`meta.js:50-71`), `buyPerk` guards, save/load round-trip incl. `usedNames` Set and v0→v1 `migrate()`. | M | Legacy points are the only cross-run currency; a regression corrupts every player's meta. Follow `test/boundaries.test.js` patterns (stubbed globals). |
| **P1-2** | **Characterization tests: combat + economy tick** — `hitRaider`/`woundSettler`/down-vs-die coin flip, warlord horde-break; hunger→eat→starve chain and resource-decrement guards. | M | Stub `chance`/`rint`. These two loops are the game. |
| **P1-3** | **Characterization tests: raids, pathing, run-end** — `spawnRaid` edge cases, `findPath` (walls, `noDoor`, null-on-boxed-in), `raidEstimate` invariants, expedition resolution, `communeFallen`/`Ascended` idempotence. | M | Completes the safety net for Phases 2–3 balance work. |
| **P1-4** | **Extract balance constants into one tunable table** — hunger `0.075`, crop `0.23`, morale drift `0.0004`, work costs, raid timers etc. are inline across `game.js`/`settlers.js`/`raiders.js`. Hoist into a `BALANCE` block in `data.js` (or `balance.js`). | M | **Prerequisite for all Phase 2 tuning** and for difficulty modes/ascension later. Behavior-identical; tests from P1-1..3 prove it. |
| **P1-5** | **Split `screens.js`** (1,099 lines, 25 functions — layout + input + direct `G` mutation interleaved). Continue the started-and-stalled `js/ui/` extraction (`ui/menu.js` is the pattern): peel modals, world screen, title screens, sidebar into files; route map mutations through `game.js` mutators. | L | Do after P1-1..3 exist. Biggest structural debt; every UI phase item lands in this code. |
| **P1-6** | **Untangle the `game.js` barrel** — it re-exports ~40 symbols from 12 modules and re-imports some of the same names (`game.js:9-35`); view modules import `G` inconsistently (via barrel vs `state.js`). Pick direct imports, keep `game.js` as the tick loop. | M | Mechanical; typecheck catches breakage. |
| **P1-7** | **Deduplicate renderer logic** — crop stages, water/tree/fire animation phases, scar thresholds reimplemented in both `mapdraw.js` and `tiles.js` (drift risk on every visual tune). Extract shared pure helpers. Include the ASCII fishing-designation color gap (`mapdraw.js:40` renders all marks identically). | M | |
| **P1-8** | **Job-scan performance** — `findJob` walks all 13,440 tiles per idle settler (`settlers.js:159-189`); `claimBed`/`housingCap` full-scan too. Maintain an actionable-tile index + house list (the per-minute cache pattern at `settlers.js:114` is the established precedent). | M | Hottest sim cost; matters before bigger populations/maps ever happen. |
| **P1-9** | **Renderer idle cost** (optional, lowest priority in phase) — full 4,500-cell repaint every rAF frame even paused; per-frame gradient allocation at night (`gfx.js:86-115`, `tiles.js:504-521`). Dirty-flag + prebuilt gradients. | M | Real but invisible on desktop; defer if Phase 2 beckons. |
| **P1-10** | **Fit-to-window grid + decompressed layout** *(user priority — schedule first among the Phase 1 refactors)* — the game renders a fixed 100×45 cell grid on a fixed 1100×855 canvas that CSS merely scales (`gfx.js:6,32-41`, `style.css:13-16`), so big screens get a blurry, cramped upscale and the sidebar squeezes 12 settlers + elder + minimap into 26 columns with zero breathing room (`screens.js:191-216`). Two stages: (1) single-source all layout from `GRID_W/H`-derived constants, killing the hand-placed literals (`SB_X=74`, sidebar floors `40`/`15`, `mmW: 25`); (2) compute grid dimensions and cell scale from the window at startup — bigger cells *and* more cells on larger screens, wider sidebar when space allows. | L | Promoted from Phase 5 on user feedback ("cramped, use the space better"). Do before P1-5 splits `screens.js`, so the split moves already-clean layout code. |

## Milestone HP0 — the Hypothesis Playable (replaces old Phases 2–4)

Direct translation of GDD §10: the minimum build that tests the core
hypothesis — *does a persistent, mortal, aging band whose settlements die make
players found the next settlement?* Ordered by dependency; all tuning flows
through the P1-4 balance table; the P1-1..3 test net and the P1-5 screens
split should land first (HP-4 and HP-8 add substantial new UI).

| ID | Item | Effort | Depends on | GDD |
|----|------|--------|------------|-----|
| **HP-1** | **The campaign store** — versioned cross-run persistence (band members with name/trait/wants/scars/age, campaign map state, lit Beacons, ruins, unlocks). New module + `META` gains a version field (it has none — landmine); ending flows must write survivors *before* `clearSave()`. This is the architecture everything cross-run stands on. | M-L | P1-1 (save/meta tests) | §3, App A |
| **HP-2** | **The cast, v2** — per-person **resolve** as 3 named bands (Steady/Fraying/Breaking; inputs at v1: food, sleep, deaths witnessed), visible **wants** (one each), **scars** (append-only, cross-campaign), **medic** role (4th), bonds/grudges as *display + resolve-on-partner-death only* (no adjacency/refusal teeth — the O(n²) bomb stays defused), breaks never mid-raid at v1. Global morale becomes a displayed aggregate. | L | P1-2 (settler tests), P1-4 | §5 |
| **HP-3** | **Arrivals as decisions** — strangers at the gate shown as people (trait, want, age); accept = joins the *band* (campaign), decline has a visible cost. Low rate, event-weight. Replaces silent dawn recruiting. | M | HP-1, HP-2 | §5 |
| **HP-4** | **The torchbearer** — dawn "who carries the torch tonight" choice; at dusk, direct control of that one mortal band member (move, rally, sortie, rescue-the-downed); during raids, pause = look only, commands flow through the torchbearer. The embodiment pillar (GDD P2) and the answer to "dusk is a cutscene." | L | HP-2; P1-5 recommended | §2 P2 |
| **HP-5** | **Menace + the scouting report** — two visible cause-ledgers replacing the day-count formula (`forecasts.js:9-16`): Menace ceiling (days, firelight claimed, noise, camps standing) and capacity-tracking raid sizing (what they bother sending), with the published no-turtle-equilibrium inequality and the no-death-spiral guard. Firelight-as-claims term included. | M-L | P1-4 | §2 P3, §6 |
| **HP-6** | **The sapper** + counterplay-matrix cost pass — the anti-turtle archetype (breaches doors/walls; defeats the sealed `noDoor` ring, `raiders.js:101-132`); defenses get priced against each other (space/labor/light). Slinger is explicitly vLater (new combat modality). | M | HP-5 | §6 |
| **HP-7** | **Endings** — collapse becomes standing offers, player-paced: **Last Stand** (everything tonight; feats honored; EV strictly below a Beacon attempt) and **the Torch** (leave now; pick who walks out → written to the campaign store). Self-induced collapse forfeits feats (anti-farm invariant). | M-L | HP-1 | §2 P8, §9 |
| **HP-8** | **The campaign layer** — wagon camp between settlements (tend wounded, spend legacy on options, pick next site, creed slot), campaign map v0 (site choice with visible quirk, lit Beacons persist, one canned your-ruins site), **aging** in simplest form (Green/Prime/Grey; Grey retire to the Chronicle). | L | HP-1, HP-7 | §3 |
| **HP-9** | **The Beacon as priced wager** — each exam night previewed at dawn; fixed concealed-share of each night's budget (balance-table number); first-attempt concealment draws only from taught vectors. | M | HP-5 | §2 P4 |
| **HP-10** | **Winter for real** — the one season verb-flip shipped fully at v1: desperate food-seeking raids (reversing `forecasts.js:11`'s winter *discount*) and the frozen river as a crossing — which requires the season-aware `walkable()` refactor (`state.js:31`), planned here, not hand-waved. Other seasons stay numeric until post-HP0. | M-L | HP-5 | §7 |

Supporting HP0 items (small, slot anywhere after their deps): trader
demand-memory + Menace-decoupled pricing (S-M, was P2-5); ambitions v0 —
Elder offers 1-of-2, reusing the `OBJECTIVES` shape (M, was P4-4); guaranteed
event/arrival/ambition proc floor per game-day (S); first-loss content-unlock
guarantee (S); event deck v0 at 15–25 templates gated on HP-2's structures
(M).

**HP0 exit test** (the only success criterion): playtesters who lose a
settlement found the next one, and by settlement ~5 they talk about band
members by name (GDD P1/P6 falsifiers). If HP0 fails that test, revisit GDD
§2 before building anything further.

## Post-HP0 backlog (vLater, gated on HP0's playtest verdict)

Held deliberately — each multiplies tuning surface or branch surface:
slinger archetype (ranged/suppression modality) · bond/grudge mechanical
teeth (adjacency, refusals) · equipment depth (armor/tools/durability; v1 is
one weapon slot) · creeds 3–6 (v1 ships 0–2) · vector-modifying Trials (v1
Trials are scalar) · spring/summer/autumn verb-flips (mud, wildfire+wind,
gathering-hordes) · mid-raid resolve breaks (after test coverage exists) ·
ruins beyond the canned site (full past-campaign persistence) · heirs/
generations depth · workshop recipe depth (old P4-3 — only the armor axis
survives, and only if it serves dusk tension) · infirmary structure ·
epilogue-settlement mode (GDD open question 6).

## Phase 5 — Reach (when the game deserves it)

| ID | Item | Effort | Notes |
|----|------|--------|-------|
| **P5-1** | **Colorblind + readability pass** — role identity on the map is color-only, HP bars are red/green with no numeral (`mapdraw.js:57-63`, `screens.js:524-533`). Glyph/letter overlays + palette toggle. | M | |
| **P5-2** | **Screen-reader affordance** — mirror log/notices into a visually-hidden `aria-live` region; label the canvas. | M | |
| **P5-3** | ~~Responsive grid~~ — **promoted to P1-10** on user feedback. Residual item here: modal geometry duplicated between `widgets()` and `draw()` in party/workshop/orders modals (`screens.js:725-765,919-933`) — single-source each modal's box math when P1-5 touches them. | M | |
| **P5-4** | **Touch support spike** — zero touch handlers exist; coarse-pointer devices get a landing page. Tap-to-cursor, drag-select, two-finger pan, minimal toolbar. | L | Only after P1-10; a fixed-size canvas can't ship on tablets anyway. |
| **P5-5** | **Wheel pan deltaMode fix** — `ui.js:101-107` assumes pixel deltas; line-mode wheels round to zero. | S | Could fold into Phase 0 if convenient. |

---

## Considered and set aside

- **Seeded/persisted RNG** (`rng.js` seeds from `Date.now()`; saves don't capture
  generator state, so reloading re-rolls outcomes). Save-scumming is arguably
  by-design for this genre — autosave-at-dawn + delete-on-death already limits it.
  Revisit only if reproducible runs are wanted for debugging or daily-challenge
  modes (it would become a P3-4 enabler).
- **Save `stats`/`mods` forward-compat backfill** — `migrate()` only merges defaults
  for v0 saves; a future key added without a version bump would load as `undefined`
  (NaN cascade). Not currently triggered. Fold the always-merge into whichever
  Phase 1 test item touches `save.js` (P1-1) rather than tracking separately.
- **New maps/biomes** — deliberately last-priority: the research is unanimous that
  for a small team, modifier decks and settler variety buy far more replayability
  per hour than map content (AtS shipped biomes last, through Early Access).
- **Retiring the legacy `bed` tile tables** — dead migration cruft in three tables;
  harmless. Bundle into any save-touching plan opportunistically.

## Sequencing logic

```
P0 (days) → P1 tests (P1-1..3) → P1 refactors (P1-10 first, then P1-4..8)
                                        │
        HP-1 campaign store ────────────┤  (needs P1-1)
        HP-2 cast v2 ───────────────────┤  (needs P1-2, P1-4)
        HP-5 menace/scouting ───────────┤  (needs P1-4)
             │                          │
        HP-3 arrivals · HP-4 torchbearer · HP-6 sapper · HP-9 beacon · HP-10 winter
             │
        HP-7 endings → HP-8 campaign layer → **HP0 exit playtest**
             │
        post-HP0 backlog (gated on the playtest verdict)

        P5 (reach) — independent, schedule by demand
```

Three tracks parallelize after Phase 1: persistence (HP-1→3→7→8), the threat
(HP-5→6→9→10), and the cast/dusk (HP-2→4). The torchbearer (HP-4) and the
campaign layer (HP-8) are the two biggest new-UI items — land the P1-5
screens split before them.

## Research sources (abridged)

- Against the Storm: Game Developer interviews on scope + roguelite hybridization; Adrian Hon's design analysis; official wiki (Queen's Impatience).
- Hades: Game Developer on narrative rewards for death; GDC Podcast ep. 16 (Kasavin); Mirror of Night analyses.
- Slay the Spire (Casey Yano, Game Developer) · FTL (GDC 2013 postmortem) · Rogue Legacy (GDC 2014 "Budget Development").
- RimWorld Wiki: Raid points, AI Storytellers, Wealth management (turtle-tax failure modes), Defense structures (anti-killbox arms race), UI/alerts.
- Frostpunk (GDC 2019 "Why Make Games?"; Book of Laws analyses) · They Are Billions wave-design community analyses.
- RimWorld Console Edition (PlayStation.Blog / DualShockers): gamepad-first UI lessons — every menu ≤3 steps deep.
- Scope: Eremite's benchmarking method + 25% contingency (Game Developer); Odd Realm's player-interview loop (PC Gamer).
