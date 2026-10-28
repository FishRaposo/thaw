export {};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    __thaw: unknown;
  }
}
