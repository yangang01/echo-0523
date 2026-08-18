"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { finalCopy, signalChannels, type SignalChannelId } from "../../lib/content";
import type { ResponseType } from "../../lib/experience";
import { attractionProgress } from "../../lib/gestures";
import { elapsedSinceConfession } from "../../lib/relationship-time";
import { sceneTimelines, type RevealCue } from "../../lib/scene-timelines";

type BasicProps = { onComplete: () => void; onReveal: (fragmentId: string) => void; active?: boolean };

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

/** Schedules a scene's immutable timeline without coupling it to render churn. */
export function useAutomaticScene(
  cues: readonly RevealCue[],
  totalMs: number,
  onReveal: (fragmentId: string) => void,
  onComplete: () => void,
  enabled = true,
) {
  const revealRef = useRef(onReveal);
  const completeRef = useRef(onComplete);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completed = useRef(false);
  useEffect(() => { revealRef.current = onReveal; }, [onReveal]);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!enabled || completed.current) return;
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    cues.forEach((cue) => timers.current.push(setTimeout(() => revealRef.current(cue.id), cue.at)));
    timers.current.push(setTimeout(() => {
      if (completed.current) return;
      completed.current = true;
      completeRef.current();
    }, totalMs));
    return clear;
  }, [cues, enabled, totalMs]);
}

export function WakeScene({ onComplete, onReveal, active = true }: BasicProps) {
  const root = useRef<HTMLDivElement>(null);
  const ownerPointer = useRef<number | null>(null);
  const attractedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [attracted, setAttracted] = useState(false);
  const revealOnce = useRevealOnce(onReveal);

  const releaseOwner = useCallback((reset = false) => {
    const pointerId = ownerPointer.current;
    const button = root.current?.querySelector<HTMLButtonElement>(".gravity-y");
    if (pointerId !== null && button?.hasPointerCapture?.(pointerId)) button.releasePointerCapture?.(pointerId);
    ownerPointer.current = null;
    if (reset && !attractedRef.current) setProgress(0);
  }, []);

  useEffect(() => {
    const cancel = () => releaseOwner(true);
    const hidden = () => { if (document.visibilityState === "hidden") cancel(); };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
      cancel();
    };
  }, [releaseOwner]);

  useEffect(() => { if (!active) releaseOwner(true); }, [active, releaseOwner]);

  useAutomaticScene(sceneTimelines.wake.reveals, sceneTimelines.wake.presentMs, revealOnce, onComplete, active && attracted);

  const startAttraction = useCallback(() => {
    if (!active || attractedRef.current) return;
    attractedRef.current = true;
    setAttracted(true);
  }, [active]);

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

  const enabled = active && !attracted;
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
  </div>;
}

export function JealousyScene({ onComplete, onReveal, active = true }: BasicProps) {
  const [value, setValue] = useState(12);
  const completed = useRef(false);
  const completeRef = useRef(onComplete);
  const revealOnce = useRevealOnce(onReveal);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    if (value >= 35) revealOnce("praise");
    if (value >= 60) revealOnce("smile");
    if (value >= 85) revealOnce("meaning");
    if (value >= 92 && !completed.current) {
      completed.current = true;
      completeRef.current();
    }
  }, [revealOnce, value]);
  const done = value >= 92;
  return <div className="signal-scrub"><div className="waveform" style={{ "--clarity": `${value}%` } as CSSProperties}><span>{done ? "在意" : "心跳失序"}</span></div><label>向右解码<input aria-label="滑动解码心跳" type="range" min="0" max="100" value={value} disabled={!active} onChange={(event) => { if (active) setValue(Number(event.target.value)); }} /></label></div>;
}

export function ConfessionScene({ onComplete, onReveal, active = true }: BasicProps) {
  const revealOnce = useRevealOnce(onReveal);
  useAutomaticScene(sceneTimelines.confession.reveals, sceneTimelines.confession.presentMs, revealOnce, onComplete, active);
  return <div className="coordinate-lock-auto" role="img" aria-label="2026·05·23 正在自动锁定"><span>2026 · 05 · 23</span><p role="status">LOVE COORDINATE LOCKING</p></div>;
}

export function PrivilegeScene({ onComplete, onReveal, active = true }: BasicProps) {
  const revealOnce = useRevealOnce(onReveal);
  useAutomaticScene(sceneTimelines.privilege.reveals, sceneTimelines.privilege.presentMs, revealOnce, onComplete, active);
  return <div className="privilege-bloom" role="status" aria-label="偏爱轨道正在点亮"><span aria-hidden="true">{"✦\u3000✧\u3000✦"}</span><strong>偏爱轨道正在点亮</strong></div>;
}

export function SignalScene({ onResponse, onComplete, onReveal, onChannelSelected, active = true }: BasicProps & { onResponse: (type: ResponseType) => void; onChannelSelected: (channelId: SignalChannelId) => void }) {
  const [channelId, setChannelId] = useState<SignalChannelId | null>(null);
  const [heard, setHeard] = useState<ResponseType[]>([]);
  const selected = useRef(false);
  const responded = useRef(new Set<ResponseType>());
  const revealOnce = useRevealOnce(onReveal);
  const channel = useMemo(() => signalChannels.find((item) => item.id === channelId), [channelId]);
  const cues = useMemo<readonly RevealCue[]>(() => {
    if (!channel) return sceneTimelines.signal.reveals;
    return sceneTimelines.signal.reveals.map((cue) => {
      if (!cue.id.startsWith("$response:")) return cue;
      const responseIndex = Number(cue.id.slice("$response:".length));
      return { ...cue, id: channel.responses[responseIndex].type };
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
  useAutomaticScene(cues, sceneTimelines.signal.presentMs, handleCue, onComplete, active && channelId !== null);

  if (!channel) return <div className="channel-grid">{signalChannels.map((item) => <button key={item.id} disabled={!active} onClick={() => {
    if (!active || selected.current) return;
    selected.current = true;
    onChannelSelected(item.id);
    setChannelId(item.id);
  }} aria-label={item.label}><i>{item.icon}</i><span>{item.label}</span></button>)}</div>;

  return <div className="response-console" role="status"><p className="selected-channel">频道已接通 · {channel.label}</p>{channel.responses.map((item) => <p key={item.type} className={heard.includes(item.type) ? "heard" : ""}><b>{item.label}</b><span>{item.text}</span></p>)}</div>;
}

export function GameScene({ onComplete, onReveal, active = true }: BasicProps) {
  const revealOnce = useRevealOnce(onReveal);
  useAutomaticScene(sceneTimelines.game.reveals, sceneTimelines.game.presentMs, revealOnce, onComplete, active);
  return <div className="dual-stream-gates" role="status" aria-label="双人副本的三道关卡正在自动开启"><div className="light-track"><i /><i /><span /></div><span>靠近</span><span>同步</span><span>穿越</span></div>;
}

export function NightScene({ onComplete, onReveal, active = true }: BasicProps) {
  const revealOnce = useRevealOnce(onReveal);
  useAutomaticScene(sceneTimelines.night.reveals, sceneTimelines.night.presentMs, revealOnce, onComplete, active);
  return <div className="frequency-link-auto" role="img" aria-label="Y 与 U 的深夜频率正在自动同频"><span className="frequency-line" /><b>我们正在同频</b></div>;
}

export function FinaleScene({ onComplete, onReveal, onRestart, active = true }: BasicProps & { onRestart: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [echoOpen, setEchoOpen] = useState(false);
  const revealOnce = useRevealOnce(onReveal);
  const reveal = useCallback((id: string) => {
    revealOnce(id);
    if (id === "echo") setEchoOpen(true);
  }, [revealOnce]);
  useAutomaticScene(sceneTimelines.finale.reveals, sceneTimelines.finale.presentMs, reveal, onComplete, active);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const elapsed = useMemo(() => elapsedSinceConfession(now), [now]);
  return <div className="finale-copy"><div className="finale-coordinate" aria-hidden="true">05:23</div>{echoOpen ? <><p className="final-line">{finalCopy.lines[0]}<br />{finalCopy.lines[1]}</p><div className="love-clock"><span><b>{elapsed.days}</b>天</span><span><b>{elapsed.hours}</b>时</span><span><b>{elapsed.minutes}</b>分</span><span><b>{elapsed.seconds}</b>秒</span></div><p className="signature">TO {finalCopy.to}<br />FROM {finalCopy.from}<br />SINCE {finalCopy.since}</p><button className="replay-button" onClick={onRestart}>重新进入这片宇宙</button></> : <p role="status">正在汇聚回音</p>}</div>;
}
