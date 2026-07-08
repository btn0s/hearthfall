# Plan 017: The campaign layer — wagon camp, campaign map v0, the founding draft, aging (HP-8)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` (Step 12).
>
> **Execution model**: plans run **sequentially, on `main`, in numeric order**;
> by the time this plan executes, **009–016 have landed on main**. That means:
> (a) `js/screens.js` is now just the game screen — the title screens live in
> `js/ui/title.js`, the modals in `js/ui/modals.js`, the sidebar in
> `js/ui/sidebar.js`, the world screen in `js/ui/world-screen.js` (plan 009);
> (b) `js/campaign.js` exists as the versioned store and `js/run-end.js` writes
> survivors through `writeRunToCampaign(...)` **before** `clearSave()` (plan
> 010); (c) settlers carry per-person `resolve`/`wants`/`scars`/`weapon` and
> `toBandMember` copies `wants`/`scars` (plan 012); (d) the run-end path has the
> **Torch** and **Last Stand** endings, `G.ending`, and a four-way game-over
> epitaph (plan 016). Every code excerpt below is anchored at commit `14fd915`
> (this plan's baseline, **before** 009–016). **Re-locate every cited site by
> symbol name** (function/export), not by line number — 009 moved the title and
> modal code out of `js/screens.js` entirely, and 010/012/016 reshaped
> `js/campaign.js` and `js/run-end.js`.
>
> **Drift check (run first)**:
> `git diff --stat 14fd915..HEAD -- js/campaign.js js/run-end.js js/game.js js/settlers.js js/state.js js/data.js js/balance.js js/meta.js js/screens.js js/main.js js/ui/ test/`
> If `js/campaign.js` has no `writeRunToCampaign({ win, survivors })` export
> that runs **before** `clearSave()` in both `communeFallen`/`communeAscended`
> (and, post-016, `lastStand`/`torch`), **STOP** — plan 010 is this plan's
> read/write substrate and 016 is its survivor source; their shape is a hard
> precondition. Re-read `plans/010-campaign-store.md` (the store, `makeCampaign`,
> `BAND_MEMBER_FIELDS`, `toBandMember`, the same-version backfill in
> `migrateCampaign`) and `plans/016-endings.md` (the Torch's `survivors:` write)
> before designing.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (the first *reader* of the campaign store; introduces three
  new full screens, a run-founding path that seeds settlers from persisted
  band members, an aging tick that runs inside the shared ending write, and a
  decision on the legacy/perks vs options question plan 010 deferred here.
  Additive to the sim, but it changes what `writeRunToCampaign` does with
  survivors — plan 010/016 tests that assert post-write band shape must be
  updated honestly)
- **Depends on**: **010** (the campaign store — `CAMPAIGN.band`, `.map`,
  `.unlocks`, `.chronicle`; `writeRunToCampaign`; `BAND_MEMBER_FIELDS`), **016**
  (the Torch writes the chosen survivors this layer receives); **009** landed
  first (new screens go in `js/ui/*`), **012** landed (band members carry
  `wants`/`scars`; aging shifts wants, never stats)
- **Category**: feature
- **Planned at**: commit `14fd915`, 2026-07-08
- **Roadmap ID**: HP-8 (`ROADMAP.md:122`, Milestone HP0) · GDD §3
  (`GDD.md:194-221`), §4 founding (`GDD.md:223-242`), P5 (`GDD.md:129-147`),
  P1 cap (`GDD.md:60-69`), §9.1(1)/(6) (`GDD.md:343-356`)

## Why this matters

Everything HP0 built so far is *inside* a settlement. The store (010) persists
a band, a map, and unlocks, but **nothing reads them** — 010 shipped write-only
by design (`plans/010-campaign-store.md:504-508`). The endings (016) write real
survivors into `CAMPAIGN.band`, but the player never meets them again. Until the
loop closes — *this settlement ended, now what happens to my people before the
next one* — the core hypothesis is untestable: "does a persistent, mortal,
aging band whose settlements die make players found the next settlement?"
(`GDD.md:368-369`). HP-8 is where the **outer game becomes visible**: the wagon
camp between settlements, the campaign map you found on, the draft of *your own
people*, and the aging that makes the band generational.

The four surfaces (GDD §3, §4):

1. **The wagon camp** (`GDD.md:214-217`) — the between-settlements hub, made
   diegetic and short: tend the wounded, hear wants, **spend legacy on
   *options*** (never stats — P5), pick the next site, choose a creed slot.
   "No shop screens; the band is the menu."
2. **The campaign map v0** (`GDD.md:205-213`) — a small set of candidate sites
   with a visible quirk shown *before* founding; **lit Beacons stay lit**
   (permanent light from `CAMPAIGN.map.litBeacons`); one canned **your-ruins**
   site drawn from a prior fall's `CAMPAIGN.map.ruins` entry. Site choice
   "replaces v1's cast-draft as the run-variety authorship moment."
3. **The founding draft** (`GDD.md:225-228`) — the *real* draft: "pick who
   comes — which of MY people do I risk, meaningful precisely because they're
   yours." A first-class screen: pick a subset of the band (cap 12 fielded),
   pick a creed if unlocked, land and light the hearth.
4. **Aging, simplest form** (`GDD.md:201-204`) — members age one step per
   settlement survived; life stages Green → Prime → Grey shift wants and
   torch-risk, **never raw stats** (P5); the Grey retire into the Chronicle. A
   campaign spans generations by design (heirs are vLater — **do not build
   them**).

Two invariants govern this plan and are **review gates**, encoded as tests:

- **P5 / §9.1(1) (`GDD.md:129-147`, `GDD.md:343`)**: what crosses between
  settlements is *history, never stats*. Age, wants, scars, unlocked options —
  all zero-modifier. The falsifier is explicit: "veterans measurably outperform
  recruits with identical trait/equipment" (`GDD.md:144-145`). **The wagon
  camp's legacy spend yields an option id, never a number that touches a fight;
  aging never changes a stat.** If any step tempts you to store or spend a
  modifier, STOP — this is a design gate.
- **§9.1(6) (`GDD.md:355-356`)**: no creed or option may reward raw headcount or
  raw passivity; benefits are qualitative. The options table is variety, not
  volume.

## Current state

All excerpts verified at `14fd915`; re-locate by symbol after 009–016.
Vanilla-JS browser game; vitest; all tuning in `js/balance.js`; persistence
conventions in `plans/010-campaign-store.md`; screen contract in `js/ui.js:1-9`;
house rules in `AGENTS.md` (per-minute scan caches, `G` singleton, versioned
saves, sim modules import directly / view modules via the `js/game.js` barrel).

### How a run starts today — `js/screens.js:58-64` (post-009: `js/ui/title.js`) + `js/game.js:441-475`

`beginRun` is the single founding path. At `14fd915` it lives in `js/screens.js`
(009 keeps `beginRun` in the shrunk `js/screens.js`; `makeGameScreen` too):

```js
// js/screens.js:58-64
export function beginRun(civId) {
  newGame(civId);
  genWorld();
  save();
  replaceAll(makeGameScreen());
  push(makeIntroModal());
}
```

`newGame(civId)` resets state and **fabricates fresh settlers** from a fixed
role template plus civ/perk extras:

```js
// js/game.js:441-475 (excerpted)
export function newGame(civId) {
  Object.assign(G, makeState());
  const civ = CIVS.find(c => c.id === civId) || CIVS[0];
  G.civ = civ.id;
  Object.assign(G.mods, civ.mods);
  // ...perk-driven G.mods / G.res bumps (larder, armory, greenthumb, ...) ...
  const { tiles, camp } = genMap();
  G.tiles = tiles; G.camp = camp;
  // ...place campfire (the hearth), tents, farms; seed civ.start resources...
  const roles = ['farmer', 'worker', 'worker', 'guard'];
  if (civ.start.settler) roles.push(civ.start.settler);
  if (hasPerk('fifth')) roles.push('worker');
  const spots = openAround(camp.x, camp.y, roles.length);
  roles.forEach((r, i) => { G.settlers.push(makeSettler(spots[i] || camp, r)); });
  // ...opening log lines...
}
```

`set(0, 0, 'campfire')` (`js/game.js:454`) **is** the founding hearth — the
lit hearth GDD §4 asks the founding to "light" already exists here. `genMap()`
(`js/map.js`, `js/game.js:7`) makes the in-run tile map; `genWorld()`
(`js/world.js`) makes the in-run expedition overworld. **Neither is the
campaign map** this plan introduces — that is a *third*, persistent map in
`CAMPAIGN.map` (010's note: `G.world` is the in-run overworld, distinct from the
persistent campaign map).

The menu → founding chain (post-009 `js/ui/title.js`; `14fd915`
`js/screens.js:67-187`): `makeMenuScreen` "New Game" pushes `makeCivScreen`;
`makeCivScreen` rows call `beginRun(c.id)` (`js/screens.js:118,137`);
`makeLegacyScreen` spends `META.points` on stat perks via `buyPerk`
(`js/screens.js:159,175`). Boot pushes the menu: `replaceAll(makeMenuScreen())`
(`js/main.js:13`).

### How a run ends today — `js/run-end.js` (post-010/016) and the game-over modal

At `14fd915` `js/run-end.js` is pre-010 (25 lines, `communeFallen`/
`communeAscended`, each `endRun(...)` then `clearSave()`). Post-010/016 it
writes survivors first:

```js
// post-010 shape (re-read the actual file):
const r = endRun(G.stats, G.day, { win: false });
G.legacyEarned = r.pts; G.bonusLines = r.bonuses;
writeRunToCampaign({ win: false, survivors });   // ← 010; 016 passes the Torch's chosen
clearSave();
```

The game-over modal (post-009 `js/ui/modals.js`; `14fd915`
`js/screens.js:1062-1099`) is where the run hands back to the menu. At `14fd915`
its only exits are `[R] rise again` → civ screen and `[M] main menu`:

```js
// js/screens.js:1063-1064,1067,1096
const toCiv = () => replaceAll(makeMenuScreen(), makeCivScreen());
const toMenu = () => replaceAll(makeMenuScreen());
// keymap: { r: toCiv, R: toCiv, Enter: toCiv, m: toMenu, M: toMenu, Escape: toMenu }
str(x0 + 2, y, '[R] rise again    [M] main menu', '#e8c860', bg);
```

Post-016 this modal branches on `G.ending` (victory / fall / laststand / torch).
**This plan repoints its "onward" exit at the wagon camp** whenever the campaign
continues (survivors walked out, or reserves remain), so the loop closes into
the outer game instead of jumping to a fresh civ pick. It is force-pushed by
`js/main.js:59` (`G.gameOver && inStack('game') && !inStack('gameover')`).

### The store this reads — `js/campaign.js` (plan 010)

Plan 010 shipped (`plans/010-campaign-store.md` Step 1):

```js
export function makeCampaign() {
  return {
    v: CAMPAIGN_VERSION, nextId: 1, settlements: 0,
    band: [],                                   // [{ id, name, trait, wants:[], scars:[], age:0 }]
    map: { sites: [], litBeacons: [], ruins: [] },
    unlocks: [],                                // permanent option ids — never modifiers
    chronicle: [],                              // [{ kind, settlement, day, survivors, cast }]
  };
}
export const BAND_MEMBER_FIELDS = ['id', 'name', 'trait', 'wants', 'scars', 'age'];
export function writeRunToCampaign({ win, survivors }) { /* pushes toBandMember(s) per survivor */ }
```

Two facts from 010 this plan leans on hard:

- **`migrateCampaign`'s same-version backfill** (`plans/010-campaign-store.md:248-251`,
  Step 2 test #5): `return { ...base, ...d, map: { ...base.map, ...(d.map||{}) } }`.
  **Additive top-level keys are backfilled from `makeCampaign()` without a
  version bump.** This plan adds `embarked`/`civ`/`site` to the record and does
  **NOT** bump `CAMPAIGN_VERSION` (only a backfill test) — the merge covers it.
- **`writeRunToCampaign` is the single campaign write, called once per
  settlement**, guarded by `G.gameOver` idempotence in `js/run-end.js`
  (`plans/010-campaign-store.md:468-478`, 016's shared guard). This plan folds
  the **aging tick** into it, so aging fires exactly once per settlement, before
  `clearSave()`, on the same idempotent path.

But 010's `writeRunToCampaign` pushes a **new** `toBandMember` for *every*
survivor. Once this plan drafts band members *into* a settlement and they
survive, that path would **duplicate** them (member in `band`, plus a fresh
age-0 copy on write-back). 010 flagged this as deferred, not a bug ("the store
is write-only by design"). **Closing that round-trip is HP-8's job** — see
Design → identity.

### Band members and settlers — `js/settlers.js:27-39` (post-012)

At `14fd915` `makeSettler(x, y, role)` (`js/settlers.js:27-39`) picks a unique
name from `NAMES` via `G.usedNames` (`js/settlers.js:28-30`), a random `trait`
(→ `maxHp` 14/20/26 by trait, `js/settlers.js:32`), and run-scoped fields.
Post-012 the record also has `resolve`, `wants:[]`, `scars:[]`, `weapon`,
`bond`, `grudge`, and dawn flags. **Trait → maxHp is P5-legal**: parity is over
*identical trait* (a hardy recruit == a hardy veteran), so history carries no
power. This plan's `seedSettlerFromMember` mirrors that record but overrides
`name`/`trait`/`wants`/`scars` from a persisted band member — same maxHp math,
so veteran-parity holds by construction.

`G.usedNames` (`js/state.js:23`) guarantees **names are unique within a run** —
the property this plan's identity round-trip relies on (matching survivors to
embarked members by name is safe within one settlement).

### The perk system to reconcile — `js/meta.js` + `js/data.js:175-186`

`META.points` is the legacy currency; `buyPerk(id)` (`js/meta.js:32-39`) spends
it on `PERKS` (`js/data.js:175-186`), and **every perk is a flat modifier**:
`larder` `+20 food`, `armory` `+2 weapons`, `timber` `walls 20% tougher`,
`greenthumb` `crops 10% faster`, `ledger` `+25% legacy`, etc. — applied in
`newGame` as `G.mods`/`G.res` bumps (`js/game.js:446-462`). **This is exactly
the "meta purchase that modifies a combat/economy number" §9.1(1) bans**
(`GDD.md:343`) — a pre-GDD-v2 artifact. Plan 010 deferred the perk system's
future to HP-8 (`plans/010-campaign-store.md:176-178, 512`). **This plan decides
it** (Design → legacy vs options).

`CIVS` (`js/data.js:146-171`) carry `mods` too (`crop:1.25`, `guardDmg:2`,
`wallHp:1.34`). These are **lateral founding flavor** chosen fresh each
founding, not accumulated carryover — out of P5's "purchases and carryover"
scope, the same category as a chosen site's quirk. Civ mods stay; this plan does
not touch them.

`CIV_UNLOCKS` (`js/data.js:190-193`) gate civs by lifetime `META.life` stats;
`OBJECTIVES` (`js/data.js:223-238`) is the in-settlement tutorial chain. Neither
is disturbed by the campaign layer (both live inside a run).

### The screen contract and the test net

`js/ui.js:1-9` — screen objects: `{ id, modal, pausesSim, listNav, focus,
widgets, keymap, onKey, onClick, draw, onEnter, onExit }`; `push/pop/replaceAll`
(`js/ui.js:15-20`); hit-testing is geometry over declared widget rects. New full
screens get their own `js/ui/*.js` (009 maintenance note, `plans/009-screens-split.md:529-531`);
`makeListScreen` (`js/ui/menu.js`) is the row-list pattern the wagon camp and
draft reuse.

Test net to extend: `test/campaign.test.js` (010 — the store round-trip, the P5
shape whitelist, the ordering assertion, idempotence); `test/ui-smoke.test.js`
(009 — module-graph/contract smoke for the new screens); header pattern is
stub `localStorage`/`performance` **before** dynamic import
(`test/meta.test.js:1-9`, `test/campaign.test.js`).

## Design (decided here, executed below)

### Decision 1 — legacy vs options (the question 010 deferred to HP-8)

The GDD is unambiguous and already names the home for flat stat bonuses. P5
(`GDD.md:139-143`) sanctions exactly one such home: "an honest, opt-in **assist
mode** (flat, labeled, off the record) — never as creeping power." The existing
`PERKS` are, verbatim, flat labeled stat bonuses. So:

- **The campaign-layer spend is OPTIONS, not perks.** At the wagon camp, legacy
  (`META.points`) buys **options** — qualitative unlock ids (arrival
  archetypes, site types, creed slots, event packs; `GDD.md:132-133`) recorded
  in `CAMPAIGN.unlocks`. An option **never** returns or applies a modifier;
  `spendLegacyOnOption` touches only `META.points` (down) and
  `CAMPAIGN.unlocks` (a string id). This is the P5-clean progression the outer
  game runs on, tested as a falsifier (Step 8).
- **The existing `PERKS` become the P5-sanctioned assist valve.** They stay
  mechanically as-is, reached from the title's Legacy screen, **re-labeled and
  moved off the diegetic campaign path** (a one-line reframe on that screen +
  its README/AGENTS description). The wagon camp does **not** offer them. The
  campaign layer introduces **no new modifier**. Fully excising or gating the
  assist perks behind an explicit toggle is a follow-up (flagged, Maintenance);
  this plan's binding commitment is: *the campaign layer grants only options,
  never stats.*

This reconciliation is honest about the pre-existing violation (`PERKS` modify
fights) without pretending one plan can also re-tune the founding economy: it
re-homes them as the GDD's own assist valve and builds the clean track beside
them.

### Decision 2 — band identity round-trip (closing 010's write-only loop)

The band is the roster of living people at the wagon camp. During a settlement,
the drafted members are *away*; the rest are *reserves* resting at the camp
(`GDD.md:199-200`). Model:

- **New store field `CAMPAIGN.embarked: []`** (member records moved out of
  `band` at founding — additive top-level key, backfilled by `migrateCampaign`,
  **no version bump**). While a settlement runs, `CAMPAIGN.band` holds only the
  reserves; `embarked` holds who left. "Reserves rest at the wagon camp" is
  literal, and no back-link field is needed on the settler (names are unique per
  run — `G.usedNames`).
- **Founding** (`embark(members)`): move `members` from `band` → `embarked`;
  seed one settler per member via `seedSettlerFromMember` (name/trait/wants/
  scars from the member; fresh run stats; role assigned by the draft).
- **Settlement end** (inside `writeRunToCampaign`, replacing 010's blind
  push): for each surviving settler, if its **name matches an embarked member**
  → return that member to `band`, merging the settler's earned `scars`/`wants`
  back onto it (history earned this run persists); else (a gentle-founding
  person or an HP-3 arrival with no embarked match) → `toBandMember(settler)`, a
  new member. Embarked members **not** matched by any survivor **died** — they
  are dropped (campaign permadeath, P1/P6). Clear `embarked`.
- **Reserves** (band members who never embarked) are untouched by the
  reconcile.

This closes the duplication and makes the Torch's chosen survivors (016) return
as *the same people* who left. It changes `writeRunToCampaign`'s observable band
shape → 010/016 tests that assert post-write band contents are updated in Step 6
(owned honestly, not worked around).

### Decision 3 — aging (simplest form, `GDD.md:201-204`)

After the reconcile, in the same `writeRunToCampaign` call (once per settlement,
`G.gameOver`-guarded), **`ageBand()`**:

- `for (m of CAMPAIGN.band) m.age++` — every living member (returned survivors,
  reserves, freshly-added arrivals) ages one step. Age == settlements survived.
- **`lifeStage(m)`** (pure, derived, never stored): `age < primeAge` → `'green'`,
  `< greyAge` → `'prime'`, else `'grey'` — a **named band** (P7,
  `GDD.md:169-173`), shown on the card, never a number.
- **Wants shift by stage, not stats**: when `ageBand` crosses a member into a
  new stage, re-assign its single want from a stage-biased pool over plan 012's
  `WANTS` (`STAGE_WANTS` in `js/data.js`) — Green leans `armed`/`purpose`, Grey
  leans `peace`/`sheltered`. Wants are zero-modifier (display + resolve teeth,
  012), so this is P5-clean.
- **Torch-risk shifts by stage**: `torchRisk(m)` (pure, derived from
  `lifeStage`) is a **display band** the founding/torch UI reads (the Grey earn
  the torch; the Green are eager — `GDD.md:274`). It is exported for HP-4 to
  consume and is **never read by combat/economy** here.
- **The Grey retire into the Chronicle**: after aging, members with
  `age >= retireAge` are removed from `band` and appended to `CAMPAIGN.chronicle`
  as `{ kind: 'retirement', name, age, settlement }`. "A campaign spans
  generations by design" — heirs (`GDD.md:203`) are **vLater; do not build
  them**. An emptied band re-bootstraps via a gentle founding (below).

`ageBand` touches **only** `age` (and, derived, `lifeStage`/want) — the P5
falsifier test (Step 8) pins that no combat stat moves and that a settler seeded
from an aged member has the same `maxHp` as one seeded from a young member of
the same trait.

### Decision 4 — the founding draft (first-class, `GDD.md:225-228`)

A real screen (`js/ui/founding.js`, `makeFoundingDraft`), not a footnote. Shows
**your band** as cards — name, trait, `lifeStage` band, want, scars, torch-risk
band (P7: compressed cards, full detail on the card in a decision). The player:

- **Picks who comes** — toggles a subset; default a sensible fill up to the cap.
  Cap `BALANCE.campaign.fieldCap` (**12**, GDD P1 `GDD.md:60`, `GDD.md:199`).
  Fewer is allowed (fewer people, more risk — the dilemma).
- **Assigns each a role** (Worker/Farmer/Guard/Medic — role is re-chosen each
  settlement, P5; role never crosses runs). Default: keep last role or Worker.
- **Picks a creed** if one is unlocked (`CAMPAIGN.unlocks` ∩ `CREEDS`; **0–2 at
  v1**, `GDD.md:363`). The creed slot is a recorded qualitative tag (`G.creed`);
  creed *teeth* are HP-later — do not invent modifiers (§9.1(6)).
- **Embarks** → `embark(selectedMembers)` then `beginRun(civId, { members,
  roles, creed, site })` — **only the selected enter the run** (no civ/perk
  settler fillers on this path; those belong to the gentle founding). Land, light
  the hearth (`newGame` already places `campfire`).

Test (Step 9): a draft of a subset seeds exactly that subset into `G.settlers`
(names match), and the un-picked stay in `CAMPAIGN.band` as reserves.

### Decision 5 — the campaign map v0 (`GDD.md:205-213`)

A screen (`js/ui/campaign-map.js`, `makeCampaignMap`) shown before founding:

- **Candidate sites**: `siteCandidates()` returns `BALANCE.campaign.siteCandidates`
  (~3) sites from a small `SITES` table (`js/data.js`) — each a terrain/season/
  **visible quirk** label (`GDD.md:207`). One biome at v1 (`GDD.md:365`); the
  quirk is a *named, visible* flavor that seeds the run's starting season/tile
  mix (like a civ pick — lateral, not carryover; P5-legal). No quirk with combat
  teeth at v1 (defer).
- **The your-ruins site**: if `CAMPAIGN.map.ruins` is non-empty, one candidate
  is the **canned your-ruins** site derived from the most recent ruin entry —
  carrying graves and its recorded `cast` (`GDD.md:211-213`). One canned site
  only (`GDD.md:376`).
- **Lit Beacons stay lit**: every `CAMPAIGN.map.litBeacons` entry renders as a
  **permanent light** marker on the map (`GDD.md:208-209`). This is the visible
  campaign-progress valve P5 names (`GDD.md:141`): a marker no single loss can
  take away. Tested (Step 8): the marker count equals `litBeacons.length`.
- Pick a site → `chooseSite(site)` sets `CAMPAIGN.site` (run-scoped choice) →
  proceed to the founding draft.

Site choice "replaces v1's cast-draft as the run-variety authorship moment"
(`GDD.md:207-208`) — so this screen, not a spreadsheet draft, is where run
variety is authored.

### Decision 6 — the wagon camp (`GDD.md:214-217`) and the flow

The between-settlements hub (`js/ui/wagon-camp.js`, `makeWagonCamp`). **The band
is the menu**: each living member is a row (name, trait, `lifeStage`, want,
scars, a `⚑` if wounded/scarred this campaign). From it:

- **Tend the wounded** — a row action clearing a transient tended flag (v1: a
  narrative acknowledgement; the wounded are those carrying a fresh `wounded`
  scar from 012). No stat heal (P5).
- **Hear wants** — each row shows the member's want (from 012); satisfying wants
  is the settlement's job, but the camp is where you *read* them.
- **Spend legacy on options** — a footer action opening the options list
  (`OPTIONS` × `META.points`), `spendLegacyOnOption(id)`. **Options only**
  (Decision 1).
- **Pick the next site** — opens the campaign map.
- **Choose a creed slot** — surfaced in the founding draft (Decision 4).
- **Embark** — proceeds map → draft → run.

**Flow gating** (the one gentle-founding carve-out, `GDD.md:196-198`): the
*very first* settlement (`CAMPAIGN.settlements === 0` && band empty) keeps
today's **curated gentle founding** — menu → civ screen → `beginRun` with a
single fixed starter site, **no wagon camp, no draft** ("no draft screen full
of unlearned words"). Every founding after that (or any time the band is
non-empty) routes menu **"Continue campaign"** and the game-over modal's
**"Onward"** → wagon camp → map → draft → run. An **emptied band** (a total
wipe with no reserves) re-bootstraps through the gentle founding (a new group
gathers; heirs are vLater).

### New module surface

Extend `js/campaign.js` (010) with the store-mutating campaign functions
(`embark`, the reconcile inside `writeRunToCampaign`, `ageBand`, `lifeStage`,
`torchRisk`, `spendLegacyOnOption`, `siteCandidates`, `chooseSite`,
`retiredThisSettlement` helper). `js/campaign.js` may import `./meta.js`
(`META`, `saveMeta`) for the options spend — cycle-safe (`meta.js` imports only
`./data.js`). View helpers are re-exported through the `js/game.js` barrel for
the new screens (house rule; plan 012 set this precedent for `cast.js` helpers).
`seedSettlerFromMember` lives in `js/settlers.js` (it needs `NAMES`/`TRAITS`/
the `makeSettler` record shape). New screens go in `js/ui/*`.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Tests     | `pnpm test`                               | all pass            |
| One file  | `pnpm vitest run test/campaign.test.js`   | that file passes    |
| Founding  | `pnpm vitest run test/founding.test.js`   | that file passes    |
| Typecheck | `pnpm check`                              | exit 0              |
| Lint      | `pnpm lint`                               | exit 0              |
| Play      | `pnpm dev` → http://localhost:8137        | manual check, Step 11 |

Debug hooks (AGENTS.md): `window.G`, `window.ff(minutes)` fast-forward,
`loadCampaign()` on the `window.CAMPAIGN_M`/console to inspect the store.

## Scope

**In scope**:
- `js/campaign.js` — `embarked`/`civ`/`site` fields; `embark`; reconcile +
  `ageBand` inside `writeRunToCampaign`; `lifeStage`, `torchRisk`,
  `spendLegacyOnOption`, `siteCandidates`, `chooseSite`
- `js/data.js` — `SITES`, `OPTIONS`, `CREEDS` (stub), `STAGE_WANTS`,
  `LIFE_STAGES` (labels/colors)
- `js/balance.js` — a `campaign` block
- `js/settlers.js` — `seedSettlerFromMember`
- `js/game.js` — `newGame(civId, founding)` + `beginRun(civId, founding)`
  founding-options path; barrel re-exports of the campaign view helpers
- `js/ui/wagon-camp.js`, `js/ui/campaign-map.js`, `js/ui/founding.js` (create)
- `js/ui/modals.js` — game-over modal "Onward → wagon camp" when the campaign
  continues
- `js/ui/title.js` — menu "Continue campaign" entry → wagon camp
- `js/meta.js` / `js/screens.js`(legacy screen) — one-line assist-valve relabel
  of the perk screen (Decision 1); no mechanical change
- `test/campaign.test.js` (extend), `test/founding.test.js` (create), additions
  to `test/ui-smoke.test.js`
- `plans/README.md` — status row; `README.md`/`AGENTS.md` code-map lines

**Out of scope** (do not touch / defer):
- **Heirs / memory-threads / generational inheritance** — vLater
  (`GDD.md:203-204`). Aging retires the Grey; no one is born.
- **Campaign victory/defeat conditions** (the constellation lit / the dark
  complete, `GDD.md:218-221`) — vLater. The loop continues indefinitely at v1.
- **Creed teeth** — v1 creeds are recorded qualitative tags with no modifier
  (`GDD.md:363`, §9.1(6)); the creed *ruleset* system is HP-later.
- **Ruins beyond one canned site**, extra biomes, extra map size
  (`GDD.md:365,376`).
- **Removing or gating the assist perks** behind an explicit toggle — flagged
  follow-up; this plan relabels, it does not excise.
- **HP-3 arrivals** (drafting a `CAMPAIGN.band` member from a *stranger at the
  gate* into a run) — plan 013's reader. This plan's `seedSettlerFromMember` is
  the shared seam; if 013 already added an equivalent, reuse it (drift check).
- **Any modifier crossing between runs or bought with legacy** (P5 gate).
- Changing `js/save.js`/`SAVE_VERSION` — the identity round-trip uses names +
  `CAMPAIGN.embarked` (in the campaign store), needing **no settler field and no
  run-save migration**.

## Git workflow

- Branch: none — execute on `main` (per `plans/README.md` execution model);
  commit per step with imperative messages ("Add the campaign flow: embark,
  aging, options spend").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `BALANCE.campaign` + `js/data.js` tables (tables first, so tests pin them)

In `js/balance.js`, add a `campaign:` block after an existing top-level block, in
the file's terse comment style (executor: re-derive the aging numbers before
trusting them):

```js
campaign: {
  fieldCap: 12,        // max fielded per settlement (GDD P1, GDD.md:60/199)
  primeAge: 2,         // age >= primeAge → Prime
  greyAge: 5,          // age >= greyAge  → Grey
  retireAge: 8,        // age >= retireAge → retire into the Chronicle
  siteCandidates: 3,   // sites offered on the campaign map (incl. your-ruins if any)
},
```

The aging ladder makes a person fielded from Green reach Grey after 5
settlements and retire after 8 — "a campaign spans generations" (`GDD.md:204`).

In `js/data.js`, add (all **variety, never modifiers** — §9.1(6)):

- **`SITES`** — `{ id: { name, terrain, season, quirk } }`, a handful of v1
  candidate templates; `quirk` is a **visible named label** (`GDD.md:207`), one
  biome (`GDD.md:365`). Include a marker for the canned your-ruins template
  (or synthesize it in `siteCandidates` from `CAMPAIGN.map.ruins`).
- **`OPTIONS`** — `{ id: { name, cost, desc, kind } }` where `kind ∈
  {'arrival','site','creed','events'}`; **no numeric effect field**. These are
  unlock tokens read by later systems, spent with legacy.
- **`CREEDS`** — stub `{ id: { name, desc } }` (0–2 entries, `GDD.md:363`); a
  qualitative tag, no `mods`.
- **`STAGE_WANTS`** — `{ green:[...], prime:[...], grey:[...] }` over plan 012's
  `WANTS` ids (the stage-biased pools `ageBand` draws from).
- **`LIFE_STAGES`** — `{ green:{label,fg}, prime:{...}, grey:{...} }` (named
  bands + colors for the cards; P7).

Extend `test/balance.test.js` with a `describe('BALANCE.campaign')`:
1. `fieldCap`, `primeAge`, `greyAge`, `retireAge`, `siteCandidates` are
   positive integers; `primeAge < greyAge < retireAge` (stages are ordered and
   non-empty).
2. **P5/§9.1(6) gate (table-local)**: no `OPTIONS[id]` and no `CREEDS[id]` has a
   `mods`/`mod`/`bonus`/`mult` key — options and creeds carry **no modifier
   field** (a retuner who edits the table trips this without running the flow).

**Verify**: `pnpm vitest run test/balance.test.js` → pass; `pnpm check && pnpm lint` → exit 0.

### Step 2: extend the store — `embarked`/`civ`/`site` + `seedSettlerFromMember`

In `js/campaign.js`, extend `makeCampaign()` with three additive top-level
fields (no `CAMPAIGN_VERSION` bump — `migrateCampaign`'s same-version backfill
covers them, `plans/010-campaign-store.md:248-251`):

```js
embarked: [],   // band members away at the current settlement (reserves stay in band)
civ: null,      // the campaign's founding people (set at first founding; reused)
site: null,     // the chosen next site (run-scoped choice)
```

In `js/settlers.js`, add `seedSettlerFromMember(pos, role, member)` — mirror the
**post-012** `makeSettler` record exactly, overriding identity from the member:

```js
export function seedSettlerFromMember(pos, role, m) {
  G.usedNames.add(m.name);                 // register so arrivals never collide
  const trait = m.trait;
  const maxHp = trait === 'hardy' ? 26 : trait === 'frail' ? 14 : 20;  // trait-only → parity
  return {
    ...makeSettlerBase(pos, role, m.name, trait, maxHp),  // the run-scoped fields
    wants: [...(m.wants || [])],
    scars: [...(m.scars || [])],
    // resolve/weapon/bond/grudge/flags: fresh run defaults (from 012)
  };
}
```

(If `makeSettler` is not already factored to share a base record, extract the
run-scoped defaults into a small local helper rather than duplicating the field
list — keep one source of truth for the settler shape. Do **not** copy `age`
onto the settler; age lives on the band member.)

Extend `test/campaign.test.js`:
1. **Backfill of new fields** (010's Step-2 test #5 lesson): store a valid `v: N`
   record with `embarked`/`civ`/`site` **deleted** → `loadCampaign()` restores
   them as `[]`/`null`/`null` while preserving `band`.

**Verify**: `pnpm vitest run test/campaign.test.js` → pass (old + new);
`pnpm check && pnpm lint` → exit 0.

### Step 3: `embark` + reconcile `writeRunToCampaign` (close the round-trip)

In `js/campaign.js`:

```js
// founding: the chosen leave the wagon camp for the settlement
export function embark(members) {
  const ids = new Set(members.map(m => m.id));
  CAMPAIGN.embarked = CAMPAIGN.band.filter(m => ids.has(m.id));
  CAMPAIGN.band = CAMPAIGN.band.filter(m => !ids.has(m.id));   // reserves remain
  saveCampaign();
}
```

Rewrite `writeRunToCampaign`'s survivor handling to reconcile by name (Decision
2), replacing 010's blind `for (const s of out) band.push(toBandMember(s))`:

```js
export function writeRunToCampaign({ win, survivors }) {
  const out = survivors ?? (win ? G.settlers : []);
  CAMPAIGN.settlements++;
  const n = CAMPAIGN.settlements;
  const names = out.map(s => s.name);
  const survived = new Set(names);
  // returned band members (drafted + lived): keep identity, merge earned history
  for (const s of out) {
    const m = CAMPAIGN.embarked.find(e => e.name === s.name);
    if (m) { m.scars = [...(s.scars || m.scars)]; m.wants = [...(s.wants || m.wants)]; CAMPAIGN.band.push(m); }
    else { CAMPAIGN.band.push(toBandMember(s)); }   // gentle-founding person or HP-3 arrival
  }
  // embarked who did not survive: campaign permadeath
  CAMPAIGN.embarked = [];
  ageBand(n);                        // once per settlement (Decision 3)
  if (win) CAMPAIGN.map.litBeacons.push({ settlement: n, day: G.day, site: CAMPAIGN.site?.id ?? null });
  else CAMPAIGN.map.ruins.push({ settlement: n, day: G.day, cast: [...G.usedNames], site: CAMPAIGN.site?.id ?? null });
  CAMPAIGN.chronicle.push({ kind: win ? 'ascension' : 'fall', settlement: n, day: G.day, survivors: names, cast: [...G.usedNames] });
  CAMPAIGN.site = null;
  saveCampaign();
}
```

(`survived` is unused if you inline; keep the version above minimal. `ageBand`
is added in Step 4 — this step may stub it as `function ageBand() {}` and fill
it next, keeping each step green.)

**Verify**: `pnpm vitest run test/campaign.test.js` → the 010 store tests still
pass **except** any that assert the exact post-write `band` (those change — do
not fix them yet; Step 6 owns the honest update). `pnpm check && pnpm lint` →
exit 0.

### Step 4: `ageBand` + `lifeStage` + `torchRisk` + retire

In `js/campaign.js`, import `BALANCE` (`./balance.js`), `STAGE_WANTS`
(`./data.js`), and a random helper (`choice` from `./rng.js`):

```js
export const lifeStage = (m) =>
  m.age >= BALANCE.campaign.greyAge ? 'grey' : m.age >= BALANCE.campaign.primeAge ? 'prime' : 'green';

// display band the founding/torch UI reads (HP-4 consumes it) — never combat.
export const torchRisk = (m) => ({ green: 'eager', prime: 'ready', grey: 'honored' }[lifeStage(m)]);

export function ageBand(settlement) {
  const C = BALANCE.campaign;
  for (const m of CAMPAIGN.band) {
    const before = lifeStage(m);
    m.age++;
    if (lifeStage(m) !== before) {           // stage crossed → shift the want (P5-clean)
      const pool = STAGE_WANTS[lifeStage(m)];
      if (pool && pool.length) m.wants = [choice(pool)];
    }
  }
  const retired = CAMPAIGN.band.filter(m => m.age >= C.retireAge);
  for (const m of retired) CAMPAIGN.chronicle.push({ kind: 'retirement', name: m.name, age: m.age, settlement });
  CAMPAIGN.band = CAMPAIGN.band.filter(m => m.age < C.retireAge);
}
```

`ageBand` touches **only** `age`/`wants` (both zero-modifier) and moves the Grey
to the Chronicle. No stat, ever.

**Verify**: `pnpm vitest run test/campaign.test.js` → pass; `pnpm check && pnpm lint` → exit 0.

### Step 5: `spendLegacyOnOption` + `siteCandidates` + `chooseSite`

In `js/campaign.js` (import `META`, `saveMeta` from `./meta.js`; `OPTIONS`,
`SITES` from `./data.js`):

```js
export function spendLegacyOnOption(id) {
  const o = OPTIONS[id];
  if (!o || CAMPAIGN.unlocks.includes(id) || META.points < o.cost) return false;
  META.points -= o.cost;                 // legacy is the currency
  CAMPAIGN.unlocks.push(id);             // the yield is an OPTION ID — never a modifier
  saveMeta(); saveCampaign();
  return true;
}

export function siteCandidates() {
  const list = pickSitesFrom(SITES, BALANCE.campaign.siteCandidates);   // variety templates
  const lastRuin = CAMPAIGN.map.ruins.at(-1);
  if (lastRuin) list[0] = { id: 'your-ruins', name: 'Your ruins', ruin: lastRuin, quirk: 'graves and salvage' };
  return list;
}

export function chooseSite(site) { CAMPAIGN.site = site; saveCampaign(); }
```

**Verify**: `pnpm check && pnpm lint && pnpm test` → green.

### Step 6: honestly update the 010/016 tests the reconcile changed

Re-read `test/campaign.test.js` (010) and `test/endings.test.js` (016). Any
assertion about the **post-write `band`** now differs because (a) survivors are
reconciled by name instead of blindly pushed and (b) `ageBand` bumps `age`:

- 010's ascension-writes-survivors test: two **gentle-founding** settlers (empty
  `embarked`) → two new members, then aged to `age: 1`. Update the expected
  `age` from `0` to `1` and add an assertion that a second call is idempotent
  (still guarded by `G.gameOver`).
- 016's Torch test: if it drafts via `embark` first, assert the survivor
  **returns as the same member** (no duplicate, identity preserved); if it uses
  bare survivors (no `embark`), assert they become new members aged to `1`.
- The **P5 shape whitelist** (010 Step-2 test #6 / 012's extension) must still
  pass **unmodified** — `BAND_MEMBER_FIELDS` is unchanged; the reconcile adds no
  member field. If it fails, the reconcile leaked a field — STOP and fix the
  reconcile, not the test.
- The **ordering assertion** (`set hearthfall.campaign` strictly before
  `remove hearthfall.save`) must still hold — `ageBand`/reconcile are inside the
  same `writeRunToCampaign`, before `clearSave()`. If it fails, the write moved
  — STOP.

Add a new `test/campaign.test.js` case: **identity round-trip** — seed a band of
3, `embark` 2 of them, build 2 surviving settlers whose names match the embarked
pair plus mutate one settler's `scars`, `writeRunToCampaign({ win: true,
survivors })` → `band` has the 2 returned members (same ids, merged scars) **plus
the 1 reserve**, no duplicates; `embarked` is `[]`; a fielded member absent from
survivors is dropped.

**Verify**: `pnpm test` → full suite green. If a 010/016 test fails for a reason
other than the documented age/reconcile change, STOP.

### Step 7: the founding path — `newGame(civId, founding)` + `beginRun(civId, founding)`

In `js/game.js`, give `newGame` an optional founding bag
`{ members, roles, creed, site }`:

- When `founding.members` is present: **skip** the fixed `roles` template and the
  civ/perk settler additions; seed exactly one settler per member via
  `seedSettlerFromMember(spots[i], founding.roles[i] || 'worker', member)`.
  Store `G.creed = founding.creed ?? null`. Read `founding.site` for the
  starting season/tile-quirk seed (v1: at most set the season; a quirk with
  combat teeth is deferred).
- When absent (gentle founding / first settlement): today's behavior, unchanged.

Extend `beginRun(civId, founding)` (`js/screens.js`, post-009 still there) to
forward the bag to `newGame` — everything else (`genWorld`, `save`,
`replaceAll(makeGameScreen())`, `push(makeIntroModal())`) is unchanged.

Add to the `js/game.js` barrel the campaign view helpers the new screens import
(house rule; 012 precedent): `export { lifeStage, torchRisk, siteCandidates,
chooseSite, spendLegacyOnOption, embark } from './campaign.js';` and
`export { CAMPAIGN, loadCampaign } from './campaign.js';` (views read the store
through the barrel).

**Verify**: `pnpm check && pnpm lint && pnpm test` → green.

### Step 8: `test/campaign.test.js` — the two P5 falsifiers + Beacon persistence

Add (store-level, no UI):

1. **Aging advances one stage per settlement and never touches stats (the P5
   falsifier as code)**: a member at `age: 0` → after N `ageBand()` calls
   `age === N` and `lifeStage` walks green→prime→grey at the `BALANCE.campaign`
   thresholds; `Object.keys(member)` stays within `BAND_MEMBER_FIELDS`
   (no stat field appeared); and **veteran parity**:
   `seedSettlerFromMember(pos,'guard', young).maxHp === seedSettlerFromMember(pos,'guard', aged).maxHp`
   when `young`/`aged` share a trait but differ in `age` — history carries no
   power (`GDD.md:144-145`). Also: a member reaching `retireAge` is removed from
   `band` and appears in `chronicle` with `kind: 'retirement'`.
2. **Wagon-camp legacy spend yields an option id, never a modifier (the P5
   spend falsifier)**: snapshot `G.mods`/`G.res`; `META.points = 10`;
   `spendLegacyOnOption(<a valid id>)` → returns `true`, `CAMPAIGN.unlocks`
   contains the **string id**, `META.points` decreased by `OPTIONS[id].cost`,
   and `G.mods`/`G.res` **deep-equal the snapshot** (the spend touched no combat/
   economy number); a second spend of the same id returns `false` (no double
   unlock); a spend with `META.points < cost` returns `false` and changes
   nothing.
3. **Lit-Beacon persistence is data the map can render**: push two
   `litBeacons` entries, assert `siteCandidates()`/the map's marker source
   yields a marker per entry (count === `litBeacons.length`) — the render test
   itself is Step 10's smoke; here pin the data contract.

**Verify**: `pnpm vitest run test/campaign.test.js` → all pass.

### Step 9: the three screens — `js/ui/wagon-camp.js`, `campaign-map.js`, `founding.js`

Follow the `js/ui.js:1-9` contract; reuse `makeListScreen` (`js/ui/menu.js`) and
`drawNotice` (`js/ui/chrome.js`); import sim/view helpers via the `js/game.js`
barrel (house rule). Keep each thin — the tested store logic is the deliverable.

- **`makeWagonCamp()`** (`js/ui/wagon-camp.js`, `id: 'wagon'`): the band as
  rows (name · trait · `lifeStage` band · want · scars · a `⚑` if wounded).
  Row action: tend (clear the transient tended flag). Footer actions: "Spend
  legacy on options ◆" → an options list screen (`OPTIONS` × `META.points`,
  `spendLegacyOnOption`); "Choose the next site →" → `makeCampaignMap()`;
  header shows the creed slot (chosen in the draft). No shop chrome — the band
  is the menu (`GDD.md:217`).
- **`makeCampaignMap()`** (`js/ui/campaign-map.js`, `id: 'campaign-map'`):
  `siteCandidates()` as rows with their **visible quirk**; render each
  `CAMPAIGN.map.litBeacons` entry as a **permanent light** glyph and each
  `CAMPAIGN.map.ruins` entry as a ruin glyph on a small region grid. Select a
  site → `chooseSite(site)` → `makeFoundingDraft()`.
- **`makeFoundingDraft()`** (`js/ui/founding.js`, `id: 'founding'`): the band as
  toggleable cards (name · trait · `lifeStage` · `torchRisk` band · want ·
  scars); a per-row role cycle (`cycleRole`-style over the 4 roles); cap the
  selection at `BALANCE.campaign.fieldCap`; a creed picker if
  `CAMPAIGN.unlocks ∩ CREEDS` is non-empty. Confirm → `embark(selected)` then
  `beginRun(CAMPAIGN.civ, { members: selected, roles, creed, site: CAMPAIGN.site })`.

Wire the flow into existing screens:

- **`js/ui/modals.js` game-over modal**: repoint the "onward" exit. When the
  campaign continues (`CAMPAIGN.band.length || (G.ending === 'torch' || G.victory)`)
  add `[C] onward to the wagon camp` → `replaceAll(makeWagonCamp())`; keep
  `[M] main menu`. Post-016 this modal already branches on `G.ending` — add the
  onward line to every non-quit branch. (Do **not** push the wagon camp
  yourself from the sim; the game-over modal is the handoff.)
- **`js/ui/title.js` menu**: add a `Continue campaign` entry shown when
  `loadCampaign().settlements > 0` → `replaceAll(makeWagonCamp())`. Leave "New
  Game" (the gentle first founding: civ → `beginRun`) as the `settlements === 0`
  path.
- **`js/ui/title.js`/legacy screen relabel** (Decision 1): retitle the perk
  screen to name it the **assist valve** (one string change, e.g. "Legacy
  Perks — assist bonuses (flat, off the record)") so the diegetic progression
  (options at the wagon camp) and the assist bonuses read as distinct. No
  mechanical change to `buyPerk`/`PERKS`.

**Verify**: `pnpm check && pnpm lint && pnpm test` → green.

### Step 10: `test/ui-smoke.test.js` — the new screens in the module graph

Extend the 009 smoke (stub-then-import header) with:

```js
const wagon = await import('../js/ui/wagon-camp.js');
const cmap  = await import('../js/ui/campaign-map.js');
const found = await import('../js/ui/founding.js');
```

Tests:
1. `wagon.makeWagonCamp`, `cmap.makeCampaignMap`, `found.makeFoundingDraft` are
   functions; each returns a contract object (`id`, `modal === false`,
   arrays/functions per `js/ui.js:1-9`).
2. After `Object.assign(G, makeState())` and seeding `CAMPAIGN.band` with 2
   members and `CAMPAIGN.map.litBeacons` with 2 entries, each screen's
   `draw(0)` runs **without throwing**, and the campaign map draws a light
   marker per `litBeacons` entry (assert via a marker count the draw exposes, or
   a spy on the glyph writer — the lit-Beacon-persistence render check).

**Verify**: `pnpm vitest run test/ui-smoke.test.js` → pass; `pnpm test` → green.

### Step 11: `test/founding.test.js` — the draft seeds a subset, only those enter

Create with the stub-then-import header (import `state.js`, `game.js`,
`campaign.js`, `settlers.js`). `beforeEach`: `Object.assign(G, makeState())`.

1. **Only the selected enter the run**: seed `CAMPAIGN.band` with 4 members;
   pick 2; `embark(picked)` then `newGame(civId, { members: picked, roles:
   ['guard','farmer'], site })` → `G.settlers.length === 2`, their `name`s are
   the picked members' names, their `role`s are the assigned roles, and the
   **un-picked 2 remain in `CAMPAIGN.band`** as reserves (not in the run).
2. **Seeded settlers carry history, not stats**: a picked member with
   `scars: [{id:'grief',day:3}]`, `wants: ['peace']` → the seeded settler has
   those `scars`/`wants`, a fresh `resolve` (run default), and `maxHp` from
   trait only.
3. **Gentle founding is unchanged**: `newGame(civId)` with **no** founding bag →
   today's fixed-template settlers (count and roles match the pre-plan
   behavior); `CAMPAIGN.embarked` stays `[]`.
4. **Round-trip closes**: after Step-1's run, build survivors for 1 of the 2
   settlers and `writeRunToCampaign({ win: true, survivors })` → that member
   returns to `band` (aged), the other embarked member is dropped, the 2
   reserves are intact and aged.

**Verify**: `pnpm vitest run test/founding.test.js` → all pass; `pnpm test` →
full suite green.

### Step 12: manual verification + docs + `plans/README.md`

`pnpm dev` → http://localhost:8137. Walk the loop:

1. Fresh profile (clear `hearthfall.campaign` in devtools): "New Game" → civ →
   the **gentle first founding** runs (no wagon camp, no draft), the hearth is
   lit.
2. End the settlement (Torch via 016, or `ff` a fall) → the game-over modal
   offers **"onward to the wagon camp"** → the wagon camp shows your survivors
   as rows, one step older.
3. Wagon camp → spend legacy on an **option** (watch `◆` drop, and in console
   `loadCampaign().unlocks` gains the id; `G.mods` unchanged) → "choose the next
   site" → the campaign map shows candidates with quirks **and a lit-Beacon
   marker if you ascended** → pick one → the **founding draft** shows your band;
   pick a subset, assign roles, embark → the run starts with **only** those
   people.
4. Repeat until a member reaches `retireAge` → confirm they leave the band and
   `loadCampaign().chronicle` has their retirement entry.
5. Confirm both renderers (Esc → Graphics toggle) draw the new screens.

Docs: extend the `README.md` code-map line for `js/campaign.js` (now also the
campaign flow) and add the three `js/ui/*` screens; add one `AGENTS.md` sentence
that the campaign layer spends legacy on **options** (P5) while the assist perks
are the flat opt-in valve.

`plans/README.md`: add (or update, if a sibling added later rows) the row:

```
| 017 | The campaign layer: wagon camp, campaign map v0, founding draft, aging | HP-8 | P1 | L | 010, 016 | DONE |
```

Under "Dependency notes", record that HP-8 (a) decided the legacy-vs-options
question 010 deferred (options are the P5-clean campaign spend; the flat perks
are the assist valve), (b) closed 010's write-only round-trip (band identity via
name + `CAMPAIGN.embarked`), and (c) leaves heirs, campaign win/lose, and creed
teeth to vLater.

**Verify**: `pnpm check && pnpm lint && pnpm test` all exit 0; `git status`
shows only in-scope files; `git diff plans/README.md` is the status row only.

## Test plan

(The steps above ARE the test plan.) Final shape: `test/campaign.test.js`
+backfill, +identity round-trip, +the two P5 falsifiers (aging-never-stats,
options-not-modifiers), +Beacon-persistence data contract, with the 010 band
assertions updated for aging; `test/founding.test.js` ~4 (subset-only, history-
not-stats, gentle-founding-unchanged, round-trip); `test/ui-smoke.test.js` +2
(three screens are contract objects, draw without throwing, lit-Beacon markers);
`test/balance.test.js` +2 (stage ordering, options/creeds carry no modifier);
`test/endings.test.js` (016) updated for the reconcile — all green alongside the
existing suite.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all exit 0
- [ ] **P5 aging gate**: `test/campaign.test.js` proves `ageBand` bumps `age`
      only, `lifeStage` walks the bands, member keys stay within
      `BAND_MEMBER_FIELDS`, and a seeded settler's `maxHp` is identical for an
      aged vs young member of the same trait (veteran parity)
- [ ] **P5 options gate**: `spendLegacyOnOption` returns an option **id**,
      pushes it to `CAMPAIGN.unlocks`, decrements `META.points`, and leaves
      `G.mods`/`G.res` deep-equal — no modifier is bought or stored
      (`grep -rn "mods\|res\." js/campaign.js` shows the spend touches neither)
- [ ] **Founding draft**: `newGame(civId,{members,...})` seeds exactly the
      selected members into `G.settlers`; the un-picked stay in `CAMPAIGN.band`
      (`test/founding.test.js` #1)
- [ ] **Round-trip closed**: `writeRunToCampaign` reconciles survivors by name
      against `CAMPAIGN.embarked` — no duplicate band members; drafted dead are
      dropped; reserves untouched; then aged once
- [ ] **Lit Beacons persist and render**: the campaign map draws one light
      marker per `CAMPAIGN.map.litBeacons` entry (Step 10 smoke)
- [ ] Legacy-vs-options **decided and documented**: the wagon camp spends on
      options only; the perk screen is relabeled the assist valve; the campaign
      layer introduces no new modifier
- [ ] `CAMPAIGN_VERSION` **unchanged** (additive fields backfilled); no
      `js/save.js`/`SAVE_VERSION` change
- [ ] Heirs, campaign win/lose, and creed teeth are **not** built
- [ ] `plans/README.md` status row updated

## STOP conditions

- **Plan 010/016 drift**: `js/campaign.js` has no `writeRunToCampaign({ win,
  survivors })` called before `clearSave()`, or `BAND_MEMBER_FIELDS`/
  `toBandMember` differ materially from the excerpts — this plan reads and
  rewrites that path; re-ground before coding.
- **You are tempted to make an option, creed, or site carry a modifier** (a
  `mods`/`bonus`/`mult` field, a founding stat bump, a quirk that changes a
  fight) — that is the §9.1(1)/(6) gate (`GDD.md:343,355-356`). STOP; options
  are variety, the assist perks are the *only* sanctioned flat bonus and they
  stay off the campaign path.
- **Aging changes a combat/economy number** (a "veteran" maxHp/damage/yield, a
  stage that buffs) — the P5 falsifier (`GDD.md:144-145`). STOP; stage shifts
  wants and torch-risk only.
- **The reconcile duplicates or loses people**: a drafted survivor appears twice
  in `band`, or a reserve vanishes, or the P5 shape whitelist starts failing —
  the name-match/`embarked` bookkeeping is wrong; fix the reconcile, never the
  P5 test.
- **The `set campaign` before `remove save` ordering breaks** (010's binding
  invariant) — `ageBand`/reconcile moved the write after `clearSave()`. STOP.
- **You find yourself building heirs, births, memory-threads, campaign
  victory/defeat, or creed teeth** — all vLater (`GDD.md:203-204,218-221,363`).
  STOP; this plan is wagon camp + map v0 + draft + aging only.
- **A `js/save.js`/`SAVE_VERSION` change becomes "necessary"** — the round-trip
  is designed to need none (names + `CAMPAIGN.embarked`). If you reach for a
  settler field, reconsider before adding it; report the coupling.
- Any test outside the ones this plan rewrites fails after Step 3/6 —
  especially the 010 store or 016 endings tests for a reason other than the
  documented age/reconcile change; report, do not adjust old assertions blindly.

## Maintenance notes

- **The legacy-vs-options split is the load-bearing decision here.** Options
  (`CAMPAIGN.unlocks`, P5-clean) are the campaign progression; the flat `PERKS`
  are the GDD's opt-in assist valve (`GDD.md:139-143`), relabeled but
  mechanically untouched. A follow-up may gate the perks behind an explicit
  assist toggle and make them "off the record" for good — that is a
  founding-economy re-tune, deliberately out of this plan.
- **The band round-trip relies on within-run name uniqueness** (`G.usedNames`,
  `js/state.js:23`). If a future change lets two live people share a name in one
  settlement, the name-match reconcile breaks — add a `memberId` back-link on
  the settler then (and a save-version bump), which this plan avoided on purpose.
- **HP-3 arrivals** (plan 013) is the other reader of `CAMPAIGN.band`/
  `seedSettlerFromMember`: a stranger accepted at the gate becomes a band member
  and can be drafted here. If 013 already added an equivalent seed helper, this
  plan reuses it (drift check) rather than adding a second.
- **HP-4 torchbearer** consumes `torchRisk(member)` (the Grey earn the torch,
  `GDD.md:274`); it is an exported display band here, unread by combat.
- **Aging is the simplest form on purpose** (`GDD.md:201`): one step per
  settlement, three stages, retire at `retireAge`. Heirs (`GDD.md:203-204`)
  make "legacy" literal and are the next generational step — they add a birth
  event and a memory-thread field, not a stat.
- **Campaign end** (the constellation lit / the dark complete, `GDD.md:218-221`)
  is the surface that turns `CAMPAIGN.map.litBeacons` into a win condition and
  an emptied band into a loss. Until then the loop runs indefinitely and an
  emptied band re-bootstraps through the gentle founding.
