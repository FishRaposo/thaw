# Thaw: design notes

## The constraint

You can't stop where you want. Every puzzle in an ice-sliding game is the same question: what will stop me, and where? So every element in Thaw is a different answer to it, and the rules stay small enough to hold in your head.

| Element | What it does to that question |
|---|---|
| Ice | nothing stops you |
| Snow | stops you on it |
| Rock | stops you before it |
| Crate | stops you before it; kick it and it becomes a brake you placed |
| Water | stops you before it; a crate that slides in sinks and becomes snow |
| Cracked ice | breaks behind whatever leaves it, so the hole becomes a new stop (and a lost path) |
| The hut | stops you on it, and stopping there wins |

## Decisions

**Each mechanic arrives alone.** Levels 1 to 6 introduce the elements one at a time (sliding and snow, rocks, crates, water, cracked ice), each with a one-line note on the board until the first move. Levels 7 to 12 combine them. The par curve rises from 2 to 14, but not monotonically: each new mechanic's first room is easy again.

**Crates are brakes, not just bridges.** The crate tutorial is solved by kicking the crate away and using it as a stop, not by pushing it somewhere obvious. A test enforces that every level with crates needs them: with the crates removed, each of those rooms is unsolvable or takes more moves.

**Cracked ice cuts both ways.** Breaking ice behind you closes a path, but the hole it leaves is also a new stopper. "Thin ice" can only be solved by breaking ice on purpose. Removing the cracks makes it unsolvable.

**Par comes from the solver, never from a person.** The BFS solver finds the true shortest solution; `levels.js` records it, and the tests fail if the two ever disagree. When a rule changes, the tests say which rooms it broke.

**Levels from a search, chosen by a person.** Writing twelve good rooms freehand is slow because you can't see the solution space. `scripts/search.mjs` generates random rooms with the chosen elements, solves each, and keeps only rooms whose shortest solution falls in a target range and actually uses the mechanic being taught. The candidates are printed for a human to judge: readability, whether the solution has a moment of insight, how it fits the curve. Level 1 was written by hand. The first candidate for the crate tutorial didn't need its crate at all; that's how the "crates must matter" filter and test came about.

**Never lose a press, never lose a move to the UI.** Moves pressed mid-slide queue (up to three) and play in order. A move that changes nothing doesn't count against par, and undo restores everything a move changed, including the ice.

**The screen only shows what the rules decided.** Animations are driven by the rules' events and, at rest, the view snaps to the real state. The solver, the tests, the session and the screen all run on the same `rules.js`.

## What would change with more time

- **More rooms**, with a difficulty measure beyond par: the number of states the solver explores is a decent proxy for how hard a room feels.
- **A level editor** in the browser that runs the solver live as you place tiles.
- **Reduced-motion and colour-blind modes.** Ice and water are distinguished by colour and pattern today, but the cracks rely on thin lines.

## Sixty seconds, out loud

Thaw is an ice-sliding puzzle game. You slide until something stops you, and every element answers "what stops me": snow, rocks, crates you kick into place, water a crate can fill, and cracked ice that breaks behind you. It ships with a breadth-first solver that proves every level: the tests re-solve all twelve rooms every run and fail if a par is wrong or if a level's crates aren't actually needed. The levels came from a solver-driven search that proposes candidates; they were picked and ordered by hand so each mechanic arrives alone first. The rules, the session and the screen are separate modules, so undo, input queueing and scoring are all tested without a browser.
