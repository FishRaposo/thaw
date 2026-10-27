// localStorage can be missing or throw (private windows, sandboxed iframes, blocked site data).
// The game must run the same without it, so every access is guarded.

const KEY = 'thaw.progress.v1';

export function loadProgress() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* not persisted this session */
  }
}
