# Plan 011: Menace + the scouting report (HP-5) — two cause-ledgers replace the day-count raid formula

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` (Step 8 — the row may not exist yet; add it).
>
> **Drift check (run first)**:
> `git diff --stat d177bfd..HEAD -- js/forecasts.js js/balance.js js/raiders.js js/world.js js/settlers.js js/save.js js/state.js js/dawn.js js/game.js js/screens.js js/seasons.js test/`
> If `js/forecasts.js`, `js/balance.js`, `js/save.js`, or `js/state.js`
> changed, re-read them fully before starting — this plan rewrites the raid
> sizing formula and bumps the save version, and every excerpt below was
> verified at `d177bfd`. If a `js/menace.js` already exists, STOP (someone
> started HP-5 already).

## Status

- **Priority**: P1
- **Effort**: M-L
- **Risk**: MED (replaces the live raid-sizing formula; save-shape change; new tuning surface)
- **Depends on**: 008 (done — `BALANCE` exists); plan 009 (P1-5 screens split) is
  NOT a dependency — see the UI note in Step 7
- **Category**: feature
- **Planned at**: commit `d177bfd`, 2026-07-08
- **Roadmap ID**: HP-5 (Milestone HP0) · GDD §2 P3, §6, §9 invariant 3

## Why this matters

Raid pressure today is a hidden day-count formula (`js/forecasts.js:7-19`):
raids grow with the calendar, shrink with bandit camps burned, and cap out
near 10 into a 16-settler economy. That is Pillar I's death ("dusk stays
scary" fails when raids are solved) and it carries both documented genre
failure modes at once: a pure time-ramp punishes a crippled commune exactly
when it is weakest (RimWorld's wealth-independent death-spiral), and a
player who stays small forever meets a cap they can out-build (the turtle
equilibrium). GDD v2 P3 replaces it with two *visible cause-ledgers*:

- **Menace** — the world's attention, a **ceiling**: rises with days,
  firelight claimed, noise made (expeditions, constructions, the Beacon),
  and camps left standing; falls **only through action** (camps burned,
  warlords slain). Never plateaus.
- **The scouting report** — what they actually send: raiders probe your
  *visible strength* (standing walls, armed defenders, lit ground) and
  bring what they judge sufficient, under Menace's ceiling. Strong communes
  draw force; a commune reeling from losses draws smaller raids, never
  snowballing ones.

Two binding invariants (GDD §9 invariant 3) ship as **executable tests over
the BALANCE table**, not prose: the no-turtle-equilibrium inequality
(worst-case defense growth per day < Menace ceiling growth per day) and the
no-death-spiral guard (post-loss raids shrink; the rising floor stays under
a published recovery headroom). Firelight-as-claims (GDD §6: "lit/warmed
ground is claimed ground") prices interior density and closes the
free-inside-the-ring turtle hole. HP-6 (sapper), HP-9 (Beacon exam
budgets), and HP-10 (winter flip) all build on the ledgers this plan lands.

## Current state

All excerpts verified at `d177bfd`. Vanilla-JS browser game; vitest; all
tuning in `js/balance.js` (plan 008); conventions in `AGENTS.md` (per-minute
scan caches, `G` singleton, versioned saves, both renderers show the same
info).

### The formula being replaced — `js/forecasts.js:7-19`

```js
export function raidEstimate(day = G.day) {
  const horde = isHordeDay(day);
  const uncleared = G.world ? G.world.locs.filter(l => l.type === 'bandits' && !l.cleared).length : 0;
  const R = BALANCE.raid;
  let n = R.sizeBase + Math.floor((day - R.sizeDayStart) / R.sizeDayStep) - Math.floor(G.banditsCleared / R.banditReductionDiv);
  if (day >= R.unclearedFromDay) n += Math.min(R.unclearedMax, uncleared);
  if (isWinter()) n = Math.max(R.sizeBase, n - R.winterReduction);
  if (G.beaconDay) n += R.beaconBonus;
  const cap = day > R.capLateFromDay ? R.capEarly + Math.floor((day - R.capLateFromDay) / R.capLateStep) : R.capEarly;
  n = Math.max(R.sizeBase, Math.min(cap, n));
  if (horde) n = Math.max(n + R.hordeBonus, R.hordeFloorBase + Math.floor(day / R.hordeFloorDiv)) + R.warlordExtra;
  return { n, horde };
}
```

**Contract to preserve**: callers get `{ n, horde }`.

- `js/raiders.js:208-212` — `spawnRaid()` reads `raidEstimate(G.day)`, subtracts
  1 for the warlord on hordes, adds `rint(0, R.jitterMax)`; the comment says
  "sizing lives in raidEstimate so the sidebar forecast can't drift from
  truth". This stays true.
- `js/forecasts.js:21-36` — `tonightInfo()` shows `~${e.n}` in the sidebar.
- `js/screens.js:471-472` — sidebar tonight line; `js/screens.js:774-781` and
  `:874,888` — party modal and Beacon modal reuse `tonightInfo()`.

### The BALANCE.raid keys involved — `js/balance.js:140-184`

Old-formula-only keys (become dead, removed in Step 5): `sizeDayStart` (148),
`sizeDayStep` (149), `banditReductionDiv` (150), `unclearedFromDay` (151),
`unclearedMax` (152), `capEarly` (155), `capLateFromDay` (156), `capLateStep`
(157). Verified referenced **only** from `js/forecasts.js:11-15`
(`grep -rn` finds no other consumer).

Kept: `sizeBase` (147), `winterReduction` (153 — **HP-10 will flip winter
from discount to desperation**; this plan keeps the numeric hook so HP-10 is
a table change + verb work, and flags it in code), `beaconBonus` (154),
`hordeBonus`/`hordeFloorBase`/`hordeFloorDiv`/`warlordExtra` (158-161),
`jitterMax` (162), plus all timers/composition keys.

### Where Menace's causes already live

- **Days**: `isHordeDay` = every 12 days (`js/seasons.js:11`); dawn pipeline is
  `onDawn()` = `communeDawn()` → `worldDawn()` → `save()` (`js/dawn.js:7-13`).
- **Camps left standing / burned**: `worldDawn` grows uncleared bandit camps
  every 3 days and adds ≤1 new site per 3 days (`js/world.js:250-260`); a
  cleared camp runs `js/world.js:158-163` (`G.banditsCleared++`, raid quiet).
- **Warlords slain**: `hitRaider` warlord branch, `js/settlers.js:311-318`.
- **Noise**: expeditions start at `js/world.js:96-110` (`startExpedition`);
  constructions complete in `completeTask`'s build branch,
  `js/settlers.js:249-264`; the Beacon ignites at `js/game.js:184-194`
  (`igniteBeacon`, already log-fictioned as "every eye for miles").
- **Lit ground**: there is **no persistent lit-tile structure** — light is
  computed at draw time (`js/tiles.js:510`:
  `const lit = tl.t === 'campfire' || (tl.t === 'beacon' && G.beaconDay) || tl.burning;`),
  and `tl.claim` (e.g. `js/fire.js:35,39`) is *bed/task claim by a settler id*,
  not territory. So "claimed ground" must be derived from warm/lit structure
  tiles (see Design).

### Visible strength inputs

- Walls: tile types `wall_w`/`wall_s`/`door` (`js/data.js:16-18`), watch
  `post` (`js/data.js:25`). Raiders bash them (`js/raiders.js:35-45`), fire
  burns them down (`js/fire.js:31-40`) — standing count is genuinely dynamic.
- Armed defenders: `s.role === 'guard'` and `G.res.weapons`;
  `settlerActive = (s) => !s.away && !s.downed` (`js/settlers.js:14`).
- Warm/lit tiles: `campfire` (`js/data.js:24`), lit `beacon` (`js/data.js:29` +
  `G.beaconDay`), roofed houses `tent`/`cabin`/`longhouse` (`js/data.js:37-42`,
  `HOUSES`), `kitchen`/`workshop`.
- Full-map scans must be cached per game-minute — house rule; precedents:
  `structCache` (`js/raiders.js:61-64`), `dmgCache` (`js/game.js:164-179`),
  `postCache` (`js/settlers.js:115-119`).

### The ledger pattern to copy — `js/journal.js:6-12`

```js
export function bumpMorale(n, why) {
  G.morale = Math.max(0, Math.min(100, G.morale + n));
  if (why && Math.abs(n) >= BALANCE.morale.eventMin) {
    G.moraleEvents.push({ day: G.day, why, n });
    if (G.moraleEvents.length > BALANCE.morale.eventCap) G.moraleEvents.shift();
  }
}
```

and its UI surface: the morale bar is a click widget at sidebar row 4 that
shows `moraleWhy()` in a notice (`js/screens.js:302-305`).

### State, save, sidebar geometry

- `makeState()` (`js/state.js:4-25`) — `G` gets the new `menace` object here;
  `state.js` currently imports only `data.js`; `balance.js` imports nothing,
  so importing `BALANCE` into `state.js` is cycle-safe.
- `js/save.js:7` `SAVE_VERSION = 1`; `toSaveData` destructure+object at 12-29;
  `migrate` at 31-65 (v0 block gated on `!d.version`; `stats`/`mods`
  always-merge at 60-61). House rule (AGENTS.md + plan 004 maintenance):
  save-shape change ⇒ bump `SAVE_VERSION`, extend `migrate()`, add a
  migration test.
- Sidebar: rows 0-8 are fixed (title, day/time, civ/tier, season, morale,
  tonight, divider, food, resources — `js/screens.js:454-479`);
  `sidebarLayout()` starts conditional rows at `let y = 9`
  (`js/screens.js:193-218`); the layout already self-compresses (minimap and
  settler list give up rows), so inserting one fixed row is safe.

### The test net to extend

- `test/raid-path.test.js:73-105` — three `raidEstimate` characterization
  tests **of the old formula** (floor/cap, horde headroom, uncleared camps
  ⇒ bigger `n`). These are deliberately rewritten in Step 6 (plan 004's
  maintenance note: characterization tests exist to make intentional change
  visible, not to prevent it).
- `test/raid-path.test.js:107-129` — `spawnRaid` test runs with empty
  settlers/tiles and RNG stubbed; under the new model it still spawns
  `sizeBase = 2` raiders (strength 0 ⇒ scouted ≈ 1, clamped up by the
  floor) — it should keep passing unchanged. If it doesn't, that's a signal.
- `test/balance.test.js:1-21` — asserts table keys; gains the menace/scout
  keys and the two published inequalities.
- Header pattern for new test files: stub `localStorage`/`performance`
  before dynamic import (`test/raid-path.test.js:1-17`).

## Design (decided here, executed below)

### State

```js
// in makeState():
menace: {
  value: BALANCE.menace.start,   // small integer, floored at 0, unbounded above
  ledger: [{ day: 1, cause: 'a fire in the wilds', delta: BALANCE.menace.start }],
},
noiseBuilds: 0,                  // constructions since last dawn (dawn-batched noise)
```

Every change to `menace.value` goes through `bumpMenace(delta, cause)` —
append-capped ledger of `{ day, cause, delta }` (cap
`BALANCE.menace.ledgerCap`, shift like `moraleEvents`). All deltas are
integers (GDD invariant 8: small integers only).

### New module `js/menace.js` (imports: `state.js`, `balance.js`, `data.js` only — cycle-safe from everywhere)

**Menace side** (world attention, the ceiling):

- `bumpMenace(delta, cause)` — clamp at 0, append, cap.
- `menaceDawn()` — called from `onDawn` between `communeDawn` and `worldDawn`:
  - `+M.dayBase` — cause `'the world turns'` (the honest clock: visible, not chosen);
  - `+campsStanding × M.perCampStanding` — `'camps left standing'` (count of
    uncleared `bandits` locs, one combined entry);
  - `+Math.floor(claims / M.claimDiv)` — `'firelight claimed'` (if > 0);
  - `+Math.min(G.noiseBuilds, M.constructionNoiseCap)` — `'hammer-noise'`
    (if > 0), then `G.noiseBuilds = 0`.
- Event bumps (wired in Step 4): expedition sets out `+M.expeditionNoise`;
  Beacon lit `+M.beaconLit`; camp burned `−M.campBurnedDrop`; warlord slain
  `−M.warlordSlainDrop`. **The only decreases are the two actions** — per
  GDD P3, Menace falls only through action.
- `menaceWhy()` — recent ledger entries rendered `'+3 the world turns · −5 a camp burned'`
  style (mirror `moraleWhy`, `js/game.js:40-52`).

**Scouting side** (pure functions — no `G` reads, unit-testable):

```js
menaceCeiling(m) = R.sizeBase + Math.floor(Math.max(0, m) / M.ceilDiv)
menaceFloor(m)   = R.sizeBase + Math.floor(Math.max(0, m) / M.floorDiv)   // the Dark's drum (GDD §6)
visibleStrength({ guards, bodies, weapons, walls, claims }) =
    guards * S.perGuard
  + Math.min(weapons, bodies) * S.perWeapon        // spears only count with hands to hold them
  + Math.min(walls, S.wallCap) / S.wallDiv         // scout perception saturates: caps publish
  + Math.min(claims, S.claimCap) / S.claimDiv      //   the bounded-defense side of the inequality
scoutRaid(inputs) → { n, horde, strength, ceiling, floorN }:
  n = Math.round(S.probeBase + S.probeMult * visibleStrength(inputs))
  if (inputs.beacon) n += R.beaconBonus            // the light shows them the way (kept)
  if (inputs.winter) n -= R.winterReduction        // HP-10 flips this to desperation raids — keep the knob
  n = Math.max(menaceFloor(m), Math.min(menaceCeiling(m), n))
  n = Math.max(R.sizeBase, n)
  if (inputs.horde) n = Math.max(n + R.hordeBonus, R.hordeFloorBase + Math.floor(day / R.hordeFloorDiv)) + R.warlordExtra
```

Horde handling is byte-for-byte the old clause and is applied **after** the
clamp, exactly as the old formula applied it after the cap
(`js/forecasts.js:17`): hordes may pierce the ceiling — they are the Dark's
scheduled exception, not a scouted party.

Note the deliberate double role of firelight: claims **raise Menace** at dawn
(light draws the world's attention) *and* **read as strength** to scouts
(lit ground looks defended). Both directions price interior density — the
GDD's stated reason for the term.

**Board scan** — `visibleBoard()` in `js/menace.js`, one pass over `G.tiles`
cached per game-minute (`structCache` pattern) **plus a `tiles`-reference
check** (`cache.tiles !== G.tiles` invalidates), so tests that reassign
`G.tiles = grassTiles()` never read stale counts:

- `walls`: count of `wall_w`, `wall_s`, `door`, `post` tiles;
- `claims`: count of `campfire`, `tent`, `cabin`, `longhouse`, `kitchen`,
  `workshop` tiles, plus `S.beaconClaimWeight` if `G.beaconDay` (the Beacon
  is the loudest light in the world).

**Published bounds for the invariant tests** (exported from `js/menace.js`
so the inequality is code, not test-local arithmetic):

```js
// Cadence facts of neighboring systems (cited, conservative):
//   worldDawn adds at most 1 new site per 3 days (js/world.js:251), so bandit
//   camps cannot be burned faster than 1 per 3 days sustained; hordes (the
//   only warlords) come every 12 days (js/seasons.js:11).
export const MAX_CAMP_BURNS_PER_DAY = 1 / 3;
export const MAX_WARLORD_KILLS_PER_DAY = 1 / 12;
export function minDailyMenaceGrowth() {   // worst case FOR THE WORLD: player counteracts maximally
  const M = BALANCE.menace;                // (each burn also makes expedition noise — net it out)
  return M.dayBase
    - (M.campBurnedDrop - M.expeditionNoise) * MAX_CAMP_BURNS_PER_DAY
    - M.warlordSlainDrop * MAX_WARLORD_KILLS_PER_DAY;
}
export function maxVisibleStrength() {     // perception saturates ⇒ closed-form over the table
  const S = BALANCE.scout, P = BALANCE.pop;
  return P.cap * S.perGuard + P.cap * S.perWeapon + S.wallCap / S.wallDiv + S.claimCap / S.claimDiv;
}
```

### `raidEstimate` becomes a thin impure wrapper (`js/forecasts.js`)

Gathers `G` into inputs and calls `scoutRaid`; returns
`{ n, horde, strength, ceiling, floorN }` — a superset of the old `{ n, horde }`,
so `spawnRaid` and `tonightInfo` are untouched. Guards =
`G.settlers.filter(s => settlerActive(s) && s.role === 'guard').length`
(hp is implied — dead settlers are removed from `G.settlers`,
`js/settlers.js:329`); bodies = active count; weapons = `G.res.weapons`;
walls/claims from `visibleBoard()`; menace = `G.menace.value`.

### Starting numbers (Step 1) and why they satisfy the invariants

```js
menace: {
  start: 3, dayBase: 3, perCampStanding: 1, claimDiv: 12,
  expeditionNoise: 1, constructionNoiseCap: 2, beaconLit: 10,
  campBurnedDrop: 5, warlordSlainDrop: 6,
  ceilDiv: 4, floorDiv: 16, ledgerCap: 12,
  noEquilibriumHorizon: 60, recoveryHeadroom: 0.5, spiralCampsAssumed: 3,
},
scout: {
  perGuard: 1, perWeapon: 0.25,
  wallDiv: 12, wallCap: 60, claimDiv: 12, claimCap: 72, beaconClaimWeight: 10,
  probeBase: 1, probeMult: 0.55,
},
```

Hand-checked (executor: re-derive before trusting):

- **No-turtle 3a (Menace always rises)**: `minDailyMenaceGrowth()` =
  `3 − (5−1)/3 − 6/12` = **7/6 ≈ 1.17 > 0**. Even burning every camp the
  world can supply and felling every warlord, attention still mounts.
- **No-turtle 3b (ceiling outruns any defense)**: `maxVisibleStrength()` =
  `16·1 + 16·0.25 + 60/12 + 72/12` = **31**; max scouted budget =
  `1 + 0.55·31` = **18.05**. Menace at the horizon under *minimum* growth =
  `3 + 60·(7/6)` = **73** ⇒ ceiling = `2 + ⌊73/4⌋` = **20 > 18.05**. So by
  day ≤ 60 the ceiling exceeds what any buildable defense can draw — and the
  floor (`2 + ⌊73/16⌋ = 6`) keeps marching regardless of how small you stay.
- **No-death-spiral**: floor growth per day for a crippled commune (no
  counter-raids, `spiralCampsAssumed = 3` camps festering) =
  `(3 + 3·1)/16` = **0.375 ≤ recoveryHeadroom 0.5** raiders/day; and the
  scouted term is monotone in strength, so losses ⇒ smaller raids (tested as
  properties in Step 3).
- **Continuity with today's curve** (sanity, not invariant): day 1-2 `n = 2`
  (old: 2); day ~10 typical `n ≈ 5` (old: 4-7); day 20 maxed commune
  `n ≈ 10` (old: cap 10); day 12 horde `≈ 9-10` (old: 9). The feel survives;
  the *causes* become visible and the cap becomes a ledger.

## Commands you will need

| Purpose   | Command                               | Expected on success |
|-----------|---------------------------------------|---------------------|
| Install   | `pnpm install`                        | exit 0              |
| Tests     | `pnpm test`                           | all pass            |
| One file  | `pnpm vitest run test/menace.test.js` | that file passes    |
| Typecheck | `pnpm check`                          | exit 0              |
| Lint      | `pnpm lint`                           | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137    | manual check, Step 7 |

Debug hooks for manual verification: `window.G`, `window.ff(minutes)`
(fast-forward) — see AGENTS.md.

## Scope

**In scope**:
- `js/menace.js` (create), `test/menace.test.js` (create)
- `js/balance.js` — add `menace` + `scout` tables; remove the 8 dead
  `raid` keys
- `js/forecasts.js` — `raidEstimate` rewrite (contract-preserving)
- `js/state.js`, `js/save.js` — `menace`/`noiseBuilds` state + SAVE_VERSION 2
- `js/dawn.js`, `js/world.js`, `js/settlers.js`, `js/game.js` — five small
  event hooks (dawn accrual, expedition, camp burn, warlord, beacon) + one
  counter increment
- `js/screens.js` — one sidebar row + one click widget (minimal UI)
- `test/raid-path.test.js`, `test/balance.test.js`, `test/save.test.js` —
  extend/rewrite as specified
- `plans/README.md` — status row

**Out of scope** (do not touch):
- `spawnRaid` composition/jitter (`js/raiders.js`) — reads `est.n` unchanged
- Winter verb-flip (HP-10 — this plan only keeps `winterReduction` and flags it)
- The sapper (HP-6), Beacon night budgets (HP-9)
- The full scouting-report panel/modal — see Step 7's deferral note
- Trader pricing, morale, `tonightInfo` copy

## Git workflow

- Branch: `advisor/011-menace-scouting`
- Commits: one per step. Imperative messages ("Add Menace and scout tables to BALANCE").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: BALANCE tables + published-inequality tests (table first, so the tests pin it)

In `js/balance.js`, add the `menace:` and `scout:` blocks from the Design
section, placed after the existing `raid:` block (`js/balance.js:184`), each
key commented in the file's terse style. Include the HP-10 flag comment on
`raid.winterReduction` (`js/balance.js:153`):

```js
winterReduction: 2, // raid-size DISCOUNT in winter — HP-10 flips winter to desperation raids; keep the knob
```

Do NOT remove the dead raid keys yet (forecasts.js still reads them until
Step 5).

Extend `test/balance.test.js` with a new `describe('BALANCE.menace/scout — published invariants')`:

1. Key presence: `BALANCE.menace.dayBase`, `.ceilDiv`, `.floorDiv`,
   `.ledgerCap`, `BALANCE.scout.probeMult`, `.wallCap`, `.claimCap` are
   numbers (spot-check the load-bearing ones, not every key).
2. **No-turtle 3a**:
   `M.dayBase - (M.campBurnedDrop - M.expeditionNoise) / 3 - M.warlordSlainDrop / 12`
   `> 0` — with a comment citing `js/world.js:251` and `js/seasons.js:11`
   for the ⅓ and 1⁄12 cadences. (Step 3 re-asserts this via the exported
   helper; this table-local copy guards against someone retuning the table
   without running the menace module's tests.)
3. **No-death-spiral headroom**:
   `(M.dayBase + M.spiralCampsAssumed * M.perCampStanding) / M.floorDiv`
   `<= M.recoveryHeadroom`.
4. **No-turtle 3b** (the roadmap's "published inequality"): compute
   `sMax = pop.cap*scout.perGuard + pop.cap*scout.perWeapon + scout.wallCap/scout.wallDiv + scout.claimCap/scout.claimDiv`,
   `minGrowth` as in (2), and assert
   `raid.sizeBase + Math.floor((M.start + M.noEquilibriumHorizon * minGrowth) / M.ceilDiv) > scout.probeBase + scout.probeMult * sMax`.

**Verify**: `pnpm vitest run test/balance.test.js` → all pass (with the
Design-section numbers: minGrowth = 7/6, sMax = 31, 20 > 18.05).
`pnpm check && pnpm lint` → exit 0.

### Step 2: `js/menace.js` + state

Create `js/menace.js` exactly per the Design section: `bumpMenace`,
`menaceDawn`, `menaceWhy`, `visibleBoard` (per-minute cache + tiles-ref
check), and the pure `menaceCeiling`, `menaceFloor`, `visibleStrength`,
`scoutRaid`, plus `MAX_CAMP_BURNS_PER_DAY`, `MAX_WARLORD_KILLS_PER_DAY`,
`minDailyMenaceGrowth`, `maxVisibleStrength`. JSDoc-annotate the `inputs`
shape (`pnpm check` runs tsc over `js/`).

`menaceDawn` reads camps standing as
`G.world ? G.world.locs.filter(l => l.type === 'bandits' && !l.cleared).length : 0`
(the same expression the old formula used, `js/forecasts.js:9`) and claims
from `visibleBoard()`.

In `js/state.js`, add to `makeState()` (after the `morale`/`beaconDay` line,
`js/state.js:17`): the `menace` object with its seed ledger entry, and
`noiseBuilds: 0`. Add `import { BALANCE } from './balance.js';` (cycle-safe —
`balance.js` imports nothing).

In `js/game.js`, add `export { bumpMenace, menaceWhy } from './menace.js';`
next to the other barrel re-exports (`js/game.js:10-24`) — view modules
import through the barrel by house rule.

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green (nothing
consumes the module yet; existing tests must not break — `makeState` gaining
keys is additive).

### Step 3: `test/menace.test.js` — unit + property tests

Create with the stub-then-import header copied from
`test/raid-path.test.js:1-17`, importing `state.js` and `menace.js` and
`balance.js`. `beforeEach`: `Object.assign(G, makeState()); G.tiles = grassTiles(); G.world = { locs: [] };`
(copy the `grassTiles`/`tile` helpers).

1. **Ledger mechanics**: `bumpMenace(+4, 'test')` appends
   `{ day, cause, delta }` and raises `value`; `bumpMenace(-999, 'x')` floors
   `value` at 0; pushing `ledgerCap + 3` entries leaves exactly `ledgerCap`
   (oldest shifted out); `menaceWhy()` contains the newest cause.
2. **Dawn accrual**: with 2 uncleared bandit camps in `G.world.locs`, 24
   `campfire` tiles (so `claims/claimDiv = 2`), and `G.noiseBuilds = 5`:
   `menaceDawn()` raises `value` by
   `dayBase + 2*perCampStanding + 2 + constructionNoiseCap` (= 3+2+2+2 = 9
   with Step 1 numbers — re-derive), writes ≥ 3 ledger entries, and resets
   `G.noiseBuilds` to 0. A second `menaceDawn()` with camps cleared adds
   no `'camps left standing'` entry.
3. **visibleBoard + cache**: paint 4 walls + 1 post + 2 tents + 1 campfire →
   `{ walls: 5, claims: 3 }`; reassign `G.tiles = grassTiles()` **without
   advancing `G.min`** → counts drop to 0 (the tiles-ref invalidation);
   `G.beaconDay = 3` → claims include `beaconClaimWeight`.
4. **scoutRaid properties** (pure — build inputs literals):
   - *Menace-monotone (roadmap: "more Menace never smaller ceiling")*: for
     fixed strength inputs, sweep `menace` 0..200 step 5 → `n` is
     non-decreasing, and `menaceCeiling`/`menaceFloor` are non-decreasing.
   - *Clamp*: for a grid of inputs (menace ∈ {0, 20, 80, 200} × guards ∈
     {0, 4, 16} × walls ∈ {0, 40, 200}), non-horde `n` always satisfies
     `max(sizeBase, floorN) ≤ n ≤ max(ceiling, sizeBase)`.
   - *Post-loss shrink (no-death-spiral)*: fixture A (menace 60, 6 guards,
     12 bodies, 6 weapons, 40 walls, 20 claims) vs fixture B = A after a
     mauling (2 guards, 7 bodies, 25 walls) → `n_B < n_A` and
     `n_B >= BALANCE.raid.sizeBase`. Also the general property: any
     component-wise-smaller strength inputs at equal menace ⇒ `n' ≤ n`.
   - *Winter knob*: same inputs, `winter: true` ⇒ `n` smaller by ≤
     `winterReduction` (document with an HP-10 comment).
   - *Horde clause*: `horde: true, day: 12` reproduces the old arithmetic:
     `max(n + hordeBonus, hordeFloorBase + Math.floor(12 / hordeFloorDiv)) + warlordExtra`.
5. **Published inequalities via the exported helpers**:
   `expect(minDailyMenaceGrowth()).toBeGreaterThan(0)` and the 3b assertion
   using `maxVisibleStrength()` and `noEquilibriumHorizon` (same arithmetic
   as Step 1's table-local copy, now exercising the shipped code path).

**Verify**: `pnpm vitest run test/menace.test.js` → all pass.

### Step 4: wire the cause events

Five hooks + one counter — each a 1-2 line change at a verified site:

1. `js/dawn.js` — import and call `menaceDawn()` between `communeDawn()` and
   `worldDawn()` inside the `if (!G.gameOver)` guard (`js/dawn.js:7-13`):
   camps are counted as they stood overnight, before `worldDawn` adds sites.
2. `js/world.js:96-110` (`startExpedition`, next to `G.stats.expeditions++`):
   `bumpMenace(BALANCE.menace.expeditionNoise, 'a party rode out')`.
3. `js/world.js:158-163` (bandit camp cleared, next to `G.banditsCleared++`):
   `bumpMenace(-BALANCE.menace.campBurnedDrop, 'a camp burned')`.
4. `js/settlers.js:311-318` (warlord branch of `hitRaider`, next to
   `G.stats.warlords++`): `bumpMenace(-BALANCE.menace.warlordSlainDrop, 'a warlord slain')`.
5. `js/game.js:184-194` (`igniteBeacon`, after `G.beaconDay = G.day`):
   `bumpMenace(BALANCE.menace.beaconLit, 'THE BEACON BURNS')`.
6. `js/settlers.js:249-264` (build branch of `completeTask`, next to the
   stats increments): `G.noiseBuilds++` (dawn-batched, capped — a 40-wall
   ring is two days of hammer-noise, not +40 Menace).

Import `bumpMenace` from `./menace.js` in sim modules directly (house rule:
sim modules import directly, not via the barrel). No import cycles:
`menace.js` depends only on `state`/`balance`/`data`.

Add integration tests to `test/menace.test.js`:

- Expedition: reuse the expedition fixture shape from
  `test/raid-path.test.js:131-166` but with a `bandits` loc; after
  `startExpedition` menace rose by `expeditionNoise`; after `tickWorld()`
  resolves a successful clear, menace net change is
  `expeditionNoise − campBurnedDrop` and the ledger's newest entry is
  `'a camp burned'`.
- Beacon: place a `beacon` tile, call `igniteBeacon()` (import via
  `game.js`), assert `+beaconLit` and that a second call (already lit)
  changes nothing (`js/game.js:185` guard).

**Verify**: `pnpm vitest run test/menace.test.js` → green;
`pnpm test` → full suite green (no behavior consumed by raids yet).

### Step 5: replace `raidEstimate` + prune the dead keys

Rewrite `js/forecasts.js:7-19` as the thin wrapper from the Design section
(delete the old formula body; keep the signature `raidEstimate(day = G.day)`
and the `{ n, horde, ... }` superset return). Remove the now-unused
`uncleared` computation. Keep a one-line comment: sizing truth lives here so
the sidebar can't drift from `spawnRaid` (mirroring `js/raiders.js:209`).

Then remove the 8 dead keys from `BALANCE.raid` (`sizeDayStart`,
`sizeDayStep`, `banditReductionDiv`, `unclearedFromDay`, `unclearedMax`,
`capEarly`, `capLateFromDay`, `capLateStep`).

**Verify**:
- `grep -rn "sizeDayStart\|sizeDayStep\|banditReductionDiv\|unclearedFromDay\|unclearedMax\|capEarly\|capLateFromDay\|capLateStep" js/ test/`
  → no hits.
- `pnpm check && pnpm lint` → exit 0.
- `pnpm test` → **expect exactly the three old `raidEstimate`
  characterization tests to fail** (`test/raid-path.test.js:73-105`); every
  other test green, including `spawnRaid` (see Current state — if
  `spawnRaid`'s test fails, STOP). Step 6 rewrites the three.

### Step 6: rewrite the `raidEstimate` characterization tests

In `test/raid-path.test.js`, replace the `describe('raidEstimate')` block
(lines 73-105). `beforeEach` keeps `Object.assign(G, makeState())` (which now
seeds `G.menace`), `G.world = { locs: [] }`, `G.tiles = grassTiles()` (the
wrapper now scans tiles — the old block never set them; `makeState()` leaves
`tiles: null` and `visibleBoard()` must guard `if (!G.tiles) return { walls: 0, claims: 0 }` —
add that guard in Step 2 if you haven't).

New tests (document intent in test names — this is the new contract):

1. **Keeps the external contract**: returns `{ n, horde }` with `n >= BALANCE.raid.sizeBase`
   and `horde === false` on a non-horde day; `raidEstimate(12).horde === true`
   and horde `n` > same-state non-horde `n` (replaces the old horde test).
2. **Menace is the ceiling**: `G.menace.value = 0` with an over-built board
   (16 guards, plenty of weapons/walls) ⇒ `n === BALANCE.raid.sizeBase`
   (nobody's watching yet); raise `G.menace.value = 200`, same board ⇒
   `n` equals the scouted budget (bigger), and never exceeds
   `menaceCeiling(200)`.
3. **Scouts track capacity**: fixed `G.menace.value = 60`; strong board
   (guards + walls painted with the `tile()` helper) ⇒ `n_strong`; strip
   walls and demote guards ⇒ `n_weak < n_strong` and
   `n_weak >= menaceFloor(60) >= sizeBase` (post-loss raids shrink, never
   snowball — replaces the old "counts uncleared camps" test, whose cause
   now flows through `menaceDawn`, tested in Step 3.2).
4. **Firelight is claimed ground**: same menace and defenders, add 30
   campfire/tent tiles ⇒ `n` does not decrease (lit ground reads as
   strength) — and note the attention side already covered by Step 3.2.

**Verify**: `pnpm test` → entire suite green.

### Step 7: persistence (SAVE_VERSION 2) + minimal UI

**Save** (`js/save.js`):

- `SAVE_VERSION = 2` (`js/save.js:7`).
- `toSaveData` (`js/save.js:12-29`): add `menace, noiseBuilds` to the
  destructure and the returned object.
- `migrate` (`js/save.js:31-65`): after the v0 block, add a v1→v2 step:

  ```js
  if (d.version < 2) {
    d.menace = d.menace || {
      value: BALANCE.menace.start + Math.max(0, (d.day || 1) - 1) * BALANCE.menace.dayBase,
      ledger: [],
    };
    d.noiseBuilds = d.noiseBuilds || 0;
    d.version = SAVE_VERSION;
  }
  ```

  (Reconstruct attention from the calendar — an old day-30 save must not
  load at `start`.) `save.js` gains `import { BALANCE } from './balance.js';`
  (cycle-safe).
- `test/save.test.js`: add (a) a round-trip assertion that a bumped menace
  value + ledger entry survives `save()`/`loadGame()`; (b) a v1→v2 test in
  the shape of the existing v1 test: write a `save()`, edit raw JSON to
  `raw.version = 1; delete raw.menace; delete raw.noiseBuilds; raw.day = 10;`,
  re-store, `loadGame()`, assert `G.menace.value === BALANCE.menace.start + 9 * BALANCE.menace.dayBase`
  and `G.noiseBuilds === 0`.

**Sidebar** (`js/screens.js` — keep it minimal; the ledger data structure is
the deliverable, the panel is not):

- `sidebarLayout()` (`js/screens.js:194`): `let y = 9` → `let y = 10`, update
  the comment to `// header through food + resource line (rows 0-9, incl. menace row)`.
  The layout below self-adjusts (see Current state).
- `drawSidebar` (insert between the tonight line and the divider,
  `js/screens.js:472-473`):

  ```js
  const est = raidEstimate();
  str(SB_X, y++, `☠ Menace ${G.menace.value} · eyes for ~${est.ceiling}`.slice(0, SB_W), '#c08a70');
  ```

  Import `raidEstimate` and `menaceWhy` by extending the existing
  `from './game.js'` import list (`js/screens.js:4-10`).
- `widgets()` (after the morale widget, `js/screens.js:302-305`): a click
  widget at `rect: { x: SB_X, y: 6, w: SB_INNER, h: 1 }` →
  `notice(menaceWhy() || 'The world has not yet taken notice.')` — the
  cause-ledger surface, same interaction grammar as morale-why.
- **Deferral note (do not block)**: the full scouting-report panel (ledger
  history + strength breakdown as a proper modal) belongs after plan 009
  (the P1-5 `screens.js` split) lands — add it to that follow-up rather
  than growing `screens.js` by another modal here. The data it needs
  (`G.menace.ledger`, `raidEstimate().strength/ceiling/floorN`) ships now.

**Verify**:
- `pnpm check && pnpm lint && pnpm test` → all green.
- Manual (`pnpm dev`, http://localhost:8137): new run → sidebar shows the
  Menace row; click it → notice lists causes; `ff(1440)` in the console →
  Menace rose and the ledger gained dawn entries; `ff` to a raid → raid
  size matches the sidebar forecast; save & quit → Continue → Menace value
  survived. Both renderers (pause menu → Graphics toggle) show the same
  sidebar row.

### Step 8: calibration snapshot + `plans/README.md`

Record the new curve so the next tuner has a baseline: in
`test/menace.test.js`, add one table-driven snapshot test — for days
{1, 5, 10, 20} with a scripted "typical" board per day (settler/wall/claim
counts written in the test), assert `n` lands in a **band** (e.g. day 20 ∈
[8, 12]), not an exact value; comment each band with the old-formula value
(2 / ~3 / 4-7 / 10). If any band misses, STOP condition 4 applies.

Update `plans/README.md`: add (or update, if a sibling plan already added
rows 009/010) the row

```
| 011 | Menace + the scouting report (visible cause-ledgers, capacity-scouted raids) | HP-5 | P1 | M-L | 008 | DONE |
```

and under "Dependency notes", note that HP-6/HP-9/HP-10 build on this
plan's ledgers and that the scouting-report panel is deferred behind plan
009.

**Verify**: `pnpm check && pnpm lint && pnpm test` all exit 0;
`git status` shows only in-scope files.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/menace.test.js`
~14 tests (ledger, dawn accrual, board cache, scoutRaid properties,
published inequalities, event integration, calibration bands),
`test/balance.test.js` +4, `test/raid-path.test.js` rewritten
`raidEstimate` block (~4), `test/save.test.js` +2 — all green alongside the
existing suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/menace.js` exists; `raidEstimate` no longer reads `day` into a
      size formula — `grep -n "sizeDayStep" js/` → no hits
- [ ] Menace falls **only** via the two action hooks — `grep -n "bumpMenace(-" js/`
      shows exactly the camp-burn and warlord sites
- [ ] The no-turtle inequality and the spiral headroom are `expect(...)`
      assertions over `BALANCE` in two test files, not comments
- [ ] `SAVE_VERSION === 2` with a v1→v2 migration test
- [ ] Sidebar shows the Menace row in both renderers; clicking it lists causes
- [ ] Old `{ n, horde }` consumers (`spawnRaid`, `tonightInfo`) unchanged
- [ ] `plans/README.md` row added/updated

## STOP conditions

1. Any excerpt in "Current state" no longer matches the code (drift) — the
   drift check at the top failed to catch a mid-flight change.
2. The Step 1 inequality tests cannot pass with numbers that also keep the
   Step 8 calibration bands — the model needs a design pass, not silent
   retuning; report the tension (which inequality vs which band).
3. Any test outside `test/raid-path.test.js:73-105` fails after Step 5 —
   especially the `spawnRaid` test: that means the floor/clamp behaves
   differently than derived here.
4. A calibration band in Step 8 misses by more than ±2 raiders — the curve
   has drifted from today's playable difficulty; report the table row.
5. An import cycle appears (`pnpm check` or Vite complains) — the design
   claims `menace.js` ← {state, balance, data} only; if a hook forces more,
   stop and report rather than inverting a dependency.

## Maintenance notes

- **The inequalities are living constraints**: any retune of
  `BALANCE.menace`/`BALANCE.scout`/`pop.cap` must keep the four assertions
  green — that is the point. Trials (GDD §8) later scale these tables;
  the tests are the per-Trial check the GDD demands ("at every Trial").
- **HP-10** flips `raid.winterReduction` into desperation-raid pressure and
  makes the frozen river a crossing — the knob and its flag comment are the
  handoff. **HP-6** (sapper) should price wall-heavy boards via
  `scout.wallDiv`/`wallCap` rather than new terms. **HP-9** budgets Beacon
  nights off `menaceCeiling` + a concealed share.
- The cadence constants (`1/3` camps, `1/12` warlords) mirror
  `js/world.js:251` and `js/seasons.js:11`; anyone changing those systems
  must update `MAX_CAMP_BURNS_PER_DAY`/`MAX_WARLORD_KILLS_PER_DAY` — the
  citation comments in `js/menace.js` are the tripwire.
- Deferred deliberately: the full scouting-report panel (after plan 009);
  Menace-aware Elder counsel lines; per-cause icons in the ledger; trader
  pricing stays Menace-decoupled by GDD §7 (do not "fix" that).
