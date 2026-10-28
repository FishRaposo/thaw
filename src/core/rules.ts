// The rules of Thaw, as pure functions over a small state object. No DOM, no timers.
// The session, the solver, the tests and the task checks all use exactly these rules.
//
// Tiles
//   #  rock      blocks everything
//   .  ice       you slide across it
//   ,  snow      you stop on it
//   ~  water     you can't enter it; a crate that slides into it sinks and fills it with snow
//   *  cracked   ice that breaks into water as soon as whatever was on it leaves
//   E  exit      you stop on it, and stopping on it wins; crates can't enter it
// Things
//   @  you (on ice)          B  a crate (on ice)
//
// Moving: pick a direction and you slide until the next tile would stop you (rock, water, a crate,
// the edge) or you land on snow or the exit. If the tile next to you in that direction holds a
// crate, you don't move: you kick the crate, and it slides by the same rules.

export const T = { ROCK: 0, ICE: 1, SNOW: 2, WATER: 3, CRACKED: 4, EXIT: 5 } as const;
export type Tile = (typeof T)[keyof typeof T];
export type Dir = 'up' | 'right' | 'down' | 'left';
export type Cell = [number, number];

export interface GameState {
  w: number;
  h: number;
  tiles: Uint8Array;
  player: { x: number; y: number };
  crates: number[];
  moves: number;
  won: boolean;
}

export type GameEvent =
  | { type: 'slide'; dir: Dir; path: Cell[] }
  | { type: 'kick'; dir: Dir }
  | { type: 'crate'; path: Cell[] }
  | { type: 'sink'; x: number; y: number; path: Cell[] }
  | { type: 'crack'; x: number; y: number }
  | { type: 'bump'; x: number; y: number }
  | { type: 'win' };

const CHAR: Record<string, Tile> = { '#': T.ROCK, '.': T.ICE, ',': T.SNOW, '~': T.WATER, '*': T.CRACKED, E: T.EXIT, '@': T.ICE, B: T.ICE };

export const DIRS: Record<Dir, Cell> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };

export function parseLevel(rows: string[]): GameState {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const tiles = new Uint8Array(w * h);
  const crates: number[] = [];
  let player: { x: number; y: number } | null = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x] ?? '#';
      if (!(c in CHAR)) throw new Error(`unknown tile '${c}' at ${x},${y}`);
      tiles[y * w + x] = CHAR[c];
      if (c === '@') player = { x, y };
      if (c === 'B') crates.push(y * w + x);
    }
  }
  if (!player) throw new Error('level has no @');
  return { w, h, tiles, player, crates, moves: 0, won: false };
}

export function cloneState(s: GameState): GameState {
  return { w: s.w, h: s.h, tiles: s.tiles.slice(), player: { ...s.player }, crates: s.crates.slice(), moves: s.moves, won: s.won };
}

const inside = (s: GameState, x: number, y: number): boolean => x >= 0 && y >= 0 && x < s.w && y < s.h;
const tileAt = (s: GameState, x: number, y: number): Tile => (inside(s, x, y) ? (s.tiles[y * s.w + x] as Tile) : T.ROCK);
const crateAt = (s: GameState, x: number, y: number): boolean => inside(s, x, y) && s.crates.includes(y * s.w + x);

// Something left (x, y): cracked ice breaks.
function leave(s: GameState, x: number, y: number, events: GameEvent[]): void {
  const i = y * s.w + x;
  if (s.tiles[i] === T.CRACKED) {
    s.tiles[i] = T.WATER;
    events.push({ type: 'crack', x, y });
  }
}

// Slide the crate at (cx, cy). Returns its path (start included), or null if it can't move at all.
function slideCrate(s: GameState, cx: number, cy: number, dx: number, dy: number, events: GameEvent[]): Cell[] | null {
  const blocked = (x: number, y: number): boolean => {
    const t = tileAt(s, x, y);
    return t === T.ROCK || t === T.EXIT || crateAt(s, x, y) || (x === s.player.x && y === s.player.y);
  };
  if (blocked(cx + dx, cy + dy)) return null;
  const path: Cell[] = [[cx, cy]];
  let x = cx;
  let y = cy;
  s.crates.splice(s.crates.indexOf(cy * s.w + cx), 1);
  for (;;) {
    const nx = x + dx;
    const ny = y + dy;
    if (blocked(nx, ny)) break;
    leave(s, x, y, events);
    x = nx;
    y = ny;
    path.push([x, y]);
    const t = tileAt(s, x, y);
    if (t === T.WATER) {
      s.tiles[y * s.w + x] = T.SNOW; // the crate sinks and freezes into a snow tile you can stand on
      events.push({ type: 'sink', x, y, path });
      return path;
    }
    if (t === T.SNOW) break;
  }
  s.crates.push(y * s.w + x);
  events.push({ type: 'crate', path });
  return path;
}

// One move. Returns { moved, events }. Mutates s. A move that changes nothing doesn't count.
export function move(s: GameState, dir: Dir): { moved: boolean; events: GameEvent[] } {
  const events: GameEvent[] = [];
  if (s.won) return { moved: false, events };
  const [dx, dy] = DIRS[dir];
  const { x: px, y: py } = s.player;

  if (crateAt(s, px + dx, py + dy)) {
    const path = slideCrate(s, px + dx, py + dy, dx, dy, events);
    if (!path) {
      events.push({ type: 'bump', x: px + dx, y: py + dy });
      return { moved: false, events };
    }
    s.moves += 1;
    events.unshift({ type: 'kick', dir });
    return { moved: true, events };
  }

  const stops = (x: number, y: number): boolean => {
    const t = tileAt(s, x, y);
    return t === T.ROCK || t === T.WATER || crateAt(s, x, y);
  };
  if (stops(px + dx, py + dy)) {
    events.push({ type: 'bump', x: px + dx, y: py + dy });
    return { moved: false, events };
  }

  const path: Cell[] = [[px, py]];
  let x = px;
  let y = py;
  for (;;) {
    leave(s, x, y, events);
    x += dx;
    y += dy;
    path.push([x, y]);
    const t = tileAt(s, x, y);
    if (t === T.SNOW || t === T.EXIT) break;
    if (stops(x + dx, y + dy)) break;
  }
  s.player = { x, y };
  s.moves += 1;
  events.unshift({ type: 'slide', dir, path });
  if (tileAt(s, x, y) === T.EXIT) {
    s.won = true;
    events.push({ type: 'win' });
  }
  return { moved: true, events };
}

// A compact, canonical key for a state: what the solver dedupes on.
export function stateKey(s: GameState): string {
  const crates = s.crates.slice().sort((a, b) => a - b).join(',');
  return `${s.player.y * s.w + s.player.x}|${crates}|${String.fromCharCode(...s.tiles)}`;
}
