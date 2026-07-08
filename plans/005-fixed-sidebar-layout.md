# Plan 005 (revised): Decompress the sidebar inside the fixed CRT grid

> **Supersedes** the original fit-to-window plan (`005-ui-space-redesign.md`),
> rejected on owner feedback: keep the 100×45 / 1100×855 CRT-aspect container;
> improve layout *within* it.

## Status

- **Priority**: P1 (user priority)
- **Effort**: M
- **Risk**: LOW–MED (screens.js layout only; viewport −2 cols)
- **Roadmap**: P1-10 (revised scope)
- **Depends on**: 001–004 recommended

## Goal

More breathing room in the sidebar without `computeLayout`, cell scaling, or
window-driven grid growth. Rebudget fixed columns and rows:

| Dimension | Before | After |
|-----------|--------|-------|
| Map viewport | 72×38 | 70×38 |
| Sidebar text | 26 cols @ x=74 | 28 cols @ x=72 |
| Resource lines | 4 | 2 (food + combined mats) |
| Settler list cap | 12 | 14 |
| Minimap row cap | 15 | 17 |
| Elder counsel wrap | 15 chars | 18 chars |

Canvas size, cell dimensions, and total grid stay unchanged.

## Out of scope

- Fit-to-window / dynamic `js/layout.js`
- Live resize reflow
- `screens.js` file split (P1-5)

## Verification

- `pnpm check && pnpm lint && pnpm test`
- Manual: sidebar text no longer clips tier names; 14 settlers visible before
  minimap shrinks; minimap and mouse hit targets still align
