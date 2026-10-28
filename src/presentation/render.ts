// Drawing only. Reads the session plus a small "view" of animation state; never changes the game.

import { T } from '../core/rules.ts';
import type { Cell, GameState, Tile } from '../core/rules.ts';
import type { Session } from '../core/session.ts';

export const W = 960;
export const H = 540;
const TAU = Math.PI * 2;

export const FONT = {
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

export const C = {
  bg: '#dfe9f0',
  bgDeep: '#c9d9e4',
  ice: '#bfe0f2',
  iceHi: '#e3f3fb',
  snow: '#f8fafc',
  snowDot: '#d9e4ec',
  rock: '#56636f',
  rockHi: '#74818d',
  rockLo: '#414c56',
  water: '#2c5a80',
  waterHi: '#4a7ea6',
  crack: '#6e93ad',
  crate: '#8a6a49',
  crateLo: '#6b5037',
  frost: '#e8f4fa',
  ink: '#1e2a35',
  dim: '#6d7f8d',
  warm: '#e8893a',
  scarf: '#c8402c',
} as const;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export interface Crate {
  x: number;
  y: number;
}

export interface Anim {
  who: 'player' | Crate | null;
  path: Cell[];
  t0: number;
  dur: number;
  sink?: boolean;
  done?: boolean;
}

export interface Scheduled {
  at: number;
  run: () => void;
  done?: boolean;
}

export interface View {
  tiles: Uint8Array;
  crates: Crate[];
  player: { x: number; y: number };
  face: Cell;
  squash: number;
  particles: Particle[];
  anims: Anim[];
  scheduled: Scheduled[];
}

export interface Button {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SelectUi {
  packs: { name: string }[];
  packIndex: number;
  packRects: CellRect[];
  settingsRect: CellRect;
  continueRect: CellRect | null;
  continueLabel: string | null;
}

export interface TextOptions {
  size?: number;
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: string;
  style?: string;
  alpha?: number;
  spacing?: number;
}

export function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  { size = 14, font = FONT.mono, color = C.ink, align = 'left', baseline = 'middle', weight = '', style = '', alpha = 1, spacing = 0 }: TextOptions = {},
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${style} ${weight} ${size}px ${font}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Board placement for a level: tile size and top-left corner.
export function layout(game: GameState): { size: number; ox: number; oy: number } {
  const size = Math.floor(Math.min(64, 900 / game.w, 400 / game.h));
  return { size, ox: Math.round((W - game.w * size) / 2), oy: Math.round(70 + (420 - game.h * size) / 2) };
}

export function drawBackground(ctx: CanvasRenderingContext2D, time: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bg);
  g.addColorStop(1, C.bgDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Slow drifting snow.
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 97.3 + time * (8 + (i % 5) * 3)) % W;
    const y = (i * 53.7 + time * (14 + (i % 7) * 2)) % H;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawTile(ctx: CanvasRenderingContext2D, t: Tile, x: number, y: number, s: number, time: number, i: number): void {
  switch (t) {
    case T.ROCK: {
      ctx.fillStyle = C.rockLo;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = C.rock;
      ctx.fillRect(x + 1, y + 1, s - 2, s - 6);
      ctx.fillStyle = C.rockHi;
      ctx.fillRect(x + 3, y + 3, s - 10, 3);
      break;
    }
    case T.SNOW:
    case T.EXIT: {
      ctx.fillStyle = C.snow;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = C.snowDot;
      for (let k = 0; k < 4; k++) ctx.fillRect(x + ((i * 7 + k * 13) % (s - 6)) + 3, y + ((i * 11 + k * 17) % (s - 6)) + 3, 2, 2);
      if (t === T.EXIT) drawExit(ctx, x + s / 2, y + s / 2, s, time);
      break;
    }
    case T.WATER: {
      ctx.fillStyle = C.water;
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = C.waterHi;
      ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const wy = y + s * (0.35 + k * 0.3);
        ctx.beginPath();
        for (let px = 0; px <= s; px += 4) ctx.lineTo(x + px, wy + Math.sin(time * 2 + px * 0.25 + i + k) * 1.6);
        ctx.stroke();
      }
      break;
    }
    default: {
      // Ice (and cracked ice): a pale tile with a diagonal sheen.
      ctx.fillStyle = C.ice;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = C.iceHi;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.15, y + s * 0.55);
      ctx.lineTo(x + s * 0.55, y + s * 0.15);
      ctx.lineTo(x + s * 0.7, y + s * 0.15);
      ctx.lineTo(x + s * 0.15, y + s * 0.7);
      ctx.fill();
      if (t === T.CRACKED) {
        ctx.strokeStyle = C.crack;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + s * 0.2, y + s * 0.3);
        ctx.lineTo(x + s * 0.45, y + s * 0.5);
        ctx.lineTo(x + s * 0.4, y + s * 0.8);
        ctx.moveTo(x + s * 0.45, y + s * 0.5);
        ctx.lineTo(x + s * 0.8, y + s * 0.42);
        ctx.moveTo(x + s * 0.6, y + s * 0.46);
        ctx.lineTo(x + s * 0.7, y + s * 0.2);
        ctx.stroke();
      }
    }
  }
}

function drawExit(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, time: number): void {
  const pulse = 1 + Math.sin(time * 3) * 0.06;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  // A small warm hut: the way out of the cold.
  ctx.fillStyle = C.warm;
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, s * 0.22);
  ctx.lineTo(-s * 0.3, -s * 0.02);
  ctx.lineTo(0, -s * 0.3);
  ctx.lineTo(s * 0.3, -s * 0.02);
  ctx.lineTo(s * 0.3, s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd59a';
  ctx.fillRect(-s * 0.08, s * 0.02, s * 0.16, s * 0.2);
  ctx.restore();
}

function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const m = s * 0.12;
  ctx.fillStyle = C.crateLo;
  ctx.fillRect(x + m, y + m, s - 2 * m, s - 2 * m);
  ctx.fillStyle = C.crate;
  ctx.fillRect(x + m + 2, y + m + 2, s - 2 * m - 4, s - 2 * m - 6);
  ctx.strokeStyle = C.crateLo;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + m + 2, y + m + 2);
  ctx.lineTo(x + s - m - 2, y + s - m - 4);
  ctx.stroke();
  ctx.fillStyle = C.frost;
  ctx.fillRect(x + m, y + m, s - 2 * m, 3);
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, face: Cell, squash: number): void {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.3;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1 + squash * 0.18, 1 - squash * 0.14);
  ctx.fillStyle = 'rgba(30,42,53,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.95, r * 0.9, r * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.scarf;
  ctx.fillRect(-r * 0.9, r * 0.15, r * 1.8, r * 0.32);
  ctx.fillRect(-face[0] * r * 0.9 - r * 0.12, r * 0.15, r * 0.24, r * 0.75);
  ctx.fillStyle = '#fff';
  const ex = face[0] * r * 0.35;
  const ey = face[1] * r * 0.3 - r * 0.25;
  ctx.beginPath();
  ctx.arc(ex - r * 0.28, ey, r * 0.16, 0, TAU);
  ctx.arc(ex + r * 0.28, ey, r * 0.16, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawBoard(ctx: CanvasRenderingContext2D, ses: Session, v: View, time: number): void {
  const g = ses.game;
  if (!g) return;
  const { size: s, ox, oy } = layout(g);
  ctx.fillStyle = 'rgba(30,42,53,0.12)';
  ctx.fillRect(ox + 6, oy + 8, g.w * s, g.h * s);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) drawTile(ctx, v.tiles[y * g.w + x] as Tile, ox + x * s, oy + y * s, s, time, y * g.w + x);
  for (const c of v.crates) drawCrate(ctx, ox + c.x * s, oy + c.y * s, s);
  drawPlayer(ctx, ox + v.player.x * s, oy + v.player.y * s, s, v.face, v.squash);
  for (const p of v.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(ox + p.x * s - p.size / 2, oy + p.y * s - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export function drawHud(ctx: CanvasRenderingContext2D, ses: Session, buttons: Button[]): void {
  const g = ses.game;
  if (!g) return;
  const L = ses.levels[ses.level];
  text(ctx, `${ses.level + 1}`, 28, 34, { size: 28, weight: 'bold', font: FONT.serif });
  text(ctx, L.name, 60, 28, { size: 18, font: FONT.serif, style: 'italic' });
  text(ctx, `moves ${g.moves}  ·  par ${L.par}`, 60, 48, { size: 12, color: C.dim });
  if (L.note && g.moves === 0) text(ctx, L.note, W / 2, H - 26, { size: 15, align: 'center', font: FONT.serif, style: 'italic', color: C.dim });
  for (const b of buttons) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(30,42,53,0.25)';
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, { size: 12, align: 'center' });
  }
}

export function drawStars(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, size: number, max = 3): void {
  for (let k = 0; k < max; k++) {
    const x = cx + (k - (max - 1) / 2) * size * 2.4;
    ctx.fillStyle = k < n ? C.warm : 'rgba(30,42,53,0.15)';
    ctx.beginPath();
    for (let j = 0; j < 10; j++) {
      const a = -Math.PI / 2 + (j * Math.PI) / 5;
      const r = j % 2 ? size * 0.45 : size;
      ctx.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawUiButton(ctx: CanvasRenderingContext2D, r: CellRect, label: string, active = false): void {
  ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.45)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = active ? C.warm : 'rgba(30,42,53,0.2)';
  ctx.lineWidth = active ? 2 : 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 12, align: 'center', color: active ? C.ink : C.dim });
}

export function drawSelect(ctx: CanvasRenderingContext2D, ses: Session, cursor: number, cells: CellRect[], time: number, ui: SelectUi): void {
  text(ctx, 'THAW', W / 2, 66, { size: 50, align: 'center', font: FONT.serif, weight: 'bold', spacing: 12 });
  text(ctx, 'slide to the hut. ice keeps you going, snow stops you.', W / 2, 104, { size: 15, align: 'center', font: FONT.serif, style: 'italic', color: C.dim });
  ui.packs.forEach((pack, i) => {
    const r = ui.packRects[i];
    if (r) drawUiButton(ctx, r, pack.name, i === ui.packIndex);
  });
  drawUiButton(ctx, ui.settingsRect, 'settings');
  if (ui.continueRect && ui.continueLabel) drawUiButton(ctx, ui.continueRect, ui.continueLabel, true);
  cells.forEach((c, i) => {
    const open = ses.unlocked(i);
    const hot = i === cursor;
    ctx.fillStyle = open ? (hot ? '#ffffff' : 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.25)';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = hot ? C.warm : 'rgba(30,42,53,0.2)';
    ctx.lineWidth = hot ? 3 : 1;
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
    text(ctx, `${i + 1}`, c.x + 14, c.y + 22, { size: 20, weight: 'bold', font: FONT.serif, color: open ? C.ink : C.dim });
    text(ctx, open ? ses.levels[i].name : 'locked', c.x + 14, c.y + 48, { size: 12, font: FONT.serif, style: 'italic', color: open ? C.ink : C.dim });
    if (open) drawStars(ctx, c.x + c.w - 36, c.y + 22, ses.progress[ses.levels[i].id] ?? 0, 6);
  });
  text(ctx, 'arrows choose · enter play · [ ] pack · c continue · o settings', W / 2, H - 22, { size: 12, align: 'center', color: C.dim, alpha: 0.7 + 0.3 * Math.sin(time * 2) });
}

export function drawWon(ctx: CanvasRenderingContext2D, ses: Session, t: number): void {
  const r = ses.result;
  if (!r) return;
  const a = Math.min(1, t * 3);
  ctx.save();
  ctx.globalAlpha = a * 0.85;
  ctx.fillStyle = '#f4f8fb';
  ctx.fillRect(W / 2 - 200, 150, 400, 230);
  ctx.restore();
  text(ctx, 'warm at last.', W / 2, 190, { size: 26, align: 'center', font: FONT.serif, style: 'italic', alpha: a });
  drawStars(ctx, W / 2, 245, Math.min(r.stars, Math.floor(t * 6)), 18);
  text(ctx, `${r.moves} moves  ·  par ${r.par}`, W / 2, 294, { size: 14, align: 'center', alpha: a });
  const last = ses.level === ses.levels.length - 1;
  text(ctx, last ? 'enter: finish  ·  r: retry' : 'enter: next  ·  r: retry  ·  esc: levels', W / 2, 346, { size: 12, align: 'center', color: C.dim, alpha: a });
}

export function drawDone(ctx: CanvasRenderingContext2D, ses: Session): void {
  const total = ses.levels.reduce((n, level) => n + (ses.progress[level.id] ?? 0), 0);
  text(ctx, 'every room thawed.', W / 2, 220, { size: 34, align: 'center', font: FONT.serif, style: 'italic' });
  text(ctx, `${total} of ${ses.levels.length * 3} stars`, W / 2, 270, { size: 16, align: 'center' });
  text(ctx, 'esc: back to the levels', W / 2, 320, { size: 12, align: 'center', color: C.dim });
}
