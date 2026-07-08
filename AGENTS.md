# HEARTHFALL — agent guide

## What this is

HEARTHFALL is a browser commune-survival roguelike: a fixed-step simulation of named settlers, raids, and legacy meta-progression, rendered on one canvas with no runtime dependencies. The codebase is plain ES modules — no framework, no bundler-required patterns beyond Vite for dev.

## Verify before you're done

Run all three gates before claiming a change is complete:

```bash
pnpm check    # tsc -p jsconfig.json
pnpm lint     # eslint js
pnpm test     # vitest run
```

For manual play: `pnpm dev` serves at http://localhost:8137.

Debug hooks (exposed from `js/main.js`): `window.G` is the live game state; `window.ff(minutes)` fast-forwards the sim; `GAME`, `WORLD`, `META_M`, `UI`, and `SCREENS` are lazy imports of the major modules.

## Architecture in five lines

The global run-state singleton `G` (`js/state.js`) is mutated in place by a fixed-step loop in `js/main.js` that calls `tickGame`. UI is a screen stack of plain objects — see the contract comment at the top of `js/ui.js` — with hit-testing over declared widget rects. Two swappable renderers (`js/mapdraw.js` ASCII, `js/tiles.js` sprites) paint through the cell compositor (`js/gfx.js`). Content and balance live in tables in `js/data.js`. Persistence is versioned JSON in localStorage: per-run state in `js/save.js`, cross-run legacy in `js/meta.js`.

## House rules

No runtime dependencies. Types are JSDoc annotations checked by `tsc`, not TypeScript syntax. Cache any full-map scan per game-minute — see `postCache` in `js/settlers.js:114`, `dmgCache` and `elderCache` in `js/game.js`. Ephemeral UI state never goes in the save (see `EPHEMERAL` in `js/save.js:9`). When the save shape changes, bump `SAVE_VERSION` and extend `migrate()`. Keep the two renderers showing the same information.

Screens are plain objects pushed onto the stack in `js/ui.js`; modals set `pausesSim: true` unless the sim must keep running (the world screen is the intentional exception). View modules may import `G` via `js/game.js` re-exports; sim modules import directly from `js/state.js`.

## Key dimensions

World map: 140×96 tiles (`js/data.js`). Cell grid: 100×45 (`js/gfx.js`). Viewport (camera window): 70×38 (`js/data.js`). Sidebar: 28 columns starting at x=72.
