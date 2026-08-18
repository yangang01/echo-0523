import type { SceneId } from "./experience";

export type Vec3Tuple = [number, number, number];
export type TargetMode = "entry" | "present" | "exit";

type GravityAnchors = { y: Readonly<Vec3Tuple>; u: Readonly<Vec3Tuple> };

const gravityAnchors: Record<SceneId, GravityAnchors> = {
  wake: { y: [-1.35, 0.72, 0.15], u: [0.72, 0.12, 0] },
  jealousy: { y: [-0.98, 0.42, 0.24], u: [0.74, 0.12, -0.08] },
  confession: { y: [-0.62, 0.55, 0.08], u: [0.58, 0.1, -0.05] },
  privilege: { y: [-0.35, 0.35, 0.08], u: [0.32, 0.08, 0] },
  signal: { y: [-0.72, 0.18, 0.15], u: [0.72, 0.18, -0.12] },
  game: { y: [-0.46, 0.08, 0.3], u: [0.46, 0.08, -0.3] },
  night: { y: [-0.3, 0.14, 0.1], u: [0.3, 0.14, -0.1] },
  finale: { y: [-0.12, 0.2, 0.04], u: [0.12, 0.08, -0.04] },
};

/** Returns fresh tuples so callers cannot mutate the persistent anchor definitions. */
export function sceneGravityAnchors(scene: SceneId): { y: Vec3Tuple; u: Vec3Tuple } {
  const anchors = gravityAnchors[scene];
  return { y: [...anchors.y], u: [...anchors.u] };
}

function randomSource(seed: number) {
  let value = seed | 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4_294_967_296;
  };
}

export function echoCoreTargets(count: number, seed = 523): number[] {
  const random = randomSource(seed);
  const values = new Array<number>(count * 3);
  for (let index = 0; index < count; index += 1) {
    const u = random() * Math.PI * 2;
    const v = Math.acos(2 * random() - 1);
    const petal = 1 + 0.24 * Math.sin(u * 5 + Math.sin(v * 3));
    const radius = Math.pow(random(), 0.34) * petal;
    const flatten = 0.72 + 0.28 * Math.sin(u * 3);
    values[index * 3] = Math.sin(v) * Math.cos(u) * radius * 1.45;
    values[index * 3 + 1] = Math.cos(v) * radius * 1.15;
    values[index * 3 + 2] = Math.sin(v) * Math.sin(u) * radius * flatten;
  }
  return values;
}

export function infinityTargets(count: number): number[] {
  const values = new Array<number>(count * 3);
  const random = randomSource(5230523);
  for (let index = 0; index < count; index += 1) {
    const t = (index / count) * Math.PI * 2 + (random() - 0.5) * 0.055;
    const width = 2.15;
    const thickness = (random() - 0.5) * 0.22;
    values[index * 3] = Math.sin(t) * width + Math.cos(t) * thickness;
    values[index * 3 + 1] = Math.sin(t) * Math.cos(t) * 1.2 + Math.sin(t * 2) * thickness;
    values[index * 3 + 2] = (random() - 0.5) * 0.34 + Math.sin(t * 3) * 0.08;
  }
  return values;
}

export function scatterTargets(count: number, seed = 20260523): number[] {
  const random = randomSource(seed);
  return Array.from({ length: count * 3 }, (_, index) => {
    const axis = index % 3;
    return (random() - 0.5) * (axis === 2 ? 8 : 12);
  });
}

function sculpt(count: number, seed: number, point: (t: number, random: () => number, index: number) => [number, number, number]) {
  const random = randomSource(seed);
  const values = new Array<number>(count * 3);
  for (let index = 0; index < count; index += 1) {
    const [x, y, z] = point((index / count) * Math.PI * 2, random, index);
    values[index * 3] = x;
    values[index * 3 + 1] = y;
    values[index * 3 + 2] = z;
  }
  return values;
}

function normalizedParticleCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function finaleYuTargets(count: number): number[] {
  const values = new Array<number>(count * 3);
  const leftEnd = Math.floor(count * 0.22);
  const rightEnd = Math.floor(count * 0.44);
  const stemEnd = Math.floor(count * 0.62);
  const progress = (index: number, start: number, end: number) => (end - start <= 1 ? 0.5 : (index - start) / (end - start - 1));

  for (let index = 0; index < count; index += 1) {
    let point: Vec3Tuple;
    if (index < leftEnd) {
      const t = progress(index, 0, leftEnd);
      point = [-1.4 * (1 - t), 1.15 - t * 0.9, Math.sin(t * Math.PI) * -0.035];
    } else if (index < rightEnd) {
      const t = progress(index, leftEnd, rightEnd);
      point = [1.4 * (1 - t), 1.15 - t * 0.9, Math.sin(t * Math.PI) * 0.035];
    } else if (index < stemEnd) {
      const t = progress(index, rightEnd, stemEnd);
      point = [Math.sin(t * Math.PI) * 0.025, 0.25 - t * 0.95, Math.sin(t * Math.PI) * 0.025];
    } else {
      const t = progress(index, stemEnd, count);
      point = [-1.4 + t * 2.8, -1.15 - Math.sin(t * Math.PI) * 0.8, Math.cos(t * Math.PI) * 0.05];
    }
    values[index * 3] = point[0];
    values[index * 3 + 1] = point[1];
    values[index * 3 + 2] = point[2];
  }
  return values;
}

function presentSceneParticleTargets(scene: SceneId, count: number): number[] {
  if (scene === "finale") return finaleYuTargets(count);

  if (scene === "wake") {
    return sculpt(count, 52301, (t, random) => {
      const radius = 0.18 + Math.pow(random(), 2.4) * 0.72;
      const latitude = Math.acos(2 * random() - 1);
      return [Math.sin(latitude) * Math.cos(t) * radius, Math.cos(latitude) * radius, Math.sin(latitude) * Math.sin(t) * radius];
    });
  }

  if (scene === "jealousy") {
    return sculpt(count, 52302, (t, random, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const lobe = 0.9 + random() * 0.7;
      const fracture = (random() - 0.5) * 0.3;
      return [side * (0.62 + Math.sin(t) * lobe) + fracture, Math.cos(t) * 1.05 + side * 0.22, (random() - 0.5) * 0.9 + Math.sin(t * 5) * 0.12];
    });
  }

  if (scene === "confession") {
    return sculpt(count, 52303, (t, random, index) => {
      const ring = index % 4;
      const radius = 0.7 + ring * 0.48 + (random() - 0.5) * 0.1;
      const tilt = ring * 0.56;
      return [Math.cos(t) * radius, Math.sin(t) * radius * Math.cos(tilt), Math.sin(t) * radius * Math.sin(tilt)];
    });
  }

  if (scene === "privilege") {
    return sculpt(count, 52304, (t, random) => {
      const petal = 1.05 + 0.72 * Math.cos(t * 7);
      const layer = 0.72 + random() * 0.72;
      return [Math.cos(t) * petal * layer, Math.sin(t) * petal * layer, (random() - 0.5) * 0.72 + Math.cos(t * 7) * 0.22];
    });
  }

  if (scene === "signal") {
    return sculpt(count, 52305, (t, random, index) => {
      const branch = index % 3;
      const reach = 0.35 + random() * 2.05;
      const angle = t + branch * (Math.PI * 2) / 3;
      return [Math.cos(angle) * reach, Math.sin(angle) * reach * 0.62, (branch - 1) * 0.48 + Math.sin(reach * 5) * 0.14];
    });
  }

  if (scene === "game") {
    return sculpt(count, 52306, (t, random, index) => {
      const depth = ((index / count) * 8 - 4) + (random() - 0.5) * 0.22;
      const radius = 1.12 + 0.3 * Math.sin(t * 6);
      return [Math.cos(t * 7) * radius, Math.sin(t * 7) * radius, depth];
    });
  }

  return sculpt(count, 52307, (t, random, index) => {
    const lane = index % 2 === 0 ? -1 : 1;
    const x = (index / count - 0.5) * 5.2;
    const y = Math.sin(x * 2.7 + lane * 0.85) * 0.72 + lane * 0.48;
    return [x, y, (random() - 0.5) * 0.38 + Math.cos(x * 1.8) * 0.12];
  });
}

function transformTargetMode(targets: number[], anchor: Readonly<Vec3Tuple>, scale: number, rotationY: number): number[] {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const transformed = new Array<number>(targets.length);
  for (let index = 0; index < targets.length; index += 3) {
    const x = targets[index];
    const z = targets[index + 2];
    transformed[index] = anchor[0] + (x * cos - z * sin) * scale;
    transformed[index + 1] = anchor[1] + targets[index + 1] * scale;
    transformed[index + 2] = anchor[2] + (x * sin + z * cos) * scale;
  }
  return transformed;
}

/** Fractional counts are floored and all non-finite or negative counts become zero. */
export function sceneParticleTargets(scene: SceneId, count: number, mode: TargetMode = "present"): number[] {
  const normalizedCount = normalizedParticleCount(count);
  const present = presentSceneParticleTargets(scene, normalizedCount);
  if (mode === "present") return present;

  const anchors = gravityAnchors[scene];
  return mode === "entry"
    ? transformTargetMode(present, anchors.u, 0.45, -0.2)
    : transformTargetMode(present, anchors.y, 0.32, 0.26);
}

export function transitionParticleTargets(from: SceneId, to: SceneId, count: number): { exit: number[]; entry: number[] } {
  return {
    exit: sceneParticleTargets(from, count, "exit"),
    entry: sceneParticleTargets(to, count, "entry"),
  };
}

export function sceneRotationY(scene: SceneId, elapsed: number, pointerX: number): number {
  if (scene === "finale") return pointerX * 0.04;
  return elapsed * (scene === "game" ? 0.13 : 0.045) + pointerX * 0.12;
}

export function sceneSpinFactor(scene: SceneId): number {
  return scene === "finale" ? 0 : 1;
}
