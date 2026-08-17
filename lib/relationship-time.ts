const CONFESSION_MS = new Date("2026-05-23T00:00:00+08:00").getTime();

export function elapsedSinceConfession(now = new Date()) {
  let remaining = Math.max(0, now.getTime() - CONFESSION_MS);
  const days = Math.floor(remaining / 86_400_000);
  remaining -= days * 86_400_000;
  const hours = Math.floor(remaining / 3_600_000);
  remaining -= hours * 3_600_000;
  const minutes = Math.floor(remaining / 60_000);
  remaining -= minutes * 60_000;
  return { days, hours, minutes, seconds: Math.floor(remaining / 1_000) };
}
