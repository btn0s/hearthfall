# Plan 019: Winter is a verb (HP-10) — desperation raids and the frozen river as a crossing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Execution model**: plans run sequentially ON MAIN in numeric order. By the
> time this plan runs, **009–018 have landed** — in particular plan 011
> (Menace + scouting report) has replaced the old day-count raid formula with
> `scoutRaid()` in `js/menace.js` and turned `raidEstimate` into a thin
> wrapper, and it has already bumped `SAVE_VERSION` to 2 and spliced
> `menaceDawn()` into `onDawn`. Every excerpt below was **verified at
> `14fd915`** (this plan's plan-time HEAD), which is *before* 009–018
> executed; where a landed plan moved code, this plan says so and the executor
> **re-locates by symbol name**, not line number.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/state.js js/path.js js/raiders.js js/forecasts.js js/menace.js js/balance.js js/seasons.js js/dawn.js js/save.js js/settlers.js js/game.js js/world.js js/map.js js/tiles.js js/mapdraw.js js/data.js test/`
> Re-read `js/menace.js` (does `scoutRaid` exist? does it hold the winter
> clause?), `js/forecasts.js` (is `raidEstimate` the wrapper?), `js/save.js`
> (is `SAVE_VERSION === 2`?), and `js/state.js` (does `walkable` still read a
> pure tile lookup?) before starting. If `js/menace.js`/`scoutRaid` does not
> exist, **STOP** — plan 011 has not landed and this plan has nothing to flip
> (STOP condition 1).

## Status

- **Priority**: P1
- **Effort**: M-L
- **Risk**: MED (touches the hot walkability path shared by every mover; a
  save-shape bump; flips live raid behaviour — but each mechanism is small and
  independently tested)
- **Depends on**: plan **011** (its `BALANCE.raid.winterReduction` knob and the
  `scoutRaid` model in `js/menace.js` are what this plan flips — read
  `plans/011-menace-scouting.md`, Design section). 009/010 not required.
- **Category**: feature
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP-10 (Milestone HP0) · GDD §7 (seasons flip verbs), §9
  invariant 1 (defenses priced against threat in space/light)

## Why this matters

GDD §7 (`GDD.md:299-306`) commits to exactly one season getting a **real
verb-flip** at v1, and names it:

> "**winter is the most tactically different season** (frozen river becomes a
> crossing — both ways). v1-scope ships winter's flip for real … the
> frozen-river pathing refactor is planned work, not a hand-wave."

Today winter is the *safest* season, and Appendix B (`GDD.md:471`) flags this
as a distance-from-target defect: "winter is the *safest* season." The code
proves it twice over. The raid formula **discounts** winter
(`js/forecasts.js:13`: `if (isWinter()) n = Math.max(R.sizeBase, n -
R.winterReduction)`) and the cooldown **lengthens** it
(`js/game.js:295`: `+ (isWinter() ? R.cooldownWinterExtra : 0)`), so winter
means fewer, smaller raids. And the river is an inert wall of `water` tiles all
year (`T.water.walk === false`, `js/data.js:12`), so the palisade ring never
has to price the frozen approach the GDD promises.

This plan makes winter the season it is supposed to be, in two moves:

1. **Desperation raids.** Winter stops being a discount and becomes pressure:
   more raiders, sooner, and — the verb-flip — **coming for the food stores,
   not just the people**. Grounded in how raiders already choose targets
   (`js/raiders.js`): the skirmisher archetype already walks to the stockpile
   at the hearth, loots `G.res.food`, and runs (`skirmisherBrain`,
   `js/raiders.js:84-111`). Winter turns *every* plain raider into that hungry
   raider and skews the raid's composition toward thieves.

2. **The frozen river becomes a crossing — both ways.** You cross out; raiders
   cross in, opening approach vectors the palisade ring never had to defend.
   This needs the **season-aware `walkable()` refactor** the GDD names as real
   work. `walkable` (`js/state.js:31`) is a pure tile lookup today; this plan
   introduces a **walkability layer** — a per-tile `frozen` flag, set at the
   winter dawn and cleared at the thaw — that the three hot walkability reads
   consult without importing the season system (that is what keeps it
   cycle-free). Winter nights become genuine ice-crossing raid vectors (the
   dusk clock: raids spawn at `raidSpawnMinute` 1150, `js/balance.js:10`), and
   the scouting report (plan 011) surfaces the ice as a cause.

Fishing has to be answered honestly by the same freeze: you cannot cast a line
through solid ice. This plan **shuts winter fishing off** — the river's summer
job (feed you) is exactly the one the freeze takes away, which is what
"desperation" means. See the Design section for the decision and its ripple.

## Current state

All excerpts verified at `14fd915`. Vanilla-JS browser game; vitest; all
tuning in `js/balance.js` (plan 008); conventions in `AGENTS.md` (per-minute
scan caches, `G` singleton, versioned saves, sim modules import directly, view
modules import through the `game.js` barrel, both renderers show the same
info). **009–018 have landed by execution time** — the notes below flag every
place a landed plan (esp. 011) has moved the code.

### The winter raid discount — where it lives, and where 011 moved it

At `14fd915` the whole raid size lives in one formula, `js/forecasts.js:7-19`,
with the winter clause at line 13:

```js
if (isWinter()) n = Math.max(R.sizeBase, n - R.winterReduction);   // js/forecasts.js:13
```

**Plan 011 (landed) moves this clause into `scoutRaid()` in `js/menace.js`**
(see `plans/011-menace-scouting.md`, Design → "Scouting side", the `scoutRaid`
pseudocode): `if (inputs.winter) n -= R.winterReduction  // HP-10 flips this to
desperation raids — keep the knob`. Plan 011's Maintenance note names HP-10 as
the flip: "HP-10 flips `raid.winterReduction` into desperation-raid pressure …
the knob and its flag comment are the handoff." So at execution time:

- The winter clause is in `scoutRaid()` (`js/menace.js`), applied **before** the
  Menace floor/ceiling clamp. `raidEstimate` (`js/forecasts.js`) is a thin
  wrapper that gathers `G` into `inputs` and must pass `winter: isWinter()`
  (verify 011 wired this; if the wrapper omits `winter`, add it — Step 5).
- `BALANCE.raid.winterReduction` still exists (011 explicitly *kept* it while
  removing 8 other dead raid keys — see 011 Current state, "The BALANCE.raid
  keys involved").

### The cooldown lengthener — `js/game.js:295`

In the raid-resolved branch (re-locate by `cooldownWinterExtra`):

```js
G.raidNext = G.day + rint(BALANCE.raid.cooldownMin, BALANCE.raid.cooldownMax) + (isWinter() ? BALANCE.raid.cooldownWinterExtra : 0);
```

`cooldownWinterExtra: 2` (`js/balance.js:146`) pushes the next raid **two days
later** in winter. 011 kept all timer keys untouched. HP-12–HP-18 do not touch
this line (verify at drift check).

### How raiders choose targets — `js/raiders.js`

- **Generic raider** (`tickRaider`, `js/raiders.js:183-191`): paths to
  `nearestLiveSettler(r)` (`js/raiders.js:18-22`) — it hunts **people**.
- **Skirmisher** (`skirmisherBrain`, `js/raiders.js:84-111`): paths to the
  stockpile at `G.camp` (the hearth), and when adjacent loots
  `G.res.food`/`G.res.coin` (`js/raiders.js:86-99`) and flees. This is already
  the "food-seeking raid" verb, in one archetype. **There is no separate larder
  structure** — "the food stores" *is* `G.res.food`, physically the hearth at
  `G.camp` (which worldgen keeps off the river, `js/map.js:75`). The dispatch
  that sends skirmishers/torchers to their brains is `js/raiders.js:180-181`:

  ```js
  if (r.type === 'skirmisher') return skirmisherBrain(r);
  if (r.type === 'torcher') return torcherBrain(r);
  ```

- **Composition** (`raidComposition`, `js/raiders.js:195-206`): rolls each
  raider's type from day-gated chances (`skirmisherFromDay: 9`,
  `skirmisherChance: 0.25`, `js/balance.js:168-169`). `raiders.js` does **not**
  import `isWinter` today.

### The walkability path — every consumer of "can something stand here"

`walkable` is a pure tile lookup, `js/state.js:31`:

```js
export const walkable = (x, y) => inMap(x, y) && T[tileAt(x, y).t].walk;
```

Callers of `walkable(...)` (all get season-awareness for free once `walkable`
learns the `frozen` flag): `js/game.js:86`, `js/game.js:435`,
`js/world.js:217` (returning-party placement), `js/raiders.js:16` (`stepRandom`),
`js/raiders.js:225` (raid spawn edges), `js/settlers.js:106` (`moveToward`
per-step guard), `js/settlers.js:213` (`nudgeOff`), `js/settlers.js:287`.

Consumers that read `T[...].walk` **directly** (these bypass `walkable` and must
be audited one by one):

- `js/path.js:14` — `findPath`'s `pass()`: `if (T[t].walk) return true;`. **This
  is the pathfinding gate** — frozen tiles must pass here or nobody routes
  across the ice. Critical.
- `js/raiders.js:36` — `stepRaider`: `if (!T[tl.t].walk || tl.t === 'door')`
  decides walk-vs-bash. Water is neither walkable nor bashable, so a raider
  whose path lands on a water node drops the path; the frozen check must make it
  **walk** instead.
- `js/settlers.js:263` — after a build completes: `if (!T[def.id].walk)
  nudgeOff(...)`. **Not season-relevant** (water is never a build target); leave
  it, but note it in the audit so the review is complete.

There is **no global pathfinding cache**. `findPath` computes fresh each call;
entities cache their own `path` array (`s.path`/`r.path`). So "invalidation on
season change" = clearing entity paths at the transition, plus the two per-step
walkable guards (`js/settlers.js:106`, `js/raiders.js:36`) that already stop a
mover before it steps onto an unwalkable tile — see Design.

### Water gen, rendering, and fishing

- **Worldgen** (`js/map.js`): a meandering north-south river of `water` tiles
  with a ford every ~14 rows (`js/map.js:56-68`); lakes are `water` too
  (`js/map.js:46`). River and lake tiles are indistinguishable (`t: 'water'`),
  so the freeze applies to **all** `water` tiles — realistic and simpler than
  tagging the river. The camp is placed ≥12 tiles off the river
  (`js/map.js:75`), so the hearth stockpile is never stranded by a thaw.
- **Rendering** — the frozen visual is one branch per renderer, kept minimal:
  - ASCII (`js/mapdraw.js`): `WINTER_FG.water` already recolours water in winter
    (`js/mapdraw.js:11`), and `js/mapdraw.js:26` picks the water glyph. One small
    edit swaps a flat ice glyph when `tl.frozen`.
  - Sprite (`js/tiles.js`): a full-screen winter tint already lies over the map
    (`js/tiles.js:481-484`); `water` is in the `FULL` sprite set
    (`js/tiles.js:385`). The overlay already reads as "frozen"; an optional
    single branch in `drawMapTiles` can pale the ice further. Minimal.
- **Fishing** (`js/settlers.js`): fishing works on `water` tiles year-round
  today, at a reduced winter yield (`fishWinter: [1,2]` vs `fishNormal: [2,4]`,
  `js/balance.js:203-204`; used at `js/settlers.js:225`). The job is offered at
  `js/settlers.js:176` and validated at `js/settlers.js:199`
  (`case 'fish': return tl.desig === 'fish' && tl.t === 'water' && !(tl.fishCd >
  0)`). **Foraging is already winter-gated** the exact way this plan will gate
  fishing (`js/settlers.js:175,198`: `&& !isWinter()` — bushes sleep in winter).
  Player-facing copy tells people to fish in winter (`js/data.js:251-252`), so
  that copy changes with this decision.

### Season plumbing and save

- `isWinter()` = `seasonIdx() === 3` (`js/seasons.js:9`), `SEASON_LEN = 5`
  (`js/data.js:124`) — winter is days 16–20, 36–40, … The season changes only at
  a day boundary, i.e. at dawn.
- Dawn pipeline: `onDawn()` = `communeDawn()` → (011 inserts `menaceDawn()`) →
  `worldDawn()` → `save()` (`js/dawn.js:7-13`).
- `makeState()` (`js/state.js:4-25`) seeds run state; 011 added `menace`/
  `noiseBuilds` here.
- `js/save.js`: `SAVE_VERSION` is **2 after 011** (was 1 at `14fd915`,
  `js/save.js:7`); `toSaveData` destructure+object at `js/save.js:12-29`
  **includes `tiles`** (line 23 — so a per-tile `frozen` flag persists for
  free); `migrate` at `js/save.js:31-65`; `loadGame` does
  `Object.assign(G, makeState(), d)` (`js/save.js:86`). House rule: any
  save-shape change ⇒ bump `SAVE_VERSION`, extend `migrate`, add a migration
  test.

### The test net

- `test/raid-path.test.js` — `findPath`/`spawnRaid`/`raidEstimate` characterization
  with `grassTiles()` and a `tile(x,y,t,extra)` helper
  (`test/raid-path.test.js:19-25`); stub-then-import header at lines 1-17.
  `raidEstimate` block (`:73-105`) is **rewritten by 011**; the `spawnRaid` and
  `findPath` blocks are stable.
- Plan 011 created `test/menace.test.js` with a **"Winter knob" property**
  (winter makes `n` *smaller* by ≤ `winterReduction`) and `test/balance.test.js`
  invariants over `BALANCE`. Both reference `winterReduction` and must be
  updated when this plan renames/flips it.

## Design (decided here, executed below)

### Part 1 — winter is pressure, and it comes for the food

Three grounded flips, each a small edit:

- **Bigger** (numeric): rename `BALANCE.raid.winterReduction` →
  `BALANCE.raid.winterSurge` and flip the sign of the clause 011 parked in
  `scoutRaid()`: `if (inputs.winter) n += R.winterSurge`. Applied before the
  Menace clamp (011), so winter raids grow **within** what the world's attention
  allows — winter is desperation, not a scheduled horde that pierces the
  ceiling. Start `winterSurge: 3`.
- **Sooner** (numeric): rename `cooldownWinterExtra` → `cooldownWinterMod` and
  flip it negative (`-1`) so winter *shortens* the gap
  (`js/game.js:295`), floored so the next raid is never same-day:
  `G.raidNext = Math.max(G.day + 1, G.day + rint(cooldownMin, cooldownMax) + (isWinter() ? R.cooldownWinterMod : 0))`.
- **Hungry** (behavioural — the verb-flip): winter raiders target the food
  stores, not just people. Two reuse-first changes in `js/raiders.js`:
  - **Delegation**: in `tickRaider` dispatch (`js/raiders.js:180-181`), send
    plain winter raiders to the *existing, tested* `skirmisherBrain` — "in
    winter, every raider is a hungry raider":
    `if (r.type === 'skirmisher' || (isWinter() && r.type === 'raider')) return skirmisherBrain(r);`
    Brutes and torchers keep their jobs (winter still has muscle and fire).
  - **Composition** (`raidComposition`, `js/raiders.js:201`): skew the roll
    toward skirmishers in winter with a new `winterSkirmisherChance: 0.5`:
    `else if (G.day >= R.skirmisherFromDay && chance(isWinter() ? R.winterSkirmisherChance : R.skirmisherChance)) t = 'skirmisher';`

  Both require `raiders.js` to `import { isWinter } from './seasons.js'`
  (cycle-safe: `seasons.js` imports `state`/`data`, never `raiders`).

### Part 2 — the walkability layer (the frozen crossing)

**Decision: materialise the freeze as a per-tile `frozen` flag, not a live
season check inside `walkable`.** A live `isWinter()` call inside `walkable`
(`state.js`) or `pass()` (`path.js`) would force those low-level modules to
import `seasons.js`, and `seasons.js` imports `state.js` — an import cycle (011
STOP condition 5; this plan keeps the same aversion). Reading a tile field has
no such dependency. So:

- The three hot reads consult `tl.frozen`, adding **no new import**:
  - `js/state.js:31` `walkable`:
    ```js
    export const walkable = (x, y) => { if (!inMap(x, y)) return false; const tl = tileAt(x, y); return T[tl.t].walk || tl.frozen === true; };
    ```
  - `js/path.js` `pass()`: `if (T[t].walk || tl.frozen) return true;` (both
    settlers and raiders route across ice — "both ways").
  - `js/raiders.js:36` `stepRaider`: `if ((!T[tl.t].walk && !tl.frozen) || tl.t === 'door')` — a raider whose path lands on frozen water now **walks** instead of dropping the path.
- The season transition — set/clear the flags — lives in a **new module
  `js/freeze.js`** that *may* import `seasons.js`, because nothing on the
  walkability path imports `freeze.js`. Complete module:

```js
// js/freeze.js — the winter freeze layer.
// Water is impassable year-round (T.water.walk === false, js/data.js:12); in
// winter the river and lakes freeze into crossable ice — the season's verb-flip
// (GDD §7): the summer food lane becomes the winter attack lane, both ways. The
// layer is a per-tile `frozen` flag so the hot walkability reads (walkable,
// pass(), stepRaider) stay pure tile lookups with NO season import — that is
// what keeps this cycle-free. Season transitions live HERE, where importing
// seasons.js is safe because nothing on the walkability path imports this file.
import { G, inMap } from './state.js';
import { MAP_W, T } from './data.js';
import { isWinter } from './seasons.js';
import { addLog } from './journal.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Reconcile every water tile's frozen flag to the current season. Idempotent —
// call after loadGame() or when a fresh map is installed (a save reloaded in
// mid-winter must show a frozen river immediately, not at the next dawn).
export function syncFreeze() {
  if (!G.tiles) return;
  const winter = isWinter();
  for (const tl of G.tiles) {
    if (tl.t !== 'water') continue;
    if (winter) tl.frozen = true; else delete tl.frozen;
  }
  G.frozen = winter;
}

// One call per dawn. Detects the freeze/thaw EDGE and does the transition work:
// flip the flags, invalidate in-flight routes, log the turn, and on thaw move
// anything standing on now-open water to solid ground (nobody drowns at melt).
export function freezeTick() {
  if (!G.tiles) return;
  const winter = isWinter();
  if (winter === !!G.frozen) return;              // no edge this dawn
  for (const tl of G.tiles) {
    if (tl.t !== 'water') continue;
    if (winter) tl.frozen = true; else delete tl.frozen;
  }
  G.frozen = winter;
  // A path plotted across ice is a death-trap once it melts; a path that
  // detoured around open water is stale once it freezes. Drop them all — the
  // per-step walkable guards (js/settlers.js:106, js/raiders.js:36) already stop
  // anyone mid-crossing safely; this just lets everyone re-route at once.
  for (const s of G.settlers) { s.path = null; s.pathGoal = null; }
  for (const r of G.raiders) r.path = null;
  if (winter) {
    addLog('❄ The river has frozen — it will carry more than fish now.', '#a8c8e8');
  } else {
    strandOffIce();
    addLog('The thaw breaks the ice; the river runs open again.', '#9ab0c8');
  }
}

// After a thaw, nudge any entity still standing on a now-open water tile to the
// nearest walkable neighbour (mirrors nudgeOff, js/settlers.js:209-216).
function strandOffIce() {
  for (const e of [...G.settlers, ...G.raiders]) {
    if (e.away) continue;
    const here = G.tiles[e.y * MAP_W + e.x];
    if (!here || here.t !== 'water') continue;
    for (const [dx, dy] of DIRS) {
      const x = e.x + dx, y = e.y + dy;
      if (!inMap(x, y)) continue;
      const nt = G.tiles[y * MAP_W + x];
      if (nt && T[nt.t].walk) { e.x = x; e.y = y; break; }
    }
  }
}
```

`freezeTick()` is called in `onDawn` (inside the `!G.gameOver` guard, adjacent
to 011's `menaceDawn()`); `syncFreeze()` is called after `loadGame()` and when a
fresh map is installed at founding. The freeze holds **all winter, day and
night** (the river does not thaw between dawns), so winter *nights* are
ice-crossing raid vectors with no per-night toggling — the dusk clock gets its
new vector for free.

**Cycle audit.** `freeze.js` imports `state`, `data`, `seasons`, `journal` —
none import `freeze.js`. `state.js`/`path.js`/`raiders.js` gain **no** import
from the freeze/season layer (they read `tl.frozen`). `dawn.js` and `save.js`
import `freeze.js` (neither is imported by it). No cycle.

### Part 3 — fishing: the freeze takes the food lane

**Decision: winter shuts fishing off.** You cannot fish through solid ice, and
the whole point of "winter desperation" is that the river's summer job — feeding
you — is the one the freeze removes, right as it opens as an attack lane. This is
the same verb-flip foraging already has (bushes sleep in winter,
`js/settlers.js:175,198`); fishing joins it. Implementation: add `&& !isWinter()`
to the fish job offer (`js/settlers.js:176`) and validity (`js/settlers.js:199`),
mirroring forage exactly.

Ripple, handled in-scope:

- `BALANCE.yields.fishWinter` (`js/balance.js:203`) becomes unused-in-practice.
  Keep it, with a comment marking it dormant — mirrors 011 keeping
  `winterReduction` as a documented handoff knob rather than churning the table;
  it is the reclaim point for a future ice-fishing structure. (It is a data key,
  not an import, so lint does not flag it.)
- Player copy that tells people to fish in winter must stop lying
  (`js/data.js:251-252`): the autumn tip points fishing at the pre-freeze window;
  the winter tip drops fishing and names the ice as the new danger.
- Fish *designations* may still be **placed** on frozen water (they simply
  produce nothing until thaw) — identical to how forage designations behave in
  winter today. No change needed to designation placement (`js/game.js:339`).

## Commands you will need

| Purpose   | Command                                | Expected on success  |
|-----------|----------------------------------------|----------------------|
| Install   | `pnpm install`                         | exit 0               |
| Tests     | `pnpm test`                            | all pass             |
| One file  | `pnpm vitest run test/freeze.test.js`  | that file passes     |
| Typecheck | `pnpm check`                           | exit 0               |
| Lint      | `pnpm lint`                            | exit 0               |
| Play      | `pnpm dev` → http://localhost:8137     | manual check, Step 7 |

Debug hooks for manual verification: `window.G`, `window.ff(minutes)`
(fast-forward) — see AGENTS.md. To reach winter fast: `ff(1440 * 15)` from a new
run puts you at day 16.

## Scope

**In scope**:
- `js/freeze.js` (create), `test/freeze.test.js` (create)
- `js/state.js` — `walkable` reads `frozen`; `makeState` gains `frozen: false`
- `js/path.js` — `pass()` reads `frozen`
- `js/raiders.js` — `stepRaider` frozen walk; winter delegation + composition
  skew; `import isWinter`
- `js/menace.js` — flip the `scoutRaid` winter clause (`-=` → `+=`, renamed knob)
- `js/forecasts.js` — ensure the `raidEstimate` wrapper passes `winter`
- `js/balance.js` — rename/flip `winterReduction`→`winterSurge` and
  `cooldownWinterExtra`→`cooldownWinterMod`; add `winterSkirmisherChance`;
  comment `fishWinter` dormant
- `js/game.js` — cooldown flip at the raid-resolved line
- `js/settlers.js` — winter-gate fishing (job + validity)
- `js/dawn.js` — call `freezeTick()`; `js/save.js` — `SAVE_VERSION 3` +
  migration + `syncFreeze()` on load; the founding path — `syncFreeze()`
- `js/mapdraw.js` (+ optionally `js/tiles.js`) — one frozen-water render branch
- `js/data.js` — autumn/winter tip copy
- `js/forecasts.js` `tonightInfo` — a winter ice-crossing marker
- `test/raid-path.test.js`, `test/menace.test.js`, `test/balance.test.js`,
  `test/save.test.js` — extend as specified
- `plans/README.md` — status row

**Out of scope** (do not touch):
- The Menace ledger / scouting model itself (011) — this plan flips one knob
  inside `scoutRaid` and reads `raidEstimate`, nothing more.
- Spring mud / summer fire / autumn gathering-hordes verb-flips — GDD §7 ships
  only winter's flip for real at v1; the rest stay numeric.
- New raider archetypes (the sapper is HP-6) — winter reuses the existing
  skirmisher brain; add no new type here.
- Fishing yield *values*, trader pricing, morale, crop growth.
- A distinct frozen-water sprite atlas entry — the winter overlay plus one tint
  branch is the whole visual budget (GDD §7 flip is mechanical, not art).

## Git workflow

- Branch: `advisor/019-winter-verbs`
- Commits: one per step. Imperative messages ("Flip the winter raid knobs in BALANCE").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: BALANCE — flip the winter knobs (table first, so the tests pin it)

In `js/balance.js`, in the `raid:` block:

- Rename `winterReduction: 2` → `winterSurge: 3` with a comment:
  `winterSurge: 3, // raid-size SURCHARGE in winter (HP-10 verb-flip; was winterReduction, a discount)`
- Rename `cooldownWinterExtra: 2` → `cooldownWinterMod: -1` with a comment:
  `cooldownWinterMod: -1, // winter shortens the gap between raids (HP-10; was cooldownWinterExtra: +2)`
- Add `winterSkirmisherChance: 0.5,` next to `skirmisherChance`
  (`js/balance.js:169`), commented: `// winter raids skew to food-thieves`.

In `js/balance.js` `yields:`, comment `fishWinter` dormant:
`fishWinter: [1, 2], // dormant — winter fishing removed by HP-10 (frozen river); reclaim for an ice-fishing structure`

Then fix the two tests plan 011 wrote against the old winter knob:

- `test/balance.test.js` — any assertion referencing `BALANCE.raid.winterReduction`
  updates to `winterSurge` (and to `> 0` — it is now a surcharge).
- `test/menace.test.js` — the **"Winter knob" property** currently asserts winter
  makes `n` *smaller* by ≤ `winterReduction`; invert it to: winter makes `n`
  *larger* by ≤ `winterSurge` (comment: "HP-10 flipped the winter discount to a
  surcharge"). Do not touch the other menace properties.

Do NOT yet change `scoutRaid`'s operator — that is Step 5, so the suite stays
green here except the two tests you just re-pinned.

**Verify**: `grep -rn "winterReduction\|cooldownWinterExtra" js/ test/` → no
hits. `pnpm vitest run test/balance.test.js` → pass. `pnpm check && pnpm lint`
→ exit 0. (`pnpm test` will show `test/menace.test.js`'s winter property red
until Step 5 flips the operator — expected; note it and continue.)

### Step 2: the walkability layer — `js/freeze.js` + `frozen` state + the three reads

Create `js/freeze.js` exactly as the Design section gives it (`syncFreeze`,
`freezeTick`, `strandOffIce`). JSDoc is unnecessary (no exported params beyond
none); `pnpm check` runs tsc over `js/`.

In `js/state.js`:
- `makeState()` (re-locate the returned object literal): add `frozen: false,`
  near `beaconDay`/the raid flags.
- Rewrite `walkable` (`js/state.js:31`) to the Design form (reads `tl.frozen`).

In `js/path.js`, in `pass()` (`js/path.js:10-16`), read the tile once and add the
frozen branch:
```js
const pass = (x, y) => {
  if (!inMap(x, y)) return false;
  const tl = tileAt(x, y);
  const t = tl.t;
  if (opts.noDoor && t === 'door') return false;
  if (T[t].walk || tl.frozen) return true;
  return !!opts.raider && (t === 'wall_w' || t === 'wall_s');
};
```

In `js/raiders.js`, `stepRaider` (`js/raiders.js:36`): change the guard to
`if ((!T[tl.t].walk && !tl.frozen) || tl.t === 'door') {`.

Leave `js/settlers.js:263` (`if (!T[def.id].walk) nudgeOff(...)`) unchanged —
audited, not season-relevant (water is never a build target).

**Verify**: `pnpm check && pnpm lint` → exit 0. `pnpm test` → same state as end
of Step 1 (only the menace winter property red; nothing else regresses —
`makeState` gaining `frozen` is additive; no water in existing fixtures so
`frozen` is never set). If any `findPath`/`spawnRaid`/settler test regresses,
STOP (the frozen read leaked into a non-winter path — condition 5).

### Step 3: tests for the crossing

**Extend `test/raid-path.test.js`** — add a `describe('frozen crossing')` using
the file's `grassTiles()`/`tile()` helpers:

1. **walkable flips with the frozen flag**: paint a vertical `water` wall
   (`for (let y=0;y<10;y++) tile(5,y,'water')`) across a grass field. Assert
   `findPath(1,5,9,5)` is `null` (open water blocks). Then set `frozen: true` on
   that column (`tile(5,y,'water',{ frozen:true })`) and assert `findPath(1,5,9,5)`
   is non-null **and** its tiles include one with `x===5` (it crosses the ice, it
   does not go around a 96-tall map).
2. **both ways / raider crossing**: same frozen column, assert
   `findPath(1,5,9,5,{ raider:true })` is non-null and crosses `x===5`.
3. **boxed in with ice**: box a tile with `water` on all four sides
   (unfrozen) → `findPath` out is `null`; flip the four to `frozen:true` →
   `findPath` out is non-null (the ice is the way out).
4. **`walkable` unit**: import `walkable` from `state.js`; `tile(5,5,'water')` →
   `walkable(5,5) === false`; `tile(5,5,'water',{ frozen:true })` →
   `walkable(5,5) === true`.

**Create `test/freeze.test.js`** — stub-then-import header copied from
`test/raid-path.test.js:1-17`, importing `state.js`, `freeze.js`, `data.js`, and
`seasons.js` (for `SEASON_LEN`). `beforeEach`: `Object.assign(G, makeState());
G.tiles = grassTiles();` (copy `grassTiles`/`tile`). Drive the season with
`G.day` (winter = day 16; SEASON_LEN 5 ⇒ `seasonIdx()===3`).

1. **`syncFreeze` is idempotent + season-correct**: paint some `water`;
   `G.day = 3` (spring) → `syncFreeze()` → no tile has `frozen`, `G.frozen ===
   false`; `G.day = 16` (winter) → `syncFreeze()` → every `water` tile
   `frozen === true`, `G.frozen === true`; call again → unchanged.
2. **`freezeTick` onset**: `G.day = 16`, `G.frozen = false`, `G.settlers`/
   `G.raiders` each carry a stale `path` → `freezeTick()` sets `G.frozen`,
   freezes water, clears every entity's `path`, and appends a journal line
   (assert `G.log[0]` mentions the river/ice).
3. **`freezeTick` thaw strands nobody on open water**: freeze first
   (`G.day=16; freezeTick()`), place a settler and a raider **on** a frozen water
   tile, then `G.day = 21` (spring) and `freezeTick()` → water no longer
   `frozen`, and **neither entity is left on a `water` tile** (assert the tile
   under each is walkable); `G.frozen === false`.
4. **no edge = no-op**: `G.frozen = true; G.day = 16` (already winter) →
   `freezeTick()` returns without a new log entry.

**Verify**: `pnpm vitest run test/raid-path.test.js test/freeze.test.js` →
pass. If a thawed entity is still on water, STOP (condition 3).

### Step 4: wire the transition — dawn + load + founding

- `js/dawn.js`: `import { freezeTick } from './freeze.js';` and call
  `freezeTick()` inside the `if (!G.gameOver)` guard, adjacent to 011's
  `menaceDawn()` (re-locate that call; order relative to `menaceDawn` does not
  matter, but `freezeTick` must run before `save()`).
- `js/save.js`: `import { syncFreeze } from './freeze.js';` and call
  `syncFreeze()` at the end of `loadGame()`, after `Object.assign(G,
  makeState(), d)` and before `return true` (`js/save.js:86-87`) — a save
  reloaded mid-winter must show a frozen river at once.
- **Founding path**: wherever a fresh run installs `G.tiles` from `genMap()`
  (grep `genMap(` / the run-start autosave near `js/screens.js:61` — note 009
  split `screens.js`, so re-locate by symbol, likely in a `startRun`/founding
  function), call `syncFreeze()` right after the tiles are assigned. New runs
  start in spring (day 1), so this is a safety no-op today, but it keeps the
  invariant "tiles installed ⇒ freeze reconciled" true for any future
  season-of-founding.

Add to `test/freeze.test.js`: **dawn integration** — `G.day = 16`,
`G.frozen = false`, run `onDawn()` (import from `js/dawn.js`; give it the
minimum state `onDawn` needs — copy the shape from any existing `onDawn`/dawn
test if one exists, else stub `G.world = { locs: [] }` and ensure
`!G.gameOver`), assert the river froze. If `onDawn` pulls in too much of the
sim to unit-test cleanly, assert the wiring instead by grepping (Done criteria)
and keep the `freezeTick` unit tests as the behavioural proof.

**Verify**: `pnpm test` → same red/green state as Step 3 (menace winter
property still red until Step 5; everything else green). `pnpm check && pnpm
lint` → exit 0.

### Step 5: winter is pressure (the numeric + behavioural flips)

- `js/menace.js` `scoutRaid`: flip the winter clause operator (re-locate by
  `winter`): `if (inputs.winter) n += R.winterSurge;` (was `n -=
  R.winterReduction`). This makes the Step-1 menace winter property go green.
- `js/forecasts.js` `raidEstimate`: confirm the wrapper passes
  `winter: isWinter()` into `inputs`; add it if 011's wrapper omitted it (it is
  needed for the clause above to fire). `isWinter` is already imported in
  `forecasts.js` (`js/forecasts.js:5`).
- `js/game.js` cooldown line (re-locate by `cooldownWinterMod`, formerly
  `cooldownWinterExtra`, in the raid-resolved branch ~`js/game.js:295`):
  ```js
  G.raidNext = Math.max(G.day + 1, G.day + rint(BALANCE.raid.cooldownMin, BALANCE.raid.cooldownMax) + (isWinter() ? BALANCE.raid.cooldownWinterMod : 0));
  ```
- `js/raiders.js`:
  - `import { isWinter } from './seasons.js';` (add to the imports).
  - Dispatch (`js/raiders.js:180-181`): change the skirmisher line to
    `if (r.type === 'skirmisher' || (isWinter() && r.type === 'raider')) return skirmisherBrain(r);`
  - `raidComposition` skirmisher roll (`js/raiders.js:201`): use
    `chance(isWinter() ? R.winterSkirmisherChance : R.skirmisherChance)`.

Add tests:

- `test/menace.test.js`: the winter property flipped in Step 1 now passes
  against the real `scoutRaid` (winter `n` ≥ non-winter `n`, by ≤ `winterSurge`).
- `test/raid-path.test.js`, new `describe('winter raids')` (mock RNG like the
  `spawnRaid` block, `:114-116`):
  - **hungry raider delegates**: with `G.day` in winter, a plain `raider`
    positioned one tile from `G.camp` and `G.res.food > 0`, one `tickRaider(r)`
    (or `tickRaiders()`) loots food like a skirmisher (`G.res.food` drops /
    `r.loot` set) — proving the winter delegation. In a non-winter day the same
    raider paths at a settler instead (no loot).
  - **composition skews in winter**: force `chance` to return `true` and
    `G.day` into winter (≥ `skirmisherFromDay`); `raidComposition(6, false)`
    yields more `'skirmisher'` entries than the same call outside winter with
    `chance` returning `true` at `skirmisherChance`'s gate — or, more robustly,
    assert that with `chance` stubbed to compare against the passed probability,
    the winter call reads `winterSkirmisherChance`. (Keep it simple: stub
    `chance` to `(p) => p >= 0.5` and assert winter produces skirmishers where
    non-winter, `p=0.25`, does not.)

**Verify**: `pnpm test` → **entire suite green** (the menace winter property is
now satisfied by real code). `pnpm check && pnpm lint` → exit 0.

### Step 6: fishing — the freeze takes the food lane

- `js/settlers.js`: add `&& !isWinter()` to the fish job offer
  (`js/settlers.js:176`) and the fish validity case (`js/settlers.js:199`),
  mirroring the forage gates two lines up (`isWinter` is already imported,
  `js/settlers.js:8`).
- `js/data.js` tips (`js/data.js:251-252`): rewrite so the copy stops telling
  players to fish in winter, e.g.:
  - autumn: `'Autumn. Winter comes in 5 days: crops stop, bushes sleep, and the river will freeze. Stockpile food, cook meals, and fish the river now — before the ice.'`
  - winter: `'WINTER. Nothing grows, the river freezes, and hunger bites harder. Live off your stores or trade for food until the thaw — and watch the ice: it carries raiders now, not fish.'`

Add to `test/raid-path.test.js` (or a small `settlers` test if one exists):
paint a `water` tile with `desig:'fish'`; assert the fish task is **valid**
outside winter and **invalid** in winter (drive `G.day`). Reuse the existing
`taskValid`/`findJob` if exported; if neither is exported, assert the behaviour
through the smallest exported surface, or add a focused unit that imports the
predicate — do not export new internals just for the test if a public path
exists.

**Verify**: `pnpm test` → green. `pnpm check && pnpm lint` → exit 0.

### Step 7: persistence (SAVE_VERSION 3), the frozen visual, and the ice marker

**Save** (`js/save.js`):
- `SAVE_VERSION = 3` (was 2 after 011).
- `toSaveData`: add `frozen` to the destructure and the returned object
  (`js/save.js:12-29`). The `tiles` array already serialises, so per-tile
  `frozen` flags persist automatically — `G.frozen` is the only new top-level
  field.
- `migrate`: after 011's v1→v2 block, add v2→v3:
  ```js
  if (d.version < 3) {
    d.frozen = false;   // reconciled to the real season by syncFreeze() at load
    d.version = SAVE_VERSION;
  }
  ```
  (The tiles in a pre-v3 save have no `frozen` flags; `syncFreeze()` in
  `loadGame` — added Step 4 — sets them to match the loaded season, so a v2 save
  reloaded in winter freezes on load, not at the next dawn.)
- `test/save.test.js`: (a) round-trip — freeze a couple of tiles + set
  `G.frozen = true`, `save()`, `loadGame()`, assert `G.frozen` and the tile
  flags survive; (b) v2→v3 migration in the shape of 011's v1→v2 test — write a
  `save()`, edit raw JSON to `raw.version = 2; delete raw.frozen; raw.day = 16`
  (winter), re-store, `loadGame()`, assert `G.frozen === true` **and** water
  tiles are `frozen` (proving `syncFreeze` ran on load).

**Frozen visual** (minimal):
- `js/mapdraw.js` (ASCII, re-locate the water glyph line, `~26`): when
  `tl.frozen`, use a flat ice glyph and a pale fg, e.g.
  `if (tl.t === 'water') ch = tl.frozen ? '·' : (((x + y + (f >> 4)) % 2) ? '≈' : '~');`
  and, if `tl.frozen`, override `fg` to a light blue (`#cfe0f0`). Keep it to
  this one branch; `WINTER_FG.water` (`js/mapdraw.js:11`) already handles the
  base recolour.
- `js/tiles.js` (sprite): **optional** — the full-screen winter tint
  (`js/tiles.js:481-484`) already reads as frozen. If a clearer read is wanted,
  add a single branch in `drawMapTiles`'s ground layer that fills a pale rect
  over a `tl.frozen` cell before the water sprite. Do not add an atlas entry.

**Scouting-report ice marker** (011's report surfaces "they cross the ice"):
- `js/forecasts.js` `tonightInfo` (`js/forecasts.js:21-36`): in the
  raid-tonight branch, when `isWinter()`, append a marker to the label, e.g.
  ` ❄ ice-crossing`. This is the minimal report surface; 011's full
  scouting panel (deferred behind plan 009) can later read the same season +
  Menace ledger to say it in prose.

**Verify**:
- `pnpm check && pnpm lint && pnpm test` → all green.
- Manual (`pnpm dev`): new run → `ff(1440*15)` to day 16 → the river renders as
  ice, and a settler ordered across it now paths over the river (it did not in
  autumn); the tonight line shows the ice-crossing marker on a raid night; a
  winter raid brings thieves that make for the stores; `ff` to day 21 (thaw) →
  the river runs open again and no one is stranded on it; save & quit → Continue
  mid-winter → the river is still frozen on reload. Both renderers (pause menu →
  Graphics toggle) show a frozen river.

### Step 8: calibration snapshot + `plans/README.md`

Record the winter curve so the next tuner has a baseline. In
`test/raid-path.test.js` (or `test/menace.test.js`, wherever the raid-size
bands live), add one table-driven check: at a fixed board and Menace, assert the
winter raid `n` lands in a **band above** the same-board non-winter `n` (winter
is pressure), e.g. `n_winter ∈ [n_summer + 1, n_summer + winterSurge]` under the
Menace clamp. Comment the old behaviour (winter was `n_summer − winterReduction`,
i.e. *smaller*) so the flip is legible in the test. If the band cannot hold with
numbers that also satisfy 011's published inequalities, STOP condition 2 applies
(report the tension; do not silently retune 011's table).

Update `plans/README.md`: set this plan's row Status to DONE (add it in the
table's shape if absent):

```
| 019 | Winter is a verb: desperation raids + the frozen river as a crossing | HP-10 | P1 | M-L | 011 | DONE |
```

and under any "Dependency notes", note that the walkability layer (`tl.frozen`)
is the seam a future spring-mud/summer-fire flip would reuse, and that winter
fishing is deliberately removed (with `fishWinter` kept dormant for an
ice-fishing structure).

**Verify**: `pnpm check && pnpm lint && pnpm test` all exit 0; `git status`
shows only in-scope files.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/freeze.test.js` ~6 tests
(syncFreeze idempotence/season-correctness, freezeTick onset/thaw-strand/no-op,
dawn integration); `test/raid-path.test.js` +~7 (frozen-crossing block, winter
raids block, fishing gate, calibration band); `test/menace.test.js` winter
property inverted; `test/balance.test.js` winter-knob assertion updated;
`test/save.test.js` +2 (round-trip + v2→v3) — all green alongside the existing
suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `grep -rn "winterReduction\|cooldownWinterExtra" js/ test/` → no hits
      (both knobs renamed and flipped)
- [ ] `grep -n "frozen" js/state.js js/path.js js/raiders.js` shows the three
      hot reads consulting `tl.frozen`, and **no** new `seasons.js`/`freeze.js`
      import in `state.js` or `path.js`
- [ ] `js/freeze.js` exists; `grep -rn "freeze" js/dawn.js js/save.js` shows
      `freezeTick` wired at dawn and `syncFreeze` on load
- [ ] A frozen river is crossable both ways (findPath test) and no entity is
      stranded on open water after a thaw (freeze test)
- [ ] Winter raids are bigger (`scoutRaid` `+= winterSurge`), sooner (cooldown
      flip), and hungry (plain winter raiders delegate to `skirmisherBrain`) —
      each with a passing test
- [ ] Winter fishing is off (fish task invalid in winter); autumn/winter tips no
      longer tell players to fish through the ice
- [ ] `SAVE_VERSION === 3` with a v2→v3 migration test; a mid-winter reload
      shows a frozen river (syncFreeze-on-load test)
- [ ] Old `{ n, horde }` consumers (`spawnRaid`, `tonightInfo`) still work;
      `tonightInfo` shows the ice-crossing marker on winter raid nights
- [ ] `plans/README.md` row added/updated

## STOP conditions

1. `js/menace.js`/`scoutRaid` does not exist, or `raidEstimate` is still the
   day-count formula — plan 011 has not landed; this plan has no winter clause
   to flip. Report and stop.
2. The Step 8 winter band cannot hold with numbers that also keep 011's
   published inequalities green — the flip is fighting the Menace ceiling;
   report which inequality vs which band, do not silently retune 011's table.
3. A settler or raider is left standing on a `water` tile after a thaw in the
   Step 3 test — `strandOffIce` failed; do not ship a drowning bug.
4. Any test outside the ones this plan rewrites fails after Steps 2/5 —
   especially `spawnRaid`, the `findPath` block, or an 011 menace/save test you
   did not intend to touch: that is drift or a leaked `frozen` read into a
   non-winter path.
5. An import cycle appears (`pnpm check`/Vite complains, or lint's import rules
   fire): the design keeps `state.js`/`path.js`/`raiders.js` reading `tl.frozen`
   with no season import, and confines `seasons.js` to `freeze.js`. If a hook
   forces a season import onto the walkability path, STOP and report rather than
   inverting a dependency.
6. Any `14fd915` excerpt no longer matches after 009–018 (drift the top-of-file
   check missed) — re-locate by symbol; if the walkability gate or the raid
   dispatch was refactored by another landed plan (e.g. HP-6's sapper reshaping
   `raidComposition`), re-derive the edit against the current shape before
   coding.

## Maintenance notes

- **The `frozen` layer is the reusable seam.** Any future season verb-flip that
  changes terrain passability (spring mud slowing tiles, a summer drought
  opening a lakebed) should add its own per-tile flag read by the same hot
  functions, and its own transition module importing `seasons.js` — never push a
  season import down onto `walkable`/`pass`/`stepRaider`. That boundary is the
  whole reason this refactor is cycle-free.
- **Winter fishing is off by decision, not oversight.** `fishWinter`
  (`js/balance.js`) is kept dormant with a comment as the reclaim point for an
  ice-fishing structure; do not "fix" the unused key by deleting it without
  first deciding that ice-fishing is not coming.
- **The two winter knobs are a matched pair with 011.** `winterSurge` feeds
  `scoutRaid` and is clamped by the Menace ceiling, so retuning it must keep
  011's published inequalities green (the balance test guards this). Winter
  raids are desperation *under* the ceiling — if a design later wants winter to
  pierce it like a horde, that is a new clause, not a bigger `winterSurge`.
- **The thaw strands nobody because the hearth is off-river** (`js/map.js:75`)
  and `strandOffIce` catches the rest. If worldgen ever places the camp on or
  across water, revisit `strandOffIce` and the founding `syncFreeze` call
  together.
