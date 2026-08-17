import type { SceneId } from "./experience";

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

export function sceneParticleTargets(scene: SceneId, count: number): number[] {
  if (scene === "finale") return infinityTargets(count);

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
