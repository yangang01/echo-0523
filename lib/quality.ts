export type Quality = "high" | "medium" | "low";
export const qualityProfiles = {
  high: { particles: 32000, bloomScale: 1, gravityCoreSegments: 3 },
  medium: { particles: 18000, bloomScale: 0.72, gravityCoreSegments: 3 },
  low: { particles: 7000, bloomScale: 0, gravityCoreSegments: 2 },
} as const satisfies Readonly<Record<Quality, {
  particles: number;
  bloomScale: number;
  gravityCoreSegments: number;
}>>;

export const particleBudget = {
  high: qualityProfiles.high.particles,
  medium: qualityProfiles.medium.particles,
  low: qualityProfiles.low.particles,
} as const;

export function initialQuality(input: { deviceMemory?: number; cores?: number; reducedMotion: boolean }): Quality {
  if (input.reducedMotion || (input.deviceMemory ?? 4) <= 2 || (input.cores ?? 4) <= 2) return "low";
  if ((input.deviceMemory ?? 4) <= 4 || (input.cores ?? 4) <= 4) return "medium";
  return "high";
}

export function lowerQuality(value: Quality): Quality {
  return value === "high" ? "medium" : "low";
}
