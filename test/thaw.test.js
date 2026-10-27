import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, move, T, cloneState } from '../src/rules.js';
import { solve } from '../src/solver.js';
import { LEVELS } from '../src/levels.js';
import { Session, stars, moveDuration } from '../src/session.js';

const at = (s, x, y) => s.tiles[y * s.w + x];

// ------------------------------------------------------------------ the levels themselves

test('every level is solvable, and its stated par is the true shortest solution', () => {
  for (const [i, L] of LEVELS.entries()) {
    const r = solve(parseLevel(L.rows));
    assert.ok(r.solution, `level ${i + 1} (${L.name}) has no solution`);
    assert.equal(r.solution.length, L.par, `level ${i + 1} (${L.name}): par ${L.par}, solver says ${r.solution.length}`);
  }
});

test('replaying each solver solution through the rules actually wins', () => {
  for (const L of LEVELS) {
    const s = parseLevel(L.rows);
    for (const d of solve(parseLevel(L.rows)).solution) assert.ok(move(s, d).moved);
    assert.ok(s.won, L.name);
  }
});

test('every level that has crates needs them', () => {
  for (const L of LEVELS.filter((l) => l.rows.join('').includes('B'))) {
    const without = solve(parseLevel(L.rows.map((r) => r.replaceAll('B', '.'))));
    assert.ok(!without.solution || without.solution.length > L.par, `${L.name} is solvable as fast without its crates`);
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

test('a move pressed mid-slide plays when the slide ends', () => {
  const ses = new Session();
  ses.start(1);
  ses.input('up', 0);
  const busy = ses.busyUntil;
  ses.input('left', 10);
  assert.deepEqual(ses.queue, ['left']);
  ses.tick(busy - 1);
  assert.equal(ses.game.moves, 1);
  ses.tick(busy);
  assert.equal(ses.game.moves, 2);
});

test('undo restores the previous state exactly, cracked ice included', () => {
  const ses = new Session();
  const i = LEVELS.findIndex((l) => l.name === 'Thin ice');
  ses.start(i);
  const start = cloneState(ses.game);
  let t = 0;
  for (const d of solve(parseLevel(LEVELS[i].rows)).solution.slice(0, -1)) {
    ses.input(d, t);
    t = ses.busyUntil;
  }
  assert.notDeepEqual([...ses.game.tiles], [...start.tiles], 'some ice broke');
  while (ses.undo(t));
  assert.deepEqual([...ses.game.tiles], [...start.tiles]);
  assert.deepEqual(ses.game.player, start.player);
  assert.equal(ses.game.moves, 0);
});

test('winning waits for the slide to finish, then scores and unlocks the next level', () => {
  const ses = new Session();
  ses.start(0);
  let t = 0;
  for (const d of solve(parseLevel(LEVELS[0].rows)).solution) {
    ses.input(d, t);
    t = ses.busyUntil;
  }
  assert.equal(ses.screen, 'play');
  ses.tick(t);
  assert.equal(ses.screen, 'won');
  assert.equal(ses.result.stars, 3);
  assert.ok(ses.unlocked(1));
  assert.ok(!ses.unlocked(2));
});

test('the input queue holds three presses and drops the rest', () => {
  const ses = new Session();
  ses.start(2);
  ses.input('left', 0);
  for (const d of ['up', 'right', 'down', 'left', 'up']) ses.input(d, 1);
  assert.deepEqual(ses.queue, ['up', 'right', 'down']);
});

test('animation length follows the distance slid', () => {
  assert.equal(moveDuration([{ type: 'slide', path: [[0, 0], [1, 0]] }]), 110);
  assert.equal(moveDuration([{ type: 'slide', path: Array.from({ length: 9 }, (_, i) => [i, 0]) }]), 440);
});
