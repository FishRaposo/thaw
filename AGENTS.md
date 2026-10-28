# Agent instructions — Thaw

Read the shared contract first: [`../STANDARD.md`](../STANDARD.md). This file is the Thaw-specific working procedure.

## Commands

```bash
npm ci
npm run check          # tsc -p tsconfig.test.json
npm run build          # clean + tsc + check-dist
npm start              # build, watch and serve http://localhost:8080
npm test               # node --test "test/**/*.test.ts"
npm run test:coverage
npm run tasks          # fail-before / pass-after task pack
npm run smoke          # Chromium, Firefox and WebKit journeys
npm run a11y           # axe scan of the DOM overlays
npm run package        # dist/thaw-web.zip
npm run verify         # everything above
```

Node 24 LTS is required. Runtime dependencies stay at zero; TypeScript, Playwright and axe are dev-only.

## Layout

```
src/core/         rules, solver, session, shared content types (no DOM)
src/content/      the core and Frostbite rooms, with stable ids
src/platform/     audio, storage, settings
src/presentation/ renderer, HUD, accessible dialogs
src/main.ts       composition root: input, animation, screens, save/continue
test/             node:test suites
tasks/            task pack and verifier
scripts/          build, serve, search, smoke, a11y, package, release
```

Dependency rule: `core` imports only core; `content` imports core types; `platform` imports core types and never presentation; `presentation` imports core/content types and receives platform services from `main.ts`; `main.ts` wires everything. `node scripts/check-boundaries.mjs` enforces it.

## Invariants

- `core/rules.ts` is pure: state plus `move()`, no DOM, no timers. `core/session.ts` is pure too: time is passed in.
- Every room's `par` is the true shortest solution; the solver re-proves it on every test run.
- Progress is keyed by `packId` and room `id`, never by list index. A new room must not reuse an old id.
- A move that changes nothing does not count; undo restores every changed tile.
- Rendering only animates events; it never decides an outcome.
- Task checks must fail on the starting state and pass on the reference. Do not weaken a check to make a refactor pass.
- For bug tasks, starting + reference must reproduce `main` exactly. The verifier enforces it.

## Task pack

- Checks stay `.mjs` and import the built `dist/` modules; do not rewrite check bodies during a refactor.
- Regenerate patches from a temp copy; never hand-edit hunks. After any source move:
  1. `git apply --check` the existing patch.
  2. If it fails, rebuild the starting state, run `git diff` to regenerate, and re-run `npm run tasks`.
- Do not add new tasks while the module tree is moving.

## Content

Read [`docs/CONTENT.md`](docs/CONTENT.md). A new room must be solvable, its par must come from the solver, and any mechanic it teaches must actually be required. A new pack must use unique stable room ids and be added to `PACKS`. Run `npm test`, `npm run tasks` and `npm run smoke` after a content change.

## Release

Read [`docs/RELEASING.md`](docs/RELEASING.md). Bump `package.json` and `src/version.ts` together, add a dated `CHANGELOG.md` entry, run `npm run verify`, then follow the merge/tag/release/Pages/itch procedure. Public page copy and profile claims are Claude-owned; prepare measured facts, do not rewrite the descriptions.

## Never

- Commit `dist/`, `node_modules/`, `site/`, `coverage/` or `.tmp/`.
- Add a runtime dependency.
- Leave a generated file or a task patch drifting.
- Claim a browser was verified when only Chromium ran.
- Put room data back in core or duplicate a room id.
