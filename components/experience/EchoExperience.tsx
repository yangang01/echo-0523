"use client";

import { useCallback, useMemo, useReducer, useState } from "react";
import { sceneEchoes, signalChannels } from "../../lib/content";
import { createExperience, reduceExperience, sceneOrder, type SceneId } from "../../lib/experience";
import { AudioEngine } from "./AudioEngine";
import { EchoCoreCanvas } from "./EchoCoreCanvas";
import { ScenePanel } from "./ScenePanel";
import { ConfessionScene, FinaleScene, GameScene, JealousyScene, NightScene, PrivilegeScene, SignalScene, WakeScene } from "./scenes";

export function EchoExperience() {
  const [state, dispatch] = useReducer(reduceExperience, undefined, createExperience);
  const [sound, setSound] = useState(false);
  const complete = useCallback((scene: SceneId) => dispatch({ type: "SCENE_COMPLETE", scene }), []);
  const reveal = useCallback((fragmentId: string) => dispatch({ type: "ECHO_REVEAL", scene: state.scene, fragmentId }), [state.scene]);
  const selectEcho = useCallback((fragmentId: string) => dispatch({ type: "ECHO_SELECT", scene: state.scene, fragmentId }), [state.scene]);
  const isComplete = state.completed.includes(state.scene);
  const transcript = state.transcript[state.scene];
  const fragments = state.scene === "signal"
    ? signalChannels.find((channel) => channel.id === state.signalChannelId)?.echoes ?? []
    : sceneEchoes[state.scene];
  const finaleOpen = state.transcript.finale.unlocked.includes("echo");
  const sceneIndex = sceneOrder.indexOf(state.scene);
  const cue = state.scene === "wake" || state.scene === "jealousy" ? "heartbeat" : state.scene === "confession" ? "lock" : state.scene === "finale" ? "bloom" : "reply";
  const scene = useMemo(() => {
    const props = { onComplete: () => complete(state.scene), onReveal: reveal };
    switch (state.scene) {
      case "wake": return <WakeScene {...props} />;
      case "jealousy": return <JealousyScene {...props} />;
      case "confession": return <ConfessionScene {...props} />;
      case "privilege": return <PrivilegeScene {...props} />;
      case "signal": return <SignalScene {...props} onResponse={(response) => dispatch({ type: "RESPONSE_SELECTED", response })} onChannelSelected={(channelId) => dispatch({ type: "SIGNAL_CHANNEL_SET", channelId })} />;
      case "game": return <GameScene {...props} />;
      case "night": return <NightScene {...props} />;
      case "finale": return <FinaleScene {...props} onRestart={() => dispatch({ type: "RESTART" })} />;
    }
  }, [complete, reveal, state.scene]);

  return <main className={`echo-experience scene-is-${state.scene}`} aria-label="0523 回音星核">
    <div className="cinematic-plate" aria-hidden="true" />
    <EchoCoreCanvas scene={state.scene} growth={state.growth} finaleOpen={finaleOpen} />
    <div className="vignette" aria-hidden="true" />
    <header className="experience-header"><div className="brand"><span className="brand-mark">05·23</span><span>ECHO CORE</span></div><button className="sound-button" aria-label={sound ? "关闭声音" : "开启声音"} onClick={() => setSound((value) => !value)}>{sound ? "声场 ON" : "声场 OFF"}</button></header>
    <div className="progress-rail" aria-label={`体验进度 ${sceneIndex + 1} / 8`}><span style={{ height: `${((sceneIndex + 1) / 8) * 100}%` }} /><b>{String(sceneIndex + 1).padStart(2, "0")} / 08</b></div>
    <div className="scene-stage" key={state.scene}><ScenePanel scene={state.scene} fragments={fragments} unlocked={transcript.unlocked} activeId={transcript.activeId} onSelect={selectEcho}>{scene}{isComplete && state.scene !== "finale" ? <button className="next-scene" onClick={() => dispatch({ type: "NEXT" })}>继续航行 <span>→</span></button> : null}</ScenePanel></div>
    <AudioEngine enabled={sound} cue={cue} />
    <div className="scene-index" aria-hidden="true">0{sceneIndex + 1}</div>
  </main>;
}
