# Acceptance criteria

## Input sequence (by hand)

1. Level 6 (Thin ice): slide across a cracked tile so it breaks, then press Z.
2. Level 5 (Bridge): kick a crate into the water, then press Z.
3. On any level, play several moves and undo all of them one at a time.

## Expected visual outcome

- Step 1: the player returns *and* the cracked tile is whole again.
- Step 2: the crate is back where it was *and* that water is open again.
- Step 3: each undo restores exactly the previous picture, all the way back to the start; the move counter counts back down to 0.

## Verifiable state (Node, `src/session.js`)

On Thin ice, Bridge and Crack and kick: play the solver's solution except the winning move through `Session.input` and `tick`, snapshotting `cloneState(game)` after each move. Then undo one move at a time.

| After each undo | Expected |
|---|---|
| `game.tiles` | identical to the snapshot from before that move |
| `game.player`, `game.crates`, `game.moves` | identical to that snapshot |

Automated: `node tasks/verify.mjs bug-01-undo-keeps-broken-ice`

## Must not change

- Undo still clears queued moves and can't go back past the level's start.
- The rules, the solver and the levels.
