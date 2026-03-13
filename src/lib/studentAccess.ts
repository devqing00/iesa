/**
 * Student Access Control — Department-based access helpers
 *
 * External students (non-IPE department) have a restricted dashboard:
 * Announcements, IEPOD, Growth Hub, Profile, Settings only.
 *
 * IPE students see everything — the full IESA experience.
 */

/** The canonical department name for in-house (IPE) students. */
export const IPE_DEPARTMENT = "Industrial Engineering";

/** Check if a student is from an external department. */
export function isExternalStudent(department?: string | null): boolean {
  if (!department) return false;
  return department !== IPE_DEPARTMENT;
}

/**
 * Route prefixes that external students are allowed to access.
 * Exact match on `/dashboard` (overview), prefix match on everything else.
 */
export const EXTERNAL_ALLOWED_ROUTES = [
  "/dashboard",             // overview (tailored)
  "/dashboard/announcements",
  "/dashboard/iepod",
  "/dashboard/growth",
  "/dashboard/profile",
  "/dashboard/settings",
] as const;

/** Check if a given pathname is allowed for external students. */
export function isRouteAllowedForExternal(pathname: string): boolean {
  for (const route of EXTERNAL_ALLOWED_ROUTES) {
    if (route === "/dashboard") {
      // Exact match only — don't match /dashboard/payments etc.
      if (pathname === "/dashboard") return true;
    } else {
      if (pathname === route || pathname.startsWith(route + "/")) return true;
    }
  }
  return false;
}

/**
 * Sidebar / MobileNav link hrefs that external students should NOT see.
 * Everything outside EXTERNAL_ALLOWED_ROUTES is hidden.
 */
export const EXTERNAL_HIDDEN_HREFS = new Set([
  "/dashboard/events",
  "/dashboard/resources",
  "/dashboard/drive",
  "/dashboard/timetable",
  "/dashboard/hubs",
  "/dashboard/teams",
  "/dashboard/payments",
  "/dashboard/iesa-ai",
  "/dashboard/press",
  "/dashboard/team",
  "/dashboard/timp",
  "/dashboard/timp/manage",
  "/dashboard/ticket",
  "/dashboard/applications",
  "/dashboard/archive",
  "/dashboard/receipt",
  "/dashboard/calendar",
  "/dashboard/messages",
  "/dashboard/class-rep",
  "/dashboard/team-head",
  "/dashboard/freshers",
  "/dashboard/iepod/manage",
]);

/**
 * Permissions that are "student-level" — committee members, press members etc.
 * get these but they do NOT grant admin dashboard access.
 * Mirrors the set in (admin)/layout.tsx.
 */
export const STUDENT_ONLY_PERMISSIONS = new Set([
  "announcement:view",
  "event:view",
  "press:access",
  "press:create",
  "press:edit",
  "resource:view",
  "resource:create",
]);

const PORTAL_ONLY_PERMISSION_PREFIXES = [
  "class_rep:",
  "team_head:",
  "timp:",
  "iepod:",
  "freshers:",
];

const PORTAL_ONLY_PERMISSION_EXACT = new Set([
  "announcement:create",
  "announcement:edit",
  "announcement:delete",
  "event:create",
  "event:edit",
  "event:manage",
  "payment:view_all",
  "timetable:view",
]);

/**
 * Check if a user should see the "Switch to Admin" button.
 * Requires admin/exco role OR at least one permission that goes
 * beyond basic student-level view/access.
 */
export function hasAdminAccess(
  role?: string | null,
  permissions: string[] = [],
): boolean {
  if (role === "admin" || role === "exco") return true;

  const elevated = permissions.filter((p) => !STUDENT_ONLY_PERMISSIONS.has(p));
  if (elevated.length === 0) return false;

  return elevated.some((permission) => {
    if (PORTAL_ONLY_PERMISSION_EXACT.has(permission)) return false;
    if (PORTAL_ONLY_PERMISSION_PREFIXES.some((prefix) => permission.startsWith(prefix))) return false;
    return true;
  });
}
