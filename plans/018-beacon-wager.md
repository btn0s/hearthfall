# Plan 018: The Beacon as a priced, previewed wager (HP-9) — the three exam nights become a committed bet the player reads before lighting

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` (Step 8).
>
> **Execution model (read first)**: plans run **sequentially, on `main`, in
> numeric order** — no branches, each plan ends in a green checkpoint. By the
> time this plan executes, **009–017 have landed**: 009 split `screens.js`
> into `js/ui/` modules (the Beacon modal now lives in `js/ui/modals.js`, not
> `js/screens.js`); **011 shipped `js/menace.js`** (Menace ledger +
> `menaceCeiling` + capacity-scouted `raidEstimate`) and bumped
> `SAVE_VERSION`; 010 shipped the versioned campaign store (`js/campaign.js`);
> **015 shipped the sapper** (a new `RAIDER_TYPES` archetype). All code
> excerpts below are anchored at **`14fd915`** (this plan's authoring commit),
> which is *before* 009–017 — so line numbers will have moved. **Re-locate
> every cited symbol by name**, and if an excerpt's shape changed, re-read the
> file before editing.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/forecasts.js js/raiders.js js/game.js js/menace.js js/campaign.js js/balance.js js/state.js js/save.js js/data.js js/ui/ js/screens.js test/`
> If `js/menace.js` does **not** exist, STOP — plan 011 has not landed and
> this plan's budget source (`menaceCeiling`, `G.menace.value`) is missing.
> If `js/campaign.js` does not exist, STOP — plan 010 (the first-attempt
> fact) has not landed. If `js/forecasts.js`'s `raidEstimate` is still the
> day-count formula (not a `scoutRaid` wrapper), STOP — 011 is not in.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (splices the live raid-spawn path; adds save + campaign-store
  shape; new tuning surface). No new combat modality — only a scheduling and
  composition layer over archetypes that already exist.
- **Depends on**:
  - **011 (HP-5, Menace + scouting report)** — provides `js/menace.js`:
    `menaceCeiling(m)` and `G.menace.value`. **Exam-night budgets come from
    that Menace/scout model** (a scheduled peak over the ceiling, the way
    hordes pierce it — read `plans/011-menace-scouting.md`, Design §"Scouting
    side" and §"scoutRaid").
  - **010 (HP-1, the campaign store)** — provides `js/campaign.js`: `CAMPAIGN`
    / `saveCampaign`. The **first-ever Beacon attempt** is a campaign-store
    fact (read `plans/010-campaign-store.md`); this plan adds a
    `beaconAttempts` counter to the store under its versioning discipline.
- **Category**: feature
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP-9 (`ROADMAP.md:123`, Milestone HP0) · GDD §2 P4
  (`GDD.md:111-127`), §9 invariant 4 (`GDD.md:351-352`)

## Why this matters

Today the Beacon "exam" has no exam. `igniteBeacon()` (`js/game.js:184-194`)
stamps `G.beaconDay`, pulls the next raid one day closer
(`G.raidNext = Math.min(G.raidNext, G.day + BALANCE.beacon.raidPullDays)`),
and adds a flat `+2` to raid size (`R.beaconBonus`, applied in
`raidEstimate`). Ascension fires at dawn when `G.day >= G.beaconDay + 3`
(`js/game.js:113`). But nothing forces three nights — raid cadence is a 2–4
day cooldown (`js/game.js:295`, `BALANCE.raid.cooldownMin/Max`), longer than
the hold — so a lucky lighting can be held against **one** scouted raid. The
"3 escalating exam nights" GDD §2 P4 promises is fiction, not code.

GDD §2 P4 (`GDD.md:111-127`) makes the Beacon the game's USP not through
scheduling (Valheim altars et al. prove self-scheduled exams are common and
degenerate) but through **pricing the delay as a contested, legible wager**.
Its binding composition invariants, restated as §9 invariant 4
(`GDD.md:351-352`):

> 4. A fixed minimum share of every exam night is concealed (no pre-solved
>    Beacon); first-attempt concealment draws only from taught vectors.

So HP-9 turns the three nights into a **priced, previewed bet the player
commits to when they light**:

- **Previewed at dawn**: each night's total budget and its *revealed*
  composition are shown (at ignite for the whole three-night wager, and again
  each dawn for that night). The player lights knowing the shape of what
  comes.
- **A fixed minimum concealed share** of every night's budget stays hidden
  (a binding `BALANCE` number, large enough that readiness can't be
  pre-solved). The falsifier P4 names — "one optimal lighting day" — dies
  because the wager is never fully solvable.
- **First-attempt fairness**: on a band's *first-ever* Beacon attempt
  (a campaign-store fact), the concealed elements are variations of **vectors
  the run already taught** — archetypes actually faced this run — never novel
  modalities. Cruelty is what Trials are for (P4). The other falsifier —
  "first-Beacon losses dominated by never-seen mechanics" — dies with it.

## Current state

All excerpts anchored at `14fd915` (this plan's commit) — **009–017 have
moved them; re-locate by symbol name.** Vanilla-JS browser game; vitest; all
tuning in `js/balance.js`; conventions in `AGENTS.md` (per-minute scan
caches, `G` singleton, versioned saves, sim modules import directly, view
modules import through the `game.js` barrel, both renderers show the same
info).

### The Beacon loop being reshaped

- **Ignite** — `js/game.js:184-194`:
  ```js
  export function igniteBeacon() {
    if (G.beaconDay) return false;
    if (!G.tiles.some(tl => tl.t === 'beacon')) { notice('Build the Beacon first'); return false; }
    G.beaconDay = G.day;
    bumpMorale(BALANCE.morale.beaconLit, 'the Beacon lit');
    G.raidNext = Math.min(G.raidNext, G.day + BALANCE.beacon.raidPullDays);
    addLog('☼ THE BEACON IS LIT! Every eye for miles turns this way.', '#ffe060');
    addLog('Raids intensify (+2) — hold the commune 3 days for victory.', '#ffe060');
    tip('beacon');
    return true;
  }
  ```
  (Plan 011 wired `bumpMenace(BALANCE.menace.beaconLit, 'THE BEACON BURNS')`
  in here too — leave that; it is the Menace event, orthogonal to the exam.)
- **Ascension gate** — `js/game.js:113` (inside `communeDawn`):
  `if (G.beaconDay && G.day >= G.beaconDay + BALANCE.beacon.holdDays) { communeAscended(); return; }`
  ⇒ nights fall on days `beaconDay + 0/1/2`; dawn of `beaconDay + 3` ascends.
  **Exactly three exam nights**, one per hold day.
- **Dawn** — `communeDawn()` (`js/game.js:109`) is the dawn reckoning (a log
  today). Plan 011 may have relocated the dawn pipeline into `js/dawn.js`
  (`onDawn`); re-locate by symbol — the exam preview attaches wherever the
  per-day dawn events fire, after the ascension gate.
- **Raid trigger** — `js/game.js:271`:
  `if (G.min === BALANCE.time.raidSpawnMinute && (G.day >= G.raidNext || isHordeDay(G.day)) && !G.raidActive) spawnRaid();`
  ⇒ **the hole**: nothing here forces a raid on each hold day. This plan adds
  `examNightFor(G.day)` as a third trigger so every exam night lands a raid.
- **Raid resolve** — `js/game.js:295`:
  `G.raidNext = G.day + rint(BALANCE.raid.cooldownMin, BALANCE.raid.cooldownMax) + ...` — the cooldown that today can swallow two of the three nights.

### The raid size + composition path (011-rewritten)

- `raidEstimate(day = G.day)` (`js/forecasts.js:7-19` at `14fd915`; **after
  011 it is a thin wrapper over `scoutRaid`** returning
  `{ n, horde, strength, ceiling, floorN }`). Consumers read `n`/`horde`:
  `tonightInfo()` (`js/forecasts.js:21-36`), the sidebar, the party modal,
  the Beacon modal. This plan **prepends an exam branch** and widens the
  return with exam fields — a superset, so those consumers stay untouched.
- `spawnRaid()` (`js/raiders.js:208-254`):
  ```js
  const est = raidEstimate(G.day);
  const horde = est.horde;
  let n = est.n - (horde ? 1 : 0) + rint(0, BALANCE.raid.jitterMax);
  ...
  const types = raidComposition(spots.length, horde);
  spots.forEach((p, i) => G.raiders.push(makeRaider(p.x, p.y, types[i] || 'raider')));
  if (horde) { const w = makeRaider(...); w.name = choice(WARLORD_NAMES); G.raiders.push(w); G.raidIsHorde = true; }
  ```
  The comment at `:209` — "sizing lives in raidEstimate so the sidebar
  forecast can't drift from truth" — is the rule this plan keeps: the exam
  budget flows through `raidEstimate` so the preview and the spawn agree.
- `raidComposition(n, horde)` (`js/raiders.js:195-206`) — the per-raider
  archetype roll (brute/skirmisher/torcher gates by day). Exam nights
  **bypass** it: their types are pre-drawn at ignite.
- `makeRaider(x, y, type)` (`js/raiders.js:25-28`) — the single choke point
  where every raider comes into being; **this is where a faced archetype is
  recorded as a taught vector** (Step 4).
- `RAIDER_TYPES` (`js/data.js:135-141` at `14fd915`; **015 added `sapper`**) —
  the archetype table. Exam draws pull from its keys minus `warlord`
  (the warlord is placed deliberately, not rolled).

### Menace budget source (011)

`js/menace.js` (shipped by 011) exports the pure `menaceCeiling(m) =
R.sizeBase + Math.floor(Math.max(0, m) / M.ceilDiv)` and the state seeds
`G.menace = { value, ledger }`. Exam-night budgets are a **scheduled peak
over the ceiling** — the same way 011's `scoutRaid` lets hordes pierce the
ceiling as "the Dark's scheduled exception, not a scouted party". Re-locate
`menaceCeiling` by name; if 011 renamed it, adapt.

### The campaign first-attempt fact (010)

`js/campaign.js` exports `CAMPAIGN` (the versioned store), `makeCampaign()`,
`migrateCampaign(d)`, `MIGRATIONS`, `CAMPAIGN_VERSION`, `saveCampaign()`.
Its discipline (plan 010 maintenance note): **every campaign-shape change
bumps `CAMPAIGN_VERSION`, adds a `MIGRATIONS` entry, and adds a migration
test.** A count of Beacon attempts is *history, not stats* (zero-modifier),
so it is P5-safe (`GDD.md:129-147`). The store records `litBeacons` only on
ascension and `ruins` only on falls (`writeRunToCampaign`, plan 010 Step 1) —
**neither counts a lit-but-lost attempt**, so "first-ever attempt" needs its
own counter incremented at ignite, not derived from `litBeacons`.

### State, save, sidebar, modal

- `makeState()` (`js/state.js:4-25`) — `beaconDay: 0` at `:17`;
  `usedNames: new Set()` at `:23` is the Set-in-state / array-in-save
  precedent this plan copies for `taughtVectors`.
- `js/save.js` — `SAVE_VERSION` (`:7`; **011 bumped it**); `toSaveData`
  destructure+object (`:12-29`) lists `beaconDay` — `beaconExam`/
  `taughtVectors` join it; `migrate` (`:31-65`) rehydrates `usedNames` as a
  Set at `:63` — the pattern for `taughtVectors`. House rule: save-shape
  change ⇒ bump `SAVE_VERSION`, extend `migrate`, add a migration test.
- Beacon modal — `makeBeaconModal()` (`js/screens.js:869-891` at `14fd915`;
  **009 moved it to `js/ui/modals.js`**). Its `drawChrome` already prints the
  wager terms ("Every eye for miles…", "raids hit harder (+2)"); the
  three-night preview goes here. Ignite happens on the "Ignite the Beacon"
  item calling `igniteBeacon()`.
- Sidebar Beacon line — `js/screens.js:484-488` (`☼ BEACON — hold Nd more` /
  `☼ BEACON ready — click to light`); the coming night's budget is appended
  here. `sidebarLayout()` reserves the Beacon row via `if (G.beaconDay) y++`
  (`js/screens.js:199`) — no new fixed row needed.

### The test net

- `test/raid-path.test.js` — `describe('raidEstimate')` and
  `describe('spawnRaid')` (**011 rewrote the `raidEstimate` block**); the
  stub-then-import header (`:1-17`) and the `grassTiles()`/`tile()` helpers
  (`:19-25`) are copied into the new file.
- `test/balance.test.js` — key-presence assertions; gains the beacon-exam
  keys and the concealed-share floor.
- `test/campaign.test.js` (010) / `test/save.test.js` — migration-test shapes
  to extend.

## Design (decided here, executed below)

### New module `js/beacon.js`

Imports: `state.js`, `balance.js`, `data.js`, `menace.js`, `campaign.js`,
`rng.js` — **cycle-safe** (none of those import `beacon.js`; the consumers
that do — `game.js`, `raiders.js`, `forecasts.js` — are not imported *by*
`beacon.js`). Exports the pure/impure split below.

**Pure exam math (no `G` reads — unit-testable):**

```js
// The archetypes a raid can field, minus the warlord (placed, not rolled).
// Sourced from RAIDER_TYPES so 015's sapper — and any future archetype —
// joins the pool automatically. Slinger et al. (GDD §6, vLater) are absent
// from RAIDER_TYPES, so first-attempt taught-only exclusion of them is free.
export function examPool() {
  return Object.keys(RAIDER_TYPES).filter(t => t !== 'warlord');
}

// Night budget: a scheduled peak over the Menace ceiling, escalating night to
// night (GDD "three escalating nights"). Strictly increasing because
// examNightBonus is strictly increasing and menaceCeiling(m) is fixed across
// the three nights (evaluated once, at ignite).
export function examBudget(menace, nightIdx) {
  return menaceCeiling(menace) + BALANCE.beacon.examNightBonus[nightIdx];
}

// Split a night's budget into revealed (previewed) and concealed (hidden)
// counts. concealedShareMin is the binding minimum share (GDD §9 inv 4);
// ceil guarantees concealed >= 1 for any budget >= 1 and concealed/budget >=
// concealedShareMin always.
export function concealedCount(budget) {
  return Math.max(1, Math.ceil(budget * BALANCE.beacon.concealedShareMin));
}
```

**Draw a single night** (uses module RNG — stub in tests like
`raid-path.test.js`):

```js
// firstAttempt === true  ⇒ concealed elements may ONLY be vectors already
//   taught this run (variations of what the run showed you — GDD §9 inv 4).
//   Fallback ['raider'] never fires in practice (raiders are faced in the
//   day-1 raid) but keeps the draw total; documented, tested.
// firstAttempt === false ⇒ concealed may draw the full pool (later attempts
//   are allowed the meaner surprise; still bounded by shipped archetypes).
export function drawExamNight(budget, nightIdx, taught, firstAttempt) {
  const pool = examPool();
  const cN = concealedCount(budget);
  const rN = budget - cN;
  const B = BALANCE.beacon;

  const revealedTypes = [];
  for (let i = 0; i < rN; i++) revealedTypes.push(pickWeighted(pool, nightIdx));
  // The final night is crowned by a NAMED warlord — announced, so it counts
  // as revealed (it is previewed, it is not the concealment).
  if (nightIdx === B.examWarlordNight && rN > 0) revealedTypes[0] = 'warlord';

  const cSource = firstAttempt ? pool.filter(t => taught.has(t)) : pool;
  const draw = cSource.length ? cSource : ['raider'];
  const concealedTypes = [];
  for (let i = 0; i < cN; i++) concealedTypes.push(pickWeighted(draw, nightIdx));

  return { budget, revealedTypes, concealedTypes };
}
```

`pickWeighted(pool, nightIdx)` is a small local helper: later nights weight
away from plain `raider` toward `brute`/`torcher`/`sapper` (escalation
flavor). Its exact weights are **not** asserted by any test — only budgets,
shares, taught-subset, and preview-matches-spawn are contracts. Keep it a
handful of lines; small integers only (GDD invariant 8).

**Build the whole wager** (pure over its args):

```js
export function buildBeaconExam(menace, taught, firstAttempt, litDay) {
  const nights = [];
  for (let k = 0; k < BALANCE.beacon.holdDays; k++) {
    const n = drawExamNight(examBudget(menace, k), k, taught, firstAttempt);
    nights.push({ day: litDay + k, ...n });
  }
  return { litDay, firstAttempt, nights };
}
```

**Lookup + preview (read `G`):**

```js
// The exam night whose dusk falls on `day`, or null. Drives both the spawn
// path and the forecast, so preview and spawn cannot drift.
export function examNightFor(day) {
  const ex = G.beaconExam;
  if (!ex) return null;
  const idx = day - ex.litDay;
  return (idx >= 0 && idx < ex.nights.length) ? ex.nights[idx] : null;
}

// Counts-only projection for the pre-ignite modal: budgets and concealed
// COUNTS are deterministic from menace + BALANCE (no RNG, no draw), so the
// player can price the wager before committing — the concealed TYPES stay
// unknown by design.
export function beaconExamPreview(menace) {
  return BALANCE.beacon.examNightBonus.map((_, k) => {
    const budget = examBudget(menace, k);
    const concealed = concealedCount(budget);
    return { budget, revealed: budget - concealed, concealed,
             warlord: k === BALANCE.beacon.examWarlordNight };
  });
}
```

### State

`makeState()` gains (after `beaconDay: 0`, `js/state.js:17`):

```js
beaconExam: null,              // { litDay, firstAttempt, nights: [{ day, budget, revealedTypes, concealedTypes }] }
taughtVectors: new Set(),      // archetype ids faced this run (Set in state, array in save — like usedNames)
```

All exam data is drawn once, at ignite, and frozen — the wager is what you
committed to, not a re-roll each night.

### `raidEstimate` gains an exam branch (`js/forecasts.js`)

Prepend, before the `scoutRaid` delegation:

```js
const exam = examNightFor(day);
if (exam) {
  const concealed = exam.concealedTypes.length;
  return {
    n: exam.budget,
    horde: exam.revealedTypes.includes('warlord'),
    exam: true, budget: exam.budget,
    revealedN: exam.revealedTypes.length, concealedN: concealed,
    // NOTE: concealed TYPES are deliberately NOT exposed — the preview shows
    // counts only. spawnRaid reads the frozen G.beaconExam directly.
  };
}
```

A superset of `{ n, horde }` — `tonightInfo`, the sidebar, the party modal
are untouched. The concealed *types* never leave `G.beaconExam`.

### `spawnRaid` uses the frozen composition on exam nights (`js/raiders.js`)

Minimal splice — compute `est` as today, then:

```js
const exam = examNightFor(G.day);
let comp = exam ? [...exam.revealedTypes, ...exam.concealedTypes] : null;
const hasWarlord = !!comp && comp.includes('warlord');
if (hasWarlord) comp = comp.filter(t => t !== 'warlord'); // warlord spawns separately, as for hordes
const horde = est.horde || hasWarlord;
let n = exam ? comp.length : est.n - (est.horde ? 1 : 0) + rint(0, BALANCE.raid.jitterMax);
```

then, where types are chosen:

```js
const types = exam ? comp : raidComposition(spots.length, horde);
```

The existing `if (horde) { ...makeRaider('warlord')...; G.raidIsHorde = true }`
block spawns the crowning warlord on the final night (reuse it; no new code).
Exam nights keep the two-front / positioning / timer machinery — the final
night reads as a horde-scale assault, which is exactly the escalation. No
`beaconBonus` double-count: exam nights bypass `scoutRaid` entirely, so
`R.beaconBonus` no longer applies during the hold (it stays in the table as
011 left it; note in a comment that HP-9 supersedes it on exam nights).

### Force a raid every exam night (`js/game.js`)

Add `examNightFor(G.day)` to the spawn trigger so the cooldown can't swallow
a night:

```js
if (G.min === BALANCE.time.raidSpawnMinute
    && (G.day >= G.raidNext || isHordeDay(G.day) || examNightFor(G.day))
    && !G.raidActive) spawnRaid();
```

### Ignite wiring (`js/game.js:igniteBeacon`)

After `G.beaconDay = G.day` (keep 011's `bumpMenace` line as-is):

```js
const firstAttempt = CAMPAIGN.beaconAttempts === 0;
G.beaconExam = buildBeaconExam(G.menace.value, new Set(G.taughtVectors), firstAttempt, G.day);
CAMPAIGN.beaconAttempts++;
saveCampaign();
```

The taught set is **snapshotted at ignite** — exam spawns that later teach
new vectors cannot retro-widen a first-attempt concealment. Import
`buildBeaconExam` from `./beacon.js`; `CAMPAIGN`, `saveCampaign` from
`./campaign.js` (sim modules import directly — house rule).

### Taught-vector tracking

In `makeRaider` (`js/raiders.js:25-28`) — the one choke point — add
`G.taughtVectors.add(type);`. Every archetype that ever spawns is thereby
recorded as faced. `warlord` is recorded too (harmless; it is never drawn
from `examPool`).

### Campaign store: `beaconAttempts` (versioned)

`makeCampaign()` gains `beaconAttempts: 0`. Bump `CAMPAIGN_VERSION` from 1 to
2 and add `MIGRATIONS[1] = (d) => { d.beaconAttempts = d.beaconAttempts || 0; return d; }`
per the store's discipline (plan 010 maintenance note). (The same-version
`{...base, ...d}` backfill would also cover it, but the house rule is an
explicit bump + migration test for any shape change — follow it.)

### BALANCE additions (`js/balance.js` beacon block, `:186-190`)

```js
beacon: {
  holdDays: 3,
  raidPullDays: 1,
  banditQuietDays: 5,
  examNightBonus: [1, 3, 6],   // escalating peak OVER menaceCeiling — night 1<2<3 (must be strictly increasing)
  concealedShareMin: 0.3,      // BINDING (GDD §9 inv 4): >=30% of every exam night's budget is concealed — large enough readiness can't pre-solve the Beacon
  examWarlordNight: 2,         // 0-indexed final night is crowned by a named warlord
},
```

`concealedShareMin = 0.3` is the binding number. Hand-check: a mid-game
ceiling of ~10 gives night budgets `{11, 13, 16}` and concealed
`ceil(0.3·b) = {4, 4, 5}` — a quarter-to-a-third of each night is a live
unknown, unsolvable by scouting, yet the revealed majority keeps the wager
readable (P7). Executor: re-derive against the shipped `menaceCeiling` before
trusting.

## Commands you will need

| Purpose   | Command                                | Expected on success |
|-----------|----------------------------------------|---------------------|
| Install   | `pnpm install`                         | exit 0              |
| Tests     | `pnpm test`                            | all pass            |
| One file  | `pnpm vitest run test/beacon.test.js`  | that file passes    |
| Typecheck | `pnpm check`                           | exit 0              |
| Lint      | `pnpm lint`                            | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137     | manual check, Step 6 |

Debug hooks: `window.G`, `window.ff(minutes)` (fast-forward) — see AGENTS.md.

## Scope

**In scope**:
- `js/beacon.js` (create), `test/beacon.test.js` (create)
- `js/balance.js` — the three `beacon` keys above
- `js/state.js` — `beaconExam`, `taughtVectors`
- `js/forecasts.js` — `raidEstimate` exam branch (contract-preserving superset)
- `js/raiders.js` — `spawnRaid` exam composition; `makeRaider` taught-vector record
- `js/game.js` — spawn-trigger `examNightFor` clause; `igniteBeacon` wiring;
  dawn exam preview log
- `js/campaign.js` — `beaconAttempts` + `CAMPAIGN_VERSION` bump + `MIGRATIONS[1]`
- `js/save.js` — `beaconExam`/`taughtVectors` persistence + `SAVE_VERSION` bump + migration
- `js/ui/modals.js` (the Beacon modal, post-009) — three-night wager preview;
  `js/screens.js` — one sidebar-line append (minimal UI)
- `test/balance.test.js`, `test/campaign.test.js`, `test/save.test.js`,
  `test/raid-path.test.js` — extend as specified
- `plans/README.md` — status row

**Out of scope** (do not touch):
- The Menace ledger / `scoutRaid` math (011) — this plan only *reads*
  `menaceCeiling`/`G.menace.value`; it does not retune them.
- Ascension/fall flow (`js/run-end.js`) — endings are HP-7 (plan 016);
  `beaconAttempts` is incremented at ignite, not at end.
- New archetypes / the slinger (GDD §6 vLater) — the pool is whatever
  `RAIDER_TYPES` already ships.
- `raidComposition`, jitter, two-front logic for *non-exam* raids.
- Trials scaling of the exam tables (GDD §8) — the tables are Trial-scaled
  later; this plan ships the v1 numbers and the invariant test that guards
  any retune.

## Git workflow

- **No branch** — this plan executes on `main` in sequence (execution model,
  top of file). Commit per step, imperative messages ("Add the Beacon exam
  module and BALANCE keys"). Each step's commit must leave
  `pnpm check && pnpm lint && pnpm test` green (the module is inert until
  Step 5 consumes it).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: BALANCE keys + the concealed-share floor test

Add the three `beacon` keys (Design section) to `js/balance.js`, each
commented in the file's terse style. Extend `test/balance.test.js` with a
`describe('BALANCE.beacon — exam wager')`:

1. Presence/type: `examNightBonus` is an array of `holdDays` integers;
   `concealedShareMin` is a number in `(0, 1)`; `examWarlordNight` is an
   integer in `[0, holdDays)`.
2. **Escalation**: `examNightBonus` is strictly increasing.
3. **Binding concealed floor (§9 inv 4)**: `concealedShareMin >= 0.25`
   (the "large enough readiness can't be pre-solved" threshold — comment it
   as the GDD invariant), and for a representative budget sweep `b` ∈
   `[BALANCE.raid.sizeBase .. 30]`, `Math.max(1, Math.ceil(b * concealedShareMin)) / b >= concealedShareMin`.

**Verify**: `pnpm vitest run test/balance.test.js` → pass;
`pnpm check && pnpm lint` → exit 0.

### Step 2: `js/beacon.js` + state

Create `js/beacon.js` exactly per the Design section (`examPool`,
`examBudget`, `concealedCount`, `pickWeighted`, `drawExamNight`,
`buildBeaconExam`, `examNightFor`, `beaconExamPreview`). Import
`menaceCeiling` from `./menace.js` **by name** — if 011 named it differently,
adapt and note it. JSDoc-annotate `drawExamNight`'s `taught` (a `Set<string>`)
and the returned night shape (`pnpm check` runs tsc over `js/`).

In `js/state.js`, add `beaconExam: null` and `taughtVectors: new Set()` to
`makeState()` after `beaconDay: 0`.

In `js/game.js`, add `export { examNightFor, beaconExamPreview } from './beacon.js';`
beside the other barrel re-exports (view modules import through the barrel).

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green (nothing
consumes the module yet; `makeState` gaining keys is additive).

### Step 3: `test/beacon.test.js` — pure-math unit + property tests

Create with the stub-then-import header from `test/raid-path.test.js:1-17`,
importing `state.js`, `balance.js`, `beacon.js`, `menace.js`. Copy
`grassTiles`/`tile`. `beforeEach`: `Object.assign(G, makeState()); G.tiles = grassTiles(); G.world = { locs: [] };`.
Stub `rng` (`vi.spyOn`) where a deterministic draw is needed.

1. **Budgets escalate off the ceiling**: for `menace` ∈ {0, 20, 80}, build
   with `buildBeaconExam(menace, new Set(['raider']), false, 5)` → three
   nights, `nights[k].budget === menaceCeiling(menace) + BALANCE.beacon.examNightBonus[k]`,
   and `budget[0] < budget[1] < budget[2]`; `nights[k].day === 5 + k`.
2. **Concealed-share invariant every night (§9 inv 4)**: sweep `menace`
   0..200 step 10 → for every night, `concealedTypes.length >= Math.max(1, Math.ceil(budget * concealedShareMin))`
   and `concealedTypes.length / budget >= BALANCE.beacon.concealedShareMin`,
   and `revealedTypes.length + concealedTypes.length === budget`.
3. **First-attempt concealment ⊆ taught (§9 inv 4)**: `taught = new Set(['raider', 'skirmisher'])`,
   `firstAttempt = true` → every element of every night's `concealedTypes`
   is in `taught`; explicitly assert `'brute'` (a non-taught vector) never
   appears in any `concealedTypes`. Then `firstAttempt = false` with the same
   `taught` and RNG forced to pick a non-taught type → a non-taught vector
   *can* appear concealed (later attempts are unrestricted).
4. **Taught fallback**: `taught = new Set()`, `firstAttempt = true` → every
   `concealedTypes` element is `'raider'` (the fallback), and the night still
   totals `budget`.
5. **Warlord crowns the final night only**: `nights[examWarlordNight].revealedTypes[0] === 'warlord'`
   (when `revealedN > 0`); no other night's types contain `'warlord'`.
6. **`examNightFor` maps days**: with `G.beaconExam = buildBeaconExam(50, new Set(['raider']), false, 10)`,
   `examNightFor(9) === null`, `examNightFor(10/11/12)` are the three nights,
   `examNightFor(13) === null`; with `G.beaconExam = null`, always `null`.
7. **`beaconExamPreview` counts match a built exam**: `beaconExamPreview(m)[k].budget === buildBeaconExam(m, ..., 5).nights[k].budget`
   and `.concealed === concealedCount(budget)` — the pre-ignite projection
   agrees with the drawn wager on budgets and counts (types differ by design).

**Verify**: `pnpm vitest run test/beacon.test.js` → pass.

### Step 4: taught-vector recording + campaign `beaconAttempts` + ignite wiring

1. `js/raiders.js` `makeRaider` — add `G.taughtVectors.add(type);`.
2. `js/campaign.js` — `makeCampaign()` gains `beaconAttempts: 0`; bump
   `CAMPAIGN_VERSION` 1→2; add `MIGRATIONS[1] = (d) => { d.beaconAttempts = d.beaconAttempts || 0; return d; };`.
   Add a `test/campaign.test.js` case: a stored `v: 1` record with no
   `beaconAttempts` loads (`loadCampaign`) as `v: 2` with `beaconAttempts === 0`,
   preserving its `band`.
3. `js/game.js` `igniteBeacon` — insert the ignite wiring (Design section)
   after `G.beaconDay = G.day`. Import `buildBeaconExam` from `./beacon.js`
   and `CAMPAIGN`, `saveCampaign` from `./campaign.js`.

Add to `test/beacon.test.js` (import `igniteBeacon` via `game.js`, and
`CAMPAIGN`/`makeCampaign` via `campaign.js`; reset `CAMPAIGN` in `beforeEach`
by `Object.assign(CAMPAIGN, makeCampaign())`; seed `G.menace = { value: 40, ledger: [] }`,
paint a `beacon` tile, seed `G.taughtVectors`):

- **Ignite builds the frozen wager**: `igniteBeacon()` → `G.beaconExam` has
  `holdDays` nights, `litDay === G.day`, `firstAttempt === true`, and
  `CAMPAIGN.beaconAttempts === 1`.
- **Second attempt is not first**: reset run state (`beaconDay = 0`,
  `beaconExam = null`), re-paint the beacon, `igniteBeacon()` again →
  `G.beaconExam.firstAttempt === false`, `CAMPAIGN.beaconAttempts === 2`.
- **Snapshot isolation**: with `firstAttempt` true and `taught = {'raider'}`
  at ignite, mutating `G.taughtVectors` afterward does not change the frozen
  `concealedTypes`.

**Verify**: `pnpm vitest run test/beacon.test.js test/campaign.test.js` →
pass; `pnpm test` → full suite green (no raid behavior consumed yet).

### Step 5: spawn integration + forecast + raid-path tests

1. `js/forecasts.js` — prepend the `examNightFor` branch to `raidEstimate`
   (Design section). Keep the `scoutRaid` delegation as the `else` path.
2. `js/raiders.js` `spawnRaid` — splice the exam composition (Design
   section): frozen types on exam nights, `raidComposition` otherwise; reuse
   the existing warlord branch for the final night.
3. `js/game.js` — add `examNightFor(G.day)` to the spawn trigger.

Extend `test/raid-path.test.js` (the `spawnRaid` block already stubs `rng`;
the `beforeEach` now seeds `G.menace` via `makeState()` from 011 — set
`G.menace = { value: 60, ledger: [] }` if the block needs a specific value):

1. **Forecast reflects the exam budget**: `G.beaconExam = buildBeaconExam(60, new Set(['raider']), false, G.day)`
   (import `buildBeaconExam`) → `raidEstimate(G.day)` returns
   `{ exam: true, n: budget0, revealedN, concealedN }` with
   `n === G.beaconExam.nights[0].budget` and **no `concealedTypes` leaked**
   (`expect(raidEstimate(G.day).concealedTypes).toBeUndefined()`).
2. **Spawn matches the preview's revealed portion**: on an exam night, with
   `rng` stubbed deterministic, `spawnRaid()` → every element of
   `nights[0].revealedTypes` appears among the spawned `G.raiders` types
   (warlord counted as a spawned `warlord` raider), and the total non-warlord
   raider count equals `revealedTypes(minus warlord).length + concealedTypes.length`.
   The concealed types are *present in the spawn* (they are real), just absent
   from the forecast — assert the spawned multiset equals
   `revealedTypes ∪ concealedTypes`.
3. **Every hold day forces a raid**: with `G.beaconExam` set and
   `G.raidNext` far in the future, the trigger condition
   `(G.day >= G.raidNext || isHordeDay(G.day) || examNightFor(G.day))` is true
   for each of the three hold days (assert `examNightFor(litDay + k)` truthy
   for k ∈ {0,1,2}, `null` for k = 3).
4. **Existing `spawnRaid` characterization still passes** (non-exam:
   `G.beaconExam === null` ⇒ the old scouted path, unchanged). If it fails,
   STOP — the splice changed non-exam behavior.

**Verify**: `pnpm test` → entire suite green.

### Step 6: dawn preview + ignite-modal wager + sidebar (minimal UI)

**Dawn preview** — in `communeDawn` (or the relocated `onDawn`), after the
ascension gate, if `examNightFor(G.day)` add a preview log:

```js
const ex = examNightFor(G.day);
if (ex) {
  const idx = G.day - G.beaconExam.litDay + 1;
  const shown = countTypes(ex.revealedTypes); // "3 raiders, 1 brute, a warlord"
  addLog(`☼ Exam night ${idx}/${BALANCE.beacon.holdDays} — ~${ex.budget} come: ${shown}; ${ex.concealedTypes.length} unseen.`, '#ffe060');
}
```

`countTypes` renders the revealed multiset using `RAIDER_TYPES[t].name`; the
concealed count is shown, the concealed types are not. This is the per-night
preview.

**Ignite modal** — in `makeBeaconModal` (post-009 `js/ui/modals.js`), add the
three-night wager to `drawChrome` using `beaconExamPreview(G.menace.value)`:
`Night k: ~budget (concealed C[, warlord])`. This is the priced, previewed
wager the player commits to. (The modal is pre-ignite, so use the
counts-only projection — no draw, no RNG.)

**Sidebar** — append the coming night's budget to the Beacon line
(`js/screens.js:484-488`): where it prints `☼ BEACON — hold Nd more`, when
`examNightFor(G.day)` exists, extend to `☼ BEACON hold Nd · tonight ~B (Cx?)`
using the forecast's `budget`/`concealedN` — clamp to `SB_W`. No new fixed
sidebar row (the Beacon row already exists via `js/screens.js:199`).

**Verify**:
- `pnpm check && pnpm lint && pnpm test` → all green.
- Manual (`pnpm dev`): build+light the Beacon → ignite modal lists three
  nights with budgets and concealed counts; each dawn logs that night's
  preview; `ff` to dusk → a raid lands every hold day; the revealed
  composition matches the dawn log; hold three → Ascension. Both renderers
  (pause → Graphics toggle) show the same sidebar Beacon line.

### Step 7: persistence (SAVE_VERSION bump + migration)

`js/save.js`:
- Bump `SAVE_VERSION` by one (011 set it to 2 ⇒ this is 3 unless an
  intervening plan bumped it — read the current value, add one).
- `toSaveData` — add `beaconExam` and `taughtVectors` to the destructure and
  the returned object; serialize `taughtVectors` as `[...taughtVectors]`
  (mirror `usedNames`, `js/save.js:26`).
- `migrate` — after the `usedNames` rehydrate (`js/save.js:63`), backfill
  additively (safe for every prior version):
  ```js
  if (!(d.taughtVectors instanceof Set)) d.taughtVectors = new Set(d.taughtVectors || []);
  if (d.beaconExam === undefined) d.beaconExam = null;
  ```
  A save written mid-hold under pre-HP-9 code has `beaconDay` set but
  `beaconExam === null`: on load the hold finishes with ordinary scouted
  raids (`examNightFor` returns `null`) — acceptable degradation for the rare
  cross-update in-flight hold; document it in a comment.

`test/save.test.js` — add: (a) a round-trip that a set `G.beaconExam` and a
non-empty `G.taughtVectors` survive `save()`/`loadGame()` (Set rehydrated);
(b) a prior-version migration in the shape of the existing version test —
raw JSON with the bumped-minus-one version and no `beaconExam`/
`taughtVectors` loads with `G.beaconExam === null` and
`G.taughtVectors instanceof Set` (empty).

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green.

### Step 8: `plans/README.md`

Add (or update, if a sibling batch already added the row) the execution-order
row:

```
| 018 | The Beacon as a priced, previewed wager | HP-9 | P1 | M | 011, 010 | DONE |
```

Under "Dependency notes", note that HP-9 consumes 011's `menaceCeiling` for
exam budgets and 010's campaign store for the first-attempt fact, and that
Trials (GDD §8) will later scale `BALANCE.beacon.examNightBonus`/
`concealedShareMin` — the Step 1 invariant test is the per-Trial guard.

**Verify**: `pnpm check && pnpm lint && pnpm test` all exit 0;
`git status` shows only in-scope files.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/beacon.test.js`
~13 tests (budgets/escalation, concealed-share invariant, first-attempt
subset + fallback, warlord placement, `examNightFor`, preview-parity, ignite
integration, snapshot isolation), `test/balance.test.js` +1 describe,
`test/campaign.test.js` +1 migration, `test/raid-path.test.js` +4 (forecast,
spawn-parity, forced-night, non-exam unchanged), `test/save.test.js` +2 — all
green alongside the existing suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/beacon.js` exists; `igniteBeacon` builds a frozen `G.beaconExam` of
      `holdDays` nights and increments `CAMPAIGN.beaconAttempts`
- [ ] **§9 inv 4 as assertions**: concealed share ≥ `concealedShareMin` every
      night, and first-attempt concealment ⊆ taught vectors — both are
      `expect(...)` tests, not comments
- [ ] Preview matches spawn for the revealed portion; concealed *types* never
      appear in `raidEstimate`'s return
- [ ] A raid is forced on each of the three hold days (`examNightFor` in the
      spawn trigger)
- [ ] Old `{ n, horde }` consumers (`tonightInfo`, sidebar, party modal)
      unchanged; non-exam `spawnRaid` characterization still green
- [ ] `SAVE_VERSION` bumped with a migration test; `CAMPAIGN_VERSION` bumped
      to 2 with a `MIGRATIONS[1]` migration test
- [ ] `plans/README.md` row added/updated

## STOP conditions

1. `js/menace.js` or `js/campaign.js` absent, or `raidEstimate` is not a
   `scoutRaid` wrapper — a dependency (011/010) has not landed; the drift
   check should have caught this. Report which.
2. `menaceCeiling` cannot be located by name in `js/menace.js` (011 renamed
   or restructured it) — the budget source is gone; report before improvising
   a substitute.
3. The Step 1 concealed-share floor test and a plausible `menaceCeiling`
   curve produce an exam night whose *revealed* portion is empty (all budget
   concealed) at realistic menace — the wager stopped being legible (P7);
   report the tension (a lower `concealedShareMin` or a budget floor is a
   design pass, not a silent retune).
4. Any test *outside* the blocks this plan rewrites fails after Step 5 —
   especially the non-exam `spawnRaid` characterization: the splice changed
   ordinary raids; STOP.
5. `RAIDER_TYPES` at execution time contains a genuinely novel *modality*
   (e.g. a ranged `slinger` — GDD §6 marks it vLater) — first-attempt
   taught-only exclusion still holds via the Set, but confirm the modality is
   answerable before letting it into non-first-attempt concealment; report.
6. An import cycle appears (`pnpm check`/Vite complains) — `beacon.js` is
   designed to import only {state, balance, data, menace, campaign, rng};
   if a hook forces more, stop rather than inverting a dependency.

## Maintenance notes

- **The concealed-share floor is a living constraint** (GDD §9 inv 4): any
  retune of `BALANCE.beacon` must keep the Step 1 assertion green — that is
  the point. Trials (GDD §8) scale `examNightBonus`/`concealedShareMin`; the
  test is the per-Trial check the GDD demands.
- **First-attempt fairness rides on `taughtVectors` truthfully tracking every
  faced archetype** — the single `makeRaider` hook is the tripwire; anything
  that spawns a raider outside `makeRaider` must also teach its vector.
- **`beaconAttempts` is history, never stats** (GDD P5/§9.1): it gates a
  *fairness* rule, modifies no combat/economy number. Do not let a future
  change read it as difficulty.
- **HP-7 (endings, plan 016)** writes real survivors/ruins at run end; it does
  not touch `beaconAttempts` (incremented at ignite). If HP-7 later wants to
  record *outcome* of an attempt, extend the store under the same versioning
  discipline.
- **Deferred deliberately**: the full previewed-nights UI (a proper wager
  panel with the strength breakdown) can grow once the `js/ui/` split (009)
  has room; the counts-only modal + dawn log ship the readable minimum now.
  Non-first-attempt escalation content (novel concealed modalities) waits on
  the slinger and Trials.
</content>
</invoke>
