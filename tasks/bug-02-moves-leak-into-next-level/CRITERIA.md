# Acceptance criteria

## Input sequence (by hand)

1. Level 1: right, down; during the down slide press up. Enter.
2. Any level: make a move, press another direction while it slides, then R.

## Expected visual outcome

- The next level and the restarted level both begin perfectly still, player on the start tile, "moves 0".
- Moves pressed during a slide in normal play still happen when the slide ends (that queue must keep working).

## Verifiable state (Node, `src/session.js`)

| Scenario | Input | Expected |
|---|---|---|
| Next level | level 1 solution; during the winning slide `input('left')`, `input('up')`; `tick` until won; `next()`; `tick(t + 1000)` | level 2: `game.moves === 0`, player on its `@` |
| Restart | level 3: one moving direction, a second queued behind it, `restart()`, `tick(5000)` | `game.moves === 0` |

Automated: `node tasks/verify.mjs bug-02-moves-leak-into-next-level`

## Must not change

- The input queue during play (up to 3 presses, played in order) and its unit tests.
