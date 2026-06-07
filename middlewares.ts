const lastAction = new Map<number, number>();

export function isFlood(userId: number, limitMs = 800): boolean {
  const now = Date.now();
  const last = lastAction.get(userId) ?? 0;
  if (now - last < limitMs) return true;
  lastAction.set(userId, now);
  return false;
}

// Clean up old entries every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [uid, ts] of lastAction.entries()) {
    if (now - ts > 60000) lastAction.delete(uid);
  }
}, 5 * 60 * 1000);
