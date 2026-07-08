# Plan 023: Deduplicate the two world renderers into shared pure classifiers (P1-7)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` (Step 6 — the row may not exist yet; add it).
>
> **Execution model** (same as every plan in this repo): plans run
> **sequentially, on `main`, in numeric order** — no feature branches; each
> plan ends in a commit checkpoint with all three gates green. Every code
> excerpt below is anchored at commit `14fd915` (the roadmap-redo HEAD). If a
> line number has moved, **re-locate by the symbol name** — the symbols, not
> the line numbers, are the contract.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/mapdraw.js js/tiles.js js/data.js js/structures.js`
> If `js/mapdraw.js` or `js/tiles.js` changed, **re-read both in full and
> re-run the audit in "Current state" before extracting anything** — this
> plan is 100% an audit-then-extract of those two files, and any drift
> invalidates the enumerated duplications below.
>
> **This plan runs after HP0 (plans 010–019).** Renderer code added by the
> intervening plans (the sapper's wall states HP-6, winter's verb-flip
> HP-10, any new tile art) may have introduced **new** cross-renderer
> duplication not listed here. The audit in "Current state" is the state at
> `14fd915`; at execution time, **re-audit both files top to bottom** and fold
> any new duplicate classifier into the same `js/render-shared.js` before
> declaring done. The enumerated list is a floor, not a ceiling.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (pure refactor; **zero intended visual change except the one
  fishing-mark fix in Step 4**; the draw paths have no unit coverage, so the
  guardrail is a manual visual checklist, not tests)
- **Depends on**: none hard. Pure renderer refactor — touches no sim, save,
  or balance surface. Sequenced after HP0 only so the audit sees the final
  post-HP0 renderer (see the execution-model note above).
- **Category**: refactor/tech-debt
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: P1-7 (`ROADMAP.md:100`)

## Why this matters

Hearthfall ships two full world renderers behind the Graphics toggle: the
ASCII cell renderer (`js/mapdraw.js`, `drawWorldAscii`) and the pixel-sprite
renderer (`js/tiles.js`, `drawMapTiles`). A house rule states both must show
the same information (`AGENTS.md`; echoed in plan 011's Current state). Today
that agreement is maintained by **hand-copied logic**: crop growth thresholds,
animation phase math, and the battle-scar threshold are each written twice,
once per renderer, with no shared source of truth. When a designer retunes
"crops ripen at 60%" they must remember to edit two files or the renderers
silently disagree — and one already does (the ASCII renderer paints every
work designation the same color, so a fishing spot is indistinguishable from
a chop/mine/forage mark, while the sprite renderer gives fishing its own blue;
Step 4).

The fix is the standard one: extract the duplicated **classification** logic
(pure `growth → stage`, `tick → phase`, `hp → scarred?` functions) into one
module, `js/render-shared.js`, unit-test the pure functions (the draw paths
themselves have no tests and are not getting any here), and leave each
renderer owning only its own **art** (glyphs vs sprites). Zero visual change,
except converging the ASCII fishing mark onto the sprite renderer's existing
behavior.

## Current state

All excerpts verified at `14fd915`. Vanilla-JS browser game; vitest; two
renderers selected by a graphics flag. `js/mapdraw.js` is 122 lines,
`js/tiles.js` is 546 lines.

### The audit — every cross-renderer duplication, verified

Six classifiers are implemented **identically in both files** (extract these):

| # | What | `js/mapdraw.js` (ASCII) | `js/tiles.js` (sprite) | Shared form |
|---|------|-------------------------|------------------------|-------------|
| 1 | **Crop growth → stage** (thresholds 100 / 60 / 25) | `:30-34` (`tl.growth\|\|0`, branches to glyph+fg) | `:451-452` (`tl.growth\|\|0`, `g>=100?3:g>=60?2:g>=25?1:0`) | `cropStage(growth) → 0..3` |
| 2 | **Water shimmer phase** | `:26` `(x + y + (f >> 4)) % 2` | `:395` `(x + y + (f >> 4)) % 2` | `waterPhase(x, y, f)` |
| 3 | **Tree variant hash** | `:25` `(x * 7 + y * 11) % 3 === 0` | `:396` `(x * 7 + y * 11) % 3 === 0` | `treeVariant(x, y) → 0\|1` |
| 4 | **Hearth flicker phase** (campfire + lit beacon) | `:27, :28` `(f >> 2) % 3` | `:406, :407` `(f >> 2) % 3` | `hearthPhase(f)` |
| 5 | **Battle-scar threshold** (`< max·0.5`) | `:38` `STRUCT_HP[tl.t] && tl.hp !== undefined && tl.hp < structMax(tl.t) * 0.5` | `:449` `STRUCT_HP[t] && tl.hp !== undefined && tl.hp < structMax(t) * 0.5` | `isBattleScarred(tl, structMax)` |
| 6 | **Camera viewport test** | `:48` `(x,y) => x>=cam.x && y>=cam.y && x<cam.x+VIEW_W && y<cam.y+VIEW_H` | `:431` byte-identical | `onScreen(cam, x, y)` |

Crop stage (#1): the shared classifier returns the **stage index 0–3**; each
renderer keeps its own stage→art table (mapdraw's `Ψ/;/,/.` glyphs + fg at
`:31-34`; tiles' `A.crops[stage]` sprite at `:453`). The thresholds
(100/60/25) are the shared contract — the fg colors and glyphs are not.

Tree variant (#3): the two renderers **already map the hash bucket to
different art** — mapdraw `%3===0 → '♣'` else `'♠'` (`:25`), tiles
`%3===0 → A.tree[1]` (treePine) else `A.tree[0]` (treeRound) (`:396` +
`:341`). Extract **only the selector**; preserve each renderer's
bucket→glyph / bucket→sprite mapping exactly. Do **not** "converge" the art —
that would be a visual change and is out of scope.

Scar threshold (#5): note this is **distinct from** `structDamaged`
(`js/structures.js:12`, `hp <= structMax - 15`), which gates *repair tasks*,
not visuals. The renderers use a different threshold (`< max·0.5`) for a
different purpose (mapdraw dims fg ×0.55 at `:38`; tiles overlays the crack
sprite at `:449`). Extract the renderers' `< max·0.5` predicate; do **not**
fold it into `structDamaged`. `structMax` reads `G.mods.wallHp`
(`js/structures.js:6-10`), so it is passed **into** the helper to keep the
shared module free of `G`.

### Suspects that are NOT duplications — verify, then leave alone

The roadmap flagged several "reimplemented in both" areas. Four of them turn
out **not** to be shared logic; converging any of them would be a visual
change, so they are explicitly out of scope. Documented here so the executor
does not "fix" them:

- **Fire / flame frame math differs between renderers.** mapdraw uses
  `(x + y + (f >> 2)) % 2` for the glyph (`:42`) and `(x + (f >> 2)) % 3`
  for its color (`:43`); tiles uses `((x * 3 + y) + (f >> 2)) % 3` for the
  sprite frame (`:475`). Three different formulas — a 2-frame glyph toggle
  vs a 3-frame sprite cycle. **Not** a shared helper.
- **Night / light overlay is tile-renderer-only.** `js/tiles.js:504-521`
  darkens the map and adds radial fire glow, gated on a per-tile `lit`
  predicate (`:510` `tl.t === 'campfire' || (tl.t === 'beacon' && G.beaconDay)
  || tl.burning`). The ASCII renderer has **no** light overlay — it only
  dims via `tf`/`ef` scalars (`js/mapdraw.js:17`). Single-use; nothing to
  dedup. (Cross-module echo, out of scope: HP-5/plan 011's `visibleBoard`
  computes a similar lit-ground notion — leave both alone.)
- **Winter treatment differs.** mapdraw recolors terrain via the `WINTER_FG`
  table + a farm-fg override (`:8-12, :24, :35`); tiles overlays one
  translucent sheet (`:481-484`). Same `isWinter()` gate, different
  technique. Not shared logic.
- **Intra-file only** (out of the cross-renderer scope): the fire-color array
  `['#ff9030', '#ffc040', '#e06020']` appears three times **inside**
  `js/mapdraw.js` (`:27, :28, :43`) and nowhere in tiles. A local `const`
  would be tidy but is a single-file concern — mention it, do not let it grow
  this plan.

### The fishing-designation color gap (the one thing that IS a bug)

- `js/mapdraw.js:40` — `if (tl.desig) fg = '#e8c860';` colors **every**
  designation the same amber.
- `js/tiles.js:467-469` — `tl.desig === 'fish' ? 'rgba(120,200,232,0.3)' :
  'rgba(232,200,96,0.26)'` singles fishing out as blue, everything else amber.

The designation values are `fish` (set at `js/game.js:340`), `chop`, `mine`,
`forage` (`js/settlers.js:173-176, :196-199`). So in ASCII a fishing spot is
indistinguishable from a chop/mine/forage mark; the sprite renderer already
distinguishes it. The convergence (Step 4): give the ASCII fish mark a
distinct color matching the sprite renderer's blue. `rgba(120,200,232)` is
`#78c8e8`, so:

```js
if (tl.desig) fg = tl.desig === 'fish' ? '#78c8e8' : '#e8c860';
```

This is the **only** intended visual change in the entire plan.

### Import-cycle facts (so `render-shared.js` stays safe to import)

- `js/data.js` imports nothing from `js/` (leaf module). `STRUCT_HP`
  (`js/data.js:69`), `VIEW_W`, `VIEW_H` are safe to import into
  `render-shared.js`.
- Both renderers already import from `./game.js` (the barrel) and `./data.js`.
  `render-shared.js` must **not** import `./game.js` or `./state.js` (that is
  what keeps it pure and unit-testable without a `G` stub). `structMax` is
  therefore **injected as a parameter**, never imported here.
- `structMax` lives in `js/structures.js:6` (re-exported by `js/game.js:15`);
  both renderers already have it in scope.

### The test net

vitest, tests in `test/` (`test/balance.test.js`, `test/save.test.js`, etc.).
There is **no** existing test that touches `mapdraw.js` or `tiles.js` — the
draw paths are entirely uncovered, and this plan does not add coverage to
them (they call `canvas`/`put`). The **pure** extracted functions get a new
`test/render-shared.test.js`, which needs no `localStorage`/DOM stub (no `G`,
no canvas) — the simplest test header in the repo.

## Design (decided here, executed below)

### New module `js/render-shared.js` (imports: `./data.js` only — leaf, cycle-safe)

```js
// Pure render classifiers shared by the two world renderers
// (js/mapdraw.js ASCII cells, js/tiles.js pixel sprites). No canvas, no DOM,
// no `G` reads — every function is a pure map from primitives to a
// classification. Both draw paths are unit-test-free; centralizing the
// classification here is what keeps them from silently disagreeing, and the
// classifiers are unit-tested in test/render-shared.test.js.
//
// Rule of the module: it owns *what stage / phase / class* a tile is in;
// each renderer still owns *what that looks like* (glyph vs sprite). Never
// move art (colors, glyphs, sprite choice) in here.
import { STRUCT_HP, VIEW_W, VIEW_H } from './data.js';

// Crop growth (0..100+) -> visual stage index 0..3. Thresholds are the
// shared contract (mapdraw glyphs + fg; tiles A.crops[stage] sprites).
export function cropStage(growth) {
  const g = growth || 0;
  return g >= 100 ? 3 : g >= 60 ? 2 : g >= 25 ? 1 : 0;
}

// Two-frame water shimmer: position + slow tick (f>>4). Returns 0 or 1.
export const waterPhase = (x, y, f) => (x + y + (f >> 4)) % 2;

// Static per-tile tree variant selector: 1 = second variant, 0 = first.
// mapdraw maps 1->'♣'/0->'♠'; tiles maps 1->treePine/0->treeRound.
// Selector only — each renderer keeps its own art mapping.
export const treeVariant = (x, y) => ((x * 7 + y * 11) % 3 === 0 ? 1 : 0);

// Three-frame hearth flicker (campfire and lit beacon): tick only (f>>2).
export const hearthPhase = (f) => (f >> 2) % 3;

// A structure at/under half its max HP shows battle damage (mapdraw dims fg,
// tiles overlays a crack). structMax is INJECTED (it reads G.mods) so this
// module stays pure. NOT the same as structures.js structDamaged (<= max-15,
// which gates repair, not visuals) — do not merge the two.
export function isBattleScarred(tl, structMax) {
  return !!STRUCT_HP[tl.t] && tl.hp !== undefined && tl.hp < structMax(tl.t) * 0.5;
}

// Camera viewport test in world coords. cam injected; VIEW_W/VIEW_H are the
// same data.js constants both renderers already use.
export const onScreen = (cam, x, y) =>
  x >= cam.x && y >= cam.y && x < cam.x + VIEW_W && y < cam.y + VIEW_H;
```

### Naming collision to resolve (crop stage)

`js/tiles.js:125` already defines a local `function cropStage(stage)` — but
that one **builds the sprite** for a given stage (called at `:348`
`crops: [cropStage(0), cropStage(1), ...]`). Importing a `cropStage` classifier
would shadow it. Resolve by **renaming the sprite builder** to `cropSprite`
(definition `:125`, call site `:348`) — the classifier keeps the natural name
`cropStage(growth)`, the builder's new name says what it does. Two-line rename,
no behavior change.

## Commands you will need

| Purpose   | Command                                     | Expected on success |
|-----------|---------------------------------------------|---------------------|
| Install   | `pnpm install`                              | exit 0              |
| Tests     | `pnpm test`                                 | all pass            |
| One file  | `pnpm vitest run test/render-shared.test.js`| that file passes    |
| Typecheck | `pnpm check`                                | exit 0              |
| Lint      | `pnpm lint`                                 | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137          | manual check, Step 5 |

Debug hooks for manual verification: `window.G`, `window.ff(minutes)`
(fast-forward). Toggle renderers via the pause menu → Graphics.

## Scope

**In scope**:
- `js/render-shared.js` (create) — the six pure classifiers above
- `test/render-shared.test.js` (create) — unit tests for those six
- `js/mapdraw.js` — replace the five duplicated classifiers with imports;
  apply the fishing-mark fix (Step 4)
- `js/tiles.js` — replace the six duplicated classifiers with imports; rename
  local `cropStage` → `cropSprite`
- `README.md` code-map line (Step 6)
- `plans/README.md` — status row

**Out of scope** (do not touch):
- Any **art**: colors, glyphs, sprite pixels, gradient radii, dim factors.
  Every color/glyph literal stays exactly where it is.
- The four verified non-duplications (fire frame math, night/light overlay,
  winter treatment, the intra-file fire-color array) — leave all as-is.
- `structDamaged` / `js/structures.js` — the visual scar threshold is
  deliberately separate.
- Renderer performance (roadmap P1-9, explicitly deferred in
  `plans/README.md`'s rejected-findings list).
- Adding any test to the draw paths themselves (`drawWorldAscii`,
  `drawMapTiles`) — they stay uncovered; the manual checklist is the gate.

## Git workflow

- **No branch** — commit directly on `main` per the repo execution model.
- Commits: one per step. Imperative messages ("Extract shared render
  classifiers into js/render-shared.js").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `js/render-shared.js` + its tests (nothing consumes it yet)

Create `js/render-shared.js` exactly as the Design section specifies. Then
create `test/render-shared.test.js` — no stub header needed (no `G`, no DOM):

```js
import { describe, it, expect } from 'vitest';
import { cropStage, waterPhase, treeVariant, hearthPhase, isBattleScarred, onScreen } from '../js/render-shared.js';
```

Tests to write:

1. **`cropStage` thresholds**: `cropStage(0)===0`, `cropStage(24)===0`,
   `cropStage(25)===1`, `cropStage(59)===1`, `cropStage(60)===2`,
   `cropStage(99)===2`, `cropStage(100)===3`, `cropStage(150)===3`;
   `cropStage(undefined)===0` and `cropStage(null)===0` (the `|| 0` guard).
2. **`waterPhase`**: returns 0/1; equals `(x + y + (f >> 4)) % 2` for a spot
   grid of `(x,y,f)` — assert against the literal formula so the test pins
   the contract, and assert it only changes every 16 frames for fixed x,y
   (`waterPhase(1,1,0)===waterPhase(1,1,15)` and differs at `f=16`).
3. **`treeVariant`**: returns exactly 0 or 1; `===1` iff
   `(x*7+y*11)%3===0` (check a handful of coords including one of each).
4. **`hearthPhase`**: returns 0/1/2; advances every 4 frames
   (`hearthPhase(0)===hearthPhase(3)`, `hearthPhase(4)!==hearthPhase(0)`);
   cycles mod 3.
5. **`isBattleScarred`**: with a fake `const sm = () => 100`: a wall tile
   `{t:'wall_w', hp:40}` → `true` (40 < 50); `{t:'wall_w', hp:60}` → `false`;
   `{t:'wall_w', hp:undefined}` → `false`; `{t:'grass', hp:1}` → `false`
   (grass not in `STRUCT_HP`); boundary `{t:'wall_w', hp:50}` → `false`
   (strict `<`).
6. **`onScreen`**: `cam={x:10,y:10}` → `onScreen(cam,10,10)` true;
   a coord past `cam.x+VIEW_W` / `cam.y+VIEW_H` false; `(9,10)` and `(10,9)`
   false (half-open bounds).

**Verify**: `pnpm vitest run test/render-shared.test.js` → all pass;
`pnpm check && pnpm lint` → exit 0. `pnpm test` → full suite still green
(nothing imports the module yet — this step is purely additive).

### Step 2: Rewire `js/tiles.js` onto the shared classifiers

Add `import { cropStage, waterPhase, treeVariant, hearthPhase, isBattleScarred, onScreen } from './render-shared.js';`.

Then, symbol by symbol (re-locate by symbol if lines moved):

1. **Rename the sprite builder** `cropStage` → `cropSprite`: definition at
   `:125` and its call site in `buildAtlas` at `:348`
   (`crops: [cropSprite(0), cropSprite(1), cropSprite(2), cropSprite(3)]`).
2. **`onScreen`** (`:431`): delete the local `const onScreen = ...` and rely
   on the import (it is called at `:431`-region, `:488`, `:491`). The imported
   signature is `onScreen(cam, x, y)` — the local closed over `cam`, so update
   the call sites to pass `cam` (e.g. `onScreen(cam, x, y)`).
3. **water** (`sprite()`, `:395`): `a.water[waterPhase(x, y, f)]`.
4. **tree** (`sprite()`, `:396`): `a.tree[treeVariant(x, y)]` — note
   `treeVariant` returns 1 for `%3===0`, matching the old `? 1 : 0`.
5. **campfire / beacon** (`sprite()`, `:406-407`): `a.campfire[hearthPhase(f)]`
   and `G.beaconDay ? a.beacon[hearthPhase(f)] : a.beaconUnlit`.
6. **battle scar** (`drawMapTiles`, `:449`): replace the inline predicate with
   `if (isBattleScarred(tl, structMax)) ctx.drawImage(A.crack, px, py);`.
7. **crop stage** (`drawMapTiles`, `:451-453`): replace the inline ternary
   with `const stage = cropStage(tl.growth);` then `ctx.drawImage(A.crops[stage], px, py);`.

Leave `STRUCT_HP`/`structMax` imports in `tiles.js` — `structMax` is still
passed into `isBattleScarred`, and `STRUCT_HP` may still be referenced
elsewhere (check: `grep -n STRUCT_HP js/tiles.js` — if the scar line was its
only use, drop the unused import to keep lint green).

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green. This step must
be a **pure identity refactor** — no visual change yet (the fishing fix is
Step 4, in the other renderer). Manually confirm in the sprite renderer that
crops, water, trees, hearths, and damaged walls look unchanged (spot check;
the full checklist is Step 5).

### Step 3: Rewire `js/mapdraw.js` onto the shared classifiers

Add `import { cropStage, waterPhase, treeVariant, hearthPhase, isBattleScarred, onScreen } from './render-shared.js';`.

Symbol by symbol:

1. **tree** (`drawWorldAscii`, `:25`):
   `if (tl.t === 'tree') ch = treeVariant(x, y) ? '♣' : '♠';` (unchanged
   mapping — `treeVariant` is 1 for `%3===0`, which chose `'♣'` before).
2. **water** (`:26`):
   `if (tl.t === 'water') ch = waterPhase(x, y, f) ? '≈' : '~';`.
3. **campfire / beacon** (`:27-28`): keep the fire-color array literal in
   place, index it with `hearthPhase(f)`:
   `fg = FIRE_COLORS[hearthPhase(f)];` (see note below on `FIRE_COLORS`) — or,
   to keep this a pure dedup with **no** other change, leave the array literal
   inline and only swap the index: `['#ff9030','#ffc040','#e06020'][hearthPhase(f)]`.
   **Prefer the minimal inline swap** to keep the diff a pure index change;
   the `FIRE_COLORS` const is the optional cleanup noted in Current state and
   may be skipped.
4. **battle scar** (`:38`): the ASCII version dims fg — replace only the
   predicate: `if (isBattleScarred(tl, structMax)) tint *= 0.55;`.
5. **crop stage** (`:29-36`): compute the stage via the shared classifier,
   keep mapdraw's own glyph/fg table and the winter override:

   ```js
   if (tl.t === 'farm') {
     const stage = cropStage(tl.growth);
     if (stage === 3) { ch = 'Ψ'; fg = '#e8d060'; }
     else if (stage === 2) { ch = ';'; fg = '#8fb050'; }
     else if (stage === 1) { ch = ','; fg = '#6a9040'; }
     else { ch = '.'; fg = '#5a7a3a'; }
     if (winter) fg = '#7a8690';
   }
   ```

   The glyphs/colors are byte-for-byte the old ones (`:31-34`); only the
   threshold branch is now shared.
6. **`onScreen`** (`:48`): delete the local `const onScreen = ...`, use the
   import, update call sites (`:49`, `:51`, `:58`) to pass `cam`:
   `onScreen(cam, x, y)`.

Do **not** touch the fire/flame block (`:41-45`) — its frame math is
renderer-specific (verified non-dup).

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green. Again a pure
identity refactor except nothing visual should differ yet.

### Step 4: The one visual fix — ASCII fishing-mark color

In `js/mapdraw.js`, the designation line (`:40`):

```js
if (tl.desig) fg = tl.desig === 'fish' ? '#78c8e8' : '#e8c860';
```

`#78c8e8` = `rgb(120,200,232)`, matching the sprite renderer's fishing tint
(`js/tiles.js:468` `rgba(120,200,232,0.3)`). Non-fish designations
(`chop`/`mine`/`forage`) keep the existing amber `#e8c860`. This is the only
intended visual change in the plan.

**Verify**: `pnpm check && pnpm lint && pnpm test` → green. Then the manual
check in Step 5 confirms the fish mark reads blue in ASCII and matches the
sprite renderer.

### Step 5: Manual visual checklist (the real gate — draw paths have no tests)

`pnpm dev` → http://localhost:8137. For **each** item, toggle **both**
renderers (pause menu → Graphics) and confirm they agree and are unchanged
from before this plan (except the fishing mark):

- [ ] **Crops at all four stages** — plant a farm; use `ff()` to advance
      growth; confirm soil → sprout → growing → ripe transitions land at the
      same growth in both renderers (thresholds 25/60/100 unchanged).
- [ ] **All four seasons** — `ff` across a year: summer/autumn crops, the
      winter recolor (ASCII) / winter sheet (sprite) both still appear; farms
      grey out in winter in ASCII as before.
- [ ] **Day and night** — the sprite renderer's night darken + fire glow is
      unchanged; ASCII night-dim is unchanged.
- [ ] **Animations** — water shimmer, tree variety, campfire and lit-beacon
      flicker all animate as before in both renderers.
- [ ] **Battle scars** — damage a wall below half HP (raiders or fire):
      ASCII dims it, sprite shows the crack — both trigger at the same HP.
- [ ] **Fire** — a burning tile still animates (this path was intentionally
      not touched; confirm no regression).
- [ ] **FISHING FIX** — designate a fishing spot on water and a chop mark on a
      tree: in **ASCII** the fish mark is now blue (`#78c8e8`) and the chop
      mark amber; in the **sprite** renderer they are blue/amber as before.
      The two renderers now agree.

If any non-fishing item differs from pre-plan behavior, a classifier was
extracted wrong — STOP and diff against `14fd915`.

### Step 6: Docs + `plans/README.md`

- `README.md` code map: add `js/render-shared.js` beside the renderer entries
  (find the `mapdraw.js`/`tiles.js` line via `grep -n "mapdraw\|tiles" README.md`)
  — e.g. append `· \`js/render-shared.js\` — pure classifiers shared by both
  renderers (crop stage, animation phase, scar threshold)`.
- `plans/README.md`: add the row (or update if present):

  ```
  | 023 | Deduplicate the two world renderers into shared pure classifiers | P1-7 | P2 | M | — | DONE |
  ```

  and, under "Dependency notes", one line: the renderer dedup is a pure
  refactor that must be **re-audited at execution time** for any new
  post-HP0 duplication (plans 012–019 may have added renderer code).

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green;
`git status` shows only the in-scope files.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/render-shared.test.js`
~6 describe blocks (one per pure classifier), all green alongside the existing
suite; `mapdraw.js` and `tiles.js` gain no tests (uncovered draw paths — the
Step 5 checklist is their gate). No existing test file changes.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/render-shared.js` exists; exports `cropStage`, `waterPhase`,
      `treeVariant`, `hearthPhase`, `isBattleScarred`, `onScreen`; imports
      **only** from `./data.js` (`grep -n "import" js/render-shared.js` shows
      no `game.js`/`state.js`)
- [ ] `test/render-shared.test.js` exists and covers all six functions
- [ ] Both renderers import the shared classifiers —
      `grep -n "render-shared" js/mapdraw.js js/tiles.js` shows both
- [ ] No duplicated classifier remains — `grep -n "growth || 0" js/mapdraw.js js/tiles.js`
      shows **only** inside the shared module's callers passing `tl.growth`
      (not a re-implemented threshold ladder); `grep -n "x \* 7 + y \* 11" js/`
      matches only `js/render-shared.js`
- [ ] `js/tiles.js` local `cropStage` renamed to `cropSprite` (no shadowing)
- [ ] Fishing fix in place — `grep -n "desig === 'fish'" js/mapdraw.js` shows
      the color branch
- [ ] Step 5 manual checklist completed with **zero** visual change except the
      ASCII fishing mark
- [ ] `README.md` code map + `plans/README.md` row updated

## STOP conditions

1. Any excerpt in "Current state" no longer matches the code at execution HEAD
   (drift) — the drift check missed a mid-flight change; re-audit both
   renderers before extracting.
2. **The re-audit finds a duplication not in the table** (a new post-HP0
   classifier written twice). Extend `render-shared.js` and the table rather
   than silently ignoring it — but if it is not a pure `input → class` map
   (e.g. it reads `G` or draws), report it rather than forcing it into the
   pure module.
3. A "suspect" you expected to be shared (fire frame math, night overlay,
   winter, the fire-color array) turns out to have **converged** since
   `14fd915` into genuinely identical cross-renderer logic — that is now a
   real duplication; report it and get the scope extension confirmed before
   extracting (its art-vs-classification split may be subtler than the six
   here).
4. Any test outside `test/render-shared.test.js` changes behavior — this is a
   pure refactor; the existing suite must pass **unmodified**. If a sim/save
   test moves, something leaked out of the renderer layer; STOP.
5. The manual checklist shows a visual difference on any item **other than**
   the ASCII fishing mark — a classifier was extracted with a subtly changed
   threshold or phase; diff the shared function against the original inline
   code and report before shipping.
6. `structMax` or `structDamaged` gets pulled into `render-shared.js`, or the
   scar helper gets "unified" with `structDamaged` — that couples the module
   to `G` and merges two deliberately-separate thresholds. STOP.

## Maintenance notes

- **The module owns classification, never art.** Any future tile — a new crop,
  a new animated structure, the sapper's damaged-wall states (HP-6) — adds its
  **stage/phase classifier** here and unit-tests it, while each renderer keeps
  its own glyph/sprite for that class. If a change wants to put a color or a
  glyph in `render-shared.js`, it is in the wrong file.
- **The two renderers must agree.** These shared classifiers are the
  mechanism that enforces the house rule ("both renderers show the same
  info"); the Step 5 checklist is the recurring manual check the draw paths
  can't get from unit tests.
- **Deliberately left un-deduped**: fire frame math, the night/light overlay,
  and winter treatment are renderer-specific by design (different techniques,
  not copied logic) — do not "finish the job" by forcing them into shared code
  without a design decision that the two renderers should animate/shade
  identically.
- **`structDamaged` stays separate** from the visual scar threshold — repair
  gating (`<= max-15`) and battle-damage art (`< max·0.5`) are different
  questions that happen to both key off HP.
</content>
</invoke>
