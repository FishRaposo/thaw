# Reference solution

`reference-solution.patch` changes three files.

1. **Session** (`session.js`):
   - `requestHint()` runs the existing BFS solver on a copy of the current state and stores the first move of the shortest solution as `hint`, or sets `stuck` when there is none. It emits a `hint` event either way.
   - Any real move or undo clears `hint` and `stuck`.
   - `hinted` records that a hint was used on this attempt; `start()` resets it, so a restart earns full stars again.
   - `stars()` takes `hinted` and caps at 2.
2. **Screen** (`render.js`): an arrow beside the player while a hint is showing and nothing is animating; "hint used" in the HUD and on the results card; the no-way-out line under the board; "h hint" on the level-select footer.
3. **Input** (`main.js`): H, the on-screen button and gamepad X, all routed through the same command as everything else, plus a sound for each outcome.

**Why the solver runs live, not from a stored solution.** A stored solution only works from the start. The brief requires hints from wherever the player is, including after detours, which is exactly what BFS on the current state gives. It costs at most a few thousand states on these rooms.

**What the check deliberately allows.** Several moves can start a shortest path. The check accepts any hinted move that brings the room one step closer by the solver's count, so an implementation that explores directions in a different order still passes.
