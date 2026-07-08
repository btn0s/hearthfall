# Plan 012: The cast, v2 (HP-2) — per-person resolve bands, wants, scars, medic, per-person weapons

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Execution model**: plans run **sequentially, on `main`, in numeric order**;
> by the time this plan executes, **009 (screens split), 010 (campaign store),
> and 011 (menace) have landed**. That means: (a) the sidebar no longer lives
> in `js/screens.js` — draw code moved to `js/ui/sidebar.js` and the game
> screen's `widgets()` stayed in `js/screens.js` (plan 009); (b) `js/campaign.js`
> exists and band members round-trip through it (plan 010); (c) `SAVE_VERSION`
> is already `2` and `migrate()` already has a `v1→v2` block (plan 011). Every
> code excerpt below is anchored at commit `14fd915` (this plan's baseline,
> **before** 009-011). **Re-locate every cited site by symbol name**, not by
> line number — 009 moved the sidebar and 011 inserted a menace row, so line
> numbers will have drifted.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/settlers.js js/data.js js/balance.js js/state.js js/save.js js/dawn.js js/game.js js/journal.js js/campaign.js js/ui/sidebar.js js/screens.js test/`
> If `js/settlers.js`, `js/save.js`, `js/campaign.js`, or `js/balance.js`
> changed, re-read them fully before starting — this plan adds fields to the
> settler record, bumps the save version, and edits the campaign store's
> `toBandMember`. If a `js/cast.js` already exists, STOP (someone started HP-2
> already).

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (touches the settler record shape, the tick loop, the
  save/campaign persistence boundary, and the sidebar; introduces a new
  person-state system that partially supersedes global morale)
- **Depends on**: 009 (sidebar split — landed), 010 (campaign store; band
  member shape `{ id, name, trait, wants, scars, age }` — landed), 011 (save
  is at v2 — landed)
- **Category**: feature
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP-2 (`ROADMAP.md:116`, Milestone HP0) · GDD §5, §2 (P1/P7)

## Why this matters

The v1 playable exists to test one hypothesis — "does a persistent, mortal,
aging band whose settlements die make players found the next settlement?"
(`GDD.md:368-369`). That hypothesis stands on the cast being **people, not
units**: irreplaceable (P1, `GDD.md:60-69`), legible (P7, `GDD.md:163-176`),
and carrying history that is *felt* but never *powerful* (P5, `GDD.md:129-147`).
Today the build has none of it — Appendix B is blunt: "**morale is one global
scalar**; weapons are a pooled index; … no draft, no arrivals-as-choices"
(`GDD.md:472-473`). Global morale is named as the anti-pattern this milestone
replaces (`GDD.md:470`).

This plan lands the §5 cast (`GDD.md:244-274`) at v1 scope:

- **Resolve**, per-person, shown as three **named bands** — Steady / Fraying /
  Breaking — never a 0–100 scalar (P7, `GDD.md:169-173`; §5, `GDD.md:252-254`).
  v1 inputs: food, sleep, deaths witnessed, and wants.
- **Wants** (one, visible): satisfiable, with resolve teeth (`GDD.md:250-251`).
- **Scars** (append-only, cosmetic-narrative, cross-campaign, `GDD.md:263-264`)
  — "the attachment ledger and the cheapest system in the game."
- **Medic**, the 4th role (`GDD.md:246`).
- **Bonds & grudges** at v1 scope: **display + resolve-damage-on-partner-death
  only** — no adjacency buffs, no cooperation refusal (`GDD.md:258-262`, the
  O(n²) branch bomb the feasibility attack defused).
- **Breaks** (refusals, desertions) that in v1 **never fire mid-raid**
  (`GDD.md:255-257`, the untested-state bomb).
- **Equipment**: one assignable weapon slot per person (`GDD.md:265-267`),
  replacing today's pooled `G.res.weapons` index.
- Global morale becomes a **displayed aggregate** of per-person resolve.

**The binding invariant, and this plan's central review gate — GDD P5 /
§9.1(1) (`GDD.md:129-147`, `GDD.md:343`)**: *what crosses between settlements
is history, never stats.* Scars, wants, bonds, age — all **zero-modifier**.
The falsifier is explicit: "veterans measurably outperform recruits with
identical trait/equipment (history leaked power)" (`GDD.md:144-145`). Every
cross-campaign field this plan adds must be inert to combat, economy, and work
math. If any step tempts you to let a scar count buff a number, STOP — that is
a design gate, not an implementation detail.

## Current state

All excerpts verified at `14fd915`; re-locate by symbol after 009-011.
Vanilla-JS browser game; vitest; all tuning in `js/balance.js` (plan 008);
house rules in `AGENTS.md` (per-minute scan caches, `G` singleton, versioned
saves, sim modules import directly / view modules via the `game.js` barrel).

### The settler record — `js/settlers.js:33-38` (`makeSettler`)

```js
return {
  id: G.nextId++, name, x, y, role, trait,
  hp: maxHp, maxHp, hunger: rint(15, 35), energy: rint(60, 95),
  sleeping: false, away: false, starving: false, downed: false,
  task: null, path: null, pathGoal: null, pathAge: 0, atkcd: 0, bedIdx: -1, failCd: 0,
};
```

No `resolve`, `wants`, `scars`, `weapon`, `bond`, or `grudge`. `trait` is one
of `Object.keys(TRAITS)` (`js/data.js:108-119`). Settlers are serialized
**wholesale** in the save (`js/save.js:16` includes `settlers`), so new
per-settler fields persist automatically on save/load — the only persistence
work is a `migrate()` backfill for old saves (Step 6).

### The weapon index being replaced — `js/settlers.js:51-55`

```js
export function weaponBonus(s) {
  const guards = G.settlers.filter(x => x.role === 'guard');
  const i = guards.indexOf(s);
  return i >= 0 && i < G.res.weapons ? 2 : 0;
}
```

Called once, in the melee branch of `tickSettler` (`js/settlers.js:419`).
`G.res.weapons` is the pooled count; it is incremented when a spear is forged
(`js/settlers.js:246`) and when a warlord falls (`js/settlers.js:314`), and
seeded at founding (`js/game.js:461`, `js/game.js:457-459` via `civ.start`).
Under this plan `G.res.weapons` becomes the **unassigned pool**; a person's
`s.weapon` boolean is the slot, and `weaponBonus` reads the slot.

### Roles — `js/data.js:97-99`

```js
export const ROLE_ORDER = ['worker', 'farmer', 'guard'];
export const ROLE_COLORS = { worker: '#d8d2c0', farmer: '#79c258', guard: '#57b8d8' };
export const ROLE_LETTER = { worker: 'W', farmer: 'F', guard: 'G' };
```

Job priorities per role live in `PRI` (`js/settlers.js:155-158`); `findJob`
returns `null` for `guard` (`js/settlers.js:161`) — guards fight, they don't
take jobs. `cycleRole` (`js/settlers.js:481-486`) walks `ROLE_ORDER`.
Guard combat/behavior is the `if (G.raidActive || G.alarm)` block and the
adjacent-foe block (`js/settlers.js:413-455`).

### Death, downed, and the morale plumbing to mirror

- `killSettler` (`js/settlers.js:325-331`): removes the settler, bumps global
  morale `'a death'`, and calls `communeFallen()` if the band is empty. **This
  is where "deaths witnessed" hooks in** — the surviving present settlers, and
  the dead's bond/grudge holder, take resolve here.
- `woundSettler` downed→recover path (`js/settlers.js:335-347`, recovery at
  `js/settlers.js:390-393`): where a "survived a wound" scar is earned.
- `bumpMorale` / `moraleLabel` (`js/journal.js:6-30`) and `moraleWhy`
  (`js/game.js:40-52`) are the exact pattern the resolve plumbing copies:
  clamp, append a capped `{ day, why, n }` ledger, render recent causes.
  The morale meter is a sidebar click-widget → `notice(moraleWhy())`
  (`js/screens.js:302-305`, moved to the game screen's `widgets()` by 009 but
  still in `js/screens.js`).
- Global morale is drawn as a bar + `moraleLabel()` in `drawSidebar`
  (`js/screens.js:466-470`, moved to `js/ui/sidebar.js` by 009). Settler rows
  are drawn at `js/screens.js:522-535` (also now in `js/ui/sidebar.js`).

### The desertion path that moves onto resolve — `js/game.js:127-138`

```js
if (G.morale < BALANCE.morale.desertMax && pop >= BALANCE.recruit.desertMinPop && chance(BALANCE.recruit.desertChance)) {
  const cands = settlersPresent();
  if (cands.length) {
    const s = choice(cands);
    const food = Math.min(G.res.food, BALANCE.recruit.desertFoodMax), coin = Math.min(G.res.coin, BALANCE.recruit.desertCoinMax);
    G.res.food -= food; G.res.coin -= coin;
    releaseTask(s);
    G.settlers = G.settlers.filter(x => x !== s);
    addLog(`☹ ${s.name} deserted in the night…`, '#e08040');
    if (!G.settlers.length) { communeFallen(); return; }
  }
}
```

This runs inside `communeDawn` (`js/game.js:109-162`) — i.e. **at dawn, never
mid-raid** already. It is keyed on global morale; this plan re-keys the *break*
(desertion **and** the new refusal) on per-person **Breaking** resolve, keeping
the dawn-only timing (§5, `GDD.md:255-257`).

### The dawn pipeline and the tick — where resolve is sampled/applied

- `onDawn()` (`js/dawn.js:7-13`): `communeDawn()` → (011 inserts
  `menaceDawn()`) → `worldDawn()` → `save()`. The new `castDawn()` runs here,
  after `communeDawn()` (so a death or desertion in `communeDawn` is reflected)
  and before `save()`.
- `tickSettler` (`js/settlers.js:349-475`): hunger/eat at `:374-383`, the
  sleeping-rough morale bump at `:407` (where a per-settler `roughNight` flag
  is set), the downed-recovery at `:390-393`, melee at `:413-422`.

### The campaign store's `toBandMember` — `js/campaign.js` (created by plan 010)

Plan 010 shipped (Step 1 of `plans/010-campaign-store.md`):

```js
export const BAND_MEMBER_FIELDS = ['id', 'name', 'trait', 'wants', 'scars', 'age'];
function toBandMember(s) {
  return { id: CAMPAIGN.nextId++, name: s.name, trait: s.trait, wants: [], scars: [], age: 0 };
}
```

`wants`/`scars` are defaulted to `[]` **because HP-2 had not landed**. Plan
010's own STOP note anticipates this exact overlap (`plans/010-campaign-store.md:485-488`):
once settlers carry `wants`/`scars`, `toBandMember` must **copy** them. That
edit is Step 6 here. The band-member **shape does not change** (still those six
fields) and `CAMPAIGN_VERSION` does **not** bump — only the copy semantics.

### Save shape — `js/save.js` (at v2 after plan 011)

`SAVE_VERSION` is `2`; `toSaveData` serializes `settlers` wholesale;
`migrate()` has a `v0` block and (from 011) a `v1→v2` block. New per-settler
fields ride along in `settlers` automatically; this plan adds `SAVE_VERSION = 3`
and a `v2→v3` block that backfills the new fields onto pre-v3 settlers.

### The test net to extend

- `test/combat-economy.test.js:1-14` — the header pattern: stub
  `localStorage`/`performance` **before** dynamic import; `grassTiles()` /
  `baseSettler()` helpers; `resetMeta()`. Copy this header for `test/cast.test.js`.
- `test/combat-economy.test.js` already exercises `woundSettler`/`tickSettler`
  — those tests build settlers with `baseSettler()`; **after this plan they must
  still pass**, so `makeSettler`'s new fields must have safe defaults and the
  tick must not assume they exist on hand-rolled fixtures (guard with `?.`/`||`).
- `test/save.test.js:15-70` — round-trip + `v1` migration patterns; extend with
  a `v2→v3` backfill test.
- `test/campaign.test.js` (from 010) — the P5 shape-whitelist gate
  (`plans/010-campaign-store.md:341-346`); extend it to prove `wants`/`scars`
  now **carry through** while nothing else does.

## Design (decided here, executed below)

### Resolve — a small integer, a named band

Per-person `s.resolve` is a **small integer** on a 0–`resolveMax` scale
(default 0–12), seeded at `resolveStart`. It is **never displayed as a number**
— `resolveBand(s)` maps it to `'steady' | 'fraying' | 'breaking'` via two
thresholds, and only the band (label + colour) ever reaches the screen (P7 /
§9.1(8), `GDD.md:358`). This is exactly the morale pattern (scalar internal,
label external) but honest about scale: a 0–12 integer, not a 0–100 bar.

`bumpResolve(s, delta, why)` clamps to `[0, resolveMax]` and appends a capped
`{ day, who, why, n }` entry to a run-level `G.resolveEvents` ledger (cap
`resolveEventCap`, shift like `moraleEvents`) — the data behind `resolveWhy()`.

**Inputs (all small-integer deltas, all in `BALANCE.cast`):**

| Input | When | Delta |
|---|---|---|
| Fed well | `castDawn`: present, not starving, ate a meal overnight | `+fedRegen` |
| Hungry | `castDawn`: `s.starving` | `−hungerDrain` |
| Rested | `castDawn`: slept under a roof last night (`!s.roughNight`) | `+restRegen` |
| Slept rough | `castDawn`: `s.roughNight` | `−roughDrain` |
| Want satisfied | `castDawn`: `wantSatisfied(s)` | `+wantRegen` |
| Want denied | `castDawn`: denied ≥ `wantDeniedGraceDays` running | `−wantDrain` |
| Death witnessed | `killSettler`: each present survivor | `−deathWitnessed` |
| Bond partner died | `killSettler`: the dead's bond holder | `−bondPartnerDeath` |
| Grudge partner died | `killSettler`: the dead's grudge holder | `+grudgePartnerRelief` |

Note the deliberate omissions per §5/P5: **scars are NOT an input** (they are
inert display — this is the veteran-parity gate; a scarred survivor and a fresh
recruit with the same trait have identical resolve dynamics). **Age is NOT read
here** (HP-8's governor). Resolve is **run-scoped**: it resets each settlement
(a fresh `makeSettler`) and is **not** a band-member field — it never crosses
runs, so it can never be the number a veteran "keeps."

### Breaks — Breaking only, dawn only, never mid-raid

In `castDawn` (which runs at dawn, and guards on `!G.raidActive`): for each
present settler whose band is `'breaking'`, roll `breakChance`. A break is one
of two **dramatic, legible** events (§5, `GDD.md:255-256`):

- **Refusal** (default): `s.refusing = true` for the day — `findJob` returns
  `null` while refusing (they sulk by the fire); cleared next dawn if the band
  climbed back out of Breaking. Zero economic *modifier* — just this one
  person, today, visibly not working.
- **Desertion** (only if `pop > breakDesertMinPop`, so the last few never
  desert): the existing desertion body (food/coin taken, settler removed,
  `communeFallen()` if empty) — **moved verbatim** from `communeDawn` to here,
  re-keyed off Breaking resolve instead of global morale.

Mid-raid breaks are **out of scope for v1** (`GDD.md:256-257`) — `castDawn`
early-returns if `G.raidActive`, and nothing else triggers a break.

### Wants — one each, satisfiable, with teeth

`WANTS` (new table in `js/data.js`) is a small set of **qualitative,
decision-bending** preferences, each a narrative label + a pure predicate over
`(s, G)`. They must **not** reward raw headcount or raw passivity (§9.1(6),
`GDD.md:355-356`) — so no "wants a big commune" want. v1 set:

- `fed` — "wants a hot meal": satisfied when `G.res.meals >= 1` at dawn.
- `sheltered` — "wants a roof": satisfied when the settler has a bed
  (`s.bedIdx >= 0`).
- `armed` — "wants a spear": satisfied when `s.weapon` is true.
- `purpose` — "wants useful work": satisfied when the settler held a task
  yesterday (a `s.workedRecently` flag set in `execTask`).
- `peace` — "wants a quiet night": satisfied when no death occurred last night
  and no raid is imminent (`G.raidNext > G.day`).

Each settler gets exactly one want (`s.wants = [id]`, an array of one to match
the store shape). `castDawn` evaluates it: satisfied → `+wantRegen`, reset
`s.wantDenied = 0`; else `s.wantDenied++`, and once `wantDenied >=
wantDeniedGraceDays`, `−wantDrain` each further dawn. Because **every** person
has exactly one want, wants create dilemmas ("who gets the one spear / the last
roofed bed") without advantaging veterans — parity holds.

> **Design tension to surface to the operator (review gate, not a blocker)**:
> GDD §5's *resolve* bullet parenthetically defers wants-as-input to vLater
> ("wants/bonds as inputs arrive vLater", `GDD.md:253-254`), while §5's *wants*
> bullet gives them resolve teeth outright ("Denied-for-days drains; satisfied
> regenerates", `GDD.md:250-251`) and the roadmap HP-2 line
> (`ROADMAP.md:116`) lists visible wants as in-scope. This plan follows the
> wants bullet + roadmap: **wants have teeth at v1**. Bonds-as-input stays
> minimal (death-damage only, below). If the operator wants the stricter §5
> reading (wants display-only at v1), cut the two want lines from `castDawn` —
> the want field, table, and display still ship. Flag which reading was chosen
> in the PR.

### Scars — append-only, cosmetic, cross-campaign, inert

`SCARS` (new table in `js/data.js`): narrative labels keyed by id. `addScar(s,
id)` pushes `{ id, day }` to `s.scars`, **deduped by id** (a person accrues
distinct scars; the array stays bounded by the table size). v1 triggers:

- `wounded` — "a bad wound": on recovery from downed (`js/settlers.js:390-393`).
- `grief` — "lost someone": on a bond partner's death (in `killSettler`).
- `survivor` — "held the line": on a horde being broken while present.

Scars are **display only** — nothing reads them for any number. They copy to
the band member (Step 6) and thus cross settlements (P5, `GDD.md:263-264`).
This is the veteran-parity gate's other half: `grep` must show `s.scars` /
`.scars` read **only** by display and `addScar`, never by combat/work/economy.

### Bonds & grudges — display + resolve-on-partner-death only

`s.bond` / `s.grudge` are **run-scoped** settler ids (`null` by default). Max
one of each per person. Formation is a **low-rate `castDawn` event** among
co-present pairs lacking that link (one bond and/or one grudge formed per dawn
at most — O(n) scan, not O(n²)): pick two random present bandmates, link them.
On a death (`killSettler`), the dead's bond holder takes `−bondPartnerDeath`
resolve and a `grief` scar; the grudge holder takes `+grudgePartnerRelief`.
**No adjacency buff, no cooperation refusal, no combat/work interaction** —
that is the O(n²) branch bomb held out of v1 (`GDD.md:258-262`). Bonds/grudges
reference per-run ids, so they are **not** band-member fields and do **not**
cross settlements. (They round-trip within a run via normal settler
serialization.)

### Medic — the 4th role

Add `'medic'` to `ROLE_ORDER` / `ROLE_COLORS` (`#68c088`) / `ROLE_LETTER`
(`'M'`). A medic's verb is **treat/stabilize** (§5, `GDD.md:246`), handled as a
tick branch (like guard combat), not the job pipeline:

- `medicTarget()` — nearest present `downed` settler, else nearest present
  wounded settler with `hp < medicTreatThreshold` (a per-minute-cached scan,
  `postCache` pattern).
- If a target exists: move adjacent (`moveToward(..., { adjacent: true })`) and,
  when adjacent, heal `+medicTreatHeal`/tick; if the target is below
  `combat.medThreshold` **and** `G.res.meds > 0`, consume one med for
  `combat.medHeal` (medic makes the kit go further). A downed target adjacent to
  a medic also recovers at `+medicStabilize` (on top of its base `downHeal`).
- No target: medic falls back to worker-style jobs (give `PRI.medic` a worker
  profile so `findJob` still returns useful tasks — brewing meds `craft` first).

This is zero-modifier to *the world* — it only moves the commune's own hp/meds
around faster. Medic is a **role choice** (re-chosen each settlement); role does
not cross runs (P5).

### Global morale → displayed aggregate

`resolveAggregate()` (pure over `G.settlers`) returns
`{ band, counts: { steady, fraying, breaking } }` — `band` is `'breaking'` if
any present settler is Breaking, else `'fraying'` if fraying outnumber steady,
else `'steady'`. The **sidebar's morale row is replaced** by this aggregate
(Step 8): the headline the player reads is now derived from per-person resolve,
retiring the global-scalar readout the GDD names as the anti-pattern
(`GDD.md:470`).

**Scope boundary (stated so it is not accidentally widened)**: the internal
`G.morale` scalar is **retained mechanically** at v1 — it still drives the work
multiplier (`moraleWorkMult`, `js/journal.js:28-30`), recruit eligibility
(`js/game.js:91-96`), and drift-to-base (`js/game.js:276-281`). Only its
**display** and the **desertion trigger** move onto resolve here. Fully
dissolving the `G.morale` scalar into a pure function of resolve is a balance
re-tune (work/recruit gates), **deferred** — flagged in a maintenance note.
This keeps the blast radius survivable while satisfying the literal HP-2
instruction (displayed morale = resolve aggregate).

### New module `js/cast.js` (imports: `state.js`, `balance.js`, `data.js`,
`journal.js`, `run-end.js` — all cycle-safe)

`js/cast.js` must **not** import `js/settlers.js` (settlers imports cast → an
avoidable cycle). It inlines the trivial `present = s => !s.away && !s.downed`
predicate instead of importing `settlerActive`. `run-end.js` (which `cast.js`
needs for `communeFallen` on the last desertion) imports only
state/journal/meta/save/campaign — no edge back to `cast.js`, so this is
one-way. Exports:

- pure: `resolveBand(s)`, `resolveLabel(band)`, `resolveAggregate()`,
  `wantSatisfied(s)`, `wantLabel(s)`.
- impure: `bumpResolve(s, n, why)`, `resolveWhy()`, `witnessDeath(dead)`,
  `addScar(s, id)`, `assignWant(s)`, `castDawn()`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Install   | `pnpm install`                       | exit 0              |
| Tests     | `pnpm test`                          | all pass            |
| One file  | `pnpm vitest run test/cast.test.js`  | that file passes    |
| Typecheck | `pnpm check`                         | exit 0              |
| Lint      | `pnpm lint`                          | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137   | manual check, Step 9 |

Debug hooks: `window.G`, `window.ff(minutes)` (fast-forward) — see `AGENTS.md`.

## Scope

**In scope**:
- `js/cast.js` (create), `test/cast.test.js` (create)
- `js/balance.js` — add the `cast` block
- `js/data.js` — `medic` role rows; `WANTS`, `SCARS` tables
- `js/settlers.js` — `makeSettler` new fields; per-person weapon slot
  (`weaponBonus` rewrite); medic tick branch + `PRI.medic`; `castDawn` hooks in
  `killSettler`/downed-recovery/`execTask`/rough-sleep; `cycleRole` covers 4 roles
- `js/game.js` — remove the morale-keyed desertion body (moves to `castDawn`);
  `newGame` auto-assigns starting weapons to guards; barrel re-export of the
  cast display helpers
- `js/dawn.js` — call `castDawn()`
- `js/journal.js`/`js/game.js` — resolve display helpers reachable by the view
- `js/campaign.js` — `toBandMember` copies `wants`/`scars` (010 overlap)
- `js/save.js` — `SAVE_VERSION = 3` + `v2→v3` migration
- `js/ui/sidebar.js` (post-009) — resolve aggregate row + per-settler band;
  `js/screens.js` (post-009) — resolve click-widget; weapon/role assignment UI
- `test/save.test.js`, `test/campaign.test.js` — extend
- `plans/README.md` — status row

**Out of scope** (do not touch / defer):
- Bond/grudge **teeth** (adjacency, refusal-to-cooperate) — vLater
  (`GDD.md:261-262`).
- Mid-raid breaks — vLater (`GDD.md:256-257`).
- Weapon **depth** (armor, tools, durability, drop-and-recover-from-a-corpse) —
  vLater (`GDD.md:265-267`); on death the weapon returns to the pool.
- Retiring the `G.morale` scalar's mechanical roles (work mult, recruit gate) —
  deferred re-tune.
- Aging / age as a resolve or power input — HP-8.
- Arrivals as decisions (drafting a persisted band member into a new settler,
  reading `CAMPAIGN.band`) — HP-3/plan 013; this plan only makes the store
  *carry* wants/scars, it adds no reader.
- Any change that lets a cross-campaign field modify a number (P5 gate).

## Git workflow

- Branch: this batch executes on `main` (see execution model). Commit per step
  with imperative messages ("Add the resolve/wants/scars cast module").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `BALANCE.cast` + `js/data.js` tables (tables first, so tests pin them)

In `js/balance.js`, add a `cast:` block after `raid:`/`beacon:` in the file's
terse comment style. Starting numbers (executor: re-derive the two invariants
below before trusting them):

```js
cast: {
  resolveMax: 12, resolveStart: 8,
  steadyMin: 7,       // resolve >= steadyMin → Steady
  breakingMax: 3,     // resolve <= breakingMax → Breaking; between → Fraying
  resolveEventCap: 8, resolveWhyWindow: 2,
  // dawn resolve deltas (small integers)
  fedRegen: 1, hungerDrain: 2, restRegen: 1, roughDrain: 1,
  wantRegen: 1, wantDrain: 1, wantDeniedGraceDays: 3,
  // death-driven (applied immediately in killSettler)
  deathWitnessed: 2, bondPartnerDeath: 4, grudgePartnerRelief: 1,
  // breaks (dawn only, Breaking only)
  breakChance: 0.5, breakDesertMinPop: 3,
  desertFoodMax: 5, desertCoinMax: 3,      // moved from BALANCE.recruit's desert keys
  // bond/grudge formation (low-rate dawn event, O(n))
  bondChance: 0.12, grudgeChance: 0.06,
  // medic
  medicTreatThreshold: 12, medicTreatHeal: 0.4, medicStabilize: 0.02,
},
```

Reuse existing `combat.weaponBonus` (=2), `combat.medThreshold`,
`combat.medHeal`, `combat.downHeal` — do **not** duplicate them into `cast`.
Leave `BALANCE.recruit.desertMinPop`/`desertChance`/`desertFoodMax`/
`desertCoinMax` in place for now (the desertion body reads the new `cast`
copies; prune the old keys only if `grep` shows no other reader — likely a
follow-up, not this plan).

In `js/data.js`:

- Extend the three role tables with `medic` (`ROLE_LETTER.medic = 'M'`,
  `ROLE_COLORS.medic = '#68c088'`, append `'medic'` to `ROLE_ORDER`).
- Add `WANTS` — `{ id: { label, want, check(s, G) } }` for the five ids in
  Design; `check` is pure and reads only `s` and `G`.
- Add `SCARS` — `{ id: { label } }` for `wounded`/`grief`/`survivor`.

Extend `test/balance.test.js` with a `describe('BALANCE.cast')`:
1. `breakingMax < steadyMin` and both in `[0, resolveMax]` (bands are ordered
   and non-empty).
2. Every dawn delta and death delta is a **positive integer** (small-integer
   invariant, §9.1(8); the sign is applied at the call site).
3. `resolveStart` lands in the **Fraying-or-better** range
   (`resolveStart >= breakingMax + 1`) so a fresh commune doesn't open at
   Breaking.

**Verify**: `pnpm vitest run test/balance.test.js` → pass; `pnpm check && pnpm lint` → exit 0.

### Step 2: `js/cast.js` + settler fields

Create `js/cast.js` per the Design section. Keep the pure functions
(`resolveBand`, `resolveLabel`, `resolveAggregate`, `wantSatisfied`,
`wantLabel`) free of side effects so Step 7 can unit-test them on literals.
`bumpResolve` mirrors `bumpMorale` (`js/journal.js:6-12`): clamp `[0,
resolveMax]`, append `{ day: G.day, who: s.id, why, n }` to `G.resolveEvents`,
cap at `resolveEventCap`. `castDawn()` early-returns if `G.raidActive`, then per
present settler applies the food/sleep/want deltas, clears `s.roughNight` /
`s.workedRecently`, runs the break roll for Breaking members (refusal or the
moved desertion body), and finally the low-rate bond/grudge formation.
`witnessDeath(dead)` applies `deathWitnessed` to present survivors and the
bond/grudge deltas + `grief` scar. JSDoc-annotate any object params (`pnpm
check` runs tsc over `js/`).

In `js/settlers.js`, extend `makeSettler`'s record (`js/settlers.js:33-38`)
with safe defaults:

```js
resolve: BALANCE.cast.resolveStart, wants: [], wantDenied: 0,
scars: [], weapon: false, bond: null, grudge: null,
roughNight: false, workedRecently: false, refusing: false,
```

and call `assignWant(s)` (from `cast.js`) before returning, so a fresh settler
has exactly one want. Import what you need from `./cast.js`; **do not** import
`settlers.js` from `cast.js` (cycle — see Design).

In `js/state.js` `makeState()`, add `resolveEvents: []` next to `moraleEvents`
(`js/state.js:16`) — the run-level resolve ledger.

**Verify**: `pnpm check && pnpm lint && pnpm test` → green. Existing
`test/combat-economy.test.js` builds settlers with `baseSettler()` (no new
fields); confirm the tick still runs — the medic branch and any new read must
guard missing fields (`s.scars || []`, `s.resolve ?? …`). If a
combat-economy test fails, a tick path assumed a field the fixture lacks —
fix the guard, do **not** edit the test.

### Step 3: per-person weapon slot

Rewrite `weaponBonus` (`js/settlers.js:51-55`):

```js
export function weaponBonus(s) { return s.weapon ? BALANCE.combat.weaponBonus : 0; }
```

`G.res.weapons` is now the **unassigned pool**. Add an `assignWeapon(s)` /
`unassignWeapon(s)` pair (in `js/settlers.js`, exported): assign moves one from
the pool onto the slot (`if (!s.weapon && G.res.weapons > 0) { s.weapon = true;
G.res.weapons--; }`), unassign returns it. In `killSettler`
(`js/settlers.js:325-331`), if `s.weapon` return it to the pool
(`G.res.weapons++`) before removing the settler (v1: recovered automatically;
corpse-recovery-by-a-volunteer is vLater). In `newGame` (`js/game.js:463-470`),
after settlers are created, auto-assign the starting weapons to guards so the
opening feels as it does today: `for (const s of G.settlers) { if (s.role ===
'guard') assignWeapon(s); }` (drains `G.res.weapons`, which was just seeded at
`js/game.js:461` and `:457-459`).

**Verify**: `pnpm test` → green (the `test/combat-economy.test.js` melee tests
build fixtures with explicit `s.weapon` if they assert the bonus — update those
fixtures to set `weapon: true` **only where they were relying on the pooled
index**, and document why in the test; if none did, no test change is needed).
`grep -n "res.weapons" js/` shows the pool is read/written only at: the
forge (`settlers.js`), warlord spoils (`settlers.js`), founding seed
(`game.js`), `assignWeapon`/`unassignWeapon`, `killSettler` return, and the
sidebar resource line.

### Step 4: medic role + tick branch

Add `PRI.medic` (a worker-shaped profile that puts `craft` — brewing meds —
first). In `tickSettler`, add a `medic` branch **before** the generic
job/idle tail (after the raid/guard block, near `js/settlers.js:456-474`):
if `s.role === 'medic'`, call `medicTarget()`; if a target exists, move
adjacent and heal per the Design (consume a med below `combat.medThreshold`
when `G.res.meds > 0`; add `medicStabilize` to an adjacent downed target's
recovery); if no target, fall through to the normal `findJob`/`execTask` path.
`medicTarget()` uses a per-minute cache (`postCache` pattern,
`js/settlers.js:113-131`). Make sure a `medic` is **not** excluded by
`findJob`'s `if (s.role === 'guard') return null` guard (it isn't — only guard
is excluded).

`cycleRole` (`js/settlers.js:481-486`) already walks `ROLE_ORDER`, so adding
`'medic'` there makes it cyclable for free — no code change beyond the
`ROLE_ORDER` edit in Step 1.

**Verify**: `pnpm test` → green. Add the medic unit test in Step 7. Manual
check deferred to Step 9.

### Step 5: wire `castDawn` + move desertion off morale

- `js/dawn.js`: import `castDawn` and call it in `onDawn()` **after**
  `communeDawn()` and (if 011 landed) after `menaceDawn()`, before
  `worldDawn()`/`save()`:

  ```js
  communeDawn();
  if (!G.gameOver) {
    castDawn();
    if (!G.gameOver) { menaceDawn(); worldDawn(); save(); }
  }
  ```

  (Guard the tail on `!G.gameOver` — a last-settler desertion inside `castDawn`
  can end the run; do not `worldDawn`/`save` a dead run.)
- `js/game.js`: **delete** the morale-keyed desertion body from `communeDawn`
  (`js/game.js:127-138`) — the whole `if (G.morale < …desertMax …)` block. It
  now lives in `castDawn`, keyed on Breaking resolve. Leave the
  `if (G.morale < BALANCE.morale.low) tip('morale')` line (`js/game.js:126`)
  alone (it is a tip, not a break). Confirm `settlersPresent`, `releaseTask`,
  `communeFallen`, `choice` end up imported where they are now used (`cast.js`
  vs `game.js`) and unused imports are pruned from `game.js`.

**Verify**: `pnpm test` → green. `grep -n "desertMax" js/` should show the
desertion condition **only** where you placed it (`cast.js`), not in
`game.js`. `pnpm dev`, then in console `ff` a starving low-resolve commune to
dawn and watch for a refusal/desertion log; then confirm one cannot fire
mid-raid (breaks are dawn-only — see Step 9).

### Step 6: campaign store carries wants/scars (the 010 overlap)

In `js/campaign.js`, change `toBandMember` to **copy** the now-present fields
(the shape and `BAND_MEMBER_FIELDS` are unchanged — plan 010 already whitelists
`wants`/`scars`):

```js
function toBandMember(s) {
  return {
    id: CAMPAIGN.nextId++, name: s.name, trait: s.trait,
    wants: [...(s.wants || [])], scars: [...(s.scars || [])], age: 0,
  };
}
```

`CAMPAIGN_VERSION` does **not** change (no shape change). Extend
`test/campaign.test.js`'s P5 gate test (`plans/010-campaign-store.md:341-346`):
give the source settler `wants: ['fed']`, `scars: [{ id: 'grief', day: 3 }]`,
**and** the usual run-only junk (`resolve`, `weapon`, `bond`, `hp`, `role`,
position); after `writeRunToCampaign({ win: true })`, assert the written
member's keys still equal `BAND_MEMBER_FIELDS` (nothing leaked), **and** its
`wants`/`scars` deep-equal the source (history crossed), **and** `resolve`,
`weapon`, `bond`, `role`, `hp` are absent (stats did not).

**Verify**: `pnpm vitest run test/campaign.test.js` → pass (old + new);
`pnpm test` → green.

### Step 7: persistence — `SAVE_VERSION = 3` + `v2→v3` migration

In `js/save.js`:
- `SAVE_VERSION = 3`.
- `migrate()`: after the `v1→v2` block (from 011), add:

  ```js
  if (d.version < 3) {
    for (const s of d.settlers || []) {
      if (s.resolve === undefined) s.resolve = BALANCE.cast.resolveStart;
      if (!Array.isArray(s.wants)) s.wants = [];
      if (!Array.isArray(s.scars)) s.scars = [];
      if (s.weapon === undefined) s.weapon = false;
      if (s.bond === undefined) s.bond = null;
      if (s.grudge === undefined) s.grudge = null;
      s.wantDenied = s.wantDenied || 0;
      s.roughNight = false; s.workedRecently = false; s.refusing = false;
    }
    d.resolveEvents = d.resolveEvents || [];
    d.version = SAVE_VERSION;
  }
  ```

  `save.js` gains `import { BALANCE } from './balance.js';` if not already
  present (011 may have added it — cycle-safe either way). An old settler
  migrated forward has **no want** (`wants: []`); that is fine — `castDawn`
  skips want evaluation when `s.wants` is empty, and a re-founding (HP-3) is
  where persisted wants seed new settlers. Do **not** assign a random want in
  migration (that would fabricate history).

Extend `test/save.test.js`:
1. **Round-trip**: a settler with `resolve: 4`, `wants: ['armed']`,
   `scars: [{ id: 'wounded', day: 2 }]`, `weapon: true`, `bond: 2` survives
   `save()`/`loadGame()` intact; `G.resolveEvents` round-trips.
2. **v2→v3 backfill**: write a `save()`, edit raw JSON to `raw.version = 2` and
   `delete` the new settler fields, re-store, `loadGame()`, assert the settler
   now has `resolve === BALANCE.cast.resolveStart`, `wants` `[]`, `scars` `[]`,
   `weapon === false`, `bond === null`, and `G.resolveEvents` `[]`.

**Verify**: `pnpm vitest run test/save.test.js` → pass; `pnpm test` → green.

### Step 8: `test/cast.test.js` — the cast under test

Create with the `test/combat-economy.test.js:1-14` header (stub
localStorage/performance before dynamic import), importing `state.js`,
`cast.js`, `settlers.js`, `balance.js`, `data.js`; `beforeEach`:
`Object.assign(G, makeState()); G.tiles = grassTiles();`. Tests:

1. **Bands + aggregate (pure)**: `resolveBand` maps `resolveMax`→steady,
   `breakingMax`→breaking, a mid value→fraying; `resolveAggregate()` on a mixed
   band returns `'breaking'` if any present member is Breaking, else the
   fraying/steady majority rule; away/downed members are excluded correctly.
2. **`bumpResolve` ledger**: clamps at `[0, resolveMax]`, appends a `{ who, why,
   n }` entry, caps at `resolveEventCap`; `resolveWhy()` names the newest cause.
3. **Dawn food/sleep**: a present, starving settler loses `hungerDrain`; a fed
   settler (`meals >= 1`, not starving) gains `fedRegen`; `roughNight` drains,
   a roofed night regens; flags reset after `castDawn`.
4. **Wants teeth**: an unsatisfied want increments `wantDenied` and, past
   `wantDeniedGraceDays`, drains; satisfying it regens and resets the counter;
   a settler with `wants: []` is untouched (migration case).
5. **Deaths witnessed + bond/grudge**: `witnessDeath(dead)` drains each present
   survivor by `deathWitnessed`; the dead's bond holder takes
   `bondPartnerDeath` **and** gains a `grief` scar (deduped on repeat); the
   grudge holder gains `grudgePartnerRelief`.
6. **Breaks are Breaking-only and dawn-only**: a Breaking settler at dawn can
   refuse (`refusing === true`, `findJob` then returns `null`) or, with
   `pop > breakDesertMinPop`, desert (removed, food/coin taken); **set
   `G.raidActive = true` and assert `castDawn()` triggers no break** (mid-raid
   guard). A Steady settler never breaks.
7. **Scars are inert (P5 gate)**: build two settlers identical but for scars
   (one with three `scars`, one with none); assert `weaponBonus`,
   `resolveBand`, and a `tickSettler` work outcome are **identical** — history
   carries no power. (This is the veteran-parity falsifier as a test,
   `GDD.md:144-145`.)
8. **Medic**: a `medic` adjacent to a `downed` settler raises its hp faster than
   the base `downHeal` (stabilize); a medic with a wounded target below
   `medicTreatThreshold` heals it and consumes a med when below `medThreshold`.
9. **Per-person weapon**: `assignWeapon` moves one from the pool to the slot and
   `weaponBonus` returns `combat.weaponBonus`; `killSettler` returns it to the
   pool; assigning with an empty pool is a no-op.

**Verify**: `pnpm vitest run test/cast.test.js` → all pass; `pnpm test` → full
suite green.

### Step 9: UI — resolve aggregate, per-person band, assignment (post-009)

All UI edits target the **post-009** files; find the sites by symbol.

- `js/game.js` barrel: re-export the view-facing cast helpers next to the other
  re-exports (`js/game.js:14`-ish): `export { resolveAggregate, resolveWhy,
  resolveBand, resolveLabel, wantLabel } from './cast.js';` (view modules import
  through the barrel, house rule).
- `js/ui/sidebar.js` `drawSidebar` (was `js/screens.js:466-470`): **replace**
  the global-morale bar/label with the resolve aggregate — e.g.
  `const ra = resolveAggregate();` then a row
  `Resolve <label>  ●steady ◐fraying ○breaking` counts, coloured by band
  (steady `#8ad080`, fraying `#e0c060`, breaking `#e05040`). Keep it to the one
  fixed row the morale line occupied so `sidebarLayout()` geometry is unchanged.
- `js/ui/sidebar.js` settler rows (was `js/screens.js:522-535`): append each
  present settler's resolve band as a compact glyph/colour and a spear mark
  (`†` when `s.weapon`), within the existing row width — do not add a row per
  settler (P7: twelve cards are a board; keep the list compressed,
  `GDD.md:165-168`).
- `js/screens.js` game-screen `widgets()` (was `js/screens.js:302-305`, the
  morale click-widget): repoint the sidebar-row-4 widget's `onClick` to
  `notice(resolveWhy() || 'The band is steady — nothing weighs on them.')`.
  Add to the per-settler row widget (was `js/screens.js:306-312`) a **second**
  interaction for assignment: keep left-click cycling role (`cycleRole`), and
  add weapon assignment — simplest v1: a modifier or a small on-row toggle that
  calls `assignWeapon`/`unassignWeapon`. If the input framework has no
  clean second click, defer weapon assignment to a **person card** opened from
  the row (a small modal in `js/ui/modals.js`) showing name/trait/role/want/
  resolve band/scars with an "assign spear" action — this is the
  notification-driven "full detail only for a person in a decision" surface
  (P7, `GDD.md:165-167`). Pick one; document the choice.

**Verify**:
- `pnpm check && pnpm lint && pnpm test` → all green.
- Manual (`pnpm dev`): new run → sidebar shows the **Resolve** aggregate row
  (not a 0–100 morale bar); each settler row shows a band colour and a spear
  mark on armed members; click the resolve row → notice lists who is fraying/
  breaking and why; click a name → role cycles (and the assignment affordance
  works). `ff` a commune into hunger → bands slide toward Fraying/Breaking →
  at a dawn, a refusal or desertion log appears; trigger a raid and confirm
  **no** break fires mid-raid. Make one settler a **medic** (cycle role) and
  down another in a raid → the medic moves to them and they recover faster.
  Both renderers (Esc → Graphics toggle) show the same sidebar. Any rendering
  or input regression vs. the pre-plan sidebar: STOP.

### Step 10: `plans/README.md` + maintenance notes

Add (or update, if a sibling added it) the row:

```
| 012 | The cast, v2 — resolve bands, wants, scars, medic, per-person weapons | HP-2 | P1 | L | 009, 010, 011 | DONE |
```

Under "Dependency notes", record that HP-3 (arrivals) and HP-8 (aging) are the
first **readers** of the persisted `wants`/`scars` this plan writes, and that
the `G.morale` scalar's mechanical retirement and mid-raid breaks are the
deliberate v1 deferrals.

**Verify**: `pnpm check && pnpm lint && pnpm test` all exit 0; `git status`
shows only in-scope files; `git diff plans/README.md` is the status row only.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/cast.test.js` ~9 tests
(bands/aggregate, ledger, dawn food/sleep, wants, deaths+bonds, breaks-dawn-
only, scars-inert P5 gate, medic, weapon slot); `test/balance.test.js` +3
(band ordering, integer deltas, start band); `test/save.test.js` +2
(round-trip, v2→v3 backfill); `test/campaign.test.js` +extended P5 gate;
`test/combat-economy.test.js` unchanged except fixture guards — all green
alongside the existing suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/cast.js` exists; resolve is displayed **only** as a band —
      `grep -rn "resolve" js/ui/ js/screens.js` shows no raw `G.*resolve`
      number printed, only `resolveBand`/`resolveLabel`/`resolveAggregate`
- [ ] Breaks fire only from `castDawn` and only for Breaking members —
      `grep -n "refusing\|desert" js/` shows the trigger only in `js/cast.js`,
      and `castDawn` early-returns on `G.raidActive`
- [ ] Global morale readout is the resolve aggregate — the sidebar no longer
      draws a 0–100 morale bar
- [ ] `weaponBonus` reads `s.weapon`, not a pooled index —
      `grep -n "guards.indexOf" js/settlers.js` → no hits
- [ ] `medic` is in `ROLE_ORDER`; `cycleRole` reaches all four roles
- [ ] `SAVE_VERSION === 3` with a `v2→v3` backfill test
- [ ] `toBandMember` copies `wants`/`scars`; the P5 gate test proves nothing
      else crosses and scars/wants do
- [ ] **P5 review gate**: `grep -rn "\.scars" js/` shows scars read only by
      display and `addScar`; no scar/want/bond/age value feeds any combat,
      economy, work, or yield number (Step 8 test #7 passes)
- [ ] `plans/README.md` row added/updated

## STOP conditions

- Any excerpt in "Current state" no longer matches after 009-011 landed
  (drift) — re-ground every cited symbol before proceeding; if `makeSettler`,
  `killSettler`, `save.js migrate`, or `campaign.js toBandMember` differ
  materially from the excerpts, re-derive the edit and report.
- A test in `test/combat-economy.test.js`, `test/save.test.js`, or
  `test/campaign.test.js` fails for a reason other than a fixture missing a new
  field — those characterize behavior this plan must not silently change;
  report, do not adjust the old assertions.
- You find yourself letting a **scar, want, bond, or age** value change any
  combat/economy/work/yield number — that violates GDD P5/§9.1(1)
  (`GDD.md:129-147`, `GDD.md:343`). STOP; this is the design gate, not an
  implementation detail.
- A break can fire **mid-raid** (the `G.raidActive` guard in `castDawn` is
  missing or bypassable) — that is the untested-state bomb the feasibility
  attack defused (`GDD.md:256-257`). STOP.
- Bond/grudge logic grows an **adjacency or cooperation** branch (O(n²)) —
  v1 is display + death-damage only (`GDD.md:258-262`). STOP.
- An import cycle appears (`pnpm check`/Vite complains): `cast.js` must import
  only `state`/`balance`/`data`/`journal`/`run-end`; if a hook forces a
  `settlers.js` import into `cast.js`, inline the predicate instead of
  inverting the dependency — if you can't, report.
- Retiring the `G.morale` scalar's mechanical roles (work mult, recruit gate)
  turns out to be unavoidable to make the display swap work — that is a
  balance re-tune out of this plan's scope; report the coupling rather than
  re-tuning silently.

## Maintenance notes

- **The P5 veteran-parity gate is a living constraint**: any future field that
  crosses settlements (HP-8 adds heirs/memories) must keep Step 8 test #7
  green — identical-but-for-history settlers must perform identically. That is
  the falsifier as code (`GDD.md:144-145`).
- **Wants-as-input is the one place this plan reads the GDD generously** (the
  §5 resolve bullet defers it, the §5 wants bullet ships it — see the Design
  tension note). If playtests say wants-teeth is too punishing at v1, the
  cut is the two want lines in `castDawn`; the field/table/display stay.
- **Deferred deliberately**: mid-raid breaks (return only after the interaction
  is test-covered, `GDD.md:256-257`); bond/grudge teeth (`GDD.md:261-262`);
  weapon depth and corpse-recovery (`GDD.md:265-267`); the `G.morale` scalar's
  full retirement into a resolve function; aging (HP-8).
- **HP-3 (arrivals)** is the first reader of persisted `wants`/`scars`: drafting
  a `CAMPAIGN.band` member into a new `makeSettler` seeds `s.wants`/`s.scars`
  from the stored member instead of `assignWant`/`[]`. The store already
  carries them after this plan; the draft is plan 013.
- If `BALANCE.recruit`'s desert keys end up unread after Step 5, prune them in
  a follow-up (they were left in place here to keep this diff additive).
