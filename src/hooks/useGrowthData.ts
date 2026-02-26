'use client';

/**
 * useGrowthData<T> — Drop-in replacement for localStorage-backed growth tool state.
 *
 * On mount:
 *   1. Instantly restores from localStorage (for fast paint).
 *   2. Fetches from API in the background.
 *      - If API has data → updates state + localStorage cache.
 *      - If API has no data but localStorage does → silently migrates to API.
 *
 * On setData:
 *   1. Updates React state immediately.
 *   2. Writes to localStorage synchronously (so a refresh never loses data).
 *   3. Debounces an API save (800 ms).
 *
 * Usage:
 *   const [habits, setHabits, loading] = useGrowthData<Habit[]>('habits', 'iesa-habits-data', []);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getGrowthData, saveGrowthData, type GrowthTool } from '@/lib/api/growth';

const DEBOUNCE_MS = 800;

function readLS<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Plain string value (e.g. grading system "4.0")
      return raw as unknown as T;
    }
  } catch {
    return undefined;
  }
}

function writeLS<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded, etc. */ }
}

export function useGrowthData<T>(
  tool: GrowthTool,
  localStorageKey: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  // Instant restore from localStorage
  const [data, setDataInternal] = useState<T>(() => {
    return readLS<T>(localStorageKey) ?? initialValue;
  });

  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestRef = useRef<T>(data);
  const loadedRef = useRef(false);

  // ── API load (once) ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await getGrowthData<T>(tool);
        if (cancelled) return;

        if (res.data !== null && res.data !== undefined) {
          // API has data → use it as source of truth
          setDataInternal(res.data);
          latestRef.current = res.data;
          writeLS(localStorageKey, res.data);
        } else {
          // API empty → migrate localStorage data silently
          const local = readLS<T>(localStorageKey);
          if (local !== undefined) {
            saveGrowthData(tool, local).catch(() => {});
          }
        }
      } catch {
        // Network failure — localStorage data is already loaded
      } finally {
        if (!cancelled) {
          setLoading(false);
          loadedRef.current = true;
        }
      }
    })();

    return () => { cancelled = true; };
    // Only run once per tool
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // ── Debounced API save ──────────────────────────────────────
  const syncToApi = useCallback(
    (value: T) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveGrowthData(tool, value).catch(() => {});
      }, DEBOUNCE_MS);
    },
    [tool],
  );

  // ── Public setter ───────────────────────────────────────────
  const setData = useCallback(
    (value: T | ((prev: T) => T)) => {
      setDataInternal((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        latestRef.current = next;
        writeLS(localStorageKey, next);
        if (loadedRef.current) syncToApi(next);
        return next;
      });
    },
    [localStorageKey, syncToApi],
  );

  // ── Flush on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // Fire final save
        saveGrowthData(tool, latestRef.current).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  return [data, setData, loading];
}
