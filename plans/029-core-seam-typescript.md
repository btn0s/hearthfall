# Plan 029: HR-0 — core seam + TypeScript baseline

> **Executor instructions**: Follow this plan stage by stage. Each stage ends
> in its own green-gate commit checkpoint on `main` — run every verification
> command and confirm the expected result before committing. If anything in
> "STOP conditions" occurs, stop and report — do not improvise. When done,
> update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat af14cf7..HEAD -- js/ test/ jsconfig.json eslint.config.js vite.config.js index.html package.json`
> If anything under `js/` changed since `af14cf7`, re-read the changed files —
> every excerpt below was verified at that commit. If `js/ui/` already
> contains more than `menu.js`, Stage A may already be done; check
> `git log --oneline | grep -i "screens"` before cherry-picking.

## Status

- **Priority**: P0 (foundation — lands before HR-1)
- **Effort**: M-L (three checkpoints; a timeboxed fourth)
- **Risk**: MED (touches every file's imports; zero behavior change intended,
  protected by the characterization net + typecheck at every step)
- **Depends on**: none
- **Category**: tech-debt / architecture
- **Planned at**: commit `af14cf7`, 2026-07-10
- **Roadmap ID**: HR-0 (ROADMAP.md route table)

## Why this matters

HR-1..HR-10 will roughly double the codebase (heat ledger, road graph,
placement rules, dwelling evolution, age state, charters). Three foundations
are cheapest *before* that happens, and each is already half-paid-for:

1. **The screens split already exists** — commit `5e256ea` (retired plan 009,
   executed on the campaign branch) has parent exactly `95e0170`, so it
   cherry-picks onto the current main with only a one-row doc conflict. It
   shrinks `screens.js` from 1,099 lines to ~260 and gives HR-4/HR-9 UI a
   sane home.
2. **TypeScript is nearly free here** — `pnpm check` already runs `tsc` with
   `checkJs` over ~5,000 lines; `typescript@^5.5` is already a devDependency;
   Vite and Vitest consume `.ts` natively. Migrating swaps JSDoc-comment
   types for first-class ones *before* the HR systems are written in the old
   idiom. The concentrated win is typing `G` — the whole game state,
   documented and drift-proof, right before Heat/ages/roads add fields to it.
3. **The barrel dies during the rename anyway** — `js/game.js:10-25`
   re-exports **47 symbols from 12 modules** (verified count) while also
   being the tick loop. The rename rewrites every import in the repo, so
   repointing consumers to definers costs nothing extra now and would cost a
   second full-repo sweep later.

The seam itself — `js/engine/` with an enforced import direction — is the
contract that keeps HR work from re-tangling the core: engine modules never
import from the game.

## Current state (verified at `af14cf7`)

- **Typecheck**: `jsconfig.json` — `checkJs: true, strict: false, noEmit`,
  includes `js/**/*.js` + `vite.config.js`. `pnpm check` = `tsc -p jsconfig.json`.
- **Lint**: `eslint.config.js` — flat config, `@eslint/js` recommended,
  `files: ['js/**/*.js']`, browser globals listed manually, two relaxed rules.
  No TS parser installed.
- **Entry**: `index.html:56-57` — two module scripts, `js/main.js` and
  `js/mobile.js` (Vite serves/bundles them).
- **The barrel** (`js/game.js:9-25`): re-exports from `state` (5 symbols,
  line 10 — note line 9 *imports* the same five for its own use), `save` (4),
  `path` (2), `seasons` (7), `journal` (4), `structures` (3), `forecasts`
  (3), `run-end` (2), `onboard` (1), `settlers` (13), `raiders` (2), `fire`
  (1) = **47**.
- **Size**: 4,957 lines in `js/*.js` + `js/ui/menu.js`; biggest:
  `screens.js` 1,099 · `tiles.js` 546 · `settlers.js` 486 · `game.js` 475.
- **Tests**: 7 files, 52 tests, imports like
  `import { BALANCE } from '../js/balance.js'` (`test/balance.test.js:2`).
- **The cherry-pick** (`5e256ea`): touches `js/screens.js`, `js/game.js`
  (+3 lines: mutators), `js/main.js`, five new `js/ui/*.js` files,
  `test/ui-smoke.test.js` (+61 lines), and one row of `plans/README.md`.
  Parent is `95e0170`; since then main changed only docs and
  `vite.config.js`, so **the sole expected conflict is `plans/README.md`**
  (that index was rewritten at the pivot).

## Design

Four stages, each an independent green checkpoint. Stop after any of them
and the repo is strictly better than before.

**Stage A — take the screens split.** `git cherry-pick 5e256ea`; resolve the
`plans/README.md` conflict by keeping ours (the incoming hunk updates a
retired index). Zero behavior change; the new `test/ui-smoke.test.js` raises
the test count (record the new number — it becomes the baseline below).

**Stage B — TypeScript migration + barrel untangle, one sweep.**
- `jsconfig.json` → `tsconfig.json`: same options, plus
  `"allowJs": true` during the sweep; **parity first** — keep
  `strict: false` at this stage so the checkpoint measures the rename, not
  new rigor (Stage D ratchets).
- **Import convention flips to extensionless** (`'./rng'` not `'./rng.js'`):
  Vite does not resolve a `'./x.js'` specifier to an `x.ts` file, so the
  extension must go. Mechanical rewrite across `js/` and `test/`
  (`grep -rl "from '\./.*\.js'" js/ test/` then sed), done file-by-file as
  each renames, or as one up-front sweep — executor's choice, gates decide.
- Rename leaf-first (`git mv x.js x.ts`): `rng`, `glyph`, `data`, `balance`,
  `seasons`, `path`, then `state` — **type `G` properly here** (a
  `GameState` interface; `any` islands are acceptable at parity, each marked
  `// TODO(strict)`), then the middle ring (`journal`, `structures`,
  `forecasts`, `save`, `meta`, `fire`, `map`, `onboard`, `portrait`, `dawn`,
  `world`, `settlers`, `raiders`), then renderers/input (`gfx`, `tiles`,
  `mapdraw`, `gamepad`, `mobile`, `ui`, `ui/*`, `screens`), finally `game`
  and `main`.
- **Barrel untangle rides the `game.ts` rename**: delete the re-export block
  (`game.js:10-25`); repoint every consumer to the defining module
  (`grep -rn "from './game'" js/`, `grep -rn "../js/game" test/` after the
  extensionless sweep). `game.ts` keeps the tick loop and its own exports
  only. The two deliberately-deferred navigation cycles from the screens
  split (`screens ↔ ui/title`, `ui/title ↔ ui/modals`) are call-time-safe —
  re-accept them, do not resolve them here.
- `index.html`: script srcs → `js/main.ts`, `js/mobile.ts`.
- `package.json`: `"check": "tsc -p tsconfig.json"`.
- ESLint: add `typescript-eslint` (devDependency — runtime stays
  dependency-free), switch the config to its recommended flat preset over
  `js/**/*.ts`; drop the hand-listed globals in favor of
  `globals.browser` or keep the manual list — smallest diff wins.
- Delete `js/globals.d.ts` only if its contents moved into real types.

**Stage C — carve `js/engine/`.** Move only what the import graph proves
generic **at execution time**: candidates are `gfx.ts`, `rng.ts`, `glyph.ts`
(expected zero game imports — verify:
`grep -n "from '\./" js/gfx.ts js/rng.ts js/glyph.ts`). `ui.ts`,
`gamepad.ts`, `path.ts` read `G`/tile data today — they **stay put** with a
note; they earn engine residency later via small seams (injectable
passability for `path`, binding table for `gamepad`), not this plan. Add the
boundary rule to `eslint.config.js`:

```js
{
  files: ['js/engine/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['../*', '../../*'] }] },
}
```

Engine modules import each other with `'./x'` only. If a moved module needs
a parent import, it was misclassified — move it back rather than widening
the rule.

**Stage D — strictness ratchet (timeboxed, ~half a day, stop anywhere
green).** Flip `strict: true`; fix in dependency order; minimum bar:
`js/engine/` and `state.ts` strict-clean with `// TODO(strict)` debt
enumerated for the rest. Never change behavior to satisfy a type — a type
error that demands a behavior change is a finding to report, not fix here.

## Commands

| Gate | Command | Expect |
|------|---------|--------|
| Types | `pnpm check` | clean (tsconfig after Stage B) |
| Lint | `pnpm lint` | clean |
| Tests | `pnpm test` | 52 + ui-smoke, all green, count never drops |
| Boot | `pnpm dev` → open :8137 | title renders, New Game starts, `v` toggles renderers |

## Scope

**In**: the cherry-pick; `.js`→`.ts` rename with parity typing; typed `G`;
extensionless imports; barrel removal; `js/engine/` for provably-generic
modules; ESLint boundary; AGENTS.md convention update; strictness ratchet.

**Out (binding)**: any behavior change; moving `ui`/`gamepad`/`path` into
engine (needs seams — later); renderer refactors (retired P1-7/P1-9 drafts);
README identity rewrite beyond one line; new systems of any kind.

## Git workflow

Sequential on `main`, no feature branch. Four checkpoints:
1. `Take the screens split (cherry-pick 5e256ea)` — the cherry-pick commit
   plus conflict resolution.
2. `Migrate to TypeScript; retire the game.js barrel`
3. `Carve js/engine/ with an enforced import boundary`
4. `Strictness ratchet: strict tsc over engine and state` (or as far as the
   timebox got)

All three gates green before each commit. `pnpm dev` boot-check before 1, 2,
and 3 (renames can pass tsc and still 404 in the browser if an
`index.html`/dynamic-import path was missed — the boot check catches what
the gates cannot).

## Steps

1. Drift check (above); record the current test count.
2. **Stage A**: `git cherry-pick 5e256ea` → resolve `plans/README.md` (keep
   ours) → gates + boot → commit checkpoint 1.
3. **Stage B**: tsconfig; extensionless sweep; leaf-first renames with
   parity types (`G` typed at `state.ts`); barrel removal with consumer
   repoint; `index.html` + `package.json`; typescript-eslint. Gates + boot
   after each rename batch; commit checkpoint 2 when the last `.js` under
   `js/` is gone (`ls js/**/*.js` → empty).
4. **Stage C**: verify candidates' import purity; `git mv` into
   `js/engine/`; boundary rule; repoint importers. Gates + boot → commit
   checkpoint 3.
5. **Update AGENTS.md**: new-code conventions — TypeScript, extensionless
   imports, direct imports only (no barrels), `js/engine/` never imports
   game code, `pnpm check` runs `tsc -p tsconfig.json`. Fold into checkpoint
   3's commit.
6. **Stage D**: ratchet within the timebox; commit checkpoint 4 at the last
   green point; enumerate remaining `TODO(strict)` in the commit body.
7. Update this plan's row in `plans/README.md` to DONE (fold into the final
   checkpoint).

## Test plan

- Existing 52 tests + `ui-smoke` green at every checkpoint — they are the
  behavior contract; no test edits except import paths.
- After Stage B: `node --experimental-strip-types` is NOT assumed — the
  smoke check is `pnpm test` + `pnpm dev` boot, which exercise the real
  Vite/Vitest resolution.
- After Stage C: `pnpm lint` proves the boundary (temporarily add a game
  import to an engine file → expect an error → remove it).
- Manual sweep once, at the end: title → New Game → build a wall → save →
  reload → Continue (camera centered) → both renderers → pad input (cursor,
  build, alarm).

## STOP conditions

1. The cherry-pick conflicts anywhere **outside** `plans/README.md` — the
   base has drifted from this plan's model; re-derive before proceeding.
2. `tsc` parity errors that cannot be fixed without changing behavior —
   report the finding; do not "fix" the code to satisfy the type.
3. Vite fails to resolve an extensionless import in dev or build — stop and
   diagnose the resolution config before renaming further.
4. The boundary rule forces an exception for an engine module — the module
   was misclassified; move it back out of `js/engine/` instead.
5. The test count drops below the Stage-A baseline at any checkpoint.

## Maintenance notes

- New modules: TypeScript, extensionless relative imports, import from the
  defining module (never re-export hubs), and anything generic-and-G-free
  belongs in `js/engine/`.
- `ui`/`gamepad`/`path` are engine candidates awaiting seams — revisit after
  HR-4 shows what the road graph needs from `path`.
- The strictness debt is enumerated as `TODO(strict)` comments; burn it down
  opportunistically as HR items touch each file.
