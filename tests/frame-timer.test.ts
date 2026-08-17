import { createFrameTimer } from "../lib/frame-timer";

test("frame timer advances with a capped delta without deprecated Three clock", () => {
  const timer = createFrameTimer(1000);
  expect(timer.tick(1016)).toEqual({ delta: 0.016, elapsed: 0.016 });
  expect(timer.tick(1216)).toEqual({ delta: 0.05, elapsed: 0.066 });
});
