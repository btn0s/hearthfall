# Plan 027: Screen-reader affordance — an aria-live mirror of the log/notice stream (P5-2)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` (Step 7 — the row may not exist yet; add it).
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/journal.js js/main.js js/ui.js js/raiders.js js/settlers.js js/run-end.js js/forecasts.js index.html style.css`
> If `js/journal.js` changed, re-read it fully before starting — this plan
> subscribes at `addLog`/`notice` and every excerpt below was verified at
> `14fd915`. Re-locate all cited sites by symbol name, not line number, if
> anything moved. If a `js/a11y.js` already exists, STOP (someone started
> P5-2 already).

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (additive — one new module + a subscriber hook in
  `journal.js`, static DOM/CSS; no sim, save, or renderer behavior changes)
- **Depends on**: none hard. See the execution-model note below re: HP0.
- **Category**: feature/accessibility
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: P5-2 (`ROADMAP.md:154`)

## Execution model (read before starting)

Plans run **sequentially, on `main`, in numeric order** — no feature
branches (`plans/README.md` "Execution model" note). This plan runs **after
the HP0 batch** (plans 012–021: dawn reports, arrivals, endings, and the
other verb work). The whole point of subscribing at the `addLog`/`notice`
choke points (Step 2) is that every notice/log source those HP0 plans add
flows through the a11y mirror **with zero further wiring**. That claim is
load-bearing and must be **re-verified at execution time**:

- `grep -rn "G.log.push\|G.notice =" js/` must still show `js/journal.js` as
  the **only** writer of `G.log` and `G.notice` (today: `js/journal.js:15`
  and `js/journal.js:20`). If any HP0 plan started pushing log lines or
  setting notices directly (bypassing `addLog`/`notice`), that source will
  be silent to the screen reader — note it and route it through the choke
  point, do not special-case it in `a11y.js`.

## Why this matters

HEARTHFALL renders entirely to one `<canvas>` (`index.html:26`) — a screen
reader sees an opaque rectangle and nothing else. The game already narrates
itself in prose: every meaningful event (`RAID!`, a death, a starving
settler, the Beacon lit, the commune fallen) is written to a running log
that is the same text a sighted player reads in the sidebar. That prose is a
ready-made non-visual channel; today it never reaches assistive technology.

P5-2 is the honest, bounded first step: **mirror the existing log/notice
stream into a visually-hidden `aria-live` region** so a screen-reader user
hears the narration in real time, and **label the canvas** so the app
announces what it is. This does **not** make the spatial map playable without
sight — that is a much larger effort (§ "Keep it honest" below), and this
plan states that limit plainly rather than implying full accessibility.

The affordance is cheap precisely because the plumbing is already funnelled:
all log text goes through one function, all notices through another. This
plan adds a subscriber there and a DOM sink — no event-source archaeology.

## Current state

All excerpts verified at `14fd915`. Vanilla-JS browser game; vitest; canvas
renderer; `G` singleton; conventions in `AGENTS.md`.

### The two choke points — `js/journal.js:14-21`

```js
export function addLog(text, fg = '#b8b2a0') {
  G.log.push({ text: `[D${G.day} ${timeStr()}] ${text}`, fg });
  if (G.log.length > 80) G.log.shift();
}

export function notice(text) {
  G.notice = { text, until: performance.now() + 1800 };
}
```

These are **verified single choke points**:

- `addLog` is the **only** writer of `G.log` (`grep -rn "G.log.push" js/`
  → `js/journal.js:15` only). Callers importing it: `js/fire.js:6`,
  `js/run-end.js:2`, `js/world.js`, `js/raiders.js:7`, `js/settlers.js:7`,
  and the `js/game.js:14` barrel re-export. ~75 call sites total, all funnel
  here.
- `notice` is the **only** writer of `G.notice` (`grep -rn "G.notice =" js/`
  → `js/journal.js:20` only). Callers: `js/game.js`, `js/gamepad.js:17`,
  `js/screens.js`, `js/settlers.js:485`.

Both push the **display** text (with a `[D.. HH:MM]` timestamp on the log).
The screen-reader mirror wants the **raw** message, so Step 2 emits `text`
(the pre-timestamp argument), not the stored string.

### There is NO urgent flag on the choke points (verified)

The roadmap item says "assertive for urgent notices — tie to the existing
urgent flag if one exists." It does **not** exist on the `addLog`/`notice`
path. The only `urgent` flag in the codebase is on `tonightInfo()`'s return
object (`js/forecasts.js:23,29,30`), which feeds **sidebar text colour**, not
the log or notice stream — a different consumer entirely. `notice()`
(`js/journal.js:19`) takes only `text`; `addLog` takes only `text, fg`.

Classifying urgency by `fg` colour is **not** reliable: the fallen ending is
red `#e05040` (`js/run-end.js:9`) but the ascension ending is gold `#ffe060`
(`js/run-end.js:19`) — both are urgent, different colours. So Step 2 adds an
explicit optional `urgent` argument to `addLog` and flags a small, enumerated
set of sites (below), rather than sniffing colour.

### The genuinely-urgent `addLog` sites (the assertive set)

Verified life-or-death interruptions — everything else stays polite:

- `js/raiders.js:244` — horde arrives (`☠ HORDE! …`, `#ff4060`)
- `js/raiders.js:247` — raid begins (`⚠ RAID! …`, `#ff5040`)
- `js/settlers.js:326` — a settler dies (`☠ ${s.name} ${how}.`, `#e05040`,
  in `killSettler`)
- `js/settlers.js:342` — a settler goes down (`☠ … is DOWN …`, `#e08040`)
- `js/run-end.js:9` — the commune falls (`#e05040`)
- `js/run-end.js:19` — the commune ascends (`#ffe060`)

### Raid combat spam — why coalescing is required

`tickRaiders()` (`js/raiders.js:256-258`) loops **every** raider each game-
minute; within one minute a raid can emit many `addLog` calls: wall smashes
(`js/raiders.js:42`), trap hits/kills (`:50`, `:55`), skirmisher loot
(`:94`), torcher fires (`:123`), thief escapes (`:164`), plus a death per
settler killed via `woundSettler`→`killSettler` (`js/settlers.js:326`). At
speed 3 the fixed-step loop runs up to 120 minutes per frame
(`js/main.js:50`). A naive "write every message to the live region" would
thrash the `aria-live` node dozens of times in 16 ms — most screen readers
either drop or garble that. The mirror must **coalesce a burst into one
flush**. The coalescing rule is a **pure function** (Step 3, unit-tested);
the flush timer is a thin impure wrapper.

### Where the DOM lives, and the boot hook

- `index.html:26` — `<canvas id="game"></canvas>`, the only game surface.
  `index.html:23` links `style.css`. The `#mobile-gate` block below it
  (`:28-55`) is a separate small-screen fallback and already uses
  `aria-label`/`aria-hidden` — precedent for the attributes this plan adds.
- `js/main.js:9-11` — boot grabs the canvas, `gfx.setupCanvas(canvas)`,
  `setupInput(canvas)`. This is the hook point: call `initA11y()` here.
- Keyboard input is bound on **`window`** (`js/ui.js:91-95`), so keys work
  regardless of canvas focus. Menu/command navigation is keyboard-complete
  (`dispatchKey`, list-nav + keymaps, `js/ui.js:35-50`). **Map tile-targeting
  and building are pointer-only** (`mousedown`→`dispatchClick`,
  `js/ui.js:112-123`; drag-paint `js/ui.js:140`) — an honesty point for
  § "Keep it honest", not something this plan fixes.

### Build/test facts

- `js/a11y.js` is type-checked (`jsconfig.json` includes `js/**/*.js`,
  `checkJs: true`) and linted (`lint` = `eslint js`). **Test files are
  neither** — `test/a11y.test.js` is not in the tsc include and not linted.
- Dev server: `pnpm dev` → `http://localhost:8137` (`vite.config.js:8`).
- No `.visually-hidden`/`sr-only` class exists yet (`grep` of `style.css`
  finds none) — Step 1 adds it.

## Design (decided here, executed below)

### Two regions, two priorities

| DOM node | `aria-live` | fed by |
|----------|-------------|--------|
| `#a11y-log` (`role="log"`) | `polite` | non-urgent `addLog` |
| `#a11y-alert` | `assertive` | urgent `addLog` (the enumerated set) **+ all `notice()`** |

Rationale: the log is ambient narration → `polite` (announced when the reader
is idle, never interrupts). Notices are direct, transient feedback on the
user's own action ("Not enough resources", "The run is saved") and the six
enumerated urgent log lines are life-or-death → `assertive` (interrupts).
Routing **all** notices to assertive needs **zero** `notice()` caller edits.

Both nodes are visually hidden (`.visually-hidden`, standard clip pattern) so
nothing changes on screen. `role="log"` on the polite node hints AT that it
is an append-only running narration.

### `js/a11y.js` — the module

**Pure core (unit-tested, no DOM, no timers):**

```js
// Collapse a burst of raw log/notice strings into one announcement.
// - runs of the SAME consecutive string fold to "text (×N)" (N>1)
// - keep only the last `maxItems` folded entries (newest wins)
// - join with ' · '; if longer than `maxChars`, drop oldest until it fits
//   and prefix '… ' to signal truncation.
// Deterministic; input order = arrival order; empty in → '' out.
export function coalesce(entries, { maxItems = 6, maxChars = 240 } = {}) { … }
```

**Impure shell (thin; only touched in the browser):**

- `initA11y()` — grab `#a11y-log`, `#a11y-alert` by id; if either is missing
  (headless/test), **no-op and return** (so importing the module is safe
  everywhere). Register two subscribers on `journal.js` (Step 2):
  `onLog((text, opts) => enqueue(opts.urgent ? 'alert' : 'log', text))` and
  `onNotice((text) => enqueue('alert', text))`.
- `enqueue(channel, text)` — push into a per-channel buffer; schedule one
  flush via `setTimeout(flush, FLUSH_MS)` (`FLUSH_MS ≈ 150`) if not already
  scheduled. This debounce is what collapses a 120-minute raid frame into a
  single announcement.
- `flush()` — for each channel with buffered entries: compute
  `coalesce(buffer)`, then set the node's `textContent` to `''` and, on the
  next microtask/tick, to the coalesced string (the empty-then-set nudge that
  makes some SRs re-announce identical text). Clear the buffers.

Import cost: `a11y.js` imports only `onLog`/`onNotice` from `./journal.js`.
`journal.js` gains no import (subscribers are plain arrays). No cycle:
`main.js → a11y.js → journal.js`, and `journal.js` already imports
`state`/`balance`/`seasons` only.

### `js/journal.js` — the subscriber hook (minimal)

Add two subscriber arrays and registration functions, invoked at the **tail**
of `addLog`/`notice` after the existing `G` writes (so the mirror never
changes sim/render behaviour — it is a strict add-on):

```js
const logSubs = [];
const noticeSubs = [];
export function onLog(fn) { logSubs.push(fn); }
export function onNotice(fn) { noticeSubs.push(fn); }
```

`addLog(text, fg = '#b8b2a0', urgent = false)` — unchanged body, then
`for (const fn of logSubs) fn(text, { urgent });`. `notice(text)` — unchanged
body, then `for (const fn of noticeSubs) fn(text);`. The raw `text` (no
timestamp) is emitted. The `urgent` param defaults `false`, so all ~75
existing `addLog` callers are unaffected; Step 2 sets it `true` at the six
enumerated sites only.

### Canvas labelling (Step 4)

`index.html:26` becomes:

```html
<canvas id="game" role="application" aria-label="HEARTHFALL — commune-survival game board" aria-describedby="a11y-desc" tabindex="0"></canvas>
```

`role="application"` tells AT that arbitrary keystrokes are the interaction
model (true — input is on `window`, `js/ui.js:91`), suppressing browse-mode
key capture. `aria-describedby` points at a static, visually-hidden
state-alternative description (the "what this is / where the narration is"
text). The two live regions sit right after it.

## Commands you will need

| Purpose   | Command                             | Expected on success |
|-----------|-------------------------------------|---------------------|
| Install   | `pnpm install`                      | exit 0              |
| Tests     | `pnpm test`                         | all pass            |
| One file  | `pnpm vitest run test/a11y.test.js` | that file passes    |
| Typecheck | `pnpm check`                        | exit 0              |
| Lint      | `pnpm lint`                         | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137  | manual, Step 6      |

## Scope

**In scope**:
- `js/a11y.js` (create) — pure `coalesce` + the DOM/subscriber shell
- `test/a11y.test.js` (create) — unit tests over `coalesce` (pure)
- `js/journal.js` — subscriber hook (`onLog`/`onNotice`) + optional
  `urgent` arg on `addLog`
- Six one-token edits flagging the urgent `addLog` sites (raiders ×2,
  settlers ×2, run-end ×2)
- `js/main.js` — one `initA11y()` call at boot
- `index.html` — canvas attributes + static description + two live regions
- `style.css` — the `.visually-hidden` class
- `README.md` code-map line; `plans/README.md` status row

**Out of scope** (do not touch):
- Making the spatial map, tile targeting, or drag-to-build usable without
  sight — the honest v1 limit; state it, don't attempt it.
- Any sim, save, renderer, or `tonightInfo` change.
- A settings toggle for the mirror (the regions are inert to sighted play;
  no toggle needed at v1).
- Localisation of the announcements (English log copy only, as today).
- Reworking `notice()`'s 1800 ms visual lifetime — the mirror reads the text,
  not the timer.

## Git workflow

- Work on `main` (per the execution model — no feature branch).
- One commit per step, imperative messages ("Add the aria-live log mirror").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: static DOM regions + `.visually-hidden` (index.html, style.css)

In `style.css`, add the standard screen-reader-only class:

```css
.visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px;
  padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0);
  clip-path: inset(50%); white-space: nowrap;
}
```

In `index.html`, edit the canvas (`:26`) to the labelled form in Design, then
insert **immediately after it** (before the `#mobile-gate` block):

```html
<div id="a11y-desc" class="visually-hidden">
  HEARTHFALL is a keyboard-played commune-survival game drawn on a canvas.
  The map itself is not yet readable by a screen reader; play is narrated in
  the live log below. Press ? in game for the key list.
</div>
<div id="a11y-log" class="visually-hidden" role="log" aria-live="polite" aria-atomic="false"></div>
<div id="a11y-alert" class="visually-hidden" aria-live="assertive" aria-atomic="true"></div>
```

**Verify**: `pnpm dev`, open `http://localhost:8137`, DevTools → the three
divs exist and are visually hidden (0×0 in the box model), the canvas shows
`role="application"` + `aria-label`. No visual change on the page.

### Step 2: subscriber hook in `js/journal.js` + flag the urgent sites

In `js/journal.js`: add `logSubs`/`noticeSubs` arrays and `onLog`/`onNotice`
exports (Design). Append the subscriber-invocation line to the tail of
`addLog` and `notice`. Add the `urgent = false` third parameter to `addLog`
and emit `{ urgent }`. **Do not** reorder the existing `G` writes — the mirror
fires after them.

Then set `urgent` `true` at exactly the six enumerated sites — a one-token
edit each (add `, true` as the third arg where the call has two args, or
`, '#..fg..', true`):

- `js/raiders.js:244`, `js/raiders.js:247`
- `js/settlers.js:326`, `js/settlers.js:342`
- `js/run-end.js:9`, `js/run-end.js:19`

**Verify**:
- `grep -rn "G.log.push\|G.notice =" js/` → still only `js/journal.js`
  (choke points intact — the execution-model check).
- `grep -rn ", true)" js/raiders.js js/settlers.js js/run-end.js` shows the
  six flagged calls and nothing else surprising.
- `pnpm check && pnpm lint && pnpm test` → all green (additive; the new
  param defaults false, no existing behaviour changes).

### Step 3: `js/a11y.js` + `test/a11y.test.js` (pure coalescing first)

Create `js/a11y.js` with the pure `coalesce(entries, opts)` exported at the
top (algorithm in Design), then the impure shell (`initA11y`, `enqueue`,
`flush`) below it. The shell guards missing DOM (`initA11y` no-ops if the
regions are absent) so the module imports cleanly under vitest.

Create `test/a11y.test.js` — **no DOM stub needed**; it imports and tests
`coalesce` only:

```js
import { describe, it, expect } from 'vitest';
import { coalesce } from '../js/a11y.js';
```

Tests (the pure logic is the deliverable's testable core):

1. **Empty / single**: `coalesce([])` → `''`; `coalesce(['Raid!'])` →
   `'Raid!'`.
2. **Consecutive-duplicate folding**: five identical
   `'A brute smashed a wall!'` → `'A brute smashed a wall! (×5)'`; a
   non-consecutive repeat (A, B, A) does **not** fold (stays three items).
3. **Order preserved, newest kept under `maxItems`**: eight distinct entries
   with `maxItems: 6` → last six, in arrival order, joined by `' · '`; the
   first two dropped.
4. **Char cap truncates from the front**: entries whose join exceeds
   `maxChars` → result ≤ `maxChars`, ends with the newest entry, begins with
   `'… '`.
5. **Realistic raid burst**: the mixed sequence
   `['⚠ RAID! 4 raiders attack from the north!', 'Raiders smashed a wall!',
   'Raiders smashed a wall!', 'Ada was slain by raiders.']` folds the two
   wall lines to `(×2)` and yields a single string containing the raid line,
   `'Raiders smashed a wall! (×2)'`, and the death line in order.

**Verify**: `pnpm vitest run test/a11y.test.js` → all pass;
`pnpm check && pnpm lint` → exit 0.

### Step 4: wire `initA11y()` at boot (`js/main.js`)

Add `import { initA11y } from './a11y.js';` and call `initA11y();` right after
`setupInput(canvas);` (`js/main.js:11`). Because `initA11y` registers the
`onLog`/`onNotice` subscribers, from this point every log line and notice is
mirrored — including any HP0 plan's new sources, for free.

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green (the boot call
is browser-only; tests never run `main.js`).

### Step 5: documentation touch

- `README.md:134` — add `js/a11y.js` to the focused-helpers code-map line:
  `… js/run-end.js, js/structures.js, js/a11y.js — focused sim helpers`
  and note in a trailing clause that `a11y.js` mirrors the log/notice stream
  into a visually-hidden `aria-live` region.
- If `AGENTS.md` documents the journal/choke-point convention, add one
  sentence: new player-facing events must go through `addLog`/`notice` so the
  screen-reader mirror (`js/a11y.js`) picks them up automatically — do not
  push to `G.log`/`G.notice` directly. (Verify the file has an apt spot; if
  not, skip — do not invent a section.)

**Verify**: `pnpm lint` (markdown is untouched by eslint, cheap) and a manual
re-read of the edits.

### Step 6: manual VoiceOver checklist (macOS)

`aria-live` behaviour cannot be unit-tested; verify it by hand. `pnpm dev` →
`http://localhost:8137`, then **System Settings → Accessibility → VoiceOver
→ On** (or ⌘F5). Concrete steps:

1. **Canvas is announced**: Tab to / navigate onto the game canvas →
   VoiceOver speaks "HEARTHFALL — commune-survival game board" and the
   description ("… map itself is not yet readable … narrated in the live log
   below"). Confirms Step 1/4 labelling.
2. **Log narration (polite)**: start a new run, let it tick (or
   `window.ff(200)` in the console) → VoiceOver reads the founding and daily
   log lines shortly after each, without you moving the cursor. It should
   **not** interrupt itself mid-sentence (polite).
3. **Coalesced raid (assertive, no thrash)**: `ff` to a raid (or wait) → the
   raid onset interrupts with `⚠ RAID! …`; a burst of wall-smash/combat
   lines is spoken as **one** coalesced announcement (…`(×N)` for repeats),
   **not** a dozen rapid-fire fragments. Confirms Step 3 coalescing + the
   `FLUSH_MS` debounce end-to-end.
4. **Notice (assertive)**: trigger a notice — e.g. press build and try to
   place something you can't afford ("Not enough resources"), or Save now
   ("The run is saved") → VoiceOver announces it promptly.
5. **Death/ending (assertive)**: let a settler die, or reach an ending →
   the flagged urgent line ("… is DOWN …", "The commune has fallen.") is
   announced assertively.
6. **No visual regression, both renderers**: the three a11y divs are
   invisible; toggle Graphics/ASCII in the pause menu → screen is unchanged.

Record pass/fail per item in the commit or the PR body. If VoiceOver is
unavailable in the run environment, note that Step 6 is **operator-run** and
leave the checklist for the human — do not mark the plan DONE claiming a
manual pass that was not performed (STOP condition 4).

### Step 7: `plans/README.md`

Add the row to the execution-order table (append after the last existing
row, in the documented column shape):

```
| 027 | Screen-reader affordance: aria-live log/notice mirror + labelled canvas | P5-2 | P3 | M | — | DONE |
```

Under "Dependency notes", add one line: P5-2 subscribes at the
`addLog`/`notice` choke points, so it must run **after** the HP0 batch
(012–021) for those plans' new event sources to be mirrored for free; it has
no hard code dependency on them.

**Verify**: `pnpm check && pnpm lint && pnpm test` all exit 0;
`git status` shows only in-scope files; `git diff plans/README.md` shows only
the row + dependency-note additions.

## Test plan

(The steps above ARE the test plan.) Final automated shape:
`test/a11y.test.js` ~5 unit tests over the pure `coalesce`; everything else
in the suite untouched and green. The `aria-live` wiring, canvas labelling,
and coalescing-under-load are covered by the Step 6 VoiceOver checklist —
inherently manual, deliberately concrete.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/a11y.js` exists; `test/a11y.test.js` exercises `coalesce`
      (folding, `maxItems`, `maxChars`, realistic raid burst)
- [ ] `grep -rn "G.log.push\|G.notice =" js/` → only `js/journal.js`
      (choke points intact; the mirror subscribes, never a second writer)
- [ ] `grep -n "onLog\|onNotice" js/journal.js js/a11y.js` shows the hook
      defined in `journal.js` and consumed in `a11y.js`
- [ ] `grep -n "initA11y" js/main.js` shows the boot call after `setupInput`
- [ ] `index.html` canvas has `role`, `aria-label`, `aria-describedby`; the
      three visually-hidden divs (`#a11y-desc`, `#a11y-log`,
      `#a11y-alert`) exist with the right `aria-live` values
- [ ] Six urgent `addLog` sites flagged (`raiders.js` ×2, `settlers.js` ×2,
      `run-end.js` ×2); no other `addLog` caller passes `urgent`
- [ ] Step 6 VoiceOver checklist run (by operator) with results recorded, OR
      explicitly deferred to the operator with the plan left non-DONE
- [ ] `plans/README.md` row + dependency note added

## STOP conditions

1. `js/journal.js` no longer matches the excerpt (drift) — especially if
   `addLog`/`notice` gained parameters or a caller now writes `G.log`/
   `G.notice` directly. Re-derive the hook point; if a bypass writer exists,
   report it (that source is silent to the mirror) before coding.
2. A `js/a11y.js` already exists (someone started P5-2) — STOP, reconcile.
3. Adding the `onLog`/`onNotice` subscriber measurably changes sim or render
   behaviour (any existing test flips) — the hook must be a strict tail
   add-on; if firing it perturbs anything, you wired it in the wrong place.
4. The Step 6 VoiceOver pass cannot actually be performed in this
   environment — do **not** mark the plan DONE on an unverified manual step;
   leave it for the operator and set the status row to a non-DONE state with
   a one-line reason.
5. You find yourself building spatial-map narration (announcing tile
   contents, settler positions, targeting) — that is beyond P5-2's honest
   scope; stop and propose it as its own roadmap item, don't smuggle it in.

## Keep it honest (state this plainly, in code comments and the description)

v1 accessibility scope is **exactly**: (a) the `aria-live` mirror of the
log/notice narration, and (b) a labelled canvas with a static
state-alternative description. What remains **inaccessible** and is *not*
claimed fixed:

- The **spatial map** — reading tiles, seeing settler/raider positions,
  understanding layout — is unreadable without sight. There is no board
  narration.
- **Map interactions are pointer-only**: tile targeting and drag-to-build go
  through `mousedown`/drag (`js/ui.js:112-123,140`), with no keyboard path.
  Menu and command navigation *are* keyboard-complete (`js/ui.js:35-50`,
  input bound on `window` at `:91`), but "full keyboard support" is an
  overstatement for the map itself — say "keyboard-navigable menus/commands",
  not "fully keyboard-playable".

The `#a11y-desc` copy and the module header comment must say this — an honest
partial affordance beats a false "accessible" badge.

## Maintenance notes

- **The choke-point contract is the whole design.** Any future player-facing
  event must go through `addLog`/`notice` to be heard. A module that pushes
  to `G.log`/`G.notice` directly is a silent regression for screen-reader
  users — the Done-criteria grep is the tripwire; keep it in CI-mindset.
- **Urgency is an explicit flag, not a colour.** New life-or-death log lines
  should pass `urgent: true` (third arg to `addLog`); do not infer urgency
  from `fg` (the ascension ending is gold, not red).
- **HP0 sources ride for free.** When plans 012–021 (dawn reports, arrivals,
  endings) land their new `addLog`/`notice` calls, they are mirrored with no
  a11y change — just decide per new event whether it is `urgent`.
- **`coalesce` is pure on purpose.** Tune `maxItems`/`maxChars`/`FLUSH_MS`
  from real VoiceOver feedback; the pure core stays unit-tested, the timer
  stays a thin shell.
- **A settings toggle** for the mirror is deliberately deferred — the regions
  are inert to sighted play, so there is nothing to turn off at v1. Revisit
  only if the announcements prove noisy for AT users who also see the screen.
