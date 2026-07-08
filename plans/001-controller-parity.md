# Plan 001: Make the controller able to build, demolish, and ring the alarm

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3ee106c..HEAD -- js/gamepad.js js/screens.js README.md`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3ee106c`, 2026-07-07

## Why this matters

The README claims "Full controller support via the Gamepad API", but a controller
cannot place a single building or demolish anything today, and cannot ring the
alarm bell — the primary response to an incoming raid. The cause is that the A
button emits the virtual key `Paint` whenever the game is not in NORMAL mode, but
selecting a build-menu entry only responds to `Enter` (or letter keys the pad
can't send), and single-tile demolish only fires on a *non-drag* press that
`Paint` never produces. This plan fixes A-button translation and adds an alarm
binding, entirely inside `js/gamepad.js`, plus a README correction.

## Current state

HEARTHFALL is a no-dependency vanilla-JS browser game. `js/gamepad.js` polls the
Gamepad API once per frame and translates buttons into virtual key names fed to
the same `dispatchKey` used by the keyboard. `G` is the global game-state
singleton (`js/state.js`); `G.mode` is one of `'NORMAL' | 'BUILD' | 'CANCEL'`,
and `G.buildSel` is the currently chosen build definition (null while browsing
the build menu).

The faulty translation, `js/gamepad.js:57-58`:

```js
  fire('a', b(0) && G.mode === 'NORMAL', 'Enter', now, false);
  fire('paint', b(0) && G.mode !== 'NORMAL', 'Paint', now, true);
```

`fire(id, cond, key, now, repeat)` (`js/gamepad.js:22-35`) edge-detects a button
and optionally key-repeats while held.

How the game screen consumes these keys, `js/screens.js` (do not modify this
file — it already handles `Enter` correctly in every mode):

```js
// js/screens.js:343-351 — build-menu browsing (G.mode === 'BUILD', no buildSel):
      if (G.mode === 'BUILD') {
        const tb = tabBuilds();
        if (/^[a-e]$/.test(k)) { selectBuild(scr, tb.find(b => b.key === k)); return; }
        if (!G.buildSel) {
          ...arrow-key tab/row navigation...
          if (k === 'Enter') { selectBuild(scr, tb[scr.buildFocus]); return; }
        }

// js/screens.js:394-398 — map action:
      if (k === 'Enter' || k === 'Paint') {
        if (!inMap(G.cursor.x, G.cursor.y)) { moveCursor(0, 0); return; }
        const cx = G.cursor.x, cy = G.cursor.y;
        if (G.mode !== 'NORMAL') { paintCell(cx, cy, k === 'Paint'); return; }
        if (k === 'Paint') return;

// js/screens.js:251-255 — why Paint can never single-demolish:
function paintCell(x, y, isDrag) {
  if (!inMap(x, y)) return;
  if (G.mode === 'BUILD' && G.buildSel) tryPlaceBuild(x, y);
  else if (G.mode === 'CANCEL') { if (!isDrag) cancelAt(x, y); }
}
```

So the correct virtual key for the A button, per state:

| State | Correct key | Why |
|---|---|---|
| `NORMAL` | `Enter` (edge) | acts at cursor / confirms selection box |
| `BUILD` and `G.buildSel == null` | `Enter` (edge) | confirms the focused build-menu row (`screens.js:351`) |
| `BUILD` and `G.buildSel != null` | `Paint` (repeat) | drag-places the chosen structure |
| `CANCEL` | `Enter` (edge) | `paintCell(..., false)` → `cancelAt` single demolish (`screens.js:397,254`) |

The current full button map (`js/gamepad.js:53-68`) uses buttons 0–9, 11–15.
**Button 10 (L3, left-stick click) is unused** — it becomes the alarm.

The alarm key on keyboard, `js/screens.js:382`: `if (k === 'r') { toggleAlarm(); return; }`
(only reachable when `G.mode !== 'BUILD'` — that guard lives in `screens.js` and
is fine; the pad just needs to emit `'r'`).

README's controller line, `README.md:88-91`:

```
**Controller** (standard layout): stick/d-pad moves the cursor and
navigates every menu · A confirm/act (hold to drag-paint) · B back ·
X build menu · Y world map · LB/RB cycle tools · LT/RT game speed ·
Start pause · Back help · R3 graphics toggle.
```

Repo conventions: plain ES modules, JSDoc comments only where non-obvious,
2-space indent, single quotes. Existing tests live in `test/boundaries.test.js`
(vitest) and stub globals with `vi.stubGlobal` before dynamically importing
modules — match that pattern.

## Commands you will need

| Purpose   | Command        | Expected on success |
|-----------|----------------|---------------------|
| Install   | `pnpm install` | exit 0              |
| Typecheck | `pnpm check`   | exit 0, no output   |
| Lint      | `pnpm lint`    | exit 0, no output   |
| Tests     | `pnpm test`    | all pass            |
| Manual    | `pnpm dev`     | game at http://localhost:8137 |

## Scope

**In scope** (the only files you should modify/create):
- `js/gamepad.js`
- `test/gamepad.test.js` (create)
- `README.md` (controller paragraph only)

**Out of scope** (do NOT touch):
- `js/screens.js` — its key handling is correct; the bug is purely in translation.
- `js/ui.js` — `dispatchKey` is shared by keyboard; changing it risks keyboard regressions.
- Any other button's mapping (LB/RB/LT/RT/Start/Back/R3 stay as they are).

## Git workflow

- Branch: `advisor/001-controller-parity`
- One commit per step is fine; message style matches repo (imperative summary line, e.g. "Fix controller build/demolish and add alarm binding").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract a testable A-button key decision

In `js/gamepad.js`, add an exported pure function near the top (after the
imports) and use it in `pollGamepad`:

```js
// Which virtual key the A button should emit, given the game-screen state.
// BUILD with a selection drag-paints; everything else is a plain confirm
// (screens.js treats Enter as single-act in every mode).
export function aButtonKey(mode, buildSel) {
  return mode === 'BUILD' && buildSel ? 'Paint' : 'Enter';
}
```

Replace `js/gamepad.js:57-58`:

```js
  fire('a', b(0) && G.mode === 'NORMAL', 'Enter', now, false);
  fire('paint', b(0) && G.mode !== 'NORMAL', 'Paint', now, true);
```

with:

```js
  const aKey = aButtonKey(G.mode, G.buildSel);
  fire('a', b(0) && aKey === 'Enter', 'Enter', now, false);
  fire('paint', b(0) && aKey === 'Paint', 'Paint', now, true);
```

Note the two `fire` ids stay distinct (`'a'` edge-triggered, `'paint'`
repeating) so holding A while placing keeps repeating, and a held A does not
re-trigger when the mode changes under it.

**Verify**: `pnpm check && pnpm lint` → both exit 0.

### Step 2: Bind L3 to the alarm bell

In `pollGamepad`, next to the existing `fire('r3', b(11), 'v', now, false);`
line (`js/gamepad.js:68`), add:

```js
  fire('l3', b(10), 'r', now, false);
```

Also update the mapping comment block at the top of the file
(`js/gamepad.js:4-14`) to add a line: `//   L3 (10)             ring/silence the alarm bell`.

**Verify**: `pnpm check && pnpm lint` → both exit 0.

### Step 3: Unit-test the key decision

Create `test/gamepad.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { aButtonKey } from '../js/gamepad.js';

describe('aButtonKey', () => {
  it('confirms in NORMAL mode', () => {
    expect(aButtonKey('NORMAL', null)).toBe('Enter');
  });
  it('confirms while browsing the build menu (no selection yet)', () => {
    expect(aButtonKey('BUILD', null)).toBe('Enter');
  });
  it('paints while placing a selected building', () => {
    expect(aButtonKey('BUILD', { id: 'tent' })).toBe('Paint');
  });
  it('single-demolishes in CANCEL mode', () => {
    expect(aButtonKey('CANCEL', null)).toBe('Enter');
  });
});
```

Note: `js/gamepad.js` imports `./ui.js`, `./journal.js`, `./state.js` at module
level; none of them touch `document`/`localStorage` at import time except
`journal.js` — if the import chain throws in vitest's node environment, stub the
missing global at the top of the test file exactly the way
`test/boundaries.test.js:1-10` stubs `localStorage` and `performance`, and use
`await import(...)` after the stubs.

**Verify**: `pnpm test` → all tests pass, including 4 new ones.

### Step 4: Correct the README controller paragraph

Update the controller paragraph (`README.md:88-91`) to read (keep surrounding
text unchanged):

```
**Controller** (standard layout): stick/d-pad moves the cursor and
navigates every menu · A confirm/act (hold to drag-paint) · B back ·
X build menu · Y world map · LB/RB cycle tools · LT/RT game speed ·
L3 alarm bell · Start pause · Back help · R3 graphics toggle.
```

**Verify**: `grep -n "L3 alarm bell" README.md` → one match.

### Step 5: Manual smoke test (if a controller is available; otherwise report untested)

`pnpm dev`, connect a standard-layout pad, start a new game, then confirm:
X opens build menu → d-pad picks a row → **A selects it** → cursor moves →
**A places the structure** (hold A while moving paints several) → RB to CANCEL
mode → **A demolishes a single plan** → back in NORMAL, **L3 rings the alarm**
(log line "♪ The alarm bell rings"), L3 again silences it.

**Verify**: all five behaviors observed. If no controller is available, state
that in the completion report — the unit tests plus code trace still stand, but
flag the plan as needing one human playtest.

## Test plan

- New file `test/gamepad.test.js`: the 4 state→key cases above (this is the
  regression net for the exact bug).
- Pattern: `test/boundaries.test.js` (vitest, stub-then-import).
- Verification: `pnpm test` → green.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `test/gamepad.test.js` exists with the 4 cases and passes
- [ ] `grep -n "aButtonKey" js/gamepad.js` → definition + one use in `pollGamepad`
- [ ] `grep -n "b(10)" js/gamepad.js` → one match (L3 → `'r'`)
- [ ] `grep -c "G.mode === 'NORMAL'" js/gamepad.js` → 0 (old condition gone)
- [ ] README controller paragraph mentions L3 alarm bell
- [ ] `git status` shows only the three in-scope files modified/created
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `js/gamepad.js:57-58` or `js/screens.js:394-398` don't match the excerpts
  above (drift).
- After Step 1, placing a building via **keyboard** (`b`, arrows, Enter, Enter
  at cursor) stops working in a manual check — the change must not affect
  keyboard paths at all.
- You find yourself wanting to modify `js/screens.js` or `js/ui.js` to make the
  pad work — that means the state table above is wrong for some case; report
  which case.

## Maintenance notes

- Any future `G.mode` value (new tool modes) must be added to `aButtonKey`'s
  reasoning — default is `Enter`, which is safe for menu-like modes.
- If a future change gives the pad more actions (trade `e`, minimap `n`,
  save-quit `Q`), prefer the pause menu / existing screens over burning the last
  free buttons; the pad already reaches trade by parking the cursor on the
  trader and pressing A (`js/screens.js:400` → `clickInteract`).
- Deferred deliberately: drag-demolish on pad (hold-A in CANCEL). Single-press
  demolish is the correct, safe default; revisit only if playtests want more.
