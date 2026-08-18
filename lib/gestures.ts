export type Point = { x: number; y: number };

export type TimedPoint = Point & { at: number };

export function attractionProgress(point: Point, target: Point, radius: number) {
  const distance = Math.hypot(point.x - target.x, point.y - target.y);
  const attracted = distance <= radius;

  if (attracted) return { progress: 1, attracted: true };

  const forgivingDenominator = Math.max(radius * 2, 1);
  return {
    progress: Math.max(0, 1 - (distance - radius) / forgivingDenominator),
    attracted: false,
  };
}

export function classifySwipe(start: TimedPoint, end: TimedPoint): "up" | "none" {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const upwardDistance = -dy;
  const duration = Math.max(end.at - start.at, 1);
  const upwardSpeed = upwardDistance / duration;
  const upwardDominant = upwardDistance > Math.abs(dx) * 1.35;

  if (upwardDominant && (upwardDistance >= 72 || (upwardSpeed >= 0.45 && upwardDistance >= 42))) {
    return "up";
  }

  return "none";
}
