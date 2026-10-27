# Acceptance criteria

## Input sequence (by hand)

1. Start any level and press H repeatedly, following each arrow, until the level ends.
2. Start level 7, make a move that isn't the arrow's direction, then press H.
3. On level 6 (Thin ice), break the ice so the hut can't be reached, then press H.

## Expected visual outcome

- Step 1: an orange arrow next to the player for each step; the level finishes in exactly its par; the results card shows two stars and "hint used".
- Step 2: the arrow points along a fastest way out from where the player now is. The move counter doesn't change when you ask.
- Step 3: no arrow; a line under the board says there's no way out and suggests undo or restart.
- The arrow disappears as soon as you move.

## Verifiable state (Node, `src/session.js`)

| # | Setup | Input | Expected |
|---|---|---|---|
| 1 | every level, from the start | loop: `requestHint()`, then `input(hint)` | screen `won`; `result.moves === par`; `result.stars <= 2` |
| 2 | Long way round, one non-optimal move | `requestHint()` | the hinted move is the first step of *a* shortest solution from here (after it, the solver's distance is one less); `game.moves` unchanged |
| 3 | Thin ice, a 3-move dead end | `requestHint()` | returns `null`; a `{ type: 'hint', dir: null }` event |

Automated: `node tasks/verify.mjs feat-01-hint`

## Must not change

- Stars for levels finished without hints, unlocking, and saved progress.
- All existing unit tests stay green.
