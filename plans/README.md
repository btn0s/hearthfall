# Implementation Plans

Current batch generated 2026-07-08 against commit `d177bfd`, from the revised
[ROADMAP.md](../ROADMAP.md) (North Star and sequencing now derive from
[GDD.md](../GDD.md) v2). Execute in the order below unless dependencies say
otherwise. Each executor: read the plan fully before starting, honor its STOP
conditions, and update your row when done.

**Previous batch**: plans 001–008 (Phase 0, the characterization net, the
fixed-grid sidebar layout, the `BALANCE` table) were executed, merged to main
on 2026-07-08, and their plan files deleted. Recover them from git if needed:
`git show 97ef00b:plans/README.md` for the old index, history in
`git log --oneline 97ef00b..d177bfd`.

## Execution order & status

| Plan | Title | Roadmap IDs | Priority | Effort | Depends on | Status |
|------|-------|-------------|----------|--------|------------|--------|
| 009 | Split `screens.js` into `js/ui/` modules | P1-5 (+ P5-3 residual) | P1 | L | — | TODO |
| 010 | The campaign store: versioned cross-run persistence | HP-1 | P1 | M-L | — | TODO |
| 011 | Menace + the scouting report | HP-5 | P1 | M-L | — | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) | REJECTED (with one-line rationale)

## Dependency notes

- **Execution model: sequential, on main, no branches.** Run plans in
  numeric order; every plan ends in a commit checkpoint with all three gates
  green (staged plans may checkpoint per stage). 009 lands before 011 so
  011's small sidebar surface goes into the split files.
- The roadmap's **playtest gate is open** (one-on-one interviews per the Odd
  Realm method). It steers HP0 *tuning*, not architecture — these three plans
  are safe to execute in parallel with it.
- Not yet planned (next batch, in roadmap order): HP-2 cast v2 (large; write
  after 009 lands), then HP-3 arrivals, HP-4 torchbearer, HP-6 sapper, HP-7
  endings, HP-9 beacon pricing, HP-10 winter; enablement stragglers
  P1-6..P1-9 slot opportunistically.

## Findings considered and rejected

- **Seeded/persisted RNG** — save-scumming is plausibly by-design for this
  genre (autosave-at-dawn + delete-on-death already bounds it). Revisit only
  if daily challenges or reproducible bug reports become goals.
- **Renderer idle cost (roadmap P1-9)** — real (full repaint every rAF frame,
  per-frame night gradients) but invisible on desktop; deliberately deferred
  behind the design-phase work.
- **Legacy `bed` tile cruft** — harmless three-table remnant; bundle into any
  future save-shape change instead of a standalone plan.
- **World screen not pausing the sim** — judged intentional (expeditions
  travel while you plan); documented decision, not a bug.
- **Fit-to-window layout** — rejected by owner decision (plans 005): the
  fixed 100×45 CRT container is part of the game's identity. Do not
  re-propose.
