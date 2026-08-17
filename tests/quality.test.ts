import { initialQuality, lowerQuality } from "../lib/quality";

test("quality selects conservatively and steps down without underflow", () => {
  expect(initialQuality({ deviceMemory: 2, cores: 2, reducedMotion: false })).toBe("low");
  expect(lowerQuality("high")).toBe("medium");
  expect(lowerQuality("low")).toBe("low");
});
