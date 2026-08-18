import type { SignalChannelId } from "./content";

export const sceneOrder = ["wake", "jealousy", "confession", "privilege", "signal", "game", "night", "finale"] as const;
export type SceneId = (typeof sceneOrder)[number];
export type ResponseType = "curious" | "compliment" | "ally";
export type Growth = { filaments: number; petals: number; currents: number };
export type TranscriptEntry = { unlocked: string[]; activeId: string | null };
export type TranscriptState = Record<SceneId, TranscriptEntry>;
export type ExperienceState = {
  scene: SceneId;
  completed: SceneId[];
  growth: Growth;
  soundEnabled: boolean;
  transcript: TranscriptState;
  signalChannelId: SignalChannelId | null;
};
export type ExperienceEvent =
  | { type: "SCENE_COMPLETE"; scene: SceneId }
  | { type: "ADVANCE_TO"; from: SceneId; to: SceneId }
  | { type: "RESPONSE_SELECTED"; response: ResponseType }
  | { type: "SOUND_SET"; enabled: boolean }
  | { type: "ECHO_REVEAL"; scene: SceneId; fragmentId: string }
  | { type: "ECHO_SELECT"; scene: SceneId; fragmentId: string }
  | { type: "SIGNAL_CHANNEL_SET"; channelId: SignalChannelId }
  | { type: "RESTART" };

function emptyTranscript(): TranscriptState {
  return sceneOrder.reduce<TranscriptState>((transcript, scene) => {
    transcript[scene] = { unlocked: [], activeId: null };
    return transcript;
  }, {} as TranscriptState);
}

export function createExperience(scene: SceneId = "wake"): ExperienceState {
  return {
    scene,
    completed: [],
    growth: { filaments: 0, petals: 0, currents: 0 },
    soundEnabled: false,
    transcript: emptyTranscript(),
    signalChannelId: null,
  };
}

export function reduceExperience(state: ExperienceState, event: ExperienceEvent): ExperienceState {
  if (event.type === "RESTART") return createExperience();
  if (event.type === "SOUND_SET") return { ...state, soundEnabled: event.enabled };
  if (event.type === "SIGNAL_CHANNEL_SET") return { ...state, signalChannelId: event.channelId };
  if (event.type === "ECHO_REVEAL") {
    const entry = state.transcript[event.scene];
    const unlocked = entry.unlocked.includes(event.fragmentId)
      ? entry.unlocked
      : [...entry.unlocked, event.fragmentId];
    return {
      ...state,
      transcript: {
        ...state.transcript,
        [event.scene]: { unlocked, activeId: event.fragmentId },
      },
    };
  }
  if (event.type === "ECHO_SELECT") {
    const entry = state.transcript[event.scene];
    if (!entry.unlocked.includes(event.fragmentId)) return state;
    return {
      ...state,
      transcript: {
        ...state.transcript,
        [event.scene]: { ...entry, activeId: event.fragmentId },
      },
    };
  }
  if (event.type === "SCENE_COMPLETE") {
    if (event.scene !== state.scene || state.completed.includes(event.scene)) return state;
    return { ...state, completed: [...state.completed, event.scene] };
  }
  if (event.type === "ADVANCE_TO") {
    const index = sceneOrder.indexOf(state.scene);
    if (event.from !== state.scene || !state.completed.includes(state.scene) || event.to !== sceneOrder[index + 1]) return state;
    return { ...state, scene: event.to };
  }
  const key = event.response === "curious" ? "filaments" : event.response === "compliment" ? "petals" : "currents";
  return { ...state, growth: { ...state.growth, [key]: state.growth[key] + 1 } };
}
