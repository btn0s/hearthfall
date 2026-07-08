# Plan 025: Renderer idle cost — dirty-cell compositing, cached night gradients, frozen-on-pause world animation (P1-9)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Execution model**: Plans run **sequentially, on `main`, in numeric order**
> (see `plans/README.md` → Dependency notes). There is no feature branch;
> each step ends in a checkpoint commit with all three gates green. Every code
> excerpt below is anchored at commit `14fd915` (current `main` HEAD). If a
> line number has drifted because an earlier plan in the sequence edited the
> file, **re-locate by symbol name** — the symbols (`paint`, `clear`, `put`,
> `drawMapTiles`, `renderFrame`, the `frame()` rAF loop) are stable even when
> line numbers are not.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/gfx.js js/main.js js/ui.js js/tiles.js js/mapdraw.js js/screens.js`
> If `js/gfx.js` or `js/main.js` changed, re-read them fully before starting —
> this plan rewrites the compositor's `paint()` and the rAF loop, and both
> edits depend on the excerpts below being current. If a `js/gfx.js` already
> tracks dirty cells or a `prev*` buffer, STOP (someone started P1-9 already).

## Status

- **Priority**: P3 (lowest in the roadmap — invisible on desktop; a
  correctness-preserving efficiency pass, not a feature)
- **Effort**: M
- **Risk**: MED (touches the single hottest path in the app — the present
  loop every frame draws through; a compositor bug is visible everywhere at
  once). Mitigated by: zero intended visual change + a byte-for-byte manual
  checklist + a measurement harness that quantifies the win.
- **Depends on**: plan **023 recommended first** — its shared render/loop
  helpers make the dirty-flagging seam cleaner (a single place to mark the
  world layer dirty rather than scattering `requestFull()` calls). This plan
  is **self-contained if 023 has not landed**: where 023 would provide a
  helper, inline the equivalent and leave a `// TODO(023)` note. Do **not**
  block on 023.
- **Category**: performance / architecture
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: P1-9 (`ROADMAP.md`; "renderer idle cost")

## Why this matters

The compositor does a full-cost repaint **every `requestAnimationFrame`
frame, unconditionally** — including when the game is paused, a modal is up,
or the player is idle on a menu. `plans/README.md:45-47` currently files this
under "Findings considered and rejected": *"real (full repaint every rAF
frame, per-frame night gradients) but invisible on desktop; deliberately
deferred behind the design-phase work."* This plan is the un-deferral: the
design-phase plans (009–011, and the 01x/02x batch) are landing, P1-9 is the
enablement straggler that "slots opportunistically" (`plans/README.md:36-37`),
and the fix is small, self-contained, and testable.

The cost is real and threefold, verified below at `14fd915`:

1. **Full-grid repaint** — `gfx.paint()` walks all `N = GRID_W·GRID_H =
   100·45 = 4500` cells every frame, issuing a `fillRect` per non-default
   background and a `fillText` per non-space glyph, even when not one cell
   changed since the last frame.
2. **Per-frame gradient allocation** — night rendering calls
   `ctx.createRadialGradient(...)` plus two `addColorStop(...)` **for every
   lit tile, every frame** (`js/tiles.js:514-516`), inside a
   `VIEW_W·VIEW_H = 70·38 = 2660`-iteration scan.
3. **Idle animation churn** — the world map (sprite mode) is fully re-rasterized
   every frame because tile animations key off a frame counter that advances
   even while the sim is frozen, so a paused screen re-runs the entire
   `drawMapTiles` double-loop for a picture that cannot change.

None of this is felt on a fast desktop today, which is exactly why it is P3
and why it must ship with **zero visual change** as the binding constraint —
this plan buys battery/thermal headroom (laptops, the mobile landing that
borrows the atlas, `getAtlas`, `js/tiles.js:417`) and a cleaner present path
for future renderers, and it must not "improve" a single pixel while doing so.

## Current state

All excerpts verified at `14fd915`. Vanilla-JS browser game; two swappable
renderers paint through one character-cell compositor (AGENTS.md: *"Two
swappable renderers (`js/mapdraw.js` ASCII, `js/tiles.js` sprites) paint
through the cell compositor (`js/gfx.js`)"*). Debug hooks live on `window`
(`window.G`, `window.ff(mins)` — AGENTS.md "Debug hooks"); this plan adds one
next to them.

### The compositor — `js/gfx.js`

The buffer is three module-level arrays of `N = 4500` cells (`js/gfx.js:10-13`).
Writers mark content but **not** which cells changed:

```js
// js/gfx.js:51-66
export function put(x, y, ch, fg, bg) {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;
  const i = y * GRID_W + x;
  chs[i] = ch; fgs[i] = fg;
  if (bg !== undefined) bgs[i] = bg;
}
export function str(x, y, text, fg, bg) {
  for (let i = 0; i < text.length; i++) put(x + i, y, text[i], fg, bg);
}
export function fillBg(x0, y0, w, h, bg) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
    const i = y * GRID_W + x;
    chs[i] = ' '; bgs[i] = bg;
  }
}
```

`clear()` (`js/gfx.js:86-90`) resets **all** cells to defaults and nulls both
painters — it runs once per frame at the top of `renderFrame` (below), so the
buffer is fully rebuilt by the screen `draw()` calls every frame. That is fine
and stays; the waste is downstream, in `paint()`:

```js
// js/gfx.js:95-117
export function paint(f) {
  if (!ctx) return;
  ctx.fillStyle = DEFAULT_BG;
  ctx.fillRect(0, 0, GRID_W * CELL_W, GRID_H * CELL_H);   // (A) full-canvas clear
  if (worldPainter) worldPainter(ctx, f);                 // (B) sprite map (tiles mode)
  ctx.font = `${CELL_H - 4}px Menlo, Consolas, "DejaVu Sans Mono", monospace`;
  ctx.textAlign = 'center';                               // (C) constant state, re-set every frame
  ctx.textBaseline = 'middle';
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {                    // (D) all 4500 cells, every frame
      const i = y * GRID_W + x;
      if (bgs[i] !== DEFAULT_BG) {
        ctx.fillStyle = bgs[i];
        ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W, CELL_H);
      }
      if (chs[i] !== ' ') {
        ctx.fillStyle = fgs[i];
        ctx.fillText(chs[i], x * CELL_W + CELL_W / 2, y * CELL_H + CELL_H / 2 + 1);
      }
    }
  }
  if (overlayPainter) overlayPainter(ctx, f);             // (E) portraits etc.
}
```

Key structural fact for the design: **UI panels are opaque by construction** —
the file's own header comment (`js/gfx.js:1-3`): *"Panels use PANEL_BG so they
are always painted opaque — nothing can bleed through UI by construction."* In
tiles mode the map region of the *buffer* is left at `clear()` defaults (space,
`DEFAULT_BG`) — the sprite layer `(B)` carries the map, and `(D)` skips
`DEFAULT_BG` cells so the sprites show through. This is what makes incremental
compositing safe: a dirty buffer cell over an **opaque** background repaints
self-contained; a cell reverting to `DEFAULT_BG` over the sprite layer is the
one case that needs the layer beneath, and the design forces a full frame for
exactly that case (see Design → "The DEFAULT_BG-under-sprite rule").

### The render pipeline — `js/ui.js:74-84`

```js
export function renderFrame(f) {
  gfx.clear();                       // wipe buffer + null painters
  let base = 0;
  for (let i = stack.length - 1; i >= 0; i--) { if (!stack[i].modal) { base = i; break; } }
  for (let i = base; i < stack.length; i++) { if (stack[i].draw) stack[i].draw(f); }
  gfx.paint(f);                      // ← the hot path above
}
```

`base` is the topmost non-modal screen: a `pausesSim` modal (pause menu,
orders, trade, help, gameover — `js/screens.js:811,845,880,905,948,983,1050,1066`)
draws **over** the still-drawn game screen, so while a modal is up the full
game screen `draw()` (and its world painter) still runs every frame. Screen
transitions go through `push`/`pop`/`replaceAll` (`js/ui.js:15-20`).

### The rAF loop and the frame counter — `js/main.js:37-63`

```js
let last = performance.now(), acc = 0, f = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  f++;                               // ← advances EVERY frame, pause or not
  pollGamepad();
  const topScreen = stack[stack.length - 1];
  if (topScreen && topScreen.update) topScreen.update();
  if (simActive()) {
    const tps = [0, 8, 22, 55][G.speed];
    acc += dt;
    const step = 1 / tps;
    let n = 0;
    while (acc >= step && n < 120) { acc -= step; advanceMinute(); n++; }
    if (n >= 120) acc = 0;
  } else { acc = 0; }
  if (G.gameOver && inStack('game') && !inStack('gameover')) push(makeGameOverModal());
  renderFrame(f);
  requestAnimationFrame(frame);
}
```

`simActive()` (`js/main.js:34-35`) = `inStack('game') && !stack.some(s =>
s.pausesSim) && !G.gameOver && !G.paused`. `advanceMinute()` (`js/main.js:15-20`)
is the **only** thing that mutates the world the sprite layer draws (entity
positions, `G.day`/`G.min` → night/winter/beacon, crop growth). Pause toggles
`G.paused` (`js/screens.js:367,664`). Debug hooks (`window.G`, `window.ff`) are
`js/main.js:22-32`.

### What `f` drives — the animation audit (load-bearing for Design step 3)

`f` is a single counter shared by **two** kinds of animation. Grep-verified
(`grep -rn "f >>\|f %\|(f)" js/`):

- **World-layer animation** (sprite/ASCII map, redrawn from `f` every frame):
  campfire/beacon flicker `a.campfire[(f >> 2) % 3]` / `a.beacon[...]`
  (`js/tiles.js:406-407`), water ripple `(x + y + (f >> 4)) % 2`
  (`js/tiles.js:395`), free-standing flame `A.flame[... (f >> 2) ...]`
  (`js/tiles.js:475`), warlord/starving/downed blink (`js/tiles.js:497`,
  `js/mapdraw.js:54,61-62`). The ASCII path recomputes the same from `f`
  (`js/mapdraw.js:27-28,43`).
- **UI / chrome animation** (drawn into the buffer, must keep ticking even
  when the world is frozen): the **`‖ PAUSED` blinker** itself
  `((f >> 4) % 2 ? '‖ PAUSED' : ...)` (`js/screens.js:456`), tonight-urgent
  `(f >> 3) % 2` (`:472`), raid/alarm/beacon-hold blinkers (`:480,481,486`),
  minimap raider dots (`:595`), the **title-screen flame** `flame[(f >> 3) % 3]`
  (`:97`), and selected-row blink in menus/modals `(f >> 4) % 2` (`:678,816,
  996`).

**The pause paradox**: today, because both kinds share `f` and `f` advances
unconditionally, campfires flicker **while paused** (world churn we want to
stop) *and* the `‖ PAUSED` label blinks (UI we must keep). Freezing `f`
wholesale would kill the blinker; leaving it kills the optimization. The
Design splits the two clocks. **Verified: nothing in the world layer blinks a
cursor** — the cursor is a static `strokeRect` (`js/tiles.js:538-544`) / static
`setCellBg` (`js/mapdraw.js:73-76`), so "cursor blink" is a non-issue here; the
UI things that *must* keep animating on pause are the sidebar/menu/modal
blinkers, all already in the buffer on `f`.

### The world painter and the night gradient — `js/tiles.js`

`drawMapTiles(ctx, f)` (`js/tiles.js:422-546`) is registered as the world
painter each frame (`js/screens.js:435`, tiles mode only; ASCII mode calls
`drawWorldAscii(f)` directly into the buffer, `js/screens.js:436`,
`js/mapdraw.js:14-77`, and leaves `worldPainter` null). Per frame it: `save()`,
disables smoothing, clips to the map rect (`js/tiles.js:424-428`); double-loops
`2660` cells drawing ground+feature sprites (`:433-478`); optional winter sheet
(`:481-484`); entities (`:486-501`); the **night pass** (`:504-521`); selection
marquee (`:524-537`); cursor (`:538-544`). The night pass is the allocation
hotspot:

```js
// js/tiles.js:504-521
if (isNight()) {
  ctx.fillStyle = 'rgba(8,12,38,0.45)';
  ctx.fillRect(0, 0, VIEW_W * CW, VIEW_H * CH);
  ctx.globalCompositeOperation = 'lighter';
  for (let sy = 0; sy < VIEW_H; sy++) for (let sx = 0; sx < VIEW_W; sx++) {
    const tl = tileAt(cam.x + sx, cam.y + sy);
    const lit = tl.t === 'campfire' || (tl.t === 'beacon' && G.beaconDay) || tl.burning;
    if (!lit) continue;
    const cx = sx * CW + CW / 2, cy = sy * CH + CH / 2;
    const rad = CW * (tl.t === 'beacon' ? 9 : 5);       // ← only TWO distinct radii ever
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);   // ← alloc per lit tile per frame
    grad.addColorStop(0, 'rgba(255,150,50,0.22)');
    grad.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}
```

`rad` takes exactly two values (`CW·9` for the Beacon, `CW·5` for every other
fire), because `CW` is a constant (`CELL_W = 11`, `js/data.js:5`). A
`CanvasGradient`'s stops are fixed at creation but its **geometry is resolved
against the current transform at fill time** — so one gradient built at a fixed
local origin can be reused at any tile by translating the context. That is the
whole cache (Design step 2).

## Design (decided here, executed below)

Three independent optimizations behind one measurement harness. Each is
correctness-preserving on its own; together they make an idle/paused frame do
near-zero canvas work.

### The two-clock split (fixes idle animation churn)

Introduce a **world-animation clock `wf`** alongside the existing UI clock `f`.

- `f` (unchanged): advances **every** rAF frame; keeps driving all buffer/UI
  blinkers (`‖ PAUSED`, raid/alarm, title flame, menu selection). Passed to
  screen `draw(f)` exactly as today.
- `wf` (new): advances **only when `simActive()`** — i.e. frozen while paused,
  under a `pausesSim` modal, on game-over, and on menus (where there is no
  world). Passed to the world painters (`drawMapTiles`, `drawWorldAscii`) in
  place of `f` for their **animation indexing only** (campfire/water/flame/
  beacon/blink). This makes a paused world a still tableau — the desired
  behavior and the precondition for skipping its repaint.

Wiring: `renderFrame` gains a second arg → `renderFrame(f, wf)`; it passes `f`
to screen `draw()` (buffer/UI) and threads `wf` to the world painters. The
game screen registers `gfx.setWorldPainter((ctx, worldFrame) => drawMapTiles(ctx, worldFrame))`
and calls `drawWorldAscii(worldFrame)` — `paint()` invokes the world painter
with `wf`, not `f`. **No animation is deleted; two are decoupled.**

### Dirty-cell compositing (fixes the full-grid repaint)

`gfx` keeps a **presented snapshot** — `prevChs/prevFgs/prevBgs`, three arrays
of length `N`, holding what is currently on the canvas. `paint()` becomes:

1. Decide `worldChanged` (the world/sprite layer must be re-rasterized):
   `true` if a full repaint was requested (`requestFull()` pending), or the
   world layer's inputs changed this frame. The caller supplies this as a
   boolean `worldDirty` arg to `paint()` (main.js computes it — see below),
   because the sprite layer is opaque canvas the compositor cannot diff.
2. **If `worldChanged`** → the current full path (clear `(A)`, world painter
   `(B)`, then paint **all** cells `(D)`), then copy buffer → `prev*`. This is
   today's behavior exactly; a changing world costs what it costs now.
3. **If not `worldChanged`** → the world/sprite pixels on the canvas are still
   valid; **skip `(A)` and `(B)`**. Diff the buffer against `prev*`; for each
   cell where `chs/fgs/bgs` differ, repaint just that cell (fill its bg — see
   the rule below — then its glyph) and update `prev*[i]`. If **zero** cells
   differ, return without touching the canvas at all (the fully-idle frame).
   If ≥1 cell was painted and an `overlayPainter` is registered, invoke it
   afterward (one small `drawImage`, idempotent — portraits do not animate
   per-frame).

`(C)` (font + text alignment) is constant: hoist it to a one-time setup in
`setupCanvas` (and re-assert on the full path for safety), so it is not
re-parsed on partial frames.

**The DEFAULT_BG-under-sprite rule** (the one correctness hazard): on a partial
frame a dirty cell whose **new** background is `DEFAULT_BG` while a
`worldPainter` is registered (tiles mode) cannot be repainted in isolation —
filling it would paint over the sprite, skipping it would leave a stale glyph.
This happens only when a transient opaque overlay clears back to transparent
over the map (a `drawNotice`/`drawTip` expiring by wall-clock while paused —
`js/screens.js:32-37,39-56`). **Handling**: if the diff finds any such cell,
promote the frame to a full repaint (fall to path 2). Cheap to detect, rare to
trigger, impossible to get a sprite-bleed from. In ASCII mode `worldPainter` is
null and every map cell is rewritten each frame with an explicit opaque bg, so
the rule never fires and erase-to-`DEFAULT_BG` is a normal opaque repaint.

### Cached night gradients (fixes per-frame allocation)

Cache one `CanvasGradient` per radius bucket (there are two) built at a fixed
local origin, and paint each lit tile by translating the context:

```js
// in js/tiles.js, module scope
const nightGrad = new Map(); // rad -> CanvasGradient, built once against origin (0,0)
function litGrad(ctx, rad) {
  let g = nightGrad.get(rad);
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 2, 0, 0, rad);
    g.addColorStop(0, 'rgba(255,150,50,0.22)');
    g.addColorStop(1, 'rgba(255,150,50,0)');
    nightGrad.set(rad, g);
  }
  return g;
}
```

Fill site (inside the night loop, replacing the per-tile `createRadialGradient`
block): `ctx.translate(cx, cy); ctx.fillStyle = litGrad(ctx, rad);
ctx.fillRect(-rad, -rad, rad * 2, rad * 2); ctx.translate(-cx, -cy);` — under
the already-set `'lighter'` composite op, translating and untranslating by the
same delta is exact and needs no `save/restore`. Result is **pixel-identical**
(same stops, same geometry, same center) with allocations dropping from
"lit-tiles × frames" to **≤ 2 total for the process**. The cache is context-
lifetime; `setupCanvas` creates the context once and never swaps it, so the
gradients never dangle. (If a future change recreates `ctx`, clear the map
there — noted in Maintenance.)

### How `main.js` computes `worldDirty`

The world/sprite layer changes only from **the sim advancing** or **input**;
never from wall-clock alone (night/winter/growth/entity moves all flow through
`advanceMinute`). So:

```
worldDirty = fullRequested            // requestFull(): screen change, mode/minimap toggle, resize, first frame
          || simSteppedThisFrame      // advanceMinute ran ≥1× this frame
          || wfAdvancedThisFrame       // wf changed (⇔ simActive; keeps live animation repainting)
          || inputSinceLastPresent     // any pointer/key/wheel/gamepad event since the last frame
```

`inputSinceLastPresent` is a coarse, safe signal: an `inputEpoch` counter
bumped in the DOM dispatchers (`dispatchKey`, `dispatchClick`, hover/drag/pan,
gamepad) — any camera pan, cursor move, selection drag, designation, or build
placement is an input, so the sprite layer (which owns the tiles-mode cursor,
marquee, ghosts) is correctly redrawn. Between input, sim ticks, and animation
ticks — i.e. genuine idle/pause — `worldDirty` is `false` and the world is
skipped. When 023 lands, its shared loop helper is the natural home for this
epoch/flag; until then it lives in `main.js` + a `gfx.requestFull()` export.

**Note when `worldDirty` is true but the *buffer* is unchanged** (unpaused,
sim running, world animating, but no UI cell moved): path 2 runs a full paint —
same as today. The win is specifically the **paused/idle** regime, which is the
entire point of P1-9.

### Measurement harness (required — before/after numbers are a deliverable)

Behind an off-by-default flag (mirroring the `window.ff` debug-hook
convention, AGENTS.md), `gfx` maintains counters and `main.js` exposes them:

```js
// js/gfx.js
export const GFXPERF = { on: false, frames: 0, presented: 0, worldRepaints: 0,
                         cellsPainted: 0, gradsAllocated: 0, ms: 0 };
```

`paint()` (when `GFXPERF.on`) increments `frames`, `presented` (frames that
touched the canvas), `worldRepaints` (full path taken), `cellsPainted` (dirty
cells repainted), and accumulates `ms` via `performance.now()` around the body;
`litGrad` increments `gradsAllocated` on a cache miss. `main.js` exposes
`window.GFXPERF = GFXPERF` next to `window.ff`, plus
`window.gfxperf = (on = true) => { Object.assign(GFXPERF, { on, frames:0,
presented:0, worldRepaints:0, cellsPainted:0, gradsAllocated:0, ms:0 }); }`.
When `on` is `false`, `paint()` touches none of it (one boolean check) — zero
overhead in normal play.

**Before/after protocol** (numbers recorded in Step 7 / the PR body):
`pnpm dev`, start a run, `gfxperf(true)`, let ~600 frames elapse in each of:
(a) **paused idle**, (b) **night raid running**, (c) **menu**. Read
`window.GFXPERF`. Expected shape of the win:

- (a) paused idle: `presented`/`frames` → near 0 (only blinker frames present),
  `worldRepaints` → ~0, `cellsPainted` per present ≪ 4500, `gradsAllocated` → 0.
- (b) night raid: `worldRepaints` ≈ `frames` (world genuinely animating — no
  regression), but `gradsAllocated` ≤ 2 total (was: lit-tiles × frames), and
  `ms`/frame **lower** than the pre-change baseline for the same scene.
- (c) menu: `presented`/`frames` near 0 between blinks.

Record the pre-change baseline by running the protocol on `HEAD~1` (or by
stubbing the flag in before wiring the skips).

## Commands you will need

| Purpose   | Command                              | Expected on success   |
|-----------|--------------------------------------|-----------------------|
| Install   | `pnpm install`                       | exit 0                |
| Tests     | `pnpm test`                          | all pass              |
| One file  | `pnpm vitest run test/gfx.test.js`   | that file passes      |
| Typecheck | `pnpm check`                         | exit 0                |
| Lint      | `pnpm lint`                          | exit 0                |
| Play      | `pnpm dev` → http://localhost:8137   | manual checklist, Step 7 |

Debug hooks for manual/measurement work: `window.G`, `window.ff(minutes)`,
`window.GFXPERF`, `window.gfxperf(true)` (this plan) — see AGENTS.md.

## Scope

**In scope**:
- `js/gfx.js` — `paint()` rewrite (dirty diff + `prev*` snapshot +
  `worldDirty` arg), `requestFull()`, `GFXPERF`, one-time font setup in
  `setupCanvas`.
- `js/main.js` — `wf` clock, `worldDirty` computation, `renderFrame(f, wf,
  worldDirty)` call, `window.GFXPERF`/`window.gfxperf` hooks.
- `js/ui.js` — `renderFrame(f, wf, worldDirty)` signature + threading `wf` to
  world painters; `inputEpoch` bumps in the DOM dispatchers;
  `push`/`pop`/`replaceAll` call `gfx.requestFull()`.
- `js/tiles.js` — night gradient cache (`litGrad`); `drawMapTiles` animation
  indices read the world frame arg (already `f`-named — just fed `wf`).
- `js/mapdraw.js` — `drawWorldAscii` animation indices read the world frame arg.
- `js/screens.js` — game screen registers the world painter with the world
  frame; `toggleGfx`/`toggleMinimap` sites trigger `requestFull()`.
- `test/gfx.test.js` (create) — compositor unit tests (headless 2D-context
  stub).
- `plans/README.md` — move P1-9 out of "rejected", add the status row.

**Out of scope** (do not touch):
- Any sprite art, color, gradient stop, radius, or timing constant — **zero
  visual change** is the contract. The night glow must be pixel-identical.
- The sim, save shape, balance, or any `G` field that persists (the `wf`
  clock and `inputEpoch` are render-loop locals / module state, never saved —
  cf. `EPHEMERAL`, `js/save.js`).
- Fit-to-window / grid-size changes (rejected, `plans/README.md:51-53`).
- The two-renderer parity rule stands: both paths get the same `wf` treatment.

## Git workflow

- **On `main`, no feature branch** (sequential execution model). Commit per
  step, imperative messages ("Cache night radial gradients by radius").
- Each commit is a checkpoint: `pnpm check && pnpm lint && pnpm test` green.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

Ordered so each step is independently shippable and independently verifiable —
if a later step must be reverted, the earlier wins survive. Steps 1 and 2 are
the low-risk, self-contained wins; Step 3 is the invasive compositor change.

### Step 1: Night gradient cache (`js/tiles.js`) — smallest, pixel-identical

Add the `nightGrad` map + `litGrad(ctx, rad)` at module scope (Design). In the
night loop (`js/tiles.js:508-519`), replace the per-tile
`createRadialGradient`+`addColorStop`×2 with the translate/`litGrad`/fill/
untranslate form. Leave every constant (`2`, `rad`, the two `rgba` stops, the
`9`/`5` radius multipliers, the `'lighter'` op) **byte-for-byte unchanged**.

**Verify**:
- `pnpm check && pnpm lint` → exit 0.
- Manual: `pnpm dev`, run to night with a campfire and the lit Beacon in view;
  the warm glow is visually identical (compare against a screenshot taken
  before the edit — this is the pixel-identity gate). `gfxperf(true)`, ~300
  night frames, `GFXPERF.gradsAllocated` ≤ 2.

### Step 2: The two-clock split (`js/main.js`, `js/ui.js`, `js/tiles.js`, `js/mapdraw.js`, `js/screens.js`)

Introduce `wf` in the rAF loop (`js/main.js`): `let f = 0, wf = 0;` and, inside
`frame()`, `if (simActive()) wf++;` (place after the `simActive()` sim block so
it reads the same predicate). Change `renderFrame(f)` → `renderFrame(f, wf)`
(the `worldDirty` arg arrives in Step 3; add it now as a 3rd param defaulting
to `true` so behavior is unchanged until Step 3 wires it).

`renderFrame(f, wf, worldDirty = true)` (`js/ui.js`): pass `f` to screen
`draw(f)` unchanged; thread `wf` into `gfx.paint` so the world painter receives
it. Simplest seam: `gfx.paint(wf)` and have the game screen register
`setWorldPainter((ctx, worldFrame) => drawMapTiles(ctx, worldFrame))` — since
`paint` already calls `worldPainter(ctx, f)`, renaming the value it forwards to
`wf` routes the world clock correctly while the buffer (built by `draw(f)`)
keeps `f`. For the ASCII path, `screens.js:436` becomes `drawWorldAscii(wf)`;
`draw(f)` receives both via a small change (pass `wf` on the screen, or extend
the `draw` signature to `draw(f, wf)` — pick the lower-churn option given
whatever 022/023 did to `screens.js`; if unsure, stash `wf` on a module the
game screen reads).

No animation constant in `drawMapTiles`/`drawWorldAscii` changes — they already
call their parameter `f`; it is now fed `wf`.

**Verify**:
- `pnpm check && pnpm lint && pnpm test` → all green.
- Manual: unpaused, campfires/water flicker exactly as before (wf advances with
  sim). **Pause** (Space): world freezes (no campfire flicker) **but** the
  `‖ PAUSED` label still blinks and raid/alarm sidebar blinkers still animate.
  Open a `pausesSim` modal over the game: world frozen, modal's own selection
  blink still animates. Title screen: flame still animates (menu is `f`, no
  world). This step alone is a visible behavior change **only while paused**
  (frozen world) — confirm that is acceptable per "screenshot-stable pause";
  it is the intended precondition for Step 3.

### Step 3: Dirty-cell compositing (`js/gfx.js`, `js/main.js`, `js/ui.js`)

**`js/gfx.js`**:
- Add `prevChs/prevFgs/prevBgs` (length `N`), a `let full = true;` flag,
  `export function requestFull() { full = true; }`, and `GFXPERF`.
- Hoist font/`textAlign`/`textBaseline` into `setupCanvas` after `getContext`
  (and re-assert them on the full path).
- Rewrite `paint(f)` → `paint(worldFrame, worldDirty)` per Design paths 1–3,
  including the DEFAULT_BG-under-sprite promotion to full, `prev*` maintenance,
  the `full` one-shot (consume it: `const doFull = full || worldDirty; full =
  false;`), and `GFXPERF` accounting.

**`js/main.js`**: compute `worldDirty` (Design): track `simStepped` (set true
if the sim `while`-loop ran ≥1 iteration this frame), `wf` advance, and an
`inputEpoch` read (`ui.js` export); OR-in a first-frame `true`. Pass through
`renderFrame(f, wf, worldDirty)`. Expose `window.GFXPERF`/`window.gfxperf`.

**`js/ui.js`**: add `inputEpoch` (exported getter or value) bumped in
`dispatchKey`, `dispatchClick`, the mousemove hover/drag and pan branches, and
wheel; import into `main.js`. Bump/`gfx.requestFull()` in `push`/`pop`/
`replaceAll` (a stack change must force a full frame). Thread `worldDirty` from
`renderFrame` into `gfx.paint`.

**`js/screens.js`**: ensure `toggleGfx` and `toggleMinimap` (menu items at
`:77,804` and the sidebar minimap toggle) call `gfx.requestFull()` — a renderer
or minimap-visibility switch invalidates the presented snapshot.

**Verify**:
- `pnpm check && pnpm lint && pnpm test` → all green.
- `pnpm vitest run test/gfx.test.js` (Step 4) → green.
- Manual: the full Step 7 checklist. Watch `GFXPERF` during paused idle:
  `presented ≪ frames`, `worldRepaints ≈ 0`, `cellsPainted` small.

### Step 4: `test/gfx.test.js` — compositor unit tests

Create with a headless canvas-2D stub (a recording fake `ctx`: `fillRect`,
`fillText`, `createRadialGradient` returning a stub with `addColorStop`,
`translate`, `save`/`restore`, settable `fillStyle`/`font`). Stub
`localStorage` before importing `js/gfx.js` (the module reads `hearthfall.gfx`
at import, `js/gfx.js:20`). Tests:

1. **Full frame paints all non-empty cells**: after `clear()`, `str(0,0,'HI',
   '#fff','#123')`, `paint(0, true)` → the fake records ≥1 `fillText('H')` and
   a `fillRect` for the two opaque cells; `requestFull` consumed.
2. **Clean frame is a no-op**: repaint identical buffer with `paint(0, false)`
   → **zero** `fillText`/`fillRect` recorded (fully-idle skip).
3. **One-cell change repaints one cell**: change a single cell, `paint(0,
   false)` → exactly one glyph/one bg `fillRect` recorded, not 4500.
4. **`worldDirty` forces the full path**: with an unchanged buffer,
   `paint(0, true)` still walks all cells (records the full-frame count).
5. **DEFAULT_BG-under-sprite promotion**: register a `worldPainter`; present an
   opaque cell; next buffer reverts it to `' '`/`DEFAULT_BG`; `paint(0, false)`
   → the frame promotes to full (world painter invoked) rather than leaving a
   stale glyph.
6. **`requestFull()` triggers exactly one full frame**, then reverts to
   incremental.
7. **Night gradient cache** (import `litGrad` or exercise via a `drawMapTiles`
   harness if practical): two distinct radii → `createRadialGradient` called
   at most twice across many calls; a stub asserts the returned gradient is
   reused.

**Verify**: `pnpm vitest run test/gfx.test.js` → all pass; `pnpm test` → whole
suite green.

### Step 5: measurement capture (the required before/after numbers)

Run the Design → "Before/after protocol" on the pre-change baseline (git-stash
the working tree or checkout the step-0 commit) and on the final tree. Record
the six numbers (paused idle, night raid, menu × {presented/frames, ms/frame,
gradsAllocated}) into the Step 6 commit message and, if a PR is opened, its
body. **A missing before/after is an incomplete plan** (STOP condition 5).

### Step 6: `plans/README.md`

- Remove the "Renderer idle cost (roadmap P1-9)" bullet from **"Findings
  considered and rejected"** (`plans/README.md:45-47`) — it is no longer
  rejected.
- Add the execution-order row (in numeric position):
  `| 025 | Renderer idle cost: dirty-cell compositing + cached night gradients | P1-9 | P3 | M | 023 (rec.) | DONE |`
- Under "Dependency notes", one line: P1-9 landed as an efficiency pass with
  zero visual change; the measurement harness (`window.gfxperf`) stays as the
  regression tripwire for future renderer work.

**Verify**: `git diff plans/README.md` shows only those edits.

### Step 7: manual visual-parity checklist (the zero-visual-change gate)

Screenshot-compare **before vs after** each scene (identical seed via a fresh
run is fine for structure; the gate is "no rendering artifact / no changed
pixel in steady state"). Both renderers (`v` / Graphics toggle) for the map
scenes:

- [ ] **Paused idle** — Space to pause; world is a still frame; `‖ PAUSED`
      still blinks; `GFXPERF` shows near-zero presents between blinks.
- [ ] **Night raid** — `ff` to a night raid; warm glows around fires/Beacon
      identical to before; raiders animate; `gradsAllocated` ≤ 2.
- [ ] **Camera pan** — middle-drag / wheel / arrows: map redraws crisply, no
      trails, no stale cells (input forces `worldDirty`).
- [ ] **Modal open/close** — pause menu, orders, trade, help: opening/closing
      leaves no ghost cells; game screen beneath is intact on close.
- [ ] **Title / civ / legacy screens** — flame and selection blinkers animate;
      navigating in and out (screen transitions) shows no stale buffer.
- [ ] **Notice/tip expiry while paused** — trigger a notice, pause, let it
      expire: it clears cleanly over the map (the DEFAULT_BG promotion path).
- [ ] **Renderer + minimap toggles** — `v` and minimap on/off: instant, no
      artifact (both call `requestFull`).

**Verify**: every box checked; `git status` shows only in-scope files.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/gfx.test.js` ~7 unit
tests (full/clean/partial/forced/promotion/requestFull/gradient-cache) over a
recording 2D-context stub; the rest of the suite untouched and green; the
manual checklist (Step 7) is the visual-parity gate; the `GFXPERF` numbers
(Step 5) are the quantitative gate.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/gfx.js` tracks a `prev*` snapshot; `paint()` skips a clean frame
      entirely and repaints only dirty cells on a world-static frame —
      `grep -n "prevChs\|requestFull\|worldDirty" js/gfx.js` all present
- [ ] Night gradients allocated ≤ 2 for the process —
      `grep -n "createRadialGradient" js/tiles.js` shows the **cache builder
      only** (`litGrad`), not the per-tile loop body
- [ ] World animation freezes on pause, UI blinkers do not —
      `grep -n "wf++" js/main.js` present; `‖ PAUSED` still on `f`
      (`js/screens.js` unchanged for that line)
- [ ] `window.GFXPERF` / `window.gfxperf` exposed; counters no-op when `off`
- [ ] Before/after numbers recorded for paused-idle, night-raid, menu (Step 5)
- [ ] Manual checklist (Step 7) fully checked — zero visual change confirmed
      in both renderers
- [ ] `plans/README.md`: P1-9 removed from "rejected", status row added
- [ ] `git status` shows only in-scope files

## STOP conditions

1. Any "Current state" excerpt no longer matches the code (drift) — the
   drift-check at the top missed a mid-sequence edit; re-derive the seam by
   symbol and report before coding the compositor rewrite.
2. **Any visual difference** appears in Step 1 or Step 7 that is not a
   deliberate frozen-on-pause world (sprite-bleed, stale glyph, trail, changed
   glow, off-by-one cell) — this plan's contract is zero visual change; report
   the scene, do not ship a "close enough" render.
3. `paint()` cannot be made incremental without knowing whether the world
   layer changed — i.e. some code path mutates the sprite/ASCII map from
   wall-clock time (not `advanceMinute`, not input). If you find one, the
   `worldDirty` model is incomplete: report it (the fix is to route that
   mutation through the dirty signal, not to widen the skip).
4. The two-clock split breaks a blinker that **should** keep animating while
   paused (the audit says the only such things are buffer/`f` blinkers — if a
   world-layer element turns out to need live animation on pause, e.g. a design
   decision that fires stay lit-and-flickering while paused, STOP: that is a
   design call, not an implementation detail).
5. The before/after measurement (Step 5) shows **no improvement** in the
   paused-idle or night-raid regime, or a **regression** in the running-game
   `ms`/frame — the optimization did not land; report the numbers rather than
   claiming done.
6. An import cycle or a `pnpm check` failure appears from the new `gfx` ↔
   `main`/`ui` wiring — report rather than inverting a dependency.

## Maintenance notes

- **The zero-visual-change contract is permanent**: any future edit to
  `paint()`, the gradient cache, or the two clocks must re-run the Step 7
  parity checklist. `window.gfxperf` is the standing regression tripwire —
  keep it.
- **`worldDirty` is a living invariant**: the sprite/ASCII layer may change
  only via `advanceMinute` (sim) or input. Anyone who adds a **wall-clock**
  world animation (e.g. idle ambient shimmer that runs while paused) must feed
  it into the dirty signal (or advance `wf` for it) — otherwise it will be
  skipped. The `wf++` line in `js/main.js` and the `inputEpoch` bumps in
  `js/ui.js` are the two seams to touch.
- **Gradient cache is context-lifetime**: `setupCanvas` creates `ctx` once. If
  a future change recreates the 2D context (resize-with-new-canvas, offscreen
  swap), clear `nightGrad` there — a `CanvasGradient` is bound to the context
  that made it.
- **Plan 023 handoff**: if 023 lands after this, migrate the ad-hoc
  `inputEpoch`/`requestFull`/`worldDirty` plumbing in `main.js`/`ui.js` onto
  023's shared loop helpers (search `// TODO(023)`), keeping behavior
  identical.
- **Deferred deliberately**: OffscreenCanvas / worker rendering, per-cell
  damage rectangles coarser than 1×1, and diffing the sprite layer itself
  (would need a tile-hash) — all overkill for a P3 whose whole justification is
  battery/thermal on idle frames. Do not gold-plate.
</content>
</invoke>
