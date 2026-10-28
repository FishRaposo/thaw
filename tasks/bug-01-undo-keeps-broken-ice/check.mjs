// Criteria: undo puts the room back exactly as it was before the move: player, crates, move
// count, and the ice itself (cracked tiles your move broke are whole again; a crate that sank
// comes back and its hole is open water again).
export default async function check(src) {
  const { Session } = await import(src + 'core/session.js');
  const { CORE_PACK, LEVELS } = await import(src + 'content/levels.js');
  const { parseLevel, cloneState } = await import(src + 'core/rules.js');
  const { solve } = await import(src + 'core/solver.js');
  const problems = [];
  for (const name of ['Thin ice', 'Bridge', 'Crack and kick']) {
    const i = LEVELS.findIndex((l) => l.name === name);
    const ses = new Session({ pack: CORE_PACK, progress: {} });
    ses.start(i);
    const snaps = [cloneState(ses.game)];
    let t = 0;
    for (const d of solve(parseLevel(LEVELS[i].rows)).solution.slice(0, -1)) {
      ses.input(d, t);
      t = ses.busyUntil;
      ses.tick(t);
      snaps.push(cloneState(ses.game));
    }
    for (let k = snaps.length - 2; k >= 0; k--) {
      ses.undo(t);
      const g = ses.game;
      const want = snaps[k];
      const same = g.moves === want.moves && g.player.x === want.player.x && g.player.y === want.player.y &&
        g.crates.slice().sort().join() === want.crates.slice().sort().join() && g.tiles.join() === want.tiles.join();
      if (!same) {
        problems.push(`${name}: after undoing back to move ${k}, ${g.tiles.join() === want.tiles.join() ? 'player/crates differ' : 'the ice differs (broken ice or a filled hole stayed)'}`);
        break;
      }
    }
  }
  return { pass: problems.length === 0, details: problems.length ? problems.join('; ') : 'undo restores every state exactly on Thin ice, Bridge and Crack and kick' };
}
