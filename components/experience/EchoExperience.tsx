"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type Dispatch } from "react";
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
import { AudioEngine } from "./AudioEngine";
import { GestureSurface } from "./GestureSurface";
import { ScenePanel } from "./ScenePanel";
import { ConfessionScene, FinaleScene, GameScene, JealousyScene, NightScene, PrivilegeScene, SignalScene, WakeScene } from "./scenes";
import { TwinGravityCanvas } from "./TwinGravityCanvas";

type DirectedSceneProps = {
  state: ExperienceState;
  dispatch: Dispatch<ExperienceEvent>;
  hidden: boolean;
  onPhaseChange: (scene: SceneId, phase: DirectorPhase) => void;
};

function timestamp() {
  return performance.now();
}

function DirectedScene({ state, dispatch, hidden, onPhaseChange }: DirectedSceneProps) {
  const { scene } = state;
  const timeline = sceneTimelines[scene];
  const [director, sendDirector] = useReducer(reduceDirector, scene, createDirector);
  const completed = useRef(false);
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
    if (director.phase !== "enter" || director.paused.length > 0) return;
    const timer = setTimeout(() => {
      sendDirector({ type: "START_PRESENTATION", now: timestamp() });
    }, timeline.enterMs);
    return () => clearTimeout(timer);
  }, [director.paused.length, director.phase, timeline.enterMs]);

  useEffect(() => {
    if (!next || director.phase !== "ready" || director.autoAdvanceAt === null) return;
    const delay = Math.max(0, director.autoAdvanceAt - timestamp());
    const timer = setTimeout(() => {
      sendDirector({ type: "IDLE_EXPIRED", now: timestamp() });
    }, delay);
    return () => clearTimeout(timer);
  }, [director.autoAdvanceAt, director.phase, next]);

  useEffect(() => {
    if (!next || director.phase !== "exit" || director.paused.length > 0) return;
    const from = scene;
    const timer = setTimeout(() => {
      dispatch({ type: "ADVANCE_TO", from, to: next });
    }, timeline.exitMs);
    return () => clearTimeout(timer);
  }, [director.advanceToken, director.paused.length, director.phase, dispatch, next, scene, timeline.exitMs]);

  const complete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    dispatch({ type: "SCENE_COMPLETE", scene });
    sendDirector({ type: "PRESENTATION_COMPLETE", now: timestamp() });
  }, [dispatch, scene]);
  const reveal = useCallback((fragmentId: string) => {
    dispatch({ type: "ECHO_REVEAL", scene, fragmentId });
  }, [dispatch, scene]);
  const selectEcho = useCallback((fragmentId: string) => {
    dispatch({ type: "ECHO_SELECT", scene, fragmentId });
  }, [dispatch, scene]);
  const reading = useCallback((paused: boolean) => {
    sendDirector({ type: paused ? "PAUSE" : "RESUME", reason: "reading", now: timestamp() });
  }, []);
  const requestAdvance = useCallback(() => {
    if (!next) return;
    const now = timestamp();
    // GestureSurface pauses while it measures a swipe. Resume that semantic
    // gesture before requesting exit so the reducer sees one atomic intent.
    sendDirector({ type: "RESUME", reason: "reading", now });
    sendDirector({ type: "REQUEST_ADVANCE", now });
  }, [next]);

  const active = director.phase === "present" && director.paused.length === 0;
  const sceneView = (() => {
    const props = { active, onComplete: complete, onReveal: reveal };
    switch (scene) {
      case "wake": return <WakeScene {...props} />;
      case "jealousy": return <JealousyScene {...props} />;
      case "confession": return <ConfessionScene {...props} />;
      case "privilege": return <PrivilegeScene {...props} />;
      case "signal": return <SignalScene {...props} onResponse={(response) => dispatch({ type: "RESPONSE_SELECTED", response })} onChannelSelected={(channelId) => dispatch({ type: "SIGNAL_CHANNEL_SET", channelId })} />;
      case "game": return <GameScene {...props} />;
      case "night": return <NightScene {...props} />;
      case "finale": return <FinaleScene {...props} onRestart={() => dispatch({ type: "RESTART" })} />;
    }
  })();

  return (
    <GestureSurface enabled={director.phase === "ready" && Boolean(next)} onAdvance={requestAdvance} onPause={reading}>
      <div className={`scene-stage scene-phase-${director.phase}`}>
        <ScenePanel
          scene={scene}
          fragments={fragments}
          unlocked={transcript.unlocked}
          activeId={transcript.activeId}
          onSelect={selectEcho}
          onReadingChange={reading}
        >
          {sceneView}
        </ScenePanel>
      </div>
      {director.phase === "ready" && next ? <div className="swipe-cue" aria-hidden="true">向上划过星轨</div> : null}
    </GestureSurface>
  );
}

export function EchoExperience() {
  const [state, dispatch] = useReducer(reduceExperience, undefined, createExperience);
  const [sound, setSound] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.visibilityState === "hidden");
  const [visual, setVisual] = useState<{ scene: SceneId; phase: DirectorPhase }>({ scene: "wake", phase: "enter" });
  const sceneIndex = sceneOrder.indexOf(state.scene);
  const cue = state.scene === "wake" || state.scene === "jealousy" ? "heartbeat" : state.scene === "confession" ? "lock" : state.scene === "finale" ? "bloom" : "reply";
  const visualPhase = visual.scene === state.scene ? visual.phase : "enter";

  useEffect(() => {
    const updateVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  const reportPhase = useCallback((scene: SceneId, phase: DirectorPhase) => {
    setVisual((current) => current.scene === scene && current.phase === phase ? current : { scene, phase });
  }, []);

  return <main className={`echo-experience scene-is-${state.scene}`} aria-label="0523 回音星核">
    <div className="cinematic-plate" aria-hidden="true" />
    <TwinGravityCanvas scene={state.scene} phase={visualPhase} growth={state.growth} />
    <div className="vignette" aria-hidden="true" />
    <header className="experience-header"><div className="brand"><span className="brand-mark">05·23</span><span>ECHO CORE</span></div><button className="sound-button" aria-label={sound ? "关闭声音" : "开启声音"} onClick={() => setSound((value) => !value)}>{sound ? "声场 ON" : "声场 OFF"}</button></header>
    <div className="progress-rail" aria-label={`体验进度 ${sceneIndex + 1} / 8`}><span style={{ height: `${((sceneIndex + 1) / 8) * 100}%` }} /><b>{String(sceneIndex + 1).padStart(2, "0")} / 08</b></div>
    <DirectedScene key={state.scene} state={state} dispatch={dispatch} hidden={hidden} onPhaseChange={reportPhase} />
    <AudioEngine enabled={sound} paused={hidden} cue={cue} />
    <div className="scene-index" aria-hidden="true">0{sceneIndex + 1}</div>
  </main>;
}
