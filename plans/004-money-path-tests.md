# Plan 004: Characterization tests for the money paths (legacy scoring, perks, save round-trip, migration)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3ee106c..HEAD -- js/meta.js js/save.js js/run-end.js test/`
> If `js/meta.js` or `js/save.js` changed, re-read them fully before writing
> tests — these tests characterize *current* behavior. (Plan 002 intentionally
> touches `js/save.js` — its cam changes are compatible with this plan.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (tests + one small guarded change to `migrate()`)
- **Depends on**: none (coexists with 002; if 002 landed, keep its tests)
- **Category**: tests
- **Planned at**: commit `3ee106c`, 2026-07-07

## Why this matters

Legacy points are the game's only cross-run currency — a scoring or
double-count regression permanently corrupts every player's meta-progression,
and save/migration bugs silently destroy runs. None of it is tested today
(the whole suite is 11 tests in one file, and its save test only asserts one
field survives). These characterization tests lock down current behavior
*before* the roadmap's balance and refactor work (perk redesign, ascension,
save-shape changes) starts landing. The plan also fixes one latent hazard in
`migrate()` while it's under test: v1 saves don't backfill newly added
`stats`/`mods` keys, so a future key added without a version bump loads as
`undefined` and NaN-cascades.

## Current state

Vanilla-JS browser game; vitest; existing suite `test/boundaries.test.js` stubs
globals **before** dynamically importing modules:

```js
// test/boundaries.test.js:1-17 — the pattern every new test file must copy:
import { describe, it, expect, beforeEach, vi } from 'vitest';
const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
});
vi.stubGlobal('performance', { now: () => 1000 });
const { G, makeState } = await import('../js/state.js');
```

### js/meta.js (71 lines, read in full before testing)

`META` is a module-level singleton loaded from localStorage at import time
(`js/meta.js:23`). Tests must reset it in `beforeEach` by mutating in place
(other modules hold the same reference):

Scoring (`js/meta.js:50-71`):

```js
export function endRun(stats, days, opts = {}) {
  let pts = Math.max(1, days + 2 * stats.raids + 2 * stats.sites + Math.floor(stats.peak / 2) + Math.floor(stats.kills / 3));
  const bonuses = [];
  const feat = (cond, label, n) => { if (cond) { bonuses.push([label, n]); pts += n; } };
  feat((stats.winters || 0) >= 1, 'endured winter', 3 * (stats.winters || 0));
  feat((stats.hordes || 0) >= 1, 'broke a horde', 4 * (stats.hordes || 0));
  feat((stats.warlords || 0) >= 1, 'slew a warlord', 3 * (stats.warlords || 0));
  feat((stats.bandits || 0) >= 3, 'scourge of bandits', 3);
  feat(stats.peak >= 12, 'a true commune', 3);
  feat(opts.win, 'THE BEACON HELD', 25);
  if (hasPerk('ledger')) pts = Math.round(pts * 1.25);
  META.points += pts;
  META.runs++;
  META.bestDays = Math.max(META.bestDays, days);
  if (opts.win) META.wins++;
  META.life.days += days; META.life.raids += stats.raids;
  META.life.sites += stats.sites; META.life.kills += stats.kills;
  saveMeta();
  return { pts, bonuses };
}
```

Perks (`js/meta.js:29-39`): `perkLevel(id)` counts occurrences in `META.owned`;
`buyPerk(id)` rejects when unknown id, at max level (`p.max || 1`), or
`META.points < p.cost`. Relevant `PERKS` rows (`js/data.js:175-186`):
`larder` cost 3 max 3 · `ledger` cost 5 (max 1 implied) · `fifth` cost 6.
`civUnlocked` (`js/meta.js:46`) uses `CIV_UNLOCKS` (`js/data.js:190-193`):
ratcatchers unlock at lifetime `sites >= 5` **or** `runs >= 3`.

### js/run-end.js (25 lines — read in full)

`communeFallen()` / `communeAscended()` both guard on `if (G.gameOver) return;`
then set flags, call `endRun`, store `G.legacyEarned`/`G.bonusLines`, and
`clearSave()`. Calling either twice must pay out only once.

### js/save.js (83 lines — read in full)

- `toSaveData()` snapshots `G`; `usedNames` is a `Set` serialized as
  `[...usedNames]` (`js/save.js:26`) and rebuilt in `migrate()`
  (`js/save.js:56`: `if (!(d.usedNames instanceof Set)) d.usedNames = new Set(d.usedNames || [])`).
- `migrate(d)` (`js/save.js:31-58`): **only when `!d.version`** it strips
  ephemeral keys, backfills `stats`/`mods` from `makeState()` defaults, gives
  traitless settlers a random trait and `downed=false`, converts tiles
  `bed→tent (hp 30)`, `floor→dirt`, `build.id bed→tent`, `sleeper→sleepers`
  array, and computes missing expedition `power`. Saves already at
  `version === 1` skip all of that, and `loadGame()`'s
  `Object.assign(G, makeState(), d)` (`js/save.js:79`) then overwrites the
  defaults wholesale — the forward-compat gap this plan closes.
- `loadGame()` returns `false` for missing/corrupt JSON or wrong tile count
  (`raw.tiles.length !== MAP_W * MAP_H`, i.e. 140×96 = 13,440).

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Install   | `pnpm install`              | exit 0              |
| Tests     | `pnpm test`                 | all pass            |
| One file  | `pnpm vitest run test/meta.test.js` | that file passes |
| Typecheck | `pnpm check`                | exit 0              |
| Lint      | `pnpm lint`                 | exit 0              |

## Scope

**In scope**:
- `test/meta.test.js` (create)
- `test/save.test.js` (create)
- `js/save.js` — the `migrate()` stats/mods always-merge change ONLY (Step 4)

**Out of scope**:
- Any change to `js/meta.js`, `js/run-end.js`, or scoring values — these tests
  *characterize* today's behavior; if a number seems odd, test what the code
  does, don't "fix" it.
- `test/boundaries.test.js` (leave as is; plan 002 owns its additions).

## Git workflow

- Branch: `advisor/004-money-path-tests`
- Commits: one per step. Imperative messages ("Add legacy scoring characterization tests").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `test/meta.test.js` — scoring and perks

Create the file with the stub-then-import header (copy from
`test/boundaries.test.js:1-10`), then import:

```js
const { META, endRun, buyPerk, perkLevel, hasPerk, addPoints, civUnlocked } = await import('../js/meta.js');
```

Add a reset helper used in `beforeEach` (mutate in place — never reassign META):

```js
function resetMeta() {
  META.points = 0; META.owned.length = 0; META.runs = 0;
  META.bestDays = 0; META.wins = 0;
  META.life = { days: 0, raids: 0, sites: 0, kills: 0 };
}
```

Tests to write (compute expectations by hand from the excerpt — the values
below are pre-computed and correct; verify them yourself before trusting them):

1. **Base formula**: `endRun({raids:4, sites:2, peak:7, kills:15, winters:0, hordes:0, warlords:0, bandits:0}, 10)`
   → `pts === 30` (10 + 8 + 4 + 3 + 5), `bonuses` empty, `META.points === 30`,
   `META.runs === 1`, `META.bestDays === 10`, `META.wins === 0`,
   `META.life` = `{days:10, raids:4, sites:2, kills:15}`.
2. **Feats stack**: same stats but `winters:2, hordes:1, warlords:1, bandits:3, peak:12`
   and days 10 → base uses `peak 12` → 10+8+4+6+5 = 33; feats +6 (winters) +4
   (horde) +3 (warlord) +3 (bandits) +3 (true commune) → `pts === 52`, and
   `bonuses` contains 5 entries with those labels.
3. **Win pays 25 and counts a win**: minimal stats `{raids:0,sites:0,peak:0,kills:0}`, days 1,
   `{win:true}` → base max(1,1)=1, +25 → `pts === 26`, `META.wins === 1`.
4. **Ledger multiplies last**: `META.owned.push('ledger')` then case 3 again →
   `pts === Math.round(26 * 1.25) === 33` (`Math.round(32.5)` — verify: JS
   rounds .5 up, so 33).
5. **Floor at 1**: all-zero stats, days 0 → base `pts === 1`.
6. **buyPerk guards**: with `points = 5`: `buyPerk('larder')` (cost 3) → true,
   `perkLevel('larder') === 1`, points 2; second buy → false (cost 3 > 2);
   `addPoints(7)`, buy twice more → both true, level 3; a fourth buy → false
   (max 3). `buyPerk('nope')` → false.
7. **civUnlocked**: fresh META → `civUnlocked('tillers') === true` (no entry),
   `civUnlocked('ratcatchers') === false`; set `META.life.sites = 5` → true;
   reset, set `META.runs = 3` → true.

**Verify**: `pnpm vitest run test/meta.test.js` → all pass.

### Step 2: `test/meta.test.js` — run-end idempotence

In the same file (needs `G`): import `state.js`, `run-end.js`:

```js
const { G, makeState } = await import('../js/state.js');
const { communeFallen, communeAscended } = await import('../js/run-end.js');
```

Test: reset META and `Object.assign(G, makeState())`; set
`G.stats.raids = 2; G.day = 5; G.banditsCleared = 1;` then call
`communeFallen()` **twice**. Assert `META.runs === 1`, `G.legacyEarned > 0`,
`G.stats.bandits === 1`, and `META.points` equals the value after the first
call (no double payout). Repeat the shape for `communeAscended()` (fresh reset):
assert `G.victory === true` and `META.wins === 1` after two calls.

**Verify**: `pnpm vitest run test/meta.test.js` → all pass.

### Step 3: `test/save.test.js` — deep round-trip and v0 migration

Create with the same stub header, importing `state.js`, `save.js`, and
`data.js` (`MAP_W`, `MAP_H`). Helper: `const blankTiles = () => new Array(140 * 96).fill(null).map(() => ({ t: 'grass' }));`

1. **Deep round-trip**: build a real-ish state — `G.tiles = blankTiles()`;
   one settler object with `id:1, name:'Ash', role:'guard', trait:'brave', hp:20, x:3, y:4, downed:false, away:false`;
   `G.usedNames = new Set(['Ash'])`; `G.res.food = 7; G.res.coin = 9`;
   `G.craftQueue = ['c_spear']`; `G.day = 9`. `save()` then scramble
   (`G.res.food = 0; G.usedNames = new Set(); G.settlers = []`) then
   `loadGame()`. Assert: `res.food === 7`, `res.coin === 9`,
   `settlers[0].name === 'Ash'` and `.trait === 'brave'`,
   `craftQueue` round-trips, `G.usedNames instanceof Set` and
   `G.usedNames.has('Ash')`.
2. **v0 migration**: hand-write a *versionless* raw object into the store key
   `hearthfall.save` (see `js/save.js:6` — `const SAVE_KEY = 'hearthfall.save'`):
   `{ day: 3, camp: {x:5,y:5}, tiles, settlers: [{id:1, name:'Old', role:'worker', hp:20, x:1, y:1}], stats: { raids: 2 }, mods: { crop: 1.25 }, usedNames: ['Old'], sel: {ax:1,ay:1,bx:2,by:2} }`
   where `tiles` is `blankTiles()` with `tiles[0] = { t: 'bed', hp: 30, sleeper: 1 }`
   and `tiles[1] = { t: 'floor' }`. After `loadGame()` assert:
   `G.tiles[0].t === 'tent'`, `G.tiles[0].sleepers` deep-equals `[1]` and
   `G.tiles[0].sleeper === undefined`, `G.tiles[1].t === 'dirt'`,
   `G.settlers[0].trait` is a truthy string, `G.settlers[0].downed === false`,
   `G.stats.raids === 2` **and** `G.stats.kills === 0` (backfilled),
   `G.mods.crop === 1.25` **and** `G.mods.expPower === 1` (backfilled),
   `G.sel === null` (ephemeral stripped).
3. **Corruption paths**: `store['hearthfall.save'] = '{not json'` →
   `loadGame() === false`; a valid JSON with `tiles` of length 10 →
   `loadGame() === false`.

**Verify**: `pnpm vitest run test/save.test.js` → all pass.

### Step 4: Close the v1 backfill gap in `migrate()`

In `js/save.js`, move the two merge lines out of the `if (!d.version)` block so
they always run (leave the rest of the v0 block where it is). The tail of
`migrate` becomes:

```js
    d.version = SAVE_VERSION;
  }
  d.stats = { ...makeState().stats, ...(d.stats || {}) };
  d.mods = { ...makeState().mods, ...(d.mods || {}) };
  d.buildSel = null; d.notice = null; d.tip = null; d.sel = null;
  if (!(d.usedNames instanceof Set)) d.usedNames = new Set(d.usedNames || []);
  return d;
```

(Deleting the two now-redundant lines inside the v0 block is correct and
expected.) Add a test to `test/save.test.js`: write a **version-1** save via
`save()`, then edit the raw JSON to `delete raw.stats.kills; delete raw.mods.expPower;`
re-store it, `loadGame()`, assert `G.stats.kills === 0` and
`G.mods.expPower === 1` — this is the regression the change prevents.

**Verify**: `pnpm test` → entire suite green (this change must not break the
existing `save/load` test in `test/boundaries.test.js` or Step 3's tests).

## Test plan

(The steps above ARE the test plan.) Final shape: `test/meta.test.js` ~10
tests, `test/save.test.js` ~5 tests, all green alongside the existing 11 (13 if
plan 002 landed first).

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `test/meta.test.js` and `test/save.test.js` exist; suite total ≥ 26 tests
- [ ] `grep -n "makeState().stats" js/save.js` shows the merge OUTSIDE the `if (!d.version)` block (once, not twice)
- [ ] Calling `communeFallen` twice in a test pays out exactly once
- [ ] `git status` shows only the three in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any hand-computed expectation in Step 1 disagrees with what the code
  produces: re-derive it from `js/meta.js` first; if the code genuinely
  double-counts or diverges from the excerpt, STOP and report — that's a real
  bug to surface, not to silently encode in a test.
- `js/meta.js` or `js/save.js` no longer match the excerpts (drift).
- The Step 4 change breaks any existing test — report rather than adjusting the
  old test.

## Maintenance notes

- These are characterization tests: when the perk redesign (roadmap P3-2) or an
  ascension system changes scoring on purpose, update expectations in the same
  PR — the tests' job is making that diff visible, not preventing it.
- Anyone changing the save shape must now: bump `SAVE_VERSION`, extend
  `migrate()`, and add a migration test here — the always-merge only protects
  `stats`/`mods` key additions.
- Deferred: RNG seeding/persistence (would make trait backfill deterministic in
  tests). Currently `migrate` gives random traits; tests only assert truthiness.
