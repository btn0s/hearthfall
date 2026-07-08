# Plan 020: Supporting HP0 systems — trader demand-memory, the deck-proc floor, the first-loss unlock

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. This plan is **three independent items batched**;
> each is its own step-group ending in its **own commit checkpoint** with all
> three gates (`pnpm check`, `pnpm lint`, `pnpm test`) green. You may land item
> 1, item 2, and item 3 in any order — they do not touch each other's files
> except `js/balance.js` (append-only) and `js/state.js`/`js/save.js`
> (additive). When done, update the status row for this plan in
> `plans/README.md` (final step).
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/game.js js/data.js js/balance.js js/state.js js/save.js js/dawn.js js/world.js js/campaign.js js/menace.js js/screens.js js/ui/`
> Every excerpt below is anchored at **`14fd915`** (this plan's authoring
> commit). By the time this plan runs, **plans 009–019 have landed on main
> ahead of it** (see Execution model), so several of these files *will* differ
> from the excerpts — that is expected, not drift. Re-locate every symbol by
> **name**, not line number, and re-read the four files this plan extends that
> other plans created or reshaped: `js/campaign.js` (plan 010),
> `js/menace.js` (plan 011), `js/save.js` (SAVE_VERSION was bumped by plan
> 011 and possibly later), and the trade modal (plan 009 splits `screens.js`
> into `js/ui/` — `makeTradeModal` likely now lives in a `js/ui/` module).

## Status

- **Priority**: P1
- **Effort**: M (three S/S-M items batched; each small, independently shippable)
- **Risk**: LOW-MED (item 1 touches the live pricing path and bumps the save
  shape; items 2 and 3 are additive — a new dawn hook and a one-time write
  into an existing store)
- **Depends on**: **010** (the campaign store — item 3 writes to
  `CAMPAIGN.unlocks`) and **011** (Menace — item 1's decoupling regression
  asserts against `G.menace`). Both have landed by execution time.
- **Category**: feature (three small systems)
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP0 supporting items (`ROADMAP.md:126-130`, the paragraph
  after the HP0 milestone table) · GDD §4, §7, §8, §9 invariants 1 & 7

## Execution model

Plans run **sequentially, on `main`, in numeric order — no feature branches**
(`plans/README.md` "Execution model"). Each plan ends in a commit checkpoint
with all three gates green; **staged plans checkpoint per stage**, and this
plan's three items are exactly those stages (one commit each). By the time
020 executes, **009–019 have already merged to main**, so:

- `js/campaign.js` exists with the versioned `CAMPAIGN` store, `makeCampaign()`
  (whose record already carries `unlocks: []`), and `writeRunToCampaign({ win,
  survivors })` called from `js/run-end.js` **before** `clearSave()` — read
  `plans/010-campaign-store.md` Step 1 for the exact shape. **Item 3 extends
  `writeRunToCampaign`.**
- `js/menace.js` exists; `G.menace` is seeded in `makeState()` and the raid
  sizing formula reads visible strength, not the calendar — read
  `plans/011-menace-scouting.md`. **Item 1 asserts pricing never reads
  `G.menace`.**
- `js/save.js` `SAVE_VERSION` is **≥ 2** (plan 011 bumped it from 1). Read the
  current value before the two additive bumps this plan makes.
- `screens.js` was split into `js/ui/` (plan 009). The trade modal
  (`makeTradeModal`) and the trade *pricing* functions are separate: pricing
  (`adjustedOffer`/`doTrade`) lives in `js/game.js`; the modal moved into a
  `js/ui/` module. Re-locate both by symbol name.

## Why this matters

Three GDD-binding guarantees that the HP0 systems assume but nothing yet
enforces. Each is small; each closes a named hole the feasibility attack or an
anti-degeneracy invariant calls out.

1. **The trader is an infinite-conversion engine and an accidental
   turtle-reward.** GDD §7 (`GDD.md:313-316`) requires finite stock, prices
   with **demand-memory** ("what you drained last visit is scarce and dear next
   visit"), seasonal drift, and pricing **decoupled from Menace** — noting v1
   "accidentally gave the low-Menace turtle a discount." Invariant 7
   (`GDD.md:357`) is binding: "Trader carries no infinite conversion at any
   price stack (demand-memory)." Today prices are a flat table with only a
   winter-food markup and a perk discount (`js/game.js:409-419`) and **no
   stock, no memory** — a fixed spread the player can grind.
2. **Quiet days violate the decision cadence.** GDD §4 (`GDD.md:240-242`):
   "one meaningful choice every 2–3 minutes, now with a **guaranteed deck-proc
   floor** (at least one event/arrival/ambition beat per game-day — v1 hoped
   RNG would fill quiet days; the attack showed it won't)." Today a day with no
   raid warning, no recruit, and no expedition is genuinely empty.
3. **The first loss must teach, not just cost.** GDD §8 (`GDD.md:336-338`):
   "the first settlement loss unlocks a meaty option ... regardless of legacy
   earned — run 2 must be visibly *different*, since it is forbidden from being
   stronger (P5)." This is the campaign valve the retention attack demands
   (`GDD.md:138-143`) — but it does not exist until something writes it.

Binding **review gates** (not suggestions):

- **GDD P5 (`GDD.md:129-147`), §9 invariant 1 (`GDD.md:343`)**: nothing this
  plan persists may be a modifier. Item 3 writes an **option id string** into
  `CAMPAIGN.unlocks` (per plan 010, "permanent option ids ... never modifiers")
  — never a number. The first-loss unlock makes run 2 *different*, never
  *stronger*; if you find yourself storing a bonus, STOP.
- **§9 invariant 7 (`GDD.md:357`)**: item 1 ships the no-infinite-conversion
  guarantee as an **executable test** over every demand state, not prose.
- **No-degeneracy for the floor beat**: item 2's fallback beat grants **nothing
  mechanical** (no resources, no morale) — a free reward every quiet day is
  farmable. The floor guarantees *a beat happened*, not *a gift arrived*.

## Current state

All excerpts verified at `14fd915`. Vanilla-JS browser game; vitest; all
tuning in `js/balance.js`; `G` singleton in `js/state.js`; versioned saves;
sim modules import directly, view modules through the `game.js` barrel
(AGENTS.md house rules).

### Item 1 — the trade path today

Pricing is a pure-ish function that reads **only** the static table, the perk
deal modifier, and the season — it **already does not read raid or Menace
state** (there is no stock and no memory to decouple, but the decoupling this
plan must *preserve* is real):

```js
// js/game.js:409-419
export function adjustedOffer(i) {
  const o = TRADE[i];
  const d = G.mods.deal;                    // perk 'friends' → 0.2 (js/game.js:448)
  const give = { ...o.give }, get = { ...o.get };
  if (get.food && isWinter()) give.coin = Math.ceil(give.coin * 1.6);   // the only drift today
  if (d) {
    if (get.coin) get.coin = Math.ceil(get.coin * (1 + d));
    if (give.coin) give.coin = Math.max(1, Math.floor(give.coin * (1 - d)));
  }
  return { give, get };
}
```

```js
// js/game.js:421-428
export function doTrade(i) {
  if (!G.trader) return;
  const { give, get } = adjustedOffer(i);
  if (!pay(give)) { notice('You cannot afford that'); return; }
  for (const k in get) G.res[k] += get[k];
  // notice ...
}
```

The offer table (`js/data.js:197-206`) — the only **round-trippable** good is
`food` (it appears on both a sell offer and a buy offer); `scrap`/`herbs` are
sell-only; `meds`/`weapons`/`wood`/`stone` are buy-only:

```js
export const TRADE = [
  { give: { food: 5 },  get: { coin: 3 } },   // sell food
  { give: { scrap: 3 }, get: { coin: 4 } },
  { give: { herbs: 2 }, get: { coin: 2 } },
  { give: { coin: 5 },  get: { food: 8 } },    // buy food  — winter markup applied in adjustedOffer
  { give: { coin: 6 },  get: { meds: 1 } },
  { give: { coin: 9 },  get: { weapons: 1 } },
  { give: { coin: 4 },  get: { wood: 10 } },
  { give: { coin: 4 },  get: { stone: 6 } },
];
```

Trader arrival/departure (`js/game.js:248-262`, `traderTick`): a caravan
spawns at `traderArrive` every 4th day (`G.day % 4 === 2`) from day 3, and
clears at `traderLeave`. `G.trader` is a bare `{ x, y }` and is **persisted**
(`js/save.js:17,25`). The modal reads `adjustedOffer(i)` per row and calls
`doTrade(i)` (`makeTradeModal`, `js/screens.js:945-978` at 14fd915 — moved to
a `js/ui/` module by plan 009).

`G.res` (`js/state.js:15`) is the five-plus stockpile; `G.mods.deal`
(`js/state.js:7`) is the perk discount. **Nothing in this path references
`G.raidNext`, `G.raidActive`, `G.banditsCleared`, or (post-011) `G.menace`** —
`grep -n "menace\|raid\|bandit" js/game.js` around the trade functions finds
none. That is the property to lock in, not repair.

### Item 2 — the dawn pipeline and today's "beats"

```js
// js/dawn.js:7-13
export function onDawn() {
  communeDawn();
  if (!G.gameOver) {
    worldDawn();     // plan 011 inserts menaceDawn() between these two
    save();
  }
}
```

`communeDawn` (`js/game.js:109-162`) is where the day's dawn content resolves —
these are the existing "beats", none of which is guaranteed on a given day:

- season arrival log (`js/game.js:114-123`),
- a possible **desertion** (`js/game.js:127-138`),
- a possible **recruit/arrival** (`js/game.js:139-153`) — "silent dawn
  recruiting", which plan 013 replaces with arrivals-as-decisions,
- raid/horde **warnings** (`js/game.js:154-158`).

Mid-day beats exist too but are not dawn-known: the **road rolls an event**
during an expedition (`js/world.js:131-136`) and the trader arrives
(`js/game.js:248-256`). There is **no counter of "did anything happen today"**
and no fallback. The floor this plan adds must be **extensible**: plans 013
(arrivals) and 021 (event/ambition decks) plug their decks into it.

### Item 3 — the campaign store's write path (from plan 010)

Do not re-derive this — read `plans/010-campaign-store.md` Step 1. The shape
that matters: `makeCampaign()` returns a record with `unlocks: []` ("permanent
option ids (structures/creeds/archetypes) — **never modifiers**") and
`chronicle: []` (entries `{ kind: 'ascension'|'fall', settlement, day,
survivors, cast }`). `writeRunToCampaign({ win, survivors })` is called by
**both** endings in `js/run-end.js` **before** `clearSave()`; on a fall it
pushes a `chronicle` entry with `kind: 'fall'`. **Item 3 hooks the fall
branch of that function.** The same-version backfill in `migrateCampaign`
merges key additions, so item 3 needs **no `CAMPAIGN_VERSION` bump** (it adds
no field — it derives "first loss" from the chronicle and appends to the
existing `unlocks` array).

### The test net and save-shape house rule

- Header pattern for new test files: stub `localStorage`/`performance` before
  dynamic import (`test/raid-path.test.js:1-17`, `test/meta.test.js:1-9`);
  reset singletons by mutating in place (`Object.assign(G, makeState())`).
- `test/balance.test.js` asserts table keys — extend it for the new blocks.
- **Save-shape house rule** (AGENTS.md + plan 004/011 maintenance): any change
  to what `toSaveData` writes ⇒ bump `SAVE_VERSION`, extend `migrate()`, add a
  migration test. Items 1 and 2 each add one additive field group, so each does
  one bump. Note `loadGame` does `Object.assign(G, makeState(), d)`
  (`js/save.js:86`), which already backfills new `makeState` defaults for old
  saves — the migration step is belt-and-suspenders and the test proves it.

## Commands you will need

| Purpose   | Command                                 | Expected on success |
|-----------|-----------------------------------------|---------------------|
| Install   | `pnpm install`                          | exit 0              |
| Tests     | `pnpm test`                             | all pass            |
| One file  | `pnpm vitest run test/trade.test.js`    | that file passes    |
| Typecheck | `pnpm check`                            | exit 0              |
| Lint      | `pnpm lint`                             | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137      | manual check        |

Debug hooks: `window.G`, `window.ff(minutes)` (fast-forward) — see AGENTS.md.

## Scope

**In scope**:
- **Item 1**: `js/trade.js` (create — pure demand/pricing helpers),
  `js/game.js` (`adjustedOffer`/`doTrade`/`traderTick` become thin wrappers),
  `js/balance.js` (+`trade` block; move the inline `1.6` winter markup into
  it), `js/state.js` (+`traderDemand`), `js/save.js` (persist it; bump), the
  trade modal's `draw` (show stock/dearness — one string), `test/trade.test.js`
  (create), `test/balance.test.js` (+keys), `test/save.test.js` (+round-trip).
- **Item 2**: `js/beats.js` (create — the deck registry + floor), `js/game.js`
  (`communeDawn` notes its real beats and calls the floor at its end),
  `js/balance.js` (+`cadence` block), `js/state.js` (+`beatsToday`,
  `lastBeatDay`), `js/save.js` (persist; bump), `test/beats.test.js` (create).
- **Item 3**: `js/campaign.js` (extend `writeRunToCampaign`'s fall branch),
  `js/balance.js` (+`campaign.firstLossUnlock` placeholder id), additions to
  `test/campaign.test.js`.

**Out of scope** (do not touch):
- The **arrivals** system (plan 013) and the **event/ambition deck content**
  (plan 021) — item 2 ships the *floor and the registry interface* they plug
  into, plus a single placeholder fallback beat, not real decks.
- **Surfacing** the first-loss unlock — plan 017's wagon camp reads
  `CAMPAIGN.unlocks` and offers the option. Item 3 only *writes* the id.
- Trader **movement/spawn cadence**, the perk `friends` discount, expedition
  road events, morale — all unchanged.
- Any pricing dependency on Menace/raids — item 1 forbids it, does not add it.
- New save/campaign *shape beyond* the additive fields named above.

## Git workflow

- **On `main`, no branch** (execution model above). One commit per item-group,
  each with all three gates green. Imperative messages
  ("Add trader demand-memory and finite stock", "Add the deck-proc floor",
  "Grant a first-loss content unlock").
- Do NOT push or open a PR unless the operator instructed it.

---

## Item 1 — Trader demand-memory + Menace-decoupled pricing

**GDD §7 (`GDD.md:313-316`), §9 invariant 7 (`GDD.md:357`).** Prices remember
what you drained (scarce + dear next visit), stock is finite, seasonal drift is
table-driven, pricing never reads Menace — and **no buy/sell cycle profits at
any demand state**.

### Design

**The demand model, in one sentence**: buying a good *drains the trader's
stock of it* and *raises its buy-price*; both effects **decay toward neutral**
each new caravan (drift). Selling is unaffected by demand. Because demand only
ever makes buy-prices **dearer** (≥ base) and sell-prices are **flat**, and the
base spread is already lossy, the no-infinite-conversion invariant holds
**structurally at every demand state** — the test proves it, but the design is
what guarantees it.

**State** (`js/state.js`, `makeState()`): add

```js
traderDemand: {},   // good -> surcharge multiplier ≥ 1 (absent = 1.0 = neutral).
                    // Rises when the player BUYS that good; decays each caravan.
```

`G.trader` gains a per-visit `stock` map when a caravan arrives (set in
`refreshTrader`, below) — it is transient visit state and rides along in the
existing `trader` save field.

**New module `js/trade.js`** (imports `state.js`, `balance.js`, `data.js` only
— cycle-safe; `balance.js` imports nothing). Pure helpers first (no `G` reads,
unit-testable), then the two impure lifecycle calls:

```js
// Pure — the demand math (BALANCE.trade = TR).
demandOf(demand, good)      = Math.min(TR.demandCap, demand[good] ?? 1);
buyCoin(baseCoin, mult)     = Math.ceil(baseCoin * mult);              // dearer, never cheaper
stockFor(good, mult)        = Math.floor((TR.stockBase[good] ?? Infinity) / mult); // scarcer
// good is "drained" by buying `units`: additive surcharge, capped.
bumpDemand(demand, good, units) → demand[good] = min(demandCap, (demand[good] ?? 1) + demandStep*units)
decayDemand(demand)         → each good drifts toward 1 by demandDecay (drop entries at ~1)
```

- `refreshTrader()` — called from `traderTick` **when a caravan spawns**
  (`js/game.js:251-255`, inside the `if (spots.length)` block, right after
  `G.trader = {...}`): `decayDemand(G.traderDemand)` (seasonal drift toward
  neutral for anything not re-drained), then set `G.trader.stock` = for each
  buy-side good, `stockFor(good, demandOf(G.traderDemand, good))`.
- `adjustedOffer(i)` (`js/game.js`) becomes a thin wrapper that calls a pure
  `priceOffer(TRADE[i], G.traderDemand, G.trader?.stock, { winter: isWinter(),
  deal: G.mods.deal })` returning `{ give, get, stock }`:
  - **buy offer** (`get` is a non-coin good `g`): `give.coin =
    buyCoin(o.give.coin * mult, ...)` where `mult = demandOf(demand, g)`; the
    winter food markup (`TR.winterFoodMarkup`, was the inline `1.6`) multiplies
    when `g === 'food'`; the get amount is **clamped to remaining stock**
    (`stock[g]`), so a drained good greys out at 0. Perk `deal` applies as
    today, **after** demand.
  - **sell offer** (`give` is a non-coin good): unchanged except perk `deal` —
    **demand does not touch sell prices** (the invariant's structural
    guarantee).
- `doTrade(i)` (`js/game.js:421-428`): after crediting `get`, for each non-coin
  good obtained call `bumpDemand(G.traderDemand, good, units)` and decrement
  `G.trader.stock[good]`. Reject the trade if stock is insufficient
  (`notice('The trader is out of that')`).

**Balance** (`js/balance.js`, new `trade:` block, terse-commented):

```js
trade: {
  demandStep: 0.12,      // +12% dearer per unit bought this visit (additive surcharge)
  demandDecay: 0.4,      // 40% of the surcharge sheds each new caravan (drift toward neutral)
  demandCap: 2.5,        // dearest a fully-drained good ever gets (× base coin)
  winterFoodMarkup: 1.6, // was inline in adjustedOffer (js/game.js:413) — now table-driven
  stockBase: { food: 24, wood: 30, stone: 18, meds: 2, weapons: 2 }, // per-visit buy-side units
},
```

**Why the invariant holds** (executor: re-derive before trusting). The only
round-trippable good is `food`. `sell food` = 5 food → 3 coin (flat).
`buy food` = 5 coin → 8 food at neutral, and demand only **raises** the coin
cost / **lowers** the food yield.

- *food → coin → food*: 5 food → 3 coin; 3 coin buys `floor(3 · 8/5 / mult)`
  food = 4 at neutral (`mult`=1), fewer as `mult` climbs. `4 < 5` ⇒ loss at
  every demand state.
- *coin → food → coin*: 5 coin → `floor(8/mult)` food → sell at 3 coin per 5
  food. At neutral: 8 food → 4 coin < 5 coin. Dearer demand shrinks the food
  bought ⇒ deeper loss.

Since buy-prices are monotone non-decreasing in demand and sell-prices are
constant, **no `(mult ≥ 1)` makes any cycle non-lossy** — that is the property
Step 1.4 brute-forces over a demand grid.

### Steps

**Step 1.1 — BALANCE + `js/state.js` + `js/trade.js`.** Add the `trade` block.
Add `traderDemand: {}` to `makeState()`. Create `js/trade.js` with the pure
helpers and `refreshTrader`/`priceOffer` exactly per Design (JSDoc the
`priceOffer` inputs — `pnpm check` runs tsc over `js/`). Do not wire `game.js`
yet.
**Verify**: `pnpm check && pnpm lint` → exit 0.

**Step 1.2 — `test/trade.test.js` (pure + invariant).** Stub-then-import
header (copy `test/raid-path.test.js:1-17`), import `state.js`, `trade.js`,
`balance.js`. Tests:
1. **Neutral pricing equals today**: with `traderDemand = {}` and no winter,
   `priceOffer` on each `TRADE` row reproduces the pre-plan `adjustedOffer`
   output (the 8 offers hard-coded as expected values — regression against the
   current table).
2. **Demand memory**: `bumpDemand({}, 'food', 4)` then `demandOf` returns
   `min(demandCap, 1 + 0.12·4)`; the food buy offer's `give.coin` rises and its
   stock (`stockFor`) falls versus neutral. `decayDemand` moves it back toward
   1 by `demandDecay`; an entry that reaches ≈1 is dropped.
3. **Seasonal drift**: `{ winter: true }` applies `winterFoodMarkup` to the
   food buy offer only; sell offers and non-food buys unchanged.
4. **No infinite conversion (§9 invariant 7 — the review gate)**: for every
   good `g` and for `mult` swept over `{1, 1.3, 1.8, 2.5}` (and the paired
   winter/no-winter cases), assert **no cycle nets a gain**:
   `sellCoin(g) < buyCoinForOneUnit(g, mult)` wherever both a sell and a buy
   offer for `g` exist, **and** `coin → g → coin` and `g → coin → g` both end
   strictly below the starting amount. This must be an `expect` loop, not a
   comment.
5. **Menace-decoupled (the roadmap's decoupling requirement)**: import
   `state.js`; set `G.menace = { value: 200, ledger: [] }` (plan 011's shape),
   `G.banditsCleared = 9`, `G.raidActive = true` — `priceOffer` output is
   **identical** to the same call with those cleared. (Grounds the claim that
   the low-Menace turtle gets no discount — pricing never reads that state.)

**Verify**: `pnpm vitest run test/trade.test.js` → all pass.

**Step 1.3 — wire `js/game.js` + the modal string + persistence.**
- Rewrite `adjustedOffer`/`doTrade` as the thin wrappers (Design); add
  `refreshTrader()` to `traderTick`'s spawn block. Import from `./trade.js`
  directly (sim module).
- Trade modal `draw` (re-locate `makeTradeModal` — `js/ui/` per plan 009): in
  the per-row `draw`, when a buy offer's `stock` is 0 show it greyed/`sold
  out`; add one status line noting a drained good is "dear" (read
  `demandOf(G.traderDemand, g) > 1`). Keep it to one string — the modal is not
  the deliverable, the memory is.
- `js/save.js`: add `traderDemand` to the `toSaveData` destructure and returned
  object; bump `SAVE_VERSION` to its **current value + 1**; add a migrate step
  `if (d.version < NEW) { d.traderDemand = d.traderDemand || {}; d.version =
  SAVE_VERSION; }`. (`G.trader.stock` needs no migration — it is recomputed on
  the next caravan.)
- `test/save.test.js`: round-trip a non-empty `traderDemand` through
  `save()`/`loadGame()`; and an old-save test (write a save, `delete
  raw.traderDemand; raw.version = OLD`, reload, assert `G.traderDemand`
  deep-equals `{}`).

**Verify**: `pnpm check && pnpm lint && pnpm test` → all green. Manual
(`pnpm dev`): trade food repeatedly at one caravan → price climbs, stock falls,
row greys at 0; `ff` past `traderLeave` to the next caravan → the good is still
dearer than base but has drifted down; changing nothing about raids/Menace
changes any price.

**Commit checkpoint (item 1)**: "Add trader demand-memory and finite stock".

---

## Item 2 — Guaranteed deck-proc floor

**GDD §4 (`GDD.md:240-242`).** At least one event/arrival/ambition beat per
game-day; a dawn-time fallback fires if the day would otherwise be quiet. The
floor is **extensible** — plans 013 and 021 register their decks through it.

### Design

**State** (`js/state.js`): `beatsToday: 0`, `lastBeatDay: 1`.

**New module `js/beats.js`** (imports `state.js`, `balance.js` only). The
**registry interface** future plans consume:

```js
// A deck source. `tryProc(day)` returns a beat object (any truthy value that
// the source itself has already applied/logged) or null if it declines today.
// Plans 013 (arrivals) and 021 (events/ambitions) call registerDeck once at
// import time; the floor consults them in registration order.
export function registerDeck(deck) { DECKS.push(deck); }   // deck = { id, tryProc }

// Any system that produces a real beat calls this so the floor knows the day
// is not empty. `kind` is 'arrival' | 'event' | 'ambition' | 'raid' | 'season'.
export function noteBeat(kind, why) {
  G.beatsToday++;
}

// Called at the END of communeDawn (after the day's dawn beats have resolved).
// Rolls over the day counter, then guarantees the floor for the NEW day: if no
// registered deck offers a beat, fire the built-in fallback (flavor only).
export function beatFloorDawn() {
  G.beatsToday = 0;                 // new day starts empty
  G.lastBeatDay = G.day;
  for (const d of DECKS) { if (d.tryProc(G.day)) { G.beatsToday++; return; } }
  if (BALANCE.cadence.floorEnabled && G.beatsToday === 0) fireFallbackBeat();
}
```

**Ordering subtlety** (state it in a code comment): the existing dawn beats in
`communeDawn` — season arrival, desertion, recruit, raid/horde warning — must
call `noteBeat(...)` at their sites so a day that already has real content does
**not** also fire a fallback. Because those resolve **above** the
`beatFloorDawn()` call at the end of `communeDawn`, `G.beatsToday` already
reflects them when the floor checks. Mid-day beats (expedition road events,
trader arrival) are **bonus** — the floor guarantees a *minimum of one*, not
*exactly one*; a fallback that fires at dawn on a day that later also has a road
event is acceptable and expected.

**The fallback beat** is **flavor only** — no resources, no morale (no-degeneracy
gate: a farmable quiet-day reward is banned). At 020 scope it is a single
neutral observation drawn from a tiny built-in list in `js/beats.js` (an Elder
line, e.g. `'The camp is quiet — the Elder watches the treeline.'`), logged via
`addLog`. **Plan 021 replaces this placeholder by registering the real event
deck** through `registerDeck`; when a real deck answers, the fallback never
fires. Do not build event *content* here.

**Balance** (`js/balance.js`, new `cadence:` block):

```js
cadence: {
  floorEnabled: true,   // the deck-proc floor (GDD §4). Off = pure RNG days (v1's failed hope).
},
```

### Steps

**Step 2.1 — BALANCE + state + `js/beats.js`.** Add the `cadence` block;
add `beatsToday`/`lastBeatDay` to `makeState()`. Create `js/beats.js`:
`registerDeck`, `noteBeat`, `beatFloorDawn`, the private `DECKS` array,
`fireFallbackBeat` (imports `addLog` — re-locate its source, currently
`js/game.js`/`js/journal.js`; if importing it creates a cycle, pass the log via
a tiny injected sink or import from the logging module directly). JSDoc the
`deck` shape.
**Verify**: `pnpm check && pnpm lint` → exit 0.

**Step 2.2 — wire `communeDawn`.** In `js/game.js`:
- Import `noteBeat`, `beatFloorDawn` from `./beats.js` (sim module, direct).
- Call `noteBeat(...)` at each real dawn beat: season arrival
  (`js/game.js:114-123`), desertion (`js/game.js:135`), recruit
  (`js/game.js:147`), raid/horde warning (`js/game.js:154-158`).
- Call `beatFloorDawn()` as the **last statement of `communeDawn`** (after the
  `daysToWinter()` line, `js/game.js:161`) — but guard it behind the early
  returns already in `communeDawn` (`communeAscended`/`communeFallen` return
  early on ascension/last-settler-desertion; a beat on a day the run ends is
  pointless — placing the call at the natural end, after those returns, handles
  it for free).
- Also `noteBeat('event', ...)` at the expedition road-event site
  (`js/world.js:134-135`, the ambush/kind-road branches) and the trader-arrival
  log (`js/game.js:253`) — cheap, and it keeps `beatsToday` honest for any
  future same-day floor logic; optional but recommended, note it.

**Step 2.3 — persistence.** `js/save.js`: add `beatsToday`, `lastBeatDay` to
`toSaveData`; bump `SAVE_VERSION` to current + 1; migrate step defaulting both
to `0`/`1`. (Note: a second bump in the same plan — item 1 did the first. Two
sequential migration entries; each with its own test.)

**Step 2.4 — `test/beats.test.js`.** Stub-then-import header; import
`state.js`, `beats.js`, `balance.js`; `beforeEach`: `Object.assign(G,
makeState())` and clear `DECKS` between tests (export a `_resetDecks()`
test-only helper, or re-import fresh — copy whichever pattern plan 011 used for
its module-level caches). Tests:
1. **Quiet day fires exactly one fallback**: no `noteBeat`, no decks →
   `beatFloorDawn()` → `G.beatsToday === 1` and the log's newest line is the
   fallback (spy `addLog` or read `G.log`).
2. **A day with a real beat fires no fallback**: `noteBeat('season', ...)`
   then `beatFloorDawn()` → the fallback line is **not** appended (only the
   noted beat counts; `beatsToday === 1` from the note, and the fallback branch
   is skipped).
3. **Registry suppresses the fallback**: `registerDeck({ id: 'x', tryProc: ()
   => ({ kind: 'event' }) })`, then `beatFloorDawn()` → no fallback line; a
   deck whose `tryProc` returns `null` does **not** suppress it.
4. **`floorEnabled: false`** (monkeypatch `BALANCE.cadence.floorEnabled` in the
   test, restore after): a quiet day fires **no** fallback.
5. **Rollover**: `beatFloorDawn()` sets `lastBeatDay = G.day` and resets
   `beatsToday` to reflect only the new day.

**Verify**: `pnpm vitest run test/beats.test.js` → all pass; `pnpm test` →
full suite green. Manual (`pnpm dev`): `ff(1440)` across a deliberately quiet
day → the fallback line appears once at dawn; a day with a raid warning shows
no fallback.

**Commit checkpoint (item 2)**: "Add the deck-proc floor".

---

## Item 3 — First-loss content-unlock guarantee

**GDD §8 (`GDD.md:336-338`), P5/§9 invariant 1 review gate.** The first
settlement loss in a campaign unlocks a meaty **option** regardless of legacy;
run 2 is visibly *different*, never *stronger*.

### Design

Extend plan 010's `writeRunToCampaign` (in `js/campaign.js`). On a **fall**
(`win === false`), after the `chronicle` entry is pushed, check whether this is
the campaign's **first** recorded loss and, if so, append the placeholder
unlock id to `CAMPAIGN.unlocks` (dedup — never twice):

```js
// after the existing chronicle.push({ kind: win ? 'ascension' : 'fall', ... }):
if (!win) {
  const falls = CAMPAIGN.chronicle.filter(c => c.kind === 'fall').length;
  const id = BALANCE.campaign.firstLossUnlock;         // placeholder id (string)
  if (falls === 1 && !CAMPAIGN.unlocks.includes(id)) CAMPAIGN.unlocks.push(id);
}
```

`falls === 1` because the current fall's chronicle entry was just pushed, so
the first-ever fall makes the count exactly 1 — no new field, no
`CAMPAIGN_VERSION` bump (the same-version backfill already covers `unlocks`).
`js/campaign.js` already imports what it needs; add `import { BALANCE } from
'./balance.js';` if plan 010 did not (cycle-safe — `balance.js` imports
nothing).

**Balance** (`js/balance.js`, new `campaign:` block — the single knob):

```js
campaign: {
  firstLossUnlock: 'first-loss-option', // placeholder option id granted on the first
                                         // settlement loss (GDD §8). Plan 017's wagon camp
                                         // surfaces it; plan 013/017 replace this with a
                                         // real creed/arrival-archetype id. NEVER a modifier (P5).
},
```

**Review gate (GDD P5 / §9 invariant 1)**: the value stored is a **string id**,
not a number — it makes run 2 *different* (a new option offered at the wagon
camp), never *stronger*. `js/campaign.js` (plan 010) already forbids modifiers
in the record by construction; this item does not weaken that. Because plan 020
cannot yet *apply* the unlock (plan 017 surfaces it), the P5 gate here is
**structural and tested**: the unlock is a string present in `CAMPAIGN.unlocks`
and carries no numeric payload.

### Steps

**Step 3.1 — BALANCE + `writeRunToCampaign`.** Add the `campaign` block. Splice
the first-loss branch into `writeRunToCampaign` exactly per Design, after the
existing chronicle push. Do not alter the ascension branch, the survivor write,
or the ordering guarantee (plan 010's reason to exist).
**Verify**: `pnpm check && pnpm lint` → exit 0.

**Step 3.2 — extend `test/campaign.test.js`** (the file plan 010 created; reuse
its stub-then-import header, `resetCampaign`, and `G` reset). Add:
1. **First fall unlocks the option**: fresh `CAMPAIGN`, `G.settlers = []`,
   `usedNames` seeded → `communeFallen()` (import from `run-end.js` as plan 010
   does) → `CAMPAIGN.unlocks` includes `BALANCE.campaign.firstLossUnlock`
   exactly once; the chronicle has one `kind: 'fall'` entry.
2. **Second loss does not re-add or add another**: after test 1, reset the run
   (`Object.assign(G, makeState())`, empty settlers) and fall again →
   `CAMPAIGN.unlocks` still contains the id exactly once (dedup), `chronicle`
   now has two falls.
3. **Ascension does not grant the first-loss unlock**: fresh campaign,
   `communeAscended()` with survivors → `CAMPAIGN.unlocks` does **not** contain
   the first-loss id.
4. **P5 review gate**: assert `typeof BALANCE.campaign.firstLossUnlock ===
   'string'` and that the unlock pushed carries no numeric/modifier payload
   (it is the bare string). Cross-check nothing in `CAMPAIGN.unlocks` is a
   number — a one-line guard that trips if a future edit stores a modifier.

**Verify**: `pnpm vitest run test/campaign.test.js` → all pass (old plan-010
tests **unchanged** and green — item 3 must not disturb them; if a plan-010
ordering or shape test fails, STOP). `pnpm test` → full suite green.

**Commit checkpoint (item 3)**: "Grant a first-loss content unlock".

---

## Final step: update `plans/README.md`

Add (or set, if a row exists) this plan's row in the execution-order table:

```
| 020 | Supporting HP0 systems (trader demand-memory · deck-proc floor · first-loss unlock) | HP0 supporting | P1 | M | 010, 011 | DONE |
```

Under "Dependency notes", add: item 2's registry (`registerDeck`/`noteBeat` in
`js/beats.js`) is the interface **plans 013 (arrivals) and 021 (event/ambition
decks)** plug into; item 3's placeholder `firstLossUnlock` id is **surfaced by
plan 017's wagon camp** and should be **replaced with a real option id by plan
013/017**.

**Verify**: `git diff plans/README.md` shows only the added row + the note.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/trade.test.js` (~5:
neutral regression, demand memory, seasonal drift, no-infinite-conversion
grid, Menace-decoupled), `test/beats.test.js` (~5: quiet-day fallback, real-beat
suppression, registry, disabled-floor, rollover), `test/campaign.test.js`
(+4: first fall, dedup, ascension-no-grant, P5 gate), `test/balance.test.js`
(+ key presence for `trade`/`cadence`/`campaign`), `test/save.test.js` (+2
round-trip/old-save) — all green alongside the existing suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] **Item 1**: `js/trade.js` exists; `adjustedOffer`/`doTrade` are thin
      wrappers; buying a good raises its price and lowers its stock, both
      decaying per caravan; the no-infinite-conversion test loops over a demand
      grid; `grep -n "menace\|raidActive\|banditsCleared" js/trade.js` → **no
      hits** (pricing reads none of them), pinned by the decoupling test
- [ ] **Item 2**: `js/beats.js` exports `registerDeck`/`noteBeat`/
      `beatFloorDawn`; a quiet day fires exactly one flavor fallback that
      grants **nothing** mechanical; a real-beat day fires none; the registry
      suppresses the fallback
- [ ] **Item 3**: the first fall in a campaign appends
      `BALANCE.campaign.firstLossUnlock` (a **string**) to `CAMPAIGN.unlocks`
      exactly once; ascension and later falls do not; the P5 gate test asserts
      no numeric payload
- [ ] `SAVE_VERSION` bumped twice (items 1 and 2), each with a migration step
      and a test; `test/save.test.js` proves old saves backfill the new fields
- [ ] Plan 010's `test/campaign.test.js` ordering/shape tests pass **unchanged**
- [ ] `plans/README.md` row added; `git status` shows only in-scope files
- [ ] Three commits, one per item-group, each with green gates

## STOP conditions

- **Item 1**: any excerpt of `adjustedOffer`/`doTrade`/`TRADE`/`traderTick` no
  longer matches (a prior plan already reworked pricing — e.g. it now reads
  `G.menace`): re-derive, and if pricing already touches raid/Menace state,
  **report** — decoupling it is then a real change, not a preservation.
- **Item 1**: the no-infinite-conversion test cannot pass with the Design
  numbers (a cycle profits at some demand state) — the model, not the test, is
  wrong; report which good/`mult` inverts the spread. Do **not** loosen the
  test.
- **Item 2**: `communeDawn`'s early-return structure changed such that
  `beatFloorDawn()` at its end would fire on a run-ending day, or `addLog`
  cannot be imported into `js/beats.js` without a cycle — report the cycle
  rather than inverting a dependency.
- **Item 3**: plan 010's `writeRunToCampaign` is not present or its signature
  differs from `plans/010-campaign-store.md` (010 did not land, or landed
  differently) — item 3 has nothing to hook; **report**, do not recreate the
  store.
- **Any item**: you find yourself storing a number that sim code could read as
  a bonus (a demand "discount" carried across runs, a farmable floor-beat
  reward, a numeric first-loss unlock) — that violates GDD P5 / §9 invariants
  1 & 7. STOP; this is a design gate.
- Any test outside this plan's files fails after a wiring step — those
  characterize behavior this plan must not change; report, do not adjust them.

## Maintenance notes

- **The no-infinite-conversion test is a living constraint** (GDD §9.7): any
  retune of `BALANCE.trade` or the `TRADE` table must keep it green. New
  round-trippable goods (a good with both a sell and a buy offer) must be
  covered by the grid automatically — the test iterates the table, so it will.
- **The demand model's guarantee is structural**: buy-prices monotone-up in
  demand, sell-prices flat. If a future "the trader pays more for what it's
  short on" feature is wanted, it must re-prove the invariant — the flat
  sell-side is load-bearing, not incidental.
- **The deck registry is the extension point**: plans 013 and 021 call
  `registerDeck({ id, tryProc })`; when a real deck answers a day, the
  placeholder fallback never fires and can be deleted once plan 021's deck is
  the default source. Keep the fallback **reward-free** until then.
- **The first-loss unlock is a placeholder**: `firstLossUnlock:
  'first-loss-option'` must be replaced with a real creed/arrival-archetype id
  by plan 013/017, and plan 017's wagon camp is its first reader. It remains a
  **string id, never a modifier** (P5) across every future edit.
- **Two save-version bumps in one plan** is deliberate (one per independently
  committed item). If a later plan collapses them, keep both migration tests.
