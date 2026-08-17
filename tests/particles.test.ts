import * as particles from "../lib/particles";
import { sceneOrder } from "../lib/experience";

const { echoCoreTargets, infinityTargets } = particles;

test("particle targets are deterministic and finite", () => {
  expect(echoCoreTargets(512, 523)).toEqual(echoCoreTargets(512, 523));
  expect(echoCoreTargets(512, 523)).toHaveLength(1536);
  expect(echoCoreTargets(512, 523).every(Number.isFinite)).toBe(true);
});

test("infinity targets contain one xyz triplet per particle", () => {
  expect(infinityTargets(100)).toHaveLength(300);
});

test("all eight chapters have materially different particle sculptures", () => {
  const sceneParticleTargets = (particles as typeof particles & {
    sceneParticleTargets?: (scene: (typeof sceneOrder)[number], count: number) => number[];
  }).sceneParticleTargets;

  expect(sceneParticleTargets).toBeTypeOf("function");
  const signatures = sceneOrder.map((scene) =>
    sceneParticleTargets!(scene, 24)
      .slice(0, 24)
      .map((value) => value.toFixed(3))
      .join(","),
  );
  expect(new Set(signatures).size).toBe(sceneOrder.length);
});
