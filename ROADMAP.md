# HEARTHFALL Roadmap (v3 — the hearth-ring reset)

Reset 2026-07-09 at commit `95e0170`. **[DESIGN.md](DESIGN.md) (hearth-ring)
is the sole design authority**; this roadmap is the route to its v0 playable
scope. Where they disagree, DESIGN.md wins.

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
a green-gate commit checkpoint. No feature branches.

---

## Route to v0 (DESIGN.md §"v0 playable scope")

Ordered; each item names its DESIGN.md anchor. `HR-*` IDs are the new
sequence. Reference implementations in `archive/hp0-campaign-flip` are cited
where a simplified re-derivation is faster than building from scratch —
consult them for shapes and tests, do not port campaign coupling.

| ID | Item | DESIGN.md | Effort | Notes |
|----|------|-----------|--------|-------|
| **HR-1** | **Hard wipe** — remove the legacy shop and run-scoring payout: collapse deletes the save, new settlement, same rules. Retire `META` perks/points/civ-unlock spending from `js/meta.js` and the legacy/civ screens; keep a dry lifetime-stats record only if it costs nothing (not progression). Simplify title flow (New / Continue). | Intent, "Pressure, Beacon, failure" | M | The identity commit — do it first so nothing below builds against the meta. |
| **HR-2** | **Heat + tonight's bill** — visible pressure ceiling (rises with days, noise, claims/light, camps standing; falls by action) and nights sized to visible strength under it. The bar: any night's size must be explainable in one sentence from on-screen causes. Replaces the day-count formula in `js/forecasts.js`. | "Pressure, Beacon, failure" | M-L | Reference: archived plan 011 (`js/menace.js`, its ledger + inequality tests) — re-derive simplified; Heat is one number + a short cause list, not two systems. |
| **HR-3** | **Gate decisions** — wanderer accept/decline modal with plain numbers (role need, food days, free beds); accept = joins *this settlement*; decline = leaves, small Heat tick. Replaces silent dawn recruiting. | "Map and resources" | M | Reference: archived plan 013's modal + dawn wiring, minus all campaign enrollment. |
| **HR-4** | **Rings & away-work** — fold the separate overworld/expedition screen into the one settlement map: value in rings outward (timber, stone, scrap ruins, fishing, caches — richer and meaner farther out), mark-POI orders, workers spend real clock away from the wall. Distance + time are the risk; no fog. | "Map and resources" | L | The biggest item: `js/world.js`'s off-map site game becomes on-map push-out. Labor rule is the point — a body in the woods is not on the wall. |
| **HR-5** | **Beacon exam** — late structure, light when you choose, hold N escalating *previewed* nights under Heat; delay priced by Heat's rise and scrap running out. Base exam, not character arc. | "Pressure, Beacon, failure" | M | Reference: archived plan 018's preview structure, simplified (no concealed-share machinery unless previews prove pre-solvable). |
| **HR-6** | **Collapse triggers + the dawn board** — collapse threatened when the hearth is dead, hands near zero, or the larder has no runway; and a compact dawn read (food days, beds, hurt/idle, what's out there, tonight's look) replacing log-scroll. Elder becomes the board-reader; teach gate/scrap/push-out. | "Core loop", collapse | M | |
| **HR-7** | **Winter bites (numeric)** — winter costs food and makes away-work scarier; nothing else. No verb-flips, no frozen-river pathing. | "Seasons (v0)" | S | Mostly tuning via `BALANCE` once HR-4 exists. |

**v0 exit test** (DESIGN.md "Design test"): after a short session, players can
answer — what am I short of and what am I risking to get it; why did I take or
turn away the last wanderer; why was last night hard or easy. If they talk
about the map, the larder, and the gate, it's working. If the best part was
controlling one fighter at dusk, we built the wrong game.

## Engineering backlog (design-neutral, pull when useful)

- **Screens split** — the executed refactor cherry-picks cleanly
  (`git cherry-pick 5e256ea`, parent is exactly `95e0170`; zero behavior
  change, gates were green). Worth taking before HR-3/HR-6's UI work.
- Job-scan index, renderer dedup, renderer idle cost, `game.js` barrel —
  the old P1-6..P1-9 findings still hold; their retired plans
  (`git show 95e0170:plans/022-barrel-untangle.md` etc.) remain accurate
  drafts. Re-plan against post-HR code when reached.
- Readability/colorblind pass, morale-why key path, screen-reader mirror,
  touch spike — reach items, unchanged in substance
  (`git show 95e0170:plans/026-readability-pass.md` etc.).

## Explicitly rejected (from DESIGN.md — do not re-propose)

Attachment-as-product (chronicle, bonds, scars-as-grief) · torchbearer /
embodied dusk · roguelike meta / legacy power shop · persistent band / aging
generations · separate world-map expedition game · arrivals as campaign
enrollment · fit-to-window layout (CRT container is identity).

## Sequencing

```
HR-1 hard wipe  →  HR-2 heat + bill  →  HR-3 gate  →  HR-4 rings/away-work
       →  HR-5 beacon exam  →  HR-6 collapse + dawn board  →  HR-7 winter
       →  v0 exit playtest
(cherry-pick 5e256ea screens split any time before HR-3's and HR-6's UI)
```

Plans get drafted per-item into [plans/](plans/README.md) as execution
approaches — batch of two or three at a time, not all at once.
