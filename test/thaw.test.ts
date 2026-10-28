import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, move, T, cloneState } from '../src/core/rules.ts';
import type { Cell, Dir, GameState } from '../src/core/rules.ts';
import { solve } from '../src/core/solver.ts';
import { CORE_PACK, LEVELS, PACKS } from '../src/content/levels.ts';
import { Session, stars, moveDuration } from '../src/core/session.ts';

const at = (s: GameState, x: number, y: number): number => s.tiles[y * s.w + x];

function solutionOf(rows: string[]): Dir[] {
  const r = solve(parseLevel(rows));
  assert.ok(r.solution);
  return r.solution;
}

function gameOf(ses: Session): GameState {
  assert.ok(ses.game);
  return ses.game;
}

// ------------------------------------------------------------------ the levels themselves

test('every level is solvable, and its stated par is the true shortest solution', () => {
  for (const pack of PACKS) {
    for (const [i, L] of pack.levels.entries()) {
      const r = solve(parseLevel(L.rows));
      assert.ok(r.solution, `${pack.id}/${L.id} (${i + 1}) has no solution`);
      assert.equal(r.solution.length, L.par, `${pack.id}/${L.id}: par ${L.par}, solver says ${r.solution.length}`);
    }
  }
});

test('replaying each solver solution through the rules actually wins', () => {
  for (const pack of PACKS) {
    for (const L of pack.levels) {
      const s = parseLevel(L.rows);
      for (const d of solutionOf(L.rows)) assert.ok(move(s, d).moved);
      assert.ok(s.won, `${pack.id}/${L.id}`);
    }
  }
});

test('every level that has crates needs them', () => {
  for (const pack of PACKS) {
    for (const L of pack.levels.filter((l) => l.rows.join('').includes('B'))) {
      const without = solve(parseLevel(L.rows.map((r) => r.replaceAll('B', '.'))));
      assert.ok(!without.solution || without.solution.length > L.par, `${pack.id}/${L.id} is solvable as fast without its crates`);
    }
  }
});

test('level ids and pack ids are unique', () => {
  const packs = new Set<string>();
  const ids = new Set<string>();
  for (const pack of PACKS) {
    assert.ok(!packs.has(pack.id), `duplicate pack id ${pack.id}`);
    packs.add(pack.id);
    for (const level of pack.levels) {
      assert.ok(!ids.has(level.id), `duplicate level id ${level.id}`);
      ids.add(level.id);
    }
  }
});

test('levels get no easier than the tutorial ones once tutorials end', () => {
  const pars = LEVELS.map((l) => l.par);
  assert.ok(Math.max(...pars.slice(-3)) >= 10 && pars[0] <= 2);
});

// ------------------------------------------------------------------ rules

test('you slide until something stops you', () => {
  const s = parseLevel(['#######', '#@....#', '#######']);
  move(s, 'right');
  assert.deepEqual(s.player, { x: 5, y: 1 });
});

test('snow and the exit stop you; stopping on the exit wins', () => {
  const s = parseLevel(['#########', '#@.,..E.#', '#########']);
  move(s, 'right');
  assert.deepEqual(s.player, { x: 3, y: 1 });
  move(s, 'right');
  assert.deepEqual(s.player, { x: 6, y: 1 });
  assert.ok(s.won);
});

test('a move that changes nothing is not a move', () => {
  const s = parseLevel(['####', '#@.#', '####']);
  assert.equal(move(s, 'left').moved, false);
  assert.equal(s.moves, 0);
});

test('kicking a crate slides it; you stay put', () => {
  const s = parseLevel(['########', '#@B....#', '########']);
  const r = move(s, 'right');
  assert.ok(r.moved);
  assert.deepEqual(s.player, { x: 1, y: 1 });
  assert.deepEqual(s.crates, [1 * 8 + 6]);
});

test('a crate against a wall cannot be kicked, and that costs nothing', () => {
  const s = parseLevel(['#####', '#@B##', '#####']);
  assert.equal(move(s, 'right').moved, false);
  assert.equal(s.moves, 0);
});

test('a crate sinks into water and freezes it into snow', () => {
  const s = parseLevel(['#######', '#@B.~.#', '#######']);
  move(s, 'right');
  assert.equal(s.crates.length, 0);
  assert.equal(at(s, 4, 1), T.SNOW);
});

test('crates cannot enter the exit', () => {
  const s = parseLevel(['#######', '#@B..E#', '#######']);
  move(s, 'right');
  assert.deepEqual(s.crates, [1 * 7 + 4]);
});

test('cracked ice breaks into water once you leave it', () => {
  const s = parseLevel(['#######', '#@*...#', '#######']);
  move(s, 'right');
  assert.equal(at(s, 2, 1), T.WATER);
  move(s, 'left');
  assert.deepEqual(s.player, { x: 3, y: 1 }, 'the hole now stops you short');
});

test('cloned states share nothing', () => {
  const a = parseLevel(['#######', '#@*.B.#', '#######']);
  const b = cloneState(a);
  move(b, 'right');
  assert.equal(at(a, 2, 1), T.CRACKED);
  assert.deepEqual(a.player, { x: 1, y: 1 });
});

// ------------------------------------------------------------------ session

test('stars: par or better is 3, within half again is 2, otherwise 1', () => {
  assert.equal(stars(5, 5), 3);
  assert.equal(stars(8, 5), 2);
  assert.equal(stars(9, 5), 1);
});

test('progress is keyed by level id, so inserting a room does not shift it', () => {
  const ses = new Session({ pack: CORE_PACK, progress: { [CORE_PACK.levels[0].id]: 3 } });
  assert.ok(ses.unlocked(1));
  assert.ok(!ses.unlocked(2));
});

test('resume restores a position and starts a fresh undo baseline', () => {
  const ses = new Session({ pack: CORE_PACK });
  ses.start(1);
  ses.input('up', 0);
  const game = cloneState(gameOf(ses));
  assert.equal(game.moves, 1);
  const saved = new Session({ pack: CORE_PACK });
  saved.resume(1, game);
  assert.equal(saved.screen, 'play');
  assert.equal(gameOf(saved).moves, 1);
  assert.equal(saved.undo(0), false);
});

test('a move pressed mid-slide plays when the slide ends', () => {
  const ses = new Session({ pack: CORE_PACK });
  ses.start(1);
  ses.input('up', 0);
  const busy = ses.busyUntil;
  ses.input('left', 10);
  assert.deepEqual(ses.queue, ['left']);
  ses.tick(busy - 1);
  assert.equal(gameOf(ses).moves, 1);
  ses.tick(busy);
  assert.equal(gameOf(ses).moves, 2);
});

test('undo restores the previous state exactly, cracked ice included', () => {
  const ses = new Session({ pack: CORE_PACK });
  const i = LEVELS.findIndex((l) => l.name === 'Thin ice');
  ses.start(i);
  const start = cloneState(gameOf(ses));
  let t = 0;
  for (const d of solutionOf(LEVELS[i].rows).slice(0, -1)) {
    ses.input(d, t);
    t = ses.busyUntil;
  }
  assert.notDeepEqual([...gameOf(ses).tiles], [...start.tiles], 'some ice broke');
  while (ses.undo(t));
  assert.deepEqual([...gameOf(ses).tiles], [...start.tiles]);
  assert.deepEqual(gameOf(ses).player, start.player);
  assert.equal(gameOf(ses).moves, 0);
});

test('winning waits for the slide to finish, then scores and unlocks the next level', () => {
  const ses = new Session({ pack: CORE_PACK });
  ses.start(0);
  let t = 0;
  for (const d of solutionOf(LEVELS[0].rows)) {
    ses.input(d, t);
    t = ses.busyUntil;
  }
  assert.equal(ses.screen, 'play');
  ses.tick(t);
  assert.equal(ses.screen, 'won');
  assert.ok(ses.result);
  assert.equal(ses.result.stars, 3);
  assert.ok(ses.unlocked(1));
  assert.ok(!ses.unlocked(2));
});

test('the input queue holds three presses and drops the rest', () => {
  const ses = new Session({ pack: CORE_PACK });
  ses.start(2);
  ses.input('left', 0);
  const dirs: Dir[] = ['up', 'right', 'down', 'left', 'up'];
  for (const d of dirs) ses.input(d, 1);
  assert.deepEqual(ses.queue, ['up', 'right', 'down']);
});

test('animation length follows the distance slid', () => {
  const short: Cell[] = [[0, 0], [1, 0]];
  const long: Cell[] = Array.from({ length: 9 }, (_, i) => [i, 0]);
  assert.equal(moveDuration([{ type: 'slide', dir: 'right', path: short }]), 110);
  assert.equal(moveDuration([{ type: 'slide', dir: 'right', path: long }]), 440);
});
