"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { finalCopy, signalChannels, type SignalChannel, type SignalChannelId } from "../../lib/content";
import type { ResponseType } from "../../lib/experience";
import { attractionProgress } from "../../lib/gestures";
import { elapsedSinceConfession } from "../../lib/relationship-time";
import { sceneTimelines, type RevealCue } from "../../lib/scene-timelines";

type BasicProps = { onComplete: () => void; onReveal: (fragmentId: string) => void; active?: boolean; paused?: boolean };

function useRevealOnce(onReveal: (fragmentId: string) => void) {
  const revealed = useRef(new Set<string>());
  const onRevealRef = useRef(onReveal);
  useEffect(() => { onRevealRef.current = onReveal; }, [onReveal]);
  return useCallback((fragmentId: string) => {
    if (revealed.current.has(fragmentId)) return;
    revealed.current.add(fragmentId);
    onRevealRef.current(fragmentId);
  }, []);
}

export function useManualScene(
  cues: readonly RevealCue[],
  onReveal: (fragmentId: string) => void,
  onComplete: () => void,
  enabled = true,
  paused = false,
) {
  const revealRef = useRef(onReveal);
  const completeRef = useRef(onComplete);
  const completed = useRef(false);
  const [index, setIndex] = useState(0);
  const [finalRevealed, setFinalRevealed] = useState(false);
  const [completedState, setCompletedState] = useState(false);
  useEffect(() => { revealRef.current = onReveal; }, [onReveal]);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  const advance = useCallback(() => {
    if (!enabled || paused || completed.current) return;
    if (finalRevealed) {
      completed.current = true;
      setCompletedState(true);
      completeRef.current();
      return;
    }
    if (index >= cues.length) return;
    const cue = cues[index];
    revealRef.current(cue.id);
    if (index === cues.length - 1) {
      setFinalRevealed(true);
      return;
    }
    setIndex((current) => current + 1);
  }, [cues, enabled, finalRevealed, index, paused]);
  return {
    advance,
    canAdvance: enabled && !paused && !completedState && (index < cues.length || finalRevealed),
    label: finalRevealed ? "进入下一幕" : "读取下一段",
  };
}

function ManualStepButton({ advance, canAdvance, label }: ReturnType<typeof useManualScene>) {
  return <button type="button" className="scene-step" disabled={!canAdvance} onClick={advance}>{label}</button>;
}

export function WakeScene({ onComplete, onReveal, active = true, paused = false }: BasicProps) {
  const root = useRef<HTMLDivElement>(null);
  const ownerPointer = useRef<number | null>(null);
  const attractedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [attracted, setAttracted] = useState(false);
  const revealOnce = useRevealOnce(onReveal);

  const releaseOwner = useCallback((reset = false, updateState = true) => {
    const pointerId = ownerPointer.current;
    const button = root.current?.querySelector<HTMLButtonElement>(".gravity-y");
    try {
      if (pointerId !== null && button?.hasPointerCapture?.(pointerId)) button.releasePointerCapture?.(pointerId);
    } catch {
      // Pointer capture can be implicitly released by the browser before teardown.
    } finally {
      ownerPointer.current = null;
    }
    if (reset && updateState && !attractedRef.current) setProgress(0);
  }, []);

  useEffect(() => {
    const cancel = () => releaseOwner(true);
    const hidden = () => { if (document.visibilityState === "hidden") cancel(); };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
      releaseOwner(false, false);
    };
  }, [releaseOwner]);

  useEffect(() => { if (!active || paused) releaseOwner(true); }, [active, paused, releaseOwner]);

  const manual = useManualScene(sceneTimelines.wake.reveals, revealOnce, onComplete, active && attracted, paused);

  const startAttraction = useCallback(() => {
    if (!active || paused || attractedRef.current) return;
    attractedRef.current = true;
    setAttracted(true);
  }, [active, paused]);

  const move = useCallback((clientX: number, clientY: number) => {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds || attractedRef.current) return;
    const target = { x: bounds.left + bounds.width * 0.64, y: bounds.top + bounds.height * 0.48 };
    const result = attractionProgress({ x: clientX, y: clientY }, target, Math.max(34, bounds.width * 0.1));
    setProgress(result.progress);
    if (result.attracted) {
      attractedRef.current = true;
      setAttracted(true);
    }
  }, []);

  const enabled = active && !paused && !attracted;
  return <div ref={root} className="gravity-intro" style={{ "--attraction": progress } as CSSProperties}>
    <button
      className="gravity-y"
      aria-label="把 Y 靠近 U"
      disabled={!enabled}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (!enabled || (event.button !== undefined && event.button !== 0) || event.isPrimary === false || ownerPointer.current !== null) return;
        ownerPointer.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (ownerPointer.current === event.pointerId) move(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => { if (ownerPointer.current === event.pointerId) releaseOwner(false); }}
      onPointerCancel={(event) => { if (ownerPointer.current === event.pointerId) releaseOwner(true); }}
      onLostPointerCapture={(event) => { if (ownerPointer.current === event.pointerId) releaseOwner(true); }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        startAttraction();
      }}
    >Y</button>
    <span className="gravity-u" aria-hidden="true">U</span>
    <p>拖动 Y，靠近 U</p>
    <ManualStepButton {...manual} />
  </div>;
}

export function JealousyScene({ onComplete, onReveal, active = true, paused = false }: BasicProps) {
  const [value, setValue] = useState(12);
  const revealOnce = useRevealOnce(onReveal);
  const done = value >= 92;
  const manual = useManualScene(sceneTimelines.jealousy.reveals, revealOnce, onComplete, active && done, paused);
  return <div className="signal-scrub"><div className="waveform" style={{ "--clarity": `${value}%` } as CSSProperties}><span>{done ? "在意" : "心跳失序"}</span></div><label>向右解码<input aria-label="滑动解码心跳" type="range" min="0" max="100" value={value} disabled={!active || paused} onChange={(event) => { if (active && !paused) setValue(Number(event.target.value)); }} /></label><ManualStepButton {...manual} /></div>;
}

export function ConfessionScene({ onComplete, onReveal, active = true, paused = false }: BasicProps) {
  const revealOnce = useRevealOnce(onReveal);
  const manual = useManualScene(sceneTimelines.confession.reveals, revealOnce, onComplete, active, paused);
  return <div className="coordinate-lock-auto" role="img" aria-label="2026·05·23 正在锁定"><span>2026 · 05 · 23</span><p role="status">LOVE COORDINATE LOCKING</p><ManualStepButton {...manual} /></div>;
}

export function PrivilegeScene({ onComplete, onReveal, active = true, paused = false }: BasicProps) {
  const revealOnce = useRevealOnce(onReveal);
  const manual = useManualScene(sceneTimelines.privilege.reveals, revealOnce, onComplete, active, paused);
  return <div className="privilege-bloom" role="status" aria-label="偏爱轨道正在点亮"><span aria-hidden="true">{"✦\u3000✧\u3000✦"}</span><strong>偏爱轨道正在点亮</strong><ManualStepButton {...manual} /></div>;
}

export function resolveSignalCue(cue: RevealCue, channel: SignalChannel): RevealCue | null {
  if (!cue.id.startsWith("$response:")) return cue;
  const responseIndex = Number(cue.id.slice("$response:".length));
  if (!Number.isInteger(responseIndex) || responseIndex < 0 || responseIndex >= channel.responses.length) return null;
  return { ...cue, id: channel.responses[responseIndex].type };
}

export function SignalScene({ onResponse, onComplete, onReveal, onChannelSelected, active = true, paused = false }: BasicProps & { onResponse: (type: ResponseType) => void; onChannelSelected: (channelId: SignalChannelId) => void }) {
  const [channelId, setChannelId] = useState<SignalChannelId | null>(null);
  const [heard, setHeard] = useState<ResponseType[]>([]);
  const selected = useRef(false);
  const responded = useRef(new Set<ResponseType>());
  const revealOnce = useRevealOnce(onReveal);
  const channel = useMemo(() => signalChannels.find((item) => item.id === channelId), [channelId]);
  const cues = useMemo<readonly RevealCue[]>(() => {
    if (!channel) return sceneTimelines.signal.reveals;
    return sceneTimelines.signal.reveals.flatMap((cue) => {
      const resolved = resolveSignalCue(cue, channel);
      return resolved ? [resolved] : [];
    });
  }, [channel]);
  const handleCue = useCallback((id: string) => {
    if (id === "curious" || id === "compliment" || id === "ally") {
      if (responded.current.has(id)) return;
      responded.current.add(id);
      onResponse(id);
      setHeard((current) => current.includes(id) ? current : [...current, id]);
    }
    revealOnce(id);
  }, [onResponse, revealOnce]);
  const manual = useManualScene(cues, handleCue, onComplete, active && channelId !== null, paused);

  if (!channel) return <div className="channel-grid">{signalChannels.map((item) => <button key={item.id} disabled={!active || paused} onClick={() => {
    if (!active || paused || selected.current) return;
    selected.current = true;
    onChannelSelected(item.id);
    setChannelId(item.id);
  }} aria-label={item.label}><i>{item.icon}</i><span>{item.label}</span></button>)}</div>;

  const latest = channel.responses.findLast((item) => heard.includes(item.type));
  return <div className="response-console"><p className="selected-channel">频道已接通 · {channel.label}</p><div className="response-live" role="status" aria-live="polite">{latest ? <><b>{latest.label}</b><span>{latest.text}</span></> : null}</div><ManualStepButton {...manual} /></div>;
}

export function GameScene({ onComplete, onReveal, active = true, paused = false }: BasicProps) {
  const revealOnce = useRevealOnce(onReveal);
  const manual = useManualScene(sceneTimelines.game.reveals, revealOnce, onComplete, active, paused);
  return <div className="dual-stream-gates" role="status" aria-label="双人副本的三道关卡等待手动开启"><div className="light-track"><i /><i /><span /></div><span>靠近</span><span>同步</span><span>穿越</span><ManualStepButton {...manual} /></div>;
}

export function NightScene({ onComplete, onReveal, active = true, paused = false }: BasicProps) {
  const revealOnce = useRevealOnce(onReveal);
  const manual = useManualScene(sceneTimelines.night.reveals, revealOnce, onComplete, active, paused);
  return <div className="frequency-link-auto" role="img" aria-label="Y 与 U 的深夜频率等待手动同频"><span className="frequency-line" /><b>我们正在同频</b><ManualStepButton {...manual} /></div>;
}

export function FinaleScene({ onComplete, onReveal, onRestart, active = true, paused = false }: BasicProps & { onRestart: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [echoOpen, setEchoOpen] = useState(false);
  const revealOnce = useRevealOnce(onReveal);
  const reveal = useCallback((id: string) => {
    revealOnce(id);
    if (id === "echo") setEchoOpen(true);
  }, [revealOnce]);
  const manual = useManualScene(sceneTimelines.finale.reveals, reveal, onComplete, active, paused);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = useMemo(() => elapsedSinceConfession(now), [now]);
  return <div className="finale-copy"><div className="finale-coordinate" aria-hidden="true">05:23</div><div className="love-clock"><span><b>{elapsed.days}</b>天</span><span><b>{elapsed.hours}</b>时</span><span><b>{elapsed.minutes}</b>分</span><span><b>{elapsed.seconds}</b>秒</span></div>{echoOpen ? <><p className="final-line">{finalCopy.lines[0]}<br />{finalCopy.lines[1]}</p><p className="signature">TO {finalCopy.to}<br />FROM {finalCopy.from}<br />SINCE {finalCopy.since}</p><ManualStepButton {...manual} /><button className="replay-button" onClick={onRestart}>重新进入这片宇宙</button></> : <><p role="status">正在汇聚回音</p><ManualStepButton {...manual} /></>}</div>;
}
