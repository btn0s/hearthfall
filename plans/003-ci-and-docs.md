# Plan 003: Add CI, an AGENTS.md, and fix the stale README code map

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3ee106c..HEAD -- README.md package.json`
> Also `ls .github 2>/dev/null` — if a workflows directory already exists,
> STOP (someone added CI since this plan was written).

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (purely additive + docs)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `3ee106c`, 2026-07-07

## Why this matters

The repo has a healthy three-command verification story (`pnpm check` /
`pnpm lint` / `pnpm test`, all green) and a README that invites PRs — but no CI
enforces those gates, so any contributor or agent can land a breaking change
silently. There is also no AGENTS.md capturing the codebase's conventions (the
`G` singleton model, the screen contract, the hot-scan cache pattern), so every
agent session rediscovers them, and the README's "Code map" actively misleads:
it says `js/game.js` contains pathfinding, settler/raider AI, and save/load —
all of which live in other modules now.

## Current state

- **No `.github/` directory exists.**
- `package.json` scripts (verified working):

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "tsc -p jsconfig.json",
    "lint": "eslint js",
    "test": "vitest run"
  },
  ...
  "packageManager": "pnpm@11.5.2"
```

- README says Node 20+ (`README.md:34`). A `pnpm-lock.yaml` exists at the root.
- The stale code map is `README.md:123-139` ("## Code map" section). Its first
  entry currently reads:

```
- `js/game.js` — the sim: state, time, seasons, morale, pathfinding, settler/raider AI, economy, the Elder's counsel, save/load
```

- **Verified module inventory** (from the audit — use exactly this for the new
  code map; every claim below was read from source):
  - `js/main.js` — boot, fixed-step loop, debug hooks (`window.G`, `ff(mins)`)
  - `js/state.js` — the global run-state singleton `G` + tile helpers
  - `js/game.js` — tick orchestration, building/trade/objectives, the Elder's counsel; also re-exports most sim APIs
  - `js/data.js` — all content/balance tables (tiles, builds, civs, traits, perks, raiders, seasons, objectives, tips)
  - `js/settlers.js` — settler AI, roles, housing, combat vs raiders
  - `js/raiders.js` — raider archetype brains, raid composition/spawning
  - `js/world.js` — overworld generation, scouting, expeditions
  - `js/map.js` — local map generation · `js/path.js` — A*-ish pathfinding · `js/rng.js` — RNG
  - `js/save.js` — versioned save/load + migration · `js/meta.js` — legacy points/perks (persistent)
  - `js/seasons.js`, `js/fire.js`, `js/forecasts.js`, `js/journal.js`, `js/onboard.js`, `js/dawn.js`, `js/run-end.js`, `js/structures.js` — focused sim helpers (seasons, fire spread, sidebar forecasts, log/morale, tutorial tips, dawn events, run end, structure HP)
  - `js/ui.js` — screen stack, widget hit-testing, DOM input · `js/ui/menu.js` — reusable list-menu screen
  - `js/screens.js` — every screen and modal (game, world, menus, sidebar)
  - `js/gfx.js` — character-cell compositor over one canvas · `js/mapdraw.js` — ASCII renderer · `js/tiles.js` — pixel-sprite renderer + lighting · `js/glyph.js`, `js/portrait.js` — small drawing helpers
  - `js/gamepad.js` — Gamepad API → virtual keys · `js/mobile.js` — phone landing page
- Debug console line (`README.md:138-139`) is still accurate — keep it.
- Conventions for AGENTS.md (all verified): no runtime deps / no framework;
  plain ES modules; JSDoc + `tsc` for types (`jsconfig.json`); global mutable
  `G` singleton, every module imports it from `js/state.js` (sim modules) or
  via `js/game.js` re-exports (view modules); screens are plain objects per the
  contract documented at `js/ui.js:1-9`; hot full-map scans are cached
  per-game-minute (pattern: `postCache` `js/settlers.js:114-120`, `dmgCache`
  `js/game.js:162-177`, `elderCache` `js/game.js:194`); debug hooks `window.G`,
  `window.ff(minutes)`, `GAME`/`WORLD`/`META_M`/`UI`/`SCREENS` (`js/main.js:22-32`);
  grid facts: map 140×96 (`js/data.js:3`), cell grid 100×45 (`js/gfx.js:6`),
  viewport 72×38 (`js/data.js:4`).

## Commands you will need

| Purpose   | Command        | Expected on success |
|-----------|----------------|---------------------|
| Install   | `pnpm install` | exit 0              |
| Typecheck | `pnpm check`   | exit 0              |
| Lint      | `pnpm lint`    | exit 0              |
| Tests     | `pnpm test`    | all pass            |

## Scope

**In scope** (create/modify only these):
- `.github/workflows/ci.yml` (create)
- `AGENTS.md` (create, repo root)
- `CLAUDE.md` (create — one line pointing at AGENTS.md)
- `README.md` (Code map section only)

**Out of scope**:
- Any `js/` source file.
- Adding new scripts to `package.json` — CI uses the existing three.
- Branch protection settings (repo-admin action, not a file).

## Git workflow

- Branch: `advisor/003-ci-and-docs`
- Commits: one for CI, one for AGENTS.md/CLAUDE.md, one for the README fix.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4   # reads packageManager from package.json
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - run: pnpm lint
      - run: pnpm test
```

**Verify**: `pnpm install --frozen-lockfile && pnpm check && pnpm lint && pnpm test`
all exit 0 locally (the same commands CI will run). If a YAML linter is
available, lint the file; otherwise visual check that indentation is spaces.

### Step 2: AGENTS.md

Create `AGENTS.md` at the repo root with exactly these sections, filling them
from the verified facts in "Current state" above (write prose, not this plan's
bullet formatting; keep it under ~80 lines):

1. **What this is** — one paragraph: browser commune-survival roguelike, no
   runtime dependencies, plain ES modules on one canvas.
2. **Verify before you're done** — the three commands (`pnpm check`,
   `pnpm lint`, `pnpm test`) and `pnpm dev` (port 8137) for manual play;
   note the debug hooks (`G`, `ff(minutes)`, `GAME`/`WORLD`/`META_M`).
3. **Architecture in five lines** — `G` singleton (`js/state.js`) mutated in
   place by the fixed-step sim (`js/main.js` → `tickGame`); screen-stack UI of
   plain screen objects (contract in the comment at the top of `js/ui.js`);
   two swappable renderers (`js/mapdraw.js` ASCII, `js/tiles.js` sprites) over
   the cell compositor (`js/gfx.js`); content/balance lives in tables in
   `js/data.js`; persistence is versioned JSON in localStorage (`js/save.js`
   runs, `js/meta.js` meta-progression).
4. **House rules** — no runtime deps; JSDoc types (checked by `tsc`), not
   TypeScript syntax; cache any full-map scan per game-minute (point at
   `postCache`, `js/settlers.js:114`); ephemeral UI state never goes in the
   save (see `EPHEMERAL`, `js/save.js:9`); bump `SAVE_VERSION` + extend
   `migrate()` when the save shape changes; keep the two renderers showing the
   same information.
5. **Key dimensions** — map 140×96, cell grid 100×45, viewport 72×38, sidebar
   26 cols at x=74. (If plan 005 has landed and these became dynamic, describe
   them as the *defaults* from `js/layout.js` instead — check first.)

Create `CLAUDE.md` containing exactly:

```markdown
See [AGENTS.md](AGENTS.md).
```

**Verify**: `test -f AGENTS.md && test -f CLAUDE.md && wc -l AGENTS.md` →
both exist, AGENTS.md ≲ 90 lines. Every file path named in AGENTS.md exists
(`ls` each).

### Step 3: Fix the README code map

Replace the list inside the "## Code map" section (`README.md:123-139`) with an
accurate one built from the module inventory in "Current state". Keep it in the
README's existing voice (short dash-separated descriptions, backticked paths),
keep the debug-console paragraph that follows, and keep it compact — group the
small helpers on shared lines the way the inventory above does. The first line
must no longer claim game.js owns pathfinding/AI/save-load; describe it as
"tick orchestration, building/trade/objectives, the Elder's counsel".

**Verify**:
`grep -n "pathfinding" README.md` → no match on the `js/game.js` line (only, if
anywhere, on a `js/path.js` line);
`grep -c "js/settlers.js\|js/raiders.js\|js/save.js" README.md` → ≥ 3.

## Test plan

No JS changes — the "tests" here are the done-criteria greps plus the local dry
run of the CI command sequence in Step 1.

## Done criteria

- [ ] `.github/workflows/ci.yml` exists and the three verify commands pass locally with `--frozen-lockfile` install
- [ ] `AGENTS.md` exists with the five sections; `CLAUDE.md` points at it
- [ ] README code map names `js/settlers.js`, `js/raiders.js`, `js/save.js`, `js/state.js`, `js/ui/menu.js`
- [ ] `git status` shows only the four in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

- `.github/` already exists (drift — someone added CI first).
- An AGENTS.md or CLAUDE.md already exists — reconcile, don't overwrite: report
  what's there.
- Any fact you're about to write into AGENTS.md contradicts what you see in the
  code (e.g. the cache pattern moved) — verify against source and report the
  discrepancy rather than copying this plan blindly.

## Maintenance notes

- When plan 005 (fit-to-window layout) lands, AGENTS.md §5 and possibly the
  README need the "fixed grid" language updated — 005's plan notes this too.
- If a `test/` reorganization ever splits vitest configs, update the CI file's
  single `pnpm test` accordingly.
- Consider (out of scope here) a future `pnpm build` step in CI once anything
  build-sensitive (asset pipeline, import maps) appears.
