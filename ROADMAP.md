# HEARTHFALL Roadmap

Revised 2026-07-08 against commit `d177bfd` and **[GDD.md](GDD.md) v2**. The
GDD is the destination; this roadmap is the route. The original audit roadmap
(written at `3ee106c`, 2026-07-07) has been fully executed through its
enablement phase — plans 001–008 are merged to main (see **Shipped**) — so
this revision does two things: replaces the pre-campaign-flip North Star with
one derived from GDD v2, and re-sequences what remains now that the safety
net, tuning surface, and layout work exist.

IDs are stable across revisions: `P0-*`/`P1-*`/`P5-*` survive from the audit
roadmap, `HP-*` is Milestone HP0 (GDD §10's v1 playable). Done items appear
once in Shipped and nowhere else. Effort: **S** = hours, **M** = a day-ish,
**L** = multi-day. Verification gates for all code work: `pnpm check`,
`pnpm lint`, `pnpm test` (52 tests; CI enforces all three on push/PR).
Detailed execution plans live in [plans/](plans/README.md).

---

## North star (derived from GDD v2 §1–2)

**Identity.** HEARTHFALL is a **campaign of settlements**: you lead one small
band of named, mortal, *aging* people from settlement to settlement across a
darkening world. Each settlement is a run — 45–75 minutes, founded, defended
night by night through the heartbeat (day = agency, dusk = consequence *you
play through the torchbearer*, dawn = reckoning) — and is won (a Beacon lit,
permanent light on the campaign map) or lost (survivors walk out; the dead
don't). **The band persists; the settlements are the runs**; the chronicle of
who these people were is the thing you actually build. And it starts
instantly — a browser tab, or the couch with a pad.

**USP.** The colony-sim × roguelite × wave-defense intersection is *occupied*
(The Last Spell, Rise to Ruins, Age of Darkness, Cult of the Lamb — GDD §1).
What's unclaimed is an **attachment-first** treatment of it, and the genre
record is unanimous that attachment lives in what *persists across* the loop,
never in what the loop consumes (Darkest Dungeon's roster, State of Decay's
community, Hades' cast). That is the campaign flip, and everything in
Milestone HP0 exists to test it. The delivery wedge stays alongside it:
zero-install + session-sized + pad-ready, which no genre neighbor ships.

**Pillars.** The pillars are GDD §2's eight — single source, not restated
here: **P1** a band, not a colony · **P2** the heartbeat, and you are in it ·
**P3** pressure is legible and tracks capacity · **P4** the exam is
player-scheduled and priced honestly · **P5** continuity carries history,
never stats · **P6** death is paid in memorial, not compensation · **P7**
legible depth · **P8** endings are choices. Each ends in a falsifier; HP0's
exit playtest is where the falsifiers get run for real. (This resolves the
old roadmap's PRODUCT.md promotion note: the GDD *is* the settled-intent
document now.)

**Cut test** — every non-enablement item must name its GDD pillar or be cut:

| GDD pillar | Served by |
|---|---|
| P1/P7 — band, legible depth | HP-2, HP-3 |
| P2 — embodied dusk | HP-4 |
| P3 — capacity-tracking pressure | HP-5, HP-6 |
| P4 — the priced exam | HP-9 |
| P5/P6 — continuity, memorial | HP-1, HP-8 |
| P8 — endings as choices | HP-7 |
| §7 — seasons flip verbs | HP-10 |
| Delivery wedge (instant, anywhere) | P0-4, P5-1..P5-4 |

Enablement (P1-5..P1-9) serves no pillar directly; it is the safety net and
tuning surface that let the pillars be executed aggressively.

**The playtest gate is open.** The audit roadmap's convergence check — after
Phase 0 + the layout work, playtest before building HP0 — is due **now**: the
game is pad-playable and decompressed. Run one-on-one player interviews (the
Odd Realm method) against the pillar falsifiers. The verdict steers HP0's
*tuning*, not its architecture — HP-1 and HP-5 are safe to start in parallel
with it.

---

## Shipped (audit-roadmap enablement, plans 001–008, merged 2026-07-08)

- **Phase 0 entire** (minus P0-4, below): controller build/demolish + alarm
  binding (P0-1/2), Continue camera recenter (P0-3), modifier-key suppression
  (P0-5), modal pause semantics (P0-6), pop-16 rescue cap (P0-7), numeric
  percentile sort (P0-8), CI workflow (P0-9), AGENTS.md/CLAUDE.md (P0-10),
  README code map (P0-11), wheel deltaMode (P5-5).
- **The characterization net** (P1-1/2/3): money paths + save round-trip,
  combat + economy tick, raids/pathing/expeditions — 52 tests across 7 files.
- **P1-10, in revised form** — fit-to-window was **rejected by owner
  decision: the fixed 100×45 / 1100×855 CRT container is part of the game's
  identity.** The sidebar was decompressed inside it instead (viewport 70
  cols, sidebar 28, more settler/minimap rows). *Treat the fixed CRT grid as
  a design constant in all future UI work.*
- **P1-4**: all sim tuning hoisted into `js/balance.js` (`BALANCE`) — the
  single tuning surface every HP0 item flows through.

## Enablement backlog

| ID | Item | Effort | Notes |
|----|------|--------|-------|
| **P1-5** | **Split `screens.js`** (still 1,099 lines — layout + input + direct `G` mutation interleaved). Continue the `js/ui/` extraction (`ui/menu.js` is the pattern); single-source the modal box math duplicated between `widgets()`/`draw()` (the P5-3 residual) as each modal moves. | L | Plan 009. Land before HP-4 and HP-8 (the two biggest new-UI items). |
| **P0-4** | **Keyboard/pad path to the morale "why"** — `moraleWhy()` is still mouse-only (`screens.js:304`); missed by plan 002's batch. | S | Folded into plan 026 (readability pass) — plan 009 is strictly zero-behavior-change. |
| **P1-6** | **Untangle the `game.js` barrel** — re-exports 47 symbols from 12 modules (`game.js:10-24`); view modules import `G` inconsistently. Direct imports; `game.js` stays the tick loop. | M | Plan 022. Mechanical; typecheck catches breakage. Natural follow-on to P1-5. |
| **P1-7** | **Dedupe renderer logic** — crop stages (`tiles.js:125` vs `mapdraw.js`), animation phases, scar thresholds reimplemented in both renderers; ASCII fishing-mark color gap. | M | |
| **P1-8** | **Job-scan performance** — `findJob` (`settlers.js:160`) walks all tiles per idle settler; `housingCap`/`claimBed` (`settlers.js:87,133`) full-scan. Actionable-tile index + house list. | M | Before any bigger-map/population ambitions. |
| **P1-9** | **Renderer idle cost** — full repaint every rAF frame even paused; per-frame radial gradient at night (`tiles.js:514`). Dirty-flag + prebuilt gradients. | M | Lowest priority; invisible on desktop. |

## Milestone HP0 — the Hypothesis Playable

Direct translation of GDD §10: the minimum build that tests the core
hypothesis — *does a persistent, mortal, aging band whose settlements die
make players found the next settlement?* The prerequisites the audit roadmap
demanded (test net, balance table) are **done**; only P1-5 remains as a
recommended pre-landing for the two UI-heavy items. All tuning flows through
`BALANCE`.

| ID | Item | Effort | Depends on | GDD |
|----|------|--------|------------|-----|
| **HP-1** | **The campaign store** — versioned cross-run persistence (band members with name/trait/wants/scars/age, campaign map state, lit Beacons, ruins, unlocks). New module, versioned from day one; `META` gains the version field it still lacks; ending flows write survivors *before* `clearSave()`. The architecture everything cross-run stands on. | M-L | — (plan 010) | §3, App A |
| **HP-2** | **The cast, v2** — per-person **resolve** as named bands (Steady/Fraying/Breaking; inputs at v1: food, sleep, deaths witnessed), visible **wants** (one each), **scars** (append-only, cross-campaign), **medic** role (4th), bonds/grudges as *display + resolve-on-partner-death only* (no adjacency/refusal teeth — the O(n²) bomb stays defused), breaks never mid-raid at v1. Global morale becomes a displayed aggregate. | L | — (plan 012) | §5 |
| **HP-3** | **Arrivals as decisions** — strangers at the gate shown as people (trait, want, age); accept = joins the *band* (campaign), decline has a visible cost. Low rate, event-weight. Replaces silent dawn recruiting. | M | HP-1, HP-2 (plan 013) | §5 |
| **HP-4** | **The torchbearer** — dawn "who carries the torch tonight"; at dusk, direct control of that one mortal band member (move, rally, sortie, rescue-the-downed); during raids, pause = look only, commands flow through the torchbearer. The embodiment pillar and the answer to "dusk is a cutscene." | L | HP-2; P1-5 first (plan 014) | §2 P2 |
| **HP-5** | **Menace + the scouting report** — two visible cause-ledgers replacing the day-count sizing formula (`forecasts.js:7-19`, `BALANCE.raid`): Menace ceiling (days, firelight claimed, noise, camps standing) and capacity-tracking raid sizing, with the published no-turtle-equilibrium inequality as an executable test over `BALANCE` and the no-death-spiral guard. Firelight-as-claims included. | M-L | — (plan 011) | §2 P3, §6 |
| **HP-6** | **The sapper** + counterplay-matrix cost pass — the anti-turtle archetype (breaches doors/walls; defeats the sealed `noDoor` ring, `raiders.js:102-133`); defenses priced against each other (space/labor/light). Slinger stays vLater. | M | HP-5 (plan 015) | §6 |
| **HP-7** | **Endings** — collapse becomes standing offers, player-paced: **Last Stand** (everything tonight; feats honored; EV strictly below a Beacon attempt) and **the Torch** (leave now; pick who walks out → written to the campaign store). Self-induced collapse forfeits feats. | M-L | HP-1 (plan 016) | §2 P8, §9 |
| **HP-8** | **The campaign layer** — wagon camp between settlements (tend wounded, spend legacy on options, pick next site, creed slot), campaign map v0 (site choice with visible quirk, lit Beacons persist, one canned your-ruins site), **aging** in simplest form (Green/Prime/Grey; Grey retire to the Chronicle). | L | HP-1, HP-7; P1-5 first (plan 017) | §3 |
| **HP-9** | **The Beacon as priced wager** — each exam night previewed at dawn; fixed concealed-share of each night's budget (a `BALANCE` number); first-attempt concealment draws only from taught vectors. | M | HP-5 (plan 018) | §2 P4 |
| **HP-10** | **Winter for real** — the one season verb-flip shipped fully at v1: desperate food-seeking raids (flipping `BALANCE.raid.winterReduction`'s *discount* into pressure) and the frozen river as a crossing — which requires the season-aware `walkable()` refactor (`state.js:31`), planned, not hand-waved. Other seasons stay numeric until post-HP0. | M-L | HP-5 (plan 019) | §7 |

Supporting HP0 items: trader demand-memory + Menace-decoupled pricing (S-M),
guaranteed event/arrival/ambition proc floor per game-day (S), and first-loss
content-unlock guarantee (S) are **plan 020**; ambitions v0 — Elder offers
1-of-2, reusing the `OBJECTIVES` shape (M) — and the event deck v0 at 15–25
templates, gated on HP-2's structures (M), are **plan 021**.

**HP0 exit test** (the only success criterion): playtesters who lose a
settlement found the next one, and by settlement ~5 they talk about band
members by name (GDD P1/P6 falsifiers). If HP0 fails that test, revisit GDD
§2 before building anything further.

## Post-HP0 backlog (vLater, gated on HP0's playtest verdict)

Held deliberately — each multiplies tuning or branch surface: slinger
archetype (ranged/suppression modality) · bond/grudge mechanical teeth
(adjacency, refusals) · equipment depth (armor/tools/durability; v1 is one
weapon slot) · creeds 3–6 (v1 ships 0–2) · vector-modifying Trials · spring/
summer/autumn verb-flips (mud, wildfire+wind, gathering-hordes) · mid-raid
resolve breaks (after test coverage exists) · ruins beyond the canned site
(full past-campaign persistence) · heirs/generations depth · workshop recipe
depth (only the armor axis survives, and only if it serves dusk tension) ·
infirmary structure · epilogue-settlement mode (GDD open question 6).

## Reach (schedule by demand)

| ID | Item | Effort | Notes |
|----|------|--------|-------|
| **P5-1** | **Colorblind + readability pass** — role identity on the map is color-only; HP bars are red/green with no numeral. Glyph/letter overlays + palette toggle. | M | |
| **P5-2** | **Screen-reader affordance** — mirror log/notices into a visually-hidden `aria-live` region; label the canvas. | M | |
| **P5-4** | **Touch support spike** — zero touch handlers; coarse-pointer devices get a landing page. Tap-to-cursor, drag-select, two-finger pan, minimal toolbar. With the CRT container now a design constant, tablets get the scaled fixed-aspect canvas — acceptable; phones stay out of scope. | L | After P1-5. |

(P5-3's residual — modal box-math duplication — moved into P1-5/plan 009.
P5-5 shipped in plan 002.)

## Considered and set aside

- **Seeded/persisted RNG** — save-scumming is plausibly by-design here;
  autosave-at-dawn + delete-on-death already bounds it. Revisit only for
  reproducible-bug or daily-challenge goals.
- **New maps/biomes** — deliberately last: for a small team, decks and cast
  variety buy more replayability per hour than map content (AtS shipped
  biomes last). GDD §10 is binding: one biome, one map size; run variety must
  come from site × season × menace × creed × cast.
- **Legacy `bed` tile tables** — dead migration cruft, harmless; bundle into
  any save-touching plan opportunistically.
- **Fit-to-window layout** — rejected on owner decision (see Shipped); do not
  re-propose. The CRT container is identity.

## Sequencing — one line, on main

Plans execute **sequentially on main** — no feature branches. Every plan ends
in a commit checkpoint with all three gates green (`pnpm check`, `pnpm lint`,
`pnpm test`); a staged plan may make one checkpoint per stage. The order below
is numeric with one exception — **plan 020 (the `js/beats.js` deck floor) lands
before plans 013 and 021, its deck consumers.** Full dependency graph and the
cross-plan coordination seams (SAVE_VERSION sequencing, the legacy-perks
reconciliation, the open §6 labor-invariant test) live in
[plans/README.md](plans/README.md). Architecture before content:

```
 009 screens split (P1-5, + P5-3 residual)
 010 campaign store (HP-1)
 011 menace + scouting report (HP-5)
 012 cast v2 (HP-2)
 015 the sapper + counterplay pricing (HP-6)
 016 endings: Last Stand & the Torch (HP-7)
 018 the Beacon as priced wager (HP-9)
 019 winter for real (HP-10)
 020 supporting systems (trader memory · proc floor · first-loss unlock)
 013 arrivals as decisions (HP-3)          ← after 020 (registers on its deck floor)
 021 ambitions v0 + event deck v0          ← after 020
 014 the torchbearer (HP-4)
 017 the campaign layer (HP-8)
 ──► HP0 exit playtest (the gate everything past this waits on)
 022 barrel · 023 renderer dedup · 024 job-scan · 026 readability (P1-6..8, P5-1)
 025 renderer idle (after 023) · 027 screen-reader · 028 touch spike
```

The order is numeric except 013/021 wait for 020 (their deck floor). It's one
valid topological sort of three tracks — persistence (010→016→017), threat
(011→015/018/019), cast/dusk (012→013/014) — so you can always just execute
the next line. The playtest gate (open now) runs alongside; it steers tuning,
not architecture.

## Research sources (abridged)

- Against the Storm: Game Developer interviews on scope + roguelite hybridization; Adrian Hon's design analysis; official wiki (Queen's Impatience).
- Hades: Game Developer on narrative rewards for death; GDC Podcast ep. 16 (Kasavin); Mirror of Night analyses.
- Slay the Spire (Casey Yano, Game Developer) · FTL (GDC 2013 postmortem) · Rogue Legacy (GDC 2014 "Budget Development").
- RimWorld Wiki: Raid points, AI Storytellers, Wealth management (turtle-tax failure modes), Defense structures (anti-killbox arms race), UI/alerts.
- Frostpunk (GDC 2019 "Why Make Games?"; Book of Laws analyses) · They Are Billions wave-design community analyses.
- RimWorld Console Edition (PlayStation.Blog / DualShockers): gamepad-first UI lessons — every menu ≤3 steps deep.
- Scope: Eremite's benchmarking method + 25% contingency (Game Developer); Odd Realm's player-interview loop (PC Gamer).
- The Last Spell, State of Decay, Darkest Dungeon, Kingdom, Valheim: genre-record sources behind GDD v2's campaign flip (see GDD §1 and Appendix A).
