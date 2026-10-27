// Everything between the rules and the screen: which level you're on, undo, restart, stars,
// progress, and pacing input against the slide animation. Pure: time is passed in, nothing reads
// a clock or the DOM, so the tests can drive a whole play session deterministically.

import { parseLevel, move, cloneState } from './rules.js';
import { LEVELS } from './levels.js';

export const QUEUE_MAX = 3;

export const TIMING = {
  perTile: 55, // ms of animation per tile slid
  min: 110, // shortest animation for any move
};

export function stars(moves, par) {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.5)) return 2;
  return 1;
}

// How long a move's animation runs, from its events: the longest path anything travelled.
export function moveDuration(events) {
  let tiles = 0;
  for (const e of events) if (e.path) tiles = Math.max(tiles, e.path.length - 1);
  return Math.max(TIMING.min, tiles * TIMING.perTile);
}

export class Session {
  constructor({ levels = LEVELS, progress = {} } = {}) {
    this.levels = levels;
    this.progress = progress; // level index -> best stars
    this.screen = 'select'; // 'select' | 'play' | 'won' | 'done'
    this.level = 0;
    this.game = null;
    this.history = [];
    this.busyUntil = 0;
    this.queue = []; // moves pressed during an animation, played in order as each one ends
    this.events = [];
    this.result = null;
  }

  unlocked(i) {
    return i === 0 || (this.progress[i - 1] ?? 0) > 0;
  }

  start(i) {
    this.level = i;
    this.game = parseLevel(this.levels[i].rows);
    this.history = [];
    this.busyUntil = 0;
    this.queue = [];
    this.result = null;
    this.screen = 'play';
    this.events.push({ type: 'start', level: i });
  }

  // A direction from the player. During an animation it waits in a short queue, so quick players
  // never lose a press; beyond QUEUE_MAX the extra presses are dropped rather than piling up.
  input(dir, now) {
    if (this.screen !== 'play') return;
    if (now < this.busyUntil || this.queue.length) {
      if (this.queue.length < QUEUE_MAX) this.queue.push(dir);
      return;
    }
    this.apply(dir, now);
  }

  apply(dir, now) {
    if (this.game.won) return false;
    const before = cloneState(this.game);
    const r = move(this.game, dir);
    this.events.push(...r.events);
    if (!r.moved) return false;
    this.history.push(before);
    this.busyUntil = now + moveDuration(r.events);
    return true;
  }

  // Call every frame. Ends a level once its winning slide has finished animating, and plays a
  // queued move once the previous one has.
  tick(now) {
    if (this.screen !== 'play' || now < this.busyUntil) return;
    if (this.game.won) {
      this.finish();
      return;
    }
    // Play queued moves until one actually moves (a queued bump shouldn't swallow the next press).
    while (this.queue.length && !this.apply(this.queue.shift(), now));
  }

  finish() {
    const par = this.levels[this.level].par;
    const earned = stars(this.game.moves, par);
    const best = Math.max(this.progress[this.level] ?? 0, earned);
    this.progress[this.level] = best;
    this.result = { moves: this.game.moves, par, stars: earned, best };
    this.screen = 'won';
    this.events.push({ type: 'complete', level: this.level, ...this.result });
  }

  undo(now) {
    if (this.screen !== 'play' || !this.history.length) return false;
    this.game = this.history.pop();
    this.queue = [];
    this.busyUntil = now;
    this.events.push({ type: 'undo' });
    return true;
  }

  restart() {
    if (this.screen !== 'play' && this.screen !== 'won') return;
    this.start(this.level);
    this.events.push({ type: 'restart' });
  }

  next() {
    if (this.level + 1 < this.levels.length) this.start(this.level + 1);
    else {
      this.screen = 'done';
      this.events.push({ type: 'done' });
    }
  }

  menu() {
    this.screen = 'select';
    this.queue = [];
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
