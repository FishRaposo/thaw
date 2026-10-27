// Breadth-first search over game states. Because every move costs 1, the first time BFS reaches a
// won state it has found a shortest solution. Used three ways: the tests prove every level is
// solvable at its stated par, the level editor workflow checks new designs, and par is never
// typed in by hand without the solver agreeing.

import { move, cloneState, stateKey, DIRS } from './rules.js';

const ORDER = Object.keys(DIRS);

// Returns { solution: [dirs], explored } or { solution: null, explored } if no solution exists
// within maxStates.
export function solve(start, { maxStates = 200000 } = {}) {
  if (start.won) return { solution: [], explored: 1 };
  const seen = new Map([[stateKey(start), null]]); // key -> [parentKey, dir]
  let frontier = [start];
  let explored = 1;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      const parentKey = stateKey(s);
      for (const dir of ORDER) {
        const t = cloneState(s);
        if (!move(t, dir).moved) continue;
        const k = stateKey(t);
        if (seen.has(k)) continue;
        seen.set(k, [parentKey, dir]);
        explored += 1;
        if (t.won) return { solution: unwind(seen, k), explored };
        if (explored >= maxStates) return { solution: null, explored };
        next.push(t);
      }
    }
    frontier = next;
  }
  return { solution: null, explored };
}

function unwind(seen, key) {
  const dirs = [];
  for (let k = key; seen.get(k); k = seen.get(k)[0]) dirs.push(seen.get(k)[1]);
  return dirs.reverse();
}
