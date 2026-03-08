/**
 * Admin API Error Handling
 *
 * Shared utility for admin page fetch calls.
 * Extracts 403 → "Permission denied" and other HTTP error details
 * so admin pages never show a generic "Failed to..." toast.
 */

/**
 * Parse an API Response that is NOT ok and throw an Error with a
 * user-friendly message.
 *
 * - 403 → "Permission denied — you don't have permission to <action>."
 * - 401 → "Session expired — please log in again."
 * - 404 → "Not found — <backend detail or fallback>."
 * - 409 → "Conflict — <backend detail or fallback>."
 * - Other → "<fallback> — <backend detail or status text>."
 *
 * @param res     The non-ok `Response` object from `fetch()`
 * @param action  Human-readable action being attempted (e.g. "create announcement")
 */
export async function throwApiError(res: Response, action: string): Promise<never> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body.detail || body.message || "";
  } catch {
    detail = res.statusText || "";
  }

  if (res.status === 403) {
    throw new Error(`Permission denied — you don't have permission to ${action}.`);
  }
  if (res.status === 401) {
    throw new Error("Session expired — please log in again.");
  }
  if (res.status === 404) {
    throw new Error(detail ? `Not found — ${detail}` : `Not found — could not ${action}.`);
  }
  if (res.status === 409) {
    throw new Error(detail ? `Conflict — ${detail}` : `Conflict — could not ${action}.`);
  }
  // Fallback for 4xx / 5xx
  throw new Error(detail || `Failed to ${action}`);
}

/**
 * Extract a user-friendly message from an error caught in a catch block.
 */
export function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  return fallback;
}
