"""Plays levels through real key presses to produce the README/itch media (video, screenshots, cover).
Usage: npm start (port 8080), then: python scripts/record_media.py <out-dir> [base-url]"""
import sys, base64
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8080'
KEYS = {'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight'}
SOLVE = """async () => { const { solve } = await import('/dist/core/solver.js'); const { parseLevel } = await import('/dist/core/rules.js');
  const g = window.__thaw; return solve(parseLevel(g.ses.levels[g.ses.level].rows)).solution; }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 960, 'height': 540}, record_video_dir=OUT, record_video_size={'width': 960, 'height': 540})
    pg = ctx.new_page()
    pg.goto(f'{BASE}/index.html')
    pg.evaluate('() => { try { localStorage.clear(); } catch {} }')
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{OUT}/select-empty.png')
    # Unlock everything for the recording, then play a few rooms at a human pace.
    pg.evaluate('() => { const s = window.__thaw.ses; s.progress = Object.fromEntries(s.levels.map((l, i) => [l.id, i < 9 ? 3 : 0])); }')
    for lvl in (5, 8, 10):
        pg.evaluate(f'() => window.__thaw.ses.start({lvl})')
        pg.wait_for_timeout(700)
        for i, d in enumerate(pg.evaluate(SOLVE)):
            pg.wait_for_function('window.__thaw.ses.queue.length === 0 && performance.now() >= window.__thaw.ses.busyUntil')
            pg.wait_for_timeout(260)
            pg.keyboard.press(KEYS[d])
            if lvl == 8 and i == 4:
                pg.wait_for_timeout(600)
                pg.screenshot(path=f'{OUT}/ferry.png')
        pg.wait_for_timeout(1600)
        pg.screenshot(path=f'{OUT}/won-{lvl + 1}.png')
    pg.evaluate('() => window.__thaw.ses.menu()')
    pg.wait_for_timeout(800)
    pg.screenshot(path=f'{OUT}/select.png')
    ctx.close()

    # Cover (630x500 at 2x): a room, with the title over it.
    pg = b.new_page(viewport={'width': 1260, 'height': 1000})
    pg.goto(f'{BASE}/index.html')
    pg.wait_for_timeout(600)
    pg.evaluate('() => window.__thaw.ses.start(11)')
    pg.wait_for_timeout(500)
    data = pg.evaluate('''() => { const c = document.getElementById('game'); const o = document.createElement('canvas'); o.width = 1260; o.height = 1000;
        const x = o.getContext('2d'); x.drawImage(c, 0, 0, 1260, 1000);
        x.fillStyle = '#dfe9f0'; x.fillRect(0, 0, 1260, 246);
        x.fillStyle = '#1e2a35'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = 'bold 170px "Iowan Old Style", Palatino, Georgia, serif'; if ('letterSpacing' in x) x.letterSpacing = '36px';
        x.fillText('THAW', 648, 132);
        return o.toDataURL('image/png'); }''')
    open(f'{OUT}/cover.png', 'wb').write(base64.b64decode(data.split(',')[1]))
    b.close()
print('done')
