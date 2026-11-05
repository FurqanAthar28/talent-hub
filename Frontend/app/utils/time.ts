/**
 * "Just now", "5 min ago", "Yesterday", "3 days ago", or a date like "Oct 20".
 * Recent things are easier to read as "how long ago".
 */
export function formatRelativeTime(value: string, now: Date = new Date()): string {
  const seconds = Math.floor((now.getTime() - new Date(value).getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

/** "Good morning" / "Good afternoon" / "Good evening", from the user's own clock. */
export function greetingForTime(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
