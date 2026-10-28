// Criteria for the hint. Driven through the Session, the same object the game screen uses.
export default async function check(src) {
  const { Session } = await import(src + 'core/session.js');
  const { CORE_PACK, LEVELS } = await import(src + 'content/levels.js');
  const { parseLevel, move, cloneState } = await import(src + 'core/rules.js');
  const { solve } = await import(src + 'core/solver.js');
  const fail = [];
  const ask = (ses) => (typeof ses.requestHint === 'function' ? ses.requestHint() : undefined);

  // 1. Following hints from the start solves every level in exactly par moves.
  for (const [i, L] of LEVELS.entries()) {
    const ses = new Session({ pack: CORE_PACK, progress: {} });
    ses.start(i);
    let t = 0;
    for (let k = 0; k < 40 && ses.screen === 'play'; k++) {
      const d = ask(ses);
      if (!d) break;
      ses.input(d, t);
      t = ses.busyUntil;
      ses.tick(t);
    }
    if (ses.screen !== 'won') { fail.push(`following hints doesn't finish level ${i + 1}`); break; }
    if (ses.result.moves !== L.par) fail.push(`level ${i + 1}: hints took ${ses.result.moves} moves (par ${L.par})`);
    // 2. A hinted run earns at most 2 stars, even at par.
    if (ses.result.stars > 2) { fail.push(`level ${i + 1}: 3 stars despite hints`); break; }
  }

  // 3. A hint picks up from where you are, not from the start: make one wrong move first.
  const ses = new Session({ pack: CORE_PACK, progress: {} });
  const k = LEVELS.findIndex((l) => l.name === 'Long way round');
  ses.start(k);
  const first = solve(parseLevel(LEVELS[k].rows)).solution[0];
  const other = ['up', 'right', 'down', 'left'].find((d) => d !== first && move(cloneState(ses.game), d).moved);
  ses.input(other, 0);
  ses.tick(10000);
  const fromHere = solve(cloneState(ses.game)).solution;
  const h = ask(ses);
  // Any move on *a* shortest path counts: after it, the room must be exactly one move closer.
  const after = cloneState(ses.game);
  const ok = h && move(after, h).moved && (after.won ? fromHere.length === 1 : solve(after).solution?.length === fromHere.length - 1);
  if (!ok) fail.push(`after a detour the hint (${h}) isn't the first step of a shortest way out from here`);
  if (ses.game.moves !== 1) fail.push('asking for a hint changed the move count');

  // 4. From a dead end, the hint says there's no way out rather than suggesting a move.
  const thin = LEVELS.findIndex((l) => l.name === 'Thin ice');
  const dead = new Session({ pack: CORE_PACK, progress: {} });
  dead.start(thin);
  let found = false;
  const tryPath = (path) => {
    const s = parseLevel(LEVELS[thin].rows);
    for (const d of path) if (!move(s, d).moved) return false;
    return !s.won && !solve(cloneState(s)).solution;
  };
  const dirs = ['up', 'right', 'down', 'left'];
  outer: for (const a of dirs) for (const b of dirs) for (const c of dirs) {
    if (tryPath([a, b, c])) {
      let t = 0;
      for (const d of [a, b, c]) { dead.input(d, t); t = dead.busyUntil; dead.tick(t); }
      found = true;
      break outer;
    }
  }
  if (!found) fail.push('test setup: no dead end found on Thin ice within 3 moves');
  else {
    const hd = ask(dead);
    if (hd !== null) fail.push(`from a dead end the hint was ${hd} (want null)`);
    if (!dead.events.some((e) => e.type === 'hint' && e.dir === null)) fail.push('no "hint" event telling the screen there is no way out');
  }

  return { pass: fail.length === 0, details: fail.length ? fail.join('; ') : 'hints solve all 12 levels at par, cap stars at 2, start from the current state and report dead ends' };
}
