# Plan 026: Colorblind + readability pass, and a keyboard/pad path to the morale "why" (P5-1 + P0-4)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/mapdraw.js js/tiles.js js/data.js js/gfx.js js/gamepad.js js/ui.js js/screens.js js/ui/ test/gamepad.test.js README.md`
> Every line number below is anchored at `14fd915` and is a **hint, not an
> address** — this plan runs after plan 009 (`js/screens.js` split into
> `js/ui/*`) and after the HP0 batch, so the sidebar/modal code has moved
> files and the settler/cast surfaces have grown. **Re-locate every excerpt by
> its symbol name** (`hpBar`, `drawSidebar`, `drawWorldAscii`, `makePauseMenu`,
> `makeHelpModal`, `moraleWhy`), not by line. If a symbol is gone or its shape
> differs from the excerpt, re-read the owning file fully before editing.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MEDIUM (touches both world renderers, the sidebar, and two input
  paths; the draw paths have no pixel-level unit coverage, so the net is the
  gamepad/palette unit tests plus a manual sweep. Additive — no grid geometry,
  no keybinding removals, no save-shape change)
- **Depends on**: 009 (screen split — the sidebar painters and modals this
  plan edits live in `js/ui/sidebar.js` and `js/ui/modals.js` by execution
  time; **read `plans/009-screens-split.md`** for the exact move map). Runs
  after the HP0 batch, so plan 012's cast v2 UI (HP-2 — resolve bands, wants)
  is part of the audit surface (Step 5).
- **Category**: accessibility / UX
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: P5-1 (colorblind + readability pass) and P0-4 (keyboard/pad
  path to the morale "why")

## Execution model (read before touching anything)

Plans in this repo run **sequentially, on `main`, in numeric order** — no
feature branches, each plan ends in a green checkpoint commit
(`plans/README.md` Dependency notes). This plan is 026, so by the time it
runs:

- **Plan 009 has landed.** `js/screens.js` is now just the game screen +
  input + `beginRun`; the sidebar/log/minimap painters and `hpBar`/
  `sidebarLayout` live in `js/ui/sidebar.js`; the pause menu and help modal
  live in `js/ui/modals.js` (009 Function-inventory table). The two world
  **renderers** (`js/mapdraw.js` ASCII, `js/tiles.js` sprites) were **not**
  moved by 009 and keep their paths. Every "was `js/screens.js:NNN`" below
  means "find the symbol in its 009 destination file".
- **The HP0 batch has landed.** In particular **plan 012 (HP-2 cast v2)**
  added a cast/roster surface with **resolve bands** (a color-banded meter)
  and **wants** — a brand-new field of color-only signals. It is part of this
  pass's remit; Step 5 sweeps it by symbol, and no-ops cleanly if 012 turns
  out not to have shipped that surface.

The fixed **100×45 CRT grid is an owner design constant** (plans 005/009;
`plans/README.md` "Findings considered and rejected" — fit-to-window is
rejected). This plan changes **glyphs and colors within existing cells only**.
If a step wants a new row, a wider sidebar, or a moved widget: STOP — that is
not this plan.

## Why this matters

Two roadmap items, one theme: information the game encodes **only in hue** is
invisible to the ~8% of players with a color-vision deficiency, and one of the
game's most important explanations is reachable **only with a mouse**.

- **P5-1** — Role identity on the map is color-only: every settler is the same
  glyph `☺`, and worker/farmer/guard are told apart solely by `ROLE_COLORS`
  (`js/mapdraw.js` settler loop, ~57-63 at 14fd915). The sidebar HP bar is a
  red→yellow→green block run with **no numeral and no pattern** (`hpBar`,
  ~231-235). `ROLE_COLORS` itself pairs a warm gray (worker `#d8d2c0`) with a
  green (farmer `#79c258`) — the classic deuteranopia-confusable pair
  (`js/data.js:98`).
- **P0-4** — `moraleWhy()` (`js/game.js:40-52`) is the game telling you *why*
  spirits are sinking. It is surfaced in exactly one place: a click on the
  morale meter widget (`notice(moraleWhy() || ...)`, `js/screens.js:302-305`
  at 14fd915, inside `makeGameScreen().widgets`). The README advertises "full
  keyboard play" and full controller support (`README.md:86,88-91`), yet this
  text is unreachable without a pointer — a hole in an otherwise complete
  input story.

Neither needs new mechanics or a layout change. Both are "add a second,
non-color channel to a signal that already exists."

## Current state

### The two renderers draw the same world twice — audit both

`js/mapdraw.js` (ASCII) and `js/tiles.js` (sprites) are selected by
`GFX.mode` (`js/gfx.js:20`, `js/screens.js` game-screen `draw`). A colorblind
fix must land in **both** or it half-works depending on the graphics toggle.

```js
// js/mapdraw.js:57-63 — ASCII settlers: ONE glyph, role carried only by color
for (const s of G.settlers) {
  if (s.away || insideHouse(s) || !onScreen(s.x, s.y)) continue;
  let fg = ROLE_COLORS[s.role] || '#d8d2c0';   // <- the only role cue
  if (s.sleeping) fg = '#5a6a90';              // state: also color-only
  if (s.downed) fg = (f >> 3) % 2 ? '#c05050' : '#7a3a3a';
  if (s.starving && (f >> 3) % 2) fg = '#e05040';
  put(s.x - cam.x, s.y - cam.y, '☺', dim(fg, s.sleeping ? 1 : ef));
}
```

```js
// js/tiles.js:490-501 — sprite settlers: role IS a distinct sprite (better),
// but downed/starving are color-wash overlays only
const set = (s.sleeping || s.downed) ? A.sleeper : A.settler;
ctx.drawImage(set[s.role] || set.worker, ...);   // role reads by sprite shape
if (s.downed) { ctx.fillStyle = 'rgba(192,64,48,0.32)'; ... }
```

### The full color-only inventory (verified at 14fd915 — re-verify by symbol)

| # | Signal | Where (14fd915) | Non-color cue today? | Verdict |
|---|--------|-----------------|----------------------|---------|
| 1 | **Settler role, ASCII map** | `js/mapdraw.js:57-63` | none — all `☺` | **fix (primary)** |
| 2 | **Settler role, sprite map** | `js/tiles.js:490-493` | sprite shape per role | ok; recolor via palette |
| 3 | **Settler state (sleep/down/starve), both maps** | `js/mapdraw.js:60-63`, `js/tiles.js:492-500` | glyph unchanged; sprite swaps for sleep/down | weak — down/starve are color-wash only |
| 4 | **Sidebar HP bar** | `hpBar` `js/screens.js:231-235`; drawn `522-533` | block count encodes magnitude; **no numeral, one fill glyph** | **fix (primary)** |
| 5 | **Morale meter** | `drawSidebar` `js/screens.js:466-470` | `moraleLabel()` text + block count | ok — verify, minimal |
| 6 | **Food line** | `js/screens.js:478` | numeric `·Nd` in the string | ok, leave |
| 7 | **Raid / horde warning** | `js/screens.js:480` | `⚠` glyph + count + flashing | ok — palette the red |
| 8 | **Alarm line** | `js/screens.js:481` | `♪` glyph + text | ok, leave |
| 9 | **Trader on map** | `js/mapdraw.js:49` | glyph `☺` **same as settlers**, only gold color differs | weak — give a distinct glyph |
| 10 | **Designation marks, both maps** | `js/mapdraw.js:40`, `js/tiles.js:466-470` | base terrain glyph differs; desig-vs-plain is a gold tint only | weak — low priority |
| 11 | **Minimap dots** | `drawMinimap` `js/screens.js:593-596` | settler `·` vs raider `•` vs camp `☼` — glyph-differentiated | ok, leave |
| 12 | **Beacon lit/unlit, ASCII** | `js/mapdraw.js:28` | color only (glyph unchanged) | weak — sidebar already narrates it; low priority |
| 13 | **Raider types** | `js/data.js:135-141`, drawn `js/mapdraw.js:50-55` | **distinct glyph per type** (`☻ Ø § ¡ ☠`) | already good — the model to copy |
| 14 | **Cast v2 resolve bands + wants** (plan 012) | re-locate — Step 5 | unknown at plan time | **fix — sweep in Step 5** |

Row 13 is the north star: raiders are unmistakable **because the glyph carries
the identity and color is redundant.** This plan brings roles (1), HP (4),
trader (9), and the cast bands (14) up to that bar, and adds an alternate
palette for everyone still relying on hue.

### The persisted-prefs idiom to reuse

The game already persists two display prefs with an identical pattern — a
module-level singleton hydrated from `localStorage` under a scalar key, plus a
`toggle*()` that flips and re-writes:

```js
// js/gfx.js:20-30 — VERIFY this shape before reusing
export const GFX = { mode: (() => { try { return localStorage.getItem('hearthfall.gfx') || 'tiles'; } catch (e) { return 'tiles'; } })() };
export function toggleGfx() { GFX.mode = GFX.mode === 'tiles' ? 'ascii' : 'tiles'; try { localStorage.setItem('hearthfall.gfx', GFX.mode); } catch (e) {} }
export const MM = { on: (() => { try { return localStorage.getItem('hearthfall.minimap') !== 'off'; } catch (e) { return true; } })() };
export function toggleMinimap() { MM.on = !MM.on; try { localStorage.setItem('hearthfall.minimap', MM.on ? 'on' : 'off'); } catch (e) {} }
```

**Verified constraint:** `hearthfall.gfx` holds the plain string
`'tiles'`/`'ascii'` and its load path (`js/gfx.js:20`) assumes that. **Do not
overload it** with palette state — a JSON blob or a third value there breaks
graphics-mode load for every existing player. The palette pref gets its **own
key** `hearthfall.palette`, mirroring the *idiom* above (that is what "reuse
the gfx prefs" means here). This is a review gate.

### The morale "why" is mouse-only

```js
// js/screens.js:302-305 (inside makeGameScreen().widgets — stays in screens.js post-009)
ws.push({ // the morale meter explains itself on click
  rect: { x: SB_X, y: 4, w: SB_INNER, h: 1 },
  onClick: () => notice(moraleWhy() || 'Spirits are level — nothing weighs on them.'),
});
```

Input flows: keyboard `keydown` → `dispatchKey(e.key, {shift})`
(`js/ui.js:91-93`) → top screen's `keymap` then `onKey` (`js/ui.js:48-49`);
gamepad buttons → `fire(id, cond, key, ...)` → `handleKey` →
`dispatchKey(key, {})` (`js/gamepad.js:19,30-43`). The game screen has **no
`keymap`**, so its keys are all handled in `onKey` (`js/screens.js:336-406`).
`js/ui.js` needs **no change** — a new key just needs an `onKey` case and a
gamepad `fire()` line, exactly like the alarm bell (`r`) which reaches the same
`onKey` from both keyboard (`js/screens.js:384`) and pad
(`fire('l3', b(10), 'r', now, false)`, `js/gamepad.js:77`).

**Gamepad buttons 0–15 are all bound** (`js/gamepad.js:56-78`: A/B/X/Y,
LB/RB, LT/RT, Back, Start, L3, R3, and the four d-pad). There is no free plain
button — Step 6 uses a **both-bumpers chord** (LB+RB together), a gesture that
means nothing today, and gates the individual LB/RB tool-cycle so the chord
doesn't also cycle tools.

### The pause menu is where a display toggle belongs

```js
// makePauseMenu — js/screens.js:797-821 at 14fd915; lives in js/ui/modals.js post-009
const items = [ { key:'1', ... 'Resume' }, ... { key:'4', ... `Graphics: ...`, act: () => toggleGfx() }, { key:'5', ... `Minimap: ...`, act: () => toggleMinimap() }, { key:'6', ... 'Save & quit...' } ];
```

The palette toggle slots in beside Graphics/Minimap as a new numbered row
(the modal is a `makeListScreen`, so adding one item is data, not layout —
but re-verify the item count and `bh` math after 009's single-sourcing pass).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| All gates | `pnpm check && pnpm lint && pnpm test` | exit 0; suite green |
| Gamepad unit | `pnpm vitest run test/gamepad.test.js` | passes (old + new) |
| Palette unit | `pnpm vitest run test/palette.test.js` | that file passes |
| Manual play | `pnpm dev` → http://localhost:8137 | Step 8 checklist |

Run the three gates **after every step**.

## Scope

**In scope**:
- `js/palette.js` (create) — semantic identity tokens (role / hp-band /
  morale-band / warn colors) in a default and a colorblind-safe variant, plus
  the redundant non-color cue tables (`ROLE_GLYPH`, HP-band fill chars), all
  selected by the active palette.
- `js/gfx.js` — add `PAL` + `togglePalette()` under `hearthfall.palette`
  (idiom-identical to `GFX`/`MM`; new key).
- `js/mapdraw.js`, `js/tiles.js` — route role/state/trader identity through
  `palette.js`; ASCII settlers gain a role-distinguishing glyph in readability
  mode.
- `js/ui/sidebar.js` (post-009) — `hpBar` patterned fill; role/morale/warn
  colors via `palette.js`; keep the existing `ROLE_LETTER` in settler rows.
- `js/ui/modals.js` (post-009) — palette toggle row in `makePauseMenu`; a
  controls line in `makeHelpModal`.
- `js/screens.js` — a morale-"why" key in `makeGameScreen().onKey`.
- `js/gamepad.js` — a LB+RB chord emitting `MORALE_WHY`; export a pure chord
  predicate for the test.
- The cast v2 surface (plan 012's file under `js/ui/`) — Step 5, by symbol.
- `test/palette.test.js` (create), `test/gamepad.test.js` (extend).
- `README.md` (keyboard + controller tables), `plans/README.md` (status row).

**Out of scope**:
- **Any grid/layout change** — no new rows, no wider sidebar, no moved
  widgets. Glyphs and colors within existing cells only.
- Re-theming decorative terrain/season colors, night gradients, or the CRT
  chrome — this pass targets the **identity-critical** signals in the audit
  table, not every hex in the codebase.
- Removing or remapping any existing key or gamepad button.
- New sprite art. Sprite mode's role sprites already differ (row 2); this plan
  only re-sources their tints from the palette.
- Save/meta/campaign shape — the palette pref is a UI-preference key, never a
  run or campaign field.

## Git workflow

- Branch: `advisor/026-readability-pass` (or continue on `main` per the
  sequential execution model — match how 009–025 were run).
- Commits: one per step, imperative ("Add the palette module and cbSafe
  variant").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `js/palette.js` — the identity token module

Create a leaf module (imports only `PAL` from `./gfx.js`, added in Step 2 —
land Step 2's `gfx.js` edit first, or stub `PAL` and wire the import when
Step 2 lands). It owns two things: **which color** a semantic signal uses, and
**which non-color cue** carries it, both keyed by the active palette.

```js
// Central source for identity-critical colors and their redundant non-color
// cues. Two variants: 'classic' (the game's look) and 'cbSafe' (a
// colorblind-safe alternate that also flips ASCII settlers to role letters).
// Only signals in the plan-026 audit table live here — decorative terrain and
// chrome keep their inline hexes.
import { PAL } from './gfx.js';

// Role: classic pairs a warm gray (worker) with a green (farmer) — the
// deuteranopia-confusable pair. cbSafe uses Okabe-Ito hues (gray / orange /
// sky) that separate across protan/deutan/tritan vision.
const ROLE = {
  classic: { worker: '#d8d2c0', farmer: '#79c258', guard: '#57b8d8' },
  cbSafe:  { worker: '#e6e6e6', farmer: '#e69f00', guard: '#56b4e9' },
};
// HP bands: classic is red/amber/green (red-green fails together). cbSafe uses
// blue/amber/red so "healthy" and "critical" never collapse into one hue.
const HP = {
  classic: { high: '#6ac060', mid: '#e0c060', low: '#e05040' },
  cbSafe:  { high: '#3a9ad0', mid: '#e0c060', low: '#e05040' },
};
const MORALE = {
  classic: { great: '#8ad080', ok: '#c8c2b0', low: '#e0c060', crisis: '#e05040' },
  cbSafe:  { great: '#56b4e9', ok: '#c8c2b0', low: '#e0c060', crisis: '#e05040' },
};

// Redundant, palette-independent non-color cues (these help even in classic).
// HP-band fill glyphs: band reads by texture, not just hue, inside the 6-cell
// bar — NO width change.
export const HP_FILL = { high: '█', mid: '▓', low: '▒' };
// ASCII map settler glyph by role. In classic we keep the face (color carries
// role, unchanged look). In cbSafe the glyph becomes the role letter so role
// is unambiguous with zero color. Sprite mode uses distinct sprites already.
const ROLE_GLYPH_CB = { worker: 'W', farmer: 'F', guard: 'G' };

export const activePalette = () => (PAL.on ? 'cbSafe' : 'classic');
export const roleColor = (role) => ROLE[activePalette()][role] || ROLE.classic.worker;
export function hpBand(frac) { return frac > 0.6 ? 'high' : frac > 0.3 ? 'mid' : 'low'; }
export const hpColor = (band) => HP[activePalette()][band];
export const moraleColor = (m) => { const v = m >= 75 ? 'great' : m >= 50 ? 'ok' : m >= 35 ? 'low' : 'crisis'; return MORALE[activePalette()][v]; };
// ASCII settler glyph: role letter in cbSafe, the face otherwise.
export const settlerGlyph = (role) => (PAL.on ? (ROLE_GLYPH_CB[role] || '☺') : '☺');
```

Notes the executor must preserve, not "improve":
- The **band thresholds must match the code being replaced** — `hpBand` uses
  the same `0.6`/`0.3` cuts as `hpBar` (`js/screens.js:233`); `moraleColor`
  the same `75/50/35` as `drawSidebar` (`js/screens.js:467`). Re-read those
  two symbols and copy the live thresholds; do not eyeball them.
- cbSafe hexes are a **starting point**, not sacred — the gate is that the
  three role colors and the high/mid/low HP colors are mutually distinguishable
  under protanopia/deuteranopia (check with any CVD simulator). Keep classic
  values **byte-identical** to today so the default look never shifts.

**Verify**: `pnpm check && pnpm lint` → exit 0. `grep -n "'#79c258'\|'#57b8d8'" js/palette.js` shows the classic role values preserved.

### Step 2: `js/gfx.js` — the `PAL` pref (new key, same idiom)

Beside `GFX`/`MM` (`js/gfx.js:20-30`), add:

```js
// Colorblind-safe palette + readability cues. Own key — never overload
// 'hearthfall.gfx' (that scalar is graphics-mode only; see plan 026).
export const PAL = { on: (() => { try { return localStorage.getItem('hearthfall.palette') === 'on'; } catch (e) { return false; } })() };
export function togglePalette() { PAL.on = !PAL.on; try { localStorage.setItem('hearthfall.palette', PAL.on ? 'on' : 'off'); } catch (e) {} }
```

Default is **off** — classic look unless the player opts in.

**Verify**: gates green. `grep -rn "hearthfall.palette" js/` → only `js/gfx.js`
(single owner of the key). `grep -rn "hearthfall.gfx" js/` still shows only
`js/gfx.js` and unchanged semantics.

### Step 3: the two map renderers — role, state, trader

**`js/mapdraw.js`** (settler loop, ~57-63): import
`{ roleColor, settlerGlyph } from './palette.js'`; replace
`ROLE_COLORS[s.role] || '#d8d2c0'` with `roleColor(s.role)` and the literal
`'☺'` with `settlerGlyph(s.role)`. Leave the sleep/down/starve color branches
as-is for now (they overlay onto the role color; keep behavior). The trader
(`js/mapdraw.js:49`): give it a distinct glyph so it is not a same-glyph
color-only twin of settlers — change `'☺'` to `'$'` (or another unused
trader glyph; confirm it is not already a map glyph via
`grep -n "put(.*'\\$'" js/mapdraw.js`). Keep its gold color.

**`js/tiles.js`** (settler loop, ~490-501): role already reads by sprite; only
re-source any role-derived **tint** through `roleColor` if one exists (if the
loop uses no role color, no change — the sprites carry it). Do **not** invent a
sprite recolor that changes the classic look; the win here is the ASCII path.

`ROLE_COLORS` in `js/data.js` stays (it is the classic source `palette.js`
reads); do not delete it.

**Verify**: gates green. In `pnpm dev` with palette **off**, the map looks
byte-identical to before (Step 8 confirms). `grep -n "ROLE_COLORS\[" js/mapdraw.js`
→ no direct reads remain (all via `roleColor`).

### Step 4: `js/ui/sidebar.js` — patterned HP, palette colors, keep the letter

Re-locate `hpBar` and `drawSidebar` (009 moved them here from
`js/screens.js:231-235` and `451-559`). Import
`{ roleColor, hpBand, hpColor, moraleColor, HP_FILL } from '../palette.js'`.

- **`hpBar`** — return the band and its fill glyph, not just a color:
  ```js
  function hpBar(hp, max, w) {
    const frac = hp / max;
    const band = hpBand(frac);
    const filled = Math.max(0, Math.min(w, Math.ceil(frac * w)));
    return { filled, col: hpColor(band), ch: HP_FILL[band] };
  }
  ```
  At the settler-row draw site (was `js/screens.js:532`), paint the filled run
  with `bar.ch` instead of the hard-coded `'█'`:
  `str(SB_X + 12, yy, bar.ch.repeat(bar.filled), bar.col);` — the empty run
  (`'░'`) is unchanged. Band now reads by **texture** (`█`/`▓`/`▒`) as well as
  hue, inside the same 6 cells. No width change.
- **Role color in the settler row** (was `js/screens.js:531`): swap
  `ROLE_COLORS[s.role] || '#d8d2c0'` for `roleColor(s.role)`. **Keep
  `ROLE_LETTER[s.role]`** in the name string exactly as-is — the sidebar's
  redundant letter cue already exists and must survive.
- **Morale** (was `js/screens.js:467`): replace the inline `mCol` ternary with
  `moraleColor(G.morale)`. The block count and `moraleLabel()` text stay.
- **Raid/warning red** (was `js/screens.js:480`): route the alert red through
  `hpColor('low')` (or a `warn` token if you prefer to add one to
  `palette.js`) so the palette moves it too; keep the flash and the `⚠` glyph.

Signals 6, 8, 11, 12 (food, alarm, minimap, beacon) already carry a non-color
cue (verified in the audit table) — leave them.

**Verify**: gates green. `grep -n "ROLE_COLORS\[\|'#6ac060'\|'#e05040'" js/ui/sidebar.js`
→ HP/role literals now come from `palette.js` (no stray band hexes in the
settler-row/morale paths). `grep -n "ROLE_LETTER" js/ui/sidebar.js` → still
present.

### Step 5: sweep plan 012's cast v2 (resolve bands + wants)

By execution time HP-2 has added a cast/roster surface with a **resolve band**
(a color-banded meter like morale) and **wants**. Re-locate it:

```
grep -rln "resolve\|wants\|roster\|cast" js/ui/
```

If a resolve-band color ladder or a wants list renders there:
- Route its band colors through `palette.js` — add a `resolveColor(band)` (or
  reuse `moraleColor` if the bands match) so the toggle covers it.
- Add a **non-color cue** to the resolve band the same way Step 4 did HP: a
  per-band fill glyph or a short band **label**, within existing cells.
- If "wants" render as color-coded chips/dots, give each want a glyph or
  letter so it is not hue-only.

**If the grep finds nothing** (012 shipped without a color-banded cast meter,
or shipped differently than the roadmap sketch): **no-op this step** and note
it in the report — do not invent a surface. This step is defensive coverage,
not a mandate to build UI.

**Verify**: gates green; if edited, the cast surface reads without color in a
CVD simulator; if skipped, the report says why.

### Step 6: P0-4 — keyboard + gamepad path to `moraleWhy()`

**Keyboard** — in `makeGameScreen().onKey` (`js/screens.js:336-406`), add a
case beside the other single-letter game keys (mnemonic `m` for morale;
verified unbound on the game screen at 14fd915 — re-check it is still free):

```js
if (k === 'm' || k === 'MORALE_WHY') { notice(moraleWhy() || 'Spirits are level — nothing weighs on them.'); return; }
```

Place it in the same `G.mode !== 'BUILD'` neighborhood as `r`/`e`/`w` so it
does not steal a build-menu letter, and mirror the widget's string **exactly**
(`js/screens.js:304`) so click and key say the same thing. `moraleWhy` and
`notice` are already imported by this file (`js/screens.js:9,7`).

**Gamepad** — buttons are exhausted (audit above), so use a **both-bumpers
chord**. Add a pure predicate (for the test, following the `aButtonKey`
precedent) and wire it before the individual bumper fires, gating them so the
chord does not also cycle tools:

```js
// js/gamepad.js
export function bumperChord(lb, rb) { return lb && rb; } // LB+RB = "explain morale"

// inside pollGamepad, replacing the lb/rb fires:
const lb = b(4), rb = b(5);
fire('why', bumperChord(lb, rb), 'MORALE_WHY', now, false);
fire('lb', lb && !bumperChord(lb, rb), '[', now, false);
fire('rb', rb && !bumperChord(lb, rb), ']', now, false);
```

`MORALE_WHY` flows through `handleKey → dispatchKey → onKey` to the case above.
Update the mapping comment block at the top of `js/gamepad.js` (the `LB/RB`
line) to note the chord.

**Verify**: gates green. `grep -n "MORALE_WHY" js/screens.js js/gamepad.js` →
one handler, one emit. Manual: press `m` on the game screen → the morale notice
appears (Step 8).

### Step 7: surfaces — pause toggle, help, README, and the tests

**Pause menu** (`makePauseMenu`, now in `js/ui/modals.js`): import
`PAL, togglePalette` from `../gfx.js` and add a row after Minimap
(re-verify the item array and any `bh`/height math 009 single-sourced):

```js
{ key: '6', label: () => `Colorblind palette: ${PAL.on ? 'on' : 'off'}`, fg: '#9ac0d8', act: () => togglePalette() },
```

Renumber the existing "Save & quit" row and any keys/`bh` that assume the old
count — the list is `makeListScreen` data, so this is a data edit, but the
`keymap` digits and `bh = items.length * ...` must stay consistent.

**Help modal** (`makeHelpModal`, now in `js/ui/modals.js`): its body already
says "Click the morale bar to hear why." (`js/screens.js:1011`). Update it to
"Click the morale bar — or press `m` — to hear why." and extend the controller
lines (`js/screens.js:1028-1029`) to mention **LB+RB: why morale**. Add a line
noting the colorblind palette lives in the pause menu.

**README** (`README.md`): add an `m` row to the keyboard table (after line 82,
the `space`/help row) — `| \`m\` | why is morale rising or falling |`; and
extend the controller paragraph (`README.md:88-91`) with "LB+RB together
explains morale" and "colorblind-safe palette in the pause menu".

**`test/palette.test.js`** (create) — pure-function tests, stub `localStorage`
before importing (copy the header idiom from `test/meta.test.js:1-9` /
`test/boundaries.test.js`):
1. `activePalette()` is `'classic'` when `PAL.on` is false, `'cbSafe'` when
   true; `roleColor('farmer')` differs between the two.
2. `hpBand(1) === 'high'`, `hpBand(0.5) === 'mid'`, `hpBand(0.1) === 'low'`,
   and `HP_FILL` has a distinct glyph per band (the non-color cue).
3. `settlerGlyph('guard')` is `'☺'` in classic and `'G'` in cbSafe.
4. `togglePalette()` flips `PAL.on` and writes `'on'`/`'off'` to
   `hearthfall.palette` (assert against the stub store), and **never** touches
   `hearthfall.gfx`.

**`test/gamepad.test.js`** (extend the existing `aButtonKey` file): add a
`describe('bumperChord')` — `bumperChord(true, true)` is `true`;
`bumperChord(true, false)` and `bumperChord(false, false)` are `false`. This
pins that a single bumper still cycles tools and only the simultaneous press is
the morale chord.

**Verify**: `pnpm vitest run test/palette.test.js test/gamepad.test.js` →
all pass; then `pnpm check && pnpm lint && pnpm test` → all green.

### Step 8: manual sweep (required — draw paths have no unit coverage)

`pnpm dev`, then, comparing against `main` if anything looks off:

1. **Classic look unchanged.** With the palette **off** (default), the map
   (both `v` graphics modes), the sidebar HP bars, morale meter, and settler
   rows look **exactly** as before this plan. Any visible drift with the
   palette off is a bug — STOP.
2. **HP pattern reads.** A wounded settler's sidebar bar shows a **different
   fill texture** (`▓`/`▒`) than a healthy one, palette on or off.
3. **Palette toggle.** Esc → pause menu → the new "Colorblind palette" row
   toggles; roles on the ASCII map become letters (W/F/G), role/HP/morale
   colors shift to the cbSafe set, and the choice **survives a reload**
   (`localStorage`).
4. **Morale "why" — three inputs, one text.** Click the morale bar, press `m`,
   and (if a pad is present) press LB+RB together — all three raise the **same
   notice**; a lone LB or RB still cycles the build/demolish tool.
5. **Trader** is no longer a same-glyph twin of settlers on the ASCII map.
6. If Step 5 edited the cast surface, open it and confirm resolve bands/wants
   read without color; if skipped, say so.

Any classic-mode rendering difference, or any lost keybinding: STOP.

### Step 9: update `plans/README.md`

Set this plan's row Status to DONE (or BLOCKED with a one-line reason). If the
row is absent from the execution-order table by the time 026 runs, add it in
the table's shape:

```
| 026 | Colorblind + readability pass; keyboard/pad morale "why" | P5-1, P0-4 | P2 | M | 009 | DONE |
```

**Verify**: `git diff plans/README.md` shows only the status/row edit.

## Test plan

Steps 1–7 each land behind `pnpm check && pnpm lint && pnpm test`.
`test/palette.test.js` (~4 tests) pins the palette selection, band logic, the
non-color cues, and the "never touch `hearthfall.gfx`" gate;
`test/gamepad.test.js` gains the chord predicate test. Step 8 is the manual
sweep of the draw paths and the three morale-why inputs the suite cannot see —
its first check (classic look unchanged with the palette off) is the plan's
do-no-harm guarantee.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/palette.js` exists; `roleColor`/`hpBand`/`hpColor`/`moraleColor`/
      `settlerGlyph` and the `HP_FILL` cue table are exported and consumed by
      `js/mapdraw.js` and `js/ui/sidebar.js`
- [ ] `grep -rn "hearthfall.palette" js/` → only `js/gfx.js`; `hearthfall.gfx`
      semantics unchanged (still a scalar mode string)
- [ ] ASCII map settlers read by **glyph** in cbSafe mode; sidebar HP reads by
      **fill texture** in both modes; `ROLE_LETTER` still present in the row
- [ ] With the palette **off**, the game is byte-for-byte the classic look
      (Step 8.1)
- [ ] `moraleWhy()` reachable by mouse **and** `m` **and** LB+RB — same string
      (`grep -n "MORALE_WHY" js/screens.js js/gamepad.js` → one handler, one
      emit); a single bumper still cycles tools
- [ ] Palette toggle present in the pause menu and persists across reload
- [ ] Help modal + README keyboard/controller tables updated
- [ ] Cast v2 (plan 012) surface swept, or the report states why it was a no-op
- [ ] `git status` shows only in-scope files; `plans/README.md` row updated

## STOP conditions

- The drift check shows `js/mapdraw.js`, `js/tiles.js`, `hpBar`/`drawSidebar`,
  or `makePauseMenu`/`makeHelpModal` no longer match their excerpts — re-ground
  every symbol before editing; the line numbers are from 14fd915 and 009+HP0
  have moved this code.
- `hpBar`/morale thresholds in the live code differ from the `0.6/0.3` and
  `75/50/35` cuts copied into `palette.js` — re-copy the live thresholds; a
  mismatch silently reclassifies bands.
- You are tempted to store palette state in `hearthfall.gfx`, or to add a row/
  column/widget to make a cue fit — both violate a review gate (scalar key
  contract; the fixed grid). STOP and reconsider within existing cells.
- Turning the palette **off** no longer reproduces the classic look exactly —
  the classic variant drifted; restore byte-identical classic values.
- A single LB or RB press starts firing `MORALE_WHY`, or stops cycling tools —
  the chord gate is wrong; fix the `!bumperChord(...)` guards before shipping.
- Plan 012's cast surface exists but its shape is nothing like "resolve bands +
  wants" — report the mismatch rather than guessing where to inject cues.

## Maintenance notes

- **Every new color-coded signal** (future raid types, status effects, cast
  fields) gets its identity token in `js/palette.js` with a cbSafe variant and
  a non-color cue — that is now the house pattern, and raider glyphs
  (`js/data.js:135-141`) are the exemplar: glyph carries identity, color is
  redundant.
- The palette pref is UI-only; it must **never** become a run/campaign field
  (plan 010's P5 invariant is unaffected, but the temptation to persist "player
  is colorblind" server-side is the same kind of scope creep — keep it in
  `localStorage`).
- If a later plan wants a graded readability scale (font size, high-contrast
  chrome) it extends `PAL` into an object of prefs, still under
  `hearthfall.palette` — do not spawn a third scalar key.
- Signals 3/10/12 (map state washes, designation tint, beacon lit/unlit) were
  judged low-priority here because each has a nearby text/tooltip narration;
  revisit them if playtests show players missing them.
