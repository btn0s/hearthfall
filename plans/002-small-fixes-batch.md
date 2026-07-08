# Plan 002: Fix six small, verified defects (camera, modifiers, pause semantics, rescue cap, mapgen sort, wheel pan)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. Each step is independent — if one hits a STOP condition, report it
> and continue with the remaining steps. When done, update the status row for
> this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3ee106c..HEAD -- js/save.js js/ui.js js/screens.js js/world.js js/map.js test/boundaries.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch for a given step, treat it as a STOP condition for that step only.

## Status

- **Priority**: P1
- **Effort**: S (six fixes, each minutes-to-an-hour)
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3ee106c`, 2026-07-07

## Why this matters

Six small defects, each independently verified against the code, each fixable in
a few lines: (1) continuing a saved game opens the camera on an empty map corner
instead of the camp; (2) OS shortcuts like Cmd+R silently trigger game actions
(the alarm!) while the browser handles them; (3) the trade and workshop menus
are the only two modals that don't pause the simulation — a raid can start while
you're reading prices; (4) rescued survivors bypass the population-16 cap that
every other join path enforces; (5) map generation sorts noise values
lexicographically instead of numerically, skewing biome thresholds at the
extremes; (6) wheel-panning is dead on browsers that report line-mode wheel
deltas. Together they close out the "stop the bleeding" bug list.

## Current state

HEARTHFALL: vanilla-JS browser game, global mutable state singleton `G`
(`js/state.js`), ES modules, 2-space indent, single quotes. Tests are vitest in
`test/boundaries.test.js`, which stubs `localStorage`/`performance` with
`vi.stubGlobal` **before** dynamically importing game modules — copy that
pattern for any new test.

### Fix A — Continue camera

`js/save.js:12-28` deliberately excludes `cam` from the save payload:

```js
function toSaveData() {
  const { settlers, raiders, expeditions, tiles, log, moraleEvents, craftQueue, res, stats, mods,
    civ, camp, world, usedNames, day, min, speed, paused, gameOver, victory, legacyEarned, bonusLines,
    objIdx, objFlash, morale, beaconDay, alarm, recruitDays,
    mode: _mode, cam: _cam, raidNext, raidActive, raidTimer,
    raidIsHorde, banditsCleared, trader, nextId } = G;
  void _mode; void _cam;
  return {
    version: SAVE_VERSION,
    ...
    mode: 'NORMAL', cursor: { x: -1, y: -1 },
  };
}
```

`loadGame()` (`js/save.js:73-82`) does `Object.assign(G, makeState(), d)`, and
`makeState()` has `cam: { x: 0, y: 0 }` — so after Continue the viewport shows
the top-left of the 140×96 map. The camp is placed at 25–75% of the map, so the
player sees empty terrain. New games are unaffected because `newGame()` calls
`centerCam` (`js/game.js:447`).

Note `centerCam` lives in `js/game.js:53-56` and `js/game.js` already imports
from `js/save.js` — importing game.js from save.js would create a cycle. The
fix therefore replicates the 2-line clamp locally (constants `MAP_W`, `MAP_H`
are already imported in save.js; `VIEW_W`, `VIEW_H` are in `js/data.js:4`):

```js
// js/game.js:53-56 — for reference, do not import:
export function centerCam(x, y) {
  G.cam.x = Math.max(0, Math.min(MAP_W - VIEW_W, Math.round(x - VIEW_W / 2)));
  G.cam.y = Math.max(0, Math.min(MAP_H - VIEW_H, Math.round(y - VIEW_H / 2)));
}
```

### Fix B — modifier keys

`js/ui.js:91-94`:

```js
  window.addEventListener('keydown', e => {
    dispatchKey(e.key, { shift: e.shiftKey });
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
  });
```

Ctrl/Cmd/Alt are never checked, so Cmd+R dispatches `r` (toggles the alarm) as
the page reloads, Ctrl+V dispatches `v` (graphics toggle), etc.

### Fix C — pause semantics

The screen-stack framework pauses the sim while any screen with `pausesSim: true`
is on the stack (`js/main.js:34-35`). Six modals set it (`js/screens.js:811`
pause, `:845` orders, `:880` beacon, `:983` intro, `:1050` help, `:1066`
gameover). The two that don't:

```js
// js/screens.js:904-906
  const scr = {
    id: 'workshop', modal: true, focus: 0,
    update() { if (!G.tiles.some(tl => tl.t === 'workshop')) pop(); }, // burned down mid-order

// js/screens.js:947-949
  const scr = {
    id: 'trade', modal: true, focus: 0,
    update() { if (!G.trader) pop(); }, // trader left / raid scared them off
```

Decision (made by the advisor, honor it): **both get `pausesSim: true`** for a
consistent "menu open = time stopped" model (Frostpunk's pause-to-decide
convention; also required for fair gamepad play). Their `update()` self-close
hooks still run every frame (`js/main.js:43-44` calls `update` regardless of
pause), so the "trader left / workshop burned down" exits keep working — but the
trader can no longer *leave while you're in the menu* since `traderTick` only
runs in the sim; that's acceptable and consistent. The **world screen**
(`js/screens.js`, id `'world'`) intentionally keeps the sim running (expeditions
travel while you watch) — do not touch it.

### Fix D — survivor rescue cap

`js/world.js:163-175` — the `survivors` branch pushes a settler unconditionally
while the generic tag-along branch right below checks the cap:

```js
    if (loc.type === 'survivors') {
      const s = makeSettler(G.camp.x, G.camp.y, 'worker');
      s.away = true;
      G.settlers.push(s);
      updatePeak();
      e.ids.push(s.id);
      addLog(`Rescued ${s.name} (${traitName(s).toLowerCase()}) — they will join the commune!`, '#e8d8a0');
    } else if (chance(0.08) && G.settlers.length < 16) {
```

The commune cap is 16 (`js/game.js:92` `pop < 16`, `js/game.js:98`
`'the commune is full'`).

### Fix E — mapgen percentile sort

`js/map.js:38`:

```js
  const pct = (arr, p) => { const s = [...arr].sort(); return s[(s.length * p) | 0]; };
```

`arr` is a `Float32Array` of noise values; spread converts to numbers and
`.sort()` without a comparator sorts them **as strings**. Values in `[0,1)`
mostly share the `"0."` prefix so it usually works, but exponential-notation
stringifications (e.g. `1e-7`) sort wrong and skew the low percentiles
(`eWater = pct(E, 0.07)`, `js/map.js:39`) that decide water placement.

### Fix F — wheel pan delta mode

`js/ui.js:101-107`:

```js
  canvas.addEventListener('wheel', e => {
    const s = top();
    if (s && s.pan) {
      e.preventDefault();
      s.pan(Math.round(e.deltaX / 25), Math.round(e.deltaY / 25));
    }
  }, { passive: false });
```

`e.deltaMode` is never checked. In `DOM_DELTA_LINE` mode (value 1 — e.g.
Firefox with a plain mouse wheel) deltas are ~1–3, so `/25` rounds to 0 and
wheel panning does nothing.

## Commands you will need

| Purpose   | Command        | Expected on success |
|-----------|----------------|---------------------|
| Install   | `pnpm install` | exit 0              |
| Typecheck | `pnpm check`   | exit 0, no output   |
| Lint      | `pnpm lint`    | exit 0, no output   |
| Tests     | `pnpm test`    | all pass            |
| Manual    | `pnpm dev`     | game at http://localhost:8137 |

## Scope

**In scope** (the only files you should modify):
- `js/save.js` (Fix A)
- `js/ui.js` (Fixes B, F)
- `js/screens.js` (Fix C — two lines only)
- `js/world.js` (Fix D)
- `js/map.js` (Fix E)
- `test/boundaries.test.js` (new tests for A)

**Out of scope** (do NOT touch):
- `js/game.js` — `centerCam` stays where it is; no new imports into save.js from game.js (cycle).
- The world screen's pause behavior (intentionally unpaused).
- `js/gamepad.js` — controller work is plan 001.
- Any other literal in `js/screens.js` beyond adding the two `pausesSim` flags.

## Git workflow

- Branch: `advisor/002-small-fixes`
- One commit per fix (A–F) with an imperative message, e.g. "Restore camera to camp on Continue".
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1 (Fix A): Persist the camera and center legacy saves

In `js/save.js`:

1. In `toSaveData()`, stop discarding `cam`: change the destructuring line
   `mode: _mode, cam: _cam, raidNext, ...` to `mode: _mode, cam, raidNext, ...`,
   change `void _mode; void _cam;` to `void _mode;`, and add `cam,` to the
   returned object (next to `camp`).
2. In `migrate(d)`, after the `if (!d.version) { ... }` block, add a guard for
   saves written before `cam` was persisted (and any malformed value):

```js
  if (!d.cam || typeof d.cam.x !== 'number') {
    const cx = d.camp ? d.camp.x : 0, cy = d.camp ? d.camp.y : 0;
    d.cam = {
      x: Math.max(0, Math.min(MAP_W - VIEW_W, Math.round(cx - VIEW_W / 2))),
      y: Math.max(0, Math.min(MAP_H - VIEW_H, Math.round(cy - VIEW_H / 2))),
    };
  }
```

3. Extend the import at `js/save.js:3` to include the viewport constants:
   `import { MAP_W, MAP_H, VIEW_W, VIEW_H, TRAITS } from './data.js';`

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green (existing
save/load test must still pass).

### Step 2 (Fix A tests): Round-trip and legacy-save camera tests

In `test/boundaries.test.js`, inside the existing `describe('save/load')` block
(`test/boundaries.test.js:48-67`), add two tests:

```js
  it('round-trips the camera position', () => {
    G.camp = { x: 70, y: 48 };
    G.cam = { x: 33, y: 21 };
    save();
    G.cam = { x: 0, y: 0 };
    expect(loadGame()).toBe(true);
    expect(G.cam).toEqual({ x: 33, y: 21 });
  });

  it('centers the camera on camp for saves without one', () => {
    G.camp = { x: 70, y: 48 };
    save();
    const raw = JSON.parse(store['hearthfall.save']);
    delete raw.cam;
    store['hearthfall.save'] = JSON.stringify(raw);
    expect(loadGame()).toBe(true);
    expect(G.cam.x).toBeGreaterThan(0);   // 70 - 72/2 = 34
    expect(G.cam.y).toBeGreaterThan(0);   // 48 - 38/2 = 29
    expect(G.cam).toEqual({ x: 34, y: 29 });
  });
```

(`store` is the module-level stub object at `test/boundaries.test.js:4`.)

**Verify**: `pnpm test` → all pass including the 2 new tests.

### Step 3 (Fix B): Ignore chords with Ctrl/Cmd/Alt

In `js/ui.js`, change the keydown listener to bail out first:

```js
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // browser/OS chords are not game input
    dispatchKey(e.key, { shift: e.shiftKey });
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
  });
```

**Verify**: `pnpm check && pnpm lint` → green. Manual: in `pnpm dev`, press
Cmd/Ctrl+R — the page reloads and, on resuming, the log does NOT show "♪ The
alarm bell rings" from before the reload (start a new game, note alarm is off,
Cmd+R, Continue → alarm still off).

### Step 4 (Fix C): Pause the sim in trade and workshop

In `js/screens.js`, add the flag to exactly two lines:

- `:905` → `id: 'workshop', modal: true, pausesSim: true, focus: 0,`
- `:948` → `id: 'trade', modal: true, pausesSim: true, focus: 0,`

**Verify**: `grep -n "pausesSim" js/screens.js` → 8 matches (was 6).
Manual: open the trade menu (`e` with trader in camp, or click the trader), watch
the clock in the sidebar — time must freeze; close, time resumes.

### Step 5 (Fix D): Cap survivor rescues at 16

In `js/world.js`, wrap the survivors branch:

```js
    if (loc.type === 'survivors') {
      if (G.settlers.length < 16) {
        const s = makeSettler(G.camp.x, G.camp.y, 'worker');
        s.away = true;
        G.settlers.push(s);
        updatePeak();
        e.ids.push(s.id);
        addLog(`Rescued ${s.name} (${traitName(s).toLowerCase()}) — they will join the commune!`, '#e8d8a0');
      } else {
        addLog('The rescued folk find the commune full and settle down the road, grateful.', '#b8b2a0');
      }
    } else if (chance(0.08) && G.settlers.length < 16) {
```

**Verify**: `pnpm check && pnpm lint` → green;
`grep -n "settlers.length < 16" js/world.js` → 2 matches.

### Step 6 (Fix E): Numeric comparator in mapgen percentiles

`js/map.js:38` becomes:

```js
  const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[(s.length * p) | 0]; };
```

**Verify**: `pnpm check && pnpm lint && pnpm test` → green. Manual: start a new
game — the map generates with a river and normal biome mix (grossly similar to
before; exact layouts may differ, which is expected and fine).

### Step 7 (Fix F): Normalize wheel delta mode

In `js/ui.js`, replace the wheel handler body:

```js
  canvas.addEventListener('wheel', e => {
    const s = top();
    if (s && s.pan) {
      e.preventDefault();
      // deltaMode: 0 = pixels, 1 = lines, 2 = pages
      const k = e.deltaMode === 1 ? 1 : e.deltaMode === 2 ? 10 : 1 / 25;
      s.pan(Math.round(e.deltaX * k), Math.round(e.deltaY * k));
    }
  }, { passive: false });
```

**Verify**: `pnpm check && pnpm lint` → green. Manual (best-effort): trackpad
two-finger scroll pans the map as before in Chrome/Safari; if Firefox is
available, a plain mouse wheel now pans ~1 cell per notch line.

## Test plan

- Two new tests in `test/boundaries.test.js` (Step 2): camera round-trip and
  legacy-save centering — these regression-lock Fix A.
- Fixes B/C/D/E/F are covered by the grep/manual verifications above; D and E
  live in code paths (expedition resolution, mapgen) that plan 004+ will bring
  under test — do not build test scaffolding for them here.
- Verification: `pnpm test` → green, 13 tests total (11 existing + 2 new).

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0; 2 new tests present
- [ ] `grep -c "void _cam" js/save.js` → 0
- [ ] `grep -n "ctrlKey" js/ui.js` → 1 match in the keydown handler
- [ ] `grep -c "pausesSim" js/screens.js` → 8
- [ ] `grep -c "settlers.length < 16" js/world.js` → 2
- [ ] `grep -n "sort((a, b) => a - b)" js/map.js` → 1 match
- [ ] `grep -n "deltaMode" js/ui.js` → present in the wheel handler
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (per step) if:

- An excerpt above doesn't match the live code at the cited lines (drift).
- Step 1: you find any *other* consumer of the saved `cam` shape (grep
  `\.cam` across `js/`) that breaks — expected consumers are `js/screens.js`
  and `js/game.js` reading `G.cam.x/y` at runtime only.
- Step 4: adding `pausesSim` to trade/workshop makes their `update()` self-close
  stop firing (trader-leaves / workshop-burned no longer closes the modal in a
  manual test) — that would mean `main.js` gates `update()` on the sim, contrary
  to the excerpt.
- Any fix requires touching an out-of-scope file.

## Maintenance notes

- Fix A: `cam` is now part of the save shape; if a future refactor renames it,
  extend `migrate()` — never let `Object.assign(G, makeState(), d)` be the only
  defense.
- Fix C: if a future modal is added, the convention is now *all* modals pause
  except the world screen; add `pausesSim: true` by default.
- Deferred deliberately: making `migrate()` always re-merge `stats`/`mods` over
  defaults (forward-compat for unversioned schema additions) — plan 004 touches
  the same function and carries that change with its tests.
