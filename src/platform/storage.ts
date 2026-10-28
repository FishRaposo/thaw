// localStorage can be missing or throw (private windows, sandboxed iframes, blocked site data).
// The game must run the same without it, so every access is guarded.

import type { Progress } from '../core/types.ts';

const PROGRESS_KEY = 'thaw.progress.v2';
const LEGACY_PROGRESS_KEY = 'thaw.progress.v1';
const SAVE_KEY = 'thaw.save.v1';

export interface RunSave {
  version: 1;
  packId: string;
  levelId: string;
  levelIndex: number;
  tiles: number[];
  player: { x: number; y: number };
  crates: number[];
  moves: number;
  savedAt: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function loadProgress(): Progress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!isObject(parsed)) return null;
    const out: Progress = {};
    for (const [packId, levels] of Object.entries(parsed)) {
      if (!isObject(levels)) continue;
      const clean: Record<string, number> = {};
      for (const [levelId, stars] of Object.entries(levels)) {
        if (typeof stars === 'number' && Number.isFinite(stars)) clean[levelId] = Math.max(0, Math.min(3, Math.round(stars)));
      }
      out[packId] = clean;
    }
    return out;
  } catch {
    return null;
  }
}

// Old index-keyed progress. The caller maps the indexes to the core pack's stable room ids.
export function loadLegacyProgress(): Record<number, number> | null {
  try {
    const raw = localStorage.getItem(LEGACY_PROGRESS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!isObject(parsed)) return null;
    const out: Record<number, number> = {};
    for (const [key, stars] of Object.entries(parsed)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && typeof stars === 'number' && Number.isFinite(stars)) {
        out[index] = Math.max(0, Math.min(3, Math.round(stars)));
      }
    }
    return out;
  } catch {
    return null;
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* not persisted this session */
  }
}

export function loadSave(): RunSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!isObject(v) || v.version !== 1) return null;
    if (typeof v.packId !== 'string' || typeof v.levelId !== 'string') return null;
    if (!Number.isInteger(v.levelIndex) || (v.levelIndex as number) < 0) return null;
    if (!Array.isArray(v.tiles) || v.tiles.length === 0 || !v.tiles.every((t) => Number.isInteger(t) && t >= 0 && t <= 5)) return null;
    if (!isObject(v.player) || typeof v.player.x !== 'number' || typeof v.player.y !== 'number') return null;
    if (!Array.isArray(v.crates) || !v.crates.every((c) => Number.isInteger(c) && c >= 0)) return null;
    if (typeof v.moves !== 'number' || !Number.isFinite(v.moves)) return null;
    return {
      version: 1,
      packId: v.packId,
      levelId: v.levelId,
      levelIndex: v.levelIndex as number,
      tiles: v.tiles as number[],
      player: { x: v.player.x, y: v.player.y },
      crates: v.crates as number[],
      moves: v.moves,
      savedAt: typeof v.savedAt === 'number' ? v.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveRun(save: RunSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* not persisted this session */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
