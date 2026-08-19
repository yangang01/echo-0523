"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { sceneEchoes, signalChannels } from "../../lib/content";
import { createDirector, reduceDirector, type DirectorPhase } from "../../lib/director";
import {
  createExperience,
  reduceExperience,
  sceneOrder,
  type ExperienceEvent,
  type ExperienceState,
  type SceneId,
} from "../../lib/experience";
import { sceneTimelines } from "../../lib/scene-timelines";
import { AudioEngine, type AudioEngineHandle } from "./AudioEngine";
import { GestureSurface, type GesturePauseSource } from "./GestureSurface";
import { ScenePanel } from "./ScenePanel";
import { ConfessionScene, FinaleScene, GameScene, JealousyScene, NightScene, PrivilegeScene, SignalScene, WakeScene } from "./scenes";
import { TwinGravityCanvas } from "./TwinGravityCanvas";

type DirectedSceneProps = {
  state: ExperienceState;
  dispatch: Dispatch<ExperienceEvent>;
  hidden: boolean;
  controlFocused: boolean;
  controlInteraction: number;
  onPhaseChange: (scene: SceneId, phase: DirectorPhase) => void;
};

function timestamp() {
  return performance.now();
}

function usePausableTimeout(enabled: boolean, paused: boolean, duration: number, onElapsed: () => void) {
  const remaining = useRef(duration);

  useEffect(() => {
    if (!enabled) {
      remaining.current = duration;
      return;
    }
    if (paused) return;

    const delay = remaining.current;
    const startedAt = timestamp();
    let elapsed = false;
    const timer = setTimeout(() => {
      elapsed = true;
      remaining.current = 0;
      onElapsed();
    }, delay);
    return () => {
      clearTimeout(timer);
      if (!elapsed) remaining.current = Math.max(0, delay - Math.max(0, timestamp() - startedAt));
    };
  }, [duration, enabled, onElapsed, paused]);
}

function DirectedScene({ state, dispatch, hidden, controlFocused, controlInteraction, onPhaseChange }: DirectedSceneProps) {
  const { scene } = state;
  const timeline = sceneTimelines[scene];
  const [director, sendDirector] = useReducer(reduceDirector, scene, createDirector);
  const completed = useRef(false);
  const controlFocusOwned = useRef(false);
  const previousControlInteraction = useRef(controlInteraction);
  const sceneIndex = sceneOrder.indexOf(scene);
  const next = sceneOrder[sceneIndex + 1];
  const transcript = state.transcript[scene];
  const fragments = scene === "signal"
    ? signalChannels.find((channel) => channel.id === state.signalChannelId)?.echoes ?? []
    : sceneEchoes[scene];

  useLayoutEffect(() => onPhaseChange(scene, director.phase), [director.phase, onPhaseChange, scene]);

  useEffect(() => {
    sendDirector({ type: hidden ? "PAUSE" : "RESUME", reason: "hidden", now: timestamp() });
  }, [hidden]);

  useEffect(() => {
    const shouldOwnFocus = director.phase === "ready" && controlFocused;
    if (controlFocusOwned.current === shouldOwnFocus) return;
    controlFocusOwned.current = shouldOwnFocus;
    sendDirector({
      type: shouldOwnFocus ? "PAUSE" : "RESUME",
      reason: "control-focus",
      now: timestamp(),
    });
  }, [controlFocused, director.phase]);

  useEffect(() => {
    if (previousControlInteraction.current === controlInteraction) return;
    previousControlInteraction.current = controlInteraction;
    if (director.phase !== "ready") return;
    const now = timestamp();
    sendDirector({ type: "PAUSE", reason: "control-interaction", now });
    sendDirector({ type: "RESUME", reason: "control-interaction", now });
  }, [controlInteraction, director.phase]);

  const startPresentation = useCallback(() => {
    sendDirector({ type: "START_PRESENTATION", now: timestamp() });
  }, []);
  const directorPaused = director.paused.length > 0;
  usePausableTimeout(director.phase === "enter", directorPaused, timeline.enterMs, startPresentation);

  const advanceScene = useCallback(() => {
    if (next) dispatch({ type: "ADVANCE_TO", from: scene, to: next });
  }, [dispatch, next, scene]);
  usePausableTimeout(Boolean(next) && director.phase === "exit", directorPaused, timeline.exitMs, advanceScene);

  const complete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    dispatch({ type: "SCENE_COMPLETE", scene });
    sendDirector({ type: "PRESENTATION_COMPLETE", now: timestamp() });
  }, [dispatch, scene]);
  const reveal = useCallback((fragmentId: string) => {
    dispatch({ type: "ECHO_REVEAL", scene, fragmentId });
    if (scene === "signal" && (fragmentId === "curious" || fragmentId === "compliment" || fragmentId === "ally") && !transcript.unlocked.includes(fragmentId)) {
      dispatch({ type: "RESPONSE_SELECTED", response: fragmentId });
    }
  }, [dispatch, scene, transcript.unlocked]);
  const selectEcho = useCallback((fragmentId: string) => {
    dispatch({ type: "ECHO_SELECT", scene, fragmentId });
  }, [dispatch, scene]);
  const reading = useCallback((paused: boolean) => {
    sendDirector({ type: paused ? "PAUSE" : "RESUME", reason: "reading", now: timestamp() });
  }, []);
  const gesturePause = useCallback((source: GesturePauseSource, paused: boolean) => {
    sendDirector({ type: paused ? "PAUSE" : "RESUME", reason: source, now: timestamp() });
  }, []);
  const requestAdvance = useCallback(() => {
    if (!next) return;
    const now = timestamp();
    sendDirector({ type: "RESUME", reason: "gesture", now });
    sendDirector({ type: "RESUME", reason: "surface-focus", now });
    sendDirector({ type: "REQUEST_ADVANCE", now });
  }, [next]);
  const active = director.phase === "present";
  const sceneView = (() => {
    const props = { active, paused: directorPaused, onComplete: complete, onReveal: reveal };
    switch (scene) {
      case "wake": return <WakeScene {...props} />;
      case "jealousy": return <JealousyScene {...props} />;
      case "confession": return <ConfessionScene {...props} />;
      case "privilege": return <PrivilegeScene {...props} />;
      case "signal": return <SignalScene {...props} activeId={transcript.activeId} onChannelSelected={(channelId) => dispatch({ type: "SIGNAL_CHANNEL_SET", channelId })} />;
      case "game": return <GameScene {...props} />;
      case "night": return <NightScene {...props} />;
      case "finale": return <FinaleScene {...props} finalRevealed={transcript.unlocked.includes("echo")} onRestart={() => dispatch({ type: "RESTART" })} />;
    }
  })();

  return (
    <GestureSurface enabled={director.phase === "ready" && Boolean(next)} onAdvance={requestAdvance} onPause={gesturePause}>
      <div className={`scene-stage scene-phase-${director.phase}`}>
        <ScenePanel
          scene={scene}
          fragments={fragments}
          unlocked={transcript.unlocked}
          activeId={transcript.activeId}
          onSelect={selectEcho}
          onReveal={reveal}
          onComplete={complete}
          onReadingChange={reading}
        >
          {sceneView}
        </ScenePanel>
      </div>
      {director.phase === "ready" && next ? <button type="button" className="swipe-cue" onClick={requestAdvance}>上划进入下一幕</button> : null}
    </GestureSurface>
  );
}

export function EchoExperience() {
  const [state, dispatch] = useReducer(reduceExperience, undefined, createExperience);
  const [sound, setSound] = useState(false);
  const audioEngine = useRef<AudioEngineHandle>(null);
  const autoStartPending = useRef(true);
  const soundRequestPending = useRef<Promise<boolean> | null>(null);
  const [soundFocused, setSoundFocused] = useState(false);
  const [soundPointerHeld, setSoundPointerHeld] = useState(false);
  const soundPointerOwner = useRef<{ pointerId: number; target: HTMLButtonElement } | null>(null);
  const [controlInteraction, noteControlInteraction] = useReducer((value: number) => value + 1, 0);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.visibilityState === "hidden");
  const [visual, setVisual] = useState<{ scene: SceneId; phase: DirectorPhase }>({ scene: "wake", phase: "enter" });
  const sceneIndex = sceneOrder.indexOf(state.scene);
  const cue = state.scene === "wake" || state.scene === "jealousy" ? "heartbeat" : state.scene === "confession" ? "lock" : state.scene === "finale" ? "bloom" : "reply";
  const visualPhase = visual.scene === state.scene ? visual.phase : "enter";
  const soundControlActive = soundFocused || soundPointerHeld;

  const requestSound = useCallback((automatic: boolean) => {
    if (automatic && (!autoStartPending.current || sound)) return;
    if (soundRequestPending.current) return;
    const attempt = audioEngine.current?.requestStart();
    if (!attempt) return;
    soundRequestPending.current = attempt;
    void attempt
      .then((started) => {
        if (!started) return;
        autoStartPending.current = false;
        setSound(true);
      })
      .finally(() => {
        if (soundRequestPending.current === attempt) {
          soundRequestPending.current = null;
        }
      });
  }, [sound]);

  const autoUnlockPointer = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button > 0) return;
    if (event.target instanceof Element && event.target.closest(".sound-button")) return;
    requestSound(true);
  }, [requestSound]);

  const autoUnlockKeyboard = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest(".sound-button")) return;
    if (!["Enter", " ", "ArrowUp", "ArrowLeft", "ArrowRight", "ArrowDown", "PageDown"].includes(event.key)) return;
    requestSound(true);
  }, [requestSound]);

  const autoUnlockClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest(".sound-button")) return;
    requestSound(true);
  }, [requestSound]);

  const toggleSound = useCallback(() => {
    autoStartPending.current = false;
    if (sound) setSound(false);
    else requestSound(false);
    noteControlInteraction();
  }, [requestSound, sound]);

  const releaseSoundPointer = useCallback((pointerId?: number, report = true) => {
    const owner = soundPointerOwner.current;
    if (!owner || (pointerId !== undefined && owner.pointerId !== pointerId)) return;
    soundPointerOwner.current = null;
    try {
      if (owner.target.hasPointerCapture?.(owner.pointerId) !== false) {
        owner.target.releasePointerCapture?.(owner.pointerId);
      }
    } catch {
      // Capture may already be gone after cancellation, blur, or teardown.
    }
    if (report) setSoundPointerHeld(false);
  }, []);

  const beginSoundPointer = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button > 0 || soundPointerOwner.current) return;
    soundPointerOwner.current = { pointerId: event.pointerId, target: event.currentTarget };
    setSoundPointerHeld(true);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer-up and window-blur fallbacks still balance ownership.
    }
  }, []);

  useEffect(() => {
    const updateVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const releaseForBlur = () => {
      releaseSoundPointer();
      setSoundFocused(false);
    };
    window.addEventListener("blur", releaseForBlur);
    return () => {
      window.removeEventListener("blur", releaseForBlur);
      releaseSoundPointer(undefined, false);
    };
  }, [releaseSoundPointer]);

  const reportPhase = useCallback((scene: SceneId, phase: DirectorPhase) => {
    setVisual((current) => current.scene === scene && current.phase === phase ? current : { scene, phase });
  }, []);

  return <main className={`echo-experience scene-is-${state.scene}`} aria-label="0523 回音星核" onClickCapture={autoUnlockClick} onKeyDownCapture={autoUnlockKeyboard} onPointerDownCapture={autoUnlockPointer}>
    <div className="cinematic-plate" aria-hidden="true" />
    <TwinGravityCanvas scene={state.scene} phase={visualPhase} growth={state.growth} />
    <div className="vignette" aria-hidden="true" />
    <header className="experience-header"><div className="brand"><span className="brand-mark">05·23</span><span>ECHO CORE</span></div><button className="sound-button" aria-label={sound ? "关闭声音" : "开启声音"} onBlur={() => setSoundFocused(false)} onClick={toggleSound} onFocus={() => setSoundFocused(true)} onLostPointerCapture={(event) => releaseSoundPointer(event.pointerId)} onPointerCancel={(event) => releaseSoundPointer(event.pointerId)} onPointerDown={beginSoundPointer} onPointerUp={(event) => releaseSoundPointer(event.pointerId)}>{sound ? "声场 ON" : "声场 OFF"}</button></header>
    <div className="progress-rail" aria-label={`体验进度 ${sceneIndex + 1} / 8`}><span style={{ height: `${((sceneIndex + 1) / 8) * 100}%` }} /><b>{String(sceneIndex + 1).padStart(2, "0")} / 08</b></div>
    <DirectedScene key={state.scene} state={state} dispatch={dispatch} hidden={hidden} controlFocused={soundControlActive} controlInteraction={controlInteraction} onPhaseChange={reportPhase} />
    <AudioEngine ref={audioEngine} enabled={sound} paused={hidden} finale={state.scene === "finale"} cue={cue} onPlaybackChange={(playing) => { if (!playing) setSound(false); }} />
    <div className="scene-index" aria-hidden="true">0{sceneIndex + 1}</div>
  </main>;
}
