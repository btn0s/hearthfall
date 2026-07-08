# Plan 015: The sapper + the counterplay-matrix cost pass (HP-6) — a breacher that defeats the sealed ring, and defenses priced against each other

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` (Step 7).
>
> **Execution model** (read before starting): plans run **sequentially, on
> `main`, in numeric order** — no feature branches. By the time this plan
> executes, 009–014 have landed. Two of them change the ground this plan
> stands on: **009** split `js/screens.js` into `js/ui/*` (the sidebar/dawn
> surfaces this plan touches now live under `js/ui/`), and **011** replaced
> the day-count raid formula with `js/menace.js` + `scoutRaid()` — the raid
> **budget** (`{ n, horde, strength, ceiling, floorN }`) is decided there; the
> raid **composition** (which archetypes fill that budget) is still
> `raidComposition()` in `js/raiders.js`, which is what this plan extends.
> Read `plans/011-menace-scouting.md` for the interface the sapper slots into
> (`scoutRaid`, `visibleBoard()`, `raidEstimate` as a thin wrapper).
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/raiders.js js/data.js js/balance.js js/menace.js js/forecasts.js js/game.js js/settlers.js js/path.js test/`
> Every excerpt below is anchored at **14fd915** (this plan's planning commit,
> *before* 009/011). Line numbers **will** have moved — re-locate every site
> **by symbol name** (`raidComposition`, `spawnRaid`, `tickRaider`,
> `RAIDER_TYPES`, `visibleBoard`, `communeDawn`). If `js/menace.js` does **not**
> exist, plan 011 has not landed — **STOP** (this plan depends on it). If
> `raidComposition` already has a `sapper` branch, someone started HP-6 —
> **STOP**.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (adds a live raider archetype with its own AI brain and a
  composition path; no save-shape change, no budget-formula change — the
  sapper spends the budget 011 already computes)
- **Depends on**: **plan 011** (needs `js/menace.js` — `visibleBoard()` for
  the wall count, `raidEstimate` returning `strength`/`ceiling`). 009 (the
  `screens.js` split) is a soft dependency: the dawn/sidebar edits in Step 5
  go into whichever `js/ui/*` file owns them post-009 — re-locate by symbol.
- **Category**: feature
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP-6 (Milestone HP0) · GDD §6 (archetypes + counterplay
  matrix), §9 invariant 5

## Why this matters

The GDD names the sapper as **v1's one anti-turtle archetype** — the reason
the sealed ring is not a solved position (`GDD.md:282-286`: "sapper (breaches
doors/walls; the sealed-ring answer; v1's anti-turtle archetype)") — and §10
lists it in the v1-playable's required set, not the stub list
(`GDD.md:373`: "…the sapper; the Beacon with previewed nights…"). Plan 011
made raid **pressure** legible and capacity-tracking; but a legible ceiling on
raid *size* does nothing about a board where **wall-heavy = safe**. Today the
turtle largely wins on a stone ring:

- The two structure-attacking specialists **give up** when sealed: skirmishers
  and torch-bearers path with `{ noDoor: true }` (`js/raiders.js:102,106,133`),
  and `findPath` refuses doors under `noDoor` and refuses walls to anyone
  without the `raider` flag (`js/path.js:13,15`) — a closed ring returns
  `null`, and they skulk or flee (`js/raiders.js:107,136-137`).
- Plain raiders *can* bash through (`raider: true` lets them stand on
  `wall_w`/`wall_s`, `js/path.js:15`; `stepRaider` bashes the tile in the way,
  `js/raiders.js:35-45`), but they bash **[3,6]** (`js/data.js:136`) toward
  *whoever is nearest* — they do not choose a breach, so a stone ring (150 hp,
  `js/data.js:17`) outlasts the raid timer (`timerNormal: 420`,
  `js/balance.js:141`; `js/game.js:290-292` sets everyone fleeing at 0).

The sapper closes this: a raider whose **target is the wall itself**, who
**picks the cheapest breach** on the ring and opens it for the horde behind
it. That single archetype makes the difference between palisade (wood, fast to
raise, fast to breach) and stone (quarried, slow to raise, slow to breach) a
**live tactical choice** instead of a flat HP number — which is exactly the
second half of this plan.

**The counterplay-matrix cost pass** discharges GDD §9 invariant 5
(`GDD.md:353-354`): "≥2 answers per archetype, ≤2 archetypes per defense, and
defenses priced against each other in space/labor/light." v1's matrix (§6,
`GDD.md:287-291`) "counted answers but not their economy." Adding the sapper is
the moment to audit the whole defense set against every archetype and make the
matrix **executable** (a test over the answer graph and `BUILDS` costs), the
same way plan 011 made the no-turtle inequality a test rather than a comment.
The pass's finding — carried below — is that the sapper's **bash economy**,
not a price renumber, is the lever that finally prices palisade against stone;
the audit's job is to prove the rest of the suite already trades in
space/labor/firelight, and to pin that with assertions so a future retune
cannot quietly break it.

## Current state

All excerpts verified at `14fd915` (pre-009, pre-011). Vanilla-JS browser
game; vitest; all tuning in `js/balance.js`; conventions in `AGENTS.md`
(per-game-minute scan caches, `G` singleton, sim modules import directly, view
modules via the `js/game.js` barrel).

### The archetype table — `js/data.js:135-141`

```js
export const RAIDER_TYPES = {
  raider:     { ch: '☻', fg: '#e05040', name: 'raider',     hp: [9, 13],  hpDay: 1,   dmg: [2, 4], bash: [3, 6],   moveCd: 2 },
  brute:      { ch: 'Ø', fg: '#d07830', name: 'brute',      hp: [20, 28], hpDay: 1.5, dmg: [3, 6], bash: [10, 15], moveCd: 3 },
  skirmisher: { ch: '§', fg: '#d090d0', name: 'skirmisher', hp: [7, 10],  hpDay: 0.5, dmg: [2, 3], bash: [0, 0],   moveCd: 1 },
  torcher:    { ch: '¡', fg: '#ff9030', name: 'torch-bearer', hp: [8, 12], hpDay: 0.5, dmg: [1, 3], bash: [0, 0],  moveCd: 2 },
  warlord:    { ch: '☠', fg: '#ff4060', name: 'warlord',    hp: [42, 52], hpDay: 2,   dmg: [4, 7], bash: [8, 12],  moveCd: 2 },
};
```

`makeRaider` scales hp by `Math.floor((G.day / 3) * d.hpDay)` (`js/raiders.js:27`).

### Spawn composition — `js/raiders.js:195-206` (`raidComposition`)

```js
function raidComposition(n, horde) {
  const R = BALANCE.raid;
  const types = [];
  for (let i = 0; i < n; i++) {
    let t = 'raider';
    if (G.day >= R.bruteFromDay && chance(horde ? R.bruteHordeChance : R.bruteChance)) t = 'brute';
    else if (G.day >= R.skirmisherFromDay && chance(R.skirmisherChance)) t = 'skirmisher';
    else if (G.day >= R.torcherFromDay && chance(R.torcherChance)) t = 'torcher';
    types.push(t);
  }
  return types;
}
```

Called once from `spawnRaid` (`js/raiders.js:229`):
`const types = raidComposition(spots.length, horde);`. `spawnRaid` reads the
size from `raidEstimate(G.day)` (`js/raiders.js:210`) — **post-011 that is the
`scoutRaid` wrapper**; composition is orthogonal to it. The specialist-count
recap log is `js/raiders.js:249-252` ("Among them: …").

### Target selection & the attack tick — `js/raiders.js`

- **Dispatch** (`tickRaider`, `js/raiders.js:180-191`): skirmishers and
  torchers get their own brains (`180-181`); everyone else hunts the nearest
  live settler via `findPath(..., { raider: true, adjacent: true })` (`187`).
- **Bash** lives in `stepRaider` (`js/raiders.js:30-46`): when the next path
  tile is a `wall_w`/`wall_s`/`door` with `hp`, and `d.bash[1] > 0`, subtract
  `rint(d.bash[0], d.bash[1])`; on `hp <= 0` convert to `dirt`, delete
  `hp`/`burning`, log (`35-43`).
- **The two brains to mirror** — both cache a per-minute target list and act
  on the adjacent structure:
  - `nearestBurnable(r)` (`js/raiders.js:61-80`) — the `structCache` scan
    pattern (`stamp = G.day * 1440 + G.min`).
  - `torcherBrain(r)` (`js/raiders.js:114-142`) — if adjacent to a flammable
    structure, act on it this tick (`116-129`); else path to the nearest one
    `{ adjacent: true, noDoor: true }` (`133`); else flee/wander (`135-138`).
    **This is the precedent for the sapper's brain** (a raider that acts on a
    structure rather than a settler — GDD calls the sapper the sealed-ring
    analogue of the torcher's arson).

### The structures a sapper breaks — `js/data.js:16-18, 25`

```js
wall_w:   { ch: '#',  ... walk: false, hp: 60,  name: 'palisade' },
wall_s:   { ch: '▓', ... walk: false, hp: 150, name: 'stone wall' },
door:     { ch: '+',  ... walk: true,  hp: 40,  name: 'door' },
post:     { ch: '⌂', ... walk: false, hp: 80, name: 'watch post' },
```

`structDamaged`/`structMax` (`js/structures.js:6-12`) read `STRUCT_HP`; stone
walls scale with `G.mods.wallHp` (Masons +34%, `js/data.js:169`) — so the
sapper's breach time is already civ-sensitive with no extra work.

### Defense costs (the matrix's price columns) — `js/data.js:59-64`

```js
{ ... cat: 'defense', id: 'wall_w', name: 'Palisade',   cost: { wood: 2 },            work: 16, hp: 60,  tier: 1 },
{ ... cat: 'defense', id: 'wall_s', name: 'Stone wall', cost: { stone: 2 },           work: 30, hp: 150, tier: 3 },
{ ... cat: 'defense', id: 'door',   name: 'Door',       cost: { wood: 3 },            work: 12, hp: 40,  tier: 1 },
{ ... cat: 'defense', id: 'trap',   name: 'Spike trap', cost: { wood: 2, scrap: 1 },  work: 10, hp: 1, tier: 1 },
{ ... cat: 'defense', id: 'post',   name: 'Watch post', cost: { wood: 2, stone: 2 },  work: 24, hp: 80, tier: 2 },
```

Guards are the labor axis: `s.role === 'guard'`, melee at range 1
(`js/settlers.js:419`) and **ranged from a watch post** (`js/settlers.js:425-438`,
`guardRange: 6` / `guardRangeKeeneye: 8`, `js/balance.js:134-135`). Traps deal
`trapDmg: 7` (`js/balance.js:182`) — note that is **fatal to a raider (9-13 hp)
but a scratch on a brute (20-28 hp)**, a fact the matrix leans on. Firelight
became a **priced claim in plan 011** (lit/warmed tiles raise Menace at dawn —
GDD §6 "lit/warmed ground is claimed ground", `GDD.md:279-281`), which is the
matrix's third cost axis (space/labor/**firelight**) already in the table.

### The BALANCE.raid block — `js/balance.js:140-184`

The archetype knobs live here: `bruteFromDay`/`bruteChance`/`bruteHordeChance`
(`165-167`), `skirmisherFromDay`/`skirmisherChance` (`168-169`),
`torcherFromDay`/`torcherChance` (`170-171`), the per-brain path-stale timers
(`172-174`). The sapper's knobs go in this block, in the same style. (Note:
plan 011 **removed** 8 dead size-formula keys and **added** `menace`/`scout`
tables after `raid:` — re-read the block; do not reintroduce the dead keys.)

### The dawn warning surface — `js/game.js:154-158` (`communeDawn`; post-009 under `js/ui/`)

```js
if (isHordeDay(G.day)) {
  addLog('☠ War-drums beyond the hills — a HORDE marches on you. They come at dusk!', '#ff4060');
  tip('horde');
} else if (G.day >= G.raidNext) { addLog('⚠ Scouts report raiders nearby — they strike at dusk!', '#e0a040'); tip('raidwarn'); }
else if (G.day === G.raidNext - 1) addLog('Rumors of raiders gathering. Prepare defenses.', '#e0c060');
```

This is where "the scouting report announces they bring sappers" attaches
(plan 011's report + this dawn line). `tonightInfo()` (`js/forecasts.js:20-36`)
feeds the sidebar tonight row and the party/Beacon modals — its `~${e.n}` label
is the other place the report can name the sapper. `TIPS` live in
`js/data.js:241-262` (add a `sapper` entry there).

### The test net — `test/raid-path.test.js`

- `spawnRaid` test (`107-129`) stubs `chance → false`
  (`js/…:116`) so **no specialists spawn** — it must stay green (with a
  sapper branch added, `chance → false` still yields plain raiders). It sets
  `G.tiles = grassTiles()` and `G.world = { locs: [] }`; post-011 `spawnRaid`
  also calls `visibleBoard()` (grass ⇒ `walls: 0` ⇒ below the sapper
  threshold, so no sappers even if `chance` were true).
- Header pattern for a new test file: stub `localStorage`/`performance`
  before dynamic import (`test/raid-path.test.js:1-17`); `grassTiles()` /
  `tile(x, y, t, extra)` helpers (`test/raid-path.test.js:19-25`).
- Invariant tests live in `test/balance.test.js` (plan 011 added its inequality
  assertions there) — the counterplay-matrix invariant joins them.

## Design (decided here, executed below)

### 1 — The sapper archetype

**Table row** (`js/data.js`, in `RAIDER_TYPES`):

```js
sapper: { ch: '¤', fg: '#b07040', name: 'sapper', hp: [16, 22], hpDay: 1, dmg: [2, 4], bash: [16, 24], moveCd: 3 },
```

- **bash [16,24]** — deliberately above the brute's [10,15]: the sapper is a
  *specialist* breacher. Breach-time arithmetic (avg bash 20, and it bashes
  once per acted tick, `moveCd: 3` ⇒ one bash per 3 ticks like the brute):
  - **door** 40 hp → ~2 hits; **palisade** 60 hp → ~3 hits (a wooden ring
    falls in seconds — the anti-turtle point);
  - **stone** 150 hp → ~7–8 hits (Masons ×1.34 = 201 → ~10) — genuinely
    **buys the defender time inside `timerNormal: 420`**, which is the price
    stone earns for its stone cost. This spread is the whole reprice; no
    `wall_*` HP number changes.
- **hp [16,22]** — tankier than a raider so it survives long enough at the
  wall to matter, but well under a brute; killable by two guards or a trap +
  a guard (keeps its ≥2 answers real).
- **dmg [2,4]** — a poor duelist; its threat is the breach, not the kill.

**Brain** (`js/raiders.js`, `sapperBrain(r)`, modeled on `torcherBrain`):

1. If adjacent (4-dir) to a `wall_w`/`wall_s`/`door` tile with `hp`, **bash it
   this tick** (roll `RAIDER_TYPES.sapper.bash`, on `hp <= 0` convert to
   `dirt`, delete `hp`/`burning`, `addLog('¤ A sapper breached your …!')`,
   `tip('sapper')`), clear `r.path`, return. (Same effect as `stepRaider`'s
   bash, applied to the chosen adjacent breach rather than the next path tile.)
2. Else re-path on a stale timer to the **cheapest breach** via
   `nearestBreach(r)` with `{ adjacent: true }` (approach the outer face, then
   step 1 fires next tick).
3. Else — **no ring to break** (open camp, or fully breached) — fall through
   to the plain-raider behavior: path to the nearest live settler
   `{ raider: true, adjacent: true }`, or `r.fleeing = true` if none. This
   keeps the sapper sensible on unwalled boards (it just fights).

**Breach target selection** — `nearestBreach(r)`, the `structCache` pattern
(per-minute stamp) over `wall_w`/`wall_s`/`door` tiles, choosing the minimum of

```
cost = mdist(sapper, tile) + tile.hp * BALANCE.raid.sapperBreachHpWeight
```

With `sapperBreachHpWeight ≈ 0.08`: a door (40 hp) adds ~3, a palisade (60)
~5, a stone wall (150) ~12 — so at similar distance the sapper **prefers the
weakest link** (the gate, the wooden seam), which is precisely the counterplay
lesson (a stone perimeter with one wooden gate is only as strong as the gate;
layering matters). Guard the breach it will pick, and it dies before opening.

### 2 — Composition + the warning (the scouting report names it)

**`raidComposition(n, horde, walls)`** gains a leading branch (sapper first, so
a wall-heavy board preferentially draws breachers):

```js
if (G.day >= R.sapperFromDay && walls >= R.sapperWallThreshold && chance(horde ? R.sapperHordeChance : R.sapperChance)) t = 'sapper';
else if (G.day >= R.bruteFromDay && chance(...)) t = 'brute';
// …unchanged…
```

`spawnRaid` passes the wall count from 011's board scan:
`const walls = visibleBoard().walls;` then
`raidComposition(spots.length, horde, walls)`. This satisfies plan 011's own
handoff note ("HP-6 should **price wall-heavy boards via** the scout's wall
term rather than new terms"): the more perimeter the scouts see, the more
breachers they send — sappers are the world's answer to turtling, gated on the
same signal the scout already reads. (`visibleBoard().walls` counts
`wall_w`/`wall_s`/`door`/`post` per 011 — the whole visible fortification;
document that the threshold is against that combined count, not the ring alone.)

**Warning** — a raid where sappers are likely must be *announced at the dawn
reckoning*, not discovered at the wall (P3: pressure is legible; §10: first
exposure to a mechanic must be fair). Add a pure predictor in
`js/forecasts.js` (the UI-facing threat module, which post-011 already imports
`js/menace.js`):

```js
export function sapperExpected(day = G.day) {
  if (day < BALANCE.raid.sapperFromDay) return false;
  return visibleBoard().walls >= BALANCE.raid.sapperWallThreshold;
}
```

Surface it in two places (both re-located post-009):
- **Dawn** (`communeDawn`, after the `raidwarn` line): on a raid/horde day
  with `sapperExpected()`, `addLog('¤ Their scouts marked your walls —
  sappers come to break them. Stone resists; hold the breach.', '#e08040')`
  and `tip('sapper')`.
- **`tonightInfo()`**: when it's a raid tonight and `sapperExpected()`, append
  a ` · sappers` marker to the label so the sidebar tonight row and the modals
  carry it too (the "scouting report" from 011, now naming the vector).

`TIPS.sapper` (`js/data.js`): *"Sappers pick your weakest wall and break it.
Stone walls resist far longer than palisade; layer a gate behind a wall, post
guards and traps where the breach will open."*

### 3 — The counterplay matrix (documented + made executable)

Structural answers only; **guards and watch-posts are the labor axis**
(governed by GDD §6's binding labor invariant, `GDD.md:294-297`), tracked
separately and excluded from the "≤2 archetypes per defense" count — the
invariant is about *built structures*, and a game whose only universal answer
is "more bodies" would violate the labor invariant, not this one.

| Archetype ↓ / Defense → | Palisade `wall_w` | Stone `wall_s` | Door | Spike trap | *(labor: guards / post)* |
|---|---|---|---|---|---|
| **raider** (rushes, bashes slowly) | ✓ funnels/slows | — | — | ✓ trapDmg 7 kills (9-13 hp) | ✓ |
| **brute** (heavy bash) | — | ✓ resists [10,15] bash | — | ✗ 7 dmg barely dents (20-28 hp) | ✓ (focus fire) |
| **skirmisher** (slips gaps, steals, flees) | ✓ part of the sealed ring | ✓ part of the sealed ring | ✓ closes the gap | — | ✓ intercept |
| **torch-bearer** (arson on wood) | ✗ *burns* (it is fuel) | ✓ fireproof perimeter | — | — | ✓ kill before ignite |
| **sapper** (breaches weakest wall) | ✗ falls in ~3 hits (soft) | ✓ breach cost buys time | ✗ *favourite target* | ✓ funnel damage at the breach | ✓ kill at the breach |

**Per-archetype answer count (structural + labor):** raider 3, brute 2,
skirmisher 4, torch-bearer 2, sapper 3 — **every archetype ≥ 2** ✓, and every
archetype has **≥ 1 structural** answer (never forced to solve a vector with
bodies alone) ✓.

**Per-defense archetype count:** palisade 2 (raider, skirmisher), door 1
(skirmisher), trap 2 (raider, sapper), **stone wall 3** (brute, torcher,
sapper). Stone is the one defense over the ≤2 line — the deliberate
**premium exception**: it is the only tier-3, stone-costed, slow-to-build
perimeter (`js/data.js:60`), so "owning the do-everything wall" is the real
tradeoff invariant 5 asks for ("owning the full suite is a real tradeoff, not a
checklist", `GDD.md:290-291`). The matrix test enforces this by rule: *any
structure answering ≥3 archetypes must be premium-priced* (tier 3 **and**
stone-costed), and stone wall is the only one that may be.

**Priced against each other** (space/labor/firelight):
- **space** — palisade and stone consume whole tiles of the ring; a bigger
  ring is more tiles to raise *and* more breach frontage to guard.
- **labor** — a defender's `work` budget is finite; the sapper's two answers
  (stone wall `work: 30` + trap `work: 10`, drawing **stone** and **scrap** —
  disjoint stockpiles, scrap also wanted for spears `c_spear`, `js/data.js:91`)
  cannot both be maxed cheaply.
- **firelight** — campfires/lit tiles are now a *priced claim* (plan 011: they
  raise Menace at dawn), so lighting the interior to deny skirmisher cover
  costs attention. This closes v1's "free inside the ring" hole (`GDD.md:281`).

**The cost pass's finding**: the existing structure prices already realize the
three-axis tradeoff — the pass ships the **encoding + assertions + the sapper
that makes palisade-vs-stone a live choice**, not a price renumber. The only
number the sapper *demands* is its own bash economy (which reprices the
perimeter by material). This is flagged in the maintenance notes as the point
that vLater's **slinger** (ranged, answers watch-posts — `GDD.md:284-286`) will
force the next repricing pass.

### Starting numbers (Step 1)

```js
// in BALANCE.raid, beside the other archetype knobs:
sapperFromDay: 7,          // after palisade/skirmisher are taught (obj 'walls' day ~5-7), before the day-12 horde
sapperWallThreshold: 8,    // needs a real ring (objective 'Raise 10 walls + door') — counts visibleBoard().walls
sapperChance: 0.22,        // per-raider roll on a qualifying board
sapperHordeChance: 0.35,   // hordes bring more breachers
sapperBreachHpWeight: 0.08,// target cost = mdist + hp*weight — nudges toward the weakest breach
sapperPathStale: 12,       // re-target cadence (mirror torcherPathStale: 12)
```

Hand-check (executor: re-derive): on a maxed day-20 stone ring, a lone sapper
(bash ~20, one bash / 3 ticks) needs ~10 hits ≈ 30 ticks to open a 201-hp
Masons wall — inside `timerNormal 420` but long enough that an ungarrisoned
breach is a *choice* the defender lost, not a dice roll. On a palisade ring the
same sapper is through in ~9 ticks: the wooden turtle is dead, the stone one is
a race — which is the design.

## Commands you will need

| Purpose   | Command                               | Expected on success  |
|-----------|---------------------------------------|----------------------|
| Install   | `pnpm install`                        | exit 0               |
| Tests     | `pnpm test`                           | all pass             |
| One file  | `pnpm vitest run test/sapper.test.js` | that file passes     |
| Typecheck | `pnpm check`                          | exit 0               |
| Lint      | `pnpm lint`                           | exit 0               |
| Play      | `pnpm dev` → http://localhost:8137    | manual check, Step 5 |

Debug hooks: `window.G`, `window.ff(minutes)` (fast-forward) — see `AGENTS.md`.

## Scope

**In scope**:
- `js/data.js` — `RAIDER_TYPES.sapper` row; `TIPS.sapper` entry
- `js/balance.js` — the 6 `raid.sapper*` knobs
- `js/raiders.js` — `sapperBrain` + `nearestBreach` + dispatch line +
  `raidComposition(n, horde, walls)` + `spawnRaid` wall pass
- `js/forecasts.js` — `sapperExpected()` predictor; `tonightInfo` marker
- `js/game.js` **or** the post-009 `js/ui/*` owner — dawn sapper-warning line
- `test/sapper.test.js` (create) — brain, target selection, composition, warning
- `test/balance.test.js` — the counterplay-matrix invariant (Step 6)
- `plans/README.md` — status row

**Out of scope** (do not touch):
- The raid **budget** (`scoutRaid`/`raidEstimate`/`js/menace.js`) — the sapper
  spends the size 011 computes; it does not change how big raids are.
- Any **price renumber** of existing defenses — the audit's finding is that
  current prices hold; if it does *not* hold (Step 6), that is a STOP/report,
  not a silent retune.
- The **slinger** (vLater — new ranged modality, `GDD.md:284-286`); watch-post
  behavior; save shape / `SAVE_VERSION`; morale; trader.
- `spawnRaid`'s spot-picking, jitter, two-front logic (`js/raiders.js:212-247`).

## Git workflow

- **No branch** — this plan executes on `main` in sequence (see Execution
  model). Commit per step, imperative messages ("Add the sapper archetype and
  its breach brain"). Do **not** push or open a PR unless the operator says so.

## Steps

### Step 1: the table row + tuning knobs

- `js/data.js`: add the `sapper` row to `RAIDER_TYPES` (Design §1) and the
  `sapper` entry to `TIPS`.
- `js/balance.js`: add the 6 `sapper*` knobs to the `raid` block (Design
  "Starting numbers"), each commented in the file's terse style.

No behavior yet (nothing spawns a sapper; the brain is unwritten — `tickRaider`
has no `sapper` branch, so a hand-placed one would fall through to the plain
hunter, which is a safe intermediate state).

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green (additive).

### Step 2: the breach brain

In `js/raiders.js`:
- Add `nearestBreach(r)` (its own per-minute cache object, mirroring
  `structCache`, `js/raiders.js:61`), scanning `wall_w`/`wall_s`/`door` tiles
  with the `cost = mdist + hp*sapperBreachHpWeight` selection. Guard
  `if (!G.tiles) return null;`.
- Add `sapperBrain(r)` per Design §1 (adjacent-bash → path-to-cheapest-breach
  → fall through to hunt/flee).
- Add the dispatch line in `tickRaider` beside the other specialists
  (`js/raiders.js:180-181`): `if (r.type === 'sapper') return sapperBrain(r);`.

**Verify**: `pnpm check && pnpm lint` → exit 0. (Behavior tested in Step 4.)

### Step 3: composition + the wall signal

In `js/raiders.js`:
- `raidComposition(n, horde, walls)` — add the leading `sapper` branch
  (Design §2). Import nothing new (`chance`, `BALANCE`, `G` already imported).
- `spawnRaid` — `const walls = visibleBoard().walls;` before the
  `raidComposition(...)` call; pass `walls`. Add
  `import { visibleBoard } from './menace.js';` (sim module, direct import;
  cycle-safe — `menace.js` depends only on `state`/`balance`/`data` per 011).

**Verify**: `pnpm test` → green, **including `test/raid-path.test.js`'s
`spawnRaid` test** (grass board ⇒ `walls: 0` ⇒ no sappers; `chance → false`
anyway). If that test fails, the wall pass changed observable spawn behavior on
an unwalled board — STOP.

### Step 4: `test/sapper.test.js`

Create with the stub-then-import header (copy `test/raid-path.test.js:1-17`),
importing `state.js`, `data.js`, `balance.js`, `path.js`, and `raiders.js`
(export `sapperBrain`/`nearestBreach`/`raidComposition` from `js/raiders.js`
for the test, or drive them through `tickRaiders` — prefer exporting the two
pure-ish helpers, matching how other internals are reached). `beforeEach`:
`Object.assign(G, makeState()); G.tiles = grassTiles(); G.world = { locs: [] };`.

1. **Breach**: place a settler at (20,10); build a `wall_w` (hp 60) at (10,10)
   between a sapper at (9,10) and the settler; tick the sapper until the wall
   `hp <= 0` → tile becomes `dirt`, a "breached" log fired. Assert it took
   ⌈60/avg-bash⌉-ish acted ticks (a band, not exact — bash is `rint`; stub
   `rint` to its low bound for determinism, as the spawn test does).
2. **Weakest-link target**: paint a `door` (40 hp) and a `wall_s` (150 hp)
   equidistant from a sapper → `nearestBreach` returns the door. Move the stone
   much closer and the door far → it returns the stone (distance dominates at
   `weight 0.08`). Documents the tradeoff the weight encodes.
3. **No ring ⇒ hunts**: no walls, one settler → `sapperBrain` produces a path
   toward the settler (or sets `fleeing` when none), i.e. it does not stall.
4. **Composition gate**: with `chance` stubbed `true`, `G.day = 10`,
   `raidComposition(6, false, 10)` → contains `'sapper'`; same with
   `walls = 4` (below `sapperWallThreshold`) → **no** `'sapper'`; same with
   `G.day = 5` (below `sapperFromDay`) → **no** `'sapper'`.
5. **Warning predictor**: paint ≥ `sapperWallThreshold` wall tiles,
   `G.day = 10` → `sapperExpected()` true; strip walls → false; `G.day = 5`
   with walls → false.

**Verify**: `pnpm vitest run test/sapper.test.js` → all pass.

### Step 5: the warning surfaces + manual check

- `js/forecasts.js`: add `sapperExpected()` (Design §2); in `tonightInfo`,
  append ` · sappers` to the raid label when it's a raid tonight and
  `sapperExpected()`. Import `visibleBoard` from `./menace.js` (already
  imported post-011 — confirm, don't duplicate).
- Dawn warning (`communeDawn`, post-009 in its `js/ui/*` owner): the
  sapper-warning `addLog` + `tip('sapper')` after the `raidwarn` line
  (Design §2). Export/route `sapperExpected` per the module's import rule.

**Verify**:
- `pnpm check && pnpm lint && pnpm test` → all green.
- Manual (`pnpm dev`): new run → ring the camp in **palisade + a door**,
  `ff` to a raid past day 7 with the ring up → the dawn log warns of sappers,
  the tonight row shows ` · sappers`, and at dusk a `¤` makes for the **door**
  and breaks it in a couple of hits; guard the door and it dies first. Rebuild
  in **stone** → the same sapper takes visibly longer (the reprice, felt).
  Both renderers (pause → Graphics toggle) show the warning row.

### Step 6: the counterplay-matrix invariant (executable)

In `test/balance.test.js`, add `describe('counterplay matrix — §9 invariant 5')`
with the answer graph as a fixture (Design §3), guards/post tagged as the labor
axis, and cited comments on the two mechanically-grounded cells (trap vs brute:
`trapDmg 7` < brute hp floor 20; palisade/door soft vs sapper: hp 60/40 ÷ bash
~20). Assertions:

1. **≥2 answers per archetype** (structural + labor), and **≥1 structural**
   answer per archetype.
2. **≤2 archetypes per defense**, with the premium exception: any structure
   answering ≥3 archetypes must be `tier === 3` **and** stone-costed in
   `BUILDS`. Assert stone wall is the only structure over the line and that it
   satisfies the premium rule (`buildDef('wall_s').tier === 3` &&
   `buildDef('wall_s').cost.stone > 0` && no `.wood`).
3. **Priced against each other**: the sapper's two structural answers draw on
   disjoint stockpiles — `buildDef('wall_s').cost.stone > 0` and
   `buildDef('trap').cost.scrap > 0` — so they cannot share a resource budget.

Read the price columns from `BUILDS`/`buildDef` (`js/structures.js:4`,
`js/data.js:59-64`) so the invariant tracks the real table, not a copy.

**Verify**: `pnpm vitest run test/balance.test.js` → all pass. If assertion 1
or 2 cannot pass with the current defense set, **STOP** — the matrix has a real
gap (an archetype under 2 answers, or a second over-broad defense), which is a
design decision, not a test to bend.

### Step 7: `plans/README.md`

Add the row (the execution-order table currently ends at 011 — append):

```
| 015 | The sapper + counterplay-matrix cost pass | HP-6 | P1 | M | 011 | DONE |
```

Under "Dependency notes", note that the sapper spends 011's raid budget and
reads its wall signal, and that the next repricing pass belongs to the vLater
**slinger** (a new ranged modality, not a table row — `GDD.md:284-286`).

**Verify**: `pnpm check && pnpm lint && pnpm test` all exit 0;
`git status` shows only in-scope files.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/sapper.test.js` ~5
tests (breach, target selection, no-ring fallback, composition gate, warning
predictor), `test/balance.test.js` +3 matrix assertions, everything else
untouched and green — including `test/raid-path.test.js`'s `spawnRaid` test
(the unwalled-board no-op guarantee).

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `RAIDER_TYPES.sapper` exists; `tickRaider` dispatches to `sapperBrain`
      (`grep -n "sapperBrain" js/raiders.js` → dispatch + definition)
- [ ] `raidComposition` gates sappers on `G.day`, `walls`, and `chance`;
      `spawnRaid` feeds it `visibleBoard().walls`
- [ ] A sapper breaches a palisade in a handful of hits and a stone wall in
      visibly more (the reprice) — Step 4.1 band + Step 5 manual
- [ ] `sapperExpected()` gates a dawn warning **and** a tonight-row marker; a
      new player is warned at the reckoning, never surprised at the wall
- [ ] The §9-invariant-5 matrix is `expect(...)` assertions over the answer
      graph and `BUILDS`, not a comment (Step 6)
- [ ] No change to the raid budget, save shape, or existing defense prices;
      `git status` shows only in-scope files
- [ ] `plans/README.md` row added

## STOP conditions

1. `js/menace.js` / `visibleBoard` absent, or `raidComposition` already has a
   `sapper` branch — plan 011 has not landed, or HP-6 was started. (Drift check.)
2. Any excerpt in "Current state" no longer matches (drift the top check
   missed) — re-derive by symbol before coding.
3. `test/raid-path.test.js`'s `spawnRaid` test fails after Step 3 — the wall
   pass changed spawn behavior on an unwalled board; that must be a no-op.
4. The Step 6 matrix cannot satisfy ≥2-answers-per-archetype or the ≤2 /
   premium rule with the current defense set — a genuine matrix gap; report
   which archetype/defense, do not bend the assertion or silently reprice.
5. Making the sapper killable enough to keep its ≥2 answers real forces its
   `hp`/`bash` so low that it can't breach stone inside `timerNormal`, or so
   high that guards+trap can't stop it at a defended breach — the archetype
   needs a design pass, not silent retuning; report the tension.
6. An import cycle appears (`pnpm check`/Vite complains) — `js/raiders.js` and
   `js/forecasts.js` importing `visibleBoard` from `js/menace.js` should be
   cycle-safe (011 established `menace.js ← {state, balance, data}`); if a hook
   forces more, stop rather than inverting a dependency.

## Maintenance notes

- **The matrix invariant is a living constraint** (like 011's inequalities):
  every new archetype or defense — and every price change — must keep the
  Step 6 assertions green. That is the point; it is the per-Trial check GDD §9
  demands.
- **The reprice is the sapper's bash, not a number in `BUILDS`.** If a future
  balance pass wants palisade to hold longer, it should move
  `sapper.bash`/`sapperBreachHpWeight`, not `wall_w.hp` (which also governs
  fire and brute bash) — keep the perimeter's material meaning in the breacher.
- **vLater slinger** (`GDD.md:284-286`) answers watch-posts and is a new ranged
  combat modality — it is the next entry in the matrix and will force the first
  real *price* renumber (watch-post vs stone-wall economy). This plan
  deliberately leaves that pass undone.
- The `sapperWallThreshold` reads `visibleBoard().walls`, which counts
  `post` alongside the ring (per 011). If a later plan splits perimeter from
  watch-posts in the scout term, revisit this threshold — the citation here is
  the tripwire.
- Deferred deliberately: sapper-specific dawn-report art/iconography; a
  distinct "sappers massing" line in the party/Beacon modals beyond the
  tonight marker; tuning the sapper into Beacon-night budgets (HP-9 reads
  `menaceCeiling` + a concealed share and may draw breachers explicitly).
