// Everything between the rules and the screen: which room you're on, undo, restart, stars,
// progress, and pacing input against the slide animation. Pure: time is passed in, nothing reads
// a clock or the DOM, so the tests can drive a whole play session deterministically.

import { parseLevel, move, cloneState } from './rules.ts';
import type { Dir, GameEvent, GameState } from './rules.ts';
import type { LevelDef, LevelPack, PackProgress } from './types.ts';

export const QUEUE_MAX = 3;

export const TIMING = {
  perTile: 55, // ms of animation per tile slid
  min: 110, // shortest animation for any move
};

export type SessionScreen = 'select' | 'play' | 'won' | 'done';

export interface SessionResult {
  moves: number;
  par: number;
  stars: number;
  best: number;
  levelId: string;
  packId: string;
  hinted?: boolean;
}

export type SessionEvent =
  | GameEvent
  | { type: 'start'; level: number; resumed?: boolean }
  | { type: 'restart' }
  | { type: 'undo' }
  | {
      type: 'complete';
      level: number;
      moves: number;
      par: number;
      stars: number;
      best: number;
      levelId: string;
      packId: string;
      hinted?: boolean;
    }
  | { type: 'done' }
  | { type: 'hint'; dir: Dir | null; remaining: number | null };

export interface SessionOptions {
  pack: LevelPack;
  progress?: PackProgress;
}

export function stars(moves: number, par: number): number {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.5)) return 2;
  return 1;
}

// How long a move's animation runs, from its events: the longest path anything travelled.
export function moveDuration(events: SessionEvent[]): number {
  let tiles = 0;
  for (const e of events) if ('path' in e && e.path) tiles = Math.max(tiles, e.path.length - 1);
  return Math.max(TIMING.min, tiles * TIMING.perTile);
}

export class Session {
  pack: LevelPack;
  progress: PackProgress;
  screen: SessionScreen;
  level: number;
  game: GameState | null;
  history: GameState[];
  busyUntil: number;
  queue: Dir[];
  events: SessionEvent[];
  result: SessionResult | null;

  constructor({ pack, progress = {} }: SessionOptions) {
    this.pack = pack;
    this.progress = progress; // level id -> best stars, for this pack
    this.screen = 'select'; // 'select' | 'play' | 'won' | 'done'
    this.level = 0;
    this.game = null;
    this.history = [];
    this.busyUntil = 0;
    this.queue = []; // moves pressed during an animation, played in order as each one ends
    this.events = [];
    this.result = null;
  }

  get levels(): LevelDef[] {
    return this.pack.levels;
  }

  unlocked(i: number): boolean {
    return i === 0 || (this.progress[this.pack.levels[i - 1].id] ?? 0) > 0;
  }

  start(i: number): void {
    this.level = i;
    this.game = parseLevel(this.pack.levels[i].rows);
    this.history = [];
    this.busyUntil = 0;
    this.queue = [];
    this.result = null;
    this.screen = 'play';
    this.events.push({ type: 'start', level: i });
  }

  // Restore a saved position. Undo history is not persisted, so the first move after a resume is
  // the new baseline.
  resume(i: number, game: GameState): void {
    this.level = i;
    this.game = game;
    this.history = [];
    this.busyUntil = 0;
    this.queue = [];
    this.result = null;
    this.screen = 'play';
    this.events.push({ type: 'start', level: i, resumed: true });
  }

  // A direction from the player. During an animation it waits in a short queue, so quick players
  // never lose a press; beyond QUEUE_MAX the extra presses are dropped rather than piling up.
  input(dir: Dir, now: number): void {
    if (this.screen !== 'play') return;
    if (now < this.busyUntil || this.queue.length) {
      if (this.queue.length < QUEUE_MAX) this.queue.push(dir);
      return;
    }
    this.apply(dir, now);
  }

  apply(dir: Dir, now: number): boolean {
    const game = this.game;
    if (!game || game.won) return false;
    const before = cloneState(game);
    const r = move(game, dir);
    this.events.push(...r.events);
    if (!r.moved) return false;
    this.history.push(before);
    this.busyUntil = now + moveDuration(r.events);
    return true;
  }

  // Call every frame. Ends a level once its winning slide has finished animating, and plays a
  // queued move once the previous one has.
  tick(now: number): void {
    if (this.screen !== 'play' || now < this.busyUntil) return;
    const game = this.game;
    if (!game) return;
    if (game.won) {
      this.finish();
      return;
    }
    // Play queued moves until one actually moves (a queued bump shouldn't swallow the next press).
    while (this.queue.length && !this.apply(this.queue.shift()!, now));
  }

  finish(): void {
    const game = this.game;
    if (!game) return;
    const level = this.pack.levels[this.level];
    const earned = stars(game.moves, level.par);
    const best = Math.max(this.progress[level.id] ?? 0, earned);
    this.progress[level.id] = best;
    this.result = {
      moves: game.moves,
      par: level.par,
      stars: earned,
      best,
      levelId: level.id,
      packId: this.pack.id,
    };
    this.screen = 'won';
    this.events.push({ type: 'complete', level: this.level, ...this.result });
  }

  undo(now: number): boolean {
    if (this.screen !== 'play' || !this.history.length) return false;
    this.game = this.history.pop()!;
    this.queue = [];
    this.busyUntil = now;
    this.events.push({ type: 'undo' });
    return true;
  }

  restart(): void {
    if (this.screen !== 'play' && this.screen !== 'won') return;
    this.start(this.level);
    this.events.push({ type: 'restart' });
  }

  next(): void {
    if (this.level + 1 < this.pack.levels.length) this.start(this.level + 1);
    else {
      this.screen = 'done';
      this.events.push({ type: 'done' });
    }
  }

  menu(): void {
    this.screen = 'select';
    this.queue = [];
  }

  takeEvents(): SessionEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
