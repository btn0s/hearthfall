# HEARTHFALL — hearth-ring design

**Status:** canonical product design (2026-07-08; adopted on `main` 2026-07-09; ages + town-building depth added same day). Sole design authority — supersedes GDD v2 (the campaign flip), whose core premise (attachment-as-product) was falsified in play. The route is [ROADMAP.md](ROADMAP.md); where they disagree, this document wins.

## Intent

Colony sandbox on **one settlement map**. Omniscient POV the whole day. Classic town-building — grid, roads, placed buildings — where **depth is geometry, not logistics**: four goods, chains ≤2, no pipelines; the puzzle is where things stand, what they touch, and what the night can reach. Labor allocation, local push-out risk/reward, gate decisions, dusk as audit. Progress through **ages**; **Beacon win** caps the last one. Collapse = **hard wipe**, new settlement, same rules. No roguelike meta, no persistent band, no name-attachment. Story is authored later on this sandbox.

The Frostpunk×Tropico fusion rule: **prosperity is the provocation.** Every engine of growth casts its own shadow — build out and the night aims better (Heat), stockpile and you're worth robbing (the larder is the raid target), recruit and you owe beds and meals. Pressure is never a difficulty dial; it is the visible consequence of the way you chose to prosper.

**North star:** The map is a risk surface. Home is safety and hunger. The tree line and the gate are where greed meets the raid clock.

The settlement is the character. Units are capacity (roles, hands, beds), not a cast to mourn.

## Core loop

1. **Dawn** — Read the board: food days, free beds, who’s hurt/idle, what’s still out there, what tonight looks like.
2. **Day** — Assign labor (home vs push the map); lay roads, place buildings, build/repair; gate accept/decline wanderers; mark local POIs. Some days: raise the age structure and feast.
3. **Dusk** — Raid (or quiet) resolves from how greedy/thin you were. Watch and pause; do not possess a unit.
4. **Dawn** — Stock, wounds, housing, and map state update. Repeat.

**Win:** Reach the final age, raise and light the Beacon; hold its exam nights.  
**Lose:** Collapse → save deletes → new settlement, same rules.  
**No** legacy shop, torchbearer, or “mourn the names.”

Session feel: one save, hours if you want. Short play is “one more day,” not “one more run.”

## Map and resources

**Map:** One generated settlement map. Hearth at center (clear home clearing). Value in **rings outward** — safer near home, richer and meaner farther out. No separate overworld.

**Home ring:** beds, farms, workshop, walls, Beacon site.  
**Outer rings:** timber, stone, scrap ruins, fishing, caches. Better payouts; workers spend time away from the wall.

**Resources (short chains):** food/meals, wood, stone, scrap — **four goods, permanently**. Chains stay ≤2 steps. Coin optional later; not required for v0. If a proposed building needs a fifth good or a third step, the building is wrong.

**Labor rule:** Hands are the bottleneck. A body in the woods is not on the wall. Marking a far POI is a bet against tonight.

**Wanderers:** Gate modal with plain numbers (role need, food, bed). Accept = join *this* settlement. Decline = leave (+ small Heat tick).

**Exploration:** Pan the map, spot a ruin/grove, send workers, watch the clock. Distance and time are enough risk for v0. No fog required.

**Build identity:** Structures multiply labor; never fully automate faces away. No belts.

## Building the town

Where the management depth lives. **Depth is geometry, not logistics** — the classic grid game (roads, placement, districts, evolving houses), never the goods game (product variety, recipes, hauling).

**Roads:** Cheap tiles; everyone on them moves fast — *including raiders*. The road graph and the gate decide how the night arrives; the road that speeds your logger home speeds the torch to your door. A building wants a road path back to the hearth (**connected**) to work at full pace; far, unroaded workplaces are slow on top of risky.

**Placement rules — few, visible, one per building:** farm wants water/soil · house wants warmth (hearth/campfire radius) · watchtower covers a radius · mill/forge are noisy neighbors (houses beside them rest badly) · workshop wants the stockpile. No hidden modifiers: inspect any building and it says why it's happy or not, in one line.

**Dwellings evolve:** tent → cottage → stone house, upgrading *in place* when local conditions hold (warm · fed · safe inside coverage · connected) and sliding back when they break. The skyline is the scoreboard — prosperity you can see is prosperity you'll defend. The current age caps the top tier.

**Districts emerge, never zoned:** the placement rules make quarters happen (farms by the water, houses around the hearth, industry downwind); there is no zoning UI.

**What building depth is NOT (binding):** no product variety, no crop rotation, no per-good hauling simulation, no recipes, no pipelines. Four goods and geometry carry the whole game. Multi-tile footprints: later, if ever.

## Ages & prosperity

The Tropico arc under the Frostpunk clock: eras you *choose* to enter, each a wager.

**The ladder:** Camp → Hamlet → Village → Township (names provisional). Each age unlocks buildings, the next dwelling tier, and one **charter**.

**Advancing is a deliberate, loud act:** build the age structure (hearthhall → mill → forge), then hold a **feast** — spend real surplus, morale rises, noise rises. The ceremony converts prosperity directly into Heat: mechanically honest, thematically commune.

**Each age raises Heat's floor permanently** — and within an age, the floor creeps. Every plateau is stable *now* and rotting *slowly*: you can sit at Hamlet as long as you dare, not forever. Defense growth within an age never outruns the creep; advancing jumps your capability and resets the race at higher stakes. The intended line is **punctuated ascent** — fatten in safety, then dare the next rung.

**Charters (one per age, binary, with teeth):** how the commune organizes — rationing rules, watch rotations, gate policy. Each trades economy vs. defense vs. rest. This is the Book-of-Laws register at commune scale; no factions, no elections.

**Prosperity is surplus + skyline,** both visible, both bait: raiders come for the larder and burn what gleams. There is no prosperity *score* — stored future and stone houses are the score.

## Pressure, Beacon, failure

**Heat:** Rises with days, noise, claims/light, camps left standing; its floor steps up with each age and creeps within one. Sets how bad nights can get.  
**Tonight’s bill:** Sized to visible strength under that ceiling. Thin or greedy play must change the bill in one explainable sentence.

Dusk is an audit, not a minigame.

**Seasons (v0):** Winter bites food and makes away-work scarier. Full verb-flip seasons wait.

**Beacon:** Late structure. Light when you choose. Hold N escalating previewed nights. Delay costs because Heat never sleeps and easy scrap runs out. Base exam, not character arc.

**Collapse → hard wipe:** Threatened when hearth is dead, almost no active hands, or larder empty with no runway. Lose → save deletes → new map. No legacy payout shop. Optional dry stats screen later (not progression).

## Explicitly rejected

- Attachment-as-product (chronicle, bonds, scars-as-grief, name-grief success metric)
- Torchbearer / embodied dusk
- Roguelike meta / legacy power shop as identity
- Persistent band / aging generations as spine
- Separate world-map expedition game
- Arrivals as campaign enrollment
- Depth-through-logistics: product variety, crop rotation, recipes, per-good hauling, pipelines (depth is geometry — roads, placement, evolution)
- Zoning UI, factions, elections

## v0 playable scope

- One map, hearth ring, four goods, chains ≤2
- Roads + connection; placement rules (one per building); dwellings evolve through 3 tiers
- Ages ladder (3–4 rungs): age structure + feast to advance, one charter each, Heat floor per age
- Labor assign, build/repair, gate accept/decline
- Local away-work with dusk-clock cost
- Heat + tonight’s bill, watched raids
- Beacon win (final age), collapse hard wipe
- Compact dawn board read; teach gate/scrap/push-out

## Design test

After a short session, can the player answer without coaching:

1. What am I short of, and what am I risking to get it?
2. Why did I accept or turn away the last wanderer?
3. Why was last night hard or easy — what daylight choice caused that?
4. Why is that house still a tent?
5. What age am I in, what would advancing cost me tonight, and why am I waiting?

If they talk about the map, the larder, the gate, and the skyline, the direction is working. If the best part was controlling one fighter at dusk — or untangling supply routes — we built the wrong game.
