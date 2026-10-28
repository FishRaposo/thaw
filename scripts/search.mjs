// Solver-driven level search: random rooms, kept only when the shortest solution is long enough and
// uses the requested mechanic (and, for crates, only when the crates are actually needed).
// Candidates are printed for a human to pick from; nothing here writes levels.js.
// Usage: node scripts/search.mjs <rock|crate|water|crack|crate-crack> <minPar> <maxPar> <count> <seed>
import { parseLevel, move, cloneState } from '../src/core/rules.ts';
import { solve } from '../src/core/solver.ts';
const [mech, minPar, maxPar, count, seed0] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +process.argv[6] || 1];
let seed = seed0;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function room() {
  const w = ri(8, 12), h = ri(6, 8);
  const g = [];
  for (let y = 0; y < h; y++) { g.push([]); for (let x = 0; x < w; x++) g[y].push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.'); }
  const free = () => { for (;;) { const x = ri(1, w - 2), y = ri(1, h - 2); if (g[y][x] === '.') return [x, y]; } };
  const nRock = Math.round((w - 2) * (h - 2) * (0.08 + rnd() * 0.1));
  for (let i = 0; i < nRock; i++) { const [x, y] = free(); g[y][x] = '#'; }
  const nSnow = mech.includes('snow') ? ri(1, 3) : (rnd() < 0.3 ? 1 : 0);
  for (let i = 0; i < nSnow; i++) { const [x, y] = free(); g[y][x] = ','; }
  if (mech.includes('crate')) { for (let i = 0, n = ri(1, 2); i < n; i++) { const [x, y] = free(); g[y][x] = 'B'; } }
  if (mech.includes('water')) {
    // a wall of water across the room with the exit beyond it
    const col = ri(Math.floor(w / 2), w - 3);
    for (let y = 1; y < h - 1; y++) if (g[y][col] !== '#' || rnd() < 0.7) g[y][col] = '~';
    const [x, y] = [ri(col + 1, w - 2), ri(1, h - 2)]; g[y][x] = 'E';
    for (let i = 0, n = ri(1, 2); i < n; i++) { const [cx, cy] = [ri(1, col - 1), ri(1, h - 2)]; g[cy][cx] = 'B'; }
    const [px, py] = [ri(1, col - 1), ri(1, h - 2)]; if (g[py][px] !== '.') return null; g[py][px] = '@';
  }
  if (mech.includes('crack')) { for (let i = 0, n = ri(3, 8); i < n; i++) { const [x, y] = free(); g[y][x] = '*'; } }
  if (!mech.includes('water')) { const [ex, ey] = free(); g[ey][ex] = 'E'; const [px, py] = free(); g[py][px] = '@'; }
  return g.map((r) => r.join(''));
}
function uses(rows, sol) {
  const s = parseLevel(rows); const kinds = new Set();
  for (const d of sol) for (const e of move(s, d).events) kinds.add(e.type);
  return kinds;
}
const found = [];
for (let tries = 0; tries < 60000 && found.length < count; tries++) {
  const rows = room(); if (!rows) continue;
  let lvl; try { lvl = parseLevel(rows); } catch { continue; }
  const r = solve(lvl, { maxStates: 40000 });
  if (!r.solution || r.solution.length < minPar || r.solution.length > maxPar) continue;
  const k = uses(rows, r.solution);
  if (mech.includes('crate') && !k.has('kick')) continue;
  if (mech.includes('water') && !k.has('sink')) continue;
  if (mech.includes('crack') && !k.has('crack')) continue;
  if (mech.includes('snow') && !r.solution.some(() => true)) continue;
  if (mech.includes('crate')) { const alt = solve(parseLevel(rows.map((r) => r.split('B').join('.'))), { maxStates: 40000 }).solution; if (alt && alt.length <= r.solution.length + 1) continue; }
  found.push({ rows, par: r.solution.length, sol: r.solution.map((d) => d[0].toUpperCase()).join(''), explored: r.explored });
}
for (const f of found.sort((a, b) => a.par - b.par)) console.log(`par ${f.par} ${f.sol} (${f.explored})\n${f.rows.join('\n')}\n`);
