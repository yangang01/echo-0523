import type { SceneId } from "./experience";

export type DirectorPhase = "enter" | "present" | "ready" | "exit";
export type PauseReason = "reading" | "gesture" | "surface-focus" | "control-focus" | "control-interaction" | "hidden";
export type DirectorState = {
  scene: SceneId;
  phase: DirectorPhase;
  paused: PauseReason[];
  autoAdvanceAt: number | null;
  idleRemainingMs: number | null;
  resetIdleOnResume: boolean;
  advanceToken: number;
};
export type DirectorEvent =
  | { type: "START_PRESENTATION"; now: number }
  | { type: "PRESENTATION_COMPLETE"; now: number }
  | { type: "PAUSE"; reason: PauseReason; now: number }
  | { type: "RESUME"; reason: PauseReason; now: number }
  | { type: "REQUEST_ADVANCE"; now: number }
  | { type: "IDLE_EXPIRED"; now: number };

export function createDirector(scene: SceneId): DirectorState {
  return {
    scene,
    phase: "enter",
    paused: [],
    autoAdvanceAt: null,
    idleRemainingMs: null,
    resetIdleOnResume: false,
    advanceToken: 0,
  };
}

function beginExit(state: DirectorState): DirectorState {
  if (state.phase !== "ready" || state.paused.includes("hidden")) return state;
  return {
    ...state,
    phase: "exit",
    autoAdvanceAt: null,
    idleRemainingMs: null,
    resetIdleOnResume: false,
    advanceToken: state.advanceToken + 1,
  };
}

export function reduceDirector(state: DirectorState, event: DirectorEvent): DirectorState {
  if (event.type === "START_PRESENTATION") {
    return state.phase === "enter" ? { ...state, phase: "present" } : state;
  }
  if (event.type === "PRESENTATION_COMPLETE") {
    if (state.phase !== "present") return state;
    return {
      ...state,
      phase: "ready",
      autoAdvanceAt: null,
      idleRemainingMs: null,
      resetIdleOnResume: false,
    };
  }
  if (event.type === "PAUSE") {
    if (state.paused.includes(event.reason)) return state;
    return {
      ...state,
      paused: [...state.paused, event.reason],
      autoAdvanceAt: null,
      idleRemainingMs: null,
      resetIdleOnResume: false,
    };
  }
  if (event.type === "RESUME") {
    if (!state.paused.includes(event.reason)) return state;
    const paused = state.paused.filter((reason) => reason !== event.reason);
    return {
      ...state,
      paused,
      autoAdvanceAt: null,
      idleRemainingMs: null,
      resetIdleOnResume: false,
    };
  }
  if (event.type === "REQUEST_ADVANCE") return beginExit(state);
  return state;
}
