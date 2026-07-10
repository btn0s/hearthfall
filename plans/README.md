# Implementation Plans

Empty by design — reset 2026-07-09 with the hearth-ring pivot
([DESIGN.md](../DESIGN.md) is the design authority,
[ROADMAP.md](../ROADMAP.md) v3 the route).

Plans are drafted per roadmap item (HR-1..HR-7) as execution approaches, two
or three at a time, in the established house style: drift check, verified
code excerpts, staged steps with `pnpm check`/`pnpm lint`/`pnpm test` gates,
STOP conditions. Execution is **sequential on main**, each plan a green-gate
commit checkpoint.

## History

- **Plans 001–008** (enablement: Phase 0 fixes, characterization tests,
  fixed-grid sidebar, `BALANCE` table) — executed and merged; still the
  foundation. Index: `git show 97ef00b:plans/README.md`.
- **Plans 009–028** (GDD v2 campaign flip / HP0) — 009–021 were executed on a
  local branch and the premise was falsified in play; the build is archived
  at `archive/hp0-campaign-flip` for reference, and the plan files are
  recoverable via `git show 95e0170:plans/`. Do not restore; ROADMAP v3 says
  which pieces serve as reference implementations (011 → Heat, 013 → gate,
  018 → beacon exam, 009 → cherry-pick `5e256ea`).

## Status

| Plan | Title | Roadmap ID | Status |
|------|-------|-----------|--------|
| 029 | Core seam + TypeScript baseline (screens split · TS migration · barrel retirement · `js/engine/` boundary) | HR-0 | TODO |
| — | *next: HR-1 hard wipe* | HR-1 | UNPLANNED |

Numbering continues from the retired sequence (001–028) so history stays
unambiguous.
