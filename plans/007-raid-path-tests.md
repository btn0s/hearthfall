# Plan 007: Characterization tests — raids, pathing, expeditions (P1-3)

## Status: DONE

Locks down `findPath` (walls, `noDoor`, raider walls, boxed-in), `raidEstimate`
invariants, `spawnRaid` activation, and expedition success via `tickWorld`.
Run-end idempotence lives in `test/meta.test.js` (plan 004).

**Tests:** `test/raid-path.test.js` (11 cases)
