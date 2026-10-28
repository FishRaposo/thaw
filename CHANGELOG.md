# Changelog

All notable changes to Thaw are recorded here. The format follows Keep a Changelog; versions follow SemVer.

## [1.1.0] — 2026-10-28

### Added

- TypeScript build and strict type checking; `dist/` is the deployable artifact.
- `core` / `content` / `platform` / `presentation` module split with a boundary check.
- Stable room ids, the `LevelPack` contract, and a second five-room **Frostbite** pack.
- Per-pack, per-room progress with a migration from the old index-keyed save.
- Save/resume: the current room is persisted after each move and offered as **Continue**.
- Settings: volume, mute, reduced motion, fullscreen; persisted with guarded storage.
- Accessible pause/settings dialogs, `aria-live` announcements and keyboard focus.
- Chromium, Firefox and WebKit smoke journeys; axe scan of the DOM overlays.
- Build, serve, module-graph, packaging and release-check scripts.

### Changed

- `index.html` now loads built assets from `dist/`.
- The level select shows one tab per pack; `[`/`]` and gamepad shoulders switch packs.
- `Esc` pauses instead of leaving the room; `L` returns to the level select.
- README, architecture, content, release and agent documentation updated.

### Fixed

- Progress no longer shifts when a room is inserted: it is keyed by stable id.
- The pause dialog no longer closes on the Escape press that opened it.
- Version metadata is aligned with the release.

### Tests

- 29 unit tests cover both packs, every room at par, rules, undo, queueing, progress migration, saves and settings.
- Task verifier builds each state before its check and enforces starting + reference = `main`.
- `npm run verify` runs the three-browser smoke and accessibility gates.

## [1.0.0] — 2026-10-27

- Initial public release: twelve rooms, solver-proven par, undo, stars, synthesized audio, task pack and GitHub Pages/itch builds.
