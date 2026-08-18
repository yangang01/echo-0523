import * as particles from "../lib/particles";
import { sceneOrder } from "../lib/experience";

const { echoCoreTargets, infinityTargets } = particles;
type Scene = (typeof sceneOrder)[number];
type TargetMode = "entry" | "present" | "exit";

const advancedParticles = particles as typeof particles & {
  sceneParticleTargets?: (scene: Scene, count: number, mode?: TargetMode) => number[];
  sceneGravityAnchors?: (scene: Scene) => { y: [number, number, number]; u: [number, number, number] };
  transitionParticleTargets?: (from: Scene, to: Scene, count: number) => { exit: number[]; entry: number[] };
};

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

test("the finale infinity sculpture stays front-facing", () => {
  const sceneRotationY = (particles as typeof particles & {
    sceneRotationY?: (scene: (typeof sceneOrder)[number], elapsed: number, pointerX: number) => number;
  }).sceneRotationY;

  expect(sceneRotationY).toBeTypeOf("function");
  expect(sceneRotationY!("finale", 83, 0)).toBe(0);
  expect(sceneRotationY!("game", 10, 0)).not.toBe(0);
});

test("the finale disables depth-axis shader spin", () => {
  const sceneSpinFactor = (particles as typeof particles & {
    sceneSpinFactor?: (scene: (typeof sceneOrder)[number]) => number;
  }).sceneSpinFactor;

  expect(sceneSpinFactor).toBeTypeOf("function");
  expect(sceneSpinFactor!("finale")).toBe(0);
  expect(sceneSpinFactor!("game")).toBe(1);
});

test("scene gravity anchors provide the exact distinct twin targets without shared mutable tuples", () => {
  const sceneGravityAnchors = advancedParticles.sceneGravityAnchors;
  expect(sceneGravityAnchors).toBeTypeOf("function");

  const expected: Record<Scene, { y: [number, number, number]; u: [number, number, number] }> = {
    wake: { y: [-1.35, 0.72, 0.15], u: [0.72, 0.12, 0] },
    jealousy: { y: [-0.98, 0.42, 0.24], u: [0.74, 0.12, -0.08] },
    confession: { y: [-0.62, 0.55, 0.08], u: [0.58, 0.1, -0.05] },
    privilege: { y: [-0.35, 0.35, 0.08], u: [0.32, 0.08, 0] },
    signal: { y: [-0.72, 0.18, 0.15], u: [0.72, 0.18, -0.12] },
    game: { y: [-0.46, 0.08, 0.3], u: [0.46, 0.08, -0.3] },
    night: { y: [-0.3, 0.14, 0.1], u: [0.3, 0.14, -0.1] },
    finale: { y: [-0.12, 0.2, 0.04], u: [0.12, 0.08, -0.04] },
  };

  expect(Object.fromEntries(sceneOrder.map((scene) => [scene, sceneGravityAnchors!(scene)]))).toEqual(expected);
  const mutated = sceneGravityAnchors!("wake");
  mutated.y[0] = 999;
  mutated.u[1] = 999;
  expect(sceneGravityAnchors!("wake")).toEqual(expected.wake);
});

test("scene target modes are finite, deterministic, and normalize counts down to nonnegative integers", () => {
  const sceneParticleTargets = advancedParticles.sceneParticleTargets;
  expect(sceneParticleTargets).toBeTypeOf("function");

  for (const scene of sceneOrder) {
    for (const mode of ["entry", "present", "exit"] as const) {
      expect(sceneParticleTargets!(scene, 19, mode)).toEqual(sceneParticleTargets!(scene, 19, mode));
      expect(sceneParticleTargets!(scene, 19, mode)).toHaveLength(57);
      expect(sceneParticleTargets!(scene, 19, mode).every(Number.isFinite)).toBe(true);
      expect(sceneParticleTargets!(scene, 0, mode)).toEqual([]);
      expect(sceneParticleTargets!(scene, -4, mode)).toEqual([]);
      expect(sceneParticleTargets!(scene, 3.8, mode)).toHaveLength(9);
    }
  }
});

test("adjacent scene bridges exactly expose the outgoing and incoming target modes", () => {
  const sceneParticleTargets = advancedParticles.sceneParticleTargets;
  const transitionParticleTargets = advancedParticles.transitionParticleTargets;
  expect(transitionParticleTargets).toBeTypeOf("function");

  for (let index = 0; index < sceneOrder.length - 1; index += 1) {
    const from = sceneOrder[index];
    const to = sceneOrder[index + 1];
    expect(transitionParticleTargets!(from, to, 31)).toEqual({
      exit: sceneParticleTargets!(from, 31, "exit"),
      entry: sceneParticleTargets!(to, 31, "entry"),
    });
  }
});

test("mode changes retain the same indexed sculpture strands instead of scattering", () => {
  const sceneParticleTargets = advancedParticles.sceneParticleTargets;
  expect(sceneParticleTargets).toBeTypeOf("function");

  for (const scene of sceneOrder) {
    const present = sceneParticleTargets!(scene, 120, "present");
    const entry = sceneParticleTargets!(scene, 120, "entry");
    const exit = sceneParticleTargets!(scene, 120, "exit");
    const averageDistance = (a: number[], b: number[]) => {
      let total = 0;
      for (let index = 0; index < a.length; index += 3) {
        total += Math.hypot(a[index] - b[index], a[index + 1] - b[index + 1], a[index + 2] - b[index + 2]);
      }
      return total / (a.length / 3);
    };

    expect(averageDistance(present, entry)).toBeLessThan(3.5);
    expect(averageDistance(present, exit)).toBeLessThan(3.5);
    expect(entry.slice(0, 30)).not.toEqual(present.slice(0, 30));
    expect(exit.slice(0, 30)).not.toEqual(present.slice(0, 30));
  }
});

test("finale present targets form converging Y branches and a stem nested over a U bowl", () => {
  const sceneParticleTargets = advancedParticles.sceneParticleTargets;
  const targets = sceneParticleTargets!("finale", 100, "present");
  const point = (index: number) => [targets[index * 3], targets[index * 3 + 1], targets[index * 3 + 2]];
  const left = Array.from({ length: 22 }, (_, index) => point(index));
  const right = Array.from({ length: 22 }, (_, index) => point(index + 22));
  const stem = Array.from({ length: 18 }, (_, index) => point(index + 44));
  const bowl = Array.from({ length: 38 }, (_, index) => point(index + 62));

  expect(left.every(([x]) => x <= 0.02)).toBe(true);
  expect(right.every(([x]) => x >= -0.02)).toBe(true);
  expect(Math.hypot(left.at(-1)![0] - right.at(-1)![0], left.at(-1)![1] - right.at(-1)![1])).toBeLessThan(0.08);
  expect(stem.every(([x]) => Math.abs(x) < 0.06)).toBe(true);
  expect(stem[0][1]).toBeGreaterThan(stem.at(-1)![1]);
  expect(bowl[0][0]).toBeLessThan(-1);
  expect(bowl.at(-1)![0]).toBeGreaterThan(1);
  expect(Math.min(...bowl.map(([, y]) => y))).toBeLessThan(-1.5);
  expect(Math.min(...stem.map(([, y]) => y))).toBeGreaterThan(Math.min(...bowl.map(([, y]) => y)));
});
