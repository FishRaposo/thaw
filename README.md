# Thaw

An ice-sliding puzzle game in seventeen rooms across two packs, with a solver that proves every one of them.

![Thaw gameplay: the player slides across ice, kicks a crate into the water to make a bridge, and reaches the hut](media/demo.gif)

You slide until something stops you. Ice keeps you going; snow, rock and crates stop you. Kick a crate and it slides by the same rules; slide one into water and it sinks and freezes into a snow tile you can stand on. Cracked ice breaks behind whatever leaves it. Reach the hut in as few moves as you can: par earns three stars.

The core pack teaches one mechanic at a time. **Frostbite** is a second five-room pack for players who already know the rules: it mixes crates, water and cracked ice without a tutorial. Your stars are saved per room, so adding a room later never shifts them.

Designed and built with AI assistance (Claude) to Vinícius Raposo's brief, then tested like production software.

**Project page:** [fishraposo.github.io/projects/thaw.html](https://fishraposo.github.io/projects/thaw.html)

**Play:** [on itch.io](https://fishraposo.itch.io/thaw) or [the GitHub Pages build](https://fishraposo.github.io/thaw/), both in the browser, or run it locally:

```bash
git clone https://github.com/FishRaposo/thaw.git
cd thaw
npm ci               # dev-only tooling: TypeScript, Playwright and axe
npm start            # builds, watches and serves http://localhost:8080
```

Node 24 LTS is required. `npm start` builds `dist/`; opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.

## Controls

| | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Slide | arrows or WASD | d-pad | swipe |
| Undo | Z, U or Backspace | B | "undo" button |
| Restart | R | Y | "restart" button |
| Levels | Esc or L | Start | "levels" button |
| Confirm / next | Enter or Space | A | tap |
| Pause | Esc | Start / B | pause dialog |
| Settings | O | X | "settings" button |
| Pack | [ or ] | LB / RB | pack tab |
| Continue a run | C | | "continue" button |
| Fullscreen · mute | F · M | | |

Moves pressed while you're still sliding are queued (up to three) and play in order, so you never lose a press. Pause and settings open an accessible dialog; the game pauses when the tab is hidden.

## Save and settings

- A run is saved after every move (`thaw.save.v1`). The level select offers **Continue** after a reload; starting a room fresh or winning clears it.
- Progress is stored per pack and room id (`thaw.progress.v2`). The old index-keyed progress is migrated once.
- Settings (`thaw.settings.v1`) keep volume, mute and reduced motion. Reduced motion is the default when the operating system asks for it.
- All storage reads are guarded: private windows and blocked storage still play, without persistence.

## Under the hood

No engine, no runtime dependencies, no asset files: TypeScript compiled to browser-native ES modules, on a 2D canvas, with synthesized sound. There is no bundler.

- **Rules, session and screen are separate.**
  - `src/core/rules.ts` is the game: pure functions over a small state.
  - `src/core/session.ts` is everything between the rules and the screen: packs, undo, restart, stars, progress, and pacing input against the slide animation. Time is passed in, so a whole play session can be driven in a test.
  - `src/main.ts` and `src/presentation/render.ts` only animate and draw what the rules decided.
  - `src/content/levels.ts` holds the rooms and packs; `src/platform/` holds audio, storage and settings.
- **A breadth-first solver** (`src/core/solver.ts`) searches game states. Every move costs one, so the first solution it finds is a shortest one.
- **The rooms are tested, not trusted.** Every run of `npm test` re-solves all seventeen rooms in both packs and fails if any stated par isn't the true shortest solution. It replays each solution through the rules and checks that every room with crates actually needs them. Stable room ids are checked for uniqueness.
- **Where the rooms came from.** The core pack starts with a hand-built tutorial. The rest were found by a solver-driven search (`scripts/search.mjs`) that proposes random rooms and keeps only those whose shortest solution is long enough and uses the mechanic being introduced. Frostbite uses the same search and assumes the core mechanics. Every candidate was picked and ordered by hand.
- **The animation can never disagree with the rules.** Slides, kicks, cracks and sinks animate from the rules' events, with cracks timed to the moment the mover leaves the tile. When nothing is animating, the view snaps to the real state.

Design reasoning: [docs/DESIGN.md](docs/DESIGN.md). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Adding rooms: [docs/CONTENT.md](docs/CONTENT.md).

## Task pack

[`tasks/`](tasks/README.md) holds three game-development tasks built on this game:

- **Undo doesn't fix the ice**: a planted state-copy bug.
- **Next level starts with a move already made**: a planted input-queue bug.
- **Hints**: a feature that puts the solver in the player's hands.

Each has a brief, acceptance criteria, a reference solution with root-cause notes and an automated check. `npm run tasks` proves every check fails on the starting state and passes on the solution, with the whole unit suite green. It also checks that each bug's starting state plus its reference solution reproduces the repo exactly.

## Tests

```bash
npm run check    # typecheck source and tests
npm run build    # emit the browser build to dist/
npm test         # 29 tests: every room solved at par, rules, undo, queue, packs, save, settings
npm run tasks    # the task pack: every check fails before, passes after
npm run smoke    # real journeys in Chromium, Firefox and WebKit
npm run a11y     # axe scan of the level select and the dialogs
npm run verify   # everything above, plus module-graph and boundary checks
```

`scripts/smoke.mjs` plays the real page: level select, pack switching, a solved room, settings persistence, pause/resume, save/reload/continue and a mobile swipe. It runs in Chromium, Firefox and WebKit and fails on any console error, page error or failed request. `scripts/smoke.py` and `scripts/record_media.py` are optional Python tools for media recording; the CI path is Node-only.

## Development

- [`AGENTS.md`](AGENTS.md) — commands, invariants and the task-pack rules for an agent or contributor.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — modules, data flow, determinism and build/deploy.
- [`docs/CONTENT.md`](docs/CONTENT.md) — how to author, search and validate a room or pack.
- [`docs/RELEASING.md`](docs/RELEASING.md) — version, checks, tag, release and itch handoff.
- [`../STANDARD.md`](../STANDARD.md) — the shared contract across the three games.

## Project layout

```
src/core/         rules, solver, session, shared content types (no DOM)
src/content/      the rooms and packs (data only)
src/platform/     audio, storage, settings
src/presentation/ renderer, HUD, accessible dialogs
src/main.ts       composition root: input, animation, screens, save/continue
test/             node:test suites (rules, packs, session, storage, settings)
scripts/          build, serve, levels search, smoke, a11y, package, release
tasks/            the task pack and its verifier
```

## Limitations

- Seventeen rooms in two packs. The search tool can propose more, but each one is picked by hand.
- Smoke-tested in Chromium, Firefox and WebKit. WebKit-on-Linux is a compatibility check, not Safari-on-macOS proof.
- No key rebinding or colour-blind palette yet; reduced motion and volume are available.
- The save stores the current room, not the undo history.

## License

[MIT](LICENSE)
