export function createFrameTimer(startMs: number) {
  let previous = startMs;
  let elapsed = 0;
  return {
    reset(nowMs: number) {
      previous = nowMs;
    },
    tick(nowMs: number) {
      const delta = Math.min(Math.max(0, (nowMs - previous) / 1000), 0.05);
      previous = nowMs;
      elapsed += delta;
      return { delta, elapsed };
    },
  };
}
