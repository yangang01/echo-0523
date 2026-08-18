import { initialQuality, lowerQuality, particleBudget, qualityProfiles } from "../lib/quality";

test("quality selects conservatively and steps down without underflow", () => {
  expect(initialQuality({ deviceMemory: 2, cores: 2, reducedMotion: false })).toBe("low");
  expect(lowerQuality("high")).toBe("medium");
  expect(lowerQuality("low")).toBe("low");
});

test("quality profiles preserve budgets while reducing bloom and geometry cost", () => {
  expect(qualityProfiles).toEqual({
    high: { particles: 32000, bloomScale: 1, gravityCoreSegments: 3 },
    medium: { particles: 18000, bloomScale: 0.72, gravityCoreSegments: 3 },
    low: { particles: 7000, bloomScale: 0, gravityCoreSegments: 2 },
  });
  expect(particleBudget).toEqual({ high: 32000, medium: 18000, low: 7000 });
  expect(qualityProfiles.high.particles).toBeGreaterThan(qualityProfiles.medium.particles);
  expect(qualityProfiles.medium.particles).toBeGreaterThan(qualityProfiles.low.particles);
  expect(qualityProfiles.high.bloomScale).toBeGreaterThan(qualityProfiles.medium.bloomScale);
  expect(qualityProfiles.medium.bloomScale).toBeGreaterThan(qualityProfiles.low.bloomScale);
  expect(qualityProfiles.low.bloomScale).toBe(0);
  Object.values(qualityProfiles).forEach(({ gravityCoreSegments }) => expect(gravityCoreSegments).toBeGreaterThan(0));
});
