import type { SceneId } from "./experience";

export type MotionCue = "attract" | "disrupt" | "lock" | "orbit" | "reply" | "tunnel" | "sync" | "infinity";
export type TransitionCue = "gravity-wave" | "orbit-repair" | "coordinate-beam" | "petal-bloom" | "echo-return" | "dual-stream" | "wave-merge" | "yu-seal";
export type RevealCue = Readonly<{ at: number; id: string }>;
export type SceneTimeline = Readonly<{
  enterMs: number;
  presentMs: number;
  exitMs: number;
  motion: MotionCue;
  transition: TransitionCue;
  reveals: readonly RevealCue[];
}>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const timelineRegistry = {
  wake: {
    enterMs: 700,
    presentMs: 31_200,
    exitMs: 1800,
    motion: "attract",
    transition: "gravity-wave",
    reveals: [{ at: 1200, id: "spark" }, { at: 11_200, id: "archive" }, { at: 21_200, id: "receiver" }],
  },
  jealousy: {
    enterMs: 650,
    presentMs: 31_200,
    exitMs: 1750,
    motion: "disrupt",
    transition: "orbit-repair",
    reveals: [{ at: 1200, id: "praise" }, { at: 11_200, id: "smile" }, { at: 21_200, id: "meaning" }],
  },
  confession: {
    enterMs: 800,
    presentMs: 41_200,
    exitMs: 2100,
    motion: "lock",
    transition: "coordinate-beam",
    reveals: [{ at: 1200, id: "year" }, { at: 11_200, id: "month" }, { at: 21_200, id: "day" }, { at: 31_200, id: "locked" }],
  },
  privilege: {
    enterMs: 720,
    presentMs: 41_200,
    exitMs: 1900,
    motion: "orbit",
    transition: "petal-bloom",
    reveals: [{ at: 1200, id: "diary" }, { at: 11_200, id: "remembered" }, { at: 21_200, id: "seen" }, { at: 31_200, id: "action" }],
  },
  signal: {
    enterMs: 680,
    presentMs: 41_200,
    exitMs: 1850,
    motion: "reply",
    transition: "echo-return",
    reveals: [{ at: 1200, id: "$response:0" }, { at: 11_200, id: "$response:1" }, { at: 21_200, id: "$response:2" }, { at: 31_200, id: "close" }],
  },
  game: {
    enterMs: 760,
    presentMs: 41_200,
    exitMs: 1700,
    motion: "tunnel",
    transition: "dual-stream",
    reveals: [{ at: 1200, id: "near" }, { at: 11_200, id: "sync" }, { at: 21_200, id: "through" }, { at: 31_200, id: "complete" }],
  },
  night: {
    enterMs: 820,
    presentMs: 41_200,
    exitMs: 2000,
    motion: "sync",
    transition: "wave-merge",
    reveals: [{ at: 1200, id: "third" }, { at: 11_200, id: "two-thirds" }, { at: 21_200, id: "connected" }, { at: 31_200, id: "frequency" }],
  },
  finale: {
    enterMs: 900,
    presentMs: 31_200,
    exitMs: 1800,
    motion: "infinity",
    transition: "yu-seal",
    reveals: [{ at: 1200, id: "recap" }, { at: 11_200, id: "present" }, { at: 21_200, id: "echo" }],
  },
} as const satisfies Readonly<Record<SceneId, SceneTimeline>>;

export const sceneTimelines: Readonly<Record<SceneId, SceneTimeline>> = deepFreeze(timelineRegistry);
