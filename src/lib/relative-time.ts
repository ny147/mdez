export function formatRelativeTime(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp) || timestamp > now) {
    return "recently";
  }

  const elapsed = now - timestamp;
  const diffMinutes = Math.max(1, Math.floor(elapsed / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(elapsed / 3_600_000);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(elapsed / 86_400_000);
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}
