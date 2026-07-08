# Plan 028: Touch support spike (P5-4)

> **Executor instructions**: This is a **timeboxed spike**, not a feature
> build. Each stage below is independently shippable and ends with a STOP
> gate: if the interaction feels wrong on a real touch device, stop, write
> down what you learned, and ship what already feels right — do not push
> through a bad-feeling stage to "finish the plan". Run every verification
> command and confirm the expected result before moving on. If a code STOP
> condition fires, stop and report. When done (or timed out), update the
> status row for this plan in `plans/README.md`.
>
> **Execution model**: plans run **sequentially, on `main`, in numeric
> order** (`plans/README.md` Dependency notes). This is the **last** plan in
> the pipeline — every HP0 feature and every P1 enablement plan has already
> landed by the time this runs. In particular plan 009 (screens split) is
> done, so `js/screens.js` is now "the game screen" and the modals live in
> `js/ui/modals.js`.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/ui.js js/gfx.js js/screens.js js/gamepad.js js/mobile.js index.html style.css`
> Every excerpt below is anchored at `14fd915` and cited by line. After nine
> intervening plans those numbers **will** have moved — **re-locate every
> symbol by name** (`grep -n "function canvasCell" js/gfx.js`, etc.), not by
> line. The DOM-input plumbing (`setupInput`, `canvasCell`) is the load-
> bearing surface and plan 009 explicitly leaves `js/ui.js` untouched, so it
> should still read as below; if it does not, re-ground before cutting.

## Status

- **Priority**: P3
- **Effort**: L (spike — the L is the number of stages and the device
  testing, not the size of any one diff; several stages are ~20 lines)
- **Risk**: MEDIUM (new input path on a surface with **zero** unit coverage;
  the mitigation is that the coordinate transform is already input-agnostic,
  each stage is dormant until the gate flips, and desktop mouse/wheel/right-
  click must survive every stage unchanged)
- **Depends on**: 009 (screens split — the game-screen input handlers and the
  new canvas toolbar land in the post-009 `js/screens.js`; modal wiring in
  `js/ui/modals.js`). The DOM-event plumbing this plan extends lives in
  `js/ui.js`, which 009 does not touch.
- **Category**: feature/spike (delivery wedge — "instant, anywhere")
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: P5-4 (`ROADMAP.md:155`, delivery-wedge column
  `ROADMAP.md:62`; plan-number mapping `ROADMAP.md:197` — "028 … P5-4").

## Why this matters

The roadmap's delivery thesis is "instant, anywhere" (`ROADMAP.md:62`), and
right now "anywhere" has a hard edge: **coarse-pointer devices never see the
game at all.** They get a static landing page. Two facts, both verified:

- **Zero touch handlers exist.** `grep -rn
  "touchstart\|touchmove\|touchend\|pointerdown\|pointermove\|pointerup\|PointerEvent\|TouchEvent"
  js/ index.html` → no matches. Every input path is mouse, wheel, keyboard,
  or Gamepad (`js/ui.js:87-159`, `js/gamepad.js`).
- **The game is gated out by CSS, not by JS.** `js/main.js:9-13` calls
  `setupCanvas`/`setupInput` and starts the rAF loop **unconditionally** — the
  sim is fully alive on a tablet. What hides it is one media query
  (`style.css:97-100`): `canvas { display: none }` +
  `#mobile-gate { display: block }`. `js/mobile.js:87` keys on the **same**
  query (`GATE_MQ`, `js/mobile.js:8`) but only to draw the landing art — it
  does not gate the game. So the entire enablement is "flip a media query and
  give the canvas something to do with a finger."

P5-4's owner constraint makes the scope tractable: the fixed **100×45 /
1100×855** CRT-aspect canvas is now a **design constant** (`js/gfx.js:6`
`GRID_W = 100, GRID_H = 45`; `js/data.js:5` `CELL_W = 11, CELL_H = 19`
→ 1100×855 CSS px; "fixed 100×45 CRT container is part of the game's
identity … Do not re-propose" — `plans/README.md` findings). That means **no
responsive relayout**: tablets get the existing letterboxed fixed-aspect
canvas (`style.css:13-16`, `max-width: 100vw; max-height: 100vh`), and
**phones stay out of scope** — the landing page remains for screens too small
to render 100 columns legibly (`ROADMAP.md:155`). The whole spike is: make a
finger drive the canvas the mouse already drives, then let tablets in.

## Current state

### The coordinate transform already accepts a finger (the key finding)

`canvasCell` is the single pixel→cell function every pointer path uses, and it
is **input-agnostic** — it reads only `clientX`/`clientY` off the event:

```js
// js/gfx.js:43-49
export function canvasCell(e) {
  const r = canvas.getBoundingClientRect();
  return {
    cx: Math.floor((e.clientX - r.left) / r.width * GRID_W),
    cy: Math.floor((e.clientY - r.top) / r.height * GRID_H),
  };
}
```

`getBoundingClientRect()` returns the **rendered CSS box** — i.e. the
letterbox-scaled size, since the canvas style size is a fixed 1100×855
(`js/gfx.js:37-38`) and CSS shrinks it to fit the viewport (`style.css:14-15`).
Dividing by `r.width`/`r.height` therefore cancels both the letterbox scale
**and** devicePixelRatio: DPR only inflates the backbuffer
(`canvas.width = GRID_W * CELL_W * dpr`, `ctx.scale(dpr, dpr)`,
`js/gfx.js:34-40`), never the CSS box `canvasCell` measures. **A `Touch` and a
`PointerEvent` both expose `clientX`/`clientY`**, so `canvasCell(touch)` and
`canvasCell(pointerEvent)` already return correct cells with **no math
change**. This is what makes the spike cheap — verify it holds before
building on it.

### How mouse input flows today (`js/ui.js:87-159`, `setupInput`)

All DOM input is wired once in `setupInput(canvas)`, called from
`js/main.js:11`. The handlers:

| Event (target) | Lines | Behavior |
|---|---|---|
| `keydown` (window) | 91-95 | `dispatchKey`; swallows OS chords (ctrl/meta/alt) |
| `contextmenu` (canvas) | 97-100 | `preventDefault` → `dispatchKey('Escape')` — **right-click = back/cancel** |
| `wheel` (canvas) | 102-110 | `preventDefault` → `s.pan(dx, dy)`; `{ passive: false }`; deltaMode-aware |
| `mousedown` (canvas) | 112-123 | button 1 + `s.pan` → start `panDrag`; button 0 → `dragging = dispatchClick(c)` |
| `mousemove` (canvas) | 125-141 | `panDrag` → `s.pan`; else `s.onHover(c)` + `s.onDrag(c)` while `dragging` |
| `mouseup` (window) | 143-149 | if `dragging` → `s.onRelease()`; clear `dragging`/`panDrag` |
| `mouseleave` (canvas) | 150-158 | if `dragging` → `s.onRelease()`; `s.onHover(null)` |

`dispatchClick(c)` (`js/ui.js:52-66`) hit-tests declared widget rects
top-down; a hit calls `w.onClick`/`w.onActivate` and returns `false` (no map
drag), a miss calls `s.onClick(c)` and returns `true` (a map drag may follow).
This is the routing every new pointer path should feed — **do not invent a
parallel dispatch.**

### The game-screen input model (`js/screens.js`, post-009 "the game screen")

The pointer surface the finger must reach lives in `makeGameScreen`:

- **`onClick(c)`** (`js/screens.js:408-413`): NORMAL mode anchors a selection
  box `G.sel = { ax, ay, bx, by }` (no `kb` flag); tool modes `paintCell`.
- **`onDrag(c)`** (414-419): NORMAL stretches `G.sel.bx/by`; tool modes
  `paintCell(..., true)`.
- **`onRelease()`** (420-422): NORMAL + a non-`kb` box → `resolveSelection()`.
- **`onHover(c)`** (423-430): sets `G.cursor` to the hovered cell.
- **`pan(dx, dy)`** (431): `panCam(dx, dy)`.

Supporting free functions (all stay in `js/screens.js` per plan 009's
inventory): `moveCursor` (237-251, moves `G.cursor`, pans the camera at the
viewport edge), `paintCell` (253-257), `clickInteract` (261-268 — trader →
trade modal, workshop → workshop modal, unlit beacon → beacon modal, settler →
`cycleRole`; the immediate-action set), `resolveSelection` (272-287 — one-cell
box falls back to `clickInteract`, otherwise opens the orders menu).

### The gamepad "virtual cursor" is `G.cursor` + Enter — reuse it, don't reinvent

Critical for Stage 2: **the gamepad has no cursor object of its own.** It
translates buttons into virtual keys via `dispatchKey` (`js/gamepad.js:19,
30-79`) — the "virtual cursor" the roadmap refers to is `G.cursor`, driven by
`ArrowUp/Down/Left/Right → moveCursor` (`js/screens.js:392-395`) and confirmed
by **Enter**. `aButtonKey` (`js/gamepad.js:26-28`) resolves the A button to
`'Enter'` in every mode except a build drag. The Enter flow is a two-press
model already:

```js
// js/screens.js:396-405 (NORMAL mode, abridged)
if (k === 'Enter' || k === 'Paint') {
  if (!inMap(G.cursor.x, G.cursor.y)) { moveCursor(0, 0); return; }
  const cx = G.cursor.x, cy = G.cursor.y;
  if (G.mode !== 'NORMAL') { paintCell(cx, cy, k === 'Paint'); return; }
  if (k === 'Paint') return;
  if (G.sel) { resolveSelection(); return; }            // second press: confirm
  if (clickInteract(cx, cy)) return;                    // immediate act on a thing
  G.sel = { ax: cx, ay: cy, bx: cx, by: cy, kb: true }; // first press: anchor a box
  notice('Selecting — arrows stretch, Enter assigns, Esc cancels');
}
```

**Tap-to-move-cursor + tap-again-to-confirm is exactly this loop**: a tap
places `G.cursor` at the tapped cell (an absolute `moveCursor`, not a relative
one), then dispatches the **same `'Enter'` key** the gamepad emits. First tap
on empty ground moves the cursor and anchors a `kb` box; a second tap on the
same cell confirms via `resolveSelection`/`clickInteract`. This reuses the
existing model verbatim — there is **no third input model** to design, only a
tap→cursor→Enter adapter.

### The gate today (two copies of one query — a gotcha)

The identical media query lives in **two** places and must move together:

```css
/* style.css:97-100 */
@media (max-width: 899px), ((pointer: coarse) and (max-width: 1200px)) {
  canvas { display: none; }
  #mobile-gate { display: block; }
}
```

```js
// js/mobile.js:8
const GATE_MQ = '(max-width: 899px), ((pointer: coarse) and (max-width: 1200px))';
```

Read literally: the game is hidden when the viewport is **≤ 899px wide**, OR
when the pointer is **coarse and ≤ 1200px wide**. So a touch tablet is
admitted *today* only above 1200px (e.g. iPad Pro 12.9" landscape at 1366) —
and even there it gets no touch handlers, so it is unplayable. Enablement
(Stage 6) is to relax the coarse clause so mid-size tablets qualify, keyed on
the **shorter viewport side** so a rotation does not bounce a mid-session
tablet back to the landing page. The honest phone/tablet separator: phones
have a short side ≤ ~430px (portrait width, or landscape height); tablets
start at ~744–768px (iPad mini portrait 744). A cutoff on `min(vw, vh)`
anywhere in **700–768px** cleanly splits them.

### The binding table (Stage 5 toolbar source)

The canonical key list is the help modal (`makeHelpModal`, moved to
`js/ui/modals.js` by plan 009; excerpt from `js/screens.js:1012-1043` at
`14fd915`): `space` pause, `1/2/3` speed, `b` build, `x` demolish, `r` alarm,
`w` world, `e` trade, `Esc` pause menu, `?` help, `v` gfx, `n` minimap, `Q`
save & quit. The four with **no touch equivalent** after Stages 2-4 (they are
keyboard-only actions, not map gestures) are **pause, alarm, build, help** —
the minimal toolbar set P5-4 names. Their handlers, for the toolbar's
`onClick`s (all in the game screen's `onKey`, `js/screens.js`): pause
`G.paused = !G.paused` (367), build `G.mode = 'BUILD'; G.buildSel = null`
(382), alarm `toggleAlarm()` (384), help `push(makeHelpModal())` (368).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| All gates | `pnpm check && pnpm lint && pnpm test` | exit 0; suite green |
| Dev server | `pnpm dev` → http://localhost:8137 | game loads |
| Touch preview (no gate flip yet) | Chrome DevTools → device toolbar → a tablet preset (e.g. iPad Air) **with** touch emulation; during the spike force the canvas visible via the `?forcegame` escape hatch (Stage 1) | canvas shows, taps register |
| Real device | serve on the LAN (`pnpm dev --host`), open on an actual tablet | the only trustworthy feel test |

There is **no unit coverage** for DOM input (the suite never imports
`js/ui.js` DOM handlers). Every stage's real gate is the manual feel test on a
touch device; the automated gates only guard against regressing desktop.

## Scope

**In scope**:
- `js/ui.js` — pointer-event handlers alongside the mouse ones (Stages 1-4);
  a one-line `?forcegame` preview hatch (Stage 1, removable)
- `js/screens.js` (the game screen) — an absolute cursor-place helper and the
  canvas toolbar widgets (Stages 2, 5)
- `style.css` + `js/mobile.js` — the gate query, flipped together (Stage 6)
- `plans/README.md` (status row); README/AGENTS one-liners if the input story
  changes (Stage 6)

**Out of scope** (and STOP if a stage pulls you toward them):
- Any responsive/fit-to-window relayout — the 100×45 fixed canvas is a design
  constant (`plans/README.md` findings; do not re-propose).
- **Phone** support — small screens keep the landing page. This spike does not
  make 100 columns legible on a 390px phone; it does not try.
- Pinch-zoom semantics — **pinch is a no-op in v1** (Stage 4). The canvas has
  one fixed scale; there is nothing to zoom.
- Rewriting the mouse handlers — pointer handlers are **added beside** them;
  the wheel and contextmenu paths (scroll-pan, right-click-back) have no
  pointer equivalent and stay exactly as they are.
- A DOM-overlay toolbar — the toolbar is **canvas-drawn buttons in grid
  cells** (CRT constraint; the panel regions are painted at
  `js/screens.js:438-439`). No HTML buttons over the canvas.
- Haptics, long-press menus, gesture libraries — none in a spike.

## Git workflow

- Branch: `advisor/028-touch-spike`
- Commits: one per stage, imperative ("Unify mouse input under pointer
  events"). Each commit is a shippable checkpoint with the three gates green.
- Do NOT push or open a PR unless the operator instructed it.

## Stages

Each stage is a self-contained experiment. Ship it, feel it, then decide
whether the next stage is worth it. **After every stage: `pnpm check && pnpm
lint && pnpm test` green AND a manual desktop pass confirming mouse, wheel,
and right-click are unchanged.**

### Stage 1 — pointer-events unification audit + adopter

**Goal**: prove `pointerdown`/`pointermove`/`pointerup` can subsume the
`button === 0` mouse path without regressing wheel or right-click, and land
that unification. This is the foundation; it is a **no-visible-change** stage
on desktop.

First, **verify the transform claim** (the whole spike rests on it): in the
console with the game up, run
`UI` is exposed (`js/main.js:31`) but `canvasCell` is in `gfx` —
`window.G` and a synthetic check:
`gfx`… simplest is a DevTools breakpoint, or add a temporary log. Confirm
`canvasCell({clientX, clientY})` returns the same cell for a mouse click and a
touch at the same screen point (tablet emulation). If it does **not**, STOP —
every later stage assumes it does.

Then, in `setupInput` (`js/ui.js:112-158`), add pointer handlers that mirror
the mouse ones, guarded so the two do not double-fire:

- Register `pointerdown`/`pointermove`/`pointerup` on the canvas/window (mirror
  the current mouse targets: down/move on canvas, up on window,
  `pointercancel`/`pointerleave` mirroring `mouseup`/`mouseleave`).
- Inside them, read `e.pointerType`. Route **mouse** pointers through the
  existing button semantics (`e.button === 1` → pan drag, `=== 0` →
  `dispatchClick`), and **touch/pen** pointers through `e.button === 0`
  equivalent (primary). `canvasCell(e)` works unchanged — a `PointerEvent`
  has `clientX`/`clientY`.
- To avoid the legacy mouse handlers **and** the new pointer handlers both
  firing for a mouse, pick one owner: the cleanest is to make the pointer
  handlers the single source for down/move/up/leave and **delete** the
  `mousedown`/`mousemove`/`mouseup`/`mouseleave` handlers (pointer events fire
  for mice on every browser this ships to). Keep `wheel` and `contextmenu` as
  mouse handlers — **they have no pointer equivalent** and this stage must not
  touch scroll-pan or right-click-back.
- Call `canvas.style.touchAction = 'none'` (or CSS `touch-action: none` on the
  canvas) so the browser does not steal drags for page scroll/zoom — the page
  itself does not scroll (`html, body { overflow: hidden }`, `style.css:6`),
  but touch gestures still need this to reach `preventDefault`.
- Add the **preview hatch** so Stages 2-5 are testable before the gate flips:
  read `location.search.includes('forcegame')` in `js/main.js` (or a tiny CSS
  class) and, when set, force `canvas { display: block }` / hide the gate.
  This is throwaway scaffolding — note it for removal or keep it as a
  documented debug flag alongside the `window.ff` hooks (`AGENTS.md:19`).

**STOP conditions (Stage 1)**:
- The transform check fails (touch and mouse map to different cells) — the DPR
  or letterbox assumption is wrong; re-derive `canvasCell` before continuing.
- Removing the mouse handlers regresses **any** desktop path: right-click still
  cancels, wheel still pans, middle-drag still pans, left-drag still box-
  selects. If pointer events do not cleanly cover middle-drag pan
  (`e.button === 1`), keep the mouse handlers for buttons 1/2 and add pointer
  handlers only for primary — do not force a unification that loses the
  mouse's extra buttons.

**Verify**: `grep -rn "pointerdown\|pointermove\|pointerup" js/ui.js` shows the
new handlers; desktop mouse/wheel/right-click manually unchanged; gates green.

### Stage 2 — tap-to-move-cursor + tap-again-to-confirm (reuse the gamepad model)

**Goal**: a single tap places the virtual cursor (`G.cursor`) at the tapped
cell; a second tap on that same cell confirms — mapped onto the **existing**
Enter/`G.sel.kb` loop (`js/screens.js:396-405`), not a new one.

- Add an absolute cursor-place helper next to `moveCursor` in `js/screens.js`,
  e.g. `placeCursorAt(x, y)` that sets `G.cursor.x/y` (clamped to
  `MAP_W`/`MAP_H` like `moveCursor`, 243-244) and nudges the camera the same
  way (247-250). This is the tap analogue of a d-pad move.
- In the pointer path, a **tap** on the map viewport (`c.cx < VIEW_W &&
  c.cy < VIEW_H`, matching the `onClick` guard at `js/screens.js:409`) should:
  first tap → `placeCursorAt(cellUnderCam)` and dispatch the game screen's
  `'Enter'` (via `dispatchKey('Enter')`), which anchors the `kb` box; a
  second tap on the **same** cell → another `'Enter'`, which
  `resolveSelection`s. Detect "same cell" from `G.cursor` — a tap elsewhere
  moves the cursor and re-anchors rather than confirming, so a misplaced first
  tap is free to correct.
- Crucially this means Stage 2 **routes taps to the keyboard/gamepad Enter
  path**, reusing `clickInteract` (a tap on a trader/workshop/beacon/settler
  acts immediately, 402/261-268) and `resolveSelection` for free. Do **not**
  route taps to the mouse `onClick` (which anchors a *non-`kb`* box for
  drag) — that is Stage 3's job, and mixing them is how you end up with a
  third input model the roadmap warns against.

Distinguishing a **tap** from a **drag** (Stage 3) is the one new bit of
state: on `pointerdown` record the start cell + time; on `pointerup`, if the
pointer moved ≤ ~1 cell and was brief, it is a tap (Stage 2 path); otherwise
it was a drag (Stage 3 path). Keep the threshold in cells, not pixels, so it
scales with the letterbox.

**STOP conditions (Stage 2)**: if tap-tap-to-confirm feels laggy, ambiguous
against drag, or fights the immediate-action taps (tapping a settler should
cycle its role at once, not require a confirm — that already works via
`clickInteract`), stop and reconsider the tap/drag threshold before adding
more. A confirm model that needs a tutorial has failed the spike.

**Verify**: on tablet emulation (`?forcegame`), tap empty ground → cursor
moves + "Selecting…" notice; tap again → orders menu or "Nothing to assign";
tap a settler → role cycles immediately. Gates green.

### Stage 3 — drag-select for area orders (reuse the mouse drag semantics)

**Goal**: a finger drag draws the same selection box the mouse does, opening
the orders menu on release.

The mouse already does this through `onClick` (anchor non-`kb` box, 411) →
`onDrag` (stretch, 417) → `onRelease` (`resolveSelection`, 421). Stage 1's
pointer handlers already call `dispatchClick`/`onDrag`/`onRelease`; the only
new work is that a **touch drag** (moved > the tap threshold) must feed the
**`onClick`+`onDrag`+`onRelease`** path, exactly as a left-mouse drag does —
i.e. when the pointer gesture is classified a drag (not a tap), run it through
the mouse-drag routing, not the Stage 2 tap routing. In tool modes
(BUILD/CANCEL) a drag paints cells (`paintCell`, 418) — same as mouse; verify
build-drag and demolish-drag both work by finger.

**STOP conditions (Stage 3)**: if the finger occludes the very cells being
selected badly enough that box-select is unusable, note it — a small drag-
offset or a live readout of the box extent might be needed, but that is polish
beyond the spike; a merely-awkward-but-working drag ships.

**Verify**: finger-drag a box over trees → orders menu; build mode finger-drag
places a row of walls; demolish mode finger-drag cancels plans. Gates green.

### Stage 4 — two-finger pan (pinch = no-op)

**Goal**: two fingers down + move pans the camera via the existing `s.pan`;
pinch does nothing in v1.

- Track active pointers in a small `Map<pointerId, {cx, cy}>` populated by the
  Stage 1 pointer handlers. When **two** touch pointers are down, switch to
  pan mode: translate the average-of-two movement into cell deltas and call
  `s.pan(dx, dy)` (the same entry the wheel and middle-drag use,
  `js/screens.js:431`). Suppress the one-finger tap/drag logic while two are
  down.
- **Pinch is explicitly a no-op** (Out of scope): the canvas is one fixed
  scale (100×45), so ignore the changing distance between the two fingers —
  only their translation drives `pan`. Do not add zoom state.
- On lifting back to one finger, do not treat the leftover finger as a fresh
  tap/drag (guard with the pointer map's size) — a released second finger
  should not order anything.

**STOP conditions (Stage 4)**: if two-finger pan constantly misfires as a
box-select or vice-versa, the gesture disambiguation is too fragile — ship
Stages 1-3 (single-finger, which use `minimap`-tap and viewport-edge cursor
pan for navigation, `js/screens.js:247-250, 313-319`) and mark two-finger pan
as deferred. Navigation without it is workable; a broken pan is not.

**Verify**: two fingers drag → camera pans smoothly; a pinch does not zoom or
jump; lifting one finger does not drop an order. Gates green.

### Stage 5 — minimal canvas-drawn toolbar (pause · alarm · build · help)

**Goal**: the four keyboard-only actions with no touch gesture get on-screen
buttons — **drawn in grid cells, not DOM** (CRT constraint).

- Add the buttons as **widgets** on the game screen (`makeGameScreen().widgets`,
  `js/screens.js:299-334`): each is a `{ rect, onClick, draw }` in a free
  region of the panel — the sidebar column (`x ≥ VIEW_W = 70`) or the bottom
  log strip (`y ≥ VIEW_H = 38`), both painted opaque at
  `js/screens.js:438-439`. Widgets route through `dispatchClick`
  (`js/ui.js:52-66`) for free — a tap on a button rect hits it before the map,
  so taps on the toolbar never leak into cursor/box logic.
- `onClick`s call the **same handlers** the keys call (do not duplicate logic):
  pause → toggle `G.paused` (367); alarm → `toggleAlarm()` (384); build →
  enter BUILD mode (382); help → `push(makeHelpModal())` (368, from
  `js/ui/modals.js` post-009). If plan 009's `togglePause` mutator exists
  (its Step 6 adds one), call that rather than writing `G.paused` directly.
- `draw` renders a labeled cell glyph (reuse `str`/`fillBg`, the sidebar's own
  vocabulary) — a couple of cells each, legible at tablet scale. Keep it in
  the sidebar so it never overlaps the map or the letterbox.
- These buttons are harmless on desktop (mouse can click them too) — no
  need to hide them behind a touch check, which keeps the code branch-free and
  the desktop layout a superset.

**STOP conditions (Stage 5)**: if four buttons crowd the sidebar enough to
push real information off-screen, cut to the two that have no other path
(alarm and help — pause has `space` on any keyboard, build has `b`) or move
them to the log strip; the sidebar's information budget wins over button
convenience.

**Verify**: buttons render in the panel, each tap fires its action, none
overlap the map or sidebar readouts; desktop mouse clicks them too. Gates
green.

### Stage 6 — flip the gate for tablets (the enablement)

**Goal**: admit touch devices whose **shorter viewport side ≥ cutoff**; keep
phones on the landing page.

- Change the coarse-pointer clause in **both** copies of the query
  (`style.css:97` and `js/mobile.js:8` — they must stay identical) so it gates
  only genuinely small touch screens. Concretely, replace the flat
  `(pointer: coarse) and (max-width: 1200px)` with a **min-dimension** cutoff
  so orientation is stable, e.g. the game shows when
  `min(vw, vh) ≥ 768px` and the landing page shows below it:

  ```css
  /* landing page only for phones (short side below the cutoff) or tiny
     desktop windows; tablets ≥ 768px on their shorter side get the game */
  @media (max-width: 767px), ((pointer: coarse) and (max-height: 767px) and (max-width: 767px)) { … }
  ```

  The exact number (700–768) is the spike's call; **768px** is defensible (iPad
  mini portrait is 744, standard iPad portrait 768/810) and keeps phones (short
  side ≤ ~430) out. State the chosen cutoff and the honest tradeoff in the
  commit: at ~1024px wide a tablet renders the 1100-col canvas letterboxed to
  ~10px cells — the spike must **judge on a real device** whether that is
  legible enough, and if not, raise the cutoff so only larger tablets qualify
  (that is a defensible outcome — "tablets ≥ N inches only").
- Keep the fine-pointer `max-width` clause (tiny desktop windows still lack the
  1100px the grid wants) — relax the coarse clause only.
- Remove the `?forcegame` scaffolding from Stage 1 (or promote it to a
  documented debug flag beside `window.ff`).
- Update the code-map lines if the input story changed: `README.md:138`
  (`js/mobile.js — phone landing page` — still true, note the tablet cutoff)
  and, if you kept a debug flag, `AGENTS.md:19`.

**STOP conditions (Stage 6)**: if, on a real tablet, the letterboxed canvas at
the chosen cutoff is illegible or the touch targets (single cells) are too
small to hit reliably, **raise the cutoff** rather than shipping an unplayable
tablet experience — an honest "only big tablets, for now" is the correct spike
outcome, and phones staying out is by design, not a failure.

**Verify**: DevTools tablet presets ≥ cutoff show the **game**; phone presets
and sub-cutoff widths show the **landing page**; rotating a tablet across the
cutoff-adjacent sizes does not flip mid-session (that is why the cutoff is on
`min(vw, vh)`). `grep -n "max-width" style.css js/mobile.js` shows the two
queries **identical**. Gates green.

## Test plan

The automated suite guards desktop only (it never imports `js/ui.js`'s DOM
handlers): after every stage, `pnpm check && pnpm lint && pnpm test` green
plus a manual desktop pass (mouse click/drag, wheel-pan, middle-drag-pan,
right-click-cancel all unchanged). The **touch** behavior is validated by the
per-stage manual checks above — first in Chrome device emulation via
`?forcegame`, then, before Stage 6 ships, on a **real tablet** over the LAN
(`pnpm dev --host`). Emulation proves the code path; only a real finger proves
the feel, and the feel is what each stage's STOP gate protects.

## Done criteria

A spike is "done" when each stage is either shipped-and-feels-right or
consciously-stopped-with-notes — not when all six land regardless of feel.

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` green at every shipped stage
- [ ] Pointer handlers exist and the transform is verified input-agnostic
      (`grep -rn "pointerdown" js/ui.js`; touch and mouse map to the same cell)
- [ ] Desktop mouse, wheel-pan, middle-drag-pan, and right-click-cancel are
      unchanged from `14fd915` behavior (manual)
- [ ] Tap-cursor-confirm routes through the existing Enter/`G.sel.kb` loop —
      no third input model (`grep -n "dispatchKey('Enter')"` or the absolute
      `placeCursorAt` helper feeds the same path as the gamepad)
- [ ] Finger drag-select and (if it survived Stage 4) two-finger pan work on a
      real tablet; pinch is a no-op
- [ ] The toolbar is canvas-drawn game-screen widgets (no DOM overlay), each
      `onClick` calling the same handler as its key
- [ ] The gate query is changed in **both** `style.css` and `js/mobile.js`,
      identical, keyed on min-dimension; tablets ≥ cutoff get the game, phones
      keep the landing page; the chosen cutoff and its legibility tradeoff are
      recorded in the commit
- [ ] `?forcegame` scaffolding removed or documented; `git status` shows only
      in-scope files
- [ ] `plans/README.md` status row updated (DONE, or STOPPED-AT-STAGE-N with a
      one-line reason)

## STOP conditions (spike-wide)

- The `canvasCell` transform is **not** input-agnostic on a real device (touch
  lands on a different cell than the mouse at the same point) — every stage
  assumes it is; re-derive before building further.
- Any desktop input path regresses (wheel, right-click, middle-drag, box-
  select) — the pointer unification was supposed to be additive; a "pure
  addition" that changed the mouse is not one.
- You find yourself adding a **third** cursor/selection model instead of
  driving `G.cursor` + the Enter/`G.sel` loop the keyboard and gamepad already
  share — stop; the reuse *is* the design (`js/gamepad.js` emits keys, not a
  private cursor; taps must too).
- You reach for a responsive relayout, a DOM-overlay control, or pinch-zoom —
  all three are explicitly out of scope and re-litigate settled owner
  decisions (the fixed CRT canvas).
- A stage's interaction cannot be made to feel right inside its timebox — ship
  the prior stages, write down why, and stop. A spike that reports "two-finger
  pan is too fragile, deferred" is a **successful** spike; one that ships a
  bad-feeling gesture to look complete is not.

## Maintenance notes

- **Two copies of the gate query** (`style.css:97`, `js/mobile.js:8`) are a
  standing footgun — they must change together. If touch ships for real beyond
  a spike, consider deriving the JS `GATE_MQ` from a single source or dropping
  the JS copy (it only guards the landing-art draw; a `matchMedia` on the CSS
  breakpoint would do).
- **The transform is the asset.** `canvasCell` reading `clientX/clientY`
  through `getBoundingClientRect` is what let this be a spike and not a
  rewrite; keep any future input work funneling through it rather than
  reimplementing pixel→cell math per input type.
- **Phones remain out of scope by design**, not by omission — 100 columns do
  not fit a phone legibly, and the landing page is the intended experience
  there. Re-opening phone support means re-opening the fixed-canvas decision,
  which is an owner call, not an input-plumbing one.
- If touch graduates from spike to supported, the missing net is a
  DOM-input smoke test (the suite still won't import `js/ui.js` handlers
  otherwise) and a device matrix — neither belongs in the timebox here.
