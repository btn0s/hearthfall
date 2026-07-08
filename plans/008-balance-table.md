# Plan 008: Extract balance constants into BALANCE table (P1-4)

## Status: DONE

Hoisted tick-loop tuning from `game.js`, `settlers.js`, `raiders.js`, `forecasts.js`,
`journal.js`, `fire.js`, and `world.js` into `js/balance.js`. Behavior-identical;
existing characterization tests are the regression net.

**Verify:** `pnpm check && pnpm lint && pnpm test`
