const MAX_TIMEOUT_MS = 2_147_483_647;

export function isShareExpired(expiresAt: string | null, now = Date.now()): boolean {
  if (expiresAt === null) return false;
  const deadline = Date.parse(expiresAt);
  return !Number.isFinite(deadline) || deadline <= now;
}

export function watchShareExpiration(
  expiresAt: string | null,
  onExpire: () => void
): () => void {
  if (expiresAt === null) return () => undefined;

  const deadline = Date.parse(expiresAt);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function stop() {
    if (stopped) return;
    stopped = true;
    if (timeout !== undefined) clearTimeout(timeout);
    window.removeEventListener("focus", check);
    window.removeEventListener("pageshow", check);
    document.removeEventListener("visibilitychange", checkWhenVisible);
  }

  function check() {
    if (stopped) return;
    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      stop();
      onExpire();
      return;
    }
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = setTimeout(check, Math.min(deadline - Date.now(), MAX_TIMEOUT_MS));
  }

  function checkWhenVisible() {
    if (document.visibilityState === "visible") check();
  }

  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
  document.addEventListener("visibilitychange", checkWhenVisible);
  check();

  return stop;
}
