import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadProgress,
  loadLegacyProgress,
  saveProgress,
  loadSave,
  saveRun,
  clearSave,
} from '../src/platform/storage.ts';
import type { RunSave } from '../src/platform/storage.ts';
import { loadSettings, saveSettings, defaultSettings } from '../src/platform/settings.ts';

class MemoryStorage {
  data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
}

function installStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  (globalThis as { localStorage: Storage }).localStorage = storage as unknown as Storage;
  return storage;
}

test('progress round-trips and clamps stars', () => {
  const storage = installStorage();
  saveProgress({ 'long-thaw': { glide: 3, crossing: 9 } });
  const loaded = loadProgress();
  assert.deepEqual(loaded, { 'long-thaw': { glide: 3, crossing: 3 } });
  assert.ok(storage.getItem('thaw.progress.v2'));
});

test('legacy index-keyed progress is readable', () => {
  installStorage().setItem('thaw.progress.v1', JSON.stringify({ 0: 3, 2: 1 }));
  assert.deepEqual(loadLegacyProgress(), { 0: 3, 2: 1 });
});

test('corrupt progress is discarded', () => {
  installStorage().setItem('thaw.progress.v2', '{');
  assert.equal(loadProgress(), null);
});

test('a run save round-trips and clears', () => {
  installStorage();
  const save: RunSave = {
    version: 1,
    packId: 'long-thaw',
    levelId: 'glide',
    levelIndex: 0,
    tiles: Array.from({ length: 40 }, () => 1),
    player: { x: 1, y: 1 },
    crates: [],
    moves: 2,
    savedAt: 123,
  };
  saveRun(save);
  assert.deepEqual(loadSave(), save);
  clearSave();
  assert.equal(loadSave(), null);
});

test('an invalid save is discarded', () => {
  const storage = installStorage();
  storage.setItem('thaw.save.v1', JSON.stringify({ version: 1, packId: 'x', levelId: 'y', levelIndex: 0, tiles: [99], player: { x: 0, y: 0 }, crates: [], moves: 0 }));
  assert.equal(loadSave(), null);
  storage.setItem('thaw.save.v1', JSON.stringify({ version: 2 }));
  assert.equal(loadSave(), null);
});

test('settings round-trip and fall back safely', () => {
  const storage = installStorage();
  saveSettings({ version: 1, volume: 0.2, muted: true, reducedMotion: true });
  assert.deepEqual(loadSettings(), { version: 1, volume: 0.2, muted: true, reducedMotion: true });
  storage.setItem('thaw.settings.v1', '{');
  const fallback = loadSettings();
  assert.equal(fallback.version, 1);
  assert.equal(fallback.volume, defaultSettings().volume);
});

test('legacy mute preference migrates into settings', () => {
  const storage = installStorage();
  storage.setItem('thaw.muted.v1', '1');
  assert.equal(loadSettings().muted, true);
});
