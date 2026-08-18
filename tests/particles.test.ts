import {
  MAX_PARTICLE_COUNT,
  echoCoreTargets,
  infinityTargets,
  sceneGravityAnchors,
  sceneParticleTargets,
  sceneRotationY,
  sceneSpinFactor,
  transitionParticleTargets,
  type TargetMode,
  type Vec3Tuple,
} from "../lib/particles";
import { sceneOrder } from "../lib/experience";

type Scene = (typeof sceneOrder)[number];

const strandPairs = [
  [0, 37],
  [0, 71],
  [37, 71],
  [13, 99],
  [42, 117],
] as const;

function distanceBetween(targets: number[], from: number, to: number): number {
  const fromOffset = from * 3;
  const toOffset = to * 3;
  return Math.hypot(
    targets[fromOffset] - targets[toOffset],
    targets[fromOffset + 1] - targets[toOffset + 1],
    targets[fromOffset + 2] - targets[toOffset + 2],
  );
}

function assertModePreservesStrandDistances(present: number[], mode: number[], modeName: TargetMode): number {
  if (present.length !== mode.length) throw new Error(`${modeName} target length differs from present targets`);

  let scale: number | undefined;
  for (const [from, to] of strandPairs) {
    const presentDistance = distanceBetween(present, from, to);
    if (presentDistance <= 1e-8) throw new Error(`present strand pair (${from}, ${to}) is degenerate`);

    const ratio = distanceBetween(mode, from, to) / presentDistance;
    if (scale === undefined) {
      scale = ratio;
    } else if (Math.abs(ratio - scale) > 1e-10) {
      throw new Error(
        `${modeName} strand distance mismatch at pair (${from}, ${to}): expected scale ${scale}, received ${ratio}`,
      );
    }
  }
  if (scale === undefined) throw new Error(`no ${modeName} strand pairs were compared`);
  return scale;
}

function transformedPoint(
  present: number[],
  index: number,
  anchor: Readonly<Vec3Tuple>,
  scale: number,
  rotationY: number,
): Vec3Tuple {
  const offset = index * 3;
  const x = present[offset];
  const z = present[offset + 2];
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return [
    anchor[0] + (x * cos - z * sin) * scale,
    anchor[1] + present[offset + 1] * scale,
    anchor[2] + (x * sin + z * cos) * scale,
  ];
}

function assertTargetMatchesTransform(
  scene: Scene,
  mode: TargetMode,
  present: number[],
  actual: number[],
  anchor: Readonly<Vec3Tuple>,
  scale: number,
  rotationY: number,
): void {
  for (const index of [1, 19, 73, 111]) {
    const expected = transformedPoint(present, index, anchor, scale, rotationY);
    for (let axis = 0; axis < 3; axis += 1) {
      const received = actual[index * 3 + axis];
      if (Math.abs(received - expected[axis]) > 1e-12) {
        throw new Error(
          `${scene} ${mode} index ${index} axis ${axis} expected ${expected[axis]}, received ${received}`,
        );
      }
    }
  }
}

function finaleBoundaries(count: number) {
  return {
    leftYEnd: Math.floor(count * 0.2),
    rightYEnd: Math.floor(count * 0.4),
    stemEnd: Math.floor(count * 0.58),
    leftULimbEnd: Math.floor(count * 0.71),
    bowlEnd: Math.floor(count * 0.87),
  };
}

function pointsInRange(targets: number[], start: number, end: number): Vec3Tuple[] {
  return Array.from({ length: end - start }, (_, index) => {
    const offset = (start + index) * 3;
    return [targets[offset], targets[offset + 1], targets[offset + 2]];
  });
}

test("particle targets are deterministic and finite", () => {
  expect(echoCoreTargets(512, 523)).toEqual(echoCoreTargets(512, 523));
  expect(echoCoreTargets(512, 523)).toHaveLength(1536);
  expect(echoCoreTargets(512, 523).every(Number.isFinite)).toBe(true);
});

test("infinity targets contain one xyz triplet per particle", () => {
  expect(infinityTargets(100)).toHaveLength(300);
});

test("all eight chapters have materially different particle sculptures", () => {
  const signatures = sceneOrder.map((scene) =>
    sceneParticleTargets(scene, 24)
      .slice(0, 24)
      .map((value) => value.toFixed(3))
      .join(","),
  );
  expect(new Set(signatures).size).toBe(sceneOrder.length);
});

test("the finale infinity sculpture stays front-facing", () => {
  expect(sceneRotationY("finale", 83, 0)).toBe(0);
  expect(sceneRotationY("game", 10, 0)).not.toBe(0);
});

test("the finale disables depth-axis shader spin", () => {
  expect(sceneSpinFactor("finale")).toBe(0);
  expect(sceneSpinFactor("game")).toBe(1);
});

test("scene gravity anchors provide the exact distinct twin targets without shared mutable tuples", () => {
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

  expect(Object.fromEntries(sceneOrder.map((scene) => [scene, sceneGravityAnchors(scene)]))).toEqual(expected);
  const mutated = sceneGravityAnchors("wake");
  mutated.y[0] = 999;
  mutated.u[1] = 999;
  expect(sceneGravityAnchors("wake")).toEqual(expected.wake);
});

test("scene target modes are finite, deterministic, and normalize counts down to nonnegative integers", () => {
  for (const scene of sceneOrder) {
    for (const mode of ["entry", "present", "exit"] as const) {
      expect(sceneParticleTargets(scene, 19, mode)).toEqual(sceneParticleTargets(scene, 19, mode));
      expect(sceneParticleTargets(scene, 19, mode)).toHaveLength(57);
      expect(sceneParticleTargets(scene, 19, mode).every(Number.isFinite)).toBe(true);
      expect(sceneParticleTargets(scene, 0, mode)).toEqual([]);
      expect(sceneParticleTargets(scene, -4, mode)).toEqual([]);
      expect(sceneParticleTargets(scene, 3.8, mode)).toHaveLength(9);
    }
  }
});

test("adjacent scene bridges exactly expose the outgoing and incoming target modes", () => {
  for (let index = 0; index < sceneOrder.length - 1; index += 1) {
    const from = sceneOrder[index];
    const to = sceneOrder[index + 1];
    expect(transitionParticleTargets(from, to, 31)).toEqual({
      exit: sceneParticleTargets(from, 31, "exit"),
      entry: sceneParticleTargets(to, 31, "entry"),
    });
  }
});

test("mode changes retain the same indexed sculpture strands instead of scattering", () => {
  for (const scene of sceneOrder) {
    const present = sceneParticleTargets(scene, 120, "present");
    const entry = sceneParticleTargets(scene, 120, "entry");
    const exit = sceneParticleTargets(scene, 120, "exit");
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

test("entry and exit preserve per-index strand distances under their affine target transforms", () => {
  for (const scene of sceneOrder) {
    const present = sceneParticleTargets(scene, 120, "present");
    expect(assertModePreservesStrandDistances(present, sceneParticleTargets(scene, 120, "entry"), "entry")).toBeCloseTo(0.45, 10);
    expect(assertModePreservesStrandDistances(present, sceneParticleTargets(scene, 120, "exit"), "exit")).toBeCloseTo(0.32, 10);
  }
});

test("strand correspondence invariant rejects a bounded target set with swapped indexed triplets", () => {
  const present = sceneParticleTargets("wake", 120, "present");
  const permutedEntry = [...sceneParticleTargets("wake", 120, "entry")];
  const firstOffset = 0;
  const secondOffset = 37 * 3;

  for (let axis = 0; axis < 3; axis += 1) {
    const value = permutedEntry[firstOffset + axis];
    permutedEntry[firstOffset + axis] = permutedEntry[secondOffset + axis];
    permutedEntry[secondOffset + axis] = value;
  }

  expect(() => assertModePreservesStrandDistances(present, permutedEntry, "entry")).toThrow(
    /entry strand distance mismatch at pair \(0, 71\)/,
  );
});

test("scene target counts clamp huge finite inputs and safely handle non-finite and small inputs", () => {
  for (const count of [Number.MAX_SAFE_INTEGER, Number.MAX_VALUE]) {
    const targets = sceneParticleTargets("wake", count);
    expect(targets).toHaveLength(MAX_PARTICLE_COUNT * 3);
    expect(targets.every(Number.isFinite)).toBe(true);
  }
  const bridge = transitionParticleTargets("wake", "jealousy", Number.MAX_VALUE);
  expect(bridge.exit).toHaveLength(MAX_PARTICLE_COUNT * 3);
  expect(bridge.entry).toHaveLength(MAX_PARTICLE_COUNT * 3);

  for (const count of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0, 1, 2]) {
    for (const mode of ["entry", "present", "exit"] as const) {
      const targets = sceneParticleTargets("finale", count, mode);
      expect(targets).toHaveLength(Math.max(0, Math.floor(Number.isFinite(count) ? count : 0)) * 3);
      expect(targets.every(Number.isFinite)).toBe(true);
    }
  }
});

test("entry and exit apply their documented anchors, scales, rotations, and indexed point order", () => {
  for (const scene of sceneOrder) {
    const present = sceneParticleTargets(scene, 120, "present");
    const anchors = sceneGravityAnchors(scene);
    assertTargetMatchesTransform(scene, "entry", present, sceneParticleTargets(scene, 120, "entry"), anchors.u, 0.45, -0.2);
    assertTargetMatchesTransform(scene, "exit", present, sceneParticleTargets(scene, 120, "exit"), anchors.y, 0.32, 0.26);
  }
});

test("transform oracle rejects swapped anchors, wrong rotations, and reordered triplets", () => {
  const present = sceneParticleTargets("wake", 120, "present");
  const entry = sceneParticleTargets("wake", 120, "entry");
  const anchors = sceneGravityAnchors("wake");

  expect(() => assertTargetMatchesTransform("wake", "entry", present, entry, anchors.y, 0.45, -0.2)).toThrow(/wake entry index 1 axis/);
  expect(() => assertTargetMatchesTransform("wake", "entry", present, entry, anchors.u, 0.45, 0.26)).toThrow(/wake entry index 1 axis/);

  const reordered = [...entry];
  for (let axis = 0; axis < 3; axis += 1) {
    const value = reordered[3 + axis];
    reordered[3 + axis] = reordered[73 * 3 + axis];
    reordered[73 * 3 + axis] = value;
  }
  expect(() => assertTargetMatchesTransform("wake", "entry", present, reordered, anchors.u, 0.45, -0.2)).toThrow(
    /wake entry index 1 axis/,
  );
});

test("finale targets nest Y branches and stem inside a continuous U across practical counts", () => {
  for (const count of [97, 100, 257, 2048]) {
    const targets = sceneParticleTargets("finale", count, "present");
    const boundaries = finaleBoundaries(count);
    const leftY = pointsInRange(targets, 0, boundaries.leftYEnd);
    const rightY = pointsInRange(targets, boundaries.leftYEnd, boundaries.rightYEnd);
    const stem = pointsInRange(targets, boundaries.rightYEnd, boundaries.stemEnd);
    const leftULimb = pointsInRange(targets, boundaries.stemEnd, boundaries.leftULimbEnd);
    const bowl = pointsInRange(targets, boundaries.leftULimbEnd, boundaries.bowlEnd);
    const rightULimb = pointsInRange(targets, boundaries.bowlEnd, count);
    const yShape = [...leftY, ...rightY, ...stem];
    const uShape = [...leftULimb, ...bowl, ...rightULimb];
    const yRange = [Math.min(...yShape.map(([, y]) => y)), Math.max(...yShape.map(([, y]) => y))];
    const uRange = [Math.min(...uShape.map(([, y]) => y)), Math.max(...uShape.map(([, y]) => y))];
    const uXRange = [Math.min(...uShape.map(([x]) => x)), Math.max(...uShape.map(([x]) => x))];

    expect(leftULimb.every(([x]) => Math.abs(x + 1.4) < 0.03)).toBe(true);
    expect(rightULimb.every(([x]) => Math.abs(x - 1.4) < 0.03)).toBe(true);
    expect(Math.min(...leftULimb.map(([, y]) => y))).toBeLessThan(-1);
    expect(Math.max(...leftULimb.map(([, y]) => y))).toBeGreaterThan(1);
    expect(Math.min(...rightULimb.map(([, y]) => y))).toBeLessThan(-1);
    expect(Math.max(...rightULimb.map(([, y]) => y))).toBeGreaterThan(1);
    expect(Math.min(...bowl.map(([, y]) => y))).toBeLessThan(-1.8);
    expect(bowl[0][0]).toBeLessThan(-1);
    expect(bowl.at(-1)![0]).toBeGreaterThan(1);
    expect(Math.max(yRange[0], uRange[0])).toBeLessThanOrEqual(Math.min(yRange[1], uRange[1]));
    expect(yShape.every(([x]) => x >= uXRange[0] && x <= uXRange[1])).toBe(true);
    expect(stem.every(([x]) => Math.abs(x) < 0.06)).toBe(true);
    expect(stem.at(-1)![1]).toBeLessThan(-1);
    expect(stem.at(-1)![1]).toBeGreaterThan(Math.min(...bowl.map(([, y]) => y)));
    expect(stem.at(-1)![1]).toBeLessThan(Math.max(...leftULimb.map(([, y]) => y)));
  }
});
