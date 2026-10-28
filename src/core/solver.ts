// Breadth-first search over game states. Because every move costs 1, the first time BFS reaches a
// won state it has found a shortest solution. Used three ways: the tests prove every level is
// solvable at its stated par, the level editor workflow checks new designs, and par is never
// typed in by hand without the solver agreeing.

import { move, cloneState, stateKey, DIRS } from './rules.ts';
import type { Dir, GameState } from './rules.ts';

const ORDER = Object.keys(DIRS) as Dir[];
type Parent = [string, Dir] | null;

export interface SolveResult {
  solution: Dir[] | null;
  explored: number;
}

// Returns { solution: [dirs], explored } or { solution: null, explored } if no solution exists
// within maxStates.
export function solve(start: GameState, { maxStates = 200000 }: { maxStates?: number } = {}): SolveResult {
  if (start.won) return { solution: [], explored: 1 };
  const seen = new Map<string, Parent>([[stateKey(start), null]]); // key -> [parentKey, dir]
  let frontier: GameState[] = [start];
  let explored = 1;
  while (frontier.length) {
    const next: GameState[] = [];
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

function unwind(seen: Map<string, Parent>, key: string): Dir[] {
  const dirs: Dir[] = [];
  let k = key;
  for (;;) {
    const entry = seen.get(k);
    if (!entry) break;
    dirs.push(entry[1]);
    k = entry[0];
  }
  return dirs.reverse();
}
