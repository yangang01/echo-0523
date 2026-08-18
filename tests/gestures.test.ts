import { attractionProgress, classifySwipe } from "../lib/gestures";

test("attraction is zero for a far point and complete for a near point", () => {
  expect(attractionProgress({ x: 20, y: 20 }, { x: 120, y: 80 }, 36)).toEqual({ progress: 0, attracted: false });
  expect(attractionProgress({ x: 101, y: 68 }, { x: 120, y: 80 }, 36)).toEqual({ progress: 1, attracted: true });
});

test("attraction includes the radius boundary and forgives points beyond it", () => {
  expect(attractionProgress({ x: 36, y: 0 }, { x: 0, y: 0 }, 36)).toEqual({ progress: 1, attracted: true });
  expect(attractionProgress({ x: 54, y: 0 }, { x: 0, y: 0 }, 36)).toEqual({ progress: 0.75, attracted: false });
});

test("attraction guards a zero radius denominator", () => {
  expect(attractionProgress({ x: 1, y: 0 }, { x: 0, y: 0 }, 0)).toEqual({ progress: 0.5, attracted: false });
});

test("classifies a long upward swipe", () => {
  expect(classifySwipe({ x: 20, y: 160, at: 100 }, { x: 36, y: 80, at: 500 })).toBe("up");
});

test("classifies a fast upward swipe of at least 42 pixels", () => {
  expect(classifySwipe({ x: 20, y: 100, at: 0 }, { x: 24, y: 55, at: 80 })).toBe("up");
});

test("rejects horizontal, downward, and short slow gestures", () => {
  expect(classifySwipe({ x: 20, y: 100, at: 0 }, { x: 110, y: 80, at: 100 })).toBe("none");
  expect(classifySwipe({ x: 20, y: 80, at: 0 }, { x: 20, y: 150, at: 100 })).toBe("none");
  expect(classifySwipe({ x: 20, y: 100, at: 0 }, { x: 22, y: 65, at: 400 })).toBe("none");
});
