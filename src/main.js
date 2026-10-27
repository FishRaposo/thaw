import { Session, moveDuration } from './session.js';
import { T, DIRS } from './rules.js';
import { W, H, C, layout, drawBackground, drawBoard, drawHud, drawSelect, drawWon, drawDone } from './render.js';
import { Sfx } from './audio.js';
import { loadProgress, saveProgress } from './storage.js';

const KEY_DIR = {
  ArrowUp: 'up', KeyW: 'up', ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
};
const UNDO_KEYS = new Set(['KeyZ', 'Backspace', 'KeyU']);
const BUTTONS = [
  { id: 'undo', label: 'undo  z', x: W - 300, y: 18, w: 86, h: 30 },
  { id: 'restart', label: 'restart  r', x: W - 206, y: 18, w: 92, h: 30 },
  { id: 'menu', label: 'levels', x: W - 106, y: 18, w: 80, h: 30 },
];

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
    this.sfx = new Sfx();
    this.ses = new Session({ progress: loadProgress() });
    this.cursor = 0;
    this.cells = this.ses.levels.map((_, i) => ({ x: 150 + (i % 4) * 170, y: 160 + Math.floor(i / 4) * 100, w: 150, h: 80 }));
    this.v = null;
    this.time = 0;
    this.wonAt = 0;
    this.padPrev = [];
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => this.onKey(e));
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    canvas.focus();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.clientWidth || innerWidth;
    const ch = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const s = Math.min(cw / W, ch / H);
    Object.assign(this.view, { scale: s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr });
  }

  toWorld(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left - this.view.ox) / this.view.scale, (e.clientY - r.top - this.view.oy) / this.view.scale];
  }

  // ---------------------------------------------------------------- input

  command(cmd, arg) {
    const ses = this.ses;
    const now = performance.now();
    this.sfx.unlock();
    switch (ses.screen) {
      case 'select':
        if (cmd === 'dir') {
          const [dx, dy] = DIRS[arg];
          this.cursor = Math.max(0, Math.min(ses.levels.length - 1, this.cursor + dx + dy * 4));
          this.sfx.select();
        } else if (cmd === 'confirm' && ses.unlocked(this.cursor)) ses.start(this.cursor);
        break;
      case 'play':
        if (cmd === 'dir') ses.input(arg, now);
        else if (cmd === 'undo') ses.undo(now);
        else if (cmd === 'restart') ses.restart();
        else if (cmd === 'menu') ses.menu();
        break;
      case 'won':
        if (cmd === 'confirm') ses.next();
        else if (cmd === 'restart') ses.restart();
        else if (cmd === 'menu') ses.menu();
        break;
      case 'done':
        if (cmd === 'confirm' || cmd === 'menu') ses.menu();
        break;
    }
    if (ses.screen === 'select') this.cursor = Math.min(this.cursor, ses.levels.length - 1);
  }

  onKey(e) {
    if (KEY_DIR[e.code] || e.code === 'Space' || e.code === 'Backspace') e.preventDefault();
    if (e.code === 'KeyM' && !e.repeat) return this.sfx.toggleMute();
    if (KEY_DIR[e.code]) return this.command('dir', KEY_DIR[e.code]);
    if (e.repeat) return;
    if (UNDO_KEYS.has(e.code)) this.command('undo');
    else if (e.code === 'KeyR') this.command('restart');
    else if (e.code === 'Escape' || e.code === 'KeyL') this.command('menu');
    else if (e.code === 'Enter' || e.code === 'Space') this.command('confirm');
  }

  onDown(e) {
    this.canvas.focus();
    this.downAt = this.toWorld(e);
  }

  onUp(e) {
    const [x, y] = this.toWorld(e);
    const [x0, y0] = this.downAt || [x, y];
    const ses = this.ses;
    const dx = x - x0;
    const dy = y - y0;
    if (ses.screen === 'play' && Math.hypot(dx, dy) > 24) {
      this.command('dir', Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      return;
    }
    if (ses.screen === 'select') {
      const i = this.cells.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
      if (i >= 0) {
        this.cursor = i;
        this.command('confirm');
      }
      return;
    }
    if (ses.screen === 'play') {
      const b = BUTTONS.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (b) this.command(b.id);
      return;
    }
    this.command('confirm');
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) return;
    const b = gp.buttons.map((x) => x.pressed);
    const edge = (i) => b[i] && !this.padPrev[i];
    if (edge(12)) this.command('dir', 'up');
    if (edge(13)) this.command('dir', 'down');
    if (edge(14)) this.command('dir', 'left');
    if (edge(15)) this.command('dir', 'right');
    if (edge(0)) this.command('confirm');
    if (edge(1)) this.command('undo');
    if (edge(3)) this.command('restart');
    if (edge(9)) this.command('menu');
    this.padPrev = b;
  }

  // ---------------------------------------------------------------- events → animation

  snap() {
    const g = this.ses.game;
    this.v = {
      tiles: g.tiles.slice(),
      crates: g.crates.map((i) => ({ x: i % g.w, y: Math.floor(i / g.w) })),
      player: { ...g.player },
      face: this.v?.face || [0, 1],
      squash: 0,
      particles: [],
      anims: [],
      scheduled: [],
    };
  }

  react(events, now) {
    // Events arrive grouped by move. Each group animates over its own duration.
    let group = [];
    const flush = () => {
      if (group.length) this.animate(group, now);
      group = [];
    };
    for (const e of events) {
      if (['start', 'restart', 'undo'].includes(e.type)) {
        flush();
        this.snap();
        if (e.type === 'undo') this.sfx.undo();
        continue;
      }
      if (e.type === 'complete') {
        flush();
        this.wonAt = this.time;
        saveProgress(this.ses.progress);
        for (let k = 0; k < e.stars; k++) setTimeout(() => this.sfx.star(k), 180 + k * 170);
        continue;
      }
      if (e.type === 'done') continue;
      if ((e.type === 'slide' || e.type === 'kick' || e.type === 'bump') && group.length) flush();
      group.push(e);
    }
    flush();
  }

  animate(events, now) {
    const v = this.v;
    const dur = moveDuration(events);
    const t0 = now;
    // The path whose leaving cracks tiles: the player's slide, or the kicked crate's.
    const mover = events.find((e) => e.type === 'slide' || e.type === 'crate' || e.type === 'sink')?.path ?? null;
    for (const e of events) {
      if (e.type === 'bump') {
        v.squash = 0.6;
        this.sfx.bump();
      } else if (e.type === 'slide') {
        v.face = DIRS[e.dir];
        v.anims.push({ who: 'player', path: e.path, t0, dur });
        this.sfx.slide(e.path.length - 1);
      } else if (e.type === 'kick') {
        v.face = DIRS[e.dir];
        v.squash = 0.4;
        this.sfx.kick();
      } else if (e.type === 'crate' || e.type === 'sink') {
        const c = v.crates.find((c) => c.x === e.path[0][0] && c.y === e.path[0][1]);
        v.anims.push({ who: c, path: e.path, t0, dur: Math.max(110, (e.path.length - 1) * 55), sink: e.type === 'sink' });
        if (e.type === 'crate') this.sfx.thud(((e.path.length - 1) * 55) / 1000);
      } else if (e.type === 'crack') {
        const k = mover ? mover.findIndex(([x, y]) => x === e.x && y === e.y) : 0;
        const at = t0 + (mover ? ((k + 1) / Math.max(1, mover.length - 1)) * dur : 0);
        v.scheduled.push({ at, run: () => this.breakTile(e.x, e.y) });
      }
    }
  }

  breakTile(x, y) {
    const g = this.ses.game;
    this.v.tiles[y * g.w + x] = T.WATER;
    this.sfx.crack();
    this.burst(x + 0.5, y + 0.5, 10, C.iceHi);
  }

  burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 2.2;
      const life = 0.3 + Math.random() * 0.4;
      this.v.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: 2 + Math.random() * 3, color });
    }
  }

  stepView(now, dt) {
    const v = this.v;
    const g = this.ses.game;
    const ease = (k) => 1 - (1 - k) * (1 - k);
    const pos = (a) => {
      const k = ease(Math.min(1, (now - a.t0) / a.dur));
      const f = k * (a.path.length - 1);
      const i = Math.min(a.path.length - 2, Math.floor(f));
      const r = f - i;
      const [x0, y0] = a.path[Math.max(0, i)];
      const [x1, y1] = a.path[Math.min(a.path.length - 1, i + 1)];
      return a.path.length < 2 ? { x: x0, y: y0 } : { x: x0 + (x1 - x0) * r, y: y0 + (y1 - y0) * r };
    };
    for (const a of v.anims) {
      const p = pos(a);
      if (a.who === 'player') Object.assign(v.player, p);
      else if (a.who) Object.assign(a.who, p);
      if (now >= a.t0 + a.dur && !a.done) {
        a.done = true;
        if (a.sink && a.who) {
          v.crates.splice(v.crates.indexOf(a.who), 1);
          const [x, y] = a.path[a.path.length - 1];
          v.tiles[y * g.w + x] = T.SNOW;
          this.sfx.splash();
          this.burst(x + 0.5, y + 0.5, 14, C.waterHi);
        }
        if (a.who === 'player') v.squash = 0.35;
      }
    }
    v.anims = v.anims.filter((a) => !a.done);
    for (const s of v.scheduled) if (now >= s.at && !s.done) { s.done = true; s.run(); }
    v.scheduled = v.scheduled.filter((s) => !s.done);
    if (!v.anims.length && !v.scheduled.length) {
      // At rest the view must match the rules exactly.
      v.player = { ...g.player };
      v.tiles = g.tiles.slice();
      v.crates = g.crates.map((i) => ({ x: i % g.w, y: Math.floor(i / g.w) }));
    }
    v.squash = Math.max(0, v.squash - dt * 4);
    for (const p of v.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 4 * dt;
    }
    v.particles = v.particles.filter((p) => p.life > 0);
  }

  // ---------------------------------------------------------------- loop

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    this.time += dt;
    this.pollPad();
    const ses = this.ses;
    const wasScreen = ses.screen;
    ses.tick(now);
    const events = ses.takeEvents();
    if (events.length) {
      if (!this.v && ses.game) this.snap();
      this.react(events, now);
      if (events.some((e) => e.type === 'win')) setTimeout(() => this.sfx.win(), moveDuration(events) - 40);
    }
    if (this.v && ses.game && (ses.screen === 'play' || ses.screen === 'won')) this.stepView(now, dt);
    if (wasScreen !== ses.screen && ses.screen === 'won') this.wonAt = this.time;
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  render() {
    const ctx = this.ctx;
    const vw = this.view;
    const ses = this.ses;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.bgDeep;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(vw.dpr * vw.scale, 0, 0, vw.dpr * vw.scale, vw.dpr * vw.ox, vw.dpr * vw.oy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    drawBackground(ctx, this.time);
    if (ses.screen === 'select') drawSelect(ctx, ses, this.cursor, this.cells, this.time);
    else if (ses.screen === 'done') drawDone(ctx, ses);
    else if (this.v) {
      drawBoard(ctx, ses, this.v, this.time);
      drawHud(ctx, ses, ses.screen === 'play' ? BUTTONS : []);
      if (ses.screen === 'won') drawWon(ctx, ses, this.time - this.wonAt);
    }
    if (this.sfx.muted) {
      ctx.fillStyle = C.dim;
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('muted', W - 10, H - 10);
    }
    ctx.restore();
  }
}

window.__thaw = new Game(document.getElementById('game'));
