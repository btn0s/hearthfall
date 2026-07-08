# Plan 009: Split `js/screens.js` into `js/ui/` modules (P1-5)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d177bfd..HEAD -- js/screens.js js/ui/ js/game.js js/main.js js/gfx.js test/`
> If `js/screens.js` or `js/game.js` changed, every line number in this plan
> is suspect — re-read both files fully and re-verify each cited excerpt
> before cutting anything. This is a **zero-behavior-change** refactor: the
> only safe way to execute it is against the exact code it describes.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MEDIUM (pure code motion, but it introduces deferred ESM import
  cycles, converts two screen methods to free functions, and the draw paths
  it moves have no unit coverage — the characterization suite plus a scripted
  import smoke test and a manual play check are the net)
- **Depends on**: 004/006/007 (test net), 005 (sidebar layout — landed),
  008 (balance table — landed). All DONE at `d177bfd`.
- **Category**: tech-debt
- **Planned at**: commit `d177bfd`, 2026-07-08
- **Roadmap ID**: P1-5 (also closes the P5-3 residual: modal geometry
  duplicated between `widgets()` and `draw()`)

## Why this matters

`js/screens.js` is 1,099 lines and ~25 functions: three title screens, the
main game screen (layout + input + draw), the world screen, and eight modals,
all interleaved with direct `G` mutation. The roadmap calls it the biggest
structural debt in the codebase — **every** HP0 UI item (HP-4 torchbearer,
HP-8 campaign layer, HP-3 arrivals) lands in this file. The `js/ui/`
extraction was started (`js/ui/menu.js`, the reusable list screen) and
stalled; this plan finishes it. Doing it now, behind the 52-test
characterization suite and before any HP0 feature work, is the cheap moment.
It also burns down the P5-3 residual (modal box math computed twice) while
each modal is in hand, so future geometry edits have one place to be wrong.

## Current state

`js/screens.js` (1,099 lines) exports `beginRun`, `makeMenuScreen`,
`makeCivScreen`, `makeLegacyScreen`, `makeGameScreen`, `makeWorldScreen`,
`makeGameOverModal`. The **only** external importer is `js/main.js`:

```js
// js/main.js:6
import { makeMenuScreen, makeGameOverModal } from './screens.js';
```

(`js/main.js:32` also lazy-imports the module onto `window.SCREENS` as a
debug hook, and `js/gamepad.js:25` mentions it in a comment — neither breaks.)

The screen-object contract lives at `js/ui.js:1-9` (plain objects with
`id, modal, pausesSim, listNav, focus, widgets, keymap, onKey, onClick,
onDrag, onRelease, onHover, pan, draw, onEnter, onExit`; hit-testing is
geometry over declared widget rects, never draw side effects). The existing
extraction pattern is `js/ui/menu.js` (52 lines): a leaf module importing
only `../gfx.js` and `../ui.js`, exporting one factory (`makeListScreen`)
that returns a contract-conforming screen object.

### Function inventory (verified against `d177bfd`)

| Lines | Function | Moves to |
|---|---|---|
| 26-29 | `SB_X` / `SB_W` / `SB_INNER` / `LOG_Y` consts | `js/ui/sidebar.js` |
| 32-37 | `drawNotice()` | `js/ui/chrome.js` |
| 39-56 | `drawTip()` | `js/ui/chrome.js` |
| 58-64 | `beginRun(civId)` | stays |
| 67-108 | `makeMenuScreen()` | `js/ui/title.js` |
| 110-150 | `makeCivScreen()` | `js/ui/title.js` |
| 152-187 | `makeLegacyScreen()` | `js/ui/title.js` |
| 190 | `TOOL_MODES` | stays |
| 193-218 | `sidebarLayout()` | `js/ui/sidebar.js` |
| 220-229 | `wrapText()` | `js/ui/sidebar.js` (private) |
| 231-235 | `hpBar()` | `js/ui/sidebar.js` (private) |
| 237-251 | `moveCursor()` | stays |
| 253-257 | `paintCell()` | stays |
| 261-268 | `clickInteract()` | stays |
| 272-287 | `resolveSelection()` | stays |
| 289-292 | `selectBuild()` | stays |
| 294-631 | `makeGameScreen()` (widgets/onKey/onClick/onDrag/onRelease/onHover/pan/draw/drawBuildMenu) | stays |
| 451-559 | └ `drawSidebar` method | `js/ui/sidebar.js` (as `drawSidebar(scr, f)`) |
| 561-570 | └ `drawLog` method | `js/ui/sidebar.js` (as `drawLog()`) |
| 572-597 | └ `drawMinimap` method | `js/ui/sidebar.js` (as `drawMinimap(f)`) |
| 634-712 | `makeWorldScreen()` | `js/ui/world-screen.js` |
| 714-792 | `makePartyModal(locIdx)` | `js/ui/world-screen.js` (private) |
| 797-821 | `makePauseMenu()` | `js/ui/modals.js` |
| 825-866 | `makeOrdersMenu(b, info)` | `js/ui/modals.js` |
| 869-891 | `makeBeaconModal()` | `js/ui/modals.js` |
| 893-943 | `makeWorkshopModal()` | `js/ui/modals.js` |
| 945-978 | `makeTradeModal()` | `js/ui/modals.js` |
| 980-999 | `makeIntroModal()` | `js/ui/modals.js` |
| 1001-1060 | `makeHelpModal()` | `js/ui/modals.js` |
| 1062-1099 | `makeGameOverModal()` | `js/ui/modals.js` |

Cohesion notes behind the split: the three title screens share the
row-list/META/perks vocabulary and are the only non-modal full screens
besides game and world; `makePartyModal` is opened **only** from the world
screen's widgets (`js/screens.js:643,646`) and shares `world.js` imports, so
it travels with `makeWorldScreen`; the eight remaining modals share
`makeListScreen`/`drawNotice`/game-mutator vocabulary; the sidebar trio plus
`sidebarLayout` are the plan-005 fixed-grid layout block ("single source of
truth for sidebar row positions (draw + hit share this)" — comment at
`js/screens.js:192`). `drawBuildMenu` (599-628) stays with the game screen:
it reads `scr.buildTab`/`scr.buildFocus`, which the game screen's `onKey`
mutates — moving it would split one state machine across two files.

### The `G`-mutation audit

Every **map/tile** mutation in `js/screens.js` already routes through a
`js/game.js` mutator: `tryPlaceBuild`/`cancelAt` (via `paintCell`, 255-256),
`assignArea`/`clearAreaPlans` (orders rows, 829-838), `queueCraft`/
`unqueueCraft` (910, 921, 928), `doTrade` (953, 966), `igniteBeacon` (876),
`cycleRole` (266, 310), `toggleAlarm` (384), `centerCam` (240, 317),
`buyPerk` (159, 175). What remains are direct writes to **ephemeral UI
state** (all in `EPHEMERAL`-adjacent fields that never enter the save):

- In code that **moves** (must gain mutators — Step 6):
  - `js/screens.js:664` (world screen keymap): `' ': () => { G.paused = !G.paused; },`
  - `js/screens.js:846` (orders menu): `onExit() { G.sel = null; },`
- In code that **stays** in the game screen (routed through the same new
  mutators in Step 6 for consistency, since they exist anyway):
  `G.paused = !G.paused` (367); `G.sel = null` (277, 282, 338).
- In code that stays and is **out of scope** for mutators (screen-local
  cursor/tool state, deferred to P1-6's import sweep): `G.cursor` writes
  (239-244, 425-428), `G.sel` box anchor/stretch (245, 403, 411, 417),
  `G.buildSel` (291, 323, 355-361, 376, 382), `G.mode` (357-361, 375,
  382-383), `G.speed` (369-371), `G.tip = null` (337).

### The P5-3 residual (verified)

- **Party modal — real duplication.** `widgets()` computes the box height
  and origin, and `draw()` recomputes the identical math:

  ```js
  // js/screens.js:724-726 (inside widgets())
  const a = avail();
  const bh = a.length + 5 + extraRows;
  const y0 = ((GRID_H - bh) / 2) | 0;
  // js/screens.js:763-765 (inside draw() — the same three lines again)
  ```

- **Workshop modal — scattered offsets.** `x0, y0, w` and `bh` are shared
  consts (`js/screens.js:894-895`) but the row math is inlined three ways:
  craft rows at `y0 + 3 + i` (908), the cancel row at `y0 + 4 + CRAFTS.length`
  (919), the footer at `y0 + bh - 1` (938).
- **Orders modal — already single-sourced.** `w/bh/x0/y0` are computed once
  in the factory closure (`js/screens.js:840-843`) and shared by `widgets`
  and `draw`. Verify, change nothing (ROADMAP's line cite predates this).
- **Trade modal — same-pattern nit.** `draw` inlines the height as
  `TRADE.length + 4` (969) while the footer uses `y0 + TRADE.length + 2`
  (973); hoist one `bh` const while the code is in hand.

### One extraction landmine

`drawSidebar` closes over the screen object to gate the portrait overlay
while a modal is up:

```js
// js/screens.js:504
if (top() === scr) { // skip while a modal is up — nothing paints over menus
```

As a free function this needs the screen passed in — `drawSidebar(scr, f)` —
NOT replaced by a `!top().modal` guess (a non-modal screen pushed over the
game screen, e.g. the world screen, must also suppress the overlay, and
`top() === scr` already encodes exactly that).

### Import cycles are unavoidable and safe — but must be verified

Navigation is inherently cyclic: menu → new game → game screen → Esc/pause →
quit → menu. After the split there are exactly two two-way module pairs
(`screens.js ↔ ui/title.js`, `ui/title.js ↔ ui/modals.js`) plus one-way
edges elsewhere. Every cross-reference sits **inside a function body**
executed long after module evaluation, and no module uses an imported
binding at top level, so ESM's live bindings make this well-defined (no
TDZ). Each step that creates a cycle verifies it with a real `node` import
(command below), not by inspection.

Per `AGENTS.md` (line 29), view modules may import `G` and sim helpers via
the `js/game.js` re-exports; the new files keep the exact import sources the
moved code uses today. Do **not** add any new re-export line to `js/game.js`
(P1-6 will untangle the barrel; this plan must not deepen it — the two new
mutators in Step 6 are defined in `game.js` itself, not re-exported from
elsewhere).

### The fixed grid is an invariant

Plan 005's layout is frozen: 100×45 cell grid (`js/gfx.js:6`), 70×38
viewport, sidebar of 28 columns starting at x=72 (`SB_X = VIEW_W + 2`,
`js/screens.js:26`). No constant in this plan changes value — only files.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| All gates | `pnpm check && pnpm lint && pnpm test` | exit 0; 52 tests pass (7 files) at baseline |
| One test file | `pnpm vitest run test/ui-smoke.test.js` | that file passes |
| Cycle smoke | `node -e "globalThis.performance={now:()=>0};import('./js/screens.js').then(m=>console.log('OK',Object.keys(m).sort().join(','))).catch(e=>{console.error(e);process.exit(1)})"` | prints `OK` + export list |
| Manual play | `pnpm dev` → http://localhost:8137 | Step 8 checklist |

Run `pnpm check && pnpm lint && pnpm test` **after every step** — the whole
point of the per-file migration order is that each step lands green.

## Scope

**In scope**:
- `js/ui/chrome.js`, `js/ui/sidebar.js`, `js/ui/modals.js`, `js/ui/title.js`,
  `js/ui/world-screen.js` (create)
- `js/screens.js` (shrink to game screen + input + `beginRun`)
- `js/game.js` (add `togglePause()` and `clearSelection()` — Step 6 ONLY)
- `js/main.js` (two import-path updates)
- `test/ui-smoke.test.js` (create)
- `plans/README.md` (status row)

**Out of scope**:
- ANY behavior, string, color, geometry-value, or keybinding change. If a
  number or hex code differs in the diff, the step is wrong.
- `js/ui.js`, `js/ui/menu.js` — the framework and pattern file don't change.
- The P1-6 barrel untangling (direct imports from `state.js` etc.) — new
  files copy the moved code's current import sources verbatim.
- Renaming any exported factory; the screen-object contract (`js/ui.js:1-9`)
  and every screen `id` string stay identical.

## Git workflow

- Branch: `advisor/009-screens-split`
- Commits: one per step, imperative ("Extract sidebar drawing into js/ui/sidebar.js").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `js/ui/chrome.js` — shared notice/tip painters

Create the file; move `drawNotice` (`js/screens.js:32-37`) and `drawTip`
(39-56) verbatim, exporting both. Imports (all already used by this code in
`screens.js`): `G, elderCounsel` from `../game.js`; `str, fillBg` from
`../gfx.js`; `VIEW_W, VIEW_H` from `../data.js`. In `js/screens.js`, delete
the two functions and add
`import { drawNotice, drawTip } from './ui/chrome.js';` — the call sites
(`drawNotice`: 104, 447, 818, 939, 974; `drawTip`: 448, 708) are untouched.

**Verify**: gates green; `grep -rn "function drawNotice\|function drawTip" js`
→ only `js/ui/chrome.js`.

### Step 2: `js/ui/sidebar.js` — layout + sidebar/log/minimap painters

Create the file; move, in order:
- The consts `SB_X, SB_W, SB_INNER, LOG_Y` (`js/screens.js:26-29`). Export
  `SB_X` and `SB_INNER` (the game screen's `widgets()` uses them at 303,
  309, 315); keep `SB_W`/`LOG_Y` private.
- `sidebarLayout()` (193-218) — exported (shared by `widgets()` at 301 and
  the three painters; keep the "single source of truth" comment at 192).
- `wrapText` (220-229) and `hpBar` (231-235) — private.
- `drawSidebar` (451-559) → `export function drawSidebar(scr, f)`; the body
  is verbatim, including `if (top() === scr)` at 504 (see landmine above).
- `drawLog` (561-570) → `export function drawLog()`.
- `drawMinimap` (572-597) → `export function drawMinimap(f)`.

Imports needed by the moved bodies (copy sources from `screens.js:4-25`):
from `../game.js` — `G, tileAt, timeStr, communeTier, season, isWinter,
daysToWinter, moraleLabel, housingCap, tonightInfo, foodInfo, elderCounsel,
recruitEligible`; from `../data.js` — `MAP_W, MAP_H, VIEW_W, VIEW_H, CELL_W,
CELL_H, CIVS, ROLE_COLORS, ROLE_LETTER`; `import * as gfx from '../gfx.js'`
plus the same destructure line as `screens.js:25` (trimmed to what's used);
`top` from `../ui.js`; `elderPortrait` from `../portrait.js`;
`MM_COL, inspectText` from `../mapdraw.js`.

In `js/screens.js`: import
`{ SB_X, SB_INNER, sidebarLayout, drawSidebar, drawLog, drawMinimap } from './ui/sidebar.js'`;
in `makeGameScreen().draw` replace `this.drawSidebar(f)` / `this.drawLog()` /
`this.drawMinimap(f)` (443-445) with `drawSidebar(this, f)` / `drawLog()` /
`drawMinimap(f)`, and delete the three methods. `drawBuildMenu` (599-628)
stays a method — do not move it.

**Verify**: gates green; `wc -l js/screens.js` ≈ 880 (was 1,099);
`grep -n "sidebarLayout" js/screens.js` shows only the import and the
`widgets()` call site.

### Step 3: `js/ui/modals.js` — the eight modals (+ P5-3 single-sourcing)

Create the file; move verbatim: `makePauseMenu` (797-821), `makeOrdersMenu`
(825-866), `makeBeaconModal` (869-891), `makeWorkshopModal` (893-943),
`makeTradeModal` (945-978), `makeIntroModal` (980-999), `makeHelpModal`
(1001-1060), `makeGameOverModal` (1062-1099). Export **all eight** (today
five are module-private; exporting them is required by the file boundary and
is not a behavior change).

Imports: from `../game.js` — `G, save, adjustedOffer, doTrade, queueCraft,
unqueueCraft, notice, tip, assignArea, clearAreaPlans, tonightInfo,
igniteBeacon, isWinter`; from `../data.js` — `CIVS, CRAFTS, TRADE, INTRO,
VIEW_W, VIEW_H`; from `../meta.js` — `META, hasPerk`; from `../gfx.js` —
`GRID_W, GRID_H, str, fillBg, GFX, MM, toggleGfx, toggleMinimap`; from
`../ui.js` — `push, pop, replaceAll, drawWidgets`; from `./menu.js` —
`makeListScreen`; from `./chrome.js` — `drawNotice`; from `../screens.js` —
`makeMenuScreen, makeCivScreen` (used by the pause menu at 806 and the
game-over modal at 1063-1064; this is a temporary cycle edge, re-pointed at
`./title.js` in Step 4).

While each modal is in hand, apply the P5-3 single-sourcing (geometry
identical, arithmetic hoisted, no rendered cell may change):
- **Workshop**: after the existing consts (894-895) add
  `const rowY = (i) => y0 + 3 + i; const cancelY = y0 + 4 + CRAFTS.length;`
  and use them at the three sites (908, 919; footer stays `y0 + bh - 1`).
- **Trade**: hoist `const bh = TRADE.length + 4;` next to `x0, y0, w` (946)
  and use it at 969 (`fillBg(x0, y0, w, bh, ...)`) and 973
  (`y0 + bh - 2`). Confirm `TRADE.length + 2 === bh - 2` before rewriting.
- **Orders**: verify 840-843 already computes geometry once — no change.
- (Party modal is Step 5's file.)

In `js/screens.js`: delete the moved code; import the modals it still
references: `makeIntroModal` (63), `makeHelpModal` (78, 368),
`makeTradeModal` (262, 386), `makeWorkshopModal` (263), `makeBeaconModal`
(264), `makeOrdersMenu` (286), `makePauseMenu` (362). In `js/main.js:6`,
change `makeGameOverModal` to import from `'./ui/modals.js'`.

**Verify**: gates green; cycle smoke command prints `OK` (this is the first
step that creates a cycle: `screens.js → ui/modals.js → screens.js`);
`grep -c "^export function make" js/ui/modals.js` → 8.

### Step 4: `js/ui/title.js` — menu, civ, legacy

Create the file; move verbatim `makeMenuScreen` (67-108), `makeCivScreen`
(110-150), `makeLegacyScreen` (152-187); export all three.

Imports: from `../game.js` — `hasSave, loadGame, notice`; from `../data.js`
— `CIVS, CIV_UNLOCKS, PERKS`; from `../meta.js` — `META, hasPerk, perkLevel,
buyPerk, civUnlocked`; from `../gfx.js` — `GRID_W, GRID_H, put, str, fillBg,
GFX, toggleGfx`; from `../ui.js` — `push, pop, replaceAll, drawWidgets`;
from `../glyph.js` — `drawBig`; from `./chrome.js` — `drawNotice`; from
`./modals.js` — `makeHelpModal`; from `../screens.js` — `beginRun,
makeGameScreen` (menu Continue at 74 calls `makeGameScreen`; civ rows call
`beginRun`).

Re-point the two consumers of the moved factories:
- `js/ui/modals.js`: change its `makeMenuScreen, makeCivScreen` import from
  `'../screens.js'` to `'./title.js'`.
- `js/screens.js`: keep `beginRun` and `makeGameScreen`; import
  `{ makeMenuScreen } from './ui/title.js'` for the `'Q'` quit key (366).
- `js/main.js:6`: `makeMenuScreen` now imports from `'./ui/title.js'`.

**Verify**: gates green; cycle smoke prints `OK` (cycles now:
`screens ↔ title`, `title ↔ modals`);
`grep -rn "from './screens.js'\|from '../screens.js'" js` → exactly one hit,
`js/ui/title.js` (the static import in `js/main.js:6` is now empty of
symbols — delete the line; the dynamic `import('./screens.js')` debug hook
at `js/main.js:32` stays: it still resolves and AGENTS.md documents it).

### Step 5: `js/ui/world-screen.js` — world map + party modal

Create the file; move `makeWorldScreen` (634-712, exported) and
`makePartyModal` (714-792, private — it is only reachable from the world
screen's widgets).

Imports: from `../game.js` — `G, settlersAvailable, homeAtDusk, tonightInfo,
traitName, notice, tip`; from `../world.js` — `WORLD_W, WORLD_H, partyPower,
riskLabel, dangerStr, startExpedition`; from `../data.js` — `LOCTYPES`; from
`../gfx.js` — `GRID_W, GRID_H, put, str, fillBg, dim`; from `../ui.js` —
`push, pop, drawWidgets, focusedWidget`; from `./chrome.js` — `drawTip`
(call at 708).

P5-3 fix for the party modal (the real duplication): inside
`makePartyModal`, add one closure-level helper and call it from **both**
`widgets()` and `draw()`:

```js
const layout = () => {
  const a = avail();
  const bh = a.length + 5 + extraRows;
  const y0 = ((GRID_H - bh) / 2) | 0;
  return { a, bh, y0 };
};
```

replacing the triplicated lines at 724-726 and 763-765. Same math, one
source.

In `js/screens.js`: import `{ makeWorldScreen } from './ui/world-screen.js'`
(call site 390).

**Verify**: gates green; cycle smoke prints `OK`; `wc -l js/screens.js` ≤
~320 and `wc -l js/ui/*.js` shows roughly chrome ~35, sidebar ~200,
title ~140, modals ~330, world-screen ~180, menu 52.

### Step 6: route the moved `G` writes through `js/game.js` mutators

Add to `js/game.js`, next to `centerCam` (`js/game.js:54-57`):

```js
export function togglePause() { G.paused = !G.paused; }
export function clearSelection() { G.sel = null; }
```

Route the write sites:
- `js/ui/world-screen.js` keymap (was `screens.js:664`):
  `' ': () => togglePause(),`
- `js/ui/modals.js` orders menu (was `screens.js:846`):
  `onExit() { clearSelection(); },`
- `js/screens.js` game screen: space key (was 367) → `togglePause()`;
  the three `G.sel = null` sites (were 277, 282, 338) → `clearSelection()`.

Leave every other direct write listed in the audit (cursor, box
anchor/stretch, `buildSel`, `mode`, `speed`, `tip`) exactly as it is — those
are screen-local tool state in the file that owns them, and widening this
step's blast radius is how a "pure refactor" stops being one.

**Verify**: gates green;
`grep -rn "G.paused = " js` → only `js/game.js`;
`grep -rn "G.sel = null" js` → only `js/game.js`.

### Step 7: `test/ui-smoke.test.js` — lock the module graph

The suite never imports `screens.js`, so nothing above was exercised by
`pnpm test` beyond typecheck/lint. Add a smoke test using the
stub-then-import header from `test/boundaries.test.js:1-17` (stub
`localStorage` and `performance` **before** any dynamic import), then:

```js
const { G, makeState } = await import('../js/state.js');
const screens = await import('../js/screens.js');
const title = await import('../js/ui/title.js');
const modals = await import('../js/ui/modals.js');
const world = await import('../js/ui/world-screen.js');
const sidebar = await import('../js/ui/sidebar.js');
```

Tests (≥4):
1. Every expected factory is a function: `screens.beginRun`,
   `screens.makeGameScreen`, `title.makeMenuScreen`, `title.makeCivScreen`,
   `title.makeLegacyScreen`, `world.makeWorldScreen`, and all 8 `modals.*`
   exports — this fails loudly on any ESM-cycle/TDZ regression.
2. `title.makeMenuScreen()` returns a contract object (`id === 'menu'`,
   `modal === false`, arrays/functions where `js/ui.js:1-9` says) and
   `scr.draw(0)` runs without throwing (gfx `str`/`put` write to plain
   buffers; no canvas needed).
3. `modals.makeGameOverModal().draw(0)` runs without throwing after
   `Object.assign(G, makeState())`.
4. After `Object.assign(G, makeState())`, `sidebar.sidebarLayout()` returns
   numeric `objY/setHdrY/settlerY/mmY/mmH` with
   `setHdrY === objY + 6` (the elder-window height, `js/screens.js:201`).

**Verify**: `pnpm vitest run test/ui-smoke.test.js` passes; `pnpm test` →
≥56 tests, all green.

### Step 8: manual play smoke (required — draw paths have no unit coverage)

`pnpm dev`, then walk every moved surface once, comparing against `main`
(or a second checkout) if anything looks off:

1. Title: menu renders (flame, big glyphs), arrows + hotkeys work; `l` legacy
   screen; `n` → civ screen → start a run.
2. Intro modal shows; Enter dismisses; sidebar (day line, morale bar, elder
   portrait + counsel, settler rows, minimap) matches its pre-split look —
   the elder portrait must still vanish while any modal/world screen is up
   (the `top() === scr` landmine).
3. `b` build menu: tabs ←→, rows, placement; `x` demolish; drag a box over
   trees → orders menu appears, order lands, Esc clears selection.
4. `w` world screen: map + location list render, Enter opens the party
   modal, toggling members updates power/risk lines, Esc backs out; space
   still toggles pause from the world screen.
5. Esc pause menu: save, graphics toggle, minimap toggle, help modal, quit
   to title, Continue reloads the run.
6. In devtools: `window.ff(1440)` a few times to reach a trader day
   (day % 4 === 2, day ≥ trader minimum) and a raid dusk — open the trade
   modal with `e`, watch the raid sidebar lines flash, ring the alarm with
   `r`. If time is short, cover at least the trade modal; note anything
   skipped in the report.

Any visual or input difference from pre-split behavior: STOP.

### Step 9: update `plans/README.md`

Add the row (and flip it to DONE when the above is all green):

```
| 009 | Split `js/screens.js` into `js/ui/` modules | P1-5, P5-3 residual | P1 | L | 005, 008 | DONE |
```

Also update the "Not yet planned" bullet in the Dependency notes (P1-5 is
now planned/done; the next-batch list starts at P1-6).

## Test plan

Steps 1-6 each land behind `pnpm check && pnpm lint && pnpm test` (52
characterization tests: combat, economy, raids, pathing, saves, meta,
balance, gamepad) plus the `node` import smoke for cycle safety; Step 7 adds
≥4 module-graph/contract tests; Step 8 is the manual sweep of the draw paths
the suite cannot see.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0; suite ≥56 tests
- [ ] `js/ui/` contains `chrome.js`, `sidebar.js`, `title.js`, `modals.js`,
      `world-screen.js`, `menu.js` (untouched)
- [ ] `wc -l js/screens.js` ≤ ~320; it exports only `beginRun` and
      `makeGameScreen`
- [ ] `git diff d177bfd..HEAD -- js/data.js js/gfx.js js/ui.js js/ui/menu.js`
      is empty (grid, contract, and pattern file untouched)
- [ ] `grep -rn "G.paused = \|G.sel = null" js` → hits only in `js/game.js`
- [ ] Party modal computes `bh`/`y0` in exactly one place
      (`grep -c "a.length + 5 + extraRows" js/ui/world-screen.js` → 1)
- [ ] `js/main.js` no longer imports from `./screens.js` at line 6 (only the
      `window.SCREENS` lazy debug import may remain)
- [ ] Manual smoke (Step 8) completed with zero visible differences
- [ ] `plans/README.md` row added and updated

## STOP conditions

- The drift check shows `js/screens.js` or `js/game.js` changed since
  `d177bfd` — re-ground every excerpt before proceeding, or re-plan.
- Any existing test fails after a move step. Never adjust a characterization
  test to make a "pure move" pass — the move wasn't pure.
- The `node` cycle smoke throws (`ReferenceError: Cannot access ... before
  initialization` means a top-level use of a cyclic import — find it, don't
  reorder imports until it happens to work).
- You find yourself changing a string, color, coordinate, or key while
  moving code. That is P1-6/HP0 work, not this plan.
- The `top() === scr` overlay gate can't be preserved verbatim by passing
  `scr` — report rather than substituting a "close enough" condition.
- Step 8 reveals any rendering or input difference from pre-split behavior.

## Maintenance notes

- New modals go in `js/ui/modals.js` (or a sibling file if one grows a
  subsystem, e.g. HP-4's torchbearer UI); new full screens get their own
  `js/ui/*.js`. `js/screens.js` is now "the game screen", nothing else —
  consider renaming it `js/ui/game-screen.js` **during P1-6** (doing it here
  would churn `main.js`/debug hooks for no structural gain).
- The two deferred cycles (`screens ↔ ui/title`, `ui/title ↔ ui/modals`) are
  documented, smoke-tested navigation edges. If P1-6 wants them gone, the
  clean seam is a screen registry in `js/ui.js`, not deeper import layers.
- P1-6 should also sweep the new files' `../game.js` imports toward direct
  module imports (`state.js`, `seasons.js`, …) — they were deliberately
  copied verbatim here to keep this diff move-only.
- The ephemeral writes left in `js/screens.js` (cursor/box/mode/speed) are
  the game screen's own tool state; promote them to mutators only if a
  second file ever needs to touch them.
