export const AUTH_RETURN_TO_PARAM = "next";

export function sanitizeReturnToPath(value?: string | null): string | null {
  if (!value) return null;

  const candidate = value.trim();
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;

  const blockedPrefixes = ["/login", "/register", "/admin/login"];
  if (blockedPrefixes.some((prefix) => candidate.startsWith(prefix))) {
    return null;
  }

  return candidate;
}

export function pathWithQuery(pathname: string, queryString?: string): string {
  if (!queryString) return pathname;
  return `${pathname}?${queryString}`;
}

export function buildAuthRedirect(authPath: string, currentPath: string): string {
  const safeCurrent = sanitizeReturnToPath(currentPath);
  if (!safeCurrent) return authPath;

  const delimiter = authPath.includes("?") ? "&" : "?";
  return `${authPath}${delimiter}${AUTH_RETURN_TO_PARAM}=${encodeURIComponent(safeCurrent)}`;
}