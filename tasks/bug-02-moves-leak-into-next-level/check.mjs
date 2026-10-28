// Criteria: presses made during the winning slide are not carried into the next level (or a
// restart). Every level starts with the player on @, zero moves, nothing queued.
export default async function check(src) {
  const { Session } = await import(src + 'core/session.js');
  const { CORE_PACK, LEVELS } = await import(src + 'content/levels.js');
  const { parseLevel, move, cloneState } = await import(src + 'core/rules.js');
  const { solve } = await import(src + 'core/solver.js');
  const problems = [];

  const ses = new Session({ pack: CORE_PACK, progress: {} });
  ses.start(0);
  let t = 0;
  const sol = solve(parseLevel(LEVELS[0].rows)).solution;
  for (const d of sol.slice(0, -1)) {
    ses.input(d, t);
    t = ses.busyUntil;
    ses.tick(t);
  }
  ses.input(sol[sol.length - 1], t); // the winning move
  // While it slides, the player keeps pressing, as people do.
  ses.input('left', t + 20);
  ses.input('up', t + 30);
  t = ses.busyUntil;
  ses.tick(t);
  if (ses.screen !== 'won') return { pass: false, details: `level 1 not won (screen ${ses.screen})` };
  ses.next();
  ses.tick(t + 1000);
  const start = parseLevel(LEVELS[1].rows).player;
  if (ses.game.moves !== 0 || ses.game.player.x !== start.x || ses.game.player.y !== start.y) {
    problems.push(`level 2 began with ${ses.game.moves} move(s) already made`);
  }

  // Same through restart: queue presses mid-slide, then restart.
  const r = new Session({ pack: CORE_PACK, progress: {} });
  r.start(2);
  const moving = ['up', 'right', 'down', 'left'].filter((d) => move(cloneState(r.game), d).moved);
  r.input(moving[0], 0);
  r.input(moving[1] ?? moving[0], 1); // queued behind the first slide
  r.restart();
  r.tick(5000);
  if (r.game.moves !== 0) problems.push(`restart began with ${r.game.moves} move(s) already made`);

  return { pass: problems.length === 0, details: problems.length ? problems.join('; ') : 'next level and restart both start clean' };
}
