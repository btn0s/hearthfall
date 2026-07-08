# Plan 016: Endings as standing offers — Last Stand & the Torch (HP-7)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` (Step 9).
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/run-end.js js/meta.js js/campaign.js js/game.js js/state.js js/forecasts.js js/settlers.js js/world.js js/balance.js js/screens.js js/ui/ test/`
> Every excerpt below is anchored at commit `14fd915`; by the time this plan
> runs, plans **009–015 have landed on main** and moved code. Do not trust a
> line number — **re-locate every splice point by symbol name** (function or
> export), then confirm the surrounding code still matches the excerpt's
> shape before editing. In particular: 009 split the modals into
> `js/ui/modals.js` (the game-over modal now lives there, not in
> `js/screens.js`); 010 shipped `js/campaign.js` and rewired `js/run-end.js`
> to write survivors before `clearSave()`; 012 gave settlers per-person
> `resolve`/`wants`/`scars`. If `js/run-end.js` no longer calls
> `writeRunToCampaign(...)` between `endRun(...)` and `clearSave()` in both
> endings, or `js/campaign.js` has no `writeRunToCampaign({ win, survivors })`
> export, **STOP** — plan 010 is this plan's write path and its shape is a
> hard precondition (read `plans/010-campaign-store.md`, especially the
> `survivors` extension point built for HP-7).

## Status

- **Priority**: P1
- **Effort**: M-L
- **Risk**: MEDIUM (new player-facing ending flow + a splice into the shared
  run-end/scoring path; additive — existing falls/ascension unchanged, new
  scoring branches gated behind opts the current callers never pass)
- **Depends on**: **010** (its `writeRunToCampaign({ win, survivors })` is the
  Torch's write path — the `survivors` parameter was built for this plan);
  009 (game-over modal now in `js/ui/modals.js`) and 012 (per-person
  `wants`/`scars` the survivors carry) have landed by execution order but are
  not gates
- **Category**: feature
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP-7 (Milestone HP0) · GDD §2 P8 (`GDD.md:178-190`), §9
  invariant 2 (`GDD.md:344-347`), Appendix A "Last Stand farm FATAL"
  (`GDD.md:416-418, 430-432`)

## Why this matters

Today a settlement's death is a single hard-coded event with no player agency:
`communeFallen()` fires only when `G.settlers` is already empty
(`js/settlers.js:330`, `js/world.js:202`, `js/game.js:136`), and the game-over
modal is force-pushed the next frame (`js/main.js:59`). The player watches the
last person die; they do not *choose* an ending. GDD v2 P8 rewrites this after
the adversarial review found the v1 hard-coded fast collapse fatal on two
counts:

- **Genre (F7, `GDD.md:430-432`)**: "DF's beloved slow doomed-fort sagas" —
  the narratable decline is the treasure, and its duration belongs to the
  player, not a death check.
- **Systems ("Last Stand farm FATAL", `GDD.md:416-418`)**: v1 paid
  *compensation* for death until dying was profitable (P6, `GDD.md:149-161`).

So HP-7 makes collapse into two **standing offers**, available from the moment
collapse threatens and remaining open however long the player fights the
decline (P8, `GDD.md:178-183`):

- **Last Stand** — call everything down tonight; die famous; feats are
  honored (the memorial, not a bribe).
- **The Torch** — leave now; the player picks who walks out, and *they and
  only they* continue the campaign (written through plan 010's
  `writeRunToCampaign({ win: false, survivors })`).

Three invariants govern this plan and are **review gates**, encoded as tests,
not prose (mirroring plan 011's published-inequality tests):

1. **§9 invariant 2, the "always" clause (`GDD.md:346-347`)**: *Last Stand
   expected legacy < Beacon-attempt expected legacy, from the same board
   state — always.* Shipped as an executable inequality over `BALANCE` +
   the win bonus, structurally guaranteed (Last Stand is the fallback branch
   of a Beacon attempt, so it can never dominate).
2. **§9 invariant 2, self-induced clause (`GDD.md:344-346`)**: self-induced
   collapse forfeits feat payouts. The plan defines **detectable proxies
   honestly** and biases toward *honoring* the loss (a false forfeit punishes
   real tragedy — the worse error under P6).
3. **P6 (`GDD.md:156-159`)**: the mechanical value of any death is strictly
   less than the value of that person alive — the Torch pays nothing *for* a
   death; a survivor is worth a continued band member, a death is worth zero.

## Current state

All excerpts verified at `14fd915`. Vanilla-JS browser game; vitest; all
tuning in `js/balance.js` (plan 008); persistence conventions in plan 010.

### The two endings today — `js/run-end.js` (25 lines, read in full)

At `14fd915` this file is pre-010; plan 010 splices `writeRunToCampaign(...)`
between the `endRun` bookkeeping and `clearSave()` in **both** functions
(`plans/010-campaign-store.md` Step 3). Re-read the post-010 file before
editing. The `14fd915` shape:

```js
// js/run-end.js:6-14
export function communeFallen() {
  if (G.gameOver) return;
  G.gameOver = true;
  addLog('The commune has fallen.', '#e05040');
  G.stats.bandits = G.banditsCleared;
  const r = endRun(G.stats, G.day, { win: false });
  G.legacyEarned = r.pts; G.bonusLines = r.bonuses;
  clearSave();
}
```

`communeAscended()` (`js/run-end.js:16-24`) is the same shape plus
`G.victory = true` and `{ win: true }`. `communeFallen()` takes **no
arguments** and all three call sites invoke it bare:

- `js/settlers.js:330` (`killSettler` — last person dies at home);
- `js/world.js:202` (expedition wipe — every fielded member lost abroad);
- `js/game.js:136` (`communeDawn` — last person deserts overnight).

All three fire only when `G.settlers` is already empty. **This plan adds two
*player-initiated* endings that fire while people are still alive**, so the
"empty commune" precondition does not hold for them.

### The scorer — `js/meta.js:50-71` (feats live here, not in BALANCE)

```js
// js/meta.js:50-71
export function endRun(stats, days, opts = {}) {
  let pts = Math.max(1, days + 2 * stats.raids + 2 * stats.sites + Math.floor(stats.peak / 2) + Math.floor(stats.kills / 3));
  const bonuses = [];
  const feat = (cond, label, n) => { if (cond) { bonuses.push([label, n]); pts += n; } };
  feat((stats.winters || 0) >= 1, 'endured winter', 3 * (stats.winters || 0));
  feat((stats.hordes || 0) >= 1, 'broke a horde', 4 * (stats.hordes || 0));
  feat((stats.warlords || 0) >= 1, 'slew a warlord', 3 * (stats.warlords || 0));
  feat((stats.bandits || 0) >= 3, 'scourge of bandits', 3);
  feat(stats.peak >= 12, 'a true commune', 3);
  feat(opts.win, 'THE BEACON HELD', 25);
  if (hasPerk('ledger')) pts = Math.round(pts * 1.25);
  META.points += pts;
  META.runs++;
  META.bestDays = Math.max(META.bestDays, days);
  if (opts.win) META.wins++;
  META.life.days += days; META.life.raids += stats.raids;
  META.life.sites += stats.sites; META.life.kills += stats.kills;
  saveMeta();
  return { pts, bonuses };
}
```

The win bonus **25** is a magic literal here; the EV inequality (Step 3) needs
it single-sourced, and the self-induced forfeit (Step 2) needs a scoring path
that drops the feats. Both come from a small behavior-preserving extraction in
Step 2. `test/meta.test.js` characterizes this exactly (`test/meta.test.js:21-62`):
base formula `= 30`, feat stack `= 52` with five named bonuses, win `= 26`,
ledger `= 33`, floor `= 1`. **These must pass unmodified** — the extraction
is a review gate.

### Where collapse is detectable — the honest signal inventory

The plan grounds "collapse threatens" only in state `js/game.js` /
`js/run-end.js` can actually read:

- **The hearth**: the founding hearth is the `campfire` tile placed at the
  camp (`js/game.js:454`, `set(0, 0, 'campfire')`). It can burn down (fire
  spreads, `js/fire.js`) or be cancelled by the player (`js/game.js:387-389`).
  Detectable proxy: `!G.tiles.some(tl => tl.t === 'campfire')` mid-run — **a
  cold hearth**. (Limitation: raiders cannot currently target the campfire —
  they bash walls, `js/raiders.js:35-45` — so this proxy fires on fire/player
  action only. Noted, not fabricated.)
- **Population**: `settlerActive = (s) => !s.away && !s.downed`
  (`js/settlers.js:14`). Detectable: active count `≤ BALANCE.endings.dwindleAt`
  — **a dwindling commune** (the current fall waits for zero; the *threat*
  fires earlier).
- **Food exhausted**: `foodInfo()` (`js/forecasts.js:38-49`) returns
  `{ perDay, days, stock, winterNeed }`. Detectable: `stock ≤ BALANCE.endings.starveStock`
  **and** `days < BALANCE.endings.starveDays` — **an empty larder** with no
  runway. `foodInfo` already backs the Elder's starvation counsel
  (`js/game.js:222`), so it is trusted UI-grade signal.

These are the only three; the plan claims no more. **What state cannot
honestly detect is *intent*** — see the self-induced discussion in Design.

### The write path this consumes — plan 010's `survivors` extension point

Post-010, `js/campaign.js` exports
`writeRunToCampaign({ win, survivors })` (`plans/010-campaign-store.md`
Step 1). `survivors` defaults to `win ? G.settlers : []`; passing an explicit
list is **exactly** the Torch's hook (010's Maintenance note: "HP-7 extends
`writeRunToCampaign(...)` by passing the Torch's chosen survivor list — the
parameter exists for it"). `toBandMember(s)` copies `name`/`trait` and (post-012)
must copy `wants`/`scars` — 010's STOP condition already flags this; verify
it before relying on the survivor record.

### The game-over modal — post-009 `js/ui/modals.js` (`14fd915`: `js/screens.js:1062-1099`)

```js
// js/screens.js:1068-1084 (moves verbatim to js/ui/modals.js in plan 009)
draw() {
  const win = G.victory;
  const feats = G.bonusLines || [];
  ...
  if (win) { str(x0 + 2, y, '☼ THE BEACON HELD — VICTORY', '#ffe060', bg); ... }
  else { str(x0 + 2, y, 'THE COMMUNE HAS FALLEN', '#ff5040', bg); ... }
```

The modal branches on `G.victory` only — a two-way split (win / fall). HP-7
needs a four-way epitaph (victory / fall / **Last Stand** / **Torch**), so the
plan adds a small `G.ending` tag read here. It is force-pushed by
`js/main.js:59` (`G.gameOver && inStack('game') && !inStack('gameover')`) — an
ending that sets `G.gameOver` routes here unchanged.

### The pause menu — where the offers surface (post-009 `js/ui/modals.js`)

`makePauseMenu()` (`14fd915`: `js/screens.js:797-821`) is the always-reachable
menu; it is the natural, low-collision home for a conditional "End the
settlement…" entry (the game-screen keymap is dense — `b/t/m/g/w/r/e/?` are
taken, `js/game.js:474`). The sidebar (post-009 `js/ui/sidebar.js`, the
plan-005 fixed-grid block) announces that offers are open.

### The test net to extend

- `test/meta.test.js:21-62` — `endRun` characterization (see above); the
  extraction in Step 2 must leave every assertion green.
- `test/meta.test.js:96-129` — run-end idempotence (`communeFallen`/
  `communeAscended` pay once); the `G.gameOver` guard is what protects them,
  and the new endings share it.
- `test/campaign.test.js` (plan 010) — the survivor-write and P5 shape-whitelist
  patterns the Torch reuses; copy its stub-then-import header for the new file.
- Header pattern: stub `localStorage`/`performance` before dynamic import
  (`test/meta.test.js:3-9`).

## Design (decided here, executed below)

### New module `js/endings.js` (imports: `state`, `balance`, `meta`, `forecasts` — cycle-safe)

The **pure/derived** side (no orchestration — mirrors `js/menace.js`'s pure
core; `js/run-end.js` owns the imperative wiring):

```js
// collapse detection — derived every call, never stored (like tonightInfo)
collapseThreat() → { threatened, causes }
  causes: [] , push honest proxies (Current state → signal inventory):
    - 'the hearth is cold'      if G.tiles && !G.tiles.some(tl => tl.t === 'campfire')
    - 'the commune is dwindling' if activeCount(G) <= E.dwindleAt
    - 'the larder is empty'      if foodInfo().stock <= E.starveStock && foodInfo().days < E.starveDays
  threatened = !G.gameOver && !!G.tiles && causes.length > 0
```

```js
// --- the §9.2 EV inequality, exported so it is CODE, not test-local arithmetic ---
// Structural guarantee (document in the module): Last Stand is the (1−p)
// fallback branch of a Beacon attempt — you can always Last-Stand LATER — so
// its legacy can never exceed the attempt's EV as long as the win bonus > 0.
lastStandLegacy(stats, day)  = scoreRun(stats, day, { win: false }).pts   // feats honored, no win bonus
beaconAttemptEV(stats, day)  = lastStandLegacy(stats, day) + E.beaconWinPMin * WIN_LEGACY_BONUS
                               // conservative LOWER bound: the real EV is ≥ this
                               // (attempting also accrues extra days, and the
                               //  losing branch may still Last-Stand for ≥ base)
// Invariant test asserts:  lastStandLegacy(b) < beaconAttemptEV(b)  for every board b.
// Strict because E.beaconWinPMin > 0 and WIN_LEGACY_BONUS > 0.

// --- P6: value of death < value alive (memorial, not compensation) ---
valueOfDeath()  = E.torchDeathValue   // 0 — no legacy/resource/feat is paid FOR a death
valueOfAlive()  = E.torchAliveValue   // +1 — a survivor continues the campaign (one band member)
// Invariant test asserts:  valueOfDeath() < valueOfAlive().

// --- self-induced collapse: honest proxies, bias to HONOR ---
isSelfInduced() → boolean
  true only on HIGH-CONFIDENCE proxies:
    - a Last Stand called while collapseThreat().threatened === false
      (an engineered death to farm 'die famous' feats — the §9.2 case), OR
    - G.endingCause === 'expedition' AND the home commune was healthy when it
      fell (had a standing hearth AND foodInfo().stock > E.starveStock) — the
      "suicide expedition" of GDD.md:345.
  false otherwise.
  CANNOT be detected honestly (documented, NOT flagged — bias to honor per P6):
    intent behind a legitimate-looking loss (under-defending a real raid,
    slow-walking a genuinely doomed larder). The design never reads intent;
    it flags only structural proxies, and prefers a missed catch to a false
    forfeit (a false forfeit punishes real tragedy — the P6 sting-test error).
```

`scoreRun(stats, days, opts)` is a **pure** scorer extracted from `endRun` in
Step 2 (Current state → the scorer): same feat table, no `META` mutation.
`endRun` becomes `const { pts, bonuses } = scoreRun(...)` plus its existing
`META` writes — behavior-preserving, so `test/meta.test.js:21-62` stays green.
`scoreRun` gains one branch: `if (opts.selfInduced) skip all feat(...)` (base
`pts` only, `bonuses = []`) — the forfeit. Current callers never pass
`selfInduced`, so default behavior is identical.

### The imperative side — `js/run-end.js` (alongside the existing endings)

```js
// communeFallen gains an opts bag; the three existing bare call sites are
// unaffected (opts = {} → today's behavior, but now tagged as a passive fall).
communeFallen(opts = {})   // { ending = 'fall', survivors = [], selfInduced = <derive> }

// NEW, player-initiated (fire while settlers are still alive):
lastStand()          // ending 'laststand'; die famous, feats honored UNLESS isSelfInduced();
                     //   writeRunToCampaign({ win: false, survivors: [] })  → a ruin, no survivors
torch(survivorIds)   // ending 'torch'; the chosen walk out and continue the campaign;
                     //   writeRunToCampaign({ win: false, survivors: <the chosen settlers> })
```

Both new endings: set `G.gameOver`/`G.ending`, `addLog` the epitaph, call
`endRun(G.stats, G.day, { win: false, selfInduced })`, then
`writeRunToCampaign(...)` **before** `clearSave()` — the same ordering plan 010
made binding (survivors reach the campaign before the run save dies;
`GDD.md:377-379`). The `G.gameOver` guard at the top makes them idempotent,
exactly like `communeFallen`.

`selfInduced` is resolved via `isSelfInduced()` at the call and passed to
`endRun` so the forfeit is single-sourced. A Last Stand is never a win, so the
win bonus never reaches a forfeit path — the forfeit only zeroes the *earned*
feats (winter/horde/warlord/etc.), which is the §9.2 intent.

### State additions — `js/state.js` `makeState()` (additive)

```js
ending: null,       // 'victory' | 'fall' | 'laststand' | 'torch' — set by the ending, read by the game-over modal
endingCause: null,  // proximate cause tag for self-induced detection: 'raid'|'starved'|'fire'|'expedition'|'laststand'
```

`endingCause` is stamped at the three `communeFallen` call sites (Step 4) so
`isSelfInduced` can tell an expedition wipe from a home raid. It is run-scoped
UI/scoring state, not campaign history — it never enters `js/campaign.js` (P5).

### Starting numbers (`BALANCE.endings`, Step 1) and why they satisfy the invariants

```js
endings: {
  dwindleAt: 2,       // active settlers ≤ this ⇒ 'dwindling' (fall fires at 0; threat fires earlier)
  starveStock: 4,     // food stock ≤ this ⇒ larder exhausted (≈ hunger.cookMinFood)
  starveDays: 1,      // AND < 1 day of runway ⇒ 'empty larder'
  beaconWinPMin: 0.05,// conservative floor on P(hold the Beacon) once attempting — MUST be > 0
  torchAliveValue: 1, // a survivor continues the campaign: +1 band member
  torchDeathValue: 0, // a death pays no legacy/resource/feat — memorial, not compensation
},
```

Hand-checked (executor: re-derive before trusting):

- **§9.2 "always" (Last Stand < Beacon attempt)**: for *any* board,
  `beaconAttemptEV − lastStandLegacy = beaconWinPMin · WIN_LEGACY_BONUS
  = 0.05 · 25 = 1.25 > 0`. Strict for every board because both factors are
  positive constants — this is why the inequality holds *always*, not just
  typically. The `ledger` perk (`js/meta.js:60`) scales *both* sides by 1.25,
  preserving strictness.
- **P6 (death < alive)**: `torchDeathValue = 0 < 1 = torchAliveValue`. No
  ending awards anything *for* a death; legacy depends only on `stats`/`day`,
  not on how many died (tested as invariance in Step 3).
- **Self-induced forfeit is a strict loss**: for a board carrying feats,
  `scoreRun(stats, day, { selfInduced: true }).pts` (base only) `<
  scoreRun(stats, day, {}).pts` (base + feats) whenever any feat condition
  holds — so engineering a Last Stand never out-earns fighting on (tested in
  Step 3).

## Commands you will need

| Purpose   | Command                                 | Expected on success |
|-----------|-----------------------------------------|---------------------|
| Install   | `pnpm install`                          | exit 0              |
| Tests     | `pnpm test`                             | all pass            |
| One file  | `pnpm vitest run test/endings.test.js`  | that file passes    |
| Typecheck | `pnpm check`                            | exit 0              |
| Lint      | `pnpm lint`                             | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137      | manual check, Step 8 |

Debug hooks (AGENTS.md): `window.G`, `window.ff(minutes)` fast-forward.

## Scope

**In scope**:
- `js/endings.js` (create) — `collapseThreat`, `isSelfInduced`, and the pure
  EV/P6 helpers (`lastStandLegacy`, `beaconAttemptEV`, `valueOfDeath`,
  `valueOfAlive`)
- `js/meta.js` — extract pure `scoreRun` (behavior-preserving); export
  `WIN_LEGACY_BONUS`; `scoreRun` gains the `selfInduced` forfeit branch
- `js/run-end.js` — `communeFallen(opts)` + new `lastStand()` / `torch(ids)`
- `js/state.js` — `ending` / `endingCause` fields
- `js/settlers.js`, `js/world.js`, `js/game.js` — stamp `endingCause` at the
  three `communeFallen` call sites (one line each)
- `js/game.js` barrel — re-export the new endings/derived functions for view use
- `js/ui/modals.js` — `makeEndingsModal()` (offers + Torch survivor pick);
  pause-menu conditional entry; game-over modal four-way epitaph
- `js/ui/sidebar.js` — one conditional "offers open" line
- `test/endings.test.js` (create), additions to `test/meta.test.js`
- `plans/README.md` — status row

**Out of scope** (do not touch):
- The wagon camp, reserves, and the *fielded* band cap (12) — HP-8. The Torch
  writes all chosen survivors; capping/reserving them is HP-8's job. Note it.
- Aging/heirs/Chronicle *reading* — HP-8. The Torch's survivors carry
  `wants`/`scars` (plan 012) through 010's `toBandMember`; this plan reads none
  of it back.
- The Beacon loop itself (`igniteBeacon`, hold-3-days) — unchanged; the EV
  inequality only *models* the attempt, it does not alter it.
- Menace/scouting (plan 011) — `collapseThreat` deliberately does **not** read
  Menace; collapse is a commune-state condition, not a raid-pressure one.
- Any change to `js/save.js` or `SAVE_VERSION` — `ending`/`endingCause` are
  cleared on `newGame()` and never persisted mid-run in a way that needs a
  migration (they are only set at `G.gameOver`, after which the save is
  cleared). If you find yourself needing to persist them, STOP and reconsider.

## Git workflow

- Branch: none — execute on `main` (per `plans/README.md` execution model);
  commit per step with imperative messages ("Add the endings module and
  BALANCE.endings block").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `BALANCE.endings` block + the published-inequality tests

In `js/balance.js`, add the `endings:` block from Design (each key commented in
the file's terse style), placed after an existing top-level block (e.g. after
`beacon:`). Then extend `test/balance.test.js` (or add `test/endings.test.js`'s
first describe — keep the *table-local* copy in `balance.test.js` so a retuner
who edits the table without running the endings module still trips a gate,
exactly as plan 011 did for its inequalities):

1. Key presence: `BALANCE.endings.dwindleAt`, `.beaconWinPMin`,
   `.torchDeathValue`, `.torchAliveValue` are numbers; `.beaconWinPMin > 0`.
2. **§9.2 strictness (table-local)**: `BALANCE.endings.beaconWinPMin * 25 > 0`
   with a comment citing `js/meta.js`'s win bonus (before Step 2 single-sources
   it as `WIN_LEGACY_BONUS`; after Step 2, import and use the constant here).
3. **P6 (table-local)**: `BALANCE.endings.torchDeathValue < BALANCE.endings.torchAliveValue`.

**Verify**: `pnpm vitest run test/balance.test.js` → all pass;
`pnpm check && pnpm lint` → exit 0.

### Step 2: extract the pure scorer + forfeit branch — `js/meta.js`

Behavior-preserving refactor. Add `export const WIN_LEGACY_BONUS = 25;` beside
`KEY`. Extract the scoring body into a pure function:

```js
// pure: computes the run's legacy and named feats; mutates nothing.
// opts.selfInduced forfeits feat payouts (GDD §9 invariant 2) — base points only.
export function scoreRun(stats, days, opts = {}) {
  let pts = Math.max(1, days + 2 * stats.raids + 2 * stats.sites + Math.floor(stats.peak / 2) + Math.floor(stats.kills / 3));
  const bonuses = [];
  const feat = (cond, label, n) => { if (cond) { bonuses.push([label, n]); pts += n; } };
  if (!opts.selfInduced) {
    feat((stats.winters || 0) >= 1, 'endured winter', 3 * (stats.winters || 0));
    feat((stats.hordes || 0) >= 1, 'broke a horde', 4 * (stats.hordes || 0));
    feat((stats.warlords || 0) >= 1, 'slew a warlord', 3 * (stats.warlords || 0));
    feat((stats.bandits || 0) >= 3, 'scourge of bandits', 3);
    feat(stats.peak >= 12, 'a true commune', 3);
    feat(opts.win, 'THE BEACON HELD', WIN_LEGACY_BONUS);
  }
  if (hasPerk('ledger')) pts = Math.round(pts * 1.25);
  return { pts, bonuses };
}
```

Rewrite `endRun` to delegate, keeping every `META` write identical:

```js
export function endRun(stats, days, opts = {}) {
  const { pts, bonuses } = scoreRun(stats, days, opts);
  META.points += pts;
  META.runs++;
  META.bestDays = Math.max(META.bestDays, days);
  if (opts.win) META.wins++;
  META.life.days += days; META.life.raids += stats.raids;
  META.life.sites += stats.sites; META.life.kills += stats.kills;
  saveMeta();
  return { pts, bonuses };
}
```

Add to `test/meta.test.js` a new describe:

1. **`scoreRun` matches `endRun`'s points** on the base fixture (`= 30`) and
   the feat-stack fixture (`= 52`) without mutating `META` (assert
   `META.points === 0` after a `resetMeta`).
2. **Self-induced forfeits feats**: `scoreRun(featStackFixture, 10, { selfInduced: true }).pts`
   equals the *base-only* score (`30` for the day-10 fixture) and
   `.bonuses` is `[]`; assert it is strictly less than the honored
   `scoreRun(featStackFixture, 10).pts` (`52`).

**Verify**: `pnpm vitest run test/meta.test.js` → **all pass, old and new**.
The existing `endRun` characterization (`test/meta.test.js:21-62`) is the
review gate — if any of base `30` / stack `52` / win `26` / ledger `33` /
floor `1` changed, the extraction is not behavior-preserving; STOP and fix
the extraction, do not edit the old expectations.

### Step 3: `js/endings.js` + its unit tests

Create `js/endings.js` exactly per Design: `collapseThreat`, `isSelfInduced`,
`lastStandLegacy`, `beaconAttemptEV`, `valueOfDeath`, `valueOfAlive`. Import
`G` from `./state.js`, `BALANCE` from `./balance.js`, `scoreRun` +
`WIN_LEGACY_BONUS` from `./meta.js`, `foodInfo` from `./forecasts.js` (all
cycle-safe — none imports `endings.js`). `activeCount(G)` is
`G.settlers.filter(s => !s.away && !s.downed).length` (mirror
`settlerActive`, `js/settlers.js:14`). JSDoc-annotate `collapseThreat`'s return
(`pnpm check` runs tsc over `js/`). Guard `collapseThreat` for `!G.tiles`
(returns `{ threatened: false, causes: [] }` before a run exists).

In `js/game.js`, add to the barrel re-exports (near `js/game.js:16-17`):
`export { collapseThreat } from './endings.js';` and (Step 4)
`export { lastStand, torch } from './run-end.js';`.

Create `test/endings.test.js` (stub-then-import header from
`test/meta.test.js:1-9`; import `state.js`, `balance.js`, `meta.js`,
`endings.js`, `forecasts.js`). `beforeEach`: `Object.assign(G, makeState())`.
Provide `grassTiles()`/`tile()` helpers (copy from `test/raid-path.test.js`) so
`G.tiles` scans are real.

Tests:

1. **`collapseThreat` — each proxy independently**: with a healthy board
   (5 active settlers, a `campfire` tile, `G.res.food` high) →
   `threatened === false`. Then, one at a time: remove the campfire tile →
   cause includes `'the hearth is cold'`; drop to 2 active settlers →
   `'the commune is dwindling'`; set `G.res.food = 0`/`G.res.meals = 0` →
   `'the larder is empty'`. `G.tiles = null` → `threatened === false` (no run).
2. **§9.2 "always" (the headline invariant)**: over a grid of boards
   (`day ∈ {1, 10, 30}` × stats with/without feats), assert
   `lastStandLegacy(stats, day) < beaconAttemptEV(stats, day)` — strictly,
   every cell. Also assert the *reason* is stable:
   `beaconAttemptEV(b) - lastStandLegacy(b) === BALANCE.endings.beaconWinPMin * WIN_LEGACY_BONUS`.
3. **P6 (death < alive, and legacy is death-count-invariant)**:
   `valueOfDeath() < valueOfAlive()`; and `scoreRun(stats, day)` returns the
   same `pts` regardless of how many settlers died (legacy is a function of
   `stats`/`day`, never a per-death bonus) — build two boards differing only
   in a death count and assert equal `pts`.
4. **`isSelfInduced` proxies (honest)**: a Last Stand called while
   `collapseThreat().threatened === false` → `true`; an
   `endingCause === 'expedition'` fall from a *healthy* home (campfire present,
   food high) → `true`; the same expedition fall from a *starved* home →
   `false` (a real doomed board — bias to honor); a plain home raid
   (`endingCause === 'raid'`) → `false`. Add one explicit test named for the
   undetectable case, asserting the design does **not** flag a slow-larder
   loss (documents the deliberate blind spot).

**Verify**: `pnpm vitest run test/endings.test.js` → all pass.

### Step 4: wire `js/run-end.js` + stamp `endingCause`

Re-read the **post-010** `js/run-end.js` first (010 added
`writeRunToCampaign(...)` between `endRun` and `clearSave()`). Then:

1. `communeFallen(opts = {})` — accept an opts bag; default
   `ending = 'fall'`, `survivors = []`, `selfInduced = isSelfInduced()`. Set
   `G.ending = opts.ending`. Pass `{ win: false, selfInduced }` to `endRun`
   and `{ win: false, survivors: opts.survivors }` to `writeRunToCampaign`.
   Keep the `G.gameOver` guard and the `clearSave()` ordering unchanged. The
   three bare callers (`js/settlers.js:330`, `js/world.js:202`,
   `js/game.js:136`) still work (`opts = {}`).
2. `communeAscended()` — one line: `G.ending = 'victory';` (so the modal's
   four-way epitaph has its tag). Nothing else changes.
3. `lastStand()` — new. Guard on `G.gameOver`. Resolve
   `selfInduced = isSelfInduced()` (true if not threatened — the engineered
   death). Set `G.ending = 'laststand'`, `G.endingCause = 'laststand'`,
   `addLog` a "die famous" epitaph. `endRun(G.stats, G.day, { win: false, selfInduced })`,
   then `writeRunToCampaign({ win: false, survivors: [] })`, then `clearSave()`.
4. `torch(survivorIds)` — new. Guard on `G.gameOver`. Map ids to the live
   settlers (`G.settlers.filter(s => survivorIds.includes(s.id))`). Set
   `G.ending = 'torch'`, `addLog` "N carry the torch onward".
   `endRun(G.stats, G.day, { win: false, selfInduced: isSelfInduced() })`, then
   `writeRunToCampaign({ win: false, survivors: chosen })`, then `clearSave()`.
   (A Torch is not itself self-harm — but if it is taken from an un-threatened
   board, `isSelfInduced` still forfeits, which is correct: leaving a healthy
   commune to farm nothing earns nothing extra.)

Import `isSelfInduced` from `./endings.js`. Stamp `endingCause` at the three
existing call sites (one line each, in the *caller*, before it invokes
`communeFallen()`):

- `js/settlers.js:325-331` (`killSettler`) — `G.endingCause = how === 'starved' ? 'starved' : how.includes('flames') ? 'fire' : 'raid';`
  just before `if (!G.settlers.length) communeFallen();`
- `js/world.js:202` — `G.endingCause = 'expedition';` before `communeFallen()`.
- `js/game.js:136` (desertion) — `G.endingCause = 'starved';` (a commune that
  starves its people into desertion) before `communeFallen()`.

Add to `test/endings.test.js` (import `run-end.js` + a `resetMeta` copy from
`test/meta.test.js:15-19`, and seed `G.usedNames`/`G.day` like plan 010's
wiring tests):

1. **Last Stand from a threatened board honors feats, writes a ruin, no
   survivors**: threatened board (cold hearth) with `stats.hordes = 1`;
   `lastStand()` → `G.ending === 'laststand'`, `G.gameOver === true`,
   `G.bonusLines` contains `'broke a horde'` (honored),
   `CAMPAIGN.map.ruins` gained one entry, `CAMPAIGN.band` unchanged.
2. **Last Stand from an un-threatened board forfeits feats** (the "Last Stand
   farm" gate): healthy board with `stats.hordes = 1`; `lastStand()` →
   `G.bonusLines` is `[]` and `G.legacyEarned` equals the base-only score —
   proving the engineered death earns strictly less than fighting on.
3. **The Torch writes the chosen survivors and only them**: 3 alive settlers,
   `torch([<two of their ids>])` → `CAMPAIGN.band` gained exactly 2 members
   whose names match the chosen (P5 shape-whitelist reused from
   `test/campaign.test.js`), `G.ending === 'torch'`, `chronicle` newest entry
   `kind === 'fall'` listing the 2 survivor names.
4. **Ordering + idempotence**: reuse plan 010's op-log assertion pattern —
   the campaign `set` precedes the save `remove`; and a second `lastStand()`
   / `torch(...)` call (already `gameOver`) writes nothing more.

**Verify**: `pnpm vitest run test/endings.test.js` → green;
`pnpm test` → full suite green (`test/meta.test.js:96-129` idempotence and
`test/campaign.test.js` must pass **unmodified** — the shared run-end path
must not have changed observable behavior for the old endings; if they fail,
STOP).

### Step 5: the offers UI — `makeEndingsModal()` (post-009 `js/ui/modals.js`)

Keep it minimal — the derived offers and the tested endings are the
deliverable; the panel is thin (plan 011's stance). Add `makeEndingsModal()`:

- **Draw**: title "⚑ The settlement is failing" and the two offers with their
  one-line consequences ("Last Stand — everything down tonight; die famous" /
  "The Torch — choose who walks out; they carry the campaign on"). If
  `isSelfInduced()` would fire (board not actually threatened), show a muted
  line "Called in health — feats will not be honored." so the forfeit is never
  a surprise.
- **Last Stand**: on confirm, `lastStand()` then let `js/main.js:59`
  force-push the game-over modal (do not push it yourself — the guard already
  routes there).
- **The Torch**: opens a survivor pick over the alive settlers
  (`G.settlers.filter(s => !s.downed)` present + a note that `away`/expedition
  members cannot walk out — they are elsewhere). Reuse the list-screen
  grammar (`makeListScreen`, plan 009). Default all selected; toggle to
  deselect; confirm calls `torch(selectedIds)`. Do **not** enforce the
  fielded-band cap of 12 here (HP-8) — if the player selects more, write them
  all and leave a one-line "reserves rest at the wagon camp (soon)" note.

Surface the offers where they are discoverable but low-collision:

- **Pause menu** (`makePauseMenu`, `js/ui/modals.js`): add a conditional entry
  "⚑ End the settlement…" that opens `makeEndingsModal()`, shown **only** when
  `collapseThreat().threatened` (import `collapseThreat` via the `game.js`
  barrel). When not threatened, omit the row (do not show a dead option).
- **Sidebar** (`js/ui/sidebar.js`): when `collapseThreat().threatened`, one
  line in an alarm color, e.g. `⚑ Endings offered — [Esc] to choose`, in the
  self-compressing conditional region (plan 011 established one extra line is
  safe). Both renderers show it (house rule).

**Game-over modal** (`js/ui/modals.js`, the four-way epitaph): branch on
`G.ending` instead of only `G.victory`:

- `'victory'` → today's "THE BEACON HELD — VICTORY";
- `'laststand'` → "THEY MADE THEIR STAND" + "Remembered for how they fell.";
- `'torch'` → "THE TORCH IS CARRIED ONWARD" + "N walked out to found again.";
- `'fall'`/`null` → today's "THE COMMUNE HAS FALLEN".

Keep the feats/legacy lines. `G.victory` stays set for `'victory'` so any
other reader is unaffected; `G.ending` is the new discriminator.

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green.

### Step 6: barrel + dead-code sweep

Confirm the `game.js` barrel re-exports everything the view layer imports
(`collapseThreat`, `lastStand`, `torch`) and that sim modules import
`isSelfInduced` from `./endings.js` directly (house rule). Nothing exported
should ship unreferenced.

**Verify**:
- `grep -rn "hearthfall.campaign" js/` unchanged from plan 010 (this plan adds
  no new persistence key).
- `grep -rn "from './endings.js'" js/` shows `run-end.js` (sim) importing
  directly and `game.js` re-exporting for views.
- `pnpm lint` (unused-export rule, if configured) → exit 0.

### Step 7: extend the run-end idempotence net

In `test/meta.test.js`'s "run-end idempotence" describe (`:96-129`), the
existing `communeFallen`/`communeAscended` tests must still pass. Add one:
`communeFallen()` called bare (a passive fall) sets `G.ending === 'fall'` and
`G.endingCause` remains whatever the caller stamped (here `null`, since the
test calls it directly) — pinning that the new tag defaults harmlessly and the
old idempotence is intact.

**Verify**: `pnpm vitest run test/meta.test.js` → all pass.

### Step 8: manual verification

`pnpm dev` → http://localhost:8137. New run; `ff` to a fragile state (or edit
`G.res.food = 0` in the console). Confirm:

1. The sidebar "⚑ Endings offered" line appears once `collapseThreat` is true,
   in **both** renderers (pause menu → Graphics toggle).
2. Pause (`Esc`) shows "End the settlement…"; open it → the two offers render.
3. **Last Stand** → game-over modal reads "THEY MADE THEIR STAND", feats
   listed (from a board that earned some).
4. Force the un-threatened case (heal the board, then open the modal via a
   temporary always-on hook or trust the unit test) → the "feats will not be
   honored" note shows and the epitaph lists no feats.
5. **The Torch** → pick two of three settlers → game-over reads "THE TORCH IS
   CARRIED ONWARD"; in the console, `loadCampaign().band` (plan 010) contains
   the two chosen names and nothing else; the run save is gone
   (`hasSave() === false`).

### Step 9: `plans/README.md`

Add (or update, if a sibling already added later rows) the row:

```
| 016 | Endings as standing offers: Last Stand & the Torch | HP-7 | P1 | M-L | 010 | DONE |
```

Under "Dependency notes", note that HP-7 consumes plan 010's `survivors`
write path and that the *fielded* band cap and reserves are deferred to HP-8.

**Verify**: `git status` shows only in-scope files; `git diff plans/README.md`
is the status row only.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/endings.test.js`
~12 tests (collapse proxies, the §9.2 EV inequality, P6 death<alive +
death-count-invariance, self-induced proxies incl. the undetectable case,
Last Stand honor/forfeit, Torch survivors, ordering/idempotence);
`test/meta.test.js` +3 (`scoreRun` parity, forfeit, `ending` tag);
`test/balance.test.js` +3 published-invariant assertions — all green alongside
the existing suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/endings.js` exists; `lastStandLegacy` and `beaconAttemptEV` are
      exported and the §9.2 inequality is an `expect(...)` over a board grid,
      not a comment
- [ ] `grep -n "WIN_LEGACY_BONUS" js/meta.js` shows the constant used in
      `scoreRun`; the win bonus `25` is single-sourced
- [ ] `test/meta.test.js:21-62` (`endRun` characterization) passes
      **unmodified** — the `scoreRun` extraction is behavior-preserving
- [ ] `grep -n "selfInduced" js/meta.js js/run-end.js js/endings.js` shows the
      forfeit threaded from `isSelfInduced` → `endRun` → `scoreRun`
- [ ] `grep -n "writeRunToCampaign" js/run-end.js` shows the call **above**
      `clearSave()` in `communeFallen`, `communeAscended`, `lastStand`, `torch`
- [ ] The Torch's survivors reach `CAMPAIGN.band` via `survivors:`; nothing
      from `G.stats`/`hp`/position leaks (plan 010's P5 whitelist test extended)
- [ ] Game-over modal reads `G.ending` (four epitaphs); sidebar shows the
      offers line in both renderers; pause menu offers the endings only when
      `collapseThreat().threatened`
- [ ] `plans/README.md` status row updated

## STOP conditions

- **Plan 010 drift**: `js/campaign.js` has no `writeRunToCampaign({ win, survivors })`,
  or `js/run-end.js` does not already write survivors before `clearSave()`.
  This plan's Torch has no write path without it — report, do not build a
  parallel one.
- **Scorer extraction is not behavior-preserving**: any assertion in
  `test/meta.test.js:21-62` changes value. The extraction must be a pure
  refactor; if you cannot make `scoreRun` reproduce base `30` / stack `52` /
  win `26` / ledger `33` / floor `1`, report the discrepancy.
- **The §9.2 inequality cannot be made strict for every board** with numbers
  that also keep collapse detection sane — that is a design tension
  (`beaconWinPMin` or `WIN_LEGACY_BONUS` at zero breaks "always"); report
  which constant, do not ship a non-strict inequality.
- **A self-induced proxy would fire on a legitimate loss** in play (a genuinely
  doomed board flagged as engineered) — the bias-to-honor rule (P6) is
  violated; widen the proxy's guard or drop it, and report. A missed catch is
  acceptable; a false forfeit is not.
- **You are tempted to pay legacy/resources/equipment *for* a death** (a
  per-death bonus, freed weapons, a thread slot) — that is the exact v1 error
  the review killed (`GDD.md:153-159`). STOP; this is a design gate.
- **`collapseThreat` starts reading Menace, morale scalars, or anything beyond
  the three named commune signals** — scope creep that couples HP-7 to HP-5;
  report and keep it to hearth/population/food.
- Any test outside the ones this plan rewrites fails after Step 4 —
  especially `test/campaign.test.js` (plan 010) or the meta idempotence tests;
  the shared run-end path changed observable behavior. Report, do not adjust
  the old tests.

## Maintenance notes

- **The §9.2 inequality is a living constraint** (like plan 011's): any retune
  of `BALANCE.endings.beaconWinPMin` or `js/meta.js`'s `WIN_LEGACY_BONUS` must
  keep `lastStandLegacy < beaconAttemptEV` strict for every board — that is
  the point. If a Trial (GDD §8) ever scales these, the test is the per-Trial
  check the GDD demands.
- **Self-induced proxies are deliberately conservative**: they flag only the
  engineered-Last-Stand and healthy-home-expedition-wipe cases and honor
  everything else. Do not "tighten" them into intent-reading — the design
  blind spot is chosen, and P6 makes a false forfeit the worse failure. New
  proxies need a new high-confidence signal and a test, not a heuristic.
- **HP-8 (wagon camp / aging)** is the first *reader* of the Torch's
  survivors: it enforces the fielded cap of 12, rests reserves, and ages the
  band. Until then the Torch writes all chosen survivors and the cap note is a
  stub — do not fake the cap here.
- **The four-way `G.ending` tag** replaces the two-way `G.victory` branch in
  the game-over modal but keeps `G.victory` set for the win case, so any other
  `G.victory` reader is unaffected. If a future ending is added (e.g. an
  epilogue mode, GDD open question 6), it adds a `G.ending` value and a modal
  branch — not another boolean.
- **`endingCause`/`ending` are run-scoped and never persist to the campaign**
  (P5): they exist only to classify the ending for scoring and the epitaph,
  and die with the save.
