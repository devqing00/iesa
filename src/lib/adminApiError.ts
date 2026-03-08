/**
 * Centralised error helpers for admin pages.
 *
 * • throwApiError  – call after a failed fetch; reads the response body once
 *                    and throws an Error with a user-friendly message.
 * • getErrorMessage – use in catch blocks to extract the message from any
 *                    caught value, with a safe fallback.
 */

/**
 * Reads a failed Response and throws an Error with a contextual message.
 *
 * 403 → "Permission denied — you don't have permission to <action>"
 * 404 → "<Action> — not found"
 * Other → server detail string, or "<Action> failed (HTTP <status>)"
 *
 * MUST be awaited — it reads the response body.
 */
export async function throwApiError(
  res: Response,
  action: string,
): Promise<never> {
  let detail = "";

  try {
    const body = await res.json();
    detail = typeof body?.detail === "string" ? body.detail : "";
  } catch {
    // body wasn't JSON — ignore
  }

  if (res.status === 403) {
    throw new Error(
      detail || `Permission denied — you don't have permission to ${action}`,
    );
  }

  if (res.status === 404) {
    throw new Error(detail || `${capitalize(action)} — not found`);
  }

  throw new Error(
    detail || `${capitalize(action)} failed (HTTP ${res.status})`,
  );
}

/**
 * Safely extract an error message from an unknown caught value.
 *
 * Covers Error instances, plain strings, and arbitrary objects.
 * Returns the fallback when the caught value has no usable message.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}

/* ── internal ─────────────────────────────────────────────── */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
