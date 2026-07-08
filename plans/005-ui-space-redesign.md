# Plan 005: Fit-to-window layout — bigger cells, bigger viewport, decompressed sidebar

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. This plan is staged: Stage 1 must land verified-identical before
> Stage 2 begins. If anything in the "STOP conditions" section occurs, stop
> and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3ee106c..HEAD -- js/gfx.js js/data.js js/screens.js js/game.js js/tiles.js js/mapdraw.js js/main.js js/ui.js style.css`
> Plans 001/002 touch `js/gamepad.js`/`js/ui.js`/`js/screens.js` lightly —
> their changes don't conflict conceptually, but re-check any excerpt whose
> line numbers moved.

## Status

- **Priority**: P1 (user priority — "the UI is cramped; use the space better")
- **Effort**: L
- **Risk**: MED (touches every renderer and screen; staged to contain it)
- **Depends on**: none hard; recommended after 001–004 so CI + tests exist
- **Category**: tech-debt / UX
- **Planned at**: commit `3ee106c`, 2026-07-07

## Why this matters

The game renders a fixed 100×45 character grid on a fixed 1100×855 px canvas;
CSS only ever *shrinks* it (`max-width/height: 100vw/vh`). On any modern
display bigger than ~1100×855 the game floats as a small, letterboxed island
(or gets blurrily stretched by page zoom), while the sidebar crams season,
morale, resources, the Elder, up to 12 settlers, expeditions, and a minimap
into 26 columns. The owner's verdict: cramped, wasted space. After this plan:
on larger windows the game gets **larger cells** (integer scale, crisp) *and*
**more cells** (wider/taller viewport, a wider sidebar), chosen at startup from
the window size. Small windows keep exactly today's layout, so nothing
regresses at the floor.

## Current state

Vanilla-JS, no deps, ES modules. One canvas; a character-cell compositor
(`js/gfx.js`) that both renderers and every screen draw into via
`put/str/fillBg`. All layout today hangs off four hardcoded anchors:

- `js/gfx.js:6` — `export const GRID_W = 100, GRID_H = 45;` — cell buffers are
  **module-level** arrays sized `N = GRID_W * GRID_H` (`js/gfx.js:10-13`).
- `js/data.js:3-5`:

```js
export const MAP_W = 140, MAP_H = 96;   // world size
export const VIEW_W = 72, VIEW_H = 38;  // on-screen viewport (camera window)
export const CELL_W = 11, CELL_H = 19;
```

- `js/screens.js:26` (approx.) — `const SB_X = 74;` — sidebar x-origin; the
  sidebar is 26 columns wide (`GRID_W - SB_X`), row rects use `w: 25`.
- `js/gfx.js:32-41` — `setupCanvas` sizes the canvas from the constants:

```js
export function setupCanvas(cv) {
  canvas = cv;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = GRID_W * CELL_W * dpr;
  canvas.height = GRID_H * CELL_H * dpr;
  canvas.style.width = GRID_W * CELL_W + 'px';
  canvas.style.height = GRID_H * CELL_H + 'px';
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
}
```

- `js/gfx.js:95-117` — `paint(f)` fills bg, calls the optional `worldPainter`
  (the sprite renderer draws the map in **pixel** coordinates under the cell
  buffer), then draws every cell's bg/char at
  `x * CELL_W, y * CELL_H` with font `` `${CELL_H - 4}px Menlo, ...` ``; an
  optional `overlayPainter` (elder portrait) draws on top, also in pixels.
- `js/gfx.js:43-49` — `canvasCell(e)` maps mouse position via
  `getBoundingClientRect` ratios × `GRID_W`/`GRID_H` (already
  resolution-independent).
- `js/screens.js:191-216` — `sidebarLayout()` — the single source for sidebar
  row positions. Key literals: settler list cap `12` (`:202`), minimap width
  `mmW: 25` (`:215`), and:

```js
  let mmY = settlerY + shown + expedRows + 1; // header row; map starts mmY+1
  let mmH = Math.min(15, 40 - (mmY + 1));     // rows of map, floor above the slim hint block
```

  (`40` is really `GRID_H - 5`; `15` is the minimap's row cap.)
- `js/screens.js` game screen handlers clamp to the viewport:
  `onClick`/`onDrag` test `c.cx >= VIEW_W || c.cy >= VIEW_H`
  (`js/screens.js:407,413`), `moveCursor` scroll-margins use `VIEW_W/H`
  (`:244-248`), `centerCam` (`js/game.js:53-56`) clamps with
  `MAP_W - VIEW_W`/`MAP_H - VIEW_H`.
- The two renderers draw exactly `VIEW_W × VIEW_H` map cells each frame
  (`js/mapdraw.js`, `js/tiles.js` — both import `VIEW_W, VIEW_H`).
- `style.css:13-16`:

```css
canvas {
  max-width: 100vw;
  max-height: 100vh;
}
```

- Title screens center via `GRID_W` (e.g. `js/screens.js`
  `const ox = ((GRID_W - 34) / 2) | 0;` in `makeMenuScreen`) — these are inside
  functions, which is the pattern that makes this plan tractable.

**Load-order constraint that shapes the whole design**: all modules are
statically imported before `js/main.js`'s body runs, so any *module-level*
`const X = <layout value>` would capture the pre-computation default. The rule
this plan enforces: **layout values are only ever read inside functions.**

Conventions: 2-space indent, single quotes, JSDoc where non-obvious, no new
dependencies. Verification: `pnpm check` (tsc over JSDoc), `pnpm lint`,
`pnpm test` (vitest).

## Commands you will need

| Purpose   | Command        | Expected on success |
|-----------|----------------|---------------------|
| Install   | `pnpm install` | exit 0              |
| Typecheck | `pnpm check`   | exit 0              |
| Lint      | `pnpm lint`    | exit 0              |
| Tests     | `pnpm test`    | all pass            |
| Manual    | `pnpm dev`     | http://localhost:8137 |

## Scope

**In scope**:
- `js/layout.js` (create), `test/layout.test.js` (create)
- `js/gfx.js`, `js/main.js`, `js/screens.js`, `js/game.js`, `js/tiles.js`,
  `js/mapdraw.js`, `js/data.js` (remove `VIEW_W/H` only), `style.css`,
  `js/mobile.js` **only if** it imports the affected constants (check;
  the phone landing page draws its own tiny canvases and likely doesn't).
- `AGENTS.md` §"Key dimensions" if plan 003 landed (update to "defaults from
  `js/layout.js`").

**Out of scope**:
- `MAP_W/MAP_H/CELL_W/CELL_H` stay fixed constants in `js/data.js`.
- Live window-resize reflow (reload applies the new size — deferred; see
  Maintenance).
- Any gameplay/balance change; any change to what the sidebar *contains*
  (only where things sit and how much room they get).
- `js/world.js` sim logic (the world *screen* in screens.js is in scope).
- Touch support, DPI beyond the existing `dpr` handling.

## Git workflow

- Branch: `advisor/005-fit-to-window`
- Commit at least once per stage; Stage 1's commit message should state
  "no visual change at default size".
- Do NOT push or open a PR unless the operator instructed it.

## Steps — Stage 1: single-source the layout (zero visual change)

### Step 1.1: Create `js/layout.js`

```js
// Runtime layout: grid, viewport and sidebar dimensions, computed once at
// startup from the window size. Defaults reproduce the classic 100×45 grid.
// RULE: read L inside functions only — module-level captures see stale values.
import { MAP_W, MAP_H, CELL_W, CELL_H } from './data.js';

export const L = { cell: 1, gridW: 100, gridH: 45, viewW: 72, viewH: 38, sbW: 26, sbX: 74 };

export function computeLayout(winW, winH) {
  // Integer cell scale: only scale up when the whole classic grid fits scaled.
  const cell = Math.max(1, Math.min(
    Math.floor(winW / (100 * CELL_W)),
    Math.floor(winH / (45 * CELL_H)),
    2,
  ));
  let gridW = Math.max(100, Math.min(Math.floor(winW / (CELL_W * cell)), 160));
  let gridH = Math.max(45, Math.min(Math.floor(winH / (CELL_H * cell)), 80));
  const sbW = gridW >= 116 ? 30 : 26;      // roomier sidebar when there's width
  let viewW = gridW - sbW - 2;             // 2-col gutter before the sidebar
  if (viewW > MAP_W) { gridW -= viewW - MAP_W; viewW = MAP_W; }
  let viewH = gridH - 7;                   // 7 bottom rows: log + hints
  if (viewH > MAP_H) { gridH -= viewH - MAP_H; viewH = MAP_H; }
  Object.assign(L, { cell, gridW, gridH, sbW, sbX: gridW - sbW, viewW, viewH });
  return L;
}
```

Sanity-check by hand before proceeding: `computeLayout(1100, 855)` must leave
every field at its default (cell 1, 100×45, view 72×38, sbW 26, sbX 74).

**Verify**: `pnpm check && pnpm lint` → green.

### Step 1.2: `test/layout.test.js`

```js
import { describe, it, expect } from 'vitest';
import { L, computeLayout } from '../js/layout.js';

describe('computeLayout', () => {
  it('reproduces the classic layout at the classic size', () => {
    expect(computeLayout(1100, 855)).toEqual({ cell: 1, gridW: 100, gridH: 45, viewW: 72, viewH: 38, sbW: 26, sbX: 74 });
  });
  it('never shrinks below the classic floor', () => {
    computeLayout(640, 480);
    expect(L.gridW).toBe(100); expect(L.gridH).toBe(45); expect(L.cell).toBe(1);
  });
  it('grows the grid and widens the sidebar at 1440p', () => {
    computeLayout(2560, 1440);
    expect(L.cell).toBe(1);
    expect(L.gridW).toBe(160); expect(L.gridH).toBe(75);
    expect(L.sbW).toBe(30); expect(L.sbX).toBe(130);
    expect(L.viewW).toBe(128); expect(L.viewH).toBe(68);
  });
  it('doubles the cell size at 4K', () => {
    computeLayout(3840, 2160);
    expect(L.cell).toBe(2);
    expect(L.gridW).toBe(160); expect(L.gridH).toBe(56);
  });
  it('viewport never exceeds the map', () => {
    computeLayout(9999, 9999);
    expect(L.viewW).toBeLessThanOrEqual(140);
    expect(L.viewH).toBeLessThanOrEqual(96);
  });
});
```

If any expectation fails, recompute it from the Step 1.1 algorithm by hand —
fix the test or the algorithm, whichever is wrong, and note it in the report.

**Verify**: `pnpm test` → green.

### Step 1.3: Convert `js/gfx.js` to `L` + heap-allocated buffers

- Delete `export const GRID_W = 100, GRID_H = 45;` — add
  `import { L } from './layout.js';` and re-export nothing (consumers import
  `L` themselves).
- Replace the module-level buffers:

```js
let N = 0;
let chs = [], fgs = [], bgs = [];
```

  and allocate them at the top of `setupCanvas` (before sizing the canvas):

```js
  N = L.gridW * L.gridH;
  chs = new Array(N).fill(' ');
  fgs = new Array(N).fill('#888');
  bgs = new Array(N).fill(DEFAULT_BG);
```

- Everywhere the file used `GRID_W`/`GRID_H`, use `L.gridW`/`L.gridH`
  (bounds in `put`/`fillBg`/`setCellBg`, index math `y * L.gridW + x`,
  loops in `paint`, ratios in `canvasCell`, canvas sizing in `setupCanvas`).
- Leave `CELL_W/CELL_H` usage as-is for now (Stage 2 adds the scale).

**Verify**: `pnpm check && pnpm lint && pnpm test` green;
`grep -c "GRID_W\|GRID_H" js/gfx.js` → 0.

### Step 1.4: Convert the remaining `GRID_W`/`GRID_H` importers

`grep -rn "GRID_W\|GRID_H" js/` — expected importers: `js/screens.js` (title
centering, help/pause geometry), possibly `js/mapdraw.js`/`js/tiles.js`/
`js/portrait.js`/`js/mobile.js`. For each use, confirm it's inside a function
and substitute `L.gridW`/`L.gridH` (importing `L` from `./layout.js`). If any
use is in module scope, see STOP conditions.

**Verify**: `grep -rn "GRID_W\|GRID_H" js/ | grep -v layout.js` → no matches;
`pnpm check && pnpm lint && pnpm test` green.

### Step 1.5: Convert `VIEW_W`/`VIEW_H` importers to `L.viewW`/`L.viewH`

`grep -rn "VIEW_W\|VIEW_H" js/` — expected: `js/data.js` (the definition),
`js/game.js` (`centerCam`), `js/screens.js` (cursor margins, click/drag
clamps, bottom-bar rows), `js/mapdraw.js`, `js/tiles.js` (render loops).
Convert every consumer to `L.viewW`/`L.viewH` (function-scope reads only),
then delete the `VIEW_W`/`VIEW_H` export from `js/data.js:4`.

**Verify**: `grep -rn "VIEW_W\|VIEW_H" js/` → no matches;
`pnpm check && pnpm lint && pnpm test` green (the checker will catch any
missed import).

### Step 1.6: Convert the sidebar anchors in `js/screens.js`

- Delete `const SB_X = 74;` and replace every `SB_X` use with `L.sbX`.
- In `sidebarLayout()`: `40` → `L.gridH - 5`; `mmW: 25` → `mmW: L.sbW - 1`;
  every sidebar widget/row width `25` (settler rows, morale rect) →
  `L.sbW - 1`.
- Sweep for stragglers: `grep -nE '\b(74|72|38|40|45|100)\b' js/screens.js js/mapdraw.js js/tiles.js`
  and inspect each hit **in context**. Conversion table: map-edge / viewport
  clamp → `L.viewW`/`L.viewH`; sidebar x / width → `L.sbX`/`L.sbW`; grid edge
  or centering → `L.gridW`/`L.gridH`; bottom-bar rows → `L.viewH + k`;
  anything that is plainly *not* layout (a hp value, a work cost, a color
  component, day counts) → leave untouched. Record every conversion in the
  final report as `file:line old → new`.

**Verify**: `pnpm check && pnpm lint && pnpm test` green. Then the Stage-1
gate: `pnpm dev` at a window ≤ 1100×855 (or just any window — defaults apply
because `computeLayout` isn't called yet) and play 2–3 minutes: title screen
centered, sidebar intact at x=74, build menu, world map `w`, trade, help all
render exactly as before. **Commit** with message noting "no visual change".

## Steps — Stage 2: compute from the window and scale cells

### Step 2.1: Boot-time computation

In `js/main.js`, before `gfx.setupCanvas(canvas)`:

```js
import { computeLayout } from './layout.js';
...
computeLayout(window.innerWidth, window.innerHeight);
gfx.setupCanvas(canvas);
```

### Step 2.2: Cell scale in `js/gfx.js`

- In `setupCanvas`, size with the scale: use
  `const cw = CELL_W * L.cell, ch = CELL_H * L.cell;` and
  `canvas.width = L.gridW * cw * dpr;` (etc. for height and the style sizes).
- In `paint(f)`: compute the same `cw`/`ch` locally; background fill rect uses
  `L.gridW * cw` × `L.gridH * ch`; cell rects/text use `x * cw`, `y * ch`,
  font `` `${ch - 4}px Menlo, ...` ``; wrap the two painter calls in a scaled,
  smoothing-off transform so the pixel-art renderers upscale crisply without
  knowing about the scale:

```js
  if (worldPainter) {
    ctx.save(); ctx.scale(L.cell, L.cell); ctx.imageSmoothingEnabled = false;
    worldPainter(ctx, f);
    ctx.restore();
  }
  ...
  if (overlayPainter) {
    ctx.save(); ctx.scale(L.cell, L.cell); ctx.imageSmoothingEnabled = false;
    overlayPainter(ctx, f);
    ctx.restore();
  }
```

### Step 2.3: Let CSS center, never stretch

`style.css` canvas rule stays `max-width: 100vw; max-height: 100vh;` (safety
shrink for windows smaller than the classic floor) — no change needed unless
you find a hardcoded size; body already flex-centers.

**Verify (the Stage-2 gate, manual)**: `pnpm dev` —
1. Window ~1100×855: identical to Stage 1 (floor).
2. Maximize on a large display (or set the browser window big): reload → more
   map is visible, sidebar sits further right (x=130 at 1440p-class widths,
   30 cols wide), bottom log unchanged in height, mouse clicks land on the
   cell under the pointer (hover the cursor across the map edge and sidebar),
   drag-select works, minimap click centers correctly, tiles mode and ASCII
   mode (`v`) both render correctly, elder portrait still draws in its box.
3. `pnpm check && pnpm lint && pnpm test` green.

## Steps — Stage 3: spend the new room in the sidebar

### Step 3.1: Distribute extra rows

In `sidebarLayout()` (`js/screens.js`), derive the slack and split it between
the settler list and the minimap (defaults unchanged when `extra === 0`):

```js
  const extra = L.gridH - 45;               // 0 on the classic grid
  let shown = Math.min(G.settlers.length, 12 + (extra >> 1));
  ...
  let mmH = Math.min(15 + (extra - (extra >> 1)), (L.gridH - 5) - (mmY + 1));
```

(Keep the existing give-back loop that shrinks the settler list before
squeezing out the minimap.)

### Step 3.2: Breathe

With `L.sbW === 30` the sidebar gains 4 columns: settler rows and the morale
bar simply render wider via the `L.sbW - 1` widths from Step 1.6 — confirm no
row text overflows into the map gutter (the draw calls all clip by string
length; visually check season/tonight/food lines).

**Verify**: `pnpm test` green; manual on a large window: with 14+ settlers
(debug: `ff(20000)` or edit a save) the list shows >12 rows and the minimap is
taller than 15 rows; on a small window both caps are exactly 12/15 as today.

## Test plan

- `test/layout.test.js` (Step 1.2): 5 cases pinning the algorithm, including
  the classic-floor identity — this is the regression net for "small screens
  unchanged".
- Existing suite must stay green throughout; no existing test knows about grid
  size (verified: `test/boundaries.test.js` only builds 140×96 *map* arrays).
- Manual gates after Stages 1, 2, 3 as specified.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0; `test/layout.test.js` passes
- [ ] `grep -rn "GRID_W\|GRID_H\|VIEW_W\|VIEW_H" js/ | grep -v layout.js` → empty
- [ ] `grep -n "const SB_X" js/screens.js` → no match
- [ ] `grep -n "computeLayout" js/main.js` → one call, before `setupCanvas`
- [ ] Classic floor verified: `computeLayout(1100, 855)` test asserts exact defaults
- [ ] Manual Stage-2 gate checklist completed and reported (both renderers, mouse accuracy, portrait)
- [ ] Conversion log (`file:line old → new`) included in the completion report
- [ ] `git status` clean of out-of-scope files; `plans/README.md` row updated

## STOP conditions

- Any module-level expression reads a layout value (e.g. a `const` outside a
  function computed from `GRID_W`, `SB_X`, or `VIEW_W`) that cannot be trivially
  moved inside a function — report the file/line and stop; that's a design
  decision, not a mechanical conversion.
- `js/tiles.js` or `js/portrait.js` turns out to size an offscreen atlas or
  canvas from the *on-screen* canvas dimensions (rather than drawing through
  the passed ctx) — the Step 2.2 transform wrap won't cover that; stop and
  report what it does.
- After Stage 2, mouse clicks land on the wrong cell at any scale — do not
  hand-tune offsets; report (it means `canvasCell` or the canvas sizing
  diverged from the spec).
- A literal in the Step 1.6 sweep is ambiguous after reading its context —
  list it in the report rather than guessing.
- The Stage-1 gate shows *any* visual difference at the classic size.

## Maintenance notes

- **Reload applies the size** — a live `resize` listener is deferred: it needs
  buffer reallocation plus a repaint hook and testing across both renderers.
  The clean seam already exists (`computeLayout` + `setupCanvas`).
- The caps (`160`, `80`, cell scale ≤ 2, sidebar 30 at ≥116 wide, the 12/15
  row-split) are **taste knobs, not physics** — the owner should playtest on
  their own display and tune them in `computeLayout`/`sidebarLayout`; they're
  all in two functions on purpose. Report screenshots/sizes if possible.
- Plan 003's AGENTS.md "Key dimensions" section must say the grid is dynamic
  with 100×45 defaults after this lands (update it in this PR if the file
  exists).
- The roadmap's P1-5 (`screens.js` split) should land *after* this so it moves
  already-converted layout code; P5-4 (touch) builds directly on this work.
- Later idea (out of scope): a settings-menu "UI scale" override for players
  who prefer bigger text over more cells.
