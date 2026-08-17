export type Quality = "high" | "medium" | "low";
export const particleBudget = { high: 32000, medium: 18000, low: 7000 } as const;

export function initialQuality(input: { deviceMemory?: number; cores?: number; reducedMotion: boolean }): Quality {
  if (input.reducedMotion || (input.deviceMemory ?? 4) <= 2 || (input.cores ?? 4) <= 2) return "low";
  if ((input.deviceMemory ?? 4) <= 4 || (input.cores ?? 4) <= 4) return "medium";
  return "high";
}

export function lowerQuality(value: Quality): Quality {
  return value === "high" ? "medium" : "low";
}
