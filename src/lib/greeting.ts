/**
 * Time-aware greeting utility
 *
 * Returns a contextual greeting based on the current hour.
 * Finer-grained than a simple morning/afternoon/evening split.
 */

export function getTimeGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 5) return "Happy late night";
  if (hour < 8) return "Good early morning";
  if (hour < 12) return "Good morning";
  if (hour < 14) return "Good afternoon";
  if (hour < 17) return "Hope your day's going well";
  if (hour < 19) return "Good evening";
  if (hour < 22) return "Good evening";
  return "Happy late night";
}
