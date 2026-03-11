/**
 * Time-aware greeting utility
 *
 * Returns a contextual greeting based on the current hour.
 * Finer-grained than a simple morning/afternoon/evening split.
 *
 * When `isBirthday` is true, returns a birthday-themed greeting
 * that still acknowledges the time of day.
 */

export function getTimeGreeting(isBirthday = false): string {
  const hour = new Date().getHours();

  if (isBirthday) {
    if (hour < 12) return "Happy Birthday! Good morning";
    if (hour < 17) return "Happy Birthday! Hope your day's amazing";
    return "Happy Birthday! Hope your day's been great";
  }

  if (hour < 5) return "Happy late night";
  if (hour < 8) return "Good early morning";
  if (hour < 12) return "Good morning";
  if (hour < 14) return "Good afternoon";
  if (hour < 17) return "Hope your day's going well";
  if (hour < 19) return "Good evening";
  if (hour < 22) return "Good evening";
  return "Happy late night";
}
