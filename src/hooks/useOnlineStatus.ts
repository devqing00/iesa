'use client';

import { useEffect, useSyncExternalStore } from 'react';

/* ─── Online / Offline status hook ──────────────────────────────
 *  Uses useSyncExternalStore for SSR-safe, concurrent-ready status.
 *  Returns `true` when the browser is online.
 */

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // Assume online during SSR
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
