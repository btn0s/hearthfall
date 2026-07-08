# Plan 022: Untangle the `js/game.js` re-export barrel (P1-6)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: this plan was written against the barrel as it
> stood at `14fd915`, but it is sequenced to run **after the whole HP0
> milestone (plans 009–021) has landed on main**, so the import graph will
> have grown — new `js/ui/*.js` files, new sim modules, new importers. Do
> **not** trust the file lists or line numbers below as a frozen inventory.
> They are *worked examples of the technique*, verified at the anchor commit.
> Before Step 1, **re-derive the real graph** with the commands in
> "Re-derive the graph (do this first)". Every excerpt in this plan is
> anchored by **symbol name**, not line number — re-locate each by grepping
> for the symbol, because line numbers here are stale by construction.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MEDIUM (mechanical, per-module import re-pointing with a
  typecheck net; the only real hazard is introducing a module-evaluation-time
  import cycle, which the per-step `node` import smoke catches)
- **Depends on**: 009 (the `js/screens.js` → `js/ui/` split — it moves the
  biggest barrel consumer into five new files and copies their `../game.js`
  imports *verbatim*, deferring this sweep to here; see plan 009 Step 6 note
  and its maintenance note "P1-6 should also sweep the new files' `../game.js`
  imports toward direct module imports"). Sequenced after all of 009–021.
- **Category**: tech-debt
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: P1-6

## Why this matters

`js/game.js` does two unrelated jobs. It is the **tick loop** — `tickGame`,
`communeDawn`, `elderCounsel`, the build/trade/objective mutators, the
`dmgCache`/`elderCache` per-minute caches (the file the AGENTS.md house rule
points at for "cache any full-map scan per game-minute"). It is *also* a
**barrel**: its first block is nothing but re-export lines that forward other
modules' symbols so consumers can pull everything through one import.

Verified at `14fd915`, that barrel is **47 symbols re-exported from 12
modules** (the roadmap's "~38" undercounts — count it yourself with the
command below and trust the number you get, not either figure). The cost is
twofold:

- **A false hub.** `game.js` looks like it owns `G`, `tileAt`, `findPath`,
  `season`, `structMax`, `spawnRaid`, `ignite`… it owns none of them. Every
  reader has to know that `import { season } from './game.js'` really means
  `seasons.js`. New contributors (and future HP-work) reach for the barrel by
  reflex, deepening it.
- **The `G` import is genuinely inconsistent** — this is the concrete smell
  the roadmap names. Verified offenders at `14fd915`:
  - `js/gamepad.js` imports `G` **directly**: `import { G } from './state.js';`
    (the correct source).
  - `js/tiles.js`, `js/mapdraw.js`, `js/world.js`, `js/main.js`, and
    `js/screens.js` (dissolved into `js/ui/*.js` by plan 009) import `G`
    **through the barrel**: e.g. `js/tiles.js` —
    `import { G, tileAt, inMap, isNight, isWinter, insideHouse, selBounds, structMax } from './game.js';`
    and `js/main.js` — `import { G, tickGame } from './game.js';`.

  So two sibling view/input modules disagree on where `G` comes from. AGENTS.md
  currently *blesses* the split ("View modules may import `G` via `js/game.js`
  re-exports; sim modules import directly from `js/state.js`") — this plan
  retires that carve-out.

**Goal**: every module imports each symbol **directly from the module that
defines it**; `js/game.js` keeps only the tick loop and *its own* exports; no
`export { … } from './x.js'` line remains in `game.js`. **Zero behavior
change** — `pnpm check` (typecheck) is the primary net (a mis-pointed import
is a type error), the full test suite is the backstop, and a `node` import
smoke per touched module rules out cycles.

## Current state (anchored at `14fd915` — re-verify by symbol)

### The barrel block in `js/game.js`

`game.js` opens with its own-use imports, then a run of pure re-export lines,
then a *second* own-use import block (the symbols it needs internally, e.g.
`bumpMorale`, `tickSettlers`, `fireTick`), then its function definitions:

```js
// js/game.js — own-use import for state, then the re-export barrel:
import { G, makeState, inMap, tileAt, walkable } from './state.js';   // KEEP (own use)
export { G, makeState, inMap, tileAt, walkable } from './state.js';   // ← barrel: DELETE
export { hasSave, clearSave, save, loadGame } from './save.js';       // ← DELETE
export { findPath, mdist } from './path.js';                          // ← DELETE
export { timeStr, isNight, season, seasonIdx, isWinter, daysToWinter, isHordeDay } from './seasons.js';
export { bumpMorale, addLog, notice, moraleLabel } from './journal.js';
export { structMax, structDamaged, buildDef } from './structures.js';
export { raidEstimate, tonightInfo, foodInfo } from './forecasts.js';
export { communeFallen, communeAscended } from './run-end.js';
export { tip } from './onboard.js';
export {
  makeSettler, traitName, toggleAlarm, releaseTask, insideHouse, housingCap, woundSettler,
  settlerActive, settlersPresent, settlersAvailable, homeAtDusk, cycleRole, tickSettlers,
} from './settlers.js';
export { spawnRaid, tickRaiders } from './raiders.js';
export { ignite } from './fire.js';
```

Two things to hold onto:

1. **The `import … from './state.js'` line directly above the first
   `export … from './state.js'` is game.js's own-use import — KEEP it.** Only
   the `export { … } from './x.js'` lines are the barrel. Deleting the barrel
   must not delete game.js's own imports (the block after it —
   `import { bumpMorale, addLog, notice } from './journal.js';` etc. — is also
   own-use; leave it).
2. **`game.js` already imports all 12 of these modules for its own use.** So
   every direct edge this plan asks a *consumer* to create already exists in
   the graph from game.js's side and evaluates without a TDZ crash. The only
   new risk is a consumer that, re-pointed, closes a fresh
   evaluation-time cycle — caught by the per-step `node` smoke.

### `js/game.js`'s **own** exports (these STAY; consumers keep importing them from `./game.js`)

26 symbols are defined in `game.js` itself and must remain exported from it:
`communeTier`, `moraleWhy`, `centerCam`, `updatePeak`, `checkObjectives`,
`recruitEligible`, `recruitBlocker`, `communeDawn`, `igniteBeacon`,
`elderCounsel`, `tickGame`, `canPay`, `pay`, `refund`, `tryPlaceBuild`,
`designate`, `selBounds`, `selectionInfo`, `assignArea`, `clearAreaPlans`,
`cancelAt`, `queueCraft`, `unqueueCraft`, `adjustedOffer`, `doTrade`,
`newGame`. Re-derive this list at execution time (command below) — HP0 may
have added or moved orchestration functions.

**The classification rule the whole plan turns on**: for any symbol `S` that a
consumer imports from `./game.js`, `S` is either
- a **re-export** (it appears on an `export { … } from './x.js'` line in
  `game.js`) → re-point the consumer's import of `S` to `./x.js`; or
- an **own export** (it appears as `export function S`/`export const S` in the
  `game.js` body) → leave the consumer importing it from `./game.js`.

A single consumer line usually mixes both (e.g. `world.js` imports `updatePeak`
— own — alongside `G`, `addLog`, `makeSettler` — all re-exports). Splitting one
such line is the atomic unit of work.

### Consumers of the barrel (worked examples, verified at `14fd915`)

Six modules import from `./game.js` at the anchor commit. Re-derive the actual
set at execution time; these show the transformation:

| Consumer | Barrel import today | After (own stays on `./game.js`; re-exports re-pointed) |
|---|---|---|
| `js/main.js` | `{ G, tickGame } from './game.js'` | `{ tickGame } from './game.js'` + `{ G } from './state.js'` |
| `js/dawn.js` | `{ communeDawn } from './game.js'` | **no change** — `communeDawn` is game-own (already imports `G` from `./state.js`) |
| `js/world.js` | `{ G, addLog, makeSettler, walkable, releaseTask, communeFallen, updatePeak, bumpMorale, traitName } from './game.js'` | `{ updatePeak } from './game.js'`; `{ G, walkable } from './state.js'`; `{ addLog, bumpMorale } from './journal.js'`; `{ makeSettler, releaseTask, traitName } from './settlers.js'`; `{ communeFallen } from './run-end.js'` |
| `js/tiles.js` | `{ G, tileAt, inMap, isNight, isWinter, insideHouse, selBounds, structMax } from './game.js'` | `{ selBounds } from './game.js'`; `{ G, tileAt, inMap } from './state.js'`; `{ isNight, isWinter } from './seasons.js'`; `{ insideHouse } from './settlers.js'`; `{ structMax } from './structures.js'` |
| `js/mapdraw.js` | `{ G, tileAt, inMap, isNight, isWinter, buildDef, traitName, insideHouse, selBounds, structMax } from './game.js'` | `{ selBounds } from './game.js'`; `{ G, tileAt, inMap } from './state.js'`; `{ isNight, isWinter } from './seasons.js'`; `{ buildDef, structMax } from './structures.js'`; `{ traitName, insideHouse } from './settlers.js'` |
| `js/screens.js` **(→ `js/ui/*.js` after plan 009)** | large mixed block (see below) | split per rule; game-own stays, re-exports re-pointed |

The `screens.js` block at `14fd915` — this file **will not exist in this shape**
after plan 009 dissolves it into `js/ui/chrome.js`, `sidebar.js`, `modals.js`,
`title.js`, `world-screen.js`, each of which copied its slice of these imports
verbatim (plan 009 Step 6 note). It is the clearest illustration of why you
must re-derive rather than trust this list:

```js
import {
  G, tileAt, inMap, timeStr, communeTier, hasSave, loadGame, newGame, save,
  adjustedOffer, doTrade, tryPlaceBuild, cancelAt, queueCraft, unqueueCraft, cycleRole, settlerActive, settlersAvailable, homeAtDusk,
  notice, tip, centerCam, season, isWinter, daysToWinter, moraleLabel, traitName, housingCap,
  selBounds, selectionInfo, assignArea, clearAreaPlans,
  tonightInfo, foodInfo, elderCounsel, toggleAlarm, moraleWhy, recruitEligible, igniteBeacon,
} from './game.js';
```

Game-own in that block (stay): `communeTier, newGame, adjustedOffer, doTrade,
tryPlaceBuild, cancelAt, queueCraft, unqueueCraft, centerCam, selBounds,
selectionInfo, assignArea, clearAreaPlans, elderCounsel, moraleWhy,
recruitEligible, igniteBeacon`. Re-exports (re-point): `G, tileAt, inMap`
(→`state.js`); `hasSave, loadGame, save` (→`save.js`); `timeStr, season,
isWinter, daysToWinter` (→`seasons.js`); `notice, moraleLabel` (→`journal.js`);
`tip` (→`onboard.js`); `cycleRole, settlerActive, settlersAvailable, homeAtDusk,
traitName, housingCap, toggleAlarm` (→`settlers.js`); `tonightInfo, foodInfo`
(→`forecasts.js`).

### Re-exports with **no external consumer** (deleting the line re-points nothing)

At `14fd915`, many re-exported symbols are used only by `game.js`'s own
internal block (which imports them directly), so no consumer imports them
through the barrel: `makeState, findPath, mdist, seasonIdx, isHordeDay,
structDamaged, raidEstimate, clearSave, woundSettler, settlersPresent,
tickSettlers, spawnRaid, tickRaiders, ignite`. Their re-export lines
(`path.js`, `raiders.js`, `fire.js` are entirely dead this way) simply
**delete** — the classification grep will show zero importers. Do not chase
phantom consumers for them; re-derive and let the grep decide.

### The AGENTS.md rule that changes

`AGENTS.md` (house-rules section, the paragraph beginning "Screens are plain
objects…") ends with: *"View modules may import `G` via `js/game.js`
re-exports; sim modules import directly from `js/state.js`."* This plan
**replaces** that sentence — the new convention is direct imports for
everyone. Re-locate it by grepping AGENTS.md for `re-exports` (line number
will have drifted).

## Re-derive the graph (do this first)

Run these at execution time and **build your own worksheet** from the output;
the tables above are the `14fd915` snapshot only.

```bash
# 1. The live barrel: how many symbols, from how many modules?
grep -nE "^export \{" js/game.js                 # every re-export statement
#    Count symbols: paste the block into node and split on commas, or eyeball
#    each `export { a, b, c } from './x.js'` — record the total N and the 12+
#    source modules. Trust THIS number, not "~38" or "47".

# 2. game.js's OWN exports (these stay exported from game.js):
grep -nE "^export (function|const|async function) " js/game.js

# 3. Every consumer that imports FROM the barrel (post-009 ui/ files sit one
#    directory down, so check both spellings, and the test tree):
grep -rn "from './game.js'"  js/
grep -rn "from '../game.js'" js/
grep -rn "game.js" test/

# 4. For any symbol S you're unsure about, find its DEFINING module:
#    (a hit outside game.js is the real home; a hit as `export function S` in
#     game.js means it is game-own and stays.)
grep -rn "export .*\bS\b" js/     # substitute the symbol for S
```

For each consumer line from (3), split it against (1)/(2): re-exported symbols
move to their defining module; game-own symbols stay on `./game.js`. That
per-consumer split is one step below.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Typecheck (primary net) | `pnpm check` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | all pass (unchanged count vs. baseline) |
| One test file | `pnpm vitest run test/boundaries.test.js` | that file passes |
| Cycle/eval smoke (per module) | `node -e "globalThis.performance={now:()=>0};import('./js/MODULE.js').then(m=>console.log('OK',Object.keys(m).length)).catch(e=>{console.error(e);process.exit(1)})"` | prints `OK` + a number |

Run `pnpm check && pnpm lint && pnpm test` **after every step** — the whole
point of going one consumer at a time is that each step lands green. `pnpm
check` is the load-bearing gate: a symbol pointed at a module that does not
export it is a `tsc` error, so a green typecheck proves every re-pointed
import resolves to a real export.

## Scope

**In scope**:
- `js/game.js` — delete every `export { … } from './x.js'` re-export line;
  keep all own-use imports and all own `export function`/`export const`.
- Each consumer of the barrel (re-derived list) — split its `./game.js`
  import so re-exported symbols come from their defining module and game-own
  symbols stay on `./game.js`.
- `AGENTS.md` — replace the "View modules may import `G` via re-exports"
  sentence with the direct-imports convention.
- `plans/README.md` — status row.

**Out of scope**:
- **Any behavior, value, string, or control-flow change.** This is pure
  import re-pointing. If a diff hunk touches anything inside a function body,
  it is wrong.
- **The two deferred navigation cycles from plan 009** (`screens ↔ ui/title`,
  `ui/title ↔ ui/modals`). Those are *function-body* navigation edges
  (menu → new game → game screen → quit → menu), not barrel re-exports — this
  plan neither creates nor removes them, and **re-accepts them as-is**.
  Removing them needs the screen-registry seam plan 009's maintenance note
  describes (`js/ui.js` registry), which is a separate plan, not this one. If
  re-pointing an import happens to *break* one of these cycles' assumptions
  (it should not — barrel symbols are values, navigation is function calls),
  STOP and report rather than restructuring navigation here.
- Renaming, moving, or merging any module; changing what any module exports
  (only *where consumers import from* changes).
- `js/game.js`'s internal caches, tick logic, or own-use imports.
- Splitting `game.js` further (e.g. lifting the mutators into a `mutate.js`).
  Tempting once the barrel is gone, but it is new structure, not this cleanup.

## Git workflow / execution model

Per `plans/README.md`: **plans run sequentially on `main` in numeric order, no
feature branch.** This plan (022) runs after 009–021 are all merged. One
commit per step, imperative messages ("Re-point js/world.js off the game.js
barrel"). Each commit is a green checkpoint (all three gates pass). Do not
push or open a PR unless the operator instructed it.

## Steps

Order: re-point every consumer *first* (each step green), then delete the now
consumer-less barrel lines *last*. Doing consumers first means each re-point
step is independently green (the barrel still re-exports until the final step),
and the delete step at the end is a no-op for anything already re-pointed.

### Step 0: Re-derive and snapshot the graph

Run the four commands in "Re-derive the graph". Write down: (a) N = re-exported
symbol count and the source-module list; (b) game.js's own-export list; (c) the
consumer list (every hit of `from './game.js'` / `from '../game.js'` across
`js/` and `test/`). This snapshot is your work queue and your Done-criteria
oracle. If N or the consumer set differs materially from this plan's `14fd915`
figures (it will — 009–021 grew the graph), **that is expected** — proceed
against your re-derived numbers, not the plan's.

**Verify**: you have a written per-consumer worksheet. No code changed yet;
`pnpm check && pnpm lint && pnpm test` still green (baseline).

### Step 1..K: Re-point one consumer per step

For **each** consumer module from your Step 0 list (one commit each), rewrite
its `./game.js` (or `../game.js`) import:

1. For every symbol on the line, classify via the worksheet: **own** (stays on
   `game.js`) vs **re-export** (moves to its defining module).
2. Keep a `… from './game.js'` import containing only the game-own symbols
   (drop the import entirely if none remain — e.g. `main.js` keeps `tickGame`,
   so its `game.js` import survives with just that).
3. Add one grouped `import { … } from './<definer>.js'` per defining module,
   **merging into any existing import from that module** the consumer already
   has (e.g. if `world.js` already imports something from `./settlers.js`, add
   the newly-direct settler symbols to that line — do not create a second
   `settlers.js` import).
4. Fix the relative path for the consumer's directory depth: `js/*.js` uses
   `./state.js`; `js/ui/*.js` uses `../state.js`.

Consumers that import **only** game-own symbols (e.g. `dawn.js` →
`communeDawn`) need **no change** — record them as verified-no-op and move on.

**Verify (after each consumer)**:
- `pnpm check` exit 0 (proves every re-pointed symbol resolves).
- `node` cycle smoke on the edited module prints `OK` (proves no new
  evaluation-time cycle / TDZ).
- `pnpm lint && pnpm test` green.
- `grep -n "from './game.js'\|from '../game.js'" js/<that-module>` shows only
  game-own symbols remaining (or no game.js import at all).

Suggested order (least to most entangled, re-derived): `main.js`, `world.js`,
`tiles.js`, `mapdraw.js`, then each `js/ui/*.js` file that plan 009 created
(and any HP0-added consumer). Commit per module.

### Step K+1: Delete the barrel from `js/game.js`

With every consumer re-pointed, no external module imports a re-exported
symbol through `game.js`. Delete **every** `export { … } from './x.js';` line
in `game.js` (the whole run shown in "Current state"). Do **not** touch:
- the `import { G, makeState, inMap, tileAt, walkable } from './state.js';`
  own-use line directly above the first deleted export,
- the second own-use import block (`import { bumpMorale, addLog, notice } …`
  through `import { fireTick } from './fire.js';`),
- any `export function`/`export const` in the body.

**Verify**:
- `grep -nE "^export \{" js/game.js` → **no matches** (barrel gone).
- `grep -c "^export " js/game.js` → equals your Step 0 own-export count (all
  survivors are game-own).
- `pnpm check && pnpm lint && pnpm test` → all green.
- Cycle smoke on `js/game.js`, `js/main.js`, and one `js/ui/*.js` → each `OK`.

### Step K+2: Update `AGENTS.md`

Replace the sentence *"View modules may import `G` via `js/game.js`
re-exports; sim modules import directly from `js/state.js`."* (grep AGENTS.md
for `re-exports`) with the new convention, matching the surrounding prose
style:

> Every module imports each symbol directly from the module that defines it —
> `G` and the tile helpers from `js/state.js`, never through `js/game.js`.
> `js/game.js` is the tick loop and its own orchestration exports only; it
> re-exports nothing.

Do not touch the rest of that paragraph (the screen-stack / `pausesSim`
sentence stays).

**Verify**: `grep -n "re-export" AGENTS.md` shows only the new sentence's
"re-exports nothing" (no lingering blessing of the old carve-out); re-read the
paragraph once for accuracy.

### Step K+3: Update `plans/README.md`

Flip this plan's row to DONE (add the row in the same shape if HP0 batching
removed it):

```
| 022 | Untangle the `js/game.js` re-export barrel | P1-6 | P2 | M | 009 | DONE |
```

**Verify**: `git diff plans/README.md` shows only the status-cell (or
single-row) edit.

## Test plan

The steps are the test plan. There is **no new test file** — this is a
zero-behavior refactor whose net is the existing suite plus the typechecker:
- `pnpm check` after every step is the primary net (a mis-pointed import is a
  `tsc` "has no exported member" error).
- `pnpm test` (the full characterization suite, incl.
  `test/boundaries.test.js`, which imports `igniteBeacon`/`elderCounsel` —
  both game-own, so that test is **unchanged**) is the behavior backstop.
- The per-module `node` import smoke rules out evaluation-time cycles/TDZ.

If any of the three gates is red after a step, the re-point for that step was
wrong — fix that step, do not adjust a test.

## Done criteria

- [ ] `grep -nE "^export \{" js/game.js` → no matches (no re-export line
      remains in `game.js`).
- [ ] `grep -rn "from './game.js'\|from '../game.js'" js/` → every remaining
      hit imports **only** game-own symbols (re-derived list); no consumer
      pulls `G`, `tileAt`, `season`, `structMax`, a settler helper, etc.,
      through the barrel.
- [ ] `grep -rn "import { G" js/ | grep "game.js"` → **no matches** (`G` is
      never imported from `game.js` anywhere; all `G` imports read
      `from './state.js'` / `from '../state.js'`).
- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0; test count unchanged
      from baseline.
- [ ] `node` cycle smoke on `js/game.js`, `js/main.js`, and each edited
      `js/ui/*.js` prints `OK`.
- [ ] `git diff` touches only import lines (plus `game.js`'s deleted export
      block); **no** hunk lands inside a function body.
- [ ] `AGENTS.md` states the direct-imports convention; the old
      "view modules may import `G` via re-exports" sentence is gone.
- [ ] `plans/README.md` row updated.

## STOP conditions

- **The drift check shows the barrel or its consumers moved substantially**
  and your re-derived graph does not resemble this plan's structure at all
  (e.g. `game.js` no longer has a re-export block — someone already did this,
  or a bundler/registry was introduced). Re-ground before proceeding, or
  re-plan.
- **`pnpm check` goes red after a re-point** and the fix is not "the symbol
  lives in a different module than the worksheet said" — if a symbol turns out
  to be defined in *two* places, or a consumer relied on a barrel-only
  re-export alias, report the ambiguity rather than guessing the source.
- **The `node` cycle smoke throws `ReferenceError: Cannot access … before
  initialization`** after a re-point. That means the newly-direct edge is used
  at module top level (not inside a function body) and closes an
  evaluation-time cycle. Find the top-level use; do **not** reorder imports
  until it happens to work, and do **not** paper over it by keeping the barrel
  hop. Report the cyclic top-level use.
- **A re-point appears to require touching one of plan 009's deferred
  navigation cycles** (`screens ↔ ui/title`, `ui/title ↔ ui/modals`) to stay
  green. It should not — those are function-call edges, orthogonal to barrel
  values. If it does, STOP: that is the screen-registry work, out of scope
  here.
- **You find yourself tempted to change a value, string, or a function body**
  to make an import resolve. The import is wrong, not the code — re-point
  correctly or report.
- **A consumer imports a symbol from `game.js` that is neither a game-own
  export nor on any re-export line** (a stale or dynamically-added binding).
  Report it; do not invent a source.

## Maintenance notes

- **The convention is now absolute**: import every symbol from its defining
  module. `js/game.js` is the tick loop and its orchestration exports — it
  re-exports nothing, and new code must not re-add a re-export line "for
  convenience." AGENTS.md (Step K+2) is the durable statement of this.
- **The two navigation cycles remain** (`screens ↔ ui/title`,
  `ui/title ↔ ui/modals`), deliberately re-accepted. They are documented,
  smoke-tested, function-body-only edges. If a later plan wants them gone, the
  seam is a screen registry in `js/ui.js` (plan 009's maintenance note), not
  more import layers — and definitely not by reviving a barrel.
- **If `game.js` ever feels large again**, the next structural move is lifting
  its build/trade mutators into a sibling (`js/mutate.js` or similar) so the
  file is purely the loop — but that is new structure and its own plan, not a
  reflex to re-barrel.
- **`grep -nE "^export \{" js/game.js` returning anything is a regression
  signal** worth a lint rule or CI grep if barrels keep creeping back.
