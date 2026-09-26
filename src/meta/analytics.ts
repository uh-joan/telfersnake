/**
 * Anonymous, aggregate analytics. Tiny beacons — "a game started", "a run ended with this
 * score/size", "the Common was unlocked" — go to the game's own server (`POST /a`), which keeps
 * only totals. Nothing here identifies a child: no names, no device ids, no cookies. It is
 * fire-and-forget and wrapped in try/catch, so it can never get in the way of playing.
 */

// In production the game is served by the same origin as the server, so a relative path is right.
// In dev the game runs on Vite while the server is on :8787, so aim the beacon straight at it.
const URL = import.meta.env.DEV ? `http://${location.hostname}:8787/a` : '/a';

export function track(type: string, data: Record<string, unknown> = {}): void {
  try {
    const body = JSON.stringify({ t: type, ...data });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(URL, body);
      return;
    }
    void fetch(URL, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
  } catch {
    /* analytics must never break the game */
  }
}

/**
 * Has this browser played on an earlier day? A single yes/no, worked out from a first-seen date kept
 * only in this browser — the date never leaves the device, just the boolean does. Not an identifier.
 */
export function returningPlayer(): boolean {
  try {
    const key = 'telfersnake.first';
    const today = new Date().toISOString().slice(0, 10);
    const first = localStorage.getItem(key);
    if (!first) {
      localStorage.setItem(key, today);
      return false;
    }
    return first < today;
  } catch {
    return false;
  }
}
