/**
 * IndexedDB-based blob cache for Drive files.
 *
 * Stores raw file blobs so subsequent opens skip the network download entirely.
 * Users who have opened a PDF once will load it instantly on subsequent visits
 * (and can read it even when on a slow connection, as long as the app itself loaded).
 *
 * TTL: 7 days. Cache entries are evicted lazily on access.
 * Storage: uses browsers IndexedDB — no service worker required.
 */

const DB_NAME = "iesa_drive_cache";
const STORE_NAME = "files";
const DB_VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  fileId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  cachedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "fileId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Returns the cached blob for a file, or null if not cached / expired. */
export async function getCachedFile(fileId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(fileId);
      req.onsuccess = () => {
        const entry: CacheEntry | undefined = req.result;
        if (!entry) return resolve(null);
        // Lazy TTL eviction
        if (Date.now() - entry.cachedAt > TTL_MS) {
          const delTx = db.transaction(STORE_NAME, "readwrite");
          delTx.objectStore(STORE_NAME).delete(fileId);
          return resolve(null);
        }
        resolve(entry.blob);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Stores a file blob in the cache. Silently fails if storage is full. */
export async function cacheFile(
  fileId: string,
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const entry: CacheEntry = {
        fileId,
        blob,
        fileName,
        mimeType,
        cachedAt: Date.now(),
      };
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently fail — user is unaffected, just won't have offline copy
  }
}

/** Returns true if a non-expired cache entry exists for the file. */
export async function isFileCached(fileId: string): Promise<boolean> {
  const blob = await getCachedFile(fileId);
  return blob !== null;
}

/** Removes a specific file from the cache. */
export async function evictCachedFile(fileId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Best-effort
    });
  } catch {
    // ignore
  }
}
