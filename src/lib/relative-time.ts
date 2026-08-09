export function formatRelativeTime(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp) || timestamp > now) {
    return "recently";
  }

  const diffMinutes = Math.max(1, Math.round((now - timestamp) / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}
