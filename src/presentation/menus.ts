// Accessible DOM menus for pause and settings. The canvas keeps the gameplay surface; dialogs
// carry focus, labels and announcements so keyboard and screen-reader users can operate them.

import type { Settings } from '../platform/settings.ts';

export interface SettingsHandlers {
  onChange: (settings: Settings) => void;
  onFullscreen: () => void;
}

export interface PauseHandlers extends SettingsHandlers {
  onResume: () => void;
  onLevels: () => void;
}

export class Menus {
  root: HTMLElement;
  announcer: HTMLElement;
  dialog: HTMLDialogElement | null = null;
  returnFocus: HTMLElement | null = null;

  constructor(root: HTMLElement, announcer: HTMLElement) {
    this.root = root;
    this.announcer = announcer;
  }

  get isOpen(): boolean {
    return this.dialog?.open === true;
  }

  announce(text: string): void {
    this.announcer.textContent = text;
  }

  close(): void {
    if (this.dialog?.open) this.dialog.close();
  }

  private settingsFields(settings: Settings, handlers: SettingsHandlers): DocumentFragment {
    const frag = document.createDocumentFragment();

    const volumeRow = document.createElement('label');
    volumeRow.className = 'row';
    volumeRow.htmlFor = 'thaw-volume';
    volumeRow.textContent = 'Volume';
    const volume = document.createElement('input');
    volume.id = 'thaw-volume';
    volume.type = 'range';
    volume.min = '0';
    volume.max = '100';
    volume.step = '5';
    volume.value = String(Math.round(settings.volume * 100));
    volume.addEventListener('input', () => handlers.onChange({ ...settings, volume: Number(volume.value) / 100 }));
    volumeRow.append(volume);

    const muteRow = document.createElement('label');
    muteRow.className = 'row';
    muteRow.htmlFor = 'thaw-mute';
    muteRow.textContent = 'Mute';
    const mute = document.createElement('input');
    mute.id = 'thaw-mute';
    mute.type = 'checkbox';
    mute.checked = settings.muted;
    mute.addEventListener('change', () => handlers.onChange({ ...settings, muted: mute.checked }));
    muteRow.append(mute);

    const motionRow = document.createElement('label');
    motionRow.className = 'row';
    motionRow.htmlFor = 'thaw-reduced';
    motionRow.textContent = 'Reduce motion';
    const motion = document.createElement('input');
    motion.id = 'thaw-reduced';
    motion.type = 'checkbox';
    motion.checked = settings.reducedMotion;
    motion.addEventListener('change', () => handlers.onChange({ ...settings, reducedMotion: motion.checked }));
    motionRow.append(motion);

    const full = document.createElement('button');
    full.type = 'button';
    full.textContent = 'Fullscreen';
    full.addEventListener('click', handlers.onFullscreen);

    frag.append(volumeRow, muteRow, motionRow, full);
    return frag;
  }

  private open(title: string, body: Node, actions: HTMLElement[], onClose?: () => void): void {
    this.close();
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'thaw-menu-title');
    const heading = document.createElement('h2');
    heading.id = 'thaw-menu-title';
    heading.textContent = title;
    const content = document.createElement('div');
    content.append(body);
    const bar = document.createElement('div');
    bar.className = 'actions';
    for (const action of actions) bar.append(action);
    dialog.append(heading, content, bar);
    dialog.addEventListener('close', () => {
      dialog.remove();
      this.dialog = null;
      this.returnFocus?.focus();
      onClose?.();
    });
    this.root.append(dialog);
    this.dialog = dialog;
    dialog.showModal();
  }

  openPause(settings: Settings, handlers: PauseHandlers): void {
    const resume = document.createElement('button');
    resume.type = 'button';
    resume.textContent = 'Resume';
    resume.addEventListener('click', () => {
      this.close();
      handlers.onResume();
    });

    const levels = document.createElement('button');
    levels.type = 'button';
    levels.textContent = 'Levels';
    levels.addEventListener('click', () => {
      this.close();
      handlers.onLevels();
    });

    const body = document.createElement('div');
    body.append(this.settingsFields(settings, handlers));
    this.open('Paused', body, [resume, levels], handlers.onResume);
  }

  openSettings(settings: Settings, handlers: SettingsHandlers, onClose?: () => void): void {
    const body = document.createElement('div');
    body.append(this.settingsFields(settings, handlers));
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.close());
    this.open('Settings', body, [close], onClose);
  }
}
