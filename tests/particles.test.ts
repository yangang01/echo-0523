import { echoCoreTargets, infinityTargets } from "../lib/particles";

test("particle targets are deterministic and finite", () => {
  expect(echoCoreTargets(512, 523)).toEqual(echoCoreTargets(512, 523));
  expect(echoCoreTargets(512, 523)).toHaveLength(1536);
  expect(echoCoreTargets(512, 523).every(Number.isFinite)).toBe(true);
});

test("infinity targets contain one xyz triplet per particle", () => {
  expect(infinityTargets(100)).toHaveLength(300);
});
