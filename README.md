# HEARTHFALL

**Play it live: <https://hearthfall.vercel.app>**

A commune-survival roguelike in the browser — Dwarf Fortress bones,
State of Decay community pressure, Fallout 4 base building, and a
death-feeds-the-next-run legacy loop. No dependencies, no build step: plain
ES modules rendered to a canvas character grid.

New players are guided in: a story splash opens each run, an **objective
chain** in the sidebar walks you from first tree to first bandit camp
(with resource and legacy rewards), and one-time contextual **tips** fire
at key moments — first night, low food, first raid, first trader.

Two graphics modes, toggled with `v` (or from the main menu, persisted):
**Tiles** — procedurally drawn pixel-art sprites with animated water and
fire, day/night lighting, and campfire glow — and **ASCII** — the classic
character-grid look. Full **controller support** via the Gamepad API.

## Run it

```sh
python3 -m http.server 8137 -d hearthfall
# then open http://localhost:8137
```

(Any static file server works — ES modules just can't load from file://.)

## The loop

Pick a people, run the commune, survive as long as you can. When it falls —
and it will — the run is scored (days survived, raids repelled, sites
cleared, kills, peak population) and paid out as **legacy ◆**, spent on
permanent perks that make every future run start stronger. Runs autosave at
dawn; death deletes the save. That's the deal.

**Civs** (chosen at New Game): the Tillers (faster crops, extra farmer),
the Wardens (harder-hitting guards, extra guard), the Ratcatchers (faster,
stronger expeditions, starting coin), the Masons (faster construction,
tougher walls, starting stone).

**Legacy perks** (8): starting stockpiles, permanent crop/wall bonuses,
trader discounts, extra starting settler, pre-scouted world sites.

## How to play

| Key | Action |
| --- | --- |
| `b` | build menu — walls, doors, farms, beds, traps, watch posts, workshop, kitchen, crafting |
| `t` / `m` / `g` | designate: chop trees ♠ / mine rocks ▲ / forage herb bushes `"` |
| `x` | cancel plans / demolish |
| `w` | world map — pick a site, pick a party, launch a quest |
| `e` | trade with the visiting caravan (arrives every few days) |
| `space` | pause · `1/2/3` game speed · `?` help · `Esc` close menus |
| `v` | toggle graphics: pixel tiles / classic ASCII |
| `Q` | save & quit to the main menu |
| click | a settler's name (sidebar or map) cycles their role |
| arrows | move the map cursor · `Enter` acts at the cursor (full keyboard play) |

**Controller** (standard layout): stick/d-pad moves the cursor and
navigates every menu · A confirm/act (hold to drag-paint) · B back ·
X build menu · Y world map · LB/RB cycle tools · LT/RT game speed ·
Start pause · Back help · R3 graphics toggle.

**Roles.** Workers build/chop/mine/craft, farmers farm/cook/forage, guards
only fight. Settlers handle eating and sleeping themselves.

**Economy.** Crops → raw food → kitchen **meals** (more filling). Herb
bushes → **herbs** → medkits at the workshop. Wood + scrap → spears. The
trader converts surplus into **coin** and coin into anything else.

**Progression.** 6 settlers unlock tier II (watch post, workshop, kitchen);
9 unlock tier III (stone walls). Guards within reach of a watch post shoot
arrows at raiders instead of chasing them.

**Raids** come at dusk every few days, scaling with survival time. Raiders
bash through walls and doors — layer palisades, funnel them through spike
traps, garrison the towers. Clearing a bandit camp on the world map delays
the next raid.

## Code map

- `js/game.js` — state, time, pathfinding, settler/raider AI, economy, trader, save/load
- `js/world.js` — overworld generation, expeditions, quest resolution
- `js/meta.js` — persistent legacy points, perks, run records
- `js/render.js` — every screen drawn into one ASCII cell buffer, then painted
- `js/tiles.js` — the sprite mode: procedural pixel-art atlas + lighting
- `js/gamepad.js` — Gamepad API polling mapped onto the shared key handler
- `js/ui.js` / `js/main.js` — input routing and the fixed-step game loop
- `js/map.js`, `js/data.js`, `js/rng.js` — mapgen, content tables, RNG

Debug console: `G` is the game state, `ff(minutes)` fast-forwards the sim,
`GAME`/`WORLD`/`META_M` expose the modules.
