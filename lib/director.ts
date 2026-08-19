import type { SceneId } from "./experience";

export const READY_IDLE_MS = 12_000;

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
  if (state.phase !== "ready" || state.paused.length > 0) return state;
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
      autoAdvanceAt: state.paused.length === 0 ? event.now + READY_IDLE_MS : null,
      idleRemainingMs: READY_IDLE_MS,
      resetIdleOnResume: state.paused.some((reason) => reason !== "hidden"),
    };
  }
  if (event.type === "PAUSE") {
    if (state.paused.includes(event.reason)) return state;
    const idleRemainingMs = state.phase === "ready" && state.autoAdvanceAt !== null
      ? Math.max(0, state.autoAdvanceAt - event.now)
      : state.idleRemainingMs;
    return {
      ...state,
      paused: [...state.paused, event.reason],
      autoAdvanceAt: null,
      idleRemainingMs,
      resetIdleOnResume: state.resetIdleOnResume || (state.phase === "ready" && event.reason !== "hidden"),
    };
  }
  if (event.type === "RESUME") {
    if (!state.paused.includes(event.reason)) return state;
    const paused = state.paused.filter((reason) => reason !== event.reason);
    const resumesReadyIdle = state.phase === "ready" && paused.length === 0;
    const delay = state.resetIdleOnResume ? READY_IDLE_MS : state.idleRemainingMs ?? READY_IDLE_MS;
    return {
      ...state,
      paused,
      autoAdvanceAt: resumesReadyIdle ? event.now + delay : state.autoAdvanceAt,
      idleRemainingMs: resumesReadyIdle ? delay : state.idleRemainingMs,
      resetIdleOnResume: resumesReadyIdle ? false : state.resetIdleOnResume,
    };
  }
  if (event.type === "REQUEST_ADVANCE") return beginExit(state);
  if (state.phase !== "ready" || state.paused.length > 0 || state.autoAdvanceAt === null || event.now < state.autoAdvanceAt) {
    return state;
  }
  return beginExit(state);
}
