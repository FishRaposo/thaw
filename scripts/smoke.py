"""Headless smoke test: plays all twelve levels through real key presses (with presses queued during
slides), checks a swipe and the level menu, and fails on any console error.
Usage: npm start (in another terminal), then: python scripts/smoke.py <screenshot-dir> [base-url]
Needs: pip install playwright && playwright install chromium"""
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8080'
KEYS = {'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight'}
SOLVE = """async () => { const { solve } = await import('/dist/core/solver.js'); const { parseLevel } = await import('/dist/core/rules.js');
  const g = window.__thaw; return solve(parseLevel(g.ses.levels[g.ses.level].rows)).solution; }"""
errors = []
fails = []

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto(f'{BASE}/index.html')
    pg.evaluate('() => { try { localStorage.clear(); } catch {} }')
    pg.reload()
    pg.wait_for_timeout(600)
    pg.keyboard.press('Enter')
    for lvl in range(12):
        pg.wait_for_timeout(200)
        for d in pg.evaluate(SOLVE):
            pg.wait_for_function('window.__thaw.ses.queue.length < 2')
            pg.keyboard.press(KEYS[d])
            pg.wait_for_timeout(60)
        pg.wait_for_function("window.__thaw.ses.screen === 'won'", timeout=8000)
        r = pg.evaluate('window.__thaw.ses.result')
        print(f"level {lvl + 1}: {r['moves']} moves, {r['stars']} stars")
        if r['stars'] != 3:
            fails.append(f'level {lvl + 1} not 3 stars')
        pg.keyboard.press('Enter')
    pg.wait_for_timeout(300)
    if pg.evaluate('window.__thaw.ses.screen') != 'done':
        fails.append('did not reach the end screen')
    pg.screenshot(path=f'{OUT}/done.png')

    # Swipe: back to the menu, start level 1, drag right across the board.
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(200)
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(300)
    pg.mouse.move(400, 300)
    pg.mouse.down()
    pg.mouse.move(520, 305, steps=4)
    pg.mouse.up()
    pg.wait_for_timeout(600)
    if pg.evaluate('window.__thaw.ses.game.moves') != 1:
        fails.append('swipe right did not move')
    b.close()

for e in errors:
    print(' ', e)
print('FAIL: ' + '; '.join(fails) if fails else 'all levels played, swipe works', '·', 'console errors' if errors else 'no console errors')
sys.exit(1 if errors or fails else 0)
