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
