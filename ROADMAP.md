# HEARTHFALL Roadmap (v3 — the hearth-ring reset)

Reset 2026-07-09 at commit `95e0170`; deepened 2026-07-10 with ages and
town-building depth. **[DESIGN.md](DESIGN.md) is the sole design authority**;
this roadmap is the route to its v0 playable scope. Where they disagree,
DESIGN.md wins.

**Why the reset.** GDD v2's campaign flip — persistent band, disposable
settlements, attachment-as-product — was built (all thirteen HP0 plans
executed) and its core premise was falsified in play: players did not care
about losing characters, and the game's best moments were the board, not the
cast. The settlement is the character; units are capacity. The full campaign
build is archived at branch `archive/hp0-campaign-flip` (reference
implementations only — not history to restore); the abandoned manual teardown
is preserved at `redesign/hearth-ring`; the retired GDD v2 and plans 009–028
are recoverable via `git show 95e0170:GDD.md` / `git show 95e0170:plans/`.

**What the reset keeps** (the enablement era, plans 001–008, all still true
at this commit): the 52-test characterization net, CI on push/PR, the
`BALANCE` tuning table (`js/balance.js`), controller parity, and the fixed
100×45 CRT grid — still an owner design constant. Verification gates for all
work: `pnpm check`, `pnpm lint`, `pnpm test`.

**Execution model** (unchanged): items become self-contained plans in
[plans/](plans/README.md), executed **sequentially on main**, each landing as
a green-gate commit checkpoint. No feature branches. Plans are drafted two
or three at a time as execution approaches — never the whole ladder up front.

---

## Route to v0 (DESIGN.md "v0 playable scope")

Ordered; each item names its DESIGN.md anchor. Reference implementations in
`archive/hp0-campaign-flip` are cited where a simplified re-derivation beats
building from scratch — consult for shapes and tests, never port campaign
coupling. The town-building depth items (HR-3, HR-4) come right after the
identity commit and the pressure model, because DESIGN.md's management depth
lives there — everything later builds on roads, placement, and evolution.

| ID | Item | DESIGN.md | Effort | Notes |
|----|------|-----------|--------|-------|
| **HR-1** | **Hard wipe** — remove the legacy shop and run-scoring payout: collapse deletes the save, new settlement, same rules. Retire `META` perks/points/civ-unlock spending and the legacy/civ screens; keep a dry lifetime-stats record only if free. Simplify title flow (New / Continue). | Intent, failure | M | The identity commit — first, so nothing below builds against the meta. |
| **HR-2** | **Heat + tonight's bill** — visible pressure ceiling (rises with days, noise, claims/light, camps standing; falls by action) and nights sized to visible strength under it; **per-age floor hook from day one** (a `BALANCE.heat.floorByAge` table HR-5 fills in). One-sentence-explainable nights. Replaces the day-count formula in `js/forecasts.js`. | "Pressure, Beacon, failure" | M-L | Reference: archived plan 011 (`js/menace.js`) — re-derive simplified; Heat is one number + a short cause list. |
| **HR-3** | **Roads + connection** — road tiles (cheap, fast for everyone *including raiders*, so the road graph + gate decide how the night arrives); buildings want a road path to the hearth (**connected**) for full output; unroaded = slow on top of risky. Raider pathing prefers roads. | "Building the town" | M | New system, no archive reference. Pathfinding weights + a connectivity check; keep both legible on inspect. |
| **HR-4** | **Placement rules + dwelling evolution** — the small visible rule set (one per building: farm/water, house/warmth, tower/coverage, mill-forge/noise, workshop/stockpile) and tents → cottages → stone houses evolving *in place* when warm · fed · safe · connected hold (sliding back when broken). Inspect says why, in one line. Skyline = scoreboard. | "Building the town" | L | The management-depth centerpiece. Dwelling tier caps come from the age (stub the cap at tier 2 until HR-5). |
| **HR-5** | **Ages, charters, feasts** — the ladder (Camp → Hamlet → Village → Township): age structure + feast (spend surplus, morale up, noise up) to advance; each age unlocks buildings + the next dwelling tier + one binary charter with teeth; Heat floor steps per age and creeps within one (fills HR-2's table). Punctuated ascent is the intended line. | "Ages & prosperity" | L | Charter effects route through `BALANCE`. |
| **HR-6** | **Gate decisions** — wanderer accept/decline modal with plain numbers (role need, food days, free beds); accept joins *this settlement*; decline leaves + small Heat tick. Replaces silent dawn recruiting. | "Map and resources" | M | Reference: archived plan 013's modal + dawn wiring, minus campaign enrollment. |
| **HR-7** | **Rings & away-work** — fold the separate overworld into the one map: value in rings outward (timber, stone, scrap ruins, fishing, caches), mark-POI orders, workers spend real clock away from the wall; surplus and distance are the risk. No fog. | "Map and resources" | L | The biggest single item: `js/world.js`'s off-map site game becomes on-map push-out, on HR-3's roads. |
| **HR-8** | **Beacon exam** — final-age structure; light when you choose; hold N escalating *previewed* nights under Heat; delay priced by Heat's creep and scrap running out. | "Pressure, Beacon, failure" | M | Reference: archived plan 018's previews, simplified. |
| **HR-9** | **Collapse triggers + the dawn board** — collapse threatened when the hearth is dead, hands near zero, or the larder has no runway; compact dawn read (food days, beds, hurt/idle, out-there, tonight's look, age status). Elder becomes the board-reader; teach gate/scrap/push-out/age-up. | "Core loop", failure | M | |
| **HR-10** | **Winter bites (numeric)** — winter costs food and makes away-work scarier; nothing else. No verb-flips, no frozen-river pathing. | "Seasons (v0)" | S | Mostly `BALANCE` tuning once HR-7 exists. |

**v0 exit test** (DESIGN.md "Design test"): players can answer, uncoached —
what am I short of and risking; why the last wanderer; why last night was
hard; **why is that house still a tent; what age am I in and why am I
waiting**. If they talk about the map, the larder, the gate, and the skyline,
it works. If the best part was one fighter at dusk — or untangling supply
routes — wrong game.

## Engineering backlog (design-neutral, pull when useful)

- **Screens split** — the executed refactor cherry-picks cleanly
  (`git cherry-pick 5e256ea`, parent is exactly `95e0170`; zero behavior
  change). Worth taking before HR-4's and HR-9's UI work.
- Job-scan index (matters more once roads/evolution add tile state), renderer
  dedup, renderer idle, `game.js` barrel — the old P1-6..P1-9 findings hold;
  retired drafts at `git show 95e0170:plans/`.
- Readability/colorblind pass, morale-why key path, screen-reader mirror,
  touch spike — reach items, unchanged in substance.

## Explicitly rejected (from DESIGN.md — do not re-propose)

Attachment-as-product · torchbearer / embodied dusk · roguelike meta / legacy
shop · persistent band / aging generations · separate world-map expedition
game · arrivals as campaign enrollment · **depth-through-logistics (product
variety, crop rotation, recipes, hauling sim, pipelines)** · zoning UI /
factions / elections · fit-to-window layout (CRT container is identity).

## Sequencing

```
HR-1 wipe → HR-2 heat+bill → HR-3 roads → HR-4 placement+evolution
   → HR-5 ages+charters+feasts → HR-6 gate → HR-7 rings/away-work
   → HR-8 beacon exam → HR-9 collapse+dawn board → HR-10 winter
   → v0 exit playtest
(cherry-pick 5e256ea screens split any time before HR-4's UI)
```

Plans get drafted per-item into [plans/](plans/README.md) as execution
approaches — a batch of two or three at a time, not all at once.
