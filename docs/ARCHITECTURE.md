# Thaw — architecture

## What the game is

An ice-sliding puzzle game. The rules are a small pure state machine; the browser layer animates the events the rules emit. A breadth-first solver proves every room's par and is reused by the tests, the level search and the hint task.

## Modules

| Module | Responsibility | DOM? |
|---|---|---|
| `src/core/types.ts` | Shared `LevelDef`, `LevelPack`, `PackProgress`, `Progress` contracts | no |
| `src/core/rules.ts` | Tiles, sliding, kicking, sinking, cracking, win state | no |
| `src/core/solver.ts` | BFS over game states; shortest solution and explored count | no |
| `src/core/session.ts` | Pack flow, undo, restart, stars, progress, input queue, animation pacing | no |
| `src/content/levels.ts` | The core and Frostbite rooms, with stable ids | no |
| `src/main.ts` | Boot, keyboard/pointer/gamepad input, screen state, animation, save/continue | yes |
| `src/presentation/render.ts` | Board, HUD, level select, won/done screens | yes |
| `src/presentation/menus.ts` | Accessible pause/settings dialogs and `aria-live` announcements | yes |
| `src/platform/audio.ts` | Synthesized WebAudio effects and volume/mute | yes |
| `src/platform/storage.ts` | Guarded progress, run save and migration | yes |
| `src/platform/settings.ts` | Guarded settings with reduced-motion default | yes |

Dependency rule, enforced by `scripts/check-boundaries.mjs`:

- `core` imports only `core` (including the type contracts in `core/types.ts`).
- `content` imports core types and holds data.
- `platform` imports core types; never `presentation`.
- `presentation` imports core/content types and receives platform services from `main.ts`.
- `main.ts` is the composition root.

## Data flow

Input → `Session.input()` → `rules.move()` mutates the game state and emits events → `main.ts` groups events into animations → `render.ts` draws the view. At rest, the view snaps to the rules state, so animation can never disagree with the simulation.

`Session` takes a `LevelPack` and a per-pack progress object. It never imports level data. Progress is keyed by room id, so inserting a room does not shift stars.

## Determinism

- `rules.ts` has no randomness; the same move sequence always produces the same state.
- `session.ts` receives `now` as an argument; it never reads a clock.
- The solver explores cloned states with a canonical key; every move costs one, so the first win is a shortest solution.
- The input queue is bounded at three; queued moves play after the current animation.

## Packs and progress

- `core/types.ts` defines `LevelDef { id, name, par, note?, rows }` and `LevelPack { id, name, version, levels }`.
- `content/levels.ts` exports `CORE_PACK`, `FROSTBITE_PACK`, `PACKS` and the `LEVELS` alias used by task checks.
- Progress is `Record<packId, Record<levelId, stars>>` in `thaw.progress.v2`. `loadLegacyProgress()` reads the old index-keyed `thaw.progress.v1`; `main.ts` maps indexes to core room ids once and writes v2.

## Save and settings

- `thaw.save.v1` stores the current pack/room ids, level index, tiles, player, crates, move count and timestamp. It is written after each move, cleared on a fresh start/win, and validated on read. A resume restores the room but not the undo history.
- `thaw.settings.v1` stores volume, mute and reduced motion. `prefers-reduced-motion` is the default. The old `thaw.muted.v1` key is read once when settings do not exist yet.
- Every storage read is guarded; private windows and blocked storage still play, without persistence.

## Build and deploy

- `tsc` emits browser-native ES modules to `dist/`; there is no bundler.
- `index.html` loads `dist/main.js` and `dist/styles.css` with relative paths.
- GitHub Pages uploads `index.html` + `dist/`; the itch zip has the same layout at its root.
- `scripts/check-dist.mjs` rejects bad imports; `scripts/check-module-graph.mjs` proves the artifact under the Pages prefix.
- `npm run smoke` runs a real journey in Chromium, Firefox and WebKit; `npm run a11y` scans the DOM overlays.
