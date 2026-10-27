# Reference solution

**Root cause.** Before each move the session saves a snapshot for undo. The snapshot was changed from `cloneState()` to an inline spread, `{ ...game, player: {...}, crates: [...] }`. That copies the player and the crate list but not `tiles`, so the snapshot and the live game share one tile array. When a move breaks ice or fills water, the "saved" state changes with it. Undo restores the player and the crates correctly, which is why it looks like it works, but the tiles come back exactly as broken as they were. The undo regression test was removed in the same change.

**How to find it by playtesting.** Only moves that change tiles show it, which means cracked ice and sinking crates (levels 5, 6, 9 to 12). The first five levels can be undone all day without a visible problem.

**Fix** (`reference-solution.patch`): use `cloneState()` from `rules.js`, the one deep copy the solver already depends on, and restore the regression test.

**Why not copy `tiles` in the spread too.** It fixes today's state shape. The next field added to the game state would reintroduce the bug. One function that owns "copy a state" keeps undo and the solver honest together, and the solver's own tests exercise it constantly.
