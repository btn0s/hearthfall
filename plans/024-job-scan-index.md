# Plan 024: The job-scan index — an incremental actionable-tile index replaces the per-tick full-map walk (P1-8)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Execution model**: plans in `plans/` run **sequentially, on `main`, in
> numeric order**. This one is authored against commit `14fd915` (current
> `HEAD`), but earlier plans land first — every code excerpt below is a
> **snapshot at `14fd915`**, cited by `file:line`. If a line has moved,
> **re-locate by the symbol name in the excerpt's header** (`findJob`,
> `claimBed`, `housingCap`, `completeTask`, `designate`, `ignite`,
> `stepRaider`) rather than trusting the number. The behavior — not the line
> — is the contract.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/settlers.js js/game.js js/fire.js js/raiders.js js/structures.js js/data.js js/state.js js/balance.js`
> If `js/settlers.js` changed, re-read `findJob`, `claimBed`, `housingCap`,
> and `completeTask` in full before starting — this plan rewrites the first
> three and hooks the fourth, and the equivalence oracle depends on the scan
> body being exactly as excerpted. If a `js/tileindex.js` already exists,
> STOP (someone started P1-8 already). **Also audit for new job kinds**: run
> `grep -n "kind = " js/settlers.js` inside `findJob` — if a later plan added
> a job type (a new `desig`, a new workable structure), it must be reflected
> in `isJobCandidate` (Step 2) and the fuzz generator (Step 3), or the index
> will silently drop that job.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (rewrites the hottest inner loop in the sim — the per-tick
  job search — plus the housing scans; strictly behavior-preserving, and the
  whole point is that a full-scan oracle test proves it so)
- **Depends on**: none hard. Runs after the HP0 milestone (plans 009-011 and
  any siblings) in numeric order; there is no code dependency, but **any job
  type or workable-structure type those plans add must be present in the
  index audit and fuzz generator at execution time** (see the drift check).
- **Category**: performance/architecture
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: P1-8 (`ROADMAP.md` — "job-scan performance")

## Why this matters

The busiest loop in the simulation walks all **13,440 tiles** (`MAP_W·MAP_H`
= 140·96, `js/data.js:3`) from scratch, and it does it per idle settler per
tick. `findJob` (`js/settlers.js:160`) is the offender —
`for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++)`
(`js/settlers.js:165`) — and it is called for every settler that has no task
and is off cooldown, every tick (`js/settlers.js:470`). At the population cap
of 16 (`js/balance.js:20`) with the commune between jobs, that is
**16 × 13,440 ≈ 215,000 tile-visits per tick**, and the fast speed setting
runs **55 ticks/second** (`[0, 8, 22, 55][G.speed]`, `js/main.js:48`) —
roughly **11.8 million tile-visits per second**, to hand out at most 16 jobs
that touch a few hundred non-grass tiles.

Two more scans compound it, both untouched by the per-minute cache discipline
the codebase already established (`postCache`, `js/settlers.js:115`;
`dmgCache`/`elderCache`, `js/game.js:164,196`):

- `claimBed` (`js/settlers.js:133`) full-scans all 13,440 tiles for the
  nearest free bed, per settler seeking sleep or crawling home, per tick
  (call sites `js/settlers.js:459` and `:398`). At dusk, when the commune
  goes to bed together, that is another ~215,000 visits/tick.
- `housingCap` (`js/settlers.js:87`) full-scans to sum sleeping spots — and
  it is called from the **sidebar draw** (`js/screens.js:520`), i.e. once
  per rendered frame (~60 fps), not per sim-tick: **13,440 × 60 ≈ 806,000
  visits/second** just to print `⌂N`, plus the recruit gates at
  `js/game.js:95,103`.

Every one of these answers a question about a tiny, slowly-changing subset of
tiles — the ones carrying a build order, a designation, a fire, or a standing
workable structure — using a scan sized to the whole world. This plan builds
the index that subset deserves, maintained incrementally by the handful of
mutators that change tile state, and proves the rewrite changes **no
behavior** with a full-scan equivalence oracle.

## Current state

All excerpts verified at `14fd915`. Vanilla-JS browser game; vitest; the
`G` singleton is mutated in place; full-map scans are cached per game-minute
by house rule (`AGENTS.md`, "Cache any full-map scan per game-minute").

### Tile storage — `js/state.js:29-31`

```js
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
export const tileAt = (x, y) => G.tiles[y * MAP_W + x];
export const walkable = (x, y) => inMap(x, y) && T[tileAt(x, y).t].walk;
```

`G.tiles` is a **flat array**, index `i = y·MAP_W + x` (`makeState()` seeds
`tiles: null`, `js/state.js:14`; the array is built by `genMap()`, assigned
at `js/game.js:451` `G.tiles = tiles`). Row-major index order is exactly the
`y`-outer/`x`-inner scan order of `findJob`, `housingCap`, and `claimBed` —
**this is load-bearing for tie-breaking** (see Design).

### The target scan — `js/settlers.js:160-190` (`findJob`)

```js
function findJob(s) {
  if (s.role === 'guard') return null;
  const pri = PRI[s.role] || PRI.worker;
  const pop = G.settlers.length;
  let best = null, bestKey = Infinity;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const tl = tileAt(x, y);
    if (tl.claim) continue;
    let kind = null, work = 0, onTile = false, p = 9;
    if (tl.burning) { kind = 'douse'; work = BALANCE.work.douse; p = -1; }
    else if (tl.build) { kind = 'build'; work = Math.ceil(buildDef(tl.build.id).work / G.mods.build); p = tl.build.id === 'farm' ? pri.buildFarm : pri.build; }
    else if (tl.desig === 'chop') { kind = 'chop'; work = BALANCE.work.chop; p = pri.chop; }
    else if (tl.desig === 'mine') { kind = 'mine'; work = BALANCE.work.mine; p = pri.mine; }
    else if (tl.desig === 'forage' && !isWinter()) { kind = 'forage'; work = BALANCE.work.forage; p = pri.forage; }
    else if (tl.desig === 'fish' && !(tl.fishCd > 0)) { kind = 'fish'; work = BALANCE.work.fish; p = pri.forage; }
    else if (tl.t === 'farm' && (tl.growth || 0) >= BALANCE.crop.mature) { kind = 'harvest'; work = BALANCE.work.harvest; onTile = true; p = pri.harvest; }
    else if (tl.t === 'kitchen' && G.res.food >= BALANCE.hunger.cookMinFood && G.res.meals < pop * BALANCE.pop.mealsTargetMult) { kind = 'cook'; work = BALANCE.work.cook; p = pri.cook; }
    else if (tl.t === 'workshop' && G.craftQueue.length) { kind = 'craft'; work = BALANCE.work.craft; p = pri.craft; }
    else if (structDamaged(tl) && !tl.burning && G.res[tl.t === 'wall_s' ? 'stone' : 'wood'] >= 1) { kind = 'repair'; work = BALANCE.work.repair; p = pri.repair; }
    if (kind === null) continue;
    const key = p * 10000 + mdist(s.x, s.y, x, y);
    if (key < bestKey) { bestKey = key; best = { kind, x, y, work, onTile, item: null }; }
  }
  if (best) {
    tileAt(best.x, best.y).claim = s.id;
    if (best.kind === 'craft') best.item = G.craftQueue.shift();
  }
  return best;
}
```

**The candidate structure of this body is the whole design.** A tile can
yield a job only if it satisfies a **tile-local, slowly-changing** predicate:

- `tl.burning` (douse), or
- `tl.build` (build), or
- `tl.desig` ∈ {`chop`,`mine`,`forage`,`fish`} (the fish/forage cases carry
  extra *runtime* gates — `!isWinter()`, `!(tl.fishCd > 0)`), or
- `tl.t` ∈ {`farm`,`kitchen`,`workshop`} (harvest/cook/craft — each with a
  *runtime* gate on `growth`, food/meals, or `craftQueue`), or
- `structDamaged(tl)` (repair) — and `structDamaged`
  (`js/structures.js:12`) is `STRUCT_HP[tl.t] && tl.hp !== undefined && tl.hp <= structMax(tl.t) - 15`, i.e. **only tiles that carry `hp`** (every
  built structure — walls, doors, houses, posts, traps, workshop, kitchen,
  beacon; `STRUCT_HP`, `js/data.js:69`).

So define a tile as a **job candidate** iff:

```
burning || build || desig || t∈{farm,kitchen,workshop} || tl.hp !== undefined
```

This is a **superset** of "tiles that can currently return a job": the
runtime gates (`isWinter`, `fishCd`, `growth`, food/meals, `craftQueue`,
`structDamaged`'s `-15` threshold, the repair material check) stay in the
`findJob` body, re-evaluated per candidate exactly as today. Membership in
the candidate set changes **only** when a tile gains/loses `burning`,
`build`, `desig`, or changes `t` into/out of a structure — and every one of
those transitions happens at an enumerable mutation site (below). Iterating
the candidate set instead of all 13,440 tiles, applying the identical body,
returns the identical job **provided the iteration order is ascending tile
index** (row-major), because the selection keeps the first tile at the
minimum `key` (strict `<`, `js/settlers.js:183`) and ties on `key` are common
(equal priority + equal `mdist`).

### The two housing scans — `js/settlers.js:87-94` and `:133-152`

```js
export function housingCap() {
  let n = 0;
  for (const tl of G.tiles) { const hd = HOUSES[tl.t]; if (hd) n += hd.cap; }
  return n;
}
```

```js
function claimBed(s) {
  if (s.bedIdx >= 0) { /* keep current bed if still valid */ }
  let best = -1, bd = Infinity;
  for (let i = 0; i < G.tiles.length; i++) {
    const tl = G.tiles[i];
    const hd = HOUSES[tl.t];
    if (!hd || (tl.sleepers || []).length >= hd.cap) continue;
    const d = mdist(s.x, s.y, i % MAP_W, (i / MAP_W) | 0);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return null;
  /* claim a sleeper slot in G.tiles[best] */
}
```

Both scan for `HOUSES[tl.t]` tiles (`tent`/`cabin`/`longhouse`/`bed`,
`js/data.js:37-42`). `housingCap` sums caps (order-independent). `claimBed`
picks the nearest free bed, tie-broken by **first index** (strict `<`,
`js/settlers.js:145`) — so a **houses list iterated in ascending index
order** preserves its choice exactly. A settler keeps its current bed via the
`s.bedIdx` fast-path (`js/settlers.js:134-138`), unaffected by this plan.

### The per-minute cache precedent to mirror — `js/settlers.js:115-124`

```js
const postCache = { stamp: -1, list: [] };
function nearestPost(s) {
  const stamp = G.day * 1440 + G.min;
  if (postCache.stamp !== stamp) {
    postCache.stamp = stamp;
    postCache.list = [];
    for (let i = 0; i < G.tiles.length; i++) {
      if (G.tiles[i].t === 'post') postCache.list.push({ x: i % MAP_W, y: (i / MAP_W) | 0 });
    }
  }
  /* nearest of postCache.list */
}
```

`dmgCache` (`js/game.js:164-179`, `countDamaged`) and `elderCache`
(`js/game.js:196`) are the same `stamp = G.day * 1440 + G.min` pattern. This
plan goes one better than a per-minute cache: an **event-maintained** index
that never needs a full rebuild during a run (a per-minute cache still
full-scans once per game-minute). The `stamp` idea survives as a **tiles-ref
guard** — plan 011's lesson (`cache.tiles !== G.tiles` forces a rebuild) — so
the index self-heals across map regen / save-load / test reassignment without
hooking `genMap`/`loadGame`.

### Every full-map scan in the sim path (enumerated, with measurements)

`grep -n "MAP_H\|for (const tl of G.tiles\|G.tiles.length\|for (let i = 0; i < G.tiles"` across the four sim files, classified:

| # | Site | What it scans | Frequency | ~visits | This plan |
|---|------|---------------|-----------|---------|-----------|
| 1 | `findJob` `js/settlers.js:165` | all tiles → best job | per idle settler per tick | 16·13,440 = **215k/tick** | **replaced** (Step 4) |
| 2 | `claimBed` `js/settlers.js:140` | all tiles → nearest free bed | per bed-seeker per tick | up to **215k/tick** at dusk | **replaced** (Step 5) |
| 3 | `housingCap` `js/settlers.js:89` | all tiles → Σ bed caps | per **render frame** + recruit gates | 13,440·60 ≈ **806k/sec** | **replaced** (Step 5) |
| 4 | `countDamaged` `js/game.js:170` | all tiles → damaged counts | per game-minute | 13,440/min | **already cached** (`dmgCache`) — left as-is |
| 5 | crop growth `js/game.js:284` | all tiles → grow farms | every `cropGrowthInterval`=3 min, day only | 13,440/3min | **enumerated, deferred** (mutation sweep; farm-index narrowing is a clean follow-up, out of scope) |
| 6 | `fireTick` `js/fire.js:21` | all tiles → spread fire **and decrement `fishCd`** | every `fireTickInterval`=2 min | 13,440/2min | **enumerated, deferred** — narrowing to burning tiles alone would drop the `fishCd` decrement (`js/fire.js:23`); unsafe without a fished-tile index, out of scope |

`js/world.js` has **no** `G.tiles` scan — its `MAP_W`/`MAP_H` uses are
overworld-grid (`G.world.grid`) and spawn-edge math (`js/game.js:82-85`), not
the settlement map. Scans #4-#6 are low-frequency and/or already cached and
are **out of scope**; this plan targets the three per-settler / per-frame
query scans (#1-#3), which are the roadmap item.

### The mutation sites that change candidacy (the index's write path)

The index must be updated wherever a tile gains/loses `burning`/`build`/
`desig` or changes `t` into/out of a workable structure or house. Verified
sites at `14fd915`:

- **`js/game.js:330`** `tl.build = { id }` (`tryPlaceBuild`) — build order placed.
- **`js/game.js:336-340`** `designate()` — `tl.desig` set (`chop`/`mine`/`forage`/`fish`).
- **`js/game.js:377-378`** `clearAreaPlans` and **`:385-386`** `cancelAt` —
  `delete tl.build` / `delete tl.desig` (area + single cancel).
- **`js/game.js:395-400`** `cancelAt` structure demolish — a standing
  structure (`wall_*`/`door`/`farm`/houses/`post`/`workshop`/`kitchen`/
  `beacon`/…) becomes `dirt`.
- **`js/settlers.js:221-223`** `completeTask` chop/mine/forage — `tl.t` →
  `dirt`/`grass`, `delete tl.desig` (job done).
- **`js/settlers.js:249-264`** `completeTask` build branch — `delete tl.build`
  then `tl.t = def.id`: the build candidate leaves **and** a new structure /
  house / farm / kitchen / workshop may enter.
- **`js/fire.js:14`** `ignite()` — `tl.burning` set (douse candidate appears).
- **`js/fire.js:31-36`** `fireTick` structure burn-down — `tl.t = 'dirt'`,
  `delete tl.burning` (structure gone); **`:37-39`** non-structure burn-down
  — `tl.t = 'dirt'`, `delete tl.desig`.
- **`js/raiders.js:40-41`** `stepRaider` wall smashed to 0 hp — `tl.t = 'dirt'`;
  and the trap-destroy `tl.t = 'dirt'` a few lines below (`js/raiders.js:51`).

Note what is **not** a membership change and therefore needs **no** hook:
harvest resetting `tl.growth = 0` (`js/settlers.js:237`), fishing setting
`tl.fishCd` (`js/settlers.js:226`), and any `tl.hp` change from bashing
(`js/raiders.js:38`) or fire (`js/fire.js:26`) or repair
(`js/settlers.js:234`) — the farm/water/structure tile stays a candidate; its
runtime gate (`growth`, `fishCd`, `structDamaged`) is re-checked in the
`findJob` body, exactly as today. This is why the design is robust: candidacy
tracks coarse tile *type/flags*, not fine numeric state.

### The test net to build on

`test/combat-economy.test.js:1-16` is the header to copy: stub
`localStorage`/`performance` before dynamic import, then
`const { G, makeState } = await import('../js/state.js')` and the
`grassTiles()` helper (`new Array(140*96).fill(null).map(() => ({ t: 'grass' }))`,
`js/combat-economy.test.js:16`). `beforeEach` does `Object.assign(G, makeState()); G.tiles = grassTiles();`. Boundary tests build full-size tile
arrays the same way (`test/boundaries.test.js:30`).

## Design (decided here, executed below)

### New module `js/tileindex.js` (imports: `state.js`, `data.js`, `structures.js` only — cycle-safe)

`structures.js` imports only `state.js`/`data.js`, so this import set has no
cycle. Sim modules import from it **directly** (house rule: sim modules
import from `state.js`, not via the `game.js` barrel).

Module-level state and the tiles-ref guard:

```js
import { MAP_W } from './data.js';
import { G } from './state.js';
import { HOUSES } from './data.js';

// The set of tile indices that could yield a job (superset of live jobs;
// runtime gates stay in findJob). Membership changes only via reindexTile.
const jobSet = new Set();      // Set<number> — tile indices
const houseSet = new Set();    // Set<number> — HOUSES[tl.t] tiles
let idxTiles = null;           // the G.tiles reference these sets describe
let jobSorted = null, houseSorted = null;  // lazily materialized ascending arrays

const WORKABLE_T = new Set(['farm', 'kitchen', 'workshop']);

// A tile is a job candidate iff it carries a build/desig/fire OR is a
// workable structure OR carries hp (any built structure → possible repair).
export function isJobCandidate(tl) {
  return !!tl.burning || !!tl.build || !!tl.desig
    || WORKABLE_T.has(tl.t) || tl.hp !== undefined;
}
```

Primitives:

- **`reindexTile(i)`** — the single mutator-facing call. Recomputes
  membership for tile `i` from its current fields and adds/removes it from
  `jobSet`/`houseSet`; invalidates the sorted caches if membership changed.
  Idempotent and self-correcting — a caller may fire it after *any* mutation
  without tracking add-vs-remove:

  ```js
  export function reindexTile(i) {
    if (idxTiles !== G.tiles) return rebuildIndex(); // guard first
    const tl = G.tiles[i];
    setMember(jobSet, i, isJobCandidate(tl), () => { jobSorted = null; });
    setMember(houseSet, i, !!HOUSES[tl.t], () => { houseSorted = null; });
  }
  ```

  (`setMember(set, i, want, onChange)` adds/deletes and calls `onChange` only
  when the set actually changed.) Convenience `reindexAt(x, y)` wraps
  `reindexTile(y * MAP_W + x)` for the `(x,y)` call sites.

- **`rebuildIndex()`** — the one legitimate full scan: clears both sets, walks
  all `G.tiles` once building them from `isJobCandidate`/`HOUSES`, stamps
  `idxTiles = G.tiles`, nulls the sorted caches. Called lazily by the guard
  when `idxTiles !== G.tiles` (new run, save-load, or a test reassigning
  `G.tiles`). **This is also the equivalence oracle** — Step 3 asserts the
  incrementally-maintained sets equal a fresh `rebuildIndex()`.

- **`jobCandidates()`** — returns the ascending-sorted array of `jobSet`
  indices (materialized lazily into `jobSorted`, rebuilt only when the set
  changed). Ascending index === row-major, preserving `findJob`'s tie-break.
  Guard-checks `idxTiles !== G.tiles` first.

- **`houseIndices()`** — same for `houseSet` → `houseSorted`; preserves
  `claimBed`'s first-index tie-break.

- **`housingCapFromIndex()`** — `Σ HOUSES[G.tiles[i].t].cap` over
  `houseIndices()` (order-independent; the array is fine).

Sorting cost is paid at most once per game-minute-ish of churn (only when
membership changes, not per read), over a few hundred entries — negligible
next to the 13,440-tile scan it replaces. `findJob`/`claimBed` then iterate a
few hundred candidates instead of 13,440 tiles.

### `findJob` becomes an index walk (identical body)

Replace the double `for` with `for (const i of jobCandidates())`, deriving
`x = i % MAP_W`, `y = (i / MAP_W) | 0`, `tl = G.tiles[i]`. **Every line of the
per-tile body — the `if/else if` ladder, the `tl.claim` skip, the
`key = p*10000 + mdist(...)` selection, the strict `<`, the claim/craft
side-effects — is copied verbatim.** The only change is the iteration source
and it visits candidates in the same row-major order. Guards still early-out
(`if (s.role === 'guard') return null;`) before touching the index.

### `claimBed` / `housingCap` become index walks

`claimBed`: keep the `s.bedIdx` fast-path (`js/settlers.js:134-138`)
untouched; replace the `for (let i = 0; i < G.tiles.length; i++)` with
`for (const i of houseIndices())`, identical body (nearest free bed, strict
`<` tie-break, sleeper-slot claim). `housingCap` returns
`housingCapFromIndex()`. Both call sites and the sidebar keep working
unchanged.

### Why behavior is identical (the argument the Step 3 test makes executable)

1. `jobSet` is a superset of every tile `findJob`'s body could return
   non-null for (candidacy predicate ⊇ every branch's precondition). Tiles
   outside `jobSet` all hit `kind === null` → `continue` in the old scan, so
   dropping them changes nothing.
2. `jobCandidates()` yields ascending indices = the old row-major order, so
   the strict-`<` first-minimum-`key` selection picks the identical tile on
   ties.
3. The per-candidate body — including all runtime gates (`isWinter`,
   `fishCd`, `growth`, food/meals, `craftQueue`, `structDamaged`, repair
   material) — is byte-for-byte the old body, so each candidate evaluates
   identically.
4. `houseSet` is exactly `{ i : HOUSES[G.tiles[i].t] }`, maintained by the
   same hooks; `housingCap`'s sum and `claimBed`'s ascending nearest are
   preserved.

The test proves (1)+(4) by comparing the incrementally-maintained sets to a
fresh full-scan `rebuildIndex()` after fuzzed mutations, and proves the whole
chain by comparing index-`findJob`/`claimBed`/`housingCap` against **naive
whole-map oracles** (test-local reimplementations of the old loops) across
generated states.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Tests     | `pnpm test`                               | all pass            |
| One file  | `pnpm vitest run test/tileindex.test.js`  | that file passes    |
| Typecheck | `pnpm check`                              | exit 0              |
| Lint      | `pnpm lint`                               | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137        | manual check, Step 7 |

Debug hooks for manual verification: `window.G`, `window.ff(minutes)`
(fast-forward the sim) — see `AGENTS.md`.

## Scope

**In scope**:
- `js/tileindex.js` (create) — the index module
- `js/settlers.js` — `findJob`, `claimBed`, `housingCap` rewired to the index;
  `completeTask`'s tile-type/`build`/`desig` mutations fire `reindexTile`
- `js/game.js` — `tryPlaceBuild`, `designate`, `cancelAt`, `clearAreaPlans`
  fire `reindexTile`
- `js/fire.js` — `ignite` and `fireTick` burn-down fire `reindexTile`
- `js/raiders.js` — `stepRaider` wall-smash / trap-destroy fire `reindexTile`
- `test/tileindex.test.js` (create) — equivalence oracle + fuzz + perf-counter
- `README.md` code-map line + `AGENTS.md` house-rule sentence (Step 8)
- `plans/README.md` — status row

**Out of scope** (do not touch):
- Scans #4-#6 (crop growth, `fireTick` spread, `countDamaged`) — enumerated
  above; `dmgCache` already caches #4, and #5/#6 are mutation sweeps whose
  narrowing (a farm index for #5; a fished-tile index for #6's `fishCd`) is a
  clean follow-up, not this plan.
- Any change to `findJob`'s **job selection logic**, priorities (`PRI`,
  `js/settlers.js:155`), the `key` formula, or the runtime gates — this plan
  changes only *which tiles are iterated and in what order* (and the order is
  preserved).
- The `s.failCd` rescan-throttle (`js/settlers.js:472`) — orthogonal and
  stays; the index makes each scan cheap, the throttle still limits churn.
- `postCache`/`dmgCache`/`elderCache` — leave the per-minute caches as they
  are; migrating them onto the index is not worth the behavior risk here.

## Git workflow

- Branch: `advisor/024-job-scan-index`
- Commits: one per step. Imperative messages ("Add the tile-job index module").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `js/tileindex.js`

Write the module exactly per the Design section: `isJobCandidate`,
`reindexTile`, `reindexAt`, `rebuildIndex`, `jobCandidates`, `houseIndices`,
`housingCapFromIndex`, plus the private `jobSet`/`houseSet`/`idxTiles`/
`jobSorted`/`houseSorted` and `setMember` helper. Every public read
(`jobCandidates`, `houseIndices`, `housingCapFromIndex`) and `reindexTile`
begins with `if (idxTiles !== G.tiles) rebuildIndex();` so the index is
self-healing. JSDoc-annotate the exports (`pnpm check` runs `tsc` over `js/`).

Nothing consumes the module yet — this step only has to typecheck and lint.

**Verify**: `pnpm check && pnpm lint` → both exit 0. `pnpm test` → still green
(additive module, no imports into it yet).

### Step 2: `test/tileindex.test.js` — the equivalence spine

Create with the stub-then-import header copied from
`test/combat-economy.test.js:1-16`, importing `state.js`, `tileindex.js`, and
`data.js`. Add helpers:

- `grassTiles()` (copy `test/combat-economy.test.js:16`).
- `tile(x, y)` → `G.tiles[y*140 + x]`, and a `paint(x, y, patch)` that
  `Object.assign`s a tile then calls `reindexAt(x, y)`.
- **`isJobCandidateNaive(tl)`** and **`findJobNaive(s)`** — a **test-local
  reimplementation of the old full scan** (copy the `14fd915` `findJob` body
  from the excerpt above verbatim, looping all tiles). This is the oracle;
  keep it in the test file (test helper, not shipped code). Likewise
  `housingCapNaive()` and `claimBedNaive(s)` copying the old loops.
- A seeded RNG (import `js/rng.js`, or a tiny local LCG) so fuzz runs are
  deterministic.

`beforeEach`: `Object.assign(G, makeState()); G.tiles = grassTiles(); rebuildIndex();`.

Tests:

1. **`isJobCandidate` matches its branches**: for a hand-built tile of each
   kind (`{burning:1}`, `{build:{id:'wall_w'}}`, `{desig:'chop'}`,
   `{t:'farm'}`, `{t:'kitchen'}`, `{t:'workshop'}`, `{t:'wall_w',hp:60}`,
   `{t:'grass'}`, `{t:'dirt'}`) assert `isJobCandidate` is true exactly for
   the first seven.
2. **`jobCandidates()` is ascending**: paint candidates at scattered
   `(x,y)`; assert the returned array is strictly increasing (row-major
   order preserved).
3. **Incremental == full-scan (the invariant)**: run a **fuzz loop** (≥ 500
   iterations): each step randomly picks a tile and applies one mutation from
   the real mutation vocabulary — place `build`, `designate` chop/mine/
   forage/fish, cancel (`delete build`/`delete desig`), complete-build
   (`delete build; tl.t = <structure/house/farm/kitchen/workshop>`), complete-
   chop (`tl.t='dirt'; delete desig`), ignite (`burning=…`), burn-down
   (`tl.t='dirt'; delete burning/desig`), wall-smash (`tl.t='dirt'`) — each
   **through `reindexAt`**. After **every** step assert
   `new Set(jobCandidates())` deep-equals the set from a fresh
   `rebuildIndex()` recompute, and likewise for `houseIndices()`. This is the
   "index contents === full-scan results" invariant, and it is the reason a
   forgotten hook cannot ship silently.
4. **`findJob` == `findJobNaive` (behavior identical, incl. tie-break)**:
   generate ≥ 200 random board+state fixtures (random builds/desigs/fires/
   structures/farms with random `growth`, random `G.res.food/meals/wood/
   stone`, random `G.craftQueue`, random `isWinter` via `G.day`/season,
   random settler `role`/`x`/`y`) and, for a probe settler, assert the
   **index `findJob`** and the **naive `findJob`** return deep-equal results
   (same `kind`,`x`,`y`,`work`,`onTile`) — including cases engineered to
   force a `key` tie between two equidistant equal-priority tiles, proving the
   ascending-order tie-break matches. (Run the naive oracle on a *clone* of
   the tiles so its `.claim`/`craftQueue` side-effects don't perturb the index
   run, or run index first then reset `.claim` before the oracle.)
5. **`housingCap` / `claimBed` == naive**: random house layouts →
   `housingCapFromIndex() === housingCapNaive()`; and a probe settler's
   `claimBed`-chosen index equals `claimBedNaive`'s (nearest, ascending
   tie-break), across fixtures including two equidistant free beds.
6. **Tiles-ref self-heal**: reassign `G.tiles = grassTiles()` **without**
   calling `rebuildIndex()`, paint one candidate, then read
   `jobCandidates()` → it reflects only the new board (the guard rebuilt on
   the reference change; no stale indices from the old array).

**Verify**: `pnpm vitest run test/tileindex.test.js` → all pass. If test 3 or
4 fails, the candidacy predicate or a mutation model is wrong — fix the module
(or the oracle if you mis-copied it), do not weaken the assertion.

### Step 3: Wire `findJob` to the index (`js/settlers.js`)

Add `import { jobCandidates, reindexAt } from './tileindex.js';` (direct
import — sim module). Rewrite the scan in `findJob` (`js/settlers.js:165`):
replace `for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const tl = tileAt(x, y);`
with

```js
  for (const i of jobCandidates()) {
    const tl = G.tiles[i];
    const x = i % MAP_W, y = (i / MAP_W) | 0;
```

and leave the entire body (the `if (tl.claim) continue;` line through the
`if (key < bestKey)` selection and the post-loop claim/craft block) exactly
as excerpted. `MAP_H` may become unused in this function — keep the
`data.js` import line (other symbols from it are used); if `pnpm lint` flags
`MAP_H` as unused across the file, that means no other reference remains
(unlikely — `claimBed`/`nearestPost` compute `y` via `MAP_W` only), in which
case the Step 5 edits or an eslint check will tell you; resolve by removing
only the now-unused import token, nothing else.

**Verify**: `pnpm check && pnpm lint` → exit 0. `pnpm test` → **expect
failures only where a mutation site is not yet hooked** (Step 6 adds the
hooks; until then a build placed via `tryPlaceBuild` won't appear in the
index during an integration test). The `test/tileindex.test.js` oracle tests
(Step 2) still pass because they paint through `reindexAt`. If a *unit*
settler test that builds its board through `G.tiles` directly (bypassing the
mutators) fails, that is expected — it will pass once Step 6 lands **and** any
such test is updated to paint through the mutators or call `rebuildIndex()`.
Note which tests fail; do not "fix" them yet.

### Step 4: Wire `claimBed` and `housingCap` to the index (`js/settlers.js`)

Extend the import to
`import { jobCandidates, houseIndices, housingCapFromIndex, reindexAt } from './tileindex.js';`.

- `housingCap` (`js/settlers.js:87-94`): replace the body with
  `return housingCapFromIndex();`.
- `claimBed` (`js/settlers.js:139-146`): keep the `s.bedIdx` fast-path
  (`:134-138`) verbatim; replace `for (let i = 0; i < G.tiles.length; i++) { const tl = G.tiles[i]; const hd = HOUSES[tl.t]; if (!hd || …) continue;`
  with `for (const i of houseIndices()) { const tl = G.tiles[i]; const hd = HOUSES[tl.t]; if ((tl.sleepers || []).length >= hd.cap) continue;`
  (the `!hd` check is now unnecessary — `houseIndices()` only yields house
  tiles — but keeping `const hd = HOUSES[tl.t]` is needed for the cap). Leave
  the nearest-selection and sleeper-claim untouched.

**Verify**: `pnpm check && pnpm lint` → exit 0. `pnpm test` → same picture as
Step 3 (housing tests that paint houses directly into `G.tiles` need Step 6's
hooks or a `rebuildIndex()`; note them).

### Step 5: Fire the `reindexTile` hooks at every mutation site

One or two lines per site, at each verified location — import
`reindexTile`/`reindexAt` directly into each sim module. **Fire the reindex
*after* the mutation completes** (so it reads the final tile state):

1. `js/game.js` — import `reindexAt`. After `tl.build = { id: def.id };`
   (`:330`) add `reindexAt(x, y);`. In `designate` (`:336-340`), after the
   `desig` assignments, `reindexAt(x, y);` (once, at the end of the function).
   In `clearAreaPlans` (`:377-378`) after the deletes, `reindexAt(x, y);`
   inside the loop. In `cancelAt` (`:385-386` and the structure-demolish
   branch `:395-400`) `reindexAt(x, y);` before each `return` / at function
   end.
2. `js/settlers.js` — in `completeTask` (`:218-266`): after the mutation for
   **every** branch (chop/mine/forage `:221-223`, build `:249-264`), call
   `reindexAt(t.x, t.y);`. Simplest correct placement: one
   `reindexAt(t.x, t.y);` just before `s.task = null;` at the end of
   `completeTask` (`:265`) — it runs for all branches and reads the final
   `tl`. (Harvest/cook/craft/repair/fish branches also hit it harmlessly —
   `reindexTile` is idempotent and their candidacy is unchanged.)
3. `js/fire.js` — import `reindexTile`. In `ignite` (`:14`) after
   `tl.burning = …`, `reindexAt(x, y);`. In `fireTick`, after the burn-down
   branches that set `tl.t = 'dirt'` (`:34` and `:38`) **and** the
   `delete tl.burning` at `:36`, call `reindexTile(i)` (the loop already has
   `i`). Place a single `reindexTile(i)` at the end of the per-tile block so
   both the "still burning, hp dropped" and "burned out" transitions are
   reflected.
4. `js/raiders.js` — import `reindexTile` (compute `const i = n.y * MAP_W + n.x;`
   or use `reindexAt(n.x, n.y)`). After the wall-smash `tl.t = 'dirt'`
   (`:41`) and the trap-destroy `tl.t = 'dirt'` (`:51`), `reindexAt(n.x, n.y);`.

Add an integration test to `test/tileindex.test.js`: drive real mutators —
`import { tryPlaceBuild, designate, cancelAt } from '../js/game.js'` and
`import { ignite } from '../js/fire.js'` — place a build, assert its index
appears in `jobCandidates()`; cancel it, assert it disappears; ignite a
flammable tile, assert a douse candidate appears; and after each,
`new Set(jobCandidates())` still equals a fresh `rebuildIndex()` (the Step 2
invariant, now exercised through the shipped mutators).

**Verify**: `pnpm vitest run test/tileindex.test.js` → green. `pnpm test` →
now the previously-noted failures resolve **if** they were failing only for
lack of hooks. Any settler/combat test that paints `G.tiles` directly without
going through a mutator and without `rebuildIndex()` must be updated to call
`rebuildIndex()` in its setup (the same way it already sets `G.tiles`) — this
is a **test-setup** change, not a behavior change; list each one you touch and
confirm the assertion itself is unchanged. If a test asserting *game
behavior* (a job chosen, a bed claimed) fails, STOP — that is a real
regression, not a setup gap.

### Step 6: Full-suite green + the tiles-ref backstop in `makeState`/load

Confirm the self-heal covers the real lifecycle: a new run assigns
`G.tiles = tiles` (`js/game.js:451`) and save-load rebuilds `G.tiles`, both
with a fresh array reference — the guard's `idxTiles !== G.tiles` triggers a
`rebuildIndex()` on the first index read after either, so **no explicit hook
in `genMap`/`loadGame` is required**. Add one test asserting this: build a
board, read `jobCandidates()`, then simulate a load by replacing `G.tiles`
with a differently-populated array and assert the next read reflects the new
array (Step 2 test 6 already covers the mechanism — here just confirm it
holds after a `makeState()`+load-shaped reset).

**Verify**: `pnpm check && pnpm lint && pnpm test` → all exit 0.

### Step 7: Perf assertion + manual sanity

The measurement is a **deterministic work-counter**, not wall-clock (timing
in vitest is flaky). Add to `test/tileindex.test.js`:

- Instrument via a counter the module exports **only in test** is overkill;
  instead assert the structural fact that makes the win real: build a
  representative mid-game board (paint ~200 structures + ~60 designations +
  a couple of fires through `reindexAt`), then
  `expect(jobCandidates().length).toBeLessThan(400)` and
  `expect(jobCandidates().length).toBeGreaterThan(0)`, with a comment stating
  the before/after: **old `findJob` visited 13,440 tiles per call; the index
  visits `jobCandidates().length` (≈ 260 here) — a ~50× reduction, ×16
  settlers ×55 ticks/s.** Same for `houseIndices().length` vs 13,440 for
  `housingCap`/`claimBed`.

Manual (`pnpm dev`, http://localhost:8137), the `ff()` before/after check per
`AGENTS.md`:

- New run → designate a swath of chopping and place several builds → workers
  pick them up exactly as before (jobs claimed, priorities respected).
- Open the browser console: `G.speed = 3` (55 tps), then time a burst —
  `let t = performance.now(); ff(600); performance.now() - t` — and confirm
  the sim advances smoothly with a full commune between jobs (this is the hot
  path the index fixes). Compare against `git stash`-ing the branch if you
  want a felt before/after; the deterministic counter above is the assertion
  of record.
- Build/burn/demolish a house and watch the sidebar `⌂N` (`js/screens.js:520`)
  update immediately — proves `housingCap` reads the live index every frame.
- Save & quit → Continue: the reloaded run hands out jobs and beds correctly
  (the tiles-ref guard rebuilt the index on load).

### Step 8: Docs + `plans/README.md`

- `README.md` code-map: add `js/tileindex.js` — the incremental
  actionable-tile / house index behind `findJob`, `claimBed`, `housingCap`.
- `AGENTS.md` house-rules paragraph (the "Cache any full-map scan
  per game-minute" sentence, `AGENTS.md` §House rules): append a sentence —
  the per-settler job/housing scans are served by an **event-maintained**
  index (`js/tileindex.js`), updated via `reindexTile` at the tile-mutation
  sites; when you add a new job kind or workable-structure type, update
  `isJobCandidate` and fire `reindexTile` where you mutate the tile.
- `plans/README.md`: add/update this plan's row:
  `| 024 | The job-scan index (incremental actionable-tile index) | P1-8 | P2 | M | — | DONE |`
  (or `BLOCKED` with a one-line reason on a STOP).

**Verify**: `pnpm check && pnpm lint && pnpm test` → all exit 0;
`git status` shows only in-scope files.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/tileindex.test.js`
~10 tests — predicate, ascending order, the fuzz invariant (index ==
full-scan after every mutation), `findJob`/`claimBed`/`housingCap` ==
naive-oracle across generated states (with engineered tie cases),
mutator-integration, tiles-ref self-heal, and the candidate-count perf
assertion — all green alongside the existing suite, with any touched settler/
combat tests changed only in **setup** (adding `rebuildIndex()`), never in
their assertions.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/tileindex.js` exists; `findJob`, `claimBed`, `housingCap` contain
      **no** `for … MAP_H` / `for … G.tiles.length` loop —
      `grep -n "MAP_H\|G.tiles.length" js/settlers.js` shows only `postCache`
      (`:121`) and index-derived `% MAP_W` math, not the three rewritten scans
- [ ] The fuzz invariant test asserts `jobCandidates()` (and `houseIndices()`)
      equal a fresh `rebuildIndex()` after **every** mutation, and
      `findJob`/`claimBed`/`housingCap` deep-equal their naive full-scan
      oracles across ≥ 200 generated states including forced ties
- [ ] `grep -n "reindexTile\|reindexAt" js/game.js js/fire.js js/raiders.js js/settlers.js`
      shows a hook at every mutation site enumerated in "Current state"
- [ ] The candidate-count perf assertion documents the before (13,440) /
      after (`jobCandidates().length`) reduction
- [ ] Iteration order preserved: `jobCandidates()`/`houseIndices()` ascending
      (the tie-break tests pass)
- [ ] `git status` shows only in-scope files; `plans/README.md` row updated

## STOP conditions

- Any "Current state" excerpt no longer matches the code (drift the top-of-
  file check missed) — especially if `findJob`'s body gained a new `kind`/
  `desig`/workable type not covered by `isJobCandidate`, or `claimBed` lost
  its `s.bedIdx` fast-path: re-derive the candidacy predicate and the fuzz
  vocabulary before coding.
- A settler/combat test that asserts **game behavior** (a specific job chosen,
  a bed claimed, a build completed) fails after Step 3-5 and the fix is
  anything other than adding `rebuildIndex()` to its **setup** — that means
  the index changed behavior; report before touching the assertion.
- The fuzz invariant test (Step 2 #3) fails — a mutation transition is not
  captured by `isJobCandidate` or a hook is missing/misplaced. Fix the module
  or the hook; **never** relax the equivalence assertion to make it pass.
- The `findJob` == naive test (Step 2 #4) fails **only** on tie cases — the
  iteration order regressed (a `Set` iterated in insertion order instead of
  the ascending `jobSorted` array). Restore ascending materialization; do not
  "accept" the different tie-break.
- You find a full-map `G.tiles` scan in the sim path not in the enumeration
  table (a later plan added one) — note it and decide explicitly whether it
  belongs in this plan or a follow-up; do not silently expand scope.
- An import cycle appears (`pnpm check` or Vite complains) — `tileindex.js` is
  designed to depend only on `state`/`data`/`structures`; if a hook forces a
  richer dependency, stop and report rather than inverting a dependency.

## Maintenance notes

- **The candidacy predicate is the contract**: any new job type (a new
  `desig`, a new workable structure, a new "actionable" tile flag) must be
  added to `isJobCandidate` **and** must fire `reindexTile` wherever the tile
  is mutated, **and** must join the fuzz vocabulary in
  `test/tileindex.test.js`. The invariant test is the tripwire — a forgotten
  predicate case makes it red on the next run, which is exactly what you want.
- **`reindexTile` is idempotent and coarse** by design: it tracks tile
  *type/flags*, not numeric state (`growth`, `fishCd`, `hp`), so growth
  crossings, fish cooldowns, and structure damage need **no** hook — their
  runtime gate stays in `findJob`. Do not "optimize" by pushing those numeric
  transitions into the index; that trades a proven-equivalent design for a
  fragile one.
- **The tiles-ref guard** (`idxTiles !== G.tiles`) is what makes the index
  correct across new runs, save-loads, and test reassignment without hooking
  `genMap`/`loadGame`. If a future change reuses the *same* `G.tiles` array
  but bulk-mutates it (e.g. an in-place map regen), it must call
  `rebuildIndex()` explicitly — the guard only catches a new reference.
- **Follow-ups this index unlocks** (deliberately out of scope): the crop-
  growth sweep (`js/game.js:284`) can iterate a farm index; `fireTick`
  (`js/fire.js:21`) can iterate a burning index once a fished-tile index
  covers its `fishCd` decrement; `dmgCache`'s wall count could read the index.
  Each is a separate, testable change — not this plan.
</content>
</invoke>
