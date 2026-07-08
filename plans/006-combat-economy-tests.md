# Plan 006: Characterization tests — combat + economy tick (P1-2)

## Status: DONE

Locks down `woundSettler` down-vs-die coin flip, `hitRaider`/`warlord` horde-break via
`tickSettler`, and hunger→eat→starve behavior. RNG stubbed with `vi.spyOn` on `js/rng.js`.

**Tests:** `test/combat-economy.test.js` (9 cases)
