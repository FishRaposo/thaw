import { chromium, firefox, webkit } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createStaticServer } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const arg = (name, fallback) => {
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const engines = { chromium, firefox, webkit };
const requested = arg('browser', 'all');
const names = requested === 'all' ? ['chromium', 'firefox', 'webkit'] : requested.split(',');
const shots = arg('shots', '');
if (shots) mkdirSync(shots, { recursive: true });

const server = createStaticServer({ root });
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

function attach(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
}

async function waitReady(page) {
  await page.waitForFunction(() => !!window.__thaw && !!window.__thaw.ses, undefined, { timeout: 15000 });
}

async function waitIdle(page) {
  await page.waitForFunction(
    () => {
      const g = window.__thaw;
      return g && g.ses && g.ses.queue.length === 0 && performance.now() >= g.ses.busyUntil;
    },
    undefined,
    { timeout: 10000 },
  );
}

async function clickRect(page, rect) {
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2);
}

async function solveCurrent(page) {
  return page.evaluate(async () => {
    const { solve } = await import('/dist/core/solver.js');
    const { parseLevel } = await import('/dist/core/rules.js');
    const s = window.__thaw.ses;
    return solve(parseLevel(s.pack.levels[s.level].rows)).solution;
  });
}

const KEYS = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };

let failed = false;

for (const name of names) {
  const engine = engines[name];
  const errors = [];
  if (!engine) {
    console.error(`unknown browser ${name}`);
    failed = true;
    continue;
  }
  let browser;
  try {
    browser = await engine.launch();
  } catch (e) {
    console.error(`FAIL ${name}: launch failed: ${e.message}`);
    console.error(`      run: npx playwright-core install ${name}`);
    failed = true;
    continue;
  }

  let step = 'load';
  try {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await context.newPage();
    attach(page, errors);
    const expect = (ok, message) => { if (!ok) errors.push(message); };

    await page.goto(`${base}/index.html`);
    await waitReady(page);
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.reload();
    await waitReady(page);
    expect(await page.evaluate(() => window.__thaw.ses.screen) === 'select', 'does not start on the level select');
    if (shots) await page.screenshot({ path: join(shots, `${name}-select.png`) });

    // Settings dialog: open, toggle reduced motion, close, verify persistence.
    step = 'open settings';
    await page.keyboard.press('KeyO');
    await page.waitForSelector('dialog[open]');
    expect((await page.locator('dialog h2').innerText()) === 'Settings', 'settings dialog has the wrong title');
    await page.locator('#thaw-reduced').check();
    await page.locator('dialog .actions button').last().click();
    step = 'close settings';
    await page.waitForSelector('dialog', { state: 'detached' });
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('thaw.settings.v1') || '{}'));
    expect(settings.reducedMotion === true, 'reduced-motion setting did not persist');

    // Pack tabs switch between the two packs.
    step = 'pack tabs';
    const tabs = await page.evaluate(() => window.__thaw.packRects);
    await clickRect(page, tabs[1]);
    expect(await page.evaluate(() => window.__thaw.packIndex) === 1, 'pack tab did not switch to Frostbite');
    await clickRect(page, tabs[0]);
    expect(await page.evaluate(() => window.__thaw.packIndex) === 0, 'pack tab did not switch back');

    // Start the first room, solve it, verify stable-id progress.
    step = 'start room 1';
    const cell = await page.evaluate(() => window.__thaw.cells[0]);
    await clickRect(page, cell);
    await page.waitForFunction(() => window.__thaw.ses.screen === 'play', undefined, { timeout: 5000 });
    step = 'solve room 1';
    const dirs = await solveCurrent(page);
    expect(Array.isArray(dirs) && dirs.length > 0, 'solver returned no solution for room 1');
    for (const dir of dirs) {
      await waitIdle(page);
      await page.keyboard.press(KEYS[dir]);
      await page.waitForTimeout(60);
    }
    await page.waitForFunction(() => window.__thaw.ses.screen === 'won', undefined, { timeout: 10000 });
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('thaw.progress.v2') || '{}'));
    expect(progress['long-thaw']?.glide === 3, 'room 1 stars were not saved under its stable id');
    expect(await page.evaluate(() => window.__thaw.save === null), 'save was not cleared after a win');
    if (shots) await page.screenshot({ path: join(shots, `${name}-won.png`) });

    // Next room, pause, resume, make a move, then reload and continue.
    step = 'next room';
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__thaw.ses.screen === 'play', undefined, { timeout: 5000 });
    step = 'open pause';
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]');
    expect((await page.locator('dialog h2').innerText()) === 'Paused', 'pause dialog has the wrong title');
    await page.locator('dialog .actions button').first().click();
    step = 'close pause';
    await page.waitForSelector('dialog', { state: 'detached' });

    step = 'move and save';
    const nextDirs = await solveCurrent(page);
    await waitIdle(page);
    await page.keyboard.press(KEYS[nextDirs[0]]);
    await waitIdle(page);
    const saved = await page.evaluate(() => window.__thaw.save);
    expect(saved && saved.moves >= 1, 'run was not saved after a move');

    step = 'reload and continue';
    await page.reload();
    await waitReady(page);
    await page.waitForFunction(() => window.__thaw.ses.screen === 'select', undefined, { timeout: 5000 });
    expect(await page.evaluate(() => !!window.__thaw.saveLabel), 'continue label is missing after reload');
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => window.__thaw.ses.screen === 'play', undefined, { timeout: 5000 });
    const resumedMoves = await page.evaluate(() => window.__thaw.ses.game.moves);
    expect(resumedMoves === saved.moves, `resumed at ${resumedMoves} moves, saved ${saved.moves}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]');
    await page.locator('dialog .actions button').nth(1).click();
    await page.waitForFunction(() => window.__thaw.ses.screen === 'select', undefined, { timeout: 5000 });
    if (shots) await page.screenshot({ path: join(shots, `${name}-settings.png`) });

    // Mobile viewport: the level select is tappable and a swipe moves the player.
    step = 'mobile';
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const mp = await mobile.newPage();
    attach(mp, errors);
    await mp.goto(`${base}/index.html`);
    await waitReady(mp);
    const tap = await mp.evaluate(() => {
      const g = window.__thaw;
      const c = g.cells[0];
      return { x: g.view.ox + (c.x + c.w / 2) * g.view.scale, y: g.view.oy + (c.y + c.h / 2) * g.view.scale };
    });
    await mp.touchscreen.tap(tap.x, tap.y);
    await mp.waitForFunction(() => window.__thaw.ses.screen === 'play', undefined, { timeout: 5000 });
    const board = await mp.evaluate(() => {
      const g = window.__thaw;
      return { x: g.view.ox + 480 * g.view.scale, y: g.view.oy + 300 * g.view.scale };
    });
    await mp.evaluate(({ x, y }) => {
      const canvas = document.getElementById('game');
      const base = { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, buttons: 1 };
      canvas.dispatchEvent(new PointerEvent('pointerdown', base));
      canvas.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: x + 70 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: x + 70, buttons: 0 }));
    }, board);
    await mp.waitForTimeout(300);
    const moves = await mp.evaluate(() => window.__thaw.ses.game.moves);
    expect(moves === 1, `swipe at 390px produced ${moves} moves`);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(!overflow, 'page overflows horizontally at 390px');
    await mobile.close();
    await context.close();
  } catch (e) {
    errors.push(`journey failed at ${step}: ${String(e.message).split('\n')[0]}`);
  } finally {
    await browser.close();
  }

  if (errors.length) {
    failed = true;
    console.error(`FAIL ${name}`);
    for (const error of errors) console.error(`      ${error}`);
  } else {
    console.log(`ok   ${name}: select, settings, packs, solve, save/resume, pause, mobile swipe`);
  }
}

server.close();
process.exit(failed ? 1 : 0);
