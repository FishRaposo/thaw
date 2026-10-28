// Player settings. Persisted separately from progress and saves; every read is guarded.

export interface Settings {
  version: 1;
  volume: number; // 0..1
  muted: boolean;
  reducedMotion: boolean;
}

const KEY = 'thaw.settings.v1';
const LEGACY_MUTE_KEY = 'thaw.muted.v1';

export function defaultSettings(): Settings {
  let reduced = false;
  try {
    reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* no matchMedia: keep motion */
  }
  return { version: 1, volume: 0.5, muted: false, reducedMotion: reduced };
}

export function loadSettings(): Settings {
  const fallback = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') {
      const legacyMuted = localStorage.getItem(LEGACY_MUTE_KEY) === '1';
      return { ...fallback, muted: legacyMuted };
    }
    const s = v as Partial<Settings>;
    return {
      version: 1,
      volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.max(0, Math.min(1, s.volume)) : fallback.volume,
      muted: typeof s.muted === 'boolean' ? s.muted : fallback.muted,
      reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : fallback.reducedMotion,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* not persisted this session */
  }
}
