import { Session, moveDuration } from './core/session.ts';
import type { SessionEvent } from './core/session.ts';
import { T, DIRS, parseLevel } from './core/rules.ts';
import type { Cell, Dir, GameState } from './core/rules.ts';
import type { LevelPack, Progress } from './core/types.ts';
import { CORE_PACK, PACKS } from './content/levels.ts';
import { W, H, C, layout, drawBackground, drawBoard, drawHud, drawSelect, drawWon, drawDone } from './presentation/render.ts';
import type { Anim, Button, CellRect, SelectUi, View } from './presentation/render.ts';
import { Menus } from './presentation/menus.ts';
import { Sfx } from './platform/audio.ts';
import { loadProgress, loadLegacyProgress, saveProgress, loadSave, saveRun, clearSave } from './platform/storage.ts';
import type { RunSave } from './platform/storage.ts';
import { loadSettings, saveSettings } from './platform/settings.ts';
import type { Settings } from './platform/settings.ts';

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up', ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
};
const UNDO_KEYS = new Set(['KeyZ', 'Backspace', 'KeyU']);
const BUTTONS: Button[] = [
  { id: 'undo', label: 'undo  z', x: W - 300, y: 18, w: 86, h: 30 },
  { id: 'restart', label: 'restart  r', x: W - 206, y: 18, w: 92, h: 30 },
  { id: 'menu', label: 'levels', x: W - 106, y: 18, w: 80, h: 30 },
];
const SETTINGS_RECT: CellRect = { x: W - 118, y: 18, w: 96, h: 30 };
const CONTINUE_RECT: CellRect = { x: W / 2 - 150, y: H - 72, w: 300, h: 32 };
const PACK_Y = 124;
const PACK_H = 26;
const PACK_W = 190;
const PACK_GAP = 12;
const CELLS_Y = 164;

class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  view: { scale: number; ox: number; oy: number; dpr: number };
  sfx: Sfx;
  menus: Menus;
  ses: Session;
  packs: LevelPack[] = PACKS;
  packIndex = 0;
  progress: Progress;
  settings: Settings;
  save: RunSave | null;
  saveLabel: string | null = null;
  paused = false;
  cursor: number;
  cells: CellRect[];
  packRects: CellRect[];
  v: View | null;
  time: number;
  wonAt: number;
  padPrev: boolean[];
  last: number;
  downAt: Cell | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    const ui = document.getElementById('ui');
    const announcer = document.getElementById('announcer');
    if (!ctx || !ui || !announcer) throw new Error('Thaw needs a canvas, #ui and #announcer');
    this.canvas = canvas;
    this.ctx = ctx;
    this.view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
    this.settings = loadSettings();
    this.sfx = new Sfx();
    this.sfx.configure(this.settings);
    this.menus = new Menus(ui, announcer);
    this.progress = loadProgress() ?? this.migrateLegacyProgress();
    this.save = loadSave();
    this.refreshSaveLabel();
    this.ses = this.makeSession(0);
    this.cursor = 0;
    this.cells = this.makeCells();
    this.packRects = this.makePackRects();
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
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    canvas.focus();
  }

  migrateLegacyProgress(): Progress {
    const legacy = loadLegacyProgress();
    if (!legacy) return {};
    const core: Record<string, number> = {};
    for (const [i, level] of CORE_PACK.levels.entries()) {
      const stars = legacy[i] ?? 0;
      if (stars > 0) core[level.id] = stars;
    }
    const progress: Progress = { [CORE_PACK.id]: core };
    saveProgress(progress);
    return progress;
  }

  makeSession(index: number): Session {
    const pack = this.packs[index] ?? this.packs[0];
    this.progress[pack.id] ??= {};
    return new Session({ pack, progress: this.progress[pack.id] });
  }

  makeCells(): CellRect[] {
    return this.ses.levels.map((_, i) => ({ x: 150 + (i % 4) * 170, y: CELLS_Y + Math.floor(i / 4) * 100, w: 150, h: 80 }));
  }

  makePackRects(): CellRect[] {
    const total = this.packs.length * PACK_W + (this.packs.length - 1) * PACK_GAP;
    const start = (W - total) / 2;
    return this.packs.map((_, i) => ({ x: start + i * (PACK_W + PACK_GAP), y: PACK_Y, w: PACK_W, h: PACK_H }));
  }

  refreshSaveLabel(): void {
    const save = this.save;
    if (!save) {
      this.saveLabel = null;
      return;
    }
    const pack = this.packs.find((p) => p.id === save.packId);
    const level = pack?.levels.find((l) => l.id === save.levelId);
    if (!pack || !level) {
      this.clearRunSave();
      return;
    }
    this.saveLabel = `continue  ${pack.name} · ${level.name}`;
  }

  clearRunSave(): void {
    clearSave();
    this.save = null;
    this.saveLabel = null;
  }

  persistRun(): void {
    const ses = this.ses;
    const game = ses.game;
    if (!game || ses.screen !== 'play') return;
    const level = ses.pack.levels[ses.level];
    const save: RunSave = {
      version: 1,
      packId: ses.pack.id,
      levelId: level.id,
      levelIndex: ses.level,
      tiles: Array.from(game.tiles),
      player: { ...game.player },
      crates: [...game.crates],
      moves: game.moves,
      savedAt: Date.now(),
    };
    this.save = save;
    this.saveLabel = `continue  ${ses.pack.name} · ${level.name}`;
    saveRun(save);
  }

  resumeSave(): void {
    const save = this.save;
    if (!save) return;
    const packIndex = this.packs.findIndex((p) => p.id === save.packId);
    if (packIndex < 0) {
      this.clearRunSave();
      return;
    }
    const pack = this.packs[packIndex];
    const levelIndex = pack.levels.findIndex((l) => l.id === save.levelId);
    if (levelIndex < 0) {
      this.clearRunSave();
      return;
    }
    const level = pack.levels[levelIndex];
    const game = parseLevel(level.rows);
    if (save.tiles.length !== game.tiles.length) {
      this.clearRunSave();
      return;
    }
    game.tiles = new Uint8Array(save.tiles);
    game.player = { ...save.player };
    game.crates = [...save.crates];
    game.moves = save.moves;
    this.packIndex = packIndex;
    this.ses = this.makeSession(packIndex);
    this.ses.resume(levelIndex, game);
    this.cells = this.makeCells();
    this.packRects = this.makePackRects();
    this.v = null;
    this.paused = false;
    this.sfx.unlock();
    this.menus.announce(`Resumed ${level.name}`);
  }

  setPack(index: number): void {
    const next = Math.max(0, Math.min(this.packs.length - 1, index));
    if (next === this.packIndex) return;
    this.packIndex = next;
    this.ses = this.makeSession(next);
    this.cursor = 0;
    this.cells = this.makeCells();
    this.packRects = this.makePackRects();
    this.v = null;
    this.menus.announce(this.packs[next].name);
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.clientWidth || innerWidth;
    const ch = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const s = Math.min(cw / W, ch / H);
    Object.assign(this.view, { scale: s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr });
  }

  toWorld(e: PointerEvent): Cell {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left - this.view.ox) / this.view.scale, (e.clientY - r.top - this.view.oy) / this.view.scale];
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    saveSettings(settings);
    this.sfx.configure(settings);
  }

  toggleFullscreen(): void {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void this.canvas.requestFullscreen?.();
    } catch {
      /* not allowed in this frame */
    }
  }

  openSettings(): void {
    this.sfx.unlock();
    this.menus.openSettings(
      this.settings,
      { onChange: (s) => this.applySettings(s), onFullscreen: () => this.toggleFullscreen() },
      () => {
        if (this.ses.screen === 'play') this.paused = false;
      },
    );
  }

  pause(): void {
    if (this.ses.screen !== 'play' || this.paused || this.menus.isOpen) return;
    this.paused = true;
    this.menus.announce('Paused');
    // Defer the modal by one task: opening it inside the Escape keydown lets the same key event
    // reach the new dialog and close it immediately.
    setTimeout(() => {
      if (!this.paused || this.menus.isOpen) return;
      this.menus.openPause(
        this.settings,
        {
          onChange: (s) => this.applySettings(s),
          onFullscreen: () => this.toggleFullscreen(),
          onResume: () => {
            if (this.ses.screen === 'play') {
              this.paused = false;
              this.menus.announce('Resumed');
            }
          },
          onLevels: () => {
            this.paused = false;
            this.ses.menu();
            this.v = null;
            this.menus.announce('Levels');
          },
        },
      );
    }, 0);
  }

  // ---------------------------------------------------------------- input

  command(cmd: string, arg?: Dir): void {
    const ses = this.ses;
    const now = performance.now();
    this.sfx.unlock();
    switch (ses.screen) {
      case 'select':
        if (cmd === 'dir' && arg) {
          const [dx, dy] = DIRS[arg];
          this.cursor = Math.max(0, Math.min(ses.levels.length - 1, this.cursor + dx + dy * 4));
          this.sfx.select();
        } else if (cmd === 'confirm' && ses.unlocked(this.cursor)) {
          this.ses.start(this.cursor);
          this.v = null;
        } else if (cmd === 'settings') {
          this.openSettings();
        } else if (cmd === 'continue') {
          this.resumeSave();
        }
        break;
      case 'play':
        if (cmd === 'dir' && arg) ses.input(arg, now);
        else if (cmd === 'undo') ses.undo(now);
        else if (cmd === 'restart') ses.restart();
        else if (cmd === 'menu') {
          ses.menu();
          this.v = null;
        } else if (cmd === 'settings') {
          this.pause();
        }
        break;
      case 'won':
        if (cmd === 'confirm') ses.next();
        else if (cmd === 'restart') ses.restart();
        else if (cmd === 'menu') {
          ses.menu();
          this.v = null;
        }
        break;
      case 'done':
        if (cmd === 'confirm' || cmd === 'menu') {
          ses.menu();
          this.v = null;
        }
        break;
    }
    if (ses.screen === 'select') this.cursor = Math.min(this.cursor, ses.levels.length - 1);
  }

  onKey(e: KeyboardEvent): void {
    if (this.menus.isOpen) return;
    const dir = KEY_DIR[e.code];
    if (dir || e.code === 'Space' || e.code === 'Backspace') e.preventDefault();
    if (e.code === 'KeyM' && !e.repeat) {
      this.applySettings({ ...this.settings, muted: !this.settings.muted });
      return;
    }
    if (e.code === 'KeyF' && !e.repeat) {
      this.toggleFullscreen();
      return;
    }
    if (e.code === 'Escape') {
      if (this.ses.screen === 'play') this.pause();
      else if (this.ses.screen === 'won' || this.ses.screen === 'done') this.command('menu');
      return;
    }
    if (this.ses.screen === 'select') {
      if (e.code === 'BracketLeft') return this.setPack(this.packIndex - 1);
      if (e.code === 'BracketRight') return this.setPack(this.packIndex + 1);
      if (e.code === 'KeyC' && this.save) return this.resumeSave();
      if (e.code === 'KeyO') return this.openSettings();
    }
    if (this.ses.screen === 'play' && e.code === 'KeyO') return this.pause();
    if (dir) {
      this.command('dir', dir);
      return;
    }
    if (e.repeat) return;
    if (UNDO_KEYS.has(e.code)) this.command('undo');
    else if (e.code === 'KeyR') this.command('restart');
    else if (e.code === 'KeyL') this.command('menu');
    else if (e.code === 'Enter' || e.code === 'Space') this.command('confirm');
  }

  onDown(e: PointerEvent): void {
    this.canvas.focus();
    this.downAt = this.toWorld(e);
  }

  onUp(e: PointerEvent): void {
    if (this.menus.isOpen) return;
    const [x, y] = this.toWorld(e);
    const [x0, y0] = this.downAt ?? [x, y];
    const ses = this.ses;
    const dx = x - x0;
    const dy = y - y0;
    if (ses.screen === 'play' && Math.hypot(dx, dy) > 24) {
      this.command('dir', Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      return;
    }
    if (ses.screen === 'select') {
      const pack = this.packRects.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
      if (pack >= 0) return this.setPack(pack);
      if (x >= SETTINGS_RECT.x && x <= SETTINGS_RECT.x + SETTINGS_RECT.w && y >= SETTINGS_RECT.y && y <= SETTINGS_RECT.y + SETTINGS_RECT.h) {
        return this.openSettings();
      }
      if (this.save && x >= CONTINUE_RECT.x && x <= CONTINUE_RECT.x + CONTINUE_RECT.w && y >= CONTINUE_RECT.y && y <= CONTINUE_RECT.y + CONTINUE_RECT.h) {
        return this.resumeSave();
      }
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

  pollPad(): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) return;
    const b = gp.buttons.map((x) => x.pressed);
    const edge = (i: number): boolean => !!b[i] && !this.padPrev[i];
    if (this.ses.screen === 'select') {
      if (edge(12)) this.command('dir', 'up');
      if (edge(13)) this.command('dir', 'down');
      if (edge(14)) this.command('dir', 'left');
      if (edge(15)) this.command('dir', 'right');
      if (edge(4)) this.setPack(this.packIndex - 1);
      if (edge(5)) this.setPack(this.packIndex + 1);
      if (edge(0)) this.command('confirm');
    } else {
      if (edge(12)) this.command('dir', 'up');
      if (edge(13)) this.command('dir', 'down');
      if (edge(14)) this.command('dir', 'left');
      if (edge(15)) this.command('dir', 'right');
      if (edge(0)) this.command('confirm');
      if (edge(1)) this.command('undo');
      if (edge(2)) this.pause();
      if (edge(3)) this.command('restart');
      if (edge(9)) this.command('menu');
    }
    this.padPrev = b;
  }

  // ---------------------------------------------------------------- events → animation

  snap(): void {
    const g = this.ses.game;
    if (!g) return;
    const face: Cell = this.v?.face ?? [0, 1];
    this.v = {
      tiles: g.tiles.slice(),
      crates: g.crates.map((i) => ({ x: i % g.w, y: Math.floor(i / g.w) })),
      player: { ...g.player },
      face,
      squash: 0,
      particles: [],
      anims: [],
      scheduled: [],
    };
  }

  react(events: SessionEvent[], now: number): void {
    // Events arrive grouped by move. Each group animates over its own duration.
    let group: SessionEvent[] = [];
    const flush = (): void => {
      if (group.length) this.animate(group, now);
      group = [];
    };
    for (const e of events) {
      if (e.type === 'start' || e.type === 'restart') {
        flush();
        this.snap();
        if (e.type === 'restart' || !e.resumed) this.clearRunSave();
        this.menus.announce(`${this.ses.pack.name}: ${this.ses.pack.levels[this.ses.level].name}`);
        continue;
      }
      if (e.type === 'undo') {
        flush();
        this.snap();
        this.sfx.undo();
        continue;
      }
      if (e.type === 'complete') {
        flush();
        this.wonAt = this.time;
        saveProgress(this.progress);
        this.clearRunSave();
        for (let k = 0; k < e.stars; k++) setTimeout(() => this.sfx.star(k), 180 + k * 170);
        this.menus.announce(`Won ${this.ses.pack.levels[this.ses.level].name} with ${e.stars} stars`);
        continue;
      }
      if (e.type === 'done') {
        this.menus.announce('Every room thawed');
        continue;
      }
      if ((e.type === 'slide' || e.type === 'kick' || e.type === 'bump') && group.length) flush();
      group.push(e);
    }
    flush();
    if (events.some((e) => e.type === 'slide' || e.type === 'kick' || e.type === 'crate' || e.type === 'sink' || e.type === 'undo')) {
      this.persistRun();
    }
  }

  animate(events: SessionEvent[], now: number): void {
    const v = this.v;
    if (!v) return;
    const dur = moveDuration(events);
    const t0 = now;
    // The path whose leaving cracks tiles: the player's slide, or the kicked crate's.
    const moverEvent = events.find((e) => e.type === 'slide' || e.type === 'crate' || e.type === 'sink');
    const mover: Cell[] | null = moverEvent && 'path' in moverEvent ? moverEvent.path : null;
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
        const [cx, cy] = e.path[0];
        const c = v.crates.find((crate) => crate.x === cx && crate.y === cy);
        v.anims.push({ who: c ?? null, path: e.path, t0, dur: Math.max(110, (e.path.length - 1) * 55), sink: e.type === 'sink' });
        if (e.type === 'crate') this.sfx.thud(((e.path.length - 1) * 55) / 1000);
      } else if (e.type === 'crack') {
        const k = mover ? mover.findIndex(([x, y]) => x === e.x && y === e.y) : 0;
        const at = t0 + (mover ? ((k + 1) / Math.max(1, mover.length - 1)) * dur : 0);
        v.scheduled.push({ at, run: () => this.breakTile(e.x, e.y) });
      }
    }
  }

  breakTile(x: number, y: number): void {
    const g = this.ses.game;
    if (!g || !this.v) return;
    this.v.tiles[y * g.w + x] = T.WATER;
    this.sfx.crack();
    this.burst(x + 0.5, y + 0.5, 10, C.iceHi);
  }

  burst(x: number, y: number, n: number, color: string): void {
    if (!this.v) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 2.2;
      const life = 0.3 + Math.random() * 0.4;
      this.v.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: 2 + Math.random() * 3, color });
    }
  }

  stepView(now: number, dt: number): void {
    const v = this.v;
    const g = this.ses.game;
    if (!v || !g) return;
    const ease = (k: number): number => 1 - (1 - k) * (1 - k);
    const pos = (a: Anim): { x: number; y: number } => {
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
        if (a.sink && a.who && a.who !== 'player') {
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

  frame(now: number): void {
    const dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    this.time += dt;
    if (!this.paused && !this.menus.isOpen) {
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
    }
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  render(): void {
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
    if (ses.screen === 'select') {
      const ui: SelectUi = {
        packs: this.packs,
        packIndex: this.packIndex,
        packRects: this.packRects,
        settingsRect: SETTINGS_RECT,
        continueRect: this.save ? CONTINUE_RECT : null,
        continueLabel: this.saveLabel,
      };
      drawSelect(ctx, ses, this.cursor, this.cells, this.time, ui);
    } else if (ses.screen === 'done') drawDone(ctx, ses);
    else if (this.v) {
      drawBoard(ctx, ses, this.v, this.time);
      drawHud(ctx, ses, ses.screen === 'play' ? BUTTONS : []);
      if (ses.screen === 'won') drawWon(ctx, ses, this.time - this.wonAt);
    }
    if (this.settings.muted) {
      ctx.fillStyle = C.dim;
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('muted', W - 10, H - 10);
    }
    ctx.restore();
  }
}

window.__thaw = new Game(document.getElementById('game') as HTMLCanvasElement);
