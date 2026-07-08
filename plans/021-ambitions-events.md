# Plan 021: Ambitions v0 + the event deck v0 (HP0 content) — the two decks that fill the day

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. This plan is **two independent items batched**;
> each is its own step-group ending in its **own commit checkpoint** with all
> three gates (`pnpm check`, `pnpm lint`, `pnpm test`) green. You may land the
> ambitions item and the event-deck item in either order — they share only
> `js/beats.js` (register calls, additive), `js/balance.js` (append-only),
> `js/data.js` (new tables), and `js/save.js`/`js/state.js` (additive). When
> done, update the status row for this plan in `plans/README.md` (final step).
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/beats.js js/data.js js/balance.js js/state.js js/save.js js/game.js js/main.js js/world.js js/journal.js js/cast.js js/campaign.js js/ui/ js/screens.js`
> Every excerpt below is anchored at **`14fd915`** (this plan's authoring
> commit). By execution time, **plans 009–020 have landed on main ahead of
> this one** (see Execution model), so several files *will* differ from the
> excerpts — that is expected, not drift. Re-locate every symbol by **name**,
> not line number, and re-read the four landed interfaces this plan consumes
> before designing (they are the whole reason this plan is small):
> - **`js/beats.js`** (plan 020): `registerDeck({ id, tryProc })` / `noteBeat`
>   and the per-day proc floor. **BOTH decks this plan ships register here.**
>   Do not build a second scheduler — the floor already calls decks at dawn.
> - **`js/cast.js`** (plan 012): `resolveBand(s)`, `wantSatisfied(s)`,
>   per-person `s.wants`/`s.scars`/`s.weapon`, the `medic` role. Event
>   templates gate on these (GDD §10 "gated on HP-2's structures").
> - **`js/campaign.js`** (plan 010) + **`js/balance.js` `campaign` block**
>   (plan 020): `CAMPAIGN.unlocks` holds **option id strings, never
>   modifiers**. An ambition's optional `unlock` id is the *only* thing either
>   deck writes cross-run.
> - The **modal surface**: plan 009 split `screens.js` into `js/ui/`; the
>   modal factories (`makeBeaconModal`, `makeGameOverModal`) likely now live in
>   a `js/ui/` module (e.g. `js/ui/modals.js`). Re-locate by symbol name.
>
> If a `js/ambitions.js` or `js/events.js` already exists, STOP (someone
> started HP0 content already).

## Status

- **Priority**: P1
- **Effort**: M (two S-M content items batched on one shared interface; the
  schemas are small, the content is the bulk)
- **Risk**: LOW-MED (both items are additive content on plan 020's registry;
  the ambition offer adds one save-shape group and one `main.js` push line
  mirroring the existing game-over push; no combat/economy core is touched)
- **Depends on**: **012** (the cast — event templates read `resolveBand`,
  `wantSatisfied`, `s.weapon`, the `medic` role) and **020** (the deck-proc
  floor — `registerDeck`/`noteBeat` in `js/beats.js`; the `CAMPAIGN.unlocks`
  string-id convention and `BALANCE.campaign`). Both have landed by execution
  time.
- **Category**: feature (two content decks)
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP0 content — ambitions v0 (Elder offers 1-of-2, reusing the
  `OBJECTIVES` shape) + the event deck v0 (15–25 templates, gated on HP-2's
  structures) — `ROADMAP.md:126-130`, the paragraph after the HP0 milestone
  table. GDD §8 (`GDD.md:326-328`), §10 (`GDD.md:360-366`), §4
  (`GDD.md:240-242`), §9 invariants 1/6/8 (`GDD.md:343`, `GDD.md:355-356`,
  `GDD.md:358`).

## Execution model

Plans run **sequentially, on `main`, in numeric order — no feature branches**
(`plans/README.md` "Execution model"). Each plan ends in a commit checkpoint
with all three gates green; **staged plans checkpoint per stage**, and this
plan's two items are those stages (one commit each). By the time 021 executes,
**009–020 have already merged to main**, so:

- **`js/beats.js` exists** (plan 020) exporting `registerDeck(deck)` where
  `deck = { id, tryProc }`, `noteBeat(kind, why)`, and `beatFloorDawn()` —
  called at the end of `communeDawn`. The floor consults registered decks **in
  registration order**; the first deck whose `tryProc(day)` returns truthy
  supplies the day's guaranteed beat. `tryProc` returns "a beat object (any
  truthy value the source has already applied/logged) or null if it declines
  today" (plan 020 Item 2 Design). **This plan registers two decks and adds no
  dawn hook of its own** — the floor is the scheduler.
- **`js/cast.js` exists** (plan 012) with `resolveBand(s)` →
  `'steady'|'fraying'|'breaking'`, `wantSatisfied(s)`, `wantLabel(s)`, and
  settlers carry `s.wants` (array of one), `s.scars` (append-only), `s.weapon`
  (bool), plus the `medic` role in `ROLE_ORDER`. View-facing helpers are
  re-exported through the `js/game.js` barrel (house rule).
- **`js/campaign.js` + `BALANCE.campaign`** (plans 010/020): `CAMPAIGN.unlocks`
  is an array of **permanent option id strings — never modifiers** (plan 010
  Step 1). Plan 020 added `BALANCE.campaign.firstLossUnlock` and the first-loss
  write. An ambition's `unlock` id appends to `CAMPAIGN.unlocks` the same way.
- **The modal surface moved** (plan 009): `screens.js` was split into `js/ui/`;
  `makeBeaconModal`/`makeGameOverModal` likely live in `js/ui/modals.js`. The
  offer modal this plan adds sits beside them. Re-locate by symbol name.
- **`js/save.js` `SAVE_VERSION` is ≥ 4** (plan 011 → 2, plan 012 → 3, plan 020
  bumped twice → 5-ish). Read the current value before this plan's single bump.

## Why this matters

GDD §4's decision cadence — "one meaningful choice every 2–3 minutes, now with
a **guaranteed deck-proc floor** (at least one event/arrival/ambition beat per
game-day)" (`GDD.md:240-242`) — is a promise plan 020 built the *floor* for but
left **content-empty**: 020 ships the registry and a single reward-free flavor
fallback, explicitly deferring "the event/ambition deck content (plan 021)"
(`plans/020-supporting-systems.md:260-262`). Until real decks register, every
day that isn't a raid or a recruit falls through to one Elder flavor line. This
plan is **the primary consumer of 020's registry** — it makes the floor
*deliver* the variety GDD §10 requires: "event deck (15–25 v1, with the per-day
proc floor), ambitions (~10)" (`GDD.md:362-363`).

Two GDD-binding jobs:

1. **Ambitions sustain the game after the tutorial ends.** GDD §8: "The Elder
   onboards; ambitions sustain: objective chain through the first horde;
   thereafter the Elder offers 1-of-2 ambitions (declining is free — pulls,
   not chores)" (`GDD.md:326-328`). Today the `OBJECTIVES` chain
   (`js/data.js:223-238`) simply **ends** — once `G.objIdx` reaches the end,
   the Elder's objective voice goes quiet and the sidebar's purpose box empties
   for the rest of the run. Nothing offers a next goal.
2. **The event deck is where run-to-run variety lives.** GDD §10: "Variety
   lives in decks and tables … run variety must come from site × season ×
   menace × creed × cast-you-brought, or the design has failed regardless of
   map count" (`GDD.md:362-366`). Today the only mid-run "events" are the
   expedition road-roll (`js/world.js:131-136`) and the trader — there is no
   deck of legible beats that reference the settlement's own state.

Binding **review gates** (not suggestions):

- **§9 invariant 6 (`GDD.md:355-356`)**: "No creed or trial may reward raw
  headcount or raw passivity (Open-Hearth-style volume perks are banned;
  benefits must be qualitative)." **No ambition may be "grow to N settlers" or
  "survive/turtle to day X", and no ambition or event reward may scale with
  headcount or reward doing-nothing.** This is an executable gate (a table
  scan), not prose. Note the existing onboarding `OBJECTIVES` *do* have
  headcount/survival goals (`tier2`/`tier3`/`day12`) — those are the tutorial
  and are out of scope; the **ambition** table must not.
- **§9 invariant 1 (`GDD.md:343`)**: nothing either deck persists cross-run may
  be a modifier. Ambitions/events are **per-run** (they live in `G`/the run
  save), "not cross-run unless they grant an unlock option"
  (`plans/010-campaign-store.md` reader-note / this plan's contract). The
  *only* cross-run write is an ambition's optional `unlock` — an **option id
  string** appended to `CAMPAIGN.unlocks`, never a number.
- **§9 invariant 8 (`GDD.md:358`)**: every quantity the player reasons about is
  a small integer or named band. Rewards are small integers; the deck adds no
  new scalar readout.
- **The floor's no-degeneracy rule survives (plan 020)**: 020's fallback beat
  "grants nothing mechanical … a free reward every quiet day is farmable"
  (`plans/020-supporting-systems.md:100-102`). Event *templates* may carry
  small bounded effects, but **no template may be a repeatable net-positive
  windfall** — mechanical effects are once-per-run or two-sided. The deck is
  content, not an income faucet.

## Current state

All excerpts verified at `14fd915`. Vanilla-JS browser game; vitest; all tuning
in `js/balance.js`; `G` singleton in `js/state.js`; versioned saves; sim
modules import directly, view modules through the `game.js` barrel (AGENTS.md
house rules).

### Item 1 — the onboarding chain that ambitions extend

The `OBJECTIVES` table is the shape both the sidebar and the Elder already
render — ambitions reuse it exactly (`js/data.js:223-238`):

```js
export const OBJECTIVES = [
  { id: 'chop', text: 'Chop 4 trees', hint: 'drag a box over trees', prog: g => [Math.min(4, g.stats.chopped || 0), 4], check: g => (g.stats.chopped || 0) >= 4, reward: { wood: 5 } },
  // …
  { id: 'raid',    text: 'Survive a raid',   hint: 'war-horns come at dusk', check: g => g.stats.raids >= 1, reward: { meds: 1 }, legacy: 1 },
  { id: 'bandits', text: 'Burn a bandit camp', hint: 'w · hit ☻ with force', check: g => g.banditsCleared >= 1, reward: { coin: 8 }, legacy: 1 },
  // …
  { id: 'beacon',  text: 'Light the Beacon',  hint: 'click beacon · confirm · hold 3 days', check: g => !!g.beaconDay, legacy: 3 },
];
```

An objective is `{ id, text, hint, prog?, check(g), reward?, legacy? }`.
`checkObjectives()` advances the chain and pays out (`js/game.js:64-76`):

```js
export function checkObjectives() {
  let guard = 0;
  while (G.objIdx < OBJECTIVES.length && guard++ < 6) {
    const o = OBJECTIVES[G.objIdx];
    if (!o.check(G)) break;
    G.objIdx++;
    const bits = [];
    if (o.reward) for (const k in o.reward) { G.res[k] += o.reward[k]; bits.push(`+${o.reward[k]} ${k}`); }
    if (o.legacy) { addPoints(o.legacy); bits.push(`◆${o.legacy} legacy`); }
    addLog(`✔ ${o.text}${bits.length ? ' — ' + bits.join(', ') : ''}`, '#8ad080');
    G.objFlash = performance.now() + 4000;
  }
}
```

It is driven from the tick on a fixed cadence (`js/game.js:273`):
`if (G.min % BALANCE.time.objectiveInterval === 0) checkObjectives();`
(`objectiveInterval: 15`, `js/balance.js:14`). `G.objIdx` starts at 0
(`js/state.js:12`) and is persisted (`js/save.js:21`).

**The "first horde" signal.** `isHordeDay(day)` = `day >= 12 && day % 12 === 0`
(`js/seasons.js:11`). A broken horde increments a stat (`js/game.js:297-301`):

```js
if (G.raidIsHorde) {
  G.raidIsHorde = false;
  G.stats.hordes++;                    // ← "survived the first horde" = G.stats.hordes >= 1
  bumpMorale(BALANCE.morale.hordeBroken, 'horde broken');
  addLog('The horde scatters. The warlord is dead or fled.', '#8ad080');
}
```

`G.stats.hordes` is seeded at `0` in `makeState()` (`js/state.js:10`) and
persisted inside `stats`. **`G.stats.hordes >= 1` is the concrete post-first-
horde gate** the offer flow keys on (GDD §8's "through the first horde").

**The Elder speaks the current objective**, then goes quiet past the raid
objective (`js/game.js:196-246`, the `rules` array; the onboarding rule at
`js/game.js:207-211`):

```js
() => {
  if (G.objIdx >= OBJECTIVES.length || G.objIdx > ELDER_OBJECTIVE_LIMIT) return null;
  const o = OBJECTIVES[G.objIdx];
  return mk(`${o.text} — ${o.hint}`, tonightInfo().urgent ? 'wary' : 'calm', o.prog ? o.prog(G) : null);
},
```

`mk(text, mood, prog)` returns `{ name, text, mood, prog }`; the sidebar draws
`prog` as an `(x/y)` counter in the Elder window (`js/screens.js:514`, the
`el.prog` line). **This is the reuse surface**: an "active ambition" rule added
to this array shows the ambition's `text`/`hint`/`prog` through the *same*
render — no new UI geometry.

**The offer modal pattern already exists.** `makeBeaconModal`
(`js/screens.js:869-891` at 14fd915; moved to `js/ui/modals.js` by plan 009) is
a centered box with a short list of labeled choices — exactly a 1-of-2 offer:

```js
const items = [
  { label: () => 'Ignite the Beacon', fg: '#ffe060', act: () => { if (igniteBeacon()) pop(); } },
  { label: () => 'Not yet', fg: '#8a94a2', act: () => pop() },
];
return makeListScreen({ id: 'beacon', items, /* … */, pausesSim: true, keymapExtra: { Escape: () => pop() }, drawChrome() { /* … */ } });
```

**A sim flag drives an auto-pushed modal.** The game-over modal is pushed from
the main loop when a `G` flag flips (`js/main.js:59`):

```js
if (G.gameOver && inStack('game') && !inStack('gameover')) push(makeGameOverModal());
```

`push`/`pop`/`inStack`/`top` are the ui.js stack (`js/ui.js:14-21`). **The
ambition offer mirrors this**: `tryProc` sets `G.ambitionOffer` at dawn; the
main loop pushes `makeAmbitionModal()` the next frame; the modal's choices
accept (or decline, free) and clear the flag.

### Item 2 — where a "beat" surfaces today, and the state events read

- **Journal surface** (`js/journal.js:14,19`): `addLog(text, fg)` appends a
  colored log line; `notice(text)` flashes a transient banner. Both are the
  legible-beat channel.
- **World sites** (`js/world.js:44-55`, `spawnLoc`): the overworld is
  `G.world = { grid, base, locs: [] }`; `spawnLoc(forceType?, quiet?)` marks a
  new site and (unless `quiet`) logs "Scouts marked a new site …". An event
  that "reveals a rumor of a ruin" calls this — a real world reference.
- **Cast state** (plan 012): `resolveBand(s)`, `wantSatisfied(s)`,
  `s.scars`, `s.weapon`, the `medic` role — the "HP-2 structures" GDD §10 says
  events gate on. Events *notice* real people ("a Fraying settler paces the
  wall"), so they can never fire on state that isn't there.
- **Buildings** (`js/data.js:52-69`, `BUILDS`): `workshop`, `kitchen`, watch
  `post`, `tent` — gate targets for structure-referencing templates
  (`G.tiles.some(tl => tl.t === 'workshop')`, `G.craftQueue`, etc.).
- **The proc floor** (plan 020): the *only* integration point. `registerDeck`
  at import time; the floor calls `tryProc(day)` each dawn. There is **no other
  hook** — do not add one (STOP condition).

### The test net and save-shape house rule

- Header pattern for new test files: stub `localStorage`/`performance` before
  dynamic import (`test/raid-path.test.js:1-17`); reset singletons in place
  (`Object.assign(G, makeState())`). Plan 020's `test/beats.test.js` clears
  `DECKS` between tests (via a `_resetDecks()` helper or fresh re-import) —
  **copy that reset**, since this plan registers into the same `DECKS`.
- `test/balance.test.js` asserts table keys — extend it for the new blocks and
  add the two **invariant-6 table-scan gates**.
- **Save-shape house rule** (AGENTS.md + plans 004/012/020): any change to what
  `toSaveData` writes ⇒ bump `SAVE_VERSION`, extend `migrate()`, add a
  migration test. Item 1 adds one additive field group (ambition run-state) ⇒
  one bump. `loadGame` does `Object.assign(G, makeState(), d)`
  (`js/save.js:86`-ish), which already backfills new `makeState` defaults for
  old saves — the migration step is belt-and-suspenders and the test proves it.

## Design

### Item 1 — Ambitions v0: the Elder offers 1-of-2, declining is free

**The offer flow, in one sentence**: once the band is past its first horde, a
dawn deck sets a pending 1-of-2 offer; the main loop shows it as a modal;
accepting sets one active ambition tracked exactly like an objective; declining
costs nothing and the offer simply returns later.

**State** (`js/state.js`, `makeState()`): add
```js
ambitionActive: null,   // id of the one accepted, in-progress ambition (null = none)
ambitionOffer: null,    // pending offer { choices: [id, id] } — main.js pushes the modal
ambitionsSeen: [],      // offered ids (never re-offered this run) + completed ids
lastAmbitionDay: 0,     // day of the last offer/completion — feeds the cooldown
```
All four are **run-scoped** (reset each settlement via `makeState`) and persist
in the run save. None crosses runs — the only cross-run write is an ambition's
optional `unlock` string into `CAMPAIGN.unlocks` (below).

**New table `AMBITIONS`** (`js/data.js`) — the **same shape as `OBJECTIVES`**
plus an optional `unlock`:
```js
// { id, text, hint, prog?(g)->[cur,max], check(g)->bool, reward?, legacy?, unlock?, offerable?(g)->bool }
// offerable(g): may this ambition be OFFERED given current run state? (default: true)
// unlock: a permanent option id STRING appended to CAMPAIGN.unlocks on completion — never a modifier.
```
`check`/`prog`/`reward`/`legacy` carry the exact semantics `checkObjectives`
already implements. `offerable` lets an ambition stay out of the pool when it
can't yet make sense (e.g. a Beacon ambition before tier III).

**v0 content set (ship ~6 of the ~10 target; all active/qualitative — invariant
6 gate).** Every one is a *pull* toward doing something, never toward growing a
number or waiting:
```js
export const AMBITIONS = [
  { id: 'armory',   text: 'Arm every guard with a spear', hint: 'forge spears (Ω) · assign them',
    prog: g => { const gd = g.settlers.filter(s => s.role === 'guard'); return [gd.filter(s => s.weapon).length, Math.max(1, gd.length)]; },
    check: g => { const gd = g.settlers.filter(s => s.role === 'guard'); return gd.length > 0 && gd.every(s => s.weapon); },
    reward: { scrap: 4 }, legacy: 1 },
  { id: 'raiders2', text: 'Break two bandit camps', hint: 'w · hit ☻ with a war party',
    prog: g => [Math.min(2, g.banditsCleared), 2], check: g => g.banditsCleared >= 2, reward: { coin: 10 }, legacy: 1 },
  { id: 'feast',    text: 'Cook a feast — 6 hearty meals', hint: 'raise a kitchen (π), cook',
    offerable: g => g.tiles.some(tl => tl.t === 'kitchen'),
    prog: g => [Math.min(6, g.stats.mealsCooked - (g._ambBase?.feast ?? 0)), 6],
    check: g => g.stats.mealsCooked - (g._ambBase?.feast ?? 0) >= 6, reward: { herbs: 3 } },
  { id: 'healer',   text: 'Keep a medic and mend the fallen', hint: 'set someone to medic (M)',
    offerable: g => g.settlers.length >= 4,
    check: g => g.settlers.some(s => s.role === 'medic') && (g.stats.recoveries || 0) >= 2,
    reward: { meds: 2 }, legacy: 1 },
  { id: 'beacontide', text: 'Light the Beacon before the next winter', hint: 'reach tier III · raise it',
    offerable: g => (g.stats.winters || 0) < 2,
    check: g => !!g.beaconDay && (g.stats.winters || 0) < 2, legacy: 2, unlock: 'ambition-beacontide' },
  { id: 'wanderers', text: 'Take in two souls from the road', hint: 'rescue survivors · welcome arrivals',
    prog: g => [Math.min(2, g.stats.rescues || 0), 2], check: g => (g.stats.rescues || 0) >= 2, reward: { food: 8 }, legacy: 1 },
];
```
Notes the executor must preserve, not "improve":
- `feast` measures meals cooked **since the ambition was accepted** — the
  `g._ambBase.feast` baseline is stamped in `acceptAmbition` (below), so a
  commune that already cooked 20 meals doesn't auto-complete. Do the same for
  any future counter-delta ambition; a bare `stats.mealsCooked >= 6` would let
  the tutorial's cooking satisfy it retroactively (and reads like passivity).
- `healer`/`wanderers` lean on two small new stat counters (`stats.recoveries`,
  `stats.rescues`) — Step 1.2 wires them at the existing recovery / rescue
  sites. If plan 012's medic work already added `recoveries`, reuse it; if
  plan 013 (arrivals) hasn't landed, `rescues` is fed only by the world
  `survivors` rescue (`js/world.js` `survivors` branch) — that is enough for
  v0. Do **not** invent a headcount goal to replace them.
- **No `settlers.length >= N` ambition, no "survive to day N" ambition.** Those
  are onboarding objectives; as *ambitions* they trip invariant 6. The
  balance-test gate (Step 1.4) enforces it by scanning the table source.

**New module `js/ambitions.js`** (imports `state.js`, `data.js`, `balance.js`,
`journal.js`, `campaign.js`, `beats.js` — all cycle-safe; it must **not** import
`js/game.js`, which imports the barrel). Exports:
- pure/predicate: `offerDue(g)`, `pickOffer(g)` (two distinct, currently
  `offerable`, un-seen ids), `activeAmbition(g)` (the `AMBITIONS` entry for
  `g.ambitionActive`, or null).
- impure: `acceptAmbition(id)`, `declineAmbition()`, `checkAmbitions()`,
  `ambitionDeckTryProc(day)`.
- side-effect at import: `registerDeck({ id: 'ambitions', tryProc: ambitionDeckTryProc })`.

```
offerDue(g) =
  g.stats.hordes >= 1                       // past the first horde (GDD §8)
  && !g.ambitionActive && !g.ambitionOffer  // one pull at a time
  && (g.day - g.lastAmbitionDay) >= BALANCE.ambition.offerCooldownDays
  && pickOffer(g).length === 2              // at least two un-seen, offerable ids remain

ambitionDeckTryProc(day):
  if (!offerDue(G)) return null;
  const choices = pickOffer(G);
  G.ambitionOffer = { choices };
  for (const id of choices) if (!G.ambitionsSeen.includes(id)) G.ambitionsSeen.push(id);  // offered = seen
  G.lastAmbitionDay = G.day;
  noteBeat('ambition', 'the Elder offers a purpose');   // this is the day's floor beat
  return { kind: 'ambition', choices };                 // truthy → the floor stops here today

acceptAmbition(id):
  G.ambitionActive = id; G.ambitionOffer = null;
  if (id === 'feast') { G._ambBase = { ...(G._ambBase||{}), feast: G.stats.mealsCooked }; }  // baseline stamps
  addLog(`◈ Ambition taken: ${AMBITIONS.find(a=>a.id===id).text}.`, '#e8d8a0');

declineAmbition():
  G.ambitionOffer = null;                   // PENALTY-FREE — pulls, not chores (GDD §8 review gate)
  addLog('The Elder nods — no burden today.', '#8a94a2');

checkAmbitions():                           // mirrors checkObjectives; called on the objective cadence
  const a = activeAmbition(G);
  if (!a || !a.check(G)) return;
  const bits = [];
  if (a.reward) for (const k in a.reward) { G.res[k] += a.reward[k]; bits.push(`+${a.reward[k]} ${k}`); }
  if (a.legacy) { addPoints(a.legacy); bits.push(`◆${a.legacy} legacy`); }
  if (a.unlock && !CAMPAIGN.unlocks.includes(a.unlock)) { CAMPAIGN.unlocks.push(a.unlock); saveCampaign(); bits.push('a new path opens'); }
  addLog(`◈ Ambition fulfilled: ${a.text}${bits.length ? ' — ' + bits.join(', ') : ''}`, '#8ad080');
  G.objFlash = performance.now() + 4000;
  if (!G.ambitionsSeen.includes(a.id)) G.ambitionsSeen.push(a.id);
  G.ambitionActive = null; G.lastAmbitionDay = G.day;   // cooldown before the next offer
```
`addPoints` comes from `js/meta.js` (as `checkObjectives` uses it);
`CAMPAIGN`/`saveCampaign` from `js/campaign.js`. **`checkAmbitions()` is called
from the existing objective hook** (`js/game.js:273`) right after
`checkObjectives()` — no new scheduler, no new cadence knob.

**Balance** (`js/balance.js`, new `ambition:` block):
```js
ambition: {
  offerCooldownDays: 3,   // days between an offer/completion and the next offer (a pull, not a nag)
},
```

**The offer modal** (`js/ui/modals.js` post-009 — re-locate beside
`makeBeaconModal`): `makeAmbitionModal()`, a centered box titled with the Elder
(`ELDERS[G.civ]`), listing the two `AMBITIONS` choices (`text` + `hint`) and a
third **"Not now"** row. Each choice `act`: `acceptAmbition(id); pop();`.
"Not now" `act`: `declineAmbition(); pop();`. `pausesSim: true` and
`Escape → declineAmbition(); pop()` (so dismissing is the same free decline).
Mirror `makeBeaconModal`'s `makeListScreen` construction exactly.

**The main-loop push** (`js/main.js`, one line beside the game-over push):
```js
if (G.ambitionOffer && inStack('game') && !inStack('ambition')) push(makeAmbitionModal());
```
Import `makeAmbitionModal` from the modals module. This is the entire wiring —
same mechanism the game-over modal already uses.

**The Elder shows the active ambition** (`js/game.js`, the `elderCounsel`
`rules` array): add one rule **after** the onboarding rule (`js/game.js:211`):
```js
() => { const a = activeAmbition(G); return a && mk(`${a.text} — ${a.hint}`, 'calm', a.prog ? a.prog(G) : null); },
```
This reuses the objective render end-to-end (the sidebar's `el.prog` counter),
so the purpose box that emptied after onboarding now carries the active
ambition. Import `activeAmbition` from `./ambitions.js` (direct — sim module).

### Item 2 — the event deck v0: 15–25 legible beats gated on real state

**The schema, in one shape** (`js/data.js`, `EVENTS` table):
```js
// { id, weight, minDay?, once?, trigger(g)->bool, effect?(g)->void, present(g)->{log,fg} | {notice} }
// trigger: is this template eligible right now? (reads cast/structures/season/world — real state)
// effect:  the small, bounded, legible change (optional; flavor-only templates omit it)
// present: the beat the player sees — a log line (and/or a notice). Required.
// once:    fire at most once per run (tracked in G.eventsSeen). weight: relative draw weight.
```

**New module `js/events.js`** (imports `state.js`, `data.js`, `balance.js`,
`journal.js`, `beats.js`, `world.js` — cycle-safe; **not** `js/game.js`).
```
eligible(g) = EVENTS.filter(e =>
  (!e.minDay || g.day >= e.minDay)
  && !(e.once && g.eventsSeen.includes(e.id))
  && e.trigger(g));

eventDeckTryProc(day):
  if (!chance(BALANCE.events.procChance)) return null;   // not every dawn — quiet days fall to 020's flavor fallback
  const pool = eligible(G);
  if (!pool.length) return null;
  const e = weightedPick(pool);                          // by e.weight
  if (e.effect) e.effect(G);
  const p = e.present(G);
  if (p.log) addLog(p.log, p.fg || '#b8b2a0');
  if (p.notice) notice(p.notice);
  if (e.once) G.eventsSeen.push(e.id);
  noteBeat('event', e.id);
  return { kind: 'event', id: e.id };                    // exactly ONE template fires → no double-fire
```
- `chance`/`weightedPick` (a tiny `rint`-based helper) come from `js/rng.js`.
- **No-double-fire is structural**: the floor calls `tryProc` **once per
  dawn**; `tryProc` applies **exactly one** template and returns it. The test
  (Step 2.3) pins that a single `beatFloorDawn()` never applies two templates.
- Register at import: `registerDeck({ id: 'events', tryProc: eventDeckTryProc })`.

**Registration order matters.** Register **ambitions first** (Item 1), then
events (Item 2), so an offer-due dawn spends the floor's single beat on the
(rare, important) ambition rather than a (common) event. Both `registerDeck`
calls run at import; ensure `js/main.js` (or wherever module import order is
fixed) imports `./ambitions.js` before `./events.js`, or state the order in a
comment at each register site. Note it in Step 2.2.

**State** (`js/state.js`): `eventsSeen: []` (once-per-run guard). Persist it.

**v0 content set (16 templates — proves the schema across cast, structures,
season, world, trade; a mix of reward-free "noticing" beats and small bounded
mechanical ones).** Flavor-only templates carry **no `effect`** (invariant-6
safe by construction); mechanical ones are `once` or two-sided (never a
farmable faucet):

*Cast-referencing (plan 012 state):*
1. `restless` — trigger: a present settler is `resolveBand(s)==='fraying'`.
   flavor: "{name} paces the palisade, sleep far off." No effect.
2. `spearless` — trigger: a settler whose want is `armed` and `!wantSatisfied`.
   flavor: "{name} keeps eyeing the empty weapon rack." No effect.
3. `scarred` — trigger: a present settler with `s.scars.length > 0`.
   flavor: "{name} goes quiet at dusk, old wounds remembering." No effect.
4. `mending` — trigger: a present settler with `wantSatisfied(s)`.
   flavor: "{name}'s wish is met — they hum through the work." No effect.
5. `medicpraise` — trigger: a `medic` role exists and `stats.recoveries > 0`.
   flavor: "The camp speaks warmly of the medic's steady hands." No effect.

*Structure/economy-referencing:*
6. `idleforge` — trigger: a `workshop` stands and `craftQueue` is empty.
   flavor: "The workshop sits cold — no orders on the bench." No effect.
7. `fulllarder` — trigger: `res.food + res.meals >= pop * BALANCE.pop.foodlowMult * 3`.
   flavor: "The larder is heavy; folk sleep the easier for it." No effect.
8. `cellar` — `once`, minDay 3. effect: `res.scrap += 3`.
   log: "Clearing old rubble uncovers a forgotten cellar. (+3 scrap)"
9. `peddler` — minDay 4, weight low. effect: `res.herbs += 2`.
   log: "A wandering peddler trades herbs for a night by the fire. (+2 herbs)"
   *(bounded: weighted draw, at most once/dawn — not a faucet.)*

*Season/world-referencing:*
10. `foragefind` — trigger: `season().id` is `summer`/`autumn`; weight low.
    effect: `res.food += rint(3,6)`. log: "Foragers hit a berry thicket."
11. `windstorm` — trigger: a flammable structure exists; `once`.
    effect: light hp damage to one random `tent`/`wall` tile (a *setback* beat).
    log: "A night gale claws at the roofs." *(two-sided — texture, not reward.)*
12. `chill` — trigger: `pop >= 4 && !raidActive`; minDay 6; weight low.
    effect: `-hp` to one present settler (a light wound, floored above downed).
    log: "A chill runs the camp; {name} takes to bed a day." *(negative.)*
13. `ruinrumor` — trigger: `G.world` exists and has `< maxLocs` sites; `once`.
    effect: `spawnLoc('ruins', true)` (`js/world.js`). log: "Travelers speak
    of a rich ruin to the north — scouts mark it." *(reveals a real site.)*

*Trader-referencing (plan 020's demand-memory):*
14. `fairname` — trigger: the player has traded this run (`stats.trades > 0` or
    a plan-020 flag); `once`. effect: set a per-run `G.traderFavor = true` flag
    the next caravan reads for a small stock bump. log: "Word of your fair
    dealing travels the roads." *(bounded, one caravan; if plan 020 exposes no
    such hook, ship this as flavor-only — drop the effect and keep the log.)*

*Pure atmosphere (always-eligible fillers so the pool is never empty):*
15. `hearthtale` — trigger: `usedNames.size > 0` or a campaign chronicle entry
    exists. flavor: "Round the fire, an elder tells of a commune now ash." No
    effect. *(references the campaign's own dead — GDD §3 memorial texture.)*
16. `quietwatch` — trigger: always. flavor: "The watch changes without
    incident; the treeline holds." No effect. *(the graceful floor filler.)*

**Balance** (`js/balance.js`, new `events:` block):
```js
events: {
  procChance: 0.6,   // dawns the event deck answers the floor (rest fall to 020's flavor fallback)
},
```

**Presentation scope for v0.** Every template resolves as a **logged beat with
an immediate, auto-applied effect** — no player choice. The schema leaves room
for a decision presentation (a `modal` field routed through the same
`G.*Offer` → `main.js` push pattern as Item 1), but v0 ships **none**; choice-
events wait until the arrivals (plan 013) and torchbearer (plan 014) decision
surfaces exist. State this so a reviewer doesn't read the absence as a miss.

## Commands you will need

| Purpose   | Command                                    | Expected on success |
|-----------|--------------------------------------------|---------------------|
| Install   | `pnpm install`                             | exit 0              |
| Tests     | `pnpm test`                                | all pass            |
| One file  | `pnpm vitest run test/ambitions.test.js`   | that file passes    |
| One file  | `pnpm vitest run test/events.test.js`      | that file passes    |
| Typecheck | `pnpm check`                               | exit 0              |
| Lint      | `pnpm lint`                                | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137         | manual check        |

Debug hooks: `window.G`, `window.ff(minutes)` (fast-forward) — see AGENTS.md.

## Scope

**In scope**:
- **Item 1**: `js/ambitions.js` (create), `js/data.js` (+`AMBITIONS` table),
  `js/balance.js` (+`ambition` block), `js/state.js` (+4 ambition fields,
  +`_ambBase`), `js/game.js` (`checkAmbitions()` beside `checkObjectives()`;
  one `elderCounsel` rule; barrel re-export of `activeAmbition` if the view
  needs it), `js/main.js` (+1 push line), the modal module (`+makeAmbitionModal`),
  `js/save.js` (persist ambition fields; bump), the small stat counters
  (`stats.recoveries`/`stats.rescues`) at their existing sites,
  `test/ambitions.test.js` (create), `test/balance.test.js` (+keys, +invariant-6
  gate), `test/save.test.js` (+round-trip/backfill).
- **Item 2**: `js/events.js` (create), `js/data.js` (+`EVENTS` table),
  `js/balance.js` (+`events` block), `js/state.js` (+`eventsSeen`), `js/save.js`
  (persist `eventsSeen`; folded into Item 1's bump if landed together, else its
  own additive field on the same version), `test/events.test.js` (create),
  `test/balance.test.js` (+keys, +invariant-6 gate for events).

**Out of scope** (do not touch):
- **The proc floor itself** (plan 020's `js/beats.js`) — this plan *registers*
  decks; it does not modify `beatFloorDawn`/`noteBeat`/the fallback. If the
  floor needs a change to consult decks the way this plan expects, that is a
  020 bug — **report it**, do not patch the floor here.
- **Choice/decision events** (a `modal` presentation) — deferred to plans
  013/014's decision surfaces; v0 events auto-resolve.
- **Arrivals** (plan 013) — `wanderers` reads `stats.rescues` from the existing
  world rescue only; this plan adds no arrival flow.
- **The onboarding `OBJECTIVES` table** — unchanged; ambitions are a parallel
  table, not an extension of the chain.
- **Cross-run persistence beyond an `unlock` string** — no ambition/event
  writes a number to `CAMPAIGN`; nothing here bumps `CAMPAIGN_VERSION`.
- Trader pricing, Menace, combat, work math — untouched.

## Git workflow

- **On `main`, no branch** (execution model). One commit per item-group, each
  with all three gates green. Imperative messages ("Add ambitions v0 — the
  Elder offers 1-of-2", "Add the event deck v0").
- Do NOT push or open a PR unless the operator instructed it.

---

## Item 1 — Ambitions v0

**GDD §8 (`GDD.md:326-328`), §9 invariants 1 & 6.** After the first horde the
Elder offers 1-of-2 ambitions; declining is free; ambitions are active,
qualitative pulls; only an `unlock` id string ever crosses runs.

### Steps

**Step 1.1 — `BALANCE.ambition` + `AMBITIONS` table + `js/state.js` fields.**
Add the `ambition` block to `js/balance.js`. Add the `AMBITIONS` table to
`js/data.js` per Design (the six v0 entries). Add `ambitionActive`,
`ambitionOffer`, `ambitionsSeen`, `lastAmbitionDay`, and `_ambBase: {}` to
`makeState()`. Add `recoveries: 0`, `rescues: 0` to the `stats` block if plan
012 did not already add `recoveries`. Do not wire anything yet.
**Verify**: `pnpm check && pnpm lint` → exit 0.

**Step 1.2 — feed the two stat counters.** Increment `G.stats.recoveries` where
a downed settler recovers (plan 012's downed-recovery site in `js/settlers.js`
— re-locate by symbol; if 012 already counts recoveries, reuse it and skip).
Increment `G.stats.rescues` at the world `survivors` rescue site
(`js/world.js`, the `loc.type === 'survivors'` branch that pushes a settler —
re-locate; it currently logs "Rescued {name} …"). One `g.stats.X++` each.
**Verify**: `pnpm test` → green (existing world/settler tests unaffected —
these are new counters nothing else reads yet).

**Step 1.3 — `js/ambitions.js`.** Create the module per Design:
`offerDue`, `pickOffer`, `activeAmbition`, `acceptAmbition`, `declineAmbition`,
`checkAmbitions`, `ambitionDeckTryProc`, and the import-time
`registerDeck({ id: 'ambitions', tryProc: ambitionDeckTryProc })`. JSDoc the
object params (`pnpm check` runs tsc over `js/`). Import `addPoints` from
`./meta.js`, `CAMPAIGN`/`saveCampaign` from `./campaign.js`, `registerDeck`/
`noteBeat` from `./beats.js`, `AMBITIONS` from `./data.js`, `BALANCE` from
`./balance.js`, `addLog` from `./journal.js`. **Do not import `./game.js`.**
**Verify**: `pnpm check && pnpm lint` → exit 0; `grep -n "from './game.js'" js/ambitions.js` → no hits.

**Step 1.4 — `test/ambitions.test.js` + the invariant-6 gate.** Stub-then-import
header; import `state.js`, `ambitions.js`, `data.js`, `balance.js`,
`campaign.js`, `beats.js`; `beforeEach`: `Object.assign(G, makeState())`, clear
`DECKS` (copy plan 020's `_resetDecks()`), `Object.assign(CAMPAIGN, makeCampaign())`.
Tests:
1. **Offer fires only post-first-horde**: with `G.stats.hordes = 0`,
   `ambitionDeckTryProc(G.day)` returns `null` and `G.ambitionOffer` stays
   `null`. Set `G.stats.hordes = 1` (and satisfy cooldown) → `tryProc` returns
   a truthy `{ kind: 'ambition' }`, `G.ambitionOffer.choices.length === 2`, and
   both choices are pushed to `G.ambitionsSeen`.
2. **Declining is penalty-free (the §8 review gate)**: after an offer,
   snapshot `G.res` and `META.points`; `declineAmbition()` → `G.ambitionOffer`
   is `null`, `G.ambitionActive` is `null`, and `G.res`/points are **unchanged**
   (no resource taken, no legacy lost). This must be a hard assertion.
3. **Accept → track → complete**: `acceptAmbition('raiders2')` sets
   `G.ambitionActive`; `checkAmbitions()` with `G.banditsCleared = 1` does
   nothing; with `= 2` it pays the reward + legacy, logs, clears
   `ambitionActive`, and adds the id to `ambitionsSeen`.
4. **`feast` baseline**: pre-set `G.stats.mealsCooked = 20`,
   `acceptAmbition('feast')` → `checkAmbitions()` does **not** complete (base
   stamped); raise `mealsCooked` by 6 → completes. (Pins the retroactive-
   completion guard.)
5. **`unlock` crosses as a string only**: `acceptAmbition('beacontide')`, set
   `G.beaconDay = 5`, `G.stats.winters = 0` → `checkAmbitions()` appends
   `'ambition-beacontide'` to `CAMPAIGN.unlocks` **exactly once** and it is a
   `string`; a second `checkAmbitions()` does not double-add.
6. **No re-offer of a seen id**: with all-but-one ambition in `ambitionsSeen`,
   `pickOffer` returns `< 2` and `offerDue` is `false` (no partial offer).
7. **Invariant-6 table gate** (the review gate, as code): for every entry in
   `AMBITIONS`, assert its `check`/`prog` source **does not** key on
   `settlers.length` as a bare headcount target and its `reward` (if any) is a
   fixed small-integer object with **no** headcount-scaled value. Implement as a
   scan over `AMBITIONS` (assert `reward` values are integers ≤ a small cap and
   `unlock` is a string or undefined) plus a source-text check
   (`Function.prototype.toString` on `check`) that trips if a future edit adds
   `settlers.length >=` or a `day >=` survival goal. Document that the
   *onboarding* `OBJECTIVES` are exempt (different table, tutorial).
**Verify**: `pnpm vitest run test/ambitions.test.js` → all pass.

**Step 1.5 — wire the tick, the Elder, the modal, the main loop, persistence.**
- `js/game.js`: after `checkObjectives()` at the objective hook
  (`js/game.js:273`), call `checkAmbitions()` (import from `./ambitions.js`).
  Add the active-ambition rule to `elderCounsel`'s `rules` array right after the
  onboarding rule (`js/game.js:211`), per Design. If the view needs it, add
  `export { activeAmbition } from './ambitions.js';` to the barrel.
- Modal module (`js/ui/modals.js` post-009): add `makeAmbitionModal()` mirroring
  `makeBeaconModal` — Elder-titled box, two `AMBITIONS` choices +"Not now",
  `pausesSim: true`, `Escape`/"Not now" → `declineAmbition(); pop()`, each
  choice → `acceptAmbition(id); pop()`.
- `js/main.js`: add beside the game-over push —
  `if (G.ambitionOffer && inStack('game') && !inStack('ambition')) push(makeAmbitionModal());`
  and import `makeAmbitionModal`.
- `js/save.js`: add `ambitionActive`, `ambitionOffer`, `ambitionsSeen`,
  `lastAmbitionDay`, `_ambBase` (and `eventsSeen` if Item 2 lands in the same
  commit) to the `toSaveData` destructure and returned object; bump
  `SAVE_VERSION` to current + 1; add a migrate step defaulting each
  (`ambitionActive: null`, `ambitionOffer: null`, `ambitionsSeen: []`,
  `lastAmbitionDay: 0`, `_ambBase: {}`).
- `test/save.test.js`: round-trip a run with `ambitionActive: 'raiders2'`,
  `ambitionsSeen: ['raiders2','feast']`; and an old-save backfill test (delete
  the fields, set an old `version`, reload, assert defaults).
**Verify**: `pnpm check && pnpm lint && pnpm test` → all green. Manual
(`pnpm dev`): `ff` a run past a broken horde to the next dawn → an ambition
modal appears offering two; press the "Not now" key → it closes, nothing is
taken, the run continues; reopen (`ff` past cooldown), accept one → the Elder
window shows it with an `(x/y)` counter; satisfy its `check` → a "◈ Ambition
fulfilled" log fires and the box clears.

**Commit checkpoint (item 1)**: "Add ambitions v0 — the Elder offers 1-of-2".

---

## Item 2 — The event deck v0

**GDD §4 (`GDD.md:240-242`), §10 (`GDD.md:362-366`), §9 invariants 6 & 8.**
15–25 legible beats gated on real cast/structure/season/world state, procced
through plan 020's floor, one at a time, no farmable windfalls.

### Steps

**Step 2.1 — `BALANCE.events` + `EVENTS` table + `js/state.js`.** Add the
`events` block. Add the `EVENTS` table (the 16 v0 templates per Design) to
`js/data.js` — each `{ id, weight, minDay?, once?, trigger, effect?, present }`
with pure `trigger`/`present` reading only `g`. Add `eventsSeen: []` to
`makeState()`.
**Verify**: `pnpm check && pnpm lint` → exit 0.

**Step 2.2 — `js/events.js`.** Create per Design: `eligible`, `weightedPick`,
`eventDeckTryProc`, and the import-time
`registerDeck({ id: 'events', tryProc: eventDeckTryProc })`. Import `chance`/
`rint` from `./rng.js`, `EVENTS` from `./data.js`, `BALANCE`, `addLog`/`notice`
from `./journal.js`, `registerDeck`/`noteBeat` from `./beats.js`, `spawnLoc`
from `./world.js`. **Do not import `./game.js`.** **Registration order**: ensure
`./ambitions.js` is imported before `./events.js` (so an ambition offer wins the
floor's single daily beat) — add a comment at the register site stating the
requirement and confirm the actual import order in whatever module first pulls
both (`js/main.js`'s import graph, or a dedicated `js/decks.js` bootstrap if
one is cleaner — but do not add a scheduler, only fix import order).
**Verify**: `pnpm check && pnpm lint` → exit 0;
`grep -n "from './game.js'" js/events.js` → no hits.

**Step 2.3 — `test/events.test.js`.** Stub-then-import header; import
`state.js`, `events.js`, `data.js`, `balance.js`, `beats.js`; `beforeEach`:
`Object.assign(G, makeState())`, clear `DECKS`, and monkeypatch
`BALANCE.events.procChance = 1` (restore after) so the deck always answers.
Tests:
1. **A template procs through the floor and applies its effect legibly**: set
   state so exactly one mechanical template is eligible (e.g. `cellar`: fresh
   run, `G.day = 3`), snapshot `G.res.scrap`, call `eventDeckTryProc(G.day)` →
   returns `{ kind: 'event', id: 'cellar' }`, `G.res.scrap` rose by 3, and the
   newest `G.log` line contains the template's text (spy `addLog` or read
   `G.log`). *(Effect applied + legible — the review requirement.)*
2. **No double-fire**: with several templates eligible, a single
   `eventDeckTryProc` call applies **exactly one** (assert only one net effect /
   one new log line, and `eventsSeen` grew by at most one). If the floor
   (`beatFloorDawn`) is available, call it once on an all-eligible state and
   assert one template fired, not two.
3. **`once` guard**: a `once` template in `G.eventsSeen` is not re-eligible;
   `eligible(G)` excludes it.
4. **Empty pool declines**: with `procChance = 1` but no template's `trigger`
   true (e.g. clear cast/structures and force day 1 with all `minDay`/triggers
   failing except pick a state where even `quietwatch` is gated off — or assert
   that with `quietwatch` always-on the pool is never empty and instead test
   that a `procChance = 0` monkeypatch returns `null`). Prefer the
   `procChance = 0 → null` form for determinism.
5. **Gating reads real state (plan 012)**: `spearless` is eligible **only**
   when a settler has an unsatisfied `armed` want (build the fixture with plan
   012's `assignWant`/`s.wants = ['armed']`, `s.weapon = false`), and not once
   `s.weapon = true`. Pins "gated on HP-2's structures".
6. **Invariant-6 gate for events**: scan `EVENTS`; assert no template's
   `effect` grants a headcount-scaled or unbounded resource (every `effect`
   that adds resources is `once` **or** adds a fixed small integer / a
   two-sided setback), and flavor-only templates have no `effect`. A source
   scan trip-wire like Step 1.4's.
**Verify**: `pnpm vitest run test/events.test.js` → all pass.

**Step 2.4 — persistence + balance keys.** If Item 2 lands in its own commit
(Item 1 already bumped `SAVE_VERSION`), add `eventsSeen` to `toSaveData` and a
same-version backfill (`d.eventsSeen = d.eventsSeen || []`) — no second bump is
needed since `loadGame`'s `Object.assign(G, makeState(), d)` backfills the
default; add a one-line save round-trip test for `eventsSeen` anyway. Extend
`test/balance.test.js` with key presence for `events` (and `ambition` from Item
1) and the two invariant-6 scans if not already there.
**Verify**: `pnpm check && pnpm lint && pnpm test` → all green. Manual
(`pnpm dev`): `ff` across several quiet days → legible event lines appear in the
log (a peddler, a restless settler, a ruin rumor that marks a world site);
confirm no two events fire on the same dawn; confirm a genuinely event-empty
dawn falls through to plan 020's flavor fallback (not a crash, not two beats).

**Commit checkpoint (item 2)**: "Add the event deck v0".

---

## Final step: update `plans/README.md`

Add (or set, if a row exists) this plan's row in the execution-order table:

```
| 021 | Ambitions v0 (Elder offers 1-of-2) + event deck v0 | HP0 content | P1 | M | 012, 020 | DONE |
```

Under "Dependency notes", add: this plan is **the primary consumer of plan
020's `registerDeck`/`noteBeat` floor** — both the ambition offer and the event
deck register there; it adds **no second scheduler**. Its only cross-run write
is an ambition's `unlock` **option-id string** into `CAMPAIGN.unlocks` (plan
010/020's convention); a later plan (HP-8 wagon camp / creeds) is the first
*reader* of `'ambition-beacontide'`. Note that choice/decision events are
deferred to the plan 013/014 decision surfaces.

**Verify**: `git diff plans/README.md` shows only the added row + the note.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/ambitions.test.js` (~7:
post-horde gate, penalty-free decline, accept→complete, feast baseline, unlock-
is-a-string, no re-offer, invariant-6 table gate), `test/events.test.js` (~6:
effect-applies-legibly, no-double-fire, once-guard, decline path, cast-gating,
invariant-6 gate), `test/balance.test.js` (+`ambition`/`events` key presence +
the two invariant-6 scans), `test/save.test.js` (+ambition round-trip/backfill,
+`eventsSeen` round-trip) — all green alongside the existing suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] **Item 1**: `js/ambitions.js` exists and `registerDeck`s the `ambitions`
      deck; an offer fires only when `G.stats.hordes >= 1`; `declineAmbition()`
      takes **nothing** (test #2 is a hard assertion); an accepted ambition
      tracks via `check` exactly like an objective and completes with reward/
      legacy; the active ambition shows in the Elder window through the reused
      `prog` render
- [ ] **Item 2**: `js/events.js` exists and `registerDeck`s the `events` deck;
      one `eventDeckTryProc` applies **exactly one** template (no double-fire);
      a template's effect applies and its line is legible in the log; gating
      reads real cast/structure state (plan 012)
- [ ] **Neither deck adds a dawn hook** — `grep -n "onDawn\|communeDawn\|beatFloorDawn" js/ambitions.js js/events.js` → no hits; both reach the day only through `registerDeck`
- [ ] **§9 invariant 6**: the table-scan gate passes — no ambition rewards raw
      headcount or survival/passivity; no event effect is an unbounded/
      headcount-scaled windfall
- [ ] **§9 invariant 1**: the only cross-run write is an ambition `unlock`
      **string** into `CAMPAIGN.unlocks`; `grep -n "CAMPAIGN" js/ambitions.js js/events.js` shows no numeric field written; nothing bumps `CAMPAIGN_VERSION`
- [ ] `SAVE_VERSION` bumped once (Item 1) with a migration step and test; old
      saves backfill the ambition/event fields
- [ ] `js/main.js` gains exactly one push line, mirroring the game-over push
- [ ] `plans/README.md` row added; `git status` shows only in-scope files
- [ ] Two commits, one per item-group, each with green gates

## STOP conditions

- **The registry interface differs from plan 020's excerpt** —
  `registerDeck`/`noteBeat` are absent, renamed, or `beatFloorDawn` no longer
  consults decks in registration order (020 landed differently): re-read
  `js/beats.js` as landed and re-derive both `tryProc` contracts; if the floor
  cannot host two decks without a change to `js/beats.js`, **report** — that is
  a 020 change, out of this plan's scope.
- **The cast helpers this plan gates on are missing** (`resolveBand`,
  `wantSatisfied`, `s.weapon`, the `medic` role) — plan 012 did not land or
  landed differently: the event templates that reference them have nothing to
  gate on; **report** and cut those templates rather than inventing state.
- **`CAMPAIGN.unlocks` or `BALANCE.campaign` is absent** (plan 010/020 not as
  described) — the `unlock` write has no target; **report**, and ship the
  ambition `unlock`-less rather than recreating the store.
- **You find yourself giving an ambition a `settlers.length >= N` or "survive
  to day N" goal, or an event a headcount-scaled/repeatable resource reward** —
  that violates §9 invariant 6. STOP; this is a design gate, not an
  implementation detail. Rewrite the goal as an active, qualitative pull.
- **You find yourself writing a number (not an option-id string) into
  `CAMPAIGN`, or carrying any ambition/event value across runs** — that
  violates §9 invariant 1 / GDD P5. STOP.
- **You are tempted to add a dawn/tick hook to fire events or offers directly**
  (a second scheduler) instead of registering with `js/beats.js` — that is
  explicitly forbidden (plan 020 is the scheduler). STOP and route through
  `registerDeck`.
- **A test outside this plan's files fails after a wiring step** — those
  characterize behavior this plan must not change; report, do not adjust them.

## Maintenance notes

- **Both decks are 020's tenants.** The floor in `js/beats.js` owns cadence;
  this plan owns content. Any future arrival deck (plan 013) registers the same
  way and shares the one-beat-per-dawn floor — mind registration order if a new
  deck should outrank events.
- **The invariant-6 table gate is a living constraint** (GDD §9.6): every new
  ambition or event added to `AMBITIONS`/`EVENTS` must keep the table-scan test
  green — active/qualitative pulls only, no headcount/passivity rewards, event
  effects bounded. The test scans the tables, so new rows are covered
  automatically.
- **Ambitions are per-run; only `unlock` crosses.** The `'ambition-beacontide'`
  option id is a placeholder that HP-8's wagon camp / creed slot should become
  the first *reader* of; until then it is written-but-unread by design, exactly
  as plan 010's store fields were. It remains a **string id, never a modifier**.
- **v0 events auto-resolve.** When the arrivals (013) and torchbearer (014)
  decision surfaces exist, extend the `EVENTS` schema with a `modal`
  presentation routed through a `G.*Offer` flag + a `main.js` push (the pattern
  Item 1 establishes for ambitions) — the schema was shaped to allow it without
  a rewrite.
- **The `feast`-style baseline pattern** (measuring a counter delta from
  acceptance, not an absolute) is how any future "do X, starting now" ambition
  avoids retroactive completion. Keep `_ambBase` for that; do not read absolute
  `stats.*` totals in a delta ambition's `check`.
</content>
</invoke>
