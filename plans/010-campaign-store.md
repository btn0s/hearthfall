# Plan 010: The campaign store — versioned cross-run persistence (HP-1)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d177bfd..HEAD -- js/meta.js js/run-end.js js/save.js js/state.js js/settlers.js test/meta.test.js test/save.test.js`
> If `js/run-end.js` or `js/meta.js` changed, re-read them fully before
> starting — this plan splices into the ending flow and stamps a version onto
> `META`, and both edits depend on the excerpts below being current.

## Status

- **Priority**: P1
- **Effort**: M-L
- **Risk**: MEDIUM (new persistence architecture + a splice into the ending
  flow; additive — no existing save/meta shape changes)
- **Depends on**: 004 (save/meta characterization tests — landed); 009 not
  required
- **Category**: feature/architecture
- **Planned at**: commit `d177bfd`, 2026-07-08
- **Roadmap ID**: HP-1 (`ROADMAP.md:130`, first item of Milestone HP0)

## Why this matters

The GDD v2 campaign flip (persistent band, disposable settlements — GDD §3)
stands entirely on cross-run persistence that does not exist: Appendix B
states it plainly — "**continuity has zero code** (META is scalar,
unversioned; saves are deleted at run end — the campaign store is new
architecture)" (`GDD.md:468-469`). Every HP0 item that makes the hypothesis
testable — arrivals joining the *band* (HP-3), endings writing real survivors
(HP-7), the wagon camp and aging (HP-8) — writes to or reads from this store.
The feasibility attack's verdict is binding: "the campaign store must be
versioned from day one" (`GDD.md:438-442`), because retrofitting migrations
onto an unversioned blob is exactly the landmine `META` already is
(`js/meta.js` has no version field; the moment its shape changes, every
player's legacy is a guess).

Two invariants from the GDD govern this plan and are **review gates**, not
suggestions:

- **GDD P5 (`GDD.md:129-147`), §9.1 (`GDD.md:343`)**: what crosses between
  runs is *history, never stats* — people (name, trait, wants, scars — all
  zero-modifier), the map, the Chronicle, unlocked *options*. Nothing in the
  campaign record may carry a number that makes the next fight easier. If any
  step tempts you to store a modifier, STOP.
- **Ending-flow ordering (GDD §10, `GDD.md:377-379`)**: survivors must be
  written to the campaign **before** `clearSave()` destroys the run — today
  both endings delete the save with nothing written anywhere
  (`js/run-end.js:13,23`), and that ordering mistake, once shipped, silently
  eats real campaigns.

## Current state

Vanilla-JS browser game; vitest. Persistence today is three independent
localStorage keys: `hearthfall.save` (run state, versioned, `js/save.js:6-7`),
`hearthfall.meta` (legacy points/perks, **unversioned**, `js/meta.js:7`),
plus UI-preference keys (`hearthfall.gfx`, `hearthfall.minimap`,
`hearthfall.tips`). `hearthfall.campaign` is unclaimed.

### js/meta.js (71 lines — read in full)

Loaded at import time into a module-level singleton; note there is **no
version field** anywhere in the record:

```js
// js/meta.js:9-23
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d.points === 'number') {
      return {
        points: d.points, owned: d.owned || [], runs: d.runs || 0, bestDays: d.bestDays || 0,
        wins: d.wins || 0,
        life: { days: 0, raids: 0, sites: 0, kills: 0, ...(d.life || {}) },
      };
    }
  } catch (e) { /* corrupted meta: start fresh */ }
  return { points: 0, owned: [], runs: 0, bestDays: 0, wins: 0, life: { days: 0, raids: 0, sites: 0, kills: 0 } };
}

export const META = load();
```

### js/run-end.js (25 lines — read in full)

Both endings score META, then destroy the run save. Nothing survives:

```js
// js/run-end.js:6-14
export function communeFallen() {
  if (G.gameOver) return;
  G.gameOver = true;
  addLog('The commune has fallen.', '#e05040');
  G.stats.bandits = G.banditsCleared;
  const r = endRun(G.stats, G.day, { win: false });
  G.legacyEarned = r.pts; G.bonusLines = r.bonuses;
  clearSave();
}
```

`communeAscended()` (`js/run-end.js:16-24`) is the same shape plus
`G.victory = true` and `{ win: true }`. Callers: ascension from the Beacon
hold check (`js/game.js:113`); falls from `js/game.js:136`,
`js/settlers.js:330` (`killSettler`), and `js/world.js:202` (expedition
wipe) — all three fall paths fire only when `G.settlers` is already empty,
so at HP-1 scope a fall has **no survivors** (HP-7's Torch ending is what
later passes an explicit survivor list).

### js/save.js — what the campaign store must NOT touch

`clearSave()` (`js/save.js:71-73`) removes `hearthfall.save`; `save()`
(`js/save.js:75-78`) refuses to write when `G.gameOver`. Autosave points:
dawn (`js/dawn.js:11`), run start (`js/screens.js:61`), save-and-quit
(`js/screens.js:366,802,806`). The run save's shape, `SAVE_VERSION`, and
`migrate()` are **out of scope** — the campaign store is a parallel key, not
a save extension.

### js/settlers.js — what a "band member" can be built from today

```js
// js/settlers.js:33-38 (makeSettler's record)
return {
  id: G.nextId++, name, x, y, role, trait,
  hp: maxHp, maxHp, hunger: rint(15, 35), energy: rint(60, 95),
  sleeping: false, away: false, starving: false, downed: false,
  task: null, path: null, pathGoal: null, pathAge: 0, atkcd: 0, bedIdx: -1, failCd: 0,
};
```

Settlers have `name` and `trait` (both history — safe to persist) but **no
wants/scars/age** (those fields arrive with HP-2/HP-8; the store defines them
now as empty/zero so the shape never changes under them). Settler `id`s are
per-run (`nextId` resets with `makeState()`, `js/state.js:23`) — band members
need their own campaign-scoped ids. Everything else on a settler (`hp`, `x`,
`role`, task state) is run-state or a stat and must not cross (P5; `role`
is re-chosen at founding, not carried).

`G.world` (`js/world.js:30`) is the **in-run** overworld (`{ grid, base,
locs }`), regenerated by `genWorld()` every run — distinct from the campaign
map this plan introduces, which persists across runs.

### The test net this builds on

`test/meta.test.js` and `test/save.test.js` (plan 004) established the
patterns: stub `localStorage`/`performance` **before** dynamic import
(`test/meta.test.js:3-9`), reset singletons by mutating in place
(`resetMeta`, `test/meta.test.js:15-19`), inject raw JSON directly into the
store to test migration (`test/save.test.js:52-61`), and the run-end
idempotence tests (`test/meta.test.js:96-129`) which — after Step 3 — will
exercise the campaign write transitively.

## Commands you will need

| Purpose   | Command                                 | Expected on success |
|-----------|-----------------------------------------|---------------------|
| Install   | `pnpm install`                          | exit 0              |
| Tests     | `pnpm test`                             | all pass            |
| One file  | `pnpm vitest run test/campaign.test.js` | that file passes    |
| Typecheck | `pnpm check`                            | exit 0              |
| Lint      | `pnpm lint`                             | exit 0              |

## Scope

**In scope**:
- `js/campaign.js` (create) — the versioned campaign store
- `js/run-end.js` — write survivors/ruins to the campaign **before** `clearSave()`
- `js/meta.js` — add a `version` field (stamp-only; no shape change otherwise)
- `test/campaign.test.js` (create), additions to `test/meta.test.js`
- `README.md` code map line + `AGENTS.md` persistence sentences (Step 5)

**Out of scope**:
- Migrating perks/`owned` into the campaign store — the perk system's future
  is decided by HP-8/wagon-camp design, not here. `META` keeps its job
  (legacy points, perks, lifetime unlock gates) unchanged.
- Reading the campaign store anywhere (drafting the band at founding,
  campaign-map UI, aging) — those are HP-3/HP-7/HP-8. This plan builds the
  store and the write path only. Dead-code lint: everything exported is used
  by `run-end.js` or tests, so nothing ships unreferenced.
- Any change to `js/save.js`, the run-save shape, or `SAVE_VERSION`.
- Wants/scars/aging *content* — the fields exist in the record as empty
  defaults; filling them is HP-2/HP-8.

## Git workflow

- Branch: `advisor/010-campaign-store`
- Commits: one per step. Imperative messages ("Add the versioned campaign store").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `js/campaign.js`

New module, its own key, explicit `v` field and migration chain from day one.
Import `G` from `./state.js` directly (sim module — per AGENTS.md house
rules, not via the `game.js` barrel; also avoids an import cycle, since
`run-end.js` will import this module). The complete module:

```js
// The campaign store: cross-run persistence for the band, the campaign map,
// and unlocked options (GDD §3). Versioned from day one — every shape change
// bumps CAMPAIGN_VERSION and adds a MIGRATIONS entry plus a test (App A).
// Binding invariant (GDD P5, §9.1): this record carries history, never
// stats — no field here may modify any combat/economy number.
import { G } from './state.js';

const KEY = 'hearthfall.campaign';
export const CAMPAIGN_VERSION = 1;

// The only keys a band member may have. History, never stats: `age` counts
// settlements survived (display banding Green/Prime/Grey is HP-8's job);
// wants/scars are filled by HP-2/HP-8 and are zero-modifier by invariant.
export const BAND_MEMBER_FIELDS = ['id', 'name', 'trait', 'wants', 'scars', 'age'];

export function makeCampaign() {
  return {
    v: CAMPAIGN_VERSION,
    nextId: 1,        // campaign-scoped member ids (run ids reset per run)
    settlements: 0,   // ended runs recorded, win or fall
    band: [],         // [{ id, name, trait, wants: [], scars: [], age: 0 }]
    map: { sites: [], litBeacons: [], ruins: [] },
    unlocks: [],      // permanent option ids (structures/creeds/archetypes) — never modifiers
    chronicle: [],    // [{ kind: 'ascension'|'fall', settlement, day, survivors, cast }]
  };
}

// v -> v+1 upgraders; each future shape change adds one entry and a test.
const MIGRATIONS = {
  // 1: (d) => { ...; return d; },
};

export function migrateCampaign(d) {
  if (!d || typeof d !== 'object' || typeof d.v !== 'number') return makeCampaign();
  if (d.v > CAMPAIGN_VERSION) {
    // A future store under older code: never guess, never destroy silently.
    try { localStorage.setItem(`${KEY}.bak-v${d.v}`, JSON.stringify(d)); } catch (e) { /* ignore */ }
    return makeCampaign();
  }
  while (d.v < CAMPAIGN_VERSION) {
    const step = MIGRATIONS[d.v];
    if (!step) return makeCampaign(); // broken chain — should be unreachable
    d = step(d);
    d.v++;
  }
  // Same-version key additions still backfill (the plan-004 Step 4 lesson).
  const base = makeCampaign();
  return { ...base, ...d, map: { ...base.map, ...(d.map || {}) } };
}

export function loadCampaign() {
  try { return migrateCampaign(JSON.parse(localStorage.getItem(KEY))); }
  catch (e) { return makeCampaign(); }
}

export const CAMPAIGN = loadCampaign();

export function saveCampaign() {
  try { localStorage.setItem(KEY, JSON.stringify(CAMPAIGN)); } catch (e) { /* private mode etc. */ }
}

function toBandMember(s) {
  return { id: CAMPAIGN.nextId++, name: s.name, trait: s.trait, wants: [], scars: [], age: 0 };
}

// Called by run-end.js BEFORE clearSave(): the ending must reach the campaign
// before the run save is destroyed (GDD §10 ordering requirement). At HP-1
// scope a fall has no survivors; HP-7's Torch ending passes an explicit list.
// Must never throw — a campaign-write failure must not leave the dead run's
// save restorable.
export function writeRunToCampaign({ win, survivors }) {
  const out = survivors ?? (win ? G.settlers : []);
  CAMPAIGN.settlements++;
  const n = CAMPAIGN.settlements;
  const names = out.map(s => s.name);
  for (const s of out) CAMPAIGN.band.push(toBandMember(s));
  if (win) CAMPAIGN.map.litBeacons.push({ settlement: n, day: G.day, site: null });
  else CAMPAIGN.map.ruins.push({ settlement: n, day: G.day, cast: [...G.usedNames] });
  CAMPAIGN.chronicle.push({ kind: win ? 'ascension' : 'fall', settlement: n, day: G.day, survivors: names, cast: [...G.usedNames] });
  saveCampaign();
}
```

Design notes the executor should preserve, not "improve":
- `litBeacons` entries carry `site: null` until HP-8's campaign map gives
  sites identity — lit Beacons are *permanent light* (`GDD.md:208-211`) and
  must accumulate even before the map exists to draw them.
- `ruins` capture the fallen run's full cast from `G.usedNames`
  (`js/state.js:23`) — graves for the your-ruins site (`GDD.md:211-213`).
- `chronicle` is deliberately a stub (append-only history; no reader yet).
- No field stores hp, points, modifiers, or anything from `G.stats`/`G.mods`.

**Verify**: `pnpm check && pnpm lint` → both exit 0.

### Step 2: `test/campaign.test.js` — store characterization

Create with the stub-then-import header (copy `test/meta.test.js:1-9`), but
give the localStorage stub an **operation log** — Step 3's ordering test
needs it:

```js
const store = {};
const ops = [];
vi.stubGlobal('localStorage', {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { ops.push(['set', k]); store[k] = v; },
  removeItem: (k) => { ops.push(['remove', k]); delete store[k]; },
});
vi.stubGlobal('performance', { now: () => 1000 });

const { CAMPAIGN, CAMPAIGN_VERSION, BAND_MEMBER_FIELDS, makeCampaign, migrateCampaign, loadCampaign, saveCampaign, writeRunToCampaign } = await import('../js/campaign.js');
const { G, makeState } = await import('../js/state.js');
```

Reset helper for `beforeEach` (mutate in place — other modules hold the same
reference): `function resetCampaign() { Object.assign(CAMPAIGN, makeCampaign()); }`
plus `ops.length = 0;` and `Object.assign(G, makeState());`.

Tests to write:

1. **Fresh default**: empty store → `loadCampaign()` deep-equals
   `makeCampaign()`; `v === CAMPAIGN_VERSION === 1`.
2. **Round-trip**: mutate `CAMPAIGN` (push a band member built from
   `{ id: 9, name: 'Ash', trait: 'brave', wants: [], scars: [], age: 1 }`,
   a `litBeacons` entry, an `unlocks` string, bump `nextId`/`settlements`),
   `saveCampaign()`, then `loadCampaign()` → returned record deep-equals
   `CAMPAIGN`.
3. **Missing/corrupt store**: `store['hearthfall.campaign'] = '{not json'`
   → `loadCampaign()` equals fresh default; same for `'null'`, `'42'`, and
   a valid object **without `v`** (`JSON.stringify({ band: [] })`) — a
   versionless record is untrusted and starts fresh.
4. **Future version backs up, never destroys**: store a record with
   `v: CAMPAIGN_VERSION + 1` and a marker field → `loadCampaign()` is a
   fresh default AND `store['hearthfall.campaign.bak-v2']` contains the
   marker.
5. **Same-version backfill**: store a valid `v: 1` record with `unlocks`
   and `map.ruins` deleted → `loadCampaign()` restores both as `[]` while
   preserving the record's `band`.
6. **P5 review gate (shape whitelist)**: `G.settlers = [<one settler with
   extra run fields: hp, x, y, role, hunger...>]`, `G.usedNames = new
   Set(['Ash'])`, then `writeRunToCampaign({ win: true })` → the written
   member's `Object.keys(...).sort()` equals `[...BAND_MEMBER_FIELDS].sort()`
   — no run stat (`hp`, `role`, position) leaks into the campaign, ever.

**Verify**: `pnpm vitest run test/campaign.test.js` → all pass.

### Step 3: Wire `js/run-end.js` — survivors before `clearSave()`

Add `import { writeRunToCampaign } from './campaign.js';` and insert the
write between the `endRun` bookkeeping and `clearSave()` in **both** flows.
`communeFallen` becomes (the `communeAscended` edit is identical with
`{ win: true }`):

```js
  const r = endRun(G.stats, G.day, { win: false });
  G.legacyEarned = r.pts; G.bonusLines = r.bonuses;
  writeRunToCampaign({ win: false });
  clearSave();
```

Then add to `test/campaign.test.js` (same file, needs `run-end.js` and
`meta.js` for a META reset — copy `resetMeta` from `test/meta.test.js:15-19`):

1. **Ascension writes survivors**: two settlers (one `away: true` — an
   expedition member is alive and walks out; one `downed: true` — down is
   not dead), `G.usedNames` seeded, `G.day = 12`, `G.tiles = []` is fine
   (nothing here touches tiles) → `communeAscended()` → `CAMPAIGN.band`
   has 2 members with campaign ids 1 and 2, `CAMPAIGN.map.litBeacons`
   is `[{ settlement: 1, day: 12, site: null }]`, chronicle has one
   `'ascension'` entry listing both names.
2. **Ordering guarantee**: in that same test, assert
   `ops.findIndex(([op, k]) => op === 'set' && k === 'hearthfall.campaign')`
   is `>= 0` **and strictly less than**
   `ops.findIndex(([op, k]) => op === 'remove' && k === 'hearthfall.save')`.
   This is the plan's reason to exist; it must be a hard assertion, not a
   comment.
3. **Fall writes a ruin, no survivors**: `G.settlers = []` (falls only fire
   on an empty commune — see call sites above), `usedNames` seeded →
   `communeFallen()` → `band` unchanged, `map.ruins` has one entry whose
   `cast` matches the seeded names, chronicle entry `kind === 'fall'` with
   `survivors: []`.
4. **Idempotence**: calling `communeAscended()` twice writes **one**
   chronicle entry, one beacon, and each survivor once (the `G.gameOver`
   guard at `js/run-end.js:7` is what protects the campaign from
   double-writes — this test pins that).

**Verify**: `pnpm test` → entire suite green. Pay attention to
`test/meta.test.js`'s run-end idempotence tests (`test/meta.test.js:96-129`):
they now transitively write campaign records into that file's own stub store.
They assert nothing about the campaign and must pass **unmodified** — if they
fail, the wiring changed observable ending behavior; STOP.

### Step 4: Version `META` (stamp, don't reshape)

In `js/meta.js`: add `const META_VERSION = 1;` beside `KEY`, add
`version: META_VERSION` as the **first field** of both returned records in
`load()` (`js/meta.js:13-17` and `js/meta.js:20`) — every pre-versioned meta
in the wild is shape-identical to v1, so stamping is the entire migration.
Add a comment on the stamp line: when `META_VERSION` first bumps, `load()`
must grow a migration chain like `js/campaign.js`'s — the stamp is only
valid while v1 is the only shape that ever existed. `saveMeta()` needs no
change (it serializes the whole record). Do **not** touch scoring, perks, or
`life` — and do not move perks into the campaign store (HP-8's decision).

Add to `test/meta.test.js` — in this file the store is empty at import time,
so to prove legacy stamping, seed the key **above** the existing dynamic
import (`test/meta.test.js:11`):

```js
store['hearthfall.meta'] = JSON.stringify({ points: 7, owned: ['larder'], runs: 2 });
```

then a new describe with two tests (no `resetMeta` needed; nothing resets
`version`):

1. **Legacy meta is stamped**: `META.version === 1` (the seeded record had
   no version; `load()` stamped it) — and the seed must not break the
   existing tests, which all `resetMeta()` in `beforeEach` (the fields the
   seed sets are all reset; verify the full file still passes).
2. **Version persists**: `saveMeta()` →
   `JSON.parse(store['hearthfall.meta']).version === 1`.

Also update `resetMeta` (`test/meta.test.js:15-19`)? **No** — leave it;
`version` is not per-test state.

**Verify**: `pnpm vitest run test/meta.test.js` → all pass (old and new);
then `pnpm check && pnpm lint && pnpm test` → all green.

### Step 5: Documentation touch

Two one-line edits so the persistence story stays true:

- `README.md:133` — extend the code-map line:
  ``- `js/save.js` — versioned save/load + migration · `js/meta.js` — legacy points/perks (persistent) · `js/campaign.js` — the campaign store (cross-run band/map/unlocks, versioned)``
- `AGENTS.md:23` — the architecture paragraph's last sentence gains the new
  key: "…per-run state in `js/save.js`, cross-run legacy in `js/meta.js`,
  and the cross-run campaign (band, map, unlocks) in `js/campaign.js`."
  And `AGENTS.md:27` — after the `SAVE_VERSION` sentence add: "When the
  campaign shape changes, bump `CAMPAIGN_VERSION` and add a `MIGRATIONS`
  entry plus a migration test."

**Verify**: `pnpm lint` (markdown untouched by eslint, but cheap) and a
manual re-read of both edits for accuracy.

### Step 6: Update `plans/README.md`

The execution-order table already carries this plan's row
(`| 010 | The campaign store: versioned cross-run persistence | HP-1 | P1 | M-L | — | TODO |`).
Set its Status to DONE (or BLOCKED with a one-line reason if a STOP condition
ended the run). If the row is somehow absent, add it in that exact shape.

**Verify**: `git diff plans/README.md` shows only the status-cell edit.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/campaign.test.js`
~10 tests (6 store + 4 wiring/ordering), `test/meta.test.js` +2 version
tests, everything else untouched and green.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/campaign.js` exists; `test/campaign.test.js` exists with the
      ordering assertion (`set hearthfall.campaign` strictly before
      `remove hearthfall.save`)
- [ ] `grep -n "writeRunToCampaign" js/run-end.js` shows the call **above**
      `clearSave()` in both `communeFallen` and `communeAscended`
- [ ] `grep -n "version" js/meta.js` shows `META_VERSION` and the stamp in
      both `load()` return paths
- [ ] `grep -rn "hearthfall.campaign" js/` matches only `js/campaign.js`
      (single owner of the key)
- [ ] No band-member field outside `BAND_MEMBER_FIELDS`; nothing from
      `G.stats`/`G.mods`/`hp` in the campaign record (P5 gate test passing)
- [ ] `git status` shows only the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

- `js/run-end.js` no longer matches the excerpt (drift) — especially if
  something already writes between `endRun` and `clearSave()`, or the
  `G.gameOver` guard moved: re-derive the splice point, and if survivors
  could now be written *after* the save is cleared, report before coding.
- Settlers already carry `wants`, `scars`, or `age` fields (HP-2 landed
  first): the store shape here still stands, but `toBandMember` must copy
  instead of defaulting them — report the overlap and get the order confirmed
  rather than guessing merge semantics.
- Any test in `test/meta.test.js` or `test/save.test.js` fails after Step 3
  or 4 — those characterize ending/persistence behavior this plan must not
  change; report, do not adjust the old tests.
- You find yourself adding a numeric field to the campaign record that any
  sim code could read as a bonus (a "veteran" counter fed into combat, a
  carried weapon count, saved resources): that violates GDD P5/§9.1 —
  STOP, this is a design gate, not an implementation detail.
- `hearthfall.campaign` turns out to be in use (a stale experiment in some
  branch's localStorage is fine; code in `js/` claiming the key is not).

## Maintenance notes

- **Every future campaign-shape change**: bump `CAMPAIGN_VERSION`, add a
  `MIGRATIONS[from]` entry, add a migration test to `test/campaign.test.js`.
  The default-merge only covers *key additions within* a version.
- **HP-7 (endings)** extends `writeRunToCampaign({ win, survivors })` by
  passing the Torch's chosen survivor list — the parameter exists for it.
  **HP-3 (arrivals)** and **HP-8 (wagon camp/aging/site draft)** are the
  first *readers* of `CAMPAIGN`; until then the store is write-only by
  design, not by accident.
- **META's stamp** is a placeholder migration: the first real `META` shape
  change must convert `load()`'s stamp into a chain (the comment added in
  Step 4 marks the spot). Perk migration into the campaign store is
  explicitly deferred to HP-8's design.
- The `.bak-v{n}` backup key is written only on downgrade collisions; it is
  never read by code — it exists so a bug report can recover a player's
  campaign by hand.
