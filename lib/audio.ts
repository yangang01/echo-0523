export type SoundName = "heartbeat" | "lock" | "reply" | "bloom";
export type SoundRecipe = { frequency: number; gain: number; duration: number; type: OscillatorType };

const recipes: Record<SoundName, SoundRecipe> = {
  heartbeat: { frequency: 62, gain: 0.18, duration: 0.18, type: "sine" },
  lock: { frequency: 520, gain: 0.12, duration: 0.42, type: "triangle" },
  reply: { frequency: 760, gain: 0.1, duration: 0.28, type: "sine" },
  bloom: { frequency: 196, gain: 0.2, duration: 1.5, type: "sine" },
};

export function audioRecipe(name: SoundName): SoundRecipe {
  return recipes[name];
}
