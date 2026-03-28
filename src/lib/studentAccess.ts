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
export function isExternalStudent(
  department?: string | null,
  externalFlag?: boolean | null,
): boolean {
  if (externalFlag === true) return true;

  const normalized = (department || "").trim().toLowerCase();
  if (!normalized) return false;

  return normalized !== IPE_DEPARTMENT.toLowerCase();
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
  "/dashboard/cohort",
  "/dashboard/class-rep",
  "/dashboard/team-head",
  "/dashboard/freshers",
  "/dashboard/iepod/manage",
]);

/**
 * Check if a user should see the "Switch to Admin" button.
 * Admin entry is explicitly gated by admin:dashboard permission.
 */
export function hasAdminAccess(
  role?: string | null,
  permissions: string[] = [],
): boolean {
  void role;
  return permissions.includes("admin:dashboard");
}
