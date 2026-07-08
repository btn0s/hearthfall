# Plan 014: The torchbearer (HP-4) — the dawn torch-choice and embodied, order-only dusk control

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Execution model**: plans run **sequentially, on `main`, in numeric order**;
> by the time this plan executes, **009 (screens split), 010 (campaign store),
> 011 (menace), 012 (cast v2), and 013 (arrivals) have landed**. That reshapes
> the ground under every excerpt below — re-locate each cited site **by symbol
> name**, not by line number:
> - **009** moved the world screen and its input into `js/ui/world-screen.js`,
>   the eight modals into `js/ui/modals.js`, the sidebar draw into
>   `js/ui/sidebar.js`; the **game screen stays in `js/screens.js`**
>   (`makeGameScreen`, which still owns the map, the virtual cursor, the
>   selection box, and `onKey`/`onClick`). 009 also added the `js/game.js`
>   mutators `togglePause()` and `clearSelection()` — the torchbearer's pause
>   handling routes through `togglePause()`, never a raw `G.paused = !G.paused`.
> - **012** added `js/cast.js`; a settler now carries `resolve`, `wants`,
>   `scars`, `weapon`, `bond`, `grudge`, `refusing`. **The torchbearer IS one
>   mortal band member** — a normal entry in `G.settlers`, with no extra
>   fields, no stat edge (this is the whole point: not a hero class).
> - **011** added the raid forecast superset `raidEstimate()` → `{ n, horde,
>   … }` and `tonightInfo()`, which this plan reads to decide whether a night
>   is "played."
>
> Every code excerpt below is anchored at commit `14fd915` (this plan's
> baseline, **before** 009-013). **Re-verify each excerpt against the current
> tree before cutting.**
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/screens.js js/settlers.js js/raiders.js js/game.js js/dawn.js js/state.js js/save.js js/gamepad.js js/main.js js/ui/ js/cast.js js/balance.js test/`
> If `js/screens.js`, `js/settlers.js`, `js/game.js`, or `js/cast.js` changed
> in ways the notes above do not predict, re-read them fully before starting —
> this plan adds a live input mode to the game screen and a control branch to
> the settler tick. If a `js/torch.js` or `js/ui/torch.js` already exists,
> STOP (someone started HP-4 already).

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (introduces the first *direct-control* mode in a game that
  has only ever had indirect orders; adds a live input regime to the game
  screen; branches the settler tick; and it is the single most novel item in
  Milestone HP0 — there is no precedent in the codebase for player-driven unit
  control, rally, or the drag-the-downed verb, so all four verbs are designed
  here from movement primitives)
- **Depends on**: 009 (screens split — the game screen input this plan extends
  lives in `js/screens.js`, the modal home is `js/ui/modals.js`, the
  `togglePause()` mutator is in `js/game.js` — all landed), 012 (cast v2 — the
  torchbearer is a `js/cast.js` band member with `resolve`/`wants`/`bond`;
  landed). 011 (menace/scouting) is used but not required. 013 (arrivals) is
  landed by execution order but not depended on.
- **Category**: feature
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP-4 (`ROADMAP.md:118`, Milestone HP0) · GDD §2 P2
  (`GDD.md:71-86`), §5 the torch choice (`GDD.md:273-274`), §11 open question 2
  (`GDD.md:392-393`)

## Why this matters

Two of the four adversarial reviews converged on one FATAL finding: **"dusk is
a cutscene"** (`GDD.md:415-417`, Appendix A). Today they are right. At dusk the
sim runs on rails — settlers fight or flee by their own AI (`js/settlers.js:413-456`),
raiders path to the nearest of them (`js/raiders.js:18-22`), and the only thing
the player does during a raid is what they do during the day: hover a cursor,
drag selection boxes, ring the bell, and — the contradiction this plan
resolves — **hit space to freeze the whole night and give omniscient orders**
(`js/screens.js:367`, gated by `js/main.js:34-35`). Appendix B names it flatly:
"no embodied control" (`GDD.md:473`).

P2 is the answer the genre attack and the designer reached independently: the
**State of Decay move** — *embodiment of the fragile* (`GDD.md:78-79`,
`GDD.md:416-417`). Each dawn you choose **who carries the torch tonight**; at
dusk you control that one mortal band member directly — "rally, sortie at the
breach, hold the door, drag the downed out" (`GDD.md:75-77`). Everyone else
fights or flees by their own lights. This is the documented mechanism that
makes losing *this* person different from losing a unit (`GDD.md:82-83`), and
it is the load-bearing half of the anti-cannibalization rule: every system on
the dusk side must run *through* a named person (`GDD.md:49-54`).

Two hard boundaries the GDD draws, and this plan enforces as code, not prose:

1. **Not a hero class.** "embodiment yes, hero class never" (`GDD.md:383`);
   "Kingdom's immortal monarch is explicitly rejected" (`GDD.md:78`). The
   torchbearer gets **zero** combat/economy/work modifier. Their only edge is
   *where you put them and what you make them do* — positioning and focus, not
   stats. This is the §9.1(1) / P5 gate (`GDD.md:343`, `GDD.md:129-147`) applied
   to control: a controlled torchbearer and an AI settler of the same
   role/trait/weapon must deal identical damage. Shipped as a test.
2. **Daylight omniscience does not extend into the night.** "During raids,
   pause allows looking, but commands flow only through the torchbearer's live
   verbs" (`GDD.md:81-83`) — this "resolves v1's hard-pause-vs-consequence
   contradiction" (`GDD.md:83`). Today's build embodies the contradiction: the
   same pause+order surface works at noon and at midnight. This plan makes dusk
   a **distinct input regime**: the daylight order surfaces (build, area orders,
   role-cycling) are locked out at night, and the four torchbearer verbs are
   **dropped while paused** — a live verb requires a live sim. Pause becomes
   look-only, by construction.

## Current state

All excerpts verified at `14fd915`; re-locate by symbol after 009-013.
Vanilla-JS browser game; vitest; all tuning in `js/balance.js`; house rules in
`AGENTS.md` (per-minute scan caches, `G` singleton, versioned saves, sim
modules import directly / view modules via the `js/game.js` barrel).

### There is no direct control anywhere — only cursor + orders

The game screen's entire input vocabulary is a **virtual cursor** and a
**selection box that opens the orders menu**. `makeGameScreen().onKey`
(`js/screens.js:336-406`) moves `G.cursor` with arrows (`moveCursor`,
`js/screens.js:237-251`), anchors/stretches a `G.sel` box, and on `Enter`
either confirms the box (`resolveSelection` → `makeOrdersMenu`,
`js/screens.js:272-287`) or acts on a single interactive tile (`clickInteract`
→ `cycleRole`/trade/workshop, `js/screens.js:261-268`). `onClick`
(`js/screens.js:408-413`) starts a drag-box in `NORMAL` mode or paints in
`BUILD`/`CANCEL`. **No settler is ever moved by the player**; the only settler
interaction is `cycleRole` on click. This is the surface the night regime
supersedes.

The gamepad is already a **virtual-key emitter over that same cursor**
(`js/gamepad.js:61-78`): d-pad / left stick → `ArrowUp/Down/Left/Right`; A(0) →
`Enter` (or `Paint` in build, via `aButtonKey`, `js/gamepad.js:26-28`); B(1) →
`Escape`; X(2) → `'b'`; Y(3) → `'w'`; L3(10) → `'r'`; R3(11) → `'v'`. The night
regime **reuses this verbatim** — it re-interprets the keys the pad already
emits, so `js/gamepad.js` needs **no edit** (verified in Design → Input).

### How pause works today — and why raids run under it unchanged

```js
// js/main.js:34-35
const simActive = () =>
  inStack('game') && !stack.some(s => s.pausesSim) && !G.gameOver && !G.paused;
```

The sim ticks only when the game screen is up, no `pausesSim` modal is open,
the run is live, and `G.paused` is false. **Raids run under exactly this gate
— there is no raid-specific pause path.** Space toggles `G.paused`
(`js/screens.js:367`, which 009 rewrote to `togglePause()`), so today you can
freeze a live raid and issue the full daylight order set. That is the
contradiction P2 kills.

`js/main.js:44` calls `topScreen.update()` every frame if the top screen
defines it — the game screen has no `update()` today; this plan adds one to
raise the dawn torch-choice modal (sim-sets-a-flag, UI-reacts — matching how
011/012 surface state to the view).

### How settlers act autonomously at dusk — the AI the torchbearer opts out of

`tickSettler(s)` (`js/settlers.js:349-475`) is the per-minute settler brain.
The parts that matter here, in order:

```js
// js/settlers.js:413-422  — adjacent-foe melee (runs for EVERY settler, incl.
// the torchbearer; the source of the "no stat edge" invariant)
const foe = adjacentRaider(s);
if (foe && s.trait !== 'craven') {
  if (s.atkcd > 0) s.atkcd--;
  else {
    s.atkcd = BALANCE.combat.guardAtkCd;
    const brave = s.trait === 'brave' ? BALANCE.combat.braveBonus : 0;
    hitRaider(foe, rint(1, 3) + brave + (s.role === 'guard' ? rint(1, 2) + G.mods.guardDmg : 0) + weaponBonus(s), s);
  }
  return;
}
```

```js
// js/settlers.js:424-456  — the raid/alarm branch: guards post up / charge the
// nearest raider; NON-guards flee to the camp. "Everyone else fights or flees
// by their own AI." The torchbearer's control branch preempts this whole block.
if (G.raidActive || G.alarm) {
  if (s.role === 'guard') { /* post / ranged / charge nearest */ }
  else {
    releaseTask(s);
    if (mdist(s.x, s.y, G.camp.x, G.camp.y) > 3) moveToward(s, G.camp.x, G.camp.y, { adjacent: true, refresh: 10 });
    return;
  }
}
```

The movement primitive every verb is built from is **`moveToward(s, tx, ty,
opts)`** (`js/settlers.js:96-109`, module-private): one A\* step per call
toward `(tx, ty)`, `{ adjacent }` to stop one tile short, `{ refresh }` to
re-path. `tickTorchbearer` (this plan) lives **in `js/settlers.js`** precisely
so it can call `moveToward` and reuse the adjacent-foe melee above.

### Raiders target the torchbearer like anyone else (mortality, verified)

```js
// js/raiders.js:18-22
const nearestLiveSettler = (r) => {
  const up = G.settlers.filter(settlerActive);
  const pool = up.length ? up : G.settlers.filter(s => !s.away && s.hp > 0);
  return pool.reduce((b, s) => (!b || mdist(s.x, s.y, r.x, r.y) < mdist(b.x, b.y, r.x, r.y)) ? s : b, null);
};
// js/raiders.js:144-155 — tickRaider picks the nearest active settler as its
// foe; the torchbearer is an ordinary settlerActive member, so it is targeted
// on identical terms. No edit needed for mortality — it is already true.
```

### Downed-not-dead — the state "drag the downed out" acts on

`woundSettler` (`js/settlers.js:335-347`): at 0 hp, `chance(BALANCE.combat.downChance)`
(`js/balance.js:124`, 0.5) sets `s.downed = true; s.hp = 1` — else `killSettler`.
A downed settler is `!settlerActive` (`js/settlers.js:14`), crawls for shelter
on its own (`js/settlers.js:387-402`, `crawlCd`/`claimBed`), and recovers at
`downRecoverHp` (`js/balance.js:125`, 8). Raiders ignore the downed unless
nobody is up (`js/raiders.js:146-147`). **The rescue verb** makes the
torchbearer drag a downed member toward the hearth faster than their own crawl
— the P6 memorial-not-compensation surface ("fighting for the wounded is where
memorial gets played, not displayed", `GDD.md:459-461`).

`killSettler` (`js/settlers.js:325-331`) removes the settler and calls
`communeFallen()` if the band is empty. **If the fallen is the torchbearer,
this plan drops the torch here** (Step 3 hook).

### State, save — the torch fields are ephemeral by design

`makeState()` (`js/state.js:4-25`) is the `G` shape. Note the ephemeral UI/tool
fields that are **never serialized**: `mode`, `sel`, `cursor`, `buildSel`
(`js/state.js:19`). The save is an **allowlist** — `toSaveData`
(`js/save.js:12-28`) destructures a fixed set and writes `mode: 'NORMAL',
cursor: { x: -1, y: -1 }` back as constants; `loadGame` does
`Object.assign(G, makeState(), d)` (`js/save.js:86`), so any `G` field **absent
from `toSaveData` resets to its `makeState` default on load**. Autosave runs at
dawn (`onDawn` → `save()`, `js/dawn.js:11`) — i.e. at `min === 360`, when night
is over and no torch is lit. **Therefore the torch fields (`torchbearer`,
`torchNight`, `torchOrder`, `rallyPoint`, `torchPromptDay`, `torchDropped`) are
run-transient: added to `makeState`, left out of `toSaveData`, they need no
`SAVE_VERSION` bump** — exactly like `mode`/`sel`/`cursor` today. (This is a
deliberate scope-saver; it is stated as an invariant and tested.)

### The dawn/dusk clock

`BALANCE.time` (`js/balance.js:5-17`): `minutesPerDay 1440`, `dawnMinute 360`,
`nightStart 1200`, `raidSpawnMinute 1150`, `nightEnd 320`. `isNight()` =
`G.min < 320 || G.min >= 1200` (`js/seasons.js:6`). `tickGame`
(`js/game.js:264-309`) advances `G.min`, spawns the raid at `raidSpawnMinute`
(`js/game.js:271`), and already fires a night hook at `nightStart`
(`js/game.js:272`, `tip('night')`) — the anchor for `engageDuskTorch()`. The
dawn pipeline is `onDawn()` (`js/dawn.js:7-13`): `communeDawn()` → (012)
`castDawn()` → (011) `menaceDawn()` → `worldDawn()` → `save()`.

### The cast (012) the choice reads

`js/cast.js` exports `resolveBand(s)` (Steady/Fraying/Breaking) and
`wantLabel(s)`; a settler carries `trait`, `resolve`, `wants` (array of one),
`bond`/`grudge` (run-scoped ids), `weapon`, `refusing`, `scars`. The torch
choice reads these to annotate each candidate (Design → Choice). **`age` is a
band-member field, not a run-settler field** at this point (010/012): run
settlers have no `age` until HP-8 (plan 017), so the "Grey earn it" dimension is
display-deferred — see the Design note.

### The modal home and the framework contract

New modals go in `js/ui/modals.js` (009 maintenance note; it even anticipates
"HP-4's torchbearer UI", `plans/009-screens-split.md:529-530`). Full screens get
their own `js/ui/*.js`. The screen-object contract is `js/ui.js:1-9`
(`{ id, modal, pausesSim, listNav, focus, widgets, keymap, onKey, onClick,
onDrag, onRelease, onHover, pan, draw, onEnter, onExit, update }`); input goes
to the **top of the stack only** (`js/ui.js:35-66`); the reusable list screen is
`makeListScreen` (`js/ui/menu.js`). `notice(text)` (`js/journal.js:19-21`) and
`tip(id)` (`js/onboard.js`) are the transient-message channels.

## Design (decided here, executed below)

The design has three moving parts: (1) the **dawn choice** that writes
`G.torchbearer`; (2) the **night control regime** — a live input mode on the
game screen where only the torchbearer takes commands; (3) the **pause-is-look-
only gate**. Plus the honest answer to *the torchbearer falls mid-night*.

### The control model, in one paragraph (the thing to get right)

**Order-at-the-cursor embodiment, not a twin-stick avatar.** At dusk the game
screen's existing virtual cursor stops meaning "hover to inspect" and starts
meaning "where I am ordering my torchbearer." Arrows / left-stick / d-pad move
the cursor (unchanged plumbing); four verb keys act *through the torchbearer* at
or toward the cursor: **Go**, **Hold**, **Rally**, **Rescue**. The torchbearer
pursues that order tick-by-tick under the normal sim (paths via `moveToward`,
fights whatever is adjacent via the unchanged melee branch) — you command a
person, you do not puppeteer a sprite frame-by-frame. This deliberately stays on
the near side of the line GDD §11 Q2 fears ("before it drifts action-RPG",
`GDD.md:392-393`): it reuses the cursor the game and the gamepad already share,
adds **no** real-time analog-movement code, and works identically on keyboard
and pad. The cost is that "sortie at the breach" and "hold the door" are
*orders you issue*, not twitch inputs — which is the correct altitude for a
colony sim whose spine is legible small numbers (P7).

### 1. The dawn torch-choice (a dilemma, not a habit)

**When.** At dawn, on nights that will be **played** — i.e. a raid or horde is
expected tonight (`G.day >= G.raidNext || isHordeDay(G.day)`, the same predicate
`communeDawn` already uses for its dusk-warning log, `js/game.js:154-157`; or
`tonightInfo().urgent` post-011). On a quiet night no one need be exposed and no
prompt fires. `onDawn`/`castDawn` sets `G.torchPromptDay = G.day`; the game
screen's `update()` reads it and pushes the modal once, then the flag is spent.

> **Design tension (review gate, not a blocker)**: P2 says the choice is
> **daily** ("each dawn you choose", `GDD.md:74`; §5 "The torch choice
> (daily)", `GDD.md:273`). This plan prompts only on raid-nights to respect P7
> notification-driven attention (`GDD.md:166-168`) — a nightly modal on
> peaceful early days is the "twelve cards are a board" noise P7 warns against.
> If the operator wants the literal daily ritual, widen the `update()` predicate
> to every dawn; the modal, state, and control regime are unchanged. Flag which
> reading shipped in the PR.

**Who is eligible.** Present band members: `settlersPresent()`
(`js/settlers.js:16`, `= settlerActive`). A member away on expedition (`s.away`,
set in `startExpedition`, `js/world.js:100`) or already downed cannot carry it.

**The dilemma (annotations that bend the decision).** Each candidate row shows,
from the 012 cast, the fields that make the choice *about that person*
(`GDD.md:273-274` — "the brave want it, the bonded fear it, the Grey earn it"):

| Signal | Source (012) | Reads as |
|---|---|---|
| Trait `brave` | `s.trait` | "eager" — wants the torch (`GDD.md:274`) |
| Bond partner present | `s.bond != null` | "⚭ fears for them" — bonded fear it: if they fall, the partner takes `bondPartnerDeath` resolve (012) |
| Resolve band | `resolveBand(s)` | Steady / Fraying / **Breaking** (a Breaking pick is a gamble) |
| Want | `wantLabel(s)` | context (e.g. an `armed` member with the spear is the natural choice — and the dilemma of *not* having a spear to give) |
| Life-stage | `s.age` **if present** | "the Grey earn it" — **display-deferred to HP-8** (run settlers have no `age` yet; render only when the field exists) |

**What it writes.** `chooseTorch(id)` sets `G.torchbearer = id`. A **"No one
carries it — let them fight"** option sets `G.torchbearer = null` (a real
choice: sometimes you expose nobody and take the AI night). The modal
`pausesSim: true` (dawn is a reckoning, `GDD.md:73`), `listNav` for
keyboard/gamepad, built on `makeListScreen`.

**The teeth (kept minimal and P5-clean).** The torchbearer receives **no combat
or work modifier** — full stop (the hero-class ban). The *only* mechanical
touch is a **run-scoped resolve honor bump**: a torchbearer who carries through
the night present and unbroken gains `+carryResolve` resolve at the next dawn
(cause "carried the torch"), applied via `bumpResolve` from 012. This is
symmetric with 012's "want satisfied → +resolve", never crosses runs (resolve
is run-scoped by 012), and touches no combat/economy/yield number, so it clears
the §9.1(1) gate. The dilemma's real weight is elsewhere: **whoever you pick is
the person whose fate is in your hands** (the SoD attachment mechanism), and
picking a bonded member puts their partner's resolve at stake if they fall.

> **Second review gate**: if playtests find the honor bump reads as "torch duty
> = a buff", cut the two lines in `endTorchNight` — the choice, control, and
> stakes all still ship. Documented as a lever, like 012's wants-teeth note.

### 2. The night control regime (a live input mode, not a screen)

A **mode on the game screen**, not a pushed screen — the verbs are map actions
that need the live map, the live camera, and a running sim, all of which the
game screen already owns; a pushed screen that `pausesSim` would freeze the
night we are trying to make playable.

**Engagement.** `engageDuskTorch()` runs in `tickGame` at `G.min ===
BALANCE.time.nightStart` (`js/game.js:272`, beside the existing `tip('night')`):
if `G.torchbearer` is set **and** that settler is present, set `G.torchNight =
true`, snap the camera to them (`centerCam`), `tip('torch')`. Else leave
`G.torchNight` false (uncontrolled AI night) and `notice('No torchbearer stands
ready — the band fights on its own tonight.')`. `endTorchNight()` runs at dawn
(`onDawn`), applying the honor bump and clearing `G.torchNight`/`G.torchOrder`/
`G.torchbearer`/`G.rallyPoint` for the new day's fresh choice.

**The under-control settler opts out of AI.** In `tickSettler`, *before* the
autonomous decision branches but *after* the universal maintenance (hunger,
fire, wound-check, eat — the parts that keep the torchbearer mortal), insert:

```js
if (G.torchNight && s.id === G.torchbearer && settlerActive(s)) return tickTorchbearer(s);
```

`tickTorchbearer(s)` executes `G.torchOrder` using the same private primitives
every settler uses — so its combat is byte-identical to an AI settler's (the
P5 gate). Orders (all set by the input layer; all `{ kind, … }`):

- **`move { x, y }`** — `moveToward(s, x, y, { adjacent: false, refresh: 3 })`;
  the unchanged adjacent-foe melee (`js/settlers.js:413-422`) fires en route, so
  Move *is* "sortie at the breach" (order them to the breach; they fight
  through). On arrival, order becomes `hold`.
- **`hold {}`** — clear `s.path`; do not move; the adjacent-foe melee still
  fires. "Hold the door."
- **`rescue { id }`** — path to the downed target; while adjacent, **drag**:
  each torchbearer move also steps the downed settler toward `G.camp` by
  `dragStep` tiles (moving `dead.x/y` along), faster than its own `crawlCd`
  crawl. If the target recovers, dies, or is gone, order falls back to `hold`.
  "Drag the downed out." (P6.)
- **`rally {}`** — set `G.rallyPoint = { x: s.x, y: s.y, until: G.day*1440 +
  G.min + rallyTtl }`; the torchbearer then holds. "Rally to me."

**Rally redirects AI (O(n), no buff).** One small edit to the *non-guard* raid
branch (`js/settlers.js:451-455`): if a live rally point is within `rallyRadius`,
non-guards converge on it instead of fleeing to camp. This is leadership
expressed as a movement redirect — **no stat change, no cooperation branch**
(the O(n²) bomb 012 held out, `GDD.md:258-262`, stays out). Guards keep their
own combat AI. That is the whole of "everyone else fights or flees by their own
lights, but the torchbearer can call them together."

### 3. The pause-is-look-only gate (enforced at the input boundary)

While `G.torchNight`, the game screen routes **all** input through a night
handler that enforces two lockouts:

1. **Daylight tools are gone** (paused or live): `b` build, `x` cancel, the
   `NORMAL`-mode drag-box/orders menu, `cycleRole` on click, `w` world screen,
   `e` trade — none fire at night. Commands flow **only** through the four
   verbs. (`G.mode` is forced to `'NORMAL'` on engage so nothing is mid-build.)
2. **Verbs require a live sim**: if `G.paused`, the four verb keys are
   **dropped**; only look inputs pass — move the cursor (arrows), pan, minimap
   click, inspect, toggle graphics, the pause **menu** (Esc), and unpause
   (space). So pause freezes the night for *looking*, and the only way to act is
   to let it run — which is precisely `GDD.md:81-83`, made structural.

Space still calls `togglePause()` (009's mutator) — pause is not removed, it is
**demoted to a lens**. This is the sentence to keep in the code comment: *the
torchbearer's verbs are the only commands at night, and a command needs a
running clock.*

### Input map (keyboard + gamepad; `js/gamepad.js` unchanged)

The night handler re-interprets the virtual keys the pad already emits
(`js/gamepad.js:61-78`), so **no gamepad edit is needed** and both devices reach
every verb. Keyboard mnemonics are added alongside the pad-shared keys:

| Verb | Keyboard | Gamepad → virtual key |
|---|---|---|
| move cursor / aim | arrows / WASD | d-pad / L-stick → `ArrowUp/Down/Left/Right` |
| **Go** (to cursor) | `Enter` | A(0) → `Enter` |
| **Hold** | `h` (also `b`) | X(2) → `'b'` |
| **Rally** | `r` | L3(10) → `'r'` |
| **Rescue** (nearest downed) | `f` (also `w`) | Y(3) → `'w'` |
| pause = look | `Space` | Start(9) → `' '` |
| pause **menu** / cancel order | `Esc` | B(1) → `Escape` |

`aButtonKey` (`js/gamepad.js:26-28`) already returns `'Enter'` whenever not in a
build-paint state, and the regime forces `G.mode = 'NORMAL'`/`buildSel = null`,
so A → Go needs nothing. The HUD (Design → Render) shows this map so it is
discoverable in play (P7: "no load-bearing number undiscoverable in play",
`GDD.md:171-173`).

### The torchbearer falls mid-night — decided honestly (cite §11 Q2)

**The torch drops; it is not auto-inherited.** When the torchbearer is downed or
killed mid-night (hooked in `woundSettler`'s down path and `killSettler`,
`js/settlers.js:335-347`, `:325-331`), control does **not** silently transfer to
"the next best unit" — that would make the torchbearer a fungible control-slot,
i.e. the hero class the GDD forbids (`GDD.md:78`, `GDD.md:383`), and it would
blunt the loss P2/P6 exist to sharpen. Instead:

- `G.torchNight` stays true but the torchbearer is now `!settlerActive`, so
  `tickTorchbearer`'s guard fails and they revert to the AI (a downed member
  crawls; a killed one is gone). The night continues **uncontrolled** unless the
  player acts.
- `torchbearerFell()` sets `G.torchDropped = { at: G.day*1440 + G.min }` and
  raises a `notice`/`tip('torchDropped')`: *"The torch is on the ground —
  press T to have the nearest willing hand take it up."* For `handoffWindow`
  minutes, the night handler accepts **`t`** (keyboard) / a face button to
  `pickUpTorch()`: the nearest present, non-Breaking member becomes the new
  `G.torchbearer`, control resumes, camera snaps. Ignore it and the window
  lapses — the band finishes the night on its own.

This makes losing your torchbearer *hurt* (you lose your hands in the fight; if
a rescue was in progress the downed may now die on their own crawl) and makes
taking the torch back a deliberate, exposed decision, not a respawn.

> **§11 Q2 is explicitly open** (`GDD.md:392-393`): whether dusk needs a richer
> **second verb set** (formations, focus-fire) "or is rally/sortie/rescue
> enough before it drifts action-RPG." This plan ships the **minimal** set
> (Go/Hold/Rally/Rescue) and the drop-the-torch handoff, and treats *both* the
> verb count and the handoff ergonomics as the playtest question. Do not add a
> fifth verb or a formation system in this plan — that is the thing Q2 is for.

### `BALANCE.torch` (Step 1)

```js
torch: {
  rallyRadius: 8,     // tiles: AI non-guards within this of a live rally point converge on it
  rallyTtl: 60,       // game-minutes a rally point stays live
  dragStep: 1,        // tiles a downed member is dragged per torchbearer move (> its own crawl)
  carryResolve: 1,    // +resolve next dawn for carrying the night through unbroken (run-scoped; cuttable)
  handoffWindow: 40,  // game-minutes the dropped-torch "press T" prompt stays armed
},
```

Engagement reads `BALANCE.time.nightStart`/`dawnMinute` directly — do **not**
duplicate the clock into `torch`.

### New modules & the cycle map

- **`js/torch.js`** (NEW, sim/policy) — *who and what order*. Imports
  `state.js`, `data.js`, `balance.js`, `journal.js`, `onboard.js`, `seasons.js`,
  and `cast.js` (for `resolveBand`/`wantLabel`/`bumpResolve`) — **all
  cycle-safe** (same import set 012's `cast.js` uses; none of these import
  `torch.js`). Exports: pure `torchEligible()`, `torchbearerNow()`,
  `torchAnnotate(s)`; impure `chooseTorch(id)`, `engageDuskTorch()`,
  `endTorchNight()`, `torchbearerFell(s)`, `pickUpTorch()`, and the order
  setters `orderMove(x,y)` / `orderHold()` / `orderRally()` / `orderRescue()`.
  It does **not** import `js/settlers.js` (that would cycle — settlers imports
  torch for the fall hook).
- **`js/settlers.js`** (EDIT) — *mechanism*: `tickTorchbearer(s)` (uses private
  `moveToward`/`adjacentRaider`), the rally redirect, and the `torchbearerFell`
  hook. `settlers.js` imports `torchbearerFell` from `torch.js`; `torch.js`
  imports nothing from `settlers.js` → **one-way, safe** (verified in Step 3).
- **`js/ui/torch.js`** (NEW, view) — `makeTorchChoiceModal()` (the dawn modal)
  and the night helpers `nightControlKey(scr, k, mods)`, `nightControlClick(scr,
  c)`, `drawTorchHud(scr, f)`. Imports the `torch.js` policy via the `js/game.js`
  barrel (view rule) plus `../ui/menu.js`, `../gfx.js`, `../cast.js` display
  helpers via barrel.
- **`js/game.js`** (EDIT) — call `engageDuskTorch()` in `tickGame`; barrel
  re-export the view-facing torch helpers.
- **`js/dawn.js`** (EDIT) — `endTorchNight()` + set `G.torchPromptDay` at dawn.
- **`js/screens.js`** (EDIT, the game screen) — `update()` raises the modal;
  `onKey`/`onClick` delegate to the night helpers when `G.torchNight`; `draw`
  adds the torchbearer marker + HUD.
- **`js/state.js`** (EDIT) — the six ephemeral torch fields.

Sim modules import `torch.js` **directly**; view modules via the `js/game.js`
barrel (house rule).

### Render (P7: full detail for the person in a decision)

The torchbearer is, every dusk, "a person currently *in a decision*"
(`GDD.md:166-168`) — so they get full detail while everyone else compresses.
During `G.torchNight` the game screen `draw`:
- marks the torchbearer's on-view tile with a torch glyph + ring (a `put`/
  overlay after the world layer, within the `VIEW_W×VIEW_H` viewport);
- replaces the two day hint lines (`js/screens.js:543-558`) with a **control
  HUD**: the torchbearer's name · role · hp bar · `resolveBand` label, and the
  verb map (`Enter go · h hold · r rally · f rescue · Space look`), colored to
  read as "you are this person."
Both renderers (ascii + tiles) show it — the marker is drawn in the screen
layer, above whichever world painter ran, so it is renderer-agnostic (the
AGENTS.md "both renderers show the same info" rule).

## Commands you will need

| Purpose   | Command                               | Expected on success |
|-----------|---------------------------------------|---------------------|
| Install   | `pnpm install`                        | exit 0              |
| Tests     | `pnpm test`                           | all pass            |
| One file  | `pnpm vitest run test/torch.test.js`  | that file passes    |
| Typecheck | `pnpm check`                          | exit 0              |
| Lint      | `pnpm lint`                           | exit 0              |
| Cycle smoke | `node -e "globalThis.performance={now:()=>0};import('./js/torch.js').then(m=>console.log('OK',Object.keys(m).sort().join(','))).catch(e=>{console.error(e);process.exit(1)})"` | prints `OK` + exports |
| Play      | `pnpm dev` → http://localhost:8137    | manual check, Step 9 |

Debug hooks: `window.G`, `window.ff(minutes)` (fast-forward) — see `AGENTS.md`.
To drive a dusk in the console: set `G.raidNext = G.day`, `window.ff(...)` to a
dawn (watch for the torch modal), pick a bearer, `ff` to `nightStart`.

## Scope

**In scope**:
- `js/torch.js` (create), `js/ui/torch.js` (create), `test/torch.test.js` (create)
- `js/balance.js` — add the `torch` block
- `js/state.js` — six ephemeral torch fields in `makeState()`
- `js/settlers.js` — `tickTorchbearer` branch; rally redirect in the non-guard
  raid branch; `torchbearerFell` hook in `woundSettler`/`killSettler`
- `js/game.js` — `engageDuskTorch()` call in `tickGame`; barrel re-exports
- `js/dawn.js` — `endTorchNight()` + `torchPromptDay` at dawn
- `js/screens.js` (post-009 game screen) — `update()` modal raise; night input
  delegation in `onKey`/`onClick`; torchbearer marker + control HUD in `draw`
- `plans/README.md` — status row

**Out of scope** (do not touch / defer):
- **A second verb set / formations / focus-fire** — GDD §11 Q2 is open; ship
  the minimal four verbs only (`GDD.md:392-393`).
- **Any torchbearer stat/combat/work modifier** — the hero-class ban
  (`GDD.md:78`, `GDD.md:383`); the P5 gate (`GDD.md:343`).
- **Mid-raid *breaks*** (refusals/desertions during a raid) — 012 keeps those
  dawn-only (`GDD.md:256-257`); the torch *handoff* is not a break and does not
  touch `castDawn`.
- **Endings** (Last Stand / Torch survivor choice) — HP-7/plan 016.
- **Aging / life-stage "Grey earn it" teeth** — HP-8/plan 017 adds `age` to run
  settlers; render the annotation only if the field exists.
- **Persisting torch state across save/load** — intentionally ephemeral (Current
  state → save); **no `SAVE_VERSION` bump**.
- Expedition/away-party changes, raider AI, the sidebar layout geometry.

## Git workflow

- Branch: this batch executes on `main` (see execution model). Commit per step
  with imperative messages ("Add the torch-choice policy module").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `BALANCE.torch` + `js/state.js` fields (tables/state first)

In `js/balance.js`, add the `torch:` block from Design after the `cast:` block
(012), in the file's terse comment style. In `js/state.js` `makeState()`, add
the six ephemeral fields next to the other UI/tool fields (`js/state.js:19`):

```js
torchbearer: null, torchNight: false, torchOrder: null,
rallyPoint: null, torchPromptDay: 0, torchDropped: null,
```

Do **not** add them to `js/save.js` (`toSaveData`) — they are transient (Current
state → save). Confirm `loadGame`'s `Object.assign(G, makeState(), d)` therefore
resets them; add a one-line comment on the `state.js` block: *"night-transient;
never serialized — reset each load like `mode`/`cursor`."*

Extend `test/balance.test.js` with a `describe('BALANCE.torch')`: `rallyTtl >
0`, `dragStep >= 1`, `handoffWindow > 0`, `carryResolve` a non-negative integer,
`rallyRadius` a positive integer.

**Verify**: `pnpm vitest run test/balance.test.js` → pass; `pnpm check && pnpm lint` → exit 0.

### Step 2: `js/torch.js` — the policy module

Create `js/torch.js` per Design → New modules. Keep the pure functions
side-effect-free so Step 8 can unit-test them on literals:

- `torchEligible()` → `settlersPresent()`… **but do not import `settlers.js`**
  (cycle). Inline the predicate: `G.settlers.filter(s => !s.away && !s.downed)`
  (the exact `settlerActive` body, `js/settlers.js:14`).
- `torchbearerNow()` → the settler whose `id === G.torchbearer` if present, else
  `null`.
- `torchAnnotate(s)` → `{ eager: s.trait === 'brave', bonded: s.bond != null,
  band: resolveBand(s), want: wantLabel(s), age: s.age }` (from `cast.js`);
  `age` is `undefined` on run settlers until HP-8 — the UI renders it only when
  defined.
- `chooseTorch(id)` → `G.torchbearer = id;` (id may be `null` for "no one").
- `engageDuskTorch()` → if `torchbearerNow()`, `G.torchNight = true`,
  `G.torchOrder = { kind: 'hold' }`, `G.mode = 'NORMAL'`, `G.buildSel = null`,
  `centerCam(tb.x, tb.y)`, `tip('torch')`; else `notice(...)` and leave
  `torchNight` false.
- `endTorchNight()` → if a torchbearer carried through present and not
  `refusing`, `bumpResolve(tb, BALANCE.torch.carryResolve, 'carried the torch')`
  (012); then clear `torchNight`/`torchOrder`/`rallyPoint`/`torchbearer`/
  `torchDropped`.
- `torchbearerFell(s)` → if `G.torchNight && s.id === G.torchbearer`, set
  `G.torchDropped = { at: G.day*1440 + G.min }`, `G.torchOrder = null`,
  `notice('The torch is on the ground — press T to take it up.')`,
  `tip('torchDropped')`.
- `pickUpTorch()` → nearest present non-Breaking member to the last torchbearer
  position (or to `G.camp`); set `G.torchbearer = pick.id`, `G.torchOrder = {
  kind: 'hold' }`, `G.torchDropped = null`, `centerCam`, `notice(...)`. No-op if
  none eligible or the window lapsed.
- `orderMove(x, y)` / `orderHold()` / `orderRally()` / `orderRescue()` → set
  `G.torchOrder`; `orderRally` also sets `G.rallyPoint`; `orderRescue` finds the
  nearest downed member and stores its id (or `notice('No one is down')`).

Import `centerCam` from `./game.js`? No — `game.js` imports `torch.js`
indirectly via the barrel; import `centerCam` directly from where it is defined
(`js/game.js` exports it, but to avoid the barrel cycle, keep `centerCam` usage
in `engageDuskTorch`/`pickUpTorch` by importing `{ centerCam } from './game.js'`
**only if** `node`-cycle-smoke stays clean; if it complains, move the
`centerCam` call to the caller in `tickGame`/the input layer and have
`torch.js` set state only). JSDoc-annotate object params (`pnpm check` runs tsc).

In `js/game.js`, barrel-re-export the view-facing helpers next to the other
re-exports: `export { torchEligible, torchbearerNow, torchAnnotate, chooseTorch,
pickUpTorch, orderMove, orderHold, orderRally, orderRescue } from './torch.js';`

**Verify**: cycle smoke prints `OK`; `pnpm check && pnpm lint && pnpm test` →
green (nothing consumes it yet; additive).

### Step 3: `js/settlers.js` — control branch, rally redirect, fall hook

- Add `import { torchbearerFell } from './torch.js';` (one-way edge; verify no
  cycle with the smoke command).
- **Control branch** in `tickSettler`: insert, immediately before the
  adjacent-foe block (`js/settlers.js:413`), after the eat/maintenance code:

  ```js
  if (G.torchNight && s.id === G.torchbearer && settlerActive(s)) return tickTorchbearer(s);
  ```

- **`tickTorchbearer(s)`** (new private function): switch on `G.torchOrder.kind`:
  - `move` → `if (mdist(s.x,s.y,o.x,o.y) <= 0) { G.torchOrder = { kind:'hold' }; }`
    else `moveToward(s, o.x, o.y, { refresh: 3 })`; then **fall through to the
    normal adjacent-foe melee** so they fight what they reach (share the code —
    either call a small `meleeIfAdjacent(s)` extracted from `:413-422`, or
    structure `tickTorchbearer` to run the melee check first, then move). Keep
    the melee math **identical** — this is the P5 gate.
  - `hold` → `meleeIfAdjacent(s)`; no move.
  - `rally` → set/refresh `G.rallyPoint`; `meleeIfAdjacent(s)`; hold.
  - `rescue` → target = the downed settler by `G.torchOrder.id`; if gone/
    recovered → `G.torchOrder = { kind:'hold' }`; else move adjacent to it and,
    when adjacent, step it toward `G.camp` by `dragStep` via a guarded position
    write (respect `walkable`); `meleeIfAdjacent(s)`.
  Extract the melee at `:413-422` into `meleeIfAdjacent(s)` (returns whether it
  attacked) and call it from both the normal branch and `tickTorchbearer` — a
  **behavior-preserving** extraction (verify the existing combat tests still
  pass unchanged).
- **Rally redirect** in the non-guard raid branch (`js/settlers.js:451-455`):
  before the flee-to-camp line, if `G.rallyPoint` is live (`until >` now) and
  within `BALANCE.torch.rallyRadius`, `moveToward(s, G.rallyPoint.x,
  G.rallyPoint.y, { adjacent: true, refresh: 10 }); return;`.
- **Fall hook**: in `woundSettler`'s down path (after `s.downed = true`,
  `js/settlers.js:340-344`) **and** in `killSettler` (before the
  `G.settlers.filter`, `js/settlers.js:329`), call `torchbearerFell(s)`.

**Verify**: cycle smoke `OK`; `pnpm test` → green. `test/combat-economy.test.js`
melee tests must pass **unchanged** (the `meleeIfAdjacent` extraction is
behavior-preserving; if one fails, the extraction changed the damage math —
fix the extraction, do not edit the test). `grep -n "meleeIfAdjacent"
js/settlers.js` → the melee body exists in exactly one place.

### Step 4: wire engage/end + dawn prompt

- `js/game.js` `tickGame`: at the `nightStart` hook (`js/game.js:272`), add
  `if (G.min === BALANCE.time.nightStart) engageDuskTorch();` (import from
  `./torch.js` directly — sim module). Keep the existing `tip('night')` line.
- `js/dawn.js` `onDawn`: after `castDawn()` (012) and before `save()`, call
  `endTorchNight()`; then set the prompt signal when tonight is a played night:
  `if (G.day >= G.raidNext || isHordeDay(G.day)) G.torchPromptDay = G.day;`
  (import `endTorchNight` from `./torch.js`, `isHordeDay` from `./seasons.js`).
  Order matters: `endTorchNight` (apply the honor bump, clear yesterday) **then**
  set `torchPromptDay` for today.

**Verify**: `pnpm test` → green. `pnpm dev`: set `G.raidNext = G.day` in the
console, `ff` to a dawn → the torch modal appears (Step 6 wires it, so until
then just confirm `G.torchPromptDay === G.day` after dawn).

### Step 5: `js/ui/torch.js` — the dawn modal

Create `js/ui/torch.js`. `makeTorchChoiceModal()` builds a `makeListScreen`
(`js/ui/menu.js`) with `pausesSim: true`, one row per `torchEligible()` member
plus a final "No one carries it — let them fight" row. Each member row shows
`name · role`, an hp/`resolveBand` tag, and the `torchAnnotate` signals (eager
`♦`, bonded `⚭ fears`, Breaking flag, want); render `age`/life-stage **only if
`ann.age !== undefined`**. Selecting a member → `chooseTorch(id)` then `pop()`;
selecting "no one" → `chooseTorch(null)` then `pop()`. Read the policy via the
`js/game.js` barrel (view rule).

Also add the night helpers here (consumed by the game screen in Step 6):
`nightControlKey(scr, k, mods)`, `nightControlClick(scr, c)`, `drawTorchHud(scr,
f)` — see Step 6 for their contracts. Export the modal factory and the three
helpers.

**Verify**: `pnpm check && pnpm lint` → exit 0; import the module in a scratch
`node` line to confirm no cycle.

### Step 6: `js/screens.js` (game screen) — raise the modal, route night input, draw the HUD

Post-009 the game screen is `makeGameScreen()` in `js/screens.js`. Import
`{ makeTorchChoiceModal, nightControlKey, nightControlClick, drawTorchHud }`
from `./ui/torch.js`, and `{ torchbearerNow } from './game.js'`.

- **`update()`** (add to the screen object; `js/main.js:44` calls it): if
  `G.torchPromptDay === G.day && !G.torchNight && !top-is-a-modal && G.torchbearer
  === null`, `push(makeTorchChoiceModal())` and spend the signal
  (`G.torchPromptDay = 0`). Guard so it raises **once** and never over another
  modal.
- **`onKey(k, mods)`**: first line — `if (G.torchNight) return nightControlKey(this, k, mods);`
  `nightControlKey` (in `js/ui/torch.js`) implements the Design → gate:
  - always allow look/meta: arrows → `moveCursor` (via the screen's existing
    handler — pass `scr` so it can call the same cursor mover), pan keys,
    `v` graphics, `n` minimap, `Escape` → `push(makePauseMenu())`, `' '` →
    `togglePause()`.
  - if `G.torchDropped` and `k === 't'` (or the pad face key) and the window is
    open → `pickUpTorch()`.
  - if **not** `G.paused`: `Enter`/`Paint` → `orderMove(G.cursor.x, G.cursor.y)`;
    `h`/`b` → `orderHold()`; `r` → `orderRally()`; `f`/`w` → `orderRescue()`.
  - if `G.paused`: **drop** the four verb keys (the enforced gate). Do **not**
    fall through to build/cancel/trade/world/cycleRole — those are locked out at
    night regardless of pause.
- **`onClick(c)`**: first line — `if (G.torchNight) return nightControlClick(this, c);`
  which, when not paused and the click is in the viewport, sets the cursor to the
  clicked tile and `orderMove`s there (a click = "go here"); when paused, only
  moves the cursor (look). No drag-box, no paint at night.
- **`draw(f)`**: after the world layer and before the day hint lines, if
  `G.torchNight` call `drawTorchHud(this, f)` which (a) marks the torchbearer's
  on-view tile with a torch glyph + ring and (b) draws the control HUD (name ·
  role · hp · resolve band · verb map) in place of the two day hint lines
  (`js/screens.js:543-558` — gate those two `str` calls behind `if
  (!G.torchNight)`).

**Verify**: `pnpm check && pnpm lint && pnpm test` → green. The modal and HUD
are draw paths with no unit coverage — Step 9 is the manual sweep. Unit-test the
pure routing in Step 8.

### Step 7: (folded into Step 6) — no separate render module

The torchbearer marker and HUD live in `drawTorchHud` (`js/ui/torch.js`), drawn
by the game screen, above whichever world painter ran — so both the ascii and
tiles renderers show it identically (AGENTS.md rule). Nothing to do here beyond
confirming, with `pnpm dev` and the Esc → Graphics toggle, that the marker
appears in **both** renderers (part of Step 9).

### Step 8: `test/torch.test.js` — the regime under test

Create with the `test/cast.test.js`/`test/combat-economy.test.js` header (stub
`localStorage`/`performance` before dynamic import), importing `state.js`,
`torch.js`, `settlers.js`, `cast.js`, `balance.js`, `data.js`, and the game
screen factory + `makeTorchChoiceModal` from the ui module. `beforeEach`:
`Object.assign(G, makeState()); G.tiles = grassTiles(); G.camp = {…};` plus a
helper to drop N settlers on the map.

Tests (the four the operator named, plus the P5 gate):

1. **Choice writes `G.torchbearer`**: build the modal from an eligible band;
   invoke the member row's activate → `G.torchbearer === that.id`; the "no one"
   row → `G.torchbearer === null`. `torchEligible()` excludes an `away` and a
   `downed` member.
2. **Night input mode rejects non-torchbearer commands**: `G.torchNight = true`,
   a torchbearer set; call the game screen's `onKey('b', {})` → `G.mode` is
   **still `'NORMAL'`** (build locked out); `onClick` on a settler tile does
   **not** `cycleRole` (role unchanged) and starts **no** `G.sel`. `onKey('Enter')`
   at a cursor tile **does** set `G.torchOrder.kind === 'move'` to that tile;
   `'h'` → `'hold'`; `'r'` → `'rally'` (and `G.rallyPoint` set); `'f'` with a
   downed present → `'rescue'`. Assert the **gamepad-shared** keys hit the same
   verbs (`'b'`→hold, `'w'`→rescue, `'r'`→rally, `'Enter'`→move) — the pad map.
3. **Pause blocks commands but allows look**: `G.torchNight` + `G.paused = true`;
   `onKey('Enter')`/`'h'`/`'r'`/`'f'` leave `G.torchOrder` **unchanged**;
   `onKey('ArrowRight')` **does** move `G.cursor`; `' '` calls `togglePause`
   (unpauses). Then with `G.paused = false`, the same verb keys **do** set
   `G.torchOrder` — proving the gate is pause-state, not a permanent lockout.
4. **Torchbearer-down transition**: torchbearer live, `G.torchNight`;
   `woundSettler(tb, 999, …)` forcing the down path (stub RNG so `downChance`
   hits) → `G.torchDropped` is set, `torchbearerNow()` is `null` (they are
   `!settlerActive`), and `tickSettler(tb)` no longer routes to the control
   branch (it crawls). `pickUpTorch()` promotes the nearest present member →
   `G.torchbearer` is the new id, `G.torchDropped` cleared. A `killSettler(tb)`
   variant sets `G.torchDropped` too.
5. **P5 hero-class gate (the falsifier as a test)**: two settlers identical in
   role/trait/weapon, one the torchbearer under `move`/`hold`, one on AI; place
   each adjacent to a fixed-hp raider and tick; assert the **damage dealt is
   identical** across a fixed-RNG seed (the melee math is shared, not buffed).
   Also assert the torchbearer takes hunger/fire/wound exactly like the AI
   settler (the maintenance code still runs) — control changes *decisions*, not
   *stats* (`GDD.md:78`, `GDD.md:343`).
6. **Rally redirect is O(n) and buff-free**: a live `G.rallyPoint` within
   `rallyRadius`; a non-guard in the raid branch moves toward it instead of the
   camp; no field on the settler changed but position. A guard ignores it (keeps
   its own AI).

**Verify**: `pnpm vitest run test/torch.test.js` → all pass; `pnpm test` →
full suite green.

### Step 9: manual play smoke (required — modal + HUD + control have no unit coverage)

`pnpm dev`, http://localhost:8137. In the console: `G.raidNext = G.day`, then
`window.ff(...)` toward the next dawn.

1. **Dawn choice**: at dawn the torch modal appears listing present members with
   the eager/bonded/resolve/want annotations; pick one (or "no one"); arrows +
   Enter and the gamepad both drive it; it `pausesSim` while open.
2. **Dusk engage**: `ff` to `nightStart` — camera snaps to the torchbearer, the
   marker + control HUD appear, the day hint lines are gone.
3. **Verbs**: move the cursor and press Enter (Go) → the torchbearer paths there
   and fights what they meet; `h` (Hold) at a door; `r` (Rally) → nearby
   non-guards converge; down a member (let a raider hit one) then `f` (Rescue) →
   the torchbearer drags them toward the fire faster than the crawl. Repeat on
   the **gamepad** (A go · X hold · L3 rally · Y rescue).
4. **Pause = look only**: press Space during the raid → sim freezes; verb keys
   do **nothing**; arrows/minimap/graphics-toggle still pan/inspect; Space again
   resumes and verbs work. Confirm `b`/`x`/`w`/`e` do nothing at night.
5. **Falls mid-night**: let the torchbearer get downed → "torch on the ground"
   prompt; press `t` → nearest member takes it up, control resumes; or ignore it
   → the night finishes on AI; at dawn no crash, a new choice is offered.
6. **Renderers**: Esc → Graphics toggle → the marker + HUD render in **both**
   ascii and tiles.
7. **Quiet night**: on a non-raid dawn, **no** modal fires and dusk runs on AI
   (no HUD) — the P7 non-nag check.

Any control that puppeteers a settler *better* than an AI settler (extra
damage/speed), any daylight order that leaks into the night, any verb that fires
while paused: STOP.

### Step 10: `plans/README.md` + maintenance notes

Add (or update) the row:

```
| 014 | The torchbearer — dawn torch-choice + embodied, order-only dusk control | HP-4 | P1 | L | 009, 012 | DONE |
```

Under "Dependency notes", record that HP-7 (endings, plan 016) is the first
consumer of "who survived the dusk you played" and that §11 Q2 (second verb set)
and the drop-the-torch handoff ergonomics are the deliberate playtest-open
questions this plan ships minimal.

**Verify**: `pnpm check && pnpm lint && pnpm test` all exit 0; `git status`
shows only in-scope files; `git diff plans/README.md` is the status row only.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/torch.test.js` ~6 tests
(choice→`G.torchbearer`; night input rejects non-torchbearer commands + verb
map incl. gamepad keys; pause blocks verbs / allows look; torchbearer-down →
drop + handoff; P5 hero-class parity; rally redirect); `test/balance.test.js`
+1 (`torch` block); `test/combat-economy.test.js` unchanged (the
`meleeIfAdjacent` extraction is behavior-preserving) — all green alongside the
existing suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/torch.js`, `js/ui/torch.js`, `test/torch.test.js` exist; cycle smoke
      prints `OK` (`torch.js` imports no `settlers.js`)
- [ ] The dawn modal writes `G.torchbearer` (or `null`); it fires only on
      played nights (or every dawn if the operator chose the literal reading —
      note which in the PR)
- [ ] Night control is a distinct regime: **`grep -n "torchNight" js/screens.js
      js/ui/torch.js`** shows `onKey`/`onClick` short-circuiting to the night
      handler; daylight tools (`b`/`x`/`w`/`e`/drag-box/`cycleRole`) are
      unreachable while `G.torchNight`
- [ ] Pause is look-only at night: the four verbs are dropped when `G.paused`
      (Step 8 test #3 passes); pause still routes through `togglePause()`, never
      a raw `G.paused =` in the new code (`grep -rn "G.paused =" js/torch.js
      js/ui/torch.js` → no hits)
- [ ] **Hero-class gate**: `grep -rn "torchbearer\|torchNight" js/settlers.js`
      shows the control branch changing only *decisions* (which order to
      pursue), never the melee/work math; Step 8 test #5 (parity) passes
- [ ] Torch fields are ephemeral — **not** in `js/save.js`; `grep -n
      "torchbearer" js/save.js` → no hits; no `SAVE_VERSION` bump
- [ ] `js/gamepad.js` is unchanged (`git diff 14fd915..HEAD -- js/gamepad.js`
      empty beyond any 009-013 churn) — the night handler reuses its virtual keys
- [ ] Torchbearer-down drops the torch (no auto-inherit); `pickUpTorch` is a
      deliberate `t`-press handoff; Step 8 test #4 passes
- [ ] `plans/README.md` row added/updated

## STOP conditions

- Any excerpt in "Current state" no longer matches after 009-013 landed (drift)
  — re-ground every cited symbol; if `tickSettler`, `woundSettler`/`killSettler`,
  `makeGameScreen().onKey`, `js/main.js`'s `simActive`/`update()` call, or the
  save allowlist differ materially from the excerpts, re-derive the edit and
  report before coding.
- You find yourself giving the torchbearer **any** combat/economy/work edge — a
  damage bonus, faster tick, cheaper work, extra hp. That is the hero class the
  GDD forbids (`GDD.md:78`, `GDD.md:383`) and the §9.1(1)/P5 gate
  (`GDD.md:343`). STOP — this is a design gate, not an implementation detail.
- A torchbearer **verb fires while `G.paused`**, or a **daylight order**
  (build/area-orders/role-cycle/trade/world) reaches the night regime. That
  re-opens the exact contradiction P2 exists to close (`GDD.md:81-83`). STOP.
- The `meleeIfAdjacent` extraction changes any `test/combat-economy.test.js`
  result — the extraction was not behavior-preserving; fix it, never edit the
  characterization test.
- An import cycle appears (`pnpm check`/Vite/the `node` smoke complains):
  `torch.js` must import only state/data/balance/journal/onboard/seasons/cast
  (and, if clean, `centerCam` from the barrel); if a hook forces a `settlers.js`
  import into `torch.js`, inline the predicate or move the call to the caller —
  do not invert `settlers → torch`.
- You reach for a **fifth verb** or a formation/focus-fire system, or an
  **auto-inherit** on the torchbearer's fall — both are exactly what GDD §11 Q2
  holds open for playtest (`GDD.md:392-393`). STOP; ship the minimal set and the
  press-T handoff.
- The torch modal turns out to need to be pushed from **sim code** (`dawn.js`/
  `tickGame`) rather than the game screen's `update()` — that couples sim to the
  view; keep it sim-sets-a-flag / UI-reacts, and report if something blocks that.

## Maintenance notes

- **§11 Q2 is the live playtest question this plan feeds**: is Go/Hold/Rally/
  Rescue enough, or does dusk need a second verb set — and is the drop-the-torch
  handoff the right friction? Both the verb count and the handoff ergonomics are
  the knobs; the honor bump (`torch.carryResolve`) is a cuttable lever if torch
  duty starts reading as a buff. Do not add verbs speculatively.
- **HP-7 (endings, plan 016)** is the first real consumer: "who walks out"
  (the Torch survivor choice) is decided over the band you *played* dusk with;
  the torchbearer is the natural default survivor to offer. This plan writes no
  ending state — it makes the dusk legible enough for HP-7 to pay off.
- **HP-8 (aging, plan 017)** adds `age` to run settlers; when it lands, the
  torch modal's `torchAnnotate.age` renders the "Grey earn it" life-stage line
  automatically (the annotation already probes for the field). No torch change
  needed beyond confirming the render.
- **The `meleeIfAdjacent` extraction** is the tripwire for the hero-class gate:
  as long as the torchbearer and the AI share that one function, parity holds by
  construction. Any future "torchbearer does X better" request must go through a
  design review against P5, not a fork of the melee.
- **Ephemeral-by-design**: the torch fields never enter the save because a save
  only ever happens at dawn, when no torch is lit. If a future feature autosaves
  mid-night (mid-run checkpoints), revisit — the fields would then need
  serializing and a `SAVE_VERSION` bump with a migration.
</content>
</invoke>
