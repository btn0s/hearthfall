# Plan 013: Arrivals as decisions (HP-3) — strangers at the gate become a campaign choice

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Execution model**: plans run **sequentially, on `main`, in numeric order**;
> by the time this plan executes, **009–012 and 020 have landed** (009 split
> `screens.js` into `js/ui/`; 010 shipped the campaign store; 011 shipped
> Menace; 012 shipped the cast v2 — `wants`/`scars`/`assignWant`; 020 shipped
> the deck-proc floor registry `js/beats.js`). Every code excerpt below is
> anchored at commit `14fd915` (this plan's baseline, **before** 009-012/020).
> **Re-locate every cited site by symbol name**, not line number — 009 moved
> the sidebar/modals into `js/ui/`, 011 inserted a Menace dawn hook, 012 added
> settler fields and a `v2→v3` save block, and 020 bumped `SAVE_VERSION` twice
> and wired `noteBeat` into `communeDawn`'s beats.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/game.js js/settlers.js js/campaign.js js/beats.js js/menace.js js/cast.js js/save.js js/state.js js/data.js js/dawn.js js/journal.js js/ui/ js/screens.js test/`
> If `js/campaign.js`, `js/beats.js`, `js/menace.js`, `js/save.js`, or
> `js/cast.js` changed, re-read them fully before starting — this plan reads the
> campaign band, registers a deck through the beats registry, ticks the Menace
> ledger, bumps the save version, and reuses the cast's `assignWant`/`WANTS`. If
> a `js/arrivals.js` already exists, STOP (someone started HP-3 already).

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM (removes the live dawn-recruit growth path and replaces it
  with an event-driven, player-decided one; adds a persisted mid-run pending
  state and a bump to `SAVE_VERSION`; reads/writes the campaign store)
- **Depends on**: **010** (`js/campaign.js` — band member shape
  `{ id, name, trait, wants, scars, age }`, `CAMPAIGN`, `saveCampaign`); **012**
  (`js/cast.js` — `WANTS`/`assignWant`/`wantLabel`; settlers carry
  `wants`/`scars`); **020** (`js/beats.js` — `registerDeck({ id, tryProc })` /
  `noteBeat` / `beatFloorDawn`, and the Menace ledger `bumpMenace` from 011 that
  020's decline cost ties into). All landed by execution time.
- **Category**: feature
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP-3 (`ROADMAP.md:132`, Milestone HP0) · GDD §5
  (`GDD.md:268-272`), §2 P1 (`GDD.md:60-69`), §4 (`GDD.md:240-242`)

## Why this matters

The GDD v2 hypothesis — a persistent, mortal band whose settlements die makes
players found the next one (`GDD.md:368-369`) — needs the band to *grow the way
the fiction says it grows*: "by arrivals, rescues, and births/heirs"
(`GDD.md:198`), where an arrival is **a person you choose to adopt into your
campaign**, not a unit that materializes at dawn. Today it is the latter:
`communeDawn` silently spawns a `worker` at the map edge on a timer
(`js/game.js:139-153`) — the "silent dawn recruiting" that Appendix B and the
roadmap both name as the anti-pattern HP-3 replaces ("Replaces silent dawn
recruiting", `ROADMAP.md:132`).

The GDD §5 arrivals bullet is precise and binding (`GDD.md:268-272`):

- Strangers are shown **as people** — trait, want, age — **not stat lines**
  (P7 legibility, `GDD.md:163-176`).
- **Accepting is a *campaign* decision**: "they join the band, not the run —
  which is why it isn't larder arithmetic." The accept writes to the persistent
  band (the 010 store), so the weight is a campaign commitment (a band slot, a
  want you now owe across settlements), not "can I feed one more mouth here."
- **Declining has a visible cost**: "they camp nearby; Menace ticks; or a
  want-of-yours goes unmet." This plan uses the Menace tick (plan 011's
  `js/menace.js` ledger) as the concrete v1 cost.
- **Low rate, each an event, not a spawn** — so it registers as a **deck**
  through 020's proc floor (`GDD.md:240-242`), counting toward the one-beat-per-
  day guarantee instead of firing on a private timer.

**The binding invariant and this plan's review gate — GDD P5 / §9.1
(`GDD.md:129-147`)**: what crosses between settlements is *history, never
stats*. An arrival's `trait`, `want`, `age` are zero-modifier; `joinBand` may
write **only** the `BAND_MEMBER_FIELDS` whitelist plan 010 fixed — no hp, no
resource, no bonus. If accepting a stranger tempts you to grant the settlement a
number, STOP; that is a design gate.

## Current state

All excerpts verified at `14fd915`; re-locate by symbol after 009-012/020.
Vanilla-JS browser game; vitest; tuning in `js/balance.js`; `G` singleton in
`js/state.js`; sim modules import directly, view modules through the `game.js`
barrel (AGENTS.md house rules).

### The silent recruit this plan removes — `js/game.js:139-153` (in `communeDawn`)

```js
if (recruitEligible()) {
  G.recruitDays--;
  if (G.recruitDays <= 0) {
    const spot = edgeWalkable();
    if (spot) {
      const s = makeSettler(spot.x, spot.y, 'worker');
      G.settlers.push(s);
      updatePeak();
      addLog(`☺ ${s.name} (${traitName(s).toLowerCase()}), a wanderer, has joined the commune!`, '#e8d8a0');
      if (G.settlers.length === BALANCE.pop.tier2) addLog('◆ Commune tier II reached — watch posts, workshop, kitchen unlocked!', '#c8a0e8');
      if (G.settlers.length === BALANCE.pop.tier3) addLog('◆ Commune tier III reached — stone walls unlocked!', '#c8a0e8');
    }
    G.recruitDays = G.morale >= BALANCE.morale.high ? BALANCE.recruit.daysHigh : BALANCE.recruit.daysNormal;
  }
}
```

This is the whole silent-arrival path: gated by `recruitEligible()`
(`js/game.js:91-96` — food, roof, morale, `pop < BALANCE.pop.cap`), spawns at a
random edge via `edgeWalkable()` (`js/game.js:78-89`), pushes a settler, logs
the tier lines. **Note the collateral after removal**:

- `edgeWalkable()` is called **only here** (`grep -n edgeWalkable js/` → two
  hits: the def and this call) → it becomes dead and must be deleted.
- `recruitEligible()` is also read by the **sidebar growth indicator**
  (`js/screens.js:519`, moved to `js/ui/sidebar.js` by 009):
  `` const grow = recruitEligible() ? ` ☺${G.recruitDays}d` : ''; `` — once the
  countdown never advances (`G.recruitDays` is decremented only in the block
  above), this indicator is stale and must be repointed (Step 6).
- `recruitBlocker()` (`js/game.js:98-106`) stays — it feeds the Elder's "no roof
  to offer" counsel (`js/game.js:229`) and is independent of the spawn.
- **Rescues are a different growth path and are untouched** — `world.js` builds
  settlers on an expedition rescue (`js/world.js:166,176`), not via this block.
  Only the *dawn silent recruit* is replaced (`GDD.md:198`: arrivals **and**
  rescues both grow the band).

### `makeSettler` and the name/trait generators to reuse — `js/settlers.js:27-39`

```js
export function makeSettler(x, y, role) {
  const avail = NAMES.filter(n => !G.usedNames.has(n));
  const name = avail.length ? choice(avail) : choice(NAMES) + ' II';
  G.usedNames.add(name);
  const trait = choice(Object.keys(TRAITS));
  const maxHp = trait === 'hardy' ? 26 : trait === 'frail' ? 14 : 20;
  return { id: G.nextId++, name, x, y, role, trait, /* …run fields… */ };
}
```

A **candidate** reuses this name-pick (dedup against `G.usedNames`) and
trait-pick, but is **not** a settler — it is a band-shaped person object (no hp,
no position). `NAMES`/`TRAITS` are in `js/data.js:101-119`; `TRAITS[t].name` is
the display label (`traitName`, `js/settlers.js:41`).

### The campaign store (from plan 010) — the accept target

`js/campaign.js` exports `CAMPAIGN`, `BAND_MEMBER_FIELDS = ['id', 'name',
'trait', 'wants', 'scars', 'age']`, `saveCampaign()`, and
`writeRunToCampaign({ win, survivors })` (called from `js/run-end.js` **before**
`clearSave()` — see `plans/010-campaign-store.md` Step 1). `toBandMember`
(post-012) copies `wants`/`scars`. **This plan adds one export, `joinBand`**,
that pushes a band member from a candidate right now (an arrival is enrolled at
the decision, not at run-end). It writes only the whitelist and bumps
`CAMPAIGN.nextId` exactly like `toBandMember`.

### The cast's wants (from plan 012) — the "want" a stranger carries

`js/data.js` `WANTS` (added by 012) is `{ id: { label, want, check(s, G) } }`
for `fed`/`sheltered`/`armed`/`purpose`/`peace`; `js/cast.js` exports
`assignWant(s)` (sets `s.wants = [id]`) and `wantLabel(s)` (reads `s.wants[0]`).
A candidate gets exactly one want id from `WANTS`, stored as `wants: [id]` to
match the band-member array shape, and displayed via `wantLabel`.

### The Menace ledger (from plan 011) — the decline cost

`js/menace.js` exports `bumpMenace(delta, cause)` — clamps `G.menace.value` at
0, appends a capped `{ day, cause, delta }` to `G.menace.ledger` (shape
`G.menace = { value, ledger }`). A **positive** delta raises Menace (worse for
the world). Declining an arrival calls `bumpMenace(+n, cause)` — the strangers
"camp nearby" and the world's attention on you grows.

### The deck-proc floor (from plan 020) — how an arrival becomes a beat

`js/beats.js` exports `registerDeck(deck)` (`deck = { id, tryProc }`, consulted
in registration order), `noteBeat(kind, why)` (increments `G.beatsToday` for
beats fired *inside* `communeDawn`), and `beatFloorDawn()` (called at the end of
`communeDawn`: resets the day counter, then walks `DECKS` calling
`tryProc(G.day)` — the first truthy return counts as the day's beat and
suppresses the flavor fallback). **The arrival deck registers here.** Its
`tryProc` *raises* an arrival (sets the pending state, opens the decision) and
returns truthy — so the loop counts it and the fallback never double-fires. It
must **not** also call `noteBeat` (the `DECKS` loop does the counting for
deck-sourced beats; `noteBeat` is for the in-`communeDawn` beats only — see
`plans/020-supporting-systems.md`, "Ordering subtlety").

### Save shape — `js/save.js` (at v1 in this excerpt; ≥3 by execution time)

`SAVE_VERSION` is `1` at `14fd915` (`js/save.js:7`); 011 took it to 2, 012 to 3
(`plans/012-cast-v2.md` Step 7). `toSaveData` destructures/returns a fixed field
list (`js/save.js:12-29`); `migrate()` is a chain of `if (d.version < N)` blocks
(`js/save.js:31-65`); `loadGame` does `Object.assign(G, makeState(), d)`
(`js/save.js:86`), which already backfills new `makeState` defaults. A new
persisted field (`pendingArrival`) rides the destructure/return and needs one
`v3→v4` migration block. **This plan bumps `SAVE_VERSION` to `4`.**

### The modal pattern — `js/screens.js:869` `makeBeaconModal` (moved to `js/ui/modals.js` by 009)

A decision surface is a `makeListScreen({ id, items, x0, y0, w, rowH,
pausesSim: true, keymapExtra, drawChrome })` pushed with `push(...)` and closed
with `pop()`; `pausesSim: true` freezes the sim while the player decides. The
arrival modal copies this shape (Accept / Decline items, a `drawChrome` showing
the person). Trade/beacon modals are opened from the game screen
(`js/screens.js:262-264`) — the arrival modal opens the same way, from the game
screen detecting `G.pendingArrival` (Step 6), so `js/arrivals.js` needs **no UI
import** (avoids a sim→view cycle).

### The test net to extend

- Header pattern for new test files: stub `localStorage`/`performance` before
  dynamic import (`test/campaign.test.js` from 010, `test/cast.test.js` from
  012); reset singletons in place (`Object.assign(G, makeState())`;
  `Object.assign(CAMPAIGN, makeCampaign())`).
- `test/beats.test.js` (020) established `_resetDecks()` for the registry —
  reuse it so the arrival deck doesn't leak between tests.
- `test/save.test.js` — round-trip + migration-backfill patterns; extend with a
  `v3→v4` `pendingArrival` test.
- `test/campaign.test.js` — the P5 shape-whitelist gate; extend it to prove
  `joinBand` writes only `BAND_MEMBER_FIELDS`.

## Design (decided here, executed below)

### The candidate — a person, generated once, shown whole

A **candidate** is a band-shaped person built at proc time:

```js
// js/arrivals.js — genCandidate()
{ name, trait, wants: [wantId], scars: [], age: 0 }
```

- `name`: the `makeSettler` pick, deduped against `G.usedNames` (inlined — three
  lines; do **not** import `settlers.js` into `arrivals.js`, see cycle note).
- `trait`: `choice(Object.keys(TRAITS))`; shown as `TRAITS[trait].name`.
- `wants`: one id from `WANTS` (`choice(Object.keys(WANTS))`); shown via
  `wantLabel(candidate)`.
- `scars`: `[]` — a fresh stranger carries no history yet (scars accrue in the
  band, plan 012).
- `age`: `0` — age is *settlements survived* (plan 010's band-member field). A
  stranger is untested; the modal shows a flavor life-stage line ("new to the
  road"), **not** a number. The Green/Prime/Grey age band and non-zero
  returning-member ages are **HP-8's** display job — do not build it here.

Zero-modifier by construction: none of these fields is read by combat, economy,
or work (P5 gate, tested in Step 5).

### Accept → `joinBand` (a campaign write, tested)

`acceptArrival()` calls `joinBand(G.pendingArrival)` (new `js/campaign.js`
export), which pushes a `BAND_MEMBER_FIELDS`-shaped record onto `CAMPAIGN.band`
(bumping `CAMPAIGN.nextId`), `saveCampaign()`s, and clears the pending state.
The stranger is now in the **persistent band** — the campaign commitment the GDD
demands ("they join the band", `GDD.md:269`). Gated by the **band cap** (P1 =
12, `GDD.md:60`): the deck declines to offer an arrival when
`CAMPAIGN.band.length >= BALANCE.arrivals.bandCap`, so the choice is about *band
room*, not larder.

> **Design tension to surface to the operator (review gate, not a blocker)**:
> the GDD/roadmap say accept = "join the *band*, not the *run*"
> (`GDD.md:269`, `ROADMAP.md:132`) — i.e. a pure campaign enrollment; the
> newcomer walks into your **next** settlement when a founding-draft reader
> (HP-8/plan 016/017) drafts `CAMPAIGN.band` into a fresh `makeSettler`. This
> plan follows that reading: **accept writes to the band only; it does not spawn
> an active settler in the current settlement.** The consequence is honest and
> stated: with no founding-draft reader landed yet, an accepted arrival has no
> *in-run* body this settlement (the store is write-mostly until its readers
> land — 010's own design). The current settlement's active workforce therefore
> no longer grows mid-run from wanderers (rescues still add bodies —
> `world.js`). If the operator wants accept to **also** spawn a run settler now
> (the task's "+ join run" reading, for an immediate in-run payoff), that is a
> *separate, larger* change: it must tag the settler with the band id, add a
> dedup guard so `writeRunToCampaign` (010) doesn't re-enroll it at run-end, and
> a `leaveBand`-on-death path (permadeath) in `killSettler` — a seam that
> collides with plan 016's endings rework. **Flag which reading was chosen in
> the commit.** Do not silently ship the in-run spawn; it changes the
> enrollment model 016 extends.

### Decline → a visible Menace cost (tested)

`declineArrival()` calls `bumpMenace(+BALANCE.arrivals.declineMenace, 'strangers
turned away — they camp beyond the treeline')` (plan 011 ledger), logs the
snub, and clears the pending state. The cost is **visible** (it appears in the
Menace cause-ledger the player can read) and **campaign-flavored** (the world's
attention grows because you left desperate people at your gate). The GDD's
alternative cost — "a want-of-yours goes unmet" (`GDD.md:271`) — is deferred;
Menace is the concrete v1 cost because 011's ledger is the landed surface.

### The arrival deck — low rate, event-weight, floor-integrated

`js/arrivals.js` self-registers a deck at import time:

```js
registerDeck({ id: 'arrivals', tryProc(day) {
  if (G.pendingArrival) return null;                       // never stack two
  if (CAMPAIGN.band.length >= BALANCE.arrivals.bandCap) return null; // band full
  if (day < BALANCE.arrivals.minDay || isWinter()) return null;      // no one travels in deep winter
  if (!chance(BALANCE.arrivals.rate)) return null;         // low rate
  G.pendingArrival = genCandidate();
  addLog('Strangers stand at the gate, asking to join.', '#e8d8a0');
  return G.pendingArrival;                                 // truthy → counts as the day's beat, suppresses fallback
}});
```

Consulted by `beatFloorDawn()` (020) in the `DECKS` loop, so a raised arrival is
the day's guaranteed beat. `isWinter()`/`minDay` keep parity with the old
recruit's seasonal gate without re-adding food/roof larder gates (accept is not
larder arithmetic). Import-time registration means **`js/arrivals.js` must be
imported for its side effect** — Step 3 adds that import to the startup barrel.

### The pending state — persisted mid-run

`G.pendingArrival` (default `null`) holds the un-decided candidate. It **must
persist** so a save-and-quit mid-decision restores the same stranger at the same
gate — bump `SAVE_VERSION` to 4, backfill `null` for old saves. The game screen
opens `makeArrivalModal` whenever `G.pendingArrival` is set and no arrival modal
is already on the stack (Step 6), so a reload re-presents the decision.

### `js/arrivals.js` imports (all cycle-safe)

`state`, `balance`, `rng` (`choice`/`chance`), `data` (`NAMES`/`TRAITS`/
`WANTS`), `seasons` (`isWinter`), `cast` (`wantLabel`), `campaign` (`joinBand`,
`CAMPAIGN`), `menace` (`bumpMenace`), `journal` (`addLog`), `beats`
(`registerDeck`). **None of these import `arrivals.js`** → one-way. Do **not**
import `settlers.js` (inline the name pick) or any `js/ui/`/`screens.js` (the
game screen reads `G.pendingArrival`; arrivals never pushes a screen).

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Tests     | `pnpm test`                               | all pass            |
| One file  | `pnpm vitest run test/arrivals.test.js`   | that file passes    |
| Typecheck | `pnpm check`                              | exit 0              |
| Lint      | `pnpm lint`                               | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137        | manual check, Step 7 |

Debug hooks: `window.G`, `window.ff(minutes)` (fast-forward) — see AGENTS.md.

## Scope

**In scope**:
- `js/arrivals.js` (create) — candidate generation, `acceptArrival`/
  `declineArrival`, the registered deck.
- `js/campaign.js` — add `joinBand(candidate)` (additive; no shape change, no
  `CAMPAIGN_VERSION` bump).
- `js/balance.js` — add the `arrivals` block.
- `js/state.js` — `pendingArrival: null` in `makeState()`.
- `js/game.js` — **remove** the silent-recruit block + now-dead `edgeWalkable`;
  import `js/arrivals.js` for its registration side effect; barrel re-export of
  the arrival view helpers.
- `js/save.js` — persist `pendingArrival`; `SAVE_VERSION = 4` + `v3→v4`
  migration.
- `js/ui/modals.js` (post-009) — `makeArrivalModal`; `js/ui/sidebar.js`
  (post-009) — repoint the recruit growth indicator; `js/screens.js` (post-009)
  — open `makeArrivalModal` on `G.pendingArrival`.
- `test/arrivals.test.js` (create); extend `test/campaign.test.js`,
  `test/save.test.js`, `test/balance.test.js`.
- `plans/README.md` — status row.

**Out of scope** (do not touch / defer):
- **Drafting `CAMPAIGN.band` into a founding settlement** (turning accepted
  members into active settlers) — HP-8/plan 016/017's founding draft. This plan
  *writes* the band; it adds no founding-time reader.
- **Accept spawning a run settler this settlement** — the switchable reading in
  the Design tension note; do not ship it silently.
- **Returning band members as candidates** (a face from a fallen settlement
  seeking the new one) — needs the founding-draft/aging surface; v1 candidates
  are fresh strangers (`age: 0`, `scars: []`).
- **The age display band** (Green/Prime/Grey) and non-zero ages — HP-8.
- **Rescues, births/heirs** — separate growth paths (`world.js`; vLater).
- **The "unmet want" decline cost** — deferred; Menace is the v1 cost.
- Any change that lets `trait`/`want`/`age` modify a number (P5 gate).

## Git workflow

- **On `main`, no branch** (execution model). One commit for the plan, gates
  green. Imperative message ("Replace silent recruiting with arrivals-as-
  decisions"). State the accept reading (band-only) in the commit body.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `BALANCE.arrivals` + `joinBand` + state field

In `js/balance.js`, add an `arrivals:` block after the existing blocks, terse-
commented:

```js
arrivals: {
  rate: 0.12,          // per-dawn proc chance once eligible (low — an event, not a spawn)
  minDay: 3,           // strangers start appearing from day 3 (parity with old recruitMinDay)
  bandCap: 12,         // P1 cast cap (GDD.md:60) — no arrival offered at/above this band size
  declineMenace: 3,    // Menace ticked when you turn strangers away (plan 011 ledger)
},
```

> Re-derive `bandCap` before trusting `12`: if plan 012 introduced a canonical
> cast/band cap constant, reference **that** instead of a second literal (drift
> check). Do **not** reuse `BALANCE.pop.cap` (that is the in-settlement
> population cap, a different number).

In `js/campaign.js`, add next to `writeRunToCampaign` (reuse `toBandMember`'s
whitelist discipline — history, never stats):

```js
// A stranger accepted at the gate joins the persistent band immediately (HP-3).
// Writes ONLY the BAND_MEMBER_FIELDS whitelist — no run stat may leak (P5).
export function joinBand(person) {
  const m = {
    id: CAMPAIGN.nextId++, name: person.name, trait: person.trait,
    wants: [...(person.wants || [])], scars: [...(person.scars || [])],
    age: person.age ?? 0,
  };
  CAMPAIGN.band.push(m);
  saveCampaign();
  return m;
}
```

In `js/state.js` `makeState()`, add `pendingArrival: null` (next to the other
run flags, e.g. near `alarm`/`recruitDays`, `js/state.js:18`).

Extend `test/balance.test.js` with a `describe('BALANCE.arrivals')`:
1. `rate` in `(0, 1)`; `minDay >= 1`; `bandCap >= 1`; `declineMenace` a positive
   integer.

**Verify**: `pnpm vitest run test/balance.test.js` → pass; `pnpm check && pnpm lint` → exit 0.

### Step 2: `js/arrivals.js`

Create the module per the Design section. Keep `genCandidate()` a pure builder
(name/trait/want/scars/age) so Step 5 can assert its shape on literals; inline
the `NAMES`/`G.usedNames` name pick from `makeSettler` (do **not** import
`settlers.js`). `acceptArrival()` → `joinBand(G.pendingArrival)`, log the join,
`G.pendingArrival = null`, `save()` the run (pending cleared). `declineArrival()`
→ `bumpMenace(+BALANCE.arrivals.declineMenace, '…')`, log, `G.pendingArrival =
null`, `save()`. Register the deck at import time exactly as in Design. JSDoc any
object params (`pnpm check` runs tsc over `js/`).

Guard against a double-decide: `acceptArrival`/`declineArrival` early-return if
`!G.pendingArrival`.

**Verify**: `pnpm check && pnpm lint` → exit 0. (The module is dead until Step 3
imports it — that is expected; `pnpm lint`'s unused-export rule is satisfied
because the exports are consumed by tests and, after Step 3/6, by the barrel and
modal.)

### Step 3: remove the silent recruit; register the deck

In `js/game.js`:
- **Delete** the `if (recruitEligible()) { … }` block in `communeDawn`
  (`js/game.js:139-153`). By execution time 020 has wired a `noteBeat(...)` into
  this block (`plans/020-supporting-systems.md` Step 2.2, at the recruit site) —
  it is removed with the block; the arrival deck now provides the beat via the
  `DECKS` loop, so the floor still holds. Re-locate and confirm.
- **Delete** the now-dead `edgeWalkable()` (`js/game.js:78-89`) — `grep -n
  edgeWalkable js/` must return **no hits** after.
- Add `import './arrivals.js';` (side-effect import — registers the deck) with
  the other sim imports. Because `arrivals.js` imports `campaign`/`menace`/
  `cast`/`beats`, confirm `pnpm check` reports **no import cycle**; if one
  appears, it is because something imported `arrivals.js` back — none should
  (STOP condition).
- Barrel re-export the view helpers next to the other re-exports: `export {
  acceptArrival, declineArrival } from './arrivals.js';` and (for the modal's
  labels) ensure `wantLabel` and `traitName` are reachable through the barrel
  (12/existing already re-export them — verify).

Leave `recruitEligible`/`recruitBlocker`/`G.recruitDays` in place for now
(`recruitBlocker` feeds the Elder; `recruitEligible` is repointed in Step 6).
Note in the commit body that `BALANCE.recruit.days*` and `G.recruitDays` become
candidates for a follow-up prune once the sidebar stops reading them.

**Verify**: `pnpm check && pnpm lint` → exit 0 (fix any unused import flagged in
`game.js` — e.g. `updatePeak`/`traitName`/`makeSettler` may still be used by
`newGame`/rescues; prune only what lint actually flags). `pnpm test` → the
existing suite must still pass; the recruit-removal changes no *tested* behavior
(no test asserts the silent spawn — confirm with `grep -rn "deserted\|wanderer\|recruitEligible" test/`; if a test pins the silent recruit, STOP and report — it characterizes behavior this plan intentionally changes).

### Step 4: persistence — `SAVE_VERSION = 4` + `v3→v4`

In `js/save.js`:
- Add `pendingArrival` to the `toSaveData` destructure and returned object.
- Bump `SAVE_VERSION` to **4** (re-read its current value first — it is `3`
  after 012; if it is not `3`, a plan landed out of order — STOP and reconcile).
- After the existing highest-version block in `migrate()`, add:

  ```js
  if (d.version < 4) {
    d.pendingArrival = d.pendingArrival ?? null;
    d.version = SAVE_VERSION;
  }
  ```

  (`loadGame`'s `Object.assign(G, makeState(), d)` already backfills the
  `makeState` default; the migration block is the belt-and-suspenders the
  save-shape house rule requires, and the test pins it.)

Extend `test/save.test.js`:
1. **Round-trip**: set `G.pendingArrival = { name: 'Wren', trait: 'brave',
   wants: ['armed'], scars: [], age: 0 }`, `save()` → `loadGame()` → it
   deep-equals the source.
2. **v3→v4 backfill**: write a `save()`, edit raw JSON to `raw.version = 3` and
   `delete raw.pendingArrival`, re-store, `loadGame()` → `G.pendingArrival ===
   null`.

**Verify**: `pnpm vitest run test/save.test.js` → pass; `pnpm test` → green.

### Step 5: `test/arrivals.test.js` + campaign P5 gate

Create `test/arrivals.test.js` with the stub-then-import header (copy
`test/campaign.test.js`), importing `state.js`, `arrivals.js`, `campaign.js`,
`menace.js`, `beats.js`, `balance.js`, `data.js`. `beforeEach`: `Object.assign(G,
makeState())`, `Object.assign(CAMPAIGN, makeCampaign())`, seed
`G.menace = { value: 0, ledger: [] }` (plan 011 shape) if `makeState` doesn't,
and `_resetDecks()` from `js/beats.js`. Tests:

1. **Candidate is a whole, zero-modifier person**: `genCandidate()` (export it,
   or reach it via a forced proc) returns keys exactly `['name','trait','wants',
   'scars','age']`, `wants.length === 1` with a valid `WANTS` id, `scars` `[]`,
   `age === 0`; no `hp`/`role`/position field present.
2. **Accept adds to the campaign band (the HP-3 test)**: set `G.pendingArrival =
   genCandidate()`, `acceptArrival()` → `CAMPAIGN.band.length === 1`, the member
   is `BAND_MEMBER_FIELDS`-shaped with the candidate's `name`/`trait`/`wants`,
   and `G.pendingArrival === null`.
3. **Decline applies the visible cost**: set a pending candidate,
   `declineArrival()` → `G.menace.value` rose by `BALANCE.arrivals.declineMenace`
   and the Menace ledger gained an entry; `CAMPAIGN.band` **unchanged**;
   `G.pendingArrival === null`.
4. **P5 gate — `joinBand` writes only the whitelist**: call `joinBand({ name:'X',
   trait:'brave', wants:['fed'], scars:[{id:'grief',day:2}], age:0, hp:99,
   role:'guard', resolve:5, weapon:true })` → the pushed member's
   `Object.keys().sort()` equals `[...BAND_MEMBER_FIELDS].sort()`; `hp`/`role`/
   `resolve`/`weapon` are **absent**; `wants`/`scars` deep-equal the source.
   (Mirror this assertion into `test/campaign.test.js` so the store's own suite
   guards `joinBand` alongside `writeRunToCampaign`.)
5. **Rate / proc-floor interaction**: register the arrival deck (import side
   effect already did, or call it), force `chance` high (seed RNG or stub) →
   `beatFloorDawn()` sets `G.pendingArrival` and returns without firing the
   flavor fallback (assert `G.log` has the gate line, not the Elder fallback
   line); force `chance` low → the deck's `tryProc` returns `null` and the
   fallback **does** fire (arrivals didn't suppress it). Also: with
   `CAMPAIGN.band.length >= bandCap`, `tryProc` returns `null` even when the
   roll would pass (band-full gate).
6. **No stacking**: with `G.pendingArrival` already set, a second `tryProc`
   returns `null` (one decision at a time).

> If forcing the RNG is awkward, follow whatever seam 020's `test/beats.test.js`
> used to drive `tryProc` deterministically (a stubbed `chance`, or asserting on
> the deck object's `tryProc` directly with a monkeypatched `BALANCE.arrivals.
> rate = 1`). Restore any monkeypatch in a `finally`/`afterEach`.

**Verify**: `pnpm vitest run test/arrivals.test.js` → all pass; `pnpm vitest run
test/campaign.test.js` → pass (old + new); `pnpm test` → full suite green.

### Step 6: UI — the arrival modal, the open hook, the sidebar repoint (post-009)

All UI edits target the **post-009** files; find sites by symbol.

- `js/ui/modals.js` — add `makeArrivalModal()`, copying `makeBeaconModal`'s
  `makeListScreen({ …, pausesSim: true })` shape. `drawChrome` shows the person:
  a header ("Strangers at the gate"), the name, `TRAITS[G.pendingArrival.trait]
  .name` (trait), `wantLabel(G.pendingArrival)` (want), and a flavor age line
  ("new to the road" — **no number**, HP-8 owns age banding). `items`: **Accept
  — into the band** (`act: () => { acceptArrival(); pop(); }`) and **Turn them
  away** (`act: () => { declineArrival(); pop(); }`), imported through the
  `game.js` barrel (view house rule). Show the decline cost inline ("they will
  camp nearby; the world's eyes turn to us") so the cost is legible *before* the
  click.
- `js/screens.js` game screen — open the modal when a decision is pending:
  where trade/beacon modals open (`js/screens.js:262-264` pattern, post-009),
  add — in the game screen's per-frame/update or its input entry — `if
  (G.pendingArrival && !arrivalModalOpen()) push(makeArrivalModal());` (guard
  against re-pushing while it is on the stack — check the screen stack's top
  `id`, mirroring how existing code avoids double-pushing). This keeps
  `js/arrivals.js` free of any UI import.
- `js/ui/sidebar.js` — repoint the stale growth indicator. The recruit
  countdown `` recruitEligible() ? ` ☺${G.recruitDays}d` : '' `` (was
  `js/screens.js:519`) no longer advances; replace it with an **arrivals hint**:
  show `☺` (band has room) when `CAMPAIGN.band.length < BALANCE.arrivals.bandCap`
  and a pending marker when `G.pendingArrival` — keep it to the same single
  glyph width so `sidebarLayout()` geometry is unchanged. This frees
  `recruitEligible` from the view; if `grep -rn recruitEligible js/` then shows
  **no reader**, delete it too (and `pnpm lint` will confirm). If a barrel entry
  for `recruitEligible` (`js/screens.js:9`) is now unused, prune it.

**Verify**:
- `pnpm check && pnpm lint && pnpm test` → all green.
- Manual (`pnpm dev`): start a run, `ff` past day 3 until "Strangers stand at
  the gate" logs and the arrival modal opens (sim paused) showing name/trait/
  want. **Accept** → the modal closes and (open devtools) `G.pendingArrival ===
  null` and `loadCampaign().band` has a new member with that name; **reload**
  mid-decision (before deciding) → the same stranger re-appears (pending
  persisted). Decline on another → `G.menace.value` rises and the Menace ledger
  (its click-widget, plan 011) shows the "strangers turned away" cause. Confirm
  **no** settler spawns at the map edge on any dawn (silent recruit gone). Both
  renderers (Esc → Graphics toggle) show the same modal. Any rendering/input
  regression vs. the pre-plan game screen: STOP.

### Step 7: update `plans/README.md`

Add (or set, if a sibling added it) this plan's row to the execution-order
table, in the established shape:

```
| 013 | Arrivals as decisions — strangers at the gate become a campaign choice | HP-3 | P1 | M | 010, 012, 020 | DONE |
```

Under "Dependency notes", record that HP-3 is the **first writer** of
`CAMPAIGN.band` outside `writeRunToCampaign` (via `joinBand`), that the
founding-time **reader** (drafting the band into a new settlement) is deferred to
HP-8/plan 016/017, and that the accept reading chosen is **band-only** (see the
Design tension note) — flip it only with the operator's sign-off.

**Verify**: `git diff plans/README.md` shows only the added row + the note.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/arrivals.test.js` ~6
tests (candidate shape, accept→band, decline→Menace cost, P5 whitelist gate,
rate/proc-floor interaction, no-stacking); `test/campaign.test.js` +1 (`joinBand`
whitelist); `test/save.test.js` +2 (round-trip, v3→v4 backfill);
`test/balance.test.js` +1 (`arrivals` keys) — all green alongside the existing
suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] `js/arrivals.js` exists and self-registers a deck via `registerDeck`; the
      silent recruit block and `edgeWalkable` are gone — `grep -n
      "edgeWalkable\|wanderer, has joined" js/` → no hits
- [ ] Accepting a stranger appends one `BAND_MEMBER_FIELDS`-shaped member to
      `CAMPAIGN.band` (Step 5 test #2) and nothing else crosses (P5 gate test
      #4); `CAMPAIGN_VERSION` unchanged
- [ ] Declining ticks `G.menace.value` by `BALANCE.arrivals.declineMenace` and
      leaves a visible ledger cause; the band is unchanged
- [ ] The arrival is a **deck**: `tryProc` returns truthy on a raised arrival
      (suppresses the 020 fallback) and `null` when the band is full / already
      pending / off-rate (Step 5 tests #5, #6)
- [ ] `G.pendingArrival` round-trips through save; `SAVE_VERSION === 4` with a
      `v3→v4` backfill test
- [ ] The modal shows a **person** (trait, want, flavor age), not a stat line;
      no raw `age` number rendered
- [ ] The sidebar's stale recruit countdown is repointed; `recruitDays` no
      longer displayed as a live countdown
- [ ] `plans/README.md` row added; `git status` shows only in-scope files

## STOP conditions

- Any "Current state" excerpt no longer matches after 009-012/020 (drift) —
  re-ground every cited symbol first. In particular, if `writeRunToCampaign`,
  `toBandMember`, or `BAND_MEMBER_FIELDS` differ from plan 010's shape, or
  `registerDeck`/`beatFloorDawn` differ from plan 020's, re-derive the edit and
  report before coding.
- A test in `test/campaign.test.js`, `test/beats.test.js`, `test/save.test.js`,
  or `test/cast.test.js` fails for any reason other than a fixture missing the
  new `pendingArrival` field — those characterize behavior this plan must not
  silently change; report, do not adjust the old assertions.
- An import cycle appears (`pnpm check`/Vite complains): `js/arrivals.js` must
  import only `state`/`balance`/`rng`/`data`/`seasons`/`cast`/`campaign`/
  `menace`/`journal`/`beats`, and must **not** import `settlers.js`,
  `screens.js`, or any `js/ui/` module. If a hook forces one of those, inline
  the helper (name pick) or move the read into the view — do not invert the
  dependency; if you can't, report.
- You find yourself letting `joinBand` write a field outside `BAND_MEMBER_FIELDS`
  — or an accepted stranger grant the *settlement* a resource, hp, or bonus —
  that violates GDD P5 / §9.1 (`GDD.md:129-147`). STOP; this is a design gate.
- You are tempted to make accept **also** spawn an active run settler this
  settlement (the "+ join run" reading) to give the decision an in-run payoff —
  that changes the enrollment model plan 016 extends (needs band-id tagging, a
  `writeRunToCampaign` dedup guard, and `leaveBand`-on-death). Do it only with
  the operator's explicit sign-off; report the coupling rather than shipping it
  silently (see the Design tension note).
- Removing the silent recruit turns out to break a test that pins it, or a
  systems reader you didn't expect (`grep -rn "recruitEligible\|edgeWalkable\|
  recruitDays" js/ test/`) — report which reader before deleting.

## Maintenance notes

- **The P5 veteran-parity gate is a living constraint**: `joinBand` must keep
  writing only `BAND_MEMBER_FIELDS`; any future arrival attribute (a stranger's
  reputation, a caravan-of-several) must stay zero-modifier and covered by the
  Step 5 #4 whitelist test.
- **HP-8 / plan 016/017 own the reader**: the founding draft that turns
  `CAMPAIGN.band` members into active settlers, the age display band
  (Green/Prime/Grey), non-zero ages, and returning members as candidates (a face
  from a fallen settlement at the new gate) all build on the `band` this plan
  writes. Until they land, accepted arrivals accumulate in the store by design
  (010's write-mostly model), not by accident.
- **The accept reading is band-only** (see the Design tension note): if
  playtests say the arrival decision feels weightless in-run at v1, the switch
  to an immediate in-run spawn is the documented alternative — but it must carry
  the band-id/dedup/`leaveBand` seam and be reconciled with plan 016.
- **The decline cost is Menace** (plan 011 ledger); the GDD's alternative
  ("a want-of-yours goes unmet", `GDD.md:271`) is the fallback if Menace tuning
  proves too punishing.
- **`BALANCE.recruit.days*` and `G.recruitDays`** are left in place to keep this
  diff additive-minus-one-block; prune them in a follow-up once nothing reads the
  old recruit countdown.
